# Blueprint 03 — Frontend Implementation Plan
## Posting Workflow Control (ERP-Level)

**Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Ready for Implementation

---

## 1. Executive Summary

This document provides a fully detailed, step-by-step plan to implement frontend changes supporting **Blueprint 03: Posting Workflow Control**. The backend already implements `docstatus`, GL reversal on cancel, and period locking. The frontend must:

1. Expose **Payment Cancel** (with GL reversal) to users
2. Show **document status badges** (Draft / Submitted / Cancelled)
3. Update **Sale void** wording to reflect GL reversal
4. Handle **period lock** and **freeze date** API errors
5. Show **reversal info** in Accounting
6. Enforce **edit restrictions** for submitted documents

---

## 2. Implementation Phases

| Phase | Scope | Priority | Est. Time |
|-------|-------|----------|-----------|
| **Phase 1** | Payment Cancel flow | Critical | 2–3 hrs |
| **Phase 2** | Error handling (PERIOD_LOCKED, FREEZE_DATE) | Critical | 1 hr |
| **Phase 3** | Document status badges + Sale void wording | High | 2 hrs |
| **Phase 4** | Accounting reversal display | Medium | 1 hr |
| **Phase 5** | Edit restrictions + types | Medium | 1–2 hrs |

---

## 3. Phase 1 — Payment Cancel Flow (Critical)

### 3.1 Types — `src/types/payments.ts`

**Add to `Payment` interface:**

```typescript
// Blueprint 03: docstatus and workflow fields
docstatus?: 0 | 1 | 2;  // 0=Draft, 1=Submitted, 2=Cancelled
cancelledAt?: string;
cancelledById?: number;
cancelReason?: string;
```

**Add new DTO:**

```typescript
export interface CancelPaymentDto {
    reason: string;
}
```

**Notes:** Keep `isVoided` for backward compatibility. Use `docstatus ?? (isVoided ? 2 : 1)` for display.

---

### 3.2 Service — `src/services/payment.service.ts`

**Add method:**

```typescript
async cancelPayment(id: number, data: CancelPaymentDto): Promise<{ success: boolean }> {
    const response = await axiosInstance.post<ApiResponse<{ success: boolean }>>(
        `/payments/${id}/cancel`,
        data
    );
    return response.data.data;
}
```

---

### 3.3 Hook — `src/hooks/use-payments.ts`

**Add mutation:**

```typescript
import { CancelPaymentDto } from '@/types/payments';

export const useCancelPayment = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: CancelPaymentDto }) =>
            paymentService.cancelPayment(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['payments', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            queryClient.invalidateQueries({ queryKey: ['debts'] });
            toast({ title: 'تم إلغاء الدفعة بنجاح' });
        },
        onError: (error: any) => {
            const code = error.response?.data?.code;
            const messageAr = error.response?.data?.messageAr;
            if (code === 'PERIOD_LOCKED') {
                toast({
                    variant: 'destructive',
                    title: 'الفترة المحاسبية مغلقة',
                    description: messageAr || 'لا يمكن الإلغاء - الفترة مغلقة',
                });
                return;
            }
            if (code === 'FREEZE_DATE') {
                toast({
                    variant: 'destructive',
                    title: 'تاريخ التجميد',
                    description: messageAr || 'التاريخ قبل تاريخ التجميد المحاسبي',
                });
                return;
            }
            toast({
                variant: 'destructive',
                title: 'خطأ في إلغاء الدفعة',
                description: messageAr || error.response?.data?.message || 'حدث خطأ',
            });
        },
    });
};
```

---

### 3.4 Shared Component — `src/components/posting/CancelConfirmDialog.tsx` (NEW)

**Purpose:** Reusable dialog for cancel operations (Payment, future Sale refinements).

**Props:**

```typescript
interface CancelConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    title: string;           // e.g. "إلغاء الدفعة"
    entityLabel: string;     // e.g. "الدفعة"
    glReversalNote?: boolean; // Show "سيتم إنشاء قيد عكسي محاسبي"
    isPending?: boolean;
}
```

**UI elements:**
- Dialog with RTL support
- Textarea or Input for reason (required)
- Two buttons: "إلغاء" (close) and "تأكيد الإلغاء" (destructive)
- Optional note: `سيتم إنشاء قيد عكسي محاسبي` when `glReversalNote=true`
- Loading state on confirm button

