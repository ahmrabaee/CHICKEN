# خطة إصلاح كشف حساب النقد في الصندوق والمشاكل المحاسبية

## 1. تشخيص المشكلة

### 1.1 الأعراض
- **القيود اليومية:** تظهر قيوداً كثيرة (بيع، إشعار دائن) جميعها مرحّلة — صحيحة
- **كشف حساب النقد في الصندوق (1111):** يظهر "لا توجد حركات في الفترة المحددة" رغم وجود عمليات بيع نقدية
- **ميزان المراجعة:** يظهر رصيد للنقد (مثلاً 292.00 ₪) — أي أن البيانات موجودة في القاعدة

### 1.2 السبب الجذري المُكتَشف

في `accounting.service.ts` دالة `getAccountLedger(accountIdOrCode, startDate, endDate)`:

```typescript
// الكود الحالي (معيب):
if (typeof accountIdOrCode === 'number') {
  accountId = accountIdOrCode;
} else {
  const numericId = parseInt(accountIdOrCode, 10);
  if (!Number.isNaN(numericId) && /^\d+$/.test(accountIdOrCode)) {
    accountId = numericId;  // ❌ يستخدم 1111 كـ ID!
  } else {
    const id = await this.chartOfAccountsService.getAccountIdByCode(accountIdOrCode);
    accountId = id;
  }
}
```

**المشكلة:**
- واجهة الويب ترسل `account.code` = `"1111"` في المسار `/accounting/ledger/1111`
- الباكند يفسّر `"1111"` كرقم ويستخدمه كـ `accountId` (المفتاح الأولي)
- الحساب "النقد في الصندوق" له `code = "1111"` و `id = 7` (أو أي قيمة auto-increment)
- القيود المخزنة في `journal_entry_lines` تحمل `accountId = 7`
- الاستعلام `WHERE accountId = 1111` يعيد صفر نتائج

### 1.3 توضيح الفرق
| المفهوم | الحساب 1111 |
|---------|--------------|
| **code** | "1111" (رمز الحساب في دليل الحسابات) |
| **id** | 7 أو 15 (المفتاح الأولي في جدول accounts) |
| **journal_entry_line.accountId** | يشير دائماً إلى id وليس code |

---

## 2. إصلاحات مُقترحة

### 2.1 إصلاح 1: تصحيح `getAccountLedger` (حرج)

**الملف:** `app/backend/src/accounting/accounting.service.ts`

**التعديل:** المسار مُعرّف باسم `accountCode` — يجب دائماً البحث بالرمز، وليس بالمفتاح الأولي.

```typescript
async getAccountLedger(accountIdOrCode: number | string, startDate?: string, endDate?: string) {
  let accountId: number;
  if (typeof accountIdOrCode === 'number') {
    accountId = accountIdOrCode;
  } else {
    // المسار يأخذ accountCode — نبحث دائماً بالرمز عند تمرير string
    const id = await this.chartOfAccountsService.getAccountIdByCode(accountIdOrCode);
    if (!id) throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Account not found',
      messageAr: 'الحساب غير موجود',
    });
    accountId = id;
  }
  // ... بقيّة المنطق
}
```

**النتيجة:** كشف حساب 1111 سيعرض فعلياً حركات حسابه الصحيح.

---

### 2.2 إصلاح 2: فلترة كشف الحساب بالقيود المرحّلة فقط

**الوضع الحالي:** الاستعلام لا يقيّد بـ `isPosted: true`، فيُظهر مسودات غير مرحّلة أيضاً.

**التعديل:**

```typescript
where.journalEntry = {
  ...(startDate || endDate ? { entryDate: entryDate } : {}),
  isPosted: true,  // إضافة
};
```

---

### 2.3 تحقق إضافي: تاريخ القيد مقابل تاريخ البيع

**الوضع الحالي:**
- عند `gl_engine_enabled = false`: `createJournalEntryInternal` يضع `entryDate: new Date()` (وقت الإنشاء)
- عند `gl_engine_enabled = true`: GL Engine يضع `entryDate = metadata.postingDate` (تاريخ البيع/الترحيل)

**التوصية:** عند تعطيل GL Engine، يُفضّل تمرير `saleDate` أو `postingDate` من عملية البيع إلى `createJournalEntryInternal` حتى يكون تاريخ القيد مطابقاً لتاريخ العملية.

