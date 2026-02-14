# 05 — Tax Engine & VAT Architecture (ERP-Level)

**Migration Blueprint — Phase 5**  
**Target:** Build a tax engine that matches ERPNext logic (Tax Templates, separate GL posting, VAT Payable/Receivable, Credit Note reversal).

> **Prerequisites:** Phase 01 (Chart of Accounts), Phase 02 (GL Engine), Phase 03 (Posting Workflow), Phase 04 (Receivables — optional for Credit Note tax) must be applied.

---

## 1️⃣ Problem Statement

### لماذا دمج الضريبة مع الإيراد خطأ محاسبي
- **معيار المحاسبة:** الإيراد يُسجّل صافياً (قبل الضريبة). الضريبة التزام تجاه السلطة الضريبية.
- **الفصل المطلوب:** Revenue Account ← الإيراد الصافي فقط. VAT Payable ← مبلغ الضريبة.
- عند دمج الاثنين: الإيراد المُسجّل يتجاوز القيمة الفعلية، والتزام الضريبة غير ظاهر في الدفاتر.
- **تأثير التقارير:** قائمة الدخل تظهر إيرادات مبالغ فيها؛ الميزانية لا تعكس الالتزام الضريبي.
- **امتثال:** هيئة الزكاة والضريبة تتطلب فصل الإيراد عن الضريبة في الفواتير والتقارير.

### لماذا taxAmount بدون GL impact عديم القيمة
- `taxAmount` مخزن في Sale/Purchase لكن لا يُستخدم في القيود.
- القيد الحالي: `CR Sales Revenue = totalAmount` — يشمل الضريبة ضمنياً.
- النتيجة: لا يوجد تأثير محاسبي للضريبة — لا قيد على حساب VAT Payable.
- التقارير المالية والتقارير الضريبية لا يمكن أن تعتمد على `taxAmount` إذا لم يكن مربوطاً بالدفاتر.
- `taxAmount` بدون GL = رقم معزول غير قابل للتدقيق.

### مخاطر عدم وجود VAT Payable
- الالتزام الضريبي (ضريبة مدفوعة من العميل للتحويل للجهة الضريبية) غير مسجّل.
- لا يمكن مطابقة الرصيد مع إقرارات الضريبة.
- لا يمكن توليد تقرير VAT رسمي من الدفاتر.
- النظام غير قابل للتدقيق الضريبي.

### مخاطر عدم دعم Return Tax
- عند إرجاع فاتورة أو إصدار Credit Note: يجب عكس الضريبة أيضاً.
- إذا تم عكس الإيراد دون عكس الضريبة: رصيد VAT Payable يبقى زائداً.
- التزام تجاه الجهة الضريبية يصبح غير متطابق مع الواقع.
- امتثال ضريبي معطوب.

---

## 2️⃣ ERPNext Tax Model (Target Model)

### عند Submit Sales Invoice

| الحساب | Debit | Credit | الوصف |
|--------|-------|--------|-------|
| Receivable (AR) | grand_total | | المستحق من العميل |
| Income Account | | net_amount | الإيراد الصافي |
| VAT Payable | | tax_amount | التزام الضريبة |

- **Net Revenue** → حساب الإيراد (Income Account).
- **Tax** → حساب الضريبة (tax.account_head، عادة VAT Payable).
- **Receivable** → العميل بالمجموع الإجمالي.

### make_tax_gl_entries()

لكل سطر في `taxes` (Sales/Purchase Taxes And Charges):

- `account_head` — الحساب المحاسبي للضريبة.
- `rate` — النسبة (مثلاً 15).
- `tax_amount` — المبلغ المحسوب.
- `cost_center` — اختياري.
- القيد: Credit للضريبة على المبيعات (زيادة التزام)، Debit للضريبة على المشتريات (استرداد).

### Tax Template

- **Sales Taxes And Charges Template** / **Purchase Taxes And Charges Template** — مجموعة ضرائب قابلة لإعادة الاستخدام.
- مرتبطة بالفاتورة عبر حقل `taxes_and_charges`.
- يحتوي على صفوف (Tax Template Items): account_head، rate، charge_type.
- عند اختيار القالب: يُنسخ محتواه إلى جدول `taxes` في الفاتورة.
- يسمح بتعديل القيم قبل الترحيل (إن سُمح).

