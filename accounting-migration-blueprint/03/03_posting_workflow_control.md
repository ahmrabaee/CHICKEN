# 03 — Posting Workflow Control (ERP-Level)

**Migration Blueprint — Phase 3**  
**Target:** Rebuild the posting mechanism to match ERPNext lifecycle (docstatus + Submit + Cancel + Reverse GL + Period Locking).

> **Prerequisites:** Phase 01 (Chart of Accounts), Phase 02 (GL Engine) must be applied. This blueprint assumes `glEngine.post()` and `glEngine.reverse()` exist.

---

## 1️⃣ Problem Statement

### المخاطر المحاسبية والرقابية

#### إمكانية تعديل البيانات بعد الترحيل
- Sale و Purchase و Payment و Expense تُنشأ وترحّل مباشرة — لا يوجد Draft.
- بعد الترحيل يمكن تعديل المستند (إن وُجد endpoint للتعديل) مما يخلق تضارباً بين الدفاتر والبيانات المصدرية.
- لا يوجد حاجز يمنع التعديل بعد إنشاء القيد المحاسبي.

#### إلغاء دفعة بدون عكس (العيب الحرج)
- `voidPayment(id)` يغيّر `isVoided = true` ويحدّث `sale.amountPaid` و `debt.amountPaid`.
- **لا يستدعي عكس القيد المحاسبي.**
- القيد الأصلي (DR Cash, CR AR أو DR AP, CR Cash) يبقى في الدفتر.
- النتيجة: الرصيد الفعلي (من Sale/Debt) يختلف عن رصيد الدفتر (من JournalEntry).
- تضارب خطير بين الحقيبة والذمم وبين الدفاتر المحاسبية.

#### عدم وجود Lifecycle موحد
- Sale/Purchase: `isVoided` فقط — لا Draft، لا Submit.
- Payment: `isVoided` فقط — نفس المشكلة.
- JournalEntry: `isPosted`, `isReversed` — لا تتطابق مع نموذج المستندات.
- لا قاعدة موحدة لـ (Draft → Submit → Posted) و (Cancel → Reverse GL).

#### غياب Locking
- لا يوجد Period Lock: يمكن الترحيل في أي تاريخ سابق.
- لا يوجد Freezing Date: يمكن تعديل بيانات فترة مالية مغلقة.
- مخاطرة على صلاحية التقارير والامتثال الضريبي.

#### ضعف Audit Trail
- من قام بالترحيل؟ (موجود جزئياً عبر `createdById`).
- من قام بالإلغاء؟ (موجود في Sale: `voidedById`, غائب في Payment).
- هل تم العكس المحاسبي؟ لا توجد علاقة واضحة بين Payment الملغى والقيد العكسي.

---

## 2️⃣ ERPNext Posting Lifecycle (Target Model)

### النموذج المستهدف

```
Draft (docstatus = 0)
    ↓ Submit
Submitted (docstatus = 1)
    ↓ Cancel
Cancelled (docstatus = 2)
```

### قواعد صارمة

| القاعدة | الوصف |
|---------|--------|
| GL عند Submit فقط | GL Entries تُنشأ فقط عند Submit. لا ترحيل في Draft. |
| Cancel ينشئ Reverse GL | كل Cancel يستدعي `glEngine.reverse()` على القيد المرتبط. |
| لا Delete بعد Submit | لا حذف للمستند بعد الترحيل. الإلغاء فقط عبر Cancel. |
| لا تعديل بعد Submit | المستند المُرحّل غير قابل للتعديل. إلغاء + إعادة إنشاء إن لزم. |
| Period Lock | لا Submit ولا Cancel داخل فترة مغلقة. |
| Freezing Date | لا ترحيل بتاريخ أقل من `freezing_date`. |

### تدفق ERPNext عند Submit
1. التحقق من صلاحية المستند.
2. التحقق من أن الفترة غير مغلقة.
3. التحقق من أن التاريخ ≥ freezing_date.
4. استدعاء `make_gl_entries(gl_map)`.
5. تحديث `docstatus = 1`.
6. تسجيل `submitted_at`, `submitted_by`.

