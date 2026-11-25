# Backend Architecture (K3)

Stack: NestJS 10, Prisma 6, SQLite (`DATABASE_URL`), schema `app/backend/prisma/schema.prisma` (no `_prisma_migrations` table in the golden DBs ⇒ `db push`), global prefix `/v1`, Swagger `/api/docs`. Response envelope via `TransformInterceptor` `{success,data}`; errors via `HttpExceptionFilter` `{success:false,error:{code,message,messageAr,...}}`; Prisma P2002 → 409 `DUPLICATE_ENTRY`. Global `ValidationPipe` (whitelist + forbidNonWhitelisted + implicit conversion) — unknown body fields → 400.
Posting logic and every GL rule: see `posting-map.md`. Findings: `findings/K3.md`.

## 1. Data model (46 tables)

Conventions (schema header, verified in code): money = Int minor units (×100); weights = Int grams; prices = minor units **per kg**; percentages/rates = basis points. All IDs autoincrement Int. Dates stored by Prisma as epoch-ms integers in SQLite.

### 1.1 Core / security
| Model (table) | Key fields | Constraints / notes |
|---|---|---|
| Branch (branches) | code unique, isMainBranch, isActive, stockAccountId→Account (SetNull), hasScale, scaleComPort | no uniqueness on isMainBranch (several "main" possible) |
| Role (roles) | name unique ('admin','accountant'; 'cashier' normalised to accountant in RolesGuard), permissions JSON string | permissions never enforced |
| PageDefinition / RolePageAccess / UserPageAccess | key unique, path; (roleId,pageId) unique; (userId,pageId) unique | 31 pages seeded, accountant default 14 keys |
| User (users) | username unique, email unique?, employeeNumber unique?, passwordHash (bcrypt 12), refreshToken (bcrypt 10 hash), refreshTokenExpiresAt, currentSessionToken/Expiry, isActive, defaultBranchId | session token stored but never validated |
| UserRole | (userId,roleId) unique | |
| SystemSetting (system_settings) | key unique, value string, dataType, settingGroup | see §5 |
| AuditLog | userId, username, action, entityType, entityId, changes JSON | written only by some services (void, adjustment, cancel, write-off, auth); not by purchases/expenses delete |
| SchemaVersion, BackupRun | | backup-meta DB is separate (`backup-prisma.service.ts`) |

### 1.2 Products & stock
| Model | Key fields / units | Constraints / notes |
|---|---|---|
| Category | code unique, purchaseItemId→Item | |
| Item | code unique, barcode unique?, categoryId (Restrict), defaultSalePrice (minor/kg), defaultPurchasePrice, taxRatePct (bp, unused by sales), min/maxStockLevelGrams, shelfLifeDays, allowNegativeStock, requiresScale | soft delete via isActive |
| Inventory | **itemId unique** (1 row per item, NOT per branch), branchId?, currentQuantityGrams, reservedQuantityGrams (never used), totalValue (minor), averageCost (minor/kg) | no CHECK ≥0 (verified negative after K3-008) |
| InventoryLot | lotNumber unique, itemId, purchaseId?, purchaseLineId?, stockTransferId?, branchId?, total/remainingQuantityGrams, unitPurchasePrice (minor/kg), receivedAt, expiryDate | no CHECK remaining ≥0 / ≤ total; lotNumber count-based ⇒ collisions |
| StockTransfer / StockTransferLine | transferNumber unique, sourceLotId (Restrict), status draft/completed/cancelled (always completed), totalWeightGrams, totalCostValue; line (transferId,lineNumber) unique, unitCost, lineCostValue | no JE link |
| StockMovement | itemId, lotId?, branchId?, movementType ('purchase','sale','void','adjustment_in/out','wastage','transfer'), quantityGrams ±, unitCost, referenceType/Id (polymorphic, **no FK**) | sales don't set lotId/branchId |
| StockLedgerEntry (SLE) | voucherType/voucherId (polymorphic, no FK), qtyChange ±g, valuationRate minor/kg, stockValueDifference minor, postingDate | documented immutable but hard-deleted on purchase update/delete; missing for wastage |
| WastageRecord | itemId, lotId?, weightGrams, wastageType, reason, estimatedCostValue, recordedById (Restrict), approvedBy?, docstatus 1 | no void |

### 1.3 Parties
| Customer | customerNumber unique, creditLimit (never enforced in sales), currentBalance (denormalised, maintained incrementally), priceLevel, defaultDiscountPct (unused), phone indexed not unique |
| Supplier | supplierNumber unique, currentBalance (denormalised; see K3-007), creditLimit?, paymentTerms |

