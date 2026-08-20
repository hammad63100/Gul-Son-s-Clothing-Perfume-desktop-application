const fs = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const ExcelJS = require('exceljs');

const ALL_TABLES = [
  'settings',
  'categories',
  'brands',
  'fragrance_types',
  'suppliers',
  'products',
  'expenses',
  'sales',
  'sale_items',
  'customers',
  'customer_payments',
  'returns',
  'stock_adjustments',
  'audit_logs'
];

function getAppUserDataDir() {
  if (app && typeof app.getPath === 'function') {
    return app.getPath('userData');
  }
  return path.join(__dirname, '..', '..');
}

function getSafetyBackupDir() {
  const baseDir = getAppUserDataDir();
  const safetyDir = path.join(baseDir, 'backups');
  if (!fs.existsSync(safetyDir)) {
    fs.mkdirSync(safetyDir, { recursive: true });
  }
  return safetyDir;
}

// ─── Pre-Restore Safety Snapshot ───
async function createSafetyBackup(db) {
  try {
    if (db && typeof db.flush === 'function') {
      db.flush();
    }
    const dbPath = (db && db.dbPath) || path.join(getAppUserDataDir(), 'gulsons.db');
    if (!fs.existsSync(dbPath)) return null;

    const safetyDir = getSafetyBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
    const safetyFileName = `gulsons_auto_safety_${timestamp}.db`;
    const safetyPath = path.join(safetyDir, safetyFileName);

    fs.copyFileSync(dbPath, safetyPath);
    return safetyPath;
  } catch (err) {
    console.error('Failed to create safety backup:', err);
    return null;
  }
}

