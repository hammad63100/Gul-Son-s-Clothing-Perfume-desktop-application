/* Brands & Categories Page Controller */

window.CategoriesPage = {
  async render(container) {
    container.innerHTML = `
      <div class="page-container animate-fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Brands & Categories</h1>
            <p class="page-subtitle">Configure clothing styles, perfume fragrance types, and brand master data</p>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-6);">

          <!-- Categories Card -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Product Categories</h3>
              <button class="btn btn-primary btn-sm" onclick="CategoriesPage.openAddCategoryModal()">+ Add Category</button>
            </div>
            <div class="table-container" style="margin-top:var(--space-3);">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Category Name</th>
                    <th>Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="cat-table-body">
                  <tr><td colspan="3" style="text-align:center;"><div class="spinner" style="margin:10px auto;"></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Brands Card -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Shop Brands</h3>
              <button class="btn btn-primary btn-sm" onclick="CategoriesPage.openAddBrandModal()">+ Add Brand</button>
            </div>
            <div class="table-container" style="margin-top:var(--space-3);">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Brand Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="brand-table-body">
                  <tr><td colspan="2" style="text-align:center;"><div class="spinner" style="margin:10px auto;"></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Fragrance Types Card -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Fragrance Types</h3>
              <button class="btn btn-primary btn-sm" onclick="CategoriesPage.openAddFragranceTypeModal()">+ Add Fragrance Type</button>
            </div>
            <div class="table-container" style="margin-top:var(--space-3);">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Fragrance Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="fragrance-table-body">
                  <tr><td colspan="2" style="text-align:center;"><div class="spinner" style="margin:10px auto;"></div></td></tr>
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
      const cats = await window.api.master.getCategories();
      const brands = await window.api.master.getBrands();
      const fragranceTypes = await window.api.master.getFragranceTypes();

      const catBody = document.getElementById('cat-table-body');
      if (catBody) {
        catBody.innerHTML = cats.map(c => `
          <tr>
            <td style="font-weight:600;">${c.name}</td>
            <td><span class="badge ${c.type === 'Clothes' ? 'badge-clothes' : (c.type === 'Hosiery' ? 'badge-hosiery' : 'badge-perfume')}">${c.type}</span></td>
            <td>
              <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" onclick="CategoriesPage.deleteCategory(${c.id})">Delete</button>
            </td>
          </tr>
        `).join('');
      }

      const brandBody = document.getElementById('brand-table-body');
      if (brandBody) {
        brandBody.innerHTML = brands.map(b => `
          <tr>
            <td style="font-weight:600;">${b.name}</td>
            <td>
              <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" onclick="CategoriesPage.deleteBrand(${b.id})">Delete</button>
            </td>
          </tr>
        `).join('');
      }

      const fragranceBody = document.getElementById('fragrance-table-body');
      if (fragranceBody) {
        fragranceBody.innerHTML = fragranceTypes.map(f => `
          <tr>
            <td style="font-weight:600;">${f.name}</td>
            <td>
              <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" onclick="CategoriesPage.deleteFragranceType(${f.id})">Delete</button>
            </td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load categories/brands/fragrance types');
    }
  },

  openAddCategoryModal() {
    modal.show({
      title: 'Add New Category',
      bodyHTML: `
        <div class="form-group">
          <label class="form-label">Category Name *</label>
          <input type="text" class="form-input" id="new-cat-name" placeholder="e.g. Hoodies / Body Spray / Socks" required>
        </div>
        <div class="form-group" style="margin-top:var(--space-3);">
          <label class="form-label">Category Type *</label>
          <select class="form-select" id="new-cat-type">
            <option value="Clothes">Clothes</option>
            <option value="Hosiery">Hosiery</option>
            <option value="Perfume">Perfume</option>
          </select>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="CategoriesPage.saveCategory()">Save Category</button>
      `
    });
  },

  async saveCategory() {
    const name = document.getElementById('new-cat-name').value.trim();
    const type = document.getElementById('new-cat-type').value;
    if (!name) return toast.error('Category name is required');
    try {
      await window.api.master.addCategory(name, type);
      toast.success('Category created!');
      modal.hide();
      this.loadData();
    } catch (err) {
      toast.error('Failed to add category');
    }
  },

  async deleteCategory(id) {
    try {
      await window.api.master.deleteCategory(id);
      toast.success('Category removed');
      this.loadData();
    } catch (err) {
      toast.error('Failed to delete category');
    }
  },

  openAddBrandModal() {
    modal.show({
      title: 'Add New Brand',
      bodyHTML: `
        <div class="form-group">
          <label class="form-label">Brand Name *</label>
          <input type="text" class="form-input" id="new-brand-name" placeholder="e.g. Dior / Outfitters / J." required>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="CategoriesPage.saveBrand()">Save Brand</button>
      `
    });
  },

  async saveBrand() {
    const name = document.getElementById('new-brand-name').value.trim();
    if (!name) return toast.error('Brand name is required');
    try {
      await window.api.master.addBrand(name);
      toast.success('Brand added!');
      modal.hide();
      this.loadData();
    } catch (err) {
      toast.error('Failed to add brand');
    }
  },

  async deleteBrand(id) {
    try {
      await window.api.master.deleteBrand(id);
      toast.success('Brand removed');
      this.loadData();
    } catch (err) {
      toast.error('Failed to delete brand');
    }
  },

  openAddFragranceTypeModal() {
    modal.show({
      title: 'Add New Fragrance Type',
      bodyHTML: `
        <div class="form-group">
          <label class="form-label">Fragrance Type Name *</label>
          <input type="text" class="form-input" id="new-fragrance-type-name" placeholder="e.g. Extrait de Parfum / Attar Oil" required>
        </div>
      `,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn btn-primary" onclick="CategoriesPage.saveFragranceType()">Save Fragrance Type</button>
      `
    });
  },

  async saveFragranceType() {
    const name = document.getElementById('new-fragrance-type-name').value.trim();
    if (!name) return toast.error('Fragrance type name is required');
    try {
      await window.api.master.addFragranceType(name);
      toast.success('Fragrance type added!');
      modal.hide();
      this.loadData();
    } catch (err) {
      toast.error('Failed to add fragrance type');
    }
  },

  async deleteFragranceType(id) {
    try {
      await window.api.master.deleteFragranceType(id);
      toast.success('Fragrance type removed');
      this.loadData();
    } catch (err) {
      toast.error('Failed to delete fragrance type');
    }
  }
};
