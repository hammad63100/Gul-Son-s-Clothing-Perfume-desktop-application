const initSqlJs = require('sql.js');
const { productsDB } = require('../../src/database/products');
const { salesDB } = require('../../src/database/sales');
const { customersDB } = require('../../src/database/customers');
const { returnsDB } = require('../../src/database/returns');
const { expensesDB } = require('../../src/database/expenses');
const { reportsDB } = require('../../src/database/reports');
const { settingsDB } = require('../../src/database/settings');
const { suppliersDB } = require('../../src/database/suppliers');
const { masterDataDB } = require('../../src/database/brands');

/**
 * Creates an in-memory test database adapter matching the application's SQL interface
 */
async function createTestDb() {
  const SQL = await initSqlJs();
  const wasmDb = new SQL.Database();

  const execSelect = (sql, params = []) => {
    let stmt;
    try {
      let boundParams = params;
      if (params.length === 1 && Array.isArray(params[0])) {
        boundParams = params[0];
      }
      stmt = wasmDb.prepare(sql);
      if (boundParams && boundParams.length > 0) stmt.bind(boundParams);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } catch (err) {
      console.error('Test DB WASM Exec Error:', err.message, 'Query:', sql, 'Params:', params);
      return [];
    } finally {
      if (stmt) stmt.free();
    }
  };

  const db = {
    pragma(cmd) {
      try { wasmDb.exec(`PRAGMA ${cmd}`); } catch (e) {}
    },
    exec(sql) {
      wasmDb.exec(sql);
    },
    prepare(sql) {
      return {
        run(...params) {
          const boundParams = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
          if (boundParams && boundParams.length > 0) {
            wasmDb.run(sql, boundParams);
          } else {
            wasmDb.run(sql);
          }
          let lastInsertRowid = 0;
          try {
            const res = wasmDb.exec("SELECT last_insert_rowid() as id");
            lastInsertRowid = res[0] && res[0].values && res[0].values[0] ? res[0].values[0][0] : 0;
          } catch (e) {}
          return { lastInsertRowid };
        },
        get(...params) {
          const rows = execSelect(sql, params);
          return rows.length > 0 ? rows[0] : null;
        },
        all(...params) {
          return execSelect(sql, params);
        }
      };
    },
    transaction(fn) {
      return function(...args) {
        try { wasmDb.exec('BEGIN TRANSACTION'); } catch (e) {}
        try {
          const res = fn(...args);
          try { wasmDb.exec('COMMIT'); } catch (e) {}
          return res;
        } catch (err) {
          try { wasmDb.exec('ROLLBACK'); } catch (e) {}
          throw err;
        }
      };
    },
    close() {
      wasmDb.close();
    }
  };

  // ─── Initialize Schema ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Clothes',
      brand TEXT,
      size TEXT,
      color TEXT,
      fabric TEXT,
      fragrance_type TEXT,
      gender TEXT,
      barcode TEXT,
      sku TEXT,
      purchase_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      wholesale_price REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      supplier TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'Clothes',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT,
      phone TEXT,
      address TEXT,
      email TEXT,
      opening_balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Shop Rent',
      amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      date TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL DEFAULT 'Admin',
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL UNIQUE,
      customer_name TEXT,
      customer_phone TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_type TEXT DEFAULT 'flat',
      discount_value REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      product_size TEXT,
      product_color TEXT,
      quantity INTEGER NOT NULL,
      price_at_sale REAL NOT NULL,
      purchase_price_at_sale REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      email TEXT,
      customer_code TEXT,
      total_purchases REAL NOT NULL DEFAULT 0,
      total_payments REAL NOT NULL DEFAULT 0,
      outstanding_balance REAL NOT NULL DEFAULT 0,
      visit_count INTEGER NOT NULL DEFAULT 0,
      last_visit TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      sale_invoice_no TEXT,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      refund_amount REAL NOT NULL DEFAULT 0,
      refund_type TEXT DEFAULT 'Cash Refund',
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      adjustment_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS customer_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // ─── Seed Default Settings & Master Data ───
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('shop_name', "Gul Son's");
  insertSetting.run('shop_address', 'Main Retail Market');
  insertSetting.run('shop_phone', '0300-0000000');
  insertSetting.run('currency_symbol', 'Rs.');
  insertSetting.run('low_stock_threshold', '5');
  insertSetting.run('invoice_prefix', 'GS');
  insertSetting.run('invoice_next_number', '1');

  // Instantiate all modules
  const products = productsDB(db);
  const sales = salesDB(db);
  const customers = customersDB(db);
  const returns = returnsDB(db);
  const expenses = expensesDB(db);
  const reports = reportsDB(db);
  const settings = settingsDB(db);
  const suppliers = suppliersDB(db);
  const masterData = masterDataDB(db);

  return {
    db,
    products,
    sales,
    customers,
    returns,
    expenses,
    reports,
    settings,
    suppliers,
    masterData,
  };
}

module.exports = { createTestDb };
