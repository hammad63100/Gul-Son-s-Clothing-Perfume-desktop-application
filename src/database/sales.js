function salesDB(db) {
  return {
    getNextInvoiceNo() {
      const prefix = db.prepare("SELECT value FROM settings WHERE key = 'invoice_prefix'").get();
      const nextNum = db.prepare("SELECT value FROM settings WHERE key = 'invoice_next_number'").get();
      const p = prefix ? prefix.value : 'GS';
      const n = nextNum ? parseInt(nextNum.value) : 1;
      return `${p}-${String(n).padStart(6, '0')}`;
    },

    create(saleData, items) {
      const txn = db.transaction(() => {
        if (!Array.isArray(items) || items.length === 0) throw new Error('A sale must contain at least one item');
        if (!saleData || typeof saleData !== 'object') throw new Error('Sale details are required');
        const invoiceNo = this.getNextInvoiceNo();

        // Calculate totals
        let subtotal = 0;
        const requestedQuantities = new Map();
        for (const item of items) {
          const quantity = Number(item.quantity);
          const price = Number(item.price_at_sale);
          if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Each item quantity must be a whole number greater than zero');
          if (!Number.isFinite(price) || price < 0) throw new Error('Each item price must be a valid non-negative number');
          const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(item.product_id);
          if (!product) throw new Error('One or more products are unavailable');
          const requested = (requestedQuantities.get(product.id) || 0) + quantity;
          if (product.quantity < requested) throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}`);
          requestedQuantities.set(product.id, requested);
          subtotal += price * quantity;
        }

        const discountValue = Number(saleData.discount_value ?? 0);
        if (!Number.isFinite(discountValue) || discountValue < 0) throw new Error('Discount must be a valid non-negative number');
        let discountAmount = 0;
        if (saleData.discount_type === 'percentage') {
          if (discountValue > 100) throw new Error('Percentage discount cannot exceed 100%');
          discountAmount = subtotal * (discountValue / 100);
        } else {
          discountAmount = Math.min(discountValue, subtotal);
        }

        const taxAmount = Number(saleData.tax_amount ?? 0);
        if (!Number.isFinite(taxAmount) || taxAmount < 0) throw new Error('Tax must be a valid non-negative number');
        const totalAmount = Math.max(0, subtotal - discountAmount + taxAmount);

        // Insert sale
        db.prepare(`
          INSERT INTO sales (invoice_no, customer_name, customer_phone, subtotal, discount_type, discount_value, discount_amount, tax_amount, total_amount, payment_method, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          invoiceNo,
          saleData.customer_name || 'Walk-in Customer',
          saleData.customer_phone || null,
          subtotal,
          saleData.discount_type || 'flat',
          discountValue,
          discountAmount,
          taxAmount,
          totalAmount,
          saleData.payment_method || 'Cash',
          saleData.notes || null
        );

        // Fetch created sale record to get guaranteed ID
        const createdSale = db.prepare('SELECT * FROM sales WHERE invoice_no = ?').get(invoiceNo);
        if (!createdSale) {
          throw new Error(`Invoice ${invoiceNo} could not be read back after saving`);
        }
        const saleId = createdSale.id;

        // Insert sale items and decrement stock
        const insertItem = db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, product_name, product_size, product_color, quantity, price_at_sale, purchase_price_at_sale, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const decrementStock = db.prepare("UPDATE products SET quantity = MAX(0, quantity - ?), updated_at = datetime('now', 'localtime') WHERE id = ?");

        for (const item of items) {
          const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(item.product_id);
          insertItem.run(
            saleId,
            item.product_id,
            product ? product.name : item.product_name || 'Unknown',
            product ? product.size : null,
            product ? product.color : null,
            item.quantity,
            item.price_at_sale,
            product ? product.purchase_price : 0,
            item.price_at_sale * item.quantity
          );
          decrementStock.run(item.quantity, item.product_id);
        }

        // Upsert customer record
        const custName = (saleData.customer_name || '').trim();
        const custPhone = (saleData.customer_phone || '').trim();

        if (custName && custName.toLowerCase() !== 'walk-in customer') {
          let existingCustomer = null;

          if (custPhone) {
            existingCustomer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(custPhone);
          }
          if (!existingCustomer && custName) {
            existingCustomer = db.prepare('SELECT * FROM customers WHERE LOWER(name) = LOWER(?)').get(custName);
          }

          const isCredit = saleData.payment_method === 'Credit / Unpaid';
          const paymentAmount = isCredit ? 0 : totalAmount;
          const outstandingAdd = isCredit ? totalAmount : 0;

          if (existingCustomer) {
            db.prepare(`
              UPDATE customers SET 
                name = COALESCE(NULLIF(?, ''), name),
                phone = COALESCE(NULLIF(?, ''), phone),
                total_purchases = total_purchases + ?,
                total_payments = total_payments + ?,
                outstanding_balance = outstanding_balance + ?,
                visit_count = visit_count + 1,
                last_visit = datetime('now', 'localtime')
              WHERE id = ?
            `).run(custName, custPhone, totalAmount, paymentAmount, outstandingAdd, existingCustomer.id);
          } else {
            db.prepare(`
              INSERT INTO customers (name, phone, total_purchases, total_payments, outstanding_balance, visit_count, last_visit)
              VALUES (?, ?, ?, ?, ?, 1, datetime('now', 'localtime'))
            `).run(
              custName,
              custPhone || null,
              totalAmount,
              paymentAmount,
              outstandingAdd
            );
          }
        }

        // Increment next invoice number
        const currentNext = db.prepare("SELECT value FROM settings WHERE key = 'invoice_next_number'").get();
        const currentValue = currentNext ? Number.parseInt(currentNext.value, 10) : 1;
        const nextVal = Number.isSafeInteger(currentValue) && currentValue > 0 ? currentValue + 1 : 2;
        db.prepare("UPDATE settings SET value = ? WHERE key = 'invoice_next_number'").run(String(nextVal));

        return { saleId, invoice_no: invoiceNo, totalAmount };
      });

      return txn();
    },

    getAll(filters = {}) {
      let query = `
        SELECT s.*, 
               (SELECT COUNT(id) FROM sale_items WHERE sale_id = s.id) as item_count 
        FROM sales s
      `;
      const params = [];
      const conditions = [];

      if (filters.startDate) {
        conditions.push('s.created_at >= ?');
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        conditions.push('s.created_at <= ?');
        params.push(filters.endDate + ' 23:59:59');
      }
      if (filters.search) {
        const rawSearch = filters.search.trim();
        const searchLower = `%${rawSearch.toLowerCase()}%`;
        const digitsOnly = rawSearch.replace(/\D/g, '');
        const digitSearch = digitsOnly ? `%${parseInt(digitsOnly, 10)}%` : null;

        if (digitSearch) {
          conditions.push('(LOWER(s.invoice_no) LIKE ? OR LOWER(s.customer_name) LIKE ? OR LOWER(s.customer_phone) LIKE ? OR s.invoice_no LIKE ?)');
          params.push(searchLower, searchLower, searchLower, digitSearch);
        } else {
          conditions.push('(LOWER(s.invoice_no) LIKE ? OR LOWER(s.customer_name) LIKE ? OR LOWER(s.customer_phone) LIKE ?)');
          params.push(searchLower, searchLower, searchLower);
        }
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY s.id DESC';

      if (filters.limit) {
        query += ` LIMIT ${parseInt(filters.limit)}`;
      }

      return db.prepare(query).all(...params);
    },

    get(identifier) {
      if (!identifier) return null;
      let sale = null;
      if (typeof identifier === 'number' || !isNaN(Number(identifier))) {
        sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(Number(identifier));
      }
      if (!sale) {
        sale = db.prepare('SELECT * FROM sales WHERE invoice_no = ?').get(String(identifier));
      }
      if (!sale) return null;

      const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
      return { ...sale, items };
    },

    /**
     * getDailySummary - uses simple queries that work reliably with sql.js WASM.
     * Avoids subqueries with JOIN inside a SELECT expression (which can fail in sql.js).
     */
    getDailySummary(dateStr) {
      // Query 1: Basic sales counts for the date
      const salesRow = db.prepare(`
        SELECT 
          COUNT(id) as total_sales,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COUNT(DISTINCT NULLIF(customer_name, '')) as total_customers
        FROM sales
        WHERE DATE(created_at) = DATE(?)
      `).get(dateStr);

      // Query 2: Profit calculation - separate query to avoid complex subquery nesting
      let total_profit = 0;
      try {
        // Get all sale IDs for this date first
        const saleIds = db.prepare(
          "SELECT id FROM sales WHERE DATE(created_at) = DATE(?)"
        ).all(dateStr);
        
        if (saleIds && saleIds.length > 0) {
          // Calculate profit from all sale_items for these sales
          // Use a simple approach: iterate over sale IDs
          for (const s of saleIds) {
            const profitRow = db.prepare(
              "SELECT COALESCE(SUM(quantity * (price_at_sale - purchase_price_at_sale)), 0) as p FROM sale_items WHERE sale_id = ?"
            ).get(s.id);
            if (profitRow) total_profit += (profitRow.p || 0);
          }
        }
      } catch (e) {
        console.error('getDailySummary profit calc error:', e.message);
      }

      // Query 3: Deduct returned amounts for the date
      let returnDeduction = 0;
      try {
        const retRow = db.prepare(`
          SELECT COALESCE(SUM(refund_amount), 0) as total_returns
          FROM returns
          WHERE DATE(created_at) = DATE(?)
        `).get(dateStr);
        if (retRow) returnDeduction = retRow.total_returns || 0;
      } catch (e) {}

      return {
        total_sales: salesRow ? salesRow.total_sales : 0,
        total_revenue: salesRow ? (salesRow.total_revenue - returnDeduction) : 0,
        total_profit: Math.max(0, total_profit),
        total_customers: salesRow ? salesRow.total_customers : 0,
        total_returns: returnDeduction
      };
    },

    /**
     * getMonthlySummary - uses LIKE pattern instead of strftime for WASM compatibility.
     */
    getMonthlySummary(year, month) {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const monthPattern = `${monthStr}%`; // e.g. "2026-08%"

      // Query 1: Basic monthly sales
      const salesRow = db.prepare(`
        SELECT 
          COUNT(id) as total_sales,
          COALESCE(SUM(total_amount), 0) as total_revenue
        FROM sales
        WHERE created_at LIKE ?
      `).get(monthPattern);

      // Query 2: Monthly profit - separate calculation
      let total_profit = 0;
      try {
        const saleIds = db.prepare(
          "SELECT id FROM sales WHERE created_at LIKE ?"
        ).all(monthPattern);
        
        if (saleIds && saleIds.length > 0) {
          for (const s of saleIds) {
            const profitRow = db.prepare(
              "SELECT COALESCE(SUM(quantity * (price_at_sale - purchase_price_at_sale)), 0) as p FROM sale_items WHERE sale_id = ?"
            ).get(s.id);
            if (profitRow) total_profit += (profitRow.p || 0);
          }
        }
      } catch (e) {
        console.error('getMonthlySummary profit calc error:', e.message);
      }

      // Query 3: Monthly returns deduction
      let returnDeduction = 0;
      try {
        const retRow = db.prepare(`
          SELECT COALESCE(SUM(refund_amount), 0) as total_returns
          FROM returns
          WHERE created_at LIKE ?
        `).get(monthPattern);
        if (retRow) returnDeduction = retRow.total_returns || 0;
      } catch (e) {}

      return {
        total_sales: salesRow ? salesRow.total_sales : 0,
        total_revenue: salesRow ? (salesRow.total_revenue - returnDeduction) : 0,
        total_profit: Math.max(0, total_profit),
        total_returns: returnDeduction
      };
    }
  };
}

module.exports = { salesDB };
