const assert=require('assert/strict');
const fs=require('fs');
const vm=require('vm');
const area={innerHTML:''};
const api={
  settings:{async get(){return {currency_symbol:'Rs.'};}},
  expenses:{async getAll(){return [{expense_type:'shop',payment_method:'Bank Transfer',amount:500}];}},
  returns:{async getAll(){return [{refund_type:'Cash Refund',refund_amount:250,product_name:'QA',created_at:'2026-11-18'}];}},
  sales:{async getAll(filters){assert.equal(filters.includeFullyReturned,true);return [{payment_method:'Cash',total_amount:250},{payment_method:'Credit / Unpaid',total_amount:1000}];}}
};
const context={window:{api},document:{getElementById(){return area;}},console,formatters:{date:x=>x,dateTime:x=>x,currency:x=>`Rs. ${x}`},toast:{error:m=>{throw Error(m);}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../renderer/js/pages/finance.js'),'utf8'),context);
context.window.FinancePage.loadActiveTab().then(()=>{
  assert.match(area.innerHTML,/1 cash bills received/);
  assert.match(area.innerHTML,/Rs\. 250/);
  assert.doesNotMatch(area.innerHTML,/Rs\. -250/);
  assert.doesNotMatch(area.innerHTML,/Rs\. 1250/);
  assert.match(area.innerHTML,/Net Closing Balance[\s\S]*?Rs\. 0/);
  console.log('PASS cashbook counts cash sales once, excludes credit and bank expenses, and subtracts refund once');
}).catch(e=>{console.error(e);process.exitCode=1;});
