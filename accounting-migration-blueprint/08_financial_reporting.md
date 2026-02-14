# 08 — Financial Reporting (GL-Based)

**Migration Blueprint — Phase 8**  
**Target:** Rebuild all financial reports to depend exclusively on General Ledger (JournalEntry / GL Entry), eliminating operational table dependencies and achieving IFRS/Audit-Ready compliance.

> **Prerequisites:** Phase 01 (Chart of Accounts), Phase 02 (GL Engine), Phase 03 (Posting Workflow), Phase 07 (Accounting Periods) must be applied. This blueprint assumes `periodId`, `fiscalYearId`, `isPosted` exist on JournalEntry, and `accountType`, `reportType`, `rootType` exist on Account.

---

## 1️⃣ Problem Statement

### لماذا الاعتماد على الجداول التشغيلية خطأ للمحاسبة الدقيقة

#### التضارب بين مصادر البيانات
- **P&L الحالي** يعتمد على جداول `Sale`, `Purchase`, `Expense` مباشرة — يجمّع `_sum` من هذه الجداول.
- القيود المحاسبية (JournalEntry + JournalEntryLine) تُنشأ من نفس العمليات، لكن قد تكون:
  - **غير متزامنة:** Sale مُرحّل لكن JournalEntry لم يُنشأ بسبب خطأ أو تأخير.
  - **مختلفة:** تعديل يدوي في القيد، إلغاء دون عكس، round-off مختلف، أو خطأ في GL mapping.
  - **مكررة/ناقصة:** قيد مكرر أو ناقص نتيجة bug في الترحيل التلقائي.
- النتيجة: **التقرير التشغيلي ≠ التقرير المحاسبي.** المراجع والجهات الرقابية تعتمد على الدفتر المحاسبي فقط.

#### مخاطر وجود تقارير غير متوافقة مع القيود الرسمية
- **عدم الاعتماد:** الجهات الضريبية والتداول تعتمد على القيود المرحّلة الرسمية.
- **فشل التدقيق:** المراجع الخارجي يرفض تقارير مبنية على جداول تشغيلية.
- **مخاطر الاحتيال:** إمكانية عرض أرقام "جميلة" من جداول مختلفة عن الدفتر الفعلي.
- **IFRS/ISA:** المعايير الدولية تتطلب أن تكون القوائم المالية معزولة من الدفتر العام (General Ledger).

#### أهمية توحيد كل التقارير على GL Entry
- **مصدر واحد للحقيقة (Single Source of Truth):** General Ledger هو السجل الرسمي والنهائي.
- **اتساق تلقائي:** أي تعديل في القيد ينعكس فوراً على جميع التقارير.
- **Drilldown ممكن:** من التقرير إلى القيد الفعلي بدون تعارض.
- **Audit trail:** كل رقم له مسار واضح من القيد إلى التقرير.

#### الحاجة لربط التقارير بالفترات المحاسبية و Fiscal Year
- **Period Lock:** التقارير للفترات المغلقة يجب أن تكون ثابتة وغير قابلة للتعديل.
- **مقارنات الفترات:** P&L للشهر الحالي vs الشهر السابق يتطلب فلترة بـ periodId.
- **Year-End:** Balance Sheet و P&L في نهاية السنة يُبنى على fiscalYearId.
- **إغلاق السنة:** ترحيل P&L إلى Retained Earnings يعتمد على نفس القيود التي تُعرض في التقارير.

---

## 2️⃣ ERPNext Reporting Architecture (Target Model)

### 2.1 General Ledger

- **كل القيود المحاسبية موجودة هنا:** JournalEntry (isPosted=true) + JournalEntryLine.
- **تقارير Trial Balance و Ledger** تُبنى مباشرة على هذا المصدر.
- لا أي اعتماد على جداول Sales, Purchases, Expenses, Payments للتقارير المالية الرسمية.
- القيود المرحّلة فقط (isPosted) تُدرج في التقارير.

### 2.2 Trial Balance

