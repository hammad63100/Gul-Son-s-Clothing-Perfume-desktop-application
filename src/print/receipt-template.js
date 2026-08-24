/**
 * Receipt HTML Template Generator for 80mm Thermal Printers (BT-801 & ESC/POS)
 *
 * Generates a complete self-contained HTML document styled for direct thermal
 * printing via Electron's webContents.print(). High-contrast pure black styling
 * ensures crisp, dark printing on all thermal heads.
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
    const name = item.product_name || 'Item';
    const variant = [item.product_size, item.product_color].filter(Boolean).join(' / ');
    const qtyNum = Number(item.quantity || 1);
    const qtyFormatted = Number.isInteger(qtyNum) ? qtyNum.toString() : parseFloat(qtyNum.toFixed(2)).toString();
    const qtyUnitStr = item.quantity_unit && !['pcs', 'Items', 'items'].includes(item.quantity_unit) ? ` ${item.quantity_unit}` : '';
    const price = Number(item.price_at_sale || 0);
    const lineTotal = item.line_total !== undefined ? Number(item.line_total) : (price * qtyNum);

    return `
      <tr>
        <td class="col-num">${idx + 1}</td>
        <td class="col-item">
          <strong>${escapeHtml(name)}</strong>
          ${variant ? `<br><span class="variant">${escapeHtml(variant)}</span>` : ''}
        </td>
        <td class="col-qty">${qtyFormatted}${qtyUnitStr ? ` ${escapeHtml(qtyUnitStr)}` : ''}</td>
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
      <td>Subtotal:</td>
      <td>${currency} ${formatNum(subtotal)}</td>
    </tr>
  `;

  if (discountAmount > 0) {
    const discLabel = saleData.discount_type === 'percentage'
      ? `Discount (${saleData.discount_value || 0}%):`
      : 'Discount:';
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
        <td>Tax:</td>
        <td>${currency} ${formatNum(taxAmount)}</td>
      </tr>
    `;
  }

  // Customer section
  const customerSection = (customerName || customerPhone) ? `
    <div class="divider-dotted"></div>
    <div class="customer-info">
      ${customerName ? `<div>Customer: <strong>${escapeHtml(customerName)}</strong></div>` : ''}
      ${customerPhone ? `<div>Phone: <strong>${escapeHtml(customerPhone)}</strong></div>` : ''}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt ${invoiceNo}</title>
<style>
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  @page {
    margin: 0;
    size: auto;
  }

  html, body {
    width: 100%;
    max-width: 72mm;
    margin: 0 auto;
    padding: 0;
    font-family: 'Segoe UI', Arial, -apple-system, sans-serif, 'Consolas', monospace;
    font-size: 11.5px;
    line-height: 1.35;
    color: #000000 !important;
    background: #ffffff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .receipt {
    width: 100%;
    max-width: 72mm;
    margin: 0 auto;
    padding: 2mm 1mm 4mm 1mm;
    background: #ffffff !important;
    color: #000000 !important;
  }

  /* ─── Shop Header ─── */
  .shop-header {
    text-align: center;
    padding-bottom: 2mm;
  }
  .shop-name {
    font-size: 17px;
    font-weight: 900;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #000000 !important;
    margin-bottom: 1mm;
  }
  .shop-detail {
    font-size: 10px;
    font-weight: 600;
    color: #000000 !important;
  }

  /* ─── Dividers ─── */
  .divider-solid {
    border: none;
    border-top: 1.5px solid #000000;
    margin: 2mm 0;
  }
  .divider-double {
    border: none;
    border-top: 2.5px solid #000000;
    margin: 2mm 0;
  }
  .divider-dashed {
    border: none;
    border-top: 1px dashed #000000;
    margin: 2mm 0;
  }
  .divider-dotted {
    border: none;
    border-top: 1px dotted #000000;
    margin: 1.5mm 0;
  }

  /* ─── Invoice Info ─── */
  .invoice-title {
    text-align: center;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 1px;
    margin: 1mm 0;
    color: #000000 !important;
  }
  .invoice-info {
    font-size: 10.5px;
    color: #000000 !important;
  }
  .invoice-info div {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5mm;
  }

  /* ─── Customer Info ─── */
  .customer-info {
    font-size: 10.5px;
    padding: 1mm 0;
    color: #000000 !important;
  }
  .customer-info div {
    margin-bottom: 0.5mm;
  }

  /* ─── Items Table ─── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
    margin-top: 1mm;
    color: #000000 !important;
  }
  .items-table thead th {
    text-align: left;
    font-weight: 900;
    font-size: 9.5px;
    padding: 1mm 0.5mm;
    border-bottom: 1.5px solid #000000;
    text-transform: uppercase;
    color: #000000 !important;
  }
  .items-table thead th.col-qty,
  .items-table thead th.col-price,
  .items-table thead th.col-total {
    text-align: right;
  }
  .items-table tbody td {
    padding: 1mm 0.5mm;
    vertical-align: top;
    border-bottom: 1px dashed #000000;
    color: #000000 !important;
  }
  .col-num { width: 5mm; text-align: center; }
  .col-item { }
  .col-qty { width: 8mm; text-align: right; font-weight: 700; }
  .col-price { width: 14mm; text-align: right; }
  .col-total { width: 16mm; text-align: right; font-weight: 800; }
  .variant {
    font-size: 9px;
    font-weight: 600;
    color: #000000 !important;
  }

  /* ─── Totals ─── */
  .totals-table {
    width: 100%;
    font-size: 11px;
    margin-top: 1mm;
    color: #000000 !important;
  }
  .totals-table td {
    padding: 0.6mm 0;
  }
  .totals-table td:last-child {
    text-align: right;
    font-weight: 700;
  }
  .grand-total-row {
    font-size: 14.5px;
    font-weight: 900;
    border-top: 2px solid #000000;
    border-bottom: 2px solid #000000;
    padding: 1.5mm 0 !important;
    color: #000000 !important;
  }

  /* ─── Footer ─── */
  .footer {
    text-align: center;
    font-size: 9.5px;
    font-weight: 600;
    color: #000000 !important;
    padding-top: 2mm;
    line-height: 1.4;
  }
  .footer .thanks {
    font-size: 11.5px;
    font-weight: 800;
    margin-bottom: 1mm;
  }

  @media print {
    html, body {
      width: 100% !important;
      max-width: 72mm !important;
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
    <div><span>Invoice #:</span><strong>${escapeHtml(invoiceNo)}</strong></div>
    <div><span>Date:</span><span>${escapeHtml(createdAt)}</span></div>
    <div><span>Payment:</span><strong>${escapeHtml(paymentMethod)}</strong></div>
  </div>

  ${customerSection}

  <hr class="divider-solid">

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

  <hr class="divider-dashed">

  <!-- Totals -->
  <table class="totals-table">
    ${totalsRows}
    <tr>
      <td class="grand-total-row">TOTAL:</td>
      <td class="grand-total-row">${currency} ${formatNum(totalAmount)}</td>
    </tr>
  </table>

  <hr class="divider-double">

  <!-- Footer -->
  <div class="footer">
    <div class="thanks">Thank you for your visit!</div>
    <div>Goods once sold can be exchanged within 3 days with receipt</div>
    <div style="margin-top:1mm; font-size:8.5px;">Gul Son's Clothing & Perfume</div>
  </div>

</div>
</body>
</html>`;
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
  @page { margin: 0; size: auto; }
  html, body {
    width: 100%; max-width: 72mm; margin: 0 auto; padding: 0;
    font-family: 'Segoe UI', Arial, sans-serif, 'Consolas', monospace;
    font-size: 11.5px; line-height: 1.35; color: #000000 !important; background: #ffffff !important;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  .receipt { width: 100%; max-width: 72mm; padding: 3mm 2mm 5mm 2mm; text-align: center; color: #000000 !important; }
  .title { font-size: 16px; font-weight: 900; margin-bottom: 2mm; text-transform: uppercase; }
  .divider { border: none; border-top: 1.5px solid #000000; margin: 2mm 0; }
  .divider-dashed { border: none; border-top: 1px dashed #000000; margin: 2mm 0; }
  .line { font-size: 10.5px; font-weight: 600; margin-bottom: 1mm; }
  .check { font-size: 20px; font-weight: 900; margin: 2mm 0; }
  @media print { html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; } }
</style>
</head>
<body>
<div class="receipt">
  <div class="title">${escapeHtml(shopName)}</div>
  <hr class="divider">
  <div class="check">[ TEST PRINT OK ]</div>
  <div class="line" style="font-size:13px; font-weight:900;">PRINTER CONNECTION VERIFIED</div>
  <div class="line">80mm Thermal Receipt Ready</div>
  <hr class="divider-dashed">
  <div class="line">Date: ${escapeHtml(now)}</div>
  <div class="line">================================</div>
  <div class="line">1234567890 ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
  <div class="line">Rs. 1,234,567.00 - Standard Test</div>
  <div class="line">================================</div>
  <div class="line" style="margin-top:2mm; font-size:9px;">Gul Son's Shop Manager Desktop</div>
</div>
</body>
</html>`;
}

/**
 * Raast / Digital Transfer Receipt Generator for 80mm Thermal Printers
 */
function generateRaastReceiptHTML(trx, settings = {}) {
  const shopName = settings.shop_name || "Gul Son's";
  const shopAddress = settings.shop_address || '';
  const shopPhone = settings.shop_phone || '';
  const currency = settings.currency_symbol || 'Rs.';

  const isDeposit = trx.transaction_type === 'Cash Deposit';
  const isBill = trx.transaction_type === 'Bill Payment';
  let typeLabel = 'CASH WITHDRAWAL (CASH OUT)';
  let icon = '[OUT]';
  if (isDeposit) {
    typeLabel = 'CASH DEPOSIT (SEND MONEY)';
    icon = '[IN]';
  } else if (isBill) {
    typeLabel = `UTILITY BILL (${escapeHtml(trx.bill_type || 'BILL PAYMENT').toUpperCase()})`;
    icon = '[BILL]';
  }

  const createdAt = trx.created_at
    ? new Date(trx.created_at).toLocaleString('en-PK', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      })
    : new Date().toLocaleString('en-PK', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });

  const slipNo = 'RAAST-' + String(trx.id || 0).padStart(6, '0');
  const amount = Number(trx.amount || 0);
  const fee = Number(trx.fee_amount || 0);
  const total = (isDeposit || isBill) ? (amount + fee) : amount;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Raast Receipt ${slipNo}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @page { margin: 0; size: auto; }
  html, body {
    width: 100%; max-width: 72mm; margin: 0 auto; padding: 0;
    font-family: 'Segoe UI', Arial, sans-serif, 'Consolas', monospace;
    font-size: 11.5px; line-height: 1.35; color: #000000 !important; background: #ffffff !important;
    -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
  }
  .receipt { width: 100%; max-width: 72mm; padding: 2mm 1mm 4mm 1mm; color: #000000 !important; }
  .header { text-align: center; margin-bottom: 2mm; }
  .shop-name { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
  .shop-meta { font-size: 10px; font-weight: 600; margin-top: 1px; }
  .divider { border: none; border-top: 1px dashed #000000; margin: 2mm 0; }
  .double-divider { border: none; border-top: 2px solid #000000; margin: 2mm 0; }
  .badge { text-align: center; font-weight: 900; font-size: 12px; margin: 1.5mm 0; padding: 1mm 0; border: 1.5px solid #000000; }
  .info-row { display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 1mm; }
  .info-label { font-weight: 600; }
  .info-val { font-weight: 800; text-align: right; }
  .amount-box { margin: 2mm 0; padding: 2mm; border: 1.5px solid #000000; text-align: center; }
  .amount-title { font-size: 11px; font-weight: 700; }
  .amount-val { font-size: 17px; font-weight: 900; margin-top: 1mm; }
  .footer { text-align: center; font-size: 9px; font-weight: 600; margin-top: 3mm; }
  @media print { html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; } }
</style>
</head>
<body>
<div class="receipt">
  <div class="header">
    <div class="shop-name">${escapeHtml(shopName)}</div>
    ${shopAddress ? `<div class="shop-meta">${escapeHtml(shopAddress)}</div>` : ''}
    ${shopPhone ? `<div class="shop-meta">Tel: ${escapeHtml(shopPhone)}</div>` : ''}
  </div>

  <div class="double-divider"></div>
  <div class="badge">${icon} ${typeLabel}</div>
  <div class="double-divider"></div>

  <div class="info-row">
    <span class="info-label">Slip #:</span>
    <span class="info-val">${slipNo}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Date:</span>
    <span class="info-val">${escapeHtml(createdAt)}</span>
  </div>
  <div class="info-row">
    <span class="info-label">Service Type:</span>
    <span class="info-val">${escapeHtml(trx.transaction_type)}</span>
  </div>

  <hr class="divider">

  <div class="amount-box">
    <div class="amount-title">${isBill ? 'Bill Amount' : (isDeposit ? 'Deposit Amount' : 'Withdrawal Amount')}</div>
    <div class="amount-val">${currency} ${formatNum(amount)}</div>
  </div>

  <div class="info-row">
    <span class="info-label">Commission Fee / Charge:</span>
    <span class="info-val">${currency} ${formatNum(fee)}</span>
  </div>
  <div class="info-row" style="font-size:12px; font-weight:900; margin-top:1mm;">
    <span class="info-label" style="font-weight:900;">Total ${(isDeposit || isBill) ? 'Collected' : 'Handed Out'}:</span>
    <span class="info-val">${currency} ${formatNum(total)}</span>
  </div>

  <hr class="divider">
  <div class="info-row">
    <span class="info-label">Status:</span>
    <span class="info-val">[COMPLETED]</span>
  </div>

  <div class="footer">
    <div>Thank you for using our digital service!</div>
    <div style="margin-top:1mm;">Computer Generated Customer Slip</div>
    <div style="font-size:8px; margin-top:1mm;">Gul Son's Desktop POS</div>
  </div>
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

module.exports = { generateReceiptHTML, generateTestReceiptHTML, generateRaastReceiptHTML };