### عند Return / Credit Note

- عكس الإيراد: DR Revenue، CR Receivable (أو العكس حسب اتجاه الإرجاع).
- عكس الضريبة: DR VAT Payable (تقليل التزام)، CR Receivable.
- إنشاء قيود عكسية تحافظ على توازن الدفاتر.
- VAT Ledger يُحدَّث ليعكس انخفاض الالتزام الضريبي.

---

## 3️⃣ Target Architecture داخل نظامنا

### هيكل المجلدات والخدمات

```
src/accounting/
├── tax/
│   ├── tax-engine.service.ts       # تنسيق الحساب والترحيل
│   ├── tax-template.service.ts     # إدارة قوالب الضرائب
│   ├── tax-calculation.service.ts  # حساب الضرائب حسب القالب
│   ├── vat-report.service.ts       # تقرير VAT
│   └── types/
│       └── tax.types.ts
└── accounting.module.ts
```

### دور كل Service

| الخدمة | الدور |
|--------|-------|
| **TaxEngineService** | `getTaxGLEntries(taxRows, netTotal, voucherType)` — يحوّل صفوف الضريبة إلى GL Map rows. يُستدعى من getSaleGLMap / getPurchaseGLMap. |
| **TaxTemplateService** | CRUD لـ TaxTemplate و TaxTemplateItem. `getTemplateWithItems(templateId)`. التحقق من صلاحية القالب. |
| **TaxCalculationService** | `calculateTaxes(templateId, netTotal, items?)` — يحسب الضريبة حسب charge_type (On Net Total، On Previous Row، Actual). يُرجع مصفوفة `{ accountId, rate, amount }`. |
| **VatReportService** | `generateVATReport(startDate, endDate, companyId?)` — يجمع من GL أو Tax Ledger: Output VAT، Input VAT، Net VAT Payable. تفصيل حسب الحساب والنسبة. |

---

## 4️⃣ Database Changes

### جدول TaxTemplate

```prisma
model TaxTemplate {
  id          Int      @id @default(autoincrement())
  name        String   @unique
  type        String   // 'sales', 'purchases'
  companyId   Int?     @map("company_id")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company Company?         @relation(fields: [companyId], references: [id], onDelete: Restrict)
  items   TaxTemplateItem[]

  @@index([type])
  @@index([companyId])
  @@map("tax_templates")
}
```

### جدول TaxTemplateItem

```prisma
model TaxTemplateItem {
  id            Int      @id @default(autoincrement())
  templateId    Int      @map("template_id")
  accountId     Int      @map("account_id")
  rate          Int      @map("rate")        // Basis points (1500 = 15%)
  chargeType    String   @map("charge_type") // 'on_net_total', 'on_previous_row', 'on_previous_row_total', 'actual'
  rowId         Int?     @map("row_id")     // للـ On Previous Row: رقم الصف المرجعي (1-based)
  fixedAmount   Int?     @map("fixed_amount") // للـ Actual: مبلغ ثابت (minor units)
  isDeductible  Boolean  @default(true) @map("is_deductible") // للمشتريات
  displayOrder  Int      @default(0) @map("display_order")
  createdAt     DateTime @default(now()) @map("created_at")

  template TaxTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  account  Account     @relation(fields: [accountId], references: [id], onDelete: Restrict)

  @@index([templateId])
  @@map("tax_template_items")
}
```

### تحديث Sale / Purchase

```prisma
// إضافة إلى Sale:
taxTemplateId   Int?     @map("tax_template_id")
netTotal        Int?     @map("net_total")       // قبل الضريبة (minor units)
totalTaxAmount  Int      @default(0) @map("total_tax_amount")
grandTotal      Int?     @map("grand_total")     // netTotal + totalTaxAmount

// إضافة إلى Purchase:
taxTemplateId   Int?     @map("tax_template_id")
netTotal        Int?     @map("net_total")
totalTaxAmount  Int      @default(0) @map("total_tax_amount")
grandTotal      Int?     @map("grand_total")
```

### جدول TaxBreakdown (اختياري — لتخزين تفصيل الضريبة لكل فاتورة)

