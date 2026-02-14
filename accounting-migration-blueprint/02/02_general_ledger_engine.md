# 02 — General Ledger Engine (ERP-Level)

**Migration Blueprint — Phase 2**  
**Target:** Extract and port ERPNext General Ledger Engine logic into a standalone, reusable GL Engine.

> **Prerequisite:** Phase 01 (Chart of Accounts Rebuild) must be applied first. This blueprint assumes `JournalEntryLine` uses `accountId` (not `accountCode`), and `Company` exists.

---

## 1️⃣ Problem Statement

### دمج منطق القيود مع العمليات
- SaleService و PurchaseService و PaymentsService و ExpensesService و WastageService تستدعي `AccountingService.createXxxJournalEntry()` مباشرة.
- كل عملية تنشئ JournalEntry و JournalEntryLine داخل دوال خاصة بها.
- إضافة مستند جديد يتطلب إنشاء دالة جديدة في AccountingService وتكرار منطق التحقق والحفظ.

### عدم وجود GL Map
- لا يوجد تمثيل وسيط للقيود قبل الحفظ. القيم تُنقل مباشرة كـ `JournalLineInput[]` إلى `createJournalEntryInternal`.
- لا يمكن تطبيق تحويلات مشتركة (merge، round-off، toggle negative) على قائمة قبل الحفظ.

### عدم وجود Round-Off Tolerance
- التحقق الحالي: `totalDebit !== totalCredit` يرمي استثناء بدون تسامح.
- فروق صغيرة بسبب التقريب (مثلاً 0.01) تمنع الحفظ بدلاً من إنشاء قيد تدوير تلقائي.

### ضعف إعادة الاستخدام
- نفس سلسلة التحقق (توازن، حفظ) مكررة في كل دالة.
- لا نقطة دخول واحدة لجميع أنواع المستندات.

### صعوبة إضافة مستندات جديدة
- إضافة نوع مستند جديد يتطلب: دالة في AccountingService، استدعاء من الـ service المعني، وتكرار منطق التحقق.

---

## 2️⃣ ERPNext GL Engine — Extracted Logic

### النمط الأساسي
- كل Document (Sales Invoice, Purchase Invoice, Payment Entry, Journal Entry, etc.) يوفّر `get_gl_entries()`.
- الدالة تُرجع قائمة GL Map (كائنات تمثل قيوداً مؤقتة).
- General Ledger Engine يستقبل GL Map عبر `make_gl_entries(gl_map, ...)`.
- لا يحفظ أي Document القيود بنفسه.

### تدفق make_gl_entries (عند عدم الإلغاء)
1. التحقق من الميزانية (إن لزم).
2. إضافة قيود الأبعاد المحاسبية (cost center offsetting) إن وُجدت.
3. التحقق من الفترة المحاسبية المغلقة.
4. التحقق من الحسابات المعطّلة.
5. استدعاء `process_gl_map(gl_map, merge_entries)`:
   - توزيع حسب cost center allocation (إن وُجد).
   - `merge_similar_entries()` — دمج القيود المتشابهة.
   - `toggle_debit_credit_if_negative()` — تطبيع القيم السالبة.
6. إنشاء Payment Ledger entries (إن وُجد).
7. استدعاء `save_entries()`:
   - `process_debit_credit_difference()` — فحص التوازن وإضافة round-off.
   - فحص freezing date.
   - فحص Period Closing.
   - لكل entry: `make_entry()` — إنشاء GL Entry وحفظه.

### process_debit_credit_difference
- حساب الفرق: `sum(debit) - sum(credit)` لكل entry بعد تطبيق precision.
- تحديد tolerance: `get_debit_credit_allowance(voucher_type, precision)` — Journal Entry / Payment Entry: `5.0 / 10^precision`، غير ذلك: 0.5.
- إذا `|diff| > allowance`: رمي خطأ.
- إذا `|diff| >= 1/10^precision`: استدعاء `make_round_off_gle()` لإضافة قيد تدوير.

### merge_similar_entries
- خصائص الدمج: account، cost_center، party، party_type، against_voucher، project، إلخ.
- لكل entry: بناء `merge_key` من هذه الخصائص.
- إذا وُجد entry بنفس الـ key: جمع debit و credit.
- إزالة entries ذات debit=0 و credit=0 (ما عدا Exchange Gain/Loss).

