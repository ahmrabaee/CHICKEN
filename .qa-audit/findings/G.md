# G — Coverage-gap findings (Phase 3, agent G)

Instance `ga` (port 3119, dev profile, fresh per script; see `tests/G/fresh.sh`). Scripts and saved outputs in `.qa-audit/tests/G/` (`NN-name.mjs` + `.out.txt`).
All findings below were executed unless explicitly marked "code review only". Dates are 2026-11-25. Money = agorot, % = basis points.
Cross-references: `T5-00x` etc. are existing findings; "extends" means G adds evidence the earlier tester did not have.

### G-001: The last (sole) admin can demote himself to accountant — the last-admin guard exists only on DELETE; system is left with no admin and no API way back
- Status: VERIFIED
- Severity: High
- Area / files: `users/users.service.ts:198-285` (`update()` replaces the role with `deleteMany`+`create`, no admin-count check); the guard is only in `delete()` (L320-336); `UpdateUserDto.roleId` is accepted for any target incl. self
- Test executed: yes — `tests/G/01-admin.mjs` (first run), `01b-lastadmin.mjs`, `02-users.mjs` (final block) → `.out.txt`
- Reproduction: 1. fresh dev, login `admin/admin123` (the only admin). 2. `PUT /v1/users/1 {"roleId":2}` -> 200, `roles:["accountant"]`. 3. relogin: role `accountant`; `GET /users`, `GET /settings`, `PUT /users/1 {"roleId":1}` all 403. 4. SQL: `user_roles` shows admin user with role accountant. Same works for the admin demoting any other admin until none is left.
- Expected (I-48 "at least one active admin always", PRD2/BLP; API doc on DELETE says "Cannot deactivate own account or last admin"): the same rule must apply to role change. Actual: guard bypassed by role change; DELETE self -> 403 (guard works there).
- Root cause: invariant enforced in one of two code paths; role update is also non-atomic (see G-002).
- Business / technical impact: one mis-click in the Users page (role dropdown in `UserForm.tsx` is enabled when editing yourself) locks the owner out of users, settings, backups, tax, bank accounts, purchases, audit. Recovery requires direct DB editing — not possible for a shop owner on a Tauri desktop install.
- Historical context checked: D-11 (admin/accountant roles), decision-log has no entry on last-admin handling beyond DELETE.
- Recommendation: enforce "≥1 active admin" in `update()` (role change and any future `isActive`), inside the same transaction; block self-demotion.

### G-002: User role change is not atomic — an invalid `roleId` leaves the user with NO role, and such a user can still log in
- Status: VERIFIED
- Severity: Medium
- Area / files: `users/users.service.ts:259-272` (deleteMany then create, outside a transaction)
- Test executed: yes — `tests/G/02-users.mjs`
- Reproduction: `PUT /users/2 {"roleId":999}` -> 400 `FOREIGN_KEY_ERROR` but `GET /users` then shows user 2 with `roles:[]`; `POST /auth/login` as that user -> 200 with a token whose payload has `roles:[]`, `permissions:[]`, yet `allowedPages` is a default list (dashboard, inventory, sales, customers, payments, accounting ... ).
- Expected: failed update changes nothing; a user without a role cannot authenticate. Actual: role destroyed, login succeeds.
- Impact: partial write on a security attribute; role-less accounts reach UI pages built from `allowedPages`. Low probability via UI (roleId is a dropdown) but trivial via API/automation.
- Recommendation: validate roleId existence first, do delete+create in `$transaction`, reject login for users with no role.

