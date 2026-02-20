# Blueprint 02 — تحليل النقصان والتعديلات المطلوبة
## من وجهة نظر هندسية ومستخدم

**التاريخ:** فبراير 2026  
**الغرض:** تحديد الثغرات في تطبيق الخطة، والصفحات/الأزرار/الرسائل الناقصة

---

# ملخص تنفيذي

| الفئة | الحالة | الأولوية |
|-------|--------|----------|
| إعدادات GL Engine | ✅ منفّذ (تفعيل، حساب التدوير، عرض tolerance) | — |
| تفاصيل القيد (مركز التكلفة، multi-currency) | ✅ منفّذ | — |
| معالجة UNBALANCED_ENTRY | ⚠️ جزئي — تعارض مع JournalEntryProfile | متوسط |
| اختبار Round-Off من القيد اليدوي | ❌ **غير ممكن** — التحقق يمنع الإرسال | **عالية** |
| مؤشر Round-Off (isRoundOff) | ❌ Backend لا يُرجع الحقل | متوسطة |
| تعديل Tolerance من الواجهة | ❌ غير متوفر (عرض فقط) | منخفضة |
| رابط القيد العكسي | ⚠️ نص فقط — غير قابل للنقر | منخفضة |
| رسائل أخطاء في عمليات أخرى | ⚠️ قد لا تعرض الفرق | منخفضة |

---

# 1. ثغرة حرجة: لا يمكن اختبار Round-Off من القيد اليدوي

## المشكلة

صفحة إنشاء القيد اليدوي (`JournalEntryProfile.tsx`) تستخدم تحققاً على العميل (formSchema) يتطلب:

```typescript
debit === credit && debit > 0
```

**النتيجة:** المستخدم **لا يستطيع** إدخال قيد بفارق صغير ضمن tolerance (مثل مدين 10، دائن 10.03) لأن النموذج يرفض الإرسال قبل الوصول إلى الـ API.

الخطة (02_TEST_SCENARIO) تتحدث عن:
> "إنشاء قيد يدوياً بفارق صغير ضمن tolerance: مدين 1000، دائن 1003"

هذا السيناريو **غير قابل للتنفيذ** من الواجهة الحالية.

## الحل المقترح

| الخيار | الوصف | التوصية |
|--------|--------|----------|
| أ | إزالة شرط `debit === credit` من formSchema والاعتماد على الـ backend | ⭐ موصى به |
| ب | استبداله بشرط tolerance: `Math.abs(debit - credit) <= toleranceInShekels` | بديل |
| ج | إضافة وضع "متسامح" (سماح بفارق صغير) مع checkbox | أكثر تعقيداً |

**تنفيذ موصى به (الخيار أ):**
- تعديل `formSchema.refine` لقبول القيود المتوازنة أو التي الفرق فيها ضمن tolerance (مثلاً 0.05 ₪ = 5 وحدات عند إدخال بالشيكل)
- أو: إزالة التحقق الصارم وترك الـ backend يرفض/يقبل حسب tolerance

---

# 2. مؤشر Round-Off (isRoundOff) غير متوفر

## المشكلة

- الواجهة جاهزة لعرض سطر التدوير: `line.isRoundOff` مع Badge وتمييز لوني
- الـ Backend **لا يملك** حقل `isRoundOff` في `JournalEntryLine` (Prisma schema)
- خدمة `gl-rounding.service` تضيف سطراً بـ `description: 'تدوير تقريبي'` دون تعيين indicator

## الحل

| المكون | الإجراء |
|--------|---------|
| Backend (Prisma) | إضافة `isRoundOff Boolean @default(false)` في `JournalEntryLine` |
| Migration | `ALTER TABLE journal_entry_lines ADD COLUMN is_round_off INTEGER DEFAULT 0` |
| gl-entry.factory | تمرير `isRoundOff: true` عند إنشاء السطر الناتج عن التدوير (يتطلب تمرير flag من gl-rounding) |
| Frontend | يعمل بالفعل عند توفر الحقل |

**بديل مؤقت:** الاعتماد على `line.description === 'تدوير تقريبي'` للتمييز — أقل موثوقية.

---

# 3. تعارض رسائل الخطأ في JournalEntryProfile

## المشكلة

عند فشل إنشاء القيد، يُستدعى `createMutation.mutate(dto, { onError: () => {...} })`:

```tsx
onError: () => {
    toast({ variant: "destructive", title: "فشل إنشاء القيد" });
}
```

هذا يعرض رسالة عامة. بينما `useCreateJournalEntry` يحتوي على `onError` يعرض رسالة مُحسّنة:

```typescript
if (code === 'UNBALANCED_ENTRY') {
    title = data?.diff != null
        ? `القيد غير متوازن (الفرق: ${(data.diff / 100).toFixed(2)} ₪)`
        : 'القيد غير متوازن';
}
```

النتيجة: قد يظهر **toast مزدوج** — واحد مفيد وواحد عام.

## الحل

إزالة `onError` من استدعاء `mutate` في `JournalEntryProfile` والاعتماد على معالجة الخطأ في الـ hook:

```tsx
createMutation.mutate(dto, {
    onSuccess: () => { ... },
    // إزالة onError — useCreateJournalEntry يتولى العرض
});
```

---

# 4. رابط القيد العكسي غير قابل للنقر

## المشكلة

في `JournalDetailCard` يظهر:
> "قيد معكوس — عكس بواسطة #123"