// ─── List Auto Safety Backups ───
function getSafetyBackupsList() {
  try {
    const safetyDir = getSafetyBackupDir();
    if (!fs.existsSync(safetyDir)) return [];
    
    const files = fs.readdirSync(safetyDir)
      .filter(f => f.endsWith('.db') || f.endsWith('.json'))
      .map(fileName => {
        const fullPath = path.join(safetyDir, fileName);
        const stats = fs.statSync(fullPath);
        return {
          fileName,
          fullPath,
          sizeBytes: stats.size,
          sizeFormatted: `${(stats.size / 1024).toFixed(1)} KB`,
          createdAt: stats.mtime.toISOString(),
          isSafety: fileName.includes('safety')
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return files.slice(0, 20); // Top 20 recent backups
  } catch (err) {
    console.error('Failed to list safety backups:', err);
    return [];
  }
}

// ─── 1. SQLite Database Backup (.db) ───
async function backupDatabase(db, customPath = null) {
  let backupFolder = customPath;

  if (!backupFolder) {
    // Check if configured in settings
    let row = null;
    try {
      row = db.prepare("SELECT value FROM settings WHERE key = 'backup_path'").get();
    } catch (e) {}

    backupFolder = row ? row.value : '';

    if (!backupFolder || !fs.existsSync(backupFolder)) {
      if (dialog && typeof dialog.showOpenDialog === 'function') {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Select Backup Storage Folder / USB Drive',
        });

        if (result.canceled || result.filePaths.length === 0) {
          throw new Error('No backup location selected');
        }

        backupFolder = result.filePaths[0];
        try {
          db.prepare("UPDATE settings SET value = ? WHERE key = 'backup_path'").run(backupFolder);
        } catch (e) {}
      } else {
        backupFolder = getSafetyBackupDir();
      }
    }
  }

  // Ensure DB flushed to disk
  if (db && typeof db.flush === 'function') {
    db.flush();
  }

  const dbPath = (db && db.dbPath) || path.join(getAppUserDataDir(), 'gulsons.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error('Database file does not exist on disk');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
  const backupFileName = `GulSons_Backup_${timestamp}.db`;
  const destPath = path.join(backupFolder, backupFileName);

  fs.copyFileSync(dbPath, destPath);

  // Log in audit log
  try {
    db.prepare('INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)')
      .run('Admin', 'Backup Database', `Created SQLite database backup at: ${destPath}`);
  } catch (e) {}

  return { success: true, path: destPath, fileName: backupFileName };
}

// ─── 2. Universal JSON Full System Export (.json) ───
async function exportAllToJson(db, filePath) {
  if (db && typeof db.flush === 'function') {
    db.flush();
  }

  const backupData = {
    app: "Gul Son's Shop Manager",
    version: '1.0.1',
    schema_version: 1,
    exported_at: new Date().toISOString(),
    summary: {},
    data: {}
  };

  for (const tableName of ALL_TABLES) {
    try {
      const rows = db.prepare(`SELECT * FROM ${tableName} ORDER BY 1 ASC`).all();
      backupData.data[tableName] = rows || [];
      backupData.summary[tableName] = (rows || []).length;
    } catch (err) {
      console.warn(`Table ${tableName} not found during JSON export:`, err.message);
      backupData.data[tableName] = [];
      backupData.summary[tableName] = 0;
    }
  }

  const jsonString = JSON.stringify(backupData, null, 2);
  fs.writeFileSync(filePath, jsonString, 'utf-8');

  // Log in audit logs
  try {
    db.prepare('INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)')
      .run('Admin', 'Export JSON Backup', `Exported full database to JSON: ${filePath} (${backupData.summary.products || 0} products, ${backupData.summary.sales || 0} sales)`);
  } catch (e) {}

  return {
    success: true,
    path: filePath,
    summary: backupData.summary,
    exportedAt: backupData.exported_at
  };
}

// ─── 3. Complete Master Excel Export (.xlsx) ───
async function exportAllToExcel(db, filePath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gul Son's Shop Manager";
  workbook.created = new Date();

  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    }
  };

  const applyHeader = (sheet, headers) => {
    const row = sheet.addRow(headers);
    row.height = 24;
    row.eachCell(cell => Object.assign(cell, headerStyle));
  };

  // 1. Overview Sheet
  const summarySheet = workbook.addWorksheet('Overview Summary');
  summarySheet.addRow(['Gul Son\'s Shop Manager — Full Database Export']);
  summarySheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF1A237E' } };
  summarySheet.addRow(['Generated Date', new Date().toLocaleString()]);
  summarySheet.addRow([]);

  const countQuery = (tbl) => {
    try {
      const res = db.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get();
      return res ? res.c : 0;
    } catch (e) { return 0; }
  };

  const overviewHeaders = ['Record Category / Table', 'Total Count in System'];
  const overviewHeaderRow = summarySheet.addRow(overviewHeaders);
  overviewHeaderRow.eachCell(c => Object.assign(c, headerStyle));

  summarySheet.addRow(['Total Products (Inventory)', countQuery('products')]);
  summarySheet.addRow(['Total Sales Invoices', countQuery('sales')]);
  summarySheet.addRow(['Total Sale Items Sold', countQuery('sale_items')]);
  summarySheet.addRow(['Total Expenses Logged', countQuery('expenses')]);
  summarySheet.addRow(['Total Registered Customers', countQuery('customers')]);
  summarySheet.addRow(['Total Customer Khata Payments', countQuery('customer_payments')]);
  summarySheet.addRow(['Total Registered Suppliers', countQuery('suppliers')]);
  summarySheet.addRow(['Total Sales Returns', countQuery('returns')]);
  summarySheet.addRow(['Total Stock Adjustments', countQuery('stock_adjustments')]);
  summarySheet.addRow(['Total Categories', countQuery('categories')]);
  summarySheet.addRow(['Total Brands', countQuery('brands')]);
  summarySheet.addRow(['Total Fragrance Types', countQuery('fragrance_types')]);
  summarySheet.columns.forEach(col => { col.width = 30; });

  // 2. Products Sheet
  const productsSheet = workbook.addWorksheet('Products & Stock');
  applyHeader(productsSheet, [
    'ID', 'Product Name', 'Category', 'Brand', 'Size', 'Color', 'Fabric', 'Fragrance Type',
    'Barcode', 'SKU', 'Purchase Price', 'Sale Price', 'Wholesale Price', 'Stock Qty',
    'Low Threshold', 'Supplier', 'Status', 'Created Date', 'Updated Date'
  ]);
  const products = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
  for (const p of products) {
    productsSheet.addRow([
      p.id, p.name, p.category, p.brand || '', p.size || '', p.color || '', p.fabric || '',
      p.fragrance_type || '', p.barcode || '', p.sku || '', p.purchase_price, p.sale_price,
      p.wholesale_price || 0, p.quantity, p.low_stock_threshold, p.supplier || '',
      p.is_active ? 'Active' : 'Discontinued', p.created_at, p.updated_at || ''
    ]);
  }
  productsSheet.columns.forEach(col => { col.width = 16; });

  // 3. Sales Sheet
  const salesSheet = workbook.addWorksheet('Sales Invoices');
  applyHeader(salesSheet, [
    'ID', 'Invoice No', 'Customer Name', 'Customer Phone', 'Subtotal', 'Discount Type',
    'Discount Value', 'Discount Amount', 'Tax Amount', 'Total Amount', 'Payment Method', 'Notes', 'Created Date'
  ]);
  const salesData = db.prepare('SELECT * FROM sales ORDER BY id ASC').all();
  for (const s of salesData) {
    salesSheet.addRow([
      s.id, s.invoice_no, s.customer_name || '', s.customer_phone || '', s.subtotal,
      s.discount_type || 'flat', s.discount_value || 0, s.discount_amount || 0,
      s.tax_amount || 0, s.total_amount, s.payment_method, s.notes || '', s.created_at
    ]);
  }
  salesSheet.columns.forEach(col => { col.width = 16; });

  // 4. Sale Items Sheet
  const itemsSheet = workbook.addWorksheet('Sale Items Detail');
  applyHeader(itemsSheet, ['ID', 'Sale ID', 'Product ID', 'Product Name', 'Size', 'Color', 'Quantity Sold', 'Sale Unit Price', 'Purchase Cost', 'Line Total']);
  const items = db.prepare('SELECT * FROM sale_items ORDER BY id ASC').all();
  for (const i of items) {
    itemsSheet.addRow([
      i.id, i.sale_id, i.product_id, i.product_name, i.product_size || '', i.product_color || '',
      i.quantity, i.price_at_sale, i.purchase_price_at_sale || 0, i.line_total
    ]);
  }
  itemsSheet.columns.forEach(col => { col.width = 16; });

  // 5. Expenses Sheet
  const expensesSheet = workbook.addWorksheet('Expenses');
  applyHeader(expensesSheet, ['ID', 'Expense Title', 'Category', 'Amount', 'Payment Method', 'Expense Date', 'Description', 'Created Date']);
  const expensesData = db.prepare('SELECT * FROM expenses ORDER BY id ASC').all();
  for (const e of expensesData) {
    expensesSheet.addRow([e.id, e.title, e.category, e.amount, e.payment_method, e.date, e.description || '', e.created_at]);
  }
  expensesSheet.columns.forEach(col => { col.width = 16; });

  // 6. Customers Sheet
  const customersSheet = workbook.addWorksheet('Customers');
  applyHeader(customersSheet, ['ID', 'Customer Code', 'Name', 'Phone', 'Address', 'Email', 'Total Purchases', 'Total Paid', 'Outstanding Balance', 'Visit Count', 'Last Visit', 'Created Date']);
  const customersData = db.prepare('SELECT * FROM customers ORDER BY id ASC').all();
  for (const c of customersData) {
    customersSheet.addRow([
      c.id, c.customer_code || '', c.name, c.phone || '', c.address || '', c.email || '',
      c.total_purchases, c.total_payments || 0, c.outstanding_balance || 0, c.visit_count,
      c.last_visit || '', c.created_at
    ]);
  }
  customersSheet.columns.forEach(col => { col.width = 16; });

  // 7. Customer Payments Sheet
  const custPaySheet = workbook.addWorksheet('Customer Khata Payments');
  applyHeader(custPaySheet, ['ID', 'Customer ID', 'Amount Paid', 'Payment Method', 'Note / Remarks', 'Payment Date']);
  try {
    const custPayData = db.prepare('SELECT * FROM customer_payments ORDER BY id ASC').all();
    for (const cp of custPayData) {
      custPaySheet.addRow([cp.id, cp.customer_id, cp.amount, cp.payment_method, cp.note || '', cp.created_at]);
    }
  } catch (e) {}
  custPaySheet.columns.forEach(col => { col.width = 16; });

  // 8. Suppliers Sheet
  const suppliersSheet = workbook.addWorksheet('Suppliers & Vendors');
  applyHeader(suppliersSheet, ['ID', 'Supplier Name', 'Company', 'Phone', 'Address', 'Email', 'Opening Balance', 'Created Date']);
  try {
    const suppData = db.prepare('SELECT * FROM suppliers ORDER BY id ASC').all();
    for (const sp of suppData) {
      suppliersSheet.addRow([sp.id, sp.name, sp.company || '', sp.phone || '', sp.address || '', sp.email || '', sp.opening_balance || 0, sp.created_at]);
    }
  } catch (e) {}
  suppliersSheet.columns.forEach(col => { col.width = 16; });

  // 9. Returns Sheet
  const returnsSheet = workbook.addWorksheet('Sales Returns');
  applyHeader(returnsSheet, ['ID', 'Sale ID', 'Invoice No', 'Product ID', 'Product Name', 'Quantity', 'Refund Amount', 'Refund Type', 'Reason', 'Created Date']);
  try {
    const retData = db.prepare('SELECT * FROM returns ORDER BY id ASC').all();
    for (const r of retData) {
      returnsSheet.addRow([r.id, r.sale_id, r.sale_invoice_no || '', r.product_id, r.product_name, r.quantity, r.refund_amount, r.refund_type || 'Cash Refund', r.reason || '', r.created_at]);
    }
  } catch (e) {}
  returnsSheet.columns.forEach(col => { col.width = 16; });

  // 10. Stock Adjustments Sheet
  const stockAdjSheet = workbook.addWorksheet('Stock Adjustments');
  applyHeader(stockAdjSheet, ['ID', 'Product ID', 'Product Name', 'Adjustment Type', 'Quantity', 'Reason / Source', 'Created Date']);
  try {
    const saData = db.prepare('SELECT * FROM stock_adjustments ORDER BY id ASC').all();
    for (const sa of saData) {
      stockAdjSheet.addRow([sa.id, sa.product_id, sa.product_name, sa.adjustment_type, sa.quantity, sa.reason || '', sa.created_at]);
    }
  } catch (e) {}
  stockAdjSheet.columns.forEach(col => { col.width = 16; });

  // 11. Categories Sheet
  const catsSheet = workbook.addWorksheet('Categories');
  applyHeader(catsSheet, ['ID', 'Category Name', 'Type / Department', 'Created Date']);
  try {
    const catData = db.prepare('SELECT * FROM categories ORDER BY id ASC').all();
    for (const cat of catData) {
      catsSheet.addRow([cat.id, cat.name, cat.type, cat.created_at]);
    }
  } catch (e) {}
  catsSheet.columns.forEach(col => { col.width = 16; });

  // 12. Brands Sheet
  const brandsSheet = workbook.addWorksheet('Brands');
  applyHeader(brandsSheet, ['ID', 'Brand Name', 'Created Date']);
  try {
    const bData = db.prepare('SELECT * FROM brands ORDER BY id ASC').all();
    for (const b of bData) {
      brandsSheet.addRow([b.id, b.name, b.created_at]);
    }
  } catch (e) {}
  brandsSheet.columns.forEach(col => { col.width = 16; });

  // 13. Fragrance Types Sheet
  const fragSheet = workbook.addWorksheet('Fragrance Types');
  applyHeader(fragSheet, ['ID', 'Type Name', 'Created Date']);
  try {
    const fData = db.prepare('SELECT * FROM fragrance_types ORDER BY id ASC').all();
    for (const f of fData) {
      fragSheet.addRow([f.id, f.name, f.created_at]);
    }
  } catch (e) {}
  fragSheet.columns.forEach(col => { col.width = 16; });

  // 14. Audit Logs Sheet
  const auditSheet = workbook.addWorksheet('Audit Logs');
  applyHeader(auditSheet, ['ID', 'User', 'Action', 'Details', 'Timestamp']);
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500').all();
    for (const l of logs) {
      auditSheet.addRow([l.id, l.user_name, l.action, l.details || '', l.created_at]);
    }
  } catch (e) {}
  auditSheet.columns.forEach(col => { col.width = 20; });

  // 15. Settings Sheet
  const setSheet = workbook.addWorksheet('Shop Settings');
  applyHeader(setSheet, ['Key', 'Value']);
  try {
    const sData = db.prepare('SELECT * FROM settings ORDER BY key ASC').all();
    for (const s of sData) {
      setSheet.addRow([s.key, s.value]);
    }
  } catch (e) {}
  setSheet.columns.forEach(col => { col.width = 24; });

  await workbook.xlsx.writeFile(filePath);
  return { success: true, path: filePath };
}

