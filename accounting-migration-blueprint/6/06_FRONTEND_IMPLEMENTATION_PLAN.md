# Blueprint 06 — Frontend Implementation Plan
## Inventory Valuation & Stock Accounting

**Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Partially Implemented

---

## 1. Executive Summary

This document outlines frontend changes supporting **Blueprint 06: Inventory Valuation & Stock Accounting**. The backend implements Stock Ledger Entry (SLE), branch-specific stock accounts, and a Stock vs GL reconciliation report. The frontend must:

1. **Expose Stock vs GL Report** — comparison of SLE totals with GL balance
2. **Allow date selection** for reconciliation
3. (Optional) **Branch stock account selector** — configure which account each branch uses
4. (Optional) **SLE display** in stock movement history or item detail

---

## 2. Implementation Phases

| Phase | Scope | Priority | Status |
|-------|-------|----------|--------|
| **Phase 1** | Stock vs GL report page | Critical | ✅ Done |
| **Phase 2** | Report service + hooks | Critical | ✅ Done |
| **Phase 3** | Sidebar navigation | High | ✅ Done |
| **Phase 4** | Branch stock account selector | Medium | ✅ Done |
| **Phase 5** | SLE history in inventory/item screens | Low | ☐ Future |

---

## 3. Phase 1 — Stock vs GL Report (Done)

### 3.1 Service — `src/services/report.service.ts`

**Added:**
```typescript
async getStockVsGLReport(params?: { asOfDate?: string; branchId?: number }): Promise<StockVsGLReport>

export interface StockVsGLReport {
  asOfDate: string;
  branchId?: number | null;
  rows: Array<{
    voucherType: string;
    voucherId: number;
    postingDate: string;
    stockValue: number;
    accountValue: number;
    difference: number;
    ledgerType: string;
  }>;
  summary: {
    totalStockValue: number;
    totalAccountValue: number;
    totalDifference: number;
  };
}
```

### 3.2 Hook — `src/hooks/use-reports.ts`

**Added:**
```typescript
export const useStockVsGLReport = (params?: { asOfDate?: string; branchId?: number }) => {
  return useQuery({
    queryKey: ['reports', 'stock-vs-gl', params],
    queryFn: () => reportService.getStockVsGLReport(params),
  });
};
```

### 3.3 Report Page — `src/pages/Reports.tsx`

**Added:**
- Report link: "المخزون مقابل الدفاتر" → `/reports/stock-vs-gl`
- Date picker for `asOfDate`
- Summary cards: قيمة المخزون (SLE)، قيمة الدفاتر (GL)، الفرق
- Detail table: voucherType, voucherId, postingDate, stockValue, accountValue, difference, ledgerType
- Highlight rows with `difference !== 0` (amber)

### 3.4 Routing — `src/App.tsx`

**Added:**
```tsx
<Route path="/reports/stock-vs-gl" element={<Reports />} />
```

### 3.5 Sidebar — `src/components/layout/AppSidebar.tsx`

**Added:**
```tsx
{ title: "Stock vs GL", titleAr: "المخزون مقابل الدفاتر", href: "/reports/stock-vs-gl", icon: Scale }
```

---

## 4. Phase 4 — Branch Stock Account Selector (Done)

### 4.1 API

Ensure backend supports `PATCH /branches/:id` with `stockAccountId`:
```json
{ "stockAccountId": 5 }
```

### 4.2 Types — `src/types/branch.ts`

```typescript
export interface Branch {
  // ...existing
  stockAccountId?: number | null;
  stockAccount?: { id: number; code: string; name: string };
}
```

### 4.3 Branch Profile — `BranchProfile.tsx`

- Add **حساب المخزون** dropdown: fetch accounts where `code` in ['1130','1131','1132'] or `parentAccountCode === '1130'`
- On save, include `stockAccountId` in payload
- Display current stock account in view mode

### 4.4 Branches List

- Optional: show stock account code per branch in table

---

## 5. Phase 5 — SLE Display (Future)

### 5.1 New Endpoint (Backend)

```
GET /inventory/items/:itemId/stock-ledger?branchId=&from=&to=
```

Returns SLE entries for an item, optionally filtered by branch and date range.

### 5.2 Inventory Item Detail

- Add tab "حركات دفتر المخزون" showing SLE history with: postingDate, voucherType, voucherId, qtyChange, valuationRate, stockValueDifference
- Link to source voucher (sale, purchase, adjustment)

### 5.3 Stock Movement Screen

- Option to show SLE alongside or instead of stock_movements
- Display valuation_rate and stock_value_difference per movement

---

## 6. Error Handling

| Error | User Message |
|-------|--------------|
| 401 | توجيه لصفحة تسجيل الدخول |
| 403 | "ليس لديك صلاحية لعرض هذا التقرير" |
| 500 | "حدث خطأ في تحميل التقرير. حاول لاحقاً." |
| Empty report | "لا توجد حركات مخزون مرحلة حتى هذا التاريخ" |

---

## 7. Localization

| Key | Arabic |
|-----|--------|
| Report title | المخزون مقابل الدفاتر |
| Stock value | قيمة المخزون (SLE) |
| Account value | قيمة الدفاتر (GL) |
| Difference | الفرق |
| Voucher type | النوع |
| Voucher ID | رقم الـ Voucher |
| Posting date | التاريخ |

---

## 8. Files Modified (Phase 1–4)

### Phase 1–3
- `src/services/report.service.ts` — getStockVsGLReport, StockVsGLReport type
- `src/hooks/use-reports.ts` — useStockVsGLReport
- `src/pages/Reports.tsx` — stock-vs-gl section, date picker, table
- `src/App.tsx` — route
- `src/components/layout/AppSidebar.tsx` — report link

### Phase 4 (Branch Stock Account Selector)
- **Backend:** `branches/dto/branch.dto.ts` — stockAccountId in CreateBranchDto, stockAccountId/stockAccount in BranchResponseDto
- **Backend:** `branches/branches.service.ts` — include stockAccount in queries, handle stockAccountId in create/update
- **Frontend:** `types/branch.ts` — stockAccountId, stockAccount on Branch; stockAccountId on CreateBranchDto, UpdateBranchDto
- **Frontend:** `pages/branches/BranchProfile.tsx` — حساب المخزون dropdown (useAccounts, filter 113x), display in sidebar
