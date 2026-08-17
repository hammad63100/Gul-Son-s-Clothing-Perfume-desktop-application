const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('Performance & Stress Tests', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  // ─────────────────────────────────────────────────────────────
  // Bulk Data Insertion Performance
  // ─────────────────────────────────────────────────────────────
  test.describe('Bulk Data Insertion', () => {

    test('should add 500 products within a reasonable time', () => {
      const start = Date.now();

      for (let i = 0; i < 500; i++) {
        ctx.products.add({
          name: `Performance Product ${i}`,
          category: i % 2 === 0 ? 'Clothes' : 'Perfume',
          brand: `Brand ${i % 20}`,
          size: ['S', 'M', 'L', 'XL'][i % 4],
          color: ['Red', 'Blue', 'Black', 'White', 'Green'][i % 5],
          sale_price: 500 + (i * 10),
          purchase_price: 300 + (i * 5),
          quantity: 10 + (i % 50),
          barcode: `PERF-${String(i).padStart(6, '0')}`,
        });
      }

      const elapsed = Date.now() - start;
      const allProducts = ctx.products.getAll();
      assert.equal(allProducts.length, 500, 'Should have exactly 500 products');
      assert.ok(elapsed < 15000, `Adding 500 products took ${elapsed}ms — expected under 15 seconds`);
    });

    test('should add 200 expenses within a reasonable time', () => {
      const start = Date.now();

      for (let i = 0; i < 200; i++) {
        ctx.expenses.add({
          title: `Expense ${i}`,
          category: ['Shop Rent', 'Electricity', 'Salary', 'Transport'][i % 4],
          amount: 500 + (i * 10),
          date: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
          payment_method: i % 2 === 0 ? 'Cash' : 'Bank Transfer',
        });
      }

      const elapsed = Date.now() - start;
      const allExpenses = ctx.expenses.getAll();
      assert.equal(allExpenses.length, 200);
      assert.ok(elapsed < 10000, `Adding 200 expenses took ${elapsed}ms — expected under 10 seconds`);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Bulk Sales Processing Performance
  // ─────────────────────────────────────────────────────────────
  test.describe('Bulk Sales Processing', () => {

    test('should process 100 sales transactions within a reasonable time', () => {
      // Create products first
      const products = [];
      for (let i = 0; i < 10; i++) {
        products.push(
          ctx.products.add({
            name: `Sale Product ${i}`,
            sale_price: 1000 + (i * 100),
            purchase_price: 500 + (i * 50),
            quantity: 1000, // Large stock
          })
        );
      }

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        const p = products[i % 10];
        ctx.sales.create(
          {
            customer_name: `Customer ${i}`,
            payment_method: i % 3 === 0 ? 'Credit / Unpaid' : 'Cash',
          },
          [{ product_id: p.id, quantity: 1, price_at_sale: 1000 + ((i % 10) * 100) }]
        );
      }

      const elapsed = Date.now() - start;
      assert.equal(ctx.sales.getAll().length, 100, 'Should have 100 sales');
      assert.ok(elapsed < 30000, `100 sales took ${elapsed}ms — expected under 30 seconds`);
    });

    test('should handle multi-item sales efficiently', () => {
      const products = [];
      for (let i = 0; i < 5; i++) {
        products.push(
          ctx.products.add({
            name: `Multi Item Product ${i}`,
            sale_price: 500,
            purchase_price: 300,
            quantity: 500,
          })
        );
      }

      const start = Date.now();

      for (let i = 0; i < 50; i++) {
        const items = products.map((p, idx) => ({
          product_id: p.id,
          quantity: 1,
          price_at_sale: 500,
        }));

        ctx.sales.create(
          { customer_name: `Multi Buyer ${i}` },
          items
        );
      }

      const elapsed = Date.now() - start;
      assert.equal(ctx.sales.getAll().length, 50, 'Should have 50 multi-item sales');

      // Each sale has 5 items, 50 sales = 250 units per product sold
      for (const p of products) {
        assert.equal(ctx.products.get(p.id).quantity, 450, `Each product should have 500 - 50 = 450 remaining`);
      }

      assert.ok(elapsed < 30000, `50 multi-item sales took ${elapsed}ms — expected under 30 seconds`);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Query Performance Under Load
  // ─────────────────────────────────────────────────────────────
  test.describe('Query Performance Under Load', () => {

    test('should search products efficiently with 300 records', () => {
      // Seed 300 products
      for (let i = 0; i < 300; i++) {
        ctx.products.add({
          name: `Item ${i} - ${i % 2 === 0 ? 'Sapphire Lawn' : 'Gul Ahmed Silk'}`,
          category: i % 3 === 0 ? 'Perfume' : 'Clothes',
          size: ['S', 'M', 'L', 'XL'][i % 4],
          color: ['White', 'Black', 'Red'][i % 3],
          sale_price: 1000 + i,
          quantity: 10 + i,
          barcode: `SEARCH-${String(i).padStart(4, '0')}`,
        });
      }

      const start = Date.now();

      // Run various filter combinations
      const byName = ctx.products.getAll({ search: 'Sapphire' });
      const byCategory = ctx.products.getAll({ category: 'Perfume' });
      const lowStock = ctx.products.getAll({ lowStock: true });
      const bySize = ctx.products.getAll({ size: 'L' });
      const byColor = ctx.products.getAll({ color: 'Black' });
      const byBarcode = ctx.products.getAll({ search: 'SEARCH-0100' });

      const elapsed = Date.now() - start;

      assert.ok(byName.length > 0, 'Name search should return results');
      assert.ok(byCategory.length > 0, 'Category filter should return results');
      assert.ok(bySize.length > 0, 'Size filter should return results');
      assert.ok(byColor.length > 0, 'Color filter should return results');
      assert.ok(elapsed < 5000, `6 searches took ${elapsed}ms — expected under 5 seconds`);
    });

    test('should retrieve sales summary efficiently with 200 sales', () => {
      // Create product
      const p = ctx.products.add({ name: 'Summary Product', sale_price: 1000, purchase_price: 500, quantity: 5000 });

      // Create 200 sales
      for (let i = 0; i < 200; i++) {
        ctx.sales.create(
          { customer_name: `Summary Buyer ${i}` },
          [{ product_id: p.id, quantity: 1, price_at_sale: 1000 }]
        );
      }

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const start = Date.now();
      const daily = ctx.sales.getDailySummary(todayStr);
      const monthly = ctx.sales.getMonthlySummary(now.getFullYear(), now.getMonth() + 1);
      const elapsed = Date.now() - start;

      assert.equal(daily.total_sales, 200);
      assert.equal(daily.total_revenue, 200000);
      assert.equal(monthly.total_sales, 200);
      assert.ok(elapsed < 10000, `Summary queries took ${elapsed}ms — expected under 10 seconds`);
    });

    test('should search sales efficiently with various filter combinations', () => {
      const p = ctx.products.add({ name: 'Search Sale', sale_price: 500, purchase_price: 250, quantity: 5000 });

      for (let i = 0; i < 100; i++) {
        ctx.sales.create(
          {
            customer_name: `Search Customer ${i}`,
            customer_phone: `0300-${String(1000000 + i).padStart(7, '0')}`,
          },
          [{ product_id: p.id, quantity: 1, price_at_sale: 500 }]
        );
      }

      const start = Date.now();

      const byName = ctx.sales.getAll({ search: 'Search Customer 50' });
      const byInvoice = ctx.sales.getAll({ search: 'GS-000050' });
      const byPhone = ctx.sales.getAll({ search: '0300-1000050' });
      const limited = ctx.sales.getAll({ limit: 10 });

      const elapsed = Date.now() - start;

      assert.ok(byName.length >= 1, 'Search by customer name should find results');
      assert.equal(limited.length, 10, 'Limit should restrict result count');
      assert.ok(elapsed < 5000, `4 sales searches took ${elapsed}ms — expected under 5 seconds`);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Customer Ledger Performance
  // ─────────────────────────────────────────────────────────────
  test.describe('Customer Ledger Performance', () => {

    test('should generate ledger for a customer with 50+ transactions', () => {
      const p = ctx.products.add({ name: 'Ledger Item', sale_price: 1000, purchase_price: 500, quantity: 5000 });

      // Create 50 credit sales to same customer
      for (let i = 0; i < 50; i++) {
        ctx.sales.create(
          { customer_name: 'Ledger Customer', customer_phone: '0300-7777777', payment_method: 'Credit / Unpaid' },
          [{ product_id: p.id, quantity: 1, price_at_sale: 1000 }]
        );
      }

      const customer = ctx.customers.getAll('0300-7777777')[0];
      assert.ok(customer, 'Customer should exist');
      assert.equal(customer.outstanding_balance, 50000, 'Outstanding balance should be 50 * 1000');

      // Make 10 payments
      for (let i = 0; i < 10; i++) {
        ctx.customers.addPayment(customer.id, 1000, 'Cash', `Payment ${i}`);
      }

      const start = Date.now();
      const ledger = ctx.customers.getLedger(customer.id);
      const elapsed = Date.now() - start;

      assert.ok(ledger.length >= 60, `Ledger should have at least 60 entries (50 sales + 10 payments), got ${ledger.length}`);
      assert.ok(elapsed < 5000, `Ledger generation took ${elapsed}ms — expected under 5 seconds`);

      // Verify running balance is correct
      // Latest entry should reflect the current balance
      const latestEntry = ledger[0]; // Newest first
      assert.equal(latestEntry.balance, 40000, 'Final balance should be 50000 - 10000 = 40000');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Report Generation Performance
  // ─────────────────────────────────────────────────────────────
  test.describe('Report Generation Performance', () => {

    test('should generate top-selling products report efficiently', () => {
      // Create 20 products
      const products = [];
      for (let i = 0; i < 20; i++) {
        products.push(
          ctx.products.add({
            name: `Report Product ${i}`,
            category: i % 2 === 0 ? 'Clothes' : 'Perfume',
            sale_price: 500 + (i * 100),
            purchase_price: 300 + (i * 50),
            quantity: 1000,
          })
        );
      }

      // Create 100 sales spread across products
      for (let i = 0; i < 100; i++) {
        const p = products[i % 20];
        ctx.sales.create(
          { customer_name: `Report Buyer ${i}` },
          [{ product_id: p.id, quantity: 1 + (i % 3), price_at_sale: 500 + ((i % 20) * 100) }]
        );
      }

      const start = Date.now();
      const topSelling = ctx.products.getTopSelling(10, {});
      const elapsed = Date.now() - start;

      assert.ok(topSelling.length <= 10, 'Should return at most 10 top sellers');
      assert.ok(topSelling.length > 0, 'Should have some top sellers');
      assert.ok(topSelling[0].total_sold >= topSelling[topSelling.length - 1].total_sold, 'Results should be sorted desc');
      assert.ok(elapsed < 5000, `Top selling query took ${elapsed}ms — expected under 5 seconds`);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Memory / Stability — Repeated Operations
  // ─────────────────────────────────────────────────────────────
  test.describe('Stability Under Repeated Operations', () => {

    test('should survive 50 create-and-delete product cycles without crashing', () => {
      for (let i = 0; i < 50; i++) {
        const p = ctx.products.add({ name: `Cycle Product ${i}`, sale_price: 100, quantity: 5 });
        ctx.products.delete(p.id);
      }

      const active = ctx.products.getAll();
      assert.equal(active.length, 0, 'All products should be soft-deleted');
    });

    test('should survive 30 sale-and-return cycles without data corruption', () => {
      const p = ctx.products.add({ name: 'Cycle Item', sale_price: 1000, purchase_price: 500, quantity: 1000 });

      for (let i = 0; i < 30; i++) {
        const sale = ctx.sales.create(
          { customer_name: `Cycle Customer ${i}` },
          [{ product_id: p.id, quantity: 2, price_at_sale: 1000 }]
        );

        // Return 1 of the 2 items
        ctx.returns.process(sale.saleId, p.id, 1, `Return round ${i}`);
      }

      // 30 sales of 2 each = 60 sold, 30 returned = 30 net deducted
      const product = ctx.products.get(p.id);
      assert.equal(product.quantity, 970, 'Stock should be 1000 - 30*2 + 30*1 = 970');
      assert.equal(ctx.sales.getAll().length, 30);
      assert.equal(ctx.returns.getAll().length, 30);
    });

    test('should handle creating 100 customers through sales without issues', () => {
      const p = ctx.products.add({ name: 'Customer Test', sale_price: 100, quantity: 5000 });

      for (let i = 0; i < 100; i++) {
        ctx.sales.create(
          { customer_name: `Unique Customer ${i}`, customer_phone: `0300-${String(2000000 + i)}` },
          [{ product_id: p.id, quantity: 1, price_at_sale: 100 }]
        );
      }

      const allCustomers = ctx.customers.getAll();
      assert.equal(allCustomers.length, 100, 'Should have exactly 100 unique customers');
    });
  });
});
