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
  };
}

module.exports = { settingsDB };