### 1.4 Transactions
| Model | Key fields | Status fields / notes |
|---|---|---|
| Sale | saleNumber unique (SAL-yyyymmdd-NNNN), saleType cash/credit, customerId? (Restrict), customerName/Phone snapshot, cashierId, branchId?, grossTotalAmount (Σ net lines), discountAmount (header), discountPct, taxAmount, totalAmount (= grandTotal), netTotal?/grandTotal? (only when taxTemplateId), totalTaxAmount, totalCost, totalProfit (= total − cost, incl. tax), amountPaid, paymentMethod/bankAccountId (= first tender), dueDate | paymentStatus unpaid/partial/paid; isVoided + docstatus 0/1/2 (create sets 1) — two parallel status systems |
| SaleLine | (saleId,lineNumber) unique, weightGrams, pricePerKg, discountAmount, netPricePerKg, taxRatePct/taxAmount (never set), lineTotalAmount, costPerKg, lineTotalCost | |
| SaleLineCostAllocation | saleLineId (Cascade), lotId (Restrict), quantityAllocatedGrams, unitCost, totalCost | the FIFO trail |
| Purchase | purchaseNumber unique (PUR-NNNNNN count-based), supplierId (Restrict), supplierInvoiceNumber (no uniqueness → duplicate supplier invoices possible), totalAmount (=grandTotal), taxAmount, netTotal, grandTotal, amountPaid, paymentMethod?, bankAccountId?, receivedAt, isApproved (unused), branchId | docstatus default 0 and never set by create; status computed (computeStatus) |
| PurchaseLine | (purchaseId,lineNumber) unique, weightGrams, pricePerKg, lineTotalAmount, isLiveBird (no shrinkage logic), taxRatePct/taxAmount (unused) | |
| Payment | paymentNumber unique (PAY-NNNNNN, 3 different generators), amount (comment: may be negative; DTOs require positive), paymentMethod cash/card/bank_transfer/mobile/check, referenceType sale/purchase/expense/null, referenceId (polymorphic, **no FK**), partyType/partyId (no FK), bankAccountId?, isVoided + docstatus 1/2 | |
| PaymentLedgerEntry (PLE) | partyType/partyId, accountType receivable/payable, accountId (Restrict), voucherType/Id, againstVoucherType/Id, amount (sign: receivable +invoice −payment; payable −invoice +payment), delinked | no FK to vouchers |
| PaymentAllocation | (paymentId,invoiceType,invoiceId) unique, allocatedAmount | not removed on payment cancel |
| CreditNote | creditNoteNumber unique (CN- count), originalInvoiceType/Id (no FK), amount, docstatus 0/1 (cancel not implemented) | |
| Debt | debtNumber unique (`DEB-<doc number>`), direction receivable/payable, partyType customer/supplier/…, partyId?, totalAmount, amountPaid, sourceType sale/purchase/expense + sourceId (no FK), status open/partial/paid/overdue(never set)/written_off/'unpaid'(set by cancel) | sale debt total = amount due; purchase debt total = grand total |
| ExpenseCategory / Expense | expenseNumber unique (EXP- count), amount, taxAmount (ignored), paymentMethod (incl. 'credit'), bankAccountId, supplierId?, isApproved, docstatus (never set by API) | hard delete allowed |

### 1.5 Accounting
| Company | code unique, defaultCurrency 'SAR', currencyPrecision 2, roundOffAccountId (seed 5400), fiscalYearStartMonth |
| Account | (code, companyId) unique — **NULL companyId makes duplicates possible in SQLite**; rootType Asset/Liability/Equity/Income/Expense, reportType, accountType, parentId (Restrict), lft/rgt nested set, isGroup, balanceMustBe (never seeded), isActive, isSystemAccount, freezeAccount |
| JournalEntry | entryNumber unique (JE-NNNNNN), entryDate, sourceType/sourceId (polymorphic, no FK, **no uniqueness** ⇒ duplicate postings not prevented; `PreventDoubleSubmitGuard` exists but is never called), isPosted, isReversed, reversedByEntryId, branchId |
| JournalEntryLine | (journalEntryId,lineNumber) unique, accountId (Restrict), debitAmount, creditAmount (no CHECK that exactly one is >0 or ≥0), currency fields, costCenterId, companyId, partyType/partyId, against voucher, isOpening, isRoundOff | legacy path leaves party/company NULL |
| AccountingPeriod | (companyId,startDate) unique (NULL companyId ⇒ not enforced), isClosed | **no service creates or closes periods** |
| TaxTemplate / TaxTemplateItem / SaleTaxBreakdown / PurchaseTaxBreakdown | name unique; rate bp, chargeType | breakdown tables never written by sales/purchases |
| CostCenter | (code, companyId) unique | unused by postings |
| BankAccount | code unique, accountId → Account (Restrict), isDefault, isActive | none seeded |

### 1.6 What is NOT constrained (integrity gaps)
- No FK/uniqueness for polymorphic references: JournalEntry.sourceType/sourceId, Payment.referenceType/Id & partyId, Debt.sourceType/Id & partyId, PLE vouchers, SLE vouchers, StockMovement references, CreditNote.originalInvoice.
- No `UNIQUE(sourceType, sourceId)` on journal_entries ⇒ double posting possible; no `UNIQUE(sourceType, sourceId)` on debts.
- No CHECK constraints at all (SQLite/Prisma): negative stock, negative lot remaining (observed), negative amounts, debit & credit both non-zero.
- Inventory is per item, not per (item, branch), although branchId columns exist everywhere — multi-branch stock is not modelled.
- Denormalised balances (customer/supplier.currentBalance, sale/purchase.amountPaid, debt.amountPaid, inventory.totalValue/averageCost) are maintained incrementally by each service, with no recomputation job.
- Soft-delete flags: isActive on Item/Customer/Supplier/Branch/User/Account/BankAccount/Category; documents use docstatus/isVoided; but Purchase and Expense are **hard-deleted**.

## 2. Module map & endpoint inventory

Guards: `JwtAuthGuard` is the only global guard (app.module.ts:95, honours `@Public()`). `RolesGuard` and `PageAccessGuard` are applied per controller/method with `@UseGuards`; **`@Roles()` without `@UseGuards(RolesGuard)` has no effect.** PageAccessGuard: admin passes; others need exact path in `allowedPages` (from user_page_access, recomputed per request in JwtStrategy.validate) or '*'.
Roles: admin, accountant (cashier alias). Role `permissions` JSON is put in the token and `request.user.permissions` but **no guard checks it**.

Controllers / services (module → controller path): accounting (`/accounting` AccountingController + duplicate AccountController from chart-of-accounts module, `/credit-notes`, `/reconciliation`, `/tax`), audit `/audit`, auth `/auth`, bank-accounts, barcode, branches, categories, customers, debts, expenses, inventory, items, page-access, payments, purchases, reports, sales, settings, stock-transfer, suppliers, users, wastage, backup `/system`. Services without controllers: GlEngine*, TaxEngine/TaxCalculation, PaymentLedger, OutstandingCalculator, StockLedger, StockAccountMapper, StockReconciliation (used by reports), PdfService, `src/lib/db.ts` (dead).

