const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('Critical business-flow regression tests', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  test('uses an explicitly requested low-stock threshold', () => {
    const low = ctx.products.add({ name: 'Low item', quantity: 2, low_stock_threshold: 1 });
    const high = ctx.products.add({ name: 'High item', quantity: 3, low_stock_threshold: 10 });

    const results = ctx.products.getLowStock(2);
    assert.deepEqual(results.map(product => product.id), [low.id]);
    assert.ok(!results.some(product => product.id === high.id));
  });

  test('rejects invalid sale data without changing stock, customer balances or invoice number', () => {
    const product = ctx.products.add({ name: 'Atomic sale item', sale_price: 1000, quantity: 4 });
    assert.throws(() => ctx.sales.create({ customer_name: 'Ayesha', tax_amount: -1 }, [
      { product_id: product.id, quantity: 1, price_at_sale: 1000 }
    ]), /Tax must be a valid non-negative number/);

    assert.equal(ctx.products.get(product.id).quantity, 4);
    assert.equal(ctx.customers.getAll('Ayesha').length, 0);
    assert.equal(ctx.sales.getNextInvoiceNo(), 'GS-000001');
  });

  test('rejects duplicate cart lines when their combined quantity exceeds stock', () => {
    const product = ctx.products.add({ name: 'One stock item', sale_price: 500, quantity: 3 });
    assert.throws(() => ctx.sales.create({ customer_name: 'Buyer' }, [
      { product_id: product.id, quantity: 2, price_at_sale: 500 },
      { product_id: product.id, quantity: 2, price_at_sale: 500 }
    ]), /Insufficient stock/);

    assert.equal(ctx.products.get(product.id).quantity, 3);
    assert.equal(ctx.sales.getAll().length, 0);
  });

  test('keeps prior khata intact when the same customer makes a later cash purchase', () => {
    const product = ctx.products.add({ name: 'Customer item', sale_price: 2000, quantity: 4 });
    ctx.sales.create({ customer_name: 'Sara', customer_phone: '03001234567', payment_method: 'Credit / Unpaid' }, [
      { product_id: product.id, quantity: 1, price_at_sale: 2000 }
    ]);
    ctx.sales.create({ customer_name: 'Sara New Name', customer_phone: '03001234567', payment_method: 'Cash' }, [
      { product_id: product.id, quantity: 1, price_at_sale: 2000 }
    ]);

    const customers = ctx.customers.getAll('03001234567');
    assert.equal(customers.length, 1);
    assert.equal(customers[0].name, 'Sara New Name');
    assert.equal(customers[0].total_purchases, 4000);
    assert.equal(customers[0].total_payments, 2000);
    assert.equal(customers[0].outstanding_balance, 2000);
  });

  test('prevents a second return after every sold unit has already been returned', () => {
    const product = ctx.products.add({ name: 'Return once', sale_price: 750, quantity: 3 });
    const sale = ctx.sales.create({ customer_name: 'Return customer' }, [
      { product_id: product.id, quantity: 2, price_at_sale: 750 }
    ]);

    ctx.returns.process(sale.saleId, product.id, 2, 'Changed mind');
    assert.throws(() => ctx.returns.process(sale.saleId, product.id, 1, 'Second try'), /Maximum returnable: 0/);
    assert.equal(ctx.products.get(product.id).quantity, 3);
    assert.equal(ctx.returns.getAll().length, 1);
  });

  test('makes a full-invoice return safe to run again without duplicate refunds or stock', () => {
    const product = ctx.products.add({ name: 'Idempotent return', sale_price: 900, quantity: 2 });
    const sale = ctx.sales.create({ customer_name: 'Return customer' }, [
      { product_id: product.id, quantity: 2, price_at_sale: 900 }
    ]);

    assert.equal(ctx.returns.processFullInvoice(sale.saleId, 'Cancelled').totalRefund, 1800);
    assert.equal(ctx.returns.processFullInvoice(sale.saleId, 'Cancelled').totalRefund, 0);
    assert.equal(ctx.products.get(product.id).quantity, 2);
    assert.equal(ctx.returns.getAll().length, 1);
  });
});
