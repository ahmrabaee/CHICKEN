# خطة مواءمة صفحة الديون مع منطق المحاسبة

**التاريخ:** فبراير 2026  
**الحالة:** تم تنفيذ المرحلة 1 و 2 ✅

---

## 1. الهدف

ت align صفحة `/debts` ونظام المحاسبة بحيث:
- **Debt** و **PLE** يعكسان نفس الواقع
- **Reconciliation** و **Outstanding** تعرض أرقاماً مطابقة لصفحة الديون
- دفع عند إنشاء الشراء يُسجّل كـ Payment + PLE

---

## 2. الثغرات المحددة

| # | الثغرة | التأثير | الأولوية |
|---|--------|---------|----------|
| 1 | دفع عند إنشاء الشراء لا ينشئ Payment ولا PLE | Reconciliation يعرض المتبقي خاطئاً | عالية |
| 2 | recover-debt ينشئ Debt دون PLE | فواتير مستردة تظهر في /debts فقط | متوسطة |
| 3 | مصدران للرصيد (Debt vs PLE) | احتمال اختلاف أرقام | منخفضة (لاحقاً) |

---

## 3. خطة التنفيذ

### المرحلة 1: Purchase Create + Payment + PLE ✅ (قيد التنفيذ)

**الملف:** `app/backend/src/purchases/purchases.service.ts`

عند إنشاء شراء مع `amountPaid > 0`:
1. إنشاء سجل `Payment` (referenceType=purchase, referenceId=purchase.id)
2. استدعاء `createPLEForPaymentAgainstPurchase` للدفعة

**النتيجة:** PLE يعكس الدفعة الأولية، Reconciliation يعرض المتبقي الصحيح.

---

### المرحلة 2: recover-debt + PLE

**الملف:** `app/backend/recover-debt.js`

عند إنشاء Debt لمشتريّة ناقصة:
1. التحقق من عدم وجود PLE للفاتورة (purchase)
2. إنشاء `createPLEForPurchase` إن وُجدت الفاتورة ولم يُنشأ PLE

**ملاحظة:** السكربت يعمل خارج NestJS، يحتاج استدعاء Prisma + منطق PLE مباشرة أو تحويله لـ Nest script.

---

### المرحلة 3 (اختيارية لاحقاً): توحيد المصدر

- جعل صفحة الديون تستمد من PLE/OutstandingCalculator بدل Debt
- أو: آلية مزامنة Debt من PLE (computed)

---

## 4. التغييرات المنفذة

| الملف | التغيير |
|-------|---------|
| `purchases.service.ts` | إنشاء Payment + PLE عند amountPaid > 0 (جزئي أو كامل) |
| `recover-debt.js` | Phase 1: Debt + PLE + Payment عند الاسترداد. Phase 2: PLE للمشتريات ذات Debt دون PLE |
| `payments.service.ts` | (سابقاً) إنشاء Debt عند recordPurchasePayment إذا كان ناقصاً |
| `DEBTS_ACCOUNTING_ALIGNMENT_PLAN.md` | هذا الملف |
