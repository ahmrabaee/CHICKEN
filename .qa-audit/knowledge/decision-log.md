# Decision Log — Development History, Decisions, Fixes, Plan Status (K2)

Author: K2 (Development Historian). Sources: `git log`/`git show` of all 89 commits (2026-02-02 → 2026-03-19), `docs/*.md`,
`accounting-migration-blueprint/**`, `FRONT_docs/*`, `Apis_issues/*`, `.trae/documents/*`, root `notes.md`, `status.txt`,
`diff.txt`, `rebase.log`, `git_status_output.txt`, `runtime-forensic-audit-report.md`.
Arabic terms are translated; originals in parentheses. Line refs are to the current working tree unless a commit is given.
"Verify" = tester must confirm at runtime; K2 only read code/history.

---

## 1. Timeline and who did what

Authors (git identities): **MBA-x86 / mba-x86** (backend/infra lead: DB, Prisma, APIs, PDF system, backup, setup wizard,
deployment, Tauri packaging, unit migration ×1000→×100, many targeted `fix:` commits with descriptive messages);
**"Your Name"** (generic git identity; commit texts "last commit of ahmed", "fixing everything Ahmed", "merging my versions with
Ahmads Version" identify this as developer Ahmed/Ahmad — accounting blueprints 01–06, GL engine, plan docs, reports, credit notes,
stock transfer, bank accounts; works with Cursor AI: "Co-authored-by: Cursor", "Made-with: Cursor"; terse messages "fix", "last",
"fixing everything"); **yousef2005x** (frontend: UI modifications, date pickers, inventory/POS UI, accountant permissions,
purchasing UI, silent printing).

| Phase | Dates | Key commits | Content |
|---|---|---|---|
| P0 Bootstrap | 02-02 → 02-08 | d629950, 59cc4f0, 6bd44f0 (PRD "weight-based only, admin/cashier roles"), a30c1c7, 70cb687, df7cac5, 90ae045/c693b8c (API plan), fcdf373 (new PRD), c565037 | Tauri+React shell, SQLite schema, Prisma, API plans, PRD v2 |
| P1 API linking | 02-09 → 02-13 | 1a2e25e, 71df989, 20b7d5a, 157b675, 787977d, de7960c/73aa327/245f04b (yousef UI), 416f659 (wastage fix) | Frontend wired to API; FRONT_docs cost decisions (02-09) |
| P2 Accounting blueprints | 02-14 → 02-19 | **342bcc0** "final with 10 plans" (+22.5k lines, 164 files: blueprints 01–06 implemented in one commit), 60e379f, **198d2ff** "fixing accounting law" (01 audit docs, monetary-units report), e62b4b3 (PDF system, MBA), **ee7b26f** merge (conflicts in accounting/payments resolved), a6e3800 (GL engine enhancements), 52489e0 (POS) | CoA rebuild (01), GL engine (02, flag off), posting workflow docstatus/reversal (03), PLE/receivables (04), tax engine (05, flag off), stock ledger (06) |
| P3 Backup / roles / setup | 02-20 → 02-22 | 5f680de (backup, MBA), f51ef9d merge, b8e0896/f355332, d64fa62 "merge stash" (keep PageAccess + Backup), **5e1f836** "fixing role" (accountant plan + dynamic page access), 7a10115 (setup wizard + production seed), 599c844, affc076 | Accountant role, page-access, setup |
| P4 Reports / daily pricing in-and-out | 02-23 → 02-28 | 96c19cf (reports, PDF plans), **e043c93** (daily pricing added) → **f64436f** (daily pricing removed 16 min after merge), fc1e39e, 679b4af merge, 8b7cac5, 0095113 (yousef "final front"), be2b27f merge, b6dea53 (POS + barcode plan), e73c0a2, 7b0c924 "last commit of ahmed" | Reports, receivables PDF |
| P5 Repo move + cleanup | 03-01 → 03-03 | 17cf9a7/81963b3 (deployment), 891bc11/30f2f78/1b831f2 (yousef merges; repo moved from codex-ps/Financial-Management-Program to ahmrabaee/CHICKEN), f621578 (remove scale settings, email fields, logo upload), e9c3afd, f28d015 (yousef, rebase with conflicts → status.txt/diff.txt), **f6f17cc** (×1000→×100, hard/soft delete, remove English names), **61c93bc** (AR without customer), **13f4e5b** (POS payment refactor, remove "mixed", walk-in customers, scale barcode), **576e358** (credit notes profile), 7daae13 merge, **8ce1abb** (stock transfer generalised), **dc5a6eb** (sale-number P2002, discount %→₪), 83080a7 | |
| P6 Packaging gap | 03-04 → 03-11 | f8383de (NSIS/MSI) | (quiet week) |
| P7 Stale-base merge + permissions | 03-12 | **e0af863** (yousef, based on 10-day-old f6f17cc; removes CSV export), 832f31d/eb32502 merges, af04c6b (.env ignore), **6047196** (accountant permissions, dashboard resilience, migration 016) | |
| P8 "Fix everything" sprint | 03-14 → 03-19 | **a01be9b** (JE number 409, purchase edit/delete with hard rollback, PDF /100), **aa432bd** "fixing everything" (customer statement fallback, FIX_PLAN_2025), **eebdc44** "fixing 90% of my work" (bank-accounts module, ledger, POS bank routing, 6 plan docs), **38a064f** (write-off exclusion, WK-xx fixes, print buttons, forensic audit), **5d9c0d8** "fixing everything Ahmed" (balance sheet, income statement PDF, insufficient-balance guard), e400467 merge, **37c0e6a** (purchase edit/delete UI), **2b86017** (weight-units audit), 127d95b (Arabic accounting guide), 5ef7e38 (silent print), **75b3211** (adjustment unitCost ×1000→×100), **09ab6e9** (low-stock), 4dfee68 | Last commit 2026-03-19 16:58 |

