// Script to completely clear all transactional & business data from Gul Son's Database
// Ready for fresh client delivery.

const path = require('path');
const fs = require('fs');

async function clearDatabase() {
  console.log('====================================================');
  console.log('   Gul Son\'s Desktop App - Complete Database Reset   ');
  console.log('====================================================\n');

  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    const possiblePaths = [
      path.join(process.env.APPDATA || '', 'gul-sons-shop-manager', 'gulsons.db'),
      path.join(process.env.LOCALAPPDATA || '', 'gul-sons-shop-manager', 'gulsons.db'),
      path.join(__dirname, 'gulsons.db'),
    ];

    let foundDbs = [];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        foundDbs.push(p);
      }
    }

    if (foundDbs.length === 0) {
      console.log('⚠️ No existing database file found at standard paths.');
      console.log('When the app starts next time, it will automatically create a 100% clean database.');
      return;
    }

    for (const dbPath of foundDbs) {
      console.log(`\n🧹 Processing database: ${dbPath}`);
      const filebuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(filebuffer);

      // List of tables to completely empty
      const tablesToClear = [
        'customer_payments',
        'returns',
        'purchase_returns',
        'stock_adjustments',
        'sale_items',
        'sales',
        'expenses',
        'products',
        'customers',
        'suppliers',
        'audit_logs'
      ];

      for (const table of tablesToClear) {
        try {
          db.exec(`DELETE FROM ${table};`);
          console.log(`  ✓ Cleared table: ${table}`);
        } catch (e) {
          // Table might not exist in older schema
          console.log(`  - Skipped table ${table} (${e.message})`);
        }
      }

      // Reset auto-increment sequence counters
      try {
        db.exec("DELETE FROM sqlite_sequence WHERE name IN ('products', 'sales', 'sale_items', 'expenses', 'customers', 'suppliers', 'returns', 'purchase_returns', 'stock_adjustments', 'customer_payments', 'audit_logs');");
        console.log('  ✓ Reset all auto-increment ID counters to 1');
      } catch (e) {
        console.log('  - Sequence reset warning:', e.message);
      }

      // Reset next invoice number setting back to 1
      try {
        db.exec("UPDATE settings SET value = '1' WHERE key = 'invoice_next_number';");
        console.log('  ✓ Reset next invoice number counter to 1');
      } catch (e) {}

      // Save the cleaned database back to disk
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
      db.close();

      console.log(`  ✨ Successfully wiped all test records and saved clean database to ${dbPath}`);
    }

    console.log('\n====================================================');
    console.log('🎉 Database is now 100% CLEAN and ready for Client Delivery!');
    console.log('   - 0 Products');
    console.log('   - 0 Sales & Invoices');
    console.log('   - 0 Customers & Khata');
    console.log('   - 0 Suppliers');
    console.log('   - 0 Expenses');
    console.log('   - 0 Returns');
    console.log('   - Default Categories & Brands preserved');
    console.log('====================================================\n');

  } catch (err) {
    console.error('❌ Error while clearing database:', err);
  }
}

clearDatabase();