**File path:** `src/components/posting/CancelConfirmDialog.tsx`

---

### 3.5 PaymentProfile — `src/pages/payments/PaymentProfile.tsx`

**Changes:**

1. **Import** `useCancelPayment`, `CancelConfirmDialog`
2. **Add state:** `const [showCancelDialog, setShowCancelDialog] = useState(false)`
3. **Status display:** Use `docstatus ?? (isVoided ? 2 : 1)` for badge
4. **Cancel button:** Show only when `docstatus !== 2 && !isVoided`
   - Label: "إلغاء الدفعة"
   - Variant: destructive or outline
   - OnClick: `setShowCancelDialog(true)`
5. **CancelConfirmDialog:**
   - `glReversalNote={true}`
   - `onConfirm={(reason) => cancelPayment.mutate({ id: payment.id, data: { reason } }, { onSuccess: () => setShowCancelDialog(false) })`

**Placement:** In the header/actions area next to other action buttons.

---

### 3.6 Payments List — `src/pages/Payments.tsx`

**Changes:**

1. **PaymentDetailCard** (or equivalent):
   - Add Cancel button when payment is not voided
   - Open `CancelConfirmDialog` (can be inline or use shared state)
   - Or: Add "إلغاء" action in the row actions dropdown if one exists

2. **Status column:** Use `docstatus`-aware badge:
   - `docstatus === 2` or `isVoided` → "ملغية" (destructive)
   - `docstatus === 1` → "مؤكدة" (default)

---

## 4. Phase 2 — Error Handling (PERIOD_LOCKED, FREEZE_DATE)

### 4.1 Utility — `src/lib/api-errors.ts` (NEW)

**Purpose:** Centralize API error code handling for posting workflow.

```typescript
export type PostingErrorCode = 'PERIOD_LOCKED' | 'FREEZE_DATE' | 'ALREADY_CANCELLED' | 'ALREADY_REVERSED' | 'ALREADY_POSTED';

export const POSTING_ERROR_MESSAGES: Record<PostingErrorCode, { title: string; description?: string }> = {
    PERIOD_LOCKED: {
        title: 'الفترة المحاسبية مغلقة',
        description: 'لا يمكن تنفيذ هذا الإجراء - الفترة المحاسبية مغلقة',
    },
    FREEZE_DATE: {
        title: 'تاريخ التجميد',
        description: 'التاريخ قبل تاريخ التجميد المحاسبي',
    },
    ALREADY_CANCELLED: {
        title: 'مُلغى بالفعل',
        description: 'المستند مُلغى ولا يمكن تنفيذ هذا الإجراء',
    },
    ALREADY_REVERSED: {
        title: 'معكوس بالفعل',
        description: 'القيد المحاسبي معكوس بالفعل',
    },
    ALREADY_POSTED: {
        title: 'مرحّل بالفعل',
        description: 'المستند مرحّل إلى الدفاتر بالفعل',
    },
};

export function getPostingErrorToast(error: any): { variant: 'destructive'; title: string; description?: string } | null {
    const code = error.response?.data?.code as PostingErrorCode | undefined;
    if (code && POSTING_ERROR_MESSAGES[code]) {
        const msg = POSTING_ERROR_MESSAGES[code];
        return { variant: 'destructive' as const, title: msg.title, description: msg.description };
    }
    return null;
}
```

---

### 4.2 Usage in Mutations

**Where to use:** In `onError` of mutations that call:
- `cancelPayment`
- `voidSale`
- Future: `submitPurchase`, `cancelPurchase`, `approveExpense`, etc.

**Pattern:**

```typescript
onError: (error: any) => {
    const postingToast = getPostingErrorToast(error);
    if (postingToast) {
        toast(postingToast);
        return;
    }
    toast({ variant: 'destructive', title: 'حدث خطأ', description: error.response?.data?.message });
}
```

---

## 5. Phase 3 — Document Status Badges + Sale Void Wording

### 5.1 Component — `src/components/posting/DocumentStatusBadge.tsx` (NEW)

**Props:**

