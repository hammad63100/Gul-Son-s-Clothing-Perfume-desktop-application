/* Main Application Router & Controller */

window.app = {
  currentPage: 'dashboard',
  splashTimer: null,

  init() {
    this.setupTitlebarControls();
    this.setupNavigation();
    this.startSplashScreen();
    this.navigateTo('dashboard');
  },

  startSplashScreen() {
    const overlay = document.getElementById('splash-overlay');
    const phase1 = document.getElementById('splash-phase-1');
    const phase2 = document.getElementById('splash-phase-2');
    const skipBtn = document.getElementById('splash-btn-skip');

    if (!overlay || !phase1 || !phase2) return;

    const hideSplash = () => {
      clearTimeout(this.splashTimer);
      overlay.classList.add('hidden');
    };

    if (skipBtn) {
      skipBtn.onclick = hideSplash;
    }

    // Step 1: Show Kalma (Phase 1) for 2.5 seconds
    this.splashTimer = setTimeout(() => {
      phase1.style.display = 'none';
      phase2.style.display = 'flex';

      // Step 2: Show Logo + Welcome message (Phase 2) for 2.5 seconds
      this.splashTimer = setTimeout(() => {
        hideSplash();
      }, 2500);
    }, 2500);
  },

  setupTitlebarControls() {
    document.getElementById('btn-minimize')?.addEventListener('click', () => {
      window.api.window.minimize();
    });

    document.getElementById('btn-maximize')?.addEventListener('click', () => {
      window.api.window.maximize();
    });

    document.getElementById('btn-close')?.addEventListener('click', () => {
      window.api.window.close();
    });
  },

  setupNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const page = item.getAttribute('data-page');
        if (page) {
          this.navigateTo(page);
        }
      });
    });
  },

  async navigateTo(pageName) {
    if (pageName === 'shutdown') {
      window.api.window.close();
      return;
    }

    this.currentPage = pageName;

    // Highlight active item in sidebar
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      if (item.getAttribute('data-page') === pageName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    switch (pageName) {
      case 'search':
        await InventoryPage.render(mainContent);
        const searchInput = document.getElementById('inv-search');
        if (searchInput) searchInput.focus();
        break;

      case 'dashboard':
        await DashboardPage.render(mainContent);
        break;

      case 'pos':
        await POSPage.render(mainContent);
        break;

      case 'sales-return':
        await SalesHistoryPage.render(mainContent, 'returns');
        break;

      case 'customers':
        await CustomersPage.render(mainContent);
        break;

      case 'add-stock':
        await InventoryPage.render(mainContent);
        InventoryPage.openAddModal();
        break;

      case 'purchase-stock':
        await InventoryPage.render(mainContent);
        const products = await window.api.products.getAll();
        if (products && products.length > 0) {
          InventoryPage.openStockInModal(products[0].id);
        } else {
          InventoryPage.openAddModal();
        }
        break;

      case 'purchase-return':
        await InventoryPage.render(mainContent, 'low-stock');
        break;

      case 'company-voucher':
        await SuppliersPage.render(mainContent);
        break;

      case 'stock-report':
        await ReportsPage.render(mainContent);
        ReportsPage.switchTab('category');
        break;

      case 'cash-book':
        await FinancePage.render(mainContent);
        FinancePage.switchTab('cashbook');
        break;

      case 'backup':
        await SettingsPage.render(mainContent);
        break;

      default:
        await DashboardPage.render(mainContent);
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