### 2.1 Endpoints lacking effective authorization (beyond "any logged-in user")
| Endpoint(s) | Declared | Effective | Verified |
|---|---|---|---|
| `/system/backup/config` GET/PUT, `/system/backup/status`, `/system/backups` GET, `POST /system/backup`, `POST /system/backups/:id/download-link`, `POST /system/backups/:id/restore`, `POST /system/backups/import` | admin | any user | GETs: 200 for accountant (K3-010) |
| `GET /system/backups/:id/download` | Public | signed-token only | — |
| `/tax/templates` POST/PUT/DELETE, `/tax/vat-report` | admin / admin+acct | any user | GET 200 |
| `/credit-notes/*` (create, submit) | admin, accountant | any user | GET 200 |
| `/reconciliation/*` incl. `POST /reconciliation/apply` | admin, accountant | any user | — |
| `AccountController` duplicates of `/accounting/accounts*` | admin | shadowed by guarded AccountingController (can-delete → 403) | yes |
| Sales: `GET /sales*`, `POST /sales`, `POST /sales/:id/payments` | none | any user | — |
| `POST /wastage`, `GET /wastage*` | none | any user (UI: admin-only page) | accountant POST → 201 |
| `GET /inventory`, `/inventory/:itemId`, `/inventory/low-stock`, `/inventory/report/pdf` | none | any user | — |
| `GET /debts/receivables`, `GET /debts/:id` | none (class RolesGuard but no @Roles) | any user; payables use PageAccess /debts | — |
| `GET /customers/:id/statement/pdf` | none | any user | — |
| Public: `/auth/login`, `/auth/refresh`, `/auth/check-setup`, `/auth/setup` (refuses after setup_completed; check outside tx) | | | — |

### 2.2 Full inventory (static analysis, 195 handlers; generator `tests/K3/endpoints.mjs`)
"RolesGuard applied = NO" means the declared roles are not enforced.

