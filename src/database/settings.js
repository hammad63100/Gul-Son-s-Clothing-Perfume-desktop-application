function settingsDB(db) {
  return {
    get() {
      const rows = db.prepare('SELECT * FROM settings').all();
      const settings = {};
      for (const row of rows) {
        settings[row.key] = row.value;
      }
      return settings;
    },

    update(data) {
      const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      const txn = db.transaction(() => {
        for (const [key, value] of Object.entries(data)) {
          upsert.run(key, String(value));
        }
      });
      txn();
      return this.get();
    },

    getValue(key) {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return row ? row.value : null;
    },

    clearAllData() {
      const txn = db.transaction(() => {
        db.pragma('foreign_keys = OFF');
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
          } catch (e) {
            console.warn(`Could not clear table ${table}:`, e.message);
          }
        }

        try {
          db.exec("DELETE FROM sqlite_sequence WHERE name IN ('products', 'sales', 'sale_items', 'expenses', 'customers', 'suppliers', 'returns', 'purchase_returns', 'stock_adjustments', 'customer_payments', 'audit_logs');");
        } catch (e) {}

        try {
          db.exec("UPDATE settings SET value = '1' WHERE key = 'invoice_next_number';");
        } catch (e) {}

        db.pragma('foreign_keys = ON');
      });

      txn();
      if (typeof db.flush === 'function') db.flush();
      return { success: true };
    },
  };
}

module.exports = { settingsDB };
