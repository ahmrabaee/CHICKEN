# 04 — Receivables & Payables Engine (ERP-Level)

**Migration Blueprint — Phase 4**  
**Target:** Rebuild the receivables/payables engine to match ERPNext (Payment Ledger, against_voucher, derived Outstanding, Reconciliation, Credit Notes).

> **Prerequisites:** Phase 01 (Chart of Accounts), Phase 02 (GL Engine), Phase 03 (Posting Workflow) must be applied. This blueprint assumes `glEngine.post()`, `glEngine.reverse()`, and `docstatus` exist.

---

## 1️⃣ Problem Statement

### لماذا Sale.amountPaid تصميم ضعيف
- **مخزن وليس محسوباً:** `amountPaid` يُحدَّث يدوياً عند كل دفعة عبر `sale.update({ amountPaid: { increment: dto.amount } })`.
- **عدم اتساق:** إذا حدث خطأ في تحديث Sale أو Debt دون Payment، أو العكس، تنفصل القيم.
- **لا مصدر حقيقة واحد:** لا يوجد Subledger (Payment Ledger) يُجمع منه المبلغ المدفوع.
- **قابل للتلاعب:** يمكن تعديل `amountPaid` مباشرة دون مرور عبر دفعة مسجلة.
- **لا تتبع للتخصيص:** لا يمكن معرفة أي جزء من الدفعة خُصص لأي فاتورة.

### لماذا Debt ليس Subledger حقيقي
- Debt يحتوي `totalAmount` و `amountPaid` كمخزنين — نفس مشكلة Sale.
- الربط بـ Payment عبر `referenceType='sale'` و `referenceId` يوحي بتخصيص دفعة واحدة لفاتورة واحدة.
- لا يوجد جدول Allocation يربط دفعة بفاتورة بمبلغ محدد.
- لا يمكن توزيع دفعة واحدة على عدة فواتير (Partial + Multi-Invoice).
- Debt يُنشأ يدوياً عند البيع الآجل — لا توليد تلقائي من GL أو PLE.

### مخاطر غياب Reconciliation
- لا أداة لمطابقة الدفعات مع الفواتير.
- المطابقة تتم يدوياً عبر تحديث amountPaid.
- لا اقتراح تلقائي للمطابقات الممكنة.
- صعوبة اكتشاف دفعات غير مخصصة أو فواتير مفتوحة بالخطأ.
- عدم جاهزية لمراجعة خارجية تتطلب Subledger Reconciliation.

### مشكلة الاعتماد على Void بدل Credit Note
- Void يلغي الفاتورة بالكامل — لا يوجد "إرجاع جزئي" أو "خصم تجاري".
- Credit Note وثيقة مستقلة تُخفض المستحق وتُسجّل في الدفاتر.
- Void لا ينتج وثيقة محاسبية قابلة للمراجعة بنفس شكل Credit Note.
- المعايير المحاسبية (IFRS) تفصل بين إلغاء الفاتورة ووثيقة الخصم/الإرجاع.

### لماذا النظام غير جاهز لبيئة تدقيق
- لا Subledger منفصل (Payment Ledger) يُطابق GL.
- Outstanding مُخزن وليس مُستنتجاً من القيود.
- لا Reconciliation workflow.
- لا Credit Note كوثيقة مستقلة.
- لا تتبع للتخصيص (Allocation) بدرجة كافية للامتثال.

---

## 2️⃣ ERPNext Target Model — Receivable/Payable Flow

### عند Submit Invoice (Sales Invoice / Purchase Invoice)
1. GL Entry يُنشأ — Debit AR (أو Credit AP) بمبلغ الفاتورة.
2. Payment Ledger Entry (PLE) يُنشأ لنفس المبلغ:
   - `voucher_type` = Sales Invoice
   - `voucher_no` = رقم الفاتورة
   - `against_voucher_type` = null (مفتوح)
   - `against_voucher_no` = null
   - `amount` = grand_total (موجب للذمم المدينة، سالب للدائنة)
3. Outstanding يُحسب من PLE: `Invoice Total - Sum(Allocated from PLE where against_voucher = هذا المستند)`.

