# خطة تنفيذ حسابات البنوك الشاملة

## المستند

خطة تنفيذية تفصيلية لدعم حسابات البنوك المتعددة في النظام، بحيث يمكن:

1. **إنشاء حسابات بنكية** تظهر في شجرة دليل الحسابات
2. **إظهار البنوك في المدفوعات** وربطها بالقيود المحاسبية
3. **إظهار البنوك في عمليات البيع والشراء**
4. **السماح باستقبال/دفع المال في الصندوق أو البنوك** بدلاً من تحويل كل شيء إلى 1111 (الصندوق)

---

## 1. الوضع الحالي والثغرات

### 1.1 ما هو موجود

| العنصر | الحالة | التفاصيل |
|--------|--------|----------|
| دليل الحسابات | ✓ | 1111 (النقد في الصندوق)، 1112 (النقد في البنك) |
| واجهة الحسابات البنكية | جزئي | `BankAccountsSettingsTab` في الإعدادات — تربط باسم + Account من الدليل |
| API الحسابات البنكية | ❓ | Frontend يستدعي `/bank-accounts` — التحقق من وجود Backend |
| طريقة دفع بنكية | ✓ | `bank_transfer`, `card` في المبيعات والمشتريات والمدفوعات |
| اختيار حساب بنكي في المدفوعات | ✓ | يظهر عند `bank_transfer` في PaymentProfile |
| اختيار حساب بنكي في المصروفات | ✓ | يظهر عند `bank_transfer` في ExpenseProfile |
| DTO المصروفات | ✓ | `bankAccountId` موجود في expense.dto |
| DTO المدفوعات | ❌ | لا يوجد `bankAccountId` في Payment schema أو DTOs |
| POS (نقطة البيع) | جزئي | فقط cash / card — لا بنك ولا اختيار وجهة استلام |
| ربط المحاسبة | ❌ | كل المبالغ النقدية تذهب إلى 1111 فقط |

### 1.2 الثغرات الحرجة

- **المحاسبة:** `getSaleGLMap`, `getPurchaseGLMap`, `getPaymentReceivedGLMap`, `getPaymentMadeGLMap`, `getExpenseGLMap` توجه كل المبالغ النقدية إلى `ACCOUNT_CODES.CASH` (1111) دون مراعاة:
  - طريقة الدفع (نقدي / بطاقة / تحويل بنكي)
  - الحساب البنكي المحدد (`bankAccountId`)
- **قاعدة البيانات:** جدول Payment لا يحتوي على `bankAccountId`. Sale و Purchase لا يحتويان على `bankAccountId` أو تفصيل الدفعات حسب الوجهة.
- **نقطة البيع:** لا خيار لاستلام المال في بنك — الدفع إما نقدي أو بطاقة، وكلاهما يحسب في الصندوق.

---

## 2. النطاق والنتائج المتوقعة

### 2.1 النتائج المستهدفة

1. **دليل الحسابات:** إمكانية إنشاء حسابات بنكية جديدة (مثل 1112-1 بنك فلسطين، 1112-2 بنك الأمة) تظهر تحت 1110 أو 1112.
2. **جدول BankAccount:** ربط كل حساب بنكي بـ Account محاسبي (من الدليل).
3. **المدفوعات:** عند اختيار تحويل بنكي، اختيار الحساب البنكي، وحفظ `bankAccountId` في Payment، واستخدام حسابه في القيد.
4. **المبيعات والمشتريات:** عند الدفع الفوري (نقدي/بطاقة/بنك)، تحديد وجهة استلام/دفع المال: صندوق أو بنك معين.
5. **نقطة البيع:** إضافة خيارات الدفع (نقدي، بطاقة، تحويل بنكي) مع اختيار وجهة الاستلام (صندوق / بنك) عند الحاجة.
6. **المصروفات:** ربط المصروفات بـ `bankAccountId` واستخدامه في القيد عند bank_transfer.

---

## 3. الخطة التفصيلية — حسب الطبقات

---

### المرحلة 1: قاعدة البيانات والبنية التحتية

