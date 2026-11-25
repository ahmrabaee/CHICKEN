# T8 coverage

## Executed (scripts in tests/T8, outputs saved)
- `sim.mjs` run t8 (30 days, 3113): setup wizard (`POST /auth/setup`), user, bank account, items, customers and suppliers created via the API. Operations exercised:
  - manual JE create + post (opening capital, 4 deposits);
  - purchases: credit, cash, partial and bank, plus 1 edit (`PUT /purchases/:id`);
  - stock transfer ×30;
  - wastage ×44 (expired + processing loss);
  - POS sales ×1,119 (cash, card→bank, credit, partial, barcode lookup, ₪ discount, VAT template);
  - voids ×6 (5 cash with re-entry, 1 credit);
  - `POST /payments/sale` ×172, `POST /payments/purchase` ×22;
  - expenses ×30 (+7 blocked);
  - adjustments (decrease, and increase with unitCost);
  - credit note create+submit; debt write-off.
- Per-operation divergence tracking: 30+ metrics after every operation. Day-end reconciliation pulls trial balance, dashboard, MTD P&L, daily sales report, debts summary, stock-vs-GL and the cash ledger, plus DB subledgers (via harness/invariants.mjs snapshot).
- `sim.mjs` run t8b (10 days, 3114, transfer cost = UI default).
- `owner-reports.mjs`: text extraction of balance sheet, income statement, cash ledger, receivables, payables, 6 customer statements, 3 supplier statements and inventory PDFs; JSON dashboard, P&L, debts summary, stock-vs-GL, inventory report, trial balance (with and without asOfDate), VAT report.
- `harness/invariants.mjs` on both DBs.
- Performance: 18 read endpoints/PDFs × 5 calls on month data, plus write-path p50/p95 from the run.

## Reviewed only
- reports.service getDashboard/getProfitLossReport, accounting.service getBalanceSheet/getIncomeStatement, barcode.service lookup, stock-transfer.service create, sales.service create (discount/stock checks).

## Not tested (why)
- GL-engine / tax-engine ON month: out of scope for the owner baseline (T1 covers engines).
- Purchase delete, payment cancel, void after collection, advances / allocations: avoided in the realistic month (known blockers K3-005/K3-001, covered by T3/T4).
- Multi-branch operation: per-branch inventory is not implemented (T2-014).
- UI-level daily flow: T7. Concurrency of several tills: T6.
- End-of-day / shift closing: no such feature exists (T8-008).
- Simulator artefact: cutting volume was driven by the part with the highest need, so slow parts over-accumulated. This does not affect the reconciliation results.
