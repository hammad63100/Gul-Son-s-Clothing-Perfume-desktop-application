const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const ExcelJS = require('exceljs');

async function backupDatabase(db) {
  // Get backup path from settings
  const row = db.prepare("SELECT value FROM settings WHERE key = 'backup_path'").get();
  let backupPath = row ? row.value : '';

  if (!backupPath) {
    // Ask user to select backup folder
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Backup Location',
    });

    if (result.canceled || result.filePaths.length === 0) {
      throw new Error('No backup location selected');
    }

    backupPath = result.filePaths[0];
    db.prepare("UPDATE settings SET value = ? WHERE key = 'backup_path'").run(backupPath);
  }

  // Copy database file
  const dbPath = path.join(app.getPath('userData'), 'gulsons.db');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
  const backupFileName = `gulsons_backup_${timestamp[0]}_${timestamp[1].substring(0, 8)}.db`;
  const destPath = path.join(backupPath, backupFileName);

  // Use WAL checkpoint before backup to ensure all data is written
  try {
    db.pragma('wal_checkpoint(FULL)');
  } catch (e) {
    // ignore if pragma not supported
  }

  fs.copyFileSync(dbPath, destPath);

  return { success: true, path: destPath };
}

async function exportAllToExcel(db, filePath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gul Son's Shop Manager";
  workbook.created = new Date();

  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };

  // ─── Products Sheet ───
  const productsSheet = workbook.addWorksheet('Products');
  const productHeaders = ['ID', 'Name', 'Category', 'Size', 'Color', 'Barcode', 'Purchase Price', 'Sale Price', 'Quantity', 'Supplier', 'Status', 'Created'];
  const prodHeaderRow = productsSheet.addRow(productHeaders);
  prodHeaderRow.eachCell(cell => Object.assign(cell, headerStyle));

  const products = db.prepare('SELECT * FROM products ORDER BY id').all();
  for (const p of products) {
    productsSheet.addRow([p.id, p.name, p.category, p.size || '', p.color || '', p.barcode || '', p.purchase_price, p.sale_price, p.quantity, p.supplier || '', p.is_active ? 'Active' : 'Discontinued', p.created_at]);
  }
  productsSheet.columns.forEach(col => { col.width = 16; });

  // ─── Sales Sheet ───
  const salesSheet = workbook.addWorksheet('Sales');
  const saleHeaders = ['ID', 'Invoice No', 'Customer', 'Phone', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment', 'Date'];
  const saleHeaderRow = salesSheet.addRow(saleHeaders);
  saleHeaderRow.eachCell(cell => Object.assign(cell, headerStyle));

  const salesData = db.prepare('SELECT * FROM sales ORDER BY id').all();
  for (const s of salesData) {
    salesSheet.addRow([s.id, s.invoice_no, s.customer_name || '', s.customer_phone || '', s.subtotal, s.discount_amount, s.tax_amount, s.total_amount, s.payment_method, s.created_at]);
  }
  salesSheet.columns.forEach(col => { col.width = 16; });

  // ─── Sale Items Sheet ───
  const itemsSheet = workbook.addWorksheet('Sale Items');
  const itemHeaders = ['ID', 'Sale ID', 'Product', 'Size', 'Color', 'Qty', 'Price', 'Total'];
  const itemHeaderRow = itemsSheet.addRow(itemHeaders);
  itemHeaderRow.eachCell(cell => Object.assign(cell, headerStyle));

  const items = db.prepare('SELECT * FROM sale_items ORDER BY id').all();
  for (const i of items) {
    itemsSheet.addRow([i.id, i.sale_id, i.product_name, i.product_size || '', i.product_color || '', i.quantity, i.price_at_sale, i.line_total]);
  }
  itemsSheet.columns.forEach(col => { col.width = 16; });

  // ─── Customers Sheet ───
  const customersSheet = workbook.addWorksheet('Customers');
  const custHeaders = ['ID', 'Name', 'Phone', 'Total Purchases', 'Visits', 'Last Visit', 'Created'];
  const custHeaderRow = customersSheet.addRow(custHeaders);
  custHeaderRow.eachCell(cell => Object.assign(cell, headerStyle));

  const customersData = db.prepare('SELECT * FROM customers ORDER BY id').all();
  for (const c of customersData) {
    customersSheet.addRow([c.id, c.name, c.phone || '', c.total_purchases, c.visit_count, c.last_visit || '', c.created_at]);
  }
  customersSheet.columns.forEach(col => { col.width = 16; });

  // ─── Returns Sheet ───
  const returnsSheet = workbook.addWorksheet('Returns');
  const retHeaders = ['ID', 'Sale ID', 'Invoice', 'Product', 'Qty', 'Refund', 'Reason', 'Date'];
  const retHeaderRow = returnsSheet.addRow(retHeaders);
  retHeaderRow.eachCell(cell => Object.assign(cell, headerStyle));

  const returnsData = db.prepare('SELECT * FROM returns ORDER BY id').all();
  for (const r of returnsData) {
    returnsSheet.addRow([r.id, r.sale_id, r.sale_invoice_no || '', r.product_name, r.quantity, r.refund_amount, r.reason || '', r.created_at]);
  }
  returnsSheet.columns.forEach(col => { col.width = 16; });

  await workbook.xlsx.writeFile(filePath);
  return { success: true, path: filePath };
}

module.exports = { backupDatabase, exportAllToExcel };