#### 1.1 التحقق من جدول BankAccount

**الحالة:** Frontend يتعامل مع BankAccount، لكن يلزم التأكد من وجود جدول في Prisma.

**الإجراء:**
- إذا لم يكن الجدول موجوداً، إضافة نموذج `BankAccount` في `schema.prisma`:

```prisma
model BankAccount {
  id          Int       @id @default(autoincrement())
  code        String    @unique @map("code")      // e.g. BANK-PAL-01
  name        String    @map("name")             // بنك فلسطين
  nameEn      String?   @map("name_en")
  accountId   Int       @map("account_id")        // FK to Account (GL)
  companyId   Int?      @map("company_id")
  isActive    Boolean   @default(true) @map("is_active")
  isDefault   Boolean   @default(false) @map("is_default")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  account   Account   @relation(fields: [accountId], references: [id], onDelete: Restrict)
  company   Company?  @relation(fields: [companyId], references: [id], onDelete: SetNull)
  payments  Payment[]
  expenses  Expense[]

  @@index([accountId])
  @@index([companyId])
  @@map("bank_accounts")
}
```

- إضافة علاقة `bankAccounts BankAccount[]` في نموذج `Account` و`Company` إن لزم.

#### 1.2 إضافة bankAccountId إلى الجداول المعنية

| الجدول | الحقل | النوع | الملاحظات |
|--------|-------|-------|-----------|
| Payment | bankAccountId | Int? (FK → BankAccount) | اختياري — يُستخدم عند bank_transfer/card |
| Sale | — | — | لا حقل مباشر — الدفعات تأتي من SalePayment أو payments[] |
| Purchase | bankAccountId | Int? | عند الدفع الفوري في أمر الشراء |
| Expense | bankAccountId | Int? | موجود في DTO — التأكد من وجوده في schema |

**ملاحظة Sale:** في المبيعات، قد تكون الدفعات متعددة (نقدي + بنك). يُفضّل جدول `SalePayment` منفصل أو مصفوفة payments مع bankAccountId لكل دفعة. البديل الأبسط: حقل واحد `bankAccountId` في Sale عند دفع فوري واحد ببنك.

**الخيار الموصى به للمبيعات:**
- إذا كان هيكل الدفع بسيطاً (دفعة واحدة): إضافة `bankAccountId` و`paymentMethod` في Sale.
- إذا كان هيكل الدفع معقداً (دفعات متعددة): جدول `SalePayment` مع (saleId, amount, paymentMethod, bankAccountId).

#### 1.3 Migration

```bash
npx prisma migrate dev --name add_bank_account_support
```

---

### المرحلة 2: واجهة الحسابات البنكية (API)

#### 2.1 إنشاء BankAccountsModule (إن لم يكن موجوداً)

**الملفات:**
- `app/backend/src/bank-accounts/bank-accounts.module.ts`
- `app/backend/src/bank-accounts/bank-accounts.controller.ts`
- `app/backend/src/bank-accounts/bank-accounts.service.ts`
- `app/backend/src/bank-accounts/dto/*.ts`

#### 2.2 الـ API المطلوبة

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| GET | /bank-accounts | قائمة الحسابات البنكية (مع includeInactive) |
| GET | /bank-accounts/:id | تفاصيل حساب بنكي |
| GET | /bank-accounts/default | الحساب الافتراضي |
| POST | /bank-accounts | إنشاء حساب بنكي |
| PUT | /bank-accounts/:id | تحديث حساب بنكي |
| DELETE | /bank-accounts/:id | حذف (أو تعطيل) حساب بنكي |

#### 2.3 تسجيل Module

إضافة `BankAccountsModule` في `AppModule`.

---

### المرحلة 3: دليل الحسابات — شجرة الحسابات البنكية

#### 3.1 آلية إنشاء حسابات بنكية في الشجرة

