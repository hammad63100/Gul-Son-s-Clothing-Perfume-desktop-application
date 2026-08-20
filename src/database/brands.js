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

    // Fragrance Types
    getFragranceTypes() {
      return db.prepare('SELECT * FROM fragrance_types ORDER BY name ASC').all();
    },

    addFragranceType(name) {
      const trimmed = String(name || '').trim();
      if (!trimmed) throw new Error('Fragrance type name is required');
      const stmt = db.prepare('INSERT OR IGNORE INTO fragrance_types (name) VALUES (?)');
      const res = stmt.run(trimmed);
      return { id: res.lastInsertRowid, name: trimmed };
    },

    deleteFragranceType(id) {
      db.prepare('DELETE FROM fragrance_types WHERE id = ?').run(id);
      return { success: true };
    }
  };
}

module.exports = { masterDataDB };