### تدفق ERPNext عند Cancel
1. التحقق من أن المستند Submitted.
2. التحقق من أن الفترة غير مغلقة.
3. استدعاء `make_reverse_gl_entries(voucher_type, voucher_no)`.
4. تحديث `docstatus = 2`.
5. تسجيل `cancelled_at`, `cancelled_by`.

---

## 3️⃣ Target Architecture داخل نظامنا

### الحقول المطلوبة (موحدة)

إضافة إلى **جميع** المستندات القابلة للترحيل:

| الحقل | النوع | الوصف |
|-------|-------|-------|
| `docstatus` | Int | 0 = Draft, 1 = Submitted, 2 = Cancelled |
| `submittedAt` | DateTime? | وقت الترحيل |
| `submittedById` | Int? | من قام بالترحيل |
| `cancelledAt` | DateTime? | وقت الإلغاء |
| `cancelledById` | Int? | من قام بالإلغاء |
| `cancelReason` | String? | سبب الإلغاء (اختياري) |

### المستندات المعنية

| المستند | العلاقة |
|---------|---------|
| Sale | ترحيل فوري حالياً → يصبح Draft ثم Submit |
| Purchase | ترحيل عند الموافقة → يُطبّق Submit عند Approve |
| Payment | ترحيل فوري → يصبح Submit فوري (Payment لا Draft عادة) أو Draft → Submit |
| Expense | ترحيل عند الموافقة → Submit عند Approve |
| WastageRecord | ترحيل فوري → Submit عند التسجيل |
| StockMovement | لا GL مباشر؛ يُربط بالمستند المصدر |
| JournalEntry | يبقى `isPosted`, `isReversed` + إضافة `docstatus` للتنسيق |

### لماذا توحيد docstatus؟

- **حماية موحدة:** Guard واحد يتحقق من `docstatus`.
- **تقارير موحدة:** فلترة حسب الحالة بسهولة.
- **منطق موحد:** Submit/Cancel نفس التدفق لكل نوع مستند.
- **امتثال:** نمط ERP معروف للمدققين.

### تنازل عملي للنظام الحالي

- **Sale (POS):** قد نبقى على "ترحيل فوري" مع `docstatus=1` مباشرة عند الإنشاء؛ أو نقدّم وضع Draft للطلبات المؤجلة فقط.
- **Payment:** عادة لا Draft — يُنشأ ويرحّل مباشرة. يُطبّق Submit فور الإنشاء.
- **التغيير الجوهري:** إضافة Cancel مع Reverse GL لـ Payment، ومنع التعديل/الحذف بعد Submit.

---

## 4️⃣ Refactor Plan — Sale / Purchase

### الوضع الحالي

```
createSale()
  → sale created
  → createSaleJournalEntry() فوراً
  → return sale
```

### الوضع المستهدف

#### الخيار أ: الترحيل الفوري (ملاءمة POS)
```
createSale()
  → sale created (docstatus = 0 مؤقتاً)
  → glMap = getSaleGLMap(sale, data)
  → glEngine.post(glMap, { voucherType: 'sale', voucherId: sale.id, ... })
  → sale.docstatus = 1, submittedAt = now, submittedById = userId
  → return sale
```

#### الخيار ب: Draft ثم Submit (للطلبات/الفواتير)
```
createSale()
  → sale created (docstatus = 0)
  → return sale (بدون ترحيل)

submitSale(id)
  → validate docstatus === 0
  → PeriodLockGuard.check(sale.saleDate)
  → glMap = getSaleGLMap(sale, data)
  → glEngine.post(glMap, metadata)
  → sale.docstatus = 1, submittedAt, submittedById
  → return sale
```

### Flow كامل لـ Sale (الخيار أ — الترحيل الفوري)

