# 09 — Financial Architecture (Event-Driven GL Layer)

**Migration Blueprint — Phase 9**  
**Target:** Decouple accounting logic from operational services via Event-Driven Architecture, enabling each document type to provide its own GL mapping via `get_gl_entries()` and ensuring a clean separation of concerns similar to ERPNext.

> **Prerequisites:** Phase 01 (Chart of Accounts), Phase 02 (GL Engine), Phase 03 (Posting Workflow), Phase 07 (Accounting Periods) must be applied. This blueprint assumes `glEngine.post()`, `glEngine.reverse()` exist, and `docstatus` is implemented on documents.

---

## 1️⃣ Problem Statement

### مخاطر دمج منطق المحاسبة في الخدمات التشغيلية

#### التزاحم والمسؤوليات المتعددة
- **SalesService** و **PurchasesService** و **PaymentsService** و **ExpensesService** و **WastageService** تستدعي `accountingService.createXxxJournalEntry()` مباشرة داخل نفس الـ transaction.
- كل خدمة تشغيلية تحتوي على معرفة محاسبية (أي حسابات تُستخدم، أي منطق قيد).
- **انتهاك Single Responsibility:** الخدمة مسؤولة عن منطق الأعمال + منطق المحاسبة معاً.
- أي خطأ في القيد يتطلب تعديل الخدمة التشغيلية — أو العكس: تعديل منطق البيع يهدد المحاسبة.

#### صعوبة إضافة مستندات جديدة
- إضافة مستند جديد (مثل **Stock Adjustment**, **Fixed Asset Purchase**, **Loan Disbursement**) يتطلب:
  1. إنشاء دالة `createXxxJournalEntry()` في AccountingService.
  2. تعديل AccountingService (ملف مركزي).
  3. إضافة استدعاء من الـ Service الجديد.
- **التوسع يصبح مكلفاً:** كل مستند جديد يضيف تعقيداً على محرك مركزي.
- **عدم المرونة:** المستندات من وحدات خارجية (Plugins, Modules) لا يمكن ربطها بدون تعديل core.

#### أهمية فصل الـ GL Layer لتحقيق المرونة والتوسع

- **قابلية الصيانة:** منطق المحاسبة في مكان واحد — تعديلات GL لا تمس Sales أو Purchases.
- **قابلية الاختبار:** GL Layer يُختبر بشكل مستقل عن العمليات التشغيلية.
- **قابلية التوسع:** مستند جديد يُضاف عبر تسجيل Mapper فقط، دون تعديل المحرك.
- **امتثال ISO/IFRS:** فصل واضح بين طبقة التشغيل وطبقة الدفاتر يسهّل التدقيق والمراجعة.

#### الحاجة إلى طبقة Event Driven مشابهة لـ ERPNext

- **ERPNext:** كل Document يُعرّف `on_submit`, `on_cancel`. المحرك العام يستدعي `doc.get_gl_entries()` عند Submit.
- **عدم اقتران مباشر:** المستند لا يعرف كيف تُحفظ القيود. المستند يعرف فقط "ما القيود المطلوبة".
- **Hooks:** حدث Submit يُطلق → Handler يستلم المستند → يستخرج GL Map → يمرره للمحرك.
- **النتيجة:** إضافة مستند جديد = إضافة `get_gl_entries()` + تسجيل Handler — لا تعديل على الـ Accounting Engine.

---

## 2️⃣ ERPNext Architecture (Target Model)

### 2.1 General Ledger Layer

```
general_ledger.make_gl_entries(document)
    → document.get_gl_entries()  # المستند يُرجع القيود
    → process_gl_map(entries)
    → save_entries()
```

- **محرك مستقل:** `general_ledger` لا يعرف تفاصيل Sales Invoice أو Purchase Invoice.
- **لكل Document:**
  - `get_gl_entries()` → تُرجع قائمة GL Map (قيود مؤقتة).
  - `Document.on_submit` → يستدعي `make_gl_entries(get_gl_entries())`.
  - `Document.on_cancel` → يستدعي `make_reverse_gl_entries()`.

### 2.2 Event Driven Hooks

- **Hooks على Submit / Cancel / Update:**
  - `before_submit`, `on_submit`, `after_submit`
  - `before_cancel`, `on_cancel`, `after_cancel`
  - `on_update` (للمستندات التي تسمح بتعديل بعد الترحيل — نادر)
- **الطبقة الحسابية لا تتأثر بالعمليات التشغيلية:** المستند يُحدّث، الحدث يُطلق، Handler المحاسبي يستجيب.
- **أي مستند جديد** يضيف `get_gl_entries()` دون تعديل الـ Accounting Engine.

