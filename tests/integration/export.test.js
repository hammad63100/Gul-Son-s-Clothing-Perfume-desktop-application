const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestDb } = require('../helpers/test-db');
const { generateInvoicePDF } = require('../../src/export/pdf');
const { exportReportToExcel } = require('../../src/export/excel');
const { exportAllToExcel } = require('../../src/backup/backup');

test.describe('Export & Document Generation Module', () => {
  let ctx;
  const tempDir = path.join(__dirname, '..', 'temp_output');

  test.beforeEach(async () => {
    ctx = await createTestDb();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  test.afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should generate a valid PDF Invoice file', async () => {
    const pdfPath = path.join(tempDir, 'test_invoice.pdf');
    const saleData = {
      invoice_no: 'GS-000099',
      customer_name: 'Muhammad Tariq',
      customer_phone: '0300-9999999',
      created_at: new Date().toISOString(),
      payment_method: 'Cash',
      subtotal: 5000,
      discount_amount: 500,
      tax_amount: 0,
      total_amount: 4500,
      items: [
        { product_name: 'Sapphire Lawn Shirt', product_size: 'L', product_color: 'Black', quantity: 1, price_at_sale: 2500, line_total: 2500 },
        { product_name: 'Oud Al Layl 100ml', product_size: '100ml', product_color: null, quantity: 1, price_at_sale: 2500, line_total: 2500 },
      ]
    };

    const res = await generateInvoicePDF(saleData, { shop_name: "Gul Son's", currency_symbol: 'Rs.' }, pdfPath);
    assert.equal(res.success, true);
    assert.ok(fs.existsSync(pdfPath), 'PDF file must exist on disk');

    const stats = fs.statSync(pdfPath);
    assert.ok(stats.size > 1000, 'PDF file size must be greater than 1KB');
  });

  test('should generate a valid Excel Report file', async () => {
    const excelPath = path.join(tempDir, 'test_report.xlsx');
    const reportData = {
      total_sales: 10,
      total_revenue: 55000,
      total_profit: 18000,
      total_discounts: 2000,
      unique_customers: 8,
      topProducts: [
        { product_name: 'Cotton Kurta', product_size: 'M', product_color: 'White', total_qty: 15, total_revenue: 30000 }
      ],
      dailyBreakdown: [
        { date: '2026-08-17', sales_count: 10, revenue: 55000 }
      ]
    };

    const res = await exportReportToExcel('daily', reportData, excelPath);
    assert.equal(res.success, true);
    assert.ok(fs.existsSync(excelPath), 'Excel file must exist on disk');

    const stats = fs.statSync(excelPath);
    assert.ok(stats.size > 1000, 'Excel file size must be greater than 1KB');
  });

  test('should export full database backup workbook with multiple sheets', async () => {
    const fullBackupPath = path.join(tempDir, 'test_full_export.xlsx');

    // Populate some data
    const p = ctx.products.add({ name: 'Backup Item', sale_price: 1500, quantity: 10 });
    ctx.sales.create({ customer_name: 'Backup Customer' }, [{ product_id: p.id, quantity: 1, price_at_sale: 1500 }]);

    const res = await exportAllToExcel(ctx.db, fullBackupPath);
    assert.equal(res.success, true);
    assert.ok(fs.existsSync(fullBackupPath));

    const stats = fs.statSync(fullBackupPath);
    assert.ok(stats.size > 2000, 'Full backup Excel file must contain populated sheets and valid size');
  });
});
