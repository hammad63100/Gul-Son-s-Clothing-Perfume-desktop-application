/**
 * Purchase Returns — tracks items returned TO a supplier/company.
 * When a purchase return is processed the quantity is DEDUCTED from stock.
 */
function purchaseReturnsDB(db) {
  return {
    /**
     * Process a purchase return — deduct quantity from stock.
     * @param {number} productId   - Product being returned to supplier
     * @param {number} quantity    - Number of units being returned
     * @param {string} supplier    - Supplier / company the goods go back to
     * @param {string} reason      - Reason for the return (e.g. defective, excess stock)
     * @param {string} [notes]     - Optional additional notes
     */
    process(productId, quantity, supplier, reason, notes = null) {
      const txn = db.transaction(() => {
        quantity = Number(quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error('Return quantity must be a whole number greater than zero');
        }

        const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(productId);
        if (!product) throw new Error('Active product not found');

        if (product.quantity < quantity) {
          throw new Error(`Cannot return ${quantity} units to supplier. Only ${product.quantity} in stock.`);
        }

        // Deduct stock
        db.prepare("UPDATE products SET quantity = quantity - ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
          .run(quantity, productId);

        // Calculate refund value at purchase price
        const refundValue = (product.purchase_price || 0) * quantity;

        // Insert purchase return record
        db.prepare(`
          INSERT INTO purchase_returns (product_id, product_name, quantity, supplier, reason, notes, refund_value, purchase_price_at_return)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          productId,
          product.name,
          quantity,
          supplier || product.supplier || 'Unknown',
          reason || 'No reason specified',
          notes,
          refundValue,
          product.purchase_price || 0
        );

        // Log stock adjustment
        db.prepare(`
          INSERT INTO stock_adjustments (product_id, product_name, adjustment_type, quantity, reason)
          VALUES (?, ?, 'purchase_return', ?, ?)
        `).run(
          productId,
          product.name,
          quantity,
          `Returned to ${supplier || product.supplier || 'supplier'}: ${reason || 'No reason specified'}`
        );

        return {
          success: true,
          product_name: product.name,
          quantity,
          refund_value: refundValue,
          new_stock: product.quantity - quantity,
        };
      });

      return txn();
    },

    /**
     * Get all purchase returns with optional filtering.
     */
    getAll(filters = {}) {
      let query = 'SELECT * FROM purchase_returns';
      const params = [];
      const conditions = [];

      if (filters.startDate) {
        conditions.push('created_at >= ?');
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        conditions.push('created_at <= ?');
        params.push(filters.endDate + ' 23:59:59');
      }
      if (filters.search) {
        conditions.push('(product_name LIKE ? OR supplier LIKE ? OR reason LIKE ?)');
        const s = `%${filters.search}%`;
        params.push(s, s, s);
      }
      if (filters.supplier) {
        conditions.push('supplier = ?');
        params.push(filters.supplier);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY id DESC';
      return db.prepare(query).all(...params);
    },
  };
}

module.exports = { purchaseReturnsDB };
