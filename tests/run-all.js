// tests/run-all.js
// Central Test Suite Runner for Gul Son's Shop Manager

// Load all unit & integration test suites into node:test runner
require('./unit/products.test');
require('./unit/sales.test');
require('./unit/customers.test');
require('./unit/returns.test');
require('./unit/expenses.test');
require('./unit/reports.test');
require('./unit/suppliers.test');
require('./unit/master-data.test');
require('./unit/settings.test');
require('./unit/whatsapp.test');
require('./unit/regressions.test');
require('./unit/security.test');
require('./unit/failure-resilience.test');
require('./unit/performance.test');
require('./integration/export.test');
