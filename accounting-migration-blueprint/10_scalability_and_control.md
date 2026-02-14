# 10 — Scalability & Control (Auditability)

**Migration Blueprint — Phase 10**  
**Target:** Achieve ERPNext-level scalability and audit control through traceability, data integrity, concurrency control, multi-company, and multi-currency support.

> **Prerequisites:** Phases 01–09 must be applied. This blueprint assumes GL Engine, Posting Workflow, Event-Driven Architecture, Accounting Periods, and Financial Reporting are in place.

---

## 1️⃣ Problem Statement

### الحاجة إلى Auditability تفصيلية لكل قيود JournalEntry

- **AuditLog الحالي** عام: `entity_type`, `entity_id`, `action`, `changes` — لا تتبع محاسبي مفصل.
- لا ربط صريح بين Audit Entry و `periodId`, `fiscalYearId`, `voucherType`, `voucherId`.
- المراجع يحتاج: من عدّل القيد؟ متى؟ ما القيم قبل وبعد؟ في أي فترة؟
- **تقارير مقارنة:** Stock vs GL، P&L vs GL — لا آلية موحدة للمقارنة والتدقيق.
- لا Voucher-level audit: تتبع كامل من المستند إلى القيد والعكس.

### أهمية Data Integrity عند إلغاء دفعات أو تعديل مستندات

- **voidPayment بدون عكس محاسبي** (العيب الحرج من Blueprint 03): الدفعة تُلغى لكن القيد الأصلي يبقى.
- النتيجة: رصيد الدفتر ≠ رصيد التشغيل (Cash، AR، AP).
- **تعديل مستند مُرحّل:** لا حماية — يمكن تغيير بيانات بعد الترحيل مما يخلق تضارباً.
- **حذف قيود:** لا آلية آمنة — الحذف المباشر يفسد التوازن والأرصدة.
- **IFRS/ISA:** المعايير تتطلب أن أي إلغاء أو تعديل مالي يُسجّل ويعكس بشكل صريح.

### مشاكل Concurrency عند معالجة مستندات متزامنة

- **لا Locks واضحة:** عمليتان تطلقان قيوداً لنفس الفترة في نفس اللحظة — احتمال double posting أو تضارب.
- **تعديل قيد أثناء إغلاق الفترة:** عملية تغلق الفترة بينما أخرى تحاول التعديل.
- **Payment processing:** دفعتان تُسجّلان لفاتورة واحدة — احتمال تخصيص زائد.
- **Race Conditions:** عدم تنفيذ العمليات الحساسة بشكل متسلسل أو محمي.

### أهمية دعم Multi-Company و Multi-Currency في نظام ERP قابل للتوسع

- **Multi-Company:** المجموعات والشركات التابعة تحتاج GL منفصل، فترات مستقلة، تقارير موحدة أو منفصلة.
- **Multi-Currency:** معاملات بعملات مختلفة، FX rates، فروق صرف، تقارير بعملة واحدة.
- **التوسع:** نظام أحادي الشركة/العملة يحدّ النمو — التصميم المبكر يوفر تكلفة إعادة الهيكلة لاحقاً.

---

## 2️⃣ ERPNext Target Model

| المعيار | الملاحظات |
|---------|-----------|
| **Auditability** | تقارير كاملة، مقارنة Stock vs GL، Voucher-level audit، تتبع كل تعديل/إلغاء مع user و timestamp و old/new values. |
| **Traceability** | كل قيد مرتبط بـ voucher_type، voucher_no، against_voucher، لا قيد بدون مصدر. |
| **Data Integrity** | إلغاء كامل مع إنشاء قيود عكسية. لا void بدون reverse GL. لا تعديل قيد مباشر — عكس وإعادة فقط. |
| **Concurrency** | Locks على Periods، منع تعديل القيود أثناء الإغلاق، تنفيذ متسلسل لعمليات حساسة. |
| **Multi-Company** | كل شركة لها GL مستقل، Accounts، Periods، Fiscal Years منفصلة. Intercompany entries للترحيل بين الشركات. |
| **Multi-Currency** | دعم العملات، FX rates، minor units، حساب فروق الصرف تلقائياً، تقارير بعملة التقرير. |

