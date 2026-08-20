const { dialog, shell } = require('electron');
const { productsDB } = require('../database/products');
const { salesDB } = require('../database/sales');
const { returnsDB } = require('../database/returns');
const { customersDB } = require('../database/customers');
const { reportsDB } = require('../database/reports');
const { settingsDB } = require('../database/settings');
const { expensesDB } = require('../database/expenses');
const { masterDataDB } = require('../database/brands');
const { suppliersDB } = require('../database/suppliers');
const {
  backupDatabase,
  exportAllToJson,
  exportAllToExcel,
  inspectBackupFile,
  restoreDatabase,
  getSafetyBackupsList,
  createSafetyBackup
} = require('../backup/backup');
const { generateInvoicePDF } = require('../export/pdf');
const { exportReportToExcel } = require('../export/excel');
const { buildWhatsAppDesktopUrl } = require('../utils/whatsapp');

function registerHandlers(db, ipcMain) {
  const products = productsDB(db);
  const sales = salesDB(db);
  const returns = returnsDB(db);
  const customers = customersDB(db);
  const reports = reportsDB(db);
  const settings = settingsDB(db);
  const expenses = expensesDB(db);
  const masterData = masterDataDB(db);
  const suppliers = suppliersDB(db);

  // ─── Enhanced Dashboard Summary ───
  ipcMain.handle('dashboard:getSummary', () => {
    try {
      const now = new Date();
      // Sales are stored with SQLite's localtime; do not use UTC here because
      // it can make today's dashboard appear empty around midnight in Pakistan.
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      // Safely fetch each piece of data — never let one failure kill the whole dashboard
      let dailySummary = { total_sales: 0, total_revenue: 0, total_profit: 0, total_customers: 0 };
      try { dailySummary = sales.getDailySummary(today) || dailySummary; } catch (e) { console.error('Dashboard: dailySummary error:', e.message); }

      let monthlySummary = { total_sales: 0, total_revenue: 0, total_profit: 0 };
      try { monthlySummary = sales.getMonthlySummary(year, month) || monthlySummary; } catch (e) { console.error('Dashboard: monthlySummary error:', e.message); }

      const lowStockThreshold = parseInt(settings.getValue('low_stock_threshold')) || 5;
      let lowStockProducts = [];
      try { lowStockProducts = products.getLowStock(lowStockThreshold) || []; } catch (e) { console.error('Dashboard: lowStock error:', e.message); }

      let todayExpenses = 0;
      try { todayExpenses = expenses.getSummary(today, today) || 0; } catch (e) { console.error('Dashboard: todayExpenses error:', e.message); }

      let monthlyExpensesVal = 0;
      try { monthlyExpensesVal = expenses.getSummary(`${year}-${String(month).padStart(2, '0')}-01`, today) || 0; } catch (e) { console.error('Dashboard: monthlyExpenses error:', e.message); }

      // Product counts (safe)
      let totalClothesCount = 0, totalHosieryCount = 0, totalPerfumeCount = 0, totalProductsCount = 0, outOfStockCnt = 0, stockVal = 0;
      try { totalClothesCount = (db.prepare("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND (category = 'Clothes' OR category IN (SELECT name FROM categories WHERE type = 'Clothes'))").get() || {}).count || 0; } catch (e) { console.error('Dashboard: totalClothes error:', e.message); }
      try { totalHosieryCount = (db.prepare("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND (category = 'Hosiery' OR category IN (SELECT name FROM categories WHERE type = 'Hosiery'))").get() || {}).count || 0; } catch (e) { console.error('Dashboard: totalHosiery error:', e.message); }
      try { totalPerfumeCount = (db.prepare("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND (category = 'Perfume' OR category IN (SELECT name FROM categories WHERE type = 'Perfume'))").get() || {}).count || 0; } catch (e) { console.error('Dashboard: totalPerfume error:', e.message); }
      try { totalProductsCount = (db.prepare("SELECT COUNT(*) as count FROM products WHERE is_active = 1").get() || {}).count || 0; } catch (e) { console.error('Dashboard: totalProducts error:', e.message); }
      try { outOfStockCnt = (db.prepare("SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND quantity <= 0").get() || {}).count || 0; } catch (e) { console.error('Dashboard: outOfStock error:', e.message); }
      try { stockVal = (db.prepare("SELECT COALESCE(SUM(purchase_price * quantity), 0) as val FROM products WHERE is_active = 1").get() || {}).val || 0; } catch (e) { console.error('Dashboard: stockValue error:', e.message); }

      let totalCustCount = 0, totalSuppCount = 0, pendingSuppBal = 0;
      try { totalCustCount = (db.prepare("SELECT COUNT(*) as count FROM customers").get() || {}).count || 0; } catch (e) { console.error('Dashboard: totalCustomers error:', e.message); }
      try { totalSuppCount = (db.prepare("SELECT COUNT(*) as count FROM suppliers").get() || {}).count || 0; } catch (e) { console.error('Dashboard: totalSuppliers error:', e.message); }
      try { pendingSuppBal = (db.prepare("SELECT COALESCE(SUM(opening_balance), 0) as val FROM suppliers").get() || {}).val || 0; } catch (e) { console.error('Dashboard: pendingSupplier error:', e.message); }

      // Top selling (safe)
      let topSelling = [];
      try { topSelling = products.getTopSelling(5, {}) || []; } catch (e) { console.error('Dashboard: topSelling error:', e.message); }

      // Top perfumes, clothes & hosiery — using JS iterative approach to avoid WASM SQLite subquery failures
      let topPerfumes = [];
      let topClothes = [];
      let topHosiery = [];
      try {
        const perfList = db.prepare("SELECT id, name, category, size FROM products WHERE is_active = 1 AND (category = 'Perfume' OR category IN (SELECT name FROM categories WHERE type = 'Perfume'))").all() || [];
        const clothesList = db.prepare("SELECT id, name, category, size, color FROM products WHERE is_active = 1 AND (category = 'Clothes' OR category IN (SELECT name FROM categories WHERE type = 'Clothes'))").all() || [];
        const hosieryList = db.prepare("SELECT id, name, category, size, color FROM products WHERE is_active = 1 AND (category = 'Hosiery' OR category IN (SELECT name FROM categories WHERE type = 'Hosiery'))").all() || [];

        const salesData = db.prepare("SELECT product_id, COALESCE(SUM(quantity), 0) as sold, COALESCE(SUM(line_total), 0) as rev FROM sale_items GROUP BY product_id").all() || [];
        const salesMap = {};
        for (const row of salesData) {
          salesMap[row.product_id] = { sold: row.sold, rev: row.rev };
        }

        for (const p of perfList) {
          const s = salesMap[p.id] || { sold: 0, rev: 0 };
          if (s.sold > 0) topPerfumes.push({ ...p, total_sold: s.sold, total_revenue: s.rev });
        }
        topPerfumes.sort((a, b) => b.total_sold - a.total_sold);
        topPerfumes = topPerfumes.slice(0, 5);

        for (const p of clothesList) {
          const s = salesMap[p.id] || { sold: 0, rev: 0 };
          if (s.sold > 0) topClothes.push({ ...p, total_sold: s.sold, total_revenue: s.rev });
        }
        topClothes.sort((a, b) => b.total_sold - a.total_sold);
        topClothes = topClothes.slice(0, 5);

        for (const p of hosieryList) {
          const s = salesMap[p.id] || { sold: 0, rev: 0 };
          if (s.sold > 0) topHosiery.push({ ...p, total_sold: s.sold, total_revenue: s.rev });
        }
        topHosiery.sort((a, b) => b.total_sold - a.total_sold);
        topHosiery = topHosiery.slice(0, 5);
      } catch (e) { console.error('Dashboard: topPerfumes/Clothes/Hosiery error:', e.message); }

      // Recent Transactions
      let recentTransactions = [];
      try { recentTransactions = sales.getAll({ limit: 5 }) || []; } catch (e) { console.error('Dashboard: recentTransactions error:', e.message); }

      // Last 7 Days Sales Trend
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        let daySummary = { total_revenue: 0, total_profit: 0 };
        try { daySummary = sales.getDailySummary(dateStr) || daySummary; } catch (e) {}
        let dayExp = 0;
        try { dayExp = expenses.getSummary(dateStr, dateStr) || 0; } catch (e) {}
        last7Days.push({
          date: dateStr.slice(5), // MM-DD
          revenue: daySummary.total_revenue || 0,
          profit: Math.max(0, (daySummary.total_profit || 0) - dayExp)
        });
      }

      // Cash In Hand = All-time cash sales revenue - all-time expenses
      let allTimeCashSales = 0;
      try {
        allTimeCashSales = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as val FROM sales WHERE payment_method = 'Cash'").get() || {}).val || 0;
      } catch (e) { console.error('Dashboard: allTimeCashSales error:', e.message); }
      let allTimeExpenses = 0;
      try {
        allTimeExpenses = (db.prepare("SELECT COALESCE(SUM(amount), 0) as val FROM expenses WHERE payment_method = 'Cash'").get() || {}).val || 0;
      } catch (e) { console.error('Dashboard: allTimeExpenses error:', e.message); }
      const cashInHand = Math.max(0, allTimeCashSales - allTimeExpenses);

      return {
        today: dailySummary,
        thisMonth: monthlySummary,
        todayExpenses,
        monthlyExpenses: monthlyExpensesVal,
        netDailyProfit: Math.max(0, (dailySummary.total_profit || 0) - todayExpenses),
        netMonthlyProfit: Math.max(0, (monthlySummary.total_profit || 0) - monthlyExpensesVal),
        lowStockProducts,
        topSelling,
        topPerfumes,
        topClothes,
        topHosiery,
        totalClothes: totalClothesCount,
        totalHosiery: totalHosieryCount,
        totalPerfume: totalPerfumeCount,
        totalProducts: totalProductsCount,
        outOfStockCount: outOfStockCnt,
        stockValue: stockVal,
        totalCustomers: totalCustCount,
        totalSuppliers: totalSuppCount,
        pendingSupplierPayments: pendingSuppBal,
        cashInHand,
        recentTransactions,
        last7Days,
        currency: settings.getValue('currency_symbol') || 'Rs.',
      };
    } catch (err) {
      console.error('Dashboard getSummary fatal error:', err);
      return {
        today: { total_sales: 0, total_revenue: 0, total_profit: 0, total_customers: 0 },
        thisMonth: { total_sales: 0, total_revenue: 0, total_profit: 0 },
        todayExpenses: 0, monthlyExpenses: 0, netDailyProfit: 0, netMonthlyProfit: 0,
        lowStockProducts: [], topSelling: [], topPerfumes: [], topClothes: [], topHosiery: [],
        totalClothes: 0, totalHosiery: 0, totalPerfume: 0, totalProducts: 0, outOfStockCount: 0,
        stockValue: 0, totalCustomers: 0, totalSuppliers: 0, pendingSupplierPayments: 0,
        cashInHand: 0, recentTransactions: [], last7Days: [],
        currency: 'Rs.',
      };
    }
  });

  // Income and outcome for a selected calendar day or month. Returns are an
  // outcome on the day they are processed, so historical cash flow is clear.
  ipcMain.handle('dashboard:getFinancialSummary', (_, period, value) => {
    const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date);
    const validMonth = month => /^\d{4}-\d{2}$/.test(month);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentMonth = today.slice(0, 7);
    const monthly = period === 'monthly';
    const selected = monthly ? (validMonth(value) ? value : currentMonth) : (validDate(value) ? value : today);
    const start = monthly ? `${selected}-01` : selected;
    const end = monthly ? `${selected}-31 23:59:59` : `${selected} 23:59:59`;
    const sales = db.prepare('SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales WHERE created_at >= ? AND created_at <= ?').get(start, end).total;
    const refunds = db.prepare('SELECT COALESCE(SUM(refund_amount), 0) AS total FROM returns WHERE created_at >= ? AND created_at <= ?').get(start, end).total;
    const expenseTotal = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE date >= ? AND date <= ?').get(start.slice(0, 10), end.slice(0, 10)).total;
    const salesProfit = db.prepare(`SELECT COALESCE(SUM(si.quantity * (si.price_at_sale - si.purchase_price_at_sale)), 0) AS total FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at >= ? AND s.created_at <= ?`).get(start, end).total;
    const returnedProfit = db.prepare(`SELECT COALESCE(SUM(r.quantity * (si.price_at_sale - si.purchase_price_at_sale)), 0) AS total FROM returns r JOIN sale_items si ON si.sale_id = r.sale_id AND si.product_id = r.product_id WHERE r.created_at >= ? AND r.created_at <= ?`).get(start, end).total;
    const income = Number(sales) - Number(refunds);
    return {
      period: monthly ? 'monthly' : 'daily', value: selected, grossIncome: Number(sales), refunds: Number(refunds), expenses: Number(expenseTotal),
      income, outcome: Number(refunds) + Number(expenseTotal), netCashFlow: income - Number(expenseTotal),
      operatingProfit: Number(salesProfit) - Number(returnedProfit) - Number(expenseTotal), currency: settings.getValue('currency_symbol') || 'Rs.',
    };
  });

  // ─── Products ───
  ipcMain.handle('products:getAll', (_, filters) => products.getAll(filters));
  ipcMain.handle('products:get', (_, id) => products.get(id));
  ipcMain.handle('products:add', (_, data) => products.add(data));
  ipcMain.handle('products:update', (_, id, data) => products.update(id, data));
  ipcMain.handle('products:delete', (_, id) => products.delete(id));
  ipcMain.handle('products:stockIn', (_, id, qty, supplier, date) => products.stockIn(id, qty, supplier, date));
  ipcMain.handle('products:adjustStock', (_, id, qty, reason) => products.adjustStock(id, qty, reason));
  ipcMain.handle('products:getLowStock', (_, threshold) => products.getLowStock(threshold));
  ipcMain.handle('products:getTopSelling', (_, limit, dateRange) => products.getTopSelling(limit, dateRange));

  // ─── Sales ───
  ipcMain.handle('sales:create', (_, saleData, items) => sales.create(saleData, items));
  ipcMain.handle('sales:getAll', (_, filters) => sales.getAll(filters));
  ipcMain.handle('sales:get', (_, id) => sales.get(id));
  ipcMain.handle('sales:getNextInvoiceNo', () => sales.getNextInvoiceNo());
  ipcMain.handle('sales:getDailySummary', (_, date) => sales.getDailySummary(date));
  ipcMain.handle('sales:getMonthlySummary', (_, year, month) => sales.getMonthlySummary(year, month));

  // ─── Returns ───
  ipcMain.handle('returns:process', (_, saleId, productId, qty, reason, customReason, refundType) => returns.process(saleId, productId, qty, reason, customReason, refundType));
  ipcMain.handle('returns:processFullInvoice', (_, saleId, reason, customReason, refundType) => returns.processFullInvoice(saleId, reason, customReason, refundType));
  ipcMain.handle('returns:getAll', (_, filters) => returns.getAll(filters));

  // ─── Customers ───
  ipcMain.handle('customers:getAll', (_, search) => customers.getAll(search));
  ipcMain.handle('customers:get', (_, id) => customers.get(id));
  ipcMain.handle('customers:update', (_, id, data) => customers.update(id, data));
  ipcMain.handle('customers:addPayment', (_, id, amount, method, note) => customers.addPayment(id, amount, method, note));
  ipcMain.handle('customers:getLedger', (_, id) => customers.getLedger(id));

  // Open the installed WhatsApp Desktop app (when available) with a message
  // addressed to the customer's saved number. Phone numbers are normalized for
  // Pakistan while still accepting numbers already stored with a country code.
  ipcMain.handle('whatsapp:openChat', async (_, phone, message) => {
    const url = buildWhatsAppDesktopUrl(phone, message);
    await shell.openExternal(url);
    return { phone: new URL(url).searchParams.get('phone') };
  });

  // ─── Expenses & Finance ───
  ipcMain.handle('expenses:getAll', (_, filters) => expenses.getAll(filters));
  ipcMain.handle('expenses:add', (_, data) => expenses.add(data));
  ipcMain.handle('expenses:delete', (_, id) => expenses.delete(id));
  ipcMain.handle('expenses:getSummary', (_, startDate, endDate) => expenses.getSummary(startDate, endDate));

  // ─── Categories & Brands & Fragrance Types ───
  ipcMain.handle('master:getCategories', (_, type) => masterData.getCategories(type));
  ipcMain.handle('master:addCategory', (_, name, type) => masterData.addCategory(name, type));
  ipcMain.handle('master:deleteCategory', (_, id) => masterData.deleteCategory(id));
  ipcMain.handle('master:getBrands', () => masterData.getBrands());
  ipcMain.handle('master:addBrand', (_, name) => masterData.addBrand(name));
  ipcMain.handle('master:deleteBrand', (_, id) => masterData.deleteBrand(id));
  ipcMain.handle('master:getFragranceTypes', () => masterData.getFragranceTypes());
  ipcMain.handle('master:addFragranceType', (_, name) => masterData.addFragranceType(name));
  ipcMain.handle('master:deleteFragranceType', (_, id) => masterData.deleteFragranceType(id));

  // ─── Suppliers ───
  ipcMain.handle('suppliers:getAll', (_, search) => suppliers.getAll(search));
  ipcMain.handle('suppliers:add', (_, data) => suppliers.add(data));
  ipcMain.handle('suppliers:update', (_, id, data) => suppliers.update(id, data));
  ipcMain.handle('suppliers:delete', (_, id) => suppliers.delete(id));

  // ─── Reports ───
  ipcMain.handle('reports:getDaily', (_, date) => reports.getDaily(date));
  ipcMain.handle('reports:getMonthly', (_, year, month) => reports.getMonthly(year, month));
  ipcMain.handle('reports:getCategory', (_, startDate, endDate) => reports.getCategory(startDate, endDate));
  ipcMain.handle('reports:getSizeColor', (_, startDate, endDate) => reports.getSizeColor(startDate, endDate));
  ipcMain.handle('reports:getTopProducts', (_, limit, startDate, endDate) => reports.getTopProducts(limit, startDate, endDate));

  // ─── Settings ───
  ipcMain.handle('settings:get', () => settings.get());
  ipcMain.handle('settings:update', (_, data) => settings.update(data));

  // ─── Backup, Export & Import / Restore ───
  ipcMain.handle('backup:backupNow', async () => backupDatabase(db));
  
  ipcMain.handle('backup:selectFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Select Backup Location' });
    if (!result.canceled && result.filePaths.length > 0) {
      settings.update({ backup_path: result.filePaths[0] });
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('backup:exportJson', async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const result = await dialog.showSaveDialog({
      title: 'Export Full System Backup (JSON)',
      defaultPath: `GulSons_FullBackup_${timestamp}.json`,
      filters: [{ name: 'JSON Backup Files', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePath) {
      return await exportAllToJson(db, result.filePath);
    }
    return null;
  });

  ipcMain.handle('backup:exportAll', async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const result = await dialog.showSaveDialog({
      title: 'Export All Data (Excel Master)',
      defaultPath: `GulSons_MasterExport_${timestamp}.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });
    if (!result.canceled && result.filePath) {
      return await exportAllToExcel(db, result.filePath);
    }
    return null;
  });

  ipcMain.handle('backup:exportReport', async (_, type, data) => {
    const result = await dialog.showSaveDialog({
      title: 'Export Report',
      defaultPath: `GulSons_${type}_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
    });
    if (!result.canceled && result.filePath) {
      return await exportReportToExcel(type, data, result.filePath);
    }
    return null;
  });

  ipcMain.handle('backup:selectFileToRestore', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Backup File to Restore (.db or .json)',
      filters: [
        { name: 'All Supported Backup Files', extensions: ['db', 'sqlite', 'bak', 'json'] },
        { name: 'SQLite Database Files (*.db, *.sqlite)', extensions: ['db', 'sqlite', 'bak'] },
        { name: 'JSON Backup Files (*.json)', extensions: ['json'] }
      ],
      properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('backup:inspectFile', async (_, filePath) => {
    return await inspectBackupFile(filePath);
  });

  ipcMain.handle('backup:restoreFile', async (_, filePath) => {
    return await restoreDatabase(db, filePath);
  });

  ipcMain.handle('backup:getSafetyBackups', async () => {
    return getSafetyBackupsList();
  });

  ipcMain.handle('backup:openSafetyBackupFolder', async () => {
    const { app } = require('electron');
    const path = require('path');
    const safetyDir = path.join(app.getPath('userData'), 'backups');
    await shell.openPath(safetyDir);
    return true;
  });

  ipcMain.handle('backup:generateInvoicePDF', async (_, saleData) => {
    if (!saleData || typeof saleData !== 'object') {
      console.warn('generateInvoicePDF called with null or invalid saleData');
      return null;
    }
    const settingsData = settings.get();
    const invoiceNo = saleData.invoice_no || 'GS-000000';
    const result = await dialog.showSaveDialog({
      title: 'Save Invoice PDF',
      defaultPath: `Invoice_${invoiceNo}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (!result.canceled && result.filePath) {
      const pdfResult = await generateInvoicePDF(saleData, settingsData, result.filePath);
      // Open the finished PDF with the system's PDF viewer so the cashier can
      // print it immediately after saving it.
      await shell.openPath(result.filePath);
      return pdfResult;
    }
    return null;
  });
}

module.exports = { registerHandlers };