- **حساب الرصيد لكل حساب حتى تاريخ محدد (asOfDate).**
- يعتمد على **JournalEntry.isPosted = true** و **JournalEntry.periodId** (اختياريًا للفلترة).
- الصيغة: لكل accountId: `SUM(debit) - SUM(credit)` حيث entryDate <= asOfDate.
- يعرض: accountCode, accountName, debit, credit, balance (Debit أو Credit حسب الطبيعة).

### 2.3 Profit & Loss Statement

- **مبني على القيود المرتبطة بحسابات Revenue و Expense فقط.**
- لا يعتمد على جداول تشغيلية (Sale, Expense).
- تصفية حسب **Account.reportType = 'Profit and Loss'** أو **Account.rootType IN ('Income', 'Expense')**.
- تجميع حسب نوع الحساب: Revenues, COGS, Gross Profit, Operating Expenses, Net Profit.
- دعم الفترات: فلترة بـ periodId أو fiscalYearId أو date range.

### 2.4 Balance Sheet

- **مبني على القيود المرتبطة بحسابات Asset, Liability, Equity.**
- يعكس الوضع المالي الفعلي حتى التاريخ المحدد (asOfDate).
- المعادلة المحاسبية: **Assets = Liabilities + Equity**.
- تصفية حسب **Account.reportType = 'Balance Sheet'** أو **Account.rootType IN ('Asset', 'Liability', 'Equity')**.

### 2.5 Cash Flow Statement

- **مبني على القيود النقدية فقط (Cash/Bank GL Accounts).**
- يعكس التدفقات النقدية:
  - **Operating:** من العمليات التشغيلية (من حسابات P&L + التغيير في Working Capital).
  - **Investing:** شراء/بيع أصول ثابتة، استثمارات.
  - **Financing:** قروض، توزيع أرباح، حقوق ملكية.
- يعتمد على **Account.accountType IN ('Cash', 'Bank')** أو تصنيف خاص للتدفقات.
- الطريقة المباشرة أو غير المباشرة حسب متطلبات IFRS.

---

## 3️⃣ Target Architecture داخل نظامنا

### هيكل المجلدات

```
src/reporting/
├── trial-balance.service.ts
├── profit-loss.service.ts
├── balance-sheet.service.ts
├── cash-flow.service.ts
├── general-ledger.service.ts
├── reporting.module.ts
└── types/
    └── reporting.types.ts
```

### دور كل Service

| الخدمة | الدور |
|--------|-------|
| **TrialBalanceService** | جمع الأرصدة لكل حساب من JournalEntryLine حيث isPosted=true و entryDate<=asOfDate. فلترة اختيارية بـ periodId أو fiscalYearId. إرجاع قائمة { accountCode, accountName, debit, credit, balance }. |
| **ProfitLossService** | حساب الإيرادات والمصروفات من GL فقط. فلترة حسب rootType IN ('Income','Expense') أو reportType='Profit and Loss'. تجميع: Revenue, COGS, Gross Profit, Expenses, Net Profit. دعم مقارنة الفترات. |
| **BalanceSheetService** | Assets = Liabilities + Equity من GL. فلترة حسب rootType IN ('Asset','Liability','Equity'). حساب أرصدة حتى asOfDate. تجميع حسب التصنيف. |
| **CashFlowService** | حساب تدفقات النقدية من حسابات Cash/Bank فقط. تصنيف التدفقات: Operating / Investing / Financing. يعتمد على GL entries المرتبطة بحسابات accountType IN ('Cash','Bank'). |
| **GeneralLedgerService** | توفير ledger مفصل لكل حساب: قائمة JournalEntryLine مع running balance. فلترة بـ accountId, startDate, endDate, periodId. Drilldown لكل قيد مع voucherType و voucherId. |

### تدفق البيانات

```
JournalEntry (isPosted=true, periodId, fiscalYearId)
    + JournalEntryLine (accountId, debitAmount, creditAmount)
    + Account (rootType, reportType, accountType)
        ↓
    TrialBalanceService  → أرصدة حسب الحساب
    ProfitLossService   → إيرادات ومصروفات
    BalanceSheetService → أصول وخصوم وحقوق ملكية
    CashFlowService     → تدفقات نقدية
    GeneralLedgerService → دفتر تفصيلي لكل حساب
```

### واجهات مخرجات التقارير