1. **createSale(dto, cashierId)**
   - التحقق من صلاحية البيانات.
   - إنشاء Sale في transaction.
   - إنشاء SaleLines و CostAllocations.
   - تحديث Inventory و StockMovements.
   - `glMap = getSaleGLMap(sale, { totalAmount, totalCost, amountPaid, ... })`.
   - `glEngine.post(glMap, { voucherType: 'sale', voucherId: sale.id, postingDate: sale.saleDate, ... })`.
   - تحديث Sale: `docstatus = 1`, `submittedAt`, `submittedById`.
   - return sale.

2. **voidSale(id, dto, userId)** → يُستبدل بـ **cancelSale(id, userId)**
   - `DocumentStatusGuard.requireSubmitted(sale)`.
   - `PeriodLockGuard.check(sale.saleDate)`.
   - استعادة المخزون (inventory, lots).
   - لكل Payment مرتبط: `cancelPayment(paymentId, userId)` (مع Reverse GL).
   - `glEngine.reverse('sale', id, userId)` — عكس قيد البيع.
   - تحديث Sale: `docstatus = 2`, `cancelledAt`, `cancelledById`, `cancelReason`.
   - Update Debt.
   - Audit log.
   - return sale.

### Flow لـ Purchase

1. **createPurchase()** → docstatus = 0.
2. **approvePurchase(id)** أو **submitPurchase(id)**:
   - `PeriodLockGuard.check(purchase.purchaseDate)`.
   - `glMap = getPurchaseGLMap(...)`.
   - `glEngine.post(...)`.
   - docstatus = 1.
3. **cancelPurchase(id)**:
   - Reverse GL.
   - Cancel related payments.
   - docstatus = 2.

---

## 5️⃣ Refactor Plan — Payment (الأولوية القصوى)

### العيب الحرج الحالي

```typescript
// payments.service.ts - voidPayment (الحالي)
async voidPayment(id: number, reason: string, userId: number) {
  await tx.payment.update({
    where: { id },
    data: { isVoided: true, notes: reason },
  });
  // يحدّث Sale/Purchase amountPaid و Debt
  // ❌ لا يستدعي glEngine.reverse() — القيد يبقى في الدفتر!
}
```

### الحل المستهدف

```typescript
async cancelPayment(id: number, reason: string, userId: number) {
  const payment = await this.prisma.payment.findUnique({ where: { id } });
  if (!payment) throw new NotFoundException(...);
  if (payment.docstatus === 2) throw new BadRequestException('ALREADY_CANCELLED');

  return this.prisma.$transaction(async (tx) => {
    PeriodLockGuard.check(payment.paymentDate, tx);
    CancellationGuard.checkPaymentSettlement(payment, tx); // منع الإلغاء إن تمت تسوية لاحقة

    await this.glEngineService.reverse('payment', payment.id, userId, tx);

    await tx.payment.update({
      where: { id },
      data: {
        docstatus: 2,
        cancelledAt: new Date(),
        cancelledById: userId,
        cancelReason: reason,
      },
    });

    if (payment.referenceType === 'sale') {
      await tx.sale.update({
        where: { id: payment.referenceId },
        data: { amountPaid: { decrement: payment.amount } },
      });
      await tx.debt.updateMany({ ... });
    } else if (payment.referenceType === 'purchase') {
      await tx.purchase.update({ ... });
      await tx.debt.updateMany({ ... });
    }

    await tx.auditLog.create({ ... });
    return { success: true };
  });
}
```

### ربط Payment بـ JournalEntry

- JournalEntry له `sourceType = 'payment'` و `sourceId = payment.id`.
- `glEngine.reverse('payment', paymentId)` يجلب `journalEntry.where({ sourceType: 'payment', sourceId: paymentId })` وينشئ القيد العكسي.
- لا حاجة لحقل `journalEntryId` على Payment إن كان الربط عبر sourceType/sourceId ثابتاً.

### منع الإلغاء إذا الفترة مغلقة

- `PeriodLockGuard.check(payment.paymentDate)` يرمي `PERIOD_LOCKED` إن كان التاريخ ضمن فترة مغلقة.

### منع الإلغاء إذا تمت التسوية لاحقًا

