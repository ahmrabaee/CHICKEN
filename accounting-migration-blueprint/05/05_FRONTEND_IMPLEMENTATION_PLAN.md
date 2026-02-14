# Blueprint 05 — Frontend Implementation Plan
## Tax Engine & VAT Architecture (محرك الضرائب ومعمارية ضريبة القيمة المضافة)

**Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Ready for Implementation  
**Prerequisite:** Blueprint 01 (Chart of Accounts), Blueprint 02 (GL Engine) frontend applied

---

## 1. Executive Summary

This document provides a detailed plan for frontend changes supporting **Blueprint 05: Tax Engine & VAT Architecture**. The backend already implements Tax Templates, tax calculation, separate VAT GL posting (Revenue = netTotal, VAT Payable/Receivable), and VAT Report API. The frontend must:

1. **Tax Template selector** — اختيار قالب الضريبة في المبيعات والمشتريات
2. **Invoice totals display** — عرض Net Total، Tax Breakdown، Grand Total
3. **Tax Engine toggle** — تفعيل/تعطيل Tax Engine في إعدادات المحاسبة
4. **Tax Templates management** — صفحة إدارة قوالب الضرائب (CRUD)
5. **VAT Report screen** — صفحة تقرير ضريبة القيمة المضافة

---

## 2. Blueprint 05 Frontend Impact (من الوثيقة الأصلية)

| البند | الوصف | الأولوية |
|-------|-------|----------|
| Invoice Screen | اختيار Tax Template، عرض Net/Tax/Grand Total | عالية |
| Tax Breakdown | جدول تفصيل الضرائب (حساب، نسبة، مبلغ) | عالية |
| Purchase Screen | نفس المنطق + Input VAT | عالية |
| Tax Template UI | إدارة قوالب الضرائب | متوسطة |
| VAT Report | تقرير Output/Input VAT، Net Payable | متوسطة |
| Settings | تفعيل Tax Engine | عالية |

---

## 3. Implementation Phases

| Phase | Scope | Priority | Est. Time |
|-------|-------|----------|-----------|
| **Phase 1** | Types + Tax Service + Hooks | Critical | 1–1.5 hrs |
| **Phase 2** | Settings — تفعيل Tax Engine | High | 30 min |
| **Phase 3** | Sale/POS — Tax Template selector + Totals display | High | 2–3 hrs |
| **Phase 4** | Tax Templates management page | Medium | 2–3 hrs |
| **Phase 5** | VAT Report page | Medium | 1.5–2 hrs |
| **Phase 6** | Purchase — Tax support (اختياري) | Low | 1–2 hrs |

---

## 4. Phase 1 — Types, Service, Hooks

### 4.1 Types — `src/types/tax.ts` (NEW)

```typescript
/**
 * Blueprint 05: Tax Engine types
 */

export interface TaxTemplateItem {
    id: number;
    templateId: number;
    accountId: number;
    rate: number;  // Basis points (1500 = 15%)
    chargeType: string;
    rowId?: number | null;
    fixedAmount?: number | null;
    isDeductible?: boolean;
    displayOrder: number;
    account?: { id: number; code: string; name: string };
}

export interface TaxTemplate {
    id: number;
    name: string;
    type: 'sales' | 'purchases';
    companyId?: number | null;
    isActive: boolean;
    items: TaxTemplateItem[];
}

export interface VATReport {
    outputVat: number;
    inputVat: number;
    netVatPayable: number;
    byAccount: {
        accountId: number;
        accountCode: string;
        accountName: string;
        output: number;
        input: number;
    }[];
    byRate: { rate: number; output: number; input: number }[];
}

export interface CreateTaxTemplateDto {
    name: string;
    type: 'sales' | 'purchases';
    companyId?: number;
    items: Array<{
        accountId: number;
        rate: number;
        chargeType?: string;
        rowId?: number;
        fixedAmount?: number;
        displayOrder?: number;
    }>;
}
```

---

### 4.2 Service — `src/services/tax.service.ts` (NEW)

