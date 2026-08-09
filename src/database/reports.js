function reportsDB(db) {
  const localDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return {
    getDaily(date) {
      const dateStr = date || localDate();

      const sales = db.prepare(`
        SELECT 
          COUNT(*) as total_sales,
          COALESCE(SUM(total_amount), 0) as total_revenue,
          COALESCE(SUM(discount_amount), 0) as total_discounts
        FROM sales WHERE DATE(created_at) = ?
      `).get(dateStr);

      const profit = db.prepare(`
        SELECT COALESCE(SUM((si.price_at_sale - si.purchase_price_at_sale) * si.quantity), 0) as total_profit
        FROM sale_items si JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.created_at) = ?
      `).get(dateStr);

      const customers = db.prepare(`
        SELECT COUNT(DISTINCT CASE WHEN customer_phone IS NOT NULL THEN customer_phone ELSE customer_name END) as unique_customers
        FROM sales WHERE DATE(created_at) = ?
      `).get(dateStr);

      const topProducts = db.prepare(`
        SELECT si.product_name, si.product_size, si.product_color, SUM(si.quantity) as total_qty, SUM(si.line_total) as total_revenue
        FROM sale_items si JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.created_at) = ?
        GROUP BY si.product_id ORDER BY total_qty DESC LIMIT 10
      `).all(dateStr);

      const returns = db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(refund_amount), 0) as total_refund
        FROM returns WHERE DATE(created_at) = ?
      `).get(dateStr);

      return { date: dateStr, ...sales, ...profit, ...customers, topProducts, returns };
    },

    getMonthly(year, month) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

      const sales = db.prepare(`
        SELECT COUNT(*) as total_sales, COALESCE(SUM(total_amount), 0) as total_revenue,
               COALESCE(SUM(discount_amount), 0) as total_discounts
        FROM sales WHERE created_at >= ? AND created_at <= ?
      `).get(startDate, endDate + ' 23:59:59');

      const profit = db.prepare(`
        SELECT COALESCE(SUM((si.price_at_sale - si.purchase_price_at_sale) * si.quantity), 0) as total_profit
        FROM sale_items si JOIN sales s ON si.sale_id = s.id
        WHERE s.created_at >= ? AND s.created_at <= ?
      `).get(startDate, endDate + ' 23:59:59');

      const customers = db.prepare(`
        SELECT COUNT(DISTINCT CASE WHEN customer_phone IS NOT NULL THEN customer_phone ELSE customer_name END) as unique_customers
        FROM sales WHERE created_at >= ? AND created_at <= ?
      `).get(startDate, endDate + ' 23:59:59');

      const dailyBreakdown = db.prepare(`
        SELECT DATE(created_at) as date, COUNT(*) as sales_count, COALESCE(SUM(total_amount), 0) as revenue
        FROM sales WHERE created_at >= ? AND created_at <= ?
        GROUP BY DATE(created_at) ORDER BY date
      `).all(startDate, endDate + ' 23:59:59');

      const topProducts = db.prepare(`
        SELECT si.product_name, si.product_size, si.product_color, SUM(si.quantity) as total_qty, SUM(si.line_total) as total_revenue
        FROM sale_items si JOIN sales s ON si.sale_id = s.id
        WHERE s.created_at >= ? AND s.created_at <= ?
        GROUP BY si.product_id ORDER BY total_qty DESC LIMIT 10
      `).all(startDate, endDate + ' 23:59:59');

      const returns = db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(refund_amount), 0) as total_refund
        FROM returns WHERE created_at >= ? AND created_at <= ?
      `).get(startDate, endDate + ' 23:59:59');

      // Previous month comparison
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
      const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-31`;

      const prevSales = db.prepare(`
        SELECT COUNT(*) as total_sales, COALESCE(SUM(total_amount), 0) as total_revenue
        FROM sales WHERE created_at >= ? AND created_at <= ?
      `).get(prevStart, prevEnd + ' 23:59:59');

      return {
        year, month, ...sales, ...profit, ...customers,
        dailyBreakdown, topProducts, returns,
        previousMonth: prevSales,
      };
    },

    getCategory(startDate, endDate) {
      const params = [];
      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = 'AND s.created_at >= ? AND s.created_at <= ?';
        params.push(startDate, endDate + ' 23:59:59');
      }

      const data = db.prepare(`
        SELECT p.category,
               COUNT(DISTINCT s.id) as total_sales,
               COALESCE(SUM(si.quantity), 0) as total_qty,
               COALESCE(SUM(si.line_total), 0) as total_revenue,
               COALESCE(SUM((si.price_at_sale - si.purchase_price_at_sale) * si.quantity), 0) as total_profit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE 1=1 ${dateFilter}
        GROUP BY p.category
        ORDER BY total_revenue DESC
      `).all(...params);

      return data;
    },

    getSizeColor(startDate, endDate) {
      const params = [];
      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = 'AND s.created_at >= ? AND s.created_at <= ?';
        params.push(startDate, endDate + ' 23:59:59');
      }

      const bySize = db.prepare(`
        SELECT si.product_size as variant, 'size' as type,
               COALESCE(SUM(si.quantity), 0) as total_qty,
               COALESCE(SUM(si.line_total), 0) as total_revenue
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE si.product_size IS NOT NULL AND si.product_size != '' ${dateFilter}
        GROUP BY si.product_size ORDER BY total_qty DESC
      `).all(...params);

      const byColor = db.prepare(`
        SELECT si.product_color as variant, 'color' as type,
               COALESCE(SUM(si.quantity), 0) as total_qty,
               COALESCE(SUM(si.line_total), 0) as total_revenue
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE si.product_color IS NOT NULL AND si.product_color != '' ${dateFilter}
        GROUP BY si.product_color ORDER BY total_qty DESC
      `).all(...params);

      return { bySize, byColor };
    },

    getTopProducts(limit = 10, startDate, endDate) {
      const params = [];
      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = 'AND s.created_at >= ? AND s.created_at <= ?';
        params.push(startDate, endDate + ' 23:59:59');
      }

      return db.prepare(`
        SELECT si.product_name, si.product_size, si.product_color,
               p.category, p.sale_price, p.purchase_price,
               COALESCE(SUM(si.quantity), 0) as total_qty,
               COALESCE(SUM(si.line_total), 0) as total_revenue,
               COALESCE(SUM((si.price_at_sale - si.purchase_price_at_sale) * si.quantity), 0) as total_profit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        LEFT JOIN products p ON si.product_id = p.id
        WHERE 1=1 ${dateFilter}
        GROUP BY si.product_id ORDER BY total_qty DESC LIMIT ?
      `).all(...params, limit);
    },
  };
}

module.exports = { reportsDB };
