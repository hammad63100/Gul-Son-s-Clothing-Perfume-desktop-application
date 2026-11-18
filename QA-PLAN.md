# QA plan

Date: 2026-11-18

Use disposable databases and a separate Electron user-data directory. Never run test sales or restores against the shop database.

| Area | Cases | Expected result |
| --- | --- | --- |
| Startup/navigation | Dashboard and every sidebar destination, empty states | No exceptions; usable content and controls |
| UI/forms | Product forms, required fields, modal close, search/filter, minimum/full window | Clear validation, no clipped actions or overlapping content |
| POS | Valid sale, duplicate product lines, oversell, zero/negative/fractional quantities, discounts, tax, credit | Accurate invoice/stock; invalid requests leave no changes |
| Inventory | Product create/update/search, bottles and attar units, stock movement | Correct units and persisted quantities |
| Customers | Credit sale, payment, overpayment, return | Balances and history remain consistent |
| Suppliers/finance | Supplier and expense validation, totals | Correct totals and rejected invalid amounts |
| Returns | Partial/full, repeated, excess, fractional, discounted sale | Correct refund and stock; no over-return |
| Data | JSON/Excel/SQLite backup and restore; transaction rollback | Round-trip preservation and atomic failures |
| Regression | Reproduce findings, fix, re-run affected and baseline suites | Documented results, no known failures in executed cases |

Exit: executed checks pass, confirmed defects fixed/retested, and untested hardware/integration scenarios explicitly listed. Testing does not guarantee absence of all defects.