```typescript
import axiosInstance from '@/lib/axios';
import type { TaxTemplate, VATReport, CreateTaxTemplateDto } from '@/types/tax';

const BASE = '/tax';

export const taxService = {
    async getTemplates(type?: 'sales' | 'purchases', companyId?: number): Promise<TaxTemplate[]> {
        const params: Record<string, string> = {};
        if (type) params.type = type;
        if (companyId != null) params.companyId = String(companyId);
        const response = await axiosInstance.get<{ data?: TaxTemplate[] }>(`${BASE}/templates`, { params });
        return response.data?.data ?? response.data ?? [];
    },

    async getTemplate(id: number): Promise<TaxTemplate> {
        const response = await axiosInstance.get<{ data?: TaxTemplate }>(`${BASE}/templates/${id}`);
        return response.data?.data ?? response.data;
    },

    async createTemplate(data: CreateTaxTemplateDto): Promise<TaxTemplate> {
        const response = await axiosInstance.post<{ data?: TaxTemplate }>(`${BASE}/templates`, data);
        return response.data?.data ?? response.data;
    },

    async updateTemplate(id: number, data: Partial<CreateTaxTemplateDto>): Promise<TaxTemplate> {
        const response = await axiosInstance.put<{ data?: TaxTemplate }>(`${BASE}/templates/${id}`, data);
        return response.data?.data ?? response.data;
    },

    async deleteTemplate(id: number): Promise<void> {
        await axiosInstance.delete(`${BASE}/templates/${id}`);
    },

    async getVATReport(startDate: string, endDate: string, companyId?: number): Promise<VATReport> {
        const params: Record<string, string> = { startDate, endDate };
        if (companyId != null) params.companyId = String(companyId);
        const response = await axiosInstance.get<{ data?: VATReport }>(`${BASE}/vat-report`, { params });
        return response.data?.data ?? response.data ?? { outputVat: 0, inputVat: 0, netVatPayable: 0, byAccount: [], byRate: [] };
    },
};
```

**ملاحظة:** تحقق من شكل استجابة الـ API — قد تكون `{ data: T }` أو `T` مباشرة.

---

### 4.3 Hooks — `src/hooks/use-tax.ts` (NEW)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taxService } from '@/services/tax.service';
import { toast } from 'sonner';
import type { CreateTaxTemplateDto } from '@/types/tax';

export const useTaxTemplates = (type?: 'sales' | 'purchases') => {
    return useQuery({
        queryKey: ['tax', 'templates', type],
        queryFn: () => taxService.getTemplates(type),
    });
};

export const useTaxTemplate = (id: number | null) => {
    return useQuery({
        queryKey: ['tax', 'templates', id],
        queryFn: () => taxService.getTemplate(id!),
        enabled: !!id,
    });
};

export const useCreateTaxTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateTaxTemplateDto) => taxService.createTemplate(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tax', 'templates'] });
            toast.success('تم إنشاء قالب الضريبة بنجاح');
        },
        onError: (e: any) => toast.error(e.response?.data?.messageAr ?? 'فشل إنشاء القالب'),
    });
};

export const useUpdateTaxTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<CreateTaxTemplateDto> }) =>
            taxService.updateTemplate(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tax', 'templates'] });
            toast.success('تم تحديث القالب بنجاح');
        },
    });
};

export const useDeleteTaxTemplate = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => taxService.deleteTemplate(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tax', 'templates'] });
            toast.success('تم حذف القالب');
        },
        onError: (e: any) => {
            if (e.response?.data?.code === 'TEMPLATE_IN_USE') {
                toast.error('لا يمكن حذف القالب لاستخدامه في فواتير');
            } else toast.error(e.response?.data?.messageAr ?? 'فشل الحذف');
        },
    });
};

export const useVATReport = (startDate: string, endDate: string, companyId?: number) => {
    return useQuery({
        queryKey: ['tax', 'vat-report', startDate, endDate, companyId],
        queryFn: () => taxService.getVATReport(startDate, endDate, companyId),
        enabled: !!startDate && !!endDate,
    });
};
```

---

### 4.4 Update `src/types/sales.ts`

**إضافة إلى `CreateSaleDto`:**
```typescript
taxTemplateId?: number;
```

**إضافة إلى `Sale`:**
```typescript
taxTemplateId?: number;
netTotal?: number;
totalTaxAmount?: number;
grandTotal?: number;
```

---

### 4.5 Update `src/types/purchases.ts` (إن وُجد)

نفس الحقول: `taxTemplateId`, `netTotal`, `totalTaxAmount`, `grandTotal`.

---

## 5. Phase 2 — Settings: تفعيل Tax Engine

### 5.1 تحديث `AccountingSettingsTab.tsx`

**إضافة قسماً جديداً:**

```tsx
// بعد قسم GL Engine، إضافة:
<div className="flex items-center justify-between rounded-lg border p-4">
    <div className="space-y-0.5">
        <Label className="text-base">تفعيل محرك الضرائب (Tax Engine)</Label>
        <p className="text-sm text-muted-foreground">
            عند التفعيل: فصل الإيراد عن الضريبة، إنشاء قيود VAT Payable/Receivable منفصلة.
        </p>
    </div>
    <Switch
        checked={taxEngineEnabled}
        onCheckedChange={handleTaxEngineToggle}
        disabled={updateSettingMutation.isPending}
    />
