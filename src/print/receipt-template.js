/**
 * Receipt HTML Template Generator for 80mm Thermal Printers (BT-801)
 *
 * Generates a complete self-contained HTML document styled for direct thermal
 * printing via Electron's webContents.print(). The layout is 80mm wide with
 * auto height — paper length matches content exactly, eliminating blank space.
 */

function generateReceiptHTML(saleData, settings = {}) {
  const shopName = settings.shop_name || "Gul Son's";
  const shopAddress = settings.shop_address || '';
  const shopPhone = settings.shop_phone || '';
  const currency = settings.currency_symbol || 'Rs.';

  const invoiceNo = saleData.invoice_no || 'GS-000000';
  const createdAt = saleData.created_at
    ? new Date(saleData.created_at).toLocaleString('en-PK', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      })
    : new Date().toLocaleString('en-PK', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
  const paymentMethod = saleData.payment_method || 'Cash';
  const customerName = saleData.customer_name || '';
  const customerPhone = saleData.customer_phone || '';
  const items = saleData.items || [];

  // Build item rows
  const itemRows = items.map((item, idx) => {
    const name = item.product_name || 'Unknown';
    const variant = item.product_size || '';
    const qtyNum = Number(item.quantity || 1);
    const qtyFormatted = Number.isInteger(qtyNum) ? qtyNum.toString() : parseFloat(qtyNum.toFixed(2)).toString();
    const qtyUnitStr = item.quantity_unit && !['pcs', 'Items', 'items'].includes(item.quantity_unit) ? ` ${item.quantity_unit}` : '';
    const price = Number(item.price_at_sale || 0);
    const lineTotal = item.line_total !== undefined ? Number(item.line_total) : (price * qtyNum);

    return `
      <tr>
        <td class="col-num">${idx + 1}</td>
        <td class="col-item">
          ${escapeHtml(name)}${variant ? `<br><span class="variant">${escapeHtml(variant)}</span>` : ''}
        </td>
        <td class="col-qty">${qtyFormatted}${qtyUnitStr ? `<span style="font-size:9px;">${escapeHtml(qtyUnitStr)}</span>` : ''}</td>
        <td class="col-price">${formatNum(price)}</td>
        <td class="col-total">${formatNum(lineTotal)}</td>
      </tr>
    `;
  }).join('');

  // Totals
  const subtotal = saleData.subtotal || 0;
  const discountAmount = saleData.discount_amount || 0;
  const taxAmount = saleData.tax_amount || 0;
  const totalAmount = saleData.total_amount || 0;

  let totalsRows = `
    <tr>
      <td>Subtotal</td>
      <td>${currency} ${formatNum(subtotal)}</td>
    </tr>
  `;

  if (discountAmount > 0) {
    const discLabel = saleData.discount_type === 'percentage'
      ? `Discount (${saleData.discount_value || 0}%)`
      : 'Discount';
    totalsRows += `
      <tr>
        <td>${discLabel}</td>
        <td>-${currency} ${formatNum(discountAmount)}</td>
      </tr>
    `;
  }

  if (taxAmount > 0) {
    totalsRows += `
      <tr>
        <td>Tax</td>
        <td>${currency} ${formatNum(taxAmount)}</td>
      </tr>
    `;
  }

  // Customer section
  const customerSection = (customerName || customerPhone) ? `
    <div class="section-divider"></div>
    <div class="customer-info">
      ${customerName ? `<div>Customer: <strong>${escapeHtml(customerName)}</strong></div>` : ''}
      ${customerPhone ? `<div>Phone: ${escapeHtml(customerPhone)}</div>` : ''}
    </div>
  ` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt ${invoiceNo}</title>
<style>
  /* Reset — zero out everything for thermal printing */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  @page {
    size: 80mm auto;
    margin: 0;
  }

  html, body {
    width: 80mm;
    margin: 0;
    padding: 0;
    font-family: 'Consolas', 'Courier New', 'Lucida Console', monospace;
    font-size: 11px;
    line-height: 1.3;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .receipt {
    width: 80mm;
    padding: 4mm 3mm 6mm 3mm;
  }

  /* ─── Shop Header ─── */
  .shop-header {
    text-align: center;
    padding-bottom: 2mm;
  }
  .shop-name {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 1mm;
  }
  .shop-detail {
    font-size: 10px;
    color: #333;
  }

  /* ─── Dividers ─── */
  .divider {
    border: none;
    border-top: 1px dashed #000;
    margin: 2mm 0;
  }
  .divider-double {
    border: none;
    border-top: 2px solid #000;
    margin: 2mm 0;
  }
  .section-divider {
    border-top: 1px dotted #555;
    margin: 1.5mm 0;
  }

  /* ─── Invoice Info ─── */
  .invoice-title {
    text-align: center;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.5px;
    margin: 1mm 0;
  }
  .invoice-info {
    font-size: 10px;
  }
  .invoice-info div {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5mm;
  }

  /* ─── Customer Info ─── */
  .customer-info {
    font-size: 10px;
    padding: 1mm 0;
  }
  .customer-info div {
    margin-bottom: 0.3mm;
  }

  /* ─── Items Table ─── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    margin-top: 1mm;
  }
  .items-table thead th {
    text-align: left;
    font-weight: 800;
    font-size: 9px;
    padding: 1mm 0.5mm;
    border-bottom: 1px solid #000;
    text-transform: uppercase;
  }
  .items-table thead th.col-qty,
  .items-table thead th.col-price,
  .items-table thead th.col-total {
    text-align: right;
  }
  .items-table tbody td {
    padding: 1mm 0.5mm;
    vertical-align: top;
    border-bottom: 1px dotted #ccc;
  }
  .col-num { width: 6mm; text-align: center; }
  .col-item { }
  .col-qty { width: 8mm; text-align: right; }
  .col-price { width: 16mm; text-align: right; }
  .col-total { width: 18mm; text-align: right; font-weight: 700; }
  .variant {
    font-size: 8px;
    color: #555;
    font-style: italic;
  }

  /* ─── Totals ─── */
  .totals-table {
    width: 100%;
    font-size: 11px;
    margin-top: 1mm;
  }
  .totals-table td {
    padding: 0.5mm 0;
  }
  .totals-table td:last-child {
    text-align: right;
    font-weight: 600;
  }
  .grand-total-row {
    font-size: 14px;
    font-weight: 900;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    padding: 1.5mm 0 !important;
  }

  /* ─── Footer ─── */
  .footer {
    text-align: center;
    font-size: 9px;
    color: #333;
    padding-top: 2mm;
    line-height: 1.4;
  }
  .footer .thanks {
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 1mm;
  }

  /* ─── Print media — remove any browser chrome ─── */
  @media print {
    html, body {
      width: 80mm;
      margin: 0 !important;
      padding: 0 !important;
    }
    .receipt {
      page-break-after: avoid;
    }
  }
</style>
</head>
<body>
<div class="receipt">

  <!-- Shop Header -->
  <div class="shop-header">
    <div class="shop-name">${escapeHtml(shopName)}</div>
    ${shopAddress ? `<div class="shop-detail">${escapeHtml(shopAddress)}</div>` : ''}
    ${shopPhone ? `<div class="shop-detail">Tel: ${escapeHtml(shopPhone)}</div>` : ''}
  </div>

  <hr class="divider-double">

  <!-- Invoice Title & Info -->
  <div class="invoice-title">SALES INVOICE</div>
  <div class="invoice-info">
    <div><span>Invoice #</span><span>${escapeHtml(invoiceNo)}</span></div>
    <div><span>Date</span><span>${escapeHtml(createdAt)}</span></div>
    <div><span>Payment</span><span>${escapeHtml(paymentMethod)}</span></div>
  </div>

  ${customerSection}

  <hr class="divider">

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th class="col-num">#</th>
        <th class="col-item">Item</th>
        <th class="col-qty">Qty</th>
        <th class="col-price">Price</th>
        <th class="col-total">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <hr class="divider">

  <!-- Totals -->
  <table class="totals-table">
    ${totalsRows}
    <tr>
      <td class="grand-total-row">TOTAL</td>
      <td class="grand-total-row">${currency} ${formatNum(totalAmount)}</td>
    </tr>
  </table>

  <hr class="divider-double">

  <!-- Footer -->
  <div class="footer">
    <div class="thanks">Thank you for shopping!</div>
    <div>Visit us again at ${escapeHtml(shopName)}</div>
    <div style="margin-top:1mm; font-size:8px; color:#888;">Powered by Gul Son's Shop Manager</div>
  </div>

</div>
</body>
</html>`;

  return html;
}

/**
 * Generate a short test receipt HTML to verify printer connectivity.
 */
function generateTestReceiptHTML(settings = {}) {
  const shopName = settings.shop_name || "Gul Son's";
  const now = new Date().toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Test Print</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: 80mm auto; margin: 0; }
  html, body {
    width: 80mm; margin: 0; padding: 0;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 11px; line-height: 1.3; color: #000; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .receipt { width: 80mm; padding: 4mm 3mm 6mm 3mm; text-align: center; }
  .title { font-size: 16px; font-weight: 900; margin-bottom: 2mm; }
  .divider { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
  .line { font-size: 10px; margin-bottom: 1mm; }
  .check { font-size: 24px; margin: 2mm 0; }
  @media print { html, body { width: 80mm; margin: 0 !important; padding: 0 !important; } }
</style>
</head>
<body>
<div class="receipt">
  <div class="title">${escapeHtml(shopName)}</div>
  <hr class="divider">
  <div class="check">✅</div>
  <div class="line" style="font-size:13px; font-weight:700;">PRINTER TEST</div>
  <div class="line">Connection Successful!</div>
  <hr class="divider">
  <div class="line">${escapeHtml(now)}</div>
  <div class="line">80mm Thermal Printer</div>
  <div class="line">================================</div>
  <div class="line">ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
  <div class="line">0123456789 Rs. 1,234,567</div>
  <div class="line">================================</div>
  <div class="line" style="margin-top:2mm; font-size:8px; color:#888;">Gul Son's Shop Manager</div>
</div>
</body>
</html>`;
}

/* ─── Utilities ─── */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNum(num) {
  return Number(num || 0).toLocaleString('en-PK');
}

module.exports = { generateReceiptHTML, generateTestReceiptHTML };