---

## 3️⃣ Target Architecture داخل نظامنا

### هيكل المجلدات

```
src/accounting/
├── audit/
│   ├── audit.service.ts           # تسجيل وتتبع كل العمليات المحاسبية
│   ├── accounting-audit.service.ts # تمديد للعمليات المالية
│   └── types/
│       └── audit.types.ts
├── concurrency/
│   ├── concurrency-lock.service.ts # Locks على Periods و JournalEntry
│   └── types/
│       └── lock.types.ts
├── multi-company/
│   ├── multi-company.service.ts    # فصل GL حسب الشركة
│   └── company-context.service.ts # سياق الشركة الحالية
├── multi-currency/
│   ├── multi-currency.service.ts  # FX، تحويل العملات، فروق الصرف
│   └── currency-conversion.service.ts
├── gl-engine/                     # من Blueprint 02
├── ... (بقية المحاسبة)
```

### دور كل Service

| الخدمة | الدور |
|--------|-------|
| **audit.service.ts** | تسجيل كل عملية على القيود: إنشاء، تعديل، إلغاء، عكس. ربط بـ documentType، documentId، periodId، fiscalYearId. توفير واجهات للاستعلام والتصفية. |
| **accounting-audit.service.ts** | تمديد مخصص للمحاسبة: `logGLPost(document, je)`, `logGLReverse(document, reversalJe)`, `logDocumentCancel(document)`. إنشاء تقارير مقارنة (Stock vs GL). |
| **concurrency-lock.service.ts** | ضمان أن نفس Period أو JournalEntry لا يمكن تعديلها من عمليتين متزامنتين. `acquirePeriodLock(periodId)`, `acquireEntryLock(jeId)`, `releaseLock()`. منع double posting. |
| **multi-company.service.ts** | دعم القيود لكل شركة. كل JournalEntry و Account مرتبط بـ companyId. الفصل الكامل بين الشركات. تقارير موحدة عبر Intercompany. |
| **multi-currency.service.ts** | دعم العملات المختلفة. حساب minor units، FX rate، فروق الصرف. تحويل المبالغ عند الترحيل بعملة مختلفة عن عملة الحساب. |

---

## 4️⃣ Backend Guards

| Guard | المنطق |
|-------|--------|
| **PeriodLockGuard** | منع تعديل أو حذف قيود في فترة مغلقة. استدعاء `periodLockService.validatePostingAllowed()` قبل أي ترحيل أو عكس. |
| **ConcurrencyLockGuard** | منع تعديل قيود عند وجود Transaction Lock. عند بدء إغلاق الفترة أو تعديل قيد: acquire lock — العمليات المتزامنة تنتظر أو تُرفض. |
| **AuditLogGuard** | تسجيل كل الإلغاءات أو التعديلات في Audit Log. لا عملية مالية ناجحة بدون Audit Entry. |
| **DataIntegrityGuard** | التحقق من Data Integrity قبل أي ترحيل أو تحديث: توازن المدين والدائن، ربط voucher، صلاحية الحسابات. |
| **VoidRequiresReverseGuard** | `voidPayment` يُرفض إذا لم يُنفّذ عكس محاسبي. أو: voidPayment يطلق حدثاً → Handler ينشئ القيد العكسي تلقائياً (من Blueprint 09). |
| **CompanyScopeGuard** | كل استعلام GL يُفلتر بـ companyId من السياق. منع عرض أو تعديل قيود شركة أخرى. |

---

## 5️⃣ Audit Logging

### نموذج AuditEntry المحاسبي

