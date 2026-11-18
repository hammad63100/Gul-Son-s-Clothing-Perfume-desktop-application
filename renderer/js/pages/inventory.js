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

  localDate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
            <p class="page-subtitle">Clothes, Hosiery &amp; Perfumes — complete catalog &amp; stock management</p>
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
            <option value="Hosiery">Hosiery</option>
            <option value="Perfume">Perfume</option>
            <option value="Empty Bottle">Empty Bottle</option>
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
        if (p.fabric) variantText.push(`Fabric: ${p.fabric}`);
        if (p.fragrance_type) variantText.push(`Type: ${p.fragrance_type}`);
        if (p.gender) variantText.push(`Gender: ${p.gender}`);

        const unit = formatters.getProductUnit(p);
        return `
          <tr>
            <td style="font-weight:600; color:var(--color-text-primary);">${p.name}</td>
            <td><span class="badge ${p.category === 'Clothes' ? 'badge-clothes' : (p.category === 'Hosiery' ? 'badge-hosiery' : 'badge-perfume')}">${p.category}</span></td>
            <td>${p.brand ? `<span class="badge badge-gold">${p.brand}</span>` : '-'}</td>
            <td style="font-size:var(--text-xs); color:var(--color-text-secondary);">${variantText.length > 0 ? variantText.join(' • ') : '-'}</td>
            <td style="font-family:monospace; font-size:var(--text-xs);">${p.sku || p.barcode || '-'}</td>
            <td>${formatters.currency(p.purchase_price, curr)}</td>
            <td style="font-weight:600; color:var(--color-accent);">${formatters.currency(p.sale_price, curr)}</td>
            <td>
              <span class="badge ${isOut ? 'badge-danger' : (isLow ? 'badge-warning' : 'badge-success')}">
                ${isOut ? `OUT OF STOCK (0 ${unit})` : `${p.quantity} ${unit}`}
              </span>
            </td>
            <td>
              <div class="flex gap-2">
                <button class="btn btn-secondary btn-sm" onclick="InventoryPage.openStockInModal(${p.id})">+ Stock</button>
                ${(p.fragrance_type || '').trim().toLowerCase() === 'attar' ? `<button class="btn btn-primary btn-sm" onclick="InventoryPage.openCustomSaleModal(${p.id})">Custom Sale</button>` : ''}
                <button class="btn btn-warning btn-sm" onclick="InventoryPage.openReturnToSupplierModal(${p.id})">↩ Return</button>
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
    const brands = await window.api.master.getBrands('Clothes');
    const fragranceTypes = await this.getFragranceTypes();

    modal.show({
      title: 'Add New Product (Clothes / Hosiery / Perfume / Empty Bottle)',
      size: 'modal-lg',
      bodyHTML: `
        <form id="form-add-product">
          <div class="form-row" style="display:grid; grid-template-columns: 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Main Category *</label>
              <select class="form-select" id="prod-category" onchange="InventoryPage.onModalCategoryChange(this.value)">
                <option value="Clothes">Clothes</option>
                <option value="Hosiery">Hosiery</option>
                <option value="Perfume">Perfume</option>
                <option value="Empty Bottle">Empty Bottle</option>
              </select>
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3); display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Brand / Label</label>
              <div style="position:relative;" id="brand-dropdown-wrapper">
                <div class="form-input" id="custom-brand-display" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="InventoryPage.toggleBrandDropdown()">
                  <span id="custom-brand-text">-- Select Brand --</span>
                  <span style="font-size:0.8em; color:var(--color-text-secondary);">▼</span>
                </div>
                <input type="hidden" id="prod-brand" value="">
                
                <div id="custom-brand-dropdown" style="display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; background:var(--color-bg-primary); border:1px solid var(--color-border); border-radius:var(--radius-md); z-index:100; max-height:200px; overflow-y:auto; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                  <div style="padding:0.5rem 0.75rem; cursor:pointer;" onclick="InventoryPage.selectBrand('', '-- Select Brand --')" onmouseover="this.style.background='var(--color-bg-secondary)'" onmouseout="this.style.background=''">-- Select Brand --</div>
                  ${brands.map(b => `
                    <div style="padding:0.25rem 0.75rem; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border-light);" onmouseover="this.style.background='var(--color-bg-secondary)'" onmouseout="this.style.background=''">
                      <span style="flex:1; cursor:pointer; padding:0.25rem 0;" onclick="InventoryPage.selectBrand('${b.name}', '${b.name.replace(/'/g, "\\'")}')">${b.name}</span>
                      <button type="button" class="btn btn-ghost btn-icon" style="color:var(--color-danger); padding:0.25rem; height:auto; min-height:auto;" onclick="InventoryPage.deleteBrandInline(${b.id}, '${b.name.replace(/'/g, "\\'")}', event)">✖</button>
                    </div>
                  `).join('')}
                  <div style="padding:0.5rem 0.75rem; cursor:pointer; font-weight:bold; color:var(--color-primary);" onclick="InventoryPage.selectBrand('ADD_NEW_BRAND', '')" onmouseover="this.style.background='var(--color-bg-secondary)'" onmouseout="this.style.background=''">+ Add Your Brand</div>
                </div>
              </div>
            </div>
            <div class="form-group" id="group-size">
              <label class="form-label" id="prod-size-label">Measurement / Size</label>
              <div id="prod-size-unit-wrapper" style="position:relative; width:100%;">
                <select class="form-select" id="prod-size-unit" onchange="InventoryPage.onSizeUnitChange(this.value, 'prod')" style="width:100%;">
                  ${this.getSizeOptionsHTML('Clothes')}
                </select>
              </div>
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3); display:grid; grid-template-columns: 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Product Name *</label>
              <input type="text" class="form-input" id="prod-name" placeholder="e.g., Cotton Embroidered Kurti / Oud Royal 100ml" required>
            </div>
          </div>

          <div id="perfume-attr-group" class="form-row" style="margin-top: var(--space-3); display:none; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Perfume Type</label>
              <div id="prod-fragrance-wrapper" style="position:relative; width:100%;">
                <select class="form-select" id="prod-fragrance" onchange="InventoryPage.onFragranceTypeChange(this.value, 'prod')" style="width:100%;">
                  ${this.getFragranceTypeOptionsHTML(fragranceTypes)}
                </select>
              </div>
            </div>
            <div class="form-group" id="prod-gender-group">
              <label class="form-label">Target Gender</label>
              <select class="form-select" id="prod-gender">
                <option value="Men">Men</option>
                <option value="Women">Women</option>
                <option value="Unisex">Unisex</option>
              </select>
            </div>
          </div>

          <div id="prod-measurement-group" class="form-row" style="margin-top: var(--space-3); display:none; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Measurement (number) *</label>
              <input type="number" step="any" min="0.01" class="form-input" id="prod-measurement">
            </div>
            <div class="form-group">
              <label class="form-label">Size</label>
              <input type="text" class="form-input" value="ml" readonly>
            </div>
          </div>

          <!-- Clothes Specific Attributes -->
          <div id="clothes-attr-group" class="form-row" style="margin-top: var(--space-3); display:grid; grid-template-columns: 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Fabric / Material</label>
              <input type="text" class="form-input" id="prod-fabric" placeholder="e.g. Lawn / Chiffon / Cotton">
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3); display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Purchase Price (Cost Rs.) *</label>
              <input type="number" step="0.01" class="form-input" id="prod-cost" placeholder="0.00" required>
            </div>
            <div class="form-group">
              <label class="form-label">Retail Selling Price (Rs.) *</label>
              <input type="number" step="0.01" class="form-input" id="prod-price" placeholder="0.00" required>
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3); display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label" id="prod-qty-label">Initial Stock Qty *</label>
              <input type="number" step="any" class="form-input" id="prod-qty" value="10" min="0" required>
              <small class="form-helper" id="prod-qty-helper" style="display:none; color:var(--color-text-secondary); font-size:var(--text-xs); margin-top:2px;"></small>
            </div>
            <div class="form-group">
              <label class="form-label" id="prod-threshold-label">Low Stock Threshold</label>
              <input type="number" class="form-input" id="prod-threshold" value="5" min="1">
              <small class="form-helper" id="prod-threshold-helper" style="display:none; color:var(--color-text-secondary); font-size:var(--text-xs); margin-top:2px;"></small>
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3); display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
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

  getDefaultSizes(category) {
    if (category === 'Perfume') {
      return [
        'ml (ملی لیٹر)',
        'Bottle (بوتل)',
        'Tola / Attar (تولہ)',
        'Fl. oz',
        'Tester Spray'
      ];
    }
    if (category === 'Hosiery') {
      return [
        'S',
        'M',
        'L',
        'XL',
        'XXL',
        '36',
        '38',
        '40',
        '42',
        '44',
        '1-2 Years',
        '3-4 Years',
        '22',
        '24',
        '26',
        'Free Size',
        'Standard Size',
        'Piece (Pc)',
        'Pack of 3',
        'Pack of 6',
        'Dozen (12 Pcs)'
      ];
    }
    return [
      'Meter (میٹر)',
      'Yard ya Gazz (گز)',
      'Gira (گرہ)',
      'Arz / Bahr (عرض / دامن)',
      'Suit (سوٹ)',
      'Pcs (تھان / پیس)',
      'Standard Size'
    ];
  },

  getGarmentSizesHTML(selectedVal = '') {
    const sizes = [
      { group: 'Alphabetical', options: ['S', 'M', 'L', 'XL', 'XXL'] },
      { group: 'Chest / Waist (inches)', options: ['36', '38', '40', '42', '44'] },
      { group: 'Kids Sizes', options: ['1-2 Years', '3-4 Years', '22', '24', '26'] }
    ];
    let html = `<option value=""${!selectedVal ? ' selected' : ''}>-- Select Garment Size --</option>`;
    for (const g of sizes) {
      html += `<optgroup label="${g.group}">`;
      for (const opt of g.options) {
        html += `<option value="${opt}"${opt === selectedVal ? ' selected' : ''}>${opt}</option>`;
      }
      html += '</optgroup>';
    }
    return html;
  },

  getCustomSizes(category) {
    const key = `custom_sizes_${category.toLowerCase()}`;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  saveCustomSizes(category, sizes) {
    const key = `custom_sizes_${category.toLowerCase()}`;
    try {
      localStorage.setItem(key, JSON.stringify(sizes));
    } catch (e) {
      console.error(e);
    }
  },

  getAllSizes(category) {
    const defaults = this.getDefaultSizes(category);
    const custom = this.getCustomSizes(category);
    return [...defaults, ...custom];
  },

  getSizeOptionsHTML(category, selectedVal = '') {
    const all = this.getAllSizes(category);
    if (selectedVal && !all.includes(selectedVal) && selectedVal !== 'ADD_NEW_SIZE') {
      all.push(selectedVal);
    }
    let defaultVal = selectedVal;
    if (!defaultVal) {
      if (category === 'Perfume') defaultVal = 'ml (ملی لیٹر)';
      else if (category === 'Hosiery') defaultVal = 'L';
      else defaultVal = 'Meter (میٹر)';
    }
    
    let html = all.map(s => `<option value="${s}" ${s === defaultVal ? 'selected' : ''}>${s}</option>`).join('');
    html += `<option value="ADD_NEW_SIZE" style="font-weight:bold; color:var(--color-primary);">➕ Add Your Own Size...</option>`;
    return html;
  },

  onSizeUnitChange(value, prefix) {
    if (value === 'ADD_NEW_SIZE') {
      const wrapper = document.getElementById(`${prefix}-size-unit-wrapper`);
      if (!wrapper) return;
      
      const prevVal = wrapper.dataset.prevVal || '';
      
      wrapper.innerHTML = `
        <div class="input-group" id="${prefix}-new-size-group" style="display:flex; width:100%;">
          <input type="text" class="form-input" id="${prefix}-new-size-input" placeholder="New size / unit name..." style="flex:1; font-size:12px; height:36px; padding:0 8px;">
          <button type="button" class="btn btn-primary btn-sm" id="${prefix}-new-size-save" style="padding:0 10px; height:36px;">OK</button>
          <button type="button" class="btn btn-secondary btn-sm" id="${prefix}-new-size-cancel" style="padding:0 8px; height:36px;">✖</button>
        </div>
      `;
      
      const input = document.getElementById(`${prefix}-new-size-input`);
      input?.focus();
      
      const categorySelect = document.getElementById(prefix === 'prod' ? 'prod-category' : 'edit-prod-category');
      const category = categorySelect ? categorySelect.value : 'Clothes';
      
      const finish = (isSave) => {
        let chosen = prevVal;
        if (isSave) {
          const newSize = input.value.trim();
          if (newSize) {
            const custom = this.getCustomSizes(category);
            if (!custom.includes(newSize) && !this.getDefaultSizes(category).includes(newSize)) {
              custom.push(newSize);
              this.saveCustomSizes(category, custom);
              toast.success(`Size "${newSize}" added to ${category}!`);
            }
            chosen = newSize;
          }
        }
        
        wrapper.innerHTML = `
          <select class="form-select" id="${prefix}-size-unit" onchange="InventoryPage.onSizeUnitChange(this.value, '${prefix}')" style="width:100%;">
            ${this.getSizeOptionsHTML(category, chosen)}
          </select>
        `;
        wrapper.dataset.prevVal = chosen;
      };
      
      document.getElementById(`${prefix}-new-size-save`).onclick = () => finish(true);
      document.getElementById(`${prefix}-new-size-cancel`).onclick = () => finish(false);
      input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { finish(false); }
      };
    } else {
      const wrapper = document.getElementById(`${prefix}-size-unit-wrapper`);
      if (wrapper) wrapper.dataset.prevVal = value;
    }
  },

  async getFragranceTypes() {
    try {
      const types = await window.api.master.getFragranceTypes();
      if (types && types.length > 0) return types;
    } catch (e) {
      console.error(e);
    }
    return [
      { id: 1, name: 'Body spray' },
      { id: 2, name: 'Attar' },
      { id: 3, name: 'Normal Spray' }
    ];
  },

  getFragranceTypeOptionsHTML(types, selectedVal = '') {
    const rawList = (types || []).map(t => typeof t === 'string' ? t : t.name);
    const uniqueMap = new Map();
    for (const item of rawList) {
      if (item && item.trim()) {
        const key = item.trim().toLowerCase();
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item.trim());
        }
      }
    }
    if (selectedVal && selectedVal !== 'ADD_NEW_FRAGRANCE_TYPE') {
      const key = selectedVal.trim().toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, selectedVal.trim());
      }
    }
    const list = Array.from(uniqueMap.values());
    const defaultVal = selectedVal ? selectedVal.trim() : (list.length > 0 ? list[0] : 'Body spray');
    let html = list.map(t => `<option value="${t}" ${t.toLowerCase() === defaultVal.toLowerCase() ? 'selected' : ''}>${t}</option>`).join('');
    html += `<option value="ADD_NEW_FRAGRANCE_TYPE" style="font-weight:bold; color:var(--color-primary);">➕ Add Your Perfume Type...</option>`;
    return html;
  },

  async onFragranceTypeChange(value, prefix) {
    if (value === 'ADD_NEW_FRAGRANCE_TYPE') {
      const wrapper = document.getElementById(`${prefix}-fragrance-wrapper`);
      if (!wrapper) return;

      const prevVal = wrapper.dataset.prevVal || '';

      wrapper.innerHTML = `
        <div class="input-group" id="${prefix}-new-fragrance-group" style="display:flex; width:100%;">
          <input type="text" class="form-input" id="${prefix}-new-fragrance-input" placeholder="New perfume type name..." style="flex:1; font-size:12px; height:36px; padding:0 8px;">
          <button type="button" class="btn btn-primary btn-sm" id="${prefix}-new-fragrance-save" style="padding:0 10px; height:36px;">OK</button>
          <button type="button" class="btn btn-secondary btn-sm" id="${prefix}-new-fragrance-cancel" style="padding:0 8px; height:36px;">✖</button>
        </div>
      `;

      const input = document.getElementById(`${prefix}-new-fragrance-input`);
      input?.focus();

      const finish = async (isSave) => {
        let chosen = prevVal;
        if (isSave) {
          const newType = input.value.trim();
          if (newType) {
            try {
              await window.api.master.addFragranceType(newType);
              toast.success(`Perfume Type "${newType}" added!`);
              chosen = newType;
            } catch (err) {
              console.error(err);
              toast.error('Failed to add perfume type');
            }
          }
        }

        const types = await this.getFragranceTypes();
        wrapper.innerHTML = `
          <select class="form-select" id="${prefix}-fragrance" onchange="InventoryPage.onFragranceTypeChange(this.value, '${prefix}')" style="width:100%;">
            ${this.getFragranceTypeOptionsHTML(types, chosen)}
          </select>
        `;
        wrapper.dataset.prevVal = chosen;
        this.updateEmptyBottleFields(prefix, chosen);
      };

      document.getElementById(`${prefix}-new-fragrance-save`).onclick = () => finish(true);
      document.getElementById(`${prefix}-new-fragrance-cancel`).onclick = () => finish(false);
      input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { finish(false); }
      };
    } else {
      const wrapper = document.getElementById(`${prefix}-fragrance-wrapper`);
      if (wrapper) wrapper.dataset.prevVal = value;
      this.updateEmptyBottleFields(prefix, value);
    }
  },

  updateEmptyBottleFields(prefix, fragranceType) {
    const categoryId = prefix === 'prod' ? 'prod-category' : 'edit-prod-category';
    const category = document.getElementById(categoryId)?.value;
    const isEmptyBottle = category === 'Empty Bottle' ||
      (category === 'Perfume' && String(fragranceType || '').trim().toLowerCase() === 'empty bottle');
    const measurementGroup = document.getElementById(`${prefix}-measurement-group`);
    const measurementInput = document.getElementById(`${prefix}-measurement`);
    const sizeGroup = document.getElementById(prefix === 'prod' ? 'group-size' : 'edit-group-size');
    const genderGroup = document.getElementById(`${prefix}-gender-group`);
    const quantityLabel = document.getElementById(prefix === 'prod' ? 'prod-qty-label' : 'edit-qty-label');
    const thresholdLabel = document.getElementById(prefix === 'prod' ? 'prod-threshold-label' : 'edit-threshold-label');
    const quantityInput = document.getElementById(prefix === 'prod' ? 'prod-qty' : 'edit-prod-qty');
    const thresholdInput = document.getElementById(prefix === 'prod' ? 'prod-threshold' : 'edit-prod-threshold');

    if (measurementGroup) measurementGroup.style.display = isEmptyBottle ? 'grid' : 'none';
    if (measurementInput) measurementInput.required = isEmptyBottle;
    if (sizeGroup) sizeGroup.style.display = isEmptyBottle ? 'none' : '';
    if (genderGroup) genderGroup.style.display = isEmptyBottle ? 'none' : '';
    if (quantityLabel) quantityLabel.textContent = isEmptyBottle
      ? `${prefix === 'prod' ? 'Initial' : 'Current'} Stock Qty (Bottles) *`
      : `${prefix === 'prod' ? 'Initial' : 'Current'} Stock Qty *`;
    if (thresholdLabel) thresholdLabel.textContent = isEmptyBottle
      ? 'Low Stock Threshold (Bottles)'
      : 'Low Stock Threshold';
    if (quantityInput) quantityInput.step = isEmptyBottle ? '1' : 'any';
    if (thresholdInput) thresholdInput.step = isEmptyBottle ? '1' : 'any';
  },

  toggleBrandDropdown() {
    const dropdown = document.getElementById('custom-brand-dropdown');
    if (dropdown) {
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
  },

  async selectBrand(value, text) {
    const dropdown = document.getElementById('custom-brand-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    
    if (value === 'ADD_NEW_BRAND') {
      const wrapper = document.getElementById('brand-dropdown-wrapper');
      const display = document.getElementById('custom-brand-display');
      display.style.display = 'none';
      
      const currentCat = document.getElementById('prod-category')?.value || 'Clothes';
      const brandCategory = currentCat === 'Empty Bottle' ? 'Perfume' : currentCat;
      const inputContainer = document.createElement('div');
      inputContainer.className = 'input-group';
      inputContainer.innerHTML = `
        <input type="text" class="form-input" id="new-brand-input" placeholder="New ${currentCat} brand name" style="flex:1;">
        <button type="button" class="btn btn-primary" id="new-brand-save">OK</button>
        <button type="button" class="btn btn-secondary" id="new-brand-cancel">X</button>
      `;
      wrapper.appendChild(inputContainer);
      
      const input = document.getElementById('new-brand-input');
      input.focus();
      
      const finishSetup = async (isSave) => {
        if (isSave) {
          const newBrand = input.value.trim();
          if (newBrand) {
            try {
              await window.api.master.addBrand(newBrand, brandCategory);
              toast.success(`Brand "${newBrand}" added to ${currentCat}!`);
              await InventoryPage.refreshBrandsDropdown(newBrand, currentCat);
            } catch (err) {
              console.error(err);
              toast.error('Failed to add brand');
            }
          }
        }
        inputContainer.remove();
        display.style.display = 'flex';
      };

      document.getElementById('new-brand-save').onclick = () => finishSetup(true);
      document.getElementById('new-brand-cancel').onclick = () => finishSetup(false);
      input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finishSetup(true); } 
        else if (e.key === 'Escape') finishSetup(false);
      };
      return;
    }

    document.getElementById('prod-brand').value = value;
    document.getElementById('custom-brand-text').textContent = text;
  },

  async deleteBrandInline(id, name, event) {
    event.stopPropagation();
    try {
      await window.api.master.deleteBrand(id);
      toast.success('Brand "' + name + '" deleted');
      
      const hiddenInput = document.getElementById('prod-brand');
      if (hiddenInput && hiddenInput.value === name) {
        hiddenInput.value = '';
        document.getElementById('custom-brand-text').textContent = '-- Select Brand --';
      }
      const currentCat = document.getElementById('prod-category')?.value || 'Clothes';
      await InventoryPage.refreshBrandsDropdown(hiddenInput ? hiddenInput.value : '', currentCat);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete brand');
    }
  },

  async refreshBrandsDropdown(selectedValue, category) {
    const cat = category || document.getElementById('prod-category')?.value || 'Clothes';
    const brandCategory = cat === 'Empty Bottle' ? 'Perfume' : cat;
    const brands = await window.api.master.getBrands(brandCategory);
    const dropdown = document.getElementById('custom-brand-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = `
      <div style="padding:0.5rem 0.75rem; cursor:pointer;" onclick="InventoryPage.selectBrand('', '-- Select Brand --')" onmouseover="this.style.background='var(--color-bg-secondary)'" onmouseout="this.style.background=''">-- Select Brand --</div>
      ${brands.map(b => `
        <div style="padding:0.25rem 0.75rem; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--color-border-light);" onmouseover="this.style.background='var(--color-bg-secondary)'" onmouseout="this.style.background=''">
          <span style="flex:1; cursor:pointer; padding:0.25rem 0;" onclick="InventoryPage.selectBrand('${b.name}', '${b.name.replace(/'/g, "\\'")}')">${b.name}</span>
          <button type="button" class="btn btn-ghost btn-icon" style="color:var(--color-danger); padding:0.25rem; height:auto; min-height:auto;" onclick="InventoryPage.deleteBrandInline(${b.id}, '${b.name.replace(/'/g, "\\'")}', event)">✖</button>
        </div>
      `).join('')}
      <div style="padding:0.5rem 0.75rem; cursor:pointer; font-weight:bold; color:var(--color-primary);" onclick="InventoryPage.selectBrand('ADD_NEW_BRAND', '')" onmouseover="this.style.background='var(--color-bg-secondary)'" onmouseout="this.style.background=''">+ Add ${cat} Brand</div>
    `;
    if (selectedValue && selectedValue !== 'ADD_NEW_BRAND') {
      document.getElementById('prod-brand').value = selectedValue;
      document.getElementById('custom-brand-text').textContent = selectedValue;
    } else {
      document.getElementById('prod-brand').value = '';
      document.getElementById('custom-brand-text').textContent = '-- Select Brand --';
    }
  },

  onModalCategoryChange(cat) {
    // Automatically filter brands list to only show brands for the selected category
    this.refreshBrandsDropdown('', cat);
    const nameInput = document.getElementById('prod-name');
    const sizeLabel = document.getElementById('prod-size-label');
    const wrapper = document.getElementById('prod-size-unit-wrapper');
    const clothesGroup = document.getElementById('clothes-attr-group');
    const perfumeGroup = document.getElementById('perfume-attr-group');
    const fabricInput = document.getElementById('prod-fabric');
    const supplierInput = document.getElementById('prod-supplier');
    const qtyHelper = document.getElementById('prod-qty-helper');
    const thresholdHelper = document.getElementById('prod-threshold-helper');

    if (cat === 'Hosiery') {
      if (nameInput) nameInput.placeholder = "e.g., Men's Cotton Banyan / White School Socks / Casual T-Shirt";
      if (sizeLabel) sizeLabel.textContent = 'Garment Size';
      if (wrapper) {
        wrapper.innerHTML = `
          <select class="form-select" id="prod-size-unit" onchange="InventoryPage.onSizeUnitChange(this.value, 'prod')" style="width:100%;">
            ${this.getSizeOptionsHTML('Hosiery')}
          </select>
        `;
      }
      if (clothesGroup) clothesGroup.style.display = 'grid';
      if (perfumeGroup) perfumeGroup.style.display = 'none';
      if (fabricInput) fabricInput.placeholder = 'e.g., Single Jersey Cotton, Interlock, Fleece, Lycra, Pique';
      if (supplierInput) supplierInput.placeholder = 'e.g., Lucky Textile / Sahar Hosiery';
      if (qtyHelper) { qtyHelper.textContent = 'Total Pieces / Packs'; qtyHelper.style.display = 'block'; }
      if (thresholdHelper) { thresholdHelper.textContent = 'Pieces / Packs count'; thresholdHelper.style.display = 'block'; }
    } else if (cat === 'Empty Bottle') {
      if (nameInput) nameInput.placeholder = 'e.g., Empty Perfume Bottle 100ml';
      if (sizeLabel) sizeLabel.textContent = 'Measurement / Size';
      if (wrapper) {
        wrapper.innerHTML = `
          <select class="form-select" id="prod-size-unit" onchange="InventoryPage.onSizeUnitChange(this.value, 'prod')" style="width:100%;">
            ${this.getSizeOptionsHTML('Perfume')}
          </select>
        `;
      }
      if (clothesGroup) clothesGroup.style.display = 'none';
      if (perfumeGroup) perfumeGroup.style.display = 'none';
      if (supplierInput) supplierInput.placeholder = 'e.g., Empty bottle supplier';
      if (qtyHelper) qtyHelper.style.display = 'none';
      if (thresholdHelper) thresholdHelper.style.display = 'none';
    } else if (cat === 'Perfume') {
      if (nameInput) nameInput.placeholder = 'e.g., Oud Royal 100ml / Lattafa Raghba';
      if (sizeLabel) sizeLabel.textContent = 'Measurement / Size';
      if (wrapper) {
        wrapper.innerHTML = `
          <select class="form-select" id="prod-size-unit" onchange="InventoryPage.onSizeUnitChange(this.value, 'prod')" style="width:100%;">
            ${this.getSizeOptionsHTML('Perfume')}
          </select>
        `;
      }
      if (clothesGroup) clothesGroup.style.display = 'none';
      if (perfumeGroup) perfumeGroup.style.display = 'grid';
      if (supplierInput) supplierInput.placeholder = 'e.g., Al-Karam / Dior Wholesale';
      if (qtyHelper) qtyHelper.style.display = 'none';
      if (thresholdHelper) thresholdHelper.style.display = 'none';
    } else {
      // Clothes (default)
      if (nameInput) nameInput.placeholder = 'e.g., Cotton Embroidered Kurti / Lawn Unstitched 3pc';
      if (sizeLabel) sizeLabel.textContent = 'Measurement / Size';
      if (wrapper) {
        wrapper.innerHTML = `
          <select class="form-select" id="prod-size-unit" onchange="InventoryPage.onSizeUnitChange(this.value, 'prod')" style="width:100%;">
            ${this.getSizeOptionsHTML('Clothes')}
          </select>
        `;
      }
      if (clothesGroup) clothesGroup.style.display = 'grid';
      if (perfumeGroup) perfumeGroup.style.display = 'none';
      if (fabricInput) fabricInput.placeholder = 'e.g., Lawn / Chiffon / Cotton';
      if (supplierInput) supplierInput.placeholder = 'e.g., Al-Karam / Dior Wholesale';
      if (qtyHelper) qtyHelper.style.display = 'none';
      if (thresholdHelper) thresholdHelper.style.display = 'none';
    }
    this.updateEmptyBottleFields('prod', document.getElementById('prod-fragrance')?.value);
  },

  async saveAddProduct() {
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value;
    const brand = document.getElementById('prod-brand').value;

    // Compose size based on category
    let size = null;
    const sizeUnitSelect = document.getElementById('prod-size-unit');
    const sizeUnitInput = document.getElementById('prod-new-size-input');
    size = sizeUnitSelect ? (sizeUnitSelect.value !== 'ADD_NEW_SIZE' ? sizeUnitSelect.value : '') : (sizeUnitInput?.value.trim() || '');
    if (!size && category === 'Hosiery') size = 'Standard Size';

    const color = null;
    const fabric = document.getElementById('prod-fabric')?.value.trim() || null;
    let fragrance_type = null;
    if (category === 'Perfume') {
      const fragSelect = document.getElementById('prod-fragrance');
      const fragInput = document.getElementById('prod-new-fragrance-input');
      fragrance_type = fragSelect ? (fragSelect.value !== 'ADD_NEW_FRAGRANCE_TYPE' ? fragSelect.value : '') : (fragInput?.value.trim() || null);
      if (!fragrance_type) fragrance_type = null;
    }
    const isEmptyBottle = category === 'Empty Bottle' ||
      (category === 'Perfume' && String(fragrance_type || '').trim().toLowerCase() === 'empty bottle');
    const measurement_ml = isEmptyBottle ? Number(document.getElementById('prod-measurement').value) : null;
    if (isEmptyBottle && (!Number.isFinite(measurement_ml) || measurement_ml <= 0)) {
      return toast.error('Measurement must be greater than 0 ml');
    }
    if (isEmptyBottle) size = `${measurement_ml} ml`;
    const gender = category === 'Perfume' && !isEmptyBottle ? (document.getElementById('prod-gender')?.value || null) : null;

    const purchase_price = parseFloat(document.getElementById('prod-cost').value) || 0;
    const sale_price = parseFloat(document.getElementById('prod-price').value) || 0;
    const quantity = parseFloat(document.getElementById('prod-qty').value) || 0;
    const low_stock_threshold = isEmptyBottle
      ? Number(document.getElementById('prod-threshold').value)
      : (parseInt(document.getElementById('prod-threshold').value) || 5);
    const barcode = document.getElementById('prod-barcode').value.trim();
    const supplier = document.getElementById('prod-supplier').value.trim();
    const isAttar = String(fragrance_type || '').trim().toLowerCase() === 'attar';
    const retail_quantity = 1;

    if (!name) return toast.error('Product Name is required');
    if (isEmptyBottle && (!Number.isInteger(quantity) || !Number.isInteger(low_stock_threshold))) {
      return toast.error('Empty bottle stock and low-stock threshold must be whole numbers');
    }

    try {
      await window.api.products.add({
        name, category, brand, size, color, fabric, fragrance_type, gender,
        measurement_ml, purchase_price, sale_price, quantity,
        inventory_unit: isEmptyBottle ? 'Bottles' : (isAttar ? 'ml' : 'pcs'),
        retail_quantity, low_stock_threshold, barcode, supplier
      });
      toast.success('Product added successfully!');
      modal.hide();
      this.loadProducts();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to save product');
    }
  },

  async onEditModalCategoryChange(cat) {
    const datalist = document.getElementById('edit-brand-datalist');
    if (datalist) {
      try {
        const brands = await window.api.master.getBrands(cat === 'Empty Bottle' ? 'Perfume' : cat);
        datalist.innerHTML = brands.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
      } catch (e) {}
    }
    const nameInput = document.getElementById('edit-prod-name');
    const sizeLabel = document.getElementById('edit-size-label');
    const wrapper = document.getElementById('edit-size-unit-wrapper');
    const clothesGroup = document.getElementById('edit-clothes-attr-group');
    const perfumeGroup = document.getElementById('edit-perfume-attr-group');
    const fabricInput = document.getElementById('edit-prod-fabric');
    const supplierInput = document.getElementById('edit-prod-supplier');
    const qtyHelper = document.getElementById('edit-qty-helper');
    const thresholdHelper = document.getElementById('edit-threshold-helper');

    if (cat === 'Hosiery') {
      if (nameInput) nameInput.placeholder = "e.g., Men's Cotton Banyan / White School Socks / Casual T-Shirt";
      if (sizeLabel) sizeLabel.textContent = 'Garment Size';
      if (wrapper) {
        wrapper.innerHTML = `
          <select class="form-select" id="edit-prod-size-unit" onchange="InventoryPage.onSizeUnitChange(this.value, 'edit')" style="width:100%;">
            ${this.getSizeOptionsHTML('Hosiery')}
          </select>
        `;
      }
      if (clothesGroup) clothesGroup.style.display = 'grid';
      if (perfumeGroup) perfumeGroup.style.display = 'none';
      if (fabricInput) fabricInput.placeholder = 'e.g., Single Jersey Cotton, Interlock, Fleece, Lycra, Pique';
      if (supplierInput) supplierInput.placeholder = 'e.g., Lucky Textile / Sahar Hosiery';
      if (qtyHelper) { qtyHelper.textContent = 'Total Pieces / Packs'; qtyHelper.style.display = 'block'; }
      if (thresholdHelper) { thresholdHelper.textContent = 'Pieces / Packs count'; thresholdHelper.style.display = 'block'; }
    } else if (cat === 'Empty Bottle') {
      if (nameInput) nameInput.placeholder = 'e.g., Empty Perfume Bottle 100ml';
      if (sizeLabel) sizeLabel.textContent = 'Measurement / Size';
      if (wrapper) {
        wrapper.innerHTML = `
          <select class="form-select" id="edit-prod-size-unit" onchange="InventoryPage.onSizeUnitChange(this.value, 'edit')" style="width:100%;">
            ${this.getSizeOptionsHTML('Perfume')}
          </select>
        `;
      }
      if (clothesGroup) clothesGroup.style.display = 'none';
      if (perfumeGroup) perfumeGroup.style.display = 'none';
      if (supplierInput) supplierInput.placeholder = 'e.g., Empty bottle supplier';
      if (qtyHelper) qtyHelper.style.display = 'none';
      if (thresholdHelper) thresholdHelper.style.display = 'none';
    } else if (cat === 'Perfume') {
      if (nameInput) nameInput.placeholder = 'e.g., Oud Royal 100ml / Lattafa Raghba';
      if (sizeLabel) sizeLabel.textContent = 'Measurement / Size';
      if (wrapper) {
        wrapper.innerHTML = `
          <select class="form-select" id="edit-prod-size-unit" onchange="InventoryPage.onSizeUnitChange(this.value, 'edit')" style="width:100%;">
            ${this.getSizeOptionsHTML('Perfume')}
          </select>
        `;
      }
      if (clothesGroup) clothesGroup.style.display = 'none';
      if (perfumeGroup) perfumeGroup.style.display = 'grid';
      if (supplierInput) supplierInput.placeholder = 'e.g., Al-Karam / Dior Wholesale';
      if (qtyHelper) qtyHelper.style.display = 'none';
      if (thresholdHelper) thresholdHelper.style.display = 'none';
    } else {
      if (nameInput) nameInput.placeholder = 'e.g., Cotton Embroidered Kurti / Lawn Unstitched 3pc';
      if (sizeLabel) sizeLabel.textContent = 'Measurement / Size';
      if (wrapper) {
        wrapper.innerHTML = `
          <select class="form-select" id="edit-prod-size-unit" onchange="InventoryPage.onSizeUnitChange(this.value, 'edit')" style="width:100%;">
            ${this.getSizeOptionsHTML('Clothes')}
          </select>
        `;
      }
      if (clothesGroup) clothesGroup.style.display = 'grid';
      if (perfumeGroup) perfumeGroup.style.display = 'none';
      if (fabricInput) fabricInput.placeholder = 'e.g., Lawn / Chiffon / Cotton';
      if (supplierInput) supplierInput.placeholder = 'e.g., Al-Karam / Dior Wholesale';
      if (qtyHelper) qtyHelper.style.display = 'none';
      if (thresholdHelper) thresholdHelper.style.display = 'none';
    }
    this.updateEmptyBottleFields('edit', document.getElementById('edit-prod-fragrance')?.value);
  },

  async openEditModal(id) {
    const product = await window.api.products.get(id);
    if (!product) return;
    const fragranceTypes = await this.getFragranceTypes();
    const categoryBrands = await window.api.master.getBrands(product.category === 'Empty Bottle' ? 'Perfume' : (product.category || 'Clothes'));

    const isPerfume = product.category === 'Perfume';
    const isHosiery = product.category === 'Hosiery';
    const isEmptyBottle = product.category === 'Empty Bottle' ||
      (isPerfume && String(product.fragrance_type || '').trim().toLowerCase() === 'empty bottle');
    const storedMeasurement = Number(product.measurement_ml) > 0
      ? Number(product.measurement_ml)
      : (Number(String(product.size || '').match(/[\d.]+/)?.[0]) || '');

    const currentSize = product.size || (isPerfume ? 'ml (ملی لیٹر)' : (isHosiery ? 'L' : 'Meter (میٹر)'));

    const namePlaceholder = isHosiery
      ? "e.g., Men's Cotton Banyan / White School Socks / Casual T-Shirt"
      : (isPerfume ? 'e.g., Oud Royal 100ml / Lattafa Raghba' : 'e.g., Cotton Embroidered Kurti / Lawn Unstitched 3pc');
    const fabricPlaceholder = isHosiery
      ? 'e.g., Single Jersey Cotton, Interlock, Fleece, Lycra, Pique'
      : 'e.g., Lawn / Chiffon / Cotton';
    const supplierPlaceholder = isHosiery
      ? 'e.g., Lucky Textile / Sahar Hosiery'
      : 'e.g., Al-Karam / Dior Wholesale';

    modal.show({
      title: 'Edit Product Details',
      size: 'modal-lg',
      bodyHTML: `
        <form id="form-edit-product">
          <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Product Name *</label>
              <input type="text" class="form-input" id="edit-prod-name" value="${product.name || ''}" placeholder="${namePlaceholder}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Category *</label>
              <select class="form-select" id="edit-prod-category" onchange="InventoryPage.onEditModalCategoryChange(this.value)">
                <option value="Clothes" ${product.category === 'Clothes' ? 'selected' : ''}>Clothes</option>
                <option value="Hosiery" ${isHosiery ? 'selected' : ''}>Hosiery</option>
                <option value="Perfume" ${isPerfume ? 'selected' : ''}>Perfume</option>
                <option value="Empty Bottle" ${product.category === 'Empty Bottle' ? 'selected' : ''}>Empty Bottle</option>
              </select>
            </div>
          </div>

          <div id="edit-perfume-attr-group" class="form-row" style="margin-top: var(--space-3); ${isPerfume ? 'display:grid;' : 'display:none;'} grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Perfume Type</label>
              <div id="edit-prod-fragrance-wrapper" style="position:relative; width:100%;">
                <select class="form-select" id="edit-prod-fragrance" onchange="InventoryPage.onFragranceTypeChange(this.value, 'edit')" style="width:100%;">
                  ${this.getFragranceTypeOptionsHTML(fragranceTypes, product.fragrance_type || '')}
                </select>
              </div>
            </div>
            <div class="form-group" id="edit-gender-group" style="${isEmptyBottle ? 'display:none;' : ''}">
              <label class="form-label">Target Gender</label>
              <select class="form-select" id="edit-prod-gender">
                <option value="Unisex" ${(product.gender || 'Unisex') === 'Unisex' ? 'selected' : ''}>Unisex</option>
                <option value="Men" ${product.gender === 'Men' ? 'selected' : ''}>Men</option>
                <option value="Women" ${product.gender === 'Women' ? 'selected' : ''}>Women</option>
              </select>
            </div>
          </div>

          <div id="edit-measurement-group" class="form-row" style="margin-top: var(--space-3); display:${isEmptyBottle ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Measurement (number) *</label>
              <input type="number" step="any" min="0.01" class="form-input" id="edit-measurement" value="${storedMeasurement}" ${isEmptyBottle ? 'required' : ''}>
            </div>
            <div class="form-group">
              <label class="form-label">Size</label>
              <input type="text" class="form-input" value="ml" readonly>
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3); display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Brand / Label</label>
              <input type="text" class="form-input" id="edit-prod-brand" list="edit-brand-datalist" value="${product.brand || ''}" placeholder="Select or type brand name">
              <datalist id="edit-brand-datalist">
                ${categoryBrands.map(b => `<option value="${b.name}">${b.name}</option>`).join('')}
              </datalist>
            </div>
            <div class="form-group" id="edit-group-size">
              <label class="form-label" id="edit-size-label">${isHosiery ? 'Garment Size' : 'Measurement / Size'}</label>
              <div id="edit-size-unit-wrapper" style="position:relative; width:100%;">
                <select class="form-select" id="edit-prod-size-unit" onchange="InventoryPage.onSizeUnitChange(this.value, 'edit')" style="width:100%;">
                  ${this.getSizeOptionsHTML(product.category, currentSize)}
                </select>
              </div>
            </div>
          </div>

          <!-- Clothes / Hosiery Specific Attributes -->
          <div id="edit-clothes-attr-group" class="form-row" style="margin-top: var(--space-3); display:grid; grid-template-columns: 1fr; gap: var(--space-4); ${isPerfume ? 'display:none;' : ''}">
            <div class="form-group">
              <label class="form-label">Fabric / Material</label>
              <input type="text" class="form-input" id="edit-prod-fabric" value="${product.fabric || ''}" placeholder="${fabricPlaceholder}">
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3); display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Purchase Price (Cost Rs.) *</label>
              <input type="number" step="0.01" class="form-input" id="edit-prod-cost" value="${product.purchase_price}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Retail Selling Price (Rs.) *</label>
              <input type="number" step="0.01" class="form-input" id="edit-prod-price" value="${product.sale_price}" required>
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3); display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label" id="edit-qty-label">Current Stock Qty *</label>
              <input type="number" step="any" class="form-input" id="edit-prod-qty" value="${product.quantity}" min="0" required>
              <small class="form-helper" id="edit-qty-helper" style="${isHosiery ? '' : 'display:none;'} color:var(--color-text-secondary); font-size:var(--text-xs); margin-top:2px;">${isHosiery ? 'Total Pieces / Packs' : ''}</small>
            </div>
            <div class="form-group">
              <label class="form-label" id="edit-threshold-label">Low Stock Threshold</label>
              <input type="number" class="form-input" id="edit-prod-threshold" value="${product.low_stock_threshold}">
              <small class="form-helper" id="edit-threshold-helper" style="${isHosiery ? '' : 'display:none;'} color:var(--color-text-secondary); font-size:var(--text-xs); margin-top:2px;">${isHosiery ? 'Pieces / Packs count' : ''}</small>
            </div>
          </div>

          <div class="form-row" style="margin-top: var(--space-3); display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label">Barcode / SKU</label>
              <input type="text" class="form-input" id="edit-prod-barcode" value="${product.barcode || product.sku || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Supplier Name</label>
              <input type="text" class="form-input" id="edit-prod-supplier" value="${product.supplier || ''}" placeholder="${supplierPlaceholder}">
            </div>
          </div>
        </form>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="InventoryPage.saveEditProduct(${id})">Save Changes</button>
      `
    });
    this.updateEmptyBottleFields('edit', product.fragrance_type);
  },

  async saveEditProduct(id) {
    const name = document.getElementById('edit-prod-name').value.trim();
    const category = document.getElementById('edit-prod-category').value;
    const brand = document.getElementById('edit-prod-brand')?.value.trim() || null;

    // Compose size based on category
    let size = null;
    const sizeUnitSelect = document.getElementById('edit-prod-size-unit');
    const sizeUnitInput = document.getElementById('edit-new-size-input');
    size = sizeUnitSelect ? (sizeUnitSelect.value !== 'ADD_NEW_SIZE' ? sizeUnitSelect.value : '') : (sizeUnitInput?.value.trim() || '');
    if (!size && category === 'Hosiery') size = 'Standard Size';

    const color = null;
    const fabric = document.getElementById('edit-prod-fabric')?.value.trim() || null;
    let fragrance_type = null;
    if (category === 'Perfume') {
      const fragSelect = document.getElementById('edit-prod-fragrance');
      const fragInput = document.getElementById('edit-new-fragrance-input');
      fragrance_type = fragSelect ? (fragSelect.value !== 'ADD_NEW_FRAGRANCE_TYPE' ? fragSelect.value : '') : (fragInput?.value.trim() || null);
      if (!fragrance_type) fragrance_type = null;
    }
    const isEmptyBottle = category === 'Empty Bottle' ||
      (category === 'Perfume' && String(fragrance_type || '').trim().toLowerCase() === 'empty bottle');
    const measurement_ml = isEmptyBottle ? Number(document.getElementById('edit-measurement').value) : null;
    if (isEmptyBottle && (!Number.isFinite(measurement_ml) || measurement_ml <= 0)) {
      return toast.error('Measurement must be greater than 0 ml');
    }
    if (isEmptyBottle) size = `${measurement_ml} ml`;
    const isAttar = String(fragrance_type || '').trim().toLowerCase() === 'attar';
    const gender = category === 'Perfume' && !isEmptyBottle ? (document.getElementById('edit-prod-gender')?.value || null) : null;
    const purchase_price = parseFloat(document.getElementById('edit-prod-cost').value) || 0;
    const sale_price = parseFloat(document.getElementById('edit-prod-price').value) || 0;
    const quantity = parseFloat(document.getElementById('edit-prod-qty').value) || 0;
    const low_stock_threshold = isEmptyBottle
      ? Number(document.getElementById('edit-prod-threshold').value)
      : (parseInt(document.getElementById('edit-prod-threshold').value) || 5);
    const barcode = document.getElementById('edit-prod-barcode')?.value.trim() || null;
    const supplier = document.getElementById('edit-prod-supplier')?.value.trim() || null;

    if (!name) return toast.error('Product Name is required');
    if (isEmptyBottle && (!Number.isInteger(quantity) || !Number.isInteger(low_stock_threshold))) {
      return toast.error('Empty bottle stock and low-stock threshold must be whole numbers');
    }

    try {
      const currentProduct = await window.api.products.get(id);
      const updateData = {
        name, category, brand, size, color, fabric, fragrance_type, gender, measurement_ml,
        purchase_price, sale_price, quantity, low_stock_threshold, barcode, supplier
      };
      if (isEmptyBottle || currentProduct?.category === 'Empty Bottle' ||
          String(currentProduct?.fragrance_type || '').trim().toLowerCase() === 'empty bottle') {
        updateData.inventory_unit = isEmptyBottle ? 'Bottles' : (isAttar ? 'ml' : 'pcs');
      }
      await window.api.products.update(id, updateData);
      toast.success('Product updated!');
      modal.hide();
      this.loadProducts();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to update product');
    }
  },

  async openStockInModal(id) {
    const product = await window.api.products.get(id);
    if (!product) return;

    const unit = formatters.getProductUnit(product);
    const quantityStep = unit === 'Bottles' ? '1' : 'any';
    modal.show({
      title: `Stock In — ${product.name}`,
      bodyHTML: `
        <div style="font-size:var(--text-sm); margin-bottom: var(--space-3); color: var(--color-text-secondary);">
          Current Stock: <strong style="color:var(--color-accent);">${product.quantity} ${unit}</strong>
        </div>
        <div class="form-group">
          <label class="form-label">Additional Quantity to Add (${unit}) *</label>
          <input type="number" step="${quantityStep}" class="form-input" id="stockin-qty" value="10" min="0.01" required>
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
    const qty = parseFloat(document.getElementById('stockin-qty').value) || 0;
    const supplier = document.getElementById('stockin-supplier').value.trim();
    if (qty <= 0) return toast.error('Quantity must be greater than 0');

    try {
      const product = await window.api.products.get(id);
      const unit = formatters.getProductUnit(product);
      await window.api.products.stockIn(id, qty, supplier, this.localDate());
      toast.success(`Added ${qty} ${unit} to stock!`);
      modal.hide();
      this.loadProducts();
    } catch (err) {
      toast.error(err.message || 'Failed to add stock');
    }
  },

  async openCustomSaleModal(id) {
    const product = await window.api.products.get(id);
    if (!product || String(product.fragrance_type || '').trim().toLowerCase() !== 'attar') return;
    const reference = Number(product.retail_quantity) || 1;
    const rate = Number(product.sale_price) / reference;
    modal.show({
      title: `Custom Attar Sale — ${product.name}`,
      bodyHTML: `
        <p>Available: <strong>${product.quantity} ml</strong> &nbsp;|&nbsp; Retail: Rs. ${product.sale_price} per ${reference} ml</p>
        <div class="form-row" style="display:grid;grid-template-columns:1fr 120px;gap:var(--space-3)">
          <div class="form-group"><label class="form-label">Quantity to sell</label><input type="number" step="any" min="0.001" max="${product.quantity}" class="form-input" id="attar-sale-qty" value="1" oninput="InventoryPage.updateAttarTotal(${rate})"></div>
          <div class="form-group"><label class="form-label">Unit</label><select class="form-select" id="attar-sale-unit"><option value="ml">ml</option><option value="tola">tola</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Selling Price (Rs.)</label><input type="number" step="0.01" class="form-input" id="attar-sale-total" value="${rate.toFixed(2)}"><small class="form-helper">Calculated from retail price; can be adjusted.</small></div>
        <div class="form-group"><label class="form-label">Customer</label><input class="form-input" id="attar-sale-customer" placeholder="Walk-in Customer"></div>
      `,
      footerHTML: `<button class="btn btn-secondary" onclick="modal.hide()">Cancel</button><button class="btn btn-primary" onclick="InventoryPage.saveAttarSale(${id})">Complete Sale</button>`
    });
  },

  updateAttarTotal(rate) {
    const qty = Number(document.getElementById('attar-sale-qty')?.value) || 0;
    document.getElementById('attar-sale-total').value = (qty * rate).toFixed(2);
  },

  async saveAttarSale(id) {
    const product = await window.api.products.get(id);
    const qty = Number(document.getElementById('attar-sale-qty')?.value);
    const total = Number(document.getElementById('attar-sale-total')?.value);
    const unit = document.getElementById('attar-sale-unit')?.value || 'ml';
    if (!product || !Number.isFinite(qty) || qty <= 0 || qty > Number(product.quantity)) return toast.error(`Enter up to ${product?.quantity || 0} ml`);
    if (!Number.isFinite(total) || total < 0) return toast.error('Enter a valid selling price');
    try {
      const sale = await window.api.sales.create({ customer_name: document.getElementById('attar-sale-customer')?.value.trim() || 'Walk-in Customer', payment_method: 'Cash', discount_type: 'flat', discount_value: 0, tax_amount: 0 }, [{ product_id: id, quantity: qty, quantity_unit: unit, price_at_sale: total / qty }]);
      toast.success(`Sale ${sale.invoice_no} saved. Remaining: ${Number(product.quantity - qty).toFixed(2)} ml`);
      modal.hide();
      this.loadProducts();
    } catch (err) { toast.error(err.message || 'Could not save Attar sale'); }
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
  },

  async openReturnToSupplierModal(id) {
    const product = await window.api.products.get(id);
    if (!product) return;

    // Load supplier list for the dropdown
    let supplierOptions = '';
    try {
      const suppliers = await window.api.suppliers.getAll();
      if (suppliers && suppliers.length > 0) {
        supplierOptions = suppliers.map(s =>
          `<option value="${s.name}" ${product.supplier && s.name === product.supplier ? 'selected' : ''}>${s.name}${s.company ? ' (' + s.company + ')' : ''}</option>`
        ).join('');
      }
    } catch (e) {}

    const unit = formatters.getProductUnit(product);
    modal.show({
      title: `\u21a9 Return to Supplier \u2014 ${product.name}`,
      bodyHTML: `
        <div style="font-size:var(--text-sm); margin-bottom: var(--space-3); color: var(--color-text-secondary);">
          Current Stock: <strong style="color:var(--color-accent);">${product.quantity} ${unit}</strong>
          &nbsp;|&nbsp; Purchase Price: <strong>${product.purchase_price || 0}</strong> per unit
        </div>
        <div class="form-group">
          <label class="form-label">Quantity to Return (${unit}) *</label>
          <input type="number" class="form-input" id="pr-qty" value="1" min="1" max="${product.quantity}" required>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Supplier / Company *</label>
          <select class="form-input" id="pr-supplier" style="width:100%;">
            <option value="">-- Select Supplier --</option>
            ${supplierOptions}
            <option value="__other__">Other (type below)</option>
          </select>
          <input type="text" class="form-input" id="pr-supplier-other" placeholder="Type supplier name" style="margin-top:var(--space-2); display:none;">
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Reason for Return *</label>
          <select class="form-input" id="pr-reason">
            <option value="Defective / Damaged">Defective / Damaged</option>
            <option value="Wrong Item Received">Wrong Item Received</option>
            <option value="Excess Stock">Excess Stock</option>
            <option value="Quality Issue">Quality Issue</option>
            <option value="Expired / Near Expiry">Expired / Near Expiry</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group" style="margin-top: var(--space-3);">
          <label class="form-label">Additional Notes</label>
          <textarea class="form-input" id="pr-notes" rows="2" placeholder="Optional notes..."></textarea>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-danger" onclick="InventoryPage.saveReturnToSupplier(${id})">Return to Supplier</button>
      `
    });

    // Bind the supplier dropdown change event after modal renders
    setTimeout(() => {
      const supplierSelect = document.getElementById('pr-supplier');
      if (supplierSelect) {
        supplierSelect.addEventListener('change', function() {
          const otherInput = document.getElementById('pr-supplier-other');
          if (otherInput) otherInput.style.display = this.value === '__other__' ? 'block' : 'none';
        });
      }
    }, 100);
  },

  async saveReturnToSupplier(id) {
    const qty = parseInt(document.getElementById('pr-qty').value) || 0;
    const supplierSelect = document.getElementById('pr-supplier');
    let supplier = supplierSelect.value;
    if (supplier === '__other__') {
      supplier = (document.getElementById('pr-supplier-other').value || '').trim();
    }
    const reason = document.getElementById('pr-reason').value;
    const notes = (document.getElementById('pr-notes').value || '').trim();

    if (qty <= 0) return toast.error('Quantity must be greater than 0');
    if (!supplier) return toast.error('Please select or enter a supplier name');
    if (!reason) return toast.error('Please select a reason for return');

    try {
      const product = await window.api.products.get(id);
      const unit = formatters.getProductUnit(product);
      const result = await window.api.purchaseReturns.process(id, qty, supplier, reason, notes || null);
      toast.success(`Returned ${qty} ${unit} of "${result.product_name}" to ${supplier}. Stock updated.`);
      modal.hide();
      this.loadProducts();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to process purchase return');
    }
  }
};
