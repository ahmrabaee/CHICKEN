# Blueprint 04 — Frontend Implementation Plan
## Receivables & Payables Engine (ERP-Level)

**Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Phase 4–5 Implemented — Enhancements Documented

---

## 1. Executive Summary

This document provides a detailed plan for frontend implementation supporting **Blueprint 04: Receivables & Payables Engine**. The backend already implements Payment Ledger (PLE), Outstanding from PLE, Reconciliation, Credit Notes, and Advance Payments. The frontend must:

1. **Reconciliation Screen** — Match unallocated payments to open invoices (implemented)
2. **Credit Notes Screen** — List, create, submit credit notes (implemented)
3. **Advance Payment** — Create payments without invoice reference (backend ready; frontend optional)
4. **Invoice Detail** — Show computed Outstanding, Allocations, linked Credit Notes (enhancement)
5. **Payment Creation** — Multi-invoice allocation UI (enhancement)
6. **Create Credit Note from Invoice** — Quick action from Sale/Purchase detail (enhancement)

---

## 2. Implementation Phases

| Phase | Scope | Priority | Status | Est. Time |
|-------|-------|----------|--------|-----------|
| **Phase 1** | Reconciliation screen | Critical | ✅ Done | 2–3 hrs |
| **Phase 2** | Credit Notes screen | Critical | ✅ Done | 2 hrs |
| **Phase 3** | Advance payment UI | High | Pending | 1 hr |
| **Phase 4** | Invoice outstanding + allocations display | Medium | Pending | 2 hrs |
| **Phase 5** | Create Credit Note from Invoice | Medium | Pending | 1–2 hrs |
| **Phase 6** | Payment multi-invoice allocation | Low | Pending | 2–3 hrs |

---

## 3. Phase 1 — Reconciliation Screen (✅ Implemented)

### 3.1 Routes & Navigation

**Route:** `/reconciliation`  
**Sidebar:** المدفوعات → مطابقة الدفعات

**App.tsx:**
```tsx
<Route path="/reconciliation" element={<Reconciliation />} />
```

**AppSidebar.tsx:** Payments group with children:
- قائمة المدفوعات → `/payments`
- مطابقة الدفعات → `/reconciliation`
- الإشعارات الدائنة → `/credit-notes`

---

### 3.2 Service — `src/services/reconciliation.service.ts`

**API methods:**
- `getOpenInvoices(partyType, partyId)` → GET `/reconciliation/open-invoices`
- `getUnallocatedPayments(partyType, partyId)` → GET `/reconciliation/unallocated-payments`
- `getSuggest(partyType, partyId)` → GET `/reconciliation/suggest`
- `apply(body)` → POST `/reconciliation/apply`

**Types:**
```typescript
interface OpenInvoice {
  voucherType: 'sale' | 'purchase';
  voucherId: number;
  voucherNumber: string;
  partyName: string;
  postingDate: string;
  dueDate: string | null;
  totalAmount: number;
  outstandingAmount: number;
}

interface UnallocatedPayment {
  id: number;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  partyName: string;
}

interface SuggestMatch {
  paymentId: number;
  paymentNumber: string;
  invoiceType: 'sale' | 'purchase';
  invoiceId: number;
  invoiceNumber: string;
  amount: number;
  score: number;
}
```

---

### 3.3 Page — `src/pages/Reconciliation.tsx`

**Layout:**
1. **Party selector** — Select customer or supplier; required before loading data
2. **Open Invoices card** — Table: voucher number, date, total, outstanding
3. **Unallocated Payments card** — Table: payment number, date, amount, unallocated
4. **Suggest matches card** — Table of suggested allocations; "تطبيق الكل" button; editable amounts

**Flow:**
1. User selects party type (customer/supplier) and party
2. Load open invoices + unallocated payments (parallel queries)
3. Load suggest matches; user may click "تطبيق الكل" to pre-fill allocations
4. User may edit allocation amounts in table
5. Click "تطبيق التخصيصات" → POST `/reconciliation/apply`

**RTL:** `dir="rtl"` on main container  
**Currency:** Minor units → display as ₪ X.XX via `/100`

