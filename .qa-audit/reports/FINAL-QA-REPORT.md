# Independent QA Audit — Chicken FMS (butcher-shop POS, inventory and accounting)

Audited: repository `ahmrabaee/CHICKEN` at commit `4dfee68` (19 March 2026), 89 commits, three developers plus AI-assisted planning.
> **Update 26 Nov 2026:** the original tests ran against commit `4dfee68`. Your teammate's branch `fix/critical-high-qa-and-returns` (6cc6d56, merged as 49b1d0f) was then re-tested against every claim and every affected problem (section 9). Result: **1 of 68 problems fixed, 13 partly fixed, 43 not fixed**, and the new sales-return feature added 3 new critical defects. The verdict in section 1 is unchanged.

Audit run: 24–25 November 2026, entirely inside `E:\DEV\Chicken FMS\.qa-audit\`. No application code, document, lockfile or developer database was changed.
Detailed evidence: `reports/MASTER-REGISTER.md` (68 root-cause clusters, each with sources, reproduction script, impact, history, fix), `findings/*.md` (raw per-agent findings), `tests/*` (every executed script with its saved output), `knowledge/*` (requirements, decision log, architecture, posting map).

---

## 1. Verdict

**The system is not ready for a real business.** It runs, its everyday paths often work, and its books always balance arithmetically (every journal entry has equal debits and credits). But the numbers a shop owner reads are wrong in ordinary use, and several holes let people without permission read or replace the whole database.

After a simulated 30-day month (1,119 sales, 40 purchases, 30 cuttings, collections, expenses, wastage), compared against an independent set of books kept by the test:

| October, in ₪ | Truth | What the system shows |
|---|---|---|
| Cash in the drawer | 8,520.25 | −4,029.75 (bank overstated by 12,550) |
| Owed to suppliers | 5,358.82 | 35,947.33 in supplier balances (ledger and debts were right) |
| Customers owe | 1,757.91 | 1,806.47 / 1,782.91 / 1,947.98 on three different screens |
| VAT owed | 13.91 | 0 |
| Profit | 17,455.38 | 17,517.27 in the ledger; 18,733.18 on the Profit and Loss page |
| Printed balance sheet | Equity 112,517.27 | Total Equity printed as −77,482.73 |

What held up: stock counts per item, plain FIFO sales and their voids (the same lots are restored), card and bank sales routed to the bank account, payment cancellation restoring balances, backup and restore of valid backups, SQL injection resistance, PDF generation, and performance with a month of data (reads 2–240 ms, writes about 270 ms).

## 2. Headline numbers

* 231 raw findings from 14 agents, merged into **68 root-cause clusters**.
* **12 Critical, 39 High, 14 Medium, 2 Low, 1 Info.**
* 49 clusters reproduced independently by two or more agents, 15 by one agent, 4 are deliberate decisions that are nevertheless risky. No cluster rests on code reading alone.
* Four findings were rated down (JWT fallback secret, restore, negative amounts, GL-engine numbering from Critical to High). None was rated up.
* Requirement coverage matrix: 114 rows (53 business invariants, 28 requirements that might be missing, 33 contradictions between documents): **95 tested and failing, 14 tested and passing, 5 not testable** (offline mode, scale serial integration, keyboard shortcuts, cash-drawer kick, draft sales have no API to test).
* Existing automated tests: 77 backend tests (76 pass, 1 broken test mock), 108 frontend tests pass. They cover only backups, the chart-of-accounts tree and small utilities. **No automated test covers sales, purchases, payments, stock or posting.** The frontend ships with 11 TypeScript errors because the build does not type-check.

## 3. The twelve Critical problems

1. **QA-001 — Anyone can download the whole database without logging in.** The backup download link is signed with a secret that falls back to a phrase in the source code and is missing from `.env`, `.env.example` and the deployment guide. Two agents forged a link and downloaded all customers, suppliers, prices, costs and password hashes.
2. **QA-002 — An accountant can take over the system.** The backup module is marked admin-only but the check is not enforced. An accountant listed backups, changed the backup path, imported an arbitrary database archive and restored one. Tax rates, credit notes and reconciliation have the same gap.
3. **QA-014 — Voiding a sale after a separate payment refunds the money twice.** A 10,000 credit sale with a 4,000 cash payment, then voided, leaves cash short by 4,000 and a phantom 4,000 receivable. The same happens for sales paid partly at the POS.
4. **QA-015 — A payment added to an existing sale posts nothing to the ledger**, and cannot be cancelled afterwards.
5. **QA-017 — Bank-transfer and card expenses are taken from the cash drawer.** Rent, electricity and salaries paid by bank made the ledger's cash negative on 9 of 30 days while the real drawer never held less than 5,013. This was marked "fixed" in an earlier commit and still fails on the default posting path.
6. **QA-019 — Purchase tax never reaches the ledger and supplier balances never go down.** Payables show four different values. A fully paid taxed purchase leaves a debit balance in the payables account.
7. **QA-029 — Deleting any purchase or expense that is not the latest blocks all later ones permanently**, because document numbers are the count of existing rows. Purchase lots and stock transfers are blocked the same way.
8. **QA-042 — Two lines of the same item in one sale oversell the same lot**, leaving negative stock.
9. **QA-043 — Stock adjustments ignore lots and use average cost.** A written-off lot can still be sold later, and lots, inventory table and ledger drift apart.
10. **QA-044 — Cutting whole chickens into parts creates or destroys stock value with no journal entry.** With the cost the screen pre-fills, nine days of cutting cut the booked profit by 86%, and inventory in the ledger fell about 361 behind per daily cutting.
11. **QA-050 — Concurrent voids, payments and credit notes all succeed.** Four parallel voids of one sale reversed it four times (stock +8 kg instead of +2 kg, customer balance −30,000). Four parallel payments of 6,000 on a 10,000 invoice were all accepted.
12. **QA-051 — Parallel stock adjustments overwrite each other and concurrent sales.** Four parallel 1 kg decreases removed only 1 kg of stock but posted 84.08 of inventory credits to the ledger.

## 4. The most important High problems (full list in the register)

* **Backups and recovery (QA-003, 004):** restore accepts any file with a database header and cannot roll back. A fake file made even the login endpoint return 500, and only a file on the server's disk could undo it. Two backups taken in the same second overwrite each other, and retention once deleted a seconds-old backup.
* **Authorization (QA-006–009, 013):** tokens survive logout and password change; no lockout; passwords like "password" accepted; accountants read profit, cost and supplier prices through the API although the requirements forbid it; the cashier discount cap is bypassed by a fixed-amount discount, a line discount or a price of 1 agora/kg; the only admin can demote himself; an admin flipping one setting lets an anonymous request reset the admin password; HTML in a customer name runs as script when a receipt is printed and can read the login token.
* **Receivables and tax (QA-016, 020–027):** mixed cash and bank payments post entirely to the first tender; credit notes change only the ledger, so a customer can still be charged in full; closed documents accept payments; write-off and void each reduce the customer's balance; the dashboard counts voided and written-off debts; VAT is booked as revenue and shown as profit; the printed tax invoice has no VAT line.
* **Accounting structure (QA-028, 031–037):** with the optional GL engine switched on, any deleted entry makes every later posting fail with a duplicate number, which stops all selling; manual journal entries check balance on decimals and store whole numbers, so the trial balance can stop balancing; the period lock covers only voids, payment cancels and credit notes; the balance sheet PDF shows equity with the wrong sign; the trial balance "as of" a date shows today's balances; there is no year-end close; the Profit and Loss page and the stock-vs-ledger report disagree with the ledger; bank accounts can be mapped to revenue or payables.
* **Operations (QA-038, 040, 047–048, 052–054):** the insufficient-cash guard blocked 5 purchases and 7 expenses including a 4,200 cash salary in the simulation, and is bypassed by back-dating; negative, zero and fractional amounts are accepted nearly everywhere (a −50.00 expense adds 50.00 to the cash drawer); expired stock is sold; no opening balances, cash deposits or end-of-day report; 20 simultaneous sales caused a 6-second freeze and 500 errors; a double click or retry creates duplicate sales (2–3 per double click in the browser); report date ranges are one day early in the shop's timezone (a same-day filter returns nothing).
* **Point of sale (QA-055–060):** the POS adds a fixed 15% tax whatever template is selected, so other rates are rejected or leave a hidden debt; scale-barcode labels can be unsellable and editing one label line changes every line of that item; the POS drops items beyond the first 100, and the payment form beyond the first 500 sales; number fields treat a comma as a decimal point ("1,250.00" saves as 1.25); choosing card or bank transfer with no bank accounts blanks the whole app, and accountants cannot read bank accounts at all.
* **Quality process (QA-064):** no regression tests on financial logic, no type-check in the build.

## 5. Why this happened (systemic themes)

1. **No single source of truth.** Receivables, payables, stock and cash each live in four or more places (ledger, subledger, balance fields, lots/inventory/stock ledger), patched separately, with no reconciliation guard.
2. **Controls enforced only in the screens.** Role decorators without guards, page access checked by prefix, dead settings, cosmetic approvals.
3. **Count-based numbering plus hard deletes** instead of sequences and reversals.
4. **Checks done outside the database transaction** and no idempotency.
5. **Posting gaps:** documents that post nothing, post to the wrong account or omit a component (tender, bank, tax, category, cutting, wastage, opening stock).
6. **Units, rounding, dates and locale** handled differently in the UI and the API.
7. **Missing input validation** at the API boundary.
8. **Public fallback secrets and unsafe backup handling.**
9. **Two posting paths, no tests.** The legacy path is on by default and the GL/tax engine behind flags drifts from it, so every fix in the history was unguarded against regression.
10. **Missing accounting lifecycle:** periods, year-end, opening balances, day close, returns.

Historical context matters here. The development history shows the ×1000→×100 money-unit change was done over five commits spread across 17 days and PDFs printed 100× amounts until 14 March. "Fix everything" commits rewrote posting code with no tests. At least one fix recorded as done (bank-paid expense routing) still fails. Several documents contradict each other (two different PRDs share one file name, with different money scales, role models and account codes), and some audit documents in the repo are partly stale. The register records which behaviours are deliberate decisions (for example the cash-balance guard, write-off exclusion from totals, per-line cutting cost) and rates the risky ones separately instead of calling them defects.

## 6. Recommended order of work (detail and dependencies in register section 5)

**P0, before any real data or network exposure**
1. Fail fast on missing secrets, add the backup secret, rotate it, treat existing backups as exposed (QA-001, 005).
2. Default-deny role guard plus an automated permission matrix test (QA-002; precedes 3 and the admin and setup hardening).
3. Validated, atomic restore with unique backup names (QA-003, 004).
4. Sequence-based numbering (QA-029; prerequisite for removing hard deletes and for the GL engine).
5. One payment-posting service that respects tender, bank account and tax; then fix void, add-payment and expense routing (QA-014–017, 019).
6. Stock integrity: lot allocation inside the transaction, lot-aware adjustments, value-conserving cutting with journal entries (QA-042–044, 051).
7. Conditional updates inside the transaction and an idempotency key for void, payment, credit note and sale creation (QA-050, 053).

**P1, before go-live:** unify the receivable subledger, VAT posting and invoice, auth lifecycle and API authorization, reversal instead of delete, one input-validation sweep, reports and periods, one timezone helper shared by UI and API, POS fixes (tax rate, barcode, page limits, comma parsing, error boundary), and start a regression suite now so P0 fixes are protected. **P2 and P3:** hardening, dead settings, minor UI, repository hygiene.

## 7. What was and was not tested

**Executed, with saved scripts and outputs:** ledger integrity and financial statements with the engines off and on; inventory, FIFO, adjustments, cutting, wastage; sales, tax, discounts, voids, credit notes, receivables; purchases, payables, bank and cash, expenses; a full permission matrix (187 endpoints × 5 identities), backup exfiltration, token lifecycle, injection attempts, dependency audit; concurrency, retries, boundaries, dates and timezones, backup and restore integrity, crash and restart; a browser-driven UI crawl and flows (Playwright, Asia/Jerusalem timezone, 53 routes); a 30-day business simulation with an independent shadow ledger; independent re-proof of the most serious claims by two agents that did not reuse the original scripts (all 16 financial claims and 16 of 17 platform claims confirmed, one inconclusive); a gap analysis against the requirement documents.

**Reviewed only:** most documentation leads before they were tested, credit-note ledger postings in depth, several reconciliation details, the Tauri desktop wrapper (boilerplate), Content Security Policy.

**Not tested, and why:**
* The real Tauri window: the browser tests used headless Chromium, so the print dialog, downloads and WebView behaviour were not exercised.
* Offline mode, scale serial integration, keyboard shortcuts, cash-drawer kick, draft sales: no API or UI to exercise.
* A full month with the GL and tax engines on, and concurrency with them on.
* The complete takeover chain (accountant imports a backup, setup flag turned off, anonymous admin reset): each step was proven separately, not as one run.
* Whether the hard-coded JWT secret is used when the `.env` file is genuinely absent on a deployment: confirmed it applies when the file is missing, but nobody deleted the team's `.env` to boot without it.
* Restoring archives that contain asset files (would write into the developers' data folder), symlink archive entries (blocked by Windows), a kill during the restore file swap, two server processes on one database.
* Multi-branch posting: the sale and purchase APIs accept no branch, so it cannot be reached.
* Dependency exploits (tar, pdfmake) were triaged for reachability, not weaponised.

**Limits of the method:** the `dev` seed writes its sample sales, purchases and stock straight into the database with no journal entries, so absolute ledger totals on it are meaningless; testers worked from baseline setups or measured changes before and after each operation. The simulated clock changed only dates set by application code, not database default timestamps. All tests ran on one machine against SQLite with the server in the Asia/Hebron timezone. The two verifier agents used the same harness as the testers, so a flaw in the shared harness could affect both; the shared invariant checker and plain SQL were used to limit that.

## 8. Housekeeping

* My setup created `app/backend/.env` (git-ignored) with a random JWT secret, `app/backend/prisma/data/app.db` (seeded dev database), and the `node_modules` and build outputs. `git status` shows no tracked change; I restored `package-lock.json` after `npm install` altered it.
* I added `.qa-audit/` to `.git/info/exclude` so the audit folder stays out of git. Remove that line if you want to commit the audit.
* `envs/` holds about 250 MB of test databases and logs; all test servers are stopped. The instance `t6` was deliberately left corrupted by the restore test (`node harness/instance.mjs reset t6 3111 dev` clears it).
* Ignore for now: repository hygiene items (tracked `node_modules`, tracked `app/frontend/.env`, stray root files) and the dependency vulnerabilities (57 backend, 31 frontend, counted separately), of which only the runtime-reachable ones (tar, multer, body-parser, path-to-regexp, proxy-addr, pdfmake) matter.

---

---

## 9. Comparison with the teammate's QA review and fixes (added 26 Nov 2026)

**His review** (`QA_TESTING/`, dated 20 Nov): 5 reviewers, code reading plus API tests, about 11 critical and high items, no concurrency, simulation, security or UI testing. All 11 overlap with problems in this audit (lots after adjustments, cutting value, opening stock, wastage, VAT, numbering, role guards, discount cap, audit log). **His review did not find** the public backup download, accountant backup access, double refund on void, payments that post nothing, bank-paid expenses taken from cash, mixed-tender routing, concurrent voids and payments, duplicate sales, negative amounts, expired-stock sales, the balance-sheet and date bugs, or any POS/UI defect. **His fixes** (commit 6cc6d56) were then re-tested by two agents running my reproduction scripts plus the edge cases his happy-path tests skipped (`findings/R1.md`, `findings/R2.md`; scripts in `tests/R1` and `tests/R2`).

### 9.1 Status of the 68 problems after the merge

1 fixed, 13 partly fixed, 1 changed (still wrong), 43 not fixed, 9 not re-run because the commit does not touch their code, 1 informational. Of the 12 critical problems: 1 fixed (QA-044, cutting), 4 partly fixed (QA-002, 019, 042, 043), 7 not fixed (QA-001, 014, 015, 017, 029, 050, 051). The per-problem status is the fourth column of the appendix.

### 9.2 His claims, checked

| Claim | Verdict | What the test showed |
|---|---|---|
| C-4 stock transfer conserves value | **TRUE** | Value created equals value consumed for UI-default, zero and 99.99 costs, odd weights and same-item transfers. |
| H-2 taxed and discounted sale balanced | **TRUE** | Default and GL-engine paths balanced. |
| H-4 wastage writes a stock-ledger row | **TRUE** | Also uses the branch stock account. There is still no cancel route. |
| H-5 sale VAT to 2120, void reverses it | **TRUE** | But the sale's `totalProfit` still includes VAT (5,500 vs 4,000). |
| M3 discounts to 4900 | **TRUE** | Expenses still all post to 5400. |
| C-2 adjustment decrease consumes lots | **TRUE for decreases** | Increases without a cost still create no lot; cost 0 and −1,500 are still accepted. |
| C-6 roles | **PARTLY TRUE** | Tax-template writes, account creation, debt write-off and the total discount cap are now enforced. Backup config/import/restore, credit notes, reconciliation, wastage and `POST /sales/:id/payments` are still open to the accountant, and a price of 1 agora per kg still bypasses the cap. |
| C-5 audit log | **PARTLY TRUE** | 30 successful changes produced 35 rows with user, entity, IP and masked passwords. But failed or denied calls leave no row, insert errors are swallowed (3 of 1,046 sales lost their row under load), bodies over 4,000 characters are cut into invalid JSON, and the IP can be spoofed. |
| C-3 opening stock posts to the ledger | **PARTLY TRUE** | Dr 1131 / Cr 3100 now posts, but there is no stock-ledger row, and nothing at all when the cost is 0. |
| H-1 purchase VAT posted | **PARTLY TRUE** | Default path only. With the GL engine on, tax is omitted and a fully paid taxed purchase is still rejected. The supplier balance still never falls. |
| C-1 WAL, busy timeout, guarded lot decrements | **PARTLY TRUE, with new harm** | WAL is on and 15 parallel sales succeed; single-lot oversell is stopped. But 20 parallel sales gave 3 successes and 17 server errors (before the fix: 8 and 12), parallel adjustments still overwrite each other, and a valid same-item sale is now falsely rejected when its stock sits in two lots. |
| H-3 atomic max+1 numbering | **MOSTLY FALSE** | Only GL-engine entry numbers changed. Purchase, expense, lot, transfer, credit-note and payment numbers are still count-based; deleting a non-last row still blocks new ones for good. |

### 9.3 New defects introduced by the merged code

Found by the re-tests (IDs in `findings/R1.md` and `findings/R2.md`).

**Critical**
* **Return then void reverses the sale twice.** Stock went from 10 kg to 14 kg and the shop paid out 40,000 on a 20,000 sale (R1-001).
* **Concurrent returns all succeed.** Four parallel full returns left 22 kg of stock after buying 10 and cash at −80,000. Five parallel 1 kg returns refunded 150.00 on a 30.00 sale (R1-002, R2-007).
* **Backups taken while sales are being posted are silently corrupt but marked successful.** The WAL setting makes a plain file copy unsafe: 3 of 20 archives were bad with 5 concurrent writers and 7 of 20 with 3 (R2-001).

**High**
* A return on a discounted sale refunds the gross amount (60.00 refunded on a 54.00 payment) and does not reverse the discount (R1-003, R2-006).
* A cash refund is allowed on an unpaid credit sale: the cash goes out, the debt stays, and the customer can still pay in full (R1-004, R2-007).
* A credit note plus a credit-refund return credits the customer twice (R1-005).
* Restoring while the API is serving requests leaves the database connection dead: every endpoint, including login, returns 500 until a restart (R2-002).

**Medium and Low (summary):**
* Credit-refund bookkeeping leaves the debt "open" and the customer balance at −18,000.
* A return matches only the first line of a repeated item.
* A damaged return writes no stock-ledger row or wastage record.
* The audit page shows raw English names and cannot filter the new rows.
* Restoring a pre-WAL archive silently switches the live database out of WAL until the next restart.
* The in-app guide states rules that are not enforced (purchase price below sale price, tax from shop settings, disabling accounts) and omits sales returns.
* Returns are open to the accountant while void is admin-only.
* Per-return rounding can over-refund by 1 agora.
* String-ordered numbering and millisecond-based lot numbers can collide (code review only).

### 9.4 Reading the two reviews together

Both reviews agree on the core accounting weaknesses, and his fixes are real progress on stock value, VAT posting and role checks (77 of 77 backend tests now pass, one more than before). Where they differ: his review stopped at the happy path, so several "fixed" items still fail under concurrency, deletes or the GL-engine mode. The new sales-return feature shipped with the same class of defect the audit found elsewhere: checks outside the transaction, gross refunds and no idempotency. None of the security holes in this audit were in his list or were fixed.

The recommended order in section 6 stands, with two changes. The return-then-void and concurrent-return defects join the P0 stock-integrity group. WAL-safe backups (using the database's own backup mechanism instead of copying the file) join the backup group.

### 9.5 Not re-tested after the merge

Five problems whose code the commit does not touch (QA-023, 024, 025, 027, 038), and the return feature under period lock, with branch-specific stock accounts, in PDFs and in the UI return dialog.

## Appendix — All 68 clusters

Evidence: 2+ = reproduced by two or more agents, 1 = one agent, IBR = deliberate decision that is still risky. After merge: result of the 26 Nov re-test of commit 6cc6d56.

| ID | Severity | Evidence | After merge of 6cc6d56 | Title |
|---|---|---|---|---|
| QA-001 | Critical | 2+ | NOT FIXED | Unauthenticated download of the whole database via a forgeable backup token |
| QA-002 | Critical | 2+ | PARTLY FIXED | Role checks not enforced on many controllers: an accountant can restore, import, download databases and edit tax rates |
| QA-014 | Critical | 2+ | NOT FIXED | Voiding a sale after a separate payment refunds the money twice (cash short, AR phantom) |
| QA-015 | Critical | 2+ | NOT FIXED | `POST /sales/:id/payments` records a payment with no journal entry, so it cannot be cancelled |
| QA-017 | Critical | 2+ | NOT FIXED | Expenses paid by bank transfer or card are taken from the cash drawer |
| QA-019 | Critical | 2+ | PARTLY FIXED | Purchase tax missing from the ledger; payables disagree four ways; supplier balance never decreases |
| QA-029 | Critical | 2+ | NOT FIXED | Count-based document numbers plus hard deletes permanently block purchases, expenses, lots and transfers |
| QA-042 | Critical | 2+ | PARTLY FIXED | Two lines of the same item in one sale oversell the same lot (negative stock) |
| QA-043 | Critical | 2+ | PARTLY FIXED | Stock adjustments ignore lots and use average cost, so lots, inventory and ledger drift apart |
| QA-044 | Critical | 2+ | FIXED | Stock transfer (cutting) creates or destroys inventory value with no journal entry |
| QA-050 | Critical | 2+ | NOT FIXED | Concurrent voids, payments and credit notes all succeed (checks happen outside the transaction) |
| QA-051 | Critical | 2+ | NOT FIXED | Lost updates: stock adjustments overwrite concurrent sales' decrements |
| QA-003 | High | 2+ | NOT FIXED | Restore/import validates nothing and cannot roll back: one bad archive bricks the system |
| QA-004 | High | 2+ | NOT FIXED | Backup files overwrite each other; retention can delete the newest backup; backups unencrypted, plaintext .bak left behind |
| QA-005 | High | 1 | NOT FIXED | Hard-coded fallback for the login signing secret |
| QA-006 | High | 2+ | NOT FIXED | Login lifecycle weaknesses: tokens survive logout/password change, refresh replayable, no lockout, weak passwords, IP not recorded |
| QA-007 | High | 2+ | NOT FIXED | Authorization lives in the UI, not the API (accountant sees cost/profit/supplier prices; page revocation ineffective) |
| QA-008 | High | 2+ | PARTLY FIXED | Discount cap, price override and approval controls not enforced |
| QA-009 | High | 1 | NOT FIXED | Sole admin can demote himself; setup can be re-opened and admin reset anonymously; settings API unvalidated |
| QA-013 | High | 1 | NOT FIXED | Tokens and passwords exposed on the client; script injection through the POS receipt |
| QA-016 | High | 2+ | NOT FIXED | Mixed-tender sale posts the whole paid amount to the first tender's account |
| QA-020 | High | 2+ | CHANGED, still wrong | Credit notes only adjust the ledger: invoice, debt and balance unchanged, customer can still pay in full |
| QA-021 | High | IBR | PARTLY FIXED | Debt write-off posts nothing to the ledger; payables write-off leaves supplier untouched |
| QA-022 | High | 2+ | NOT FIXED | Closed documents still accept payments; void and write-off each decrement the customer balance |
| QA-023 | High | 2+ | not re-run (code untouched) | Allocating an advance or reconciliation changes only the ledger; invoice stays unpaid and can be collected again |
| QA-024 | High | 2+ | not re-run (code untouched) | Several parallel sources of truth for receivables; dashboard counts voided and written-off debts |
| QA-026 | High | 2+ | PARTLY FIXED | VAT is booked as revenue and counted as profit; VAT report shows 0 |
| QA-027 | High | 2+ | not re-run (code untouched) | Printed tax invoice has no VAT line, no tax number and ignores credit notes |
| QA-028 | High | 2+ | PARTLY FIXED | GL/tax engine mode (flag ON) breaks postings: numbering collisions, taxed discounted sales rejected, silent round-off |
| QA-030 | High | IBR | NOT FIXED | Purchase edit/delete rewrites posted history; paid-at-creation purchases can never be corrected |
| QA-031 | High | 2+ | NOT FIXED | Manual journal entries accept invalid or unbalanced data and cannot be corrected |
| QA-032 | High | 2+ | NOT FIXED | Period lock/freeze barely enforced; no API to manage periods; journal dates differ from document dates |
| QA-033 | High | 2+ | NOT FIXED | Balance sheet and trial balance wrong: equity sign, as-of date used as start date |
| QA-034 | High | 1 | NOT FIXED | No year-end close or retained earnings; account ledger ignores opening balance |
| QA-035 | High | 2+ | NOT FIXED | "Profit and Loss" page disagrees with the ledger income statement |
| QA-036 | High | 2+ | NOT FIXED | Stock-vs-GL reconciliation report is unreliable and cannot detect real drift |
| QA-037 | High | 1 | NOT FIXED | Account mapping not validated: bank can point to revenue/AP/cash; accounts reclassifiable with history; some edits silently ignored |
| QA-038 | High | IBR | not re-run (code untouched) | Insufficient-cash guard (D-14) blocks legitimate work and is bypassable |
| QA-040 | High | 2+ | NOT FIXED | Negative, zero and fractional amounts accepted across purchases, expenses, payments, advances, adjustments |
| QA-045 | High | 1 | NOT FIXED | Cutting has no yield/loss concept; batch date and expiry not preserved |
| QA-047 | High | 2+ | NOT FIXED | Expired lots are sold and transferred; alerts and due dates are missing |
| QA-048 | High | 2+ | PARTLY FIXED | No opening balances or cash operations; opening stock has no journal |
| QA-052 | High | 2+ | NOT FIXED | Burst of concurrent sales causes 500 errors after a 6-second freeze |
| QA-053 | High | 2+ | NOT FIXED | No idempotency: double-click, retry or aborted request creates duplicate sales ("ghost sales") |
| QA-054 | High | 2+ | NOT FIXED | Date handling: reports shift a day in the shop's timezone and end dates are excluded |
| QA-055 | High | 2+ | NOT FIXED | POS tax estimate hard-coded at 15% regardless of the selected template |
| QA-056 | High | 2+ | NOT FIXED | Scale-barcode sales: label total discarded, some labels unsellable, line edits affect all lines of the item |
| QA-057 | High | 2+ | NOT FIXED | POS and payment form silently drop records beyond a page limit |
| QA-059 | High | 2+ | NOT FIXED | Number inputs treat a comma as decimal: "1,250.00" saves as 1.25 |
| QA-060 | High | 1 | NOT FIXED | Payment form crashes the whole app; accountants cannot read bank accounts; no error boundary |
| QA-064 | High | 2+ | not re-run (code untouched) | No automated tests for financial logic; build does not type-check |
| QA-010 | Medium | 1 | NOT FIXED | Inactive records cannot be listed or re-enabled |
| QA-011 | Medium | 2+ | PARTLY FIXED | Audit trail covers only a few actions |
| QA-012 | Medium | 2+ | NOT FIXED | Platform hardening: public API docs, leaked internals, vulnerable dependencies, 500 on bad input |
| QA-018 | Medium | 2+ | PARTLY FIXED | Expense posting defects: all categories and discounts go to 5400; expense edit/delete leaves the journal untouched |
| QA-025 | Medium | 2+ | not re-run (code untouched) | Customer statement changes its computation depending on whether the period has entries |
| QA-039 | Medium | IBR | NOT FIXED | Payment methods are free text; cheque/mobile and card-with-no-bank post to the cash box |
| QA-041 | Medium | 2+ | NOT FIXED | Sale-level validation gaps and 1-agora residues |
| QA-046 | Medium | 2+ | PARTLY FIXED | Wastage: no stock-ledger row, cannot be corrected, can create phantom stock, reachable by any user |
| QA-049 | Medium | 1 | NOT FIXED | Inactive items sellable and invisible in lists; per-branch inventory not implemented |
| QA-058 | Medium | 1 | NOT FIXED | POS weight rounding and discount input defects |
| QA-061 | Medium | 1 | NOT FIXED | Real backend error reasons hidden in about 50 UI call sites |
| QA-062 | Medium | 2+ | NOT FIXED | Purchase form totals computed in floats: "pay in full" fails or leaves 0.01 debts |
| QA-065 | Medium | 1 | not re-run (code untouched) | Dead or misleading settings and unvalidated configuration |
| QA-067 | Medium | 1 | not re-run (code untouched) | Requirements not implemented and master-data validation gaps |
| QA-063 | Low | 1 | not re-run (code untouched) | Minor UI defects: stale PDF dialog parameters, dead code, mislabels, cache invalidation |
| QA-066 | Low | 1 | PARTLY FIXED | Repository, documentation and currency hygiene |
| QA-068 | Info | 2+ | info | Test-data and harness facts (Info) |
