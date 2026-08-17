const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('Master Data (Brands & Categories) Module', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  test('should manage product categories for Clothes and Perfume', () => {
    const c1 = ctx.masterData.addCategory('Winter Jackets', 'Clothes');
    const c2 = ctx.masterData.addCategory('French Perfume', 'Perfume');

    assert.ok(c1.id > 0);
    assert.ok(c2.id > 0);

    const clothesCats = ctx.masterData.getCategories('Clothes');
    assert.ok(clothesCats.some(c => c.name === 'Winter Jackets'));

    const perfumeCats = ctx.masterData.getCategories('Perfume');
    assert.ok(perfumeCats.some(c => c.name === 'French Perfume'));

    // Delete category
    const del = ctx.masterData.deleteCategory(c1.id);
    assert.equal(del.success, true);
    assert.ok(!ctx.masterData.getCategories('Clothes').some(c => c.id === c1.id));
  });

  test('should manage brands master data', () => {
    const b = ctx.masterData.addBrand('Khaadi');
    assert.ok(b.id > 0);

    const brands = ctx.masterData.getBrands();
    assert.ok(brands.some(x => x.name === 'Khaadi'));

    ctx.masterData.deleteBrand(b.id);
    assert.ok(!ctx.masterData.getBrands().some(x => x.id === b.id));
  });
});