```typescript
interface DocumentStatusBadgeProps {
    docstatus: number;  // 0 | 1 | 2
    isVoided?: boolean; // Fallback for legacy
    isApproved?: boolean; // Fallback for Purchase/Expense
    size?: 'sm' | 'default';
}
```

**Logic:**
- If `docstatus` is defined: use it
- Else: infer from `isVoided` (2 if true, 1 if false) or `isApproved` (1 if true, 0 if false)

**Labels:**

| docstatus | Label (AR) | Variant |
|-----------|------------|---------|
| 0 | مسودة | secondary |
| 1 | مُرحّل | default |
| 2 | ملغى | destructive |

**File path:** `src/components/posting/DocumentStatusBadge.tsx`

---

### 5.2 Barrel Export — `src/components/posting/index.ts` (NEW)

```typescript
export { DocumentStatusBadge } from './DocumentStatusBadge';
export { CancelConfirmDialog } from './CancelConfirmDialog';
```

---

### 5.3 Apply to Pages

**Sales.tsx**
- Replace `getPaymentStatusBadge(status, isVoided)` usage for status with `<DocumentStatusBadge docstatus={sale.docstatus} isVoided={sale.isVoided} />` where appropriate
- Or keep payment status badge separate; add docstatus badge next to it (e.g. "ملغية" from docstatus=2)

**VoidSaleDialog (Sales.tsx)**
- Add text below "هل أنت متأكد...":
  - `سيتم إنشاء قيد عكسي محاسبي وتراجع المخزون.`
- Optional: Change button text to "تأكيد الإلغاء (عكس محاسبي)"

**Purchasing.tsx / PurchaseProfile.tsx**
- Add `<DocumentStatusBadge docstatus={purchase.docstatus} isApproved={purchase.isApproved} />` in header/detail
- Map existing status (draft/ordered/partial/received/cancelled) if different from docstatus; clarify in UI

**Payments.tsx / PaymentProfile.tsx**
- Add `<DocumentStatusBadge docstatus={payment.docstatus} isVoided={payment.isVoided} />`

**ExpenseProfile.tsx / Expenses.tsx**
- Add `<DocumentStatusBadge docstatus={expense.docstatus} isApproved={expense.isApproved} />`

---

## 6. Phase 4 — Accounting Reversal Display

### 6.1 Types — `src/types/accounting.ts`

**Extend `JournalEntry`:**

```typescript
isPosted?: boolean;
isReversed?: boolean;
reversedByEntryId?: number;
reversedByEntry?: JournalEntry; // Optional nested
// Backend may return: sourceType, sourceId for reversals
```

---

### 6.2 Accounting Page — `src/pages/Accounting.tsx`

**JournalDetailCard (or JournalEntry detail view):**

1. **If `entry.isReversed`:**
   - Show badge: "معكوس"
   - Link: "عكس بواسطة: # entry.reversedByEntryId" (or entry number) — navigates to that entry
2. **If entry is a reversal** (`sourceType === 'reversal'`):
   - Show badge: "قيد عكسي"
   - Link: "عكس لـ # sourceId" (original entry ID)

**List view:**
- Add small indicator (icon or badge) next to reversed entries
- Optional: Filter toggle "إظهار القيود المعكوسة"

---

## 7. Phase 5 — Edit Restrictions + Type Updates

### 7.1 Edit Restrictions

**Rule:** Hide or disable Edit/Delete when `docstatus === 1` (Submitted) or `docstatus === 2` (Cancelled).

**Pages to update:**

| Page | Edit/Delete Location | Condition |
|------|----------------------|-----------|
| Sales.tsx | Edit sale (if exists) | `docstatus !== 1 && !isVoided` |
| PurchaseProfile.tsx | Edit purchase | `docstatus === 0` |
| PaymentProfile.tsx | Edit payment | N/A (payments typically not edited) |
| ExpenseProfile.tsx | Edit expense | `docstatus === 0` |

**Pattern:**

```tsx
{docstatus === 0 && (
    <Button variant="outline" onClick={handleEdit}>تعديل</Button>
)}
```

Or with tooltip when disabled:

```tsx
<Tooltip content="لا يمكن تعديل المستند بعد الترحيل">
    <span><Button disabled={docstatus !== 0}>تعديل</Button></span>
</Tooltip>
```