```typescript
// reporting.types.ts

export interface TrialBalanceRow {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;  // مدين موجب، دائن سالب
}

export interface TrialBalanceResult {
  asOfDate: Date;
  periodId?: number;
  fiscalYearId?: number;
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
}

export interface ProfitLossSection {
  name: string;
  nameAr: string;
  accounts: { accountCode: string; accountName: string; amount: number }[];
  total: number;
}

export interface ProfitLossResult {
  startDate: Date;
  endDate: Date;
  periodId?: number;
  fiscalYearId?: number;
  revenue: ProfitLossSection;
  costOfGoodsSold: ProfitLossSection;
  grossProfit: number;
  operatingExpenses: ProfitLossSection;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}

export interface BalanceSheetSection {
  rootType: 'Asset' | 'Liability' | 'Equity';
  accounts: { accountCode: string; accountName: string; balance: number }[];
  total: number;
}

export interface BalanceSheetResult {
  asOfDate: Date;
  periodId?: number;
  fiscalYearId?: number;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
}

export interface CashFlowSection {
  category: 'Operating' | 'Investing' | 'Financing';
  items: { description: string; amount: number }[];
  total: number;
}

export interface CashFlowResult {
  startDate: Date;
  endDate: Date;
  openingCash: number;
  closingCash: number;
  sections: CashFlowSection[];
  netChange: number;
}

export interface LedgerEntry {
  date: Date;
  entryNumber: string;
  voucherType: string;
  voucherId?: number;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  journalEntryId: number;
}
```

---

## 4️⃣ Database Changes

### لا تغييرات كبيرة في الهيكل

كل شيء يعتمد على **JournalEntry** و **JournalEntryLine** و **Account** الموجودين. الشروط:

1. **JournalEntry** يجب أن يحتوي:
   - `isPosted` (موجود)
   - `periodId` (من Blueprint 07)
   - `fiscalYearId` (من Blueprint 07)
   - `entryDate`

2. **JournalEntryLine** يجب أن يحتوي:
   - `accountId` (من Blueprint 01)
   - `debitAmount`, `creditAmount`
   - مرتبط بـ JournalEntry

3. **Account** يجب أن يحتوي:
   - `rootType` (Asset, Liability, Equity, Income, Expense)
   - `reportType` (Balance Sheet, Profit and Loss)
   - `accountType` (Cash, Bank, Receivable, Expense Account, Income Account, ...)

### Migration للتأكد من ربط القيود

```sql
-- التأكد من أن كل JournalEntry المرحّل له periodId و fiscalYearId
-- يتم عبر script migration (انظر القسم 7)
```

### Indexes للتقرير السريع

```sql
-- إن لم تكن موجودة
CREATE INDEX IF NOT EXISTS idx_je_posted_date ON journal_entries(is_posted, entry_date);
CREATE INDEX IF NOT EXISTS idx_je_period_fiscal ON journal_entries(period_id, fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_jel_account_je ON journal_entry_lines(account_id, journal_entry_id);
```

---

## 5️⃣ Backend Guards

| Guard | المنطق |
|-------|--------|
| **PostedOnlyGuard** | تجاهل القيود غير المنشورة (`isPosted=false`) عند بناء أي تقرير مالي. فقط القيود المرحّلة تدخل في الأرصدة. |
| **PeriodValidationGuard** | التحقق من الفترة المحاسبية: عند طلب تقرير بـ periodId، التأكد من أن القيود المُدرجة تنتمي لهذه الفترة. القيود بدون periodId (قديمة قبل Migration) تُعرض مع تحذير. |
| **ReadOnlyDuringReportGuard** | (اختياري) منع تعديل أو حذف JournalEntry أثناء تشغيل تقرير ثقيل — أو استخدام snapshot/transaction isolation level مناسب. |
| **FreezingDateGuard** | (من Blueprint 03) عند تعديل قيد: التحقق من أن entryDate لا يسبق freezing_date. التقارير نفسها لا تمنع، لكن البيانات المعروضة تتأثر بالإغلاق. |

### تنفيذ PostedOnlyGuard

```typescript
// في كل reporting service
const where = {
  journalEntry: {
    isPosted: true,
    ...(asOfDate && { entryDate: { lte: new Date(asOfDate) } }),
    ...(periodId && { periodId }),
    ...(fiscalYearId && { fiscalYearId }),
  },
};
```