```prisma
model SaleTaxBreakdown {
  id         Int      @id @default(autoincrement())
  saleId     Int      @map("sale_id")
  accountId  Int      @map("account_id")
  rate       Int      @map("rate")
  taxAmount  Int      @map("tax_amount")
  createdAt  DateTime @default(now()) @map("created_at")

  sale    Sale    @relation(fields: [saleId], references: [id], onDelete: Cascade)
  account Account @relation(fields: [accountId], references: [id], onDelete: Restrict)

  @@index([saleId])
  @@map("sale_tax_breakdowns")
}
```

### Migration SQL

```sql
-- 014_tax_engine

CREATE TABLE tax_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE tax_template_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES tax_templates(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  rate INTEGER NOT NULL,
  charge_type TEXT NOT NULL DEFAULT 'on_net_total',
  row_id INTEGER,
  fixed_amount INTEGER,
  is_deductible INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_tax_template_items_template ON tax_template_items(template_id);

ALTER TABLE sales ADD COLUMN tax_template_id INTEGER REFERENCES tax_templates(id);
ALTER TABLE sales ADD COLUMN net_total INTEGER;
ALTER TABLE sales ADD COLUMN total_tax_amount INTEGER DEFAULT 0;
ALTER TABLE sales ADD COLUMN grand_total INTEGER;

ALTER TABLE purchases ADD COLUMN tax_template_id INTEGER REFERENCES tax_templates(id);
ALTER TABLE purchases ADD COLUMN net_total INTEGER;
ALTER TABLE purchases ADD COLUMN total_tax_amount INTEGER DEFAULT 0;
ALTER TABLE purchases ADD COLUMN grand_total INTEGER;

-- Seed: قالب ضريبة افتراضي 15% على المبيعات (يُنفّذ بعد التأكد من وجود حساب VAT)
INSERT INTO tax_templates (name, type) VALUES ('VAT 15% Sales', 'sales');
INSERT INTO tax_template_items (template_id, account_id, rate, charge_type)
SELECT 1, id, 1500, 'on_net_total' FROM accounts WHERE code IN ('2120', '2200') AND is_active = 1 LIMIT 1;
```

---

## 5️⃣ Tax Calculation Engine

### Charge Types (منطق ERPNext)

| النوع | الوصف | صيغة الحساب |
|-------|-------|--------------|
| **On Net Total** | الضريبة على صافي المجموع | `amount = netTotal * rate / 10000` |
| **On Previous Row Amount** | الضريبة على مبلغ الضريبة السابقة | `amount = previousTaxAmount * rate / 10000` |
| **On Previous Row Total** | الضريبة على المجموع التراكمي (شامل الضرائب السابقة) | `amount = (netTotal + sum(prevTaxes)) * rate / 10000` |
| **Actual** | مبلغ ثابت | `amount = value` (يُدخل يدوياً) |

### دعم Multi Tax Rows
- ترتيب التنفيذ حسب `displayOrder` أو `rowId`.
- لكل صف: حساب المبلغ حسب charge_type.
- تجميع النتائج في مصفوفة للاستخدام في GL.

### دعم Compounded Taxes
- "On Previous Row" يُستخدم للضرائب المركبة (مثلاً ضريبة على ضريبة).
- الترتيب مهم: الضريبة الأولى تُحسب على Net، الثانية على مبلغ الأولى أو المجموع التراكمي.

### Rounding Rules
- استخدام precision الشركة (مثلاً 2 منازل = 100 في minor units).
- `Math.round(amount)` أو تطبيق precision عند الحساب.
- جمع الضرائب مع تطبيق التقريب على كل صف قبل الجمع.

### Precision per Company
- من Company.currencyPrecision (من Blueprint 01).
- أو SystemSetting: `currency_precision` = 2.
- المبالغ تُخزن دائماً في minor units.

### تنفيذ TaxCalculationService