### عند Payment (Payment Entry)
1. GL Entry — DR Cash / CR AR (أو العكس للدفع).
2. Payment Ledger Entry للدفعة:
   - `voucher_type` = Payment Entry
   - `voucher_no` = رقم الدفعة
   - `against_voucher_type` = Sales Invoice (مثلاً)
   - `against_voucher_no` = رقم الفاتورة
   - `amount` = المبلغ المخصص (سالِب للذمم المدينة لأنه يُقلّل المستحق)
3. PLE إضافي للفاتورة (أو تحديث allocation) يربط الدفعة بالفاتورة.
4. Outstanding للفاتورة = المجموع الأصلي − المبلغ المخصص.

### عند Reconciliation
- أداة تجمع الفواتير المفتوحة والمدفوعات غير المخصصة.
- المستخدم يختار فاتورة ودفعة ويعيّن المبلغ.
- يُنشأ Allocation Record ويُحدَّث PLE.
- يمكن Partial allocation — جزء من الدفعة لفواتير متعددة.
- يمكن Advance — دفعة مسبقة قبل الفاتورة.

### عند Credit Note
- وثيقة مستقلة مرتبطة بالفاتورة الأصلية.
- GL Entries — عكس تأثير الفاتورة (CR AR، DR Revenue، إلخ).
- PLE Entries — تخفيض Outstanding للفاتورة.
- Outstanding = Invoice − Allocated Payments − Credit Notes.

---

## 3️⃣ Target Architecture داخل نظامنا

### هيكل المجلدات والخدمات

```
src/accounting/
├── payment-ledger/
│   ├── payment-ledger.service.ts     # إنشاء/تحديث PLE عند الترحيل
│   ├── outstanding-calculator.service.ts  # حساب Outstanding من PLE
│   └── types/
│       └── payment-ledger.types.ts
├── reconciliation/
│   ├── reconciliation.service.ts    # reconcile(partyId) + auto-match
│   └── allocation.service.ts        # إنشاء Allocation records
├── credit-note/
│   └── credit-note.service.ts       # إنشاء Credit Note (وثيقة مستقلة)
└── accounting.module.ts
```

### دور كل Service

| الخدمة | الدور |
|--------|-------|
| **PaymentLedgerService** | `createPLE(entry)` — إنشاء PLE عند Submit Invoice أو Payment. `deletePLEForVoucher()` عند Cancel. ربط GL بـ Subledger. |
| **OutstandingCalculatorService** | `getOutstanding(voucherType, voucherId)` — يحسب من PLE: Total − Allocated. `getPartyOutstanding(partyType, partyId)`. |
| **ReconciliationService** | `getOpenInvoices(partyId)`, `getUnallocatedPayments(partyId)`. `reconcile(partyId, allocations[])` — ينشئ AllocationRecords ويحدّث PLE. `suggestMatches(partyId)`. |
| **AllocationService** | `allocate(paymentId, allocations[])` — توزيع دفعة على فواتير. التحقق من عدم تجاوز outstanding. إنشاء PaymentAllocation records. |
| **CreditNoteService** | `createCreditNote(invoiceId, amount, reason)` — إنشاء وثيقة Credit Note، GL، PLE. ربطها بالفاتورة الأصلية. |

---

## 4️⃣ إنشاء Payment Ledger Table

### جدول PaymentLedgerEntry

