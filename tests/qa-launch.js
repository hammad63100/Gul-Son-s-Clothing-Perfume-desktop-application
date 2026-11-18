// Disposable desktop instance for manual UI QA; never opens production data.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gulsons-ui-qa-'));
const log = (...args) => fs.appendFileSync(path.join(dir, 'qa-ui.log'), args.join(' ') + '\n');
process.on('uncaughtException', e => log(e.stack));
process.on('unhandledRejection', e => log(e.stack || e));
app.setPath('userData', dir);
app.whenReady().then(async () => {
  const db = await require('../src/database/init').initDatabase(path.join(dir, 'qa.db'));
  db.prepare("UPDATE settings SET value = 'false' WHERE key = 'auto_print_receipt'").run();
  require('../src/database/products').productsDB(db).add({name:'QA Seed Fabric',category:'Clothes',size:'Meter',quantity:10,purchase_price:60,sale_price:100});
  require('../src/ipc/handlers').registerHandlers(db, ipcMain);
  log('Handlers registered');
  const win = new BrowserWindow({width:1400,height:900,minWidth:1100,minHeight:700,frame:false,webPreferences:{preload:path.join(__dirname,'../preload.js'),contextIsolation:true,nodeIntegration:false}});
  ipcMain.on('window:minimize',()=>win.minimize());
  ipcMain.on('window:maximize',()=>win.isMaximized()?win.unmaximize():win.maximize());
  ipcMain.on('window:close',()=>win.close());
  win.webContents.on('console-message', (_e,level,message)=>{if(level>=2) log('RENDERER:',message);});
  win.webContents.on('preload-error', (_e, p, e) => log('PRELOAD:', p, e.stack));
  await win.loadFile(path.join(__dirname,'../renderer/index.html'));
  log('QA database:',dir);
  app.on('before-quit',()=>db.close());
});
app.on('window-all-closed',()=>app.quit());
