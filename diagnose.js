// Diagnostic: Query actual database contents
const path = require('path');
const fs = require('fs');

async function diagnose() {
  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    // Find the actual database file
    const possiblePaths = [
      path.join(process.env.APPDATA || '', 'gul-sons-shop-manager', 'gulsons.db'),
      path.join(process.env.LOCALAPPDATA || '', 'gul-sons-shop-manager', 'gulsons.db'),
    ];

    let dbPath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        dbPath = p;
        break;
      }
    }

    if (!dbPath) {
      console.log('DATABASE NOT FOUND at expected paths:');
      possiblePaths.forEach(p => console.log('  -', p));
      const appData = process.env.APPDATA || '';
      if (fs.existsSync(appData)) {
        const dirs = fs.readdirSync(appData).filter(d => d.toLowerCase().includes('gul'));
        console.log('Gul-related dirs in APPDATA:', dirs);
      }
      return;
    }

    console.log('DATABASE FOUND:', dbPath);
    console.log('File size:', fs.statSync(dbPath).size, 'bytes');

    const filebuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(filebuffer);

    function query(sql) {
      try {
        const results = db.exec(sql);
        if (!results || results.length === 0) return [];
        const cols = results[0].columns;
        return results[0].values.map(row => {
          const obj = {};
          cols.forEach((c, i) => obj[c] = row[i]);
          return obj;
        });
      } catch (e) {
        console.error('Query Error:', e.message, 'SQL:', sql);
        return [];
      }
    }

    console.log('\n=== TABLE LIST ===');
    const tables = query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    tables.forEach(t => console.log('  TABLE:', t.name));

    console.log('\n=== PRODUCTS ===');
    console.log('Active:', query("SELECT COUNT(*) as c FROM products WHERE is_active=1")[0]?.c);
    console.log('Stock val:', query("SELECT COALESCE(SUM(purchase_price*quantity),0) as v FROM products WHERE is_active=1")[0]?.v);
    console.log('Low stock:', query("SELECT COUNT(*) as c FROM products WHERE is_active=1 AND quantity>0 AND quantity<=low_stock_threshold")[0]?.c);
    console.log('Out of stock:', query("SELECT COUNT(*) as c FROM products WHERE is_active=1 AND quantity<=0")[0]?.c);
    const sp = query("SELECT id,name,category,quantity,purchase_price,sale_price FROM products WHERE is_active=1 LIMIT 10");
    sp.forEach(p => console.log(`  [${p.id}] ${p.name} | ${p.category} | Qty:${p.quantity} | Cost:${p.purchase_price} | Price:${p.sale_price}`));

    console.log('\n=== CATEGORIES ===');
    query("SELECT * FROM categories").forEach(c => console.log(`  [${c.id}] ${c.name} (${c.type})`));

    console.log('\n=== SALES ===');
    console.log('Total:', query("SELECT COUNT(*) as c FROM sales")[0]?.c);
    const todayStr = new Date().toISOString().split('T')[0];
    const td = query("SELECT COUNT(*) as c, COALESCE(SUM(total_amount),0) as r FROM sales WHERE DATE(created_at)=DATE('" + todayStr + "')");
    console.log('Today count:', td[0]?.c, 'Revenue:', td[0]?.r);
    query("SELECT id,invoice_no,customer_name,total_amount,payment_method,created_at FROM sales ORDER BY id DESC LIMIT 5").forEach(s => console.log(`  [${s.id}] ${s.invoice_no} | ${s.customer_name} | Rs.${s.total_amount} | ${s.payment_method} | ${s.created_at}`));

    console.log('\n=== SALE ITEMS ===');
    console.log('Total:', query("SELECT COUNT(*) as c FROM sale_items")[0]?.c);

    console.log('\n=== CUSTOMERS ===');
    console.log('Total:', query("SELECT COUNT(*) as c FROM customers")[0]?.c);

    console.log('\n=== SUPPLIERS ===');
    console.log('Total:', query("SELECT COUNT(*) as c FROM suppliers")[0]?.c);

    console.log('\n=== EXPENSES ===');
    console.log('Total:', query("SELECT COUNT(*) as c FROM expenses")[0]?.c);

    console.log('\n=== RETURNS ===');
    console.log('Total:', query("SELECT COUNT(*) as c FROM returns")[0]?.c);

    console.log('\n=== SETTINGS ===');
    query("SELECT * FROM settings").forEach(s => console.log(`  ${s.key} = ${s.value}`));

    // Dashboard query tests
    console.log('\n=== DASHBOARD QUERY TESTS ===');
    const ms = new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0');
    console.log('Monthly (strftime):', query("SELECT COUNT(id) as c, COALESCE(SUM(total_amount),0) as r FROM sales WHERE strftime('%Y-%m',created_at)='" + ms + "'")[0]);
    console.log('Profit subquery:', query("SELECT COALESCE(SUM(si.quantity*(si.price_at_sale-si.purchase_price_at_sale)),0) as p FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE strftime('%Y-%m',s.created_at)='" + ms + "'")[0]);

    db.close();
    console.log('\n=== DONE ===');
  } catch (e) {
    console.error('FATAL:', e);
  }
}
diagnose();
