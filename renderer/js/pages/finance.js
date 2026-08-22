/* Finance & Expenses Page Controller */

window.FinancePage = {
  activeTab: 'expenses',

  localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  async render(container) {
    const today = this.localDate();

    container.innerHTML = `
      <div class="page-container animate-fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Finance & Expenses</h1>
            <p class="page-subtitle">Track shop operational expenses, daily cash ledger, and net profit & loss</p>
          </div>
          <div class="toolbar" style="margin:0;">
            <button class="btn btn-primary" onclick="FinancePage.openAddExpenseModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>+ Record New Expense</span>
            </button>
          </div>
        </div>

        <div class="tabs">
          <button class="tab-btn active" id="fin-tab-expenses" onclick="FinancePage.switchTab('expenses')">Shop Expenses</button>
          <button class="tab-btn" id="fin-tab-pnl" onclick="FinancePage.switchTab('pnl')">Profit & Loss Statement</button>
          <button class="tab-btn" id="fin-tab-cashbook" onclick="FinancePage.switchTab('cashbook')">Daily Cash Book</button>
        </div>

        <div id="fin-content-area" style="margin-top: var(--space-4);">
          <div class="spinner" style="margin:40px auto;"></div>
        </div>

      </div>
    `;

    await this.loadActiveTab();
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`fin-tab-${tab}`).classList.add('active');
    this.loadActiveTab();
  },

  async loadActiveTab() {
    const area = document.getElementById('fin-content-area');
    if (!area) return;
    area.innerHTML = `<div class="spinner" style="margin:40px auto;"></div>`;

    const settings = await window.api.settings.get();
    const curr = settings.currency_symbol || 'Rs.';
    const today = this.localDate();

    try {
      if (this.activeTab === 'expenses') {
        const expenses = await window.api.expenses.getAll();
        const totalExp = await window.api.expenses.getSummary();

        area.innerHTML = `
          <div class="grid grid-3 gap-4" style="margin-bottom:var(--space-5);">
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-danger);">${formatters.currency(totalExp, curr)}</div>
              <div class="stat-label">Total Recorded Expenses</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${expenses.length}</div>
              <div class="stat-label">Total Expense Entries</div>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Payment Method</th>
                  <th>Description</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${expenses.length === 0 ? `
                  <tr><td colspan="7"><div class="empty-state"><h3>No Expenses Recorded</h3><p>Record shop rent, electricity, salaries, or marketing expenses.</p></div></td></tr>
                ` : expenses.map(e => `
                  <tr>
                    <td>${formatters.date(e.date)}</td>
                    <td style="font-weight:600;">${e.title}</td>
                    <td><span class="badge badge-info">${e.category}</span></td>
                    <td style="font-weight:700; color:var(--color-danger);">${formatters.currency(e.amount, curr)}</td>
                    <td><span class="badge badge-gold">${e.payment_method}</span></td>
                    <td>${e.description || '-'}</td>
                    <td>
                      <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" onclick="FinancePage.deleteExpense(${e.id})">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;

      } else if (this.activeTab === 'pnl') {
        const dailySales = await window.api.sales.getDailySummary(today);
        const todayExp = await window.api.expenses.getSummary(today, today);
        const grossRevenue = dailySales.total_revenue || 0;
        const grossProfit = dailySales.total_profit || 0;
        const netProfit = Math.max(0, grossProfit - todayExp);

        area.innerHTML = `
          <div class="grid grid-4 gap-4" style="margin-bottom:var(--space-6);">
            <div class="stat-card">
              <div class="stat-value">${formatters.currency(grossRevenue, curr)}</div>
              <div class="stat-label">Gross Sales Revenue (Today)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-clothes);">${formatters.currency(grossProfit, curr)}</div>
              <div class="stat-label">Gross Profit (Sale − Cost)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-danger);">${formatters.currency(todayExp, curr)}</div>
              <div class="stat-label">Today's Shop Expenses</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-success);">${formatters.currency(netProfit, curr)}</div>
              <div class="stat-label">Net Profit (Gross − Expenses)</div>
            </div>
          </div>

          <div class="card">
            <h3 class="card-title">Profit & Loss Calculation Formula</h3>
            <p style="font-size:var(--text-sm); color:var(--color-text-secondary); margin-top:var(--space-2);">
              <strong>Net Profit</strong> = (Selling Price − Purchase Cost) × Qty Sold − Shop Expenses (Rent, Bills, Salaries, Packaging, Marketing).
            </p>
          </div>
        `;

      } else if (this.activeTab === 'cashbook') {
        const dailySales = await window.api.sales.getDailySummary(today);
        const todayExp = await window.api.expenses.getSummary(today, today);
        const todayReturns = dailySales.total_returns || 0;

        area.innerHTML = `
          <div class="card">
            <h3 class="card-title">Daily Cash Book — ${formatters.date(today)}</h3>
            <div class="grid grid-3 gap-4" style="margin-top:var(--space-4);">
              <div class="card" style="background:var(--color-bg-tertiary);">
                <div style="font-size:var(--text-xs); color:var(--color-text-muted);">Total Cash Received</div>
                <div style="font-size:var(--text-xl); font-weight:700; color:var(--color-success);">${formatters.currency(dailySales.total_revenue, curr)}</div>
              </div>
              <div class="card" style="background:var(--color-bg-tertiary);">
                <div style="font-size:var(--text-xs); color:var(--color-text-muted);">Total Cash Paid Out</div>
                <div style="font-size:var(--text-xl); font-weight:700; color:var(--color-danger);">${formatters.currency(todayExp + todayReturns, curr)}</div>
                <div style="font-size:var(--text-xs); color:var(--color-text-muted); margin-top:4px;">Expenses: ${formatters.currency(todayExp, curr)} | Refunds: ${formatters.currency(todayReturns, curr)}</div>
              </div>
              <div class="card" style="background:var(--color-bg-tertiary);">
                <div style="font-size:var(--text-xs); color:var(--color-text-muted);">Net Cash Balance</div>
                <div style="font-size:var(--text-xl); font-weight:700; color:var(--color-accent);">${formatters.currency(dailySales.total_revenue - todayExp - todayReturns, curr)}</div>
              </div>
            </div>
          </div>
        `;
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load finance data');
    }
  },

  openAddExpenseModal() {
    modal.show({
      title: 'Record New Shop Expense',
      bodyHTML: `
        <div class="form-group">
          <label class="form-label">Expense Title *</label>
          <input type="text" class="form-input" id="exp-title" placeholder="e.g. Electricity Bill / Shop Rent" required>
        </div>

        <div class="form-row" style="margin-top:var(--space-3);">
          <div class="form-group">
            <label class="form-label">Category *</label>
            <select class="form-select" id="exp-cat">
              <option value="Shop Rent">Shop Rent</option>
              <option value="Electricity">Electricity Bill</option>
              <option value="Salaries">Employee Salary</option>
              <option value="Internet/Phone">Internet & Phone</option>
              <option value="Packaging">Packaging & Shopping Bags</option>
              <option value="Marketing">Marketing & Ads</option>
              <option value="Transportation">Transportation / Carriage</option>
              <option value="Maintenance">Maintenance & Repairs</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Amount (Rs.) *</label>
            <input type="number" step="0.01" class="form-input" id="exp-amount" placeholder="0.00" required>
          </div>
        </div>

        <div class="form-row" style="margin-top:var(--space-3);">
          <div class="form-group">
            <label class="form-label">Payment Method</label>
            <select class="form-select" id="exp-payment">
              <option value="Cash">Cash</option>
              <option value="Bank">Bank Transfer</option>
              <option value="JazzCash/Easypaisa">JazzCash / Easypaisa</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date *</label>
            <input type="date" class="form-input" id="exp-date" value="${this.localDate()}" required>
          </div>
        </div>

        <div class="form-group" style="margin-top:var(--space-3);">
          <label class="form-label">Description / Notes</label>
          <input type="text" class="form-input" id="exp-desc" placeholder="Additional details...">
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="FinancePage.saveExpense()">Save Expense</button>
      `
    });
  },

  async saveExpense() {
    const title = document.getElementById('exp-title').value.trim();
    const category = document.getElementById('exp-cat').value;
    const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
    const payment_method = document.getElementById('exp-payment').value;
    const date = document.getElementById('exp-date').value;
    const description = document.getElementById('exp-desc').value.trim();

    if (!title || amount <= 0) {
      toast.error('Please fill in title and valid amount');
      return;
    }

    try {
      await window.api.expenses.add({ title, category, amount, payment_method, date, description });
      toast.success('Expense recorded!');
      modal.hide();
      this.loadActiveTab();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save expense');
    }
  },

  async deleteExpense(id) {
    modal.confirm({
      title: 'Delete Expense',
      message: 'Are you sure you want to remove this expense record?',
      confirmText: 'Delete',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        try {
          await window.api.expenses.delete(id);
          toast.success('Expense deleted');
          this.loadActiveTab();
        } catch (err) {
          console.error(err);
          toast.error('Failed to delete expense');
        }
      }
    });
  }
};
