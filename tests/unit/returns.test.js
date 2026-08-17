const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('Returns & Refund Management Module', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  test('should process a partial product return, auto-restore inventory, and log stock adjustment', () => {
    const p = ctx.products.add({ name: 'Perfume Noir', sale_price: 3000, quantity: 10 });

    // Customer buys 3 items (remaining stock = 7)
    const sale = ctx.sales.create({ customer_name: 'Customer A' }, [
      { product_id: p.id, quantity: 3, price_at_sale: 3000 }
    ]);
    assert.equal(ctx.products.get(p.id).quantity, 7);

    // Customer returns 1 item
    const retResult = ctx.returns.process(sale.saleId, p.id, 1, 'Defective nozzle', null, 'Cash Refund');
    assert.equal(retResult.success, true);
    assert.equal(retResult.refund_amount, 3000);

    // Stock should be automatically restored to 7 + 1 = 8
    assert.equal(ctx.products.get(p.id).quantity, 8);

    // Verify stock adjustment record created
    const adjustments = ctx.db.prepare("SELECT * FROM stock_adjustments WHERE adjustment_type = 'return'").all();
    assert.equal(adjustments.length, 1);
    assert.equal(adjustments[0].quantity, 1);
  });

  test('should prevent returning more quantity than purchased', () => {
    const p = ctx.products.add({ name: 'Silk Dupatta', sale_price: 1500, quantity: 10 });
    const sale = ctx.sales.create({ customer_name: 'Customer B' }, [
      { product_id: p.id, quantity: 2, price_at_sale: 1500 }
    ]);

    // Attempting to return 3 when only 2 were purchased
    assert.throws(() => {
      ctx.returns.process(sale.saleId, p.id, 3, 'Wrong color');
    }, /Cannot return 3 items. Maximum returnable: 2/);
  });

  test('should adjust customer outstanding balance when returning a credit purchase', () => {
    const p = ctx.products.add({ name: 'Cotton Trouser', sale_price: 2000, quantity: 10 });
    const sale = ctx.sales.create({
      customer_name: 'Imran Shah',
      customer_phone: '0345-0000000',
      payment_method: 'Credit / Unpaid'
    }, [{ product_id: p.id, quantity: 2, price_at_sale: 2000 }]);

    let customer = ctx.customers.getAll('Imran Shah')[0];
    assert.equal(customer.outstanding_balance, 4000);

    // Return 1 trouser
    ctx.returns.process(sale.saleId, p.id, 1, 'Size mismatch');

    customer = ctx.customers.get(customer.id);
    assert.equal(customer.outstanding_balance, 2000, 'Balance should reduce by refund amount on credit return');
    assert.equal(customer.total_purchases, 2000);
  });

  test('should process full invoice return and restock all items', () => {
    const p1 = ctx.products.add({ name: 'Item Alpha', sale_price: 1000, quantity: 10 });
    const p2 = ctx.products.add({ name: 'Item Beta', sale_price: 2000, quantity: 10 });

    const sale = ctx.sales.create({ customer_name: 'Full Return Customer' }, [
      { product_id: p1.id, quantity: 2, price_at_sale: 1000 },
      { product_id: p2.id, quantity: 1, price_at_sale: 2000 },
    ]);

    assert.equal(ctx.products.get(p1.id).quantity, 8);
    assert.equal(ctx.products.get(p2.id).quantity, 9);

    const fullRet = ctx.returns.processFullInvoice(sale.saleId, 'Customer cancelled order');
    assert.equal(fullRet.success, true);
    assert.equal(fullRet.totalRefund, 4000); // (2*1000) + (1*2000)

    // Verify both items restocked
    assert.equal(ctx.products.get(p1.id).quantity, 10);
    assert.equal(ctx.products.get(p2.id).quantity, 10);
  });
});