```prisma
model PaymentLedgerEntry {
  id                   Int      @id @default(autoincrement())
  companyId            Int?     @map("company_id")
  partyType            String   @map("party_type")   // 'customer', 'supplier'
  partyId              Int      @map("party_id")
  accountType          String   @map("account_type") // 'receivable', 'payable'
  accountId            Int      @map("account_id")

  voucherType          String   @map("voucher_type") // 'sale', 'purchase', 'payment', 'credit_note'
  voucherId            Int      @map("voucher_id")
  voucherDetailNo      String?  @map("voucher_detail_no")

  againstVoucherType    String?  @map("against_voucher_type")
  againstVoucherId     Int?     @map("against_voucher_id")

  amount               Int      @map("amount")       // موجب للذمم المدينة (زيادة)، سالِب للنقصان
  amountInAccountCurr  Int?     @map("amount_in_account_currency")
  accountCurrency      String?  @map("account_currency")
  exchangeRate         Float?   @map("exchange_rate")

  postingDate          DateTime @map("posting_date")
  dueDate              DateTime? @map("due_date")
  costCenterId         Int?     @map("cost_center_id")
  remarks              String?
  delinked             Boolean  @default(false) @map("delinked")

  createdAt            DateTime @default(now()) @map("created_at")

  company    Company?    @relation(fields: [companyId], references: [id], onDelete: Restrict)
  account    Account     @relation(fields: [accountId], references: [id], onDelete: Restrict)
  costCenter CostCenter? @relation(fields: [costCenterId], references: [id], onDelete: SetNull)

  @@index([partyType, partyId])
  @@index([voucherType, voucherId])
  @@index([againstVoucherType, againstVoucherId])
  @@index([postingDate])
  @@map("payment_ledger_entries")
}
```

### لماذا PLE منفصل عن GL
- GL يسجّل التأثير على الحساب (Debit/Credit).
- PLE يسجّل التأثير على **الطرف** (Party) — أي عميل/مورد ومبلغ الذمة.
- PLE = Subledger للذمم. GL = الدفتر العام.
- الفصل يسمح بتقارير Aged Receivables/Payables دون الاعتماد على GL فقط.

### كيف يربط Subledger بالدفاتر
- كل PLE يُنشأ مقترناً بإنشاء GL Entry.
- عند Submit Invoice: GL (DR AR) + PLE (amount موجب، voucher=Sale).
- عند Payment: GL (CR AR) + PLE (amount سالِب، against_voucher=Sale).

### كيف يحل محل Debt تدريجياً
- المرحلة الأولى: إنشاء PLE موازي لـ Debt.
- المرحلة التالية: Outstanding يُحسب من PLE؛ Debt.amountPaid يُستمد من PLE (computed).
- المرحلة النهائية: إيقاف استخدام Debt كمصدر للحقيقة؛ الاحتفاظ به للتوافق الخلفي فقط.

---

## 5️⃣ Refactor Outstanding Logic

### الصيغة المستهدفة

```
Outstanding = Invoice Total
              - Sum(Allocated Payments from PLE where against_voucher = this Invoice)
              - Sum(Credit Notes applied to this Invoice)
```

### لماذا الحساب يجب أن يكون Derived
- القيمة المخزنة قابلة للخطأ والتلاعب.
- القيمة المحسوبة دائماً متسقة مع PLE و GL.
- أي تغيير في Allocation يُحدّث PLE ويُعاد حساب Outstanding تلقائياً.

### منع التحديث اليدوي
- لا `UPDATE sales SET amount_paid = ...` من أي Service.
- `amountPaid` يصبح computed أو يُحذف لاحقاً.
- الـ API يعرض `outstandingAmount` المحسوب فقط.

### منع فقدان التزامن
- أي تحديث لـ Allocation يمر عبر AllocationService فقط.
- AllocationService يحدّث PLE ثم يُعاد حساب Outstanding عبر استعلام.

### تنفيذ OutstandingCalculatorService

```typescript
async getOutstanding(voucherType: string, voucherId: number): Promise<number> {
  const entries = await this.prisma.paymentLedgerEntry.findMany({
    where: {
      OR: [
        { voucherType, voucherId },
        { againstVoucherType: voucherType, againstVoucherId: voucherId },
      ],
      delinked: false,
    },
  });
  const invoiceTotal = entries
    .filter(e => e.voucherType === voucherType && e.voucherId === voucherId && !e.againstVoucherId)
    .reduce((s, e) => s + e.amount, 0);
  const allocated = entries
    .filter(e => e.againstVoucherType === voucherType && e.againstVoucherId === voucherId)
    .reduce((s, e) => s + Math.abs(e.amount), 0);  // المدفوعات سالبة
  return invoiceTotal - allocated;
}
```