- إذا كان هناك مستند لاحق يعتمد على هذه الدفعة (مثلاً تسوية دين، إغلاق فترة)، يُمنع الإلغاء.
- حالياً: نتحقق من عدم وجود "تسوية نهائية" أو "إقفال" يعتمد على الدفعة. يمكن تأجيل هذا إلى مرحلة لاحقة.

### إضافة endpoint

```typescript
// payments.controller.ts
@Post(':id/cancel')
@ApiOperation({ summary: 'Cancel payment (creates GL reversal)' })
cancelPayment(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: CancelPaymentDto,
  @CurrentUser() user: any,
) {
  return this.paymentsService.cancelPayment(id, dto.reason, user.id);
}
```

---

## 6️⃣ Reverse GL Mechanism

### قواعد من ERPNext (make_reverse_gl_entries)

| القاعدة | التنفيذ |
|---------|---------|
| كل debit يصبح credit | `reversalLine.debit = originalLine.credit` |
| كل credit يصبح debit | `reversalLine.credit = originalLine.debit` |
| الاحتفاظ بنفس metadata | accountId, costCenterId, partyType, partyId |
| ربط القيد العكسي | `reversedByEntryId` على الأصلي، `sourceType='reversal'`, `sourceId=originalEntry.id` |
| منع عكس مرتين | فحص `original.isReversed` قبل التنفيذ |

### تنفيذ في glEngine (من Blueprint 02)

```typescript
async reverse(voucherType: string, voucherId: number, userId: number, tx?: PrismaTransaction) {
  const original = await tx.journalEntry.findFirst({
    where: { sourceType: voucherType, sourceId: voucherId },
    include: { lines: true },
  });
  if (!original) throw new NotFoundException('Journal entry not found');
  if (original.isReversed) throw new BadRequestException('ALREADY_REVERSED');

  const glMap = original.lines.map(l => ({
    accountId: l.accountId,
    debit: l.creditAmount,
    credit: l.debitAmount,
    costCenterId: l.costCenterId,
    partyType: l.partyType,
    partyId: l.partyId,
    description: `عكس: ${l.description ?? original.description}`,
  }));

  const reversal = await this.post(glMap, {
    voucherType: 'reversal',
    voucherId: original.id,
    postingDate: new Date(),
    description: `عكس: ${original.description}`,
    createdById: userId,
  }, tx);

  await tx.journalEntry.update({
    where: { id: original.id },
    data: { isReversed: true, reversedByEntryId: reversal.id },
  });
  return reversal;
}
```

---

## 7️⃣ Period Locking System

### جدول AccountingPeriod

```prisma
model AccountingPeriod {
  id          Int      @id @default(autoincrement())
  startDate   DateTime @map("start_date")
  endDate     DateTime @map("end_date")
  isClosed    Boolean  @default(false) @map("is_closed")
  closedAt    DateTime? @map("closed_at")
  closedById  Int?     @map("closed_by")
  companyId   Int?     @map("company_id")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company Company? @relation(fields: [companyId], references: [id], onDelete: Restrict)

  @@unique([companyId, startDate])
  @@index([companyId, isClosed])
  @@map("accounting_periods")
}
```

### جدول SystemSetting للـ Freezing Date

```sql
INSERT OR IGNORE INTO system_settings (key, value, data_type, description) VALUES
  ('accounting_freeze_date', '', 'string', 'ISO date: no posting before this date'),
  ('period_lock_enabled', 'false', 'boolean', 'Enable period locking');
```

### القواعد

| القاعدة | الوصف |
|---------|-------|
| لا Submit في فترة مغلقة | `postingDate` ضمن فترة `isClosed=true` → رمي `PERIOD_LOCKED` |
| لا Cancel في فترة مغلقة | نفس الفحص لتاريخ المستند الأصلي |
| Freezing date | لا ترحيل بتاريخ < `accounting_freeze_date` |
| فحص عند Submit/Cancel | استدعاء `PeriodLockGuard.check(date)` قبل أي ترحيل أو إلغاء |

### Migration SQL

