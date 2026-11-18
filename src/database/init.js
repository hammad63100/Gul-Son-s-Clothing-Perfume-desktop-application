const path = require('path');
const fs = require('fs');
const { app } = require('electron');

async function createDatabaseAdapter(dbPath) {
  // Option 1: Try native node:sqlite (Node 22.5+ / Node 24)
  try {
    const { DatabaseSync } = require('node:sqlite');
    let nativeDb = new DatabaseSync(dbPath);
    console.log('SQLite Engine: Native node:sqlite');
    return {
      pragma(cmd) { try { nativeDb.exec(`PRAGMA ${cmd}`); } catch (e) {} },
      exec(sql) { nativeDb.exec(sql); },
      flush() {
        try { nativeDb.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch (e) {}
      },
      reload(newPath = dbPath) {
        try { nativeDb.close(); } catch (e) {}
        nativeDb = new DatabaseSync(newPath);
      },
      prepare(sql) {
        const stmt = nativeDb.prepare(sql);
        return {
          run(...params) {
            const boundParams = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
            if (boundParams && boundParams.length > 0) return stmt.run(...boundParams);
            return stmt.run();
          },
          get(...params) {
            const boundParams = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
            if (boundParams && boundParams.length > 0) return stmt.get(...boundParams);
            return stmt.get();
          },
          all(...params) {
            const boundParams = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
            if (boundParams && boundParams.length > 0) return stmt.all(...boundParams);
            return stmt.all();
          }
        };
      },
      transaction(fn) {
        return function(...args) {
          try { nativeDb.exec('BEGIN TRANSACTION'); } catch (e) {}
          try {
            const res = fn(...args);
            try { nativeDb.exec('COMMIT'); } catch (e) {}
            return res;
          } catch (err) {
            try { nativeDb.exec('ROLLBACK'); } catch (e) {}
            throw err;
          }
        };
      },
      close() { nativeDb.close(); }
    };
  } catch (e) {}

  // Option 2: Try better-sqlite3
  try {
    const Database = require('better-sqlite3');
    let bDb = new Database(dbPath);
    console.log('SQLite Engine: better-sqlite3');
    bDb.flush = () => {
      try { bDb.pragma('wal_checkpoint(TRUNCATE)'); } catch (e) {}
    };
    bDb.reload = (newPath = dbPath) => {
      try { bDb.close(); } catch (e) {}
      bDb = new Database(newPath);
    };
    return bDb;
  } catch (e) {}

  // Option 3: Pure WASM sql.js
  try {
    const initSqlJs = require('sql.js');
    const wasmLocation = path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const SQL = await initSqlJs({
      locateFile: file => {
        if (file.endsWith('.wasm')) {
          const unpacked = wasmLocation.replace('app.asar', 'app.asar.unpacked');
          if (fs.existsSync(unpacked)) return unpacked;
          if (fs.existsSync(wasmLocation)) return wasmLocation;
        }
        return file;
      }
    });
    console.log('SQLite Engine: Pure WASM sql.js');

    let wasmDb;
    const loadWasmFromDisk = (targetPath) => {
      if (fs.existsSync(targetPath)) {
        const filebuffer = fs.readFileSync(targetPath);
        return new SQL.Database(filebuffer);
      }
      return new SQL.Database();
    };
    wasmDb = loadWasmFromDisk(dbPath);

    let transactionDepth = 0;
    let dirty = false;

    const saveToDisk = () => {
      try {
        const data = wasmDb.export();
        const buffer = Buffer.from(data);
        const tempPath = `${dbPath}.${process.pid}.tmp`;
        fs.writeFileSync(tempPath, buffer);
        if (process.platform === 'win32' && fs.existsSync(dbPath)) {
          fs.copyFileSync(tempPath, dbPath);
          fs.unlinkSync(tempPath);
        } else {
          fs.renameSync(tempPath, dbPath);
        }
        dirty = false;
      } catch (err) {
        try {
          const tempPath = `${dbPath}.${process.pid}.tmp`;
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch (cleanupError) {}
        console.error('Failed to save WASM SQLite database to disk:', err);
      }
    };

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
        console.error('WASM SQL Exec Error:', err.message, 'Query:', sql, 'Params:', params);
        return [];
      } finally {
        if (stmt) stmt.free();
      }
    };

    return {
      pragma(cmd) {
        try { wasmDb.exec(`PRAGMA ${cmd}`); } catch (e) {}
      },
      exec(sql) {
        wasmDb.exec(sql);
        dirty = true;
        if (transactionDepth === 0) saveToDisk();
      },
      flush() {
        if (dirty) saveToDisk();
      },
      reload(newPath = dbPath) {
        if (wasmDb) {
          try { wasmDb.close(); } catch (e) {}
        }
        wasmDb = loadWasmFromDisk(newPath);
        dirty = false;
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
            dirty = true;
            if (transactionDepth === 0) saveToDisk();
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
          transactionDepth += 1;
          try {
            wasmDb.exec('BEGIN TRANSACTION');
          } catch (e) {}
          try {
            const res = fn(...args);
            try { wasmDb.exec('COMMIT'); } catch (e) {}
            transactionDepth -= 1;
            if (transactionDepth === 0 && dirty) saveToDisk();
            return res;
          } catch (err) {
            try { wasmDb.exec('ROLLBACK'); } catch (e) {}
            transactionDepth -= 1;
            if (transactionDepth === 0) dirty = false;
            throw err;
          }
        };
      },
      close() {
        if (dirty) saveToDisk();
        wasmDb.close();
      }
    };
  } catch (e3) {
    throw new Error('Failed to load any SQLite engine: ' + e3.message);
  }
}