**الخيار أ (الموصى به):** إنشاء Account تلقائياً عند إضافة BankAccount جديد:
- عند إنشاء BankAccount باسم "بنك فلسطين"، النظام ينشئ Account جديداً:
  - `code`: 1112-1 أو 1112-001 (تسلسل تحت 1112)
  - `name`: بنك فلسطين
  - `parentId`: حساب 1112 (النقد في البنك)
  - `accountType`: Bank
  - `isGroup`: false
- الجدول BankAccount يربط هذا الحساب الجديد.
- النتيجة: الحساب يظهر مباشرة في شجرة المحاسبة تحت "النقد في البنك".

**الخيار ب:** المستخدم يختار Account موجوداً من الدليل:
- في BankAccountsSettingsTab: قائمة الحسابات القابلة للترحيل تحت 1110 (الصندوق والبنوك).
- المستخدم ينشئ حساباً يدوياً من دليل الحسابات أولاً (مثلاً 1112-1 بنك فلسطين)، ثم يربطه في الحسابات البنكية.

#### 3.2 عرض الحسابات البنكية في الواجهة

- في صفحة دليل الحسابات: عرض أي Account مرتبط بـ BankAccount مع تمييز بصري (أيقونة بنك 🏦).
- في BankAccountsSettingsTab: القائمة الحالية كافية، مع التأكد أن الحساب المختار يظهر في الشجرة تحت النقدية.
- إضافة زر "إنشاء حساب بنكي جديد" في دليل الحسابات يفتح نموذج إنشاء BankAccount ويُنشئ Account تلقائياً.

---

### المرحلة 4: المحاسبة — استخدام البنك في القيود

#### 4.1 تعديل GL Maps في AccountingService

**مبدأ عام:** عند استلام أو دفع مبلغ نقدي/بطاقة/بنك، يجب تحديد حساب الخصم/الدائن:
- نقدي / بطاقة (بدون bankAccountId) → 1111 (CASH)
- تحويل بنكي / بطاقة مع bankAccountId → حساب البنك من BankAccount.accountId

#### 4.2 الدوال المطلوب تعديلها

| الدالة | التعديل |
|--------|---------|
| `getSaleGLMap` | إضافة معاملات: `paymentMethod`, `bankAccountId`. عند amountPaid > 0، استخدام `resolveCashOrBankAccount(...)` لتحديد accountId الخصم. |
| `getSaleVoidGLMap` | نفس المنطق للعكس (credit بدل debit). |
| `getPurchaseGLMap` | إضافة `paymentMethod`, `bankAccountId`. عند amountPaid > 0، تحديد حساب الدائن (صندوق أو بنك). |
| `getPaymentReceivedGLMap` | إضافة `paymentMethod?`, `bankAccountId?`. |
| `getPaymentMadeGLMap` | إضافة `paymentMethod?`, `bankAccountId?`. |
| `getExpenseGLMap` | إضافة `bankAccountId?`. عند bank_transfer + bankAccountId، استخدام حساب البنك بدل CASH. |

#### 4.3 دالة مساعدة

```typescript
// في accounting.service.ts
private async resolveCashOrBankAccount(
  paymentMethod: string,
  bankAccountId?: number | null,
  tx?: any
): Promise<number> {
  const prisma = tx ?? this.prisma;
  const useBank = ['bank_transfer', 'card'].includes(paymentMethod) && bankAccountId;
  if (useBank) {
    const bank = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId! },
      select: { accountId: true },
    });
    if (bank) return bank.accountId;
  }
  return this.chartOfAccountsService.getAccountIdByCode(ACCOUNT_CODES.CASH);
}
```

---

### المرحلة 5: المدفوعات

#### 5.1 Payment Schema

إضافة حقل:

```prisma
bankAccountId Int? @map("bank_account_id")
```

مع العلاقة:

```prisma
bankAccount BankAccount? @relation(fields: [bankAccountId], references: [id], onDelete: SetNull)
```

#### 5.2 Payment DTOs

- `RecordSalePaymentDto`: إضافة `bankAccountId?: number`
- `RecordPurchasePaymentDto`: إضافة `bankAccountId?: number`
- `CreateAdvancePaymentDto`: إضافة `bankAccountId?: number`

