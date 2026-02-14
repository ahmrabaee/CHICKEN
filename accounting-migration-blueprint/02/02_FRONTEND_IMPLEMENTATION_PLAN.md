# Blueprint 02 — Frontend Implementation Plan
## General Ledger Engine (GL Engine)

**Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Ready for Implementation  
**Prerequisite:** Blueprint 01 (Chart of Accounts Rebuild) frontend applied

---

## 1. Executive Summary

This document provides a detailed plan for frontend changes supporting **Blueprint 02: General Ledger Engine**. The blueprint states that **no direct flow change** is required for sale/purchase/payment creation — the change is backend-only. However, there are **optional enhancements** for display and administration:

1. **Journal Entry detail** — عرض الحقول الجديدة (عملة الحساب، مركز التكلفة) عند توفرها
2. **Multi-currency display** — عمود اختياري "عملة الحساب" و`debit_in_account_currency` / `credit_in_account_currency` إن كانت العملة مختلفة
3. **Round-off indicator** — أيقونة أو تمييز بصري لسطر التدوير (إن أُضيف حقل `is_round_off` لاحقاً)
4. **Error handling** — تحسين عرض خطأ `UNBALANCED_ENTRY` مع عرض الفرق والمجاميع
5. **Admin settings** (اختياري) — تفعيل/تعطيل GL Engine، إعدادات tolerance، حساب التدوير في الشركة

---

## 2. Blueprint 02 Frontend Impact (من الوثيقة الأصلية)

| البند | الوصف | الأولوية |
|-------|-------|----------|
| عدم وجود تغيير مباشر | واجهة إنشاء البيع/الشراء/الدفع تبقى كما هي | — |
| دعم العملات المتعددة | عرض `debit_in_account_currency` و`credit_in_account_currency` إن كانت العملة مختلفة | متوسط |
| عرض Round-Off | قيد التدوير يُحفظ كسطر عادي؛ يمكن إضافة indicator إن وُجد `is_round_off` | منخفض |
| عرض merged entries | القيود المدمجة تظهر كسطر واحد — لا تغيير مطلوب | — |

---

## 3. Implementation Phases

| Phase | Scope | Priority | Est. Time |
|-------|-------|----------|-----------|
| **Phase 1** | Types — JournalEntryLine الحقول الجديدة | Medium | 30 min |
| **Phase 2** | Journal detail — عرض الحقول الاختيارية + multi-currency | Medium | 1 hr |
| **Phase 3** | Error handling — UNBALANCED_ENTRY المحسّن | Low | 30 min |
| **Phase 4** | Admin: إعدادات GL Engine (اختياري) | Low | 1–2 hrs |
| **Phase 5** | Round-off indicator (لاحقاً عند إضافة الحقل) | Low | 30 min |

---

## 4. Phase 1 — Types Update

### 4.1 `src/types/accounting.ts`

**تحديث `JournalEntryLine`:**

```typescript
export interface JournalEntryLine {
    id: number;
    accountId: number;
    account?: { id: number; code: string; name: string; accountCurrency?: string | null };
    accountName?: string;
    accountCode?: string;
    debit?: number;
    credit?: number;
    debitAmount?: number;
    creditAmount?: number;
    // Blueprint 02: multi-currency & GL fields
    debitInAccountCurrency?: number | null;
    creditInAccountCurrency?: number | null;
    exchangeRate?: number | null;
    costCenterId?: number | null;
    costCenter?: { id: number; code: string; name: string } | null;
    partyType?: string | null;
    partyId?: number | null;
    againstVoucherType?: string | null;
    againstVoucherId?: number | null;
    voucherDetailNo?: string | null;
    description?: string;
    isOpening?: boolean;
    isRoundOff?: boolean;  // لاحقاً عند إضافته في الـ backend
}
```

**الملاحظة:** الحقول الجديدة اختيارية؛ الـ backend قد لا يُرجعها لكل قيد قديم.

---

## 5. Phase 2 — Journal Entry Detail Display

### 5.1 جدول تفاصيل القيد — `JournalDetailCard` في `Accounting.tsx`

**الحالة الحالية:** يعرض الحساب، مدين، دائن، الوصف فقط.

