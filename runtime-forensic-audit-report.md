# Runtime Forensic Audit Report

Date: 2026-03-18
Scope: Active runtime source only (frontend/backend execution paths)

## Findings

1. **Critical**
   - **Location:** [app/frontend/src/services/bank-accounts.service.ts](app/frontend/src/services/bank-accounts.service.ts#L31), [app/frontend/src/components/settings/BankAccountsSettingsTab.tsx](app/frontend/src/components/settings/BankAccountsSettingsTab.tsx#L34), [app/frontend/src/pages/payments/PaymentProfile.tsx](app/frontend/src/pages/payments/PaymentProfile.tsx#L808), [app/backend/src/app.module.ts](app/backend/src/app.module.ts#L15)
   - **Problem:** Frontend actively calls bank-accounts APIs in settings/payments/expenses, but backend wiring has no bank-accounts module/controller, so the flow is broken at runtime.
   - **Fix:** Implement a backend BankAccounts module (controller/service/Prisma model) with full CRUD/default endpoints and register it in app module, or remove frontend dependency until backend exists.

2. **High**
   - **Location:** [app/backend/prisma/schema.prisma](app/backend/prisma/schema.prisma#L802), [app/backend/src/payments/payments.service.ts](app/backend/src/payments/payments.service.ts#L748), [app/backend/src/sales/sales.service.ts](app/backend/src/sales/sales.service.ts#L967), [app/backend/src/purchases/purchases.service.ts](app/backend/src/purchases/purchases.service.ts#L537)
   - **Problem:** Payment numbers are generated from count+1 in multiple services while paymentNumber is unique, creating duplicate-key failure risk under concurrency/deletions.
   - **Fix:** Replace count-based numbering with transactional sequence/last-number table (or DB-native sequence) and generate numbers atomically in one shared utility.

3. **High**
   - **Location:** [app/frontend/src/pages/expenses/ExpenseProfile.tsx](app/frontend/src/pages/expenses/ExpenseProfile.tsx#L682), [app/backend/src/expenses/dto/expense.dto.ts](app/backend/src/expenses/dto/expense.dto.ts#L51), [app/backend/src/expenses/expenses.service.ts](app/backend/src/expenses/expenses.service.ts#L56), [app/backend/prisma/schema.prisma](app/backend/prisma/schema.prisma#L971)
   - **Problem:** Expense flow accepts/sends bankAccountId in UI and DTO, but service create/update does not persist it and schema has no field, causing silent data loss/inconsistent accounting metadata.
   - **Fix:** Add bankAccountId to Expense schema and service persistence (create/update/read), enforce validation rules for bank_transfer, and backfill migration safely.

4. **High**
   - **Location:** [app/frontend/src/pages/POS.tsx](app/frontend/src/pages/POS.tsx#L236), [app/frontend/src/pages/POS.tsx](app/frontend/src/pages/POS.tsx#L865), [app/frontend/src/pages/POS.tsx](app/frontend/src/pages/POS.tsx#L391)
   - **Problem:** POS allows printing from in-memory cart before/without successful sale posting, so users can produce a receipt not tied to a committed transaction.
   - **Fix:** Gate printing behind successful createSale response and print using persisted sale receipt endpoint (or saved sale payload with sale id/number).

5. **Medium**
   - **Location:** [app/frontend/src/pages/POS.tsx](app/frontend/src/pages/POS.tsx#L291), [app/frontend/src/pages/POS.tsx](app/frontend/src/pages/POS.tsx#L320)
   - **Problem:** POS receipt content uses hardcoded 15% tax estimation and fixed store name, which can diverge from actual tax template/company settings and posted invoice truth.
   - **Fix:** Build receipt data from backend sale response or sales receipt endpoint so tax/store metadata always reflect persisted source of truth.

6. **Medium**
   - **Location:** [app/backend/src/accounting/tax/vat-report.service.ts](app/backend/src/accounting/tax/vat-report.service.ts#L74), [app/backend/prisma/schema.prisma](app/backend/prisma/schema.prisma#L1284), [app/backend/prisma/schema.prisma](app/backend/prisma/schema.prisma#L1300), [app/frontend/src/pages/Reports.tsx](app/frontend/src/pages/Reports.tsx#L669)
   - **Problem:** VAT report by-rate output is hardcoded to 15% and tax-breakdown tables exist but are not runtime-populated/read, so per-rate VAT analytics are not reliable.
   - **Fix:** Persist sale/purchase tax breakdown rows at posting time and compute by-rate VAT from those persisted rates instead of placeholders.

7. **Low**
   - **Location:** [app/frontend/src/services/audit.service.ts](app/frontend/src/services/audit.service.ts#L12), [app/backend/src/audit/audit.controller.ts](app/backend/src/audit/audit.controller.ts#L39), [app/frontend/src/hooks/use-audit.ts](app/frontend/src/hooks/use-audit.ts#L16)
   - **Problem:** Frontend service calls /audit/action-counts while backend exposes /audit/counts, leaving a latent broken integration path.
   - **Fix:** Align route paths on one canonical endpoint and add an integration test for audit action-count fetch.

8. **Medium**
   - **Location:** [app/frontend/src/pages/Settings.tsx](app/frontend/src/pages/Settings.tsx#L391), [app/frontend/src/pages/Settings.tsx](app/frontend/src/pages/Settings.tsx#L449), [app/frontend/src/pages/Settings.tsx](app/frontend/src/pages/Settings.tsx#L491), [app/frontend/src/pages/Settings.tsx](app/frontend/src/pages/Settings.tsx#L232)
   - **Problem:** Several settings sections are placeholder/non-persistent (users coming soon, multiple save buttons with no API write path), so UI implies functionality that does not execute.
   - **Fix:** Either wire these tabs to backend settings endpoints with optimistic/error states or clearly mark them read-only/disabled until implemented.

## Severity Totals

- Critical: 1
- High: 3
- Medium: 3
- Low: 1

## Most Critical Broken Flow

- Bank transfer accounting flow is broken end-to-end: bank account setup UI calls missing backend APIs, downstream payment/expense bank-account selection is not reliably available, and expense bankAccountId is not persisted even when provided.
