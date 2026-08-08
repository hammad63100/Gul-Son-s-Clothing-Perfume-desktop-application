const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ─── Dashboard ───
  dashboard: {
    getSummary: () => ipcRenderer.invoke('dashboard:getSummary'),
  },

  // ─── Products / Inventory ───
  products: {
    getAll: (filters) => ipcRenderer.invoke('products:getAll', filters),
    get: (id) => ipcRenderer.invoke('products:get', id),
    add: (data) => ipcRenderer.invoke('products:add', data),
    update: (id, data) => ipcRenderer.invoke('products:update', id, data),
    delete: (id) => ipcRenderer.invoke('products:delete', id),
    stockIn: (id, qty, supplier, date) => ipcRenderer.invoke('products:stockIn', id, qty, supplier, date),
    adjustStock: (id, qty, reason) => ipcRenderer.invoke('products:adjustStock', id, qty, reason),
    getLowStock: (threshold) => ipcRenderer.invoke('products:getLowStock', threshold),
    getTopSelling: (limit, dateRange) => ipcRenderer.invoke('products:getTopSelling', limit, dateRange),
  },

  // ─── Master Data (Brands & Categories) ───
  master: {
    getCategories: (type) => ipcRenderer.invoke('master:getCategories', type),
    addCategory: (name, type) => ipcRenderer.invoke('master:addCategory', name, type),
    deleteCategory: (id) => ipcRenderer.invoke('master:deleteCategory', id),
    getBrands: () => ipcRenderer.invoke('master:getBrands'),
    addBrand: (name) => ipcRenderer.invoke('master:addBrand', name),
    deleteBrand: (id) => ipcRenderer.invoke('master:deleteBrand', id),
  },

  // ─── Expenses & Finance ───
  expenses: {
    getAll: (filters) => ipcRenderer.invoke('expenses:getAll', filters),
    add: (data) => ipcRenderer.invoke('expenses:add', data),
    delete: (id) => ipcRenderer.invoke('expenses:delete', id),
    getSummary: (startDate, endDate) => ipcRenderer.invoke('expenses:getSummary', startDate, endDate),
  },

  // ─── Suppliers ───
  suppliers: {
    getAll: (search) => ipcRenderer.invoke('suppliers:getAll', search),
    add: (data) => ipcRenderer.invoke('suppliers:add', data),
    update: (id, data) => ipcRenderer.invoke('suppliers:update', id, data),
    delete: (id) => ipcRenderer.invoke('suppliers:delete', id),
  },

  // ─── Sales / POS ───
  sales: {
    create: (saleData, items) => ipcRenderer.invoke('sales:create', saleData, items),
    getAll: (filters) => ipcRenderer.invoke('sales:getAll', filters),
    get: (id) => ipcRenderer.invoke('sales:get', id),
    getNextInvoiceNo: () => ipcRenderer.invoke('sales:getNextInvoiceNo'),
    getDailySummary: (date) => ipcRenderer.invoke('sales:getDailySummary', date),
    getMonthlySummary: (year, month) => ipcRenderer.invoke('sales:getMonthlySummary', year, month),
  },

  // ─── Returns ───
  returns: {
    process: (saleId, productId, qty, reason, customReason, refundType) => ipcRenderer.invoke('returns:process', saleId, productId, qty, reason, customReason, refundType),
    processFullInvoice: (saleId, reason, customReason, refundType) => ipcRenderer.invoke('returns:processFullInvoice', saleId, reason, customReason, refundType),
    getAll: (filters) => ipcRenderer.invoke('returns:getAll', filters),
  },

  // ─── Customers ───
  customers: {
    getAll: (search) => ipcRenderer.invoke('customers:getAll', search),
    get: (id) => ipcRenderer.invoke('customers:get', id),
    update: (id, data) => ipcRenderer.invoke('customers:update', id, data),
    addPayment: (id, amount, method, note) => ipcRenderer.invoke('customers:addPayment', id, amount, method, note),
    getLedger: (id) => ipcRenderer.invoke('customers:getLedger', id),
  },

  // ─── Reports ───
  reports: {
    getDaily: (date) => ipcRenderer.invoke('reports:getDaily', date),
    getMonthly: (year, month) => ipcRenderer.invoke('reports:getMonthly', year, month),
    getCategory: (startDate, endDate) => ipcRenderer.invoke('reports:getCategory', startDate, endDate),
    getSizeColor: (startDate, endDate) => ipcRenderer.invoke('reports:getSizeColor', startDate, endDate),
    getTopProducts: (limit, startDate, endDate) => ipcRenderer.invoke('reports:getTopProducts', limit, startDate, endDate),
  },

  // ─── Settings ───
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (data) => ipcRenderer.invoke('settings:update', data),
  },

  // ─── Backup & Export ───
  backup: {
    backupNow: () => ipcRenderer.invoke('backup:backupNow'),
    selectFolder: () => ipcRenderer.invoke('backup:selectFolder'),
    exportAll: () => ipcRenderer.invoke('backup:exportAll'),
    exportReport: (type, data) => ipcRenderer.invoke('backup:exportReport', type, data),
    generateInvoicePDF: (saleData) => ipcRenderer.invoke('backup:generateInvoicePDF', saleData),
  },

  // ─── Window Controls ───
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
});