### تنفيذ فلترة isPosted

```typescript
// trial-balance.service.ts (مثال)
async getTrialBalance(asOfDate?: Date, periodId?: number, fiscalYearId?: number) {
  const jeWhere: any = { isPosted: true };
  if (asOfDate) jeWhere.entryDate = { lte: asOfDate };
  if (periodId) jeWhere.periodId = periodId;
  if (fiscalYearId) jeWhere.fiscalYearId = fiscalYearId;

  const grouped = await this.prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: { journalEntry: jeWhere },
    _sum: { debitAmount: true, creditAmount: true },
  });
  // ... باقي المنطق
}
```

### تنفيذ أساسي للخدمات

```typescript
// profit-loss.service.ts - الاعتماد على rootType فقط
async getProfitLoss(startDate: Date, endDate: Date, periodId?: number) {
  const jeWhere: any = {
    isPosted: true,
    entryDate: { gte: startDate, lte: endDate },
  };
  if (periodId) jeWhere.periodId = periodId;

  const lines = await this.prisma.journalEntryLine.findMany({
    where: { journalEntry: jeWhere },
    include: { account: true },
  });

  const incomeAccounts = lines.filter(l => l.account.rootType === 'Income');
  const expenseAccounts = lines.filter(l => l.account.rootType === 'Expense');
  const revenue = this.sumCreditsMinusDebits(incomeAccounts);
  const expenses = this.sumDebitsMinusCredits(expenseAccounts);
  return { revenue, expenses, netProfit: revenue - expenses, /* ... */ };
}

// balance-sheet.service.ts - نفس المنطق مع rootType Asset/Liability/Equity
async getBalanceSheet(asOfDate: Date) {
  const jeWhere = { isPosted: true, entryDate: { lte: asOfDate } };
  const grouped = await this.prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: { journalEntry: jeWhere },
    _sum: { debitAmount: true, creditAmount: true },
  });
  const accounts = await this.loadAccountsWithRootType(grouped.map(g => g.accountId));
  const assets = grouped.filter(g => accounts.get(g.accountId)?.rootType === 'Asset');
  const liabilities = grouped.filter(g => accounts.get(g.accountId)?.rootType === 'Liability');
  const equity = grouped.filter(g => accounts.get(g.accountId)?.rootType === 'Equity');
  return { assets: this.calcSection(assets), liabilities: this.calcSection(liabilities), /* ... */ };
}
```

> **ملاحظة:** الإصدار الحالي `getTrialBalance` يستخدم `accountCode` (من schema قديم). بعد تطبيق Blueprint 01 ينتقل إلى `accountId` مع join على Account.

### API Endpoints المقترحة

| Method | Endpoint | الوصف |
|--------|----------|-------|
| GET | `/reporting/trial-balance?asOfDate=&periodId=&fiscalYearId=` | Trial Balance |
| GET | `/reporting/profit-loss?startDate=&endDate=&periodId=` | P&L من GL |
| GET | `/reporting/balance-sheet?asOfDate=&periodId=` | Balance Sheet |
| GET | `/reporting/cash-flow?startDate=&endDate=` | Cash Flow |
| GET | `/reporting/ledger/:accountCode?startDate=&endDate=` | General Ledger لحساب |
| GET | `/reporting/drilldown/:reportType/:accountId?params` | Drilldown للقيود |

**إهمال:** `GET /reports/profit-loss` القديم (المبني على Sale/Expense) يُستبدل أو يُحوّل داخلياً لاستدعاء `ProfitLossService` — مع feature flag للانتقال التدريجي.

---

## 6️⃣ Frontend Refactor

### 1. Reports Dashboard (`/reports` أو `/reports/financial`)

- **قائمة بجميع التقارير المالية:**
  - Trial Balance
  - Profit & Loss
  - Balance Sheet
  - Cash Flow
  - General Ledger
- **إمكانية اختيار Fiscal Year و Accounting Period:**
  - Dropdown للسنوات المالية
  - Dropdown للفترات (شهرية/ربع سنوية) حسب السنة المختارة
  - خيار "حتى تاريخ" (asOfDate) للـ Trial Balance و Balance Sheet
