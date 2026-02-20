# خطة ربط التقارير وواجهات PDF بالفرونت إند

## 1. خرائط واجهات الـ API

### 1.1 تقارير JSON (موجودة ومربوطة)

| المسار | الـ API | الحالة |
|-------|---------|--------|
| `/reports/dashboard` | `GET /v1/reports/dashboard` | ✅ مربوط |
| `/reports/sales` | `GET /v1/reports/sales?startDate=&endDate=` | ✅ مربوط |
| `/reports/purchases` | `GET /v1/reports/purchases?startDate=&endDate=` | ✅ مربوط |
| `/reports/inventory` | `GET /v1/reports/inventory` | ✅ مربوط |
| `/reports/expenses` | `GET /v1/reports/expenses?startDate=&endDate=` | ✅ مربوط |
| `/reports/profit-loss` | `GET /v1/reports/profit-loss?startDate=&endDate=` | ✅ مربوط |
| `/reports/wastage` | `GET /v1/reports/wastage?startDate=&endDate=` | ✅ مربوط |
| `/reports/stock-vs-gl` | `GET /v1/reports/stock-vs-gl?asOfDate=&branchId=` | ✅ مربوط |
| `/reports/vat` | `GET /v1/tax/vat-report?startDate=&endDate=` | ✅ مربوط |

### 1.2 واجهات PDF الكاملة في الـ Backend

| # | الـ API | الـ Query Params | التقرير |
|---|---------|------------------|---------|
| 1 | `GET /v1/sales/report/pdf` | startDate, endDate, language | تقرير المبيعات PDF |
| 2 | `GET /v1/sales/:id/pdf` | language | فاتورة المبيعات PDF |
| 3 | `GET /v1/purchases/report/pdf` | startDate, endDate, language | تقرير المشتريات PDF |
| 4 | `GET /v1/purchases/:id/pdf` | language | أمر الشراء PDF |
| 5 | `GET /v1/inventory/report/pdf` | language, startDate, endDate, asOfDate | تقرير المخزون PDF |
| 6 | `GET /v1/expenses/report/pdf` | startDate, endDate, language | تقرير المصروفات PDF |
| 7 | `GET /v1/debts/receivables/pdf` | startDate, endDate, language | تقرير الذمم المدينة PDF |
| 8 | `GET /v1/debts/payables/pdf` | startDate, endDate, language | تقرير الذمم الدائنة PDF |
| 9 | `GET /v1/suppliers/:id/statement/pdf` | language, startDate, endDate | كشف حساب المورد PDF |
| 10 | `GET /v1/customers/:id/statement/pdf` | language, startDate, endDate | كشف حساب الزبون PDF |
| 11 | `GET /v1/payments/:id/pdf` | language | سند الدفع PDF |
| 12 | `GET /v1/accounting/reports/balance-sheet/pdf` | asOfDate, language | قائمة المركز المالي PDF |
| 13 | `GET /v1/accounting/reports/income-statement/pdf` | startDate, endDate, language | قائمة الدخل PDF |
| 14 | `GET /v1/accounting/reports/trial-balance/pdf` | asOfDate, language | ميزان المراجعة PDF |
| 15 | `GET /v1/accounting/reports/ledger/:accountCode/pdf` | startDate, endDate, language | دفتر حساب PDF |

**ملاحظة:** تقرير الهدر (Wastage) لا يوجد له PDF في الـ Backend حاليًا.

---

## 2. ربط التقارير بـ PDF