```sql
CREATE TABLE IF NOT EXISTS accounting_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_closed INTEGER NOT NULL DEFAULT 0,
  closed_at TEXT,
  closed_by INTEGER REFERENCES users(id),
  company_id INTEGER REFERENCES companies(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(company_id, start_date)
);
CREATE INDEX idx_acct_periods_closed ON accounting_periods(company_id, is_closed);
```

---

## 8️⃣ Backend Guards

### هيكل المجلدات

```
src/common/guards/
├── document-status.guard.ts
├── period-lock.guard.ts
├── cancellation.guard.ts
└── prevent-double-submit.guard.ts
```

### DocumentStatusGuard

| الدالة | الدور |
|--------|-------|
| `requireDraft(doc)` | يُرمي إن كان docstatus !== 0 |
| `requireSubmitted(doc)` | يُرمي إن كان docstatus !== 1 |
| `requireNotCancelled(doc)` | يُرمي إن كان docstatus === 2 |
| `requireEditable(doc)` | يُرمي إن كان Submitted أو Cancelled |

```typescript
export class DocumentStatusGuard {
  static requireSubmitted(doc: { docstatus: number }) {
    if (doc.docstatus !== 1) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Document must be submitted',
        messageAr: 'المستند يجب أن يكون مُرحّلاً',
      });
    }
  }
  static requireDraft(doc: { docstatus: number }) { ... }
  static requireNotCancelled(doc: { docstatus: number }) { ... }
}
```

### PeriodLockGuard

```typescript
export class PeriodLockGuard {
  static async check(postingDate: Date, companyId?: number, tx?: PrismaTransaction) {
    const settings = await getSystemSettings(tx, ['period_lock_enabled', 'accounting_freeze_date']);
    if (settings.accounting_freeze_date) {
      const freeze = new Date(settings.accounting_freeze_date);
      if (postingDate < freeze) {
        throw new BadRequestException({ code: 'FREEZE_DATE', messageAr: 'التاريخ قبل تاريخ التجميد' });
      }
    }
    if (settings.period_lock_enabled === 'true') {
      const period = await tx.accountingPeriod.findFirst({
        where: {
          companyId: companyId ?? null,
          startDate: { lte: postingDate },
          endDate: { gte: postingDate },
          isClosed: true,
        },
      });
      if (period) {
        throw new BadRequestException({ code: 'PERIOD_LOCKED', messageAr: 'الفترة المحاسبية مغلقة' });
      }
    }
  }
}
```

### CancellationGuard

- التحقق من عدم وجود تسويات لاحقة (إن طُبّق).
- التحقق من أن المستند ليس جزءاً من إقفال نهائي.

### PreventDoubleSubmitGuard

```typescript
static async check(voucherType: string, voucherId: number, tx: PrismaTransaction) {
  const existing = await tx.journalEntry.findFirst({
    where: { sourceType: voucherType, sourceId: voucherId },
  });
  if (existing) {
    throw new BadRequestException({
      code: 'ALREADY_POSTED',
      message: 'Document already has GL entries',
    });
  }
}
```

---

## 9️⃣ Database Changes

### الحقول على المستندات

| المستند | الحقول الجديدة |
|---------|-----------------|
| Sale | docstatus, submittedAt, submittedById, cancelledAt, cancelledById, cancelReason |
| Purchase | docstatus, submittedAt, submittedById, cancelledAt, cancelledById, cancelReason |
| Payment | docstatus, cancelledAt, cancelledById, cancelReason (استبدال/تكميل isVoided) |
| Expense | docstatus, submittedAt, submittedById, cancelledAt, cancelledById, cancelReason |
| WastageRecord | docstatus, submittedAt, submittedById, cancelledAt, cancelledById |
| JournalEntry | (موجود: isPosted, isReversed, reversedByEntryId) |

### علاقة JournalEntry بالمستند المصدر

- موجودة: `sourceType`, `sourceId`.
- لا حاجة لـ FK مباشر إن كان الربط عبر هذين الحقلين كافياً.

### Migration SQL

