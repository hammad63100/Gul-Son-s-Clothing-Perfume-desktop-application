# QA execution report — 18 November 2026

Status: this QA round passed its automated checks and desktop smoke scenarios. This is not a claim that every possible defect has been eliminated or a complete production/accounting sign-off.

## Environment and data safety

- Electron development app on Windows; real renderer/preload/IPC/database modules.
- Isolated temporary QA databases, never the shop's production database.
- Desktop checked at 1400×900 and 1100×700.
- Physical receipt printing disabled in the QA launcher. No WhatsApp messages sent.
- Initial sandbox renderer startup failed; isolated desktop instance ran outside the sandbox. An initial QA launcher's disconnected output pipe was corrected using file logging. These launch issues were not counted as production application defects.

## Executed automated checks

| Suite | Result |
| --- | --- |
| `npm test` | Passed |
| Functional database scenarios | 22 passed, 0 failed |
| POS renderer state regression | Passed: visible reset, field reset, duplicate submission |
| Cashbook renderer regression | Passed: refund counted once, cash/credit and bank separation |
| JSON, Excel and SQLite export/inspection/restore | Passed |
| `npm run test:wasm` | Passed backup and 22 functional checks on sql.js, the Electron fallback engine |
| `git diff --check` | Passed |

Functional scenarios include product creation/search, negative prices, empty sales, invalid quantities, overselling/rollback, combined-stock limits, discount/tax validation, credit/payment/overpayment, partial/full/excess returns, expenses, stock-in, supplier return and Raast fees.

## Confirmed defects corrected

| Finding | Correction and verification |
| --- | --- |
| sql.js insert ID became zero after persistence | Read `last_insert_rowid()` before database export; database tests now pass on both engines |
| Fractional empty bottle sales and returns accepted | Whole bottle validation in sales and returns; regression checks pass |
| Partial product edits bypassed bottle stock rules | Validate with persisted product context; fractional edit rejected |
| Credit sale without identifiable customer accepted | Require a named customer; regression passes |
| Cart quantity increase/remove controls clipped | Compact five-column cart with variant/unit below main content; desktop verified |
| Successful checkout left the old cart and totals visible | Refresh cart and reset customer, discount, tax and payment fields; automated and desktop verified |
| Rapid checkout clicks could create repeated invoices | In-flight save guard; concurrent-call regression passes |
| Minimum-height POS hid checkout controls | Scrollable cart and compact-height layout; checkout completed at 1100×700 |
| Return item table escaped its card | Horizontal scroll wrapper added; source reviewed |
| Invoice return quantity used generic Items | Prefer saved invoice quantity unit |
| Purchase Return opened low-stock-only inventory | Show all products with supplier return guidance |
| Purchase Stock arbitrarily selected first product | Let user choose product before stock entry |
| Available Stock Report opened sales comparison | Open actual inventory; retain Sales Analytics as a separate button |
| Cashbook subtracted returned money twice | Use gross cash invoices and subtract cash refunds once; observed balance changed from -250 to 0 for a fully refunded Rs.250 cash sale |
| Cashbook treated credit/non-cash transactions as cash | Filter cash invoices and cash expenses; renderer regression passes |
| Category gross figures labelled net profit | Label gross revenue/profit and explain exclusions |

## Desktop smoke coverage

- Dashboard and empty states; POS catalogue; product creation and success feedback.
- Loose cloth preset quantity (2.5 metres), editable price and Rs.250 totals.
- Required customer validation; hold/list/resume bill.
- Completed invoice GS-000001: stock 10 → 7.5; full return: stock 7.5 → 10; refund Rs.250.
- Customer Records, Supplier Records, Purchase Stock/Return entry points, category analytics, Cash Book, Raast, and Backup screens opened.
- Repaired cart controls visible at normal and minimum sizes.
- Final invoice GS-000002 completed at minimum size: visible cart empty, customer cleared, totals zero.
- Corrected Cash Book shows cash in Rs.250, refund out Rs.250, closing zero.
- Corrected Available Stock Report route opened and displayed inventory.

The later-added Sales Analytics button, category explanatory labels, return-table wrapper and purchase-route guidance received source review, not a second full desktop interaction pass.

## Remaining coverage and limits

- Physical printer, barcode scanner, WhatsApp integration and NSIS installed build not exercised.
- No full stress/performance run, power-loss simulation, or exhaustive large-history migration run.
- Supplier CRUD/payment workflows and every modal/filter combination are not exhaustively tested.
- Category analytics intentionally remain gross figures; daily/monthly reports provide return-adjusted totals.
- Full accounting reconciliation remains outside this completed round: customer payment receipts, refund mode versus paid/unpaid balances, supplier payments, Raast cash movements, tax and loss-making transactions need dedicated scenario coverage before relying on the cashbook as a complete accounting ledger.
- Tests do not prove absence of all bugs. Review remaining scenarios before production sign-off.

## Re-run

```powershell
npm test
npm run test:wasm
# Launch disposable data with receipt printing disabled:
$env:ELECTRON_RUN_AS_NODE = ''
npm run test:qa-ui
```

QA launcher creates a fresh temporary database and log on each run. Its window deliberately uses test data; do not use it to enter real shop transactions.