### toggle_debit_credit_if_negative
- إذا debit و credit سالبان ومتساويان: عكسهما لجعلهما موجبين.
- إذا debit سالب: نقل القيمة إلى credit.
- إذا credit سالب: نقل القيمة إلى debit.

### make_reverse_gl_entries
- جلب الـ GL entries الأصلية للـ voucher.
- لكل entry: إنشاء entry جديد مع swap: debit↔credit.
- تعيين `remarks = "On cancellation of {voucher_no}"`.
- عند Immutable Ledger: إنشاء قيود عكسية بدلاً من تحديث is_cancelled.

---

## 3️⃣ Target Architecture داخل نظامنا

### هيكل المجلدات

```
src/accounting/
├── gl-engine/
│   ├── gl-engine.service.ts      # نقطة الدخول الرئيسية
│   ├── gl-validator.service.ts   # التحقق من التوازن والـ tolerance
│   ├── gl-rounding.service.ts   # Round-off
│   ├── gl-merger.service.ts     # دمج القيود المتشابهة
│   ├── gl-entry.factory.ts      # تحويل GL Map → JournalEntryLine
│   └── types/
│       └── gl-map.types.ts
├── accounting.module.ts
└── accounting.service.ts         # يُحصر في getXxxGLMap + استدعاء glEngine
```

### دور كل ملف

| الملف | الدور |
|-------|-------|
| `gl-engine.service.ts` | نقطة الدخول: `post(glMap, metadata)` و `reverse(voucherType, voucherId)`. ينسّق: التحقق، الدمج، التدوير، الحفظ. |
| `gl-validator.service.ts` | `validateBalance(glMap)` — حساب الفرق، مقارنته مع tolerance، رمي خطأ أو إرجاع true. `getDebitCreditAllowance(voucherType, precision)`. |
| `gl-rounding.service.ts` | `applyRoundOffIfNeeded(glMap, diff, precision)` — إضافة قيد round-off إلى GL Map. |
| `gl-merger.service.ts` | `mergeSimilarEntries(glMap)` — دمج حسب account، cost_center، party، إلخ. |
| `gl-entry.factory.ts` | `createJournalEntryFromGLMap(tx, glMap, metadata)` — إنشاء JournalEntry و JournalEntryLine من GL Map المعالَج. |

---

## 4️⃣ GL Map Pattern

### واجهة GLMapEntry

```typescript
// gl-map.types.ts
export interface GLMapEntry {
  accountId: number;
  debit?: number;
  credit?: number;
  debitInAccountCurrency?: number;
  creditInAccountCurrency?: number;
  debitInTransactionCurrency?: number;
  creditInTransactionCurrency?: number;
  accountCurrency?: string;
  transactionCurrency?: string;
  exchangeRate?: number;
  costCenterId?: number | null;
  partyType?: string | null;
  partyId?: number | null;
  description?: string;
  againstVoucherType?: string | null;
  againstVoucherId?: number | null;
  voucherDetailNo?: string | null;
  isOpening?: boolean;
  skipMerge?: boolean;
}

export interface GLPostMetadata {
  voucherType: string;
  voucherId: number;
  voucherNumber?: string;
  postingDate: Date;
  companyId: number | null;
  branchId: number | null;
  description: string;
  createdById: number;
  updateOutstanding?: boolean;
}
```

### نمط الاستخدام

كل عملية لا تنشئ JournalEntry مباشرة. بدلاً من ذلك:

```typescript
// sales.service.ts - بعد إنشاء Sale
const glMap = this.getSaleGLMap(sale, data);
await this.glEngineService.post(glMap, {
  voucherType: 'sale',
  voucherId: sale.id,
  voucherNumber: sale.saleNumber,
  postingDate: sale.saleDate,
  companyId: 1,
  branchId: sale.branchId,
  description: `بيع: ${sale.saleNumber}`,
  createdById: cashierId,
});
```

### مثال GL Map للبيع

```typescript
[
  { accountId: cashAccountId, debit: amountPaid, description: 'Cash received' },
  { accountId: arAccountId, debit: amountDue, partyType: 'customer', partyId: customerId, description: 'Credit sale' },
  { accountId: revenueAccountId, credit: totalAmount, description: 'Sales revenue' },
  { accountId: cogsAccountId, debit: totalCost, description: 'Cost of goods sold' },
  { accountId: inventoryAccountId, credit: totalCost, description: 'Inventory reduction' },
]
```

