const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('App Failure & Resilience Tests', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  // ─────────────────────────────────────────────────────────────
  // Sale Transaction Atomicity (Rollback Guarantee)
  // ─────────────────────────────────────────────────────────────
  test.describe('Transaction Atomicity & Rollback', () => {

    test('should rollback entire sale if second item has insufficient stock', () => {
      const p1 = ctx.products.add({ name: 'In-Stock Shirt', sale_price: 2000, quantity: 10 });
      const p2 = ctx.products.add({ name: 'Empty Perfume', sale_price: 5000, quantity: 0 });

      assert.throws(() => {
        ctx.sales.create({ customer_name: 'Buyer' }, [
          { product_id: p1.id, quantity: 2, price_at_sale: 2000 },
          { product_id: p2.id, quantity: 1, price_at_sale: 5000 },
        ]);
      }, /Insufficient stock/);

      // Nothing should have changed — full rollback
      assert.equal(ctx.products.get(p1.id).quantity, 10, 'First product stock should remain unchanged after rollback');
      assert.equal(ctx.products.get(p2.id).quantity, 0, 'Second product stock should remain 0');
      assert.equal(ctx.sales.getAll().length, 0, 'No sale record should exist');
    });

    test('should rollback sale when discount exceeds 100%', () => {
      const p = ctx.products.add({ name: 'Rollback Test', sale_price: 5000, quantity: 5 });

      assert.throws(() => {
        ctx.sales.create(
          { customer_name: 'Greedy Buyer', discount_type: 'percentage', discount_value: 150 },
          [{ product_id: p.id, quantity: 1, price_at_sale: 5000 }]
        );
      }, /Percentage discount cannot exceed 100%/);

      assert.equal(ctx.products.get(p.id).quantity, 5, 'Stock should not change after failed sale');
      assert.equal(ctx.sales.getAll().length, 0);
    });

    test('should rollback sale when invalid item quantity is provided', () => {
      const p = ctx.products.add({ name: 'Valid Product', sale_price: 1000, quantity: 10 });

      assert.throws(() => {
        ctx.sales.create({ customer_name: 'Bad Qty Buyer' }, [
          { product_id: p.id, quantity: -2, price_at_sale: 1000 },
        ]);
      }, /must be a whole number greater than zero/);

      assert.equal(ctx.products.get(p.id).quantity, 10);
    });

    test('should rollback sale when item price is negative', () => {
      const p = ctx.products.add({ name: 'Negative Price Sale', sale_price: 1000, quantity: 10 });

      assert.throws(() => {
        ctx.sales.create({ customer_name: 'Negative Pricer' }, [
          { product_id: p.id, quantity: 1, price_at_sale: -500 },
        ]);
      }, /must be a valid non-negative number/);

      assert.equal(ctx.products.get(p.id).quantity, 10);
      assert.equal(ctx.sales.getAll().length, 0);
    });

    test('should not create customer record when sale transaction fails', () => {
      const p = ctx.products.add({ name: 'Ghost Customer Item', sale_price: 1000, quantity: 0 });

      assert.throws(() => {
        ctx.sales.create(
          { customer_name: 'Ghost Customer', customer_phone: '0300-9999999', payment_method: 'Credit / Unpaid' },
          [{ product_id: p.id, quantity: 1, price_at_sale: 1000 }]
        );
      }, /Insufficient stock/);

      const customers = ctx.customers.getAll('Ghost Customer');
      assert.equal(customers.length, 0, 'Customer should not be created when sale fails');
    });

    test('should not increment invoice number when sale fails', () => {
      const p = ctx.products.add({ name: 'Invoice Guard', sale_price: 1000, quantity: 0 });

      const invoiceBefore = ctx.sales.getNextInvoiceNo();
      assert.throws(() => {
        ctx.sales.create({ customer_name: 'Failed Sale' }, [
          { product_id: p.id, quantity: 1, price_at_sale: 1000 },
        ]);
      });

      const invoiceAfter = ctx.sales.getNextInvoiceNo();
      assert.equal(invoiceBefore, invoiceAfter, 'Invoice number should not change after failed sale');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Return Process Failure Resilience
  // ─────────────────────────────────────────────────────────────
  test.describe('Return Failure Resilience', () => {

    test('should throw error when processing return for non-existent sale', () => {
      const p = ctx.products.add({ name: 'Return Fail Item', sale_price: 500, quantity: 5 });

      assert.throws(() => {
        ctx.returns.process(99999, p.id, 1, 'Defective');
      }, /Sale not found/);
    });

    test('should throw error when processing return for product not in sale', () => {
      const p1 = ctx.products.add({ name: 'Sold Item', sale_price: 500, quantity: 10 });
      const p2 = ctx.products.add({ name: 'Not Sold', sale_price: 300, quantity: 5 });

      const sale = ctx.sales.create({ customer_name: 'Buyer' }, [
        { product_id: p1.id, quantity: 1, price_at_sale: 500 },
      ]);

      assert.throws(() => {
        ctx.returns.process(sale.saleId, p2.id, 1, 'Wrong product');
      }, /Product not found in this sale/);
    });

    test('should throw error when return quantity exceeds sold quantity', () => {
      const p = ctx.products.add({ name: 'Limited Return', sale_price: 1000, quantity: 10 });
      const sale = ctx.sales.create({ customer_name: 'Return Buyer' }, [
        { product_id: p.id, quantity: 2, price_at_sale: 1000 },
      ]);

      assert.throws(() => {
        ctx.returns.process(sale.saleId, p.id, 5, 'Too many');
      }, /Maximum returnable/);
    });

    test('should throw error for zero or negative return quantity', () => {
      const p = ctx.products.add({ name: 'Zero Return', sale_price: 500, quantity: 10 });
      const sale = ctx.sales.create({ customer_name: 'Returner' }, [
        { product_id: p.id, quantity: 3, price_at_sale: 500 },
      ]);

      assert.throws(() => {
        ctx.returns.process(sale.saleId, p.id, 0, 'Zero qty');
      }, /must be a whole number greater than zero/);

      assert.throws(() => {
        ctx.returns.process(sale.saleId, p.id, -1, 'Negative');
      }, /must be a whole number greater than zero/);
    });

    test('should handle full invoice return on sale with no returnable items', () => {
      const p = ctx.products.add({ name: 'Full Return', sale_price: 800, quantity: 5 });
      const sale = ctx.sales.create({ customer_name: 'Full Returner' }, [
        { product_id: p.id, quantity: 2, price_at_sale: 800 },
      ]);

      // Return everything
      ctx.returns.processFullInvoice(sale.saleId, 'Cancelled');
      // Try again — should succeed but with 0 refund (idempotent)
      const result = ctx.returns.processFullInvoice(sale.saleId, 'Duplicate');
      assert.equal(result.totalRefund, 0, 'Second full return should refund 0');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Null / Missing Data Resilience
  // ─────────────────────────────────────────────────────────────
  test.describe('Null & Missing Data Handling', () => {

    test('should handle sale with empty items array', () => {
      assert.throws(() => {
        ctx.sales.create({ customer_name: 'Empty Cart' }, []);
      }, /must contain at least one item/);
    });

    test('should handle sale with null/undefined saleData', () => {
      assert.throws(() => {
        ctx.sales.create(null, [{ product_id: 1, quantity: 1, price_at_sale: 100 }]);
      }, /Sale details are required/);
    });

    test('should handle getting a non-existent product', () => {
      const result = ctx.products.get(99999);
      assert.equal(result, null, 'Getting non-existent product should return null');
    });

    test('should handle getting a non-existent sale', () => {
      const result = ctx.sales.get(99999);
      assert.equal(result, null, 'Getting non-existent sale should return null');
    });

    test('should handle getting a non-existent customer', () => {
      const result = ctx.customers.get(99999);
      assert.equal(result, null, 'Getting non-existent customer should return null');
    });

    test('should handle customer payment for non-existent customer', () => {
      assert.throws(() => {
        ctx.customers.addPayment(99999, 500, 'Cash', 'Nonexistent');
      }, /Customer not found/);
    });

    test('should handle product update with no fields (empty data)', () => {
      const p = ctx.products.add({ name: 'No Update', sale_price: 500, quantity: 5 });
      const result = ctx.products.update(p.id, {});
      assert.equal(result, null, 'Updating with empty data should return null');
    });

    test('should handle getAll with no data in tables', () => {
      // Fresh database should return empty arrays
      assert.deepEqual(ctx.products.getAll(), []);
      assert.deepEqual(ctx.sales.getAll(), []);
      assert.deepEqual(ctx.returns.getAll(), []);
      assert.deepEqual(ctx.expenses.getAll(), []);
    });

    test('should handle sale with walk-in customer (no customer record created)', () => {
      const p = ctx.products.add({ name: 'Walk-In Item', sale_price: 500, quantity: 10 });

      ctx.sales.create(
        { customer_name: 'Walk-in Customer' },
        [{ product_id: p.id, quantity: 1, price_at_sale: 500 }]
      );

      // Walk-in customers should not create customer records
      const customers = ctx.customers.getAll('Walk-in Customer');
      assert.equal(customers.length, 0, 'Walk-in customer should not be stored');
    });

    test('should handle daily summary for date with no sales', () => {
      const summary = ctx.sales.getDailySummary('1990-01-01');
      assert.equal(summary.total_sales, 0);
      assert.equal(summary.total_revenue, 0);
      assert.equal(summary.total_profit, 0);
    });

    test('should handle monthly summary for month with no sales', () => {
      const summary = ctx.sales.getMonthlySummary(1990, 1);
      assert.equal(summary.total_sales, 0);
      assert.equal(summary.total_revenue, 0);
      assert.equal(summary.total_profit, 0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Data Integrity Under Concurrent-Like Operations
  // ─────────────────────────────────────────────────────────────
  test.describe('Data Integrity Under Rapid Operations', () => {

    test('should maintain correct stock after many rapid sales of the same product', () => {
      const p = ctx.products.add({ name: 'Hot Seller', sale_price: 100, quantity: 100 });

      // Simulate 20 rapid single-item sales
      for (let i = 0; i < 20; i++) {
        ctx.sales.create(
          { customer_name: `Buyer ${i}` },
          [{ product_id: p.id, quantity: 1, price_at_sale: 100 }]
        );
      }

      const after = ctx.products.get(p.id);
      assert.equal(after.quantity, 80, 'Stock should be exactly 100 - 20 = 80');
      assert.equal(ctx.sales.getAll().length, 20, 'Should have exactly 20 sale records');
    });

    test('should generate unique sequential invoice numbers under rapid sales', () => {
      const p = ctx.products.add({ name: 'Rapid Sale', sale_price: 50, quantity: 500 });
      const invoices = new Set();

      for (let i = 0; i < 15; i++) {
        const result = ctx.sales.create(
          { customer_name: `Rapid Buyer ${i}` },
          [{ product_id: p.id, quantity: 1, price_at_sale: 50 }]
        );
        const sale = ctx.sales.get(result.saleId);
        invoices.add(sale.invoice_no);
      }

      assert.equal(invoices.size, 15, 'All 15 invoices must have unique numbers');
    });

    test('should maintain customer balance accuracy across multiple credit sales', () => {
      const p = ctx.products.add({ name: 'Credit Item', sale_price: 1000, quantity: 50 });

      // 5 credit sales to same customer
      for (let i = 0; i < 5; i++) {
        ctx.sales.create(
          { customer_name: 'Repeat Credit', customer_phone: '0300-5555555', payment_method: 'Credit / Unpaid' },
          [{ product_id: p.id, quantity: 1, price_at_sale: 1000 }]
        );
      }

      const customer = ctx.customers.getAll('0300-5555555')[0];
      assert.equal(customer.total_purchases, 5000, 'Total purchases should be 5 * 1000');
      assert.equal(customer.outstanding_balance, 5000, 'Outstanding balance should be 5000');
      assert.equal(customer.visit_count, 5, 'Visit count should be 5');
    });

    test('should maintain stock accuracy through sale-return-sale cycle', () => {
      const p = ctx.products.add({ name: 'Cycle Item', sale_price: 500, quantity: 10 });

      // Sell 3
      const sale1 = ctx.sales.create({ customer_name: 'Cycle Buyer' }, [
        { product_id: p.id, quantity: 3, price_at_sale: 500 },
      ]);
      assert.equal(ctx.products.get(p.id).quantity, 7);

      // Return 2
      ctx.returns.process(sale1.saleId, p.id, 2, 'Changed mind');
      assert.equal(ctx.products.get(p.id).quantity, 9);

      // Sell 4 more
      ctx.sales.create({ customer_name: 'Cycle Buyer 2' }, [
        { product_id: p.id, quantity: 4, price_at_sale: 500 },
      ]);
      assert.equal(ctx.products.get(p.id).quantity, 5);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Edge Cases: Duplicate & Re-entrant Operations
  // ─────────────────────────────────────────────────────────────
  test.describe('Duplicate & Re-entrant Operation Safety', () => {

    test('should handle deleting an already-deleted product gracefully', () => {
      const p = ctx.products.add({ name: 'Double Delete', sale_price: 100, quantity: 5 });
      ctx.products.delete(p.id);
      // Second delete should not throw
      const result = ctx.products.delete(p.id);
      assert.ok(result.success, 'Deleting an already-deleted product should not throw');
    });

    test('should handle updating a soft-deleted product', () => {
      const p = ctx.products.add({ name: 'Update After Delete', sale_price: 100, quantity: 5 });
      ctx.products.delete(p.id);

      // Update should still work (soft-deleted product is still in DB)
      const updated = ctx.products.update(p.id, { sale_price: 200 });
      assert.equal(updated.sale_price, 200);
      assert.equal(updated.is_active, 0, 'Product should still be marked as deleted');
    });

    test('should handle customer search with special regex characters', () => {
      const p = ctx.products.add({ name: 'Test', sale_price: 100, quantity: 10 });
      ctx.sales.create(
        { customer_name: 'Test (Special) [Chars] {Here}', customer_phone: '0300-1111111' },
        [{ product_id: p.id, quantity: 1, price_at_sale: 100 }]
      );

      // Should not throw
      const results = ctx.customers.getAll('(Special)');
      assert.ok(Array.isArray(results));
    });
  });
});
