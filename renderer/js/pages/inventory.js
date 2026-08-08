/* Inventory & Products Controller */

window.InventoryPage = {
  activeTab: 'all-products',
  currentFilters: {
    search: '',
    category: '',
    brand: '',
    lowStock: false,
    outOfStock: false
  },

  async render(container, defaultTab = 'all-products') {
    this.activeTab = defaultTab;
    // Each navigation entry starts with a fresh visible filter state.
    this.currentFilters.search = '';
    this.currentFilters.category = '';

    container.innerHTML = `
      <div class="page-container animate-fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Products & Inventory Master</h1>
            <p class="page-subtitle">Clothes (size/color/fabric) and Perfumes (ml/gender/fragrance) catalog & stock</p>
          </div>
          <div class="toolbar" style="margin:0;">
            <button class="btn btn-primary" onclick="InventoryPage.openAddModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>+ Add Product</span>
            </button>
          </div>
        </div>

        <!-- In-Page Tab Navigation Bar -->
        <div class="tabs">
          <button class="tab-btn ${this.activeTab === 'all-products' ? 'active' : ''}" id="inv-tab-all" onclick="InventoryPage.switchTab('all-products')">📦 All Products</button>
          <button class="tab-btn ${this.activeTab === 'add-product' ? 'active' : ''}" id="inv-tab-add" onclick="InventoryPage.openAddModal()">➕ Add Product</button>
          <button class="tab-btn ${this.activeTab === 'categories' ? 'active' : ''}" id="inv-tab-cat" onclick="app.navigateTo('categories')">🏷️ Categories & Brands</button>
          <button class="tab-btn ${this.activeTab === 'low-stock' ? 'active' : ''}" id="inv-tab-low" onclick="InventoryPage.switchTab('low-stock')">⚠️ Low Stock</button>
          <button class="tab-btn ${this.activeTab === 'out-of-stock' ? 'active' : ''}" id="inv-tab-out" onclick="InventoryPage.switchTab('out-of-stock')">🚫 Out of Stock</button>
        </div>

        <!-- Filter Toolbar -->
        <div class="toolbar" style="margin-top: var(--space-4);">
          <div class="search-bar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="inv-search" placeholder="Search product, SKU, barcode, brand, supplier..." oninput="InventoryPage.onSearchInput(this.value)">
          </div>

          <select class="filter-select" id="inv-filter-category" onchange="InventoryPage.onCategoryFilter(this.value)">
            <option value="">All Categories</option>
            <option value="Clothes">Clothes</option>
            <option value="Perfume">Perfume</option>
          </select>

          <div style="margin-left: auto;">
            <button class="btn btn-ghost btn-sm" onclick="InventoryPage.loadProducts()">Refresh</button>
          </div>
        </div>

        <!-- Products Table -->
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Variants & Attributes</th>
                <th>SKU / Barcode</th>
                <th>Cost Price</th>
                <th>Retail Price</th>
                <th>Stock Qty</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="inv-products-table">
              <tr><td colspan="9" style="text-align:center;"><div class="spinner" style="margin:20px auto;"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (defaultTab === 'low-stock') {
      this.currentFilters.lowStock = true;
      this.currentFilters.outOfStock = false;
    } else if (defaultTab === 'out-of-stock') {
      this.currentFilters.outOfStock = true;
      this.currentFilters.lowStock = false;
    } else {
      this.currentFilters.lowStock = false;
      this.currentFilters.outOfStock = false;
    }

    await this.loadProducts();
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.tabs .tab-btn').forEach(b => b.classList.remove('active'));
    
    if (tab === 'low-stock') {
      document.getElementById('inv-tab-low')?.classList.add('active');
      this.currentFilters.lowStock = true;
      this.currentFilters.outOfStock = false;
    } else if (tab === 'out-of-stock') {
      document.getElementById('inv-tab-out')?.classList.add('active');
      this.currentFilters.outOfStock = true;
      this.currentFilters.lowStock = false;
    } else {
      document.getElementById('inv-tab-all')?.classList.add('active');
      this.currentFilters.lowStock = false;
      this.currentFilters.outOfStock = false;
    }
    this.loadProducts();
  },

  async loadProducts() {
    try {
      const products = await window.api.products.getAll(this.currentFilters);
      const settings = await window.api.settings.get();
      const curr = settings.currency_symbol || 'Rs.';

      const tbody = document.getElementById('inv-products-table');
      if (!tbody) return;

      if (!products || products.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9">
              <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                <h3>No Products Found</h3>
                <p>Click "+ Add Product" to start building your catalog.</p>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = products.map(p => {
        const isOut = p.quantity <= 0;
        const isLow = !isOut && p.quantity <= p.low_stock_threshold;
        const variantText = [];
        if (p.size) variantText.push(`Size: ${p.size}`);
        if (p.color) variantText.push(`Color: ${p.color}`);
        if (p.fabric) variantText.push(`Fabric: ${p.fabric}`);
        if (p.fragrance_type) variantText.push(`Type: ${p.fragrance_type}`);
        if (p.gender) variantText.push(`Gender: ${p.gender}`);

        return `
          <tr>
            <td style="font-weight:600; color:var(--color-text-primary);">${p.name}</td>
            <td><span class="badge ${p.category === 'Clothes' ? 'badge-clothes' : 'badge-perfume'}">${p.category}</span></td>
            <td>${p.brand ? `<span class="badge badge-gold">${p.brand}</span>` : '-'}</td>
            <td style="font-size:var(--text-xs); color:var(--color-text-secondary);">${variantText.length > 0 ? variantText.join(' • ') : '-'}</td>
            <td style="font-family:monospace; font-size:var(--text-xs);">${p.sku || p.barcode || '-'}</td>
            <td>${formatters.currency(p.purchase_price, curr)}</td>
            <td style="font-weight:600; color:var(--color-accent);">${formatters.currency(p.sale_price, curr)}</td>
            <td>
              <span class="badge ${isOut ? 'badge-danger' : (isLow ? 'badge-warning' : 'badge-success')}">
                ${isOut ? 'OUT OF STOCK (0 pcs)' : `${p.quantity} pcs`}
              </span>
            </td>
            <td>
              <div class="flex gap-2">
                <button class="btn btn-secondary btn-sm" onclick="InventoryPage.openStockInModal(${p.id})">+ Stock</button>
                <button class="btn btn-ghost btn-sm btn-icon" onclick="InventoryPage.openEditModal(${p.id})">✏️</button>
                <button class="btn btn-ghost btn-sm btn-icon" style="color:var(--color-danger);" onclick="InventoryPage.confirmDelete(${p.id}, '${p.name.replace(/'/g, "\\'")}')">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to load inventory');
    }
  },

  onSearchInput(val) {
    this.currentFilters.search = val.trim();
    this.loadProducts();
  },

  onCategoryFilter(cat) {
    this.currentFilters.category = cat;
    this.loadProducts();
  },

  async openAddModal() {
    const categories = await window.api.master.getCategories();
    const brands = await window.api.master.getBrands();

    modal.show({
      title: 'Add New Product (Clothes / Perfume)',
      size: 'modal-lg',
      bodyHTML: `
        <form id="form-add-product">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Product Name *</label>
              <input type="text" class="form-input" id="prod-name" placeholder="e.g. Cotton Embroidered Kurti / Oud Royal 100ml" required>
            </div>
            <div class="form-group">
              <label class="form-label">Main Category *</label>
              <select class="form-select" id="prod-category" onchange="InventoryPage.onModalCategoryChange(this.value)">
                <option value="Clothes">Clothes</option>
                <option value="Perfume">Perfume</option>
              </select>
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3);">
            <div class="form-group">
              <label class="form-label">Brand / Label</label>
              <select class="form-select" id="prod-brand">
                <option value="">-- Select Brand --</option>
                ${brands.map(b => `<option value="${b.name}">${b.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" id="group-size">
              <label class="form-label">Size / Volume (Variants)</label>
              <select class="form-select" id="prod-size">
                <option value="S">Small (S)</option>
                <option value="M" selected>Medium (M)</option>
                <option value="L">Large (L)</option>
                <option value="XL">Extra Large (XL)</option>
                <option value="XXL">XXL</option>
                <option value="Unstitched">Unstitched</option>
              </select>
            </div>
          </div>

          <!-- Clothes Specific Attributes -->
          <div id="clothes-attr-group" class="form-row" style="margin-top: var(--space-3);">
            <div class="form-group">
              <label class="form-label">Color / Shade</label>
              <input type="text" class="form-input" id="prod-color" placeholder="e.g. Black / Navy Blue">
            </div>
            <div class="form-group">
              <label class="form-label">Fabric / Material</label>
              <input type="text" class="form-input" id="prod-fabric" placeholder="e.g. Lawn / Chiffon / Cotton">
            </div>
          </div>

          <!-- Perfume Specific Attributes -->
          <div id="perfume-attr-group" class="form-row" style="margin-top: var(--space-3); display:none;">
            <div class="form-group">
              <label class="form-label">Fragrance Type</label>
              <select class="form-select" id="prod-fragrance">
                <option value="Eau de Parfum (EDP)">Eau de Parfum (EDP)</option>
                <option value="Eau de Toilette (EDT)">Eau de Toilette (EDT)</option>
                <option value="Pure Oud / Attar">Pure Oud / Attar</option>
                <option value="Body Spray">Body Spray</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Target Gender</label>
              <select class="form-select" id="prod-gender">
                <option value="Unisex">Unisex</option>
                <option value="Men">Men</option>
                <option value="Women">Women</option>
              </select>
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3);">
            <div class="form-group">
              <label class="form-label">Purchase Price (Cost Rs.) *</label>
              <input type="number" step="0.01" class="form-input" id="prod-cost" placeholder="0.00" required>
            </div>
            <div class="form-group">
              <label class="form-label">Retail Selling Price (Rs.) *</label>
              <input type="number" step="0.01" class="form-input" id="prod-price" placeholder="0.00" required>
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3);">
            <div class="form-group">
              <label class="form-label">Initial Stock Qty *</label>
              <input type="number" class="form-input" id="prod-qty" value="10" min="0" required>
            </div>
            <div class="form-group">
              <label class="form-label">Low Stock Threshold</label>
              <input type="number" class="form-input" id="prod-threshold" value="5" min="1">
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3);">
            <div class="form-group">
              <label class="form-label">Barcode / SKU</label>
              <div class="input-group">
                <input type="text" class="form-input" id="prod-barcode" placeholder="Scan or enter barcode">
                <button type="button" class="btn btn-secondary" onclick="InventoryPage.generateBarcode()">Generate</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Supplier Name</label>
              <input type="text" class="form-input" id="prod-supplier" placeholder="e.g. Al-Karam / Dior Wholesale">
            </div>
          </div>
        </form>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="InventoryPage.saveAddProduct()">Save Product</button>
      `
    });
  },

  generateBarcode() {
    const code = 'GS' + Math.floor(10000000 + Math.random() * 90000000);
    const input = document.getElementById('prod-barcode');
    if (input) input.value = code;
  },

  onModalCategoryChange(cat) {
    const sizeSelect = document.getElementById('prod-size');
    const clothesGroup = document.getElementById('clothes-attr-group');
    const perfumeGroup = document.getElementById('perfume-attr-group');

    if (cat === 'Perfume') {
      sizeSelect.innerHTML = `
        <option value="30ml">30ml Bottle</option>
        <option value="50ml" selected>50ml Bottle</option>
        <option value="100ml">100ml Bottle</option>
        <option value="12ml (Tola)">12ml (Tola Attar)</option>
      `;
      clothesGroup.style.display = 'none';
      perfumeGroup.style.display = 'flex';
    } else {
      sizeSelect.innerHTML = `
        <option value="S">Small (S)</option>
        <option value="M" selected>Medium (M)</option>
        <option value="L">Large (L)</option>
        <option value="XL">Extra Large (XL)</option>
        <option value="XXL">XXL</option>
        <option value="Unstitched">Unstitched</option>
      `;
      clothesGroup.style.display = 'flex';
      perfumeGroup.style.display = 'none';
    }
  },

  async saveAddProduct() {
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value;
    const brand = document.getElementById('prod-brand').value;
    const size = document.getElementById('prod-size').value;
    const color = document.getElementById('prod-color')?.value.trim() || null;
    const fabric = document.getElementById('prod-fabric')?.value.trim() || null;
    const fragrance_type = document.getElementById('prod-fragrance')?.value || null;
    const gender = document.getElementById('prod-gender')?.value || null;

    const purchase_price = parseFloat(document.getElementById('prod-cost').value) || 0;
    const sale_price = parseFloat(document.getElementById('prod-price').value) || 0;
    const quantity = parseInt(document.getElementById('prod-qty').value) || 0;
    const low_stock_threshold = parseInt(document.getElementById('prod-threshold').value) || 5;
    const barcode = document.getElementById('prod-barcode').value.trim();
    const supplier = document.getElementById('prod-supplier').value.trim();

    if (!name) return toast.error('Product Name is required');

    try {
      await window.api.products.add({
        name, category, brand, size, color, fabric, fragrance_type, gender,
        purchase_price, sale_price, quantity, low_stock_threshold, barcode, supplier
      });
      toast.success('Product added successfully!');
      modal.hide();
      this.loadProducts();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save product');
    }
  },

  async openEditModal(id) {
    const product = await window.api.products.get(id);
    if (!product) return;

    modal.show({
      title: 'Edit Product Details',
      size: 'modal-lg',
      bodyHTML: `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Product Name *</label>
            <input type="text" class="form-input" id="edit-prod-name" value="${product.name}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Category *</label>
            <select class="form-select" id="edit-prod-category">
              <option value="Clothes" ${product.category === 'Clothes' ? 'selected' : ''}>Clothes</option>
              <option value="Perfume" ${product.category === 'Perfume' ? 'selected' : ''}>Perfume</option>
            </select>
          </div>
        </div>

        <div class="form-row" style="margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Purchase Price (Cost Rs.) *</label>
            <input type="number" step="0.01" class="form-input" id="edit-prod-cost" value="${product.purchase_price}">
          </div>
          <div class="form-group">
            <label class="form-label">Retail Selling Price (Rs.) *</label>
            <input type="number" step="0.01" class="form-input" id="edit-prod-price" value="${product.sale_price}">
          </div>
        </div>

        <div class="form-row" style="margin-top: var(--space-3);">
          <div class="form-group">
            <label class="form-label">Current Stock Qty *</label>
            <input type="number" class="form-input" id="edit-prod-qty" value="${product.quantity}">
          </div>
          <div class="form-group">
            <label class="form-label">Low Stock Threshold</label>
            <input type="number" class="form-input" id="edit-prod-threshold" value="${product.low_stock_threshold}">
          </div>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="InventoryPage.saveEditProduct(${id})">Save Changes</button>
      `
    });
  },

  async saveEditProduct(id) {
    const name = document.getElementById('edit-prod-name').value.trim();
    const category = document.getElementById('edit-prod-category').value;
    const purchase_price = parseFloat(document.getElementById('edit-prod-cost').value) || 0;
    const sale_price = parseFloat(document.getElementById('edit-prod-price').value) || 0;
    const quantity = parseInt(document.getElementById('edit-prod-qty').value) || 0;
    const low_stock_threshold = parseInt(document.getElementById('edit-prod-threshold').value) || 5;

    try {
      await window.api.products.update(id, { name, category, purchase_price, sale_price, quantity, low_stock_threshold });
      toast.success('Product updated!');
      modal.hide();
      this.loadProducts();
    } catch (err) {
      toast.error('Failed to update product');
    }
  },

  async openStockInModal(id) {
    const product = await window.api.products.get(id);
    if (!product) return;

    modal.show({
      title: `Stock In — ${product.name}`,
      bodyHTML: `
        <div style="font-size:var(--text-sm); margin-bottom: var(--space-3); color: var(--color-text-secondary);">
          Current Stock: <strong style="color:var(--color-accent);">${product.quantity} pcs</strong>
        </div>
        <div class="form-group">
          <label class="form-label">Additional Quantity to Add *</label>
          <input type="number" class="form-input" id="stockin-qty" value="10" min="1" required>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Supplier Reference</label>
          <input type="text" class="form-input" id="stockin-supplier" value="${product.supplier || ''}" placeholder="Supplier name">
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="InventoryPage.saveStockIn(${id})">Add Stock</button>
      `
    });
  },

  async saveStockIn(id) {
    const qty = parseInt(document.getElementById('stockin-qty').value) || 0;
    const supplier = document.getElementById('stockin-supplier').value.trim();
    if (qty <= 0) return toast.error('Quantity must be greater than 0');

    try {
      await window.api.products.stockIn(id, qty, supplier, new Date().toISOString().split('T')[0]);
      toast.success(`Added ${qty} pieces to stock!`);
      modal.hide();
      this.loadProducts();
    } catch (err) {
      toast.error('Failed to add stock');
    }
  },

  confirmDelete(id, name) {
    modal.confirm({
      title: 'Delete Product',
      message: `Are you sure you want to remove "${name}" from inventory?`,
      confirmText: 'Delete',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        try {
          await window.api.products.delete(id);
          toast.success('Product deleted');
          this.loadProducts();
        } catch (err) {
          toast.error('Failed to delete product');
        }
      }
    });
  }
};
