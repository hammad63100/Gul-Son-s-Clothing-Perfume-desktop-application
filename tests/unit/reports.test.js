const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('Reports & Analytics Module', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  test('should generate detailed daily report with sales, revenue, profit, and top products', () => {
    const p1 = ctx.products.add({ name: 'Lawn Shirt M', category: 'Clothes', size: 'M', color: 'Blue', purchase_price: 1000, sale_price: 2000, quantity: 20 });
    const p2 = ctx.products.add({ name: 'Perfume 100ml', category: 'Perfume', size: '100ml', color: 'Gold', purchase_price: 2500, sale_price: 5000, quantity: 10 });

    ctx.sales.create({ customer_name: 'Customer 1', customer_phone: '0300-1111111' }, [
      { product_id: p1.id, quantity: 3, price_at_sale: 2000 }
    ]);
    ctx.sales.create({ customer_name: 'Customer 2', customer_phone: '0300-2222222' }, [
      { product_id: p2.id, quantity: 1, price_at_sale: 5000 }
    ]);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const report = ctx.reports.getDaily(todayStr);
    assert.equal(report.total_sales, 2);
    assert.equal(report.total_revenue, 11000); // (3*2000) + (1*5000)
    // Profit: 3*(2000-1000) + 1*(5000-2500) = 3000 + 2500 = 5500
    assert.equal(report.total_profit, 5500);
    assert.equal(report.unique_customers, 2);
    assert.equal(report.topProducts.length, 2);
    assert.equal(report.topProducts[0].product_name, 'Lawn Shirt M');
    assert.equal(report.topProducts[0].total_qty, 3);
  });

  test('should generate monthly report with daily breakdown', () => {
    const p = ctx.products.add({ name: 'Monthly Item', sale_price: 1500, quantity: 30 });
    ctx.sales.create({ customer_name: 'User 1' }, [{ product_id: p.id, quantity: 2, price_at_sale: 1500 }]);

    const now = new Date();
    const monthlyReport = ctx.reports.getMonthly(now.getFullYear(), now.getMonth() + 1);

    assert.equal(monthlyReport.total_sales, 1);
    assert.equal(monthlyReport.total_revenue, 3000);
    assert.ok(Array.isArray(monthlyReport.dailyBreakdown));
    assert.ok(monthlyReport.dailyBreakdown.length > 0);
  });

  test('should generate category-wise sales and profit report', () => {
    const pClothes = ctx.products.add({ name: 'Kurta', category: 'Clothes', purchase_price: 1000, sale_price: 2000, quantity: 20 });
    const pPerfume = ctx.products.add({ name: 'Attar', category: 'Perfume', purchase_price: 500, sale_price: 1200, quantity: 20 });

    ctx.sales.create({}, [{ product_id: pClothes.id, quantity: 2, price_at_sale: 2000 }]);
    ctx.sales.create({}, [{ product_id: pPerfume.id, quantity: 5, price_at_sale: 1200 }]);

    const catReport = ctx.reports.getCategory();
    assert.equal(catReport.length, 2);

    const perfCat = catReport.find(c => c.category === 'Perfume');
    const clothCat = catReport.find(c => c.category === 'Clothes');

    assert.equal(perfCat.total_qty, 5);
    assert.equal(perfCat.total_revenue, 6000);
    assert.equal(perfCat.total_profit, 3500); // 5 * (1200-500)

    assert.equal(clothCat.total_qty, 2);
    assert.equal(clothCat.total_revenue, 4000);
    assert.equal(clothCat.total_profit, 2000); // 2 * (2000-1000)
  });

  test('should generate size and color variant breakdown report', () => {
    const p1 = ctx.products.add({ name: 'Polo Shirt', size: 'M', color: 'Navy', sale_price: 1500, quantity: 10 });
    const p2 = ctx.products.add({ name: 'Polo Shirt', size: 'L', color: 'Navy', sale_price: 1500, quantity: 10 });

    ctx.sales.create({}, [
      { product_id: p1.id, quantity: 4, price_at_sale: 1500 },
      { product_id: p2.id, quantity: 2, price_at_sale: 1500 },
    ]);

    const variantReport = ctx.reports.getSizeColor();
    assert.ok(variantReport.bySize.length > 0);
    assert.ok(variantReport.byColor.length > 0);

    const navyColor = variantReport.byColor.find(c => c.variant === 'Navy');
    assert.equal(navyColor.total_qty, 6);
  });
});
