# G coverage matrix (Phase 3)

Rule: a row is TESTED only if an executed test produced the result (a tester `*-coverage.md` lists the script, or a G script). Code-review-only rows are NOT TESTED. Evidence IDs: `Tn-nnn` = findings/Tn.md, `G-nnn` = findings/G.md, `G NN-name` = tests/G script, `checker` = harness/invariants.mjs run (outputs: tests/T3/invariants-t3.out.txt, T4/inv-t4a.out.txt, T8/invariants-t8*.out.txt, G/15-invariants-ga.out.txt).


## Invariants I-01..I-53

| ID | Requirement / invariant | Status | Covered by | Note |
|---|---|---|---|---|
| I-01 | Every posted JE balances | TESTED-FAIL | T1-006, T1-007 (checker GL-01 PASS on all runs) | Normal flows balance; manual JE API with fractional amounts posts UNBALANCED entries |
| I-02 | Trial balance balances at any as-of date | TESTED-FAIL | T1-002, T1-006, T1-013 (GL-03 PASS in normal flows) | as-of ignored (T1-002); can be unbalanced via fractional JE |
| I-03 | Assets = L + E (+ NI) at any date | TESTED-FAIL | T1-001, T1-002, T1-013 (GL-05 PASS same-year) | fails in year 2 / past as-of dates |
| I-04 | No JE line on group/inactive/frozen account | TESTED-PASS | T1 02-manual-je matrix, checker GL-04 on T3/T4/T8/G | T4-008 / T1-008 are mapping issues, not this invariant |
| I-05 | Every document has JE, no duplicates | TESTED-FAIL | T2-005, T2-012, T4-002; checker DOC-01/02 | transfers, opening stock, creation-payments lack JE/posting |
| I-06 | Cancel/void reverses all lines, once | TESTED-FAIL | T3-001, T3-005, T3-006, T6-003; checker GL-07 PASS single path | double/concurrent reversal, CN interplay |
| I-07 | Posted JEs never edited/deleted via API | TESTED-FAIL | T4-003, T1-018 | purchase edit/delete hard-deletes JEs; no JE edit route (T1 PASS) |
| I-08 | Draft JEs do not affect TB/P&L/BS | TESTED-PASS | T1 02-manual-je (draft exclusion), checker GL-06 | executed |
| I-09 | Financial = GL; operational reports reconcile to GL | TESTED-FAIL | T1-004, T8-004, G-011 (operational vs raw tables PASS) | operational reports match raw tables (G) but not GL |
| I-10 | Ledger opening+movements=closing; continuity | TESTED-FAIL | T1-014, T3-018 |  |
| I-11 | No posting/cancel in closed period / before freeze | TESTED-FAIL | T1-011 | only void/payment-cancel/CN protected |
| I-12 | Year-end close zeroes P&L into RE | TESTED-FAIL | T1-013 | no close process |
| I-13 | Operation and JE atomic | TESTED-FAIL | T4-005, K3-012 (T6 08-forced-late-failure), T2-005 | partial; checker DOC-01 PASS for normal docs |
| I-14 | Inventory GL = Σ lot value = report | TESTED-FAIL | T2-001, T2-002, T2-005, T1-020, T8-006; G 15-invariants | INV-01 FAIL on all runs |
| I-15 | Inventory qty = Σ lots per item/branch | TESTED-FAIL | T8-006 (checker INV-02 FAIL on t8); PASS T2/T3/T4/G | fails after count adjustments (T2-001) |
| I-16 | inventory.totalValue = Σ lot values | TESTED-FAIL | T2-001, T8-006 (INV-03) |  |
| I-17 | 0<=lot<=initial, no negative stock | TESTED-FAIL | T2-011, T6-008, T2-008 | checker INV-04 PASS on clean flows |
| I-18 | No over-sell/waste/transfer under concurrency | TESTED-FAIL | T6-001, T6-002, T2-011, T6-004 |  |
| I-19 | Movements per lot sum to remaining | TESTED-FAIL | T2-008 (wastage writes no SLE), T8-006; checker INV-05 WARN |  |
| I-20 | FIFO: never consume newer lot first | TESTED-PASS | T2-003 (t01-fifo), T8 sim |  |
| I-21 | Sale line cost = allocations; total = COGS JE | TESTED-PASS | checker INV-06 PASS on T2/T3/T4/T8/G | executed on every DB |
| I-22 | Expired lots not sold (or logged override) | TESTED-FAIL | T2-010; G-009 |  |
| I-23 | Transfer value-neutral, no P&L impact | TESTED-FAIL | T2-005, T8-005 |  |
| I-24 | Dest grams <= source grams | TESTED-PASS | T2 t03 (over-transfer rejected), T6 05b (0 over-consumption in 10 runs) | yield loss itself is T2-006 |
| I-25 | Wastage value = grams x lot cost; Dr Wastage = Cr Inventory | TESTED-PASS | G 16-inv-misc (10 000 = 2 kg x 50.00, JE 5300/1131); T2 t04 | but see T2-008 (no SLE), T2-009 |
| I-26 | Stock adjustment value hits GL | TESTED-FAIL | T2-001, T2-002 |  |
| I-27 | Live-bird: net weight, cost, shrinkage % | TESTED-FAIL | G-016 / G 16-inv-misc: gross/net fields rejected (400), flag only; T2/T4 coverage | feature not implemented |
| I-28 | Displayed cost = avg if qty>0 else default price | TESTED-PASS | G 16-inv-misc (5000 avg while stock, 4000 at qty 0) |  |
| I-29 | AR control = Σ customer balances = aging total | TESTED-FAIL | T3-004, T3-007, T8-003; checker AR-01 FAIL on T3/T4/T8; PASS on G | aging total not exposed (G-011) |
| I-30 | AP control = Σ supplier outstanding = balances | TESTED-FAIL | T4-001; checker AP-01 FAIL (G re-confirmed) |  |
| I-31 | Customer.currentBalance = Σ open debts | TESTED-FAIL | T3-004, T8-003 |  |
| I-32 | Sale.amountPaid = Σ allocations; status consistent | TESTED-FAIL | T3-007, T6-004; checker DOC-03 FAIL on t3 |  |
| I-33 | Debt remaining = orig - allocs - CN, never <0 | TESTED-FAIL | T3-003, T3-004; checker DEBT-01 FAIL t3/t4 |  |
| I-34 | Allocations <= payment amount | TESTED-FAIL | T6-004, T3-007 |  |
| I-35 | Statement opening+sales-payments=closing=balance | TESTED-FAIL | T3-018, T3 lifecycle, T7-020 |  |
| I-36 | Cash/bank never negative through a disbursement | TESTED-FAIL | T4-007, T8-001, T8-002; checker CASH-01 FAIL t4/t8 | guard exists but is bypassable and mis-sourced |
| I-37 | Bank/card to selected bank, cash to 1111, never group 1112 | TESTED-FAIL | T4-006, T4-008, T4-009, T7-004 |  |
| I-38 | Credit/partial sale has customer record on AR line | TESTED-FAIL | T3-010, T7-003, K1 C-30, D-13 |  |
| I-39 | Outstanding <= credit limit unless override | TESTED-FAIL | T3 boundaries (credit sale 40 000 vs limit 5 000 accepted); G 04-scenario (15 000 vs 5 000 accepted) | re-verified by G |
| I-40 | Sale total = Σ nets - discount + tax; paid+due=total | TESTED-FAIL | T3-011, T3-014, T3-015; checker DOC-05 FAIL t3 |  |
| I-41 | Revenue ex-VAT; VAT payable = sale tax; VAT report | TESTED-FAIL | T3-012, T8-007 |  |
| I-42 | Void leaves zero net effect | TESTED-FAIL | T3-001, T3-006, T6-003, T1-016 |  |
| I-43 | Returned qty <= sold; return reverses revenue/VAT/COGS | TESTED-FAIL | T2-003, T3 coverage; G 04-scenario probes: 404 on /sales/:id/return|refund, /returns | no partial return/goods return feature exists (credit note = GL only, T3-003) |
| I-44 | Profit = net revenue ex-VAT - FIFO COGS | TESTED-FAIL | T3-012, T1-004, T8-004 |  |
| I-45 | Cashier discount <=5% and <= line; no price override | TESTED-FAIL | T3-008, T7-008, T7-024; G-005 (setting ignored) |  |
| I-46 | Document numbers unique, no duplicates under concurrency | TESTED-FAIL | T4-004, T4-012, T6-006, T4-003; checker NUM-01 PASS | count-based numbering blocks creation |
| I-47 | Cashier/accountant responses exclude cost/profit/supplier prices | TESTED-FAIL | T5-004, T7-024 |  |
| I-48 | >=1 active admin, >=1 active branch, main branch cannot be deactivated | TESTED-FAIL | G-001 (sole admin demoted via roleId); branch half PASS: G 03-master, G-015 | FAIL for admin, PASS for branches |
| I-49 | Setup runs exactly once | TESTED-FAIL | G-003 (re-opened by setting; anon reset of admin); T7 setup replay PASS with flag true |  |
| I-50 | Password change/reset/deactivation invalidates sessions | TESTED-FAIL | T5-005; G 02-users (reset kills refresh token, access token survives) |  |
| I-51 | Settings, voids, adjustments, weights, resets leave immutable audit | TESTED-FAIL | T5-008, G-008 | only void/adjustment/write-off/payment-cancel/login logged |
| I-52 | Backup then restore yields identical DB | TESTED-PASS | T6 10-backup-restore, 11, 14 (T6-013); caveats T6-011, T6-012, T5-001, T5-002 | restore of assets/* not executed |
| I-53 | Weights in kg to users, grams in API, no x1000 errors | TESTED-FAIL | T7-021, T7-007, T7-013 (UI), K4 unit tests | mostly correct; wastage detail shows raw units |

Subtotal: TESTED-FAIL 45, TESTED-PASS 8, NOT TESTED 0 (of 53)

## Section 8 requirements (possibly unimplemented)

| ID | Requirement / invariant | Status | Covered by | Note |
|---|---|---|---|---|
| R8-01 | Expiry alerts + near-expiry job + "move to wastage / keep selling" action | TESTED-FAIL | G-009; T2-010 | pull list /inventory/expiring works; no job/notification/action |
| R8-02 | Storage-time, overdue-debt, shrinkage>30%, low-stock alerts | TESTED-FAIL | G-009, G-010 | low-stock + overdue lists only; due date never set by POS; others absent |
| R8-03 | Offline mode, queue, sync, indicator | NOT TESTED | G-016 (code review only) | no code found; not executed |
| R8-04 | Return receipt; partial returns restoring FIFO lots | TESTED-FAIL | G 04-scenario probes (404); T2-003; T3-003 | no return feature; credit note is GL-only |
| R8-05 | Password policy (8+complexity), bcrypt 12, rate limit, lockout | TESTED-FAIL | T5-006, T5-007; G 02-users (8-char any, same-password change accepted) | bcrypt cost 12 seen in code |
| R8-06 | Export all reports to PDF/Excel/CSV; bulk sales export | TESTED-FAIL | G-011 (24 PDF endpoints PASS; Excel/CSV absent) | PDF only |
| R8-07 | Digital scale serial, stability, calibration; manual weight needs admin password + log | NOT TESTED | G-016 (code review only); scale.* settings dead (G-005) | no backend/Tauri serial code |
| R8-08 | Cashier discount 5% + manager approval; price override admin-only | TESTED-FAIL | T3-008, T7-024; G-005 (cap hard-coded, setting ignored) |  |
| R8-09 | Credit limit enforcement with admin override | TESTED-FAIL | T3 boundaries; G 04-scenario |  |
| R8-10 | Live bird receiving (gross/net/shrinkage) and shrinkage report | TESTED-FAIL | G 16-inv-misc, T4 05, T2 coverage | absent; only isLiveBird boolean |
| R8-11 | End-of-day Z report, cash count, day lock; month-end review | TESTED-FAIL | T8-008; G 04-scenario (/reports/z-report 404) | absent |
| R8-12 | Approval workflows (purchase, expense>threshold, adjustment, wastage) | TESTED-FAIL | G-012; T2-008 | expense approve cosmetic; others absent |
| R8-13 | Daily encrypted off-site backup + documented restore + restore UI/endpoint | TESTED-FAIL | T6 10-15, T6-013, T5-001/002; G 06 (backup.* settings dead) | backup/restore work; not encrypted, not off-site, security holes |
| R8-14 | Immutable audit log of all critical actions incl. IP/user agent | TESTED-FAIL | T5-008, G-008 | login rows carry ip/user-agent; most actions unlogged |
| R8-15 | Reports: cash flow, AR aging, cashier perf, item profit, wastage %, supplier history, VAT, stock-vs-GL | TESTED-FAIL | G-011; T3 reports.mjs; T1-020 | VAT, stock-vs-GL, wastage, sales, purchases exist; aging/cash-flow/cashier/supplier-history absent |
| R8-16 | Data import (products/opening stock/customers) and accounting export | TESTED-FAIL | G-011 (no import/export routes) | absent |
| R8-17 | Receipt templates, drawer kick, save-draft sale, F2/F4/F9/F12 | NOT TESTED | G-016 (code review only); T7 printed receipts (T7-006) | drawer/draft/shortcuts not executed |
| R8-18 | Users page: logged-in status, last login, work start date, onboarding, language | TESTED-PASS | G 12-users-view (isLoggedIn, lastLoginAt, workStartDate returned and updated on login) | UI use of isLoggedIn absent (G-016); onboarding message not tested |
| R8-19 | Per-branch inventory, branch reports, user-branch access, inter-branch transfer | TESTED-FAIL | T2-014, T1-020, T4 coverage | not implemented |
| R8-20 | Insufficient cash/bank check on disbursements | TESTED-FAIL | T4-007, T8-002, T8-001 | exists, wrong in both directions |
| R8-21 | Fiscal years, periods, closing voucher, year-end close, freeze date | TESTED-FAIL | T1-011, T1-013 | no period API |
| R8-22 | Payment ledger, reconciliation, advances, credit notes with VAT reversal | TESTED-FAIL | T3-003, T3-005, T3-007, T4-016, T3-012 |  |
| R8-23 | Opening stock on item creation with proper GL | TESTED-FAIL | T2-012 |  |
| R8-24 | Cash-to-bank deposits and bank-to-bank transfers | TESTED-FAIL | T4 coverage (no endpoint), T1-008 (manual JE only) | absent |
| R8-25 | Supplier statement & payables page; printable customer statement | TESTED-FAIL | T3-018, T7-020, T4-001, T4-020 |  |
| R8-26 | Bad-debt write-off POST /debts/:id/write-off | TESTED-FAIL | T3-004, K3 posting probes, K2-001 |  |
| R8-27 | Session timeout and refresh-token rotation / blacklist | TESTED-FAIL | T5-005; G 02-users | access 15 min, refresh 7 d; no rotation (T5-005) |
| R8-28 | Encryption at rest of users/permissions | TESTED-FAIL | G-016, T5-001, T6 (plain SQLite read by every tester) | absent |

Subtotal: TESTED-FAIL 24, TESTED-PASS 1, NOT TESTED 3 (of 28)

## Section 7 contradictions C-01..C-33

| ID | Requirement / invariant | Status | Covered by | Note |
|---|---|---|---|---|
| C-01 | Two PRDs share a name (v1 multi-tenant vs v2 chicken) | NOT TESTED | - | documentation contradiction; no runtime oracle (T7 observed v2 behaviour: 2 roles) |
| C-02 | Money x100 vs x1000 | TESTED-FAIL | T7-021, T7-013, T1 PDFs, K4 unit tests | one remaining raw-unit display; API consistent x100 |
| C-03 | Transfer = item->item vs inter-branch | TESTED-FAIL | T2-014 (inter-branch absent), T2-005 | implemented as transformation only |
| C-04 | Costing FIFO vs average | TESTED-FAIL | T2-001, T2-004 | both used; drift |
| C-05 | Cashier & purchases (admin-only vs cashier allowed) | TESTED-PASS | T5 authz matrix, T5-009 | purchases admin-only at API (PRD2 reading); other guards missing are T5-009 |
| C-06 | Default credit days 30 vs 7 | TESTED-FAIL | G-010 | neither: due date stays NULL |
| C-07 | Overpayment: credit balance vs reject | TESTED-FAIL | T3 boundaries, T3-007, T6-004 | both behaviours exist |
| C-08 | Tax base before/after discount; inclusive vs exclusive | TESTED-FAIL | T3-011, T3-012, T3-014, T7-002 |  |
| C-09 | Profit incl. VAT vs ex-VAT | TESTED-FAIL | T3-012 | profit includes VAT |
| C-10 | Discount accounting (net revenue vs 54xx) | TESTED-FAIL | T1-005, G 10-reconcile (GL revenue 60 100 vs report 59 980) |  |
| C-11 | Void rules / 24 h window / HAS_PAYMENTS | TESTED-FAIL | T3-001, T3-006, T3 xval |  |
| C-12 | P&L COGS periodic vs perpetual (wastage double count) | TESTED-FAIL | T1-004, T2-009, T8-004 |  |
| C-13 | Account codes differ across docs | TESTED-PASS | T1 06-coa; checker (1111, 1112-NNN, 1120, 1125, 1131, 2110, 5300, 5400 consistently used by code) | seed chart is internally consistent; T4-008 mapping issues separate |
| C-14 | VAT receivable account | TESTED-FAIL | T4-001 (1125 never debited), T3-007 |  |
| C-15 | Dynamic page access UI-only | TESTED-FAIL | T5 authz matrix, T7-023, T5-009 |  |
| C-16 | Accountant beyond PRD limits | TESTED-FAIL | T5-004, T7-024 |  |
| C-17 | Transfer receivedAt / expiry | TESTED-FAIL | T2-006 |  |
| C-18 | Transfer cost / yield loss | TESTED-FAIL | T2-005, T2-006, T8-005 |  |
| C-19 | Live-bird shrinkage cost vs 5252 | TESTED-FAIL | G 16-inv-misc (not implemented) |  |
| C-20 | Expired stock: block vs warn vs exclude | TESTED-FAIL | T2-010 | sold FIFO with no warning |
| C-21 | Price override admin-only vs setting allow | TESTED-FAIL | T3-008, G-005 |  |
| C-22 | Wastage approval vs immediate JE | TESTED-FAIL | T2-008, G-012 | immediate JE, no approval route |
| C-23 | FIFO key receivedAt vs expiry | TESTED-PASS | T2-003 (receivedAt), T2-006 | receivedAt used |
| C-24 | Session 15 min/7 d vs 8 h | TESTED-PASS | G (JWT exp-iat = 900 s; sessionExpiresAt = login + 7 d), T5-005 | APIP reading implemented |
| C-25 | Manual debt JE header with no lines; debt cancel no JE | TESTED-FAIL | G 04-scenario (no POST /debts route), T3-004, K2-001 | manual debt endpoint absent; write-off no GL (K2-001) |
| C-26 | Supplier return wording | TESTED-FAIL | T4-015, G-011 (no supplier return route) | absent |
| C-27 | Barcode price field 5 vs 7 digits | TESTED-FAIL | T3-015 | 14-digit template cannot be set via config |
| C-28 | Return restock rounding vs I-14 | NOT TESTED | G 04-scenario (no return feature, nothing to test) |  |
| C-29 | Purchase cancel refund of cash part | TESTED-FAIL | T4-002 | paid purchases cannot be cancelled |
| C-30 | Mixed payment creates debt without customer | TESTED-FAIL | T3 xval, T3-010, T7-003 |  |
| C-31 | GL reversal by findFirst | TESTED-FAIL | T3-006, T1-016, T1 05b-mixed |  |
| C-32 | Event-driven posting risk (doc without JE) | TESTED-PASS | checker DOC-01 PASS on T3/T4/T8/G; K3-012 (T6 08) rollback | posting is synchronous in-transaction on the default path; exceptions K3-012/T4-005 |
| C-33 | Cheque / mobile payment routing, no PDC workflow | TESTED-FAIL | T4-009, G 04-scenario (check accepted, cheque/mobile_payment rejected) |  |

Subtotal: TESTED-FAIL 26, TESTED-PASS 5, NOT TESTED 2 (of 33)

## Totals

TESTED-FAIL 95, TESTED-PASS 14, NOT TESTED 5 (of 114 rows)