```typescript
// audit.types.ts
export interface AccountingAuditEntry {
  id: number;
  userId: number;
  username: string;
  actionType: 'create' | 'update' | 'cancel' | 'void' | 'reverse' | 'post' | 'reopen';
  documentType: string;    // 'journal_entry' | 'sale' | 'purchase' | 'payment' | ...
  documentId: number;
  voucherType?: string;
  voucherId?: number;
  journalEntryId?: number;
  oldValues?: Record<string, unknown>;  // JSON
  newValues?: Record<string, unknown>;
  timestamp: Date;
  periodId?: number;
  fiscalYearId?: number;
  companyId?: number;
  branchId?: number;
  ipAddress?: string;
  reason?: string;  // للعمليات الملغاة
}
```

### جدول accounting_audit_entries (جديد)

```sql
CREATE TABLE accounting_audit_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  username TEXT NOT NULL,
  action_type TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_id INTEGER NOT NULL,
  voucher_type TEXT,
  voucher_id INTEGER,
  journal_entry_id INTEGER REFERENCES journal_entries(id),
  old_values TEXT,  -- JSON
  new_values TEXT, -- JSON
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  period_id INTEGER REFERENCES accounting_periods(id),
  fiscal_year_id INTEGER REFERENCES fiscal_years(id),
  company_id INTEGER REFERENCES companies(id),
  branch_id INTEGER REFERENCES branches(id),
  reason TEXT
);

CREATE INDEX idx_acc_audit_document ON accounting_audit_entries(document_type, document_id);
CREATE INDEX idx_acc_audit_timestamp ON accounting_audit_entries(timestamp DESC);
CREATE INDEX idx_acc_audit_period ON accounting_audit_entries(period_id);
CREATE INDEX idx_acc_audit_company ON accounting_audit_entries(company_id);
```

### العلاقة مع AuditLog العام

- **audit_logs** (الموجود): يسجل create/update/delete/void للكيانات العامة.
- **accounting_audit_entries** (الجديد): يسجل كل العمليات المحاسبية مع periodId، fiscalYearId، voucherType.
- يمكن دمج الاثنين لاحقاً عبر `entity_type = 'accounting_audit'` و `entity_id = accounting_audit_entry.id`، أو الإبقاء على جدول منفصل للتخصص والاستعلام السريع.

### تدفق التسجيل

```typescript
// عند إنشاء قيد
await this.accountingAuditService.logGLPost({
  documentType: 'sale',
  documentId: sale.id,
  journalEntryId: je.id,
  voucherType: 'sale',
  voucherId: sale.id,
  userId,
  periodId: je.periodId,
  fiscalYearId: je.fiscalYearId,
});

// عند العكس
await this.accountingAuditService.logGLReverse({
  documentType: 'payment',
  documentId: payment.id,
  originalJournalEntryId: originalJe.id,
  reversalJournalEntryId: reversalJe.id,
  userId,
  reason: 'void',
});
```

### تقارير مقارنة

- **Stock vs GL:** مقارنة أرصدة المخزون من `stock_ledger` مع رصيد حساب Inventory في GL.
- **Outstanding vs AR/AP:** مقارنة Outstanding من Payment Ledger مع رصيد حسابات الذمم.
- **Voucher-level audit:** من أي قيد → المستند المصدر، ومن أي مستند → كل القيود المرتبطة.

---

## 6️⃣ Concurrency Control

### Locks المطلوبة

| Lock Type | الموقع | الغرض |
|-----------|--------|-------|
| **Period Lock** | AccountingPeriod | منع الترحيل أو التعديل في فترة أثناء إغلاقها أو إعادة فتحها. |
| **JournalEntry Lock** | JournalEntry | منع تعديل قيد من عمليتين (نادر — عادة العكس لا التعديل). |
| **Payment Allocation Lock** | Sale / Debt | منع تخصيص دفعات متزامنة لنفس الفاتورة بأكثر من المبلغ المتبقي. |
| **Year-End Lock** | FiscalYear | منع عمليات أثناء Year-End Closing. |

### تنفيذ ConcurrencyLockService