| تقرير الفرونت إند | JSON API | PDF API المقابل | ملاحظة |
|-------------------|----------|-----------------|---------|
| المبيعات | `/reports/sales` | `/sales/report/pdf` | نفس الفترة |
| المشتريات | `/reports/purchases` | `/purchases/report/pdf` | نفس الفترة |
| المخزون | `/reports/inventory` | `/inventory/report/pdf` | — |
| المصروفات | `/reports/expenses` | `/expenses/report/pdf` | نفس الفترة |
| الأرباح والخسائر | `/reports/profit-loss` | — | لا PDF مباشر، لكن يوجد `income-statement` في المحاسبة |
| الهدر | `/reports/wastage` | — | لا يوجد PDF |
| المخزون vs الدفاتر | `/reports/stock-vs-gl` | — | لا يوجد PDF |
| ضريبة القيمة المضافة | `/tax/vat-report` | — | لا يوجد PDF |
| قائمة الدخل | — | `/accounting/reports/income-statement/pdf` | من صفحة المحاسبة |
| قائمة المركز المالي | — | `/accounting/reports/balance-sheet/pdf` | من صفحة المحاسبة |
| ميزان المراجعة | `/accounting/trial-balance` | `/accounting/reports/trial-balance/pdf` | من صفحة المحاسبة |
| دفتر الحساب | `/accounting/ledger/:code` | `/accounting/reports/ledger/:code/pdf` | من dialog المحاسبة |

---

## 3. خطة التنفيذ المرحلية

### Phase 1: البنية التحتية (PDF Service + Hooks)

**الملفات:**
- `src/services/pdf.service.ts` — دوال تحميل PDF (تحميل مباشر + رابط المعاينة)
- `src/hooks/use-pdf-download.ts` — Hook للتحميل والمعاينة
- `src/types/pdf.ts` — أنواع `PdfQueryParams`, `PdfReportType`

**الدوال المطلوبة:**
```typescript
// تحميل PDF وتنزيل الملف
downloadReportPdf(type, params, filename?)

// الحصول على رابط للمعاينة (blob URL أو iframe)
getPdfPreviewUrl(type, params) -> string
```

### Phase 2: مكون PDF Preview (Profile View)

**الملف:** `src/components/reports/PdfPreviewDialog.tsx`

**المتطلبات:**
1. Dialog بالكامل `dir="rtl"`
2. عرض الـ PDF داخل `<iframe>` أو `<embed>` أو `react-pdf`
3. أزرار: **معاينة** | **تحميل** | **إغلاق**
4. اختيار اللغة (عربي / إنجليزي)
5. اختيار الفترة أو التاريخ حسب نوع التقرير
6. تصميم حديث: خلفية شفافة، ظلال، زوايا مستديرة

**مكتبة مقترحة للعرض:** `react-pdf` (صفحات متعددة) أو `<iframe src={blobUrl}>` (أبسط)

### Phase 3: ربط زر "تصدير" في صفحة التقارير

**الملف:** `src/pages/Reports.tsx`

لكل تقرير له PDF مقابل:
1. زر **تصدير PDF** يفتح `PdfPreviewDialog`
2. تمرير نوع التقرير والفترة الحالية
3. عند الفتح، طلب PDF من الـ API وعرضه

### Phase 4: ربط PDF في الصفحات الأخرى

| الصفحة | PDF المطلوب | مكان الزر |
|--------|-------------|-----------|
| Sales list / Sale profile | فاتورة `sales/:id/pdf` | زر في صف الفاتورة أو صفحة التفاصيل |
| Purchasing list / Purchase profile | أمر شراء `purchases/:id/pdf` | نفس المنطق |
| Suppliers / Supplier profile | كشف حساب `suppliers/:id/statement/pdf` | زر في صفحة المورد |
| Customers / Customer profile | كشف حساب `customers/:id/statement/pdf` | زر في صفحة الزبون |
| Payments / Payment profile | سند دفع `payments/:id/pdf` | زر في صفحة الدفع |
| Accounting | Balance Sheet, Income Statement, Trial Balance, Ledger | أزرار في الشريط العلوي أو قائمة |

### Phase 5: RTL + شكل عربي احترافي

1. **الصفحة الرئيسية للتقارير**
   - `dir="rtl"` للكل
   - خط عربي: `Tajawal` (موجود بالفعل)
   - تسميات عربية واضحة
   - أيقونات مناسبة

2. **PdfPreviewDialog**
   - `dir="rtl"`
   - ترتيب الأزرار من اليمين لليسار
   - تسميات: معاينة، تحميل، إغلاق