### G-003: "Setup runs exactly once" is protected only by one mutable string setting; once it is not `'true'`, anonymous `POST /auth/setup` resets the existing admin's password
- Status: VERIFIED
- Severity: High
- Area / files: `auth/auth.service.ts:462-475` (checkSetup = row `setup_completed`==='true'), `:486-545` (completeSetup reuses an existing admin username and overwrites `passwordHash`; never checks that users already exist); `settings.service.ts:47` (any key/any value writable)
- Test executed: yes — `tests/G/07-setup-reopen.mjs` → `.out.txt`
- Reproduction: 1. as admin `PUT /settings/setup_completed {"value":false}` -> 200 (`check-setup` now `setupCompleted:false`). 2. unauthenticated `POST /auth/setup {businessName:"Hijack",adminUsername:"admin",adminPassword:"Hacked12345",adminFullName:"H",preferredLanguage:"ar"}` -> 200 with admin access token. 3. `admin/admin123` -> 401; `admin/Hacked12345` -> 200; business_name overwritten; all sales/purchase data untouched.
- Expected (I-49): setup refuses when any user/branch/document exists, independent of a setting. Actual: protection collapses to one editable string.
- Ways the flag can become false other than a deliberate change: restore/import of an older or baseline DB (T5-002 shows an accountant can import a DB; T6-012 shows restore performs no content validation), manual data fix, accidental bulk settings update (G-004).
- Impact: after any such event the shop is one unauthenticated HTTP call from losing admin control; the audit trail records `system_setup_complete` only.
- Historical context: BLP/FPRD require wizard once; T7 "setup wizard (baseline)" checked only the happy path and the replay with flag true.
- Recommendation: setup allowed only when `COUNT(users)=0`; never reuse an existing username; do not store the guard only in `system_settings`.

