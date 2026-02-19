# خطة شاملة: إلغاء الدفعة وقيود المحاسبة اليومية

**التاريخ:** 2025-02-19  
**المشكلة:** 404 على `POST /v1/payments/:id/cancel` + تحسين عرض القيود الملغية في واجهة قيود اليومية

---

## 1. ملخص المشكلة

| البند | الوصف |
|-------|-------|
| **الأخطاء** | `404 Not Found` عند `POST /v1/payments/8/cancel` |
| **المطلوب** | إصلاح الإلغاء + فهم المسار الكامل + عرض القيود الملغية بشكل واضح |

---

## 2. مسار إلغاء الدفعة (Full Flow)

### 2.1 الفرونت إند

| الخطوة | الملف | الوصف |
|--------|-------|-------|
| 1 | `PaymentProfile.tsx` أو `Payments.tsx` | المستخدم يضغط "إلغاء الدفعة" |
| 2 | `CancelConfirmDialog` | حوار يطلب سبب الإلغاء |
| 3 | `useCancelPayment().mutate({ id, data: { reason } })` | استدعاء الـ mutation |
| 4 | `payment.service.cancelPayment(id, { reason })` | `POST /payments/{id}/cancel` مع body: `{ reason }` |
| 5 | `axiosInstance.post(\`/payments/${id}/cancel\`, data)` | الـ baseURL: `http://localhost:3000/v1` |
| 6 | **URL النهائي** | `POST http://localhost:3000/v1/payments/8/cancel` |

### 2.2 الباك إند — Controller

| الملف | المسار | الوصف |
|-------|--------|-------|
| `payments.controller.ts` | `@Post(':id/cancel')` | يعالج `POST /v1/payments/:id/cancel` |
| `CancelPaymentDto` | `{ reason: string }` | DTO للإدخال |

### 2.3 الباك إند — Service (`cancelPayment`)

| الخطوة | الإجراء |
|--------|---------|
| 1 | جلب الـ Payment من DB |
| 2 | `DocumentStatusGuard.requireNotCancelled` — منع إلغاء الملغى |
| 3 | `PeriodLockGuard.check` — منع الإلغاء في فترات مقفلة |
| 4 | **عكس قيد اليومية** — `accountingService.reverseByVoucher('payment', id, userId, tx)` |
| 5 | **فك ربط PLE** — `paymentLedgerService.delinkPLEForVoucher('payment', id, tx)` |
| 6 | تحديث الـ Payment: `docstatus=2, isVoided=true, cancelledAt, cancelledById, cancelReason` |
| 7 | عكس amountPaid على Sale/Purchase و Debt إن وُجدت |
| 8 | إدخال سجل Audit |

### 2.4 عكس القيد المحاسبي (`reverseByVoucher`)

| النقطة | التفاصيل |
|--------|----------|
| **المصدر** | `accountingService.reverseByVoucher` أو `glEngineService.reverse` عند تفعيل GL Engine |
| **الخطوات** | 1) جلب القيد الأصلي (sourceType='payment', sourceId=paymentId) |
| | 2) التحقق من عدم عكسه مسبقاً |
| | 3) إنشاء قيد عكسي (عكس مدين/دائن) |
| | 4) تحديث القيد الأصلي: `isReversed=true`, `reversedByEntryId=reversalId` |
| **القيد العكسي** | sourceType='reversal', sourceId=originalEntryId |

---

## 3. تحليل سبب 404

### 3.1 احتمالات

| # | الاحتمال | الإجراء المقترح |
|---|----------|-----------------|
| 1 | ترتيب الـ routes في NestJS | نقل `Post(':id/cancel')` قبل `Get(':id')` إن أمكن |
| 2 | البورت خاطئ | التأكد أن الباك إند يعمل على `localhost:3000` |
| 3 | الـ prefix خاطئ | التأكد أن المسار هو `/v1/payments/...` |
| 4 | الـ route غير مُسجّل | التحقق من أن `PaymentsModule` محمّل وأن الـ controller صحيح |

### 3.2 إصلاح ترتيب الـ Routes (مقترح)

في `payments.controller.ts`، يُفضّل أن تسبق المسارات الأكثر تحديداً المسارات العامة:

```typescript
// ترتيب مقترح — المسارات المحددة أولاً
@Get()
findAll(...)

@Get(':id/pdf')   // قبل Get(':id')
getPaymentPdf(...)

@Post('sale')
@Post('purchase')
@Post('advance')
@Post(':id/cancel')  // قبل أي Post(':id') إن وُجد

@Get(':id')
findById(...)
```

### 3.3 التحقق من الـ API

```bash
# من الطرفية — التأكد أن الـ endpoint يعمل
curl -X POST http://localhost:3000/v1/payments/8/cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"reason":"اختبار"}'
```

---

## 4. التأثيرات المحاسبية عند الإلغاء

### 4.1 Journal Entries

