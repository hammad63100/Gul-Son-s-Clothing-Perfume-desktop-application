const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function generateInvoicePDF(saleData, settings = {}, filePath) {
  return new Promise((resolve, reject) => {
    try {
      if (!filePath) {
        return reject(new Error('Target file path is required for PDF generation'));
      }

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Invoice ${saleData.invoice_no || ''}`,
          Author: settings.shop_name || "Gul Son's",
        },
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const currency = settings.currency_symbol || 'Rs.';
      const pageWidth = doc.page.width - 80;

      // ─── Header ───
      doc.fontSize(22).font('Helvetica-Bold')
        .text(settings.shop_name || "Gul Son's", { align: 'center' });

      if (settings.shop_address) {
        doc.fontSize(10).font('Helvetica')
          .text(settings.shop_address, { align: 'center' });
      }
      if (settings.shop_phone) {
        doc.fontSize(10).font('Helvetica')
          .text(`Phone: ${settings.shop_phone}`, { align: 'center' });
      }

      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke('#cccccc');
      doc.moveDown(0.5);

      // ─── Invoice Title & Info ───
      doc.fontSize(14).font('Helvetica-Bold')
        .text('RETAIL SALES INVOICE', { align: 'center' });
      doc.moveDown(0.3);

      const infoY = doc.y;
      doc.fontSize(10).font('Helvetica');
      doc.text(`Invoice No: ${saleData.invoice_no || '-'}`, 40, infoY);
      doc.text(`Date: ${saleData.created_at ? new Date(saleData.created_at).toLocaleString() : new Date().toLocaleString()}`, 40);
      doc.text(`Payment Method: ${saleData.payment_method || 'Cash'}`, 40);

      if (saleData.customer_name || saleData.customer_phone) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Customer Details:', 40);
        doc.font('Helvetica');
        if (saleData.customer_name) doc.text(`Name: ${saleData.customer_name}`, 40);
        if (saleData.customer_phone) doc.text(`Phone: ${saleData.customer_phone}`, 40);
      }

      doc.moveDown(1);

      // ─── Table Headers ───
      const tableTop = doc.y;
      const colWidths = [30, 180, 80, 50, 65, 75];
      const headers = ['#', 'Product', 'Variant', 'Qty', 'Price', 'Total'];

      doc.fillColor('#1a1a2e').rect(40, tableTop, pageWidth, 22).fill();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);

      let xPos = 45;
      headers.forEach((h, i) => {
        doc.text(h, xPos, tableTop + 6, { width: colWidths[i], align: i >= 3 ? 'right' : 'left' });
        xPos += colWidths[i];
      });

      // ─── Table Items ───
      doc.fillColor('#000000').font('Helvetica').fontSize(9);
      let rowY = tableTop + 26;
      const items = saleData.items || [];

      items.forEach((item, index) => {
        if (rowY > doc.page.height - 120) {
          doc.addPage();
          rowY = 40;
        }

        const bgColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
        doc.fillColor(bgColor).rect(40, rowY - 2, pageWidth, 18).fill();
        doc.fillColor('#000000');

        xPos = 45;
        const variantStr = [item.product_size, item.product_color].filter(Boolean).join(' / ') || '-';
        const rowData = [
          String(index + 1),
          String(item.product_name || 'Unknown'),
          String(variantStr),
          String(item.quantity || 1),
          `${currency} ${(item.price_at_sale || 0).toLocaleString()}`,
          `${currency} ${(item.line_total || 0).toLocaleString()}`,
        ];

        rowData.forEach((cell, i) => {
          doc.text(cell, xPos, rowY, { width: colWidths[i], align: i >= 3 ? 'right' : 'left' });
          xPos += colWidths[i];
        });

        rowY += 20;
      });

      // ─── Totals Breakdown ───
      rowY += 10;
      const totalsX = 320;

      doc.moveTo(40, rowY).lineTo(doc.page.width - 40, rowY).stroke('#cccccc');
      rowY += 10;

      doc.font('Helvetica').fontSize(10);
      doc.text('Subtotal:', totalsX, rowY);
      doc.text(`${currency} ${(saleData.subtotal || 0).toLocaleString()}`, totalsX + 100, rowY, { align: 'right', width: 100 });
      rowY += 18;

      if (saleData.discount_amount > 0) {
        doc.text('Discount:', totalsX, rowY);
        doc.text(`- ${currency} ${(saleData.discount_amount || 0).toLocaleString()}`, totalsX + 100, rowY, { align: 'right', width: 100 });
        rowY += 18;
      }

      if (saleData.tax_amount > 0) {
        doc.text('Tax:', totalsX, rowY);
        doc.text(`${currency} ${(saleData.tax_amount || 0).toLocaleString()}`, totalsX + 100, rowY, { align: 'right', width: 100 });
        rowY += 18;
      }

      doc.font('Helvetica-Bold').fontSize(12);
      doc.fillColor('#1a1a2e').rect(totalsX - 5, rowY, 210, 24).fill();
      doc.fillColor('#ffffff');
      doc.text('TOTAL PAID:', totalsX, rowY + 5);
      doc.text(`${currency} ${(saleData.total_amount || 0).toLocaleString()}`, totalsX + 100, rowY + 5, { align: 'right', width: 100 });

      // ─── Footer Message ───
      doc.fillColor('#888888').font('Helvetica').fontSize(8);
      doc.text('Thank you for shopping at ' + (settings.shop_name || "Gul Son's") + '!', 40, doc.page.height - 50, {
        align: 'center',
        width: pageWidth,
      });

      doc.end();

      stream.on('finish', () => resolve({ success: true, path: filePath }));
      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePDF };
