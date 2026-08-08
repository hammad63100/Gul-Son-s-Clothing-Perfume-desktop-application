/* Customers Page Controller */

window.CustomersPage = {
  currentCustomer: null,

  async render(container) {
    this.container = container;
    this.showList();
  },

  async showList(search = '') {
    this.container.innerHTML = `
      <div class="page-container animate-fade-in">
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h1 class="page-title">Customer Records</h1>
            <p class="page-subtitle">Track customer purchase history, ledgers, and credit balances</p>
          </div>
        </div>

        <div class="toolbar" style="display:flex; justify-content:space-between;">
          <div class="search-bar" style="width:300px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="cust-search" placeholder="Search code, name or phone..." value="${search}" oninput="CustomersPage.onSearch(this.value)">
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>Total Purchases</th>
                <th>Payments</th>
                <th>Balance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="cust-table-body">
              <tr><td colspan="7" style="text-align:center;"><div class="spinner" style="margin:20px auto;"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    // Focus search if it exists
    const searchInput = document.getElementById('cust-search');
    if (searchInput && search) {
      searchInput.focus();
      // Move cursor to end
      const val = searchInput.value;
      searchInput.value = '';
      searchInput.value = val;
    }

    try {
      const customers = await window.api.customers.getAll(search);
      const settings = await window.api.settings.get();
      const curr = settings.currency_symbol || 'Rs.';

      const tbody = document.getElementById('cust-table-body');
      if (!customers || customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3>No Customers Found</h3><p>Customers are saved when processing POS sales.</p></div></td></tr>`;
        return;
      }

      tbody.innerHTML = customers.map(c => `
        <tr style="cursor:pointer" onclick="CustomersPage.showProfile(${c.id})">
          <td><span class="badge badge-info">${c.customer_code || 'N/A'}</span></td>
          <td style="font-weight:600; color:var(--color-text-primary);">${c.name}</td>
          <td>${c.phone || '-'}</td>
          <td style="font-weight:600;">${formatters.currency(c.total_purchases, curr)}</td>
          <td style="color:var(--color-success); font-weight:600;">${formatters.currency(c.total_payments, curr)}</td>
          <td style="color:var(--color-danger); font-weight:700;">${formatters.currency(c.outstanding_balance, curr)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); CustomersPage.showProfile(${c.id})">View Profile</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customers');
    }
  },

  onSearch(val) {
    this.showList(val);
  },

  async showProfile(id) {
    try {
      const customer = await window.api.customers.get(id);
      if (!customer) return toast.error('Customer not found');
      
      this.currentCustomer = customer;
      const ledger = await window.api.customers.getLedger(id);
      const settings = await window.api.settings.get();
      const curr = settings.currency_symbol || 'Rs.';

      this.container.innerHTML = `
        <div class="page-container animate-fade-in">
          <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <button class="btn btn-ghost btn-sm" style="margin-bottom:var(--space-2); padding:0;" onclick="CustomersPage.showList()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to Customers
              </button>
              <h1 class="page-title">${customer.name}</h1>
              <p class="page-subtitle">Phone: ${customer.phone || 'N/A'} &nbsp;|&nbsp; Code: ${customer.customer_code || 'N/A'} &nbsp;|&nbsp; Address: ${customer.address || 'N/A'}</p>
            </div>
            <div style="display:flex; gap:var(--space-2);">
              <button class="btn btn-secondary" onclick="CustomersPage.editProfile()">Edit Profile</button>
              <button class="btn btn-primary" onclick="CustomersPage.showAddPaymentModal()">Receive Payment</button>
            </div>
          </div>

          <div class="grid grid-4 gap-4" style="margin-bottom: var(--space-4);">
            <div class="card" style="border-top: 3px solid var(--color-accent);">
              <div style="font-size:var(--text-xs); color:var(--color-text-muted);">Total Purchases</div>
              <div style="font-size:var(--text-lg); font-weight:700;">${formatters.currency(customer.total_purchases, curr)}</div>
            </div>
            <div class="card" style="border-top: 3px solid var(--color-success);">
              <div style="font-size:var(--text-xs); color:var(--color-text-muted);">Total Payments Received</div>
              <div style="font-size:var(--text-lg); font-weight:700; color:var(--color-success);">${formatters.currency(customer.total_payments || 0, curr)}</div>
            </div>
            <div class="card" style="border-top: 3px solid var(--color-danger);">
              <div style="font-size:var(--text-xs); color:var(--color-text-muted);">Outstanding Balance (Credit)</div>
              <div style="font-size:var(--text-lg); font-weight:700; color:var(--color-danger);">${formatters.currency(customer.outstanding_balance || 0, curr)}</div>
            </div>
            <div class="card" style="border-top: 3px solid #8b5cf6;">
              <div style="font-size:var(--text-xs); color:var(--color-text-muted);">Est. Profit from Customer</div>
              <div style="font-size:var(--text-lg); font-weight:700; color:#8b5cf6;">${formatters.currency(customer.total_profit || 0, curr)}</div>
            </div>
          </div>

          <div class="card" style="padding:0; overflow:hidden;">
            <div style="padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); background: var(--color-bg-tertiary);">
              <h3 style="margin:0; font-size:var(--text-md);">Customer Ledger</h3>
            </div>
            <div class="table-container" style="border:none; border-radius:0;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Description</th>
                    <th>Payment Method</th>
                    <th style="text-align:right;">Debit (Rs.)</th>
                    <th style="text-align:right;">Credit (Rs.)</th>
                    <th style="text-align:right;">Balance (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  ${ledger.length === 0 ? `<tr><td colspan="7" style="text-align:center;">No ledger entries found</td></tr>` : 
                    ledger.map(entry => `
                      <tr>
                        <td>${formatters.dateTime(entry.date)}</td>
                        <td style="font-weight:600;">${entry.reference}</td>
                        <td>
                          ${entry.type === 'Purchase' ? '<span class="badge badge-info">Sale</span> ' : ''}
                          ${entry.type === 'Payment' ? '<span class="badge badge-success">Payment</span> ' : ''}
                          ${entry.type === 'Return' ? '<span class="badge badge-danger">Return</span> ' : ''}
                          ${entry.description}
                        </td>
                        <td>${entry.method || '-'}</td>
                        <td style="text-align:right; font-weight:600; color:var(--color-text-primary);">${entry.amount_debit ? entry.amount_debit.toLocaleString() : '-'}</td>
                        <td style="text-align:right; font-weight:600; color:var(--color-success);">${entry.amount_credit ? entry.amount_credit.toLocaleString() : '-'}</td>
                        <td style="text-align:right; font-weight:700; color:${entry.balance > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)'};">${entry.balance.toLocaleString()}</td>
                      </tr>
                    `).join('')
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customer profile');
    }
  },

  editProfile() {
    const c = this.currentCustomer;
    modal.show({
      title: 'Edit Customer Profile',
      bodyHTML: `
        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label">Customer Code</label>
          <input type="text" id="edit-cust-code" class="form-input" value="${c.customer_code || ''}">
        </div>
        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label">Name</label>
          <input type="text" id="edit-cust-name" class="form-input" value="${c.name || ''}">
        </div>
        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label">Phone</label>
          <input type="text" id="edit-cust-phone" class="form-input" value="${c.phone || ''}">
        </div>
        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label">Address</label>
          <input type="text" id="edit-cust-address" class="form-input" value="${c.address || ''}">
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="CustomersPage.saveProfile()">Save Changes</button>
      `
    });
  },

  async saveProfile() {
    const code = document.getElementById('edit-cust-code').value.trim();
    const name = document.getElementById('edit-cust-name').value.trim();
    const phone = document.getElementById('edit-cust-phone').value.trim();
    const address = document.getElementById('edit-cust-address').value.trim();

    if (!name) return toast.error('Name is required');

    try {
      await window.api.customers.update(this.currentCustomer.id, {
        customer_code: code,
        name: name,
        phone: phone,
        address: address
      });
      modal.hide();
      toast.success('Profile updated');
      this.showProfile(this.currentCustomer.id);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile');
    }
  },

  showAddPaymentModal() {
    modal.show({
      title: 'Receive Customer Payment',
      bodyHTML: `
        <div style="background:var(--color-bg-secondary); padding:var(--space-3); border-radius:var(--radius-md); margin-bottom:var(--space-3);">
          <strong>Outstanding Balance: </strong> 
          <span style="color:var(--color-danger); font-weight:700;">Rs. ${this.currentCustomer.outstanding_balance.toLocaleString()}</span>
        </div>
        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label">Amount Received (Rs.)</label>
          <input type="number" id="pay-amount" class="form-input" value="${this.currentCustomer.outstanding_balance > 0 ? this.currentCustomer.outstanding_balance : ''}" step="0.01">
        </div>
        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label">Payment Method</label>
          <select id="pay-method" class="form-select">
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Check">Check</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:var(--space-3);">
          <label class="form-label">Note / Reference (Optional)</label>
          <input type="text" id="pay-note" class="form-input" placeholder="e.g. Paid in full, Check #1234">
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="CustomersPage.processPayment()">Record Payment</button>
      `
    });
  },

  async processPayment() {
    const amount = parseFloat(document.getElementById('pay-amount').value);
    const method = document.getElementById('pay-method').value;
    const note = document.getElementById('pay-note').value.trim();

    if (isNaN(amount) || amount <= 0) {
      return toast.error('Please enter a valid amount greater than 0');
    }

    try {
      await window.api.customers.addPayment(this.currentCustomer.id, amount, method, note);
      modal.hide();
      toast.success('Payment recorded successfully');
      this.showProfile(this.currentCustomer.id);
    } catch (err) {
      console.error(err);
      toast.error('Failed to record payment');
    }
  }
};