| المستند | التأثير |
|---------|---------|
| القيد الأصلي (payment) | `isReversed=true`, `reversedByEntryId` يُحدَّث |
| قيد العكس | قيد جديد بـ sourceType='reversal', sourceId=قيد أصلي |

### 4.2 Payment Ledger (PLE)

- `delinkPLEForVoucher('payment', id)` — فك ربط إدخالات PLE المرتبطة بالدفعة الملغاة

### 4.3 Sale / Purchase / Debt

- تصحيح `amountPaid` و `paymentStatus` على الفاتورة
- تصحيح `amountPaid` و `status` على Debt
- تصحيح `currentBalance` على Customer/Supplier

---

## 5. خطة الفرونت إند — قيود اليومية

### 5.1 التحسينات المطلوبة

| البند | الوصف |
|-------|-------|
| **القيد الملغى/المعكوس** | إظهاره بوضوح (مثلاً Badge "معكوس" أو "ملغى") |
| **تنسيق الصف** | صفوف القيود المعكوسة بلون مختلف أو شفافية |
| **تفاصيل القيد** | عرض "عكس بواسطة #123" مع رابط للقيد العكسي |
| **القيد العكسي** | تمييز أنه عكس لقيد آخر (مثلاً badge "قيد عكسي") |

### 5.2 الملفات المتأثرة

| الملف | التعديل |
|-------|---------|
| `Accounting.tsx` | تحسين صفوف قيود اليومية — تنسيق القيود الملغية/المعكوسة |
| `JournalDetailCard` | تحسين عرض الحالة + رابط القيد العكسي |
| `types/accounting.ts` | التأكد من وجود `isReversed`, `reversedByEntryId`, `reversedByEntry` |

### 5.3 تصميم مقترح للجدول

```
| رقم القيد | الوصف | التاريخ | المدين | الدائن | الحالة | عرض |
|-----------|-------|---------|--------|--------|-------|-----|
| JE-000001 | دفعة #PAY-123 | 2025-02-19 | ₪100 | ₪100 | [مرحّل] [معكوس] | 👁 |
| JE-000002 | عكس: دفعة #PAY-123 | 2025-02-19 | ₪100 | ₪100 | [مرحّل] [قيد عكسي] | 👁 |
```

- القيد المعكوس: خلفية `bg-amber-50/50` أو شريط جانبي بلون كهرماني
- Badge "معكوس": لون كهرماني مع أيقونة
- Badge "قيد عكسي": لون رمادي أو بنفسجي فاتح

### 5.4 حوار التفاصيل (JournalDetailCard)

- قسم "معكوس" مع رابط للقيد العكسي (موجود حالياً)
- قسم "قيد عكسي لـ" إن كان القيد عكساً لقيد آخر — مع رابط للقيد الأصلي

---

## 6. ترتيب التنفيذ المقترح

| # | المهمة | النوع | الأولوية | ✅ الحالة |
|---|--------|-------|----------|-----------|
| 1 | إصلاح 404 — إعادة ترتيب routes | Backend | عالية | ✅ منفذ |
| 2 | التأكد من صحة الـ response من cancelPayment | Frontend | عالية | ✅ منفذ |
| 3 | تحسين عرض القيود المعكوسة في جدول قيود اليومية | Frontend | عالية | ✅ منفذ |
| 4 | تحسين JournalDetailCard للقيود المعكوسة | Frontend | متوسطة | ✅ منفذ |
| 5 | إضافة فلتر "إظهار المعكوسة فقط" (اختياري) | Frontend | منخفضة | - |

---

## 7. اختبارات مقترحة

### 7.1 إلغاء الدفعة

1. إنشاء دفعة على فاتورة بيع أو شراء
2. الضغط على "إلغاء الدفعة" وإدخال السبب
3. التحقق: نجاح العملية وعدم ظهور 404
4. التحقق في قيود اليومية: القيد الأصلي معكوس + وجود قيد عكسي

### 7.2 قيود اليومية

1. عرض قيد معكوس — التحقق من ظهور Badge "معكوس"
2. فتح التفاصيل — التحقق من رابط "عكس بواسطة #X"
3. التحقق من القيد العكسي — أنه يُعرَّف كـ "قيد عكسي"

---

## 8. المراجع في الكود

| الملف | السطور/الدوال الرئيسية |
|-------|-------------------------|
| `payments.controller.ts` | `@Post(':id/cancel')` |
| `payments.service.ts` | `cancelPayment()` |
| `accounting.service.ts` | `reverseByVoucher()` |
| `gl-engine.service.ts` | `reverse()` |
| `payment-ledger.service.ts` | `delinkPLEForVoucher()` |
| `payment.service.ts` (frontend) | `cancelPayment()` |
| `use-payments.ts` | `useCancelPayment()` |
| `Accounting.tsx` | جدول قيود اليومية، `JournalDetailCard` |
