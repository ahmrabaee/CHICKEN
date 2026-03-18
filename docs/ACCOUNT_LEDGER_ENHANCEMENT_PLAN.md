# خطة تقوية كشوف الحساب — منظور محاسب خبير

## 1. التحليل الحالي والمشاكل

### 1.1 الوضع الراهن
كشف الحساب (Account Ledger) يعرض اليوم أعمدة محدودة وببيانات ضعيفة:

| العمود الحالي | المحتوى الفعلي | المشكلة |
|---------------|----------------|---------|
| **التاريخ** | `entryDate` بصيغة Mar 2, 2026 | صيغة إنجليزية غير مناسبة للنظام العربي |
| **رقم القيد** | JE-000001 | جيد ✓ |
| **البنك** | — (فارغ دائماً) | غير ذي فائدة للحسابات النقدية |
| **الوصف** | "Cash received" (إنجليزي) | غير مترجم، عام جداً |
| **مدين / دائن** | المبلغ | جيد ✓ |
| **الرصيد** | الرصيد الجاري | جيد ✓ |

### 1.2 ما ينقص من وجهة نظر محاسب

1. **نوع العملية** — لا يوضح هل الحركة: بيع، تحصيل، مشتريات، دفع، مصروف، إشعار دائن، تسوية...
2. **الطرف (المقابل)** — لا يظهر اسم العميل أو المورد أو الجهة ذات الصلة
3. **رقم المستند المرجعي** — لا يربط بـ SAL-XXX أو PUR-XXX أو سند الدفع...
4. **التاريخ بصيغة عربية** — DD/MM/YYYY أو النمط الشائع محلياً
5. **وصف عربي واضح** — بدل "Cash received" يظهر مثلاً "تحصيل نقدي من عميل" أو "قبض بيع"
6. **إثراء المصدر** — ربط القيد بمصدره (فاتورة، أمر شراء، سند صرف...)

---

## 2. البيانات المتاحة في القاعدة (والتي لا تُستغل حالياً)

### 2.1 `JournalEntry` (رأس القيد)
| الحقل | الاستخدام المحتمل |
|-------|-------------------|
| `sourceType` | sale, purchase, payment, expense, credit_note, adjustment, wastage, reversal |
| `sourceId` | ID المستند الأصلي (البيع، الشراء، الدفعة، المصروف...) |
| `description` | وصف القيد عامةً |
| `entryDate` | تاريخ القيد |

### 2.2 `JournalEntryLine` (بيان القيد)
| الحقل | الاستخدام المحتمل |
|-------|-------------------|
| `partyType` | customer | supplier |
| `partyId` | مرجع العميل أو المورد |
| `description` | وصف السطر (مثل: Cash received, Sales revenue) |
| `againstVoucherType` | نوع المستند المقابل |
| `againstVoucherId` | رقم المستند المقابل |
| `voucherDetailNo` | تفاصيل إضافية |

---

## 3. الخطة التفصيلية

### 3.1 المرحلة 1: إثراء Backend — `getAccountLedger`

**الملف:** `app/backend/src/accounting/accounting.service.ts`

**الهدف:** إرجاع حقول إضافية لكل حركة:

```typescript
// الحقول الجديدة المقترحة لكل سطر
{
  id, entryDate, entryNumber, description,
  debit, credit, balance,
  // --- إضافات ---
  partyName: string | null,        // اسم العميل أو المورد
  transactionType: string,         // sale | purchase | payment | expense | ...
  transactionTypeAr: string,       // بيع | شراء | تحصيل | دفع | مصروف | ...
  referenceNumber: string | null,  // SAL-20260315-0003 | PUR-001 | ...
  descriptionAr: string,           // قبض بيع | تحصيل من عميل | دفع لمورد | ...
}
```

**الخطوات:**
1. توسيع الاستعلام ليشمل `journalEntry` (موجود) مع التأكد من وجود `sourceType`, `sourceId`.
2. لكل سطر، استدعاء دالة `resolvePartyName(partyType, partyId)` لجلب اسم العميل أو المورد.
3. استدعاء دالة `resolveReferenceNumber(sourceType, sourceId)` لجلب رقم المستند (مثال: sale → saleNumber).
4. إضافة خريطة ترجمة `DESCRIPTION_AR` لتحويل الوصف الإنجليزي إلى عربي.
5. إضافة خريطة ترجمة `SOURCE_TYPE_AR` لتحويل نوع المصدر إلى عربي.

