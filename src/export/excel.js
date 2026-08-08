const ExcelJS = require('exceljs');

async function exportReportToExcel(type, data, filePath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gul Son's Shop Manager";
  workbook.created = new Date();

  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    },
  };

  if (type === 'daily' || type === 'monthly') {
    const sheet = workbook.addWorksheet(`${type.charAt(0).toUpperCase() + type.slice(1)} Report`);

    // Summary section
    sheet.addRow(['Summary']);
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.addRow(['Total Sales', data.total_sales || 0]);
    sheet.addRow(['Total Revenue', data.total_revenue || 0]);
    sheet.addRow(['Total Profit', data.total_profit || 0]);
    sheet.addRow(['Total Discounts', data.total_discounts || 0]);
    sheet.addRow(['Unique Customers', data.unique_customers || 0]);
    sheet.addRow([]);

    // Top products
    if (data.topProducts && data.topProducts.length > 0) {
      sheet.addRow(['Top Products']);
      sheet.getRow(sheet.lastRow.number).font = { bold: true, size: 12 };
      const headerRow = sheet.addRow(['Product', 'Size', 'Color', 'Qty Sold', 'Revenue']);
      headerRow.eachCell(cell => Object.assign(cell, headerStyle));

      for (const p of data.topProducts) {
        sheet.addRow([p.product_name, p.product_size || '-', p.product_color || '-', p.total_qty, p.total_revenue]);
      }
    }

    // Daily breakdown (for monthly)
    if (data.dailyBreakdown && data.dailyBreakdown.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['Daily Breakdown']);
      sheet.getRow(sheet.lastRow.number).font = { bold: true, size: 12 };
      const headerRow = sheet.addRow(['Date', 'Sales Count', 'Revenue']);
      headerRow.eachCell(cell => Object.assign(cell, headerStyle));

      for (const d of data.dailyBreakdown) {
        sheet.addRow([d.date, d.sales_count, d.revenue]);
      }
    }

    sheet.columns.forEach(col => { col.width = 18; });

  } else if (type === 'category') {
    const sheet = workbook.addWorksheet('Category Report');
    const headerRow = sheet.addRow(['Category', 'Total Sales', 'Qty Sold', 'Revenue', 'Profit']);
    headerRow.eachCell(cell => Object.assign(cell, headerStyle));

    if (Array.isArray(data)) {
      for (const row of data) {
        sheet.addRow([row.category, row.total_sales, row.total_qty, row.total_revenue, row.total_profit]);
      }
    }
    sheet.columns.forEach(col => { col.width = 18; });

  } else if (type === 'sizeColor') {
    if (data.bySize && data.bySize.length > 0) {
      const sizeSheet = workbook.addWorksheet('By Size');
      const headerRow = sizeSheet.addRow(['Size', 'Qty Sold', 'Revenue']);
      headerRow.eachCell(cell => Object.assign(cell, headerStyle));
      for (const row of data.bySize) {
        sizeSheet.addRow([row.variant, row.total_qty, row.total_revenue]);
      }
      sizeSheet.columns.forEach(col => { col.width = 18; });
    }

    if (data.byColor && data.byColor.length > 0) {
      const colorSheet = workbook.addWorksheet('By Color');
      const headerRow = colorSheet.addRow(['Color', 'Qty Sold', 'Revenue']);
      headerRow.eachCell(cell => Object.assign(cell, headerStyle));
      for (const row of data.byColor) {
        colorSheet.addRow([row.variant, row.total_qty, row.total_revenue]);
      }
      colorSheet.columns.forEach(col => { col.width = 18; });
    }
  }

  await workbook.xlsx.writeFile(filePath);
  return { success: true, path: filePath };
}

module.exports = { exportReportToExcel };
