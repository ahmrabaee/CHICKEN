# كشف حساب العميل — ملخص الإصلاح والتحسين

## التشخيص

### السبب الجذري
1. **PaymentLedgerEntry (PLE) فارغ**: المبيعات المُنشأة عبر الـ seed (Prisma مباشرة) لم تمر عبر `SalesService`، فلم تُنشأ سجلات PLE.
2. **عدم وجود مصدر بديل**: كان الـ API يعتمد فقط على PLE، فإذا كان فارغاً يعيد رصيد افتتاحي 0 وحركات فارغة.

### التدفق السابق
```
Controller → CustomersService.getStatementPdf → PaymentLedgerService.getStatement
                                                      ↓
                                            PaymentLedgerEntry (فارغ للبيانات القديمة)
                                                      ↓
                                            رصيد افتتاحي + حركات = []
```

---

## الإصلاحات المُطبقة

### 1. Fallback من Sale + Payment (Backend)

**الملف**: `app/backend/src/accounting/payment-ledger/payment-ledger.service.ts`

- عند عدم وجود سجلات PLE للعميل، يتم بناء كشف الحساب من:
  - جدول **Sale** (المبيعات)
  - جدول **Payment** (المدفوعات)
- منطق الرصيد:
  - **الرصيد الافتتاحي** = إجمالي مبيعات قبل تاريخ البداية − إجمالي مدفوعات قبل تاريخ البداية
  - **الحركات**: مبيعات (مدين) + مدفوعات (دائن)
- تُرتب الحركات بالتاريخ وتُحسب الأرصدة الجارية بشكل صحيح.

### 2. إعادة تصميم قالب كشف الحساب (PDF)

**الملف**: `app/backend/src/pdf/templates/statement.template.ts`

- **Header**: عنوان "كشف حساب عميل"، سطر فرعي يضم اسم العميل، رقم العميل، الفترة، تاريخ الإصدار.
- **جدول**: أعمدة `التاريخ | المرجع | نوع الحركة | البيان | مدين | دائن | الرصيد`.
- **ملخص**: الرصيد الافتتاحي، إجمالي المدين، إجمالي الدائن، الرصيد الختامي.
- **حالة عدم وجود بيانات**: عرض رسالة "لا توجد حركات لهذا العميل ضمن الفترة المحددة".

### 3. حالة عدم وجود بيانات (Empty State)

**الملفات**: `statement.template.ts`, `pdf.service.ts`, `pdf.types.ts`

- عند عدم وجود حركات وأرصدة = 0: عرض رسالة واضحة بدلاً من جدول فارغ.
- تمت إضافة `statementEmpty` إلى `PdfGenerateOptions`.
- يتم عرض الرسالة في منتصف الصفحة بتنسيق مناسب.

### 4. تحديث خدمة العملاء والموردين

**الملفات**: `customers.service.ts`, `suppliers.service.ts`

- إضافة `partyNumber` (رقم العميل/المورد) في بيانات كشف الحساب.
- توحيد تنسيق التاريخ للحركات.
- استخدام `localizeReference` و `localizeVoucherType` لترجمة النوع والمرجع.

### 5. تحديث واجهة البيانات

**الملف**: `app/backend/src/pdf/dto/statement.dto.ts`

- إضافة `partyNumber` إلى `StatementPdfData`.

---

## مثال الاستجابة المتوقعة

### من PaymentLedgerService.getStatement (أو Fallback)

```typescript
{
  openingBalance: 50000,  // رصيد افتتاحي (minor units)
  transactions: [
    {
      id: 1,
      date: "2026-02-16",
      type: "sale",
      reference: "sale #1",
      debit: 10000,
      credit: 0,
      balance: 60000,
      notes: "SAL-SEED-0001"
    },
    {
      id: 2,
      date: "2026-02-18",
      type: "payment",
      reference: "payment #1",
      debit: 0,
      credit: 10000,
      balance: 50000,
      notes: "PAY-SEED-SAL-0001"
    }
  ],
  closingBalance: 50000,
  totalDebits: 10000,
  totalCredits: 10000
}
```

---

## Before / After

| الجانب | قبل | بعد |
|--------|-----|-----|
| **مصدر البيانات** | PLE فقط | PLE + Fallback من Sale/Payment |
| **عند عدم وجود PLE** | تقرير فارغ (رصيد 0 فقط) | بيانات حقيقية من المبيعات والمدفوعات |
| **حالة عدم وجود حركات** | جدول يبدو مكسوراً | رسالة واضحة "لا توجد حركات" |
| **تصميم التقرير** | بسيط | عربي RTL مع هيدر وملخص |
| **البيان** | غير موجود | عمود البيان مضاف |
| **رقم العميل** | غير معروض | معروض في الهيدر |

---

## الملفات المُعدلة

| الملف | التعديل |
|-------|---------|
| `payment-ledger.service.ts` | Fallback `getStatementForCustomerFromSales` |
| `statement.template.ts` | إعادة تصميم كشف الحساب |
| `statement.dto.ts` | إضافة `partyNumber` |
| `pdf.types.ts` | إضافة `statementEmpty` |
| `pdf.service.ts` | دعم `statementEmpty` |
| `customers.service.ts` | تمرير `partyNumber`، تنسيق التاريخ |
| `suppliers.service.ts` | تمرير `partyNumber`، تنسيق التاريخ |

---

## اختبار التقرير

1. التأكد من تشغيل `db:seed:dev` لتوفير مبيعات ومدفوعات وبيانات عملاء.
2. فتح صفحة عميل له مبيعات (مثلاً من FIXTURE_CUSTOMERS).
3. الضغط على "كشف حساب PDF".
4. اختيار فترة تشمل فبراير 2026 (مثلاً 2026-01-01 إلى 2026-03-15).
5. يجب أن يظهر:
   - رصيد افتتاحي
   - حركات (مبيعات ومدفوعات) مرتبة زمنياً
   - الرصيد الجاري بعد كل حركة
   - ملخص بالأرقام النهائية

---

## ملاحظة

- الموردون (Suppliers) ما زالوا يعتمدون على PLE فقط. إضافة fallback من Purchase + Payment للموردين ممكنة لاحقاً بنفس المنطق.
- لتحسين الأداء على المدى الطويل، يمكن إنشاء سكربت backfill لملء PLE من المبيعات والمدفوعات الموجودة.