### نقطة الدخول GL Engine

```typescript
// gl-engine.service.ts
async post(glMap: GLMapEntry[], metadata: GLPostMetadata, tx?: PrismaTransaction): Promise<JournalEntry> {
  const executor = tx ?? this.prisma;
  return executor.$transaction(async (t) => {
    const processed = await this.processGLMap(glMap, metadata, t);
    return this.glEntryFactory.createJournalEntryFromGLMap(t, processed, metadata);
  });
}
```

---

## 5️⃣ Debit/Credit Validation Logic

### process_debit_credit_difference — منطق ERPNext

1. قراءة precision من GL Entry أو من Company default_currency.
2. تحديد allowance عبر `get_debit_credit_allowance(voucher_type, precision)`.
3. حساب الفرق: `debit_credit_diff = sum(debit) - sum(credit)` لكل entry بعد تطبيق precision.
4. إذا `|diff| > allowance`: رمي خطأ (ما عدا Exchange Gain Or Loss).
5. إذا `|diff| >= 1/10^precision`: استدعاء `make_round_off_gle()`.

### أين نضع tolerance؟

- في `SystemSetting`: `gl_debit_credit_tolerance` — بالقيمة الافتراضية أو override.
- القيمة الافتراضية: `5.0 / (10 ** precision)` لـ Journal Entry و Payment، `0.5` لغيرها.
- **ملاحظة:** النظام يخزّن المبالغ بوحدات صغيرة (minor units)؛ عند precision=2 فـ 1 وحدة = 0.01 عملة. نفّذ `allowance` و `threshold` في نفس الوحدة.

### كيف نحدد حساب Round-Off؟

- في `Company`: `round_off_account_id` (مرجع لحساب Expense أو مخصص للتدوير).
- Fallback: `default_expense_account_id` من Company.
- في `Company`: `round_off_cost_center_id` (اختياري).
- عند عدم وجود Company: إضافة `round_off_account_id` في `SystemSetting` يشير للحساب المناسب (مثلاً 5290 مصروفات أخرى).

### كيف نخزن precision per company؟

- `Company.currencyPrecision` أو استنتاج من `default_currency`:
  - SAR, USD, EUR → 2
  - KWD, BHD → 3
- أو في `SystemSetting`: `currency_precision` = 2 افتراضياً.

### تنفيذ في gl-validator.service.ts

```typescript
getDebitCreditAllowance(voucherType: string, precision: number): number {
  if (['journal_entry', 'payment'].includes(voucherType)) {
    return 5.0 / Math.pow(10, precision);
  }
  return 0.5;
}

validateBalance(glMap: GLMapEntry[], precision: number, voucherType: string): { diff: number; needsRoundOff: boolean } {
  const totalDebit = glMap.reduce((s, e) => s + (e.debit ?? 0), 0);
  const totalCredit = glMap.reduce((s, e) => s + (e.credit ?? 0), 0);
  const diff = totalDebit - totalCredit;
  const allowance = this.getDebitCreditAllowance(voucherType, precision);
  if (Math.abs(diff) > allowance) {
    throw new BadRequestException({ code: 'UNBALANCED_ENTRY', diff, totalDebit, totalCredit });
  }
  const threshold = 1 / Math.pow(10, precision);
  return { diff, needsRoundOff: Math.abs(diff) >= threshold };
}
```

---

## 6️⃣ Merge Similar Entries

### خصائص الدمج (merge_properties)

```typescript
const MERGE_PROPERTIES = [
  'accountId',
  'costCenterId',
  'partyType',
  'partyId',
  'againstVoucherType',
  'againstVoucherId',
  'voucherDetailNo',
];

// يمكن توسيعها لاحقاً: projectId, financeBookId
```

### الخوارزمية

1. لكل entry: بناء `mergeKey` من القيم المقابلة للخصائص.
2. البحث عن entry في القائمة المدمجة بنفس الـ key.
3. إن وُجد: جمع debit، credit، debitInAccountCurrency، creditInAccountCurrency، debitInTransactionCurrency، creditInTransactionCurrency.
4. إن لم يُوجد: إضافة entry جديد.
5. بعد الدمج: إزالة entries حيث `debit === 0 && credit === 0` (ما عدا حالات خاصة مثل Exchange Gain/Loss).