Observations on process:
- Plan docs are almost always committed in the SAME commit as the implementation (or later), so "plan says X" ≠ evidence it was
  verified. Several docs still contain unchecked `[ ]` checklists although code exists (CREDIT_NOTES, STOCK_TRANSFER, CASH_LEDGER).
- Some docs are dated "2025-…" though written in 2026 (AI-generated headers): FIX_PLAN_2025, PAYMENT_CANCEL (2025-02-19),
  CREDIT_NOTES/STOCK_TRANSFER (2025-03-02), ACCOUNTANT_ADMIN_PLAN_STATUS (2025-02-21). Treat dates by commit, not header.
- `status.txt`/`diff.txt`/`rebase.log`/`git_status_output.txt` are leftovers of conflict sessions that were committed to the repo.

---

## 2. DECISION REGISTER (deliberate behaviour — do not report as a bug without checking harm)

| ID | Decision | Source | Rationale | Observable behaviour testers should expect |
|---|---|---|---|---|
| D-01 | **Weight-based selling only; weights stored in integer grams; display in kg** | 6bd44f0 PRD; docs/WEIGHT_UNITS_AUDIT (2b86017) | Chicken shop sells by weight | API takes `weightGrams`, `pricePerKg`; UI shows كجم/كغم. Barcode settings deliberately show grams (غرام) because the label encodes grams. `WeightEntryDialog` shows grams as secondary confirmation. |
| D-02 | **Money = integer minor units ×100 (agorot, ₪)**; percentages = basis points | f6f17cc ("agora units"); dc5a6eb ("ILS agorot"); common/utils/helpers.ts:9 | Previously UI used ×1000 (fils/millim) while backend stored ×100 | 2200 = ₪22.00. Any 3-decimal or ÷1000 money display is a residual bug (see §5 R-01). Seed settings still say `currency.code=SAR`, symbol `ر.س` (seed.ts:523-525) — not deliberate, see K2-003. |
| D-03 | **Inventory costing = FIFO lots for COGS + running average (`inventory.averageCost`, per kg) for valuation display/adjustments** | FRONT_docs/INVENTORY_COST_ACCOUNTING.md, SCENARIO_COST_AND_INVENTORY.md, Blueprint 06 | Lots give FIFO COGS; average used for decreases/increases without cost | Sale consumes oldest lot first. Adjustment decrease reduces value proportionally to average (lots untouched — see K3-009). Swagger text "FIFO" and commit 75b3211 "weighted average" are both partially true. |
| D-04 | **No "cost price" column on Item**; `defaultPurchasePrice` is reference/estimate only and must not enter valuation | FRONT_docs/COST_PRICE_DECISION.md §5 ("Option A adopted") | Single source of truth for cost = lots/inventory | Item detail `effectiveCostPrice` = average cost if stock>0 else defaultPurchasePrice (display only). Violated by stock transfer default and seed (K2-005). |
| D-05 | **Adjustment increase requires unit cost when stock is zero**; increase with cost creates a `LOT-ADJ-…` lot | INVENTORY_COST_ACCOUNTING.md §3 | Keep FIFO consistent | Increase without cost on empty item → error. Unit cost is per kg ×100 (fixed only in 75b3211). |
| D-06 | **Item delete: hard delete if no transaction history, soft (isActive=false) otherwise** | f6f17cc; items.service.ts:357-406 | Preserve history | Deleting an item with sales/purchases returns success but item just becomes inactive. |
| D-07 | **Category delete: deactivate if it has real items, hard delete otherwise (auto-created purchaseItem removed/deactivated)** | f28d015 rebase (diff.txt conflict) resolved toward yousef's soft-delete version; categories.service.ts:185-225 | Same as D-06 | Response `{action:'deactivated'|'deleted', messageAr}`. Earlier MBA version (e9c3afd) cascade-deleted items without history — that version LOST in the rebase. |
| D-08 | **Each category auto-owns a "purchase item"** (`category.purchaseItemId`), purchases can be by category | backend_docs/plan_purchase_by_category.md (599c844); dc5a6eb "Auto-bootstrap purchaseItem" | Buy whole chickens per category, then split | Extra hidden items exist per category; they appear in lots/stock. |
| D-09 | **Daily pricing feature removed** | e043c93 added → f64436f removed (same day, "Remove daily pricing, keep full reports logic") | Business dropped it | No daily-price gate at POS; prices come from `item.defaultSalePrice`. No remnants in code (verified grep). be2b27f merge kept removal. |
| D-10 | **English name fields removed from UI** (item/customer/supplier); **email removed** (customer/supplier/user); scale settings & logo upload removed from UI | f6f17cc; f621578 | Arabic-only single shop | `nameEn` still accepted by DTOs (items/dto/item.dto.ts:25, customers dto:21) and seeded; users.email still in schema (`@unique`, schema.prisma:137) though removed from UI. |
| D-11 | **Roles: `admin` + `accountant` only; "cashier" renamed to "accountant"; `cashier` kept as a legacy alias** | ACCOUNTANT_ADMIN_ROLES_PLAN (5e1f836); roles.guard.ts:5-8 | PRD: shop owner + one accountant/cashier | Accountant gated by per-page `allowedPages` (dynamic page access, DYNAMIC_PAGE_ACCESS_PLAN) + `@RequirePageAccess` on sensitive endpoints (items create/update/delete → `/inventory/new`; adjustments → `/inventory/adjustments`, 6047196). Admin always passes. Accountant max POS discount 5% vs admin unlimited (sales.service.ts:259). |
| D-12 | **No separate "mixed" sale type**: partial payment = `saleType:'cash'` with paid < total; remainder becomes customer debt; customer (registered or name+phone) required | 13f4e5b removed 'mixed' everywhere; PARTIAL_PAYMENT_MIXED_PLAN (dc5a6eb) describes the UI concept; POS.tsx:332-344 | Backend already handled partial | Paid 0 on cash sale is rejected (must use "آجل/credit"); overpay rejected; walk-in name+phone auto-creates `CUST####` customer (13f4e5b). |
| D-13 | **AR is debited even when no registered customer** ("Partial payment - balance due") | 61c93bc | Fix unbalanced JE | Such AR lines have no party → not in any customer statement; check trial balance vs party totals. |
| D-14 | **Insufficient-balance guard on cash/bank outflows** (`INSUFFICIENT_BALANCE`) | BANKS_AND_FUNDS_COMPREHENSIVE_PLAN (5d9c0d8); accounting.service.ts:221-245 | Prevent negative cash/bank | Expenses, purchase/supplier/advance payments, paid-at-creation purchases are rejected if GL balance of resolved 1111/bank account < amount. Receipts not checked. Expense uses expense date as as-of; purchase payment uses current balance (e400467 comment). On a fresh DB cash = 0 so outflows fail until sales bring cash. |
| D-15 | **Cash vs bank routing**: `bank_transfer`/`card` → bank GL account (chosen BankAccount, else default, else first active); everything else (cash, mobile_payment, check…) → 1111 | accounting.service.ts:83-120; POS_BANK_PAYMENT_BUG_PROMPT | | A "check" or "mobile_payment" receipt lands in cash box 1111 — confirm with business (K2-008). |
| D-16 | **Debt write-off = forgiveness: excluded from all balances/aging/overdue/PDFs; decrements customer.currentBalance** | 38a064f | "written-off debts were inflating totals" | Written-off debts disappear from /debts totals. BUT no GL/PLE posting (K2-001) — INTENTIONAL-BUT-RISKY. |
| D-17 | **Aging uses dueDate (fallback createdAt)** | 38a064f WK-03 | | Debts without dueDate age from creation. |
| D-18 | **Customer with open (unpaid, non-written-off) debts cannot be deleted** | 38a064f WK-05 | | 400 `CUSTOMER_HAS_OPEN_DEBTS`. |
| D-19 | **Posting lifecycle docstatus 0/1/2; cancellation = GL reversal entry, original flagged `isReversed`** (never delete) | Blueprint 03; PAYMENT_CANCEL_AND_JOURNAL_PLAN | ERP-style audit trail | Payment cancel: `POST /payments/:id/cancel` {reason} → reversal JE (sourceType 'reversal'), PLE delinked, amounts/debts/customer balance restored. `voidPayment` delegates to cancel. Journal UI shows "معكوس" (reversed) / "قيد عكسي" (reversal) badges. **Exception:** purchase edit/delete hard-deletes (D-20). |
| D-20 | **Purchase orders can be edited/deleted only if no active payments, no credit notes and stock from them unused; edit/delete physically rolls back** (deletes JE, SLE, movements, lots, PLE, debt, and on delete the purchase row) | a01be9b (backend); 37c0e6a (UI: edit/delete buttons shown for any non-cancelled PO; edit form forces amountPaid=0, payments only via /payments) | Let users fix mistakes before use | Delete dialog says "all inventory and accounting effects will be reversed". Contradicts D-19 and Blueprint 06 "SLE is immutable" → INTENTIONAL-BUT-RISKY (K3-005/006). |
| D-21 | **Paid-at-creation purchase**: partial → Payment + PLE + Debt; full → Payment (audit trail) without Debt/PLE | DEBTS_ACCOUNTING_ALIGNMENT_PLAN phase 1; purchases.service.ts:546-600 | Align Debt with PLE | |
| D-22 | **Debt table and PLE are two parallel sources of truth** (unification "phase 3" deferred) | DEBTS_ACCOUNTING_ALIGNMENT_PLAN §3 | Time | /debts (Debt table) and reconciliation/statements (PLE) can disagree; known & accepted. |
| D-23 | **Customer statement falls back to Sale+Payment tables when PLE is empty** (suppliers: PLE only) | CUSTOMER_STATEMENT_FIX_SUMMARY (aa432bd) | Seeded data has no PLE | Statements for API-created customers come from PLE; for fixtures from fallback — two different computations. |
| D-24 | **Credit notes: created as draft from a profile page; party → open invoice → amount ≤ outstanding; then "submit/post"** | CREDIT_NOTES_IMPROVEMENT_PLAN (576e358) | No manual invoice ID entry | `/credit-notes/new`, `/credit-notes/:id`. Credit note date = now (not editable). Credit note blocks purchase edit/delete. |
| D-25 | **Stock transfer = convert X kg from one source LOT (any product, incl. raw chicken) into one or more destination products**; expiry optional (defaults to source lot expiry, else +7 days); destination cost per kg entered per line | STOCK_TRANSFER_FIX_PLAN (8ce1abb); stock-transfer.service.ts:147-300 | Splitting whole chickens into parts | Source lot reduced at source lot cost; destination lots created at the user-entered/defaulted unit cost (UI default = item.defaultPurchasePrice ?? defaultSalePrice). Cost is NOT carried over automatically and no GL entry is made → K2-005. Transfer status stays `'draft'` though stock already moved. Stock transfer UI moved into Inventory tab (`/inventory?tab=stock-transfer`, FIX_PLAN_2025 §2). |
| D-26 | **GL engine and tax engine are feature-flagged OFF by default** (`gl_engine_enabled=false`, `tax_engine_enabled=false`) | Blueprint 02/05 summaries; seed.ts:582 | Safe rollout | Default posting path = legacy `createJournalEntryInternal` (strict balance check, no round-off). Testing with flags ON exercises a different path (K3-010/011). |
| D-27 | **Balance sheet includes current-period net income in equity** (no closing entries exist) | 5d9c0d8; accounting.service.ts:1871-1883 (goes beyond BALANCE_SHEET_FIX_PLAN which listed it as "optional future") | Make A = L + E | Equity shows `netIncomeForPeriod` from fiscal-year start; no opening capital entry; retained earnings 3200 always 0. |
| D-28 | **Trial balance / ledger / balance include posted entries only; as-of date inclusive to 23:59:59.999 UTC** | BALANCE_SHEET_FIX_PLAN §2.1; CASH_LEDGER_FIX_PLAN §2.2 | | Entries posted after 00:00 local but before 02:00/03:00 local belong to previous UTC day (see K4-007 timezone). |
| D-29 | **Ledger route takes account CODE** (`/accounting/ledger/:accountCode`), never PK | CASH_LEDGER_FIX_PLAN; accounting.service.ts:1589 | Fix "no movements in 1111" | |
| D-30 | **Low-stock includes out-of-stock items even without a minimum set** | 09ab6e9 | Show "نفذ" (sold out) | `/inventory/low-stock` returns all zero-stock active items. Seed sets min levels for 5 items. |
| D-31 | **POS discount entered in ₪ (amount) not %** | dc5a6eb | Cashier usability | DTO still has `discountPct`; check which field the POS sends. |
| D-32 | **Dashboard default range = last 30 days; dashboard resilient to 403 on secondary widgets** | FIX_PLAN_2025 §1 (aa432bd); .trae plan (6047196) | Avoid all-zero dashboard | |
| D-33 | **Purchase price must be < sale price** in item form (frontend-only validation) | FIX_PLAN_2025 §4; ItemProfile.tsx:76-83 | | API does not enforce; seed raw chicken has sale price 0. |
| D-34 | **POS lists only items with price > 0**; raw chicken (sale price 0) never sellable directly | f6f17cc | Raw chicken must be transferred into products | |
| D-35 | **Scale barcode: 14-digit template (prefix 2 + 6-digit item + 7-digit TOTAL price in minor units); weight inferred = total / pricePerKg** | 13f4e5b; BARCODE_SYSTEM_PLAN | Local scales print price labels | Backend recomputes line total from weight×system price (K4-002). |
| D-36 | **Inventory CSV export removed** | e0af863 (it still used ÷1000) | — | No "تصدير البيانات" button on Inventory. |
| D-37 | **Sale & payment numbering**: sale numbers via last-number + retry (dc5a6eb); payments.service last-number (38a064f WK-02); JE legacy path next-free probing (a01be9b); others still count-based | | Fix P2002 | Mixed strategies — see R-05. |

