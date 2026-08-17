const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('Suppliers Management Module', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  test('should create, search, update and delete suppliers', () => {
    const s = ctx.suppliers.add({
      name: 'Haji Abdul Rehman',
      company: 'Rehman Fabrics Faisalabad',
      phone: '0300-7654321',
      address: 'Clock Tower Market, Faisalabad',
      email: 'rehman@example.com',
      opening_balance: 150000
    });

    assert.ok(s.id > 0);

    // Search by company
    const searchRes = ctx.suppliers.getAll('Faisalabad');
    assert.equal(searchRes.length, 1);
    assert.equal(searchRes[0].name, 'Haji Abdul Rehman');

    // Update
    const updated = ctx.suppliers.update(s.id, {
      name: 'Haji Abdul Rehman & Sons',
      company: 'Rehman Fabrics Faisalabad',
      phone: '0300-7654321',
      address: 'Clock Tower Market, Faisalabad',
      email: 'rehman@example.com',
      opening_balance: 120000
    });
    assert.equal(updated.name, 'Haji Abdul Rehman & Sons');
    assert.equal(updated.opening_balance, 120000);

    // Delete
    const delRes = ctx.suppliers.delete(s.id);
    assert.equal(delRes.success, true);
    assert.equal(ctx.suppliers.getAll().length, 0);
  });
});
