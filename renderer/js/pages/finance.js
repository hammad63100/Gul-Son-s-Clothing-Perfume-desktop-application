/* Finance & Cash Book Controller */

window.FinancePage = {
  activeTab: 'cashbook',
  selectedCashbookDate: null,

  localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  async render(container) {
    this.selectedCashbookDate = this.localDate();

    container.innerHTML = `
      <div class="page-container animate-fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Finance & Cash Book</h1>
            <p class="page-subtitle">Track shop expenses, owner home expenses, daily cash ledger, and net profit & loss</p>
          </div>
          <div class="toolbar" style="margin:0; gap:var(--space-2); flex-wrap:wrap;">
            <button class="btn btn-secondary" style="border-color:var(--color-accent); color:var(--color-accent);" onclick="FinancePage.openAddHomeExpenseModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>+ Record Home Expense</span>
            </button>
            <button class="btn btn-primary" onclick="FinancePage.openAddExpenseModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>+ Record Shop Expense</span>
            </button>
          </div>
        </div>

        <div class="tabs">
          <button class="tab-btn active" id="fin-tab-cashbook" onclick="FinancePage.switchTab('cashbook')">Daily Cash Book</button>
          <button class="tab-btn" id="fin-tab-expenses" onclick="FinancePage.switchTab('expenses')">Shop Expenses</button>
          <button class="tab-btn" id="fin-tab-home-expenses" onclick="FinancePage.switchTab('home-expenses')">Home Expenses (Ghar Ka Kharcha)</button>
          <button class="tab-btn" id="fin-tab-pnl" onclick="FinancePage.switchTab('pnl')">Profit & Loss Statement</button>
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
    const btn = document.getElementById(`fin-tab-${tab}`);
    if (btn) btn.classList.add('active');
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
      if (this.activeTab === 'cashbook') {
        const targetDate = this.selectedCashbookDate || today;
        const [dailySales, dayShopExp, dayHomeExp, dayAllExpenses, allReturns] = await Promise.all([
          window.api.sales.getDailySummary(targetDate),
          window.api.expenses.getSummary(targetDate, targetDate, 'shop'),
          window.api.expenses.getSummary(targetDate, targetDate, 'home'),
          window.api.expenses.getAll({ startDate: targetDate, endDate: targetDate }),
          window.api.returns.getAll({ startDate: targetDate, endDate: targetDate })
        ]);

        const totalCashIn = dailySales.total_revenue || 0;
        const totalShopPaid = dayShopExp || 0;
        const totalHomePaid = dayHomeExp || 0;
        const totalRefunds = (allReturns || []).reduce((sum, r) => sum + (r.refund_type === 'Cash Refund' ? Number(r.refund_amount || 0) : 0), 0);
        const totalCashOut = totalShopPaid + totalHomePaid + totalRefunds;
        const netCashBalance = totalCashIn - totalCashOut;

        area.innerHTML = `
          <div class="card" style="margin-bottom:var(--space-5);">
            <div class="card-header" style="flex-wrap:wrap; gap:var(--space-3);">
              <div>
                <h3 class="card-title">📖 Daily Cash Book Ledger</h3>
                <p class="card-subtitle">Complete cash inflow & outflow summary for ${formatters.date(targetDate)}</p>
              </div>
              <div class="toolbar" style="margin:0; gap:var(--space-2);">
                <input type="date" class="form-input" id="cashbook-date-picker" value="${targetDate}" onchange="FinancePage.changeCashbookDate(this.value)" style="width:160px;">
                <button class="btn btn-secondary btn-sm" onclick="FinancePage.changeCashbookDate('${today}')">Today</button>
              </div>
            </div>

            <div class="grid grid-4 gap-4" style="margin-top:var(--space-4);">
              <div class="stat-card" style="background:var(--color-bg-tertiary);">
                <div class="stat-label">1. Total Cash In (Sales)</div>
                <div class="stat-value" style="color:var(--color-success);">${formatters.currency(totalCashIn, curr)}</div>
                <small style="color:var(--color-text-muted);">${dailySales.total_sales || 0} cash bills received</small>
              </div>

              <div class="stat-card" style="background:var(--color-bg-tertiary);">
                <div class="stat-label">2. Shop Expenses Out</div>
                <div class="stat-value" style="color:var(--color-danger);">${formatters.currency(totalShopPaid, curr)}</div>
                <small style="color:var(--color-text-muted);">Rent, bills, staff, carriage</small>
              </div>

              <div class="stat-card" style="background:var(--color-bg-tertiary);">
                <div class="stat-label">3. Home Expenses Out</div>
                <div class="stat-value" style="color:var(--color-accent);">${formatters.currency(totalHomePaid, curr)}</div>
                <small style="color:var(--color-text-muted);">Owner / personal drawings</small>
              </div>

              <div class="stat-card" style="background:var(--color-bg-tertiary);">
                <div class="stat-label">4. Net Closing Balance</div>
                <div class="stat-value" style="color:${netCashBalance >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">${formatters.currency(netCashBalance, curr)}</div>
                <small style="color:var(--color-text-muted);">Inflow − Total Outflows</small>
              </div>
            </div>

            <div style="margin-top:var(--space-3); padding:var(--space-3); background:var(--color-bg-secondary); border-radius:var(--radius-md); font-size:var(--text-xs); color:var(--color-text-secondary); display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <span><strong>Total Cash Paid Out:</strong> ${formatters.currency(totalCashOut, curr)} (Shop: ${formatters.currency(totalShopPaid, curr)} + Home: ${formatters.currency(totalHomePaid, curr)} + Refunds: ${formatters.currency(totalRefunds, curr)})</span>
              <span><strong>Selected Date:</strong> ${targetDate}</span>
            </div>
          </div>

          <!-- Entries for Today -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">📋 Detailed Daily Cash Outflow & Inflow Breakdown</h3>
              <div class="toolbar" style="margin:0; gap:var(--space-2);">
                <button class="btn btn-secondary btn-sm" onclick="FinancePage.openAddHomeExpenseModal()">+ Home Expense</button>
                <button class="btn btn-primary btn-sm" onclick="FinancePage.openAddExpenseModal()">+ Shop Expense</button>
              </div>
            </div>

            <div class="table-container" style="margin-top:var(--space-3);">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Title / Reason</th>
                    <th>Category</th>
                    <th>Payment Method</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${(dayAllExpenses.length === 0 && totalRefunds === 0) ? `
                    <tr><td colspan="6"><div class="empty-state"><h3>No Expenses or Outflows Logged for this Date</h3><p>Use the buttons above to log shop or home expenses.</p></div></td></tr>
                  ` : `
                    ${dayAllExpenses.map(e => `
                      <tr>
                        <td>
                          <span class="badge ${e.expense_type === 'home' ? 'badge-gold' : 'badge-danger'}">
                            ${e.expense_type === 'home' ? '🏠 Home Expense' : '🏬 Shop Expense'}
                          </span>
                        </td>
                        <td style="font-weight:600;">
                          ${e.title}
                          ${e.description ? `<div style="font-size:var(--text-xs); color:var(--color-text-muted); font-weight:400;">Reason: ${e.description}</div>` : ''}
                        </td>
                        <td><span class="badge badge-info">${e.category}</span></td>
                        <td><span class="badge badge-gold">${e.payment_method}</span></td>
                        <td style="font-weight:700; color:var(--color-danger);">${formatters.currency(e.amount, curr)}</td>
                        <td>
                          <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" onclick="FinancePage.deleteExpense(${e.id})">Delete</button>
                        </td>
                      </tr>
                    `).join('')}
                    ${allReturns.filter(r => r.refund_type === 'Cash Refund').map(r => `
                      <tr>
                        <td><span class="badge badge-warning">↩️ Customer Refund</span></td>
                        <td style="font-weight:600;">Sale #${r.sale_id || '-'} Refund ${r.reason ? `(${r.reason})` : ''}</td>
                        <td><span class="badge badge-info">Sales Return</span></td>
                        <td><span class="badge badge-gold">Cash</span></td>
                        <td style="font-weight:700; color:var(--color-warning);">${formatters.currency(r.refund_amount, curr)}</td>
                        <td>-</td>
                      </tr>
                    `).join('')}
                  `}
                </tbody>
              </table>
            </div>
          </div>
        `;

      } else if (this.activeTab === 'expenses') {
        const expenses = await window.api.expenses.getAll({ expense_type: 'shop' });
        const totalExp = await window.api.expenses.getSummary(null, null, 'shop');
        const todayExp = await window.api.expenses.getSummary(today, today, 'shop');

        area.innerHTML = `
          <div class="grid grid-3 gap-4" style="margin-bottom:var(--space-5);">
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-danger);">${formatters.currency(totalExp, curr)}</div>
              <div class="stat-label">Total All-Time Shop Expenses</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-danger);">${formatters.currency(todayExp, curr)}</div>
              <div class="stat-label">Today's Shop Expenses</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${expenses.length}</div>
              <div class="stat-label">Total Shop Expense Entries</div>
            </div>
          </div>

          <div class="card-header" style="margin-bottom:var(--space-3);">
            <h3 class="card-title">🏬 Shop Operational Expenses</h3>
            <button class="btn btn-primary" onclick="FinancePage.openAddExpenseModal()">+ Record Shop Expense</button>
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
                  <tr><td colspan="7"><div class="empty-state"><h3>No Shop Expenses Recorded</h3><p>Record shop rent, electricity, salaries, or marketing expenses.</p></div></td></tr>
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

      } else if (this.activeTab === 'home-expenses') {
        const homeExpenses = await window.api.expenses.getAll({ expense_type: 'home' });
        const totalHome = await window.api.expenses.getSummary(null, null, 'home');
        const todayHome = await window.api.expenses.getSummary(today, today, 'home');

        area.innerHTML = `
          <div class="grid grid-3 gap-4" style="margin-bottom:var(--space-5);">
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-accent);">${formatters.currency(totalHome, curr)}</div>
              <div class="stat-label">Total All-Time Home Expenses</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-accent);">${formatters.currency(todayHome, curr)}</div>
              <div class="stat-label">Today's Home Expenses</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${homeExpenses.length}</div>
              <div class="stat-label">Total Home Expense Entries</div>
            </div>
          </div>

          <div class="card-header" style="margin-bottom:var(--space-3);">
            <div>
              <h3 class="card-title">🏠 Home Expenses (Ghar Ka Kharcha / Owner Drawings)</h3>
              <p class="card-subtitle">Owner personal expenses taken from shop cash</p>
            </div>
            <button class="btn btn-primary" onclick="FinancePage.openAddHomeExpenseModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>+ Record Home Expense</span>
            </button>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Reason / Details (Jis kaly kharch howa)</th>
                  <th>Payment Method</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${homeExpenses.length === 0 ? `
                  <tr><td colspan="5"><div class="empty-state"><h3>No Home Expenses Recorded</h3><p>Record home expenses like grocery, home bills, pocket money, or personal cash taken.</p></div></td></tr>
                ` : homeExpenses.map(e => `
                  <tr>
                    <td>${formatters.date(e.date)}</td>
                    <td style="font-weight:700; color:var(--color-accent); font-size:var(--text-md);">${formatters.currency(e.amount, curr)}</td>
                    <td style="font-weight:500;">${e.description || e.title || '-'}</td>
                    <td><span class="badge badge-gold">${e.payment_method}</span></td>
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
        const [todayShopExp, todayHomeExp] = await Promise.all([
          window.api.expenses.getSummary(today, today, 'shop'),
          window.api.expenses.getSummary(today, today, 'home')
        ]);
        const grossRevenue = dailySales.total_revenue || 0;
        const grossProfit = dailySales.total_profit || 0;
        const netBusinessProfit = Math.max(0, grossProfit - todayShopExp);
        const netRetainedCash = Math.max(0, netBusinessProfit - todayHomeExp);

        area.innerHTML = `
          <div class="grid grid-4 gap-4" style="margin-bottom:var(--space-6);">
            <div class="stat-card">
              <div class="stat-value">${formatters.currency(grossRevenue, curr)}</div>
              <div class="stat-label">Gross Sales Revenue (Today)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-clothes);">${formatters.currency(grossProfit, curr)}</div>
              <div class="stat-label">Gross Margin (Sale − Cost)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-danger);">${formatters.currency(todayShopExp, curr)}</div>
              <div class="stat-label">Shop Operating Expenses</div>
            </div>
            <div class="stat-card">
              <div class="stat-value" style="color:var(--color-success);">${formatters.currency(netBusinessProfit, curr)}</div>
              <div class="stat-label">Net Shop Profit (Gross − Shop Exp)</div>
            </div>
          </div>

          <div class="grid grid-2 gap-4" style="margin-bottom:var(--space-6);">
            <div class="card">
              <div class="stat-label">Owner Home Drawings (Today)</div>
              <div class="stat-value" style="color:var(--color-accent); font-size:var(--text-2xl); font-weight:700; margin-top:var(--space-2);">${formatters.currency(todayHomeExp, curr)}</div>
              <p style="font-size:var(--text-xs); color:var(--color-text-muted); margin-top:var(--space-2);">Cash taken from shop for home/personal use</p>
            </div>
            <div class="card">
              <div class="stat-label">Final Retained Shop Cash</div>
              <div class="stat-value" style="color:var(--color-success); font-size:var(--text-2xl); font-weight:700; margin-top:var(--space-2);">${formatters.currency(netRetainedCash, curr)}</div>
              <p style="font-size:var(--text-xs); color:var(--color-text-muted); margin-top:var(--space-2);">Net Business Profit minus Home Expenses</p>
            </div>
          </div>

          <div class="card">
            <h3 class="card-title">Profit & Loss Accounting Structure</h3>
            <div style="font-size:var(--text-sm); color:var(--color-text-secondary); margin-top:var(--space-2); line-height:1.6;">
              <div>• <strong>Gross Profit</strong> = (Selling Price − Purchase Cost) × Units Sold</div>
              <div>• <strong>Net Shop Operating Profit</strong> = Gross Profit − Shop Operating Expenses (Rent, Bills, Salaries, Carriage)</div>
              <div>• <strong>Net Retained Cash</strong> = Net Operating Profit − Home Expenses (Owner Personal Drawings)</div>
            </div>
          </div>
        `;
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load finance data');
    }
  },

  changeCashbookDate(dateStr) {
    this.selectedCashbookDate = dateStr;
    this.loadActiveTab();
  },

  openAddHomeExpenseModal() {
    modal.show({
      title: '🏠 Record Home Expense (Ghar Ka Kharcha)',
      bodyHTML: `
        <div class="form-group">
          <label class="form-label">Expense Amount (Rs.) *</label>
          <input type="number" step="0.01" class="form-input" id="home-exp-amount" placeholder="e.g. 2500" required autofocus>
        </div>

        <div class="form-group" style="margin-top:var(--space-3);">
          <label class="form-label">Reason / Detail (Jis kaly howa hay) *</label>
          <input type="text" class="form-input" id="home-exp-desc" placeholder="e.g. Ghar ka rashan, Doodh ka bill, Bachon ki pocket money..." required>
        </div>

        <div class="form-row" style="margin-top:var(--space-3);">
          <div class="form-group">
            <label class="form-label">Date *</label>
            <input type="date" class="form-input" id="home-exp-date" value="${this.localDate()}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Payment Method</label>
            <input type="text" class="form-input" id="home-exp-payment" value="Cash" readonly style="background:var(--color-bg-secondary); cursor:not-allowed;">
          </div>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="FinancePage.saveHomeExpense()">Save Home Expense</button>
      `
    });

    setTimeout(() => {
      const input = document.getElementById('home-exp-amount');
      if (input) input.focus();
    }, 100);
  },

  async saveHomeExpense() {
    const amount = parseFloat(document.getElementById('home-exp-amount').value) || 0;
    const description = document.getElementById('home-exp-desc').value.trim();
    const date = document.getElementById('home-exp-date').value;
    const payment_method = 'Cash';

    if (amount <= 0) {
      toast.error('Please enter a valid expense amount');
      return;
    }
    if (!description) {
      toast.error('Please enter the reason / detail for home expense');
      return;
    }

    try {
      await window.api.expenses.add({
        title: description || 'Home Expense',
        category: 'Home Expense',
        expense_type: 'home',
        amount,
        payment_method,
        date,
        description
      });
      toast.success('Home expense recorded!');
      modal.hide();
      this.loadActiveTab();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save home expense');
    }
  },

  openAddExpenseModal() {
    modal.show({
      title: '🏬 Record New Shop Expense',
      bodyHTML: `
        <div class="form-group">
          <label class="form-label">Expense Title *</label>
          <input type="text" class="form-input" id="exp-title" placeholder="e.g. Electricity Bill / Shop Rent" required autofocus>
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
        <button class="btn btn-primary" onclick="FinancePage.saveExpense()">Save Shop Expense</button>
      `
    });

    setTimeout(() => {
      const input = document.getElementById('exp-title');
      if (input) input.focus();
    }, 100);
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
      await window.api.expenses.add({
        title,
        category,
        expense_type: 'shop',
        amount,
        payment_method,
        date,
        description
      });
      toast.success('Shop expense recorded!');
      modal.hide();
      this.loadActiveTab();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save shop expense');
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