```typescript
interface TaxResult { accountId: number; rate: number; amount: number }

async calculateTaxes(
  templateId: number,
  netTotal: number,
  precision: number = 2
): Promise<TaxResult[]> {
  const items = await this.getOrderedTaxItems(templateId);
  const results: TaxResult[] = [];
  let cumulativeBase = netTotal;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let amount = 0;

    if (item.chargeType === 'on_net_total') {
      amount = Math.round((netTotal * item.rate) / 10000);
    } else if (item.chargeType === 'on_previous_row_amount') {
      const prev = results[item.rowId! - 1];
      amount = prev ? Math.round((prev.amount * item.rate) / 10000) : 0;
    } else if (item.chargeType === 'on_previous_row_total') {
      const prevTotal = netTotal + results.slice(0, item.rowId).reduce((s, r) => s + r.amount, 0);
      amount = Math.round((prevTotal * item.rate) / 10000);
    } else if (item.chargeType === 'actual') {
      amount = item.fixedAmount ?? 0;
    }

    results.push({ accountId: item.accountId, rate: item.rate, amount });
  }
  return results;
}
```

---

## 6️⃣ GL Posting Logic

### بدلاً من

```
CR Sales Revenue = totalAmount
```

### يصبح

```
DR Receivable = grandTotal
CR Sales Revenue = netTotal
CR VAT Payable = totalTaxAmount
```

### GLMap يجب أن يحتوي tax rows
- عند بناء getSaleGLMap: استدعاء TaxCalculationService إذا وُجد taxTemplateId.
- إضافة صف لكل tax: `{ accountId: vatAccountId, credit: taxAmount, description: 'VAT 15%' }`.
- الإيراد: `credit: netTotal` وليس totalAmount.

### tax.account_head يُستخدم
- من TaxTemplateItem.accountId — كل ضريبة لها حسابها.
- يدعم عدة حسابات (VAT 15%، ضريبة بلدية، إلخ).

### فصل صريح في القيود
- لا قيد واحد للإيراد+الضريبة.
- صف منفصل لكل حساب.
- يسمح بتقارير VAT دقيقة من GL.

### مثال GL Map للبيع مع ضريبة

```typescript
const glMap: GLMapEntry[] = [];

// Receivable
glMap.push({ accountId: arAccountId, debit: grandTotal, partyType: 'customer', partyId: customerId });

// Revenue (صافي)
glMap.push({ accountId: revenueAccountId, credit: netTotal, description: 'Sales revenue' });

// Tax rows
for (const tax of taxResults) {
  glMap.push({ accountId: tax.accountId, credit: tax.amount, description: `VAT ${tax.rate / 100}%` });
}

// COGS, Inventory, Cash, Discounts... كما هي
```

---

## 7️⃣ Purchase VAT (Input VAT)

### عند Purchase
- **Expense** → Net (المبلغ الصافي للمصروف).
- **VAT Receivable** (Input VAT) → Debit — نسترد الضريبة من الجهة الضريبية.
- **Payable** → Credit — المبلغ الإجمالي المستحق للمورد.

### الفرق بين VAT Payable و VAT Receivable
| VAT Payable | VAT Receivable |
|-------------|----------------|
| Output VAT — ضريبة مجمعة من المبيعات | Input VAT — ضريبة مدفوعة في المشتريات |
| Credit (التزام) | Debit (أصل قابل للاسترداد) |
| نتحصل من العميل ونسلم للجهة الضريبية | ندفع للمورد ونسترد من الجهة الضريبية |
| حساب 2120 (Liability) | حساب 1130 أو مشابه (Current Asset) |

### GL للشراء مع ضريبة

```
DR Inventory/Expense     netTotal
DR VAT Receivable        inputTaxAmount
CR Accounts Payable      grandTotal
```

### إنشاء حساب VAT Receivable
- إضافة حساب في الشجرة (مثلاً 1135 أو تحت Current Assets).
- ربطه بـ TaxTemplateItem للمشتريات عند isDeductible=true.

---

## 8️⃣ Credit Note / Return Tax

### عند إرجاع فاتورة أو Credit Note
- عكس الإيراد: DR Revenue، CR Receivable.
- **عكس الضريبة:** DR VAT Payable (تقليل التزام)، CR Receivable.
- إنشاء GL عكسي بنفس الهيكل.
- تحديث VAT Ledger ليعكس الانخفاض.

### تنفيذ
- Credit Note أو Sale Void يُستدعى فيه getSaleGLMap بقيم سالبة أو عكسية.
- أو استخدام glEngine.reverse() الذي يبدّل debit/credit تلقائياً.
- التأكد من أن الضريبة مشمولة في القيد الأصلي؛ فالعكس يشملها.