| Method | Path | Handler | Public | Roles (declared) | RolesGuard applied | Page (declared) | PageAccessGuard applied | File |
|---|---|---|---|---|---|---|---|---|
| GET | /v1/accounting/accounts | getAccounts |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:37 |
| GET | /v1/accounting/accounts/code/:code | getAccountByCode |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:45 |
| GET | /v1/accounting/accounts/:id/can-delete | canDeleteAccount |  | admin | yes | - |  | accounting/accounting.controller.ts:51 |
| GET | /v1/accounting/accounts/:id | getAccountByIdOrCode |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:58 |
| POST | /v1/accounting/accounts | createAccount |  | admin | yes | - |  | accounting/accounting.controller.ts:64 |
| POST | /v1/accounting/accounts/rebuild-tree | rebuildAccountTree |  | admin | yes | - |  | accounting/accounting.controller.ts:71 |
| PUT | /v1/accounting/accounts/:id | updateAccount |  | admin | yes | - |  | accounting/accounting.controller.ts:78 |
| DELETE | /v1/accounting/accounts/:id | deleteAccount |  | admin | yes | - |  | accounting/accounting.controller.ts:89 |
| GET | /v1/accounting/journal-entries | getJournalEntries |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:97 |
| GET | /v1/accounting/journal-entries/:id/party | getJournalEntryParty |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:103 |
| GET | /v1/accounting/journal-entries/:id | getJournalEntryById |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:109 |
| POST | /v1/accounting/journal-entries | createJournalEntry |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:115 |
| POST | /v1/accounting/journal-entries/:id/post | postJournalEntry |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:121 |
| GET | /v1/accounting/trial-balance | getTrialBalance |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:128 |
| GET | /v1/accounting/ledger/:accountCode | getAccountLedger |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:135 |
| GET | /v1/accounting/reports/balance-sheet/pdf | getBalanceSheetPdf |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:148 |
| GET | /v1/accounting/reports/income-statement/pdf | getIncomeStatementPdf |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:162 |
| GET | /v1/accounting/reports/trial-balance/pdf | getTrialBalancePdf |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:177 |
| GET | /v1/accounting/reports/ledger/:accountCode/pdf | getAccountLedgerPdf |  | admin,accountant | yes | - |  | accounting/accounting.controller.ts:191 |
| GET | /v1/accounting/accounts | getAccounts |  | admin,accountant | **NO** | - |  | accounting/chart-of-accounts/account.controller.ts:25 |
| GET | /v1/accounting/accounts/code/:code | getAccountByCode |  | admin,accountant | **NO** | - |  | accounting/chart-of-accounts/account.controller.ts:34 |
| GET | /v1/accounting/accounts/:id/can-delete | canDelete |  | admin | **NO** | - |  | accounting/chart-of-accounts/account.controller.ts:41 |
| GET | /v1/accounting/accounts/:id | getAccountByIdOrCode |  | admin,accountant | **NO** | - |  | accounting/chart-of-accounts/account.controller.ts:48 |
| POST | /v1/accounting/accounts | createAccount |  | admin | **NO** | - |  | accounting/chart-of-accounts/account.controller.ts:55 |
| PUT | /v1/accounting/accounts/:id | updateAccount |  | admin | **NO** | - |  | accounting/chart-of-accounts/account.controller.ts:62 |
| DELETE | /v1/accounting/accounts/:id | deleteAccount |  | admin | **NO** | - |  | accounting/chart-of-accounts/account.controller.ts:73 |
| POST | /v1/accounting/accounts/rebuild-tree | rebuildTree |  | admin | **NO** | - |  | accounting/chart-of-accounts/account.controller.ts:80 |
| GET | /v1/credit-notes | findAll |  | admin,accountant | **NO** | - |  | accounting/credit-note/credit-note.controller.ts:22 |
| GET | /v1/credit-notes/:id | findById |  | admin,accountant | **NO** | - |  | accounting/credit-note/credit-note.controller.ts:38 |
| POST | /v1/credit-notes | create |  | admin,accountant | **NO** | - |  | accounting/credit-note/credit-note.controller.ts:44 |
| POST | /v1/credit-notes/:id/submit | submit |  | admin,accountant | **NO** | - |  | accounting/credit-note/credit-note.controller.ts:59 |
| GET | /v1/reconciliation/outstanding/sale/:id | getSaleOutstanding |  | admin,accountant | **NO** | - |  | accounting/reconciliation/reconciliation.controller.ts:26 |
| GET | /v1/reconciliation/outstanding/purchase/:id | getPurchaseOutstanding |  | admin,accountant | **NO** | - |  | accounting/reconciliation/reconciliation.controller.ts:32 |
| GET | /v1/reconciliation/outstanding/party | getPartyOutstanding |  | admin,accountant | **NO** | - |  | accounting/reconciliation/reconciliation.controller.ts:38 |
| GET | /v1/reconciliation/open-invoices | getOpenInvoices |  | admin,accountant | **NO** | - |  | accounting/reconciliation/reconciliation.controller.ts:49 |
| GET | /v1/reconciliation/unallocated-payments | getUnallocatedPayments |  | admin,accountant | **NO** | - |  | accounting/reconciliation/reconciliation.controller.ts:60 |
| GET | /v1/reconciliation/suggest | suggest |  | admin,accountant | **NO** | - |  | accounting/reconciliation/reconciliation.controller.ts:71 |
| POST | /v1/reconciliation/apply | apply |  | admin,accountant | **NO** | - |  | accounting/reconciliation/reconciliation.controller.ts:82 |
| GET | /v1/tax/templates | getTemplates |  | - |  | - |  | accounting/tax/tax-template.controller.ts:16 |
| GET | /v1/tax/templates/:id | getTemplate |  | - |  | - |  | accounting/tax/tax-template.controller.ts:22 |
| POST | /v1/tax/templates | createTemplate |  | admin | **NO** | - |  | accounting/tax/tax-template.controller.ts:28 |
| PUT | /v1/tax/templates/:id | updateTemplate |  | admin | **NO** | - |  | accounting/tax/tax-template.controller.ts:35 |
| DELETE | /v1/tax/templates/:id | deleteTemplate |  | admin | **NO** | - |  | accounting/tax/tax-template.controller.ts:45 |
| GET | /v1/tax/vat-report | getVatReport |  | admin,accountant | **NO** | - |  | accounting/tax/tax-template.controller.ts:52 |
| GET | /v1/audit | getLogs |  | admin | yes | - |  | audit/audit.controller.ts:25 |
| GET | /v1/audit/counts | getActionCounts |  | admin | yes | - |  | audit/audit.controller.ts:38 |
| POST | /v1/auth/login | login | **PUBLIC** | - |  | - |  | auth/auth.controller.ts:36 |
| GET | /v1/auth/me | getMe |  | - |  | - |  | auth/auth.controller.ts:60 |
| POST | /v1/auth/refresh | refresh | **PUBLIC** | - |  | - |  | auth/auth.controller.ts:68 |
| POST | /v1/auth/logout | logout |  | - |  | - |  | auth/auth.controller.ts:88 |
| POST | /v1/auth/change-password | changePassword |  | - |  | - |  | auth/auth.controller.ts:108 |
| POST | /v1/auth/check-setup | checkSetup | **PUBLIC** | - |  | - |  | auth/auth.controller.ts:143 |
| POST | /v1/auth/setup | completeSetup | **PUBLIC** | - |  | - |  | auth/auth.controller.ts:163 |
| GET | /v1/bank-accounts | findAll |  | admin | yes | - |  | bank-accounts/bank-accounts.controller.ts:27 |
| GET | /v1/bank-accounts/default | getDefault |  | admin | yes | - |  | bank-accounts/bank-accounts.controller.ts:35 |
| GET | /v1/bank-accounts/:id | findById |  | admin | yes | - |  | bank-accounts/bank-accounts.controller.ts:41 |
| POST | /v1/bank-accounts | create |  | admin | yes | - |  | bank-accounts/bank-accounts.controller.ts:47 |
| PUT | /v1/bank-accounts/:id | update |  | admin | yes | - |  | bank-accounts/bank-accounts.controller.ts:53 |
| DELETE | /v1/bank-accounts/:id | delete |  | admin | yes | - |  | bank-accounts/bank-accounts.controller.ts:59 |
| GET | /v1/barcode/config | getConfig |  | admin,accountant | yes | - |  | barcode/barcode.controller.ts:15 |
| PUT | /v1/barcode/config | updateConfig |  | admin | yes | - |  | barcode/barcode.controller.ts:22 |
| GET | /v1/barcode/parse | parse |  | admin,accountant | yes | - |  | barcode/barcode.controller.ts:30 |
| GET | /v1/barcode/lookup | lookup |  | admin,accountant | yes | - |  | barcode/barcode.controller.ts:40 |
| GET | /v1/branches | findAll |  | admin | yes | - |  | branches/branches.controller.ts:18 |
| GET | /v1/branches/:id | findById |  | admin | yes | - |  | branches/branches.controller.ts:26 |
| POST | /v1/branches | create |  | admin | yes | - |  | branches/branches.controller.ts:34 |
| PUT | /v1/branches/:id | update |  | admin | yes | - |  | branches/branches.controller.ts:41 |
| POST | /v1/branches/:id/activate | activate |  | admin | yes | - |  | branches/branches.controller.ts:52 |
| DELETE | /v1/branches/:id | delete |  | admin | yes | - |  | branches/branches.controller.ts:60 |
| GET | /v1/categories/purchaseable | findPurchaseable |  | admin,accountant | yes | - |  | categories/categories.controller.ts:17 |
| GET | /v1/categories | findAll |  | admin,accountant | yes | - |  | categories/categories.controller.ts:25 |
| GET | /v1/categories/:id | findById |  | admin,accountant | yes | - |  | categories/categories.controller.ts:36 |
| GET | /v1/categories/code/:code | findByCode |  | admin,accountant | yes | - |  | categories/categories.controller.ts:45 |
| POST | /v1/categories | create |  | admin | yes | - |  | categories/categories.controller.ts:54 |
| PUT | /v1/categories/:id | update |  | admin | yes | - |  | categories/categories.controller.ts:62 |
| DELETE | /v1/categories/:id | delete |  | admin | yes | - |  | categories/categories.controller.ts:74 |
| GET | /v1/customers | findAll |  | admin,accountant | yes | - |  | customers/customers.controller.ts:20 |
| GET | /v1/customers/search | search |  | admin,accountant | yes | - |  | customers/customers.controller.ts:28 |
| GET | /v1/customers/:id | findById |  | admin,accountant | yes | - |  | customers/customers.controller.ts:37 |
| GET | /v1/customers/number/:customerNumber | findByCustomerNumber |  | admin,accountant | yes | - |  | customers/customers.controller.ts:46 |
| GET | /v1/customers/phone/:phone | findByPhone |  | admin,accountant | yes | - |  | customers/customers.controller.ts:55 |
| GET | /v1/customers/:id/statement/pdf | getStatementPdf |  | - |  | - |  | customers/customers.controller.ts:64 |
| POST | /v1/customers | create |  | admin,accountant | yes | - |  | customers/customers.controller.ts:80 |
| PUT | /v1/customers/:id | update |  | admin,accountant | yes | - |  | customers/customers.controller.ts:91 |
| DELETE | /v1/customers/:id | delete |  | admin | yes | - |  | customers/customers.controller.ts:104 |
| GET | /v1/debts/receivables | findReceivables |  | - |  | - |  | debts/debts.controller.ts:29 |
| GET | /v1/debts/receivables/pdf | getReceivablesPdf |  | admin,accountant | yes | - |  | debts/debts.controller.ts:37 |
| GET | /v1/debts/payables | findPayables |  | - |  | /debts | yes | debts/debts.controller.ts:50 |
| GET | /v1/debts/payables/pdf | getPayablesPdf |  | - |  | /debts | yes | debts/debts.controller.ts:60 |
| GET | /v1/debts/summary | getSummary |  | - |  | /debts | yes | debts/debts.controller.ts:74 |
| GET | /v1/debts/overdue | getOverdue |  | - |  | /debts | yes | debts/debts.controller.ts:82 |
| GET | /v1/debts/:id | findById |  | - |  | - |  | debts/debts.controller.ts:90 |
| POST | /v1/debts/:id/write-off | writeOff |  | admin,accountant | yes | - |  | debts/debts.controller.ts:96 |
| GET | /v1/expenses | findAll |  | - |  | /expenses | yes | expenses/expenses.controller.ts:30 |
| GET | /v1/expenses/categories | getCategories |  | - |  | /expenses | yes | expenses/expenses.controller.ts:38 |
| GET | /v1/expenses/report/pdf | getReportPdf |  | - |  | /expenses | yes | expenses/expenses.controller.ts:44 |
| GET | /v1/expenses/summary | getSummary |  | - |  | /expenses | yes | expenses/expenses.controller.ts:56 |
| GET | /v1/expenses/:id | findById |  | - |  | /expenses | yes | expenses/expenses.controller.ts:64 |
| POST | /v1/expenses | create |  | - |  | /expenses | yes | expenses/expenses.controller.ts:70 |
| PUT | /v1/expenses/:id | update |  | - |  | /expenses | yes | expenses/expenses.controller.ts:76 |
| POST | /v1/expenses/:id/approve | approve |  | - |  | /expenses | yes | expenses/expenses.controller.ts:82 |
| DELETE | /v1/expenses/:id | delete |  | - |  | /expenses | yes | expenses/expenses.controller.ts:88 |
| GET | /v1/inventory | findAll |  | - |  | - |  | inventory/inventory.controller.ts:26 |
| GET | /v1/inventory/report/pdf | getInventoryReportPdf |  | - |  | - |  | inventory/inventory.controller.ts:32 |
| GET | /v1/inventory/low-stock | getLowStock |  | - |  | - |  | inventory/inventory.controller.ts:44 |
| GET | /v1/inventory/expiring | getExpiring |  | admin,accountant | yes | - |  | inventory/inventory.controller.ts:50 |
| GET | /v1/inventory/:itemId | findByItemId |  | - |  | - |  | inventory/inventory.controller.ts:59 |
| GET | /v1/inventory/:itemId/lots | getLots |  | admin,accountant | yes | /inventory | yes | inventory/inventory.controller.ts:66 |
| GET | /v1/inventory/:itemId/movements | getMovements |  | admin,accountant | yes | /inventory | yes | inventory/inventory.controller.ts:76 |
| POST | /v1/inventory/adjustments | createAdjustment |  | admin,accountant | yes | /inventory/adjustments | yes | inventory/inventory.controller.ts:89 |
| GET | /v1/items | findAll |  | admin,accountant | yes | - |  | items/items.controller.ts:25 |
| GET | /v1/items/:id | findById |  | admin,accountant | yes | - |  | items/items.controller.ts:33 |
| GET | /v1/items/code/:code | findByCode |  | admin,accountant | yes | - |  | items/items.controller.ts:42 |
| GET | /v1/items/barcode/:barcode | findByBarcode |  | admin,accountant | yes | - |  | items/items.controller.ts:51 |
| POST | /v1/items | create |  | admin,accountant | yes | /inventory/new | yes | items/items.controller.ts:60 |
| PUT | /v1/items/:id | update |  | admin,accountant | yes | /inventory/new | yes | items/items.controller.ts:73 |
| DELETE | /v1/items/:id | delete |  | admin,accountant | yes | /inventory/new | yes | items/items.controller.ts:88 |
| GET | /v1/system/backup/config | getConfig |  | admin | **NO** | - |  | modules/backup/backup.controller.ts:45 |
| PUT | /v1/system/backup/config | updateConfig |  | admin | **NO** | - |  | modules/backup/backup.controller.ts:52 |
| GET | /v1/system/backup/status | getStatus |  | admin | **NO** | - |  | modules/backup/backup.controller.ts:61 |
| GET | /v1/system/backups | listRuns |  | admin | **NO** | - |  | modules/backup/backup.controller.ts:70 |
| POST | /v1/system/backup | createBackup |  | admin | **NO** | - |  | modules/backup/backup.controller.ts:79 |
| POST | /v1/system/backups/:id/download-link | createDownloadLink |  | admin | **NO** | - |  | modules/backup/backup.controller.ts:92 |
| POST | /v1/system/backups/:id/restore | restoreBackup |  | admin | **NO** | - |  | modules/backup/backup.controller.ts:103 |
| POST | /v1/system/backups/import | importBackup |  | admin | **NO** | - |  | modules/backup/backup.controller.ts:110 |
| GET | /v1/system/backups/:id/download | downloadBackup | **PUBLIC** | - |  | - |  | modules/backup/backup.controller.ts:147 |
| GET | /v1/page-access/users | getAccountantUsers |  | admin | yes | - |  | page-access/page-access.controller.ts:15 |
| GET | /v1/page-access/user/:userId | findByUserId |  | admin | yes | - |  | page-access/page-access.controller.ts:21 |
| PUT | /v1/page-access | update |  | admin | yes | - |  | page-access/page-access.controller.ts:28 |
| PUT | /v1/page-access/bulk | bulkUpdate |  | admin | yes | - |  | page-access/page-access.controller.ts:34 |
| GET | /v1/payments | findAll |  | admin,accountant,cashier | yes | - |  | payments/payments.controller.ts:35 |
| GET | /v1/payments/:id/pdf | getPaymentPdf |  | admin,accountant,cashier | yes | - |  | payments/payments.controller.ts:42 |
| POST | /v1/payments/sale | recordSalePayment |  | admin,accountant,cashier | yes | - |  | payments/payments.controller.ts:59 |
| POST | /v1/payments/purchase | recordPurchasePayment |  | admin,accountant | yes | - |  | payments/payments.controller.ts:66 |
| POST | /v1/payments/advance | createAdvancePayment |  | admin,accountant | yes | - |  | payments/payments.controller.ts:73 |
| POST | /v1/payments/:id/cancel | cancelPayment |  | admin,accountant | yes | - |  | payments/payments.controller.ts:80 |
| GET | /v1/payments/:id | findById |  | admin,accountant,cashier | yes | - |  | payments/payments.controller.ts:95 |
| GET | /v1/purchases | findAll |  | admin | yes | - |  | purchases/purchases.controller.ts:30 |
| GET | /v1/purchases/report/pdf | getPurchasesReportPdf |  | admin | yes | - |  | purchases/purchases.controller.ts:36 |
| GET | /v1/purchases/:id | findById |  | admin,accountant | yes | - |  | purchases/purchases.controller.ts:48 |
| GET | /v1/purchases/:id/pdf | getPurchaseOrderPdf |  | admin | yes | - |  | purchases/purchases.controller.ts:57 |
| POST | /v1/purchases | create |  | admin | yes | - |  | purchases/purchases.controller.ts:73 |
| PUT | /v1/purchases/:id | update |  | admin | yes | - |  | purchases/purchases.controller.ts:79 |
| DELETE | /v1/purchases/:id | remove |  | admin | yes | - |  | purchases/purchases.controller.ts:89 |
| PUT | /v1/purchases/:id/receive | receive |  | admin | yes | - |  | purchases/purchases.controller.ts:98 |
| GET | /v1/reports/dashboard | getDashboard |  | admin,accountant | yes | - |  | reports/reports.controller.ts:17 |
| GET | /v1/reports/sales | getSalesReport |  | admin,accountant | yes | - |  | reports/reports.controller.ts:23 |
| GET | /v1/reports/purchases | getPurchasesReport |  | admin,accountant | yes | - |  | reports/reports.controller.ts:34 |
| GET | /v1/reports/inventory | getInventoryReport |  | admin,accountant | yes | - |  | reports/reports.controller.ts:45 |
| GET | /v1/reports/wastage | getWastageReport |  | admin,accountant | yes | - |  | reports/reports.controller.ts:51 |
| GET | /v1/reports/expenses | getExpenseReport |  | admin,accountant | yes | - |  | reports/reports.controller.ts:62 |
| GET | /v1/reports/profit-loss | getProfitLossReport |  | admin,accountant | yes | - |  | reports/reports.controller.ts:73 |
| GET | /v1/reports/stock-vs-gl | getStockVsGLReport |  | admin,accountant | yes | - |  | reports/reports.controller.ts:84 |
| GET | /v1/reports/wastage/pdf | getWastageReportPdf |  | admin,accountant | yes | - |  | reports/reports.controller.ts:100 |
| GET | /v1/reports/vat/pdf | getVatReportPdf |  | admin,accountant | yes | - |  | reports/reports.controller.ts:114 |
| GET | /v1/reports/stock-vs-gl/pdf | getStockVsGLReportPdf |  | admin,accountant | yes | - |  | reports/reports.controller.ts:128 |
| GET | /v1/sales | findAll |  | - |  | - |  | sales/sales.controller.ts:18 |
| GET | /v1/sales/report/pdf | getSalesReportPdf |  | - |  | - |  | sales/sales.controller.ts:29 |
| GET | /v1/sales/:id | findById |  | - |  | - |  | sales/sales.controller.ts:41 |
| GET | /v1/sales/:id/receipt | getReceipt |  | - |  | - |  | sales/sales.controller.ts:48 |
| GET | /v1/sales/:id/pdf | getInvoicePdf |  | - |  | - |  | sales/sales.controller.ts:55 |
| POST | /v1/sales | create |  | - |  | - |  | sales/sales.controller.ts:72 |
| POST | /v1/sales/:id/void | voidSale |  | admin | yes | - |  | sales/sales.controller.ts:81 |
| POST | /v1/sales/:id/payments | addPayment |  | - |  | - |  | sales/sales.controller.ts:95 |
| GET | /v1/settings | getAll |  | admin | yes | - |  | settings/settings.controller.ts:25 |
| GET | /v1/settings/group/:group | getByGroup |  | admin | yes | - |  | settings/settings.controller.ts:31 |
| POST | /v1/settings/bulk | bulkUpdate |  | admin | yes | - |  | settings/settings.controller.ts:37 |
| PUT | /v1/settings/company | updateCompany |  | admin | yes | - |  | settings/settings.controller.ts:43 |
| GET | /v1/settings/:key | getByKey |  | admin | yes | - |  | settings/settings.controller.ts:49 |
| PUT | /v1/settings/:key | set |  | admin | yes | - |  | settings/settings.controller.ts:55 |
| DELETE | /v1/settings/:key | delete |  | admin | yes | - |  | settings/settings.controller.ts:61 |
| GET | /v1/stock-transfer/source-lots | getAvailableSourceLots |  | admin,accountant | yes | - |  | stock-transfer/stock-transfer.controller.ts:22 |
| GET | /v1/stock-transfer/products | getTransferrableProducts |  | admin,accountant | yes | - |  | stock-transfer/stock-transfer.controller.ts:35 |
| GET | /v1/stock-transfer | findAll |  | admin,accountant | yes | - |  | stock-transfer/stock-transfer.controller.ts:44 |
| GET | /v1/stock-transfer/:id | findById |  | admin,accountant | yes | - |  | stock-transfer/stock-transfer.controller.ts:57 |
| POST | /v1/stock-transfer | create |  | admin,accountant | yes | - |  | stock-transfer/stock-transfer.controller.ts:65 |
| GET | /v1/suppliers | findAll |  | admin | yes | - |  | suppliers/suppliers.controller.ts:35 |
| GET | /v1/suppliers/:id | findById |  | admin | yes | - |  | suppliers/suppliers.controller.ts:41 |
| GET | /v1/suppliers/:id/statement/pdf | getStatementPdf |  | admin | yes | - |  | suppliers/suppliers.controller.ts:47 |
| POST | /v1/suppliers | create |  | admin | yes | - |  | suppliers/suppliers.controller.ts:63 |
| PUT | /v1/suppliers/:id | update |  | admin | yes | - |  | suppliers/suppliers.controller.ts:69 |
| DELETE | /v1/suppliers/:id | delete |  | admin | yes | - |  | suppliers/suppliers.controller.ts:75 |
| GET | /v1/users | findAll |  | admin | yes | - |  | users/users.controller.ts:43 |
| GET | /v1/users/me | getMe |  | - |  | - |  | users/users.controller.ts:58 |
| GET | /v1/users/roles | getRoles |  | admin | yes | - |  | users/users.controller.ts:72 |
| GET | /v1/users/active-sessions | getActiveSessions |  | admin | yes | - |  | users/users.controller.ts:83 |
| GET | /v1/users/:id | findById |  | admin | yes | - |  | users/users.controller.ts:98 |
| POST | /v1/users | create |  | admin | yes | - |  | users/users.controller.ts:119 |
| PUT | /v1/users/me | updateMe |  | - |  | - |  | users/users.controller.ts:139 |
| PUT | /v1/users/:id | update |  | admin | yes | - |  | users/users.controller.ts:163 |
| DELETE | /v1/users/:id | delete |  | admin | yes | - |  | users/users.controller.ts:187 |
| POST | /v1/users/:id/reset-password | resetPassword |  | admin | yes | - |  | users/users.controller.ts:219 |
| GET | /v1/wastage | findAll |  | - |  | - |  | wastage/wastage.controller.ts:21 |
| GET | /v1/wastage/:id | findById |  | - |  | - |  | wastage/wastage.controller.ts:27 |
| POST | /v1/wastage | create |  | - |  | - |  | wastage/wastage.controller.ts:33 |

