function productsDB(db) {
  return {
    getAll(filters = {}) {
      let query = 'SELECT * FROM products WHERE is_active = 1';
      const params = [];

      if (filters.search) {
        // Search every user-visible product identifier/attribute. The Search
        // page is also used for SKU, brand and variant lookups.
        query += ` AND (
          LOWER(name) LIKE LOWER(?) OR LOWER(COALESCE(barcode, '')) LIKE LOWER(?) OR
          LOWER(COALESCE(sku, '')) LIKE LOWER(?) OR LOWER(COALESCE(brand, '')) LIKE LOWER(?) OR
          LOWER(COALESCE(supplier, '')) LIKE LOWER(?) OR LOWER(COALESCE(size, '')) LIKE LOWER(?) OR
          LOWER(COALESCE(color, '')) LIKE LOWER(?) OR LOWER(COALESCE(fabric, '')) LIKE LOWER(?) OR
          LOWER(COALESCE(fragrance_type, '')) LIKE LOWER(?) OR LOWER(COALESCE(gender, '')) LIKE LOWER(?)
        )`;
        const s = `%${filters.search}%`;
        params.push(s, s, s, s, s, s, s, s, s, s);
      }
      if (filters.category) {
        query += ' AND category = ?';
        params.push(filters.category);
      }
      if (filters.lowStock) {
        query += ' AND quantity <= low_stock_threshold';
      }
      if (filters.outOfStock) {
        query += ' AND quantity <= 0';
      }
      if (filters.size) {
        query += ' AND size = ?';
        params.push(filters.size);
      }
      if (filters.color) {
        query += ' AND color = ?';
        params.push(filters.color);
      }

      query += ' ORDER BY created_at DESC';
      return db.prepare(query).all(...params);
    },

    get(id) {
      return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    },

    add(data) {
      const stmt = db.prepare(`
        INSERT INTO products (name, category, brand, size, color, fabric, fragrance_type, gender, barcode, sku, purchase_price, sale_price, quantity, low_stock_threshold, supplier)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        data.name,
        data.category || 'Clothes',
        data.brand || null,
        data.size || null,
        data.color || null,
        data.fabric || null,
        data.fragrance_type || null,
        data.gender || null,
        data.barcode || null,
        data.sku || data.barcode || null,
        data.purchase_price || 0,
        data.sale_price || 0,
        data.quantity || 0,
        data.low_stock_threshold || 5,
        data.supplier || null
      );
      return { id: result.lastInsertRowid, ...data };
    },

    update(id, data) {
      const fields = [];
      const params = [];

      const allowedFields = ['name', 'category', 'brand', 'size', 'color', 'fabric', 'fragrance_type', 'gender', 'barcode', 'sku', 'purchase_price', 'sale_price', 'quantity', 'low_stock_threshold', 'supplier'];
      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          fields.push(`${field} = ?`);
          params.push(data[field]);
        }
      }

      if (fields.length === 0) return null;

      fields.push("updated_at = datetime('now', 'localtime')");
      params.push(id);

      const stmt = db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...params);
      return this.get(id);
    },

    delete(id) {
      // Soft delete
      db.prepare("UPDATE products SET is_active = 0, updated_at = datetime('now', 'localtime') WHERE id = ?").run(id);
      return { success: true };
    },

    stockIn(id, quantity, supplier, date) {
      const txn = db.transaction(() => {
        db.prepare("UPDATE products SET quantity = quantity + ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(quantity, id);
        
        const product = this.get(id);
        db.prepare(`
          INSERT INTO stock_adjustments (product_id, product_name, adjustment_type, quantity, reason)
          VALUES (?, ?, 'stock_in', ?, ?)
        `).run(id, product.name, quantity, `Stock in from ${supplier || 'supplier'} on ${date || new Date().toISOString().split('T')[0]}`);

        if (supplier && product) {
          db.prepare("UPDATE products SET supplier = ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(supplier, id);
        }

        return this.get(id);
      });
      return txn();
    },

    adjustStock(id, quantity, reason) {
      const txn = db.transaction(() => {
        const product = this.get(id);
        db.prepare("UPDATE products SET quantity = quantity - ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(quantity, id);
        
        db.prepare(`
          INSERT INTO stock_adjustments (product_id, product_name, adjustment_type, quantity, reason)
          VALUES (?, ?, 'adjustment', ?, ?)
        `).run(id, product.name, quantity, reason || 'Stock adjustment');

        return this.get(id);
      });
      return txn();
    },

    getLowStock(threshold) {
      const t = threshold || 5;
      return db.prepare('SELECT * FROM products WHERE is_active = 1 AND quantity <= low_stock_threshold ORDER BY quantity ASC').all();
    },

    getTopSelling(limit = 5, dateRange = {}) {
      let dateFilter = '';
      const params = [];

      if (dateRange.startDate) {
        dateFilter += ' AND s.created_at >= ?';
        params.push(dateRange.startDate);
      }
      if (dateRange.endDate) {
        dateFilter += ' AND s.created_at <= ?';
        params.push(dateRange.endDate + ' 23:59:59');
      }

      // First get all active products
      const productsList = db.prepare('SELECT id, name, category, size, color, sale_price FROM products WHERE is_active = 1').all();
      
      // If there are no products, return empty array
      if (!productsList || productsList.length === 0) return [];
      
      const salesQuery = `
        SELECT si.product_id, COALESCE(SUM(si.quantity), 0) as total_sold, COALESCE(SUM(si.line_total), 0) as total_revenue
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE 1=1 ${dateFilter}
        GROUP BY si.product_id
      `;
      
      const salesData = db.prepare(salesQuery).all(...params) || [];
      const salesMap = {};
      for (const row of salesData) {
        salesMap[row.product_id] = { sold: row.total_sold, rev: row.total_revenue };
      }
      
      const results = [];
      for (const p of productsList) {
        const s = salesMap[p.id] || { sold: 0, rev: 0 };
        if (s.sold > 0) {
          results.push({
            id: p.id,
            name: p.name,
            category: p.category,
            size: p.size,
            color: p.color,
            sale_price: p.sale_price,
            total_sold: s.sold,
            total_revenue: s.rev
          });
        }
      }
      
      // Sort descending by total_sold and apply limit
      results.sort((a, b) => b.total_sold - a.total_sold);
      return results.slice(0, limit);
    },

    getAllSizes() {
      return db.prepare("SELECT DISTINCT size FROM products WHERE size IS NOT NULL AND size != '' AND is_active = 1 ORDER BY size").all().map(r => r.size);
    },

    getAllColors() {
      return db.prepare("SELECT DISTINCT color FROM products WHERE color IS NOT NULL AND color != '' AND is_active = 1 ORDER BY color").all().map(r => r.color);
    },
  };
}

module.exports = { productsDB };
