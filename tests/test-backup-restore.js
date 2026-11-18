const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('../src/database/init');
const { productsDB } = require('../src/database/products');
global.window = {};
require('../renderer/js/utils/formatters');
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

  // Keep generated databases and exports outside the repository so running the
  // test never changes tracked fixtures or leaves generated files behind.
  const testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gulsons-backup-test-'));

  const testDbPath = path.join(testDbDir, 'test_gulsons.db');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  // 1. Initialize Test Database
  const db = await initDatabase(testDbPath);
  console.log('1. Database initialized successfully');

  const products = productsDB(db);
  assert.strictEqual(
    db.prepare("SELECT COUNT(*) AS c FROM categories WHERE name = 'Empty Bottle' AND type = 'Perfume'").get().c,
    1
  );
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS c FROM fragrance_types WHERE name = 'Empty Bottle'").get().c, 0);
  assert.throws(() => products.add({
    name: 'Invalid Empty Bottle',
    category: 'Empty Bottle',
    measurement_ml: 0
  }), /measurement must be greater than zero/i);
  assert.throws(() => products.add({
    name: 'Fractional Empty Bottle Stock',
    category: 'Empty Bottle',
    measurement_ml: 100,
    quantity: 0.5
  }), /stock quantity must be a whole number/i);
  const emptyBottle = products.add({
    name: 'Empty Perfume Bottle',
    category: 'Empty Bottle',
    brand: 'Generic',
    size: '100 ml',
    measurement_ml: 100,
    purchase_price: 10,
    sale_price: 25,
    quantity: 8,
    inventory_unit: 'Bottles',
    low_stock_threshold: 2
  });
  assert.strictEqual(emptyBottle.measurement_ml, 100);
  assert.strictEqual(emptyBottle.size, '100 ml');
  assert.strictEqual(window.formatters.getProductUnit(emptyBottle), 'Bottles');
  assert.throws(() => products.stockIn(emptyBottle.id, 0.5, 'Test Supplier'), /whole number/);
  assert.throws(() => products.adjustStock(emptyBottle.id, 0.5, 'Test adjustment'), /whole number/);
  const updatedEmptyBottle = products.update(emptyBottle.id, {
    category: 'Empty Bottle',
    measurement_ml: 120,
    size: 'old size',
    inventory_unit: 'pcs'
  });
  assert.strictEqual(updatedEmptyBottle.measurement_ml, 120);
  assert.strictEqual(updatedEmptyBottle.size, '120 ml');
  assert.strictEqual(updatedEmptyBottle.inventory_unit, 'Bottles');
  console.log('1b. Empty bottle measurement and validation passed');

  const legacyDbPath = path.join(testDbDir, 'legacy_empty_bottle.db');
  const legacyDb = await initDatabase(legacyDbPath);
  legacyDb.prepare(`
    INSERT INTO products (name, category, size, measurement_ml, fragrance_type, quantity, inventory_unit)
    VALUES (?, 'Perfume', ?, ?, 'Empty Bottle', 3, 'pcs')
  `).run('Legacy Empty Bottle', '80 ml', 80);
  legacyDb.close();
  const migratedLegacyDb = await initDatabase(legacyDbPath);
  const migratedProduct = migratedLegacyDb.prepare('SELECT category, size, measurement_ml, fragrance_type, inventory_unit FROM products WHERE name = ?').get('Legacy Empty Bottle');
  assert.strictEqual(migratedProduct.category, 'Empty Bottle');
  assert.strictEqual(migratedProduct.size, '80 ml');
  assert.strictEqual(migratedProduct.measurement_ml, 80);
  assert.strictEqual(migratedProduct.fragrance_type, null);
  assert.strictEqual(migratedProduct.inventory_unit, 'Bottles');
  migratedLegacyDb.close();
  console.log('1c. Existing empty bottle products migrated to the main category');

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

  // 5. Test Excel Master Export & Inspection & Restore
  const excelExportPath = path.join(testDbDir, 'test_master_export.xlsx');
  const excelResult = await exportAllToExcel(db, excelExportPath);
  assert.strictEqual(excelResult.success, true);
  assert.strictEqual(fs.existsSync(excelExportPath), true);
  console.log('5. Excel Master Export succeeded');

  const excelInspection = await inspectBackupFile(excelExportPath);
  assert.strictEqual(excelInspection.valid, true);
  assert.strictEqual(excelInspection.type, 'excel');
  assert.strictEqual(excelInspection.stats.products >= 3, true);
  assert.strictEqual(excelInspection.stats.expenses >= 2, true);
  assert.strictEqual(excelInspection.stats.sales >= 1, true);
  console.log('5b. Excel Master Backup inspection passed:', excelInspection.stats);

  const restoreExcelResult = await restoreDatabase(db, excelExportPath);
  assert.strictEqual(restoreExcelResult.success, true);
  assert.strictEqual(restoreExcelResult.mode, 'excel');
  const restoredFromExcel = db.prepare("SELECT measurement_ml, size FROM products WHERE name = ?").get('Empty Perfume Bottle');
  assert.strictEqual(restoredFromExcel.measurement_ml, 120);
  assert.strictEqual(restoredFromExcel.size, '120 ml');
  const restoredFromExcelCount = db.prepare('SELECT count(*) as c FROM products').get().c;
  assert.strictEqual(restoredFromExcelCount >= 3, true);
  console.log(`5c. Excel Master Restore verified: ${restoredFromExcelCount} products restored from Excel`);

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
  const restoredFromJson = db.prepare("SELECT measurement_ml, size FROM products WHERE name = ?").get('Empty Perfume Bottle');
  assert.strictEqual(restoredFromJson.measurement_ml, 120);
  assert.strictEqual(restoredFromJson.size, '120 ml');
  console.log(`8. JSON Restore verified: ${restoredProductsCount} products successfully restored`);

  // 9. Test SQLite .db Restore into DB
  const restoreDbResult = await restoreDatabase(db, dbBackupResult.path);
  assert.strictEqual(restoreDbResult.success, true);
  const restoredFromSqlite = db.prepare("SELECT measurement_ml, size FROM products WHERE name = ?").get('Empty Perfume Bottle');
  assert.strictEqual(restoredFromSqlite.measurement_ml, 120);
  assert.strictEqual(restoredFromSqlite.size, '120 ml');
  console.log('9. SQLite .db Restore verified');

  // Cleanup test artifacts
  db.close();
  fs.rmSync(testDbDir, { recursive: true, force: true });

  console.log('\n--- ALL BACKUP & RESTORE TESTS (EXCEL, SQLITE, JSON) PASSED SUCCESSFULLY! ---');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
