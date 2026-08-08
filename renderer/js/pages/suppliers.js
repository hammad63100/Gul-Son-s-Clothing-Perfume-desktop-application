/* Suppliers Page Controller */

window.SuppliersPage = {
  async render(container) {
    container.innerHTML = `
      <div class="page-container animate-fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Supplier Records</h1>
            <p class="page-subtitle">Manage wholesalers, distributors, and supplier purchase ledgers</p>
          </div>
          <div class="toolbar" style="margin:0;">
            <button class="btn btn-primary" onclick="SuppliersPage.openAddModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>+ Add New Supplier</span>
            </button>
          </div>
        </div>

        <div class="toolbar">
          <div class="search-bar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search by name, company, phone..." oninput="SuppliersPage.onSearch(this.value)">
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Supplier Name</th>
                <th>Company / Brand</th>
                <th>Phone Number</th>
                <th>Address</th>
                <th>Opening Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="supplier-table-body">
              <tr><td colspan="6" style="text-align:center;"><div class="spinner" style="margin:20px auto;"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadSuppliers();
  },

  async loadSuppliers(search = '') {
    try {
      const list = await window.api.suppliers.getAll(search);
      const settings = await window.api.settings.get();
      const curr = settings.currency_symbol || 'Rs.';

      const tbody = document.getElementById('supplier-table-body');
      if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><h3>No Suppliers Recorded</h3><p>Add suppliers to track purchases and payables.</p></div></td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(s => `
        <tr>
          <td style="font-weight:600; color:var(--color-text-primary);">${s.name}</td>
          <td>${s.company || '-'}</td>
          <td>${s.phone || '-'}</td>
          <td>${s.address || '-'}</td>
          <td style="font-weight:700; color:var(--color-accent);">${formatters.currency(s.opening_balance, curr)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" onclick="SuppliersPage.deleteSupplier(${s.id})">Delete</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to load suppliers');
    }
  },

  onSearch(val) {
    this.loadSuppliers(val.trim());
  },

  openAddModal() {
    modal.show({
      title: 'Add New Supplier',
      bodyHTML: `
        <div class="form-group">
          <label class="form-label">Supplier Name *</label>
          <input type="text" class="form-input" id="sup-name" placeholder="e.g. Al-Karam Wholesale" required>
        </div>
        <div class="form-row" style="margin-top:var(--space-3);">
          <div class="form-group">
            <label class="form-label">Company / Brand</label>
            <input type="text" class="form-input" id="sup-company" placeholder="e.g. Sapphire / Dior Distributor">
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="text" class="form-input" id="sup-phone" placeholder="0300-1234567">
          </div>
        </div>
        <div class="form-group" style="margin-top:var(--space-3);">
          <label class="form-label">Address</label>
          <input type="text" class="form-input" id="sup-address" placeholder="City Market, Shop #">
        </div>
        <div class="form-group" style="margin-top:var(--space-3);">
          <label class="form-label">Opening Balance Payable (Rs.)</label>
          <input type="number" step="0.01" class="form-input" id="sup-balance" value="0">
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="SuppliersPage.saveSupplier()">Save Supplier</button>
      `
    });
  },

  async saveSupplier() {
    const name = document.getElementById('sup-name').value.trim();
    const company = document.getElementById('sup-company').value.trim();
    const phone = document.getElementById('sup-phone').value.trim();
    const address = document.getElementById('sup-address').value.trim();
    const opening_balance = parseFloat(document.getElementById('sup-balance').value) || 0;

    if (!name) {
      toast.error('Supplier name is required');
      return;
    }

    try {
      await window.api.suppliers.add({ name, company, phone, address, opening_balance });
      toast.success('Supplier added!');
      modal.hide();
      this.loadSuppliers();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save supplier');
    }
  },

  deleteSupplier(id) {
    modal.confirm({
      title: 'Delete Supplier',
      message: 'Are you sure you want to delete this supplier profile?',
      confirmText: 'Delete',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        try {
          await window.api.suppliers.delete(id);
          toast.success('Supplier deleted');
          this.loadSuppliers();
        } catch (err) {
          console.error(err);
          toast.error('Failed to delete supplier');
        }
      }
    });
  }
};
