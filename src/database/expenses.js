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

      const expenseType = filters.expense_type || filters.type;
      if (expenseType) {
        conditions.push('expense_type = ?');
        params.push(expenseType);
      }
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
        conditions.push('(title LIKE ? OR description LIKE ? OR category LIKE ?)');
        const s = `%${filters.search}%`;
        params.push(s, s, s);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY date DESC, id DESC';
      return db.prepare(query).all(...params);
    },

    add(data) {
      const amount = Number(data.amount);
      const expense_type = data.expense_type === 'home' ? 'home' : 'shop';
      let title = String(data.title || '').trim();

      if (expense_type === 'home' && !title) {
        title = data.description ? String(data.description).trim() : 'Home Expense';
      }

      if (!title) {
        throw new Error('Expense title or description is required');
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Expense amount must be greater than zero');
      }

      const category = expense_type === 'home' ? (data.category || 'Home Expense') : (data.category || 'Shop Rent');
      const payment_method = data.payment_method || 'Cash';
      const date = data.date || localDate();
      const description = data.description ? String(data.description).trim() : null;

      const stmt = db.prepare(`
        INSERT INTO expenses (title, category, expense_type, amount, payment_method, date, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const res = stmt.run(
        title,
        category,
        expense_type,
        amount,
        payment_method,
        date,
        description
      );
      return { id: res.lastInsertRowid, title, category, expense_type, amount, payment_method, date, description };
    },

    delete(id) {
      db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
      return { success: true };
    },

    getSummary(startDate, endDate, expenseType) {
      let query = 'SELECT COALESCE(SUM(amount), 0) as total FROM expenses';
      const params = [];
      const conditions = [];

      if (expenseType) {
        conditions.push('expense_type = ?');
        params.push(expenseType);
      }
      if (startDate && endDate) {
        conditions.push('date >= ? AND date <= ?');
        params.push(startDate, endDate);
      } else if (startDate) {
        conditions.push('date >= ?');
        params.push(startDate);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      const res = db.prepare(query).get(...params);
      return res ? res.total : 0;
    },

    getBreakdown(startDate, endDate) {
      let whereClause = '';
      const params = [];
      if (startDate && endDate) {
        whereClause = ' WHERE date >= ? AND date <= ?';
        params.push(startDate, endDate);
      }

      const rows = db.prepare(`
        SELECT
          expense_type,
          COALESCE(SUM(amount), 0) as total_amount,
          COUNT(*) as total_count
        FROM expenses
        ${whereClause}
        GROUP BY expense_type
      `).all(...params);

      let shopTotal = 0, homeTotal = 0, shopCount = 0, homeCount = 0;
      for (const r of rows) {
        if (r.expense_type === 'home') {
          homeTotal = r.total_amount || 0;
          homeCount = r.total_count || 0;
        } else {
          shopTotal = r.total_amount || 0;
          shopCount = r.total_count || 0;
        }
      }

      return {
        total: shopTotal + homeTotal,
        shopTotal,
        homeTotal,
        shopCount,
        homeCount
      };
    }
  };
}

module.exports = { expensesDB };