### تحسين الأداء

- استخدام `Map<string, GLMapEntry>` بمفتاح هو `mergeKey` مُسلسَل.
- تمر واحد على glMap.

### تقليل حجم Ledger

- الدمج يقلل عدد الصفوف المحفوظة في JournalEntryLine.
- مثال: عدة بنود مبيعات لنفس الحساب تُدمج في سطر واحد.

### تنفيذ gl-merger.service.ts

```typescript
mergeSimilarEntries(glMap: GLMapEntry[], precision: number): GLMapEntry[] {
  const merged = new Map<string, GLMapEntry>();
  for (const entry of glMap) {
    if (entry.skipMerge) {
      merged.set(`skip_${entry.accountId}_${Math.random()}`, { ...entry });
      continue;
    }
    const key = this.getMergeKey(entry);
    const existing = merged.get(key);
    if (existing) {
      existing.debit = (existing.debit ?? 0) + (entry.debit ?? 0);
      existing.credit = (existing.credit ?? 0) + (entry.credit ?? 0);
      existing.debitInAccountCurrency = (existing.debitInAccountCurrency ?? 0) + (entry.debitInAccountCurrency ?? 0);
      existing.creditInAccountCurrency = (existing.creditInAccountCurrency ?? 0) + (entry.creditInAccountCurrency ?? 0);
    } else {
      merged.set(key, { ...entry });
    }
  }
  return [...merged.values()].filter(e => 
    Math.abs(e.debit ?? 0) > 0 || Math.abs(e.credit ?? 0) > 0
  );
}
```

---

## 7️⃣ Multi-Currency Foundation

### الحقول المطلوبة

| الحقل | النوع | الوصف |
|-------|-------|-------|
| debit | number | المدين بعملة الشركة (أو الأساسية) |
| credit | number | الدائن بعملة الشركة |
| debit_in_account_currency | number | المدين بعملة الحساب |
| credit_in_account_currency | number | الدائن بعملة الحساب |
| account_currency | string | عملة الحساب |
| transaction_currency | string | عملة المعاملة |
| exchange_rate | number | سعر الصرف من معاملة → عملة الشركة |

### كيف نخزن القيم

- عند عملة واحدة: `debit` = `debit_in_account_currency`، `credit` = `credit_in_account_currency`.
- عند multi-currency: `debit` = `debit_in_account_currency * exchange_rate` (أو من معكوس حسب الاتجاه).
- الحفاظ على القيم الثلاثة يسمح بالتقارير بعملة الحساب أو بعملة الشركة.

### كيف نحسب الفرق

- الفرق للتوازن يُحسب دائماً في عملة الشركة: `sum(debit) - sum(credit)`.
- الفرق في عملة المعاملة: `sum(debit_in_transaction_currency) - sum(credit_in_transaction_currency)`.
- Round-off يُطبَّق على كلا المستويين إن لزم.

### Exchange Gain/Loss لاحقاً

- عند اختلاف العملات أو تغيّر سعر الصرف، يُنشأ Journal Entry من نوع Exchange Gain Or Loss.
- في الـ allowance: هذا النوع قد يُعفى من شرط التوازن الصارم (حسب السياسة).
- المرحلة الحالية: إعداد الحقول فقط؛ منطق Gain/Loss في blueprint منفصل.

---

## 8️⃣ Reversal Logic داخل GL Engine

### glEngine.reverse(voucherType, voucherId)

1. جلب كل JournalEntry التي `sourceType = voucherType` و `sourceId = voucherId`.
2. لكل JournalEntry: جلب كل JournalEntryLine.
3. إنشاء JournalEntry جديد:
   - `description = "عكس: {original.description}"`
   - `sourceType = "reversal"`
   - `sourceId = originalEntry.id`
   - `reversedByEntryId = newEntry.id` على الأصلي بعد الحفظ.
4. لكل Line: إنشاء line مع `debit = original.credit`, `credit = original.debit`.
5. تحديث الأصلي: `isReversed = true`, `reversedByEntryId = newEntry.id`.

### منع حذف القيود

- لا يُسمح بحذف JournalEntry أو JournalEntryLine من الـ API.
- الإلغاء يتم فقط عبر العكس.
- عند الحاجة لـ "مسح": تعطيل أو إخفاء في الواجهة، مع الإبقاء على البيانات للتدقيق.

