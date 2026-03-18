# برومبت شامل: مشكلة توجيه دفعات نقطة البيع إلى الصندوق بدلاً من البنك

## ملخص المشكلة

عند إجراء عملية بيع من **نقطة البيع (POS)** واختيار طريقة الدفع **بطاقة** أو **تحويل بنكي** ثم اختيار **بنك محدد** (مثل بنك الكفرة 1112-001)، فإن القيد المحاسبي يُسجّل المبلغ المستلم في حساب **1111 النقد في الصندوق** بدلاً من حساب البنك المختار.

### السلوك المتوقع
- عند اختيار "بطاقة" أو "تحويل بنكي" واختيار بنك من القائمة → يُسجّل القيد في حساب البنك (مثل 1112-001 بنك الكفرة)
- يظهر كشف حساب البنك الحركات الصحيحة

### السلوك الفعلي
- القيد يُسجّل دائماً في **1111 النقد في الصندوق** مع وصف "Cash received"
- كشف حساب البنك يظهر "لا توجد حركات في الفترة المحددة"
- رغم اختيار المستخدم للبنك صراحةً في الواجهة

---

## السياق التقني

### البنية العامة
- **Frontend:** React + TypeScript (Vite)
- **Backend:** NestJS + Prisma
- **API:** REST مع ValidationPipe و class-transformer

### مسار البيانات (Data Flow)

```
[POS.tsx]                    [sales.service.ts]              [accounting.service.ts]
   │                                │                                  │
   │  payments: [{                   │  firstPayment = dto.payments[0]  │
   │    amount,                     │  saleBankAccountId =              │
   │    paymentMethod: "card",      │    firstPayment?.bankAccountId    │
   │    bankAccountId: ?            │                                  │
   │  }]                            │  createSaleJournalEntry(          │
   │         ──────────────────────>│    { paymentMethod,             │
   │         POST /sales            │      bankAccountId }             │
   │                                │    )                             │
   │                                │         ────────────────────────>│
   │                                │                                  │  getSaleGLMap()
   │                                │                                  │  resolveCashOrBankAccount()
   │                                │                                  │  → يُفترض أن يعيد accountId البنك
   │                                │                                  │  → لكن يعيد 1111 (الصندوق)
```

---

## الملفات المعنية

### Frontend

| الملف | الدور |
|-------|-------|
| `app/frontend/src/pages/POS.tsx` | واجهة نقطة البيع، اختيار طريقة الدفع والبنك، إرسال `payments` مع `bankAccountId` |
| `app/frontend/src/types/sales.ts` | `CreateSalePaymentDto` يتضمن `bankAccountId?: number` |
| `app/frontend/src/services/sales.service.ts` | `createSale(data)` يرسل POST إلى `/sales` |
| `app/frontend/src/services/bank-accounts.service.ts` | جلب قائمة البنوك من `GET /bank-accounts` |

### Backend

| الملف | الدور |
|-------|-------|
| `app/backend/src/sales/sales.controller.ts` | `POST /sales` يستقبل `CreateSaleDto` |
| `app/backend/src/sales/sales.service.ts` | استخراج `firstPayment.bankAccountId` وتمريره إلى `createSaleJournalEntry` |
| `app/backend/src/sales/dto/sale.dto.ts` | `SalePaymentDto` مع `bankAccountId?: number` |
| `app/backend/src/accounting/accounting.service.ts` | `resolveCashOrBankAccount()` و `getSaleGLMap()` |

### قاعدة البيانات

| الجدول | الحقول ذات الصلة |
|--------|------------------|
| `Sale` | `paymentMethod`, `bankAccountId` |
| `Payment` | `paymentMethod`, `bankAccountId` |
| `BankAccount` | `id`, `accountId` (FK → Account) |
| `Account` | `id`, `code` (1111, 1112, 1112-001...) |

---

## تفاصيل الكود الحالي

### 1. POS.tsx - إرسال الطلب

```typescript
// عند إتمام البيع
if (saleType === "cash" && amount > 0) {
  let effectiveBankId = bankAccountId ?? undefined;
  if ((paymentMethod === "bank_transfer" || paymentMethod === "card") && bankAccounts.length > 0 && !effectiveBankId) {
    const defaultBank = bankAccounts.find((b) => b.isDefault) ?? bankAccounts[0];
    effectiveBankId = defaultBank?.id;
  }
  dto.payments = [{
    amount,
    paymentMethod: paymentMethod,
    bankAccountId: (paymentMethod === "bank_transfer" || paymentMethod === "card") ? effectiveBankId : undefined,
  }];
}
```

### 2. sales.service.ts - استقبال وإنشاء القيد

```typescript
const firstPayment = dto.payments?.[0];
const salePaymentMethod = firstPayment?.paymentMethod ?? 'cash';
const saleBankAccountId = firstPayment?.bankAccountId ?? null;

// ...
await this.accountingService.createSaleJournalEntry(tx, sale.id, ..., {
  paymentMethod: salePaymentMethod,
  bankAccountId: saleBankAccountId,
});
```

### 3. accounting.service.ts - resolveCashOrBankAccount