**التعديلات المقترحة:**

1. **عمود اختياري "عملة الحساب"** — يظهر فقط عندما `account.accountCurrency` موجود ومختلف عن عملة الشركة الافتراضية (مثلاً SAR).

2. **عرض القيم بعملة الحساب** — عندما `debitInAccountCurrency` أو `creditInAccountCurrency` مختلفة عن `debit`/`credit` (في معاملات multi-currency):

```tsx
// مثال: عرض مدين بعملة الحساب إن وُجدت
{(line.debitInAccountCurrency ?? line.debit ?? line.debitAmount ?? 0) > 0 && 
 line.account?.accountCurrency && 
 line.account.accountCurrency !== 'SAR' && (
    <span className="text-xs text-muted-foreground block">
        {formatCurrency(line.debitInAccountCurrency ?? line.debit ?? 0)} {line.account.accountCurrency}
    </span>
)}
```

3. **عرض مركز التكلفة** — إن وُجد `costCenter`، إظهاره بجانب الحساب أو في عمود منفصل.

**جدول مقترح (توسيع):**

| الحساب | مدين | دائن | مركز التكلفة | الوصف |
|--------|------|------|--------------|-------|
| ...    | ...  | ...  | (اختياري)   | ...   |

أو إبقاء الجدول كما هو وإضافة tooltip أو صف فرعي يعرض العملة ومركز التكلفة.

### 5.2 منطق العرض

- إذا كل القيم بـ SAR أو لا توجد `accountCurrency`: لا داعي لعمود إضافي.
- التوسيع يكون تدريجياً (progressive enhancement) — لا يعطل العرض الحالي.

---

## 6. Phase 3 — Error Handling

### 6.1 UNBALANCED_ENTRY

الـ backend يرمي:

```json
{
  "code": "UNBALANCED_ENTRY",
  "diff": 5,
  "totalDebit": 10000,
  "totalCredit": 10005,
  "message": "Unbalanced entry...",
  "messageAr": "القيد غير متوازن"
}
```

**في `useCreateJournalEntry` أو عند استدعاء أي عملية تُنشئ قيد:**

```typescript
onError: (error: any) => {
    const code = error.response?.data?.code;
    const data = error.response?.data;
    const messages: Record<string, string> = {
        UNBALANCED_ENTRY: data?.diff != null
            ? `القيد غير متوازن (الفرق: ${(data.diff / 100).toFixed(2)} ₪)`
            : 'القيد غير متوازن',
        POSTING_TO_GROUP_ACCOUNT: 'لا يمكن القيد على حسابات المجموعة',
        POSTING_TO_DISABLED_ACCOUNT: 'لا يمكن القيد على حسابات معطلة',
        POSTING_TO_FROZEN_ACCOUNT: 'لا يمكن القيد على حسابات مجمدة',
        ALREADY_REVERSED: 'القيد معكوس بالفعل',
    };
    toast({
        variant: 'destructive',
        title: messages[code] || 'خطأ',
        description: data?.messageAr || error.response?.data?.message,
    });
},
```

### 6.2 نطاق التطبيق

- إنشاء قيد يدوي (Manual Journal Entry)
- أي عملية تستدعي `createJournalEntry` أو مسار GL Engine (البيع، الشراء، الدفع، إلخ) — غالباً عبر نفس الـ service أو hooks.

---

## 7. Phase 4 — Admin Settings (اختياري)

### 7.1 الهدف

تمكين المدير من:
- تفعيل/تعطيل GL Engine (`gl_engine_enabled`)
- تعديل tolerance إن وُجد واجهة لذلك (`gl_debit_credit_tolerance`)
- إعداد حساب التدوير ومركز التكلفة في إعدادات الشركة

### 7.2 الموقع

- تبويب جديد في `/settings` مثل "المحاسبة" أو "GL Engine"
- أو توسيع صفحة إعدادات الشركة إن وُجدت

### 7.3 APIs مطلوبة (قد تحتاج إضافة في الـ backend)

| Method | Path | الوصف |
|--------|------|-------|
| GET | `/settings` أو `/system-settings` | جلب الإعدادات |
| PUT | `/settings/gl_engine_enabled` | تفعيل/تعطيل GL Engine |
| PUT | `/settings/gl_debit_credit_tolerance` | تعديل tolerance |

