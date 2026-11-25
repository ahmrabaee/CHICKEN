# Orchestrator findings

### ORCH-001: Frontend ships with 11 TypeScript errors; production build does not type-check
- Status: VERIFIED
- Severity: Medium
- Area / files: `app/frontend` (`vite build` passes; `npx tsc --noEmit -p tsconfig.app.json` → exit 2, 11 errors)
- Test executed: yes — `npx tsc --noEmit -p tsconfig.app.json` (2026-11-24)
- Errors: DebtsTable.tsx:224, LowStockTable.tsx:195 (`dir` prop), CategoriesManagement.tsx:69 (`code` field), TransferStockDialog.tsx:30 (`useTransferStock` not exported — component unused/dead), use-inventory.ts:106 (Partial<Item> vs CreateItemDto), Accounting.tsx:560 (`.items` on ApiResponse<JournalEntry[]>), Dashboard.tsx:126 (refetch type), PaymentProfile.tsx:706 (InvoiceReferenceCombobox props mismatch), PaymentProfile.tsx:845 (`Link` not imported ×2), Purchasing.tsx:151 (`.items` on union).
- Impact: type errors hide real runtime faults (see ORCH-002); shape mismatches (`.items` on array responses) can render empty lists silently.
- Recommendation: add `tsc --noEmit` to the build script / CI; fix each error.

### ORCH-002: Payment form crashes when bank/card method selected with no bank accounts (undefined `Link`)
- Status: SUSPECTED (code + tsc evidence; runtime verification assigned to UI/E2E agent)
- Severity: High (blocks recording a payment; white-screen/error boundary on a financial form)
- Area / files: `app/frontend/src/pages/payments/PaymentProfile.tsx:845` — `<Link>` used, never imported (no `react-router-dom` Link import in file).
- Reproduction: fresh setup with zero bank accounts → open new payment form → choose "bank_transfer" or "card" → render branch at :842 executes → `ReferenceError: Link is not defined`.
- Recommendation: import `Link` from react-router-dom; add tsc to build.

### ORCH-003: JWT strategy falls back to a hardcoded secret
- Status: SUSPECTED (code) — security agent to verify impact (token forgery if JWT_SECRET unset)
- Severity: High (conditional on deployment)
- Area / files: `app/backend/src/auth/strategies/jwt.strategy.ts:16` `configService.get('JWT_SECRET', 'default-secret-change-me')`; check signing side in `auth.service.ts` uses the same source.
- Recommendation: fail fast at boot when JWT_SECRET is missing/weak.

### ORCH-004: Init guide documents wrong default admin password
- Status: VERIFIED (login with `Admin@123` → 401; `admin123` → 200)
- Severity: Low
- Files: `app/backend/DB_INIT_GUIDE.md:75` vs `app/backend/prisma/seed.ts:755`.

### ORCH-005: Repository hygiene — tracked node_modules, tracked .env, stray artifacts
- Status: VERIFIED
- Severity: Low
- Files: `app/node_modules` (19 tracked files), `app/frontend/.env`, root `diff.txt`, `rebase.log`, `git_status_output.txt`, `status.txt`, `app/backend/test-*.pdf`, `check-db.*`, `recover-debt.js`, duplicated blueprint docs.

### ORCH-007: No automated tests for any financial core logic; one existing test fails; e2e script broken
- Status: VERIFIED
- Severity: High (process risk: every fix in history was unguarded against regression)
- Test executed: yes — backend suite run in isolated sandbox copy `.qa-audit/sandbox/backend` (`npx vitest run`): 14 files, 77 tests, 76 pass, 1 fail.
- Coverage: tests exist ONLY for backup module (12 files) and chart-of-accounts tree/validator (2 files). Zero tests for sales, purchases, payments, debts, inventory costing, stock transfer, wastage, GL engine posting, tax, credit notes, reports. Frontend: 7 small unit test files (money utils, filters, scale barcode, purchasing helpers).
- Failing: `account-tree-builder.service.spec.ts > rebuildNestedSet > should assign correct lft/rgt values` → `TypeError: Cannot read properties of undefined (reading 'account')` — mock of `$transaction` doesn't match service's batch form (`account-tree-builder.service.ts:47`); test rot, not a production defect.
- `package.json` script `test:e2e` references `vitest.e2e.config.ts`, which does not exist.
- Recommendation: build a regression suite around posting rules and invariants (the QA scripts under `.qa-audit/tests/` can seed it).

### ORCH-006: Dependency vulnerabilities
- Status: VERIFIED (npm audit summary at install)
- Severity: Medium (needs triage: which are reachable at runtime vs dev-only)
- backend: 57 (4 critical, 32 high); frontend: 31 (2 critical, 20 high). Security agent to triage runtime-reachable ones.