async function initDatabase(customDbPath = null) {
  const dbPath = customDbPath || (app ? path.join(app.getPath('userData'), 'gulsons.db') : path.join(__dirname, '..', '..', 'gulsons.db'));
  const db = await createDatabaseAdapter(dbPath);
  db.dbPath = dbPath;

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // ─── Create Tables ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Clothes',
      brand TEXT,
      size TEXT,
      measurement_ml REAL,
      color TEXT,
      fabric TEXT,
      fragrance_type TEXT,
      gender TEXT,
      barcode TEXT,
      sku TEXT,
      purchase_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      wholesale_price REAL NOT NULL DEFAULT 0,
      quantity REAL NOT NULL DEFAULT 0,
      inventory_unit TEXT NOT NULL DEFAULT 'pcs',
      retail_quantity REAL NOT NULL DEFAULT 1,
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
      category TEXT NOT NULL DEFAULT 'Clothes',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS fragrance_types (
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
      expense_type TEXT NOT NULL DEFAULT 'shop',
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
      quantity REAL NOT NULL,
      quantity_unit TEXT,
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
      total_purchases REAL NOT NULL DEFAULT 0,
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
      quantity REAL NOT NULL,
      refund_amount REAL NOT NULL DEFAULT 0,
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
      quantity REAL NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      supplier TEXT,
      reason TEXT,
      notes TEXT,
      refund_value REAL NOT NULL DEFAULT 0,
      purchase_price_at_return REAL NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS raast_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_type TEXT NOT NULL,
      bill_type TEXT,
      consumer_number TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      raast_id TEXT,
      account_title TEXT,
      bank_name TEXT,
      amount REAL NOT NULL,
      fee_amount REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0,
      total_collected REAL NOT NULL DEFAULT 0,
      trx_reference TEXT,
      status TEXT DEFAULT 'Completed',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // ─── Migrations for Existing Database Files ───
  const safeAddColumn = (table, colDef) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef};`);
    } catch (e) {
      // Column already exists
    }
  };

  safeAddColumn('products', 'brand TEXT');
  safeAddColumn('products', 'measurement_ml REAL');
  safeAddColumn('products', 'fabric TEXT');
  safeAddColumn('products', 'fragrance_type TEXT');
  safeAddColumn('products', 'gender TEXT');
  safeAddColumn('products', 'sku TEXT');
  safeAddColumn('products', 'wholesale_price REAL NOT NULL DEFAULT 0');
  safeAddColumn('products', "inventory_unit TEXT NOT NULL DEFAULT 'pcs'");
  safeAddColumn('products', 'retail_quantity REAL NOT NULL DEFAULT 1');
  safeAddColumn('sale_items', 'quantity_unit TEXT');
  safeAddColumn('customers', 'address TEXT');
  safeAddColumn('customers', 'email TEXT');
  safeAddColumn('customers', 'customer_code TEXT');
  safeAddColumn('customers', 'total_payments REAL NOT NULL DEFAULT 0');
  safeAddColumn('customers', 'outstanding_balance REAL NOT NULL DEFAULT 0');
  safeAddColumn('returns', "refund_type TEXT DEFAULT 'Cash Refund'");
  safeAddColumn('brands', "category TEXT NOT NULL DEFAULT 'Clothes'");
  safeAddColumn('raast_transactions', 'bill_type TEXT');
  safeAddColumn('raast_transactions', 'consumer_number TEXT');
  safeAddColumn('expenses', "expense_type TEXT NOT NULL DEFAULT 'shop'");

  try {
    db.exec(`
      UPDATE products
      SET category = 'Empty Bottle',
          measurement_ml = CASE
            WHEN measurement_ml IS NULL OR measurement_ml <= 0 THEN
              CASE WHEN CAST(size AS REAL) > 0 THEN CAST(size AS REAL) ELSE measurement_ml END
            ELSE measurement_ml
          END,
          size = CASE
            WHEN size IS NULL OR TRIM(size) = '' THEN
              CASE WHEN measurement_ml > 0 THEN CAST(measurement_ml AS TEXT) || ' ml' ELSE size END
            ELSE size
          END,
          fragrance_type = NULL,
          gender = NULL,
          inventory_unit = 'Bottles'
      WHERE category = 'Perfume' AND LOWER(TRIM(COALESCE(fragrance_type, ''))) = 'empty bottle';
      DELETE FROM fragrance_types WHERE LOWER(TRIM(name)) = 'empty bottle';
    `);
  } catch (e) {}

  // Update known perfume/hosiery brands to correct category for existing databases
  try {
    db.exec("UPDATE brands SET category = 'Perfume' WHERE name IN ('Dior', 'Chanel', 'Lattafa', 'Rasasi', 'Junaid Jamshed', 'Ameer Al Oudh', 'Ajmal') AND (category = 'Clothes' OR category IS NULL);");
    db.exec("UPDATE brands SET category = 'Hosiery' WHERE name IN ('Oxfo', 'Bata', 'Sahar', 'Lucky', 'Servis', 'Standard Hosiery') AND (category = 'Clothes' OR category IS NULL);");
  } catch (e) {}

  // Update known fragrance types for existing databases to standard 3
  try {
    db.exec(`
      DELETE FROM fragrance_types WHERE LOWER(TRIM(name)) IN (
        'eau de parfum (edp)',
        'eau de toilette (edt)',
        'pure oud / attar',
        'extrait de parfum',
        'cologne (edc)',
        'concentrated perfume oil (cpo)',
        'body spray'
      );
    `);

    const insertFT = db.prepare('INSERT OR IGNORE INTO fragrance_types (name) VALUES (?)');
    insertFT.run('Body spray');
    insertFT.run('Attar');
    insertFT.run('Normal Spray');
  } catch (e) {}

  // ─── Create Indexes ───
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_invoice_no ON sales(invoice_no);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
    CREATE INDEX IF NOT EXISTS idx_raast_created_at ON raast_transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_raast_type ON raast_transactions(transaction_type);
  `);

  // ─── Seed Default Data ───
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name, type) VALUES (?, ?)');
  const insertBrand = db.prepare('INSERT OR IGNORE INTO brands (name, category) VALUES (?, ?)');
  const insertFragranceType = db.prepare('INSERT OR IGNORE INTO fragrance_types (name) VALUES (?)');

  const seedAll = db.transaction(() => {
    insertSetting.run('shop_name', "Gul Son's");
    insertSetting.run('shop_address', 'Main Retail Market');
    insertSetting.run('shop_phone', '0300-0000000');
    insertSetting.run('currency_symbol', 'Rs.');
    insertSetting.run('low_stock_threshold', '5');
    insertSetting.run('backup_reminder', 'true');
    insertSetting.run('invoice_prefix', 'GS');
    insertSetting.run('invoice_next_number', '1');
    insertSetting.run('thermal_printer_name', '');
    insertSetting.run('auto_print_receipt', 'true');
    insertSetting.run('raast_fee_rate', '20'); // Rs. 20 per 1000

    // Default Categories
    const defaultCats = [
      ['Men\'s Shirts', 'Clothes'],
      ['T-Shirts', 'Clothes'],
      ['Shalwar Kameez', 'Clothes'],
      ['Pants & Jeans', 'Clothes'],
      ['Women\'s Suits', 'Clothes'],
      ['Kids Wear', 'Clothes'],
      ['Men\'s Perfume', 'Perfume'],
      ['Women\'s Perfume', 'Perfume'],
      ['Unisex Perfume', 'Perfume'],
      ['Empty Bottle', 'Perfume'],
      ['Attar & Oud', 'Perfume'],
      ['Body Spray', 'Perfume'],
      ['Banyans / Vests', 'Hosiery'],
      ['Socks', 'Hosiery'],
      ['T-Shirts', 'Hosiery'],
      ['Undergarments', 'Hosiery'],
    ];
    for (const [catName, catType] of defaultCats) {
      insertCategory.run(catName, catType);
    }

    // Default Brands by Category
    const defaultBrands = [
      ['Gul Ahmed', 'Clothes'],
      ['J.', 'Clothes'],
      ['Sapphire', 'Clothes'],
      ['Al-Karam', 'Clothes'],
      ['Charcoal', 'Clothes'],
      ['Khaadi', 'Clothes'],
      ['Bonanza Satrangi', 'Clothes'],
      ['Dior', 'Perfume'],
      ['Chanel', 'Perfume'],
      ['Lattafa', 'Perfume'],
      ['Rasasi', 'Perfume'],
      ['Junaid Jamshed', 'Perfume'],
      ['Ameer Al Oudh', 'Perfume'],
      ['Ajmal', 'Perfume'],
      ['Oxfo', 'Hosiery'],
      ['Bata', 'Hosiery'],
      ['Sahar', 'Hosiery'],
      ['Lucky', 'Hosiery'],
      ['Servis', 'Hosiery'],
      ['Standard Hosiery', 'Hosiery'],
    ];
    for (const [bName, bCat] of defaultBrands) {
      insertBrand.run(bName, bCat);
    }

    // Default Fragrance Types
    const defaultFragranceTypes = [
      'Body spray',
      'Attar',
      'Normal Spray'
    ];
    for (const ft of defaultFragranceTypes) {
      insertFragranceType.run(ft);
    }
  });
  seedAll();

  return db;
}

module.exports = { initDatabase };
