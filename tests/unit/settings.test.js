const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('Settings & Configuration Module', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  test('should load default shop settings correctly', () => {
    const s = ctx.settings.get();
    assert.equal(s.shop_name, "Gul Son's");
    assert.equal(s.currency_symbol, 'Rs.');
    assert.equal(s.invoice_prefix, 'GS');
  });

  test('should update settings and read updated values', () => {
    ctx.settings.update({
      shop_name: "Gul Son's Boutique & Fragrances",
      shop_phone: '0312-3456789',
      low_stock_threshold: '10'
    });

    const updatedName = ctx.settings.getValue('shop_name');
    assert.equal(updatedName, "Gul Son's Boutique & Fragrances");

    const updatedThreshold = ctx.settings.getValue('low_stock_threshold');
    assert.equal(updatedThreshold, '10');
  });
});
