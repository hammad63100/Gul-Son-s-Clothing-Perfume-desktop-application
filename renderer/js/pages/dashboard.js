/* Enhanced Owner Dashboard Controller */

window.DashboardPage = {
  async render(container) {
    container.innerHTML = `
      <div class="page-container animate-fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Gul Son's — Executive Dashboard</h1>
            <p class="page-subtitle">Complete overview of sales, profit, stock levels, expenses, cash, and category metrics</p>
          </div>
          <div class="toolbar" style="margin:0;">
            <button class="btn btn-primary" onclick="app.navigateTo('pos')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              <span>+ New Sales Invoice</span>
            </button>
          </div>
        </div>

        <!-- ─── Financial Metrics (Row 1) ─── -->
        <div class="grid grid-4 gap-4">
          <div class="stat-card">
            <div class="stat-icon gold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div class="stat-value" id="dash-today-sales">...</div>
            <div class="stat-label">1. Today's Total Sales</div>
          </div>

          <div class="stat-card">
            <div class="stat-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </div>
            <div class="stat-value" id="dash-today-profit">...</div>
            <div class="stat-label">2. Today's Net Profit</div>
          </div>

          <div class="stat-card">
            <div class="stat-icon red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div class="stat-value" id="dash-today-exp">...</div>
            <div class="stat-label">3. Today's Expenses</div>
          </div>

          <div class="stat-card">
            <div class="stat-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </div>
            <div class="stat-value" id="dash-cash-in-hand">...</div>
            <div class="stat-label">11. Cash In Hand</div>
          </div>
        </div>

        <!-- ─── Monthly & Invoice Performance (Row 2) ─── -->
        <div class="grid grid-4 gap-4" style="margin-top: var(--space-4);">
          <div class="stat-card">
            <div class="stat-icon gold">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
            <div class="stat-value" id="dash-monthly-sales">...</div>
            <div class="stat-label">14. Monthly Sales</div>
          </div>

          <div class="stat-card">
            <div class="stat-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
            </div>
            <div class="stat-value" id="dash-monthly-profit">...</div>
            <div class="stat-label">15. Monthly Net Profit</div>
          </div>

          <div class="stat-card">
            <div class="stat-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="stat-value" id="dash-today-invoices">...</div>
            <div class="stat-label">8. Today's Invoices</div>
          </div>

          <div class="stat-card">
            <div class="stat-icon red">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/></svg>
            </div>
            <div class="stat-value" id="dash-pending-supplier">...</div>
            <div class="stat-label">13. Pending Supplier Payables</div>
          </div>
        </div>

        <!-- ─── Inventory & Relationships (Row 3) ─── -->
        <div class="grid grid-6 gap-4" style="margin-top: var(--space-4); grid-template-columns: repeat(6, 1fr);">
          <div class="stat-card" style="padding: var(--space-3);">
            <div style="font-size: var(--text-xs); color: var(--color-text-muted);">4. Total Products</div>
            <div style="font-size: var(--text-lg); font-weight:700;" id="dash-total-products">...</div>
          </div>

          <div class="stat-card" style="padding: var(--space-3);">
            <div style="font-size: var(--text-xs); color: var(--color-text-muted);">5. Stock Value</div>
            <div style="font-size: var(--text-lg); font-weight:700; color: var(--color-accent);" id="dash-stock-value">...</div>
          </div>

          <div class="stat-card" style="padding: var(--space-3);">
            <div style="font-size: var(--text-xs); color: var(--color-text-muted);">6. Low Stock</div>
            <div style="font-size: var(--text-lg); font-weight:700; color: var(--color-warning);" id="dash-low-stock-cnt">...</div>
          </div>

          <div class="stat-card" style="padding: var(--space-3);">
            <div style="font-size: var(--text-xs); color: var(--color-text-muted);">7. Out of Stock</div>
            <div style="font-size: var(--text-lg); font-weight:700; color: var(--color-danger);" id="dash-out-stock-cnt">...</div>
          </div>

          <div class="stat-card" style="padding: var(--space-3);">
            <div style="font-size: var(--text-xs); color: var(--color-text-muted);">9. Total Customers</div>
            <div style="font-size: var(--text-lg); font-weight:700;" id="dash-total-customers">...</div>
          </div>

          <div class="stat-card" style="padding: var(--space-3);">
            <div style="font-size: var(--text-xs); color: var(--color-text-muted);">10. Total Suppliers</div>
            <div style="font-size: var(--text-lg); font-weight:700;" id="dash-total-suppliers">...</div>
          </div>
        </div>

        <!-- ─── Visual Charts Section ─── -->
        <div class="grid grid-2 gap-6" style="margin-top: var(--space-6);">
          
          <!-- Chart 1: Daily Sales Trend (Last 7 Days Bar Chart) -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">📈 Daily Sales Trend (Last 7 Days)</h3>
                <p class="card-subtitle">Revenue comparison across days</p>
              </div>
            </div>
            <div id="chart-daily-sales" style="padding: var(--space-4) 0; height: 180px; display: flex; align-items: flex-end; justify-content: space-around; gap: 8px;">
              <!-- Dynamic Bar Chart generated here -->
            </div>
          </div>

          <!-- Chart 2: Profit vs Expenses Breakdown -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">⚖️ Profit vs. Expenses Breakdown</h3>
                <p class="card-subtitle">Monthly financial health ratio</p>
              </div>
            </div>
            <div id="chart-profit-expenses" style="padding: var(--space-4) 0; display:flex; flex-direction:column; gap: var(--space-4);">
              <!-- Comparison Bars -->
            </div>
          </div>

        </div>

        <!-- ─── Category Breakdown: Top Perfumes & Top Clothes ─── -->
        <div class="grid grid-2 gap-6" style="margin-top: var(--space-6);">
          
          <!-- Top Selling Perfumes -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">🧴 Top-Selling Perfumes</h3>
              <span class="badge badge-perfume">Perfume Category</span>
            </div>
            <div class="table-container" style="margin-top:var(--space-3);">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Perfume Name</th>
                    <th>Volume</th>
                    <th>Units Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody id="dash-top-perfumes-body">
                  <tr><td colspan="4" style="text-align:center;"><div class="spinner"></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Top Selling Clothes -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">👔 Top-Selling Clothes</h3>
              <span class="badge badge-clothes">Clothes Category</span>
            </div>
            <div class="table-container" style="margin-top:var(--space-3);">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Size/Color</th>
                    <th>Units Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody id="dash-top-clothes-body">
                  <tr><td colspan="4" style="text-align:center;"><div class="spinner"></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        <!-- ─── Recent Activity: Transactions & Restock Alerts ─── -->
        <div class="grid grid-2 gap-6" style="margin-top: var(--space-6);">
          
          <!-- Recent Transactions -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">🧾 Recent Transactions</h3>
              <button class="btn btn-ghost btn-sm" onclick="app.navigateTo('sales-history')">View All</button>
            </div>
            <div class="table-container" style="margin-top:var(--space-3);">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody id="dash-recent-sales-body">
                  <tr><td colspan="4" style="text-align:center;"><div class="spinner"></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Low Stock Restock Alerts -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title" style="color:var(--color-warning);">⚠️ Restock Warnings</h3>
              <button class="btn btn-secondary btn-sm" onclick="app.navigateTo('inventory')">Inventory</button>
            </div>
            <div class="table-container" style="margin-top:var(--space-3);">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Stock Left</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="dash-restock-alerts-body">
                  <tr><td colspan="4" style="text-align:center;"><div class="spinner"></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const summary = await window.api.dashboard.getSummary();
      const curr = summary.currency || 'Rs.';

      // Row 1: Core Financials
      document.getElementById('dash-today-sales').textContent = formatters.currency(summary.today.total_revenue, curr);
      document.getElementById('dash-today-profit').textContent = formatters.currency(summary.netDailyProfit, curr);
      document.getElementById('dash-today-exp').textContent = formatters.currency(summary.todayExpenses, curr);
      document.getElementById('dash-cash-in-hand').textContent = formatters.currency(summary.cashInHand, curr);

      // Row 2: Monthly & Invoices
      document.getElementById('dash-monthly-sales').textContent = formatters.currency(summary.thisMonth.total_revenue, curr);
      document.getElementById('dash-monthly-profit').textContent = formatters.currency(summary.netMonthlyProfit, curr);
      document.getElementById('dash-today-invoices').textContent = `${summary.today.total_sales} bills`;
      document.getElementById('dash-pending-supplier').textContent = formatters.currency(summary.pendingSupplierPayments, curr);

      // Row 3: Counts & Stock Valuation
      document.getElementById('dash-total-products').textContent = `${summary.totalProducts} (${summary.totalClothes} Clt / ${summary.totalPerfume} Prf)`;
      document.getElementById('dash-stock-value').textContent = formatters.currency(summary.stockValue, curr);
      document.getElementById('dash-low-stock-cnt').textContent = `${summary.lowStockProducts.length} items`;
      document.getElementById('dash-out-stock-cnt').textContent = `${summary.outOfStockCount} items`;
      document.getElementById('dash-total-customers').textContent = `${summary.totalCustomers}`;
      document.getElementById('dash-total-suppliers').textContent = `${summary.totalSuppliers}`;

      // Update sidebar low stock badge
      const badge = document.getElementById('sidebar-low-stock-badge');
      if (badge) {
        if (summary.lowStockProducts.length > 0) {
          badge.textContent = summary.lowStockProducts.length;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      // Chart 1: Daily Sales Trend (Last 7 Days)
      const dailyChartEl = document.getElementById('chart-daily-sales');
      if (summary.last7Days && summary.last7Days.length > 0) {
        const maxRev = Math.max(...summary.last7Days.map(d => d.revenue), 100);
        dailyChartEl.innerHTML = summary.last7Days.map(d => {
          const heightPct = Math.max(10, Math.round((d.revenue / maxRev) * 100));
          return `
            <div style="display:flex; flex-direction:column; align-items:center; flex:1; height:100%; justify-content:flex-end;">
              <div style="font-size:10px; color:var(--color-text-muted); margin-bottom:4px;">${d.revenue > 0 ? formatters.currency(d.revenue, '') : '0'}</div>
              <div style="width:70%; max-width:32px; height:${heightPct}%; background:linear-gradient(180deg, var(--color-accent), #8a7330); border-radius:4px 4px 0 0;" title="${d.date}: ${formatters.currency(d.revenue, curr)}"></div>
              <div style="font-size:11px; font-weight:600; color:var(--color-text-secondary); margin-top:6px;">${d.date}</div>
            </div>
          `;
        }).join('');
      } else {
        dailyChartEl.innerHTML = `<p style="color:var(--color-text-muted);">No sales data for past 7 days</p>`;
      }

      // Chart 2: Profit vs Expenses Breakdown
      const profitExpEl = document.getElementById('chart-profit-expenses');
      const monthlyRev = summary.thisMonth.total_revenue || 0;
      const monthlyExp = summary.monthlyExpenses || 0;
      const monthlyProfit = summary.netMonthlyProfit || 0;
      const maxVal = Math.max(monthlyRev, monthlyExp + monthlyProfit, 1);

      profitExpEl.innerHTML = `
        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:var(--text-sm);">
            <span>Monthly Revenue</span>
            <span style="font-weight:700; color:var(--color-accent);">${formatters.currency(monthlyRev, curr)}</span>
          </div>
          <div style="height:10px; background:var(--color-bg-tertiary); border-radius:5px; overflow:hidden;">
            <div style="height:100%; width:${Math.round((monthlyRev/maxVal)*100)}%; background:var(--color-accent);"></div>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:var(--text-sm);">
            <span>Monthly Expenses</span>
            <span style="font-weight:700; color:var(--color-danger);">${formatters.currency(monthlyExp, curr)}</span>
          </div>
          <div style="height:10px; background:var(--color-bg-tertiary); border-radius:5px; overflow:hidden;">
            <div style="height:100%; width:${Math.round((monthlyExp/maxVal)*100)}%; background:var(--color-danger);"></div>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:var(--text-sm);">
            <span>Net Monthly Profit</span>
            <span style="font-weight:700; color:var(--color-success);">${formatters.currency(monthlyProfit, curr)}</span>
          </div>
          <div style="height:10px; background:var(--color-bg-tertiary); border-radius:5px; overflow:hidden;">
            <div style="height:100%; width:${Math.round((monthlyProfit/maxVal)*100)}%; background:var(--color-success);"></div>
          </div>
        </div>
      `;

      // Top Selling Perfumes
      const perfumesBody = document.getElementById('dash-top-perfumes-body');
      if (!summary.topPerfumes || summary.topPerfumes.length === 0) {
        perfumesBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--color-text-muted);">No perfume sales recorded yet</td></tr>`;
      } else {
        perfumesBody.innerHTML = summary.topPerfumes.map(p => `
          <tr>
            <td style="font-weight:600;">${p.name}</td>
            <td><span class="badge badge-perfume">${p.size || 'Bottle'}</span></td>
            <td style="font-weight:700;">${p.total_sold} pcs</td>
            <td style="color:var(--color-accent); font-weight:700;">${formatters.currency(p.total_revenue, curr)}</td>
          </tr>
        `).join('');
      }

      // Top Selling Clothes
      const clothesBody = document.getElementById('dash-top-clothes-body');
      if (!summary.topClothes || summary.topClothes.length === 0) {
        clothesBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--color-text-muted);">No clothes sales recorded yet</td></tr>`;
      } else {
        clothesBody.innerHTML = summary.topClothes.map(p => `
          <tr>
            <td style="font-weight:600;">${p.name}</td>
            <td><span class="badge badge-clothes">${p.size || ''} ${p.color || ''}</span></td>
            <td style="font-weight:700;">${p.total_sold} pcs</td>
            <td style="color:var(--color-accent); font-weight:700;">${formatters.currency(p.total_revenue, curr)}</td>
          </tr>
        `).join('');
      }

      // Recent Transactions
      const recentBody = document.getElementById('dash-recent-sales-body');
      if (!summary.recentTransactions || summary.recentTransactions.length === 0) {
        recentBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--color-text-muted);">No recent invoices</td></tr>`;
      } else {
        recentBody.innerHTML = summary.recentTransactions.map(s => `
          <tr>
            <td style="font-weight:700; color:var(--color-accent);">${s.invoice_no}</td>
            <td>${s.customer_name || 'Walk-in'}</td>
            <td style="font-weight:700;">${formatters.currency(s.total_amount, curr)}</td>
            <td style="font-size:var(--text-xs); color:var(--color-text-muted);">${formatters.dateTime(s.created_at)}</td>
          </tr>
        `).join('');
      }

      // Restock Warnings
      const restockBody = document.getElementById('dash-restock-alerts-body');
      if (!summary.lowStockProducts || summary.lowStockProducts.length === 0) {
        restockBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--color-success);">All stock levels optimal!</td></tr>`;
      } else {
        restockBody.innerHTML = summary.lowStockProducts.slice(0, 5).map(p => `
          <tr>
            <td style="font-weight:600;">${p.name}</td>
            <td><span class="badge ${p.category === 'Clothes' ? 'badge-clothes' : 'badge-perfume'}">${p.category}</span></td>
            <td><span class="badge badge-warning">${p.quantity} pcs</span></td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="InventoryPage.openStockInModal(${p.id})">+ Stock</button>
            </td>
          </tr>
        `).join('');
      }

    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard metrics');
    }
  }
};