## 3. Transaction boundaries & concurrency

### 3.1 Uses `$transaction` (interactive) — and what still leaks outside
| Operation | Service method | Outside-tx reads/writes (risk) |
|---|---|---|
| Sale create | SalesService.create (retry ×5 on sale_number P2002) | allocateFIFO lots read via this.prisma (K3-008); customer lookup; flag/account lookups; payment_number P2002 not retried |
| Sale void | voidSale | sale + isVoided read before tx (double void) |
| Sale add payment | addPayment | sale read before tx (overpayment race); no JE |
| Payment sale/purchase/advance/cancel | PaymentsService.* | sale/purchase/payment read before tx; cancel docstatus check before tx |
| Purchase create/update/delete/receive | PurchasesService.* | purchase number before tx (count); receive's receivedAt check before tx |
| Expense create | ExpensesService.create | number before tx |
| Wastage create | WastageService.create | branch derivation before tx (lot re-read inside — OK) |
| Stock adjustment | InventoryService.createAdjustment | item + current qty/value read **before** tx and used for the write (lost update with concurrent sale) |
| Stock transfer | StockTransferService.create | source lot remaining check before tx; number before tx |
| Debt write-off | DebtsService.writeOff | debt/status read before tx |
| Credit note submit | CreditNoteService.submit | docstatus + outstanding check before tx (double submit) |
| Reconciliation apply | ReconciliationService.apply → AllocationService.allocate(tx) | OK |
| Manual JE (legacy) | AccountingService.createJournalEntry | validations before tx |
| Reverse JE | reverseJournalEntry | nested `$transaction` inside `$transaction` (unreachable via API) |
| Setup | AuthService.completeSetup | setup_completed check before tx |