---

## 4. Phase 2 — Credit Notes Screen (✅ Implemented)

### 4.1 Routes & Navigation

**Route:** `/credit-notes`  
**Sidebar:** المدفوعات → الإشعارات الدائنة

---

### 4.2 Service — `src/services/credit-note.service.ts`

**API methods:**
- `getAll(params)` → GET `/credit-notes`
- `getById(id)` → GET `/credit-notes/:id`
- `create(data)` → POST `/credit-notes`
- `submit(id)` → POST `/credit-notes/:id/submit`

**Create DTO:**
```typescript
interface CreateCreditNoteDto {
  originalInvoiceType: 'sale' | 'purchase';
  originalInvoiceId: number;
  amount: number;
  reason?: string;
  branchId?: number;
}
```

---

### 4.3 Page — `src/pages/CreditNotes.tsx`

**Layout:**
1. Header: title "الإشعارات الدائنة", button "إنشاء إشعار دائن"
2. Table: credit note number, date, original invoice (type + ID), amount, status (مسودة / مُرحّل)
3. Action: "ترحيل" button for draft items

**Create dialog:**
- نوع الفاتورة (sale / purchase)
- رقم الفاتورة (ID)
- المبلغ (شيكل)
- السبب (اختياري)

**Status labels:** 0 = مسودة, 1 = مُرحّل, 2 = ملغى

---

## 5. Phase 3 — Advance Payment UI (Pending)

### 5.1 Purpose

Allow creating a payment without linking to a specific invoice. The payment becomes "unallocated" and appears in Reconciliation for later matching.

### 5.2 Implementation

**PaymentProfile.tsx or new flow:**

Add tab/section for "دفعة مسبقة" (Advance Payment):
- Party type: customer | supplier
- Party (from customers/suppliers list)
- Amount, payment method, date, receipt number, notes
- Submit → POST `/payments/advance`

**DTO:** `CreateAdvancePaymentDto` — already defined in backend.

**Service:** Add `createAdvancePayment(dto)` to `payment.service.ts`.

---

## 6. Phase 4 — Invoice Outstanding & Allocations Display (Pending)

### 6.1 Sale Detail — `src/pages/Sales.tsx` or Sale detail component

**Add section:** "المستحق والتخصيصات"

1. **Outstanding (computed):**
   - API: `GET /reconciliation/outstanding/sale/:id`
   - Display: "المبلغ المتبقي: ₪ X.XX"

2. **Allocations table:**
   - Show payments allocated to this sale
   - Columns: Payment number, amount allocated, date
   - (Backend may need endpoint to return allocations per invoice — or derive from PLE)

3. **Linked Credit Notes:**
   - List credit notes where `originalInvoiceType=sale`, `originalInvoiceId=id`
   - API: `GET /credit-notes?originalInvoiceType=sale&originalInvoiceId=:id` (extend backend if needed)
   - Or filter client-side from full credit notes list

### 6.2 Purchase Detail — same pattern for purchases

---

## 7. Phase 5 — Create Credit Note from Invoice (Pending)

### 7.1 Purpose

From Sale or Purchase detail page, add button "إنشاء رصيد دائن" that opens create dialog with:
- `originalInvoiceType` and `originalInvoiceId` pre-filled
- Max amount = current outstanding (fetch from outstanding API)
- Amount input validated ≤ outstanding

### 7.2 Implementation

**Sale detail page:**
- Button: "إنشاء رصيد دائن"
- Opens `CreditNoteCreateDialog` with `originalInvoiceType='sale'`, `originalInvoiceId=sale.id`
- Fetch outstanding: `GET /reconciliation/outstanding/sale/:id`
- Max amount hint: "الحد الأقصى: ₪ X.XX"

**CreditNoteCreateDialog** — reusable component:
- Props: `originalInvoiceType`, `originalInvoiceId`, `onSuccess`, `onClose`
- On create success → invalidate credit-notes, outstanding, optionally navigate to credit note

---

## 8. Phase 6 — Payment Multi-Invoice Allocation (Pending)

### 8.1 Purpose