```typescript
// concurrency-lock.service.ts
@Injectable()
export class ConcurrencyLockService {
  private locks = new Map<string, Promise<void>>();

  async acquirePeriodLock(periodId: number, companyId: number): Promise<() => void> {
    const key = `period:${companyId}:${periodId}`;
    const existing = this.locks.get(key);
    if (existing) await existing; // انتظار إن وُجد lock

    let release: () => void;
    const promise = new Promise<void>((resolve) => {
      release = () => {
        this.locks.delete(key);
        resolve();
      };
    });
    this.locks.set(key, promise);
    return release!;
  }

  async withPeriodLock<T>(periodId: number, companyId: number, fn: () => Promise<T>): Promise<T> {
    const release = await this.acquirePeriodLock(periodId, companyId);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
```

### تنفيذ متسلسل لتجنب Double Posting

- **Option A:** Queue للعمليات الحساسة (مثلاً Bull/RMQ) — ترحيل القيود عبر worker يضمن التسلسل.
- **Option B:** Database transaction مع row-level lock (SELECT FOR UPDATE) على المستند قبل الترحيل.
- **Option C:** Optimistic locking عبر `version` على JournalEntry والـ Document.

---

## 7️⃣ Multi-Company

### المبادئ

- **كل شركة لها:**
  - GL مستقل (JournalEntry يُفلتر بـ companyId)
  - Chart of Accounts مستقلة (Account.companyId)
  - Periods و Fiscal Years منفصلة
  - Stock Ledger مستقل (إن وُجد)
- **أي ترحيل أو نقل بين الشركات** يتم عبر **Intercompany Journal Entry** — قيد يمس حسابات شركتين.
- **Company Context:** كل طلب API أو مستخدم يعمل ضمن شركة محددة (من token أو header أو tenant).

### حقول companyId

| الجدول | الحقل | الوصف |
|--------|-------|-------|
| JournalEntry | companyId | شركة القيد |
| JournalEntryLine | companyId | (اختياري، يُستنتج من JE) |
| Account | companyId | شركة الحساب |
| Sale, Purchase, Payment | companyId | شركة المستند |
| AccountingPeriod | companyId | شركة الفترة |
| FiscalYear | companyId | شركة السنة |

### تقارير موحدة

- **Consolidation:** تجميع قيود عدة شركات بعملة موحدة لفترة محددة.
- **Elimination:** إزالة قيود Intercompany عند التوحيد.
- **استعلام:** `WHERE companyId IN (allowedCompanies)` حسب صلاحيات المستخدم.

---

## 8️⃣ Multi-Currency

### المبادئ

- **لكل Transaction:**
  - `currency` — عملة المعاملة
  - `exchangeRate` — سعر الصرف لعملة الشركة
  - `amountInCompanyCurrency` أو استخدام minor units بالعملة المحلية
- **عند الترحيل:**
  - إنشاء قيود GL بعملة الشركة (أو عملة الحساب)
  - حساب فروق العملة (Exchange Gain/Loss) تلقائياً عند اختلاف السعر
- **Minor units:** كل المبالغ مخزنة كأعداد صحيحة (مثلاً هللات لـ SAR).

### حقول العملة

| الجدول/الحقل | الوصف |
|---------------|-------|
| JournalEntryLine.debitInAccountCurrency | المبلغ بعملة الحساب |
| JournalEntryLine.creditInAccountCurrency | المبلغ بعملة الحساب |
| JournalEntryLine.exchangeRate | سعر الصرف عند الترحيل |
| Account.accountCurrency | عملة الحساب (null = عملة الشركة) |
| Company.defaultCurrency | عملة الشركة الافتراضية |

### حساب فروق الصرف

- عند دفعة بعملة أجنبية: المبلغ × FX عند الدفع ≠ المبلغ × FX عند إنشاء الفاتورة.
- الفرق → حساب **Exchange Gain/Loss** (Income/Expense).
- إنشاء قيد تلقائي: DR/CR الحساب، CR/DR Exchange Gain/Loss.

---

## 9️⃣ Frontend Refactor