</div>
```

- استخدام `settings.tax_engine_enabled` للقراءة
- `PUT /settings/tax_engine_enabled` مع `{ value: "true" | "false" }`

---

## 6. Phase 3 — Sale / POS: Tax Template و Totals

### 6.1 مكون `TaxTemplateSelector.tsx` (NEW)

```tsx
// src/components/tax/TaxTemplateSelector.tsx
interface TaxTemplateSelectorProps {
    value: number | null;
    onChange: (id: number | null) => void;
    type: 'sales' | 'purchases';
    allowClear?: boolean;
}
```

- استدعاء `useTaxTemplates('sales')` أو `useTaxTemplates('purchases')`
- عرض `Select` مع خيار "بدون ضريبة" (null)
- عند تغيير القالب: إعادة حساب المجاميع (إن كان الحساب client-side)

---

### 6.2 مكون `TaxBreakdownTable.tsx` (NEW)

```tsx
// عرض تفصيل الضرائب عند وجود taxTemplateId و netTotal
// الإدخال: taxTemplateId, netTotal (minor units)
// الحساب: يمكن استدعاء API لحساب الضرائب، أو الاعتماد على الـ backend عند الـ submit
```

**ملاحظة:** الحساب يتم في الـ backend عند إنشاء البيع. للعرض المسبق (قبل الحفظ)، يمكن:
- **Option A:** إضافة endpoint `POST /tax/calculate` يرجع المبالغ (إن وُجد)
- **Option B:** حساب تقريبي في الـ frontend باستخدام نفس منطق on_net_total (netTotal * rate / 10000)

---

### 6.3 تحديث `POS.tsx` و `Sales.tsx`

**عند وجود نموذج إنشاء بيع:**

1. إضافة `TaxTemplateSelector` (type="sales")
2. حفظ `taxTemplateId` في الـ state وتمريره إلى `CreateSaleDto`
3. **عرض Totals:**
   - صافي المبلغ (قبل الضريبة) = مجموع البنود - الخصم
   - ضريبة = يحسبها الـ backend؛ للعرض المسبق يمكن تقديرها إذا كان قالب بسيط (on_net_total 15%): `Math.round(netTotal * 0.15)`
   - الإجمالي = صافي + ضريبة

4. **تحديث الـ DTO:** إرسال `taxTemplateId` عند اختيار قالب

---

### 6.4 مثال تكامل في POS

```tsx
// في POS أو SaleCreateForm
const [taxTemplateId, setTaxTemplateId] = useState<number | null>(null);

// في dto
const dto: CreateSaleDto = {
    ...
    taxTemplateId: taxTemplateId ?? undefined,
};

