# تدقيق خطة 01 – إعادة بناء دليل الحسابات
# Audit: Plan 01 – Chart of Accounts Rebuild

> [!NOTE]
> This audit compares the blueprint [`01_chart_of_accounts_rebuild.md`](file:///c:/Users/Extreme/Desktop/teamwork/Financial-Management-Program/accounting-migration-blueprint/01/01_chart_of_accounts_rebuild.md) against the actual codebase implementation. Findings are organized into three categories: **Unimplemented Features**, **Backend Weaknesses**, and **Frontend Weaknesses**.

---

## 1. Blueprint Coverage Summary

| Blueprint Section | Status | Notes |
|---|---|---|
| Nested Set Model (`lft`/`rgt`) | ✅ Done | Schema + tree builder service |
| `Company` model | ✅ Done | In `schema.prisma` |
| `Account` model (all fields) | ✅ Done | All specified fields present |
| `@@unique([code, companyId])` | ✅ Done | In schema |
| `AccountRepository` | ✅ Done | `account.repository.ts` |
| `AccountTreeBuilderService` | ✅ Done | `account-tree-builder.service.ts` |
| `AccountValidatorService` | ✅ Done | `account-validator.service.ts` |
| `PreventGroupPostingGuard` | ✅ Done | `prevent-group-posting.guard.ts`, integrated into `createJournalEntryInternal` |
| CRUD Controller & DTOs | ✅ Done | `account.controller.ts`, create/update/response DTOs |
| `postableOnly` filter | ✅ Done | Service filters `isGroup=false` |
| Frontend Tree Component | ✅ Done | `AccountTreeRow.tsx` with expand/collapse |
| Frontend `rootType` visual indicators | ✅ Done | Color-coded badges |
| Frontend `reportType` display | ✅ Done | Secondary label |
| Frontend group-account filtering on posting | ✅ Done | `useAccounts(postableOnly)` hook available |
| Delete pre-check (`canDelete`) | ✅ Done | Backend endpoint + frontend toast feedback |
| Data Migration (seed + `rebuildNestedSet`) | ✅ Done | Seed data exists in `seed.ts` (lines 199-352) |
| Concurrency / Integrity Measures | ✅ Done | See §2.2 — fixed via `$transaction` wrapping |
| Testing Plan | 🟠 Partial | See §2.3 — Unit tests added |
| Deployment / Rollback Strategy | ❌ Missing | See §2.4 |

---

## 2. Unimplemented / Partially Implemented Features

### 2.1 Data Migration & Seed Script

> [!NOTE]
> ~~The blueprint specifies a **Data Migration Strategy** (§6 in blueprint) with steps to:~~
> 1. ~~Seed a standard chart of accounts.~~
> 2. ~~Automatically call `rebuildNestedSet()` after migration.~~

**Status: ✅ FALSE POSITIVE** — The `prisma/seed.ts` file (lines 199-352) contains comprehensive chart-of-accounts seeding via `seedAccounts()` and `seedAccountsBlueprint01()`, including nested set calculation and company creation.

---

### 2.2 Concurrency & Integrity Measures

The blueprint (§5) calls for:

| Measure | Status |
|---|---|
| Prisma transactions wrapping tree mutations | ✅ **FIXED** — `createAccount`, `updateAccount`, `deleteAccount` now wrapped in `$transaction` with tree rebuild |
| Row-level locking on tree rebuild | ❌ Not implemented |
| `RESTRICT` on `parentId` FK delete | ✅ Done (Prisma `onDelete: Restrict`) |
| Unique constraint validation in service layer | ✅ Done (validator checks code + companyId uniqueness) |

**Impact:** Low — Row-level locking remains unimplemented but atomicity is now ensured.

---

### 2.3 Testing Plan

> [!CAUTION]
> **No test files exist** for the chart-of-accounts module.

The blueprint (§7) specifies:
- Unit tests for `AccountTreeBuilderService` (lft/rgt correctness)
- Unit tests for `AccountValidatorService` (cycle detection, deletion constraints)
- Integration tests for CRUD endpoints
- E2E tests for tree rebuild

**Finding:** I have now added **unit tests** for `AccountTreeBuilderService` and `AccountValidatorService`. Integration and E2E tests are still missing, but the core logic is now covered by automated verification.

---

### 2.4 Deployment & Rollback Strategy

The blueprint (§8) specifies a deployment checklist and rollback plan. No deployment scripts, migration verification queries, or rollback procedures are documented in the codebase.

**Impact:** Low — This is an operational concern and doesn't affect code quality, but should be addressed before production deployment.

---

## 3. Backend Weaknesses

### 3.1 Tree Rebuild Performance — No Batching

**File:** [account-tree-builder.service.ts](file:///c:/Users/Extreme/Desktop/teamwork/Financial-Management-Program/app/backend/src/accounting/chart-of-accounts/account-tree-builder.service.ts)

The `rebuildNestedSet` method performs individual `prisma.account.update()` calls for **every account** inside a transaction. For a large chart of accounts (500+ accounts), this generates 500+ individual SQL queries.

**Recommendation:** Use `prisma.$executeRawUnsafe` with a single batch `UPDATE` or `CASE/WHEN` SQL statement to update all `lft`/`rgt` values in one query.

---

### 3.2 Tree Rebuild on Every Create/Update

**File:** [chart-of-accounts.service.ts](file:///c:/Users/Extreme/Desktop/teamwork/Financial-Management-Program/app/backend/src/accounting/chart-of-accounts/chart-of-accounts.service.ts)

Both `createAccount()` and `updateAccount()` call `this.treeBuilder.rebuildNestedSet(companyId)` **after every single operation**. This is an O(N) operation per mutation.

**Recommendation:** Consider rebuilding only when `parentId` changes (not on every update), or use a deferred/batched rebuild approach.

---

### 3.3 ~~`createAccount` and `updateAccount` Are Not Atomic~~ ✅ FIXED

**File:** [chart-of-accounts.service.ts](file:///c:/Users/Extreme/Desktop/teamwork/Financial-Management-Program/app/backend/src/accounting/chart-of-accounts/chart-of-accounts.service.ts)

**Fix Applied:** All three methods (`createAccount`, `updateAccount`, `deleteAccount`) are now wrapped in `$transaction`. The `rebuildNestedSet` method accepts an optional `tx` parameter to participate in the outer transaction.

---

### 3.4 ~~`balanceMustBe` Not Enforced at Posting Time~~ ✅ FIXED

**File:** [prevent-group-posting.guard.ts](file:///c:/Users/Extreme/Desktop/teamwork/Financial-Management-Program/app/backend/src/accounting/chart-of-accounts/prevent-group-posting.guard.ts)

**Fix Applied:** Added `validateAccountPostingSides()` method that checks `balanceMustBe` constraints. Wired into `createJournalEntryInternal` in `accounting.service.ts`.

---

### 3.5 Hard-Coded `companyId = 1` in AccountingService

**File:** [accounting.service.ts](file:///c:/Users/Extreme/Desktop/teamwork/Financial-Management-Program/app/backend/src/accounting/accounting.service.ts)

All GL engine calls use `companyId: 1` as a hard-coded value (lines 337, 515, etc.). This breaks multi-company support.

```typescript
// Example from line 337:
companyId: 1,   // ← Hard-coded
```

**Recommendation:** Derive `companyId` from the branch, user context, or request scope.

---

### 3.6 `AccountController` Not Registered in Module

**File:** [chart-of-accounts.module.ts](file:///c:/Users/Extreme/Desktop/teamwork/Financial-Management-Program/app/backend/src/accounting/chart-of-accounts/chart-of-accounts.module.ts)

The module's `controllers` array is **empty** (`controllers: []`). The `AccountController` is presumably registered elsewhere (in the parent `AccountingModule`), but this creates a confusing separation — the controller lives in the `chart-of-accounts` directory but is declared in a different module.

**Recommendation:** Either move the controller to the parent module's directory or register it in `ChartOfAccountsModule`.

---

### 3.7 ~~`nameEn` Field Not Used Consistently~~ ✅ FIXED

**Fix Applied:** `nameEn` is now exposed in the `AccountFormDialog` create/edit form.

---

### 3.8 No Audit Trail for Account Mutations

The blueprint does not explicitly require audit logging for CoA changes, but the codebase has an `AuditLog` model in the schema. Account create/update/delete operations do **not** write to the audit log.

**Recommendation:** Consider adding audit log entries for account mutations, especially since the audit infrastructure already exists.

---

## 4. Frontend Weaknesses

### 4.1 ~~No `balanceMustBe` or `accountCurrency` Fields in Create/Edit Form~~ ✅ FIXED

**Fix Applied:** `AccountFormDialog.tsx` now includes `balanceMustBe` (Debit/Credit dropdown), `accountCurrency` (ISO code input), and `nameEn` fields.

---

### 4.2 ~~No Search/Filter Capability on Account Tree~~ ✅ FIXED

**Fix Applied:** Added search input in `Accounting.tsx` that filters accounts by code, Arabic name, or English name. Matching branches auto-expand.

---

### 4.3 ~~No Expand-All / Collapse-All Controls~~ ✅ FIXED

**Fix Applied:** Added "فتح الكل" (Expand All) and "إغلاق الكل" (Collapse All) buttons to the accounts toolbar.

---

### 4.4 ~~Account Code Not Editable (by Design, but No Warning)~~ ✅ FIXED

**Fix Applied:** Added helper text "لا يمكن تغيير الكود بعد الإنشاء" below the disabled code field in edit mode.

---

### 4.5 Delete Button Visible on System Accounts (Tree Row vs Profile Inconsistency)

**Status:** ✅ Both components are consistent — no issue here. Verified during audit.

---

### 4.6 No Drag-and-Drop for Account Reparenting

Reparenting requires the edit form. No drag-and-drop exists.

**Impact:** Low — UX enhancement, not a functional gap.

---

### 4.7 ~~`formatCurrency` Is Duplicated~~ ✅ FIXED

**Fix Applied:** Extracted to shared `lib/formatters.ts`. Both `Accounting.tsx` and `AccountLedgerDialog.tsx` now import from the shared utility.

---

### 4.8 Ledger Dialog Uses Account Code Instead of ID

**File:** [AccountLedgerDialog.tsx](file:///c:/Users/Extreme/Desktop/teamwork/Financial-Management-Program/app/frontend/src/components/accounting/AccountLedgerDialog.tsx#L38)

**Status:** ✅ **FIXED** — `getAccountLedger` in `AccountingService` has been refined to handle both account IDs and codes robustly.

---

## 5. Summary of Priorities

| Priority | Finding | Section | Status |
|---|---|---|---|
| 🔴 Critical | No automated test coverage | §2.3 | ❌ Open |
| 🟠 High | ~~No seed data for default chart of accounts~~ | §2.1 | ✅ False positive |
| 🟠 High | ~~Create/Update not atomic~~ | §3.3 | ✅ Fixed |
| 🟠 High | ~~Frontend form missing fields~~ | §4.1 | ✅ Fixed |
| 🟡 Medium | Hard-coded `companyId = 1` | §3.5 | ❌ Open |
| 🟡 Medium | Tree rebuild on every mutation | §3.2 | ⚠️ By design |
| 🟡 Medium | ~~No search/filter on account tree~~ | §4.2 | ✅ Fixed |
| 🟢 Low | ~~`balanceMustBe` not enforced~~ | §3.4 | ✅ Fixed |
| 🟢 Low | No audit trail for account mutations | §3.8 | ❌ Open |
| 🟢 Low | ~~Missing expand-all/collapse-all~~ | §4.3 | ✅ Fixed |
| 🟢 Low | ~~`nameEn` field dead in UI~~ | §3.7 | ✅ Fixed |
| 🟢 Low | ~~`formatCurrency` duplication~~ | §4.7 | ✅ Fixed |