---

## 6️⃣ Partial Payment Allocation Engine

### منطق ERPNext
- يمكن دفع مبلغ وتوزيعه على عدة فواتير.
- يمكن تخصيص جزء من دفعة لفاتورة واحدة.
- يمكن وجود Advance Payment — دفعة قبل الفاتورة.

### Allocation Table

```prisma
model PaymentAllocation {
  id              Int      @id @default(autoincrement())
  paymentId       Int      @map("payment_id")
  invoiceType     String   @map("invoice_type")   // 'sale', 'purchase'
  invoiceId       Int      @map("invoice_id")
  allocatedAmount Int      @map("allocated_amount") // Minor units
  createdAt       DateTime @default(now()) @map("created_at")

  payment Payment @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@unique([paymentId, invoiceType, invoiceId])
  @@index([invoiceType, invoiceId])
  @@map("payment_allocations")
}

// إضافة إلى model Payment:
// allocations PaymentAllocation[]
```

### Validation
- `Sum(allocatedAmount) for paymentId <= Payment.amount`.
- `allocatedAmount <= Outstanding(invoiceId)`.
- منع التخصيص على مستند ملغى (docstatus=2).

### منع تجاوز outstanding
```typescript
const outstanding = await this.outstandingCalculator.getOutstanding('sale', invoiceId);
if (allocatedAmount > outstanding) {
  throw new BadRequestException({ code: 'OVER_ALLOCATION' });
}
```

### التعامل مع rounding
- استخدام نفس precision (minor units). تجنب الفروق بالتقريب عند التوزيع.
- إذا بقي فرق بسيط بعد التوزيع، يمكن إضافته لآخر فاتورة أو تسجيله كـ write-off (لاحقاً).

### Advance Payment
- Payment بدون against_voucher — يبقى في PLE كرصيد موجب (للعميل) أو سالِب (للمورد).
- عند إنشاء الفاتورة: يمكن ربطها بالدفعة المسبقة تلقائياً عبر Reconciliation.

---

## 7️⃣ Payment Reconciliation Tool

### reconcile(partyId)

```typescript
async reconcile(
  partyType: 'customer' | 'supplier',
  partyId: number,
  allocations: { paymentId: number; invoiceType: string; invoiceId: number; amount: number }[],
  userId: number
) {
  return this.prisma.$transaction(async (tx) => {
    PeriodLockGuard.check(new Date(), null, tx);
    for (const a of allocations) {
      await this.allocationService.allocate(a.paymentId, [{ invoiceType: a.invoiceType, invoiceId: a.invoiceId, amount: a.amount }], tx);
    }
  });
}
```

### خطوات الأداة
1. **جلب فواتير مفتوحة:** `getOpenInvoices(partyType, partyId)` — من PLE حيث `amount > 0` وليس ملغى.
2. **جلب مدفوعات غير مخصصة:** `getUnallocatedPayments(partyType, partyId)` — مدفوعات لم تُخصَّص بالكامل.
3. **اقتراح مطابقة تلقائية:** مطابقة بالتاريخ والمبلغ (أقدم فاتورة أولاً، أو أقرب مبلغ).
4. **السماح بتخصيص يدوي:** المستخدم يعدّل المبالغ في واجهة الجدول.
5. **إنشاء Allocation Records:** استدعاء AllocationService لكل صف.

### واجهة API

```
GET  /reconciliation/open-invoices?partyType=customer&partyId=1
GET  /reconciliation/unallocated-payments?partyType=customer&partyId=1
GET  /reconciliation/suggest?partyType=customer&partyId=1
POST /reconciliation/apply
  Body: { partyType, partyId, allocations: [{ paymentId, invoiceType, invoiceId, amount }] }
```

---

## 8️⃣ Credit Note System

### بدلاً من Void كبديل لـ Credit Note

**CreditNote** كنموذج مستقل:

