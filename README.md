# Gul Son's Clothing & Perfume - Shop Manager

A comprehensive desktop application designed to manage Point of Sale (POS), Inventory, Customers, and Suppliers for "Gul Son's" Clothing & Perfume shop. Built using Electron, Node.js, and SQLite (sql.js).

## Features

- **Dashboard**: Real-time summary of sales, profits, expenses, stock valuation, and top-selling products.
- **Point of Sale (POS)**: Fast and efficient checkout process with barcode scanning, discounts, and tax handling.
- **Inventory Management**: Track stock for clothes (including sizes/colors) and perfumes. Low stock alerts and restock history.
- **Customer & Supplier Management**: Manage customer ledgers, credit tracking, supplier payables, and visit history.
- **Sales & Purchase Returns**: Comprehensive returns management adjusting stock and financials automatically.
- **Finance & Cashbook**: Track daily expenses, cash-in-hand, and overall cash flow.
- **Reporting**: Generate daily, monthly, and top-selling product reports. Export data to Excel.
- **Data Backup**: Local database backups and invoice PDF generation.

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Electron (IPC Communication)
- **Database**: SQLite (via Pure WASM `sql.js` adapter)
- **Libraries**: Chart.js (analytics), PDFKit (invoices), SheetJS (Excel export)

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/hammad63100/Gul-Son-s-Clothing-Perfume-desktop-application.git
   cd Gul-Son-s-Clothing-Perfume-desktop-application
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

## Building for Production

To package the application into an executable for distribution:

```bash
npm run build
```

The output will be generated in the `dist/` directory.

## License

All rights reserved.