### عند Void Sale
- createSaleVoidJournalEntry حالياً يعكس totalAmount.
- بعد تطبيق Tax Engine: يجب أن يعكس netTotal + totalTaxAmount منفصلين.
- أو الاعتماد على glEngine.reverse('sale', id) الذي يعكس كل الأسطر.

---

## 9️⃣ Multi-Tax Support

### ضرائب متعددة
- VAT 15%
- Municipality Tax
- Service Tax
- Environmental Fee
- إلخ.

### ترتيب التنفيذ
- حسب displayOrder في TaxTemplateItem.
- الأول: On Net Total.
- الثاني: On Previous Row Amount أو On Previous Row Total.
- الثالث: Actual أو On Net Total (لضريبة إضافية).

### حساب على net أو على tax سابق
- On Net Total: دائماً على صافي المبلغ.
- On Previous Row: على الضريبة السابقة أو المجموع التراكمي.
- Actual: مبلغ ثابت لا يعتمد على الحساب.

### كيف نخزن التفاصيل
- SaleTaxBreakdown / PurchaseTaxBreakdown (إن وُجد).
- أو الاعتماد على GL — كل قيد ضريبة له حساب وصف.
- VAT Report يجمع من GL حسب account.

---

## 🔟 VAT Reporting Engine

### generateVATReport(startDate, endDate, companyId?)

```typescript
interface VATReport {
  outputVat: number;      // من المبيعات (Credit في VAT Payable)
  inputVat: number;      // من المشتريات (Debit في VAT Receivable)
  netVatPayable: number; // outputVat - inputVat
  byAccount: { accountId: number; accountCode: string; output: number; input: number }[];
  byRate: { rate: number; output: number; input: number }[];
}
```

### الاعتماد على GL أو Tax Ledger
- استعلام على JournalEntryLine حيث accountId في قائمة حسابات الضريبة.
- `SUM(Credit) - SUM(Debit)` للحساب = صافي الالتزام.
- تجميع حسب الحساب والنسبة (من الـ description أو من جدول مرجعي).

### لا الاعتماد على Sale.taxAmount
- التقرير يُبنى من القيود فقط.
- يضمن اتساقاً مع الدفاتر وقابلية التدقيق.

### مثال استعلام

```sql
SELECT a.id, a.code, a.name,
  SUM(CASE WHEN jel.debit_amount > 0 THEN jel.debit_amount ELSE 0 END) - 
  SUM(CASE WHEN jel.credit_amount > 0 THEN jel.credit_amount ELSE 0 END) AS net_balance
FROM journal_entry_lines jel
JOIN accounts a ON a.id = jel.account_id
JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE a.account_type IN ('Tax', 'Tax Receivable')
  AND je.entry_date BETWEEN :start AND :end
  AND je.is_reversed = 0
GROUP BY a.id;
```

---

## 1️⃣1️⃣ Backend Guards

| Guard | المنطق |
|-------|--------|
| **RequireTaxTemplateIfVATEnabled** | إذا Company.vatEnabled أو SystemSetting TaxEnabled: منع Submit بدون taxTemplateId (أو قالب افتراضي). |
| **PreventDeleteUsedTaxTemplate** | عدم حذف TaxTemplate إن وُجدت فواتير تستخدمه. |
| **PreventModifyTaxRateAfterUse** | عدم تعديل rate في TaxTemplateItem إن وُجدت فواتير مرحّلة به. أو السماح مع تحذير. |
| **PeriodLockGuard** | منع الترحيل في فترة مغلقة (من Blueprint 03). |

---

## 1️⃣2️⃣ Frontend Refactor

### 1. Invoice Screen (Sale / POS)
- **اختيار Tax Template:** قائمة منسدلة أو اختيار افتراضي من إعدادات الفرع.
- **عرض Net Total:** قبل الضريبة.
- **عرض Tax Breakdown:** جدول يوضح كل ضريبة ومبلغها.
- **عرض Grand Total:** netTotal + totalTaxAmount.
- **عرض حساب الضريبة:** اسم الحساب أو رمزه بجانب كل صف ضريبة.
- عند تغيير البنود أو الخصم: إعادة حساب الضريبة تلقائياً.