### 2.3 نمط الاستدعاء في ERPNext

```python
# عند Submit
def on_submit(self):
    self.make_gl_entries()

def make_gl_entries(self):
    gl_entries = self.get_gl_entries()
    from erpnext.accounts.general_ledger import make_gl_entries
    make_gl_entries(gl_entries, cancel=False)
```

- المستند يستدعي `make_gl_entries` لكن الـ GL Map يأتي من `get_gl_entries()` المُعرّفة في نفس المستند.
- الفصل: المستند = مصدر البيانات. المحرك = التنفيذ.

---

## 3️⃣ Target Architecture داخل نظامنا

### هيكل المجلدات

```
src/accounting/
├── gl-engine/                    # من Blueprint 02
│   ├── gl-engine.service.ts
│   ├── gl-validator.service.ts
│   └── ...
├── general-ledger.service.ts      # واجهة موحدة: make_gl_entries / reverse
├── mappers/
│   ├── journal-entry.mapper.ts    # Registry + استخراج GL من المستندات
│   ├── sale-gl.mapper.ts
│   ├── purchase-gl.mapper.ts
│   ├── payment-gl.mapper.ts
│   ├── expense-gl.mapper.ts
│   └── wastage-gl.mapper.ts
├── events/
│   ├── accounting-event.emitter.ts   # إطلاق أحداث المستندات
│   ├── accounting-event.hooks.ts     # مستمعين (Subscribers)
│   └── types/
│       └── accounting-events.types.ts
├── accounting.module.ts
└── accounting.service.ts         # يُحصر في: تقارير، Trial Balance، لا createXxx
```

### دور كل Service/Module

| المكون | الدور |
|--------|-------|
| **general-ledger.service.ts** | مسؤول عن إنشاء GL Entry مستقل لكل مستند. يستقبل `GLMapEntry[]` + `GLPostMetadata`، يستدعي `glEngine.post()` أو `glEngine.reverse()`. نقطة الدخول الوحيدة للطبقة المحاسبية من الخارج. |
| **journal-entry.mapper.ts** | **Registry للـ Mappers:** يربط `voucherType` (sale, purchase, payment_received, ...) بـ Mapper المناسب. يستدعي `mapper.getGlEntries(document)` ويُرجع GL Map. ترجمة مستندات التشغيل إلى قيود GL عبر واجهة موحدة. |
| **sale-gl.mapper.ts** (وغيره) | تنفيذ `getGlEntries(sale: Sale, context): GLMapEntry[]` — معرفة كيفية تحويل Sale إلى قيود مدين/دائن. كل مستند له Mapper مستقل. |
| **accounting-event.hooks.ts** | مراقبة Submit / Cancel لكل Document. عند `DocumentSubmitted` → يستخرج voucherType، يجلب المستند، يستدعي Mapper، يمرر GL Map لـ GeneralLedgerService. عند `DocumentCancelled` → يستدعي `makeReverseGlEntries()`. |
| **accounting-event.emitter.ts** | واجهة لتسهيل إطلاق الأحداث: `emitDocumentSubmitted(type, id)`, `emitDocumentCancelled(type, id)`. الخدمات التشغيلية تستدعي هذا بدلاً من AccountingService مباشرة. |

### أنواع الأحداث (Accounting Events)

```typescript
// accounting-events.types.ts
export interface DocumentSubmittedPayload {
  voucherType: 'sale' | 'purchase' | 'payment_received' | 'payment_made' | 'expense' | 'wastage' | string;
  voucherId: number;
  branchId?: number | null;
  companyId?: number | null;
  userId: number;
  postingDate?: Date;
}

export interface DocumentCancelledPayload {
  voucherType: string;
  voucherId: number;
  userId: number;
  reason?: string;
}

// NestJS EventEmitter2
eventEmitter.emit('document.submitted', payload);
eventEmitter.emit('document.cancelled', payload);
```

### تدفق البيانات

```
[Operational Service]                    [Accounting Layer]
       |                                        |
       |  Submit Document                       |
       |  docstatus = 1                         |
       |  submittedAt = now                      |
       |                                        |
       |  EventBus.emit('document.submitted',   |
       |    { voucherType: 'sale', id: 123 })  |
       | -------------------------------------->|
       |                                        | AccountingEventHandler
       |                                        |   → load Document
       |                                        |   → SaleGLMapper.getGlEntries(sale)
       |                                        |   → GeneralLedgerService.makeGlEntries(glMap, metadata)
       |                                        |   → GlEngineService.post(glMap, metadata)
       |                                        |   → JournalEntry created
       |<--------------------------------------|
       |  return                                |
```

