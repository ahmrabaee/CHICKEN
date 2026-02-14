# Blueprint 03 — Posting Workflow Control — Implementation Summary

## Overview

Blueprint 03 (ERP-level posting lifecycle) has been applied to the Financial Management Program. The system now follows a unified **Draft → Submit → Cancel** workflow with proper GL reversal.

---

## Changes Implemented

### 1. Database Schema (Prisma + SQL Migration)

| Table | New Fields |
|-------|------------|
| **Sale** | `docstatus`, `submittedAt`, `submittedById`, `cancelledAt`, `cancelledById`, `cancelReason` |
| **Purchase** | `docstatus`, `submittedAt`, `submittedById`, `cancelledAt`, `cancelledById`, `cancelReason` |
| **Payment** | `docstatus`, `cancelledAt`, `cancelledById`, `cancelReason` |
| **Expense** | `docstatus`, `submittedAt`, `submittedById`, `cancelledAt`, `cancelledById`, `cancelReason` |
| **WastageRecord** | `docstatus`, `submittedAt`, `submittedById` |
| **AccountingPeriod** | New table for period locking |

**docstatus values:** `0` = Draft, `1` = Submitted, `2` = Cancelled

### 2. Guards (`src/common/guards/`)

- **DocumentStatusGuard** — `requireDraft()`, `requireSubmitted()`, `requireNotCancelled()`, `requireEditable()`
- **PeriodLockGuard** — `check(postingDate, companyId, tx)` — validates freeze date and closed periods
- **PreventDoubleSubmitGuard** — Prevents duplicate GL entries for same voucher

### 3. Accounting Service

- **`reverseByVoucher(voucherType, voucherId, userId, tx)`** — Finds original JournalEntry by `sourceType`+`sourceId`, creates reversal by swapping debit/credit, marks original as reversed.

### 4. Payments Service

- **`cancelPayment(id, reason, userId)`** — New primary method:
  1. PeriodLockGuard.check
  2. **reverseByVoucher('payment', id)** — creates GL reversal first (critical fix)
  3. Update payment: docstatus=2, isVoided, cancelledAt, cancelledById
  4. Update sale/purchase amountPaid, debt, customer balance
  5. Audit log

- **`voidPayment`** — Deprecated, now delegates to `cancelPayment`

- **recordSalePayment / recordPurchasePayment** — Set `docstatus: 1` on new payments

### 5. Sales Service

- **create** — Sets `docstatus: 1`, `submittedAt`, `submittedById` on sale
- **voidSale** — Now:
  1. PeriodLockGuard.check
  2. For each payment with a JournalEntry: `reverseByVoucher('payment', paymentId)`
  3. Update each payment: docstatus=2, isVoided
  4. Reverse sale JE (createSaleVoidJournalEntry)
  5. Update sale: docstatus=2, cancelledAt, cancelledById

### 6. API

**New endpoint:**
```
POST /payments/:id/cancel
Body: { "reason": "string" }
```

**Response on period lock:**
```json
{ "code": "PERIOD_LOCKED", "messageAr": "الفترة المحاسبية مغلقة" }
```

### 7. System Settings (Seed 004)

- `accounting_freeze_date` — ISO date; no posting before this
- `period_lock_enabled` — `true`/`false`; when true, no posting in closed periods

---

## Migration Path

1. **Apply schema:** `npx prisma db push` (or run `db/migrations/008_posting_workflow_control.sql`)
2. **Run seeds:** Apply updated `db/seeds/004_settings.sql` for period lock settings
3. **Existing data:** Migration backfills docstatus from `is_voided` / `is_approved`

---

## Key Rules Enforced

| Rule | Status |
|------|--------|
| Cancel creates GL reversal | ✅ `cancelPayment` calls `reverseByVoucher` before updating |
| No cancel without reversal | ✅ Guard + accounting flow |
| Period lock check before submit/cancel | ✅ `PeriodLockGuard.check()` in cancelPayment, voidSale |
| Sale/Payment docstatus on create | ✅ `docstatus: 1` set at creation |

---

## Testing

1. **Cancel payment:** Create a sale, add payment via `recordSalePayment`, then `POST /payments/:id/cancel` — verify reversal JE exists and `original.isReversed = true`
2. **Void sale with payments:** Create sale with payment, void sale — verify each payment JE is reversed
3. **Period lock:** Set `period_lock_enabled=true`, create a closed period, attempt cancel → expect `PERIOD_LOCKED`

---

## Files Modified/Created

- `prisma/schema.prisma` — docstatus fields, AccountingPeriod
- `src/common/guards/document-status.guard.ts` (new)
- `src/common/guards/period-lock.guard.ts` (new)
- `src/common/guards/prevent-double-submit.guard.ts` (new)
- `src/accounting/accounting.service.ts` — `reverseByVoucher`
- `src/payments/payments.service.ts` — `cancelPayment`, docstatus on create
- `src/payments/payments.controller.ts` — `POST :id/cancel`
- `src/payments/dto/payment.dto.ts` — `CancelPaymentDto`
- `src/sales/sales.service.ts` — voidSale with GL reversal, docstatus on create
- `db/migrations/008_posting_workflow_control.sql` (new)
- `db/seeds/004_settings.sql` — period lock settings
