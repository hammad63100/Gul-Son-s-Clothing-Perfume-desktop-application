function expensesDB(db) {
  const localDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return {
    getAll(filters = {}) {
      let query = 'SELECT * FROM expenses';
      const params = [];
      const conditions = [];

      if (filters.startDate) {
        conditions.push('date >= ?');
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        conditions.push('date <= ?');
        params.push(filters.endDate);
      }
      if (filters.category) {
        conditions.push('category = ?');
        params.push(filters.category);
      }
      if (filters.search) {
        conditions.push('(title LIKE ? OR description LIKE ?)');
        const s = `%${filters.search}%`;
        params.push(s, s);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY date DESC, id DESC';
      return db.prepare(query).all(...params);
    },

    add(data) {
      const stmt = db.prepare(`
        INSERT INTO expenses (title, category, amount, payment_method, date, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const res = stmt.run(
        data.title,
        data.category || 'Shop Rent',
        data.amount || 0,
        data.payment_method || 'Cash',
        data.date || localDate(),
        data.description || null
      );
      return { id: res.lastInsertRowid, ...data };
    },

    delete(id) {
      db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
      return { success: true };
    },

    getSummary(startDate, endDate) {
      let query = 'SELECT COALESCE(SUM(amount), 0) as total FROM expenses';
      const params = [];

      if (startDate && endDate) {
        query += ' WHERE date >= ? AND date <= ?';
        params.push(startDate, endDate);
      }

      const res = db.prepare(query).get(...params);
      return res ? res.total : 0;
    }
  };
}

module.exports = { expensesDB };
