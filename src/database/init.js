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
        // Write and replace atomically so a crash or competing file operation
        // cannot leave a partially-written database behind.
        const tempPath = `${dbPath}.${process.pid}.tmp`;
        fs.writeFileSync(tempPath, buffer);
        if (process.platform === 'win32' && fs.existsSync(dbPath)) {
          // Windows does not replace an existing file with renameSync().
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
        // sql.js db.exec() does not bind parameters reliably. Using a
        // prepared statement here is required for every parameterized SELECT
        // (including reading the sale immediately after inserting it).
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
      quantity INTEGER NOT NULL,
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
      quantity INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
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
  safeAddColumn('products', 'fabric TEXT');
  safeAddColumn('products', 'fragrance_type TEXT');
  safeAddColumn('products', 'gender TEXT');
  safeAddColumn('products', 'sku TEXT');
  safeAddColumn('products', 'wholesale_price REAL NOT NULL DEFAULT 0');
  safeAddColumn('customers', 'address TEXT');
  safeAddColumn('customers', 'email TEXT');
  safeAddColumn('customers', 'customer_code TEXT');
  safeAddColumn('customers', 'total_payments REAL NOT NULL DEFAULT 0');
  safeAddColumn('customers', 'outstanding_balance REAL NOT NULL DEFAULT 0');
  safeAddColumn('returns', "refund_type TEXT DEFAULT 'Cash Refund'");

  // ─── Create Indexes ───
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_invoice_no ON sales(invoice_no);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
  `);

  // ─── Seed Default Data ───
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name, type) VALUES (?, ?)');
  const insertBrand = db.prepare('INSERT OR IGNORE INTO brands (name) VALUES (?)');
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

    // Default Brands
    const defaultBrands = ['Gul Ahmed', 'J.', 'Sapphire', 'Al-Karam', 'Charcoal', 'Dior', 'Chanel', 'Lattafa', 'Rasasi', 'Junaid Jamshed'];
    for (const b of defaultBrands) {
      insertBrand.run(b);
    }

    // Default Fragrance Types
    const defaultFragranceTypes = [
      'Eau de Parfum (EDP)',
      'Eau de Toilette (EDT)',
      'Pure Oud / Attar',
      'Body Spray',
      'Extrait de Parfum',
      'Cologne (EDC)',
      'Concentrated Perfume Oil (CPO)'
    ];
    for (const ft of defaultFragranceTypes) {
      insertFragranceType.run(ft);
    }
  });
  seedAll();

  return db;
}

module.exports = { initDatabase };
