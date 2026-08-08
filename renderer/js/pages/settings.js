/* Settings & Backup Page Controller */

window.SettingsPage = {
  async render(container) {
    container.innerHTML = `
      <div class="page-container animate-fade-in">
        <div class="page-header">
          <div>
            <h1 class="page-title">Settings & Data Management</h1>
            <p class="page-subtitle">Configure shop details, receipt headers, database backups, and low stock thresholds</p>
          </div>
        </div>

        <div class="grid grid-2 gap-6">

          <!-- Shop Configuration Card -->
          <div class="card">
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

          <!-- Backup & Data Export Card -->
          <div class="card">
            <h3 class="card-title" style="margin-bottom:var(--space-4);">Backup & Export Tools</h3>
            
            <div style="display:flex; flex-direction:column; gap:var(--space-4);">
              
              <div style="background:var(--color-bg-tertiary); padding:var(--space-4); border-radius:var(--radius-md); border:1px solid var(--color-border);">
                <h4 style="font-size:var(--text-base); font-weight:600; margin-bottom:4px;">Database Backup Path</h4>
                <p style="font-size:var(--text-xs); color:var(--color-text-muted); margin-bottom:var(--space-3);" id="set-backup-path-text">No path selected</p>
                <button class="btn btn-secondary btn-sm" onclick="SettingsPage.selectBackupFolder()">Choose Folder / USB Location</button>
              </div>

              <div style="display:flex; gap:var(--space-3);">
                <button class="btn btn-success" style="flex:1;" onclick="SettingsPage.backupNow()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  <span>Backup Now</span>
                </button>

                <button class="btn btn-secondary" style="flex:1;" onclick="SettingsPage.exportAllData()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Export All Data (Excel)</span>
                </button>
              </div>

              <div style="margin-top:var(--space-4); padding:var(--space-4); background:var(--color-accent-light); border-radius:var(--radius-md); border:1px solid rgba(200,168,78,0.2);">
                <h4 style="font-size:var(--text-sm); font-weight:700; color:var(--color-accent);">Data Safety Tip</h4>
                <p style="font-size:var(--text-xs); color:var(--color-text-secondary); margin-top:4px;">
                  All shop records are stored safely in an offline SQLite database on your local disk. Taking daily backups to an external USB drive protects your data against hardware failure.
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    `;

    await this.loadSettings();
  },

  async loadSettings() {
    try {
      const s = await window.api.settings.get();
      document.getElementById('set-shop-name').value = s.shop_name || "Gul Son's";
      document.getElementById('set-shop-address').value = s.shop_address || '';
      document.getElementById('set-shop-phone').value = s.shop_phone || '';
      document.getElementById('set-currency').value = s.currency_symbol || 'Rs.';
      document.getElementById('set-threshold').value = s.low_stock_threshold || '5';
      document.getElementById('set-inv-prefix').value = s.invoice_prefix || 'GS';
      document.getElementById('set-reminder').value = s.backup_reminder || 'true';

      const pathText = document.getElementById('set-backup-path-text');
      if (pathText) {
        pathText.textContent = s.backup_path ? `Current: ${s.backup_path}` : 'No location configured (Click below to set)';
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load settings');
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
      toast.error('Failed to save settings');
    }
  },

  async selectBackupFolder() {
    try {
      const folder = await window.api.backup.selectFolder();
      if (folder) {
        document.getElementById('set-backup-path-text').textContent = `Current: ${folder}`;
        toast.success('Backup folder configured!');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to set backup path');
    }
  },

  async backupNow() {
    try {
      const res = await window.api.backup.backupNow();
      if (res && res.success) {
        toast.success(`Database backed up to ${res.path}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Backup failed: ' + err.message);
    }
  },

  async exportAllData() {
    try {
      const res = await window.api.backup.exportAll();
      if (res && res.success) {
        toast.success(`Full database exported to ${res.path}`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Export failed: ' + err.message);
    }
  }
};