- **عرض ملخص سريع:** بطاقات تعرض آخر أرصدة أو صافي الربح من آخر فترة.

### 2. Trial Balance Screen (`/reports/trial-balance`)

- **عرض حسابات مع Debit / Credit** حتى تاريخ محدد.
- أعمدة: Account Code | Account Name | Debit | Credit | Balance.
- إجمالي المدين = إجمالي الدائن (التحقق من التوازن).
- **Drilldown:** زر بجانب كل حساب → يفتح General Ledger لهذا الحساب في نفس الفترة.
- ربط كل بند بـ Journal Entry: عند النقر → navigate to `/accounting/entries/{id}`.

### 3. Profit & Loss Screen (`/reports/profit-loss`)

- **عرض Revenues / Expenses** حسب الفترات.
- أقسام: Revenue → COGS → Gross Profit → Operating Expenses → Net Profit.
- **مقارنات:**
  - اختيار فترة واحدة أو مقارنة بين فترتين (مثلاً شهر حالي vs شهر سابق).
  - اختيار سنة مالية ومقارنة مع السنة السابقة.
- **Drilldown:** النقر على أي مبلغ → قائمة JournalEntryLine التي ساهمت في هذا الرقم مع روابط للقيود.
- **هامش الربح:** Gross Margin %, Net Margin % محسوبان من GL.

### 4. Balance Sheet Screen (`/reports/balance-sheet`)

- **عرض الأصول والخصوم وحقوق الملكية** حتى تاريخ محدد.
- قسم Assets (مدين)، قسم Liabilities + Equity (دائن).
- التحقق: Total Assets = Total Liabilities + Equity.
- **تحديث تلقائي:** عند ترحيل قيود جديدة، إعادة جلب التقرير يعكس التغيير.
- **Drilldown:** لكل حساب → General Ledger حتى asOfDate.

### 5. Cash Flow Screen (`/reports/cash-flow`)

- **عرض التدفقات النقدية:** Operating, Investing, Financing.
- Opening Cash Balance → + Net Operating → + Net Investing → + Net Financing → = Closing Cash Balance.
- **ربط مع Bank/Cash GL Accounts:** التدفقات تُستمد من حركات هذه الحسابات فقط.
- **Drilldown:** لكل حركة → Journal Entry المرتبط.

### 6. General Ledger Screen (تفصيلي لكل حساب)

- **معلمات:** accountCode أو accountId، startDate، endDate، periodId.
- **عرض:** قائمة الحركات مع Running Balance.
- روابط لكل قيد: voucherType + voucherNumber.
- تصدير Excel/PDF.

### مكونات مقترحة

```tsx
// ReportsDashboard.tsx         - الصفحة الرئيسية للتقارير
// ReportPeriodSelector.tsx    - اختيار السنة والفترة
// TrialBalanceTable.tsx       - جدول Trial Balance
// ProfitLossReport.tsx        - تقرير P&L
// BalanceSheetReport.tsx      - تقرير الميزانية
// CashFlowReport.tsx          - تقرير التدفقات
// GeneralLedgerDetail.tsx     - دفتر حساب مفصل
// ReportDrilldownModal.tsx    - نافذة Drilldown للقيود
```

---

## 7️⃣ Data Migration Strategy

### 1. ربط القيود السابقة بحسابات صحيحة

- التأكد من أن كل JournalEntryLine مرتبط بـ accountId صحيح.
- التأكد من أن كل Account له `rootType`, `reportType`, `accountType` محدّد.
- Migration script: تحديث الحسابات الناقصة من Chart of Accounts الافتراضي.

### 2. ترحيل بيانات تشغيلية قديمة إلى GL

- إذا وُجدت جداول Sale, Purchase, Expense بقيود غير منشأة:
  - تشغيل script يمرّ على المعاملات غير المرحّلة.
  - إنشاء JournalEntry لكل معاملة (أو تجميع حسب اليوم) وترحيلها.
  - أو: قبول الفجوة وتسجيلها كـ "ما قبل Migration" مع إغلاق السنة السابقة برصيد افتتاحي.

