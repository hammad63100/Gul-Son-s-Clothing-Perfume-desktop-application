const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('Customers & Khata Ledger Module', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  test('should create customer and fetch customer details with code format', () => {
    const p = ctx.products.add({ name: 'Shalwar Kameez', sale_price: 3500, quantity: 10 });
    ctx.sales.create({
      customer_name: 'Usman Ali',
      customer_phone: '0300-1122334',
      payment_method: 'Cash'
    }, [{ product_id: p.id, quantity: 1, price_at_sale: 3500 }]);

    const customers = ctx.customers.getAll('Usman');
    assert.equal(customers.length, 1);
    assert.match(customers[0].customer_code, /^CUST-\d{4}$/);

    const detail = ctx.customers.get(customers[0].id);
    assert.equal(detail.name, 'Usman Ali');
    assert.equal(detail.purchases.length, 1);
  });

  test('should handle khata credit payments, update total_payments and reduce outstanding_balance', () => {
    const p = ctx.products.add({ name: 'Sherwani', sale_price: 15000, quantity: 5 });

    // Customer buys on credit
    ctx.sales.create({
      customer_name: 'Bilal Farooq',
      customer_phone: '0333-5555555',
      payment_method: 'Credit / Unpaid'
    }, [{ product_id: p.id, quantity: 1, price_at_sale: 15000 }]);

    let customer = ctx.customers.getAll('Bilal Farooq')[0];
    assert.equal(customer.outstanding_balance, 15000);
    assert.equal(customer.total_payments, 0);

    // Customer makes a partial payment of 5000
    ctx.customers.addPayment(customer.id, 5000, 'Cash', 'Installment 1');

    customer = ctx.customers.get(customer.id);
    assert.equal(customer.outstanding_balance, 10000);
    assert.equal(customer.total_payments, 5000);
    assert.equal(customer.payments.length, 1);
    assert.equal(customer.payments[0].amount, 5000);

    // Customer pays remaining 10000
    ctx.customers.addPayment(customer.id, 10000, 'Bank Transfer', 'Final Clearance');
    customer = ctx.customers.get(customer.id);
    assert.equal(customer.outstanding_balance, 0);
    assert.equal(customer.total_payments, 15000);
  });

  test('should reject payments that are zero, negative, or exceed outstanding balance', () => {
    const p = ctx.products.add({ name: 'Waistcoat', sale_price: 4000, quantity: 5 });
    ctx.sales.create({
      customer_name: 'Kamran Akmal',
      payment_method: 'Credit / Unpaid'
    }, [{ product_id: p.id, quantity: 1, price_at_sale: 4000 }]);

    const customer = ctx.customers.getAll('Kamran')[0];

    // Reject negative payment
    assert.throws(() => {
      ctx.customers.addPayment(customer.id, -100, 'Cash', 'Invalid');
    }, /Payment amount must be greater than zero/);

    // Reject overpayment
    assert.throws(() => {
      ctx.customers.addPayment(customer.id, 6000, 'Cash', 'Too much');
    }, /Payment cannot exceed the outstanding balance/);
  });

  test('should generate an accurate running ledger with debits, credits, and balances', () => {
    const p1 = ctx.products.add({ name: 'Item 1', sale_price: 2000, quantity: 10 });
    const p2 = ctx.products.add({ name: 'Item 2', sale_price: 3000, quantity: 10 });

    // Purchase 1 (Credit Rs. 2000)
    ctx.sales.create({ customer_name: 'Zahid Khan', payment_method: 'Credit / Unpaid' }, [
      { product_id: p1.id, quantity: 1, price_at_sale: 2000 }
    ]);

    // Purchase 2 (Credit Rs. 3000)
    ctx.sales.create({ customer_name: 'Zahid Khan', payment_method: 'Credit / Unpaid' }, [
      { product_id: p2.id, quantity: 1, price_at_sale: 3000 }
    ]);

    const cust = ctx.customers.getAll('Zahid Khan')[0];

    // Payment of Rs. 1500
    ctx.customers.addPayment(cust.id, 1500, 'Cash', 'Partial Cash');

    const ledger = ctx.customers.getLedger(cust.id);
    assert.equal(ledger.length, 3, 'Ledger should have 2 purchases and 1 payment');

    // The ledger returns newest first (reverse chronological)
    // Oldest was purchase 2000 (balance 2000)
    // Next was purchase 3000 (balance 5000)
    // Most recent was payment 1500 (balance 3500)
    const latestEntry = ledger[0];
    assert.equal(latestEntry.type, 'Payment');
    assert.equal(latestEntry.amount_credit, 1500);
    assert.equal(latestEntry.balance, 3500);
  });
});