---

## 4️⃣ Refactor Existing Services

### 4.1 SalesService / PurchaseService / PaymentService / ExpenseService / WastageService

#### إزالة الاستدعاءات المباشرة

**قبل:**
```typescript
// sales.service.ts
await this.accountingService.createSaleJournalEntry(tx, saleId, saleNumber, ...);
```

**بعد:**
```typescript
// sales.service.ts
// لا استدعاء لـ accountingService.createXxxJournalEntry
// بدلاً من ذلك:
await this.accountingEventEmitter.emitDocumentSubmitted('sale', sale.id, tx);
// أو: الاعتماد على Hook يُطلق تلقائياً عند تحديث docstatus
```

#### إضافة Hook لإرسال Document

- **الخيار أ:** الخدمة تستدعي `accountingEventEmitter.emitDocumentSubmitted()` صراحة بعد تحديث docstatus.
- **الخيار ب:** استخدام NestJS EventEmitter2 — الخدمة تُطلق `this.eventEmitter.emit('document.submitted', payload)` والمستمع المحاسبي يستجيب.

#### أي إضافة مستند جديد

```typescript
// new-document-gl.mapper.ts
@Injectable()
export class NewDocumentGLMapper implements IGLMapper {
  readonly voucherType = 'new_document';

  async getGlEntries(document: NewDocument, context: GLMapperContext): Promise<GLMapEntry[]> {
    return [
      { accountId: x, debit: amount, description: '...' },
      { accountId: y, credit: amount, description: '...' },
    ];
  }
}

// تسجيل في JournalEntryMapperRegistry
```

- **لا تعديل على AccountingService أو GeneralLedgerService.** فقط إضافة Mapper وتسجيله.

### 4.2 AccountingService

- تصبح مجرد **محرك تجميع وتقارير** — لا `createXxxJournalEntry`.
- **يبقى فيه:**
  - `getTrialBalance()`, `getAccountLedger()`
  - إدارة الحسابات (إن وُجدت في نفس الوحدة)
  - إنشاء Journal Entry يدوي من الواجهة (يستخدم GL Engine عبر واجهة موحدة)
- **يُزال منه:** كل دوال `createSaleJournalEntry`, `createPurchaseJournalEntry`, ... أو تُحوّل إلى Mappers.

### 4.3 واجهة IGLMapper

```typescript
// mappers/types/igl-mapper.types.ts
export interface IGLMapper<T = unknown> {
  readonly voucherType: string;
  getGlEntries(document: T, context: GLMapperContext): Promise<GLMapEntry[]> | GLMapEntry[];
}

export interface GLMapperContext {
  companyId: number | null;
  branchId: number | null;
  userId: number;
  postingDate: Date;
}
```

### 4.4 العلاقة مع Blueprint 02 (GL Engine)

- **Blueprint 02** يُقدّم `GlEngineService`: `post(glMap, metadata)`, `reverse(voucherType, voucherId)`.
- **Blueprint 09** يُقدّم طبقة **أعلى:** GeneralLedgerService + Event Hooks.
- **GeneralLedgerService** يستدعي `GlEngineService.post()` داخلياً — لا يحل محله.
- التقسيم:
  - `GlEngineService` = معالجة GL Map (merge, round-off, حفظ).
  - `GeneralLedgerService` = واجهة موحدة + Guards.
  - `AccountingEventHooks` = ربط الأحداث بالمحرك.

---

## 5️⃣ Event Driven Workflow

### تدفق Submit

```
1. Controller/Service: submitSale(id)
2. SalesService:
   - التحقق من صلاحية Sale (Draft, غير ملغى)
   - التحقق من Period Lock (postingDate)
   - tx.sale.update({ docstatus: 1, submittedAt, submittedById })
   - this.eventEmitter.emit('document.submitted', { voucherType: 'sale', voucherId: id, branchId, userId })
3. AccountingEventHooks (Listener):
   - يتلقى الحدث
   - SaleGLMapper.getGlEntries(sale) → glMap
   - metadata = { voucherType, voucherId, postingDate, ... }
   - generalLedgerService.makeGlEntries(glMap, metadata)
   - glEngineService.post(glMap, metadata)
4. JournalEntry يُنشأ مع isPosted=true, periodId, fiscalYearId
```

### تدفق Cancel

```
1. Controller/Service: cancelSale(id)
2. SalesService:
   - التحقق من docstatus=1
   - التحقق من Period Lock
   - tx.sale.update({ docstatus: 2, cancelledAt, cancelledById })
   - this.eventEmitter.emit('document.cancelled', { voucherType: 'sale', voucherId: id })
3. AccountingEventHooks (Listener):
   - generalLedgerService.makeReverseGlEntries('sale', id)
   - glEngineService.reverse('sale', id)
4. قيد عكسي يُنشأ أو isReversed=true
```

