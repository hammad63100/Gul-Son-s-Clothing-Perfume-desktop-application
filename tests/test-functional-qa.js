const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initDatabase } = require('../src/database/init');
async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gulsons-functional-'));
  const db = await initDatabase(path.join(dir, 'qa.db'));
  const products = require('../src/database/products').productsDB(db);
  const sales = require('../src/database/sales').salesDB(db);
  const returns = require('../src/database/returns').returnsDB(db);
  const customers = require('../src/database/customers').customersDB(db);
  const expenses = require('../src/database/expenses').expensesDB(db);
  const purchaseReturns = require('../src/database/purchaseReturns').purchaseReturnsDB(db);
  const raast = require('../src/database/raast').raastDB(db);
  let failed = 0, passed = 0;
  function test(name, fn) { try { fn(); passed++; console.log('PASS', name); } catch(e) { failed++; console.error('FAIL', name, e.message); } }
  const p = products.add({name:'QA Kurta',category:'Clothes',quantity:30,purchase_price:60,sale_price:100});
  const bottle = products.add({name:'QA Bottle',category:'Empty Bottle',measurement_ml:50,quantity:10,sale_price:100});
  const line = (quantity=1,id=p.id) => ({product_id:id,quantity,price_at_sale:100});
  const count = () => db.prepare('SELECT COUNT(*) AS n FROM sales').get().n;
  test('product search finds created product',()=>assert.equal(products.getAll({search:'QA Kurta'}).length,1));
  test('negative product price rejected',()=>assert.throws(()=>products.add({name:'Invalid',sale_price:-1})));
  test('empty sale rejected',()=>assert.throws(()=>sales.create({},[])));
  for(const q of [0,-1,NaN,Infinity]) test(`invalid sale quantity ${q}`,()=>assert.throws(()=>sales.create({},[line(q)])));
  test('oversell rolls back invoice and stock',()=>{const n=count(), stock=products.get(p.id).quantity; assert.throws(()=>sales.create({},[line(31)])); assert.equal(count(),n); assert.equal(products.get(p.id).quantity,stock);});
  test('duplicate lines cannot exceed combined stock',()=>assert.throws(()=>sales.create({},[line(20),line(20)])));
  test('percentage >100 rejected',()=>assert.throws(()=>sales.create({discount_type:'percentage',discount_value:101},[line()])));
  test('negative tax rejected',()=>assert.throws(()=>sales.create({tax_amount:-1},[line()])));
  test('discount and tax calculated correctly',()=>{const s=sales.create({discount_type:'percentage',discount_value:10,tax_amount:18},[line(2)]); assert.equal(s.totalAmount,198); assert.equal(products.get(p.id).quantity,28);});
  test('credit sale and customer payment balance',()=>{sales.create({customer_name:'QA Customer',customer_phone:'QA-001',payment_method:'Credit / Unpaid'},[line(2)]);const c=customers.getAll('QA Customer')[0];assert.equal(c.outstanding_balance,200);customers.addPayment(c.id,50,'Cash','QA');assert.equal(customers.get(c.id).outstanding_balance,150);assert.throws(()=>customers.addPayment(c.id,151,'Cash','QA'));});
  test('partial and full returns restore stock and discount',()=>{const s=sales.create({discount_type:'percentage',discount_value:10},[line(2)]);assert.equal(returns.process(s.saleId,p.id,1,'QA').refund_amount,90);assert.equal(returns.processFullInvoice(s.saleId,'QA').totalRefund,90);assert.throws(()=>returns.process(s.saleId,p.id,1,'QA'));});
  test('expense validation and summary',()=>{assert.throws(()=>expenses.add({title:'QA',amount:-1}));expenses.add({title:'QA Expense',amount:75,date:'2026-11-18'});assert.equal(expenses.getSummary('2026-11-18','2026-11-18'),75);});
  test('stock-in and supplier return',()=>{const before=products.get(p.id).quantity;products.stockIn(p.id,3,'QA Supplier');purchaseReturns.process(p.id,2,'QA Supplier','QA');assert.equal(products.get(p.id).quantity,before+1);assert.throws(()=>purchaseReturns.process(p.id,999,'QA','QA'));});
  test('Raast fee and amount validation',()=>{assert.equal(raast.create({transaction_type:'Cash Deposit',amount:1500}).fee_amount,40);assert.throws(()=>raast.create({amount:-1}));});
  test('fractional bottle sale rejected',()=>assert.throws(()=>sales.create({},[line(0.5,bottle.id)]),/whole number/i));
  test('partial bottle update preserves measurement',()=>{products.update(bottle.id,{name:'QA Bottle Renamed'});assert.equal(products.get(bottle.id).measurement_ml,50);});
  test('partial bottle quantity update rejects fractional stock',()=>assert.throws(()=>products.update(bottle.id,{quantity:0.5}),/whole number/i));
  test('fractional bottle return rejected',()=>{const s=sales.create({},[line(1,bottle.id)]);assert.throws(()=>returns.process(s.saleId,bottle.id,0.5,'QA'),/whole number/i);});
  test('credit without customer rejected',()=>assert.throws(()=>sales.create({payment_method:'Credit / Unpaid'},[line()]),/customer/i));
  db.close();
  // Remove only the temporary directory created by this test.
  fs.rmSync(dir,{recursive:true,force:true});
  console.log(`QA result: ${passed} passed, ${failed} failed`);
  if(failed) process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
