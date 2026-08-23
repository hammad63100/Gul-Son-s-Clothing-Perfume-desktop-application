/**
 * Thermal Printer Module — Silent Print via Hidden BrowserWindow
 *
 * Renders receipt HTML in a hidden off-screen BrowserWindow and prints it
 * directly to the configured thermal printer using Electron's
 * webContents.print() API. No Save dialog, no system print dialog.
 *
 * Designed for the BT-801 80mm Portable Mini Bluetooth Thermal Receipt Printer.
 */

const { BrowserWindow } = require('electron');
const { generateReceiptHTML, generateTestReceiptHTML } = require('./receipt-template');

/**
 * Print a receipt silently to the configured thermal printer.
 *
 * @param {Object} saleData - The full sale object (with .items array)
 * @param {Object} settings - Shop settings (shop_name, shop_address, etc.)
 * @param {string} printerName - The system printer name (e.g. 'BT-801')
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function printReceipt(saleData, settings, printerName) {
  const html = generateReceiptHTML(saleData, settings);
  return await printHTML(html, printerName);
}

/**
 * Print a test page to verify printer connectivity.
 *
 * @param {Object} settings - Shop settings
 * @param {string} printerName - The system printer name
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function printTestPage(settings, printerName) {
  const html = generateTestReceiptHTML(settings);
  return await printHTML(html, printerName);
}

/**
 * Get list of available printers from the system.
 *
 * @returns {Promise<Array<{name: string, isDefault: boolean, status: number}>>}
 */
async function getAvailablePrinters() {
  // We need a BrowserWindow to query printers. Reuse the focused window if
  // available, otherwise create a temporary hidden one.
  let win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  let tempWin = null;

  if (!win) {
    tempWin = new BrowserWindow({ show: false, width: 1, height: 1 });
    win = tempWin;
  }

  try {
    let printers = [];
    if (typeof win.webContents.getPrintersAsync === 'function') {
      printers = await win.webContents.getPrintersAsync();
    } else if (typeof win.webContents.getPrinters === 'function') {
      printers = win.webContents.getPrinters();
    }
    return (printers || []).map(p => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault,
      status: p.status,
      description: p.description || '',
    }));
  } finally {
    if (tempWin) {
      tempWin.destroy();
    }
  }
}

/**
 * Internal: renders HTML in a hidden window and prints it.
 */
function printHTML(html, printerName) {
  return new Promise((resolve, reject) => {
    let printWindow = null;
    let settled = false;

    // Safety timeout — if printing hangs for more than 30 seconds, clean up
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        if (printWindow && !printWindow.isDestroyed()) {
          printWindow.destroy();
        }
        reject(new Error('Print operation timed out after 30 seconds'));
      }
    }, 30000);

    try {
      // Create a hidden off-screen window for rendering the receipt
      printWindow = new BrowserWindow({
        show: false,
        width: 302,          // 80mm at 96 DPI ≈ 302px
        height: 800,         // Tall enough for any receipt
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          // Disable features we don't need
          webgl: false,
          images: true,
        },
      });

      // Load the receipt HTML as a data URI
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);

      printWindow.loadURL(dataUrl);

      printWindow.webContents.on('did-finish-load', () => {
        // Small delay to ensure CSS/layout is fully computed before printing
        setTimeout(() => {
          if (settled) return;

          const printOptions = {
            silent: true,               // No system print dialog
            printBackground: true,      // Print background colors/borders
            margins: {
              marginType: 'none',       // No extra margins — receipt CSS handles padding
            },
            scaleFactor: 100,           // No scaling
            pageSize: {
              width: 80000,             // 80mm in microns
              height: 297000,           // Max height in microns (auto-trimmed by content)
            },
          };

          // If a specific printer is configured, target it
          if (printerName && printerName.trim()) {
            printOptions.deviceName = printerName.trim();
          }

          printWindow.webContents.print(printOptions, (success, failureReason) => {
            clearTimeout(timeout);
            if (settled) return;
            settled = true;

            // Clean up the hidden window
            if (printWindow && !printWindow.isDestroyed()) {
              printWindow.destroy();
            }

            if (success) {
              resolve({
                success: true,
                message: `Receipt printed successfully${printerName ? ` on ${printerName}` : ''}`,
              });
            } else {
              reject(new Error(
                failureReason || 'Print failed. Check printer connection and try again.'
              ));
            }
          });
        }, 300); // 300ms layout settling delay
      });

      // Handle load errors
      printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;

        if (printWindow && !printWindow.isDestroyed()) {
          printWindow.destroy();
        }
        reject(new Error(`Failed to render receipt: ${errorDescription} (code ${errorCode})`));
      });

    } catch (err) {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        if (printWindow && !printWindow.isDestroyed()) {
          printWindow.destroy();
        }
        reject(err);
      }
    }
  });
}

module.exports = { printReceipt, printTestPage, getAvailablePrinters };