### تدفق Update (إن وُجد)

- **نادراً:** معظم المستندات لا تُعدّل بعد Submit.
- إن وُجد: `document.updated` → إما عكس القيد القديم + إنشاء قيد جديد، أو منع التعديل (الأفضل للامتثال).

### الاعتماد على isPosted و periodId و fiscalYearId

- كل قيد يُنشأ عبر GL Engine يُعيّن تلقائياً:
  - `isPosted = true` (عند الترحيل الناجح)
  - `periodId` من `AccountingPeriodService.getPeriodForDate(postingDate)`
  - `fiscalYearId` من الفترة أو مباشرة

---

## 6️⃣ Backend Guards

| Guard | المنطق |
|-------|--------|
| **PeriodLockGuard** | منع إنشاء قيود إذا الفترة مغلقة. يتم التحقق في `generalLedgerService.makeGlEntries()` قبل استدعاء GL Engine. استدعاء `periodLockService.validatePostingAllowed(postingDate, companyId)`. |
| **FreezingDateGuard** | منع الترحيل بتاريخ أقل من `company.freezing_date` (إن وُجد). |
| **ModifyAfterCloseGuard** | منع تعديل أو عكس GL Entries في فترة مغلقة. عند Cancel: التحقق من أن postingDate للمستند ليس في فترة مغلقة. |
| **NoDirectGLEditGuard** | منع حذف أو تعديل JournalEntryLine إلا عبر Document Hooks (عكس). لا endpoint عام لـ "تعديل قيد" دون إلغاء المستند المصدر. |
| **PostedOnlyInReportsGuard** | (من Blueprint 08) التقارير تعتمد فقط على isPosted=true. |

### تنفيذ PeriodLockGuard

```typescript
// general-ledger.service.ts
async makeGlEntries(glMap: GLMapEntry[], metadata: GLPostMetadata, tx?: PrismaTransaction) {
  await this.periodLockService.validatePostingAllowed(metadata.postingDate, metadata.companyId);
  return this.glEngineService.post(glMap, metadata, tx);
}
```

---

## 7️⃣ Frontend Refactor

### 1. Document Submission Screen

- **زر Submit / Cancel** مرتبط بالـ Event Hooks — استدعاء API يطلق الحدث من الـ backend.
- **إظهار حالة GL Entry لكل مستند:**
  - Draft: لا قيود
  - Submitted: قيد مُرحّل — عرض رقم القيد ورابط للعرض
  - Cancelled: قيد مُعكوس — عرض القيد الأصلي والقيد العكسي
- **Drilldown لكل قيود مرتبطة:** من صفحة Sale/Purchase/Payment — قسم "القيود المحاسبية" يعرض JournalEntry المرتبط مع voucherType و voucherId.

### 2. Accounting Dashboard

- **عرض مستندات مع حالة GL Posting:**
  - فلتر: Draft | Posted | Reversed
  - جدول: نوع المستند، الرقم، التاريخ، حالة القيد، رابط للقيد
- **القدرة على تتبع أي قيود لأي مستند:**
  - بحث حسب voucherType + voucherId
  - من JournalEntry: عرض المستند المصدر (رابط لـ Sale، Purchase، ...)
- **عرض التاريخ والفترة المالية لكل قيد:**
  - عمود Period، Fiscal Year

### مكونات مقترحة

```tsx
// DocumentGLStatusBadge.tsx    - شارة حالة القيد (Draft/Posted/Reversed)
// DocumentLedgerLink.tsx       - رابط من المستند إلى القيد
// AccountingDashboard.tsx     - لوحة تتبع المستندات والقيود
// VoucherDrilldownTable.tsx   - جدول القيود المرتبطة بمستند
```

---

## 8️⃣ Data Migration Strategy

### 1. تحويل الاستدعاءات المباشرة

| Service | الاستدعاء الحالي | الإجراء |
|---------|-------------------|---------|
| SalesService | `createSaleJournalEntry` | إزالة. إضافة `emitDocumentSubmitted('sale', id)` بعد تحديث docstatus. |
| SalesService | `createSaleVoidJournalEntry` | تحويل إلى Cancel flow: `emitDocumentCancelled('sale', id)`. |
| PurchasesService | `createPurchaseJournalEntry` | إزالة. إضافة emit عند Submit. |
| PaymentsService | `createPaymentReceivedJournalEntry` | إزالة. emit عند Submit. |
| PaymentsService | `createPaymentMadeJournalEntry` | إزالة. emit عند Submit. |
| ExpensesService | `createExpenseJournalEntry` | إزالة. emit عند Approve/Submit. |
| WastageService | `createWastageJournalEntry` | إزالة. emit عند التسجيل. |

