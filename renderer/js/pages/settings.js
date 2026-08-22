/* Settings, Full Backup & Restore Management Controller */

window.SettingsPage = {
  activeTab: 'backup',
  pendingRestorePath: null,
  pendingRestoreData: null,

  async render(container, defaultTab = 'backup') {
    this.activeTab = defaultTab;
    container.innerHTML = `
      <div class="page-container animate-fade-in">
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:var(--space-4);">
          <div>
            <h1 class="page-title">Settings & System Data Management</h1>
            <p class="page-subtitle">Export full system backups, restore database records, download Excel reports, and configure shop details</p>
          </div>
          <div style="display:flex; gap:var(--space-2);">
            <button class="btn btn-secondary btn-sm" onclick="SettingsPage.openSafetyBackupFolder()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span>Open Backups Folder</span>
            </button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="tabs" style="margin-bottom:var(--space-5); display:flex; gap:var(--space-2); border-bottom:1px solid var(--color-border); padding-bottom:var(--space-2);">
          <button class="btn ${this.activeTab === 'backup' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="tab-btn-backup" onclick="SettingsPage.switchTab('backup')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>1. Full Data Export & Backup</span>
          </button>
          <button class="btn ${this.activeTab === 'restore' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="tab-btn-restore" onclick="SettingsPage.switchTab('restore')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <span>2. Import & Restore Data</span>
          </button>
          <button class="btn ${this.activeTab === 'safety' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="tab-btn-safety" onclick="SettingsPage.switchTab('safety')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>3. Auto Safety Snapshots</span>
          </button>
          <button class="btn ${this.activeTab === 'shop' ? 'btn-primary' : 'btn-secondary'} btn-sm" id="tab-btn-shop" onclick="SettingsPage.switchTab('shop')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>4. Shop Configuration</span>
          </button>
          <button class="btn ${this.activeTab === 'reset' ? 'btn-danger' : 'btn-secondary'} btn-sm" id="tab-btn-reset" onclick="SettingsPage.switchTab('reset')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            <span>5. Clear Data (Client Reset)</span>
          </button>
        </div>

        <!-- TAB CONTENT CONTAINER -->
        <div id="settings-tab-content">
          <!-- Rendered dynamically -->
        </div>

      </div>
    `;

    this.renderActiveTab();
  },

  switchTab(tabName) {
    this.activeTab = tabName;
    ['backup', 'restore', 'safety', 'shop', 'reset'].forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      if (btn) {
        if (t === tabName) {
          btn.className = t === 'reset' ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm';
        } else {
          btn.className = 'btn btn-secondary btn-sm';
        }
      }
    });
    this.renderActiveTab();
  },

  async renderActiveTab() {
    const container = document.getElementById('settings-tab-content');
    if (!container) return;

    if (this.activeTab === 'backup') {
      container.innerHTML = `
        <div class="grid grid-2 gap-6 animate-fade-in">
          
          <!-- SQLite & JSON Backup Card -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Full System Database Backup</h3>
                <p class="card-subtitle">Exports 100% of all data from Day 1 (Stock, Sales, Expenses, Customers, Khata, Suppliers, Settings)</p>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:var(--space-4);">
              
              <div style="background:var(--color-bg-tertiary); padding:var(--space-4); border-radius:var(--radius-md); border:1px solid var(--color-border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-2);">
                  <span style="font-size:var(--text-xs); font-weight:700; color:var(--color-accent); text-transform:uppercase;">Configured Auto Backup Directory</span>
                  <button class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:11px;" onclick="SettingsPage.selectBackupFolder()">Change Folder</button>
                </div>
                <p style="font-size:var(--text-xs); color:var(--color-text-secondary); word-break:break-all;" id="set-backup-path-text">Loading path...</p>
              </div>

              <!-- Option 1: Direct SQLite File Backup -->
              <div style="border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-4); background:var(--color-bg-card);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <h4 style="font-size:var(--text-sm); font-weight:600; color:var(--color-text-primary);">1. Instant Database Snapshot (.db)</h4>
                    <p style="font-size:var(--text-xs); color:var(--color-text-muted); margin-top:2px;">Complete SQLite binary backup. Best for direct app restoration.</p>
                  </div>
                  <button class="btn btn-success" onclick="SettingsPage.backupNow()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    <span>Instant Backup (.db)</span>
                  </button>
                </div>
              </div>

              <!-- Option 2: Universal JSON Archive Backup -->
              <div style="border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-4); background:var(--color-bg-card);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <h4 style="font-size:var(--text-sm); font-weight:600; color:var(--color-text-primary);">2. Universal JSON Full System Backup (.json)</h4>
                    <p style="font-size:var(--text-xs); color:var(--color-text-muted); margin-top:2px;">Human-readable structured archive with all 14 tables and counts.</p>
                  </div>
                  <button class="btn btn-primary" onclick="SettingsPage.exportJson()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    <span>Export JSON Backup (.json)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

          <!-- Excel Master Export & Data Health Card -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Comprehensive Master Excel Export</h3>
                <p class="card-subtitle">Export all 15 tables into an organized Excel spreadsheet with formatted sheets</p>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:var(--space-4);">
              
              <div style="border:1px solid rgba(26,35,126,0.3); border-radius:var(--radius-md); padding:var(--space-4); background:rgba(26,35,126,0.06);">
                <h4 style="font-size:var(--text-sm); font-weight:700; color:var(--color-info); margin-bottom:4px;">Sheets Included in Excel Export:</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:var(--text-xs); color:var(--color-text-secondary); margin-top:var(--space-2);">
                  <div>✓ Products & Stock Inventory</div>
                  <div>✓ Sales Invoices & Totals</div>
                  <div>✓ Sale Items Sold Breakdown</div>
                  <div>✓ All Expenses & Categories</div>
                  <div>✓ Customers & Khata Balances</div>
                  <div>✓ Customer Ledger Payments</div>
                  <div>✓ Suppliers & Vendors</div>
                  <div>✓ Sales Returns & Refunds</div>
                  <div>✓ Stock Adjustments History</div>
                  <div>✓ Master Categories & Brands</div>
                  <div>✓ Master Fragrance Types</div>
                  <div>✓ Audit Activity Logs</div>
                </div>

                <div style="margin-top:var(--space-4);">
                  <button class="btn btn-secondary" style="width:100%; justify-content:center;" onclick="SettingsPage.exportAllData()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <span>Download Complete Master Excel File (.xlsx)</span>
                  </button>
                </div>
              </div>

              <div style="padding:var(--space-3) var(--space-4); background:var(--color-accent-light); border-radius:var(--radius-md); border:1px solid rgba(200,168,78,0.2);">
                <p style="font-size:var(--text-xs); color:var(--color-text-secondary); line-height:1.5;">
                  <strong style="color:var(--color-accent);">Tip:</strong> Taking regular weekly backups to a USB Flash Drive guarantees that even in case of hard disk failure, all client records and stock can be restored in seconds.
                </p>
              </div>

            </div>
          </div>

        </div>
      `;
      this.loadBackupSettingsPath();

    } else if (this.activeTab === 'restore') {
      container.innerHTML = `
        <div class="card animate-fade-in" style="max-width:900px; margin:0 auto;">
          <div class="card-header">
            <div>
              <h3 class="card-title">Restore System Data from Backup File</h3>
              <p class="card-subtitle">Import your full records from a previous SQLite (.db) or Universal JSON (.json) backup file</p>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:var(--space-5);">
            
            <div style="padding:var(--space-4); background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.25); border-radius:var(--radius-md);">
              <div style="display:flex; gap:var(--space-3); align-items:flex-start;">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2" style="width:24px; height:24px; flex-shrink:0; margin-top:2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                  <h4 style="font-size:var(--text-sm); font-weight:700; color:var(--color-danger);">Automatic Safety Snapshot Protection</h4>
                  <p style="font-size:var(--text-xs); color:var(--color-text-secondary); margin-top:4px; line-height:1.5;">
                    Before replacing any data, the system will <strong>automatically create an automatic safety backup</strong> of your current database in the app folder. You will also see a full preview of what is inside the backup file before confirming.
                  </p>
                </div>
              </div>
            </div>

            <!-- Upload / Select Box -->
            <div style="border:2px dashed var(--color-border); border-radius:var(--radius-lg); padding:var(--space-8); text-align:center; background:var(--color-bg-tertiary);">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2" style="width:48px; height:48px; margin:0 auto var(--space-3);"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/><polyline points="16 16 12 12 8 16"/></svg>
              <h3 style="font-size:var(--text-md); font-weight:700; color:var(--color-text-primary);">Select Backup File (.db, .sqlite, or .json)</h3>
              <p style="font-size:var(--text-xs); color:var(--color-text-muted); max-width:450px; margin:var(--space-2) auto var(--space-4);">
                Choose any previous backup taken on this computer or transferred from another computer.
              </p>
              <button class="btn btn-primary" onclick="SettingsPage.selectFileToRestore()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Browse & Select Backup File...</span>
              </button>
            </div>

          </div>
        </div>
      `;

    } else if (this.activeTab === 'safety') {
      container.innerHTML = `
        <div class="card animate-fade-in">
          <div class="card-header">
            <div>
              <h3 class="card-title">Automatic Safety Snapshots</h3>
              <p class="card-subtitle">Automatic snapshots created automatically prior to previous restores and closures</p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="SettingsPage.openSafetyBackupFolder()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <span>Explore Folder</span>
            </button>
          </div>

          <div class="table-responsive" style="margin-top:var(--space-3);">
            <table class="table" style="width:100%;">
              <thead>
                <tr>
                  <th>Snapshot File Name</th>
                  <th>Created Date & Time</th>
                  <th>File Size</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody id="safety-backups-tbody">
                <tr><td colspan="4" style="text-align:center; padding:var(--space-6); color:var(--color-text-muted);">Loading snapshots...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      this.loadSafetyBackups();

    } else if (this.activeTab === 'shop') {
      container.innerHTML = `
        <div class="card animate-fade-in" style="max-width:800px;">
          <h3 class="card-title" style="margin-bottom:var(--space-4);">Shop Details & Invoice Header</h3>
          <form id="form-settings" onsubmit="event.preventDefault(); SettingsPage.saveSettings();">
            
            <div class="form-group">
              <label class="form-label">Shop Name *</label>
              <input type="text" class="form-input" id="set-shop-name" placeholder="Gul Son's" required>
            </div>

            <div class="form-group" style="margin-top:var(--space-3);">
              <label class="form-label">Address / Tagline</label>
              <input type="text" class="form-input" id="set-shop-address" placeholder="Main Bazaar, Shop #12">
            </div>

            <div class="form-group" style="margin-top:var(--space-3);">
              <label class="form-label">Contact Phone Number</label>
              <input type="text" class="form-input" id="set-shop-phone" placeholder="0300-1234567">
            </div>

            <div class="form-row" style="margin-top:var(--space-3);">
              <div class="form-group">
                <label class="form-label">Currency Symbol</label>
                <input type="text" class="form-input" id="set-currency" value="Rs.">
              </div>
              <div class="form-group">
                <label class="form-label">Low Stock Threshold</label>
                <input type="number" class="form-input" id="set-threshold" value="5" min="1">
              </div>
            </div>

            <div class="form-row" style="margin-top:var(--space-3);">
              <div class="form-group">
                <label class="form-label">Invoice Prefix</label>
                <input type="text" class="form-input" id="set-inv-prefix" value="GS">
              </div>
              <div class="form-group">
                <label class="form-label">Backup Reminder on Exit</label>
                <select class="form-select" id="set-reminder">
                  <option value="true">Enabled (Prompt on exit)</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" style="margin-top:var(--space-5);">Save Configuration</button>
          </form>
        </div>
      `;
      this.loadShopSettings();

    } else if (this.activeTab === 'reset') {
      container.innerHTML = `
        <div class="card animate-fade-in" style="max-width:850px; margin:0 auto;">
          <div class="card-header" style="border-bottom:1px solid var(--color-border); padding-bottom:var(--space-3); margin-bottom:var(--space-4);">
            <div>
              <h3 class="card-title" style="color:var(--color-danger); display:flex; align-items:center; gap:var(--space-2);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px;"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                <span>Clear Database (Factory Reset for Client Handover)</span>
              </h3>
              <p class="card-subtitle">Wipe all test records completely to give your client a clean, fresh, empty software</p>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:var(--space-4);">
            
            <div style="padding:var(--space-4); background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); border-radius:var(--radius-md);">
              <h4 style="font-size:var(--text-sm); font-weight:700; color:var(--color-danger); margin-bottom:6px;">⚠️ Important Notice before Client Handover:</h4>
              <p style="font-size:var(--text-xs); color:var(--color-text-secondary); line-height:1.6;">
                Clicking the button below will <strong>permanently delete all test records</strong>:
              </p>
              <ul style="font-size:var(--text-xs); color:var(--color-text-secondary); margin:var(--space-2) 0 var(--space-2) var(--space-5); line-height:1.6;">
                <li><strong>All Products & Current Stock</strong> (Clean slate for client to add their actual inventory)</li>
                <li><strong>All Sales, Invoices & Sold Items</strong> (Resets invoice counter to <code>GS-000001</code>)</li>
                <li><strong>All Customers, Khata & Payments</strong></li>
                <li><strong>All Suppliers & Vendor records</strong></li>
                <li><strong>All Expenses & Cash Out entries</strong></li>
                <li><strong>All Sales Returns & Supplier Purchase Returns</strong></li>
                <li><strong>All Stock Adjustment audit logs</strong></li>
              </ul>
              <p style="font-size:var(--text-xs); color:var(--color-text-muted);">
                ✓ <em>Default Categories (Men's Shirts, Perfumes, etc.) and Brand catalogs are preserved.</em>
              </p>
            </div>

            <div style="border:2px dashed rgba(239,68,68,0.3); border-radius:var(--radius-lg); padding:var(--space-6); text-align:center; background:var(--color-bg-tertiary);">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="2" style="width:48px; height:48px; margin:0 auto var(--space-3);"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <h3 style="font-size:var(--text-md); font-weight:700; color:var(--color-text-primary);">Wipe All Test Data Now</h3>
              <p style="font-size:var(--text-xs); color:var(--color-text-muted); max-width:480px; margin:var(--space-2) auto var(--space-4);">
                Once cleared, the application will be 100% fresh with 0 sales and 0 products, ready for the client.
              </p>
              <button class="btn btn-danger" style="padding:var(--space-3) var(--space-6); font-weight:700;" onclick="SettingsPage.confirmClearDatabase()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; height:18px;"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Wipe Database & Reset for Client</span>
              </button>
            </div>

          </div>
        </div>
      `;
    }
  },

  async loadBackupSettingsPath() {
    try {
      const s = await window.api.settings.get();
      const pathText = document.getElementById('set-backup-path-text');
      if (pathText) {
        pathText.textContent = s.backup_path ? s.backup_path : 'Default system folder (Click "Change Folder" to specify external USB or custom path)';
      }
    } catch (e) {}
  },

  async loadShopSettings() {
    try {
      const s = await window.api.settings.get();
      if (document.getElementById('set-shop-name')) document.getElementById('set-shop-name').value = s.shop_name || "Gul Son's";
      if (document.getElementById('set-shop-address')) document.getElementById('set-shop-address').value = s.shop_address || '';
      if (document.getElementById('set-shop-phone')) document.getElementById('set-shop-phone').value = s.shop_phone || '';
      if (document.getElementById('set-currency')) document.getElementById('set-currency').value = s.currency_symbol || 'Rs.';
      if (document.getElementById('set-threshold')) document.getElementById('set-threshold').value = s.low_stock_threshold || '5';
      if (document.getElementById('set-inv-prefix')) document.getElementById('set-inv-prefix').value = s.invoice_prefix || 'GS';
      if (document.getElementById('set-reminder')) document.getElementById('set-reminder').value = s.backup_reminder || 'true';
    } catch (err) {
      console.error(err);
      toast.error('Failed to load shop settings');
    }
  },

  async saveSettings() {
    const data = {
      shop_name: document.getElementById('set-shop-name').value.trim(),
      shop_address: document.getElementById('set-shop-address').value.trim(),
      shop_phone: document.getElementById('set-shop-phone').value.trim(),
      currency_symbol: document.getElementById('set-currency').value.trim() || 'Rs.',
      low_stock_threshold: document.getElementById('set-threshold').value.trim() || '5',
      invoice_prefix: document.getElementById('set-inv-prefix').value.trim() || 'GS',
      backup_reminder: document.getElementById('set-reminder').value,
    };

    try {
      await window.api.settings.update(data);
      toast.success('Settings saved successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings: ' + err.message);
    }
  },

  async selectBackupFolder() {
    try {
      const folder = await window.api.backup.selectFolder();
      if (folder) {
        const pathText = document.getElementById('set-backup-path-text');
        if (pathText) pathText.textContent = folder;
        toast.success('Backup folder updated: ' + folder);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to select backup directory');
    }
  },

  async backupNow() {
    try {
      toast.info('Creating SQLite database backup...');
      const res = await window.api.backup.backupNow();
      if (res && res.success) {
        toast.success(`Backup created: ${res.fileName}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Backup failed: ' + err.message);
    }
  },

  async exportJson() {
    try {
      const res = await window.api.backup.exportJson();
      if (res && res.success) {
        toast.success(`Full system JSON backup exported (${res.summary.products || 0} products, ${res.summary.sales || 0} sales)`);
      }
    } catch (err) {
      console.error(err);
      toast.error('JSON export failed: ' + err.message);
    }
  },

  async exportAllData() {
    try {
      const res = await window.api.backup.exportAll();
      if (res && res.success) {
        toast.success(`Master Excel workbook exported to ${res.path}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Excel export failed: ' + err.message);
    }
  },

  async openSafetyBackupFolder() {
    try {
      await window.api.backup.openSafetyBackupFolder();
    } catch (e) {
      toast.error('Could not open folder: ' + e.message);
    }
  },

  async loadSafetyBackups() {
    try {
      const tbody = document.getElementById('safety-backups-tbody');
      if (!tbody) return;

      const backups = await window.api.backup.getSafetyBackups();
      if (!backups || backups.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:var(--space-6); color:var(--color-text-muted);">No automatic safety snapshots found yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = backups.map(b => `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:var(--space-2);">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="2" style="width:16px; height:16px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
              <strong style="color:var(--color-text-primary); font-size:var(--text-xs);">${b.fileName}</strong>
            </div>
          </td>
          <td style="font-size:var(--text-xs); color:var(--color-text-secondary);">${new Date(b.createdAt).toLocaleString()}</td>
          <td style="font-size:var(--text-xs); color:var(--color-text-muted);">${b.sizeFormatted}</td>
          <td style="text-align:right;">
            <button class="btn btn-secondary btn-sm" style="padding:2px 10px; font-size:11px;" onclick="SettingsPage.inspectAndConfirmRestore('${b.fullPath.replace(/\\/g, '\\\\')}')">
              <span>Restore from this snapshot</span>
            </button>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error(err);
      toast.error('Failed to load safety snapshots: ' + err.message);
    }
  },

  async selectFileToRestore() {
    try {
      const filePath = await window.api.backup.selectFileToRestore();
      if (!filePath) return;
      await this.inspectAndConfirmRestore(filePath);
    } catch (err) {
      console.error(err);
      toast.error('Failed to open backup file: ' + err.message);
    }
  },

  async inspectAndConfirmRestore(filePath) {
    try {
      toast.info('Validating backup file contents...');
      const inspection = await window.api.backup.inspectFile(filePath);

      if (!inspection || !inspection.valid) {
        toast.error('Invalid backup file: ' + (inspection?.error || 'Validation failed'));
        return;
      }

      const stats = inspection.stats || {};
      const formatNum = (n) => (n !== undefined && n !== null) ? Number(n).toLocaleString() : '0';

      const previewHtml = `
        <div style="display:flex; flex-direction:column; gap:var(--space-4);">
          
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--color-bg-tertiary); padding:var(--space-3) var(--space-4); border-radius:var(--radius-md); border:1px solid var(--color-border);">
            <div>
              <span style="font-size:10px; font-weight:700; color:var(--color-accent); text-transform:uppercase;">Backup File</span>
              <p style="font-size:var(--text-sm); font-weight:600; color:var(--color-text-primary); margin-top:2px;">${inspection.fileName}</p>
            </div>
            <div style="text-align:right;">
              <span style="font-size:10px; font-weight:700; color:var(--color-text-muted); text-transform:uppercase;">Format & Size</span>
              <p style="font-size:var(--text-xs); color:var(--color-text-secondary); margin-top:2px;">${inspection.type.toUpperCase()} • ${inspection.fileSize}</p>
            </div>
          </div>

          <h4 style="font-size:var(--text-sm); font-weight:700; color:var(--color-text-primary); margin-bottom:0;">Records Found in Backup:</h4>
          
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:var(--space-3);">
            <div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-3); text-align:center;">
              <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-accent);">${formatNum(stats.products)}</div>
              <div style="font-size:var(--text-xs); color:var(--color-text-secondary); margin-top:2px;">Products / Stock</div>
            </div>
            <div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-3); text-align:center;">
              <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-success);">${formatNum(stats.sales)}</div>
              <div style="font-size:var(--text-xs); color:var(--color-text-secondary); margin-top:2px;">Sales Invoices</div>
            </div>
            <div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-3); text-align:center;">
              <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-info);">${formatNum(stats.expenses)}</div>
              <div style="font-size:var(--text-xs); color:var(--color-text-secondary); margin-top:2px;">Expenses Logged</div>
            </div>
            <div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-3); text-align:center;">
              <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-text-primary);">${formatNum(stats.customers)}</div>
              <div style="font-size:var(--text-xs); color:var(--color-text-secondary); margin-top:2px;">Customers</div>
            </div>
            <div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-3); text-align:center;">
              <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-text-primary);">${formatNum(stats.suppliers)}</div>
              <div style="font-size:var(--text-xs); color:var(--color-text-secondary); margin-top:2px;">Suppliers</div>
            </div>
            <div style="background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:var(--space-3); text-align:center;">
              <div style="font-size:var(--text-xl); font-weight:800; color:var(--color-text-primary);">${formatNum(stats.returns)}</div>
              <div style="font-size:var(--text-xs); color:var(--color-text-secondary); margin-top:2px;">Returns / Refunds</div>
            </div>
          </div>

          <div style="padding:var(--space-3); background:rgba(239,68,68,0.08); border-radius:var(--radius-md); border:1px solid rgba(239,68,68,0.25);">
            <p style="font-size:var(--text-xs); color:var(--color-danger); line-height:1.4;">
              <strong>Warning:</strong> Restoring this backup will replace current system data with the records from this file. A safety copy of current database will be saved before restore starts.
            </p>
          </div>

        </div>
      `;

      modal.show({
        title: 'Confirm Database Restore',
        bodyHTML: previewHtml,
        size: 'modal-lg',
        footerHTML: `
          <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
          <button class="btn btn-danger" id="modal-btn-execute-restore">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <span>Proceed & Restore Data Now</span>
          </button>
        `
      });

      const execBtn = document.getElementById('modal-btn-execute-restore');
      if (execBtn) {
        execBtn.onclick = async () => {
          modal.hide();
          await SettingsPage.executeRestore(filePath);
        };
      }

    } catch (err) {
      console.error(err);
      toast.error('Failed to inspect backup file: ' + err.message);
    }
  },

  async executeRestore(filePath) {
    try {
      toast.info('Restoring database from backup file...');
      const res = await window.api.backup.restoreFile(filePath);

      if (res && res.success) {
        toast.success(`Database restored successfully (${res.totalRecords || 0} total records restored)!`);
        // Refresh active page or navigate to dashboard
        setTimeout(() => {
          window.app.navigateTo('dashboard');
        }, 800);
      } else {
        toast.error('Restore failed: Unknown error');
      }
    } catch (err) {
      console.error(err);
      toast.error('Restore failed: ' + err.message);
    }
  },

  async confirmClearDatabase() {
    modal.confirm({
      title: '🚨 Wipe All Database Records?',
      message: 'Are you sure you want to permanently clear all products, stock, sales, customer khata, expenses, and returns? This cannot be undone and resets the app for client handover.',
      confirmText: 'Yes, Wipe Everything & Reset',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        await SettingsPage.executeClearDatabase();
      }
    });
  },

  async executeClearDatabase() {
    try {
      toast.info('Wiping all test records from database...');
      const res = await window.api.settings.clearDatabase();
      if (res && res.success) {
        toast.success('Database completely wiped! 0 Products, 0 Sales, Invoices reset.');
        setTimeout(() => {
          window.app.navigateTo('dashboard');
        }, 800);
      } else {
        toast.error('Failed to reset database');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear database: ' + err.message);
    }
  }
};