```typescript
private async resolveCashOrBankAccount(paymentMethod?, bankAccountId?, tx?): Promise<number> {
  if (paymentMethod && ['bank_transfer', 'card'].includes(paymentMethod)) {
    let resolvedBankId = bankAccountId;
    if (!resolvedBankId) {
      // Fallback: default bank أو أول بنك نشط
      fallback = await prisma.bankAccount.findFirst({ where: { isDefault: true, ... } });
      if (!fallback) fallback = await prisma.bankAccount.findFirst({ where: { isActive: true }, ... });
      resolvedBankId = fallback?.id ?? null;
    }
    if (resolvedBankId) {
      const bank = await prisma.bankAccount.findUnique({ where: { id: resolvedBankId }, select: { accountId: true } });
      if (bank) return bank.accountId;  // ← حساب GL للبنك
    }
  }
  return getAccountIdByCode('1111');  // ← الصندوق
}
```

---

## الفرضيات المحتملة لسبب المشكلة

### 1. عدم وصول `bankAccountId` إلى الباكند
- **السبب المحتمل:** الـ DTO أو ValidationPipe لا يحتفظ بـ `bankAccountId` في الـ payload
- **التحقق:** إضافة `console.log` أو Logger في `sales.service.create()` لطباعة `dto.payments` و `firstPayment?.bankAccountId`

### 2. تحويل/تحويل خاطئ من الفرونت إند
- **السبب المحتمل:** `bankAccountId` يُرسَل كـ `undefined` أو لا يُضمّن في الـ JSON
- **التحقق:** فتح DevTools → Network → طلب POST عند إتمام البيع → التحقق من Request Payload

### 3. هيكل استجابة API البنوك
- **السبب المحتمل:** `bankAccounts` من `useQuery` لا تُرجع البنية المتوقعة (`id`, `isDefault`)
- **التحقق:** التحقق من `res.data?.data ?? res.data` في استدعاء `bankAccountsService.getAll()`

### 4. مشكلة في React state
- **السبب المحتمل:** `bankAccountId` في state لا يتحدّث قبل إرسال الطلب (stale closure)
- **التحقق:** إضافة `console.log` في `handleCompleteSale` لطباعة `bankAccountId` قبل إرسال الطلب

### 5. بنك غير موجود أو `accountId` خاطئ
- **السبب المحتمل:** `BankAccount.accountId` يوجّه إلى حساب غير صحيح أو `bank` لا يُوجد
- **التحقق:** استعلام قاعدة البيانات: `SELECT * FROM BankAccount WHERE id = ?`

### 6. شرط `paymentMethod` لا يُحقّق
- **السبب المحتمل:** `paymentMethod` يصل كـ `"cash"` أو قيمة غير متوقعة
- **التحقق:** طباعة `salePaymentMethod` و `data.paymentMethod` في `getSaleGLMap`

---

## ما تم تجربته سابقاً

1. **اختيار البنك الافتراضي تلقائياً** عند الانتقال من "نقداً" إلى "بطاقة/تحويل بنكي"
2. **حماية عند إتمام البيع** لاستخدام البنك الافتراضي إن لم يُحدد بنك
3. **Fallback في الباكند** لاستخدام أول بنك نشط عند غياب `bankAccountId`
4. **تتبع تفاعل المستخدم** مع `userHasChosenBankRef` لعدم إلغاء اختيار "— صندوق —"
5. **معالجة تحميل البنوك متأخراً** عبر `banksJustLoaded` في useEffect

---

## خطوات التصحيح المقترحة

### 1. التحقق من الـ Request Payload
```
1. فتح DevTools (F12) → تبويب Network
2. إجراء بيع من POS باختيار "بطاقة" وبنك محدد
3. إيجاد طلب POST /v1/sales
4. التحقق من Request Payload: هل يحتوي على payments[0].bankAccountId؟
```

### 2. إضافة Logging في الباكند
```typescript
// في sales.service.ts - create()
const firstPayment = dto.payments?.[0];
this.logger.debug?.('Sale create payload', { paymentMethod: firstPayment?.paymentMethod, bankAccountId: firstPayment?.bankAccountId });
```

### 3. التحقق من قاعدة البيانات
```sql
SELECT id, code, name, accountId, isDefault FROM BankAccount WHERE isActive = 1;
SELECT id, code, name FROM Account WHERE code LIKE '1112%';
```

### 4. اختبار API مباشرة
```bash
curl -X POST http://localhost:3000/v1/sales \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "saleType": "cash",
    "lines": [{"itemId": 1, "weightGrams": 1000, "pricePerKg": 100}],
    "payments": [{"amount": 10000, "paymentMethod": "card", "bankAccountId": 1}]
  }'
```
ثم التحقق من القيد المحاسبي الناتج.

---

## المخرجات المطلوبة للتحقق من الحل

1. **قيد اليومية:** يجب أن يظهر الحساب المدين باسم البنك (مثل 1112-001 بنك الكفرة) وليس 1111 النقد في الصندوق
2. **وصف القيد:** "Bank received" بدلاً من "Cash received"
3. **كشف حساب البنك:** يظهر الحركة في الفترة المحددة

---

## ملاحظات إضافية

- البنك "بنك الكفرة" له كود 1112-001 ويظهر في دليل الحسابات
- المستخدم يختار البنك صراحةً من القائمة
- المشكلة لا تظهر عند الدفع "نقداً" (تُسجّل في الصندوق بشكل صحيح)
- المشكلة تتكرر حتى بعد التعديلات السابقة