```prisma
model CreditNote {
  id                Int      @id @default(autoincrement())
  creditNoteNumber  String   @unique @map("credit_note_number")
  creditNoteDate    DateTime @default(now()) @map("credit_note_date")
  docstatus         Int      @default(0) @map("docstatus")  // 0 Draft, 1 Submitted, 2 Cancelled

  originalInvoiceType String @map("original_invoice_type") // 'sale', 'purchase'
  originalInvoiceId   Int    @map("original_invoice_id")
  amount             Int    @map("amount")  // Minor units
  reason             String?
  branchId           Int?   @map("branch_id")
  createdById       Int?   @map("created_by")
  submittedAt       DateTime? @map("submitted_at")
  submittedById     Int?   @map("submitted_by")
  cancelledAt       DateTime? @map("cancelled_at")
  cancelledById     Int?   @map("cancelled_by")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  branch    Branch? @relation(...)
  createdBy User?   @relation(...)
  ...
  @@map("credit_notes")
}
```

### الفرق بين Void و Credit Note
| Void | Credit Note |
|------|-------------|
| يلغي الفاتورة بالكامل | يُخفض المستحق بمبلغ محدد |
| لا وثيقة منفصلة | وثيقة مستقلة قابلة للمراجعة |
| مناسب للإلغاء الكامل | مناسب للخصم، الإرجاع الجزئي، التصحيحات |
| يُعيد المخزون | قد يُعيد المخزون إن كان إرجاع بضاعة |

### لماذا Credit Note أفضل محاسبيًا
- وثيقة قابلة للتدقيق والربط بالفاتورة الأصلية.
- يدعم الإرجاع الجزئي والخصومات التجارية.
- متوافق مع IFRS ومعايير الفوترة الإلكترونية.

### كيف يؤثر على outstanding
- عند Submit Credit Note: PLE ب amount سالِب (للذمم المدينة) مرتبط بالفاتورة عبر `against_voucher`.
- Outstanding = Invoice Total − Allocated Payments − Credit Notes.

---

## 9️⃣ Data Migration Strategy

### تحويل Debt إلى PLE تدريجياً

1. **إنشاء PLE من Sales الحالية:**
   - لكل Sale مُرحّل (docstatus=1) مع amountDue > 0:
   - إنشاء PLE: voucherType=sale, voucherId=sale.id, amount=totalAmount, against=null.
   - إنشاء PLE سالِب لكل Payment مُرحّل: voucherType=payment, against_voucher=sale.

2. **إنشاء PLE من Purchases:**
   - نفس المنطق للشراء.

3. **Script لإنشاء PaymentLedgerEntries:**

```typescript
async migrateSalesToPLE(tx: PrismaTransaction) {
  const sales = await tx.sale.findMany({
    where: { docstatus: 1, isVoided: false },
    include: { branch: true },
  });
  for (const sale of sales) {
    if (sale.customerId && sale.totalAmount > 0) {
      await tx.paymentLedgerEntry.create({
        data: {
          partyType: 'customer',
          partyId: sale.customerId,
          accountType: 'receivable',
          accountId: await getARAccountId(),
          voucherType: 'sale',
          voucherId: sale.id,
          postingDate: sale.saleDate,
          amount: sale.totalAmount,
          dueDate: sale.dueDate,
        },
      });
    }
  }
  // ثم لكل Payment ضد هذه المبيعات: PLE سالِب مع against_voucher
}
```

4. **إيقاف استخدام amountPaid:**
   - إضافة عمود `outstanding_computed` أو الاعتماد على استعلام فقط.
   - عدم كتابة `amountPaid` من أي Service جديد.

5. **Backward compatibility:**
   - خلال الفترة الانتقالية: قراءة `amountPaid` للعرض إن لم يُوجد PLE بعد.
   - بعد اكتمال migration: عرض Outstanding المحسوب فقط.

6. **Payment الحالي و referenceType/referenceId:**
   - يمكن الإبقاء على الحقلين للتوافق مع الدفعات القديمة (تخصيص واحد لفاتورة واحدة).
   - عند migration: إنشاء PaymentAllocation لكل Payment من (referenceType, referenceId, amount).
   - الدفعات الجديدة تُسجّل عبر AllocationService وتُملأ PaymentAllocation بدل الاعتماد على referenceId فقط.