أو استخدام `PATCH /system-settings/:key` إن وُجد.

### 7.4 مكونات مقترحة

```
Settings.tsx
  └── AccountingSettingsTab (جديد)
        ├── GL Engine toggle (gl_engine_enabled)
        ├── Tolerance (gl_debit_credit_tolerance) — اختياري
        └── ربط بإعدادات الشركة (round_off_account_id) إن وُجدت واجهة لها
```

**الأولوية منخفضة** — يمكن تنفيذها في مرحلة لاحقة بعد استقرار GL Engine.

---

## 8. Phase 5 — Round-Off Indicator (لاحقاً)

### 8.1 الحالة الحالية

- قيد التدوير يُحفظ كسطر عادي في `JournalEntryLine`.
- الـ backend لا يُرجّع حالياً حقل `is_round_off`.

### 8.2 عند إضافة `is_round_off` في الـ backend

- تحديث `JournalEntryLine` في الـ types.
- في جدول تفاصيل القيد: إضافة أيقونة (مثل ⟳) أو لون مختلف (مثلاً `bg-amber-50`) للصف الذي `line.isRoundOff === true`.
- إظهار وصف مثل "تدوير تقريبي" بجانب السطر.

### 8.3 مثال عرض

```tsx
{entry.lines.map((line) => (
    <TableRow 
        key={line.id} 
        className={line.isRoundOff ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
    >
        ...
        {line.isRoundOff && (
            <Badge variant="outline" className="text-xs">تدوير</Badge>
        )}
    </TableRow>
))}
```

---

## 9. Files to Create/Modify

| File | Action | Phase |
|------|--------|-------|
| `src/types/accounting.ts` | تحديث `JournalEntryLine` | 1 |
| `src/pages/Accounting.tsx` | `JournalDetailCard` — حقول اختيارية، عمود مركز التكلفة، عملة الحساب | 2 |
| `src/hooks/use-accounting.ts` | تحسين `onError` لـ UNBALANCED_ENTRY | 3 |
| `src/pages/Settings.tsx` | تبويب إعدادات المحاسبة (اختياري) | 4 |
| `src/components/settings/AccountingSettingsTab.tsx` | NEW (اختياري) | 4 |
| `Accounting.tsx` JournalDetailCard | Round-off indicator (عند إضافة الحقل) | 5 |

---

## 10. API Response Shape (للتحقق)

**Journal Entry مع lines من الـ backend:**

```json
{
  "id": 1,
  "entryNumber": "JE-000001",
  "entryDate": "2026-02-13T00:00:00.000Z",
  "description": "بيع: SALE-001",
  "lines": [
    {
      "id": 1,
      "accountId": 5,
      "debitAmount": 10000,
      "creditAmount": 0,
      "debitInAccountCurrency": 10000,
      "creditInAccountCurrency": null,
      "exchangeRate": null,
      "costCenterId": null,
      "costCenter": null,
      "partyType": "customer",
      "partyId": 1,
      "description": "Credit sale",
      "account": { "id": 5, "code": "1120", "name": "حسابات القبض", "accountCurrency": "SAR" }
    }
  ]
}
```

تأكد أن الـ backend يُضمّن `account` و`costCenter` في `include` عند جلب تفاصيل القيد.

---

## 11. Dependencies

- لا حزم npm جديدة مطلوبة لهذه الخطة.
- الاعتماد على المكونات الحالية: `Table`, `Badge`, `Dialog`, `toast`, إلخ.

---

## 12. ملخص الأولويات

| الأولوية | المهمة | ملاحظات |
|----------|--------|---------|
| **عالي** | تحديث Types | ضروري للتوسيع المستقبلي |
| **متوسط** | عرض الحقول الاختيارية في تفاصيل القيد | تحسين UX |
| **متوسط** | تحسين عرض UNBALANCED_ENTRY | تحسين تجربة المستخدم عند الخطأ |
| **منخفض** | إعدادات GL Engine في Settings | للمدراء فقط |
| **لاحقاً** | Round-off indicator | عند إضافة `is_round_off` في الـ backend |
