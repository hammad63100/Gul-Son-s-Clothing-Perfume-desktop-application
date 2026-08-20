/* Reports & Analytics Page Controller */

window.ReportsPage = {
  activeTab: 'daily',

  localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  async render(container) {
    const today = this.localDate();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    container.innerHTML = `
      <div class="page-container animate-fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Reports & Business Analytics</h1>
            <p class="page-subtitle">Daily, monthly, category, and size/color sales performance reports with profit calculations</p>
          </div>
          <div class="toolbar" style="margin:0;">
            <button class="btn btn-primary" onclick="ReportsPage.exportCurrentReport('excel')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>Export to Excel</span>
            </button>
          </div>
        </div>

        <div class="tabs">
          <button class="tab-btn active" id="rpt-tab-daily" onclick="ReportsPage.switchTab('daily')">Daily Report</button>
          <button class="tab-btn" id="rpt-tab-monthly" onclick="ReportsPage.switchTab('monthly')">Monthly Report</button>
          <button class="tab-btn" id="rpt-tab-category" onclick="ReportsPage.switchTab('category')">Category Breakdown</button>
          <button class="tab-btn" id="rpt-tab-sizecolor" onclick="ReportsPage.switchTab('sizecolor')">Size & Color Report</button>
        </div>

        <!-- Toolbar for Date Pickers -->
        <div class="toolbar" style="margin-top: var(--space-4);">
          <div id="rpt-date-controls" class="flex gap-3" style="align-items:center;">
            <div class="form-group" style="margin:0;">
              <label class="form-label" style="font-size:11px;">Select Date</label>
              <input type="date" class="form-input" id="rpt-daily-date" value="${today}" onchange="ReportsPage.loadActiveReport()">
            </div>
          </div>
        </div>

        <!-- Dynamic Report Content Area -->
        <div id="rpt-content-area" style="margin-top: var(--space-4);">
          <div class="spinner" style="margin:40px auto;"></div>
        </div>

      </div>
    `;

    await this.loadActiveReport();
  },

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`rpt-tab-${tabName}`).classList.add('active');

    const controls = document.getElementById('rpt-date-controls');
    const today = this.localDate();
    const now = new Date();

    if (tabName === 'daily') {
      controls.innerHTML = `
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:11px;">Select Date</label>
          <input type="date" class="form-input" id="rpt-daily-date" value="${today}" onchange="ReportsPage.loadActiveReport()">
        </div>
      `;
    } else if (tabName === 'monthly') {
      controls.innerHTML = `
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:11px;">Year</label>
          <input type="number" class="form-input" id="rpt-monthly-year" value="${now.getFullYear()}" style="width:100px;" onchange="ReportsPage.loadActiveReport()">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:11px;">Month</label>
          <select class="form-select" id="rpt-monthly-month" onchange="ReportsPage.loadActiveReport()">
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
              <option value="${m}" ${m === now.getMonth() + 1 ? 'selected' : ''}>${new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}</option>
            `).join('')}
          </select>
        </div>
      `;
    } else if (tabName === 'category' || tabName === 'sizecolor') {
      controls.innerHTML = `
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:11px;">Start Date</label>
          <input type="date" class="form-input" id="rpt-range-start" onchange="ReportsPage.loadActiveReport()">
        </div>
        <span style="color:var(--color-text-muted); align-self:flex-end; margin-bottom:8px;">to</span>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:11px;">End Date</label>
          <input type="date" class="form-input" id="rpt-range-end" onchange="ReportsPage.loadActiveReport()">
        </div>
      `;
    }

    this.loadActiveReport();
  },

  async loadActiveReport() {
    const area = document.getElementById('rpt-content-area');
    if (!area) return;
    area.innerHTML = `<div class="spinner" style="margin:40px auto;"></div>`;

    const settings = await window.api.settings.get();
    const curr = settings.currency_symbol || 'Rs.';

    try {
      if (this.activeTab === 'daily') {
        const dateInput = document.getElementById('rpt-daily-date');
        const dateStr = dateInput ? dateInput.value : this.localDate();
        const data = await window.api.reports.getDaily(dateStr);
        this.currentReportData = { type: 'daily', data };

        area.innerHTML = `
          <div class="grid grid-4 gap-4" style="margin-bottom: var(--space-6);">
            <div class="stat-card">
              <div class="stat-value">${formatters.currency(data.total_revenue, curr)}</div>
              <div class="stat-label">Total Revenue</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-success);">${formatters.currency(data.total_profit, curr)}</div>
              <div class="stat-label">Net Profit (Revenue − Cost)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${data.total_sales}</div>
              <div class="stat-label">Invoices Generated</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${data.unique_customers}</div>
              <div class="stat-label">Unique Customers</div>
            </div>
          </div>

          <h3 style="font-size:var(--text-md); font-weight:700; margin-bottom:var(--space-3);">Top Selling Products on ${formatters.date(data.date)}</h3>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th>Quantity Sold</th>
                  <th>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${!data.topProducts || data.topProducts.length === 0 ? `
                  <tr><td colspan="4" style="text-align:center;">No sales recorded for this date</td></tr>
                ` : data.topProducts.map(p => `
                  <tr>
                    <td style="font-weight:600;">${p.product_name}</td>
                    <td>${p.product_size || '-'} ${p.product_color ? `(${p.product_color})` : ''}</td>
                    <td><span class="badge badge-gold">${p.total_qty} pcs</span></td>
                    <td style="font-weight:700;">${formatters.currency(p.total_revenue, curr)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;

      } else if (this.activeTab === 'monthly') {
        const yearInput = document.getElementById('rpt-monthly-year');
        const monthInput = document.getElementById('rpt-monthly-month');
        const year = yearInput ? parseInt(yearInput.value) : new Date().getFullYear();
        const month = monthInput ? parseInt(monthInput.value) : new Date().getMonth() + 1;

        const data = await window.api.reports.getMonthly(year, month);
        this.currentReportData = { type: 'monthly', data };

        area.innerHTML = `
          <div class="grid grid-4 gap-4" style="margin-bottom: var(--space-6);">
            <div class="stat-card">
              <div class="stat-value">${formatters.currency(data.total_revenue, curr)}</div>
              <div class="stat-label">Monthly Revenue</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-success);">${formatters.currency(data.total_profit, curr)}</div>
              <div class="stat-label">Monthly Profit</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${data.total_sales}</div>
              <div class="stat-label">Total Invoices</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${data.unique_customers}</div>
              <div class="stat-label">Total Customers</div>
            </div>
          </div>

          <div class="card" style="margin-bottom:var(--space-6);">
            <h3 class="card-title">Daily Revenue Breakdown</h3>
            <div class="table-container" style="margin-top:var(--space-3);">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoices</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${!data.dailyBreakdown || data.dailyBreakdown.length === 0 ? `
                    <tr><td colspan="3" style="text-align:center;">No daily data available for this month</td></tr>
                  ` : data.dailyBreakdown.map(d => `
                    <tr>
                      <td>${formatters.date(d.date)}</td>
                      <td>${d.sales_count}</td>
                      <td style="font-weight:700; color:var(--color-accent);">${formatters.currency(d.revenue, curr)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;

      } else if (this.activeTab === 'category') {
        const start = document.getElementById('rpt-range-start')?.value || '';
        const end = document.getElementById('rpt-range-end')?.value || '';
        const data = await window.api.reports.getCategory(start, end);
        this.currentReportData = { type: 'category', data };

        area.innerHTML = `
          <div class="card">
            <h3 class="card-title">Category Sales Comparison (Clothes, Hosiery &amp; Perfumes)</h3>
            <div class="table-container" style="margin-top:var(--space-3);">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Total Invoices</th>
                    <th>Pieces Sold</th>
                    <th>Total Revenue</th>
                    <th>Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  ${!data || data.length === 0 ? `
                    <tr><td colspan="5" style="text-align:center;">No category sales data found</td></tr>
                  ` : data.map(c => `
                    <tr>
                      <td><span class="badge ${c.category === 'Clothes' ? 'badge-clothes' : (c.category === 'Hosiery' ? 'badge-hosiery' : 'badge-perfume')}">${c.category}</span></td>
                      <td>${c.total_sales}</td>
                      <td>${c.total_qty} pcs</td>
                      <td style="font-weight:700;">${formatters.currency(c.total_revenue, curr)}</td>
                      <td style="font-weight:700; color:var(--color-success);">${formatters.currency(c.total_profit, curr)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;

      } else if (this.activeTab === 'sizecolor') {
        const start = document.getElementById('rpt-range-start')?.value || '';
        const end = document.getElementById('rpt-range-end')?.value || '';
        const data = await window.api.reports.getSizeColor(start, end);
        this.currentReportData = { type: 'sizeColor', data };

        area.innerHTML = `
          <div class="grid grid-2 gap-6">
            <div class="card">
              <h3 class="card-title">Sales by Size (Variant Demand)</h3>
              <div class="table-container" style="margin-top:var(--space-3);">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Qty Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${!data.bySize || data.bySize.length === 0 ? `
                      <tr><td colspan="3" style="text-align:center;">No size data recorded</td></tr>
                    ` : data.bySize.map(s => `
                      <tr>
                        <td style="font-weight:600;">${s.variant}</td>
                        <td><span class="badge badge-gold">${s.total_qty} pcs</span></td>
                        <td style="font-weight:700;">${formatters.currency(s.total_revenue, curr)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="card">
              <h3 class="card-title">Sales by Color / Style</h3>
              <div class="table-container" style="margin-top:var(--space-3);">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Color / Style</th>
                      <th>Qty Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${!data.byColor || data.byColor.length === 0 ? `
                      <tr><td colspan="3" style="text-align:center;">No color data recorded</td></tr>
                    ` : data.byColor.map(c => `
                      <tr>
                        <td style="font-weight:600;">${c.variant}</td>
                        <td><span class="badge badge-gold">${c.total_qty} pcs</span></td>
                        <td style="font-weight:700;">${formatters.currency(c.total_revenue, curr)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load report data');
    }
  },

  async exportCurrentReport(format) {
    if (!this.currentReportData) {
      toast.warning('No report loaded to export');
      return;
    }
    try {
      const res = await window.api.backup.exportReport(this.currentReportData.type, this.currentReportData.data);
      if (res && res.success) {
        toast.success(`Report exported to ${res.path}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Export failed: ' + err.message);
    }
  }
};
