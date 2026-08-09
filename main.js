const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { initDatabase } = require('./src/database/init');
const { registerHandlers } = require('./src/ipc/handlers');

let mainWindow;
let db;
let hasSingleInstanceLock = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: '#0a0e1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'renderer', 'assets', 'icon.ico'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // ─── Window control IPC ───
  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window:close', async () => {
    const settings = db.prepare('SELECT value FROM settings WHERE key = ?').get('backup_reminder');
    const backupReminder = settings ? settings.value === 'true' : true;

    if (backupReminder) {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Close', 'Backup & Close', 'Cancel'],
        defaultId: 1,
        title: 'Backup Reminder',
        message: 'Have you taken a backup today?',
        detail: 'It is recommended to backup your data regularly to prevent data loss.',
      });

      if (response === 0) {
        mainWindow.destroy();
      } else if (response === 1) {
        try {
          const { backupDatabase } = require('./src/backup/backup');
          await backupDatabase(db);
          mainWindow.destroy();
        } catch (err) {
          await dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Backup Failed',
            message: `Backup failed: ${err.message}. The app will still close.`,
          });
          mainWindow.destroy();
        }
      }
      // response === 2 (Cancel) — do nothing
    } else {
      mainWindow.destroy();
    }
  });
}

app.whenReady().then(async () => {
  // Running two copies against the same sql.js database lets the last copy
  // overwrite the first copy's in-memory state. Keep one owner of the file.
  hasSingleInstanceLock = app.requestSingleInstanceLock();
  if (!hasSingleInstanceLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  // Initialize database (supports native node:sqlite, better-sqlite3, or WASM sql.js)
  db = await initDatabase();

  // Register all IPC handlers
  registerHandlers(db, ipcMain);

  // Create window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (db) {
    db.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
