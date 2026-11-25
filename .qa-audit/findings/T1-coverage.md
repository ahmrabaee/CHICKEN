# T1 coverage — GL integrity & financial statements

## Deliverable
- `harness/invariants.mjs` (28 checks + snapshot/diff/formatDiff, CLI + library), usage in bulletin/T1.md. Fixed once (open-debt status set) — noted in bulletin.

## Executed (scripts in tests/T1, outputs *.out.txt, PDFs in tests/T1/pdf)
| Script | Instance | Scope |
|---|---|---|
| 01-clean-slate.mjs | t1 (baseline) | setup via API, capital JE, purchases (credit/cash), sales (cash/credit/bank/discount), payments in/out, expenses (cash/bank), wastage, adjustment; per-step GL delta vs expected; invariants; TB (no params / asOfDate today / yesterday), ledgers 6 accounts vs raw GL, /reports/profit-loss, /reports/stock-vs-gl (with/without date), dashboard; 5 PDFs (BS, IS, TB, ledger 1111, stock-vs-GL) read visually |
| 02-manual-je.mjs, 02b-fraction.mjs | t1 | 25-case manual JE validation matrix (unbalanced, zero/empty lines, negative, two-sided, fractional, group/inactive/frozen/non-existent accounts, huge, past/future/invalid dates, control accounts, overdraw, DTO fields), post/double-post, reverse/edit/delete routes, draft exclusion |
| 03-period-lock.mjs | t1 | back-dated docs (doc date vs JE date), freeze date matrix (16 operations), closed period (company NULL and company 1) matrices |
| 04-dates-yearend.mjs | t1b | as-of TB, prior-year entries, retained earnings, fiscal-year start in UTC+2, local-midnight boundary, ledger opening balance; 6 PDFs |
| 05-reversals-crossval.mjs, 05b-mixed.mjs | t1b | cross-validation K3-001..009/011, K2-001; void mirror (discount, bank, partial+cancel, after credit note), double void, double payment cancel, embedded-payment cancel |
| 06-coa.mjs | t1 (old) | delete/deactivate/freeze accounts in use, accountType/rootType/code/parent edits with balances, duplicate code, child under leaf |
| 07-engines-on.mjs | t1b (after a purchase delete) and fresh t1 | gl_engine+tax_engine ON: sales (cash, discount, VAT, VAT+discount, credit, mixed), payment, purchases (tax, paid taxed), expenses (bank, tax), wastage, adjustment, manual JE (tolerance, zero lines, fractional), mixed-mode voids/cancels OFF→ON and ON→OFF, numbering after purchase delete |
| 08-branch.mjs | t1 | JE/SLE/inventory branch tagging, stock-vs-GL with branchId |

## Reviewed only (code)
- accounting.service.ts statements (getTrialBalance, getBalanceSheet, getNetIncomeForPeriod, getIncomeStatement, getAccountLedger, PDF builders), period-lock.guard.ts, chart-of-accounts update, stock-reconciliation.service.ts, reports.service.ts P&L, settings.service set, frontend JournalEntryProfile (×100 rounding, UI tolerance 5) and Accounting.tsx (TB has no params).

## Not tested / why
- K3-010 RolesGuard gaps — security tester scope.
- Credit-note GL in depth, allocation/reconciliation (K3-022/023) — only the void-after-CN interaction (T1-016).
- Concurrency (double-submit races on numbering/voids) — not attempted (single-threaded scripts); recommend T-concurrency.
- Multi-branch posting: sale/purchase DTOs carry no branchId; branch 2 creatable but no document can be posted to it via API → only tagging observed (T1-020).
- Backup/restore invariant (I-52) — other tester.
- Arabic text shaping in PDFs (letters/words reversed, ₪ glyph missing "Amount ()") observed in every accounting PDF — cosmetic, flagged for UI/PDF tester, not filed.
- UI date-range defaults (K4-007) not re-tested.