### 2. إنشاء Mappers

- نقل منطق `createSaleJournalEntry` من AccountingService إلى `SaleGLMapper.getGlEntries()`.
- نقل منطق `createPurchaseJournalEntry` إلى `PurchaseGLMapper.getGlEntries()`.
- وهكذا لكل نوع مستند.

### 3. تسجيل Mappers

```typescript
// journal-entry.mapper.ts (Registry)
const MAPPERS: Record<string, IGLMapper> = {
  sale: SaleGLMapper,
  purchase: PurchaseGLMapper,
  payment_received: PaymentReceivedGLMapper,
  payment_made: PaymentMadeGLMapper,
  expense: ExpenseGLMapper,
  wastage: WastageGLMapper,
};
```

### 4. مراجعة جميع Services التشغيلية

- التأكد من عدم وجود أي استدعاء متبقي لـ `accountingService.createXxx`.
- إضافة Hooks لكل مستند قديم لضمان استمرار ترحيل القيود.

### 5. Feature Flag

- `event_driven_accounting_enabled`: عند false — الاستدعاء المباشر القديم يعمل (للانتقال التدريجي). عند true — Event Driven فقط.
- بعد التحقق: إزالة المسار القديم.

---

## 9️⃣ Testing Strategy

| الاختبار | المطلوب |
|----------|---------|
| **Submit → GL Posting** | Submit لكل نوع مستند (Sale, Purchase, Payment, ...) → التحقق من إنشاء JournalEntry صحيح مع isPosted، periodId. |
| **Cancel → GL Reversal** | Cancel مستند مُرحّل → التحقق من إنشاء قيد عكسي أو isReversed. |
| **مستند جديد** | إضافة Mapper لمستند وهمي، تسجيله، Submit → تحقق من إنشاء GL Entry تلقائياً. |
| **Stress Test** | آلاف المستندات وقيود متعددة — التأكد من عدم تسرب ذاكرة أو تباطؤ. |
| **فصل الخدمات** | التأكد من أن SalesService لا يستورد AccountingService (أو لا يستدعي createXxx). التحقق من أن الـ Event هو المسار الوحيد. |
| **Period Lock** | Submit مستند بتاريخ في فترة مغلقة → PERIOD_LOCKED. |
| **Mapper Unit Tests** | `SaleGLMapper.getGlEntries(sale)` يرجع قيود صحيحة (مدين=دائن، حسابات صحيحة). |

### أمثلة Tests

```typescript
describe('AccountingEventHooks', () => {
  it('should create GL entry on sale submit', async () => {
    const sale = await createTestSale({ docstatus: 0 });
    eventEmitter.emit('document.submitted', { voucherType: 'sale', voucherId: sale.id });
    await waitForHandlers();
    const je = await findJournalEntryByVoucher('sale', sale.id);
    expect(je).toBeDefined();
    expect(je.isPosted).toBe(true);
  });
});

describe('SaleGLMapper', () => {
  it('should return balanced GL entries', async () => {
    const sale = createMockSale({ totalAmount: 100, totalCost: 60, amountPaid: 100 });
    const glMap = await mapper.getGlEntries(sale, context);
    const totalDebit = glMap.reduce((s, e) => s + (e.debit ?? 0), 0);
    const totalCredit = glMap.reduce((s, e) => s + (e.credit ?? 0), 0);
    expect(totalDebit).toBe(totalCredit);
  });
});
```

---

# النتيجة المتوقعة

بعد تنفيذ هذا الملف:

- **فصل تام للـ GL Layer** — لا استدعاء محاسبي من الخدمات التشغيلية.
- **Event Driven Architecture** مشابه لـ ERPNext — Submit/Cancel يطلق أحداثاً، المحاسبة تستجيب.
- **إضافة مستندات جديدة** دون تعديل محرك المحاسبة — فقط Mapper + تسجيل.
- **قابلية التوسع العالية** — Audit-Ready، تتبع كامل لكل قيود المحاسبة وربطها بالمستندات.
- **AccountingService** يقتصر على التقارير والتنسيق — لا إنشاء قيود مباشر.
- **كل القيود** تعتمد على isPosted، periodId، fiscalYearId.
- **متوافق** مع Period Lock و Fiscal Year.

---

**الانتقال للمحور العاشر:** Security & Permissions / Controls — إكمال معمارية النظم المالية بالتحكم في الصلاحيات والتدقيق.
