# Business Requirements & Expected-Behavior Oracle (K1)

> Author: K1 (Business & Requirements Analyst). Scope: INTENT (what the documents say the system must do), not what the code does.
> Where documents disagree, the "Expected" column states the **most authoritative / most recent intent** and the disagreement is listed in §7. Testers: when a test hits a §7 item, report against BOTH readings and check `decision-log.md` (K2).
>
> **Source key** (tags used below)
> - [FPRD] `Final PRD.md` — original owner PRD (butcher shop, 1–2 staff, 2 roles)
> - [PRD2] `MDs we done with it/Chicken_Shop_PRD.md` v2.0 2026-02-06 — detailed chicken-shop PRD (primary functional spec)
> - [PRDU] `app/frontend/docs/Chicken_Shop_PRD.md` v1.0 2026-02-04 — **different, older "Unified multi-vertical/multi-tenant" PRD** despite same filename (see §7 C-01)
> - [BRD] `MDs we done with it/Chicken_Shop_PRD_FULL.md` — short BRD
> - [APIP] `MDs we done with it/Unified_POS_Backend_API_Plan.md` v2.0 2026-02-07 ("authoritative API spec aligned with PRD v2.0")
> - [BLP] `backend_docs/business_logic_plan.md`; [CAP] `backend_docs/comprehensive_api_plan.md`; [API-nn] `backend_docs/API/nn-*.md`
> - [WST] `backend_docs/plan_of_wastage.md`; [PBC] `backend_docs/plan_purchase_by_category.md`
> - [GUIDE] `docs/ACCOUNTING_USER_GUIDE_AR.md` (2026-03-19)
> - [BP01..BP10] `accounting-migration-blueprint/` (01/01_chart_of_accounts_rebuild, 02_general_ledger_engine, 03/03_posting_workflow_control, 04_receivables_payables_engine, 05_tax..., 06_inventory..., 07_accounting_periods, 08_financial_reporting, 09_financial_architecture, 10_scalability_and_control)
> - [CPD] `FRONT_docs/COST_PRICE_DECISION.md`; [ICA] `FRONT_docs/INVENTORY_COST_ACCOUNTING.md`; [SCN] `FRONT_docs/SCENARIO_COST_AND_INVENTORY.md`
> - [NOTES] `notes.md`; [WUA] `docs/WEIGHT_UNITS_AUDIT_غم_vs_كغم.md`; [POSO] `POS_original.txt` (old POS React code)
> - Supplementary intent docs consulted (in `docs/`): [BANK] BANKS_AND_FUNDS_COMPREHENSIVE_PLAN, [ACCT] ACCOUNTANT_ADMIN_ROLES_PLAN, [DPA] DYNAMIC_PAGE_ACCESS_PLAN/_MIGRATION, [MIX] PARTIAL_PAYMENT_MIXED_PLAN, [CN] CREDIT_NOTES_IMPROVEMENT_PLAN, [BAR] BARCODE_SYSTEM_PLAN, [STF] STOCK_TRANSFER_FIX_PLAN

---

## 1. Business context

### 1.1 The business
- A small chicken / poultry retail shop ("محل دجاج / فروج", also described as butcher shop "ملحمة"), 1–2 employees, single shop initially, possibly more branches later [FPRD, PRD2 1.4]. Deployment evidence points to **Palestine, currency ₪ ILS/NIS** (WST, SCN, CPD "NIS/KG", POSO "₪", GUIDE "بنك فلسطين"); PRD2/API docs use SAR as the example and say single currency, configurable [PRD2 2.1]. Single currency only (multi-currency is a non-goal) [FPRD, PRD2, APIP].
- Arabic-first, RTL, English secondary [all PRDs].
- Desktop app (Tauri + React) talking to a NestJS + SQLite/Prisma backend; owner wants remote access "from anywhere" [FPRD].

### 1.2 Users / roles
| Role | Source | Intent |
|---|---|---|
| Owner / Admin (مالك/مدير) | all | Full access: sales, purchases, inventory, customers, suppliers, expenses, reports, settings, users, approvals. |
| Cashier (كاشير/بائع) | FPRD, PRD2, APIP | POS, customer list & debts, receive customer payments, own daily sales. Must NOT see profit, supplier info/prices, cost, expenses, detailed financial reports [FPRD, PRD2 3.2]. |
| Accountant (محاسب) | [ACCT] (later plan) | **The cashier role renamed to `accountant`** (same restricted user, new name), plus shared access to payments, reconciliation, credit notes, accounting journal (view + manual JE "per permissions"), sales/inventory/purchase/wastage reports. Admin-only pages listed in §5. |
| Manager / Purchaser / Viewer / separate Accountant | [PRDU], [BRD] | Exist only in the older multi-vertical PRD/BRD — NOT intended for this product (PRD2: "two roles only, cannot create custom roles"). |

### 1.3 Real-world operations the system must model
- **Weight-based selling only** — everything by kg (stored as grams), no piece selling [PRD2]. (BRD/PRDU allow per-piece/fixed price; superseded.)
- **Digital scale** integration required; manual weight entry only with admin override, logged [PRD2 5.2, 7.2.19]. **Scale barcodes**: custom 25-digit variable-weight barcode: start `2` + item code(6) + weight grams(5) + total price with tax(7) + price(5) + check digit(1) [BAR]; scanning adds the item with the encoded weight (and encoded price, if present) [BAR §T7].
- **Purchasing by category / raw chicken**: the shop buys "raw chicken" (دجاج خام, item `CHK-RAW-01`, category `CHICKEN_RAW`) by weight from traders/suppliers; it does NOT buy finished cuts [WST 1.2, PBC].
- **Cutting = stock transfer** (تحويل المخزون): a raw-chicken lot (or, per [STF], any product lot) is converted into sellable products (wings, breast, thighs, whole…) — each destination gets its own lot with cost and expiry [WST 2–4, STF, FPRD "whole chicken to chicken breasts", NOTES "replace adjustments page with item transfer page"].
- **Live bird purchasing** (optional/legacy in PRD2): gross live weight vs net usable weight, shrinkage % = (gross−net)/gross×100, real cost/kg = line total / net weight; lot created with NET weight at real cost [PRD2 5.1.4].
- **Shelf life / expiry**: fresh 2 days, frozen 90 days, processed 7 days (configurable); expiry alerts; lots near expiry prompt "move to wastage or keep selling" [PRD2, WST 6].
- **Wastage / spoilage** daily (spoilage, trimming, expired, damaged, end_of_day, other) with mandatory reason; it is an expense [PRD2, WST 7].
- **Credit customers** (آجل): debts, partial payments, installments, credit limit, statements, overdue/aging [FPRD, PRD2].
- **Supplier credit**: purchase on credit/partial, supplier payments by cash, bank, **cheque** [FPRD "cash, deferred, or by cheque"].
- **Cash box + bank accounts**: cash box account 1111 (الصندوق); bank accounts under 1112 "النقد في البنك" as 1112-NNN, created from Settings → Bank accounts; bank transfer/card payments must select a bank account [GUIDE §3, §7; BANK].
- **Branches**: main branch auto-created at setup; at least one active branch; per-branch inventory and reports [FPRD, PRD2].
- Expenses (rent, electricity, gas, salaries…) [BRD].

