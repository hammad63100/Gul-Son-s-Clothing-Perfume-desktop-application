/* Point of Sale (POS) / Billing Page Controller */

window.POSPage = {
  cart: [],
  products: [],
  customersList: [],
  discountType: 'flat',
  discountValue: 0,
  taxRate: 0,
  heldInvoices: [],

  async render(container) {
    container.innerHTML = `
      <div class="pos-page-wrapper animate-fade-in">
        
        <!-- Header Toolbar -->
        <div class="page-header" style="margin-bottom:var(--space-4);">
          <div>
            <h1 class="page-title">Sales / POS Billing</h1>
            <p class="page-subtitle">Scan barcodes, manage cart items, auto-suggest returning customers & print PDF receipts</p>
          </div>
          <div class="toolbar" style="margin:0;">
            <button class="btn btn-secondary btn-sm" onclick="POSPage.showHeldInvoicesModal()">
              📜 Held Bills (<span id="pos-held-count">0</span>)
            </button>
            <button class="btn btn-ghost btn-sm" onclick="app.navigateTo('sales-return')">
              ↩️ Return / Refund
            </button>
          </div>
        </div>

        <div class="pos-container">
          
          <!-- Left Panel: Product Catalog List & Barcode Scanner -->
          <div class="pos-products-panel">
            
            <!-- Barcode & Search Input -->
            <div class="toolbar" style="margin:0; flex-wrap:nowrap; gap: var(--space-2);">
              <div class="search-bar" style="flex:1;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="pos-barcode-input" placeholder="Scan barcode or type product name/SKU..." onkeydown="POSPage.onBarcodeKeyDown(event)" oninput="POSPage.filterProducts(this.value)" autofocus>
              </div>
            </div>

            <!-- Category Filter Tabs -->
            <div class="tabs" style="margin-top:var(--space-3); margin-bottom:0;">
              <button class="tab-btn active" onclick="POSPage.filterCategory('', this)">All Products</button>
              <button class="tab-btn" onclick="POSPage.filterCategory('Clothes', this)">👔 Clothes</button>
              <button class="tab-btn" onclick="POSPage.filterCategory('Perfume', this)">🧴 Perfumes</button>
            </div>

            <!-- Product List Table Container -->
            <div class="pos-grid" id="pos-products-grid" style="margin-top:var(--space-3);">
              <div class="spinner" style="margin:40px auto;"></div>
            </div>
          </div>

          <!-- Right Panel: Current Bill / Cart -->
          <div class="pos-cart-panel">
            
            <!-- Cart Header -->
            <div class="pos-cart-header">
              <div>
                <h3 style="font-size: var(--text-md); font-weight:700;">Current Sales Invoice</h3>
                <span style="font-size: var(--text-xs); color: var(--color-accent);" id="pos-invoice-no">GS-000000</span>
              </div>
              <div class="flex gap-2">
                <button class="btn btn-secondary btn-sm" onclick="POSPage.holdInvoice()">Hold</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" onclick="POSPage.clearCart()">Clear</button>
              </div>
            </div>

            <!-- Cart Items Table Body -->
            <div class="pos-cart-items" id="pos-cart-items">
              <div class="empty-state" style="padding: 40px 0;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
                <h3>Cart is Empty</h3>
                <p>Scan barcode or click any product to add to bill</p>
              </div>
            </div>

            <!-- Cart Summary & Checkout Controls -->
            <div class="pos-cart-footer">
              
              <!-- Customer Auto-Suggest Selection (MANDATORY) -->
              <div class="form-row">
                <div class="form-group" style="position:relative;">
                  <label class="form-label" style="font-size:11px; color:var(--color-accent);">Customer Name *</label>
                  <input type="text" class="form-input" id="pos-cust-name" list="customer-suggestions-list" placeholder="Type customer name..." oninput="POSPage.onCustomerNameInput(this.value)" style="height:32px; font-size:12px;" required>
                  <datalist id="customer-suggestions-list"></datalist>
                  <span id="pos-cust-badge" style="font-size:10px; color:var(--color-success); font-weight:600; display:none; margin-top:2px;"></span>
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-size:11px;">Phone No</label>
                  <input type="text" class="form-input" id="pos-cust-phone" placeholder="0300-1234567" style="height:32px; font-size:12px;">
                </div>
              </div>

              <!-- Discount & Tax Controls -->
              <div class="form-row" style="margin-top: 4px;">
                <div class="form-group">
                  <label class="form-label" style="font-size:11px;">Discount</label>
                  <div class="input-group">
                    <input type="number" class="form-input" id="pos-discount-val" value="0" min="0" onchange="POSPage.updateTotals()" style="height:32px; font-size:12px;">
                    <select id="pos-discount-type" class="form-select" onchange="POSPage.updateTotals()" style="height:32px; font-size:12px; padding:0 4px; width:60px;">
                      <option value="flat">Rs.</option>
                      <option value="percentage">%</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" style="font-size:11px;">Tax (%)</label>
                  <input type="number" class="form-input" id="pos-tax-val" value="0" min="0" onchange="POSPage.updateTotals()" style="height:32px; font-size:12px;">
                </div>
              </div>

              <!-- Payment Method -->
              <div class="form-row" style="margin-top: 4px;">
                <div class="form-group">
                  <label class="form-label" style="font-size:11px;">Payment Method</label>
                  <select class="form-select" id="pos-payment-method" style="height:32px; font-size:12px;">
                    <option value="Cash">💵 Cash</option>
                    <option value="Card">💳 Credit / Debit Card</option>
                    <option value="Bank">🏦 Bank Transfer</option>
                    <option value="JazzCash/Easypaisa">📱 JazzCash / Easypaisa</option>
                    <option value="Credit / Unpaid">⏳ Credit / Unpaid (Add to Balance)</option>
                  </select>
                </div>
              </div>

              <!-- Totals Breakdown -->
              <div class="summary-row" style="margin-top:4px;">
                <span>Subtotal</span>
                <span id="pos-subtotal">Rs. 0</span>
              </div>
              <div class="summary-row" id="pos-discount-row" style="display:none; color: var(--color-success);">
                <span>Discount</span>
                <span id="pos-discount-amount">- Rs. 0</span>
              </div>
              <div class="summary-row" id="pos-tax-row" style="display:none; color: var(--color-warning);">
                <span>Tax Amount</span>
                <span id="pos-tax-amount">+ Rs. 0</span>
              </div>

              <div class="summary-row total">
                <span>Grand Total</span>
                <span class="amount" id="pos-grand-total">Rs. 0</span>
              </div>

              <!-- Action Checkout Buttons -->
              <div class="flex gap-2" style="margin-top:6px;">
                <button class="btn btn-primary btn-lg" style="flex:1;" onclick="POSPage.completeSale(true)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Complete & Print Invoice</span>
                </button>
                <button class="btn btn-secondary btn-lg" style="width:48px; padding:0; display:flex; align-items:center; justify-content:center;" title="Share WhatsApp Invoice" onclick="POSPage.shareWhatsApp()">
                  💬
                </button>
              </div>

            </div>

          </div>

        </div>
      </div>
    `;

    await this.init();
  },

  async init() {
    this.cart = [];
    this.discountValue = 0;
    this.discountType = 'flat';
    this.taxRate = 0;

    const invoiceNo = await window.api.sales.getNextInvoiceNo();
    const invoiceEl = document.getElementById('pos-invoice-no');
    if (invoiceEl) invoiceEl.textContent = invoiceNo;

    this.products = await window.api.products.getAll({ lowStock: false });
    this.customersList = await window.api.customers.getAll() || [];

    // Populate Datalist for Customer Auto-Suggest
    const datalist = document.getElementById('customer-suggestions-list');
    if (datalist && this.customersList.length > 0) {
      datalist.innerHTML = this.customersList.map(c => `
        <option value="${c.name}">${c.phone ? `${c.name} (${c.phone})` : c.name} — ${c.visit_count || 1} visits</option>
      `).join('');
    }

    this.renderProductsGrid(this.products);
  },

  onCustomerNameInput(val) {
    const valTrim = val.trim().toLowerCase();
    const badge = document.getElementById('pos-cust-badge');
    const phoneInput = document.getElementById('pos-cust-phone');

    if (!valTrim) {
      if (badge) badge.style.display = 'none';
      return;
    }

    const matched = this.customersList.find(c => c.name.toLowerCase() === valTrim);
    if (matched) {
      if (phoneInput && matched.phone) phoneInput.value = matched.phone;
      if (badge) {
        badge.textContent = `⭐ Returning Customer (${matched.visit_count || 1} visits • Rs. ${(matched.total_purchases || 0).toLocaleString()})`;
        badge.style.display = 'block';
      }
    } else {
      if (badge) badge.style.display = 'none';
    }
  },

  renderProductsGrid(items) {
    const grid = document.getElementById('pos-products-grid');
    if (!grid) return;

    if (!items || items.length === 0) {
      grid.innerHTML = `<div class="empty-state"><p>No available products found</p></div>`;
      return;
    }

    grid.innerHTML = `
      <div class="table-container" style="max-height: 100%; overflow-y: auto;">
        <table class="data-table pos-product-list-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Category</th>
              <th>Variant</th>
              <th>Price</th>
              <th>Stock</th>
              <th style="width: 70px;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(p => `
              <tr class="pos-list-row ${p.quantity <= 0 ? 'disabled' : ''}" onclick="POSPage.addToCart(${p.id})">
                <td style="font-weight:600; color:var(--color-text-primary);">${p.name}</td>
                <td><span class="badge ${p.category === 'Clothes' ? 'badge-clothes' : 'badge-perfume'}">${p.category}</span></td>
                <td style="font-size:var(--text-xs); color:var(--color-text-secondary);">
                  ${p.category === 'Clothes' ? `${p.size || 'M'} ${p.color ? `(${p.color})` : ''}` : `${p.size || '50ml'}`}
                </td>
                <td style="font-weight:700; color:var(--color-accent);">Rs. ${p.sale_price.toLocaleString()}</td>
                <td>
                  <span class="badge ${p.quantity <= 0 ? 'badge-danger' : (p.quantity <= p.low_stock_threshold ? 'badge-warning' : 'badge-success')}">
                    ${p.quantity <= 0 ? 'Out of Stock' : `${p.quantity} pcs`}
                  </span>
                </td>
                <td>
                  <button class="btn btn-primary btn-sm" style="padding:2px 10px;" onclick="event.stopPropagation(); POSPage.addToCart(${p.id})">+ Add</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  onBarcodeKeyDown(event) {
    if (event.key === 'Enter') {
      const code = event.target.value.trim().toLowerCase();
      if (!code) return;

      const product = this.products.find(p => 
        (p.barcode && p.barcode.toLowerCase() === code) ||
        (p.sku && p.sku.toLowerCase() === code) ||
        p.name.toLowerCase() === code
      );

      if (product) {
        this.addToCart(product.id);
        event.target.value = '';
        toast.success(`Scanned: ${product.name}`);
      } else {
        toast.warning(`Product not found for barcode: ${code}`);
      }
    }
  },

  filterProducts(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.renderProductsGrid(this.products);
      return;
    }
    const filtered = this.products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.size && p.size.toLowerCase().includes(q)) ||
      (p.color && p.color.toLowerCase().includes(q))
    );
    this.renderProductsGrid(filtered);
  },

  filterCategory(cat, btnEl) {
    const tabs = btnEl.parentNode.querySelectorAll('.tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    btnEl.classList.add('active');

    if (!cat) {
      this.renderProductsGrid(this.products);
    } else {
      const filtered = this.products.filter(p => p.category === cat);
      this.renderProductsGrid(filtered);
    }
  },

  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    if (product.quantity <= 0) {
      toast.error(`"${product.name}" is out of stock!`);
      return;
    }

    const existing = this.cart.find(i => i.product_id === productId);
    if (existing) {
      if (existing.quantity + 1 > product.quantity) {
        toast.warning(`Cannot add more than available stock (${product.quantity} pcs)`);
        return;
      }
      existing.quantity += 1;
    } else {
      const variantText = product.category === 'Clothes' 
        ? `${product.color || ''} / ${product.size || 'M'}`.trim()
        : `${product.size || '50ml'}`;

      this.cart.push({
        product_id: product.id,
        product_name: product.name,
        category: product.category,
        variant: variantText,
        product_size: product.size,
        product_color: product.color,
        price_at_sale: product.sale_price,
        purchase_price_at_sale: product.purchase_price,
        quantity: 1,
        max_stock: product.quantity,
      });
    }

    this.renderCart();
  },

  updateQuantity(productId, delta) {
    const item = this.cart.find(i => i.product_id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity > item.max_stock) {
      item.quantity = item.max_stock;
      toast.warning(`Max available stock reached (${item.max_stock})`);
    }

    if (item.quantity <= 0) {
      this.cart = this.cart.filter(i => i.product_id !== productId);
    }

    this.renderCart();
  },

  clearCart() {
    this.cart = [];
    this.renderCart();
  },

  holdInvoice() {
    if (this.cart.length === 0) return toast.warning('Cart is empty to hold');
    const invoiceNo = document.getElementById('pos-invoice-no').textContent;
    this.heldInvoices.push({
      invoice_no: invoiceNo,
      cart: [...this.cart],
      time: new Date().toLocaleTimeString()
    });
    this.cart = [];
    document.getElementById('pos-held-count').textContent = this.heldInvoices.length;
    toast.info(`Invoice ${invoiceNo} held successfully`);
    this.renderCart();
  },

  showHeldInvoicesModal() {
    if (this.heldInvoices.length === 0) return toast.info('No held bills');

    modal.show({
      title: 'Held Invoices',
      bodyHTML: `
        <table class="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Time</th>
              <th>Items</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${this.heldInvoices.map((h, idx) => `
              <tr>
                <td style="font-weight:700;">${h.invoice_no}</td>
                <td>${h.time}</td>
                <td>${h.cart.length} items</td>
                <td>
                  <button class="btn btn-primary btn-sm" onclick="POSPage.restoreHeldInvoice(${idx})">Resume Bill</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    });
  },

  restoreHeldInvoice(idx) {
    const held = this.heldInvoices[idx];
    if (!held) return;
    this.cart = [...held.cart];
    this.heldInvoices.splice(idx, 1);
    document.getElementById('pos-held-count').textContent = this.heldInvoices.length;
    modal.hide();
    toast.success(`Resumed invoice ${held.invoice_no}`);
    this.renderCart();
  },

  updateTotals() {
    this.renderCart();
  },

  renderCart() {
    const container = document.getElementById('pos-cart-items');
    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 40px 0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>
          <h3>Cart is Empty</h3>
          <p>Scan barcode or click any product to add to bill</p>
        </div>
      `;
      document.getElementById('pos-subtotal').textContent = 'Rs. 0';
      document.getElementById('pos-grand-total').textContent = 'Rs. 0';
      document.getElementById('pos-discount-row').style.display = 'none';
      document.getElementById('pos-tax-row').style.display = 'none';
      return;
    }

    container.innerHTML = `
      <table class="data-table" style="font-size:12px;">
        <thead>
          <tr>
            <th>Product</th>
            <th>Variant</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${this.cart.map(item => `
            <tr>
              <td style="font-weight:600;">${item.product_name}</td>
              <td><span class="badge ${item.category === 'Clothes' ? 'badge-clothes' : 'badge-perfume'}">${item.variant || '-'}</span></td>
              <td>
                <div class="flex items-center gap-1">
                  <button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="POSPage.updateQuantity(${item.product_id}, -1)">-</button>
                  <span style="font-weight:700;">${item.quantity}</span>
                  <button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick="POSPage.updateQuantity(${item.product_id}, 1)">+</button>
                </div>
              </td>
              <td>Rs. ${item.price_at_sale.toLocaleString()}</td>
              <td style="font-weight:700; color:var(--color-accent);">Rs. ${(item.price_at_sale * item.quantity).toLocaleString()}</td>
              <td>
                <button class="btn btn-ghost btn-sm" style="color:var(--color-danger); padding:0 4px;" onclick="POSPage.updateQuantity(${item.product_id}, -${item.quantity})">✕</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const subtotal = this.cart.reduce((sum, i) => sum + (i.price_at_sale * i.quantity), 0);
    const discVal = parseFloat(document.getElementById('pos-discount-val')?.value) || 0;
    const discType = document.getElementById('pos-discount-type')?.value || 'flat';
    let discountAmount = discType === 'percentage' ? (subtotal * (discVal / 100)) : discVal;
    discountAmount = Math.min(subtotal, discountAmount);

    const taxVal = parseFloat(document.getElementById('pos-tax-val')?.value) || 0;
    const taxAmount = (subtotal - discountAmount) * (taxVal / 100);

    const grandTotal = Math.max(0, subtotal - discountAmount + taxAmount);

    document.getElementById('pos-subtotal').textContent = `Rs. ${subtotal.toLocaleString()}`;
    
    const discRow = document.getElementById('pos-discount-row');
    if (discountAmount > 0) {
      discRow.style.display = 'flex';
      document.getElementById('pos-discount-amount').textContent = `- Rs. ${discountAmount.toLocaleString()}`;
    } else {
      discRow.style.display = 'none';
    }

    const taxRow = document.getElementById('pos-tax-row');
    if (taxAmount > 0) {
      taxRow.style.display = 'flex';
      document.getElementById('pos-tax-amount').textContent = `+ Rs. ${taxAmount.toLocaleString()}`;
    } else {
      taxRow.style.display = 'none';
    }

    document.getElementById('pos-grand-total').textContent = `Rs. ${grandTotal.toLocaleString()}`;
  },

  async completeSale(printPdf = true) {
    if (this.cart.length === 0) {
      toast.warning('Cart is empty!');
      return;
    }

    // MANDATORY Customer Name Validation
    const customerNameInput = document.getElementById('pos-cust-name');
    const customer_name = customerNameInput ? customerNameInput.value.trim() : '';

    if (!customer_name) {
      toast.error('Customer Name is required before completing invoice!');
      if (customerNameInput) {
        customerNameInput.focus();
        customerNameInput.style.borderColor = 'var(--color-danger)';
      }
      return;
    } else if (customerNameInput) {
      customerNameInput.style.borderColor = 'var(--color-border)';
    }

    const customer_phone = document.getElementById('pos-cust-phone').value.trim() || null;
    const payment_method = document.getElementById('pos-payment-method').value;

    const subtotal = this.cart.reduce((sum, i) => sum + (i.price_at_sale * i.quantity), 0);
    const discVal = parseFloat(document.getElementById('pos-discount-val')?.value) || 0;
    const discType = document.getElementById('pos-discount-type')?.value || 'flat';
    let discountAmount = discType === 'percentage' ? (subtotal * (discVal / 100)) : discVal;
    discountAmount = Math.min(subtotal, discountAmount);

    const taxVal = parseFloat(document.getElementById('pos-tax-val')?.value) || 0;
    const taxAmount = (subtotal - discountAmount) * (taxVal / 100);

    const total_amount = Math.max(0, subtotal - discountAmount + taxAmount);

    const saleData = {
      customer_name,
      customer_phone,
      subtotal,
      discount_type: discType,
      discount_value: discVal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount,
      payment_method
    };

    const itemsData = this.cart.map(i => ({
      product_id: i.product_id,
      product_name: i.product_name,
      product_size: i.product_size,
      product_color: i.product_color,
      quantity: i.quantity,
      price_at_sale: i.price_at_sale,
      purchase_price_at_sale: i.purchase_price_at_sale || 0,
      line_total: i.price_at_sale * i.quantity
    }));

    try {
      const result = await window.api.sales.create(saleData, itemsData);
      toast.success(`Invoice ${result.invoice_no} completed & saved to database!`);

      if (printPdf) {
        try {
          const fullSale = await window.api.sales.get(result.invoice_no);
          if (fullSale) {
            await window.api.backup.generateInvoicePDF(fullSale);
          }
        } catch (pdfErr) {
          console.warn('PDF prompt skipped:', pdfErr);
        }
      }

      this.cart = [];
      this.init();
    } catch (err) {
      console.error(err);
      toast.error('Failed to complete sale: ' + err.message);
    }
  },

  shareWhatsApp() {
    if (this.cart.length === 0) return toast.warning('Cart is empty');
    const custName = document.getElementById('pos-cust-name').value.trim() || 'Valued Customer';
    const total = document.getElementById('pos-grand-total').textContent;
    const text = `Hello ${custName}, Thank you for shopping at Gul Son's Clothes & Perfume Shop! Your total invoice bill is ${total}. Have a blessed day!`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }
};