---

## 🔟 Database Changes

### جداول جديدة
- `payment_ledger_entries` (كما في القسم 4)
- `payment_allocations` (كما في القسم 6)
- `credit_notes` (كما في القسم 8)

### إضافة relation
- Payment لا يحتاج FK مباشر لـ JournalEntry إن كان الربط عبر sourceType/sourceId في JournalEntry.
- إضافة `PaymentAllocation` لربط Payment بـ Sale/Purchase.

### فهارس
- `payment_ledger_entries`: (party_type, party_id), (voucher_type, voucher_id), (against_voucher_type, against_voucher_id), posting_date.
- `payment_allocations`: (payment_id), (invoice_type, invoice_id).
- `credit_notes`: (original_invoice_type, original_invoice_id).

### Migration SQL

```sql
CREATE TABLE payment_ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id),
  party_type TEXT NOT NULL,
  party_id INTEGER NOT NULL,
  account_type TEXT NOT NULL,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  voucher_type TEXT NOT NULL,
  voucher_id INTEGER NOT NULL,
  voucher_detail_no TEXT,
  against_voucher_type TEXT,
  against_voucher_id INTEGER,
  amount INTEGER NOT NULL,
  amount_in_account_currency INTEGER,
  account_currency TEXT,
  exchange_rate REAL,
  posting_date TEXT NOT NULL,
  due_date TEXT,
  cost_center_id INTEGER,
  remarks TEXT,
  delinked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_ple_party ON payment_ledger_entries(party_type, party_id);
CREATE INDEX idx_ple_voucher ON payment_ledger_entries(voucher_type, voucher_id);
CREATE INDEX idx_ple_against ON payment_ledger_entries(against_voucher_type, against_voucher_id);
CREATE INDEX idx_ple_posting ON payment_ledger_entries(posting_date);

CREATE TABLE payment_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_type TEXT NOT NULL,
  invoice_id INTEGER NOT NULL,
  allocated_amount INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(payment_id, invoice_type, invoice_id)
);
CREATE INDEX idx_pa_invoice ON payment_allocations(invoice_type, invoice_id);

CREATE TABLE credit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_note_number TEXT UNIQUE NOT NULL,
  credit_note_date TEXT NOT NULL,
  docstatus INTEGER DEFAULT 0,
  original_invoice_type TEXT NOT NULL,
  original_invoice_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  branch_id INTEGER,
  created_by INTEGER,
  submitted_at TEXT,
  submitted_by INTEGER,
  cancelled_at TEXT,
  cancelled_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_cn_original ON credit_notes(original_invoice_type, original_invoice_id);
```

---

## 1️⃣1️⃣ Backend Guards

| Guard | المنطق |
|-------|--------|
| **PreventOverAllocation** | `allocatedAmount <= paymentRemaining` و `allocatedAmount <= invoiceOutstanding`. |
| **PeriodLockGuard** | عدم السماح بـ reconciliation أو allocation في فترة مغلقة. |
| **PreventAllocationOnCancelled** | عدم التخصيص على فاتورة أو دفعة ملغاة (docstatus=2). |
| **PreventDeleteAfterSubmit** | عدم حذف PLE أو Allocation بعد Submit. |

---

## 1️⃣2️⃣ Frontend Refactor

### 1. Invoice Screen (Sale / Purchase)
- عرض **Outstanding محسوب** (من PLE) بدل amountPaid/remaining.
- عرض **Allocations** — جدول يوضح كل دفعة مُخصّصة ومدى تخصيصها.
- عرض **Credit Notes المرتبطة** — قائمة Credit Notes للفاتورة.

### 2. Payment Screen
- عند إنشاء دفعة: **اختيار multiple invoices** وتوزيع المبلغ.
- واجهة توزيع يدوي: صف لكل فاتورة مفتوحة، حقل مبلغ للتخصيص.
- عرض **remaining balance** للدفعة بعد التخصيص.
- منع حفظ دفعة بتخصيص يتجاوز المبلغ.