### 2. Purchase Screen
- نفس المنطق.
- **دعم VAT Receivable:** عرض Input VAT بشكل منفصل.
- اختيار قالب ضرائب للمشتريات.

### 3. Tax Template UI
- صفحة جديدة: `/settings/tax-templates` أو ضمن الإعدادات.
- **إنشاء قالب ضريبة:** اسم، نوع (مبيعات/مشتريات)، الشركة.
- **إضافة عدة tax rows:** حساب، نسبة، نوع الحساب (On Net Total، إلخ)، ترتيب.
- **تحديد row_id** عند اختيار On Previous Row.

### 4. VAT Report Screen
- صفحة `/reports/vat` أو تبويب ضمن Reports.
- **تحديد فترة:** startDate، endDate.
- **عرض Summary:** Output VAT، Input VAT، Net Payable.
- **عرض Drilldown:** تفصيل حسب الحساب، حسب الفاتورة.
- **Export Excel/PDF.**

### مكونات مقترحة

```tsx
// TaxTemplateSelector.tsx - اختيار قالب الضريبة
// TaxBreakdownTable.tsx - عرض تفصيل الضرائب
// VATReportFilters.tsx - فلتر الفترة والشركة
// VATReportSummary.tsx - ملخص التقرير
```

### مسارات الصفحات
- `/settings/tax-templates` — إدارة قوالب الضرائب.
- `/reports/vat` — تقرير VAT.
- تحديث `Sales.tsx`, `POS.tsx`, `Purchasing.tsx`, `PurchaseProfile.tsx` لعرض الضرائب والتفصيل.

---

## 1️⃣3️⃣ Data Migration Strategy

1. **إضافة VAT Payable Account:** التأكد من وجود حساب 2120 أو 2200 ومطابقته في ACCOUNT_CODES.
2. **تحويل الفواتير الحالية:** اعتبارها Net-only — netTotal = totalAmount، totalTaxAmount = 0.
3. **تفعيل VAT على الشركات الجديدة فقط:** Feature flag أو إعداد على مستوى الشركة/الفرع.
4. **Feature Flag:** `tax_engine_enabled` في SystemSetting — عند false: السلوك الحالي (بدون ضريبة). عند true: إلزام القالب وإنشاء قيود ضريبية.

### Migration Script للفواتير الحالية

```sql
UPDATE sales SET
  net_total = total_amount,
  total_tax_amount = 0,
  grand_total = total_amount
WHERE net_total IS NULL;
```

---

## 1️⃣4️⃣ Testing Strategy

| الاختبار | المطلوب |
|----------|---------|
| Single tax | قالب ضريبة واحدة 15% — التحقق من الحساب والقيود. |
| Multi tax | قالب بضريبتين — التحقق من المجاميع. |
| Compounded tax | On Previous Row — التحقق من التسلسل. |
| Purchase VAT | التحقق من DR VAT Receivable. |
| Credit note reverses tax | إلغاء/Credit Note — التحقق من عكس الضريبة. |
| VAT report accuracy | مطابقة التقرير مع المجاميع اليدوية. |
| 1000 invoice stress test | أداء مقبول عند آلاف الفواتير. |

---

## 1️⃣5️⃣ Compliance Readiness

بعد التنفيذ يجب أن يكون النظام:
- **جاهز لضريبة القيمة المضافة** — فصل الإيراد عن الضريبة.
- **يدعم Multiple Rates** — من خلال TaxTemplateItem.
- **يدعم VAT Return** — Credit Note يعكس الضريبة.
- **قابل للتدقيق** — التقارير من GL.
- **يمنع تسجيل إيراد شامل الضريبة** — Revenue = netTotal فقط.

---

# النتيجة المتوقعة

بعد تنفيذ هذا الملف:
- الإيراد يصبح **صافي**.
- VAT يُسجّل في **حساب منفصل** (VAT Payable / VAT Receivable).
- يدعم **Multi-Tax** وقوالب ضرائب.
- يدعم **Credit Note** مع عكس الضريبة.
- يمكن إصدار **تقرير VAT رسمي** من الدفاتر.
- يصبح النظام **جاهز لبيئة ضريبية حقيقية** وقابل للتدقيق.

---

**لا انتقال للمحور السادس.** هذا الملف يختص بمحرك الضرائب فقط.