---

### 3.2 جداول الترجمة المقترحة

#### أ. ترجمة الوصف (Description)
| English | العربية |
|---------|---------|
| Cash received | قبض نقدي / تحصيل من عميل |
| Cash payment | دفع نقدي / دفع لمورد |
| Cash refund | استرداد نقدي |
| Sales revenue | إيراد مبيعات |
| Credit sale | بيع آجل |
| Partial payment - balance due | دفع جزئي — رصيد مستحق |
| Sales discount | خصم مبيعات |
| Cost of goods sold | تكلفة البضاعة المباعة |
| Inventory reduction | تخفيض المخزون |
| Inventory increase | زيادة المخزون |
| Inventory purchase | شراء مخزون |
| Credit purchase | شراء آجل |
| Sales revenue reversal | إلغاء إيراد مبيعات |
| Inventory restoration | إرجاع مخزون |
| Write off receivable | شطب ذمم مدينة |
| Expense on credit | مصروف آجل |
| Stock adjustment (increase) | تسوية مخزون (زيادة) |
| Stock adjustment (decrease) | تسوية مخزون (نقصان) |
| Credit note | إشعار دائن |
| ... | (تُضاف حسب الحاجة) |

#### ب. ترجمة نوع العملية (Source Type)
| sourceType | العربية |
|------------|---------|
| sale | بيع |
| sale_void | إلغاء بيع |
| purchase | شراء |
| payment | تحصيل / دفع |
| expense | مصروف |
| credit_note | إشعار دائن |
| adjustment | تسوية |
| wastage | تلف مخزون |
| reversal | قيد عكسي |
| journal_entry | قيد يدوي |

---

### 3.3 دالة `resolveReferenceNumber`

```typescript
async resolveReferenceNumber(sourceType: string, sourceId: number | null): Promise<string | null> {
  if (!sourceId) return null;
  switch (sourceType) {
    case 'sale':
      const sale = await this.prisma.sale.findUnique({ where: { id: sourceId }, select: { saleNumber: true } });
      return sale?.saleNumber ?? `SAL-${sourceId}`;
    case 'purchase':
      const pur = await this.prisma.purchase.findUnique({ where: { id: sourceId }, select: { purchaseNumber: true } });
      return pur?.purchaseNumber ?? `PUR-${sourceId}`;
    case 'payment':
      const pay = await this.prisma.payment.findUnique({ where: { id: sourceId }, select: { id: true } });
      return pay ? `PAY-${sourceId}` : null;
    case 'expense':
      const exp = await this.prisma.expense.findUnique({ where: { id: sourceId }, select: { expenseNumber: true } });
      return exp?.expenseNumber ?? `EXP-${sourceId}`;
    case 'credit_note':
      const cn = await this.prisma.creditNote.findUnique({ where: { id: sourceId }, select: { creditNoteNumber: true } });
      return cn?.creditNoteNumber ?? `CN-${sourceId}`;
    default:
      return null;
  }
}
```

---

### 3.4 وصف الذكاء المحاسبي

بدلاً من الاعتماد فقط على النص المخزن، يمكن بناء وصف عربي ذكي:

```typescript
function buildDescriptionAr(line: JournalEntryLine, entry: JournalEntry, partyName: string | null): string {
  const descEn = line.description ?? entry.description ?? '';
  // إذا وجد ترجمة مباشرة، استخدمها
  const direct = DESCRIPTION_AR[descEn];
  if (direct) {
    return partyName ? `${direct} — ${partyName}` : direct;
  }
  // خلاف ذلك: ادمج نوع العملية + الطرف
  const typeAr = SOURCE_TYPE_AR[entry.sourceType] ?? entry.sourceType;
  return partyName ? `${typeAr} — ${partyName}` : typeAr;
}
```

---

### 3.5 المرحلة 2: تعديل واجهة العرض (Frontend)

**الملف:** `app/frontend/src/components/accounting/AccountLedgerDialog.tsx`

**الأعمدة المقترحة (بالترتيب المنطقي RTL):**