### 3. Reconciliation Screen
- شاشة مخصصة: **قائمة فواتير مفتوحة** + **قائمة مدفوعات غير مخصصة**.
- **زر Auto-match:** يقترح توزيع تلقائي (أقدم فاتورة أولاً أو تطابق المبلغ).
- **Suggest matches:** عرض اقتراحات قابلة للتعديل.
- **Filter by date, party.**

### 4. Credit Note UI
- **إنشاء Credit Note من داخل Invoice:** زر "إنشاء رصيد دائن" يفتح نموذج مرتبط بالفاتورة.
- عرض **تأثيرها على الرصيد:** المبلغ المتبقي بعد Credit Note.

### مسارات الصفحات المقترحة
- `/reconciliation` — شاشة المطابقة.
- `/sales/:id` — إضافة تبويب Allocations و Credit Notes.
- `/payments/new` — نموذج مع توزيع على فواتير.
- `/credit-notes` — قائمة وإنشاء Credit Notes.

---

## 1️⃣3️⃣ Testing Strategy

| الاختبار | المطلوب |
|----------|---------|
| Partial payment | دفعة أقل من الفاتورة → تخصيص جزئي، outstanding يتحدث. |
| Over allocation | محاولة تخصيص أكثر من outstanding → خطأ. |
| Multiple allocations | دفعة واحدة لفواتير متعددة → توزيع صحيح. |
| Credit note reduces outstanding | إنشاء Credit Note → outstanding ينخفض. |
| Reversal after reconciliation | إلغاء دفعة بعد تخصيص → إزالة allocation وعكس PLE. |
| 1000 invoices stress test | تحميل 1000 فاتورة + مطابقة → أداء مقبول. |

---

## 1️⃣4️⃣ Performance Strategy

| الآلية | التنفيذ |
|--------|---------|
| Aggregation index | فهارس على (party, voucher, against, posting_date). |
| Materialized outstanding (optional) | جدول/View يُحدَّث عند كل allocation إن احتيج لأداء أسرع. |
| Caching | Cache لـ getPartyOutstanding إذا كان مُستدعى بكثافة. |
| Batch reconciliation | معالجة دفعات عند reconciliation لعدد كبير. |

---

## 1️⃣5️⃣ Deployment Plan

| المرحلة | الإجراء |
|---------|---------|
| **Phase 1: Add PLE** | إنشاء جدول PLE، PaymentLedgerService. عدم استخدامه في التدفق الأساسي بعد. |
| **Phase 2: Enable new payments via PLE** | عند Payment Submit: إنشاء PLE. عند Invoice Submit: إنشاء PLE للذمة. |
| **Phase 3: Migrate outstanding** | Script لملء PLE من البيانات الحالية. OutstandingCalculator. |
| **Phase 4: Enable reconciliation** | ReconciliationService، واجهة المطابقة، AllocationService. |
| **Phase 5: Enable credit notes** | CreditNote model، خدمة، واجهة. |
| **Phase 6: Deprecate Debt.amountPaid** | إيقاف التحديث المباشر لـ amountPaid. الاعتماد على PLE فقط. |

### Rollback Strategy
- **قبل Phase 4:** إزالة PLE من التدفق، العودة لـ amountPaid.
- **بعد Phase 4:** الاحتفاظ بجدول Allocation و PLE؛ يمكن تعطيل واجهة reconciliation.
- **بيانات:** Backup قبل migration. Script لاستعادة PLE من Debt إن لزم (معقد — تجنّب إن أمكن).

---

# النتيجة المتوقعة

بعد تنفيذ هذا الملف:
- Outstanding يصبح **Derived** من PLE وليس Stored.
- النظام يدعم **Partial + Multi-Invoice Allocation**.
- يوجد **Reconciliation حقيقي** مع اقتراح تلقائي.
- يوجد **Credit Notes** كوثائق مستقلة.
- النظام يصبح **Audit-Grade Subledger**.
- يصبح جاهزاً لبيئة **IFRS** ومراجعة خارجية.

---

**لا انتقال للمحور الخامس.** هذا الملف يختص بمحرك الذمم فقط.