### 1. Audit Dashboard (`/audit/accounting`)

- **عرض كل القيود مع:**
  - User، Action، Document Type، Document ID
  - Period، Fiscal Year، Company
  - Timestamp
  - Old Values / New Values (قابلة للتوسيع)
- **Drilldown للمستندات المرتبطة:** رابط من Audit Entry إلى Sale، Payment، JournalEntry.
- **فلترة:** نوع العملية، الشركة، العملة، الفترة، المستخدم.
- **تصدير:** CSV/Excel للسجلات المفلترة.

### 2. Concurrency Alerts

- **إشعارات** عند محاولة تعديل قيود مقفلة: "الفترة مقفلة" أو "قيد قيد التعديل من مستخدم آخر".
- **عرض Locks الحالية:** (إن وُجد UI للإدارة) قائمة الفترات أو القيود المقفلة حالياً.
- **Timeout:** عدم انتظار غير محدود — رسالة واضحة عند تعذر الحصول على Lock.

### 3. Multi-Company / Multi-Currency UI

- **اختيار الشركة:** قبل إنشاء Transaction — dropdown أو افتراضي من إعدادات المستخدم.
- **عرض Currency و Minor Units:** في نماذج الدفع، الفاتورة، القيد اليدوي.
- **FX Rate و Conversion Info:** عند إدخال مبلغ بعملة أجنبية — عرض المبلغ المحوّل، وسعر الصرف المستخدم.
- **Company Switcher:** في الـ header للتبديل بين الشركات المسموح بها.

### مكونات مقترحة

```tsx
// AccountingAuditDashboard.tsx  - لوحة التدقيق المحاسبي
// AuditEntryTable.tsx            - جدول سجلات التدقيق
// AuditDrilldownModal.tsx       - نافذة تفاصيل مع روابط للمستندات
// ConcurrencyAlertBanner.tsx    - تنبيه عند Lock
// CompanySwitcher.tsx           - اختيار الشركة
// CurrencyInputWithFX.tsx       - إدخال مبلغ مع تحويل العملة
```

---

## 🔟 Data Migration Strategy

### 1. مراجعة كل voidPayment

- **السياق:** Blueprint 03 و 09 يضمنان أن voidPayment يطلق `document.cancelled` ويتلقاه Handler لإنشاء القيد العكسي.
- **للبيانات القديمة (ما قبل Migration):** اكتشاف كل Payment حيث `isVoided = true` وليس له قيد عكسي.
- **إصلاح:** تشغيل script ينشئ قيد عكسي لكل دفعة ملغاة بدون عكس.
- **التحقق:** رصيد Cash و AR/AP بعد الإصلاح يطابق التشغيل.

### 2. إنشاء AuditEntry للعمليات الموجودة

- **Backfill:** لكل JournalEntry موجود — إنشاء `AccountingAuditEntry` افتراضي (action=create، user=system أو من createdById).
- **للعمليات القديمة بدون تفاصيل:** timestamp من createdAt للمستند.

### 3. فحص Concurrency

- مراجعة العمليات السابقة: هل وُجدت حالات double posting أو تضارب؟
- إضافة ملاحظات للمستندات المشكوك فيها.
- لا إصلاح تلقائي — مراجعة يدوية أو مسار تصحيح مخصص.

### 4. تحديد الشركات المتعددة

- إذا النظام سيُستخدم لشركات متعددة: تحديد companyId لكل قيد ومستند.
- الافتراضي: `companyId = 1` لكل السجلات الحالية.
- تقسيم لاحق: إنشاء شركات جديدة وترحيل بيانات حسب معايير (فرع، نشاط، إلخ).

### 5. العملة

- الافتراضي: كل المبالغ بعملة واحدة (SAR أو من Company).
- **إنشاء FX entries** للمستندات متعددة العملات القديمة (إن وُجدت) أو تسجيلها كـ historical.
- إضافة `currency` و `exchangeRate` للمستندات الجديدة حسب Multi-Currency Blueprint.

---