---

## 3. FIX REGISTER

| ID | Symptom | Claimed root cause | Fix commit / files | Regression test idea |
|---|---|---|---|---|
| F-01 | UI prices/costs shown 10× too small/large; item prices saved ×1000 | UI used ×1000 while backend minor units ×100 | f6f17cc (ItemProfile, Inventory, POS, use-sales), dc5a6eb (Customers/CustomerProfile formatAmount, creditLimit, defaultDiscountPct), a01be9b (InventoryLotsDialog, Suppliers, SupplierProfile creditLimit, inventory valuation avgCost /10→/100), e0af863 (CSV export deleted), 75b3211 (AdjustStockDialog unitCost) | Create item at ₪22.50/kg → DB 2250; edit → form shows 22.50; credit limit ₪1,000 → DB 100000; adjustment +10 kg @ ₪20 → lot unitPurchasePrice 2000, averageCost consistent. |
| F-02 | Weighted average cost wrong after stock adjustment | AdjustStockDialog still sent `unitCost × 1000` (missed in F-01) | 75b3211 AdjustStockDialog.tsx:104 | Stock 10 kg @ ₪20, increase 10 kg @ ₪30 → avg ₪25.00 (2500). |
| F-03 | All PDF amounts 100× too large | `pdf.helpers.formatCurrency` did `toFixed(2)` on minor units | a01be9b pdf.helpers.ts:11-15 | Invoice of ₪84 prints 84.00 in every PDF (invoice, statement, trial balance, P&L, BS, receivables, payment voucher, PO). Check no caller pre-divides (double /100). |
| F-04 | Duplicate journal entry number → 409 on purchase payment | `count()+1` collides after deleted rows | a01be9b `generateEntryNumberTx` accounting.service.ts:1178 | Delete a purchase (creates gap), then record payments/sales → no 409. **Not applied to GL engine** gl-entry.factory.ts:74 (R-05). |
| F-05 | Duplicate sale_number P2002 | count-based number | dc5a6eb sales.service (findFirst+orderBy+retry) | Concurrent POS sales (2 parallel requests) → both succeed, distinct numbers. |
| F-06 | Payment number race | COUNT(*) | 38a064f WK-02 payments.service.ts:798 | Parallel payments. sales.service.ts:979 & purchases.service.ts:548/579 still count-based. |
| F-07 | Written-off debts inflate /debts totals (e.g. 27.00 when balance 0) | queries used `status != 'paid'` | 38a064f debts.service (getSummary, balances, aging, overdue, PDFs) | Write off debt → excluded everywhere in /debts; **then compare with GL AR & customer statement** (K2-001). |
| F-08 | Payment did not reduce customer.currentBalance | missing update | 38a064f WK-01 payments.service.ts:195 | Credit sale 100, pay 40 → balance 60; cancel payment → 100 (cancel increments at :595). |
| F-09 | Unbalanced sale JE when balance due but no customerId | AR line skipped | 61c93bc accounting.service (getSaleGLMap + legacy) | Cash sale ₪80 paid ₪50 with name+phone only → JE balanced, AR 30. |
| F-10 | Cash ledger 1111 shows "no movements" though TB has balance | `/ledger/1111` parsed as account PK | eebdc44 (CASH_LEDGER_FIX_PLAN) accounting.service.ts:1589; posted-only filter | Open ledger for 1111, 1120, 1112-xxx after sales → rows present; totals = TB. |
| F-11 | Balance sheet all zeros / unbalanced / liabilities negative / same-day entries excluded | filtered by `accountType==='asset'` instead of rootType; asOf midnight; no net income | 5d9c0d8 (getTrialBalance, getBalanceSheet, getBalanceSheetPdf) | BS JSON & PDF: A = L + E (incl. net income) on dates with same-day entries; ordering by code; liabilities positive. |
| F-12 | Customer statement PDF empty for fixtures | PLE empty for seeded sales | aa432bd payment-ledger.service fallback | Statement for seeded and API-created customers; opening/closing balances consistent with AR. |
| F-13 | POS card/bank sale posted to cash box 1111 | bankAccountId not propagated / resolve fallback | eebdc44 (POS.tsx, sales dto/service, resolveCashOrBankAccount) — doc says issue "recurs after previous edits"; no closing verification note | POS sale, method card + bank "1112-001" → JE debit 1112-001 "Bank received"; bank ledger shows it. **Needs tester verification.** |
| F-14 | Bank accounts UI calling non-existent API | module missing | eebdc44 bank-accounts module (runtime-forensic report #1 is therefore stale — written against pre-eebdc44 tree) | CRUD bank account; default flag; linked CoA account auto-created under 1112. |
| F-15 | Expense bankAccountId dropped | not persisted | eebdc44 schema + expenses.service.ts:71 | Expense via bank → expense.bank_account_id set, JE credits bank. |
| F-16 | Payment cancel 404 | route order | PAYMENT_CANCEL plan (a6e3800 era), 38a064f adds HttpCode 200 + roles | `POST /v1/payments/:id/cancel` → 200, reversal JE. |
| F-17 | Low-stock count always 0 on dashboard; out-of-stock not listed | wrong field `minStockGrams`; filter required min set | 09ab6e9 reports.service.ts:53, inventory.service getLowStock | Item min 30 kg with 20 kg → listed; item with 0 kg and no min → listed. |
| F-18 | Dashboard fails entirely for accountant; accountant can't add items/adjust even when granted | UI `isAdmin` checks; backend admin-only; one 403 kills dashboard | 6047196 (+ migration 016 `/inventory/adjustments` page) | Accountant with only `/inventory/new` can create item; without it 403; dashboard partial. |
| F-19 | Purchase payment JE used raw dto.amount | normalisation | a01be9b | Pay purchase with decimal/odd amount → JE = payment row amount. |
| F-20 | Duplicate password eye icon; categories issues; suppliers delete/search; audit query whitelist; stock adjustment validation; purchases status/NaN | various | 13fafe2, fc1e39e, e9c3afd | Smoke: supplier search, adjust decrease > available rejected with Arabic message. |
| F-21 | Item hard delete failing / shelfLifeDays 0 rejected | FK history; @Min(1) | f6f17cc | Delete never-used item → gone; used item → inactive. |
| F-22 | Weight shown in grams in reports/wastage/transfer errors | display | 2b86017 (Reports.tsx, Wastage.tsx, stock-transfer.service.ts:152) | Inventory & wastage reports show kg. |
| F-23 | Party empty on cash-sale JE lines; GL settings 400 | DTO/route | a6e3800 / 02 results.md | JE detail shows customer on all lines. |

---

## 4. PLAN COMPLETION AUDIT

Status: IMPL = code evidence found; PARTIAL; NOT FOUND; SUPERSEDED. ⚑ = needs tester verification.

| Plan doc | Claimed | Evidence | Status |
|---|---|---|---|
| Blueprint 01 CoA rebuild | "تنفيذ مكتمل" (complete) | Account tree, rootType, nested set, guards | IMPL |
| Blueprint 02 GL engine | complete; results.md "testing in progress" | gl-engine/* exists; flag off; round-off tested with account **1112 (bank!)** as round-off account in results.md | IMPL but flag OFF ⚑ (K3-010) |
| Blueprint 03 posting workflow | implemented | docstatus, reverseByVoucher, PeriodLockGuard, AccountingPeriod table | PARTIAL — no API/UI to create/close periods (no controller found) ⚑; purchase edit/delete bypasses reversal (D-20) |
| Blueprint 04 receivables/PLE | Phase 1–6 | PLE, reconciliation API, migrate-to-ple script | IMPL; seed bypasses (D-23) |
| Blueprint 05 tax/VAT | complete | tax module; flag off; VAT report by-rate hard-coded 1500 (vat-report.service.ts:76); breakdown tables not populated (forensic #6) | PARTIAL ⚑ (K3-004/011/012) |
| Blueprint 06 stock ledger | implemented; "SLE immutable" | SLE created; purchase rollback deletes SLE; stock transfer SLE without GL | PARTIAL (contradicted) |
| Blueprints 07 periods, 08 reporting, 09 architecture, 10 scalability | design docs only, no IMPLEMENTATION_SUMMARY | no closing entries, no period-close API | NOT FOUND (07/10), PARTIAL (08 reports exist) |
| ACCOUNTANT_ADMIN_ROLES_PLAN | STATUS doc (same commit) says 0/39 done | Later: roles renamed, constants/roles.ts, hooks/useRole.ts, RolesGuard alias, page access | IMPL (mostly) — but backend/UI gating misaligned (K4 bulletin) ⚑ |
| DYNAMIC_PAGE_ACCESS_PLAN/MIGRATION | — | page-access module, PageAccessGuard (exact match vs UI prefix) | IMPL ⚑ |
| .trae plan_fix_accountant_permissions | — | 6047196 RequirePageAccess on items/inventory; Dashboard rework | IMPL ⚑ |
| BALANCE_SHEET_DIAGNOSIS / FIX_PLAN | "main fixes done ✅" | getBalanceSheet rootType + net income; PDF table layout? | IMPL (equity via net income); opening capital, closing entries, hierarchy/indent, zero-balance key accounts NOT FOUND/unknown ⚑ |
| CASH_LEDGER_FIX_PLAN | checklist unchecked | code-lookup + isPosted present | IMPL; item 3 (legacy JE date = posting date when GL engine off) ⚑ |
| BANKS_AND_FUNDS_COMPREHENSIVE_PLAN | — | purchase form payment method/bank; insufficient balance | IMPL ⚑ (ORCH-002: payment form crashes with no banks) |
| BANK_ACCOUNTS_IMPLEMENTATION_PLAN + TEST_SCENARIOS | — | module exists | IMPL ⚑ run BANK_ACCOUNTS_TEST_SCENARIOS |
| ACCOUNT_LEDGER_ENHANCEMENT_PLAN | — | AccountLedgerDialog, ledger-localization.ts (eebdc44) | IMPL ⚑ |
| POS_BANK_PAYMENT_BUG_PROMPT | a debugging prompt; bug "recurs" | routing code in place | UNKNOWN ⚑ (F-13) |
| TRIAL_BALANCE_TEST_PLAN | test plan | getTrialBalance totals; verify-trial-balance.ts script | ⚑ run it |
| CREDIT_NOTES_IMPROVEMENT_PLAN | checklist unchecked | CreditNoteProfile, PartySearchCombobox, routes | IMPL (UI); optional GL party & date editing NOT FOUND |
| CUSTOMER_STATEMENT_FIX_SUMMARY | done | fallback present; supplier fallback explicitly not done | PARTIAL (acknowledged) |
| DEBTS_ACCOUNTING_ALIGNMENT_PLAN | phase 1–2 ✅ | purchase payment+PLE yes; `recover-debt.js` script (outside Nest) | PARTIAL; phase 3 (single source) NOT DONE |
| FIX_PLAN_2025 (6 tasks) | — | 1 dashboard range ✓; 2 stock transfer tab ✓; 3 TB totals/warning ⚑; 4 price validation ✓ (UI only); 5 print button ✓; 6 statement redesign ✓ | IMPL mostly |
| PARTIAL_PAYMENT_MIXED_PLAN | plan | "mixed" removed in 13f4e5b; achieved via cash+partial; ThermalReceipt cash/deferred split ⚑ | SUPERSEDED |
| PAYMENT_CANCEL_AND_JOURNAL_PLAN | 4/5 ✅ | | IMPL |
| STOCK_TRANSFER_FIX_PLAN | checklist unchecked | getAvailableSourceLots any item, excludeItemId, expiry optional | IMPL; cost carry-over (§6.2 "could suggest destination cost = source cost") NOT DONE |
| WEIGHT_UNITS_AUDIT | audit | fixed items in 2b86017 | IMPL |
| INVENTORY_SIDEBAR_AND_CATEGORIES_PLAN, POS_SALES_NEW_PLAN, POS_UI_REDESIGN_PLAN, POS_CUSTOMER_WEIGHT_PLAN, BARCODE_SYSTEM_PLAN | — | POS/barcode/weight dialog exist | IMPL (UI) ⚑ |
| PDF_REPORTS_DESIGN / PDF_ALL_REPORTS_UNIFIED / REPORTS_PDF_INTEGRATION / TROUBLESHOOTING_PDF_CORS | — | pdf module, print buttons | IMPL ⚑ amounts (F-03) |
| TEST_SCENARIO_REPORTS_FULL | scenario | — | ⚑ reusable test script |
| DAILY_PRICING_PLAN | — | removed f64436f | SUPERSEDED |
| backend_docs/plan_of_wastage, plan_purchase_by_category | — | wastage module, category purchase item | IMPL |
| FRONT_docs COST_PRICE_DECISION / INVENTORY_COST_ACCOUNTING | decision | effectiveCostPrice / avgCostPrice | IMPL, violated by transfers (K2-005) |
| runtime-forensic-audit-report (03-18) | 8 findings | #1 bank module, #3 expense bankAccountId → FIXED by eebdc44 (report stale); #2 payment numbering partly fixed; #4/#5 POS receipt from cart & 15% → OPEN (K4-001/005); #6 VAT by-rate OPEN; #7 `/audit/action-counts` vs `/audit/counts` OPEN (audit.service.ts:12 vs audit.controller.ts:38); #8 settings placeholders ⚑ | |
| Apis_issues/* (02-09) | early API audit | superseded by later work | historical |
| notes.md (02-06) | wishlist: low-stock notification, adjustments→transfer page, batch/fridge location per lot, item history | transfer & storageLocation exist; notifications ⚑ | PARTIAL |

---

## 5. RISK HOTSPOTS

Churn (commits touching file, approx.): `accounting.service.ts` (342bcc0, 198d2ff, ee7b26f-merge, a6e3800, 61c93bc, a01be9b,
eebdc44 +444, 5d9c0d8 +566, 2b86017), `payments.service.ts` (ee7b26f & e400467 merges, a01be9b, eebdc44, 38a064f, 5d9c0d8),
`purchases.service.ts` (16 commits; a01be9b +488), `POS.tsx` (21 commits, 2 merges, stale-base e0af863), `sales.service.ts`,
`seed.ts`, `pdf.service.ts`/`pdf.helpers.ts` (5d9c0d8 +476/+241).

| R | Risk | Evidence | Where to test |
|---|---|---|---|
| R-01 | Incomplete ×1000→×100 migration; any money path not covered by F-01 | Migration spanned 5 commits over 17 days; last spot found 03-19. Remaining suspicious: Wastage.tsx:80 shows raw minor units "(فلس)"; backend currency settings SAR/ر.س; `pdf.helpers.formatWeight` appends 'kg' to whatever is passed (pdf.helpers.ts:98) | every money input form & PDF; API round-trip |
| R-02 | "Fix everything" commits with broad diffs and no tests: aa432bd (20 files), eebdc44 (36 files, +2.6k), 5d9c0d8 (24 files, +2.2k, accounting.service +566), a01be9b (26 files) | messages don't describe changes; posting functions rewritten | full GL regression: sale/purchase/payment/expense/void/cancel JEs balanced and on right accounts |
| R-03 | Purchase edit/delete physical rollback (a01be9b) contradicts reversal model; deletes SLE/JE; count-based numbers | K3-005/006 | delete non-last PO, create new PO same day |
| R-04 | Two posting paths (legacy vs GL engine) — fixes applied to one only | F-04 only legacy; 61c93bc patched both | run core flows with `gl_engine_enabled=true` too |
| R-05 | Mixed numbering strategies; count-based remain (PUR, LOT, ST, CN, EXP, CAT, BANK, PAY in sales/purchases, JE in GL engine) | §3 F-04..F-06 | parallel requests; after deletions |
| R-06 | Write-off without GL (K2-001), Debt vs PLE vs GL vs customer.currentBalance — 4 sources of receivable truth patched independently (WK-01, WK-11, D-22, D-23) | 38a064f, aa432bd | reconcile /debts total, customer.currentBalance, PLE outstanding, GL 1120 after: credit sale, partial pay, cancel pay, void sale, credit note, write-off |
| R-07 | Stale-base merge 832f31d (yousef's e0af863 based on 03-02 tree merged into 03-09 main) — POS.tsx conflict resolved by taking main; Inventory CSV removed | combined diff shows main won; no logic lost found | POS smoke after merge: qty rounding 0.001 kg |
| R-08 | Rebase f28d015 (status.txt/diff.txt): categories.service delete — MBA's history-check cascade version (e9c3afd) replaced by yousef's soft/hard version; use-inventory toast; Inventory header | diff.txt | category with items that have NO history → now deactivated, not deleted (differs from e9c3afd intent) |
| R-09 | be2b27f merge kept P1 (f64436f) app.module.ts wholesale | combined analysis: app.module identical to P1 | verify no module yousef registered was dropped (diff shows daily-pricing only) — low |
| R-10 | Stock transfer creates/destroys inventory value without GL (K2-005) | stock-transfer.service.ts:180-300 | stock-vs-GL report after transfer at different cost |
| R-11 | Seed bypasses posting → dev profile inconsistent (bulletin) | seed.ts | testers must build data via API |
| R-12 | PDF currency change (F-03) could double-divide if any caller passes major units | pdf.service callers pass minor (checked) | spot-check each PDF vs screen |
| R-13 | Role leftovers: `@Roles('admin','accountant','cashier')` on payments (38a064f) — harmless via alias; but 'cashier' role still exists? seed creates `accountant` | roles.guard.ts:5 | accountant vs legacy cashier user |
| R-14 | Customer default discount / POS discount changed %→₪ (dc5a6eb) while DTO `discountPct` in basis points remains (sales.service.ts:358) | | discount sale: JE discount line = UI amount |

Top suspicions with refs:
- `debts.service.ts:288-336` write-off: no JE, no PLE, payable side ignored (K2-001).
- `stock-transfer.service.ts:186-215,276-300` + `StockTransferProfile.tsx:63` destination cost from defaultPurchasePrice/defaultSalePrice; no GL; status 'draft' (K2-005).
- `gl-entry.factory.ts:74-77` count-based JE number (K2-004).
- `seed.ts:523-525` SAR/ر.س vs ₪ (K2-003).
- `audit.service.ts:12` `/audit/action-counts` vs `audit.controller.ts:38` `counts` (K2-006).
- `vat-report.service.ts:76` hard-coded 15%.
- `seed.ts:301-353` initial stock without GL, `averageCost` set to defaultPurchasePrice (K2-002).

---

## 6. Known open issues explicitly acknowledged in docs but not resolved

1. No opening capital entry, no period/year closing, retained earnings never populated (BALANCE_SHEET_DIAGNOSIS §2.2, §4.1-4.2; FIX_PLAN §4 "optional future"). Mitigated only by net income in equity (D-27).
2. Zero-balance key accounts not shown; BS hierarchy/indent not implemented (BALANCE_SHEET_FIX_PLAN §4).
3. Supplier statement has no Sale/Purchase fallback; no PLE backfill script run (CUSTOMER_STATEMENT_FIX_SUMMARY "ملاحظة").
4. Debt vs PLE single source of truth (DEBTS_ACCOUNTING_ALIGNMENT_PLAN phase 3).
5. Legacy JE date = creation time not transaction date when GL engine off (CASH_LEDGER_FIX_PLAN §2.3, "optional").
6. Credit note date not editable; no party on credit note GL lines (CREDIT_NOTES plan §6.4).
7. Stock transfer cost carry-over (STOCK_TRANSFER plan §6.2).
8. POS bank routing bug "recurs even after previous edits" (POS_BANK_PAYMENT_BUG_PROMPT) — no closure evidence.
9. Forensic audit (03-18) items #2 (partly), #4, #5, #6, #7, #8 still open (see §4).
10. Blueprint 06 known limits: historical movements without SLE; rounding differences in stock-vs-GL report; voucherType naming differences GL vs SLE (06_ISSUES_AND_FIXES §2).
11. Blueprint 02 gaps: tolerance not editable from UI; round-off cannot be tested from manual JE UI (02_GAPS_AND_FRONTEND_REVIEW §1, §5).
12. ACCOUNTANT_ADMIN_PLAN_STATUS listed missing RolesGuard on settings, audit, debts, expenses, suppliers, purchases, wastage, reports — later partially addressed; K4 reports remaining misalignment.
13. notes.md wishlist: low-stock notifications, per-lot storage location/fridge editing by admin, item history.
14. Frontend TS errors / no automated financial tests (ORCH-001/007) — no test was added by any fix commit except the scale-barcode and money-utils unit tests.