### الحفاظ على Audit Trail

- القيد الأصلي يبقى مع `isReversed = true`.
- القيد العكسي يُسجَّل كـ voucher مستقل مرتبط بالأصلي.

### تنفيذ

```typescript
async reverse(voucherType: string, voucherId: number, userId: number, tx?: PrismaTransaction): Promise<JournalEntry> {
  const executor = tx ?? this.prisma;
  return executor.$transaction(async (t) => {
    const original = await t.journalEntry.findFirst({
      where: { sourceType: voucherType, sourceId: voucherId },
      include: { lines: true },
    });
    if (!original) throw new NotFoundException('Journal entry not found');
    if (original.isReversed) throw new BadRequestException('Already reversed');

    const glMap = original.lines.map(l => ({
      accountId: l.accountId,
      debit: l.creditAmount,
      credit: l.debitAmount,
      description: `عكس: ${l.description ?? original.description}`,
    }));

    const reversal = await this.post(glMap, {
      voucherType: 'reversal',
      voucherId: original.id,
      postingDate: new Date(),
      companyId: null,
      branchId: original.branchId,
      description: `عكس: ${original.description}`,
      createdById: userId,
    }, t);

    await t.journalEntry.update({
      where: { id: original.id },
      data: { isReversed: true, reversedByEntryId: reversal.id },
    });
    return reversal;
  });
}
```

---

## 9️⃣ Database Changes

> **Note:** These changes build on Phase 01. `JournalEntryLine` from 01 already has `accountId`. Here we add GL Engine–related columns.

### تحديث JournalEntryLine (إضافة أعمدة)

```prisma
model JournalEntryLine {
  id                        Int      @id @default(autoincrement())
  journalEntryId            Int      @map("journal_entry_id")
  lineNumber                Int      @map("line_number")
  accountId                 Int      @map("account_id")  // من Blueprint 01

  debitAmount               Int      @default(0) @map("debit_amount")
  creditAmount              Int      @default(0) @map("credit_amount")
  debitInAccountCurrency    Int?     @map("debit_in_account_currency")   // NEW
  creditInAccountCurrency   Int?     @map("credit_in_account_currency")  // NEW
  exchangeRate              Float?   @map("exchange_rate")                 // NEW

  costCenterId              Int?     @map("cost_center_id")   // NEW
  companyId                 Int?     @map("company_id")       // NEW
  partyType                 String?  @map("party_type")       // NEW
  partyId                   Int?     @map("party_id")        // NEW

  againstVoucherType        String?  @map("against_voucher_type")  // NEW
  againstVoucherId          Int?     @map("against_voucher_id")    // NEW
  voucherDetailNo           String?  @map("voucher_detail_no")     // NEW

  description               String?
  isOpening                 Boolean  @default(false) @map("is_opening")  // NEW
  createdAt                 DateTime @default(now()) @map("created_at")

  journalEntry JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  account      Account      @relation(fields: [accountId], references: [id], onDelete: Restrict)
  costCenter   CostCenter?  @relation(fields: [costCenterId], references: [id], onDelete: SetNull)
  company      Company?     @relation(fields: [companyId], references: [id], onDelete: Restrict)

  @@unique([journalEntryId, lineNumber])
  @@index([accountId])
  @@index([companyId])
  @@index([costCenterId])
  @@index([partyType, partyId])
  @@map("journal_entry_lines")
}
```

### تحديث Company (إضافة Round-Off)

```prisma
// إضافة إلى model Company من Blueprint 01:
roundOffAccountId    Int?  @map("round_off_account_id")
roundOffCostCenterId Int?  @map("round_off_cost_center_id")
currencyPrecision    Int   @default(2) @map("currency_precision")
```

### جدول cost_centers (جديد)

```sql
CREATE TABLE IF NOT EXISTS cost_centers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(code, company_id)
);
CREATE INDEX idx_cost_centers_company ON cost_centers(company_id);
```

### Migration SQL

