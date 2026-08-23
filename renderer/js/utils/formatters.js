/* Formatters for currency, dates, numbers */

window.formatters = {
  currency(amount, symbol = 'Rs.') {
    const val = parseFloat(amount) || 0;
    return `${symbol} ${val.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  },

  date(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  dateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  number(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString();
  },

  getProductUnit(p) {
    if (!p) return 'Items';
    const cat = p.category || '';
    const size = (p.size || p.product_size || p.variant || '').trim();
    const fragType = (p.fragrance_type || '').trim().toLowerCase();

    // 1. Perfume
    if (cat === 'Perfume') {
      if (fragType === 'body spray' || fragType === 'body spary') {
        return 'Items';
      }
      if (size.toLowerCase().includes('bottle') || size.includes('بوتل')) {
        return 'Bottles';
      }
      if (size.toLowerCase().includes('tola') || size.includes('تولہ')) {
        return 'Tola';
      }
      if (size.toLowerCase().includes('tester')) {
        return 'Testers';
      }
      return 'Items';
    }

    // 2. Hosiery
    if (cat === 'Hosiery') {
      if (size.toLowerCase().includes('pack of 3') || size.toLowerCase().includes('pack of 6')) return 'Packs';
      if (size.toLowerCase().includes('dozen')) return 'Dozens';
      return 'Items';
    }

    // 3. Clothes
    if (cat === 'Clothes') {
      if (size.includes('Meter') || size.includes('میٹر') || size.toLowerCase().includes('meter')) {
        return 'Meter';
      }
      if (size.includes('Yard') || size.includes('Gazz') || size.includes('گز')) {
        return 'Yard';
      }
      if (size.includes('Suit') || size.includes('سوٹ')) {
        return 'Suit';
      }
      if (size.includes('Gira') || size.includes('گرہ')) {
        return 'Gira';
      }
      if (size.includes('Arz') || size.includes('Bahr') || size.includes('عرض')) {
        return 'Arz';
      }
      if (size.includes('Pcs') || size.includes('پیس') || size.includes('تھان')) {
        return 'Pcs';
      }
      if (size.toLowerCase().includes('piece')) {
        return 'Pcs';
      }
      if (size) {
        const cleaned = size.replace(/^[\d.]+\s*/, '').replace(/\(.*\)/, '').trim();
        if (cleaned) return cleaned;
      }
      return 'Meter';
    }

    return 'Items';
  },

  formatStock(qty, product) {
    const val = qty !== undefined && qty !== null ? qty : (product ? product.quantity : 0);
    const unit = this.getProductUnit(product);
    return `${val} ${unit}`;
  }
};