### 3.2 Multi-write operations WITHOUT a transaction
- `ExpensesService.update` / `delete` — single write but leaves JE/Debt inconsistent (logical non-atomicity; K3-012).
- `ExpensesService.approve`, `WastageService.approve` — single writes (no posting).
- `CreditNoteService.create` — single write.
- `AccountingService.postJournalEntry` — read then update (no tx).
- `AllocationService.allocate` when called without tx (only via apply → has tx).
- `InventoryService.deductFromLots` (unused helper) — loop of updates without tx.
- Settings `bulkUpdate`, page-access bulk update, branch/bank-account isDefault switching — check those services if relevant (not posting).
- Backup restore replaces the DB file while the app runs (see backup.service.ts) — out of K3 scope.

### 3.3 Number generation (race / collision)
| Number | Generator | Safe? |
|---|---|---|
| SAL-yyyymmdd-NNNN | last by saleNumber desc, inside tx, retry ×5 | mostly (UTC date prefix) |
| PUR-NNNNNN | count+1 outside tx | **collides after delete (verified)** |
| LOT-yyyymmdd-NNN | count+1 inside tx (global count, date prefix) | **collides after lot deletion same day (verified)**, NNN overflow past 999 harmless |
| PAY-NNNNNN | payments.service: last-id+1; sales/purchases: count+1 | inconsistent; concurrent → P2002 (not retried) |
| EXP-NNNNNN | count+1 outside tx | collides after expense delete |
| CN-NNNNNN | count+1 | race |
| JE-NNNNNN | legacy: count+1 then probe; GL engine: count+1 | legacy OK, GL engine collides after JE deletes |
| CUST#### (auto-created in POS) | last id's number +1; customer module uses own generator | possible clash |
| TR-/transfer number | count-based (stock-transfer.service.ts:362) | race |
SQLite serialises writers, so true concurrency errors surface mostly as P2002 / "database is locked" timeouts rather than silent duplicates.

