# T4 coverage

## Executed (scripts in tests/T4, outputs *.out.txt)
| Script | Instance | Covers |
|---|---|---|
| 01-purchase-xval.mjs | t4a | credit/partial/full taxed purchases, tax in GL, supplier balance, payments (partial, multiple, overpay 1 agora), cancel, double cancel, re-pay, creation-payment cancel, edit before/after payment, edit with amountPaid, AP 4-way reconciliation |
| 02-bank-cash.mjs, 02b-bank-wrong-gl.mjs | t4a | BANK_ACCOUNTS_TEST_SCENARIOS (API level), routing cash/bank/card/check/free text, no-bank fallback, default bank, guard per bank, mis-mapped GL accounts, remap, deactivate, delete with balance, BANK code numbering, supplier advance (bank/negative/zero), customer receipt into mis-mapped bank |
| 03-expenses.mjs | t4a | category GL mapping, cash/bank/card/credit expenses, tax on expense, credit expense debt/PLE, expense payment endpoint, payable write-off, dashboard vs /debts, personal expenses, negative/zero/fractional/unknown category, branch, edit amount/method/date, delete, report & P&L vs GL, EXP numbering after delete |
| 04-guard-dates.mjs, 04b-ledger-asof.mjs | t4b(1) | D-14 guard: back-dated expense/purchase/advance vs current-balance payment, future-dated, JE date vs document date, ledger vs operational report by period, TB asOfDate |
| 05-purchase-lifecycle.mjs | t4b(1) | purchase validation (neg/zero/empty/unknown item/neg tax/fractional/inactive supplier/overflow/branch), purchase-by-category, live-bird flag, receive endpoint, delete after adjustment/wastage, purchase credit note as return, return endpoint, PUR/LOT numbering after delete |
| 06-engines-on.mjs, 06b, 06c-engines-on-fresh.mjs | t4a, t4b(2) | gl_engine + tax_engine ON: taxed purchases, tolerance round-off, bank expense, JE numbering after delete; flags restored to false |
| 07-rounding-supplier-views.mjs | t4b(3) | K4-013 UI rounding, supplier views (/debts/payables, outstanding, open-invoices, unallocated), advance allocation, PDFs (HTTP only) |
| harness/invariants.mjs | t4a, t4b(1) | inv-t4a.out.txt, inv-t4b.out.txt (t4b(1) DB copy: tests/T4/t4b-after-05.db; t4b(2): t4b-after-06c.db) |

## Reviewed only (code)
- Purchase `receive` path (dead for API purchases; returns ALREADY_RECEIVED) — second JE without debt if ever reachable.
- recordExpensePayment (dead code), PO PDF data mapping, supplier statement source (PLE), payables PDF (Debt), dashboard payables query.
- Live-bird: only an `isLiveBird` boolean on the line; no gross/net/shrinkage fields → requirement PRD2 5.1.4 not implemented (Info).
- Purchase draft/approve statuses: computeStatus derives from receivedAt; no approve endpoint; partial receive not possible (create = full receipt).

## NOT tested + why
- PDF *content* (amounts printed): pdfmake embeds glyph IDs, no text extractor available without installing packages; HTTP 200 + size verified only. → T7 visually.
- UI parts of BANK_ACCOUNTS_TEST_SCENARIOS (dialogs, toasts, dropdown visibility) → T7.
- Concurrency of supplier payments (double submit / overpay race; check is outside tx) → T6.
- Period-lock / freeze-date interaction with purchase/expense create/edit (code says not checked, K3-018) → T1.
- Multi-branch purchasing: impossible via API (branchId not in DTO).
- Cash↔bank transfer: no endpoint exists (manual JE only) — documented gap.
- Accountant-role access to purchases/expenses/bank-accounts endpoints → T5.