---

## 2. Workflows & expected outcomes (incl. side-effects)

Notation: **Inv** = lots/inventory; **Party** = customer/supplier balance & debts; **Cash/Bank**; **JE** = journal entry. Account names are canonical; codes per COA seed per [BP01 §6.4, GUIDE, BANK]: Cash box 1111, Bank 1112-NNN, AR 1130, Inventory 1200, Fixed assets 1300, AP 2110 (21xx), VAT payable 2120, Capital 3100, Retained earnings 3200, Sales revenue 4xxx (4010), COGS 5100 (51xx), Opex 52xx, Wastage 525x/53xx (5300 per WST), Inventory adjustment 5320 [BP06], Discounts 54xx, Round-off 5290 [BP02]. **Codes are conflicting across docs (§7 C-13) — verify against seed / K3 posting-map; test the account *type*, not only the code.**

General posting rules (all documents) [BP02, BP03, API-11, CAP]:
- Every financial event creates a balanced JE (Σdebit = Σcredit), linked to its source (sourceType/sourceId).
- Posted documents are immutable; cancellation = reversal JE (debit↔credit swap), never deletion or edit; no double reversal.
- No posting to group accounts, inactive or frozen accounts [BP01 §4.6].
- Operational record + stock + subledger + JE succeed or fail atomically (each spec wraps in `$transaction`).

### 2.1 First-time setup wizard [FPRD, BLP, API-01, API-12 §12.10]
1. `GET /auth/check-setup` (public) → `setupCompleted:false` on fresh install.
2. `POST /auth/setup` (public) with businessName (+En), adminUsername (≥3), adminPassword (≥8), adminFullName, preferredLanguage.
3. Expected in ONE transaction: main branch created (code `MAIN`, isMainBranch, active); admin user with admin role, default branch = main; settings `setup_completed=true`, business name(s), `setup_completed_at`; audit log `setup_complete`; returns tokens → auto-login to admin dashboard.
4. **Can only run once** — second call → 409 `SETUP_ALREADY_COMPLETE`. Before setup, protected APIs → `SETUP_NOT_COMPLETE` [API-00].
- PRD2 10.5 wishes the wizard to also cover branches, users, initial inventory (not specified in APIs).

### 2.2 Auth, users, roles [FPRD, PRD2 7.2.21, APIP 4.2/6.1, API-01/02, BLP]
- Login username+password; inactive user → `USER_INACTIVE`; bad creds → `INVALID_CREDENTIALS`. Access token 15 min, refresh 7 days [APIP]; PRD2: session timeout 8 h. Rate limit 5 attempts/min, lockout after 10 failures for 30 min [APIP 6.1].
- Change password requires old password, min 8 chars, clears all sessions/refresh tokens. Login screen "change password" link for cashier → message "ask the admin" (`GET /auth/password-reset-policy` requiresAdmin) [FPRD, BLP].
- Admin creates users (full name, username unique, password ≥8, role admin|cashier/accountant, default branch, language); admin resets any password (clears sessions, audit) [FPRD, API-02 §2.9].
- Users page shows name, username, role, branch, active, last login, **logged-in status**, work start date [FPRD].
- Users are never deleted, only deactivated; cannot deactivate self; **cannot deactivate the last active admin**; at least one active admin always [PRD2, APIP, API-02 §2.8]. Deactivation clears sessions.
- Logins/logouts, password changes/resets audited.

### 2.3 Branches [FPRD, BLP, API-03]
- Admin-only CRUD; code unique (`DUPLICATE_ENTRY`); main branch cannot be deactivated; last active branch cannot be deactivated. Branch has scale config (hasScale, COM port).
- Inventory tracked per branch; reports filterable by branch; users assigned a default branch; admin controls branch access [FPRD].

### 2.4 Items & categories [PRD2, API-12, PBC, CPD/ICA/SCN]
- Item: code unique, barcode unique (optional), name AR (+EN), category, default sale price per kg, **expected purchase price per kg** (reference only), min/max stock (grams), shelf life, storage location, requiresScale.
- No "cost price" field on item. **Displayed cost** = `inventory.average_cost` if qty>0 else `items.default_purchase_price`; expected purchase price **never** used in valuation, COGS or P&L [CPD §5, SCN Part 4].
- Optional **opening stock** on item creation (qty + opening cost) → creates first lot once [SCN Part 3]. Expected accounting: Dr Inventory / Cr opening-balance equity (not specified in docs → lead, §8).
- Category cannot be deleted if it has items or children [API-12 §12.6]. Purchaseable categories map to a purchase item (`purchaseItemId`) [PBC].

### 2.5 Sale (POS) [FPRD, PRD2 5.2/7.2.2, APIP 4.7, CAP 5.1, API-05, MIX, POSO]
Steps: select item (button/search/barcode) → weight from scale (or admin-approved manual weight) → price/kg (default; override admin-only per PRD2) → line discount → sale discount → tax (if enabled/template chosen) → payment type → save → receipt.

Calculations (expected):
- line gross = round(weightGrams × pricePerKg / 1000) (minor units); line net = gross − line discount.
- subtotal = Σ line net; afterDiscount = subtotal − sale discount.
- **tax = round(afterDiscount × taxRateBp / 10000)** (exclusive; on net AFTER discount) [CAP 5.1, POSO, PRD2 7.2.2 example 150 −7.50 → tax 21.38 → 163.88; but see §7 C-08].
- total = afterDiscount + tax. Profit = **net revenue (ex-VAT)** − FIFO cost (see §7 C-09).