## 4. Auth
- Login `POST /auth/login` (Public): bcrypt compare; inactive → 401. Access token HS256, `JWT_SECRET` (fallback **'default-secret-change-me'**), expiry `JWT_EXPIRES_IN` default 15m (response says expiresIn 900); payload sub, username, roles, permissions, branchId, allowedPages, type 'access'.
- Refresh token: JWT type 'refresh', `JWT_REFRESH_EXPIRES_IN` default 7d, stored bcrypt-hashed on user (single session — new login overwrites ⇒ previous device's refresh fails). `POST /auth/refresh` verifies JWT + hash + expiry, returns new access token.
- Logout / change-password null the refresh token & session token; issued access tokens remain valid until expiry (session token never checked).
- JwtStrategy.validate reloads user per request (role/page changes and deactivation take effect immediately; refresh-type tokens rejected).
- Password hashing: bcrypt 12 (setup, change), seed 12; user create/reset in users.service.
- Setup: `POST /auth/check-setup`, `POST /auth/setup` (Public) — refused when setting `setup_completed`='true'; creates main branch, admin user (or reuses an existing admin/role-less user with same username), business settings, returns tokens with allowedPages ['*'].
- Page access: admin ⇒ '*'; others ⇒ user_page_access (seeded from role defaults on first use). Uses `roles[0]` as primary role. Frontend (K4) gates by prefix, backend PageAccessGuard by exact path, and only ~15 handlers use it.
- Frontend-visible permissions (role.permissions JSON) are **not** enforced server-side; enforcement = RolesGuard where applied + PageAccessGuard where applied (see §2).

## 5. Settings that change behaviour (system_settings)
| Key | Read by | Effect |
|---|---|---|
| gl_engine_enabled | AccountingService.isGlEngineEnabled (every posting) | switches posting path (default false) |
| tax_engine_enabled | AccountingService.isTaxEngineEnabled | GL engine tax lines only (default false) |
| period_lock_enabled, accounting_freeze_date | PeriodLockGuard | not seeded ⇒ off |
| setup_completed (+_at), business_name(_en) | AuthService | setup wizard gate |
| barcode.* | BarcodeService | scale-label parsing |
| backup.* (auto_enabled, path_vps, retention_count, schedule_time, scope, last_*) | BackupService | backups |
| store_name, receipt_header, receipt_footer, tax_number, app.name*, tax.registration_number, app.version | sales receipt, PdfService | printing only (store_name/receipt_* not seeded) |
| **Never read** (dead): pos.accountant_max_discount_pct (sales hard-codes 500 bp), pos.allow_credit_sale, pos.require_customer, pos.print_receipt, pos.receipt_copies, inventory.allow_negative_stock (per-item flag used instead), inventory.fifo_enabled, inventory.default_expiry_alert_days, inventory.low_stock_alert_enabled, tax.default_rate, tax.prices_include_tax, gl_debit_credit_tolerance (validator hard-codes), numbering.* (only src/lib/db.ts, unused), currency.* (frontend only?), scale.* (frontend/Tauri?) | |
Also: Company.currencyPrecision and roundOffAccountId (GL engine).

## 6. Seed profiles (`prisma/seed.ts`, `--profile=baseline|dev|test`)
- **All profiles**: roles admin/accountant (permissions JSON), 31 page definitions + role defaults, categories, chart of accounts (company DEFAULT, 43 accounts, nested set; groups 1000/1100/1110/1112/1130/1200/2000/2100/3000/4000/4100/5000/5200/5220; round-off 5400), system settings (setup_completed = profile ≠ baseline), tax templates, expense categories.
- **dev/test only**: main branch, items, `seedInitialStock` (50 kg per active item except CHK-RAW-01 at defaultPurchasePrice; inventory + LOT-SEED lot; **no JE, no SLE, no movement**), admin/admin123, fixtures: 3 customers, 2 suppliers, 3 purchases (PUR-SEED-*, paid, no lots), 5 sales (SAL-SEED-*, item 1, cost 0), 3 expenses, 3 payments (PAY-SEED-*) — all inserted directly, bypassing posting (zero JEs; verified). No accountant user, no bank account.
- Refuses dev/test in NODE_ENV=production unless forced.
- No opening-balance seeding/feature for real deployments (capital, opening stock, AR/AP).
