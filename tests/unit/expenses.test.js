const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestDb } = require('../helpers/test-db');

test.describe('Expenses Management Module', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await createTestDb();
  });

  test('should create expense with validation and retrieve it', () => {
    const exp = ctx.expenses.add({
      title: 'Electricity Bill',
      category: 'Utilities',
      amount: 15000,
      payment_method: 'Cash',
      date: '2026-08-15',
      description: 'August Bill'
    });

    assert.ok(exp.id > 0);
    const list = ctx.expenses.getAll();
    assert.equal(list.length, 1);
    assert.equal(list[0].title, 'Electricity Bill');
    assert.equal(list[0].amount, 15000);
  });

  test('should reject invalid expenses (empty title or non-positive amount)', () => {
    assert.throws(() => {
      ctx.expenses.add({ title: '', amount: 1000 });
    }, /Expense title is required/);

    assert.throws(() => {
      ctx.expenses.add({ title: 'Tea and Refreshments', amount: -500 });
    }, /Expense amount must be greater than zero/);
  });

  test('should filter expenses and calculate date range summary', () => {
    ctx.expenses.add({ title: 'Shop Rent', category: 'Shop Rent', amount: 50000, date: '2026-08-01' });
    ctx.expenses.add({ title: 'Staff Salary', category: 'Salaries', amount: 30000, date: '2026-08-05' });
    ctx.expenses.add({ title: 'Tea', category: 'Refreshments', amount: 2000, date: '2026-08-10' });

    // Category filter
    const salaries = ctx.expenses.getAll({ category: 'Salaries' });
    assert.equal(salaries.length, 1);
    assert.equal(salaries[0].amount, 30000);

    // Summary calculation
    const totalAugust = ctx.expenses.getSummary('2026-08-01', '2026-08-31');
    assert.equal(totalAugust, 82000);

    // Partial range summary
    const totalMidAugust = ctx.expenses.getSummary('2026-08-02', '2026-08-08');
    assert.equal(totalMidAugust, 30000);
  });

  test('should delete expense properly', () => {
    const exp = ctx.expenses.add({ title: 'Temporary Expense', amount: 500 });
    assert.equal(ctx.expenses.getAll().length, 1);

    const delRes = ctx.expenses.delete(exp.id);
    assert.equal(delRes.success, true);
    assert.equal(ctx.expenses.getAll().length, 0);
  });
});