// ─── 4. Inspect Backup File (.db or .json) ───
async function inspectBackupFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Selected backup file does not exist');
  }

  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      if (!parsed.data || typeof parsed.data !== 'object') {
        return {
          valid: false,
          type: 'json',
          filePath,
          fileName: path.basename(filePath),
          fileSize: `${(stats.size / 1024).toFixed(1)} KB`,
          error: 'Invalid JSON backup format (missing "data" root property)'
        };
      }

      const summary = {};
      ALL_TABLES.forEach(tbl => {
        summary[tbl] = Array.isArray(parsed.data[tbl]) ? parsed.data[tbl].length : 0;
      });

      return {
        valid: true,
        type: 'json',
        filePath,
        fileName: path.basename(filePath),
        fileSize: `${(stats.size / 1024).toFixed(1)} KB`,
        exportedAt: parsed.exported_at || stats.mtime.toISOString(),
        appName: parsed.app || "Gul Son's Shop Manager",
        stats: summary,
        totalRecords: Object.values(summary).reduce((a, b) => a + b, 0)
      };
    } catch (err) {
      return {
        valid: false,
        type: 'json',
        filePath,
        fileName: path.basename(filePath),
        fileSize: `${(stats.size / 1024).toFixed(1)} KB`,
        error: 'Corrupted JSON file: ' + err.message
      };
    }
  } else if (ext === '.db' || ext === '.sqlite' || ext === '.bak') {
    try {
      let tempDb = null;
      let isNative = false;
      let isBetter = false;

      try {
        const { DatabaseSync } = require('node:sqlite');
        tempDb = new DatabaseSync(filePath, { readOnly: true });
        isNative = true;
      } catch (e1) {
        try {
          const Database = require('better-sqlite3');
          tempDb = new Database(filePath, { readonly: true });
          isBetter = true;
        } catch (e2) {
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
          const fileBuffer = fs.readFileSync(filePath);
          tempDb = new SQL.Database(fileBuffer);
        }
      }

      const summary = {};
      ALL_TABLES.forEach(tbl => {
        try {
          if (isNative) {
            const stmt = tempDb.prepare(`SELECT count(*) as c FROM ${tbl}`);
            const row = stmt.get();
            summary[tbl] = row ? row.c : 0;
          } else if (isBetter) {
            const row = tempDb.prepare(`SELECT count(*) as c FROM ${tbl}`).get();
            summary[tbl] = row ? row.c : 0;
          } else {
            const res = tempDb.exec(`SELECT count(*) as c FROM ${tbl}`);
            summary[tbl] = (res && res[0] && res[0].values && res[0].values[0]) ? res[0].values[0][0] : 0;
          }
        } catch (e) {
          summary[tbl] = 0;
        }
      });

      try { tempDb.close(); } catch (e) {}

      return {
        valid: true,
        type: 'sqlite',
        filePath,
        fileName: path.basename(filePath),
        fileSize: `${(stats.size / 1024).toFixed(1)} KB`,
        exportedAt: stats.mtime.toISOString(),
        stats: summary,
        totalRecords: Object.values(summary).reduce((a, b) => a + b, 0)
      };
    } catch (err) {
      return {
        valid: false,
        type: 'sqlite',
        filePath,
        fileName: path.basename(filePath),
        fileSize: `${(stats.size / 1024).toFixed(1)} KB`,
        error: 'Invalid or corrupt SQLite database file: ' + err.message
      };
    }
  } else {
    throw new Error('Unsupported backup file format. Please select a .db, .sqlite, or .json file.');
  }
}

