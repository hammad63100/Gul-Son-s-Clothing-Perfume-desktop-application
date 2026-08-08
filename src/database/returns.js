function returnsDB(db) {
  return {
    process(saleId, productId, quantity, reason, customReason = null, refundType = 'Cash Refund') {
      const txn = db.transaction(() => {
        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
        if (!sale) throw new Error('Sale not found');

        const saleItem = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? AND product_id = ?').get(saleId, productId);
        if (!saleItem) throw new Error('Product not found in this sale');

        // Check return quantity limit
        const alreadyReturned = db.prepare('SELECT COALESCE(SUM(quantity), 0) as qty FROM returns WHERE sale_id = ? AND product_id = ?').get(saleId, productId);
        const maxReturnable = saleItem.quantity - alreadyReturned.qty;
        if (quantity > maxReturnable) {
          throw new Error(`Cannot return ${quantity} items. Maximum returnable: ${maxReturnable}`);
        }

        const refundAmount = saleItem.price_at_sale * quantity;
        const finalReason = reason === 'Other' ? (customReason || 'Other') : (reason || 'No reason specified');

        // Insert return record
        db.prepare(`
          INSERT INTO returns (sale_id, sale_invoice_no, product_id, product_name, quantity, refund_amount, reason, refund_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(saleId, sale.invoice_no, productId, saleItem.product_name, quantity, refundAmount, finalReason, refundType);

        // Auto-restore stock
        db.prepare("UPDATE products SET quantity = quantity + ?, updated_at = datetime('now', 'localtime') WHERE id = ?").run(quantity, productId);

        // Adjust sale total
        db.prepare('UPDATE sales SET total_amount = MAX(0, total_amount - ?) WHERE id = ?').run(refundAmount, saleId);

        // Adjust customer total purchase volume / balance if customer exists
        if (sale.customer_name || sale.customer_phone) {
          const cust = sale.customer_phone
            ? db.prepare('SELECT * FROM customers WHERE phone = ?').get(sale.customer_phone)
            : db.prepare('SELECT * FROM customers WHERE LOWER(name) = LOWER(?)').get(sale.customer_name);

          if (cust) {
            db.prepare('UPDATE customers SET total_purchases = MAX(0, total_purchases - ?) WHERE id = ?').run(refundAmount, cust.id);
          }
        }

        // Log stock adjustment
        db.prepare(`
          INSERT INTO stock_adjustments (product_id, product_name, adjustment_type, quantity, reason)
          VALUES (?, ?, 'return', ?, ?)
        `).run(productId, saleItem.product_name, quantity, `Return from invoice ${sale.invoice_no} (${refundType}): ${finalReason}`);

        return {
          success: true,
          refund_amount: refundAmount,
          invoice_no: sale.invoice_no,
        };
      });

      return txn();
    },

    processFullInvoice(saleId, reason, customReason = null, refundType = 'Cash Refund') {
      const txn = db.transaction(() => {
        const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
        if (!sale) throw new Error('Sale not found');

        const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
        let totalRefund = 0;

        for (const item of items) {
          const alreadyReturned = db.prepare('SELECT COALESCE(SUM(quantity), 0) as qty FROM returns WHERE sale_id = ? AND product_id = ?').get(saleId, item.product_id);
          const maxReturnable = item.quantity - alreadyReturned.qty;

          if (maxReturnable > 0) {
            this.process(saleId, item.product_id, maxReturnable, reason, customReason, refundType);
            totalRefund += item.price_at_sale * maxReturnable;
          }
        }

        return { success: true, invoice_no: sale.invoice_no, totalRefund };
      });

      return txn();
    },

    getAll(filters = {}) {
      let query = 'SELECT * FROM returns';
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
        conditions.push('(sale_invoice_no LIKE ? OR product_name LIKE ? OR reason LIKE ?)');
        const s = `%${filters.search}%`;
        params.push(s, s, s);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY id DESC';
      return db.prepare(query).all(...params);
    },
  };
}

module.exports = { returnsDB };