#### 5.3 PaymentsService

- عند إنشاء Payment، حفظ `bankAccountId` من الـ DTO.
- عند استدعاء `createPaymentReceivedJournalEntry` و `createPaymentMadeJournalEntry`، تمرير `paymentMethod` و `bankAccountId` من Payment.

#### 5.4 تعديل createPaymentReceivedJournalEntry و createPaymentMadeJournalEntry

- إضافة معاملات: `paymentMethod?: string`, `bankAccountId?: number`.
- استخدام `getPaymentReceivedGLMap(amount, paymentMethod, bankAccountId)` و `getPaymentMadeGLMap(...)` مع الحساب الصحيح.

---

### المرحلة 6: المبيعات

#### 6.1 Sale Schema

- إذا كان نموذج الدفع بسيطاً: إضافة `paymentMethod`, `bankAccountId` في Sale.
- إذا كان هناك جدول SalePayment منفصل: إضافة الحقول هناك.

#### 6.2 Create Sale DTO / Payments Array

- كل عنصر في `payments` يتضمن: `amount`, `paymentMethod`, `bankAccountId?`.
- عند إعداد الـ GL Map للمبيعة، تجميع المبالغ حسب الوجهة (صندوق مقابل بنوك) وإنشاء قيود منفصلة أو سطور متعددة.

#### 6.3 SalesService

- عند إنشاء قيد البيع، تمرير `paymentMethod` و `bankAccountId` (أو تفصيل payments) إلى `getSaleGLMap` أو إنشاء دوال مساعدة للتجزئة.

---

### المرحلة 7: المشتريات

#### 7.1 Purchase Schema

- إضافة `paymentMethod?: string`, `bankAccountId?: number` عند وجود دفع فوري.

#### 7.2 PurchasesService

- عند إنشاء أمر شراء مع دفع فوري، حفظ `paymentMethod` و `bankAccountId`.
- عند استدعاء `createPurchaseJournalEntry`، تمرير هذه القيم لتحديد حساب الدائن.

---

### المرحلة 8: المصروفات

#### 8.1 Expense Schema

- التأكد من وجود `bankAccountId` في schema إن لم يكن موجوداً.

#### 8.2 ExpensesService

- التأكد أن `bankAccountId` يُمرّر إلى `getExpenseGLMap` عند `paymentMethod === 'bank_transfer'`.

---

### المرحلة 9: نقطة البيع (POS)

#### 9.1 توسيع خيارات الدفع

- إضافة: نقدي، بطاقة، تحويل بنكي.
- عند اختيار تحويل بنكي، إظهار قائمة الحسابات البنكية.

#### 9.2 وجهة الاستلام

- عند نقدي: استلام في الصندوق (1111).
- عند بطاقة أو تحويل بنكي: اختيار الصندوق أو بنك معين.
- يُفضّل واجهة بسيطة: "استلام في: [صندوق ▼] [بنك فلسطين ▼]".

#### 9.3 تحديث CreateSaleDto

- إرسال `paymentMethod` و `bankAccountId` (أو مصفوفة payments) مع طلب إنشاء البيع.

---

### المرحلة 10: الواجهات الأمامية (Frontend)

#### 10.1 المدفوعات (PaymentProfile)

- التأكد أن `bankAccountId` يُرسَل ويُعرض.
- إظهار الحساب البنكي في وضع العرض (View) عند توفرها.

#### 10.2 المبيعات (Create Sale / Sales Form)

- إضافة حقل طريقة الدفع واختيار الحساب البنكي عند الدفع الفوري.

#### 10.3 المشتريات (Purchase Form)

- إضافة حقل طريقة الدفع واختيار الحساب البنكي عند الدفع الفوري.

#### 10.4 المصروفات (ExpenseProfile)

- التحقق أن `bankAccountId` يُستخدم فعلياً (مع تطابق Backend).

#### 10.5 نقطة البيع (POS)

- إضافة أزرار/قائمة للدفع (نقدي، بطاقة، تحويل بنكي) مع اختيار وجهة الاستلام.

