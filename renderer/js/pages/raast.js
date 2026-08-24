/* Raast & Utility Bills Financial Manager Page Controller */

window.RaastPage = {
  activeTypeFilter: 'all',
  searchQuery: '',
  activePeriod: 'all', // 'today', 'month', 'year', 'all', 'custom'
  selectedDate: '',
  selectedMonth: '',
  selectedYear: '',
  customStartDate: '',
  customEndDate: '',

  initDefaults() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    this.selectedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    this.selectedMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    this.selectedYear = String(now.getFullYear());
    this.customStartDate = this.selectedDate;
    this.customEndDate = this.selectedDate;
  },

  getDateRange() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (this.activePeriod === 'today') {
      const d = this.selectedDate || todayStr;
      return {
        startDate: `${d} 00:00:00`,
        endDate: `${d} 23:59:59`,
        label: `Today / Daily (${d})`,
        badge: 'Daily'
      };
    }

    if (this.activePeriod === 'month') {
      const mStr = this.selectedMonth || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
      const parts = mStr.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const lastDay = new Date(y, m, 0).getDate();
      return {
        startDate: `${y}-${pad(m)}-01 00:00:00`,
        endDate: `${y}-${pad(m)}-${pad(lastDay)} 23:59:59`,
        label: `Month (${mStr})`,
        badge: 'Monthly'
      };
    }

    if (this.activePeriod === 'year') {
      const y = this.selectedYear || String(now.getFullYear());
      return {
        startDate: `${y}-01-01 00:00:00`,
        endDate: `${y}-12-31 23:59:59`,
        label: `Year (${y})`,
        badge: 'Yearly'
      };
    }

    if (this.activePeriod === 'custom') {
      const s = this.customStartDate || todayStr;
      const e = this.customEndDate || todayStr;
      return {
        startDate: `${s} 00:00:00`,
        endDate: `${e} 23:59:59`,
        label: `${s} to ${e}`,
        badge: 'Custom'
      };
    }

    return {
      startDate: null,
      endDate: null,
      label: 'All Time History',
      badge: 'All Time'
    };
  },

  async render(container) {
    if (!this.selectedDate) this.initDefaults();

    container.innerHTML = `
      <div class="page-container animate-fade-in">
        <!-- Page Header -->
        <div class="page-header">
          <div>
            <h1 class="page-title">⚡ Raast & Utility Bills Manager</h1>
            <p class="page-subtitle">Track Cash Deposits, Withdrawals, Utility Bills & Commission Profits</p>
          </div>
          <div class="toolbar" style="margin:0; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="RaastPage.openTransactionModal('Cash Deposit')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              <span>+ Cash Deposit</span>
            </button>
            <button class="btn btn-secondary" style="border-color:var(--color-warning); color:var(--color-warning);" onclick="RaastPage.openTransactionModal('Cash Withdrawal')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>+ Cash Withdrawal</span>
            </button>
            <button class="btn btn-primary" style="background:#7c3aed; border-color:#7c3aed;" onclick="RaastPage.openTransactionModal('Bill Payment')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>🧾 + Utility Bill</span>
            </button>
          </div>
        </div>

        <!-- Period Timeframe Filter Bar -->
        <div class="card" style="margin-bottom:var(--space-4); padding:var(--space-3) var(--space-4); background:var(--color-bg-card);">
          <div class="flex-between" style="flex-wrap:wrap; gap:12px; align-items:center;">
            
            <div class="flex gap-2" style="align-items:center; flex-wrap:wrap;">
              <span style="font-size:12px; font-weight:800; color:var(--color-text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Filter Period:</span>
              
              <div class="tabs" style="margin:0;">
                <button class="tab-btn ${this.activePeriod === 'today' ? 'active' : ''}" id="period-btn-today" onclick="RaastPage.setPeriod('today')">📅 Daily / Today</button>
                <button class="tab-btn ${this.activePeriod === 'month' ? 'active' : ''}" id="period-btn-month" onclick="RaastPage.setPeriod('month')">📆 Monthly</button>
                <button class="tab-btn ${this.activePeriod === 'year' ? 'active' : ''}" id="period-btn-year" onclick="RaastPage.setPeriod('year')">🗓️ Yearly</button>
                <button class="tab-btn ${this.activePeriod === 'all' ? 'active' : ''}" id="period-btn-all" onclick="RaastPage.setPeriod('all')">♾️ All Time</button>
                <button class="tab-btn ${this.activePeriod === 'custom' ? 'active' : ''}" id="period-btn-custom" onclick="RaastPage.setPeriod('custom')">⚙️ Custom Range</button>
              </div>
            </div>

            <!-- Dynamic Date/Month/Year Controls -->
            <div id="raast-period-controls" class="flex gap-2" style="align-items:center;">
              <!-- Inserted via renderPeriodControls -->
            </div>

          </div>
        </div>

        <!-- 4 ATM Smart Cards (Deposit, Withdrawal, Bills, Total Benefit) -->
        <div class="atm-card-grid" id="raast-kpi-grid">
          
          <!-- Card 1: Sapphire Blue ATM Card (Cash Deposit) -->
          <div class="atm-card blue">
            <div class="atm-card-header">
              <div class="atm-brand-group">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12M5 10l7 7 7-7"/><path d="M5 21h14"/></svg>
                <span class="atm-title">Cash Deposit</span>
              </div>
              <span class="atm-badge">Deposit</span>
            </div>

            <div class="atm-middle-row">
              <div class="emv-chip"></div>
              <div class="contactless-wave">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px;"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
              </div>
              <span class="atm-dots">• • • • 1001</span>
            </div>

            <div class="atm-value-group">
              <div class="atm-value-label">Deposit Amount</div>
              <div class="atm-value" id="kpi-deposit-amount">Rs. 0</div>
            </div>

            <div class="atm-footer">
              <span class="atm-holder" id="kpi-deposit-count">0 Deposits</span>
              <span class="atm-sub" id="kpi-deposit-commission">Commission: Rs. 0</span>
            </div>
          </div>

          <!-- Card 2: Amber Sunset ATM Card (Cash Withdrawal) -->
          <div class="atm-card amber">
            <div class="atm-card-header">
              <div class="atm-brand-group">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V7M5 12l7-7 7 7"/><path d="M5 21h14"/></svg>
                <span class="atm-title">Cash Withdrawal</span>
              </div>
              <span class="atm-badge">Withdrawal</span>
            </div>

            <div class="atm-middle-row">
              <div class="emv-chip"></div>
              <div class="contactless-wave">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px;"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
              </div>
              <span class="atm-dots">• • • • 2002</span>
            </div>

            <div class="atm-value-group">
              <div class="atm-value-label">Withdrawal Amount</div>
              <div class="atm-value" id="kpi-withdrawal-amount">Rs. 0</div>
            </div>

            <div class="atm-footer">
              <span class="atm-holder" id="kpi-withdrawal-count">0 Withdrawals</span>
              <span class="atm-sub" id="kpi-withdrawal-commission">Commission: Rs. 0</span>
            </div>
          </div>

          <!-- Card 3: Purple / Cyan ATM Card (Utility Bills) -->
          <div class="atm-card purple">
            <div class="atm-card-header">
              <div class="atm-brand-group">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span class="atm-title">Utility Bills</span>
              </div>
              <span class="atm-badge">Bills Paid</span>
            </div>

            <div class="atm-middle-row">
              <div class="emv-chip"></div>
              <div class="contactless-wave">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px;"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
              </div>
              <span class="atm-dots">• • • • 3003</span>
            </div>

            <div class="atm-value-group">
              <div class="atm-value-label">Total Bills Amount</div>
              <div class="atm-value" id="kpi-bill-amount">Rs. 0</div>
            </div>

            <div class="atm-footer">
              <span class="atm-holder" id="kpi-bill-count">0 Bills</span>
              <span class="atm-sub" id="kpi-bill-commission">Commission: Rs. 0</span>
            </div>
          </div>

          <!-- Card 4: Gold Diamond ATM Card (Total Benefit / Grand Total Profit) -->
          <div class="atm-card gold">
            <div class="atm-card-header">
              <div class="atm-brand-group">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 6v12"/></svg>
                <span class="atm-title">Total Benefit</span>
              </div>
              <span class="atm-badge" id="kpi-badge-period-1">Grand Profit</span>
            </div>

            <div class="atm-middle-row">
              <div class="emv-chip"></div>
              <div class="contactless-wave">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px;"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
              </div>
              <span class="atm-dots">• • • • 9999</span>
            </div>

            <div class="atm-value-group">
              <div class="atm-value-label">Total Net Profit</div>
              <div class="atm-value" id="kpi-total-profit">Rs. 0</div>
            </div>

            <div class="atm-footer">
              <span class="atm-holder" id="kpi-total-volume">Vol: Rs. 0</span>
              <span class="atm-sub">100% Net Profit</span>
            </div>
          </div>

        </div>

        <!-- Filter & Search Toolbar -->
        <div class="card" style="margin-bottom:var(--space-4); padding:var(--space-3) var(--space-4);">
          <div class="flex-between" style="flex-wrap:wrap; gap:12px;">
            <div class="flex gap-2" style="flex:1; min-width:280px;">
              <div class="search-bar" style="max-width:100%; flex:1;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="raast-search-input" placeholder="Search by slip #, amount, type..." oninput="RaastPage.onSearchInput(this.value)">
              </div>
            </div>

            <div class="flex gap-2" style="align-items:center; flex-wrap:wrap;">
              <!-- Type Filter Tabs -->
              <div class="tabs" style="margin:0;">
                <button class="tab-btn active" id="raast-tab-all" onclick="RaastPage.setTypeFilter('all')">All</button>
                <button class="tab-btn" id="raast-tab-deposit" onclick="RaastPage.setTypeFilter('Cash Deposit')">📥 Deposits</button>
                <button class="tab-btn" id="raast-tab-withdraw" onclick="RaastPage.setTypeFilter('Cash Withdrawal')">📤 Withdrawals</button>
                <button class="tab-btn" id="raast-tab-bill" onclick="RaastPage.setTypeFilter('Bill Payment')">🧾 Bills</button>
              </div>

              <!-- Refresh Button -->
              <button class="btn btn-ghost btn-sm" onclick="RaastPage.refresh()" title="Refresh List">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Transactions Table Container -->
        <div class="card" style="padding:0;">
          <div class="table-container" style="max-height: calc(100vh - 430px); overflow-y:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Slip #</th>
                  <th>Date & Time</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Commission Fee (Profit)</th>
                  <th>Total Handled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="raast-table-body">
                <tr><td colspan="7" style="text-align:center; padding:40px;"><div class="spinner"></div></td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    this.renderPeriodControls();
    await this.loadStats();
    await this.loadTransactions();
  },

  renderPeriodControls() {
    const container = document.getElementById('raast-period-controls');
    if (!container) return;

    if (this.activePeriod === 'today') {
      container.innerHTML = `
        <label style="font-size:12px; font-weight:700; color:var(--color-text-secondary);">Select Day:</label>
        <input type="date" class="form-input" style="padding:4px 10px; font-size:12px; width:auto;" value="${this.selectedDate}" onchange="RaastPage.onDateChange(this.value)">
      `;
    } else if (this.activePeriod === 'month') {
      container.innerHTML = `
        <label style="font-size:12px; font-weight:700; color:var(--color-text-secondary);">Select Month:</label>
        <input type="month" class="form-input" style="padding:4px 10px; font-size:12px; width:auto;" value="${this.selectedMonth}" onchange="RaastPage.onMonthChange(this.value)">
      `;
    } else if (this.activePeriod === 'year') {
      const currentYear = new Date().getFullYear();
      const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
      container.innerHTML = `
        <label style="font-size:12px; font-weight:700; color:var(--color-text-secondary);">Select Year:</label>
        <select class="form-select" style="padding:4px 10px; font-size:12px; width:auto;" onchange="RaastPage.onYearChange(this.value)">
          ${years.map(y => `<option value="${y}" ${String(y) === String(this.selectedYear) ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      `;
    } else if (this.activePeriod === 'custom') {
      container.innerHTML = `
        <label style="font-size:11px; font-weight:700; color:var(--color-text-secondary);">From:</label>
        <input type="date" class="form-input" style="padding:4px 8px; font-size:12px; width:auto;" value="${this.customStartDate}" onchange="RaastPage.onCustomStartChange(this.value)">
        <label style="font-size:11px; font-weight:700; color:var(--color-text-secondary);">To:</label>
        <input type="date" class="form-input" style="padding:4px 8px; font-size:12px; width:auto;" value="${this.customEndDate}" onchange="RaastPage.onCustomEndChange(this.value)">
      `;
    } else {
      container.innerHTML = `
        <span class="badge badge-info" style="font-size:11px; padding:4px 10px;">Showing Full History</span>
      `;
    }
  },

  async setPeriod(period) {
    this.activePeriod = period;
    document.querySelectorAll('#period-btn-today, #period-btn-month, #period-btn-year, #period-btn-all, #period-btn-custom').forEach(b => b.classList.remove('active'));
    document.getElementById(`period-btn-${period}`)?.classList.add('active');

    this.renderPeriodControls();
    await this.loadStats();
    await this.loadTransactions();
  },

  async onDateChange(val) {
    this.selectedDate = val;
    await this.loadStats();
    await this.loadTransactions();
  },

  async onMonthChange(val) {
    this.selectedMonth = val;
    await this.loadStats();
    await this.loadTransactions();
  },

  async onYearChange(val) {
    this.selectedYear = val;
    await this.loadStats();
    await this.loadTransactions();
  },

  async onCustomStartChange(val) {
    this.customStartDate = val;
    await this.loadStats();
    await this.loadTransactions();
  },

  async onCustomEndChange(val) {
    this.customEndDate = val;
    await this.loadStats();
    await this.loadTransactions();
  },

  async setTypeFilter(type) {
    this.activeTypeFilter = type;
    document.querySelectorAll('#raast-tab-all, #raast-tab-deposit, #raast-tab-withdraw, #raast-tab-bill').forEach(b => b.classList.remove('active'));
    if (type === 'Cash Deposit') {
      document.getElementById('raast-tab-deposit')?.classList.add('active');
    } else if (type === 'Cash Withdrawal') {
      document.getElementById('raast-tab-withdraw')?.classList.add('active');
    } else if (type === 'Bill Payment') {
      document.getElementById('raast-tab-bill')?.classList.add('active');
    } else {
      document.getElementById('raast-tab-all')?.classList.add('active');
    }
    await this.loadTransactions();
  },

  onSearchInput(val) {
    this.searchQuery = val.trim();
    this.loadTransactions();
  },

  async refresh() {
    await this.loadStats();
    await this.loadTransactions();
    toast.info('Data refreshed');
  },

  async loadStats() {
    try {
      const dateRange = this.getDateRange();
      const filters = {};
      if (dateRange.startDate) filters.startDate = dateRange.startDate;
      if (dateRange.endDate) filters.endDate = dateRange.endDate;

      const stats = await window.api.raast.getStats(filters);
      const settings = await window.api.settings.get();
      const curr = settings.currency_symbol || 'Rs.';

      const badgeElem = document.getElementById('kpi-badge-period-1');
      if (badgeElem) badgeElem.textContent = dateRange.badge || 'Grand Profit';

      // Card 1: Deposit Amount & Commission
      document.getElementById('kpi-deposit-amount').textContent = `${curr} ${(stats.total_deposit_volume || 0).toLocaleString()}`;
      document.getElementById('kpi-deposit-count').textContent = `${stats.total_deposit_count || 0} Deposits`;
      document.getElementById('kpi-deposit-commission').textContent = `Commission: ${curr} ${(stats.total_deposit_profit || 0).toLocaleString()}`;

      // Card 2: Withdrawal Amount & Commission
      document.getElementById('kpi-withdrawal-amount').textContent = `${curr} ${(stats.total_withdrawal_volume || 0).toLocaleString()}`;
      document.getElementById('kpi-withdrawal-count').textContent = `${stats.total_withdrawal_count || 0} Withdrawals`;
      document.getElementById('kpi-withdrawal-commission').textContent = `Commission: ${curr} ${(stats.total_withdrawal_profit || 0).toLocaleString()}`;

      // Card 3: Utility Bills Amount & Commission
      document.getElementById('kpi-bill-amount').textContent = `${curr} ${(stats.total_bill_volume || 0).toLocaleString()}`;
      document.getElementById('kpi-bill-count').textContent = `${stats.total_bill_count || 0} Bills`;
      document.getElementById('kpi-bill-commission').textContent = `Commission: ${curr} ${(stats.total_bill_profit || 0).toLocaleString()}`;

      // Card 4: Total Benefit (Grand Profit)
      document.getElementById('kpi-total-profit').textContent = `${curr} ${(stats.total_profit || 0).toLocaleString()}`;
      document.getElementById('kpi-total-volume').textContent = `Vol: ${curr} ${(stats.total_volume || 0).toLocaleString()} (${stats.total_transactions || 0} Trx)`;
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  },

  async loadTransactions() {
    const tbody = document.getElementById('raast-table-body');
    if (!tbody) return;

    try {
      const dateRange = this.getDateRange();
      const filters = {};
      if (this.activeTypeFilter !== 'all') filters.type = this.activeTypeFilter;
      if (this.searchQuery) filters.search = this.searchQuery;
      if (dateRange.startDate) filters.startDate = dateRange.startDate;
      if (dateRange.endDate) filters.endDate = dateRange.endDate;

      const transactions = await window.api.raast.getAll(filters);
      const settings = await window.api.settings.get();
      const curr = settings.currency_symbol || 'Rs.';

      if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7">
              <div class="empty-state" style="padding:40px;">
                <h3>No Transactions for ${dateRange.label}</h3>
                <p>Click "+ Cash Deposit", "+ Cash Withdrawal", or "+ Utility Bill" to record a transaction.</p>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = transactions.map(t => {
        const isDeposit = t.transaction_type === 'Cash Deposit';
        const isBill = t.transaction_type === 'Bill Payment';
        const slipNo = 'RAAST-' + String(t.id).padStart(5, '0');
        
        let badgeClass = 'badge-warning';
        let icon = '📤';
        let typeText = 'Cash Withdrawal';

        if (isDeposit) {
          badgeClass = 'badge-success';
          icon = '📥';
          typeText = 'Cash Deposit';
        } else if (isBill) {
          badgeClass = 'badge-purple';
          icon = '🧾';
          typeText = 'Utility Bill';
        }

        return `
          <tr>
            <td style="font-weight:700; color:var(--color-accent);">${slipNo}</td>
            <td style="font-size:12px;">${formatters.dateTime(t.created_at)}</td>
            <td><span class="badge ${badgeClass}" style="${isBill ? 'background:rgba(124,58,237,0.15); color:#7c3aed;' : ''}">${icon} ${typeText}</span></td>
            <td style="font-weight:700; font-size:14px;">${curr} ${(t.amount || 0).toLocaleString()}</td>
            <td>
              <span class="badge badge-gold" style="font-weight:800; font-size:12px;">+${curr} ${(t.fee_amount || 0).toLocaleString()}</span>
            </td>
            <td style="font-weight:700; color:var(--color-text-primary); font-size:14px;">${curr} ${(t.total_collected || t.amount || 0).toLocaleString()}</td>
            <td>
              <button class="btn btn-ghost btn-sm" style="padding:4px 10px; font-size:12px; color:var(--color-danger);" onclick="RaastPage.confirmDelete(${t.id})" title="Delete Record">
                🗑 Delete
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load transactions:', err);
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--color-danger); text-align:center; padding:20px;">Error loading data: ${err.message}</td></tr>`;
    }
  },

  openTransactionModal(defaultType = 'Cash Deposit') {
    modal.show({
      title: '⚡ Record Transaction & Commission',
      bodyHTML: `
        <div style="display:flex; gap:8px; margin-bottom:var(--space-4);">
          <button type="button" class="btn ${defaultType === 'Cash Deposit' ? 'btn-primary' : 'btn-secondary'}" id="modal-type-deposit" style="flex:1; padding:8px 10px; font-size:13px; font-weight:700;" onclick="RaastPage.switchModalType('Cash Deposit')">
            📥 Cash Deposit
          </button>
          <button type="button" class="btn ${defaultType === 'Cash Withdrawal' ? 'btn-primary' : 'btn-secondary'}" id="modal-type-withdraw" style="flex:1; padding:8px 10px; font-size:13px; font-weight:700;" onclick="RaastPage.switchModalType('Cash Withdrawal')">
            📤 Cash Withdrawal
          </button>
          <button type="button" class="btn ${defaultType === 'Bill Payment' ? 'btn-primary' : 'btn-secondary'}" id="modal-type-bill" style="flex:1; padding:8px 10px; font-size:13px; font-weight:700; background:${defaultType === 'Bill Payment' ? '#7c3aed' : 'transparent'}; border-color:#7c3aed; color:${defaultType === 'Bill Payment' ? '#fff' : 'inherit'};" onclick="RaastPage.switchModalType('Bill Payment')">
            🧾 Utility Bill
          </button>
        </div>
        <input type="hidden" id="raast-trx-type" value="${defaultType}">

        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label" id="raast-amount-label" style="font-weight:800; font-size:14px; color:var(--color-accent);">Deposit Amount (Rs.) *</label>
          <input type="number" class="form-input" id="raast-amount" placeholder="e.g. 5000" min="1" step="any" required oninput="RaastPage.onAmountChange(this.value)" style="font-size:18px; font-weight:800; height:46px;">
        </div>

        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label" id="raast-fee-label" style="font-weight:800; font-size:14px; color:var(--color-gold);">Commission Fee (Profit) (Rs.) *</label>
          <input type="number" class="form-input" id="raast-fee" placeholder="Rs. 20 on 1000" min="0" step="any" value="20" required oninput="RaastPage.onFeeChange(this.value)" style="font-size:18px; font-weight:800; height:46px; color:var(--color-gold);">
        </div>

        <!-- Live Calculation Box -->
        <div class="card" style="margin-top:var(--space-3); padding:var(--space-3) var(--space-4); background:var(--color-bg-tertiary); border:1px solid var(--color-border); border-radius:var(--radius-md);">
          <div class="flex-between">
            <span style="font-size:13px; color:var(--color-text-secondary);" id="raast-calc-label">Total Cash to Collect from Customer:</span>
            <span style="font-size:20px; font-weight:900; color:var(--color-success);" id="raast-calc-total">Rs. 0</span>
          </div>
          <div class="flex-between" style="margin-top:6px; padding-top:6px; border-top:1px dashed var(--color-border);">
            <span style="font-size:12px; color:var(--color-text-muted);">Shopkeeper Earned Profit:</span>
            <span style="font-size:14px; font-weight:800; color:var(--color-gold);" id="raast-calc-profit">+Rs. 0</span>
          </div>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" id="raast-save-btn" onclick="RaastPage.submitTransaction()">Save Transaction</button>
      `
    });

    this.switchModalType(defaultType);
    setTimeout(() => {
      document.getElementById('raast-amount')?.focus();
    }, 150);
  },

  switchModalType(type) {
    const hidden = document.getElementById('raast-trx-type');
    const btnDeposit = document.getElementById('modal-type-deposit');
    const btnWithdraw = document.getElementById('modal-type-withdraw');
    const btnBill = document.getElementById('modal-type-bill');
    const amountLabel = document.getElementById('raast-amount-label');
    const feeLabel = document.getElementById('raast-fee-label');

    if (hidden) hidden.value = type;

    // Reset button styles
    [btnDeposit, btnWithdraw, btnBill].forEach(b => {
      if (b) {
        b.className = 'btn btn-secondary';
        b.style.background = 'transparent';
        b.style.color = 'inherit';
      }
    });

    if (type === 'Cash Deposit') {
      if (btnDeposit) {
        btnDeposit.className = 'btn btn-primary';
      }
      if (amountLabel) amountLabel.textContent = 'Deposit Amount (Rs.) *';
      if (feeLabel) feeLabel.textContent = 'Deposit Commission Fee (Rs. 20/1000) *';
      document.getElementById('raast-calc-label').textContent = 'Total Cash to Collect from Customer:';
    } else if (type === 'Cash Withdrawal') {
      if (btnWithdraw) {
        btnWithdraw.className = 'btn btn-primary';
      }
      if (amountLabel) amountLabel.textContent = 'Withdrawal Amount (Rs.) *';
      if (feeLabel) feeLabel.textContent = 'Withdrawal Commission Fee (Rs. 20/1000) *';
      document.getElementById('raast-calc-label').textContent = 'Net Cash to Hand Over to Customer:';
    } else if (type === 'Bill Payment') {
      if (btnBill) {
        btnBill.className = 'btn btn-primary';
        btnBill.style.background = '#7c3aed';
        btnBill.style.borderColor = '#7c3aed';
        btnBill.style.color = '#fff';
      }
      if (amountLabel) amountLabel.textContent = 'Bill Payable Amount (Rs.) *';
      if (feeLabel) feeLabel.textContent = 'Bill Service Commission Fee (Rs.) *';
      document.getElementById('raast-calc-label').textContent = 'Total Cash to Collect from Customer:';
    }

    this.onAmountChange(document.getElementById('raast-amount')?.value || 0);
  },

  onAmountChange(val) {
    const amt = parseFloat(val) || 0;
    const type = document.getElementById('raast-trx-type')?.value || 'Cash Deposit';
    const feeInput = document.getElementById('raast-fee');

    if (feeInput) {
      if (type === 'Bill Payment') {
        if (!feeInput.value || parseFloat(feeInput.value) <= 0) {
          feeInput.value = 20;
        }
      } else {
        const fee = amt > 0 ? Math.ceil(amt / 1000) * 20 : 0;
        feeInput.value = fee;
      }
    }
    this.updateCalculation();
  },

  onFeeChange() {
    this.updateCalculation();
  },

  updateCalculation() {
    const amt = parseFloat(document.getElementById('raast-amount')?.value) || 0;
    const fee = parseFloat(document.getElementById('raast-fee')?.value) || 0;
    const type = document.getElementById('raast-trx-type')?.value || 'Cash Deposit';

    const totalDisplay = document.getElementById('raast-calc-total');
    const profitDisplay = document.getElementById('raast-calc-profit');

    if (totalDisplay) {
      if (type === 'Cash Deposit' || type === 'Bill Payment') {
        totalDisplay.textContent = `Rs. ${(amt + fee).toLocaleString()}`;
        totalDisplay.style.color = 'var(--color-success)';
      } else {
        totalDisplay.textContent = `Rs. ${amt.toLocaleString()}`;
        totalDisplay.style.color = 'var(--color-warning)';
      }
    }

    if (profitDisplay) {
      profitDisplay.textContent = `+Rs. ${fee.toLocaleString()} (Direct Profit)`;
    }
  },

  async submitTransaction() {
    const type = document.getElementById('raast-trx-type')?.value || 'Cash Deposit';
    const amount = parseFloat(document.getElementById('raast-amount')?.value);
    const fee_amount = parseFloat(document.getElementById('raast-fee')?.value) || 0;

    if (!amount || isNaN(amount) || amount <= 0) {
      return toast.error('Please enter a valid amount');
    }

    const saveBtn = document.getElementById('raast-save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      await window.api.raast.create({
        transaction_type: type,
        amount,
        fee_amount
      });

      toast.success(`${type} recorded! Commission profit: Rs. ${fee_amount}`);
      modal.hide();

      await this.loadStats();
      await this.loadTransactions();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save: ' + err.message);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Transaction';
      }
    }
  },

  confirmDelete(id) {
    modal.show({
      title: '🔒 Admin Password Required to Delete',
      bodyHTML: `
        <div style="padding:4px 0;">
          <p style="color:var(--color-danger); font-size:var(--text-sm); font-weight:700;">
            ⚠️ Are you sure you want to delete record <strong>RAAST-${String(id).padStart(5, '0')}</strong>?
          </p>
          <p style="font-size:var(--text-xs); color:var(--color-text-muted); margin-top:4px;">
            This will remove the transaction and its commission from the profit calculations.
          </p>

          <div class="form-group" style="margin-top:var(--space-4);">
            <label class="form-label" style="font-weight:700; color:var(--color-text-primary);">Enter Password to Confirm Deletion *</label>
            <input type="password" class="form-input" id="raast-delete-password" placeholder="Enter password..." style="font-size:14px; letter-spacing:1px;" onkeydown="if(event.key==='Enter') RaastPage.executeDelete(${id})">
            <small style="color:var(--color-text-muted); font-size:11px; margin-top:4px; display:block;">Authorization password is required to delete this record.</small>
          </div>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-danger" onclick="RaastPage.executeDelete(${id})">Confirm & Delete Record</button>
      `
    });

    setTimeout(() => {
      document.getElementById('raast-delete-password')?.focus();
    }, 150);
  },

  async executeDelete(id) {
    const passwordInput = document.getElementById('raast-delete-password');
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (!password) {
      toast.error('Please enter the password to delete');
      passwordInput?.focus();
      return;
    }

    if (password !== 'hammad') {
      toast.error('Incorrect password! Record was not deleted.');
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
      return;
    }

    try {
      await window.api.raast.delete(id);
      toast.success(`Record RAAST-${String(id).padStart(5, '0')} deleted successfully`);
      modal.hide();
      await this.loadStats();
      await this.loadTransactions();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete: ' + err.message);
    }
  }
};
