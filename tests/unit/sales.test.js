const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('Sales & POS Transactions Module', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  test('should generate sequential formatted invoice numbers', () => {
    const inv1 = ctx.sales.getNextInvoiceNo();
    assert.equal(inv1, 'GS-000001');

    const p = ctx.products.add({ name: 'Kurta', sale_price: 2000, quantity: 10 });
    ctx.sales.create({ customer_name: 'Walk-in Customer' }, [{ product_id: p.id, quantity: 1, price_at_sale: 2000 }]);

    const inv2 = ctx.sales.getNextInvoiceNo();
    assert.equal(inv2, 'GS-000002');
  });

  test('should complete a cash sale, calculate line totals and deduct inventory stock', () => {
    const p1 = ctx.products.add({ name: 'Lawn Suit', purchase_price: 1500, sale_price: 3000, quantity: 20 });
    const p2 = ctx.products.add({ name: 'Perfume 50ml', purchase_price: 1000, sale_price: 2500, quantity: 10 });

    const saleResult = ctx.sales.create({
      customer_name: 'Ahmed Khan',
      customer_phone: '0301-1234567',
      payment_method: 'Cash',
      discount_type: 'flat',
      discount_value: 500,
    }, [
      { product_id: p1.id, quantity: 2, price_at_sale: 3000 }, // 6000
      { product_id: p2.id, quantity: 1, price_at_sale: 2500 }, // 2500
    ]);

    // Subtotal: 8500, Discount: 500 => Total: 8000
    assert.ok(saleResult.saleId > 0);
    assert.equal(saleResult.totalAmount, 8000);

    // Verify stock deducted
    const p1After = ctx.products.get(p1.id);
    const p2After = ctx.products.get(p2.id);
    assert.equal(p1After.quantity, 18, 'Stock for Product 1 should be 20 - 2 = 18');
    assert.equal(p2After.quantity, 9, 'Stock for Product 2 should be 10 - 1 = 9');

    // Verify sale retrieval with items
    const saleRecord = ctx.sales.get(saleResult.saleId);
    assert.equal(saleRecord.customer_name, 'Ahmed Khan');
    assert.equal(saleRecord.total_amount, 8000);
    assert.equal(saleRecord.items.length, 2);
    assert.equal(saleRecord.items[0].purchase_price_at_sale, 1500, 'Must record purchase price snapshot for profit calculation');
  });

  test('should throw error when attempting to buy more stock than available', () => {
    const p = ctx.products.add({ name: 'Limited Edition Attar', sale_price: 5000, quantity: 2 });

    assert.throws(() => {
      ctx.sales.create({ customer_name: 'Customer A' }, [
        { product_id: p.id, quantity: 5, price_at_sale: 5000 }
      ]);
    }, /Insufficient stock for Limited Edition Attar/);

    // Stock should remain unchanged
    const pAfter = ctx.products.get(p.id);
    assert.equal(pAfter.quantity, 2);
  });

  test('should accurately calculate percentage discount and reject discount over 100%', () => {
    const p = ctx.products.add({ name: 'Designer Suit', sale_price: 10000, quantity: 5 });

    // 20% discount on 10000 = 2000 => Total 8000
    const res = ctx.sales.create({
      customer_name: 'Discount User',
      discount_type: 'percentage',
      discount_value: 20
    }, [{ product_id: p.id, quantity: 1, price_at_sale: 10000 }]);

    assert.equal(res.totalAmount, 8000);

    // Reject > 100%
    assert.throws(() => {
      ctx.sales.create({
        customer_name: 'Over Discount User',
        discount_type: 'percentage',
        discount_value: 120
      }, [{ product_id: p.id, quantity: 1, price_at_sale: 10000 }]);
    }, /Percentage discount cannot exceed 100%/);
  });

  test('should record credit / unpaid sale and update customer outstanding balance', () => {
    const p = ctx.products.add({ name: 'Silk Fabric', sale_price: 4000, quantity: 10 });

    const saleRes = ctx.sales.create({
      customer_name: 'Tariq Mehmood',
      customer_phone: '0321-9876543',
      payment_method: 'Credit / Unpaid'
    }, [{ product_id: p.id, quantity: 1, price_at_sale: 4000 }]);

    const customer = ctx.customers.getAll('Tariq Mehmood')[0];
    assert.ok(customer, 'Customer record should be automatically created');
    assert.equal(customer.total_purchases, 4000);
    assert.equal(customer.total_payments, 0, 'No payment recorded for credit sale');
    assert.equal(customer.outstanding_balance, 4000, 'Customer should owe 4000');
    assert.equal(customer.visit_count, 1);
  });

  test('should compute accurate daily and monthly summaries and profits', () => {
    const p1 = ctx.products.add({ name: 'Product A', purchase_price: 1000, sale_price: 1500, quantity: 50 });
    const p2 = ctx.products.add({ name: 'Product B', purchase_price: 2000, sale_price: 3000, quantity: 50 });

    // Sale 1: Profit (1500-1000)*2 = 1000
    ctx.sales.create({ customer_name: 'Customer 1' }, [{ product_id: p1.id, quantity: 2, price_at_sale: 1500 }]);
    // Sale 2: Profit (3000-2000)*1 = 1000
    ctx.sales.create({ customer_name: 'Customer 2' }, [{ product_id: p2.id, quantity: 1, price_at_sale: 3000 }]);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const daily = ctx.sales.getDailySummary(todayStr);
    assert.equal(daily.total_sales, 2);
    assert.equal(daily.total_revenue, 6000); // 3000 + 3000
    assert.equal(daily.total_profit, 2000); // 1000 + 1000

    const monthly = ctx.sales.getMonthlySummary(now.getFullYear(), now.getMonth() + 1);
    assert.equal(monthly.total_sales, 2);
    assert.equal(monthly.total_revenue, 6000);
    assert.equal(monthly.total_profit, 2000);
  });
});