// ─── 5. Restore Database (.db or .json) ───
async function restoreDatabase(db, filePath) {
  // Step 1: Inspect and validate file first
  const inspection = await inspectBackupFile(filePath);
  if (!inspection.valid) {
    throw new Error(inspection.error || 'Backup file validation failed');
  }

  // Step 2: Create automatic safety snapshot of current database
  const safetyBackupPath = await createSafetyBackup(db);

  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const data = parsed.data || {};

    const restoreTransaction = db.transaction(() => {
      // Temporarily disable foreign keys for clean restoration
      db.pragma('foreign_keys = OFF');

      // Clear existing records in reverse dependency order
      const clearOrder = [
        'customer_payments',
        'returns',
        'stock_adjustments',
        'sale_items',
        'sales',
        'expenses',
        'products',
        'customers',
        'suppliers',
        'fragrance_types',
        'brands',
        'categories',
        'settings',
        'audit_logs'
      ];

      for (const tbl of clearOrder) {
        try {
          db.exec(`DELETE FROM ${tbl};`);
        } catch (e) {
          console.warn(`Could not clear table ${tbl}:`, e.message);
        }
      }

      // Re-insert data for each table
      for (const [tbl, rows] of Object.entries(data)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;

        // Extract column names from first row
        const firstRow = rows[0];
        const cols = Object.keys(firstRow);
        const placeholders = cols.map(() => '?').join(', ');
        const insertSql = `INSERT OR REPLACE INTO ${tbl} (${cols.join(', ')}) VALUES (${placeholders})`;
        const stmt = db.prepare(insertSql);

        for (const row of rows) {
          const values = cols.map(c => row[c] !== undefined ? row[c] : null);
          stmt.run(values);
        }
      }

      // Re-enable foreign keys
      db.pragma('foreign_keys = ON');

      // Synchronize auto-increment sequence counters
      for (const tbl of clearOrder) {
        if (tbl === 'settings') continue;
        try {
          db.exec(`
            DELETE FROM sqlite_sequence WHERE name = '${tbl}';
            INSERT INTO sqlite_sequence (name, seq) SELECT '${tbl}', COALESCE(MAX(id), 0) FROM ${tbl};
          `);
        } catch (e) {}
      }

      // Log restoration action in audit log
      try {
        db.prepare('INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)')
          .run('Admin', 'Restore Database', `Database restored from JSON file: ${path.basename(filePath)} (${inspection.totalRecords} records)`);
      } catch (e) {}
    });

    restoreTransaction();

    if (db && typeof db.flush === 'function') {
      db.flush();
    }

    return {
      success: true,
      mode: 'json',
      safetyBackupPath,
      stats: inspection.stats,
      totalRecords: inspection.totalRecords,
      fileName: path.basename(filePath)
    };

  } else if (ext === '.db' || ext === '.sqlite' || ext === '.bak') {
    const dbPath = (db && db.dbPath) || path.join(getAppUserDataDir(), 'gulsons.db');

    // Ensure source file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('Source SQLite backup file does not exist');
    }

    // Overwrite the gulsons.db file
    fs.copyFileSync(filePath, dbPath);

    // Reload the database adapter so in-memory representation updates instantly
    if (db && typeof db.reload === 'function') {
      db.reload(dbPath);
    }

    // Run migrations on the newly restored database to make sure any missing columns/indexes exist
    try {
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');

      const safeAddColumn = (table, colDef) => {
        try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef};`); } catch (e) {}
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

      db.prepare('INSERT INTO audit_logs (user_name, action, details) VALUES (?, ?, ?)')
        .run('Admin', 'Restore Database', `Database restored from SQLite file: ${path.basename(filePath)}`);
    } catch (e) {}

    if (db && typeof db.flush === 'function') {
      db.flush();
    }

    return {
      success: true,
      mode: 'sqlite',
      safetyBackupPath,
      stats: inspection.stats,
      totalRecords: inspection.totalRecords,
      fileName: path.basename(filePath)
    };
  }
}

module.exports = {
  ALL_TABLES,
  backupDatabase,
  exportAllToJson,
  exportAllToExcel,
  inspectBackupFile,
  restoreDatabase,
  createSafetyBackup,
  getSafetyBackupsList
};