```sql
-- 013_posting_workflow_control

-- Sale
ALTER TABLE sales ADD COLUMN docstatus INTEGER DEFAULT 1;
ALTER TABLE sales ADD COLUMN submitted_at TEXT;
ALTER TABLE sales ADD COLUMN submitted_by INTEGER REFERENCES users(id);
ALTER TABLE sales ADD COLUMN cancelled_at TEXT;
ALTER TABLE sales ADD COLUMN cancelled_by INTEGER REFERENCES users(id);
ALTER TABLE sales ADD COLUMN cancel_reason TEXT;
UPDATE sales SET docstatus = 1 WHERE is_voided = 0;
UPDATE sales SET docstatus = 2 WHERE is_voided = 1;

-- Purchase
ALTER TABLE purchases ADD COLUMN docstatus INTEGER DEFAULT 0;
ALTER TABLE purchases ADD COLUMN submitted_at TEXT;
ALTER TABLE purchases ADD COLUMN submitted_by INTEGER REFERENCES users(id);
ALTER TABLE purchases ADD COLUMN cancelled_at TEXT;
ALTER TABLE purchases ADD COLUMN cancelled_by INTEGER REFERENCES users(id);
ALTER TABLE purchases ADD COLUMN cancel_reason TEXT;
UPDATE purchases SET docstatus = 1 WHERE is_approved = 1;

-- Payment
ALTER TABLE payments ADD COLUMN docstatus INTEGER DEFAULT 1;
ALTER TABLE payments ADD COLUMN cancelled_at TEXT;
ALTER TABLE payments ADD COLUMN cancelled_by INTEGER REFERENCES users(id);
ALTER TABLE payments ADD COLUMN cancel_reason TEXT;
UPDATE payments SET docstatus = 1 WHERE is_voided = 0;
UPDATE payments SET docstatus = 2 WHERE is_voided = 1;

-- Expense
ALTER TABLE expenses ADD COLUMN docstatus INTEGER DEFAULT 0;
ALTER TABLE expenses ADD COLUMN submitted_at TEXT;
ALTER TABLE expenses ADD COLUMN submitted_by INTEGER REFERENCES users(id);
ALTER TABLE expenses ADD COLUMN cancelled_at TEXT;
ALTER TABLE expenses ADD COLUMN cancelled_by INTEGER REFERENCES users(id);
UPDATE expenses SET docstatus = 1 WHERE is_approved = 1;

-- WastageRecord
ALTER TABLE wastage_records ADD COLUMN docstatus INTEGER DEFAULT 1;
ALTER TABLE wastage_records ADD COLUMN submitted_at TEXT;
ALTER TABLE wastage_records ADD COLUMN submitted_by INTEGER REFERENCES users(id);

-- Indexes
CREATE INDEX idx_sales_docstatus ON sales(docstatus);
CREATE INDEX idx_purchases_docstatus ON purchases(docstatus);
CREATE INDEX idx_payments_docstatus ON payments(docstatus);
CREATE INDEX idx_expenses_docstatus ON expenses(docstatus);
```

---

## 🔟 Data Migration Strategy

### المبادئ

1. كل Sale غير ملغاة حالياً → `docstatus = 1`.
2. كل Sale ملغاة → `docstatus = 2`.
3. كل Payment غير ملغاة → `docstatus = 1`.
4. **كل Payment ملغاة بدون عكس:** إنشاء قيود عكسية تلقائياً.

### Script لاكتشاف Payments الملغاة بدون عكس

```sql
-- Payments ملغاة (is_voided=1) ولا يوجد لها قيد عكسي
SELECT p.id, p.payment_number, p.amount, p.reference_type, p.reference_id
FROM payments p
LEFT JOIN journal_entries je ON je.source_type = 'reversal' 
  AND je.source_id IN (SELECT id FROM journal_entries WHERE source_type = 'payment' AND source_id = p.id)
WHERE p.is_voided = 1
  AND je.id IS NULL;
```

### Script تصحيح تلقائي

1. لكل Payment ملغى بدون reversal: استدعاء `glEngine.reverse('payment', payment.id, systemUserId)`.
2. تسجيل النتائج في جدول migration_log.

### ترتيب التنفيذ

