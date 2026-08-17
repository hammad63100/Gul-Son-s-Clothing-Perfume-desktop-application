const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('Products & Inventory Module', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  test('should successfully add a new product with default and custom values', () => {
    const product = ctx.products.add({
      name: 'Cotton Embroidered Kurta',
      category: 'Clothes',
      brand: 'J.',
      size: 'L',
      color: 'Navy Blue',
      fabric: 'Cotton',
      purchase_price: 1500,
      sale_price: 2800,
      quantity: 25,
      low_stock_threshold: 5,
      supplier: 'Al-Karam Mills',
      barcode: '123456789012',
      sku: 'JK-COT-L'
    });

    assert.ok(product.id > 0, 'Product should have an auto-generated positive ID');
    const fetched = ctx.products.get(product.id);
    assert.equal(fetched.name, 'Cotton Embroidered Kurta');
    assert.equal(fetched.brand, 'J.');
    assert.equal(fetched.size, 'L');
    assert.equal(fetched.purchase_price, 1500);
    assert.equal(fetched.sale_price, 2800);
    assert.equal(fetched.quantity, 25);
    assert.equal(fetched.is_active, 1);
  });

  test('should throw error when adding product without name or with invalid quantity/prices', () => {
    // Missing name
    assert.throws(() => {
      ctx.products.add({ name: '', sale_price: 100 });
    }, /Product name is required/);

    // Negative price
    assert.throws(() => {
      ctx.products.add({ name: 'Invalid Product', sale_price: -50 });
    }, /must be a valid non-negative number/);

    // Non-integer quantity
    assert.throws(() => {
      ctx.products.add({ name: 'Fractional Stock', quantity: 3.5 });
    }, /Quantity must be a whole number/);
  });

  test('should update product fields and validate update constraints', () => {
    const p = ctx.products.add({ name: 'Oud Al Layl', category: 'Perfume', sale_price: 4500, quantity: 10 });
    
    const updated = ctx.products.update(p.id, {
      sale_price: 4800,
      quantity: 12,
      fragrance_type: 'Eau De Parfum'
    });

    assert.equal(updated.sale_price, 4800);
    assert.equal(updated.quantity, 12);
    assert.equal(updated.fragrance_type, 'Eau De Parfum');

    // Updating with invalid negative price should fail
    assert.throws(() => {
      ctx.products.update(p.id, { sale_price: -100 });
    }, /must be a valid non-negative number/);
  });

  test('should soft-delete product and exclude from active listings', () => {
    const p1 = ctx.products.add({ name: 'Active Shirt', sale_price: 1200, quantity: 5 });
    const p2 = ctx.products.add({ name: 'Deleted Shirt', sale_price: 1200, quantity: 5 });

    ctx.products.delete(p2.id);

    const all = ctx.products.getAll();
    assert.ok(all.some(p => p.id === p1.id));
    assert.ok(!all.some(p => p.id === p2.id), 'Deleted product should not appear in getAll');

    const fetchedDeleted = ctx.products.get(p2.id);
    assert.equal(fetchedDeleted.is_active, 0, 'Soft deleted product is_active flag must be 0');
  });

  test('should filter products by search, category, lowStock, outOfStock, size, and color', () => {
    ctx.products.add({ name: 'Sapphire Lawn Shirt', category: 'Clothes', size: 'M', color: 'Red', quantity: 10, low_stock_threshold: 5, barcode: 'SAP-101' });
    ctx.products.add({ name: 'Gul Ahmed Silk Shirt', category: 'Clothes', size: 'L', color: 'Blue', quantity: 3, low_stock_threshold: 5, barcode: 'GUL-202' });
    ctx.products.add({ name: 'Dior Sauvage', category: 'Perfume', size: '100ml', color: 'Black', quantity: 0, low_stock_threshold: 2, barcode: 'DIO-303' });

    // Search by name
    const searchByName = ctx.products.getAll({ search: 'Sapphire' });
    assert.equal(searchByName.length, 1);
    assert.equal(searchByName[0].name, 'Sapphire Lawn Shirt');

    // Search by barcode
    const searchByBarcode = ctx.products.getAll({ search: 'GUL-202' });
    assert.equal(searchByBarcode.length, 1);

    // Filter by category
    const perfumes = ctx.products.getAll({ category: 'Perfume' });
    assert.equal(perfumes.length, 1);

    // Filter by low stock (quantity <= threshold)
    const lowStock = ctx.products.getAll({ lowStock: true });
    assert.equal(lowStock.length, 2, 'Should return products with quantity <= threshold (including 0 qty)');

    // Filter by out of stock (quantity <= 0)
    const outOfStock = ctx.products.getAll({ outOfStock: true });
    assert.equal(outOfStock.length, 1);
    assert.equal(outOfStock[0].name, 'Dior Sauvage');

    // Filter by size
    const sizeM = ctx.products.getAll({ size: 'M' });
    assert.equal(sizeM.length, 1);

    // Filter by color
    const colorRed = ctx.products.getAll({ color: 'Red' });
    assert.equal(colorRed.length, 1);
  });

  test('should increase stock on stockIn and log stock adjustment audit', () => {
    const p = ctx.products.add({ name: 'Lattafa Perfume', quantity: 10 });
    
    const updated = ctx.products.stockIn(p.id, 15, 'Direct Import', '2026-08-17');
    assert.equal(updated.quantity, 25);
    assert.equal(updated.supplier, 'Direct Import');

    const adjustments = ctx.db.prepare('SELECT * FROM stock_adjustments WHERE product_id = ?').all(p.id);
    assert.equal(adjustments.length, 1);
    assert.equal(adjustments[0].adjustment_type, 'stock_in');
    assert.equal(adjustments[0].quantity, 15);
  });

  test('should reduce stock on adjustStock and throw error if adjustment exceeds quantity', () => {
    const p = ctx.products.add({ name: 'Fragile Bottle', quantity: 8 });

    // Valid adjustment (damaged goods)
    const afterAdj = ctx.products.adjustStock(p.id, 3, 'Damaged in store');
    assert.equal(afterAdj.quantity, 5);

    const adjRow = ctx.db.prepare('SELECT * FROM stock_adjustments WHERE product_id = ?').get(p.id);
    assert.equal(adjRow.adjustment_type, 'adjustment');
    assert.equal(adjRow.quantity, 3);
    assert.equal(adjRow.reason, 'Damaged in store');

    // Over-reduction attempt
    assert.throws(() => {
      ctx.products.adjustStock(p.id, 10, 'Too many broken');
    }, /Cannot remove 10 units; only 5 available/);
  });

  test('should retrieve distinct sizes and colors', () => {
    ctx.products.add({ name: 'Shirt 1', size: 'S', color: 'White', quantity: 5 });
    ctx.products.add({ name: 'Shirt 2', size: 'M', color: 'Black', quantity: 5 });
    ctx.products.add({ name: 'Shirt 3', size: 'L', color: 'White', quantity: 5 });

    const sizes = ctx.products.getAllSizes();
    const colors = ctx.products.getAllColors();

    assert.ok(sizes.includes('S') && sizes.includes('M') && sizes.includes('L'));
    assert.ok(colors.includes('White') && colors.includes('Black'));
  });
});