### 3. إضافة accountType لكل حساب

```sql
-- تحديث حساب حسب التصنيف
UPDATE accounts SET account_type = 'Income Account', root_type = 'Income', report_type = 'Profit and Loss'
WHERE code LIKE '4%';
UPDATE accounts SET account_type = 'Expense Account', root_type = 'Expense', report_type = 'Profit and Loss'
WHERE code LIKE '5%';
-- ... إلخ حسب دليل الحسابات
```

### 4. ربط periodId و fiscalYearId للقيود القديمة

- استدعاء نفس المنطق في Blueprint 07: `migrateToFiscalPeriods()`.
- كل JournalEntry يرتبط بـ AccountingPeriod حسب entryDate.

---

## 8️⃣ Testing Strategy

| الاختبار | المطلوب |
|----------|---------|
| **P&L vs GL Consistency** | مقارنة P&L المبني من GL مع مجموع حركات حسابات Income/Expense. يجب التطابق. |
| **P&L vs Operational (Pre-Migration)** | مقارنة P&L الحالي (من Sale/Expense) مع P&L الجديد (من GL) قبل الإلغاء — للتحقق من صحة الترحيل. |
| **Balance Sheet Equation** | توليد Balance Sheet → التحقق من Assets = Liabilities + Equity. |
| **Cash Flow Reconciliation** | توليد Cash Flow → Opening + Net Change = Closing. ومقارنة Closing مع رصيد حسابات Cash/Bank من Trial Balance. |
| **Drilldown Integrity** | من P&L أو Trial Balance: Drilldown لحساب معين → مجموع الحركات يجب أن يساوي الرصيد المعروض. |
| **Stress Test** | آلاف القيود في فترة واحدة — وقت استجابة التقرير < حد معقول (مثلاً 5 ثوانٍ). |
| **Period Filtering** | تقرير بـ periodId محدد — التحقق من أن النتائج فقط من القيود في هذه الفترة. |
| **Posted Only** | إضافة قيد غير مرحّل (isPosted=false) — التحقق من عدم ظهوره في أي تقرير. |
| **Fiscal Year Closure** | بعد Year-End Closing — التحقق من أن P&L يظهر صافي الربح المحمّل إلى Retained Earnings. |

### أمثلة Unit Tests

```typescript
describe('TrialBalanceService', () => {
  it('should exclude unposted entries', async () => {
    // create JE with isPosted=false
    const tb = await service.getTrialBalance(asOfDate);
    expect(tb.rows.find(r => r.accountCode === '1110')?.balance).not.toContain(unpostedAmount);
  });

  it('should filter by periodId', async () => {
    const tb = await service.getTrialBalance(asOfDate, periodId);
    // جميع القيود المُدرجة من هذه الفترة فقط
  });

  it('total debit should equal total credit', async () => {
    const tb = await service.getTrialBalance(asOfDate);
    expect(tb.totalDebit).toBe(tb.totalCredit);
  });
});

describe('ProfitLossService', () => {
  it('should use only GL entries', async () => {
    // لا استعلام لـ Sale أو Expense
    const pl = await service.getProfitLoss(params);
    // النتيجة من JournalEntryLine فقط
  });
});
```

---

# النتيجة المتوقعة

بعد تنفيذ هذا الملف:

- كل التقارير المالية تعتمد على **GL Entry فقط** — لا Sale, Expense, Purchase للتقارير الرسمية.
- **P&L, Balance Sheet, Cash Flow** جاهزة ومتوافقة مع منطق ERPNext ومعايير IFRS.
- **Drilldown كامل** من التقرير إلى القيد الفعلي.
- متوافق مع **Fiscal Year / Accounting Period** — فلترة دقيقة حسب الفترة.
- النظام **Audit-Ready** — مصدر واحد للحقيقة، قيود مرقّمة، فترات مغلقة.
- إلغاء اعتماد frontend على `/reports/profit-loss` القديم المبني على جداول تشغيلية.
- Reports Dashboard موحّد مع اختيار السنة والفترة.

---

**الانتقال للمحور التاسع:** Fixed Assets (الأصول الثابتة) — نفس مستوى التفصيل والربط مع GL.