3. **تحسينات بصرية**
   - ألوان متناسقة (أخضر للنجاح، أزرق للمعلومات)
   - ظلال وبعد بين الكروت
   - تكبير/تصغير سلس للمعاينة
   - هيكلة واضحة للأقسام

---

## 4. بنية الملفات المقترحة

```
frontend/src/
├── services/
│   ├── report.service.ts      (موجود - تحديث إن لزم)
│   └── pdf.service.ts         (جديد)
├── hooks/
│   ├── use-reports.ts          (موجود)
│   └── use-pdf-download.ts     (جديد)
├── components/
│   └── reports/
│       ├── PdfPreviewDialog.tsx (جديد)
│       ├── ReportExportButton.tsx (جديد - زر تصدير موحد)
│       └── ReportFilters.tsx   (اختياري - تحسين الفلاتر)
├── types/
│   └── pdf.ts                  (جديد)
└── pages/
    └── Reports.tsx             (تحديث - ربط التصدير)
```

---

## 5. خريطة PDF حسب نوع التقرير

```typescript
export const PDF_REPORT_MAP: Record<string, { endpoint: string; needsDateRange: boolean; needsId?: boolean }> = {
  'sales-report':       { endpoint: '/sales/report/pdf',           needsDateRange: true },
  'purchases-report':   { endpoint: '/purchases/report/pdf',       needsDateRange: true },
  'inventory-report':   { endpoint: '/inventory/report/pdf',        needsDateRange: false },
  'expenses-report':    { endpoint: '/expenses/report/pdf',         needsDateRange: true },
  'receivables-report': { endpoint: '/debts/receivables/pdf',      needsDateRange: true },
  'payables-report':    { endpoint: '/debts/payables/pdf',          needsDateRange: true },
  'balance-sheet':      { endpoint: '/accounting/reports/balance-sheet/pdf', needsDateRange: false },
  'income-statement':   { endpoint: '/accounting/reports/income-statement/pdf', needsDateRange: true },
  'trial-balance':     { endpoint: '/accounting/reports/trial-balance/pdf', needsDateRange: false },
};
```

---

## 6. ملخص الأولويات

| الأولوية | المهمة | الجهد |
|----------|--------|-------|
| 1 | إنشاء `pdf.service.ts` | منخفض |
| 2 | إنشاء `PdfPreviewDialog` مع iframe/embed | متوسط |
| 3 | ربط زر تصدير في Reports.tsx لكل تقرير | متوسط |
| 4 | إضافة أزرار PDF في صفحات المبيعات/المشتريات/المحاسبة | متوسط |
| 5 | تحسين RTL والتصميم العربي | منخفض |

---

## 7. مثال استخدام PdfPreviewDialog

```tsx
// في Reports.tsx - عند النقر على "تصدير"
<PdfPreviewDialog
  open={pdfDialogOpen}
  onOpenChange={setPdfDialogOpen}
  reportType="sales-report"
  params={{
    startDate: rangeForQuery.startDate,
    endDate: rangeForQuery.endDate,
    language: 'ar',
  }}
  title="تصدير تقرير المبيعات PDF"
/>
```

---

## 8. حالة التنفيذ (مُحدّث)

| المرحلة | الحالة | التفاصيل |
|---------|--------|----------|
| Phase 1: البنية التحتية | ✅ مكتمل | pdf.service, use-pdf-download, types |
| Phase 2: PdfPreviewDialog | ✅ مكتمل | RTL، اختيار اللغة، فلاتر التاريخ، تكبير/تصغير، تحديث |
| Phase 3: ربط التقارير | ✅ مكتمل | زر تصدير PDF لكل تقرير له PDF |
| Phase 4: الصفحات الأخرى | ✅ مكتمل | Sales، Purchasing، Accounting، Suppliers، Customers، Payments |
| Phase 5: RTL والعربية | ✅ مكتمل | dir="rtl"، تسميات عربية، ألوان، أيقونات، تكبير PDF |