```sql
-- 012_gl_engine_enhancements
-- Prerequisite: 011_chart_of_accounts_rebuild applied

-- 1. Cost Centers
CREATE TABLE IF NOT EXISTS cost_centers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(code, company_id)
);
INSERT INTO cost_centers (code, name, company_id)
SELECT 'main', 'المركز الرئيسي', 1
WHERE NOT EXISTS (SELECT 1 FROM cost_centers);

-- 2. Company round-off fields
ALTER TABLE companies ADD COLUMN round_off_account_id INTEGER REFERENCES accounts(id);
ALTER TABLE companies ADD COLUMN round_off_cost_center_id INTEGER REFERENCES cost_centers(id);
ALTER TABLE companies ADD COLUMN currency_precision INTEGER DEFAULT 2;

-- 3. JournalEntryLine enhancements
ALTER TABLE journal_entry_lines ADD COLUMN debit_in_account_currency INTEGER;
ALTER TABLE journal_entry_lines ADD COLUMN credit_in_account_currency INTEGER;
ALTER TABLE journal_entry_lines ADD COLUMN exchange_rate REAL;
ALTER TABLE journal_entry_lines ADD COLUMN cost_center_id INTEGER REFERENCES cost_centers(id);
ALTER TABLE journal_entry_lines ADD COLUMN company_id INTEGER REFERENCES companies(id);
ALTER TABLE journal_entry_lines ADD COLUMN party_type TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN party_id INTEGER;
ALTER TABLE journal_entry_lines ADD COLUMN against_voucher_type TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN against_voucher_id INTEGER;
ALTER TABLE journal_entry_lines ADD COLUMN voucher_detail_no TEXT;
ALTER TABLE journal_entry_lines ADD COLUMN is_opening INTEGER DEFAULT 0;

-- 4. Backfill
UPDATE journal_entry_lines SET debit_in_account_currency = debit_amount, credit_in_account_currency = credit_amount WHERE debit_in_account_currency IS NULL;

-- 5. Indexes (إذا لم تكن موجودة من 01)
CREATE INDEX IF NOT EXISTS idx_jel_account ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_jel_company ON journal_entry_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_jel_cost_center ON journal_entry_lines(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_jel_party ON journal_entry_lines(party_type, party_id);
```

### SystemSetting للـ tolerance

```sql
INSERT OR IGNORE INTO system_settings (key, value, data_type, description) VALUES
  ('gl_debit_credit_tolerance', '5', 'number', 'Tolerance in minor units (e.g. 5 = 0.05 when precision=2)'),
  ('gl_engine_enabled', 'false', 'boolean', 'Use new GL Engine (Phase 02)');
```

---

## 🔟 Migration Strategy

### تحويل createSaleJournalEntry إلى getSaleGLMap

1. إنشاء `SalesGLMapper` أو دالة `getSaleGLMap(sale, data): GLMapEntry[]` داخل AccountingService أو SalesService.
2. الدالة تُرجع GL Map فقط بدون استدعاء حفظ.
3. استبدال:
   ```typescript
   await this.accountingService.createSaleJournalEntry(tx, ...);
   ```
   بـ:
   ```typescript
   const glMap = this.getSaleGLMap(sale, data);
   await this.glEngineService.post(glMap, metadata, tx);
   ```

### تحويل بقية العمليات

| العملية | الدالة الحالية | الدالة المستهدفة |
|---------|----------------|-------------------|
| Sale | createSaleJournalEntry | getSaleGLMap |
| Sale Void | createSaleVoidJournalEntry | getSaleVoidGLMap (أو استدعاء reverse) |
| Purchase | createPurchaseJournalEntry | getPurchaseGLMap |
| Payment Received | createPaymentReceivedJournalEntry | getPaymentReceivedGLMap |
| Payment Made | createPaymentMadeJournalEntry | getPaymentMadeGLMap |
| Wastage | createWastageJournalEntry | getWastageGLMap |
| Expense | createExpenseJournalEntry | getExpenseGLMap |

### منع إنشاء JournalEntry مباشرة

- إزالة أو تعطيل `createJournalEntryInternal` من الاستدعاء المباشر.
- إضافة تعليق أو رمي خطأ: "Use glEngine.post() instead".
- `createJournalEntry` من الواجهة (Manual JV) يستدعي `glEngine.post(glMap, metadata)` بعد تحويل الـ DTO إلى GL Map.

### فرض استخدام glEngine

