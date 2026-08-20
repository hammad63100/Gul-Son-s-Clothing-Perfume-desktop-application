const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('../src/database/init');
const {
  backupDatabase,
  exportAllToJson,
  exportAllToExcel,
  inspectBackupFile,
  restoreDatabase,
  getSafetyBackupsList
} = require('../src/backup/backup');

async function runTest() {
  console.log('--- Starting Backup & Restore Automation Test ---');

  const testDbDir = path.join(__dirname, 'scratch_test_db');
  if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });

  const testDbPath = path.join(testDbDir, 'test_gulsons.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  // 1. Initialize Test Database
  const db = await initDatabase(testDbPath);
  console.log('1. Database initialized successfully');

  // 2. Insert sample products, sales, sale_items, expenses, customers, suppliers
  const insertProd = db.prepare(`
    INSERT INTO products (name, category, brand, size, color, purchase_price, sale_price, quantity, barcode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertProd.run('Embroidered Kurta', 'Clothes', 'Gul Ahmed', 'L', 'Navy Blue', 2500, 4500, 15, '123456789012');
  insertProd.run('Oud Sublime EDP 50ml', 'Perfume', 'Lattafa', '50ml', 'Gold', 3000, 5800, 10, '987654321098');
  insertProd.run('Cotton Vest Pack of 3', 'Hosiery', 'J.', 'XL', 'White', 800, 1500, 25, '112233445566');

  const insertExp = db.prepare(`
    INSERT INTO expenses (title, category, amount, payment_method, date, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertExp.run('Shop Rent August', 'Shop Rent', 35000, 'Cash', '2026-08-01', 'Monthly shop rent paid in cash');
  insertExp.run('Electricity Bill', 'Electricity', 8200, 'Bank Transfer', '2026-08-10', 'August MEPCO Bill');

  const insertCust = db.prepare(`
    INSERT INTO customers (name, phone, address, total_purchases, visit_count)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertCust.run('Hammad Khan', '03001234567', 'Shop #12 Main Market', 11800, 3);

  const insertSale = db.prepare(`
    INSERT INTO sales (invoice_no, customer_name, customer_phone, subtotal, discount_amount, total_amount, payment_method)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertSale.run('GS-1001', 'Hammad Khan', '03001234567', 10300, 300, 10000, 'Cash');

  const insertItem = db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, product_name, product_size, product_color, quantity, price_at_sale, line_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertItem.run(1, 1, 'Embroidered Kurta', 'L', 'Navy Blue', 1, 4500, 4500);
  insertItem.run(1, 2, 'Oud Sublime EDP 50ml', '50ml', 'Gold', 1, 5800, 5800);

  console.log('2. Sample records inserted');

  // 3. Test JSON Export
  const jsonExportPath = path.join(testDbDir, 'test_export.json');
  const jsonResult = await exportAllToJson(db, jsonExportPath);
  assert.strictEqual(jsonResult.success, true);
  assert.strictEqual(fs.existsSync(jsonExportPath), true);
  console.log('3. JSON Export succeeded:', jsonResult.summary);
  assert.strictEqual(jsonResult.summary.products >= 3, true);
  assert.strictEqual(jsonResult.summary.expenses >= 2, true);
  assert.strictEqual(jsonResult.summary.sales >= 1, true);

  // 4. Test Backup Inspection for JSON
  const jsonInspection = await inspectBackupFile(jsonExportPath);
  assert.strictEqual(jsonInspection.valid, true);
  assert.strictEqual(jsonInspection.type, 'json');
  assert.strictEqual(jsonInspection.stats.products >= 3, true);
  assert.strictEqual(jsonInspection.stats.expenses >= 2, true);
  console.log('4. Backup inspection for JSON passed');

  // 5. Test Excel Master Export
  const excelExportPath = path.join(testDbDir, 'test_master_export.xlsx');
  const excelResult = await exportAllToExcel(db, excelExportPath);
  assert.strictEqual(excelResult.success, true);
  assert.strictEqual(fs.existsSync(excelExportPath), true);
  console.log('5. Excel Master Export succeeded');

  // 6. Test SQLite Backup Creation
  const dbBackupResult = await backupDatabase(db, testDbDir);
  assert.strictEqual(dbBackupResult.success, true);
  assert.strictEqual(fs.existsSync(dbBackupResult.path), true);
  console.log('6. SQLite Database Backup created:', dbBackupResult.fileName);

  // 7. Test Backup Inspection for SQLite .db
  const dbInspection = await inspectBackupFile(dbBackupResult.path);
  assert.strictEqual(dbInspection.valid, true);
  assert.strictEqual(dbInspection.type, 'sqlite');
  assert.strictEqual(dbInspection.stats.products >= 3, true);
  console.log('7. Backup inspection for SQLite passed');

  // 8. Test JSON Restore into DB
  const restoreJsonResult = await restoreDatabase(db, jsonExportPath);
  assert.strictEqual(restoreJsonResult.success, true);

  const restoredProductsCount = db.prepare('SELECT count(*) as c FROM products').get().c;
  assert.strictEqual(restoredProductsCount >= 3, true);
  console.log(`8. JSON Restore verified: ${restoredProductsCount} products successfully restored`);

  // 9. Test SQLite .db Restore into DB
  const restoreDbResult = await restoreDatabase(db, dbBackupResult.path);
  assert.strictEqual(restoreDbResult.success, true);
  console.log('9. SQLite .db Restore verified');

  // Cleanup test artifacts
  try {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n--- ALL BACKUP & RESTORE TESTS PASSED SUCCESSFULLY! ---');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