1. تشغيل migration لجدول `accounting_periods` والحقول الجديدة.
2. تشغيل migration للبيانات (docstatus، إلخ).
3. تشغيل script اكتشاف inconsistencies.
4. تشغيل script إنشاء القيود العكسية للمدفوعات الملغاة.

---

## 1️⃣1️⃣ Frontend Refactor

### تغييرات مطلوبة

| العنصر | الوصف |
|--------|-------|
| زر Submit | عرض زر "ترحيل" للمستندات Draft (Purchase، Expense). |
| زر Cancel | استبدال "إلغاء" بـ "إلغاء (عكس محاسبي)" مع تحذير. |
| منع التعديل بعد Submit | إخفاء أزرار Edit للمستندات docstatus=1. |
| عرض حالة المستند | Badge أو نص: مسودة / مُرحّل / ملغى. |
| تنبيه فترة مغلقة | رسالة واضحة عند محاولة Submit أو Cancel في فترة مغلقة. |

### الصفحات المتأثرة

| الصفحة | التغييرات |
|--------|-----------|
| **Sales.tsx** | Badge للحالة، زر Void → Cancel مع تحذير، منع Edit بعد Submit |
| **Purchasing.tsx** | زر Submit/Approve، Badge للحالة، زر Cancel |
| **Payments.tsx** | إضافة زر Cancel للدفعة (استدعاء POST /payments/:id/cancel) |
| **PaymentProfile.tsx** | عرض docstatus، زر Cancel إن لم يكن ملغياً |
| **ExpenseProfile.tsx** | زر Submit عند الموافقة، Badge، منع Edit بعد Submit |
| **Accounting.tsx** | عرض القيود العكسية (isReversed، reversedByEntryId) |

### مكونات مشتركة مقترحة

```tsx
// DocumentStatusBadge.tsx
function DocumentStatusBadge({ docstatus }: { docstatus: number }) {
  const config = { 0: { label: 'مسودة', variant: 'secondary' }, 1: { label: 'مُرحّل', variant: 'default' }, 2: { label: 'ملغى', variant: 'destructive' } };
  return <Badge variant={config[docstatus]?.variant}>{config[docstatus]?.label}</Badge>;
}

// CancelConfirmDialog.tsx
// حوار تأكيد للإلغاء مع تنبيه: "سيتم إنشاء قيد عكسي محاسبي"
```

### API للتعديلات

- `POST /payments/:id/cancel` — إلغاء الدفعة مع Reverse GL.
- الـ DTO: `{ reason: string }`.
- استجابة عند `PERIOD_LOCKED`: `{ code: 'PERIOD_LOCKED', messageAr: 'الفترة المحاسبية مغلقة' }`.

---

## 1️⃣2️⃣ Audit & Compliance

### ما يُسجّل

| الحدث | الحقول |
|-------|--------|
| Submit | من (submittedById)، متى (submittedAt) |
| Cancel | من (cancelledById)، متى (cancelledAt)، السبب (cancelReason) |
| GL Post | من (createdById)، عبر JournalEntry |
| GL Reverse | من (createdById)، عبر JournalEntry العكسي |

### منع Delete بعد Submit

- لا endpoint لحذف Sale, Purchase, Payment, Expense بعد Submit.
- إن وُجد Delete في الـ API: إضافة فحص `docstatus === 0` فقط.
- JournalEntry: لا Delete أبداً — Cancel عبر Reverse فقط.

### Audit Log

```typescript
await tx.auditLog.create({
  data: {
    action: 'cancel',
    entityType: 'Payment',
    entityId: payment.id,
    userId,
    changes: JSON.stringify({ reason: dto.reason, reversalEntryId: reversal.id }),
  },
});
```

---

## 1️⃣3️⃣ Testing Strategy