- لا يُصدَّر من AccountingService دوال `createXxxJournalEntry`.
- يُصدَّر فقط `getXxxGLMap` و `GlEngineService.post/reverse`.
- في AccountingModule: GlEngineService مُصدَّر ويُستورد من SalesModule, PurchasesModule, إلخ.

---

## 1️⃣1️⃣ Frontend Impact

### عدم وجود تغيير مباشر في التدفق

- واجهة إنشاء البيع/الشراء/الدفع تبقى كما هي.
- التغيير في الـ backend فقط.

### دعم عرض العملات المتعددة

- عند إضافة الحقول الجديدة: عرض `debit_in_account_currency` و `credit_in_account_currency` إن كانت العملة مختلفة.
- عمود اختياري "عملة الحساب" في جدول تفاصيل القيد.

### عرض Round-Off line

- قيد التدوير يُحفظ كسطر عادي في JournalEntryLine.
- يمكن إضافة indicator في الواجهة (مثلاً أيقونة أو لون) للسطر الناتج عن round-off إن وُجد حقل `is_round_off` لاحقاً.

### عرض merged entries

- القيود المدمجة تظهر كسطر واحد. لا تغيير في العرض المطلوب.

---

## 1️⃣2️⃣ Testing Strategy

### Test balanced entries

- GL Map متوازن (sum debit = sum credit) → نجاح الحفظ.
- GL Map غير متوازن خارج tolerance → رمي UNBALANCED_ENTRY.

### Test tolerance rounding

- فرق 0.01 مع precision=2 و tolerance=0.05 → إنشاء round-off تلقائي.
- فرق 1.00 مع tolerance=0.5 → رمي خطأ.

### Test multi-currency

- GL Map بعملات مختلفة مع exchange_rate → التحقق من حفظ debit_in_account_currency و debit بشكل صحيح.

### Test merge logic

- عدة entries لنفس الحساب ونفس cost_center → دمجها في سطر واحد.
- entries مختلفة الخصائص → عدم الدمج.

### Test reversal

- إنشاء قيد ثم reverse → قيد عكسي مع debit↔credit.
- استدعاء reverse مرتين → رمي Already reversed.

### Load test (10k entries)

- إنشاء 10,000 قيد عبر loop.
- قياس زمن التنفيذ.
- التحقق من عدم استنفاد الذاكرة أو حدوث deadlock.

---

## 1️⃣3️⃣ Concurrency & Integrity

### حدود الـ transaction

- كل استدعاء `glEngine.post()` داخل `prisma.$transaction`.
- إذا كان الـ post يُستدعى من داخل transaction موجود (مثلاً من Sale create): تمرير `tx` لتجنب nested transaction أو استخدام نفس الـ transaction.

### منع double posting

- فحص قبل الـ post: هل وُجدت بالفعل JournalEntry لنفس `voucherType` و `voucherId`؟
- إن وُجدت: رمي `ALREADY_POSTED` أو تجاوز بحسب السياسة.

### Idempotency key

- إضافة `postingKey` اختياري في metadata: `hash(voucherType, voucherId, timestamp)`.
- تخزين المفاتيح المستخدمة في جدول أو cache.
- عند تكرار الطلب بنفس المفتاح: إرجاع النتيجة المحفوظة دون إعادة التنفيذ.

### آلية الـ locking

- عند reverse: `SELECT ... FOR UPDATE` على JournalEntry الأصلية (إن دعمتها قاعدة البيانات).
- في SQLite: استخدام transaction كافٍ لضمان التتابع.

---

## 1️⃣4️⃣ Deployment Strategy

### Feature flag

- `SystemSetting`: `gl_engine_enabled` (boolean).
- عند `false`: استخدام المسار القديم (createXxxJournalEntry).
- عند `true`: استخدام glEngine.post().

### Gradual migration

1. نشر GL Engine دون تفعيله.
2. تشغيل كلا المسارين بشكل متوازي والتحقق من تطابق النتائج.
3. تفعيل المسار الجديد لعمليات جديدة فقط.
4. إيقاف المسار القديم بعد التأكد.

### Compatibility mode

- خلال الفترة الانتقالية: دعم `accountCode` في GL Map (است resolve إلى accountId من Account).
- إصدار تنبيه عند استخدام accountCode.

### Data verification script

- سكربت يقارن: عدد القيود، المجاميع، الأرصدة قبل وبعد التفعيل.
- تشغيله على بيئة staging قبل الإنتاج.