Validations:
- weight > 0 (`SCALE_REQUIRED` / zero weight blocked); item active; branch exists.
- **Cannot sell more than available stock** (AllowNegativeStock default false) → `INSUFFICIENT_STOCK` with available qty [FPRD, PRD2, APIP].
- Expired lots: CAP/API-05 exclude expired lots from allocation / block (`EXPIRED_STOCK`); FPRD "block"; PRD2 "warning, admin override".
- Cashier discount max 5% (setting `pos.cashier_max_discount_pct`), admin unlimited → `DISCOUNT_LIMIT_EXCEEDED`; discount ≤ item price.
- Credit / partial / mixed requires a customer → `CUSTOMER_REQUIRED`; credit limit check → `CREDIT_LIMIT_EXCEEDED` (admin override with reason).
- Paid amount ≤ total (`INVALID_PAYMENT`); partial: 0 < paid < total.

Payment types: cash (fully paid, change computed), bank/card (must choose bank account [GUIDE §7, BANK]), credit (paid 0), partial/mixed (cash or card part + remainder deferred) [MIX]. Backend treats "mixed" as cash with payments < total; the remainder auto-becomes debt [MIX §1.4/§2].

Side-effects:
- **Inv**: FIFO allocation oldest `receivedAt` first (or nearest expiry, WST 3.3) across lots; one SaleLineCostAllocation per lot touched; lot remaining −= allocated; inventory aggregate qty −= line qty; stock movement (sale, −qty) per lot; SLE (−qty, −cost) [BP06].
- **Party**: if amountDue > 0 → Debt (receivable) for customer, due date = sale date + default credit days; customer balance += due.
- **Cash/Bank**: cash part to cash box (1111), bank/card part to chosen bank 1112-NNN.
- **JE** (one sale voucher):
  - Dr Cash 1111 (cash paid) / Dr Bank 1112-x (bank paid) / Dr AR 1130 (amountDue, party=customer)
  - Cr Sales Revenue 4xxx (net, ex-VAT, after discount — or gross with Dr Discounts 54xx; see §7 C-10)
  - Cr VAT Payable 2120 (tax) [BP05 §6]
  - Dr COGS 5100 / Cr Inventory 1200 (Σ FIFO allocation cost)
