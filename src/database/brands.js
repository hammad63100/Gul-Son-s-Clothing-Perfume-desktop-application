function masterDataDB(db) {
  return {
    // Categories
    getCategories(type) {
      if (type) {
        return db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY name').all(type);
      }
      return db.prepare('SELECT * FROM categories ORDER BY name').all();
    },

    addCategory(name, type = 'Clothes') {
      const stmt = db.prepare('INSERT OR IGNORE INTO categories (name, type) VALUES (?, ?)');
      const res = stmt.run(name, type);
      return { id: res.lastInsertRowid, name, type };
    },

    deleteCategory(id) {
      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
      return { success: true };
    },

    // Brands
    getBrands() {
      return db.prepare('SELECT * FROM brands ORDER BY name').all();
    },

    addBrand(name) {
      const stmt = db.prepare('INSERT OR IGNORE INTO brands (name) VALUES (?)');
      const res = stmt.run(name);
      return { id: res.lastInsertRowid, name };
    },

    deleteBrand(id) {
      db.prepare('DELETE FROM brands WHERE id = ?').run(id);
      return { success: true };
    }
  };
}

module.exports = { masterDataDB };
