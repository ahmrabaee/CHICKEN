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
