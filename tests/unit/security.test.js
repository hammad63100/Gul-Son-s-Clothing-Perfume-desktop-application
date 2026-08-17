const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('Security & Input Sanitization Tests', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  // ─────────────────────────────────────────────────────────────
  // SQL Injection Prevention
  // ─────────────────────────────────────────────────────────────
  test.describe('SQL Injection Prevention', () => {

    test('should safely handle SQL injection in product name', () => {
      // Classic SQL injection payloads — none should break the query or delete data
      const maliciousNames = [
        "'; DROP TABLE products; --",
        "1' OR '1'='1",
        "' UNION SELECT * FROM settings --",
        "Robert'); DROP TABLE sales;--",
        "'; UPDATE products SET sale_price=0 WHERE '1'='1",
      ];

      for (const name of maliciousNames) {
        const product = ctx.products.add({ name, sale_price: 100, quantity: 1 });
        assert.ok(product.id > 0, `Product with SQL injection name should be stored safely`);
        const fetched = ctx.products.get(product.id);
        assert.equal(fetched.name, name, 'SQL payload should be stored as literal string, not executed');
      }

      // Verify the products table still exists and is intact
      const all = ctx.products.getAll();
      assert.equal(all.length, maliciousNames.length, 'All products with SQL payloads should exist');
    });

    test('should safely handle SQL injection in search filters', () => {
      ctx.products.add({ name: 'Normal Shirt', sale_price: 500, quantity: 10 });

      const injectionSearches = [
        "' OR 1=1 --",
        "'; DROP TABLE products; --",
        "' UNION SELECT password FROM users --",
        "%' OR '1'='1",
      ];

      for (const search of injectionSearches) {
        // Should not throw or return all records
        const results = ctx.products.getAll({ search });
        assert.ok(Array.isArray(results), 'Search with injection payload should return an array');
      }

      // Verify DB is intact
      const all = ctx.products.getAll();
      assert.equal(all.length, 1, 'Original product should still exist after injection attempts');
    });

    test('should safely handle SQL injection in customer name during sale', () => {
      const p = ctx.products.add({ name: 'Test Item', sale_price: 100, quantity: 10 });

      const result = ctx.sales.create(
        { customer_name: "'; DELETE FROM customers; --", customer_phone: '0300-0000000' },
        [{ product_id: p.id, quantity: 1, price_at_sale: 100 }]
      );

      assert.ok(result.saleId > 0);
      const sale = ctx.sales.get(result.saleId);
      assert.equal(sale.customer_name, "'; DELETE FROM customers; --");
    });

    test('should safely handle SQL injection in expense fields', () => {
      const expense = ctx.expenses.add({
        title: "'; DROP TABLE expenses; --",
        category: "' UNION SELECT * FROM settings --",
        amount: 1000,
        date: '2026-08-17',
        payment_method: 'Cash',
      });

      assert.ok(expense, 'Expense with SQL payload in title should be created safely');
      const all = ctx.expenses.getAll();
      assert.ok(all.length >= 1);
    });

    test('should safely handle SQL injection in supplier fields', () => {
      const supplier = ctx.suppliers.add({
        name: "'; DROP TABLE suppliers; --",
        company: "' OR '1'='1",
        phone: "0300'; --",
      });

      assert.ok(supplier, 'Supplier with SQL injection payload should be created safely');
    });

    test('should safely handle SQL injection in sales search', () => {
      const p = ctx.products.add({ name: 'Item', sale_price: 100, quantity: 10 });
      ctx.sales.create({ customer_name: 'Normal Customer' }, [{ product_id: p.id, quantity: 1, price_at_sale: 100 }]);

      const results = ctx.sales.getAll({ search: "' OR 1=1 --" });
      assert.ok(Array.isArray(results));
    });

    test('should safely handle SQL injection in returns search', () => {
      const results = ctx.returns.getAll({ search: "'; DROP TABLE returns; --" });
      assert.ok(Array.isArray(results));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // XSS / Script Injection in Data Fields
  // ─────────────────────────────────────────────────────────────
  test.describe('XSS & Script Injection Handling', () => {

    test('should store HTML/script payloads as literal text in product fields', () => {
      const xssPayloads = {
        name: '<script>alert("xss")</script>Shirt',
        brand: '<img src=x onerror=alert(1)>',
        color: '"><script>document.cookie</script>',
        fabric: '<svg onload=alert("hack")>',
        supplier: 'javascript:alert(1)',
      };

      const product = ctx.products.add({
        ...xssPayloads,
        sale_price: 100,
        quantity: 5,
      });

      const fetched = ctx.products.get(product.id);
      assert.equal(fetched.name, xssPayloads.name, 'Script tag should be stored as literal text');
      assert.equal(fetched.brand, xssPayloads.brand, 'Img tag injection should be stored literally');
      assert.equal(fetched.color, xssPayloads.color, 'Escaped script should be stored literally');
    });

    test('should store XSS payloads in customer name without execution', () => {
      const p = ctx.products.add({ name: 'Safe Product', sale_price: 100, quantity: 10 });

      ctx.sales.create(
        { customer_name: '<script>steal(cookies)</script>Ali', customer_phone: '03001111111', payment_method: 'Credit / Unpaid' },
        [{ product_id: p.id, quantity: 1, price_at_sale: 100 }]
      );

      const customers = ctx.customers.getAll('<script>');
      assert.ok(customers.length >= 1, 'Customer with script tag name should be stored');
      assert.ok(customers[0].name.includes('<script>'), 'Name should contain literal script tag');
    });

    test('should store XSS payloads in settings values safely', () => {
      ctx.settings.update({ shop_name: '<script>alert("hacked")</script>' });
      const settings = ctx.settings.get();
      assert.equal(settings.shop_name, '<script>alert("hacked")</script>');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Extreme & Boundary Value Attacks
  // ─────────────────────────────────────────────────────────────
  test.describe('Boundary Value & Type Coercion Attacks', () => {

    test('should reject negative prices disguised as strings', () => {
      assert.throws(() => {
        ctx.products.add({ name: 'Negative Price', sale_price: '-500', quantity: 1 });
      }, /must be a valid non-negative number/);
    });

    test('should reject NaN, Infinity, and undefined prices', () => {
      assert.throws(() => {
        ctx.products.add({ name: 'NaN Price', sale_price: NaN, quantity: 1 });
      }, /must be a valid non-negative number/);

      assert.throws(() => {
        ctx.products.add({ name: 'Infinity Price', sale_price: Infinity, quantity: 1 });
      }, /must be a valid non-negative number/);
    });

    test('should reject fractional quantity even when passed as string', () => {
      assert.throws(() => {
        ctx.products.add({ name: 'String Fraction', sale_price: 100, quantity: '3.7' });
      }, /Quantity must be a whole number/);
    });

    test('should handle extremely large numeric values without crashing', () => {
      // Number.MAX_SAFE_INTEGER = 9007199254740991
      const p = ctx.products.add({
        name: 'Huge Price Item',
        sale_price: 999999999,
        purchase_price: 888888888,
        quantity: 1000000,
      });

      const fetched = ctx.products.get(p.id);
      assert.equal(fetched.sale_price, 999999999);
      assert.equal(fetched.quantity, 1000000);
    });

    test('should handle zero-value sale gracefully', () => {
      const p = ctx.products.add({ name: 'Free Sample', sale_price: 0, purchase_price: 0, quantity: 10 });

      const result = ctx.sales.create(
        { customer_name: 'Freebie Customer' },
        [{ product_id: p.id, quantity: 1, price_at_sale: 0 }]
      );

      assert.equal(result.totalAmount, 0);
      assert.equal(ctx.products.get(p.id).quantity, 9);
    });

    test('should reject empty string as product name', () => {
      assert.throws(() => ctx.products.add({ name: '', sale_price: 100 }), /Product name is required/);
    });

    test('should reject whitespace-only product name', () => {
      assert.throws(() => ctx.products.add({ name: '   ', sale_price: 100 }), /Product name is required/);
    });

    test('should handle unicode and emoji in product names', () => {
      const p = ctx.products.add({
        name: 'عطر العود 🌹✨',
        brand: '阿拉伯品牌',
        sale_price: 5000,
        quantity: 3,
      });

      const fetched = ctx.products.get(p.id);
      assert.equal(fetched.name, 'عطر العود 🌹✨');
      assert.equal(fetched.brand, '阿拉伯品牌');
    });

    test('should handle very long product names without crashing', () => {
      const longName = 'A'.repeat(10000);
      const p = ctx.products.add({ name: longName, sale_price: 100, quantity: 1 });
      const fetched = ctx.products.get(p.id);
      assert.equal(fetched.name.length, 10000);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Access Control: Soft-Deleted Records
  // ─────────────────────────────────────────────────────────────
  test.describe('Soft-Delete Access Control', () => {

    test('should not allow selling a soft-deleted product', () => {
      const p = ctx.products.add({ name: 'Soon Deleted', sale_price: 500, quantity: 10 });
      ctx.products.delete(p.id);

      assert.throws(() => {
        ctx.sales.create(
          { customer_name: 'Buyer' },
          [{ product_id: p.id, quantity: 1, price_at_sale: 500 }]
        );
      }, /unavailable/);
    });

    test('should not allow stock-in on a soft-deleted product', () => {
      const p = ctx.products.add({ name: 'Deleted Perfume', sale_price: 2000, quantity: 5 });
      ctx.products.delete(p.id);

      assert.throws(() => {
        ctx.products.stockIn(p.id, 10, 'Supplier', '2026-08-17');
      }, /Active product not found/);
    });

    test('should not allow stock adjustment on a soft-deleted product', () => {
      const p = ctx.products.add({ name: 'Deleted Shirt', sale_price: 1500, quantity: 5 });
      ctx.products.delete(p.id);

      assert.throws(() => {
        ctx.products.adjustStock(p.id, 2, 'Damaged');
      }, /Active product not found/);
    });

    test('should not include deleted products in low stock alerts', () => {
      const p = ctx.products.add({ name: 'Low Stock Deleted', sale_price: 100, quantity: 1, low_stock_threshold: 5 });
      ctx.products.delete(p.id);

      const lowStock = ctx.products.getLowStock(5);
      assert.ok(!lowStock.some(item => item.id === p.id), 'Deleted product should not appear in low stock');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Payment / Financial Integrity
  // ─────────────────────────────────────────────────────────────
  test.describe('Financial Integrity & Payment Security', () => {

    test('should reject negative payment amount', () => {
      const p = ctx.products.add({ name: 'Test', sale_price: 1000, quantity: 5 });
      ctx.sales.create(
        { customer_name: 'Debtor', customer_phone: '0311-0000001', payment_method: 'Credit / Unpaid' },
        [{ product_id: p.id, quantity: 1, price_at_sale: 1000 }]
      );

      const customer = ctx.customers.getAll('0311-0000001')[0];
      assert.throws(() => {
        ctx.customers.addPayment(customer.id, -500, 'Cash', 'Negative test');
      }, /Payment amount must be greater than zero/);
    });

    test('should reject zero payment amount', () => {
      const p = ctx.products.add({ name: 'Test Zero', sale_price: 500, quantity: 5 });
      ctx.sales.create(
        { customer_name: 'Zero Payer', customer_phone: '0311-0000002', payment_method: 'Credit / Unpaid' },
        [{ product_id: p.id, quantity: 1, price_at_sale: 500 }]
      );

      const customer = ctx.customers.getAll('0311-0000002')[0];
      assert.throws(() => {
        ctx.customers.addPayment(customer.id, 0, 'Cash', 'Zero test');
      }, /Payment amount must be greater than zero/);
    });

    test('should reject payment exceeding outstanding balance', () => {
      const p = ctx.products.add({ name: 'Test Excess', sale_price: 1000, quantity: 5 });
      ctx.sales.create(
        { customer_name: 'Excess Payer', customer_phone: '0311-0000003', payment_method: 'Credit / Unpaid' },
        [{ product_id: p.id, quantity: 1, price_at_sale: 1000 }]
      );

      const customer = ctx.customers.getAll('0311-0000003')[0];
      assert.throws(() => {
        ctx.customers.addPayment(customer.id, 2000, 'Cash', 'Overpayment');
      }, /Payment cannot exceed the outstanding balance/);
    });

    test('should reject negative discount value in sales', () => {
      const p = ctx.products.add({ name: 'Discount Item', sale_price: 1000, quantity: 5 });

      assert.throws(() => {
        ctx.sales.create(
          { customer_name: 'Discount Hacker', discount_type: 'flat', discount_value: -500 },
          [{ product_id: p.id, quantity: 1, price_at_sale: 1000 }]
        );
      }, /Discount must be a valid non-negative number/);
    });

    test('should reject negative tax amount in sales', () => {
      const p = ctx.products.add({ name: 'Tax Item', sale_price: 1000, quantity: 5 });

      assert.throws(() => {
        ctx.sales.create(
          { customer_name: 'Tax Hacker', tax_amount: -100 },
          [{ product_id: p.id, quantity: 1, price_at_sale: 1000 }]
        );
      }, /Tax must be a valid non-negative number/);
    });
  });
});
