/* Sales History & Returns Page Controller */

window.SalesHistoryPage = {
  activeTab: 'returns',
  selectedInvoice: null,

  async render(container, defaultTab = 'returns') {
    this.activeTab = defaultTab;

    container.innerHTML = `
      <div class="page-container animate-fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Sales Return & Refund Manager</h1>
            <p class="page-subtitle">Search original invoices, process item/full returns, restore stock & track return history</p>
          </div>
          <div class="toolbar" style="margin:0;">
            <button class="btn btn-primary" onclick="app.navigateTo('pos')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              <span>+ New Sale / POS</span>
            </button>
          </div>
        </div>

        <!-- Tab Bar -->
        <div class="tabs">
          <button class="tab-btn ${this.activeTab === 'returns' ? 'active' : ''}" id="sales-tab-returns" onclick="SalesHistoryPage.switchTab('returns')">↩️ Sales Return</button>
          <button class="tab-btn ${this.activeTab === 'history' ? 'active' : ''}" id="sales-tab-history" onclick="SalesHistoryPage.switchTab('history')">📜 Sales History</button>
        </div>

        <div id="sales-tab-content" style="margin-top: var(--space-4);">
          <div class="spinner" style="margin: 40px auto;"></div>
        </div>
      </div>
    `;

    await this.loadActiveTab();
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
    
    if (tab === 'returns') {
      document.getElementById('sales-tab-returns')?.classList.add('active');
    } else {
      document.getElementById('sales-tab-history')?.classList.add('active');
    }
    this.loadActiveTab();
  },

  async loadActiveTab() {
    const area = document.getElementById('sales-tab-content');
    if (!area) return;

    area.innerHTML = `<div class="spinner" style="margin: 40px auto;"></div>`;

    if (this.activeTab === 'returns') {
      await this.loadReturnsView(area);
    } else {
      await this.loadHistoryView(area);
    }
  },

  async loadReturnsView(container) {
    container.innerHTML = `
      <div class="grid grid-2 gap-6">

        <!-- Left Panel: Search & Process Return -->
        <div class="card">
          <h3 class="card-title">🔍 Search Original Invoice</h3>
          <p class="card-subtitle">Enter Invoice # (e.g. GS-000001), customer name or phone</p>

          <div class="search-bar" style="margin-top:var(--space-3); max-width:100%;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="return-search-invoice" placeholder="Type GS-000001 or Customer Name/Phone..." oninput="SalesHistoryPage.onSearchInvoiceInput(this.value)">
          </div>

          <!-- Invoice Selection Results -->
          <div id="return-invoice-results" style="margin-top:var(--space-3); max-height:180px; overflow-y:auto;">
            <p style="color:var(--color-text-muted); font-size:var(--text-xs);">Start typing above to find matching invoices...</p>
          </div>

          <!-- Selected Invoice Items Area -->
          <div id="return-invoice-items-area" style="margin-top:var(--space-4); display:none;">
            <!-- Rendered when an invoice is clicked -->
          </div>
        </div>

        <!-- Right Panel: Return History Log -->
        <div class="card">
          <div class="flex-between">
            <h3 class="card-title">📜 Return History Log</h3>
            <button class="btn btn-ghost btn-sm" onclick="SalesHistoryPage.loadActiveTab()">Refresh</button>
          </div>
          <div class="table-container" style="margin-top:var(--space-3); max-height:450px; overflow-y:auto;">
            <table class="data-table" style="font-size:12px;">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice #</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Refund</th>
                  <th>Reason</th>
                  <th>Refund Type</th>
                </tr>
              </thead>
              <tbody id="returns-history-tbody">
                <tr><td colspan="7" style="text-align:center;"><div class="spinner"></div></td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    await this.loadReturnHistoryTable();
    await this.onSearchInvoiceInput('');
  },

  async onSearchInvoiceInput(query = '') {
    const q = query.trim().toLowerCase();
    const resultsContainer = document.getElementById('return-invoice-results');
    if (!resultsContainer) return;

    try {
      const sales = await window.api.sales.getAll(q ? { search: q, limit: 10 } : { limit: 10 });
      if (!sales || sales.length === 0) {
        resultsContainer.innerHTML = `<p style="color:var(--color-danger); font-size:var(--text-xs); padding:10px;">${q ? `No invoices found matching "${q}"` : 'No saved invoices in database yet. Create a sale in POS first!'}</p>`;
        return;
      }

      resultsContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="font-size:11px; color:var(--color-accent); font-weight:600;">${q ? 'Matching Search Invoices:' : 'Recent Saved Invoices (Click to select):'}</div>
          ${sales.map(s => `
            <div class="card" style="padding:8px 12px; cursor:pointer; background:var(--color-bg-tertiary);" onclick="SalesHistoryPage.selectInvoiceForReturn(${s.id})">
              <div class="flex-between">
                <strong style="color:var(--color-accent);">${s.invoice_no}</strong>
                <span style="font-weight:700;">Rs. ${(s.total_amount || 0).toLocaleString()}</span>
              </div>
              <div style="font-size:11px; color:var(--color-text-muted);">
                Cust: ${s.customer_name || 'Walk-in'} ${s.customer_phone ? `(${s.customer_phone})` : ''} • ${s.created_at || ''}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      console.error(err);
    }
  },

  async selectInvoiceForReturn(saleId) {
    try {
      const sale = await window.api.sales.get(saleId);
      if (!sale) return;

      this.selectedInvoice = sale;
      const area = document.getElementById('return-invoice-items-area');
      if (!area) return;

      area.style.display = 'block';
      area.innerHTML = `
        <div style="border-top:1px solid var(--color-border); padding-top:var(--space-3);">
          <div class="flex-between" style="margin-bottom:var(--space-2);">
            <div>
              <h4 style="font-size:var(--text-base); color:var(--color-accent);">Invoice: ${sale.invoice_no}</h4>
              <span style="font-size:11px; color:var(--color-text-muted);">Customer: ${sale.customer_name || 'Walk-in'} • Total: Rs. ${sale.total_amount.toLocaleString()}</span>
            </div>
            <button class="btn btn-danger btn-sm" onclick="SalesHistoryPage.confirmFullInvoiceReturn(${sale.id})">
              ↩️ Return Complete Invoice
            </button>
          </div>

          <h5 style="font-size:var(--text-xs); color:var(--color-text-muted); margin-bottom:6px;">Select Item for Partial Return / Exchange:</h5>
          
          <table class="data-table" style="font-size:12px;">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Variant</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items.map(item => `
                <tr>
                  <td style="font-weight:600;">${item.product_name}</td>
                  <td>${item.product_size || item.product_color ? `${item.product_size || ''} ${item.product_color || ''}` : '-'}</td>
                  <td><span class="badge badge-info">${item.quantity} pcs</span></td>
                  <td>Rs. ${item.price_at_sale}</td>
                  <td>
                    <button class="btn btn-primary btn-sm" style="padding:2px 8px;" onclick="SalesHistoryPage.openItemReturnModal(${sale.id}, ${item.product_id}, '${item.product_name.replace(/'/g, "\\'")}', ${item.quantity}, ${item.price_at_sale})">Return</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      console.error(err);
      toast.error('Failed to load invoice items');
    }
  },

  openItemReturnModal(saleId, productId, prodName, maxQty, price) {
    modal.show({
      title: `Process Return — ${prodName}`,
      bodyHTML: `
        <div class="form-group">
          <label class="form-label">Return Quantity (Max: ${maxQty} pcs) *</label>
          <input type="number" class="form-input" id="ret-item-qty" value="1" min="1" max="${maxQty}" required>
        </div>

        <div class="form-group" style="margin-top:var(--space-3);">
          <label class="form-label">Return Reason *</label>
          <select class="form-select" id="ret-item-reason" onchange="SalesHistoryPage.onReasonChange(this.value)">
            <option value="Wrong Size">Wrong Size</option>
            <option value="Wrong Color">Wrong Color</option>
            <option value="Defective / Damaged">Defective / Damaged</option>
            <option value="Customer Changed Mind">Customer Changed Mind</option>
            <option value="Other">Other (Custom Reason)</option>
          </select>
        </div>

        <!-- Custom Reason Space (Saved in DB) -->
        <div class="form-group" id="ret-custom-reason-group" style="margin-top:var(--space-3); display:none;">
          <label class="form-label">Specify Custom Reason *</label>
          <input type="text" class="form-input" id="ret-item-custom-reason" placeholder="Enter reason details...">
        </div>

        <div class="form-group" style="margin-top:var(--space-3);">
          <label class="form-label">Refund / Adjustment Mode *</label>
          <select class="form-select" id="ret-item-type">
            <option value="Cash Refund">💵 Cash Refund to Customer</option>
            <option value="Adjust Customer Balance">📖 Adjust Customer Balance / Credit</option>
            <option value="Product Exchange">🔄 Exchange Product</option>
          </select>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-danger" onclick="SalesHistoryPage.submitItemReturn(${saleId}, ${productId})">Confirm Return & Restore Stock</button>
      `
    });
  },

  onReasonChange(val) {
    const group = document.getElementById('ret-custom-reason-group');
    if (group) {
      group.style.display = val === 'Other' ? 'block' : 'none';
    }
  },

  async submitItemReturn(saleId, productId) {
    const qty = parseInt(document.getElementById('ret-item-qty').value) || 1;
    const reason = document.getElementById('ret-item-reason').value;
    const customReason = document.getElementById('ret-item-custom-reason')?.value.trim() || null;
    const refundType = document.getElementById('ret-item-type').value;

    if (reason === 'Other' && !customReason) {
      return toast.error('Please enter the custom reason');
    }

    try {
      await window.api.returns.process(saleId, productId, qty, reason, customReason, refundType);
      toast.success('Return processed successfully! Stock restored.');
      modal.hide();
      this.loadActiveTab();
    } catch (err) {
      console.error(err);
      toast.error('Failed to process return: ' + err.message);
    }
  },

  confirmFullInvoiceReturn(saleId) {
    modal.show({
      title: 'Return Complete Invoice',
      bodyHTML: `
        <p style="color:var(--color-warning); font-size:var(--text-sm);">Are you sure you want to return ALL items in this invoice?</p>

        <div class="form-group" style="margin-top:var(--space-3);">
          <label class="form-label">Return Reason *</label>
          <select class="form-select" id="ret-full-reason" onchange="SalesHistoryPage.onReasonChangeFull(this.value)">
            <option value="Customer Changed Mind">Customer Changed Mind</option>
            <option value="Wrong Size">Wrong Size</option>
            <option value="Wrong Color">Wrong Color</option>
            <option value="Defective / Damaged">Defective / Damaged</option>
            <option value="Other">Other (Custom Reason)</option>
          </select>
        </div>

        <div class="form-group" id="ret-full-custom-group" style="margin-top:var(--space-3); display:none;">
          <label class="form-label">Specify Custom Reason *</label>
          <input type="text" class="form-input" id="ret-full-custom-reason" placeholder="Enter reason details...">
        </div>

        <div class="form-group" style="margin-top:var(--space-3);">
          <label class="form-label">Refund / Adjustment Mode *</label>
          <select class="form-select" id="ret-full-type">
            <option value="Cash Refund">💵 Cash Refund</option>
            <option value="Adjust Customer Balance">📖 Adjust Customer Balance</option>
          </select>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-danger" onclick="SalesHistoryPage.submitFullInvoiceReturn(${saleId})">Return Entire Invoice & Restore All Stock</button>
      `
    });
  },

  onReasonChangeFull(val) {
    const group = document.getElementById('ret-full-custom-group');
    if (group) {
      group.style.display = val === 'Other' ? 'block' : 'none';
    }
  },

  async submitFullInvoiceReturn(saleId) {
    const reason = document.getElementById('ret-full-reason').value;
    const customReason = document.getElementById('ret-full-custom-reason')?.value.trim() || null;
    const refundType = document.getElementById('ret-full-type').value;

    if (reason === 'Other' && !customReason) {
      return toast.error('Please enter the custom reason');
    }

    try {
      await window.api.returns.processFullInvoice(saleId, reason, customReason, refundType);
      toast.success('Complete invoice returned! All items restored to inventory stock.');
      modal.hide();
      this.loadActiveTab();
    } catch (err) {
      console.error(err);
      toast.error('Failed to return invoice: ' + err.message);
    }
  },

  async loadReturnHistoryTable() {
    try {
      const returnsList = await window.api.returns.getAll();
      const settings = await window.api.settings.get();
      const curr = settings.currency_symbol || 'Rs.';

      const tbody = document.getElementById('returns-history-tbody');
      if (!tbody) return;

      if (!returnsList || returnsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3>No Returns Recorded</h3><p>Processed sales returns will appear here.</p></div></td></tr>`;
        return;
      }

      tbody.innerHTML = returnsList.map(r => `
        <tr>
          <td>${formatters.dateTime(r.created_at)}</td>
          <td style="font-weight:700; color:var(--color-accent);">${r.sale_invoice_no}</td>
          <td style="font-weight:600;">${r.product_name}</td>
          <td><span class="badge badge-warning">${r.quantity} pcs</span></td>
          <td style="font-weight:700; color:var(--color-danger);">${formatters.currency(r.refund_amount, curr)}</td>
          <td>${r.reason || '-'}</td>
          <td><span class="badge badge-gold">${r.refund_type || 'Cash Refund'}</span></td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  },

  async loadHistoryView(container) {
    try {
      const salesList = await window.api.sales.getAll();
      const settings = await window.api.settings.get();
      const curr = settings.currency_symbol || 'Rs.';

      if (!salesList || salesList.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <h3>No Sales Recorded Yet</h3>
            <p>Go to POS / Billing to make your first sale.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Items Count</th>
                <th>Total Amount</th>
                <th>Payment Method</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${salesList.map(s => `
                <tr>
                  <td style="font-weight:700; color: var(--color-accent);">${s.invoice_no}</td>
                  <td>${formatters.dateTime(s.created_at)}</td>
                  <td>${s.customer_name || 'Walk-in Customer'}</td>
                  <td><span class="badge badge-info">${s.item_count || 0} items</span></td>
                  <td style="font-weight:700;">${formatters.currency(s.total_amount, curr)}</td>
                  <td><span class="badge badge-gold">${s.payment_method}</span></td>
                  <td>
                    <div class="flex gap-2">
                      <button class="btn btn-secondary btn-sm" onclick="SalesHistoryPage.viewInvoiceDetails(${s.id})">Details</button>
                      <button class="btn btn-ghost btn-sm" onclick="SalesHistoryPage.printInvoice(${s.id})">Print PDF</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      console.error(err);
      toast.error('Failed to load sales history');
    }
  },

  async viewInvoiceDetails(saleId) {
    const sale = await window.api.sales.get(saleId);
    if (!sale) return;

    const settings = await window.api.settings.get();
    const curr = settings.currency_symbol || 'Rs.';

    modal.show({
      title: `Invoice Details — ${sale.invoice_no}`,
      size: 'modal-lg',
      bodyHTML: `
        <div class="flex-between" style="margin-bottom: var(--space-4);">
          <div>
            <div>Date: <strong>${formatters.dateTime(sale.created_at)}</strong></div>
            <div>Customer: <strong>${sale.customer_name || 'Walk-in Customer'}</strong> (${sale.customer_phone || 'No phone'})</div>
          </div>
          <div style="text-align:right;">
            <div>Payment Method: <span class="badge badge-gold">${sale.payment_method}</span></div>
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Variant</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items.map(item => `
              <tr>
                <td style="font-weight:600;">${item.product_name}</td>
                <td>${item.product_size || item.product_color ? `${item.product_size || ''} ${item.product_color || ''}` : '-'}</td>
                <td>${item.quantity}</td>
                <td>${formatters.currency(item.price_at_sale, curr)}</td>
                <td style="font-weight:700;">${formatters.currency(item.line_total, curr)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: var(--space-4); text-align:right; font-size: var(--text-md);">
          <div>Subtotal: <strong>${formatters.currency(sale.subtotal, curr)}</strong></div>
          ${sale.discount_amount > 0 ? `<div style="color:var(--color-success);">Discount: -${formatters.currency(sale.discount_amount, curr)}</div>` : ''}
          <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-accent); margin-top: 4px;">
            Total Paid: ${formatters.currency(sale.total_amount, curr)}
          </div>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Close</button>
        <button class="btn btn-primary" onclick="SalesHistoryPage.printInvoice(${saleId})">Print Invoice PDF</button>
      `
    });
  },

  async printInvoice(saleId) {
    const sale = await window.api.sales.get(saleId);
    if (!sale) return;

    try {
      const savedPath = await window.api.backup.generateInvoicePDF(sale);
      if (savedPath) {
        toast.success(`Invoice saved to ${savedPath.path || savedPath}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF');
    }
  }
};
