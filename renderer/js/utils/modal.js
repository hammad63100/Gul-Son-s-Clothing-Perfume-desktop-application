/* Reusable Modal System */

window.modal = {
  show({ title, bodyHTML, footerHTML = '', size = '' }) {
    const overlay = document.getElementById('modal-overlay');
    const container = document.getElementById('modal-container');
    if (!overlay || !container) return;

    container.className = `modal ${size}`;
    container.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" id="modal-btn-close">&times;</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
    `;

    overlay.classList.remove('hidden');

    const closeBtn = document.getElementById('modal-btn-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.hide();
    }

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        this.hide();
      }
    };
  },

  hide() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  },

  confirm({ title, message, confirmText = 'Confirm', confirmClass = 'btn-primary', onConfirm }) {
    this.show({
      title,
      bodyHTML: `<p style="font-size: var(--text-base); color: var(--color-text-secondary);">${message}</p>`,
      footerHTML: `
        <button class="btn btn-secondary" onclick="modal.hide()">Cancel</button>
        <button class="btn ${confirmClass}" id="modal-btn-confirm">${confirmText}</button>
      `
    });

    const btn = document.getElementById('modal-btn-confirm');
    if (btn) {
      btn.onclick = () => {
        this.hide();
        if (onConfirm) onConfirm();
      };
    }
  }
};