---

## 4. ترتيب التنفيذ المقترح

| # | المرحلة | الأولوية | التبعيات |
|---|---------|----------|----------|
| 1 | قاعدة البيانات: BankAccount، bankAccountId في Payment, Expense, Purchase, Sale | عالية | — |
| 2 | BankAccountsModule + API | عالية | 1 |
| 3 | تعديل دوال GL Maps في المحاسبة | عالية | 1 |
| 4 | المدفوعات: حفظ واستخدام bankAccountId | عالية | 1, 2, 3 |
| 5 | المصروفات: ربط bankAccountId بالقيد | متوسطة | 1, 3 |
| 6 | المبيعات: paymentMethod + bankAccountId | عالية | 1, 3 |
| 7 | المشتريات: paymentMethod + bankAccountId | عالية | 1, 3 |
| 8 | نقطة البيع: خيارات الدفع ووجهة الاستلام | عالية | 6 |
| 9 | دليل الحسابات: تحسين عرض الحسابات البنكية | منخفضة | 2 |
| 10 | التحقق النهائي والاختبارات | عالية | 1–9 |

---

## 5. أمثلة سيناريوهات الاستخدام

### 5.1 سيناريو 1: إنشاء حساب بنك والاستخدام في مدفوعات

1. المستخدم يذهب إلى الإعدادات → الحسابات البنكية.
2. يضيف "بنك فلسطين" ويربطه بحساب 1112-1 (أو حساب جديد تحت 1110).
3. عند تسجيل دفعة تحصيل من عميل بطريقة "تحويل بنكي"، يختار "بنك فلسطين".
4. القيد: مدين 1120 (حسابات القبض) دائن، مدين 1112-1 (بنك فلسطين) مدين.

### 5.2 سيناريو 2: بيع في نقطة البيع بدفع بطاقة إلى البنك

1. الكاشير ينتهي من البيع، يختار "بطاقة" ثم "استلام في: بنك فلسطين".
2. النظام يسجل الدفعة في بنك فلسطين.
3. القيد: مدين حساب بنك فلسطين، دائن إيرادات المبيعات، إلخ.

### 5.3 سيناريو 3: مصروف بتحويل بنكي

1. المستخدم يسجل مصروف إيجار بطريقة "تحويل بنكي" ويختار "بنك الأمة".
2. القيد: مدين مصروف الإيجار، دائن حساب بنك الأمة.

---

## 6. ملاحظات تقنية

- **وحدات القيمة:** المبالغ بأصغر وحدة (فلس/سنت) في كل أنحاء النظام.
- **الترحيل:** الحسابات البنكية يجب أن تكون قابلة للترحيل (isGroup = false).
- **منع الترحيل الجماعي:** التحقق أن حسابات البنك ليست مجموعات (PreventGroupPostingGuard).
- **الترحيل العكسي:** عند إلغاء عملية، استخدام نفس حساب البنك في قيد العكس.

---

## 7. ملفات مرجعية

| الملف | الغرض |
|-------|-------|
| `app/backend/prisma/schema.prisma` | نموذج البيانات والهجرة |
| `app/backend/src/accounting/accounting.service.ts` | GL Maps ودوال القيود |
| `app/backend/src/payments/payments.service.ts` | إنشاء المدفوعات وربطها بالمحاسبة |
| `app/backend/src/sales/sales.service.ts` | إنشاء المبيعات والقيود |
| `app/backend/src/purchases/purchases.service.ts` | إنشاء المشتريات والقيود |
| `app/backend/src/expenses/expenses.service.ts` | إنشاء المصروفات والقيود |
| `app/frontend/src/pages/payments/PaymentProfile.tsx` | نموذج المدفوعات |
| `app/frontend/src/pages/sales/POS.tsx` أو `Sales.tsx` | نقطة البيع وتفاصيل البيع |
| `app/frontend/src/components/settings/BankAccountsSettingsTab.tsx` | إدارة الحسابات البنكية |

---

*تاريخ الإعداد: 2026-03-18*
*الإصدار: 1.0*
