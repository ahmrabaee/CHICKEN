# خطة توحيد تصميم PDF لجميع التقارير

## الحالة الحالية

✅ **تم تنفيذ تصميم تقرير المبيعات بنجاح** ويشمل:
- pdfmake-rtl للنص العربي و RTL
- هيدر غني (اسم التطبيق، المحل، التاريخ، الشعار)
- فوتر موحد
- تاريخ بصيغة DD-MM-YYYY بأرقام غربية
- ألوان موحدة وجداول منسقة

---

## نقطة مركزية: PdfService

**جميع التقارير تمر عبر `PdfService.generate()`** — التصميم يُطبَّق تلقائياً من مصدر واحد.

| المكون | الملف | يُطبَّق على |
|--------|-------|-------------|
| الهيدر + الفوتر + RTL | `pdf.service.ts` | كل التقارير |
| الألوان والهوامش | `pdf.constants.ts` | كل التقارير |
| تنسيق التاريخ | `pdf.helpers.ts` | كل التقارير |

---

## قائمة التقارير (15 نوعاً)

### تقارير جدولية (buildReportPdfOptions)
| # | النوع | الخدمة | الحالة |
|---|-------|--------|--------|
| 1 | تقرير المبيعات | sales.service | ✅ مطبّق |
| 2 | تقرير المشتريات | purchases.service | نفس التصميم |
| 3 | تقرير المخزون | inventory.service | نفس التصميم |
| 4 | تقرير المصروفات | expenses.service | نفس التصميم |
| 5 | الذمم المدينة | debts.service | نفس التصميم |
| 6 | الذمم الدائنة | debts.service | نفس التصميم |
| 7 | ميزان المراجعة | accounting.service | نفس التصميم |
| 8 | دفتر الحساب | accounting.service | نفس التصميم |

### قوائم مالية (buildFinancialStatementPdfOptions)
| # | النوع | الخدمة | الحالة |
|---|-------|--------|--------|
| 9 | قائمة المركز المالي | accounting.service | نفس التصميم |
| 10 | قائمة الدخل | accounting.service | نفس التصميم |

### وثائق فردية (قوالب مخصّصة)
| # | النوع | القالب | الحالة |
|---|-------|--------|--------|
| 11 | فاتورة بيع | invoice.template | نفس التصميم |
| 12 | أمر شراء | purchase-order.template | نفس التصميم |
| 13 | كشف حساب مورد | statement.template | نفس التصميم |
| 14 | كشف حساب عميل | statement.template | نفس التصميم |
| 15 | سند دفع | payment-voucher.template | نفس التصميم |

---

## معالجة مشاكل عرض اللغة

### 1. التاريخ (تم حلّه جزئياً)
- **الهيدر**: استخدام `formatDateForHeader` (DD-MM-YYYY بأرقام غربية)
- **الجداول**: الأعمدة ذات `format: 'date'` ما زالت تستخدم `toLocaleDateString` — قد تظهر بأرقام عربية هندية وتُفسَّد في PDF

**الإجراء:** استخدام نفس صيغة التاريخ الآمنة في خلايا الجداول عند اللغة العربية.

### 2. RTL
- `rtl: true` في docDefinition
- `direction: 'rtl'` في defaultStyle
- عكس أعمدة الجدول يدوياً للعربية
- pdfmake-rtl للمعالجة الداخلية

### 3. الخطوط
- Cairo (متغير أو ثابت)
- Roboto = Cairo لتفادي أخطاء pdfmake-rtl

---

## المهام التنفيذية

### المهمة 1: توحيد تنسيق التاريخ في الجداول ✅
- [x] تعديل `buildTableSection` في pdf.service
- [x] عند `col.format === 'date'`: استدعاء `formatDateForHeader` لجميع اللغات (تفادي أرقام عربية هندية)
- [x] نفس الصيغة DD-MM-YYYY بأرقام غربية

### المهمة 2: التحقق من subtitle للتقارير التي تستخدم الفترة ✅
- [x] تقرير المبيعات: formatDateForHeader
- [x] تقرير المشتريات: formatDateForHeader
- [x] تقرير المصروفات: formatDateForHeader + subtitleAr
- [x] الذمم: formatDateForHeader + subtitleAr
- [x] المخزون: formatDateForHeader + subtitleAr
- [x] قائمة الدخل/المركز المالي/ميزان المراجعة: formatDateForHeader
- [x] دفتر الحساب: formatDateForHeader + subtitleAr
- [x] كشف حساب (مورد/عميل): formatDateForHeader في statement.template
- [x] سند دفع: format: 'date' في summaryItems

### المهمة 3: التحقق من subtitle للأقسام المالية
- تم في accounting.service (subtitle من القالب)

### المهمة 4: اختبار كل تقرير
- [ ] تشغيل كل تقرير بـ `language=ar`
- [ ] التأكد من: التاريخ، الهيدر، RTL، الجداول
- [ ] توثيق أي خلل

---

## الملفات المستهدفة

| الملف | التعديل |
|-------|---------|
| `pdf.service.ts` | استخدام formatDateForHeader لعمود التاريخ في الجداول عند العربية |
| `pdf.helpers.ts` | (لا تعديل إضافي) |
| خدمات أخرى | لا تغيير — تعتمد على pdf.service |

---

## ملخص الإجراءات لتجنّب أخطاء العرض

1. **لا استخدام `toLocaleDateString('ar-SA')`** لتواريخ PDF — ينتج أرقاماً عربية هندية قد تُفسَّد.
2. **استخدام `formatDateForHeader`** لكل عرض تاريخ في PDF.
3. **تمرير `language`** من الاستعلام إلى meta في كل الخدمات (معظمها يفعل ذلك).
4. **الحفاظ على pdfmake-rtl** مع Cairo و Roboto=Cairo.

---

## ترتيب التنفيذ المقترح

1. تنفيذ المهمة 1 (توحيد التاريخ في الجداول)
2. اختبار سريع لـ 3–4 تقارير
3. إكمال التحقق من subtitle حيث يلزم
4. اختبار شامل لجميع التقارير