- Sale number SAL-xxxx unique, sequential; receipt printed (business name, sale#, date, items, totals, paid, remaining/deferred [MIX 1.5]).
- Cashier sees only own sales; cost/profit fields hidden from cashier responses [CAP, API-05].

### 2.6 Sale void / cancel [PRD2 5.3/6.6, APIP, CAP 5.4, API-05 §5.5, BP03 §4]
- Admin only; reason required; not twice (`SALE_ALREADY_VOIDED` / `ALREADY_CANCELLED`); blocked in closed period [BP03]; APIP: blocked after end-of-day close; CAP: 24 h window and blocked if payments exist (conflict §7 C-11).
- Expected: lots restored **to the exact original lots** from cost allocations (+qty), status available; stock movement (+, reason sale void); every linked payment cancelled with its own GL reversal (BP03 Option A); debt cancelled / customer balance reduced by remaining; **reversal JE of the whole sale voucher (revenue, VAT, cash/AR, COGS/inventory)**; status cancelled with who/when/why; audit log. Records never deleted.
- Net effect after void = zero on stock qty, lot remaining, inventory value, AR, customer balance, revenue, VAT, COGS, cash.

### 2.7 Customer return / credit note [FPRD, PRD2 5.3, CAP 9.1, API-09, BP04 §8, BP05 §8, CN]
- Return linked to the original sale line; qty ≤ sold − previously returned (`EXCEEDS_QUANTITY`); refund value = original unit price × qty (automatic) [FPRD]; reason required; customer gets a return receipt [FPRD].
- Condition good → restock as new lot (RET-…) at original FIFO cost (proportional cost of the line); damaged/expired → wastage.
- Refund: cash (Cr Cash) or credit to account (Cr AR, reduces debts).
- JE: Dr Sales Returns (contra revenue) net + Dr VAT Payable tax / Cr Cash or AR (gross); restock: Dr Inventory / Cr COGS (returned cost); damaged: Dr Wastage expense / Cr COGS.
- Sale status partial_return / returned.
- **Credit note** (BP04/CN): independent document against an open invoice of a customer (sale) or supplier (purchase); amount ≤ invoice outstanding; draft → submit; on submit GL + payment-ledger entry reduce outstanding; Outstanding = Invoice − allocated payments − credit notes.

### 2.8 Purchase (receive, cash/partial/credit) [FPRD, PRD2 5.1, APIP 4.8, CAP 6.1, API-06, PBC, BANK]
- Admin only (PRD2/APIP; CAP lets cashier — §7 C-05). Supplier required & active; ≥1 line; price > 0; quantity in grams; purchase by category item (raw chicken).
- Totals: line = round(grams × pricePerKg/1000) − line discount; total = subtotal − discount + tax.
- Payment method cash / bank_transfer / card (+ bank account) / check / credit / partial [BANK].
- Draft → approve/receive (PRD2: "Save draft" / "Save & receive"; BP03: GL only at submit/approve).
- On receive: InventoryLot per line (lot number, receivedAt, expiry = received + shelf life, storage location, supplier, qty, unit cost); stock movement +; inventory qty/value +, average cost recomputed [ICA]; partial receive keeps purchase open.
- Party: amountDue > 0 → supplier payable/debt; supplier balance += due.
- JE: Dr Inventory 1200 (net of recoverable VAT) + Dr VAT Receivable (input VAT) / Cr Cash 1111 or Bank 1112-x (paid) + Cr AP 2110 (due, party=supplier) [BP05 §7, BP06 §7].
- Disbursement checks: cash/bank paid part requires sufficient balance → `INSUFFICIENT_BALANCE` [BANK §3].
- Live bird variant: lot qty = net weight, unit cost = total/net, shrinkage stored in metadata and wastage record with EstimatedCostValue = 0 (cost absorbed into lot) [PRD2 5.1.4].
- Cancel purchase (API-06 §6.9): admin; only if no lot quantity consumed (`INVENTORY_ALREADY_USED`); lots zeroed/cancelled; supplier balance reduced; reversal JE; linked payments cancelled (BP03).

### 2.9 Purchase return (رد المشتريات) [FPRD, CAP 9.1, WST §5]
- Linked to original purchase and specific lot; qty ≤ lot remaining; reason required.
- Inv: lot remaining −qty, SLE/stock movement −, voucher `purchase_return`.
- JE: Dr AP (credit) or Dr Cash/Bank (refund) / Cr Inventory (at lot cost) (+ Cr VAT Receivable if taxed). Supplier balance decreases.

### 2.10 Supplier payment [FPRD, APIP, API-08 §8.5, BP03]
- Admin only. Method cash / bank / card / cheque (+ reference no.). Amount ≤ supplier balance (`AMOUNT_EXCEEDS_BALANCE`) [API-08] (CAP allows overpayment → advance, §7 C-07). Sufficient cash/bank balance required [BANK].
- Allocates to oldest payables (or chosen invoices); updates purchase paid/status.
- JE: Dr AP 2110 / Cr Cash 1111 or Bank 1112-x.

### 2.11 Customer collection (debt settlement) [FPRD, PRD2 5.5, API-08 §8.1, BP04]
- Admin and cashier. Method cash / bank_transfer / check. Allocation manual (debtIds/amounts) or automatic oldest due date first; allocation ≤ debt remaining; Σallocations ≤ payment amount.
- Debt remaining −= allocated; status unpaid → partial → paid; sale paymentStatus updated when fully paid; customer balance −= amount.
- JE: Dr Cash/Bank / Cr AR 1130 (party=customer). Payment number PAY-xxxx.

### 2.12 Payment cancellation [API-08 §8.4, BP03 §5, BP10]
- Admin only; reason; not twice; not in closed period.
- Debts restored (remaining += allocated, status recomputed), customer/supplier balance restored, sale/purchase paid amounts restored, payment status cancelled (who/when/why), **reversal JE created** ("critical defect" if missing per BP03), audit log.

### 2.13 Debts (receivables/payables) [PRD2 4.2.5, API-07, BP04]
- Auto-created from credit/partial sales and purchases; manual debt (opening balance) admin-only, respects credit limit; cancel debt admin-only, only if no payments.
- Lists: receivables/payables, overdue, aging buckets (current, 1–30, 31–60, 61–90, 90+); customer statement = opening balance + sales − payments ± returns = closing balance; supplier statement analogous.
- Target model (BP04): outstanding must be **derived** from a payment ledger, not stored; stored `amountPaid` must equal sum of allocations.

### 2.14 Expenses [PRD2 5.6, APIP 4.13, BANK]
- Admin only. Category (linked to expense GL account), amount, description required, date, payment method (+bank), optional supplier/attachment. Approval if amount > threshold.
- JE: Dr Expense account (52xx) / Cr Cash/Bank; unpaid → Cr AP/accrued (+ debt OwedByMe). Insufficient balance check for cash/bank.

### 2.15 Wastage [PRD2 4.2.2/5.4/7.2.11, APIP 4.6, API-09 §9.3, WST §7]
- Item + lot (or FIFO oldest), weight grams > 0, type (spoilage|trimming|expired|damaged|end_of_day|other), reason required, optional photo. Qty ≤ lot remaining (`INSUFFICIENT_QUANTITY`).
- Recorded by admin (PRD2) — CAP: cashier may record, pending approval, GL on approval.
- Inv: lot remaining −, inventory qty/value −, stock movement/SLE (wastage).
- Value = qty × lot unit cost (FIFO). JE: Dr Wastage expense / Cr Inventory.
- Expiry notification action "move to wastage" creates the record + JE [WST 6.3].

### 2.16 Stock adjustment [PRD2 5.4/7.2.10, API-04 §4.4, ICA, SCN, BP06 §8]
- Admin only; reason required; PRD2: physical count vs system → difference; manager approval.
- Decrease: FIFO from oldest lots; value removed; JE Dr Inventory adjustment/loss (5320) / Cr Inventory.
- Increase: new adjustment lot (LOT-ADJ-…) at entered unit cost; if no cost and stock > 0 use current average cost; if stock = 0 and no cost → error "cost required" [ICA]. JE Dr Inventory / Cr Inventory adjustment (income or reversal).
- BP06 calls missing GL on adjustments a defect: every adjustment must hit GL.

### 2.17 Stock transfer / cutting (product transformation) [FPRD, WST §2–4, API-04 §4.5, STF, CAP 4.4]
- Admin only. Select source lot (any product with remaining stock per STF; originally raw chicken only); distribute kg to one or more destination items; Σ destination kg ≤ source available.
- Expiry: chosen at transfer (default from category/item shelf life), optional per STF (falls back to source lot expiry). FPRD: "preserving original batch date".
- Cost: destination lot cost inherited from source (API-04) or allocated proportionally / by default price with manual adjustment (WST 4.2, STF has per-line "cost/kg").
- Inv: source lot −, destination lots created, stock movements both sides, SLE voucher `stock_transfer`.
- **Accounting: neutral** — inventory to inventory at same total value; no P&L effect; if raw and finished share one inventory account, no JE / net-zero JE [WST 4.3, API-04, CAP].
- Inter-branch transfer (PRD2 5.4/APIP) is a different concept: lots move branch, two stock movements, GL only if branch stock accounts differ [BP06 §10].

### 2.18 Bank accounts, deposits, transfers [GUIDE, BANK]
- Bank account = chart account under 1112 (type Bank, asset) + BankAccount record; one may be default for bank transfers. Deleting a bank account record does not delete the GL account.
- Bank/card payments post to the selected bank's account; cash without bank → 1111 [BANK §5].
- Balance of cash/bank = Σ(debit − credit) of posted JEs; disbursements must not exceed balance (`INSUFFICIENT_BALANCE`); receipts need no check [BANK §3.3].
- Cash→bank deposit / bank→bank transfer: not specified by any doc except via manual JE (Dr Bank / Cr Cash) — lead §8.

### 2.19 Manual journal entries [APIP 4.14, API-11 §11.4, GUIDE §4]
- Lines: account (ledger/non-group), debit XOR credit, ≥2 lines, Σdebit = Σcredit (`DEBIT_CREDIT_MISMATCH`/`UNBALANCED_ENTRY`); amounts entered in minor units ("فلس").
- Created as **draft**; "post" makes it count in TB/reports; after posting no edit/delete — only reverse (reversal entry, original marked reversed). Draft JEs excluded from reports [BP08 PostedOnlyGuard].

### 2.20 Accounting periods & closing [PRD2 5.7, BP03 §7, BP07]
- Fiscal year (default calendar year, FiscalYearStart setting) with monthly/quarterly periods; every JE linked to its period by posting date.
- Closed period / freeze date: no posting, no cancel/reversal, no edit with a date in it (`PERIOD_LOCKED`, `FREEZE_DATE`); reopen requires special permission.
- Year-end: Period Closing Voucher closes all income/expense accounts to Retained Earnings (3200); P&L accounts zero after close; next year opens with balances.
- End of day (Z report): opening cash + cash sales + collections − refunds − withdrawals = expected; counted cash; variance (explanation if > threshold); day locked (no backdated edits / voids) [PRD2 5.7, APIP].

### 2.21 Reports [PRD2 §8, API-10, BP08, APIP 4.15]
- **Official financial reports come only from posted GL** (BP08): Trial balance (Σdebit = Σcredit), P&L (income/expense accounts, period), Balance sheet (Assets = Liabilities + Equity, current-period profit included in equity), Cash flow (cash/bank accounts), General ledger / account ledger with running balance (opening + movements = closing).
- P&L: revenue (net of returns & discounts), COGS (FIFO), gross profit & margin, operating expenses, wastage, net profit & margin.
- Inventory valuation = Σ lot remaining × unit cost (FIFO), per item/category/branch; must equal Inventory GL [PRD2 6.4]; Stock-vs-GL reconciliation report [BP06 §9].
- Others: daily sales / Z report (cashier: own only), sales by item/category/cashier/customer, top items, profit by item, wastage report (value, % of COGS), live-bird shrinkage report, AR aging, overdue debts, customer & supplier statements, cashier performance (sales, discounts, voids), stock movements, low stock, expiring lots, VAT summary (output − input), dashboard (today's sales/profit, receivables, payables, inventory value, low stock, wastage today).
- Exports PDF / Excel / CSV with business name, title, parameters, generated at/by [PRD2 8.3]. Accounting page prints Balance sheet, Income statement (current month), Trial balance (current date) PDFs [GUIDE §6].
- Units in reports: weights shown in **kg** (API returns grams; UI divides by 1000) [WUA].

### 2.22 Settings, backup/restore, audit [PRD2, APIP, API-12]
- Settings admin-only; unknown key rejected; type-validated; every change audited (old/new value).
- Backup: admin-only `POST /system/backup`; daily automated, encrypted, off-site; restore procedure documented; RTO < 1–4 h, RPO < 24 h [PRD2 10.4, APIP 7.3].
- Audit log: logins/logouts, sale create/void, purchase create, payments, adjustments, wastage, user and settings changes, manual weight entries, password changes; immutable; retention 5 years [PRD2 10.3].

### 2.23 Alerts
- Low stock (below min), expiring lots (fresh within 1 day, frozen within 7 days; `inventory.expiry_alert_days` = 7), overdue debts, abnormal shrinkage > 30%, "stack about to get empty" [NOTES], scale not responding [PRD2].

---

## 3. Costing method (intended)

| Source | Statement |
|---|---|
| PRD2 header, 1.4, 2.1, 6.4, 7.2.18, 11.10 | **FIFO, fixed, not configurable.** COGS = sum of allocated qty x lot unit price. Period-end inventory value = sum(lot remaining x unit price) and "should match Inventory account balance". 6.4 also offers weighted average "if FIFO complexity is too high" (alternative). |
| APIP 2.3, CAP, API-00/04/05 | FIFO, oldest `receivedAt` first, per-lot cost allocations. API-00 says "calculate weighted average cost" of allocated lots per line (= FIFO line cost / qty; display only). |
| WST 3.3 | FIFO "by oldest expiry **or** receivedAt" (FEFO ambiguity). |
| PRDU 2.3.4 | FIFO implemented; LIFO/Average future. |
| BP06 §11 | Keep FIFO; `averageCost` is a cached **display-only** indicator, not used for accounting. |
| ICA / SCN | Lots + FIFO for sales, BUT `inventory.total_value` decreased **proportionally** (average) on adjustment decrease; increase without unit cost valued at average cost; SCN calls average cost "the cost the system uses for accounting and display" -> mixed FIFO/average (§7 C-04). |
| CPD | Valuation only from actual movements (lots); expected purchase price never used. |
| PRD2 5.1.4 | Live bird: per-lot real cost = total / net weight. |
| API-04 / WST / STF | Transfer: destination lot cost inherited from source (per unit) or allocated / user-entered per line. |

**Oracle:** FIFO per lot (perpetual). Expected COGS of a sale = sum over allocations of round(allocGrams x lotUnitCostPerKg / 1000). Inventory value = sum over lots of round(remainingGrams x unitCost / 1000). Average cost is display only.

## 4. Unit & value conventions (intended)

| Quantity | Intended convention | Sources / conflicts |
|---|---|---|
| Money | Integer **minor units x100** (2 decimals; 2500 = 25.00) | APIP 5.3, POSO toMinor x100, BP02 §5 (precision 2 default; KWD/BHD 3), BP05 §5, charter. **Conflict:** API-05..10 examples use x1000 ("8000 = 8.000 SAR", fils); API-12 `regional.decimal_places=3`; GUIDE says JE amounts entered in "فلس" (fils). |
| Currency | Single currency; ₪ ILS in practice; SAR default in specs; symbol configurable | PRD2 2.1, APIP; UI ₪ |
| Weight | Integer **grams** in storage/API; display **kg** (3 decimals); prices are **per kg** | APIP 5.3, WUA, PRD2 (kg fixed). Barcode encodes grams (5 digits). POSO used kg with 2 decimals, min 0.1 kg. |
| Line amount | round(grams x pricePerKg / 1000) | derived |
| Percent | **Basis points** (1500 = 15%) for tax rate, discount %, shrinkage % | APIP 4.4/4.7/4.16, CAP tax/10000, BP05 |
| Tax | Exclusive, on net after discount, rounded per tax row then summed; precision 2 | CAP 5.1, BP05 §5, POSO |
| Rounding | `Math.round` per line/row; GL tolerance + round-off account 5290 [BP02 §5]; allocation remainder -> last invoice / write-off [BP04 §6] | |
| Dates | ISO 8601 UTC | APIP |
| Numbering | SAL-, PUR-, PAY-, SPAY-, RET-, WST-, JE-, LOT-YYYYMMDD-NNN, ADJ-/TRF-/RET- lots, C0001/S0001 | API-00 |
| Default credit days | 30 [PRD2, CAP] vs 7 [API-05/07/12] | §7 C-06 |

## 5. Permission model (intended)

Two roles: **admin** (everything) and **cashier** (= later renamed **accountant** [ACCT]). Permissions enforced on **backend API and UI** [PRD2 11.1, 11.9]; UI hiding alone is not security.

Cashier/accountant MUST NOT [FPRD, PRD2 3.2, APIP 6.2, API-00, CAP, ACCT 3.1]:
- see profit, margins, cost prices, FIFO allocations, lot cost, inventory value, supplier prices / supplier info;
- see or record expenses; see financial reports (P&L, balance sheet, stock-vs-GL, tax/VAT), profit dashboard widgets;
- create/receive/approve purchases (PRD2/ACCT; CAP disagrees), manage suppliers, make supplier payments, see payables;
- adjust inventory, transfer stock, approve wastage (PRD2: not even record wastage);
- void/edit/delete sales, override price (PRD2), give discount > 5%, enter manual weight without admin password;
- edit customers or set credit limits (PRD2: create/view only);
- access settings, users, branches, audit log, backup;
- view other cashiers' sales (own only).

Cashier/accountant MAY: POS sales (cash/credit/partial), create customers, view customers & debts, receive customer payments, view stock levels (no cost), print receipts; per ACCT also payments/reconciliation/credit notes, accounting journal view + manual JE "per permissions", sales/inventory/purchase/wastage reports (no cost).

Dynamic page access [DPA]: admin toggles which pages each accountant (per-user `user_page_access`) can open; returned as `allowedPages` on login and `/auth/me`; **DPA says it is UI-only and "backend remains role-based"** (§7 C-15).

## 6. System invariants (testers must check)

Accounting / GL
- I-01 Every posted JE balances: sum(debit) = sum(credit) (exactly, or with documented round-off line to 5290). [all; BP02]
- I-02 Trial balance balances at any as-of date, including after voids, reversals, period close. [API-11, GUIDE §5]
- I-03 Balance sheet: Assets = Liabilities + Equity (+ current-period net income) at any date. [API-11 §11.6, BP08]
- I-04 No JE line on a group, inactive or frozen account. [BP01]
- I-05 Every financial document (sale, purchase, payment, supplier payment, expense, wastage, adjustment, return, credit note, purchase return, manual debt, opening stock) has >=1 JE with matching sourceType/sourceId; no duplicate posting. [BP03, BP10]
- I-06 Every cancel/void produces a reversal mirroring **all** original JE lines of that voucher (incl. VAT, COGS, every payment); original marked reversed; no double reversal. [BP02 §8, BP03 §6]
- I-07 Posted JEs are never edited or deleted via any API. [BP02, GUIDE §4]
- I-08 Draft JEs do not affect TB/P&L/BS/ledgers. [BP08]
- I-09 Financial reports equal what is derivable from posted GL lines; operational reports (dashboard, sales summary) reconcile to GL revenue/COGS for the same period. [BP08]
- I-10 Account ledger: opening + movements = closing; closing(N) = opening(N+1). [API-11 §11.7]
- I-11 No posting, cancel or reversal dated in a closed period or before freeze date. [BP03 §7, BP07]
- I-12 After year-end close, income/expense balances for the year are zero and net income is in Retained Earnings. [BP07 §8]
- I-13 Operational change and its JE are atomic: no document without JE, no JE without document. [BP09 risk]

Inventory
- I-14 Inventory GL balance = sum(lot remainingGrams x unitCost/1000) = inventory valuation report (within rounding tolerance). [PRD2 6.4, BP06 §9]
- I-15 Per item/branch: inventory.currentQuantityGrams = sum(lot remainingGrams). [PRD2]
- I-16 Per item: inventory.totalValue = sum(lot values) (no average-vs-FIFO drift). [ICA vs BP06]
- I-17 0 <= lot remaining <= lot initial; no negative stock when AllowNegativeStock=false. [PRD2]
- I-18 Cannot sell / waste / transfer / adjust-down / purchase-return more than available (per lot and item/branch), also under concurrent requests. [FPRD, APIP, BP10]
- I-19 Signed stock movements per lot sum to lot remaining; per item to current qty. [API-04]
- I-20 FIFO: a sale never consumes a newer lot while an older non-expired lot of the same item/branch has stock. [PRD2 5.2]
- I-21 Sale line cost = sum of its allocations; sale totalCost = sum of line costs = COGS JE amount. [PRD2 5.2]
- I-22 Expired lots not allocated to sales (or only with logged admin override). [CAP, FPRD]
- I-23 Stock transfer is value-neutral: sum(destination lot values) = source value consumed; Inventory GL unchanged; no P&L impact. [WST 4.3, API-04]
- I-24 Destination grams total <= source grams consumed. [WST 4.2]
- I-25 Wastage value = consumed grams x lot cost; Dr Wastage = Cr Inventory = that value. [API-09]
- I-26 Every stock adjustment hits GL with value = lot value change. [BP06 §1, §8]
- I-27 Live-bird lot: qty = net weight, unit cost = total / net; shrinkage % = (gross-net)/gross. [PRD2 5.1.4]
- I-28 Displayed item cost = avg cost if qty>0 else default purchase price; default purchase price never in COGS/valuation. [CPD]

Receivables / payables / cash
- I-29 AR control (1130) = sum of customer outstanding (debts / payment ledger) = sum of customer balances = AR aging total. [BP04]
- I-30 AP control (2110) = sum of supplier outstanding = sum of supplier balances. [BP04]
- I-31 Customer.currentBalance = sum of open debt remaining (stored = derived). [CAP 7.1, BP04 §5]
- I-32 Sale.amountPaid = sum of non-cancelled allocations to it; amountDue = total - paid; status consistent. [BP04]
- I-33 Debt remaining = original - allocations - credit notes; never < 0; status consistent. [API-08, BP04]
- I-34 Payment allocations sum <= payment amount (= unless an explicit advance/credit balance exists). [API-08, BP04 §6]
- I-35 Customer statement: opening + sales - payments - returns/credit notes = closing = current balance. [API-07 §7.8]
- I-36 Cash box / bank balances never go negative through a disbursement (INSUFFICIENT_BALANCE). [BANK §3]
- I-37 Bank/card amounts post to the selected bank account, cash to 1111, never to group 1112. [GUIDE, BANK]
- I-38 Every credit/partial sale has a customer record on the debt and AR line (party). [API-05, MIX]
- I-39 Customer outstanding <= credit limit unless an admin override is logged. [PRD2]

Sales / tax
- I-40 Sale total = sum(line nets) - sale discount + tax; amountPaid + amountDue = total. [PRD2, CAP]
- I-41 Revenue posted ex-VAT; VAT Payable credit = sale tax; VAT report output = sales tax - returns, input = purchase tax. [BP05]
- I-42 A voided sale leaves zero net effect on stock (same lots), AR, customer balance, revenue, VAT, COGS, cash/bank. [PRD2 5.3, BP03]
- I-43 Returned qty per line <= sold qty; return reverses revenue, VAT, COGS proportionally; restocked lot value = returned cost. [API-09]
- I-44 Profit = net revenue (ex-VAT) - FIFO COGS; P&L gross profit reconciles with sale profits net of returns. [PRD2 6.3/5.2]
- I-45 Cashier discount <= 5% (setting) and never > line amount; cashier cannot override price. [PRD2]
- I-46 Document numbers unique per prefix, no duplicates under concurrency. [API-00]

Security / admin
- I-47 Cashier/accountant API responses never include cost, profit, lot cost, supplier prices; forbidden endpoints return 403 regardless of UI. [PRD2 11.9, CAP]
- I-48 At least one active admin and one active branch always; main branch cannot be deactivated. [PRD2, BLP]
- I-49 Setup can run exactly once. [BLP]
- I-50 Password change/reset/deactivation invalidates existing sessions/refresh tokens. [API-01/02]
- I-51 Settings changes, voids, adjustments, manual weights, password resets leave immutable audit records. [PRD2 10.3]
- I-52 Backup then restore yields an identical consistent DB (I-02, I-14, I-29, I-30 still hold). [PRD2 10.4]
- I-53 Weights shown to users in kg; API in grams; no x1000 display errors. [WUA]

---

## 7. Contradictions / ambiguities between documents (audit leads)

- C-01 **Two different PRDs share the name `Chicken_Shop_PRD.md`.** `app/frontend/docs/` holds v1.0 (2026-02-04) "Unified multi-vertical, multi-tenant" PRD: 6 roles (Manager/Purchaser/Accountant/Viewer), ILS, inclusive/exclusive tax, kg+piece UoM, "no double-entry ledger, implicit postings", "waste does NOT affect profit", void/return "not implemented", edit/delete sale allowed before payment. `MDs we done with it/` holds v2.0 (2026-02-06) chicken-only, 2 roles, kg only, full double-entry, waste = expense. The frontend team may have built against the obsolete one.
- C-02 **Money minor units x100 vs x1000.** APIP/POSO/BP02/BP05 = 2 decimals; API-05..10 examples (`8000 = 8.000 SAR`) and API-12 `regional.decimal_places=3`; GUIDE "فلس". Any UI/PDF/report dividing by 1000 vs 100 inconsistently will misstate money 10x.
- C-03 Transfer meaning: item->item transformation (FPRD, NOTES, API-04, CAP, WST, STF) vs inter-branch transfer (PRD2 5.4, APIP `/inventory/transfers`).
- C-04 **Costing FIFO vs average.** PRD2/BP06 FIFO with avg display-only; ICA/SCN reduce `inventory.total_value` proportionally (average) on adjustments, value increases without cost at average, and SCN calls average "the cost used for accounting". -> Inventory.totalValue, Σlots and GL can diverge.
- C-05 Cashier & purchases: PRD2/APIP/ACCT admin-only; FPRD ("cashier logs supplier deliveries", "records supplier returns") and CAP (cashier can create/list purchases, record wastage pending approval) allow it.
- C-06 Default credit days 30 (PRD2 5.2, CAP) vs 7 (API-05, API-07, API-12).
- C-07 Overpayment: CAP creates a customer credit balance; API-08 rejects `AMOUNT_EXCEEDS_BALANCE`; BP04 allows advance payments.
- C-08 Tax base: PRD2 5.2 formula `TaxAmount = GrossTotalAmount x TaxRate` (before discount) contradicts PRD2 7.2.2 worked example (tax on post-discount 142.50 -> 21.38) and CAP/POSO. Also PRDU allows tax-inclusive pricing; barcode encodes "total price with tax" [BAR] (inclusive) while POS computes exclusive.
- C-09 Profit: CAP 5.1 / API-05 `profit = totalAmount(incl. tax) - totalCost` vs BP05/PRD2 6.3 revenue ex-VAT. Profit including VAT overstates margin.
- C-10 Discount accounting: revenue net of discount (CAP, BP05) vs separate Discounts account 54xx (BP01 §6.2). Either is valid; check consistency between sale JE, P&L "discounts" line (APIP P&L has grossSales/discounts/netSales) and void reversal.
- C-11 Void rules: APIP "cannot void after end-of-day close"; CAP "within 24 h window" and "HAS_PAYMENTS -> cannot void"; BP03 void cancels payments with GL reversal; API-05 cancel does not mention refunding/cancelling cash already received.
- C-12 P&L COGS: periodic (Opening + Purchases - Closing; PRD2 8.1.2, API-10 §10.4) vs perpetual FIFO COGS (PRD2 6.4, CAP, BP08 GL-based). With periodic COGS and a wastage expense line, wastage is double counted.
- C-13 **Account codes differ.** PRD2/BP01 seed: 1110 Cash, 1120 Bank, 1130 AR, 1200 Inventory, 1300 Fixed assets, 2110 AP, 2120 VAT, 4010 Sales, 5100 COGS, 5250/5251/5252 wastage/shrinkage. GUIDE/BANK: Cash box 1111, bank group 1112 with 1112-NNN. API-00: 1200 Inventory, 2100 AP, 2200 VAT, 4100 Sales. API-11: 1000 Cash, 1100 Bank, 1200 AR, 1300 Inventory, 2000 AP, 4000 Sales, 4100 Sales Returns, 5000 COGS, 5100 Wastage, 5200 Inventory adj. BP06: Inventory 1300, adjustment 5320. WST: Inventory 1130 (!), wastage 5300, AP 2000. BP01 §6.4 documents that code had AR=1200/Inventory=1300 "wrong" vs seed — risk of postings to the wrong account (e.g. inventory into fixed assets).
- C-14 VAT Receivable: BP05 §7 suggests "1130 or similar" — 1130 is AR in the seed; BP05 then suggests 1135.
- C-15 **Dynamic page access is UI-only** [DPA line ~197 "backend stays role-based"] yet DPA also says endpoints link to pageKey. Granting a page in UI that the backend role-guards (or revoking a page the API still serves) breaks either function or security.
- C-16 Accountant = renamed cashier [ACCT] but is granted manual journal entries, reconciliation, credit notes, purchase/wastage reports — beyond PRD2 cashier limits (no financial data). PRDU/BRD "Accountant" was a separate read-only financial role.
- C-17 Stock transfer receivedAt/expiry: FPRD "preserving original batch date"; API-04 new lot `receivedAt=now` (moves it to the back of FIFO) with inherited expiry; WST expiry set at transfer; STF expiry optional (fallback source expiry). FIFO order of cut products depends on this.
- C-18 Transfer cost: API-04 inherits source unit cost (1:1 qty); WST/STF destination cost/kg allocated or user-entered per line; yield loss (dest grams < source grams) treatment unspecified (absorbed into product cost vs wastage).
- C-19 Live-bird shrinkage: cost absorbed into real cost/kg and wastage record value 0 (PRD2 5.1.4) yet COA has 5252 "Live Bird Shrinkage" expense (PRD2 6.1).
- C-20 Expired stock: FPRD/CAP block sale; PRD2 5.2 warning + admin override; API-05 silently excludes expired lots (sale may fail INSUFFICIENT_STOCK while stock exists).
- C-21 Price override: PRD2 "admin only"; API-12 `sales.allow_price_override=true` default "allow cashiers to change prices"; API-05 `unitPrice` "override allowed"; BAR uses barcode-encoded price instead of item price.
- C-22 Wastage approval: CAP JE only on approval (pending wastage already reduced stock -> stock and GL out of sync until approved); API-09 immediate JE; PRD2 has ApprovedBy field.
- C-23 FIFO ordering key: receivedAt (PRD2/API) vs oldest expiry (WST 3.3).
- C-24 Session: access 15 min/refresh 7 d (APIP) vs session timeout 8 h (PRD2).
- C-25 Manual debt (API-07 §7.10) creates a JE header with no lines; debt cancel (§7.11) has no JE -> AR subledger vs GL divergence by design. BP04 wants outstanding derived from payment ledger.
- C-26 Supplier return wording (CAP 9.1) "Increase supplier debt (we owe less)" — self-contradictory; correct intent: AP decreases.
- C-27 Barcode spec internal: table says price field 5 digits, later "Price 7 digits" [BAR §1.0 vs §1.2].
- C-28 Return restock lot cost = round(lineCost/qty) [API-09] -> restocked lot value can differ from Dr Inventory amount (rounding drift vs I-14).
- C-29 Purchase cancel [API-06 §6.9] reduces supplier balance by amountDue only; cash part of the purchase not refunded/reversed explicitly (relies on reversal JE).
- C-30 Mixed payment [MIX]: backend creates debt when `remaining > 1` and "customer info" (name/phone) present — may create a debt for a walk-in with no customer record; remainder of exactly 1 minor unit is silently ignored.
- C-31 GL reversal by `findFirst(sourceType, sourceId)` [BP02 §8, BP03 §6] — vouchers with several JEs (e.g. sale + separate COGS entry, or payments) would be only partially reversed.
- C-32 Event-driven posting [BP09]: accounting posted by an event handler after the operational transaction -> risk of documents without JE (I-13).
- C-33 Cheque / mobile payment routing: BANK maps cash->1111, bank_transfer/card->bank; `check`/`mobile_payment` unspecified (likely default to cash box). No post-dated cheque (PDC) / cheque clearing workflow defined although FPRD requires cheque payments.

## 8. Stated requirements possibly unimplemented ("to verify")

Each is a requirement with source; testers should confirm existence and behavior.
1. Expiry alerts & near-expiry notification job with "move to wastage / keep selling" action [FPRD, PRD2 11.4, WST 6].
2. "Batch stored beyond threshold" alerts (storage time) [FPRD]; overdue-debt alerts [PRD2 11.6]; abnormal shrinkage > 30% alert [PRD2 8.2.3]; low-stock ("stack about to empty") notification [NOTES].
3. Offline mode: local queue, sync on reconnect, offline indicator [FPRD, PRD2 10.4, APIP 7.4].
4. Return receipt for customer returns [FPRD]; partial returns restoring FIFO lots [PRD2 11.2].
5. Password policy: min 8 chars + complexity; bcrypt cost 12; rate limit 5/min; lockout after 10 failures (30 min) [PRD2 10.3, APIP 6.1].
6. Export of all reports to PDF / Excel / CSV with header metadata [FPRD, PRD2 8.3, 11.8]; bulk export of sales list.
7. Digital scale serial integration, stability detection, calibration; manual weight requires admin password and is logged [PRD2 5.2, 7.2.19, 11.2].
8. Cashier discount limit 5% and manager approval above threshold [PRD2]; price override admin-only.
9. Customer credit limit enforcement with admin override [PRD2 5.2, 11.5].
10. Live bird receiving (gross/net, shrinkage %, real cost) and Live Bird Shrinkage report [PRD2 5.1.4, 8.2.3].
11. End-of-day Z report with cash count, variance, day lock; month-end review [PRD2 5.7, 8.1.1].
12. Approval workflows: purchase approval, expense > threshold, stock adjustment approval, wastage approval [PRD2, CAP].
13. Daily automated encrypted off-site backup + documented restore [PRD2 10.3/10.4]; restore endpoint/UI.
14. Immutable audit log of all critical actions incl. manual weight entries, IP/user agent [PRD2 10.3].
15. Reports: cash flow, AR aging buckets, cashier performance (discounts, voids), item sales/profit, wastage % of COGS, supplier purchase history, VAT summary, stock-vs-GL reconciliation [PRD2 §8, BP06 §9, APIP 4.15].
16. Data import: products, opening inventory, customers/suppliers via Excel/CSV [PRD2 9.3]; accounting export (QuickBooks IIF) [PRD2 9.4].
17. Receipt templates (thermal, Arabic/English), cash drawer kick [PRD2 9.1]; "Save draft" sale [PRD2 7.2.2]; keyboard shortcuts F2/F4/F9/F12.
18. Users page: logged-in status, last login, work start date; onboarding message; preferred language login [FPRD].
19. Per-branch inventory, branch-filtered reports, user-branch access control, inter-branch transfer [FPRD, PRD2 11.4].
20. Insufficient cash/bank balance check on disbursements [BANK §3] (marked "to be added").
21. Fiscal years, accounting periods, period closing voucher, year-end close, freeze date [BP03 §7, BP07].
22. Payment ledger, reconciliation tool, advance payments, credit notes with VAT reversal [BP04, BP05 §8, CN].
23. Opening stock on item creation with proper GL (equity/opening balance account) [SCN] — GL side not specified anywhere.
24. Cash-to-bank deposits and bank-to-bank transfers (no dedicated workflow in docs) [GUIDE, BANK].
25. Supplier statement & payables page (admin) [API-06 §6.8]; customer statement printable for date range [PRD2 11.5].
26. Bad-debt write-off `POST /debts/{id}/write-off` [APIP 4.12] — GL treatment unspecified.
27. Session timeout and refresh-token rotation / server-side blacklist [APIP 3.4].
28. Encryption at rest of users/permissions, protection if device is stolen [FPRD].
