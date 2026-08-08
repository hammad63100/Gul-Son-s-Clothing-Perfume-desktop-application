function customersDB(db) {
  return {
    getAll(search) {
      let query = 'SELECT * FROM customers';
      const params = [];

      if (search) {
        query += ' WHERE name LIKE ? OR phone LIKE ? OR customer_code LIKE ?';
        const s = `%${search}%`;
        params.push(s, s, s);
      }

      query += ' ORDER BY last_visit DESC';
      const results = db.prepare(query).all(...params);
      return results.map(c => {
        if (!c.customer_code) c.customer_code = 'CUST-' + String(c.id).padStart(4, '0');
        return c;
      });
    },

    get(id) {
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      if (!customer) return null;
      if (!customer.customer_code) customer.customer_code = 'CUST-' + String(customer.id).padStart(4, '0');

      // Match criteria for this customer's sales
      let matchClause = '';
      const matchParams = [];
      if (customer.phone) {
        matchClause = 's.customer_phone = ?';
        matchParams.push(customer.phone);
      } else {
        matchClause = 's.customer_name = ? AND s.customer_phone IS NULL';
        matchParams.push(customer.name);
      }

      // 1. Get Purchase History with Profit
      const salesQuery = `
        SELECT s.*, 
               (SELECT SUM((si.price_at_sale - si.purchase_price_at_sale) * si.quantity) 
                FROM sale_items si WHERE si.sale_id = s.id) as profit
        FROM sales s 
        WHERE ${matchClause}
        ORDER BY s.created_at DESC
      `;
      customer.purchases = db.prepare(salesQuery).all(...matchParams);

      // Calculate Customer-wise Profit
      customer.total_profit = customer.purchases.reduce((sum, sale) => sum + (sale.profit || 0), 0);

      // 2. Get Return History
      const returnsQuery = `
        SELECT r.* 
        FROM returns r 
        JOIN sales s ON r.sale_id = s.id
        WHERE ${matchClause}
        ORDER BY r.created_at DESC
      `;
      customer.returns = db.prepare(returnsQuery).all(...matchParams);

      // 3. Get Payment History
      customer.payments = db.prepare('SELECT * FROM customer_payments WHERE customer_id = ? ORDER BY created_at DESC').all(id);

      return customer;
    },

    update(id, data) {
      return db.transaction(() => {
        const setCols = [];
        const params = [];
        const updatable = ['name', 'phone', 'address', 'email', 'customer_code', 'total_purchases', 'total_payments', 'outstanding_balance'];
        
        for (const key of updatable) {
          if (data[key] !== undefined) {
            setCols.push(`${key} = ?`);
            params.push(data[key]);
          }
        }
        
        if (setCols.length === 0) return true;
        
        params.push(id);
        const query = `UPDATE customers SET ${setCols.join(', ')} WHERE id = ?`;
        db.prepare(query).run(...params);
        return true;
      })();
    },

    addPayment(id, amount, method, note) {
      return db.transaction(() => {
        // Log payment
        db.prepare(`
          INSERT INTO customer_payments (customer_id, amount, payment_method, note) 
          VALUES (?, ?, ?, ?)
        `).run(id, amount, method, note);

        // Update customer balances
        db.prepare(`
          UPDATE customers 
          SET total_payments = total_payments + ?,
              outstanding_balance = CASE 
                WHEN outstanding_balance - ? < 0 THEN 0 
                ELSE outstanding_balance - ? 
              END
          WHERE id = ?
        `).run(amount, amount, amount, id);
        
        return true;
      })();
    },
    
    getLedger(id) {
      const customer = this.get(id);
      if (!customer) return [];
      
      const ledger = [];
      
      // Fetch items for purchases to show detailed ledger
      const itemsStmt = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
      
      // Add purchases
      customer.purchases.forEach(sale => {
        const items = itemsStmt.all(sale.id);
        const itemNames = items && items.length > 0 
          ? items.map(i => `${i.product_name} (${i.quantity}x)`).join(', ') 
          : 'No items';

        ledger.push({
          type: 'Purchase',
          date: sale.created_at,
          reference: sale.invoice_no,
          amount_debit: sale.total_amount, // Adds to balance
          amount_credit: 0,
          description: `Invoice: ${sale.invoice_no}<br><small style="color:var(--color-text-muted);">${itemNames}</small>`,
          method: sale.payment_method
        });
      });
      
      // Add returns
      customer.returns.forEach(ret => {
        ledger.push({
          type: 'Return',
          date: ret.created_at,
          reference: ret.sale_invoice_no,
          amount_debit: 0,
          amount_credit: ret.refund_amount, // Reduces balance
          description: `Return: ${ret.product_name} (${ret.quantity} pcs)`,
          method: ret.refund_type || 'Adjustment'
        });
      });
      
      // Add payments
      customer.payments.forEach(pay => {
        ledger.push({
          type: 'Payment',
          date: pay.created_at,
          reference: `PAY-${pay.id}`,
          amount_debit: 0,
          amount_credit: pay.amount, // Reduces balance
          description: pay.note || 'Payment Received',
          method: pay.payment_method
        });
      });
      
      // Sort chronologically (oldest first for running balance)
      ledger.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Compute running balance
      let runningBalance = 0;
      ledger.forEach(entry => {
        runningBalance += entry.amount_debit;
        runningBalance -= entry.amount_credit;
        entry.balance = runningBalance;
      });
      
      // Reverse so newest is at the top
      return ledger.reverse();
    }
  };
}

module.exports = { customersDB };
