# MASTER REGISTER - QA audit of the butcher-shop POS / inventory / accounting system

Consolidator: agent C, 2026-11-25. Inputs read in full: `findings/*.md` (K1-K4, ORCH, T1-T8 + coverage files, V1, V2, G, G-coverage-matrix), `knowledge/decision-log.md` (D-01..D-37, F-01..F-23, R-01..R-14), `bulletin/*.md`. No new tests were run; every number below is copied from a findings file or a saved test output named there.

## How to read this register
* Raw volume: 231 raw finding headings (ORCH 7, K1 15, K2 10, K3 25, K4 21, T1 20, T2 18, T3 18, T4 20, T5 13, T6 14, T7 24, T8 9, G 17) plus the re-proof tables of V1 (16 rows) and V2 (about 17 rows). They collapse into **68 clusters** (QA-001..QA-068).
* Status: `VERIFIED-BY-2+ AGENTS` = at least two agents each executed their own test (a V1/V2 re-proof counts as an extra agent; an agent that only repeated a lead or read code does not). `VERIFIED-BY-1` = one agent executed it. `SUSPECTED` = code or document review only. `INTENTIONAL-BUT-RISKY` = deliberate decision (D-nn) with harmful consequences. `NOT-VERIFIABLE` = harness could not settle it.
* Severity (re-rated): Critical = wrong money/inventory in ordinary operation, data loss, or unauthenticated / low-privilege takeover. High = wrong money/stock or blocked workflow under common conditions, or a serious control failure. Medium = conditional or reporting-level. Low = cosmetic/hygiene. Info = informational. Where this differs from a tester's rating it is stated.
* Money is quoted in the unit the source used (minor units: 100 = 1.00 shekel, or shekels). Source paths are relative to `app/backend/src` unless prefixed `app/`. Test scripts are relative to `E:\DEV\Chicken FMS\.qa-audit\`.
* "Engines OFF" = `gl_engine_enabled=false`, `tax_engine_enabled=false`, the default in every profile (D-26). Behaviour described is on that default (legacy) path unless stated.

---

# 1. Clusters by root cause

## 1A. Security, access control and platform

### QA-001 - Unauthenticated download of the whole database via a forgeable backup token
* Severity: Critical | Status: VERIFIED-BY-2+ AGENTS | Sources: T5-001, V2 (re-proof)
* In plain words: backups can be downloaded with a signed, time-limited link. The signing secret was never configured, so it falls back to a phrase printed in the source code. Anyone who can reach the server can forge a link and download every customer, supplier, price, cost, financial record and every user's password hash, without logging in.
* Where: `modules/backup/security/backup-token.service.ts:19`; `modules/backup/backup.controller.ts:147` (`@Public() GET /system/backups/:id/download`); `BACKUP_DOWNLOAD_SECRET` absent from `.env`, `.env.example`, `DEPLOYMENT.md`.
* Repro: `tests/T5/backup-exfil.mjs` (forged token, no auth header -> 200, gzip, 35,839 bytes; wrong secret -> 401); V2 `tests/V2/01-auth-security.mjs` (200, 34,487 bytes, magic 1f8b).
* Impact: full data theft with no account; backup ids are small integers; PRD says the API is internet-reachable behind Caddy.
* Root cause: public default for a security secret, no boot check, template and docs silent. V2: not merely latent, any deployment following DEPLOYMENT.md is on the fallback permanently.
* History: no D-nn; missed by K2/K3.
* Fix: refuse to start without the secret; document it; require an authenticated admin for downloads; rotate and treat existing backups as exposed.

### QA-002 - Role checks not enforced on many controllers: an accountant can restore, import, download databases and edit tax rates
* Severity: Critical | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-010, T5-002, T5-009, V2 (re-proof); related K4-009, K3-024
* In plain words: many areas are labelled admin-only in code but the enforcement switch (RolesGuard) was never attached to them; only the login check is global. So an accountant can list, create, download, import and restore backups (replacing all data), change the backup folder, create/edit/delete tax rates, submit credit notes, apply allocations and read the chart of accounts.
* Where: `modules/backup/backup.controller.ts`; `accounting/tax/tax-template.controller.ts` (also inline body type, no DTO whitelist); `accounting/credit-note/credit-note.controller.ts`; `accounting/reconciliation/reconciliation.controller.ts`; `accounting/chart-of-accounts/account.controller.ts`; `app.module.ts:95`. No role restriction at all: sales (except void), wastage, inventory GETs, debts receivables/:id.
* Repro: `tests/T5/authz-matrix.mjs` (187 endpoints x 5 principals; `authz-matrix.csv`, `authz-violations.txt`), `backup-exfil.mjs`, `guard-gap-writes.mjs`, `input-attacks.mjs` (accountant import -> 201; tax template 9900 bps created and deleted). K3 control: `GET /purchases` and `/settings` -> 403. V2 `tests/V2/02-accountant-backups.mjs`: accountant restore -> 201 "Backup restored successfully".
* Impact: the lowest staff role can replace the whole database, zero its own debt, create admins, forge history, mis-state VAT.
* Root cause: authorization is decorated, not enforced.
* History: `ACCOUNTANT_ADMIN_PLAN_STATUS` listed missing RolesGuard on settings, audit, debts, expenses, suppliers, purchases, wastage, reports (decision-log section 6 #12); later fix partial - plan treated as done, gap remains (D-11).
* Fix: global default-deny RolesGuard with explicit `@Public()`; DTO for tax templates; keep the 187-endpoint matrix as a CI test.

### QA-003 - Restore/import validates nothing and cannot roll back: one bad archive bricks the system
* Severity: High (T6-012 rated Critical; High because it needs an admin action or QA-002) | Status: VERIFIED-BY-2+ AGENTS | Sources: T6-012, V2 (re-proof); T6-013
* In plain words: import checks only the SQLite file signature. An archive from another version, or a damaged one, is swapped over the live database; if broken the program cannot even log in and there is no automatic way back.
* Where: `modules/backup/backup.service.ts` importBackup / restoreBackup.
* Repro: `tests/T6/15-restore-incompatible.mjs` (schema lacking `sales.cancel_reason` -> restore 201 then `/sales` 500 P2022), `15b-restore-fake.mjs` (5,016-byte fake -> import 201, restore 500, every endpoint 500 including login). V2 `tests/V2/03-restore-fake-db.mjs` (`.bak` 802,816 bytes is the only way back).
* Impact: outage needing shell access. Positives (T6-013): good same-version restore exact; 7 backups under load all integrity ok; hard kill consistent; traversal archives rejected.
* Root cause: bytes copied over the live file before verification.
* Fix: verify candidate (integrity_check + migration version), atomic swap via temp file, auto swap-back, maintenance mode, admin-only with audit.

### QA-004 - Backup files overwrite each other; retention can delete the newest backup; backups unencrypted, plaintext .bak left behind
* Severity: High | Status: VERIFIED-BY-2+ AGENTS (overwrite/retention); SUSPECTED (residuals by code) | Sources: T6-011, V2 (re-proof), T6-013, G-016; matrix R8-13, R8-28
* In plain words: backup names have one-second resolution, so two backups in the same second share a file; the earlier is still listed as successful but no longer exists, and retention may later delete the file the newer run depends on. Backups and the `.bak` left after each restore are plain files; the PRD asked for encrypted off-site backups.
* Where: `modules/backup/utils/paths.ts generateBackupFilename`; `backup.service.ts runBackup` / `applyRetention`.
* Repro: `tests/T6/13-retention.mjs`, `13b-retention-after.mjs` (both runs `backup_manual_20261125_132421.tar.gz`; after aging run 1 retention deleted it and `POST /system/backups/2/restore` -> 404); V2 `tests/V2/06-backup-overwrite.mjs` (checksums 5dccf6... vs f80b84... on one file name).
* Impact: a "successful" restore point may not exist; plaintext copies of all data accumulate (7 `.bak` in T6).
* Fix: unique file names, verify checksum before restore, retention only deletes unreferenced files, delete `.bak` after verified restore, encrypt and offer off-site copy.

### QA-005 - Hard-coded fallback for the login signing secret
* Severity: High (T5-003 rated Critical conditional) | Status: VERIFIED-BY-1 (T5 executed; V2 only corroborated config/code) | Sources: ORCH-003, T5-003, V2, K3-025
* In plain words: if `JWT_SECRET` is not set the program uses the public phrase `default-secret-change-me`, letting anyone forge an admin token.
* Where: `auth/auth.module.ts:17`, `auth/strategies/jwt.strategy.ts:16`.
* Repro: `tests/T5/forge-default-proof.mjs` (server with the default secret: forged `{sub:1}` token -> `/users/me` 200 as admin). With the real `.env` present (loaded by absolute path, `app.module.ts:47`) forgery is rejected (401); V2 could not execute the no-`.env` boot without deleting the team's `.env`.
* Impact: latent but real: a redeploy that skips `cp .env.example .env` boots on a public key silently.
* Fix: remove fallbacks; fail fast (same change as QA-001).

### QA-006 - Login lifecycle weaknesses: tokens survive logout/password change, refresh replayable, no lockout, weak passwords, IP not recorded
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: T5-005, T5-006, T5-007, V2 (re-proof), K4-010 (server half), G-015; matrix R8-05, R8-27, I-50
* In plain words: after logout or password change the old access token keeps working up to 15 minutes; one refresh token can be used repeatedly for 7 days; ten wrong passwords never lock the account; passwords like `password` and `12345678` are accepted; every audit row records `localhost` as address.
* Where: `auth/auth.service.ts`, `jwt.strategy` (never checks `currentSessionToken`), `auth/dto/auth.dto.ts`.
* Repro: `tests/T5/deep-checks.mjs`, `input-attacks.mjs`; V2 `01-auth-security.mjs` (logout -> old token 200; refresh twice -> 200,200; 10 wrong then correct -> 200). T7/G also saw weak passwords and no lockout after 7 failures.
* Impact: stolen tokens survive resets; internet-exposed admin login can be guessed; forensics blind.
* History: `auth_assessment.md` claims closed but its goals are unmet; `Apis_issues/group1-auth-audit.md` was optimistic. Deactivation IS enforced (T5-011 secure).
* Fix: per-user token version checked each request; refresh rotation with reuse detection; throttling/lockout; stronger policy; real IP.

### QA-007 - Authorization lives in the UI, not the API (accountant sees cost/profit/supplier prices; page revocation ineffective)
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: K1-001, K1-011, K4-009, T5-004, T7-011, T7-023, T7-024, V1 (accountant reads); related K3-015, K3-024
* In plain words: only the owner should see costs, margins and supplier prices. Screens hide the pages but the server returns the data to any accountant token. Revoking "POS" for a user does nothing (the screen matches by prefix and the server never page-checks sale creation). The accountant's menu does not match what is allowed, shows a Void button, and the role may post manual journals and credit notes.
* Where: `reports/reports.controller.ts`, `sales/sales.controller.ts` (responses carry `totalCost/totalProfit`), `purchases.controller.ts:48`, `accounting.controller.ts`; frontend `hooks/useRole.ts` (prefix) vs `common/guards/page-access.guard.ts` (exact).
* Repro: `tests/T5/deep-checks.mjs` section B (profit-loss netProfit 20000, stock-vs-gl, `/purchases/1`, `/sales/1` totalCost); V1 `tests/V1/11-acc-reports.mjs` (also `/items/3` averageCost 2229, `/inventory/3/lots`, `/tax/vat-report`, trial balance; correct 403 on `/expenses`, `/suppliers`, `/purchases`, `/users`, `/settings`); `tests/T7/acc.mjs` (page revoked, `POST /sales` still 201 SAL-...0527; sale card "cost 20.00 / profit -20.00").
* Impact: staff see owner-only margins; controls the owner believes active are not.
* History: DYNAMIC_PAGE_ACCESS_PLAN "backend stays role-based"; F-18 fixed only items/adjustments.
* Fix: permission checks in API, strip cost/profit for non-privileged roles, shared exact-match path rule.

### QA-008 - Discount cap, price override and approval controls not enforced
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: T3-008, T7-008, T7-024, V1 (API half), G-005, G-012; matrix I-45, R8-08, R8-12
* In plain words: rule is cashier discount max 5%, no price override. Only the percent field is capped; shekel discounts (what POS sends), line discounts and a changed price per kilo pass, and POS accepts 100% discount. "Approve" on an expense only sets a flag after the expense is already booked.
* Where: `sales/sales.service.ts:258-268` (cap hard-coded `isAdmin ? 10000 : 500`), :331; `expenses.service.ts:156-167`; POS.tsx:325-326.
* Repro: `tests/T3/boundaries.mjs` (accountant: header discount 2000 on 4000 -> 201; line 3900 on 4000 -> 201 profit -1900; `pricePerKg 1`, 10 kg -> total 0.10 profit -199.90; `discountPct 600` -> 403); V1 `tests/V1/10-*.mjs` (95% line, price 1 -> profit -4398); T7 SAL-...0016 / ...0526 total 0; G `06-settings-audit.mjs` (self-approve twice -> 201).
* Impact: untraceable give-aways; owner thinks the cap setting works (QA-065).
* Fix: cap effective discount per role, price >= list for non-admin, real approve-then-post or remove.

### QA-009 - Sole admin can demote himself; setup can be re-opened and admin reset anonymously; settings API unvalidated
* Severity: High | Status: VERIFIED-BY-1 (G executed each hop; combined chain not fired) | Sources: G-001, G-002, G-003, G-004; matrix I-48, I-49
* In plain words: the "at least one admin" rule exists only on delete, so changing your own role to accountant locks the owner out with no way back. A failed role change can leave a user with no role who can still log in. The "setup once" guard is one editable setting; when false, an unauthenticated setup call overwrites the existing admin's password. The settings endpoint accepts any key and value, and malformed bodies give 500.
* Where: `users/users.service.ts:198-285` and :320-336; `auth/auth.service.ts:462-545`; `settings/settings.service.ts:47-110`.
* Repro: `tests/G/01b-lastadmin.mjs`, `02-users.mjs`, `07-setup-reopen.mjs` (admin123 -> 401, new password -> 200), `06-settings-audit.mjs`, `11-badsettings-impact.mjs`.
* Impact: with QA-002/QA-003 (import a baseline DB, setup flag false) an anonymous takeover chain exists; recovery needs DB editing.
* Fix: enforce >=1 admin on every path in a transaction; setup only when user count is 0; make `setup_completed` read-only; per-key validators.

### QA-010 - Inactive records cannot be listed or re-enabled
* Severity: Medium | Status: VERIFIED-BY-1 | Sources: G-006, G-007
* In plain words: asking for inactive customers/items/users returns the active ones (the text "false" is read as true), so soft-deleted records are unreachable; the Users page enable/disable button sends a field the API rejects, and nothing can reactivate a user.
* Where: `@Type(() => Boolean)` in `items/dto/item.dto.ts:85-105`, customers, users; `users/dto/user.dto.ts`; `pages/Users.tsx:81-86`.
* Repro: `tests/G/13-boolfilter.mjs`, `14-boolfilter2.mjs`, `02-users.mjs` (`PUT /users/5 {"isActive":true}` -> 400).
* Fix: explicit boolean parsing; activation endpoint with the last-admin rule.

### QA-011 - Audit trail covers only a few actions
* Severity: Medium | Status: VERIFIED-BY-2+ AGENTS | Sources: T5-008, G-008; matrix I-51, R8-14
* In plain words: only logins, sale voids, adjustments, write-offs, payment cancels, chart edits and setup are logged. User management, backups, settings, page access, tax, purchases (even the edit/delete that hard-deletes journals), expenses, manual journals, credit notes, wastage and transfers leave no trace.
* Repro: T5 session then `audit_logs` query (only login/logout/update rows); `tests/G/06-settings-audit.mjs` (about 30 mutations -> 6 rows).
* Fix: central interceptor with before/after and real IP; append-only storage.

### QA-012 - Platform hardening: public API docs, leaked internals, vulnerable dependencies, 500 on bad input
* Severity: Medium | Status: VERIFIED-BY-2+ AGENTS | Sources: T5-010, T5-012, T5-013, ORCH-006, T1-010, T6-009
* In plain words: full API documentation (187 endpoints incl. restore) is public; some errors echo raw DB text and the server path; numbers above 32-bit, oversize bodies and impossible dates are mishandled (2026-02-30 stored as 2026-03-02); dependencies have known vulnerabilities, some reachable (tar, multer, body-parser, path-to-regexp, proxy-addr, pdfmake).
* Repro: `GET /api/docs` and `/api/docs-json` -> 200 unauthenticated; `tests/T5/npm-audit.json` (backend 57 vulns, 4 critical, 32 high; ORCH-006 frontend 31, 2 critical, 20 high); `tests/T1/02-manual-je.mjs` (9e15 -> 500 P2023; bad date -> 400 with `E:\DEV\Chicken FMS\app\backend\dist\...` path); `tests/T6/07-boundaries.mjs` (price 2147483647 -> 500; 200,000-char note -> 500).
* Note: CORS allowlist is strict (only tauri://localhost and localhost:1420/5173), so remote owner access works only from the desktop app (T5-012) - not a defect.
* Fix: gate Swagger, clean 4xx mapping, range validation, upgrade runtime packages.

### QA-013 - Tokens and passwords exposed on the client; script injection through the POS receipt
* Severity: High | Status: VERIFIED-BY-1 (T7 executed; K4/T5 by code) | Sources: K4-005, K4-010, T7-006
* In plain words: POS "print" writes customer and item names into HTML unescaped; a customer named with an HTML tag runs code in the app and reads the login token. Every request body (including the login password) is console-logged, tokens sit in localStorage, the desktop shell has no content-security policy.
* Where: `pages/POS.tsx:272-322`, `lib/axios.ts:6,42,57,61`, `hooks/use-auth.ts:19-25`, `lib/auth.ts:3-52`, `src-tauri/tauri.conf.json` (CSP null).
* Repro: `tests/T7/pos2.mjs` section K4-005 (onerror handler read the JWT; `shots/pos2-print-xss.png`). Any role can create customers.
* Fix: escape/textContent; print from saved sale; CSP; remove logging.

## 1B. Sales, receipts, receivables and tax posting

### QA-014 - Voiding a sale after a separate payment refunds the money twice (cash short, AR phantom)
* Severity: Critical | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-001, T3-006, K1-012 (spec gap: cancel does not reverse received cash), T1 (xval K3-001), V1 (K3-001, T3-006)
* In plain words: if a credit invoice was partly paid later and is then voided, the system reverses the payment and also refunds the same amount again from the cash drawer. Cash is understated and receivables overstated by the payment amount; books still balance so nobody notices. Variant: payment taken by bank, refund taken from cash.
* Where: `sales/sales.service.ts:711-855` (voidSale), `payments/payments.service.ts:123-229`, `accounting/accounting.service.ts:553-660`.
* Repro: `tests/K3/posting-probe.mjs` (credit 10000, pay 4000, void -> cash -4000, AR +4000); T3 `tests/T3/xval.mjs`, `lifecycle.mjs` D (POS 3000 + later 2000, void -> cash -7000 vs -5000 expected); T1 `tests/T1/05-reversals-crossval.mjs` (100, pay 40 -> -40.00/+40.00); V1 `tests/V1/01-sales-void-pay.mjs`.
* Impact: each such void leaves a phantom receivable; customer subledger shows 0 so only the GL carries it.
* Root cause: void JE credits cash for `sale.amountPaid` (already including the later payment) while payment JEs are also reversed; void JE is not a mirror of the sale JE.
* History: D-19 (reversal model); `reverseByVoucher` uses findFirst (K1-004, matrix C-31).
* Fix: refund once - build the void from the original posting plus individually reversed payments.

### QA-015 - `POST /sales/:id/payments` records a payment with no journal entry, so it cannot be cancelled
* Severity: Critical | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-002, T3 (xval), T1 (xval), T6-004(c), V1
* In plain words: this endpoint marks the invoice paid and lowers the customer balance but never touches cash or receivables in the ledger; cancelling it fails with JOURNAL_ENTRY_NOT_FOUND. The same is true for payments created inside a POS sale. It also accepts bank receipts incorrectly (DTO rejects bank id).
* Where: `sales/sales.service.ts:861-957`; route without RolesGuard (accountant can call).
* Repro: `tests/K3/posting-probe.mjs` (3000 -> 201, JE 0, GL delta empty); `tests/V1/01b` S3; cancel -> 404.
* Impact: cash and AR in the GL silently disagree with invoices; under concurrency it also loses `amountPaid` updates (QA-050).
* Fix: one payment-posting service; route this endpoint through PaymentsService or remove it.

### QA-016 - Mixed-tender sale posts the whole paid amount to the first tender's account
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-003, T3 (xval), T1 (05b), V1
* In plain words: a sale paid 5000 cash plus 5000 by bank puts all 10000 into cash (or all into bank if bank is listed first). Payment rows are right, the ledger is wrong; refund on void also comes from cash only.
* Where: `sales/sales.service.ts:447-449, 631-652`; `accounting/accounting.service.ts:469-478`.
* Repro: `tests/K3/posting-probe.mjs`; `tests/T3/xval.mjs`; `tests/T1/05b-mixed.mjs` (30 cash + 70 card -> 1111 +100.00); V1 `tests/V1` S4. Single-tender bank sales are correct (F-13 verified good).
* Impact: cash count and bank reconciliation impossible for split payments; unchanged with engines ON (T1-019).
* Fix: post one line per tender account.

### QA-017 - Expenses paid by bank transfer or card are taken from the cash drawer
* Severity: Critical (cash wrong in ordinary operation; T8: -12,550 after 3 bills) | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-011, T1-005 (part), T4-006, T8-001, V1; F-15 context
* In plain words: the expense posts "credit cash" whatever the payment method, though the balance check looks at the bank. Cash drawer is short and the bank overstated by every bank-paid bill; GL cash went negative on 9 of 30 simulated days while the real drawer never fell below 5,013.
* Where: `accounting/accounting.service.ts:1031-1082` (legacy lines hard-code 1111); `expenses/expenses.service.ts:82-90`.
* Repro: `tests/K3/posting-probe*.mjs`; `tests/T4/03-expenses.mjs` E2 (200.00 bank -> Cr 1111); `tests/T8/sim.mjs` (rent 6,000 + electricity 2,350 + salary 4,200: drawer truth 8,520.25 vs GL -4,029.75; bank 98,716.10 vs 111,266.10); V1 `tests/V1/03-expense.mjs`.
* History: F-15 (eebdc44) claimed fixed - regressed/ineffective on the legacy path; only the GL-engine path credits the bank (T1-019, T4-018). Not intentional (D-15).
* Fix: route credit by payment method and bank account, as sales and purchases do; add a cash-count report.

### QA-018 - Expense posting defects: all categories and discounts go to 5400; expense edit/delete leaves the journal untouched
* Severity: Medium (edit/delete part High per T4-005) | Status: VERIFIED-BY-2+ AGENTS | Sources: T1-005, T4-006 (part), T8-004 (part), K3-025, K3-012, T4-005, T6-014 (late-failure confirmation), V1
* Also (K3-012/T4-005, executed by K3, T1, T4, T6): editing an expense amount or deleting it does not touch its journal or debt - PUT 999.00 leaves JE 100.00; DELETE leaves an orphan JE and the credit-expense debt and supplier balance; operational reports show 775.00 while GL 5400 is 376.00; expenseDate edits are ignored.
* In plain words: rent, electricity, salaries, maintenance, sales discounts and credit notes all land on one line, so the income statement cannot show what each cost; seeded categories point to group accounts; "personal" expenses reduce profit instead of being drawings (3300); expense tax is dropped.
* Where: `accounting/accounting.service.ts` (`ACCOUNT_CODES.OPERATING_EXPENSES` and `DISCOUNTS_GIVEN` both 5400); seeded `expense_categories.account_code` unused.
* Repro: `tests/T1/01-clean-slate.mjs`; `tests/T4/03-expenses.mjs`; T8 month (GL 5400 = 15,349.00 lumps everything); V1 (category 1 -> 5400).
* Fix: post to the category's leaf account, discounts to 4900, drawings to 3300.

### QA-019 - Purchase tax missing from the ledger; payables disagree four ways; supplier balance never decreases
* Severity: Critical | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-004, K3-007, T4-001, T4-020, T8-008 (#5), T1 (xval), V1
* In plain words: the purchase journal uses lines only while debt/ledger use total with tax, so AP in the GL is short by every tax amount (VAT receivable 1125 never debited) and a fully-settled taxed purchase leaves a phantom DEBIT on payables. A taxed purchase paid in full at creation cannot be saved (UNBALANCED_ENTRY). Supplier screens show a balance that only ever grows: T8 month shows 35,947.33 versus 5,358.82 actually owed (6.7 times); T4: GL 34,000 / debts 43,000 / PLE 43,000 / supplier balance 66,000.
* Where: `purchases/purchases.service.ts:344-347, 482-545`; `payments/payments.service.ts:315-327, 599-626`; `accounting/accounting.service.ts:666-746`.
* Repro: `tests/T4/01-purchase-xval.mjs` (FINAL table), `tests/K3/posting-probe.mjs`, `tests/T1/05-reversals-crossval.mjs`, V1 `tests/V1/04-ap.mjs`, `tests/T8/sim.mjs`.
* History: F-08 fixed the customer side only; D-22 accepted Debt/PLE divergence but here GL and balance diverge.
* Fix: post tax to 1125 and AP on grand total; update supplier balance on payment/cancel; add AP-control reconciliation.

### QA-020 - Credit notes only adjust the ledger: invoice, debt and balance unchanged, customer can still pay in full
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-022, T3-003, T3-005, T1-016, T4-015, T3-012 (CN part), T8-003 (part)
* In plain words: a credit note posts to "Other Expenses" and AR, not revenue/VAT/inventory; it does not change the sale, debt or customer balance, return stock or reduce what can be collected. The customer can then be charged the full invoice (overcollection 4000 in T3); purchase credit notes are booked as other income and the supplier can still be paid in full. Voiding a sale with a credit note leaves AR -40.00 and a phantom expense. Two concurrent submits exceed the invoice.
* Where: `accounting/credit-note/credit-note.service.ts:61-157`; `accounting/accounting.service.ts:403-417, 905-978`; `payments/payments.service.ts:136-148, 253-266`.
* Repro: `tests/T3/xval.mjs`, `lifecycle.mjs` A,B,E; `tests/T1/05-reversals-crossval.mjs` VOID-cn; `tests/T4/05-purchase-lifecycle.mjs` PR1-PR5; T8 month (25 credit note not in balances).
* History: D-24; K3-022 was SUSPECTED until T3 executed it. No return-of-goods feature exists (matrix I-43, R8-04).
* Fix: post against revenue/VAT/inventory, update sale/debt/balance in one transaction, validate outstanding inside it, block void while credit notes exist.

### QA-021 - Debt write-off posts nothing to the ledger; payables write-off leaves supplier untouched
* Severity: High | Status: INTENTIONAL-BUT-RISKY (D-16) and VERIFIED-BY-2+ AGENTS | Sources: K2-001, K3-014, T1 (xval), T3-004, T4-011, T8-003, K1-005; D-16, D-22, F-07
* In plain words: forgiving a debt only flips its status and lowers the customer balance. GL receivables, the customer statement and reconciliation still show the amount, no bad-debt expense is recognised, and a payable write-off changes nothing on the supplier. T1: AR GL 150 / customers 70 / debts 70 / PLE 80. T8: statement still bills the forgiven 48.56.
* Where: `debts/debts.service.ts:288-336`.
* Repro: `tests/K3/posting-probe.mjs`, `tests/T1/05-reversals-crossval.mjs`, `tests/T3/lifecycle.mjs`, `tests/T4/03-expenses.mjs` E4d, T8 sim.
* History: D-16 chose exclusion from totals; F-07 fixed /debts totals only. Fix: post write-off JE and PLE adjustment, handle payables symmetrically.

### QA-022 - Closed documents still accept payments; void and write-off each decrement the customer balance
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-013, T3-004, T3 (xval)
* In plain words: a payment on a voided sale is accepted (cash +1000, AR -1000) and resurrects the written-off debt as partial; a payment after write-off does the same. Write-off then void lowers the balance twice (-10000 for a 10000 sale).
* Where: `payments/payments.service.ts:123-148`, `sales/sales.service.ts:861`, `debts/debts.service.ts:288-336`.
* Repro: `tests/K3/posting-probe.mjs`; `tests/T3/xval.mjs`, `lifecycle.mjs` C.
* Fix: refuse payments on voided/written-off documents; void must not decrement an already written-off debt.

### QA-023 - Allocating an advance or reconciliation changes only the ledger; invoice stays unpaid and can be collected again
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-023, T3-007, T4-016
* In plain words: applying a customer advance (or supplier advance) to an invoice does not update the invoice, debt or balance, so the invoice is collected again (12500 collected on a 10000 invoice). The reconciliation screen's supplier open-invoice list is always empty because purchases stay docstatus 0.
* Where: `accounting/reconciliation/allocation.service.ts:31-196`; `reconciliation.service.ts:81-83`.
* Repro: `tests/T3/lifecycle.mjs` A6-A8; `tests/T4/07-rounding-supplier-views.mjs`.
* Fix: allocation updates sale/purchase/debt/balance or payments validate against ledger outstanding; set purchase docstatus.

### QA-024 - Several parallel sources of truth for receivables; dashboard counts voided and written-off debts
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: D-22, D-23, T3 (end-of-xval snapshot), T8-003, T4-011, G-011, K4-011; related QA-020/021/023
* In plain words: "what do customers owe me" has four answers (T8: GL/statements 1,806.47; balances/debts 1,782.91; dashboard 1,947.98; truth 1,757.91). The dashboard counts any non-paid debt, including debts of voided (returned) sales (void marks them written_off, +116.51) and written-off ones; payables dashboard 1,160.00 vs 860.00.
* Where: `reports/reports.service.ts:40-48`; `sales/sales.service.ts` voidSale; debts, PLE, customer balance tables.
* Repro: `tests/T8/sim.mjs` out-t8/summary.md; `tests/T3/xval.mjs` (Σ customer balance 26,900 / open debts 36,900 / PLE 27,900 / GL 40,001); `tests/T4/03-expenses.mjs`; G `10-reconcile.mjs` (receivables 11,000 vs debts 8,000).
* Not reproduced: T7 found dashboard = Debts page = `/debts/summary` in the default view (K4-011 client-side KPI claim). K4-011 stays SUSPECTED for browser-side filtering by creation date / 500-row cap.
* Fix: one source of truth; void cancels the debt; dashboard from the ledger.

### QA-025 - Customer statement changes its computation depending on whether the period has entries
* Severity: Medium | Status: VERIFIED-BY-2+ AGENTS | Sources: T3-018, T7-020 (supplier part), D-23, F-12
* In plain words: statements use the payment ledger when the period has entries, else a sale+payment fallback that ignores credit notes and write-offs; closing of one period does not equal opening of the next (75.00 vs 105.00). Default-period supplier statements print "no movements" and omit purchases paid at creation.
* Repro: `tests/T3/statement.mjs`; `tests/T7/pdfs.mjs`.
* Fix: opening balance always from the ledger; fallback only for parties with no ledger rows.

### QA-026 - VAT is booked as revenue and counted as profit; VAT report shows 0
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-021, K1-007, K1-008, T3-012, T7 (bulletin), T8-007, V1, T3-013
* In plain words: with the default flags a taxed sale credits revenue with price plus VAT; 2120 VAT payable stays 0; profit = total incl. VAT minus cost; `/tax/vat-report` says output 0 (T8: 13.91 VAT owed shown as 0); voided taxed sales appear as input VAT; by-rate always 1500 bp. Turning only `tax_engine_enabled` on does nothing; with both engines on, revenue and 2120 are right but profit still counts VAT (7100 vs 5600). Tax templates accept negative rates (hidden discount), inactive and purchase templates.
* Where: `sales/sales.service.ts:366-371, 469`; `accounting/accounting.service.ts:274, 490`; `vat-report.service.ts:70-82`.
* Repro: `tests/T3/tax.mjs`, `reports.mjs`; `tests/T8/sim.mjs`; V1 `tests/V1/09-tax-acc.mjs`, `10-engine-acc.mjs`; T7 pos1 (4292 with no 2120 line).
* History: Blueprint 05 "complete" but flag off (D-26); forensic report #6 still open.
* Fix: post tax to 2120 regardless of flag (or block templates), profit ex-VAT, validate templates.

### QA-027 - Printed tax invoice has no VAT line, no tax number and ignores credit notes
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: T3-016, T7-020
* In plain words: invoice PDF reads Subtotal 100.00, Discount 0.00, Total 115.00 with no VAT amount or rate; Subtotal minus Discount is not Total; balance ignores credit notes (prints 65.00 vs real 53.50); no currency label; header is generic.
* Where: `pdf/templates/invoice.template.ts:21-27`; `sales.service.ts:192-195`.
* Repro: `tests/T3/reports.mjs`; `tests/T7/pdfs.mjs` (35.00 / 0.00 / 40.60 / 40.25 / 0.35).
* Fix: add VAT lines, tax number, currency, net credit notes.

### QA-028 - GL/tax engine mode (flag ON) breaks postings: numbering collisions, taxed discounted sales rejected, silent round-off
* Severity: High (mode is OFF by default; T1-018 rated Critical) | Status: VERIFIED-BY-2+ AGENTS | Sources: K2-004, K3-020, T1-018, T1-019, T3-011, T4-018, V2 (T1-018), T2-018; D-26, F-04, R-04
* In plain words: if the owner switches the GL engine on after any purchase edit/delete, every posting returns 409 (sales, purchases, expenses, wastage, voids) and stays blocked. With engines on, a sale with tax and a header discount above 0.50 is rejected (UNBALANCED_ENTRY), small discounts are silently rounded away, purchase tax is still missing, wastage still has no stock-ledger row, and manual journals auto-post (legacy requires /post).
* Where: `accounting/gl-engine/gl-entry.factory.ts:74-77` (count+1); `accounting/accounting.service.ts:274-299`; `gl-validator.service.ts:185-220`.
* Repro: `tests/T1/07-engines-on.mjs`, `tests/T4/06-engines-on.mjs`, `06c-engines-on-fresh.mjs`; `tests/T3/tax.mjs` (t3b); V2 `tests/V2/07-gl-engine-delete.mjs` (409 on sale, purchase, expense, permanent). Engine ON inventory behaviour identical (T2-018). ON variants only partly tested (see coverage).
* History: F-04 fixed the legacy path only (R-04). Fix: shared numbering service, gross-up or drop discount line, test both modes in CI.

## 1C. Posting integrity, numbering and accounting structure

### QA-029 - Count-based document numbers plus hard deletes permanently block purchases, expenses, lots and transfers
* Severity: Critical | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-005, T4-004, T4-012, T6-006, T1 (xval), V2 (T4-012/T4-004), T2-007 (transfer collision), T4-008 (BANK numbering), D-37, R-05
* In plain words: new numbers are "count of rows + 1". After deleting any non-last purchase (or expense) the next number already exists, every later create fails with 409 DUPLICATE_ENTRY forever (count never moves); same-day lot numbers and stock transfers fail too. Two users saving at the same moment get 1 success and 1 failure. V2 refinement: the block clears only when the highest-numbered row is deleted, and the freed number is re-issued for a different document.
* Where: `purchases/purchases.service.ts:1062-1071, 894-923`; `expenses/expenses.service.ts:196-199, 170-173`; stock-transfer, credit-note (CN-), bank (BANK-nnn), PAY- in sales/purchases services.
* Repro: `tests/K3/probe3.mjs`; `tests/T4/05-purchase-lifecycle.mjs` N1-N6, `03-expenses.mjs` E9; `tests/T6/05-parallel-create-numbering.mjs` (N=2: 1 x 201 + 1 x 409 for purchases, expenses, transfers); `tests/T1/03-period-lock.mjs`; V2 `tests/V2/04-numbering-and-boundaries.mjs`.
* Impact: one routine "delete wrong PO" stops purchasing for good; no workaround except SQL.
* History: F-04/F-05/F-06 fixed sale, payment, legacy JE numbering; R-05 listed the rest as still count-based. Not accepted by any decision.
* Fix: sequence table or max+1 inside the transaction with retry; replace hard delete with cancel plus reversal.

### QA-030 - Purchase edit/delete rewrites posted history; paid-at-creation purchases can never be corrected
* Severity: High | Status: INTENTIONAL-BUT-RISKY (D-20) and VERIFIED-BY-2+ AGENTS | Sources: K3-006, T4-002, T4-003, T4-014, T2-013, K2-009, T7-014, K4-013 (edit claim); D-19, D-20, R-03
* In plain words: editing or deleting a purchase hard-deletes its journal entries, stock-ledger rows, lots and debt, reuses the same entry number (JE-000009 for different amounts), leaves no audit row and ignores period locks. Deleting after an adjustment consumed the stock clamps inventory to 0 and orphans the adjustment (item GL -8,000 for goods never bought). Conversely a purchase paid at creation (the commonest) has a payment with no journal entry, so it can never be cancelled, edited or deleted, yet the UI offers the buttons. K4-013 "edit resets paid to 0" NOT REPRODUCED (backend blocks it).
* Where: `purchases/purchases.service.ts:184-319, 546-597`; `payments/payments.service.ts:544`.
* Repro: `tests/T4/01-purchase-xval.mjs` 8, 9; `05-purchase-lifecycle.mjs` U1-U3; `tests/T2/t05-edge.mjs` PD; `tests/T1/03-period-lock.mjs`; `tests/T7/purchase-edit.mjs`.
* History: contradicts D-19 and Blueprint 06 "SLE immutable" (decision-log plan audit); number reuse is not in any decision.
* Fix: reversal instead of delete; never reuse numbers; creation-time payment gets its own JE; block when later movements exist.

### QA-031 - Manual journal entries accept invalid or unbalanced data and cannot be corrected
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: T1-006, T1-007, T1-008, T1-009, K3-019, V2 (T1-006)
* In plain words: fractional amounts pass a float balance check and are truncated on save (1.6+0.4 debit vs 2 credit stored 1/2 and posted, trial balance out by 3 minor units); empty, negative, two-sided and all-zero entries post; entries can hit AR/AP/inventory without a party and overdraw cash (cash -996,979.00); any date (2020, 2030) is accepted, future ones disappear from default reports; reverse/edit/delete routes return 404 (service method exists, unrouted) so a mistake is permanent.
* Where: `accounting/accounting.service.ts:1374-1452, 1471-1503`; DTO lacks `@IsInt`/ArrayMinSize/Min(0).
* Repro: `tests/T1/02-manual-je.mjs` (25-case matrix), `02b-fraction.mjs`; V2 inline (debit 1000.7 stored 1000).
* Note: web form rounds x100, so the UI path is safe; exposure is API/imports.
* Fix: DTO validation, control-account protection, expose reversal.

### QA-032 - Period lock/freeze barely enforced; no API to manage periods; journal dates differ from document dates
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-018, K2-010, T1-011, T1-012, T4-007 (date split); D-19; Blueprint 07 NOT FOUND
* In plain words: the freeze date and closed periods block only void, payment-cancel and credit-note. New sales, purchase create/edit/delete, expenses, wastage, adjustments, manual journals and write-offs proceed in frozen/closed months; a closed period tied to the company row is ignored entirely. Legacy journal entries are dated now, so a back-dated expense or purchase lands in a different month in the GL than in operational reports (EXP-000005 dated 2026-11-02, JE 2026-11-25). No API creates or closes periods.
* Where: `common/guards/period-lock.guard.ts:22-58`; callers only in `sales.service.ts`, `payments.service.ts`, `credit-note.service.ts`, `allocation.service.ts`, `reconciliation.service.ts`.
* Repro: `tests/T1/03-period-lock.mjs` (16-operation matrix, closed period with company NULL and company 1); `tests/T4/04-guard-dates.mjs`, `04b-ledger-asof.mjs`.
* Fix: call the guard centrally in posting, post on the document date, resolve company id, build a period-close feature.

### QA-033 - Balance sheet and trial balance wrong: equity sign, as-of date used as start date
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: T1-001, T1-002, T8 answer sheet, V1 (T1-001, T1-002), T4 bulletin
* In plain words: once owner capital exists the printed balance sheet shows Total Equity -8,300 and Total Equity and Liabilities -7,300 against assets 8,700 (T8 month: -77,482.73). The API trial balance treats `asOfDate` as a start date, so any past as-of date (and every past-dated balance sheet) shows today's balances; PDF and API trial balances disagree.
* Where: `accounting/accounting.service.ts:1871-1874, 2044-2088, 1507, 1829-1831`; `accounting.controller.ts:128-132`.
* Repro: `tests/T1/01-clean-slate.mjs`, `tests/T1/pdf/01-bs.pdf`, `04-dates-yearend.mjs`; V1 `tests/V1/07-reports.mjs`, `08-tb.mjs` (`asOfDate=2027-01-01` gives opening 192500, period 0); T8 `owner-reports-t8.out.txt`.
* History: F-11/D-27 fixed zeros but not this arithmetic. Hidden on the dev seed (equity 0). T7 found balance sheet/income statement/TB PDFs equal DB balances in its (no-capital) data.
* Fix: natural-sign equity totals, `getTrialBalance(undefined, asOfDate)`, A = L + E assertion.

### QA-034 - No year-end close or retained earnings; account ledger ignores opening balance
* Severity: High | Status: VERIFIED-BY-1 | Sources: T1-013, T1-014, K2-010, T1-015 (fiscal-start part)
* In plain words: from the second fiscal year the balance sheet cannot balance (the prior-year profit of 100.00 is in no equity line; Retained earnings 0.00); a 31 Dec expense is counted in the next year because fiscal start resolves to 2025-12-31 in UTC+2. A ledger with a start date begins at zero (closing 1,030.70 vs true 1,115.70), so cash counts cannot be reconciled.
* Where: `accounting/accounting.service.ts:1829-1907, 1584-1677, 2210`.
* Repro: `tests/T1/04-dates-yearend.mjs` (PDFs `04-bs-today.pdf`, `04-led1111-2026.pdf`).
* History: D-27 (net income in equity, no closing entries) - decided for year one only. Fix: closing entries or computed retained earnings; opening row in ledgers.

### QA-035 - "Profit and Loss" page disagrees with the ledger income statement
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: T1-004, T2-009, T8-004, T3-012 (part), T4-005 (part), G-011
* In plain words: the page the owner opens leaves out wastage and stock-count losses, credit notes and write-offs, counts VAT as revenue and takes expenses from the expenses table (so edited/deleted expenses diverge). T8 October: truth 17,455.38; GL 17,517.27; P&L page 18,733.18 (+1,277.80). T1: -275.00 vs -300.00. T3: gross profit overstated by 7,226.
* Where: `reports/reports.service.ts:287-323`.
* Repro: `tests/T1/01-clean-slate.mjs`; `tests/T2/t04-wastage-expiry.mjs` (netProfit 0 -> 0 after 6,000 wastage); `tests/T8/sim.mjs`; `tests/T3/reports.mjs`.
* Fix: build the page from the ledger or show reconciling items.

### QA-036 - Stock-vs-GL reconciliation report is unreliable and cannot detect real drift
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: T1-003, T1-020, T2-004, T8-006 (part)
* In plain words: it compares the stock ledger to the GL only (both written by the same code), ignores lots and the inventory table, excludes the whole as-of day (today = 0/0), double-counts the GL value of multi-line documents (difference -2,993.34 on a clean book), and its branch filter sees only sales. T2 showed 0 difference while 15,000 was off-book; T8 shows an unrelated "difference 650.96".
* Where: `inventory/stock-ledger/stock-reconciliation.service.ts:37-160`; `reports/reports.service.ts:461-466`.
* Repro: `tests/T1/08-branch.mjs`, `01-clean-slate.mjs`; `tests/T2/t02-adjust.mjs`; `tests/T8` out-t8.
* Fix: compare GL with Σlots and Σinventory.total_value per item; end-of-day inclusive; group by voucher.

### QA-037 - Account mapping not validated: bank can point to revenue/AP/cash; accounts reclassifiable with history; some edits silently ignored
* Severity: High | Status: VERIFIED-BY-1 per sub-item (T4-008, T1-017) | Sources: T4-008, T1-017
* In plain words: a bank account can be mapped to any GL account (AP, revenue, cash) so receipts "by bank" reduce revenue or AP; inactive banks still post; remapping or deleting a bank strands its balance; payment rows can claim a bank while the ledger hits cash. An account's type can be changed after postings (5400 turned into Income reclassifies all history); code/rootType edits return 200 but are ignored.
* Where: `bank-accounts/bank-accounts.service.ts:47-184`; `accounting/chart-of-accounts/chart-of-accounts.service.ts:118-165`.
* Repro: `tests/T4/02-bank-cash.mjs`, `02b-bank-wrong-gl.mjs`; `tests/T1/06-coa.mjs`.
* Fix: validate type/parent, forbid remap/delete with balance, lock account type with postings, reject unsupported fields.

### QA-038 - Insufficient-cash guard (D-14) blocks legitimate work and is bypassable
* Severity: High | Status: INTENTIONAL-BUT-RISKY (D-14) and VERIFIED-BY-2+ AGENTS | Sources: T4-007, T8-002, T1-012 (part), R8-20; D-14
* In plain words: the guard checks a polluted cash balance (see QA-017) and the document date: T8 month rejected 5 purchases and 7 expenses (1,145 plus a 4,200 salary never recorded) while the drawer held 5,000-8,000; back-dated documents bypass it and drive cash to -2,200.00, while legitimate back-dated ones are refused. No opening-float or deposit operations exist (QA-048).
* Repro: `tests/T8/sim.mjs` out-t8/errors.md (12 rejections); `tests/T4/04-guard-dates.mjs`.
* Fix: fix QA-017 first; supervised override with reason; check as of document date and all later dates.

### QA-039 - Payment methods are free text; cheque/mobile and card-with-no-bank post to the cash box
* Severity: Medium | Status: INTENTIONAL-BUT-RISKY (D-15) and VERIFIED-BY-2+ AGENTS | Sources: T4-009, K1-006, K2-008, T7-004, K4-020, T3 (xval); matrix C-33
* In plain words: `check` and `mobile_payment` go to the cash box 1111 with no cheque register; the value `"bitcoin"` is accepted; `bank_transfer` with no bank configured silently credits cash; in POS a card sale with no bank account books to cash (cash count 22.00 short), and the dropdown offers "cash box" for card. Sales accept `check` but reject `cheque`/`mobile_payment` (G).
* Repro: `tests/T4/02-bank-cash.mjs` A1-A3; `tests/T7/pos1.mjs` scenario H; `tests/T3/xval.mjs`.
* Fix: enum validation, require bank for bank/card, cheques-in-hand account.

### QA-040 - Negative, zero and fractional amounts accepted across purchases, expenses, payments, advances, adjustments
* Severity: High (T6-008 rated Critical; High because it needs a typo or a malicious authenticated user) | Status: VERIFIED-BY-2+ AGENTS | Sources: T6-008, T4-010, T4-013, T2-002, V2 (T6-008), T1-006 pattern; related T3-009
* In plain words: a purchase of -5000 g creates a negative lot with no journal or debt; a negative price creates negative-cost stock (negative COGS later); a negative expense or advance is "cash in" (+500.00); a negative payment acts as a refund; fractional values are truncated; zero creates empty journals; empty purchases, unknown items (included in payable but not inventory), inactive suppliers, 1,000,000 kg at 99,999.99 (500) are accepted; adjustment increase with unit cost 0 or -1500 changes value with no journal (value 33,167 vs GL 48,167).
* Where: `purchases/dto/purchase.dto.ts`, `expenses/dto/expense.dto.ts`, `payments/dto/payment.dto.ts:7-12`, `inventory/dto/inventory.dto.ts:78-82`; sale DTO is correct (`@IsInt @IsPositive`).
* Repro: `tests/T6/07-boundaries.mjs` (30 cases), `tests/T4/02-bank-cash.mjs` R7/R8, `05-purchase-lifecycle.mjs` V1-V11, `tests/T2/t02-adjust.mjs` C; V2 `04-numbering-and-boundaries.mjs` (3 of 4 sub-cases; adjustment sub-case inconclusive due to V2's own state).
* Fix: `@IsInt() @IsPositive()` on every money/weight field, existence/active checks, reject instead of skipping.

### QA-041 - Sale-level validation gaps and 1-agora residues
* Severity: Medium | Status: VERIFIED-BY-2+ AGENTS | Sources: T3-009, T3-010, T7-003, K1-009, T2-015, K4-020 (part)
* In plain words: empty sale accepted; 100% discount sales; discount above total rejected only as "OVERPAYMENT"; overpay by exactly 1 agora gives cryptic UNBALANCED_ENTRY; credit limit never enforced (credit sale 40,000 vs limit 5,000, also G); inactive customers/items sellable. A walk-in paid 0.01 short books 1 agora AR with no owner that can never be collected; per-line rounding makes 1-agora gaps routine; selling a lot in 78 small pieces leaves 10 agorot residue at zero quantity.
* Repro: `tests/T3/boundaries.mjs`; `tests/T7/pos1.mjs` I (SAL-...0006); `tests/T2/t05-edge.mjs` PR.
* Fix: validate; post sub-agora differences to a round-off account; allocate last slice as lot value minus allocated.

## 1D. Inventory, costing and stock

### QA-042 - Two lines of the same item in one sale oversell the same lot (negative stock)
* Severity: Critical | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-008, T2-011, T1 (xval K3-008)
* In plain words: the stock check runs per line against the pre-sale quantity and the lot decrements happen after the loop, so a cart with 30 kg + 30 kg of an item holding 50 kg is accepted. A scale-label cart scanning the same item twice triggers it. Inventory and the lot go negative (-10000 g / value -24000 in K3; T1: item 103 kg, 60+60 kg sold, inventory -17 kg, oldest lot -50 kg) and COGS is booked from phantom stock.
* Where: `sales/sales.service.ts:302-353`; `inventory/inventory.service.ts:424-476` (`allocateFIFO` uses `this.prisma`, not the transaction).
* Repro: `tests/K3/posting-probe2.mjs`; `tests/T2/t05-edge.mjs` O1/O2 (6+6 kg on 10 kg: lot -2,000 g, inventory -2,000 g / -4,000); `tests/T1/05-reversals-crossval.mjs`.
* Not reproduced: the claimed race between separate concurrent sales (3 x 8 kg on 10 kg -> 201/400/400; T6 10x1 kg and 20x100 g oversold 0 g). See section 2.
* Fix: aggregate lines per item before checking; allocate inside the transaction with decrements between lines.

### QA-043 - Stock adjustments ignore lots and use average cost, so lots, inventory and ledger drift apart
* Severity: Critical | Status: VERIFIED-BY-2+ AGENTS | Sources: K1-002, K3-009, T2-001, T2-002 (cost 0/negative), T1 (xval), T8-006 (part), V1 (T2-001); D-03, D-05, F-02
* In plain words: a count correction only changes the inventory total at weighted-average value; the lots are untouched. Written-off kilos stay "sellable" and are later sold at their old FIFO cost (phantom 5 kg lot worth 150.00 in scenario A), stock added without a unit cost creates no lot so it can never be sold (INSUFFICIENT_STOCK "Short by 5000g" though the screen shows 15 kg), a `lotId` is ignored and one from another item accepted. Drift per scenario: +5 kg/+13,333; -5 kg/-10,000; +7 kg/+14,000; +3 kg/+6,000. T8 month: Σlots +1.35 kg phantom thigh worth 14.99.
* Where: `inventory/inventory.service.ts:227-419, 437-476`; `inventory/dto/inventory.dto.ts:78-82`.
* Repro: `tests/T2/t02-adjust.mjs` A-E; `tests/K3/posting-probe.mjs`; `tests/T1/01-clean-slate.mjs`; V1 `tests/V1/05-adjust-transfer.mjs` (exact numbers: A end inventory 0 g/1667, lots 5 kg/15000; D COGS 10000 not 12500); `tests/T8/sim.mjs`.
* History: F-02 (75b3211, average after adjustment) CONFIRMED FIXED (T2 t07-f02: avg 2500, lot 3000), but D-03's mixed average/FIFO design still produces drift. Commit 75b3211 fixed one unit bug only.
* Fix: lot-aware adjustments (decrease FIFO or selected lot at lot cost; increase always creates a lot with required positive cost); invariant check Σlots = inventory.

### QA-044 - Stock transfer (cutting) creates or destroys inventory value with no journal entry
* Severity: Critical | Status: VERIFIED-BY-2+ AGENTS | Sources: K1-003, K2-005, K3-016, T2-005, T8-005, V1 (T2-005); D-04, D-25, R-10
* In plain words: cutting whole chickens into parts is the shop's daily core process. Destination cost is a free per-line number (UI default = the product's reference price), source is reduced at lot cost, and no journal is posted. T2: 9 kg of a 10 kg raw lot at 18.00 became +5,600 of stock value; to 0 cost -5,600; same-item revaluation +21,597; 26,994 unbooked by script end. T8: with UI-default costs profit over 9 days was 387.93 vs correct 2,848.95 (-86%) and GL inventory lags 3,613.21 after 10 days (about 361 per cutting).
* Where: `stock-transfer/stock-transfer.service.ts:133-360`; frontend `StockTransferProfile.tsx:63`.
* Repro: `tests/T2/t03-transfer.mjs`; `tests/T8/sim.mjs --days=10 --name=t8b --transfer-cost=ui-default`; V1 `tests/V1/05-adjust-transfer.mjs` (+5600, status `completed`, cost 0 and 99.99 accepted).
* History: D-04 violated (defaultPurchasePrice must not enter valuation); D-25 deliberate per-line cost; STOCK_TRANSFER_FIX_PLAN 6.2 (carry source cost) not done. K2-005 "status stays draft" NOT REPRODUCED (status `completed`).
* Fix: server-computed destination cost from consumed source cost (weight or value weighting), post Dr destination stock / Cr source stock, reject same-item.

### QA-045 - Cutting has no yield/loss concept; batch date and expiry not preserved
* Severity: High | Status: VERIFIED-BY-1 | Sources: T2-006, T8-005 (part), T8-008 (#4); matrix C-17, C-18
* In plain words: 10 kg raw -> 9 kg cuts leaves 1 kg (value 1,800) in the raw lot that no longer exists; modelling the loss needs a manual wastage (double count 5,400). Cut products with no source expiry expire at now+7 days though the category shelf life is 2 days; destination lots get `receivedAt = now`, moving cut stock behind later purchases in FIFO. T8 needed 30 extra wastage documents a month.
* Where: `stock-transfer/stock-transfer.service.ts:147, 165-167, 212`.
* Repro: `tests/T2/t03-transfer.mjs` T1/T2.
* Fix: consume whole input with a loss line, expiry = min(source, shelf life), keep batch date.

### QA-046 - Wastage: no stock-ledger row, cannot be corrected, can create phantom stock, reachable by any user
* Severity: Medium | Status: VERIFIED-BY-2+ AGENTS | Sources: K3-015, T2-008, T8-006, T1-019 (part), K4-009 (wastage guard), K4-018
* In plain words: wastage books the journal and lot change but no stock-ledger entry (T8: ledger +105.5 kg / 1,179 across 44 records); no delete/cancel/approve route (404); a lot written off by adjustment can be wasted again (-5,000 g, loss expensed twice); fractional grams rounded; accountant may post it despite UI treating it as admin-only; detail dialog shows raw minor units labelled "(فلس)" and internal ids.
* Repro: `tests/T2/t04-wastage-expiry.mjs`; `tests/K3/posting-probe.mjs`; `tests/T7/stock.mjs`.
* Fix: write a stock-ledger row, add cancel with reversal, check item-level stock, guard the route.

### QA-047 - Expired lots are sold and transferred; alerts and due dates are missing
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: T2-010, G-009, G-010, T8-008 (#7); matrix I-22, R8-01, R8-02, C-20
* In plain words: FIFO sells a lot that expired on 2026-11-01 first (sale 3 kg entirely from it); expired lots can be turned into new products. Only pull lists exist (low-stock, expiring, overdue); no notification job, no "move to wastage" action. POS credit sales get no due date, so the overdue list is empty for them; AR aging exists in code but has no route.
* Repro: `tests/T2/t04-wastage-expiry.mjs` E1; `tests/G/04-scenario.mjs` section D, `10-reconcile.mjs`, `18-misc2.mjs`.
* Fix: block or warn with admin override, default credit terms, dashboard counts, expose aging.

### QA-048 - No opening balances or cash operations; opening stock has no journal
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: T2-012, T8-008 (#1-3, #5-6), K3-017 (missing feature), K1 requirements; matrix R8-11, R8-23, R8-24
* In plain words: there is no way to enter opening cash, bank, capital, stock, receivables or payables except a manual journal; stock entered at item creation has no journal/ledger (selling it drives GL inventory to -40,000 for that item); no cash-to-bank deposit, drawing, bank-to-bank transfer, day-end/Z report or cash count; credit expenses can never be paid (route 404).
* Repro: `tests/T2/t05-edge.mjs` OP; `tests/T8/sim.mjs`; G `04-scenario.mjs` (`/reports/z-report` 404).
* Fix: provide these operations before go-live.

### QA-049 - Inactive items sellable and invisible in lists; per-branch inventory not implemented
* Severity: Medium | Status: VERIFIED-BY-1 | Sources: T2-007, T2-014, T2-016
* In plain words: soft-deleted items still receive transfers and sell, while the inventory list hides their stock but valuation keeps it; purchases cannot carry a branch, all new lots/inventory have branch NULL, branch filters are ignored, a second branch is cosmetic; deleting a category with stocked items hides the category while items stay active (D-06/D-07 behaviour).
* Repro: `tests/T2/t03-transfer.mjs` T6; `t05-edge.mjs` BR, CAT; `t05b-branch.mjs`.
* Fix: active checks on documents; decide branch scope.

## 1E. Concurrency, robustness and dates

### QA-050 - Concurrent voids, payments and credit notes all succeed (checks happen outside the transaction)
* Severity: Critical | Status: VERIFIED-BY-2+ AGENTS | Sources: T3-001, T3-002, T6-003, T6-004, V1 (T3-001/T6-003, T3-002, T6-004c), K3-025
* In plain words: a double-click or retry reverses a sale several times (T6: 5 parallel voids -> 5 x 200, stock +10000 g instead of +2000, AR -280.00, customer shows a 224.00 credit never owed; V1: 4 parallel -> balance -30000), accepts overpayments (5 x 40.00 on a 56.00 invoice -> 200.00 collected, status "partial") and credit notes above the invoice (6000+6000 on 10000). Via `/sales/:id/payments` the stored `amountPaid` is overwritten (40.00 while debt says 200.00).
* Where: `sales/sales.service.ts:682-735`; `payments/payments.service.ts:123-148`; `credit-note.service.ts`.
* Repro: `tests/T3/lifecycle.mjs` F,G,E; `tests/T6/04-void-pay-races.mjs`; V1 `tests/V1/06-concurrency.mjs`.
* Fix: re-check inside the transaction with conditional update (`updateMany where isVoided=false`), increments, unique reversal key.

### QA-051 - Lost updates: stock adjustments overwrite concurrent sales' decrements
* Severity: Critical | Status: VERIFIED-BY-2+ AGENTS | Sources: T6-002, V1 (T6-002)
* In plain words: adjustment reads inventory before its transaction and writes absolute values. Five parallel decreases of 1000 g -> 5 journals but inventory changes once (50000 -> 49000); with sales in parallel 4000 g drift appears and sold kilograms are "restored". V1: 4 parallel -> inventory 102000 -> 101000, GL -8408.
* Where: `inventory/inventory.service.ts:227-262, 313-327`.
* Repro: `tests/T6/03-adjustment-lost-update.mjs`; `tests/V1/06-concurrency.mjs`.
* Fix: read inside the transaction, use increment/decrement, per-item lock, idempotency key.

### QA-052 - Burst of concurrent sales causes 500 errors after a 6-second freeze
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: T6-001, V2 (T6-001)
* In plain words: up to 15 parallel sales are fine (all 201); at 20 -> 8 x 201 + 12 x 500; 30 -> 13/17. SQLite rollback-journal locking plus a read on a second connection inside the sale transaction stalls until the 5 s timeout; clients get generic 500. Rollback is clean (no half sales).
* Where: `sales/sales.service.ts:283-660`, `inventory.service.ts:423-476`, `prisma/prisma.service.ts` (no WAL/busy_timeout).
* Repro: `tests/T6/02-concurrency-threshold.mjs` (+`01b`); V2 `tests/V2/08-burst-concurrency.mjs` (9/20 -> 500, wall 5,980 ms). Three tills do not normally reach the threshold; reconnect storms do.
* Fix: all reads via tx, WAL + busy_timeout, retryable 503.

### QA-053 - No idempotency: double-click, retry or aborted request creates duplicate sales ("ghost sales")
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: T6-005, T6-007, T7-005, K4-006, V2 (T6-005)
* In plain words: submitting the same sale twice (with identical Idempotency-Key headers) gives two or three complete sales; a client abort after 5 ms still commits; 10 sales aborted at 30 ms were all committed while the client saw 1 success. In the browser, a double-click/double-Enter on "Complete sale" created 2-3 sales 23-33 ms apart.
* Where: `sales/sales.controller.ts:72`; `common/guards/prevent-double-submit.guard.ts` (never used); POS.tsx:347-352, 932-936.
* Repro: `tests/T6/04-void-pay-races.mjs` d, `06-client-abort.mjs`; `tests/T7/pos2.mjs`; V2 `tests/V2/04b-duplicate-sale.mjs`.
* Fix: client-generated key with unique index; synchronous lock in UI; "recover pending sale" flow.

### QA-054 - Date handling: reports shift a day in the shop's timezone and end dates are excluded
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: K4-007, T7-017, T6-010, T3-017, T1-015, T1-003 (part), V2 (T6-010), T7-020 (part); D-28
* In plain words: the front end converts local dates through UTC, so "this month" runs 2026-10-31..2026-11-29 and "this year" starts 31 Dec (verified in Asia/Jerusalem with a fake clock). The backend buckets by UTC day, so activity between 00:00 and 02:00/03:00 lands on the previous day/month; the sales list and sales/VAT report PDFs treat the end date as exclusive (a same-day report is empty, "today" PDF shows 0.00 while the screen shows 524 sales); expenses list ignores date filters; dashboard "today" uses server-local time. V2 broadened: `GET /sales?startDate=X&endDate=X` returns 0 whenever start equals end.
* Where: `pages/Reports.tsx:63-71`, `PdfPreviewDialog.tsx:57-66`, statements; `reports/reports.service.ts:75-76,127-128,207-208,249-250,288`; `accounting.service.ts:181,1508-1512,1600,1903`; `sales/sales.service.ts:51-52,212-213`.
* Repro: `tests/K4/tz-date-range.mjs`; `tests/T7/reports.mjs`; `tests/T6/09-dates-tz.mjs`; `tests/T3/reports.mjs`; V2 `tests/V2/05-date-boundary.mjs`.
* Fix: one business-timezone helper (setting `app.timezone`), inclusive local-day bounds in JSON and PDF.

## 1F. User interface and POS

### QA-055 - POS tax estimate hard-coded at 15% regardless of the selected template
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: K4-001, T3-014, T7-002, forensic audit #4/#5
* In plain words: POS computes tax as 15% for any template and sends the cashier-visible total as payment. With a 16% template a walk-in sale fails with CUSTOMER_REQUIRED, or with a customer a silent 0.35 debt is created (invoice 40.60, paid 40.25, "paid in full" receipt); with 10% it fails OVERPAYMENT; receipt shows wrong tax.
* Where: `pages/POS.tsx:327-332, 409-414`.
* Repro: `tests/T7/pos1.mjs` B,C,D; `tests/T3/tax.mjs` (11600, +100 debt).
* History: forensic audit #4/#5 open since 2026-03-18. Fix: backend preview endpoint or template rows; print from saved sale.

### QA-056 - Scale-barcode sales: label total discarded, some labels unsellable, line edits affect all lines of the item
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: K4-002, K4-003, T3-015, T7-022, K1-010; D-35, C-27
* In plain words: the cart shows the label total but only weight and system price per kilo are sent. Label 10.01 -> saved 10.02; label 10.00 on a 29.99/kg item -> UNBALANCED_ENTRY (cannot be sold); label price differing from system price is ignored (customer sees 35.00, invoice 30.00); two labels of one item: pressing + on one row changes both, trash removes both; check digit never validated; the documented 14-digit template cannot be configured through the barcode API (weightLength 0 rejected), and a string-typed barcode setting makes every label 404; seeded item codes are not 6-digit so no seeded product can be on a scale label.
* Repro: `tests/T3/barcode.mjs`; `tests/T7/barcode.mjs` (`shots/barcode-two-labels.png`).
* Fix: persist label total as authoritative, per-line uid, validate config.

### QA-057 - POS and payment form silently drop records beyond a page limit
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: K4-021, T7-015, K4-012, T7-016, T8 (note)
* In plain words: POS loads only the first 100 active items sorted by Arabic name; with 106 items "فروج كامل" (main product) disappears from tap and search; the payment form lists only the 500 most recent sales, so older unpaid invoices cannot be paid and the screen says none exist (at the T8 shop's volume within two weeks).
* Repro: `tests/T7/bulk-setup.mjs` + `limits.mjs`; `shots/pos-101-items.png`.
* Fix: server-side search/pagination.

### QA-058 - POS weight rounding and discount input defects
* Severity: Medium | Status: VERIFIED-BY-1 (T7 executed) | Sources: K4-004, T7-007, T7-008 (negative discount), K4-020 (no change handling)
* In plain words: re-opening a cart line rounds weight to 10 g (0.255 kg -> 0.26 kg, 5.61 -> 5.72), the dialog shows two different weights, weights under 100 g cannot be entered; a negative discount raises the total and gives an English validator toast; POS has no tendered-cash/change handling.
* Repro: `tests/T7/pos3.mjs`.
* Fix: integer grams end to end, clamp discount.

### QA-059 - Number inputs treat a comma as decimal: "1,250.00" saves as 1.25
* Severity: High | Status: VERIFIED-BY-2+ AGENTS | Sources: T7-013, V2 (T7-013 function re-run), T7-016/T7-019/T7-021 (same cause)
* In plain words: pasting a number with a thousands separator saves a value 1000 times too small in purchase price (PUR-000006 stored 125 instead of 125000), payments (PAY-000527 amount 125), expenses (123 for 1,234.50) and adjustment cost, with no warning. Arabic digits and the Arabic decimal mark are handled correctly; POS uses plain number inputs where Arabic digits are rejected.
* Where: `app/frontend/src/lib/numbers.ts normalizeToEnglishNumberString`; `components/ui/numeric-input.tsx`.
* Repro: `tests/T7/purchase.mjs`; V2 ran the real function standalone (`'1,250.00'` -> `'1.25000'`; UI layer not re-run by V2).
* Fix: treat comma as grouping unless sole separator with <=2 following digits; echo formatted value.

### QA-060 - Payment form crashes the whole app; accountants cannot read bank accounts; no error boundary
* Severity: High | Status: VERIFIED-BY-1 (ORCH-002 suspected by code; T7 executed twice) | Sources: ORCH-002, T7-001, T7-010
* In plain words: choosing card or bank transfer when no bank account exists renders an undefined `Link` and the whole screen goes blank until reload (every fresh install). For accountants `/bank-accounts` returns 403, so the same crash occurs even when banks exist and POS cannot select a bank.
* Where: `pages/payments/PaymentProfile.tsx:845`; app has no React error boundary.
* Repro: `tests/T7/orch002.mjs`, `tests/T7/acc.mjs` (`shots/acc-payment-card.png`).
* Fix: import Link, add error boundary, `tsc --noEmit` in build, allow bank list read.

### QA-061 - Real backend error reasons hidden in about 50 UI call sites
* Severity: Medium | Status: VERIFIED-BY-1 (K4 by code; T7 executed) | Sources: K4-008, T7-009, T7-019, T7-012 (toast "القيد غير متوازن")
* In plain words: the error envelope is `{error:{messageAr}}` but many screens read the wrong level: duplicate username shows "unexpected error", wrong login shows English "Request failed with status code 401", insufficient cash shows "حدث خطأ", the period-lock toasts can never appear. POS sales hook reads it correctly.
* Repro: `tests/T7/users.mjs`, `expenses.mjs`.
* Fix: one shared `getApiErrorMessage`.

### QA-062 - Purchase form totals computed in floats: "pay in full" fails or leaves 0.01 debts
* Severity: Medium | Status: VERIFIED-BY-2+ AGENTS | Sources: K4-013, T4-017, T7-012
* In plain words: 3 x 0.333 kg x 10.01 gives UI 10.00 vs backend 9.99 -> UNBALANCED_ENTRY; other combos save a 0.01 debt; no overpayment check before posting.
* Repro: `tests/T4/07-rounding-supplier-views.mjs`; `tests/T7/purchase.mjs`.
* Fix: same per-line integer rounding in UI, server OVERPAYMENT check first.

### QA-063 - Minor UI defects: stale PDF dialog parameters, dead code, mislabels, cache invalidation
* Severity: Low | Status: VERIFIED-BY-1 / SUSPECTED mixed | Sources: T7-018 (VERIFIED: dialog exports a different period than its fields), K4-014, K4-015, K4-016, K4-017, K4-019, T7-011 (menu mismatch), K2-006, K4-011 (browser KPI)
* In plain words: PDF dialog fetches with the first-render dates; customer "default discount" labelled shekels but stored in basis points and never applied; margin computed on VAT-inclusive total; stale-cache gaps after money mutations; dead code (`scale-barcode.ts` whose 22 tests cover no live path, `TransferStockDialog`, unrouted pages); frontend audit endpoint `/audit/action-counts` vs backend `/audit/counts` (hook unused).
* Repro: `tests/T7/reports.mjs`; others by code and grep (SUSPECTED).
* Fix: key dialog on params; clean dead code.

## 1G. Process, configuration and requirements

### QA-064 - No automated tests for financial logic; build does not type-check
* Severity: High | Status: VERIFIED-BY-2+ AGENTS (ORCH ran vitest/tsc; K4 ran frontend suite) | Sources: ORCH-007, ORCH-001, K4-015 (log), decision-log section 6 #14
* In plain words: backend has 14 test files / 77 tests (76 pass, 1 fails from test rot) covering only backup and chart-of-accounts tree; zero tests for sales, purchases, payments, debts, costing, transfers, GL posting, tax, reports. Frontend: 10 files, 108 tests all pass (money utils, scale barcode - dead path). `test:e2e` script references a missing config. Frontend build passes but `tsc --noEmit` shows 11 errors (e.g. the undefined `Link` of QA-060). Every fix in history was unguarded.
* Repro: ORCH `npx vitest run` in sandbox copy; `logs/K4-vitest.log` (108 passed).
* Not reproduced: ORCH-001's `.items` empty-list claim (T7: journals tab lists 20 rows). Fix: regression suite from `tests/`, tsc in CI.

### QA-065 - Dead or misleading settings and unvalidated configuration
* Severity: Medium | Status: VERIFIED-BY-1 | Sources: K3-024, G-005, G-004 (cross-ref QA-009), T3-013 (`tax.prices_include_tax`)
* In plain words: `pos.allow_credit_sale=false`, `pos.require_customer=true`, `pos.accountant_max_discount_pct`, `inventory.fifo_enabled`, `numbering.*`, `tax.default_rate`, `tax.prices_include_tax`, `gl_debit_credit_tolerance`, `app.timezone`, `currency.decimals`, `backup.frequency_hours`/`retention_days` and others have no reader; role `permissions` JSON is not enforced. Owner believes controls are on. (`inventory.allow_negative_stock=true` is honoured only per item.)
* Repro: `tests/G/06-settings-audit.mjs` A (6 keys behaviourally), greps over src/dist/frontend.
* Fix: remove or wire each setting.

### QA-066 - Repository, documentation and currency hygiene
* Severity: Low | Status: VERIFIED-BY-1 | Sources: ORCH-004, ORCH-005, K2-003, K2-007, K1-013, K1-014, K1-015
* In plain words: `DB_INIT_GUIDE.md` says admin password `Admin@123` (real `admin123`, login 401 vs 200); tracked `node_modules` (19 files), `app/frontend/.env`, stray root files (`diff.txt`, `rebase.log`, `status.txt`); currency settings still SAR / `ر.س` while product is shekels (invoice shows no currency); the forensic audit report of 2026-03-18 is partly stale (#1, #3 fixed by eebdc44); doc contradictions (account codes, x100 vs x1000) are mostly settled in code (matrix C-13 passes, C-02 residual wastage label).
* Fix: align docs/settings, untrack artefacts.

### QA-067 - Requirements not implemented and master-data validation gaps
* Severity: Medium | Status: VERIFIED-BY-1 (G route probing) / SUSPECTED (offline, scale serial, drawer: code review only; NOT TESTED) | Sources: G-009, G-011, G-012, G-013, G-014, G-016, G-017, T4 coverage (live bird); matrix R8-03, R8-06, R8-07, R8-10, R8-15..R8-19, R8-28
* In plain words: absent: AR aging route, cash-flow, cashier performance, supplier history, day book, Excel/CSV export, data import, returns, live-bird gross/net/shrinkage, per-branch stock, notifications, offline mode, scale serial integration, keyboard shortcuts, cash-drawer kick, save-draft, encryption at rest. Master data accepts blank/duplicate names (phones `0599777000` / `+970599777000` as three customers), below-cost sale prices, supplier rating 99, negative supplier credit limit; `/stock-transfer` pageSize unbounded; `%` acts as a LIKE wildcard. Money integrity is unaffected.
* Repro: `tests/G/03-master.mjs`, `04-scenario.mjs` (31 probes), `08-misc.mjs`, `18-misc2.mjs`. Update the PRD status list or schedule these.

### QA-068 - Test-data and harness facts (Info)
* Severity: Info | Status: VERIFIED-BY-2+ AGENTS | Sources: K2-002, K3-017, T2-017, T8-009; bulletin K2
* In plain words: the `dev` seed writes fixtures directly with no journals, ledger, debts or opening capital, so absolute GL totals on `dev` are meaningless (inventory 560,000 with GL 0; INSUFFICIENT_BALANCE on first outflow; no bank or accountant user); testers used deltas. Production profile (`baseline`) has no fixtures; the missing opening-balance feature is QA-048. Performance with a month of data is acceptable (reads 2-239 ms; writes about 250-300 ms p50; max sale 1,093 ms; 1,119 sales) - Info.

---

# 2. Conflicts reconciled

| # | Disagreement / odd result | Resolution and evidence |
|---|---|---|
| 1 | K3-008 was written as two defects: (a) two lines of one item oversell, (b) concurrent separate POS sales race. | (a) VERIFIED by K3, T1, T2 (QA-042). (b) NOT REPRODUCED by T2 (3 parallel 8 kg on 10 kg -> 201/400/400) and T6 (10 x 1 kg and 20 x 100 g against the last 1000 g -> 0 g oversold). SQLite serialises write transactions, so the in-transaction stock check is reliable across requests; the out-of-transaction FIFO read instead produces lock waits and 500s (QA-052). |
| 2 | K2-005 said a stock transfer stays `draft`. | NOT REPRODUCED: T2 (`t03-transfer.mjs` dump) and V1 show status `completed`; code sets draft then completes inside the transaction. The value-creation part is confirmed (QA-044). |
| 3 | K3-005 count-based numbering: T8 "NOT REPRODUCED for edit". | Not a contradiction: edit deletes and re-creates the lot so the row count is unchanged (T8). Delete is what blocks (T4-012, T1 xval, V2). V2 refined: the block clears only when the highest-numbered row is removed, and the freed number is re-issued. T8 did not exercise delete. |
| 4 | K4-011 (dashboard AR/AP wrong) vs T7 "not reproduced" vs T8-003 (dashboard 1,947.98). | Different mechanisms. T7 (default view, fixtures without debt rows) found dashboard = Debts page = `/debts/summary`. T8/G found the backend dashboard counts every non-paid debt incl. voided and written-off ones. Both true: screens agree with each other and disagree with the ledger (QA-024). The K4 browser-side 500-row / creation-date filter remains SUSPECTED. |
| 5 | ORCH-001 claimed `.items` on array responses may render empty lists. | NOT REPRODUCED by T7 (journals tab lists 20 rows, same as API). The 11 tsc errors themselves are real (QA-064). |
| 6 | K4-013 / K2-009: purchase edit resets amountPaid to 0. | NOT REPRODUCED by T4 (PUT with amountPaid -> 400 PURCHASE_UPDATE_WITH_PAYMENT_NOT_ALLOWED; after payment -> PURCHASE_HAS_PAYMENTS) and T7. The real defect is the opposite: purchases paid at creation can never be edited (QA-030). |
| 7 | Severity of T5-003 (JWT fallback): Critical vs "masked by .env". | T5 forged a token only with the fallback active; V2 confirmed the `.env` absolute-path load and git-ignore but could not run the no-`.env` boot. Rated High, status VERIFIED-BY-1 (QA-005). T5-001 (backup secret) is unconditionally Critical because the variable is absent from `.env` too. |
| 8 | T6-012 (Critical), T6-008 (Critical), T1-018 (Critical) ratings. | Re-rated: restore (High, needs admin or QA-002), negative/zero amounts (High, needs a typo or malicious authenticated user), GL-engine numbering (High, only after a non-default flag). Rationale in each cluster. |
| 9 | K1-004 predicted reversal by `findFirst` could reverse only one of several JEs of a voucher. | Not independently confirmed as stated. T1 mirror checks (GL-07) pass for single-path voids; the actual defect found is the double refund of payments (QA-014) and credit-note interaction (QA-020). Matrix row C-31 marks it TESTED-FAIL through those. |
| 10 | T3-006 figures (-7000 vs -5000 expected) vs V1 (-2000/+2000). | Different baselines (after-sale vs before-sale); same extra refund equal to the later payment (V1 "Differences" section). No contradiction. |
| 11 | T4-001 four-way AP table vs V1. | V1 verified the per-invoice mechanism (GL short by tax, 3000 phantom debit, balance never decremented) but did not rebuild the 3-purchase aggregate table. Numbers quoted from T4. |
| 12 | K4-009 vs T7-010: is the accountant allowed to use bank accounts? | REFINED by T7: the API returns 403 on `/bank-accounts` for accountants (not the permissive reading of K4), causing the payment-form crash and unassigned card banks (QA-060). |
| 13 | T1-015 / D-28 "UTC day boundaries" is deliberate. | Intentional decision, but harmful with the front end shifting the other way (QA-054). Fiscal-year start built from local `new Date(year,m,1)` then `toISOString` is a defect even under D-28 (QA-034). |
| 14 | F-13 (POS bank routing "recurs") and F-15 (expense bank). | F-13: T3 and V1 CONFIRMED FIXED for single tender. F-15: NOT effective on the legacy path (T4, T8, V1) - the plan was marked done but is not (QA-017). F-02 (weighted average after adjustment) CONFIRMED FIXED (T2 t07-f02). |
| 15 | Stale or optimistic documents. | `runtime-forensic-audit-report.md` #1/#3 fixed by eebdc44 (K2-007) but #4, #5, #6, #7 still open; `auth_assessment.md` and `Apis_issues/group1-auth-audit.md` overstate session security (T5); `DB_INIT_GUIDE.md` password `Admin@123` wrong (ORCH-004); ACCOUNTANT_ADMIN_PLAN_STATUS said 0/39 done; several plan checklists unchecked though code exists; blueprint 02 results.md used account 1112 (a group) as round-off; Blueprint 07 (periods) has no implementation. |
| 16 | Settings that do nothing. | Verified by G (QA-065): `pos.allow_credit_sale`, `pos.require_customer`, `pos.accountant_max_discount_pct`, numbering prefix, etc. The tax-engine flag alone also does nothing (T3-012, V1). |
| 17 | V2 could not re-prove the setup-rerun sub-claim of T5-011. | INCONCLUSIVE for V2 (payload shape). T7 replayed `POST /auth/setup` -> 400 SETUP_ALREADY_COMPLETE with the flag true, and G showed the guard collapses when the setting is false (QA-009). Both consistent. |
| 18 | V2 adjustment unitCost -5000 returned INSUFFICIENT_STOCK. | Self-inflicted negative stock in V2's own script; original T2-002/T6-008 stands (VERIFIED by T2 and T6). |
| 19 | Which cost method is in force (O-4: commit 75b3211 "weighted average" vs Swagger "FIFO"). | Both, un-reconciled (K3 bulletin, D-03): sales/wastage use FIFO lot cost; adjustments and displayed averageCost use weighted average; transfers use user cost (QA-043, QA-044). |
| 20 | K3 note that `AccountController` duplicates guarded routes. | Empirically the guarded `AccountingController` wins (`can-delete` -> 403), so harmless today but fragile (QA-002). |
| 21 | K3-017 rated Info/Medium (seed bypass). | Info for testers (QA-068); the genuine product gap is the missing opening-balance feature (QA-048). |
| 22 | K3-025 "purchase docstatus stays 0". | VERIFIED by T4-019; consequence is the empty supplier open-invoice list (QA-023). |

---

# 3. Refuted / not-a-defect list and verified-good behaviours

## 3A. Leads not reproduced, not confirmed or turned out intentional (NOT reported as defects)
* K3-008 concurrent separate sales oversell - not reproduced (T2, T6).
* K2-005 transfer status stays draft - not reproduced (completed).
* ORCH-001 empty lists from `.items` - not reproduced (T7).
* K4-013 / K2-009 edit zeroes amountPaid - not reproduced (T4, T7).
* K4-011 dashboard AR/AP computed from first 500 debts - not reproduced in the default view (T7).
* K3-005 for purchase edit (as opposed to delete) - not reproduced (T8).
* K3-001 in a realistic month (voids of already-collected invoices) - not exercised by T8; confirmed elsewhere (QA-014).
* Transfer source-lot over-consumption race (K3-016 part) - window exists by code but not reproduced (T6 05b, 10 runs, 0 over-consumption).
* K4-006 as a server-side double-submit guard question: confirmed (QA-053), not a refutation.
* T1-015 UTC day boundaries as a design - INTENTIONAL (D-28); only the interaction defects are reported.
* Docs-only contradictions C-01 (two PRDs), C-28 (return rounding) - NOT TESTED, no runtime oracle.
* D-01..D-37 behaviours that look odd but are deliberate: weight-only selling; grams storage; money x100; no mixed sale type (D-12); daily pricing removed (D-09); item/category soft-vs-hard delete (D-06/D-07); balance-sheet equity by computed net income (D-27); low-stock includes zero stock (D-30); POS discount in shekels (D-31); raw chicken (price 0) not sellable (D-34); purchase price < sale price frontend-only (D-33); Debt table and ledger as parallel truths (D-22); category auto-purchase items (D-08).
* Settings dead by design are reported (QA-065), but the "dev seed has no GL" is not a product defect (QA-068).
* The `AccountController` duplicate routes - harmless today.
* CORS blocking remote browsers (T5-012) - note, not a defect.

## 3B. Verified-good behaviours (executed PASS)
* Plain single-line FIFO sale and its void restore the same lots; GL exact; all 6 voids in the T8 month exact (T2-003, T1, V1 S0, T8).
* POS card/bank-transfer with a bank id posts to the bank; void reverses it (F-13, T3, V1). Payment cancel restores customer balance, debt and ledger (F-08, T3, V1; double cancel -> 400).
* F-02 weighted average after adjustment correct (T2 t07-f02: avg 2500, lot 3000).
* Wastage value = lot cost (I-25, G 16-inv-misc: 2 kg x 50.00 = 10,000 with JE 5300/1131); displayed cost rule I-28.
* Trial balance balanced in normal flows (checker GL-01/03 PASS on all runs); drafts excluded (I-08); no lines on group/inactive/frozen accounts (I-04); T8: trial balance Dr-Cr = 0 all month; POS sales, collections, partial/credit sales, scale-barcode sales and header discounts reconcile to the agora.
* Deactivated users rejected on both tokens; accountant cannot create admins, edit others, reset admin password or grant itself pages; mass-assignment via `PUT /users/me` rejected; SQL injection via search/sort parameterised (T5-011, V2 re-confirmed two of these); prototype pollution; body-size limit (413); stack traces not leaked in 500s.
* Backup -> data change -> restore is exact for a good same-version backup; 7 backups under load integrity ok; hard-kill consistent; traversal and garbage archives rejected (T6-013).
* Roll-backs on late failure inside transactions are complete (T6 08).
* Pagination bounded on 12 of 14 list endpoints; duplicate code/username/phone exact checks; branch rules (main branch cannot be deactivated, last active branch); customer with open debts cannot be deleted (D-18); wastage by lot; all 24 PDF endpoints return valid PDFs (G).
* Operational reports (sales, purchases, expenses, inventory) reconcile to raw tables on a one-day dataset (G 10-reconcile); dashboard "today's sales" equalled truth every day of T8.
* Accounting PDFs (balance sheet, income statement, trial balance) equal DB balances in T7's (no-capital) data.
* Session lifetime matches APIP (15 min / 7 days, C-24); account codes used consistently (C-13).
* Performance acceptable for a month of data (QA-068).

---

# 4. Root-cause themes

| # | Theme | Clusters |
|---|---|---|
| T-1 | **No single source of truth for balances and quantities.** Receivables, payables, stock and cash live in 4+ places (GL, subledger/ledger entries, debts/balances, lots/inventory/stock ledger) patched independently; no reconciliation guard. | QA-014, 015, 019, 020, 021, 022, 023, 024, 025, 035, 036, 043, 044, 046 |
| T-2 | **Authorization and business controls enforced in the UI only (or not at all).** Decorators without guards, page gating by prefix, dead settings, cosmetic approvals. | QA-002, 007, 008, 009, 010, 065 |
| T-3 | **Count-based numbering, hard deletes and history rewriting** instead of sequences and reversals. | QA-029, 030, 031, 032, 011 |
| T-4 | **Race conditions: reads and checks outside the transaction, no idempotency.** | QA-042, 050, 051, 052, 053 (with QA-015 lost update) |
| T-5 | **Posting-map gaps: documents that post nothing, post to the wrong account, or omit a component** (tender, bank, tax, category, transfer, wastage, opening stock). | QA-014, 015, 016, 017, 018, 019, 026, 027, 039, 044, 046, 048 |
| T-6 | **Units, rounding, dates and locale.** Integer money vs float UI, 1-agora rounding, UTC vs local day, comma/period parsing, weight rounding, label totals. | QA-041, 054, 055, 056, 058, 059, 062 |
| T-7 | **Missing input validation** at API boundaries (DTOs without IsInt/IsPositive, no range checks, settings and master data). | QA-031, 037, 040, 041, 009, 012, 067 |
| T-8 | **Secrets, deployment defaults and backup safety.** Public fallback secrets, unauthenticated download, unvalidated restore, overwrite, plaintext. | QA-001, 003, 004, 005, 006, 013, 012 |
| T-9 | **Dual posting paths and no automated tests for core logic** (flags off, ON mode drifts, every fix unguarded; stale docs; plan marked done but not). | QA-028, 064, 066, 068 |
| T-10 | **Missing accounting lifecycle**: periods, year-end, opening balances, day close, returns. | QA-032, 033, 034, 048, 047, 067 |

---

# 5. Remediation ordering

**P0 - stop-ship (fix before any real data or network exposure)**
1. QA-001 + QA-005 (one change: fail-fast secrets, add `BACKUP_DOWNLOAD_SECRET`, rotate, treat past backups as exposed).
2. QA-002 (global default-deny RolesGuard + authz matrix test). Must precede QA-003, QA-009 exposure review. Shares the guard change with QA-007 role parts.
3. QA-003 + QA-004 (validated atomic restore, unique backup names) - after QA-002.
4. QA-029 (sequence-based numbering) - prerequisite for QA-030 and QA-028.
5. QA-014 + QA-015 + QA-016 + QA-017 (cash/AR posting correctness; one payment-posting service) - QA-015 first, then QA-014 can reuse it.
6. QA-042, QA-043, QA-044, QA-051 (stock integrity: in-transaction lot allocation, lot-aware adjustments, value-conserving transfers). QA-043 and QA-051 share the adjustment rewrite; QA-044 needs transfer posting (shares the stock-journal helper with QA-046).
7. QA-050 + QA-053 (conditional updates inside the transaction + idempotency key) - one change in void/payment/credit-note/sale create.
8. QA-019 (purchase tax in GL and supplier balance).

**P1 (before go-live)**
* QA-020, 021, 022, 023, 024 (receivable subledger unification; do after P0 payment service). QA-025 follows.
* QA-026 + QA-027 (VAT posting and invoice) - decide first whether tax engine becomes default; QA-028 depends on that decision.
* QA-006, 007, 008, 009, 011, 013 (auth lifecycle, API authorization, controls, setup integrity, audit, XSS) - QA-011 after QA-002.
* QA-030 (reversal instead of delete; depends on QA-029), QA-031, QA-040, QA-041 (DTO validation sweep - one change set).
* QA-032, QA-033, QA-034, QA-035, QA-036 (reports and periods; QA-033 fix is tiny and independent).
* QA-038 (after QA-017), QA-045, QA-047, QA-048, QA-054 (single timezone helper, front and back), QA-055, QA-056, QA-057, QA-059, QA-060.
* QA-052 (SQLite tuning), QA-064 (tests and tsc - start in parallel with P0 so P0 fixes get regression tests).

**P2**
* QA-010, 012, 018, 028, 037, 039, 046, 049, 058, 061, 062, 065.

**P3**
* QA-063, 066, 067, 068 and the Info/Low items.

Dependency notes: QA-029 -> QA-030 -> QA-028; QA-015 -> QA-014 -> QA-022; QA-017 -> QA-038; QA-043/051 share the inventory service rewrite; QA-050/053 share one transactional-guard change; QA-054 front and back share one date helper; QA-040/041/031/009 share the DTO validation pass; QA-064 runs alongside everything.

---

# 6. Coverage statement

Source: `findings/G-coverage-matrix.md` (114 rows: 53 invariants I-01..I-53, 28 section-8 requirements R8-01..R8-28, 33 contradictions C-01..C-33) and each `*-coverage.md`. Matrix totals: **TESTED-FAIL 95, TESTED-PASS 14, NOT TESTED 5** (invariants 45 fail / 8 pass; section-8 24 fail / 1 pass / 3 not tested; contradictions 26 fail / 5 pass / 2 not tested).

**Executed (with saved scripts/outputs)**: GL integrity, statements, periods, engines ON (T1); inventory, FIFO, adjustments, transfers, wastage, expiry, branches, GL-engine variant (T2); sales/POS, tax, discounts, void, credit notes, receivables, statements, barcode, tax engines toggled (T3); purchases, payables, bank/cash, expenses, guard dates, numbering, engines ON (T4); authz matrix 187 endpoints x 5 principals, backup exfiltration, JWT, input attacks, npm audit (T5); concurrency, idempotency, boundaries, dates/TZ, backup/restore integrity, crash/restart (T6); UI via Playwright (T7); 30-day business simulation with 1,119 sales, 40 purchases and a shadow ledger, plus a 10-day variant (T8); independent re-proofs (V1 16 rows, V2 about 17 rows); gap analysis (G, 18 script groups); backend vitest (77 tests) and frontend vitest (108 tests passed); shared checker `harness/invariants.mjs` (28 checks) on every DB.

**Reviewed only (code/documents, not executed)**: K1 (all 15 doc leads), most of K2 and K4 leads before T7/T-agents confirmed them, credit-note GL in depth, allocation races, K3 reconciliation/period details, purchase `receive` path, `recordExpensePayment` dead code, PO PDF mapping, frontend Tauri specifics, CSP, offline/scale/shortcut/drawer requirements (G-016).

**Untested**: R8-03 offline mode, R8-07 scale serial/calibration, R8-17 receipt templates/drawer/draft/shortcuts (matrix NOT TESTED); C-01, C-28; restore of archives containing `assets/*` (forbidden path); symlink tar entries (Windows EPERM); kill during restore swap; two server processes on one DB; credit-note double submit, reconciliation-apply and write-off races; GL/tax-engine ON month, ON variants of K3-001/002/003, ON-mode concurrency; combined chain accountant import -> setup flag false -> anonymous reset (each hop proven separately); full re-run of T5's authz matrix by V2 (spot checks only); `.env`-absent boot path (V2); dependency exploits (tar hardlink, pdfmake SSRF) not weaponised; PDF glyph content mostly unreadable by extractor outside T3/T7/T8; multi-branch posting (impossible through the API); UI execution of G-006/G-007.

**Harness limitations**: (1) T7 used headless Chromium on a frontend build served over HTTP, not the Tauri WebView2 - print dialog, downloads, CSP and devtools behaviour not exercised. (2) The `dev` seed bypasses all posting (no JEs, ledger, debts, stock ledger; inventory 560,000 with GL 0), so absolute GL totals on `dev` are meaningless; testers used GL deltas and `baseline` + setup instances. (3) Engines are OFF by default; ON variants were exercised by T1, T2, T3, T4 only partly and not for concurrency or a full month. (4) The T8 fake clock affects JS-set dates only; Prisma `@default(now())` columns (createdAt, `stock_movements.movementDate`, `debts.createdAt`) keep real time. (5) All tests ran against local SQLite on one machine (server TZ Asia/Hebron); no network latency, no WAL. (6) T6's instance `t6` was left bricked by T6-012 (reset before reuse). (7) T7 used 106+ items and 530+ sales of filler data.

---

# 7. Statistics

**Raw entries to clusters**: 231 raw finding headings (ORCH 7, K1 15, K2 10, K3 25, K4 21, T1 20, T2 18, T3 18, T4 20, T5 13, T6 14, T7 24, T8 9, G 17) + about 33 V1/V2 re-proof rows -> **68 clusters** (QA-001..068), plus the refuted/verified-good list in section 3.

| Severity | VERIFIED-BY-2+ AGENTS | VERIFIED-BY-1 | INTENTIONAL-BUT-RISKY | SUSPECTED | NOT-VERIFIABLE | Total |
|---|---|---|---|---|---|---|
| Critical | 12 | 0 | 0 | 0 | 0 | 12 |
| High | 29 | 7 | 3 | 0 | 0 | 39 |
| Medium | 7 | 6 | 1 | 0 | 0 | 14 |
| Low | 0 | 2 | 0 | 0 | 0 | 2 |
| Info | 1 | 0 | 0 | 0 | 0 | 1 |
| **Total** | **49** | **15** | **4** | **0** | **0** | **68** |

Notes: INTENTIONAL-BUT-RISKY clusters are QA-021 (D-16), QA-030 (D-20), QA-038 (D-14), QA-039 (D-15); QA-021, 030 and 038 were also executed by 2+ agents. No cluster is wholly SUSPECTED because every code-only lead was executed by a tester; sub-items that stayed code-only are noted inside QA-063 and QA-067. Raw ratings that were lowered: T5-003, T6-012, T6-008, T1-018 (Critical -> High); raised: none.