## 1️⃣1️⃣ Testing Strategy

| الاختبار | المطلوب |
|----------|---------|
| **voidPayment → قيد عكسي** | إلغاء دفعة → التحقق من وجود قيد عكسي ورصيد صحيح. |
| **Multi-Company** | ترحيل قيود لشركتين → التأكد من الفصل في الاستعلامات والتقارير. |
| **Multi-Currency** | معاملة بعملة أجنبية → التحقق من minor units، FX، فروق الصرف. |
| **Concurrency** | محاولة تعديل قيود في نفس الفترة متزامناً → إما انتظار أو رفض مع رسالة. |
| **Audit Log** | كل عملية إنشاء/إلغاء/عكس → التحقق من وجود Audit Entry مع Drilldown. |
| **Load Test** | آلاف القيود في نفس الوقت — عدم فقدان بيانات، عدم double posting. |
| **Period Lock** | محاولة ترحيل في فترة مغلقة → PERIOD_LOCKED. |
| **Company Scope** | مستخدم شركة أ لا يرى قيود شركة ب. |

### أمثلة Tests

```typescript
describe('VoidPayment', () => {
  it('should create reversal journal entry on void', async () => {
    const payment = await createAndPostPayment();
    await paymentsService.voidPayment(payment.id, 'reason', userId);
    const reversal = await findReversalJournalEntry('payment', payment.id);
    expect(reversal).toBeDefined();
    expect(reversal.isReversed).toBe(false); // القيد العكسي نفسه
    const original = await findJournalEntryByVoucher('payment', payment.id);
    expect(original.reversedByEntryId).toBe(reversal.id);
  });
});

describe('ConcurrencyLockService', () => {
  it('should block concurrent period close', async () => {
    const [r1, r2] = await Promise.all([
      concurrencyLock.withPeriodLock(periodId, companyId, () => closePeriod()),
      concurrencyLock.withPeriodLock(periodId, companyId, () => closePeriod()),
    ]);
    // إحداهما تنجح، الأخرى تنتظر أو تُرفض
  });
});
```

---

# النتيجة المتوقعة

بعد تنفيذ هذا الملف:

- **Audit-ready** لكل القيود والمستندات — تتبع كامل مع period، fiscal year، voucher.
- **Data Integrity** — لا voidPayment بدون قيود عكسية؛ لا تعديل قيد بدون Audit Entry.
- **Concurrency آمن** لجميع العمليات — Locks على Periods والحالات الحساسة.
- **دعم كامل لشركات متعددة** — GL منفصل، تقارير موحدة.
- **دعم كامل لعملات متعددة** — FX، فروق صرف، minor units.
- **حماية البيانات المالية** — Period Lock، Company Scope، Audit Log.
- **إمكانية تتبع كل التعديلات والمستندات** — Drilldown من التقرير إلى القيد إلى المستند.
- **نظام قابل للتوسع** وصيانة طويلة المدى.

---

# اكتمال مخطط الترحيل

بعد هذا الملف يصبح لديك **10 ملفات** في `accounting-migration-blueprint`:

| # | الملف | المحور |
|---|-------|--------|
| 01 | chart_of_accounts_rebuild | دليل الحسابات |
| 02 | general_ledger_engine | محرك القيود |
| 03 | posting_workflow_control | دورة حياة المستندات |
| 04 | receivables_payables_engine | الذمم والمدفوعات |
| 05 | tax_engine_and_vat_architecture | الضريبة والـ VAT |
| 06 | inventory_valuation_and_stock_accounting | تقييم المخزون |
| 07 | accounting_periods | الفترات والسنة المالية |
| 08 | financial_reporting | التقارير المالية |
| 09 | financial_architecture | المعمارية المالية (Event-Driven) |
| 10 | scalability_and_control | التوسع والرقابة |

الخطوة التالية المقترحة: **برومبت شامل** يجمع العشرة ملفات في خطة تنفيذ موحدة مع ترتيب الاعتماديات وملفات Frontend + Backend + Migration.