---

### 7.2 Type Updates (Optional but Recommended)

**Sale** (`src/types/sales.ts`):
```typescript
docstatus?: 0 | 1 | 2;
submittedAt?: string;
submittedById?: number;
cancelledAt?: string;
cancelledById?: number;
cancelReason?: string;
```

**Purchase** (`src/types/purchases.ts`):
```typescript
docstatus?: 0 | 1 | 2;
submittedAt?: string;
submittedById?: number;
cancelledAt?: string;
cancelledById?: number;
cancelReason?: string;
```

**Expense** (`src/types/expenses.ts`):
```typescript
docstatus?: 0 | 1 | 2;
submittedAt?: string;
submittedById?: number;
cancelledAt?: string;
cancelledById?: number;
cancelReason?: string;
```

---

## 8. File Checklist

### New Files

| File | Purpose |
|------|---------|
| `src/components/posting/DocumentStatusBadge.tsx` | Status badge (مسودة / مُرحّل / ملغى) |
| `src/components/posting/CancelConfirmDialog.tsx` | Reusable cancel dialog |
| `src/components/posting/index.ts` | Barrel export |
| `src/lib/api-errors.ts` | Posting error code handling |

### Modified Files

| File | Changes |
|------|---------|
| `src/types/payments.ts` | docstatus, CancelPaymentDto |
| `src/types/sales.ts` | docstatus, cancelled* |
| `src/types/purchases.ts` | docstatus, cancelled* |
| `src/types/expenses.ts` | docstatus, cancelled* |
| `src/types/accounting.ts` | isReversed, reversedByEntryId |
| `src/services/payment.service.ts` | cancelPayment() |
| `src/hooks/use-payments.ts` | useCancelPayment() |
| `src/pages/payments/PaymentProfile.tsx` | Cancel button, dialog |
| `src/pages/Payments.tsx` | Cancel action, status badge |
| `src/pages/Sales.tsx` | Void wording, DocumentStatusBadge |
| `src/pages/Purchasing.tsx` | DocumentStatusBadge |
| `src/pages/purchasing/PurchaseProfile.tsx` | DocumentStatusBadge, edit guard |
| `src/pages/expenses/ExpenseProfile.tsx` | DocumentStatusBadge, edit guard |
| `src/pages/Accounting.tsx` | Reversal display |
| `src/hooks/use-sales.ts` | onError: PERIOD_LOCKED handling |

---

## 9. Testing Checklist

### Payment Cancel
- [ ] Cancel a sale payment → success toast, payment shows "ملغية"
- [ ] Cancel a purchase payment → success toast
- [ ] Cancel already cancelled → ALREADY_CANCELLED toast
- [ ] With period locked → PERIOD_LOCKED toast (requires backend setup)

### Sale Void
- [ ] Void sale → success, sale shows "ملغية"
- [ ] Dialog shows GL reversal note
- [ ] With period locked → PERIOD_LOCKED toast

### Badges
- [ ] Sale: مسودة / مُرحّل / ملغى correct per docstatus
- [ ] Payment: مؤكدة / ملغية
- [ ] Purchase: مسودة / مُرحّل / ملغى
- [ ] Expense: مسودة / مُرحّل / ملغى

### Accounting
- [ ] Reversed entry shows "معكوس" and link to reversal
- [ ] Reversal entry shows "قيد عكسي"

### Edit Restrictions
- [ ] Cannot edit submitted sale
- [ ] Cannot edit submitted purchase
- [ ] Cannot edit submitted expense

---

## 10. RTL and i18n Notes

- All new copy is in Arabic
- Ensure Dialog/Alert content has `dir="rtl"` and `className` for RTL layout
- Buttons: primary action on the right (تأكيد الإلغاء), cancel on the left (إلغاء)

---

## 11. Dependencies

- No new npm packages required
- Uses existing: `@/components/ui/*`, `react-hook-form`, `zod`, `@tanstack/react-query`, `toast`

---

## 12. Rollback

If issues arise:
- Remove Cancel button and dialog; revert `payment.service` and `use-payments`
- Revert badge to `isVoided` / `paymentStatus` only
- Backend `voidPayment` still delegates to `cancelPayment`, so backend stays as-is

---

*End of Plan*