// عرض المجاميع
const netTotal = subtotal; // بعد الخصم
const estimatedTax = taxTemplateId ? Math.round(netTotal * 0.15) : 0; // تبسيط لقالب 15%
const grandTotal = netTotal + estimatedTax;
```

---

## 7. Phase 4 — Tax Templates Management

### 7.1 صفحة `TaxTemplates.tsx` (NEW)

**المسار:** `/settings/tax-templates` أو تبويب في Settings

**المحتوى:**
- جدول قوالب الضرائب (الاسم، النوع، عدد البنود، الحالة)
- أزرار: إضافة، تعديل، حذف
- فلتر حسب النوع (مبيعات / مشتريات)

---

### 7.2 حوار `TaxTemplateFormDialog.tsx` (NEW)

**لإنشاء/تعديل قالب:**
- حقل الاسم
- اختيار النوع: مبيعات / مشتريات
- جدول البنود:
  - حساب (Select من postable accounts أو حسابات نوع Tax)
  - النسبة (basis points، مثلاً 1500 = 15%)
  - نوع الحساب: On Net Total / On Previous Row / Actual
  - للـ Actual: مبلغ ثابت
  - للـ On Previous Row: row_id

---

### 7.3 إضافة رابط في الإعدادات

في `Settings.tsx` أو `AppSidebar`:
- تبويب "قوالب الضرائب" أو رابط `/settings/tax-templates`

---

### 7.4 Route

```tsx
// App.tsx
<Route path="/settings/tax-templates" element={<TaxTemplates />} />
```

---

## 8. Phase 5 — VAT Report Page

### 8.1 صفحة `VATReport.tsx` (NEW)

**المسار:** `/reports/vat`

**المحتوى:**
- فلتر الفترة: startDate, endDate (DatePicker أو inputs)
- زر "عرض التقرير"
- ملخص:
  - Output VAT (من المبيعات)
  - Input VAT (من المشتريات)
  - Net VAT Payable
- جدول تفصيل حسب الحساب: الحساب، Output، Input
- (اختياري) تفصيل حسب النسبة

---

### 8.2 مكونات مساعدة

```
VATReportFilters.tsx — startDate, endDate
VATReportSummary.tsx — البطاقات الثلاث (Output, Input, Net)
VATReportByAccountTable.tsx — جدول byAccount
```

---

### 8.3 إضافة رابط في التقارير

في `Reports.tsx`:
```tsx
{ href: "/reports/vat", label: "تقرير ضريبة القيمة المضافة", icon: Receipt }
```

---

### 8.4 Route

```tsx
<Route path="/reports/vat" element={<VATReport />} />
```

---

## 9. Phase 6 — Purchase Tax Support (اختياري)

### 9.1 نفس منطق المبيعات

- إضافة `TaxTemplateSelector` (type="purchases") في نموذج إنشاء الشراء
- عرض Net Total، Input VAT، Grand Total
- تمرير `taxTemplateId` إلى `CreatePurchaseDto`

**ملاحظة:** الـ backend قد يحتاج تحديث لـ Purchase creation flow لدعم taxTemplateId (راجع 05_IMPLEMENTATION_SUMMARY).

---

## 10. API Routes Summary (Backend)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/tax/templates` | قائمة قوالب الضرائب (?type=sales\|purchases) |
| GET | `/v1/tax/templates/:id` | قالب بالتفصيل |
| POST | `/v1/tax/templates` | إنشاء قالب |
| PUT | `/v1/tax/templates/:id` | تحديث قالب |
| DELETE | `/v1/tax/templates/:id` | حذف قالب |
| GET | `/v1/tax/vat-report` | تقرير VAT (?startDate=&endDate=) |
| GET | `/v1/settings` | يشمل tax_engine_enabled |
| PUT | `/v1/settings/tax_engine_enabled` | تفعيل/تعطيل |

---

## 11. Files to Create/Modify

| File | Action |
|------|--------|
| `src/types/tax.ts` | NEW — TaxTemplate, VATReport, CreateTaxTemplateDto |
| `src/types/sales.ts` | Update — taxTemplateId, netTotal, totalTaxAmount, grandTotal |
| `src/types/purchases.ts` | Update — نفس الحقول (إن وُجد) |
| `src/services/tax.service.ts` | NEW |
| `src/hooks/use-tax.ts` | NEW |
| `src/components/tax/TaxTemplateSelector.tsx` | NEW |
| `src/components/tax/TaxBreakdownTable.tsx` | NEW (اختياري للعرض المسبق) |
| `src/components/settings/AccountingSettingsTab.tsx` | Update — Tax Engine toggle |
| `src/pages/Settings.tsx` | Update — تبويب أو رابط قوالب الضرائب |
| `src/pages/tax/TaxTemplates.tsx` | NEW |
| `src/components/tax/TaxTemplateFormDialog.tsx` | NEW |
| `src/pages/reports/VATReport.tsx` | NEW |
| `src/pages/Reports.tsx` | Update — رابط تقرير VAT |
| `src/pages/POS.tsx` | Update — TaxTemplateSelector, عرض totals |
| `src/pages/Sales.tsx` | Update — إن وُجد نموذج إنشاء بيع |
| `src/App.tsx` | Update — Routes |

---

## 12. Dependencies

- لا توجد حزم npm جديدة مطلوبة.
- استخدام المكونات الموجودة: Select, Table, Card, DatePicker (إن وُجد).

---

## 13. ترتيب التنفيذ الموصى به

```
1. Phase 1: Types, tax.service, use-tax hooks
2. Phase 2: AccountingSettingsTab — Tax Engine toggle
3. Phase 3: TaxTemplateSelector + تحديث CreateSaleDto في POS
4. Phase 5: VAT Report page (أبسط من إدارة القوالب)
5. Phase 4: Tax Templates management page
6. Phase 6: Purchase tax (إن لزم)
```

---

## 14. ملاحظات إضافية

- **الوحدات:** المبالغ دائماً في minor units (قرش). عرض للمستخدم: `/ 100` مع منزلتين.
- **tax_engine_enabled:** عند false، عدم إظهار اختيار قالب الضريبة أو إظهاره مع تحذير أن القيود الضريبية لن تُنشأ.
- **Backend:** إنشاء بيع مع taxTemplateId يعمل حالياً؛ التأكد من تفعيل tax_engine_enabled و gl_engine_enabled للقيود الصحيحة.