الرقم `123` نص عادي. المستخدم لا يستطيع النقر لفتح القيد العكسي.

## الحل

تحويل الرقم إلى زر/رابط:

```tsx
{entry.isReversed && (
    <Info label="معكوس" value={
        <Button variant="link" className="h-auto p-0 text-amber-600"
            onClick={() => { onClose(); setDetailEntryId(entry.reversedByEntryId); }}>
            عكس بواسطة #{entry.reversedByEntryId ?? entry.reversedByEntry?.id}
        </Button>
    } />
)}
```

يتطلب تمرير `setDetailEntryId` و`onClose` إلى `JournalDetailCard` أو استخدام `navigate` لفتح نفس الصفحة مع id مختلف إن وُجدت صفحة تفاصيل.

---

# 5. تعديل Tolerance من الواجهة

## المشكلة

- الـ plan يعتبره **اختياري**
- حاليّاً: عرض فقط (`{tolerance} وحدة صغيرة`)
- لا يوجد حقل تعديل لـ `gl_debit_credit_tolerance`

## التوصية

منخفضة الأولوية. إن رغب المدير بتعديله، إضافة:
- `Input` أو `Select` لقيم محددة (مثلاً 1، 5، 10)
- استدعاء `settingsService.set('gl_debit_credit_tolerance', value)`
- التحقق من أن الـ backend يدعم `PUT /settings/gl_debit_credit_tolerance` أو ما يعادله

---

# 6. رسائل أخطاء في عمليات أخرى (بيع، شراء، دفعة، مصروف)

## المشكلة

عند إنشاء بيع/شراء/دفعة ومصروف، القيد يُنشأ عبر GL Engine. إذا حدث `UNBALANCED_ENTRY` (نادر في هذه العمليات)، الخطأ يُعاد من الـ API.

- `use-sales`, `use-purchases`, `use-payments`, `use-expenses`: تعرض `messageAr` أو `message`
- لا يوجد معالجة خاصة لـ `code === 'UNBALANCED_ENTRY'` مع عرض `diff`

## التوصية

إضافة معالجة موحّدة في كل hook (أو في طبقة Axios interceptor):

```typescript
if (data?.code === 'UNBALANCED_ENTRY' && data?.diff != null) {
    description = `القيد غير متوازن (الفرق: ${(data.diff / 100).toFixed(2)} ₪)`;
}
```

الأولوية منخفضة — السيناريو نادر في عمليات آلية.

---

# 7. ملاحظات إضافية للمستخدم

## رسائل نجاح/تأكيد

| الموقع | الحالة | ملاحظة |
|--------|--------|--------|
| تفعيل GL Engine | ✅ "تم حفظ الإعداد بنجاح" | جيد |
| إنشاء قيد | ✅ "تم إنشاء القيد بنجاح" | جيد |
| Round-off حدث تلقائياً | ❌ لا رسالة | يمكن إضافة toast عند اكتشاف أن القيد احتوى round-off: "تم إنشاء القيد مع قيد تدوير تلقائي" |

## تنبيهات وتوجيه

| الموقع | الاقتراح |
|--------|----------|
| إعدادات GL Engine | إضافة تنبيه: "عند التفعيل لأول مرة، تأكد من وجود حساب تدوير (Round-off) في بيانات الشركة" |
| تبويب المحاسبة (Settings) | الاسم "المحاسبة" واضح — التأكد من أن التبويب يظهر في القائمة (✅ يظهر) |

## إمكانية الوصول (Accessibility)

- زر تفعيل GL Engine: له label ووصف — جيد
- حقل حساب التدوير: يظهر "غير محدد" عند عدم التحديد — جيد

---

# 8. ملخص الإجراءات الموصى بها

| # | الإجراء | الأولوية | الجهد |
|---|---------|----------|-------|
| 1 | تعديل `JournalEntryProfile` formSchema للسماح بفارق ضمن tolerance (أو إزالة التحقق الصارم) | **عالية** | 30 دقيقة |
| 2 | إزالة `onError` المكرر من `JournalEntryProfile` mutate | متوسطة | 5 دقائق |
| 3 | إضافة `isRoundOff` في Backend (Prisma + gl-entry.factory) | متوسطة | 1 ساعة |
| 4 | جعل "عكس بواسطة #X" رابطاً قابلاً للنقر | منخفضة | 20 دقيقة |
| 5 | معالجة UNBALANCED_ENTRY في use-sales/purchases/payments (عرض الفرق) | منخفضة | 30 دقيقة |
| 6 | (اختياري) واجهة لتعديل gl_debit_credit_tolerance | منخفضة | 1 ساعة |

---

# 9. ما يعمل بشكل صحيح (لا يحتاج تغيير)

- ✅ تبويب المحاسبة في الإعدادات مع تفعيل/تعطيل GL Engine
- ✅ حساب التدوير (Round-off account) في إعدادات المحاسبة
- ✅ عرض tolerance (قراءة فقط)
- ✅ جدول تفاصيل القيد: مركز التكلفة، الطرف، multi-currency
- ✅ مؤشر "معكوس" على القيود المُلغاة
- ✅ Sale Void مع إنشاء قيد عكسي
- ✅ إلغاء الدفعة
- ✅ أنواع الحسابات والـ Types محدثة

---

**نهاية التحليل — جاهز للمراجعة والتطبيق**