| الاختبار | المطلوب |
|----------|---------|
| Submit creates GL | إنشاء Sale → التحقق من وجود JournalEntry مرتبط |
| Cancel creates reverse GL | Cancel Sale → التحقق من وجود قيد عكسي، isReversed=true على الأصلي |
| Double cancel prevented | استدعاء Cancel مرتين → خطأ ALREADY_CANCELLED |
| Period lock prevents submit | إغلاق فترة → محاولة Submit → PERIOD_LOCKED |
| Payment cancel creates reverse | Cancel Payment → التحقق من Reverse GL، تحديث amountPaid |
| Data integrity | 1000 عملية (Create + Cancel) → التحقق من توازن الأرصدة |

### أمثلة اختبار

```typescript
it('should create reverse GL when cancelling payment', async () => {
  const payment = await paymentsService.recordSalePayment(dto, userId);
  const jeBefore = await prisma.journalEntry.count({ where: { sourceType: 'payment', sourceId: payment.id } });
  expect(jeBefore).toBe(1);

  await paymentsService.cancelPayment(payment.id, 'Wrong amount', userId);

  const reversal = await prisma.journalEntry.findFirst({
    where: { sourceType: 'reversal' },
    include: { lines: true },
  });
  expect(reversal).toBeDefined();
  const original = await prisma.journalEntry.findFirst({
    where: { sourceType: 'payment', sourceId: payment.id },
  });
  expect(original.isReversed).toBe(true);
});
```

---

## 1️⃣4️⃣ Concurrency

| الآلية | التنفيذ |
|--------|---------|
| Transaction boundaries | كل Submit و Cancel داخل `prisma.$transaction` |
| Idempotency on submit | `PreventDoubleSubmitGuard` — فحص وجود JE قبل الإنشاء |
| منع duplicate GL | فحص `sourceType + sourceId` قبل post |
| Lock document | `SELECT ... FOR UPDATE` عند الحاجة (إن دعمتها DB)؛ أو الاعتماد على transaction isolation |

---

## 1️⃣5️⃣ Deployment Plan

### Phase 1: Add docstatus (أسبوع 1)
- تشغيل migration للحقول الجديدة.
- تعيين قيم افتراضية للبيانات الحالية.
- عدم تفعيل Guards بعد.

### Phase 2: Enforce submit for new documents (أسبوع 2)
- تحديث createSale/createPurchase ليُحدّث submittedAt/submittedById.
- إضافة فحص PreventDoubleSubmit حيث يلزم.
- لا تغيير في void/cancel بعد.

### Phase 3: Migrate old data (أسبوع 2)
- تشغيل script اكتشاف Payments الملغاة بدون عكس.
- تشغيل script إنشاء القيود العكسية.
- التحقق من النتائج.

### Phase 4: Enforce guards (أسبوع 3)
- تطبيق `cancelPayment` مع `glEngine.reverse`.
- إزالة/استبدال `voidPayment` بالـ Cancel.
- تفعيل DocumentStatusGuard في الـ endpoints.

### Phase 5: Enable period locking (أسبوع 4)
- إضافة واجهة إدارة الفترات (اختياري).
- تفعيل `period_lock_enabled`.
- تفعيل PeriodLockGuard.

### Rollback Plan

| الخطوة | الإجراء |
|--------|---------|
| قبل Phase 4 | التراجع سهل — الحقول الجديدة لا تُستخدم في المنطق. |
| بعد Phase 4 | الاحتفاظ بـ voidPayment كـ deprecated مع تحذير؛ إمكانية flag للعودة للمسار القديم. |
| بيانات | backup قبل migration؛ script لاستعادة docstatus إن لزم. |
| قيود عكسية | لا حذف — القيود العكسية تبقى للامتثال. |

---

# النتيجة المتوقعة

بعد تنفيذ هذا الملف:

- لن يوجد إلغاء دفعة بدون عكس محاسبي.
- لن يوجد تعديل أو حذف للمستندات بعد الترحيل (بدون إلغاء رسمي).
- لن يمكن الترحيل أو الإلغاء داخل فترة مغلقة (عند التفعيل).
- يصبح النظام مطابقاً لمستوى مراجعة مقبول (Audit-Grade).
- يصبح Payment آمن من الناحية المحاسبية.

---

**لا انتقال للمحور الرابع.** هذا الملف يختص بآلية الترحيل فقط.