### G-004: Settings API has no validation at all — any key, any type, any value; malformed bodies return 500
- Status: VERIFIED
- Severity: Medium
- Area / files: `settings/settings.service.ts:47-110` (stringify and upsert), `settings.controller.ts`
- Test executed: yes — `tests/G/06-settings-audit.mjs` §B, `11-badsettings-impact.mjs`
- Reproduction (all return 200): `currency.decimals="abc"`/`-3`, `tax.default_rate="banana"`/`999999`, `barcode.total_length="abc"`, `barcode.weight_start=-5`, `backup.frequency_hours=0`, `app.timezone="Mars/Phobos"`, `app.default_language="xx"`, `gl_debit_credit_tolerance=-100`, `totally.new.key="x"`, `setup_completed=false` (G-003). `POST /settings/bulk {"settings":"x"}` -> 500 `settings is not iterable`; `DELETE /settings/app.name` -> **500** (should be 4xx) "Cannot delete system settings"; `PUT /settings/company {roundOffAccountId:999999}` -> 400 FOREIGN_KEY_ERROR (only validated by the DB).
- Observed effect of bad values (`11-badsettings-impact.mjs`): sales keep working in every case (the settings are mostly dead, see G-005); only barcode parse/lookup/config are affected (`/barcode/parse` -> 400 with `total_length="abc"`, config endpoint returns the garbage; confirms T6's observation). No crash found.
- Expected: typed schema per key (range, enum, type), unknown keys rejected, `isSystem` keys protected, 4xx for malformed input.
- Impact: an admin typo corrupts barcode behaviour or reopens setup (G-003) with no guard. Severity limited by G-005 (most keys are inert).
- Recommendation: per-key validators; whitelist keys; make `setup_completed` read-only through the API.

### G-005: Most seeded settings are dead switches — the UI/API let the owner "configure" behaviour that is hard-coded or not implemented
- Status: VERIFIED (behaviour for 6 keys, code/dist grep for the rest)
- Severity: Medium
- Area / files: seed `system_settings` (62 rows); consumers: `lib/db.ts` (only `numbering.*_next`/prefix helper for non-sale documents), `sales.service.ts:259` (hard-coded `isAdmin ? 10000 : 500`), backup module reads `backup.auto_enabled` and `backup.retention_count` (not the seeded `backup.retention_days`/`frequency_hours`)
- Test executed: yes — `tests/G/06-settings-audit.mjs` §A
- Reproduction and results:
  - `pos.allow_credit_sale=false` then credit sale to customer 1 -> **201** (accepted).
  - `pos.require_customer=true` then walk-in cash sale -> **201**.
  - `pos.accountant_max_discount_pct=100` (1 %) then accountant sale with 4 % discount -> **201**, discount 120 applied (cap is hard-coded 5 %).
  - `inventory.allow_negative_stock=true` then oversell by 500 kg -> **400 INSUFFICIENT_STOCK** (only the per-item flag is read).
  - `numbering.sale_prefix="XYZ-"` / `numbering.sale_next=999999` -> next sale number is still `SAL-20261125-0013` (sale numbers are generated from date + counter, setting unused).
  - Grep of `app/backend/src`, `app/backend/dist` and `app/frontend/src` finds no reader for: `tax.default_rate`, `tax.prices_include_tax`, `inventory.default_expiry_alert_days`, `inventory.low_stock_alert_enabled`, `inventory.fifo_enabled`, `pos.receipt_copies`, `pos.print_receipt`, `currency.decimals`, `app.timezone`, `scale.*`, `backup.frequency_hours`, `backup.retention_days`, `sales.allow_price_override` (API-12 default; not even seeded).
- Expected: either honoured (PRD2 5.2 credit/discount rules, C-21, I-39/I-45) or not offered. Actual: false sense of control. Extends T3-008 (cap bypass) with the root cause: the setting is ignored.
- Impact: an owner who disables credit sales or lowers the cashier discount cap believes the control is in force; it is not. Reports/receipts ignore timezone and decimals settings (ties to T6-010/K4-007).
- Recommendation: delete the dead rows from the seed/UI or wire them; document which settings are live.

### G-006: Boolean query filters are broken — `isActive=false` (also `lowStock=false`, `hasBalance=false`) behaves as `true`; "show inactive" lists active records and deactivated records are unreachable
- Status: VERIFIED (API); UI path VERIFIED by code (`pages/Customers.tsx:330` sends `isActive:false`)
- Severity: Medium
- Area / files: DTOs using `@Type(() => Boolean)` (`items/dto/item.dto.ts:85-105`, customers, users): `Boolean("false") === true`
- Test executed: yes — `tests/G/13-boolfilter.mjs`, `14-boolfilter2.mjs`
- Reproduction: with one deactivated customer/item present: `GET /customers?isActive=false` returns the 8 ACTIVE customers (identical to `isActive=true`); `GET /customers?isActive=` (empty string) returns the one inactive customer; same for `/items`, `/users?isActive=false` (returns active users), `items?lowStock=false` (= `true`), `customers?hasBalance=false` (= `true`). Default lists hide inactive rows entirely.
- Expected: `false` filters inactive. Actual: inactive customers/items (including those soft-deleted by D-06 "delete with history") cannot be listed from the UI, so they cannot be reviewed or reactivated.
- Impact: soft-deleted customers with history disappear permanently from the UI; "فعّل/عطّل" workflows cannot work. Extends G-007.
- Recommendation: parse booleans explicitly (`Transform(({value}) => value === 'true')`).

### G-007: User enable/disable in the Users page can never work — the UI sends `isActive` in `PUT /users/:id`, the API rejects it; there is no reactivation path at all
- Status: VERIFIED (API); UI by code review (`pages/Users.tsx:81-86`, menu items "تعطيل/تفعيل الحساب")
- Severity: Medium
- Area / files: `users/dto/user.dto.ts` (UpdateUserDto has no `isActive`; global `forbidNonWhitelisted`), `Users.tsx handleToggleStatus`
- Test executed: yes — `tests/G/02-users.mjs`: `PUT /users/5 {"isActive":true}` -> 400 `property isActive should not exist`; `PUT /users/1 {"isActive":false}` -> 400. Only `DELETE /users/:id` deactivates; nothing reactivates (also `PUT /users/me` ignores everything but profile fields).
- Expected (FPRD users management; PRD2 10.3): admin can disable and re-enable staff. Actual: toggle shows an error (and T7-009 shows the backend reason is hidden), a deactivated employee can never be restored short of DB edit; the 400 also hides G-001's sibling problem.
- Recommendation: add `isActive` to the DTO with the last-admin rule (G-001) or a dedicated activate endpoint (branches already have `/activate`).

### G-008: Audit trail covers only 8 write paths; no audit for purchases, expenses, payments, credit notes, manual JEs, wastage, transfers, customer/supplier edits, price/discount overrides
- Status: VERIFIED
- Severity: Medium
- Area / files: only `auth` (login/setup), `chart-of-accounts`, `debts` (write-off), `inventory` (adjustment), `payments` (cancel), `sales` (void) call `auditLog.create`
- Test executed: yes — `tests/G/06-settings-audit.mjs` §C and DB query: after ~30 mutations (sales, purchases, payments, expenses, customer/supplier CRUD, settings, role changes, setup reset) `audit_logs` held 6 rows: 5× login, 1× sale void.
- Expected (I-51, PRD2 10.3): voids, adjustments, manual weights, price/discount overrides, settings, password resets, backups leave immutable records; "immutable audit log of all critical actions" (§8 #14). Actual: extends T5-008 (users/backups/settings/page-access/tax) with financial documents: purchase edit/delete (T4-003 hard-deletes JEs and leaves no row), expense edit/delete (T4-005), manual JE, credit note, wastage, stock transfer, credit-limit/discount changes, header discounts of 100 %, price overrides. There is no API to modify audit rows (PUT/DELETE -> 404) and `/audit` is admin-only (accountant 403) — good. `GET /audit?entityType=sale` is case-sensitive (`Sale`), returns 0 for `sale`.
- Impact: no forensic trail for the actions that move most money; combined with G-003/T5-001 an intruder leaves no trace.
- Recommendation: central interceptor for all mutating controllers; log before/after for settings and master data.

### G-009: Alerts requirement (expiry / storage-time / abnormal shrinkage / low stock / overdue) is implemented only as three pull-style lists; there is no notification system
- Status: VERIFIED
- Severity: Medium
- Area / files: `inventory.service.ts:162-230` (`getLowStock`, `getExpiring`), `debts.service.ts:258` (`getOverdue`); no notification/alert module in `app/backend/src` or frontend; `inventory.default_expiry_alert_days`, `inventory.low_stock_alert_enabled` are dead settings (G-005)
- Test executed: yes — `tests/G/04-scenario.mjs` §D
- Results: `GET /inventory/low-stock` works (lists all zero-stock items by D-30 + items below min); `GET /inventory/expiring?days=30` returned the lot with expiry = purchase + category shelf life (3 d) with `daysUntilExpiry:3` — correct; `GET /debts/overdue` works only when a debt has a due date (G-010); 404 for `/notifications`, `/alerts`; dashboard payload has only `lowStockCount`, no expiring/overdue/shrinkage counts. Not implemented anywhere: batch-stored-too-long alert (FPRD), shrinkage > 30 % alert (PRD2 8.2.3), near-expiry job with "move to wastage / keep selling" action (WST 6), low-stock notification (NOTES). T2-010 already shows expired lots are still sold.
- Expected: §8 items 1-2. Actual: partial (pull lists only).
- Impact: spoilage prevention relies on someone opening the inventory page; the system never alerts the owner.
- Recommendation: decide scope; at minimum surface expiring/overdue counts on the dashboard.

### G-010: POS credit sales have no due date, so they are never "overdue" — the overdue list, aging and overdue alerts cannot fire for the shop's main credit flow
- Status: VERIFIED
- Severity: Medium
- Area / files: `sales.service.ts:478,617` (`dueDate: dto.dueDate ? ... : null`); POS page never sends `dueDate` (grep `pages/POS.tsx`: none); `debts.service.ts:259-266` (`dueDate < today` filter)
- Test executed: yes — `tests/G/10-reconcile.mjs`/`18-misc2.mjs`; SQL on `debts`/`sales`: every debt created from a POS credit sale has `due_date NULL`; a sale created with `dueDate:'2026-10-01'` appears in `/debts/overdue` (count 1), the others never.
- Expected (C-06: default credit days 30 per PRD2 / 7 per API-05; PRD2 11.6 overdue alerts): default due date = sale date + configured days. Actual: no default at all, neither 7 nor 30.
- Impact: "overdue receivables" is empty by construction for walk-up credit customers; aging falls back to creation date (D-17), so only the aging PDF reflects reality.
- Recommendation: apply a default term at sale/purchase creation (customer-specific if set).

### G-011: Reports/Export gaps confirmed against the report list in PRD2 §8 / §8-#15
- Status: VERIFIED (route probing + controller review)
- Severity: Medium
- Test executed: yes — `tests/G/04-scenario.mjs` §D (31 GET/POST probes), `05-reports.mjs`, `08-misc.mjs`
- Present: dashboard, sales (with byItem), purchases (bySupplier), inventory, wastage, expenses, profit-loss, stock-vs-gl, VAT, 24 PDF endpoints. All 24 PDF endpoints return valid `%PDF-` (100-300 kB) for default, `language=ar` and date params; invalid `language`/dates -> clean 400; unknown ids -> 404 (`08-misc.out.txt`). Content correctness is T3/T4/T7 scope.
- Absent (404 / no controller): AR/AP **aging report** (`debts.service.getAgingReport` exists but is dead code — no route), cash-flow report, cashier performance (discounts/voids), item sales/profit report as a separate endpoint, supplier purchase history, day book, end-of-day Z report (T8-008), customer/supplier returns, **Excel/CSV export** (only a frontend CSV helper for the dashboard; D-36 deliberately removed the inventory CSV), **import** of products/customers/opening stock, QuickBooks export (PRD2 9.4).
- Reconciliation result (positive): on a one-day dataset the operational reports reconcile with raw tables exactly — sales count/net/cost/profit, purchases count/total, expenses count/total, P&L revenue/COGS/expenses, inventory report vs lots vs inventory table (`10-reconcile.out.txt`, all OK). Remaining differences are the known ones: GL revenue 60 100 vs report 59 980 (discount posted to 5400, T1-005), dashboard receivables 11 000 vs debts 8 000 (written-off debt counted, T8-003, re-confirmed), supplier balance (T4-001, re-confirmed).
- Impact: owner cannot get AR aging, cash flow or staff-discount reports from the system; Excel/CSV claims in FPRD/PRD2 8.3 unmet.
- Recommendation: expose `getAgingReport`; decide scope for the rest and update the PRD.

### G-012: Approval workflows are cosmetic — an expense is posted to the GL when created; "approve" only stamps a flag and has no role, threshold or effect; purchases, wastage and adjustments have no approval at all
- Status: VERIFIED
- Severity: Medium
- Area / files: `expenses.service.ts:156-167` (sets isApproved/approvedBy only), `expenses.controller.ts` (page-gated only), no approval routes for wastage (404 on `/wastage/:id/approve|reject`, T2-008), purchases (`is_approved` column, no endpoint; `/purchases/:id/receive` returns ALREADY_RECEIVED), adjustments
- Test executed: yes — `tests/G/06-settings-audit.mjs` §D, `08-misc.mjs`, `09-cust-del.mjs`
- Results: expense created by admin -> `is_approved=0` but JE exists (`journal_entries` source expense id 4/5) before any approval; `POST /expenses/5/approve` -> 201 for the creator himself, again 201 (idempotent), no threshold, no effect on GL; accountants have no `/expenses` page access by default (403) so the PRD "expense > threshold needs approval" cannot be exercised.
- Expected (§8 #12; CAP; C-22): approvals gate posting or at least big amounts. Actual: unenforced flag.
- Impact: anyone with the expenses page can book unlimited expenses; "approved" columns on reports can be misread as control.
- Recommendation: either remove the approval UI/columns or implement draft→approve→post.

### G-013: Master-data validation gaps (duplicates, whitespace names, ranges, enums) — Low-impact but systematic
- Status: VERIFIED
- Severity: Low
- Test executed: yes — `tests/G/03-master.mjs`, `08-misc.mjs`, `09-cust-del.mjs`, `18-misc2.mjs`
- Accepted without complaint (201/200): customer name `"   "`; phone `"abc"`; the same phone as `"0599777000"`, `" 0599777000 "`, `"+970599777000"` (3 customers; only the exact string is unique); supplier names `"GSupHist"`, `"gsuphist"`, `"GSupHist "` (exact-match dup check only); category duplicate names (also case/Arabic dup), category `storageType:"lava"`; item `min stock > max stock`, 5 000-char name, `<script>` in name (stored raw; output encoding is a UI concern, T7-006), item barcode equal to another item's code (`CHK-RAW-01`), duplicate item names, sale price 0 / sale price below purchase price (D-33 is frontend-only); supplier rating 99, supplier negative credit limit -5; customer `priceLevel:"vip"` on PUT; username case-insensitive duplicate (`GG1` vs `gg1`); customer deactivation while debts are open; `change-password` to the same password; `weak pw` = any 8 chars (T5-007). Admin can sell below cost (price 100 vs cost 1800/kg -> profit -1700).
- Correctly rejected: duplicate exact username/email/phone/item code/barcode/category code/branch code, negative price/credit limit, tax rate > 100 %, discount > 100 %, bad category id, fractional money, page/pageSize bounds (1..500) on 14 list endpoints.
- Impact: duplicate customers/suppliers split balances; below-cost sales are silent. No defect in money integrity.
- Recommendation: trim/normalise phone & names, case-insensitive unique indexes, enum validation, margin warning at POS.

### G-014: Pagination is validated everywhere except `/stock-transfer` (unbounded `pageSize`) and `/credit-notes` (silent clamp to 100); `%`/`_` act as LIKE wildcards in search
- Status: VERIFIED
- Severity: Low
- Test executed: yes — `tests/G/03-master.mjs` (Pagination block), `08-misc.mjs` (search)
- Results: `GET /stock-transfer?pageSize=99999` -> 200 with `pageSize:99999` echoed (no cap); `GET /credit-notes?pageSize=99999` -> 200 with `pageSize:100`; the other 12 list endpoints return 400 above 500 and below 1. `page=99999` returns empty with `hasPrev:true` (fine). `items?search=%` returns every item (wildcard). SQL-injection style search strings return 0 rows safely.
- Impact: possible slow response on large data; trivial.

### G-015: Informational — positive controls (executed, PASS)
- Status: VERIFIED PASS (no defect)
- Branch rules: main branch cannot be deactivated (`CANNOT_DELETE_MAIN_BRANCH`), last active branch protected (`LAST_ACTIVE_BRANCH`), duplicate code 409, code format validated, `activate` works (`03-master.out.txt`) — I-48 branch half PASS.
- Users: duplicate username/email 409, password min-length 8, role must exist on create (404), admin password reset invalidates the target's refresh token (old refresh -> 401; old access token still valid until expiry = T5-005), wrong current password rejected, deactivated user cannot log in (`USER_INACTIVE`), delete self blocked, deleting the last active admin blocked (but see G-001).
- Master data: item/category delete follows D-06/D-07 (hard delete without history, soft with history); customer with open debts -> `CUSTOMER_HAS_OPEN_DEBTS` (D-18), fully paid customer is soft-deleted, supplier with any transaction cannot be deleted (409 `SUPPLIER_HAS_TRANSACTIONS`, even when fully paid — no archive path except `isActive` PUT).
- I-25 wastage value = lot remaining cost (2 kg × 50.00 = 100.00; JE Dr 5300 / Cr 1131 = 10 000) PASS; I-28 displayed cost = effectiveCostPrice 5 000 (avg) while stock>0 and default price 4 000 at qty 0 PASS; payment methods accepted by sales: `cash, card, bank_transfer, check` (invalid -> 400; `cheque`, `mobile_payment` rejected although PRD/C-33 mention them).
- Invariant checker (`harness/invariants.mjs`) on the `ga` DB after all G scenarios: all GL/AR/DEBT/CASH/DOC/NUM checks PASS; only AP-01/02 (T4-001) and INV-01 (dev seed stock without GL) FAIL (`15-invariants-ga.out.txt`).

### G-016: Informational — requirements confirmed ABSENT by code review only (no runtime test possible via API)
- Status: SUSPECTED (code review only)
- Severity: Info
- Offline mode / sync queue / offline indicator (no `navigator.onLine`/service worker in `app/frontend/src`), digital scale serial integration & stability/calibration (`scale.*` settings dead, no serial code in frontend or Tauri), keyboard shortcuts F2/F4/F9/F12 (only an unrelated "F2" hit), cash-drawer kick, "save draft" sale, thermal receipt templates (print is browser print, T7-006), encryption at rest (DB is plain SQLite; every tester opened it with `node:sqlite`; backup archives unencrypted T5-001), QuickBooks export, Users page "logged-in status" (`isLoggedIn` is returned by the API but never used by `Users.tsx`).
- Recommendation: update the PRD status list or schedule them.

### G-017: Informational — model/endpoint coverage holes found while mapping controllers and Prisma models
- Status: VERIFIED (static + route probing)
- `CostCenter` model: no controller/route; `costCenterId` exists only on JE lines/GL engine. A manual JE line with a bogus `costCenterId` is rejected as "lines has invalid value" (DTO shape), so the field is effectively unreachable and untested. `ExpenseCategory`: only `GET /expenses/categories` (no CRUD; T1-005 already shows its account mapping is ignored). `SchemaVersion`: only touched by T6-012 (restore of incompatible schema). `AccountingPeriod`: no API (K3/T1 seeded it via SQL). `PageDefinition/RolePageAccess/UserPageAccess`: covered by T5/T7 only. `POST /accounting/accounts/rebuild-tree` had no test by anyone; run by G -> 201, parent links consistent afterward. Routes with no *functional* execution by any tester (only authz probes or UI renders): `GET /stock-transfer/source-lots` & `/products` (G: 200), `GET /reconciliation/suggest` (G: 200, empty), `GET /debts/overdue` (G: works, see G-010), `GET /items/barcode/:barcode` (G: works, exact match incl. barcode `CHK-RAW-01` equal to another item's code collides silently, G-013).