| العمود | المحتوى | ملاحظات |
|--------|---------|---------|
| التاريخ | DD/MM/YYYY أو صيغة عربية | استخدام `toLocaleDateString('ar-EG', {...})` |
| رقم القيد | JE-000001 | مع رابط لعرض تفاصيل القيد (إن وُجد) |
| نوع العملية | بيع / تحصيل / دفع / مصروف... | من `transactionTypeAr` |
| المرجع | SAL-XXX / PUR-XXX... | من `referenceNumber` |
| الطرف | اسم العميل أو المورد | من `partyName` |
| الوصف | وصف عربي مفصل | من `descriptionAr` |
| مدين | المبلغ | كما هو |
| دائن | المبلغ | كما هو |
| الرصيد | الرصيد الجاري | كما هو |

**إزالة / إعادة هيكلة:**
- عمود "البنك" — إما إخفاؤه للحسابات النقدية أو استخدامه فقط لحسابات البنك (1112) عند توفر `bankName`.

---

### 3.6 المرحلة 3: تحديث PDF كشف الحساب

**الملف:** `app/backend/src/accounting/accounting.service.ts` — `getAccountLedgerPdf`

- استخدام نفس الحقول الإثرائية من `getAccountLedger`.
- إضافة أعمدة PDF: نوع العملية، المرجع، الطرف، الوصف (عربي).
- التأكد من صيغة التاريخ العربية في PDF.
- دعم لغة التقرير (عربي/إنجليزي) إذا كان النظام يدعمها.

---

### 3.7 المرحلة 4: إثراء إنشاء القيود (اختياري — مستقبلي)

لضمان جودة البيانات من المنبع:
- مراجعة نقاط إنشاء القيود (بيع، شراء، دفع، مصروف...) والتأكد من:
  - تمرير `partyType` و `partyId` عند الوجود.
  - استخدام أوصاف يمكن ترجمتها أو إضافة حقل `descriptionAr` في القيد إذا دعت الحاجة.

---

## 4. أولويات التنفيذ

| # | المهمة | الملف | الجهد | الأولوية |
|---|--------|-------|-------|----------|
| 1 | إضافة جداول الترجمة (DESCRIPTION_AR, SOURCE_TYPE_AR) | accounting.service أو ملف i18n | منخفض | عالية |
| 2 | resolvePartyName + resolveReferenceNumber | accounting.service | متوسط | عالية |
| 3 | إثراء getAccountLedger بإرجاع partyName, transactionTypeAr, referenceNumber, descriptionAr | accounting.service | متوسط | عالية |
| 4 | تحديث AccountLedgerDialog (أعمدة جديدة، تنسيق التاريخ) | AccountLedgerDialog.tsx | متوسط | عالية |
| 5 | تحديث LedgerEntry type في الفرونت إند | types/accounting.ts | منخفض | عالية |
| 6 | تحديث getAccountLedgerPdf لاستخدام البيانات الإثرائية | accounting.service | منخفض | متوسطة |
| 7 | (اختياري) ربط رقم القيد بعرض تفاصيل القيد | AccountLedgerDialog | منخفض | منخفضة |

---

## 5. نموذج بيانات الاستجابة بعد التنفيذ

```json
{
  "id": 123,
  "entryDate": "2026-03-15T00:00:00.000Z",
  "entryNumber": "JE-000006",
  "description": "Cash received",
  "descriptionAr": "قبض بيع — أحمد محمد",
  "debit": 17500,
  "credit": 0,
  "balance": 24000,
  "partyName": "أحمد محمد",
  "partyType": "customer",
  "transactionType": "sale",
  "transactionTypeAr": "بيع",
  "referenceNumber": "SAL-20260315-0003"
}
```

---

## 6. ملاحظات محاسبية

1. **الطرف (المقابل)** ضروري للمراجعة والتدقيق — معرفة من أين جاءت الأموال وإلى من ذهبت.
2. **رقم المرجع** يربط كشف الحساب بالمستندات المصدرية (فواتير، أوامر شراء، سندات).
3. **نوع العملية** يسرّع التصنيف والفلترة والتحليل.
4. **اللغة العربية** في التقارير المحاسبية مطلب أساسي في البيئة العربية.
5. **صيغة التاريخ** الموحدة (DD/MM/YYYY) تتفق مع العرف المحلي والتدقيق.

---

## 7. المراجع

| الملف | الوظيفة |
|-------|---------|
| `accounting.service.ts` | getAccountLedger, getAccountLedgerPdf |
| `AccountLedgerDialog.tsx` | عرض كشف الحساب |
| `types/accounting.ts` | LedgerEntry interface |
| `prisma/schema.prisma` | JournalEntry, JournalEntryLine |
| `gl-entry.factory.ts` | إنشاء القيود مع partyType, partyId, description |