When recording a payment, allow allocating to multiple invoices (or creating advance) instead of single invoice only.

### 8.2 Implementation

**PaymentProfile.tsx (new payment flow):**

1. **Mode:** "دفعة لفاتورة واحدة" vs "دفعة متعددة الفواتير" vs "دفعة مسبقة"
2. **Single invoice:** Current flow — select sale/purchase, amount
3. **Multi-invoice:**
   - Select party (customer/supplier)
   - Enter total amount
   - Table of open invoices with allocation amount per row
   - Validation: sum(allocations) ≤ payment amount; each ≤ outstanding
   - Submit → create Payment (with referenceType=null for allocation?) + call allocation API
4. **Advance:** As in Phase 3

**Backend note:** Multi-invoice payment creation may require new endpoint that creates Payment + allocations in one call.

---

## 9. Error Handling

### 9.1 Reconciliation Apply Errors

| Code | Message (AR) | Action |
|------|--------------|--------|
| OVER_ALLOCATION | إجمالي التخصيص يتجاوز المبلغ المتاح | Toast destructive |
| EXCEEDS_OUTSTANDING | المبلغ يتجاوز المستحق | Toast destructive |
| PERIOD_LOCKED | الفترة المحاسبية مغلقة | Toast destructive |
| NO_PARTY | الدفعة يجب أن يكون لها طرف | Toast destructive |

### 9.2 Credit Note Errors

| Code | Message (AR) | Action |
|------|--------------|--------|
| EXCEEDS_OUTSTANDING | مبلغ الإشعار الدائن يتجاوز المستحق | Toast destructive |

---

## 10. File Checklist

### Implemented

| File | Purpose |
|------|---------|
| `src/services/reconciliation.service.ts` | Reconciliation API client |
| `src/services/credit-note.service.ts` | Credit notes API client |
| `src/pages/Reconciliation.tsx` | Reconciliation screen |
| `src/pages/CreditNotes.tsx` | Credit notes list + create |
| `App.tsx` | Routes for /reconciliation, /credit-notes |
| `AppSidebar.tsx` | Nav: مطابقة الدفعات، الإشعارات الدائنة |
| `src/pages/Payments.tsx` | Advance payment type display (referenceType null) |

### Pending Enhancements

| File | Change |
|------|--------|
| `src/pages/payments/PaymentProfile.tsx` | Advance payment form; multi-invoice allocation |
| `src/services/payment.service.ts` | createAdvancePayment() |
| `src/types/payments.ts` | referenceType?, referenceId? optional |
| `src/pages/Sales.tsx` / Sale detail | Outstanding, allocations, Credit Notes section; "إنشاء رصيد دائن" |
| `src/pages/Purchasing.tsx` / Purchase detail | Same as Sales |
| `src/components/credit-note/CreditNoteCreateDialog.tsx` | Reusable create dialog |

---

## 11. Testing Checklist

- [ ] Reconciliation: select party → open invoices and unallocated payments load
- [ ] Reconciliation: suggest matches → "تطبيق الكل" pre-fills; apply succeeds
- [ ] Reconciliation: edit allocation amounts → apply succeeds
- [ ] Reconciliation: no party selected → no API calls
- [ ] Credit Notes: list loads; create dialog opens
- [ ] Credit Notes: create with amount > outstanding → error toast
- [ ] Credit Notes: submit draft → status changes to مُرحّل
- [ ] Credit Notes: amount in minor units displayed correctly (₪)
- [ ] Payments: advance payment shows "دفعة مسبقة" in detail (referenceType null)
- [ ] Navigation: مطابقة الدفعات and الإشعارات الدائنة links work

---

## 12. RTL and i18n Notes

- All copy in Arabic
- `dir="rtl"` on main containers
- Tables: headers and cells RTL-aligned
- Currency: ₪ (ILS) with 2 decimal places
- Dates: `toLocaleDateString("ar-SA", { year, month, day })`

---

## 13. Dependencies

- No new npm packages required
- Uses existing: `@/components/ui/*`, `@tanstack/react-query`, `toast`, `axios`

---

*End of Plan*
