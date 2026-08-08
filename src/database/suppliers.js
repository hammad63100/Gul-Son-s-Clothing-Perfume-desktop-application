function suppliersDB(db) {
  return {
    getAll(search = '') {
      let query = 'SELECT * FROM suppliers';
      const params = [];
      if (search) {
        query += ' WHERE name LIKE ? OR company LIKE ? OR phone LIKE ?';
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      query += ' ORDER BY name';
      return db.prepare(query).all(...params);
    },

    add(data) {
      const stmt = db.prepare(`
        INSERT INTO suppliers (name, company, phone, address, email, opening_balance)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const res = stmt.run(
        data.name,
        data.company || null,
        data.phone || null,
        data.address || null,
        data.email || null,
        data.opening_balance || 0
      );
      return { id: res.lastInsertRowid, ...data };
    },

    update(id, data) {
      db.prepare(`
        UPDATE suppliers SET
          name = COALESCE(?, name),
          company = COALESCE(?, company),
          phone = COALESCE(?, phone),
          address = COALESCE(?, address),
          email = COALESCE(?, email),
          opening_balance = COALESCE(?, opening_balance)
        WHERE id = ?
      `).run(data.name, data.company, data.phone, data.address, data.email, data.opening_balance, id);
      return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    },

    delete(id) {
      db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
      return { success: true };
    }
  };
}

module.exports = { suppliersDB };