---

## 3. استكشاف مشاكل محتملة أُخرى

### 3.1 إعداد GL Engine

| المفتاح | القيمة الافتراضية (seed) | التأثير |
|---------|--------------------------|---------|
| `gl_engine_enabled` | `false` | استخدام `createJournalEntryInternal` بدلاً من GL Engine |
| عند `true` | — | استخدام GL Engine مع Round-off و Tax |

**التوصية:** التحقق من أن القيود تُنشأ فعلاً (في كلتا الحالتين)، ومراجعة أن `gl_engine_enabled` مُعدّ كما يُتوقّع في بيئة الإنتاج.

### 3.2 مطابقة الحسابات مع seed

التأكد من أن الأكواد التالية موجودة في دليل الحسابات ومُستخدَمة في القيود التلقائية:

| الكود | الاسم | الاستخدام |
|-------|-------|-----------|
| 1111 | النقد في الصندوق | تحصيل نقد من المبيعات، دفعات نقدية |
| 1120 | حسابات القبض | المبيعات الآجلة، الرصيد المستحق |
| 1131 | مخزون الدجاج الطازج | تخفيض المخزون عند البيع |
| 4110 | مبيعات الدجاج الطازج | إيرادات المبيعات |
| 5100 | تكلفة البضاعة المباعة | تكلفة المبيعات |
| 5400 | مصروفات أخرى / خصم مسموح | خصومات، مصروفات |
| 2110 | حسابات الدفع | مشتريات آجلة |
| 1112 | النقد في البنك | تحويلات مصرفية |

### 3.3 المدفوعات والحساب النقدي

عند إضافة مدفوعة لفاتورة بيع:
- الدفع النقدي يُفترض أن يُمدّن حساب 1111 ويُقابله تخفيض 1120 أو غيرها حسب نوع الدفع.
- التحقق من أن `createPaymentJournalEntry` (أو ما يماثلها) تُستدعى ويُسجّل فيها الحساب 1111 بشكل صحيح.

### 3.4 المشتريات

المشتريات عادة تخصّص إلى:
- ح/ المخزون (مدين)
- ح/ الموردين 2110 (دائن) أو ح/ النقد 1111/1112 (دائن) عند الدفع النقدي.

يجب التأكد من أن الدفع النقدي للموردين يظهر في 1111 أو 1112 حسب طريقة الدفع.

---

## 4. خطوات التنفيذ

| # | المهمة | الملف | الأولوية |
|---|--------|-------|----------|
| 1 | إصلاح `getAccountLedger` لاستخدام `getAccountIdByCode` عند string | accounting.service.ts | عالية |
| 2 | إضافة فلتر `isPosted: true` لكشف الحساب | accounting.service.ts | متوسطة |
| 3 | (اختياري) تمرير تاريخ الترحيل إلى القيود عند تعطيل GL Engine | accounting.service.ts, sales.service | منخفضة |
| 4 | التحقق اليدوي: إنشاء بيع نقدي ثم فتح كشف حساب 1111 | — | تحقق |
| 5 | التحقق من وجود حسابات seed وتطابقها مع الأكواد المستخدمة في الكود | seed, accounting | تحقق |

---

## 5. قائمة تحقق ما بعد الإصلاح

- [ ] كشف حساب 1111 (النقد في الصندوق) يعرض حركات البيع النقدي
- [ ] كشف حساب 1120 (حسابات القبض) يعرض المبيعات الآجلة والأقساط المستحقة
- [ ] ميزان المراجعة يظل متوازناً بعد أي تعديلات
- [ ] قائمة المركز المالي وقائمة الدخل تعتمدان على نفس المصدر وتتفق مع ميزان المراجعة
- [ ] PDF كشف الحساب يُولّد نفس البيانات المعروضة على الشاشة

---

## 6. مراجع الكود

| الملف | الوظيفة |
|-------|---------|
| `accounting.service.ts` | `getAccountLedger`, `createSaleJournalEntry`, `createJournalEntryInternal` |
| `chart-of-accounts.service.ts` | `getAccountIdByCode` |
| `account.repository.ts` | `findByCodeAndCompany` |
| `AccountLedgerDialog.tsx` | استدعاء API بـ `account.code` |
| `accounting.controller.ts` | `GET ledger/:accountCode` |
