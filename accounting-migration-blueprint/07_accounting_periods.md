# 07 — Accounting Periods & Fiscal Management (ERP-Level)

**Migration Blueprint — Phase 7**  
**Target:** Implement ERPNext-style fiscal management (Fiscal Year, Accounting Periods, Period Lock, Year-End Closing).

> **Prerequisites:** Phase 01 (Chart of Accounts + Company), Phase 02 (GL Engine), Phase 03 (Posting Workflow) must be applied. Blueprint 03 introduces a basic AccountingPeriod; this blueprint expands it with Fiscal Year hierarchy and Year-End Closing.

---

## 1️⃣ Problem Statement

### مخاطر السماح بتعديل القيود التاريخية
- **عدم الثقة في الدفاتر:** أي قيد يمكن تغييره لاحقاً يقلل من مصداقية السجل المحاسبي.
- **الاحتيال:** إمكانية التلاعب بالبيانات بعد انتهاء الفترة.
- **التدقيق:** المراجع الخارجي لا يستطيع الاعتماد على قيود قابلة للتعديل دائماً.
- **الامتثال:** المعايير الدولية (IFRS, ISA) تتطلب حماية البيانات المحاسبية المغلقة.

### صعوبة التدقيق بسبب غياب الفترات المغلقة
- لا يوجد حد واضح بين "فترة مفتوحة" و "فترة مغلقة".
- المراجع لا يستطيع افتراض أن القيود حتى تاريخ معين نهائية.
- التقارير المالية قد تتغير عند إعادة فتح المعاملات القديمة.
- **Audit trail** يصبح ضعيفاً.

### الحاجة لربط كل قيد بالفترة الصحيحة
- كل JournalEntry يجب أن يُربط بـ AccountingPeriod حسب `postingDate`.
- التحقق من صلاحية الفترة قبل أي ترحيل أو تعديل.
- التقارير تفصل حسب الفترة — لا يعمل ذلك بدون ربط صريح.

### لماذا Fiscal Year و Accounting Period ضروريان للتوافق مع المعايير الدولية
- **IFRS:** التقارير المالية تُعدّ حسب سنة مالية محددة.
- **Fiscal Year:** يحدد نطاق الإغلاق السنوي وترحيل الأرباح/الخسائر.
- **Accounting Period:** فترة فرعية (شهرية/ربع سنوية) تُغلق تدريجياً.
- **Period Closing Voucher:** وثيقة رسمية تُسجّل إغلاق الفترة وتمنع المعاملات بعدها.
- **Year-End Closing:** ترحيل P&L إلى Retained Earnings وإعداد السنة الجديدة.

---

## 2️⃣ ERPNext Fiscal Architecture (Target Model)

### Fiscal Year
- فترة مالية سنوية: `year_start_date`, `year_end_date`.
- مرتبطة بالشركة.
- حالة: Open / Closed.
- عند الإغلاق: لا يُسمح بمعاملات في هذه السنة (ما عدا Opening Entry للسنة التالية).

### Accounting Period
- فترة فرعية ضمن السنة المالية (شهرية أو ربع سنوية).
- كل قيد يُربط بفترة حسب `posting_date`.
- عند إغلاق الفترة: أي محاولة إنشاء/تعديل قيد ضمنها تُرفض.

### Period Lock / Closing Voucher
- **validate_against_pcv(is_opening, posting_date, company):**
  - إذا وُجد Period Closing Voucher: لا يُسمح بقيود بتاريخ <= `period_end_date`.
  - Opening Entry: ممنوع بعد إنشاء أول PCV (حماية من إضافة أرصدة افتتاحية لاحقاً).
- **Hard Lock:** لا تعديل ولا حذف للقيود في فترة مغلقة.
- **Reopen:** إجراء رسمي (إلغاء PCV أو فتح الفترة) — يتطلب صلاحيات خاصة.

### Year-End Closing
- إنشاء **Period Closing Voucher** لفترة نهاية السنة.
- ترحيل الأرباح/الخسائر إلى حساب **Retained Earnings** (closing_account_head).
- القيود المنشأة: إغلاق حسابات الدخل والمصروفات، ترحيل صافي الربح/الخسارة.
- بعد الإغلاق: السنة المالية تُعتبر مغلقة.
- السنة التالية تبدأ بـ Opening Balances من الأرصدة المغلقة.

---

## 3️⃣ Target Architecture داخل نظامنا

### هيكل المجلدات والخدمات

```
src/fiscal/
├── fiscal-year.service.ts
├── accounting-period.service.ts
├── period-lock.service.ts
├── year-end-closing.service.ts
└── fiscal.module.ts
```

### دور كل Service

| الخدمة | الدور |
|--------|-------|
| **FiscalYearService** | CRUD للسنوات المالية. `createFromCompanySettings(companyId)`. `getFiscalYearForDate(date)`. `closeFiscalYear(id)`. ربط الفترات بالسنة. |
| **AccountingPeriodService** | إنشاء فترات (شهرية/ربع سنوية) ضمن السنة. `getPeriodForDate(date)`. `closePeriod(id)`. `reopenPeriod(id)` (بصلاحيات). ربط JournalEntry بالفترة. |
| **PeriodLockService** | `validatePostingAllowed(postingDate, companyId)` — يرمي `PERIOD_LOCKED` إن كان التاريخ ضمن فترة مغلقة. استدعاءه من GL Engine وكل عمليات Submit/Cancel. `getLastClosedDate(companyId)`. |
| **YearEndClosingService** | `runYearEndClosing(fiscalYearId, closingAccountId)` — يحسب صافي الدخل، ينشئ قيد ترحيل إلى Retained Earnings، يُغلق السنة. يتكامل مع Period Closing Voucher. |

---

## 4️⃣ Database Changes

### جدول FiscalYear

```prisma
model FiscalYear {
  id          Int      @id @default(autoincrement())
  companyId   Int      @map("company_id")
  name        String   @map("name")        // "FY-2024", "2024"
  startDate   DateTime @map("start_date")
  endDate     DateTime @map("end_date")
  status      String   @default("Open") @map("status")  // 'Open', 'Closed'
  closedAt    DateTime? @map("closed_at")
  closedById  Int?     @map("closed_by")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  company  Company                 @relation(fields: [companyId], references: [id], onDelete: Restrict)
  periods  AccountingPeriod[]
  periodClosingVouchers PeriodClosingVoucher[]

  @@unique([companyId, name])
  @@index([companyId, status])
  @@index([startDate, endDate])
  @@map("fiscal_years")
}
```

### جدول AccountingPeriod (تحديث من Blueprint 03)

```prisma
model AccountingPeriod {
  id            Int      @id @default(autoincrement())
  fiscalYearId  Int      @map("fiscal_year_id")
  name          String   @map("name")       // "Jan 2024", "Q1 2024"
  startDate     DateTime @map("start_date")
  endDate       DateTime @map("end_date")
  isClosed      Boolean  @default(false) @map("is_closed")
  closedAt      DateTime? @map("closed_at")
  closedById    Int?     @map("closed_by")
  companyId     Int?     @map("company_id")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  fiscalYear   FiscalYear  @relation(fields: [fiscalYearId], references: [id], onDelete: Restrict)
  company      Company?    @relation(fields: [companyId], references: [id], onDelete: Restrict)
  journalEntries JournalEntry[]

  @@unique([fiscalYearId, startDate])
  @@index([companyId, isClosed])
  @@index([startDate, endDate])
  @@map("accounting_periods")
}
```

### جدول PeriodClosingVoucher (وثيقة إغلاق رسمية)

```prisma
model PeriodClosingVoucher {
  id                  Int      @id @default(autoincrement())
  voucherNumber       String   @unique @map("voucher_number")
  companyId           Int      @map("company_id")
  fiscalYearId        Int      @map("fiscal_year_id")
  periodStartDate     DateTime @map("period_start_date")
  periodEndDate       DateTime @map("period_end_date")
  closingAccountId    Int      @map("closing_account_id")  // Retained Earnings
  remarks             String?
  docstatus           Int      @default(0) @map("docstatus")
  journalEntryId     Int?     @map("journal_entry_id")     // القيد الناتج
  createdAt           DateTime @default(now()) @map("created_at")
  createdById         Int?     @map("created_by")

  company  Company   @relation(fields: [companyId], references: [id], onDelete: Restrict)
  fiscalYear FiscalYear @relation(fields: [fiscalYearId], references: [id], onDelete: Restrict)
  closingAccount Account @relation(fields: [closingAccountId], references: [id], onDelete: Restrict)

  @@index([companyId, periodEndDate])
  @@map("period_closing_vouchers")
}
```

### تحديث JournalEntry

```prisma
// إضافة إلى JournalEntry:
periodId     Int?     @map("period_id")
fiscalYearId Int?     @map("fiscal_year_id")

period    AccountingPeriod? @relation(fields: [periodId], references: [id], onDelete: SetNull)
fiscalYear FiscalYear?      @relation(fields: [fiscalYearId], references: [id], onDelete: SetNull)
```

### Migration SQL

```sql
-- 016_accounting_periods_fiscal

CREATE TABLE fiscal_years (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  closed_at TEXT,
  closed_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(company_id, name)
);
CREATE INDEX idx_fy_company_status ON fiscal_years(company_id, status);
CREATE INDEX idx_fy_dates ON fiscal_years(start_date, end_date);

-- تحديث accounting_periods إن وُجدت من Blueprint 03: إضافة fiscal_year_id
ALTER TABLE accounting_periods ADD COLUMN fiscal_year_id INTEGER REFERENCES fiscal_years(id);

CREATE TABLE period_closing_vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_number TEXT NOT NULL UNIQUE,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_years(id),
  period_start_date TEXT NOT NULL,
  period_end_date TEXT NOT NULL,
  closing_account_id INTEGER NOT NULL REFERENCES accounts(id),
  remarks TEXT,
  docstatus INTEGER DEFAULT 0,
  journal_entry_id INTEGER REFERENCES journal_entries(id),
  created_at TEXT DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);
CREATE INDEX idx_pcv_company_period ON period_closing_vouchers(company_id, period_end_date);

ALTER TABLE journal_entries ADD COLUMN period_id INTEGER REFERENCES accounting_periods(id);
ALTER TABLE journal_entries ADD COLUMN fiscal_year_id INTEGER REFERENCES fiscal_years(id);
CREATE INDEX idx_je_period ON journal_entries(period_id);
CREATE INDEX idx_je_fiscal ON journal_entries(fiscal_year_id);
```

---

## 5️⃣ Backend Guards

| Guard | المنطق |
|-------|--------|
| **PeriodLockGuard** | منع إنشاء قيود في فترة مغلقة — `postingDate` ضمن `AccountingPeriod` حيث `isClosed=true` → `PERIOD_LOCKED`. |
| **ModifyAfterCloseGuard** | منع تعديل أو عكس قيود مرتبطة بفترة مغلقة. |
| **DeleteAfterYearEndGuard** | منع حذف قيود بعد Year-End (حتى مع إعادة فتح — الحذف ممنوع، العكس فقط). |
| **validate_against_pcv** | قبل أي ترحيل: التحقق من أن `postingDate > lastPCV.period_end_date`. مرجع ERPNext: `general_ledger.py::validate_against_pcv`. |
| **ReopenGuard** | فتح فترة مغلقة يتطلب صلاحية `fiscal.reopen_period` وتأكيد. |

### تنفيذ PeriodLockService

```typescript
async validatePostingAllowed(postingDate: Date, companyId: number | null, tx?: PrismaTransaction) {
  const lastClosed = await this.getLastClosedDate(companyId, tx);
  if (lastClosed && postingDate <= lastClosed) {
    throw new BadRequestException({
      code: 'PERIOD_LOCKED',
      message: `Books closed till ${lastClosed}. Cannot post before this date.`,
      messageAr: `الدفاتر مغلقة حتى ${lastClosed}. لا يمكن الترحيل قبل هذا التاريخ.`,
    });
  }
}

async getLastClosedDate(companyId: number | null, tx?: PrismaTransaction): Promise<Date | null> {
  const pcv = await (tx ?? this.prisma).periodClosingVoucher.findFirst({
    where: { companyId: companyId ?? undefined, docstatus: 1 },
    orderBy: { periodEndDate: 'desc' },
    select: { periodEndDate: true },
  });
  return pcv?.periodEndDate ?? null;
}
```

---

## 6️⃣ Frontend Refactor

### 1. Fiscal Year Screen (`/settings/fiscal-years` أو `/fiscal/years`)
- **إنشاء سنة مالية جديدة:** اسم، تاريخ البداية، النهاية (عادة من إعدادات Company).
- **إغلاق السنة السابقة:** زر إغلاق مع التحقق من إغلاق كل الفترات.
- **عرض حالة السنة:** Open / Closed.
- **قائمة السنوات:** مع فلترة حسب الشركة.

### 2. Accounting Period Screen (`/settings/accounting-periods` أو `/fiscal/periods`)
- **إنشاء الفترات:** زر "إنشاء فترات السنة" — يولّد فترات شهرية أو ربع سنوية من Fiscal Year.
- **إغلاق/فتح الفترات:** زر لكل فترة. فتح يتطلب صلاحية.
- **عرض القيود المرتبطة:** عدد القيود أو رابط لجدول القيود في الفترة.
- **فلترة حسب السنة والشركة.**

### 3. Journal Entry Screen
- **عرض الفترة الحالية:** لكل قيد — اسم الفترة ووصف الحالة (مفتوحة/مغلقة).
- **منع تعديل القيود المغلقة:** إخفاء زر التعديل أو تعطيله مع رسالة.
- **تحذير عند محاولة ترحيل بتاريخ قديم:** "التاريخ قد يكون في فترة مغلقة".
- **عند إنشاء قيد:** تعيين periodId و fiscalYearId تلقائياً حسب entryDate.

### 4. Reports Screen
- **عرض التقارير حسب الفترة:** فلتر حسب Fiscal Year و Accounting Period.
- **منع اختيار فترة مغلقة للتعديل:** التقارير للعرض فقط عند فترة مغلقة.
- **Drilldown للقيود ضمن الفترات:** من التقرير إلى قائمة القيود في الفترة.

### مكونات مقترحة
```tsx
// FiscalYearList.tsx - قائمة السنوات المالية
// FiscalYearForm.tsx - نموذج إنشاء/تعديل سنة
// AccountingPeriodList.tsx - قائمة الفترات
// PeriodClosingDialog.tsx - حوار إغلاق الفترة/السنة
// PeriodLockBanner.tsx - تنبيه عند محاولة التعديل في فترة مغلقة
```

---

## 7️⃣ Data Migration Strategy

1. **إنشاء Fiscal Years للسنوات الحالية:** من أقدم قيد إلى أحدث قيد — توليد سنوات تغطي النطاق.
2. **إنشاء Accounting Periods:** فترات شهرية لكل سنة (أو ربع سنوية حسب الإعداد).
3. **ربط القيود الحالية:** تحديث JournalEntry بـ periodId و fiscalYearId حسب entryDate.
4. **تعيين سنة مالية للمستندات:** Sale, Purchase, Payment — إضافة fiscalYearId إن لزم للتقارير.
5. **Feature flag:** `period_lock_enabled` — عند false: التحقق لا يمنع (تحذير فقط). عند true: منع كامل.

### Script Migration

```typescript
async migrateToFiscalPeriods(tx: PrismaTransaction) {
  const companyId = 1; // أو من الإعداد
  const minDate = await tx.journalEntry.findFirst({
    orderBy: { entryDate: 'asc' },
    select: { entryDate: true },
  });
  const maxDate = await tx.journalEntry.findFirst({
    orderBy: { entryDate: 'desc' },
    select: { entryDate: true },
  });
  if (!minDate || !maxDate) return;

  // إنشاء سنوات مالية (مثلاً من بداية سنة minDate إلى نهاية سنة maxDate)
  const startYear = minDate.entryDate.getFullYear();
  const endYear = maxDate.entryDate.getFullYear();
  for (let y = startYear; y <= endYear; y++) {
    const fy = await tx.fiscalYear.create({
      data: {
        companyId,
        name: `FY-${y}`,
        startDate: new Date(y, 0, 1),
        endDate: new Date(y, 11, 31),
        status: 'Open',
      },
    });
    // إنشاء فترات شهرية
    for (let m = 0; m < 12; m++) {
      await tx.accountingPeriod.create({
        data: {
          fiscalYearId: fy.id,
          companyId,
          name: `${y}-${String(m + 1).padStart(2, '0')}`,
          startDate: new Date(y, m, 1),
          endDate: new Date(y, m + 1, 0),
          isClosed: false,
        },
      });
    }
  }

  // ربط القيود بالفترات
  const entries = await tx.journalEntry.findMany({ select: { id: true, entryDate: true } });
  for (const entry of entries) {
    const period = await tx.accountingPeriod.findFirst({
      where: {
        startDate: { lte: entry.entryDate },
        endDate: { gte: entry.entryDate },
        companyId,
      },
      select: { id: true, fiscalYearId: true },
    });
    if (period) {
      await tx.journalEntry.update({
        where: { id: entry.id },
        data: { periodId: period.id, fiscalYearId: period.fiscalYearId },
      });
    }
  }
}
```

---

## 8️⃣ Year-End Closing Logic

### تدفق YearEndClosingService

1. **التحقق:** السنة السابقة مغلقة. كل فترات السنة الحالية مغلقة أو يتم إغلاق الفترة الأخيرة.
2. **حساب صافي الدخل:** مجموع (إيرادات - مصروفات) من حسابات P&L.
3. **إنشاء قيد الترحيل:**
   - DR كل حسابات الإيرادات (لإغلاقها)
   - CR كل حسابات المصروفات
   - الفرق: صافي الربح أو الخسارة
   - CR/DR Retained Earnings
4. **إنشاء PeriodClosingVoucher:** ربط القيد به.
5. **إغلاق Fiscal Year:** status = Closed.

### مثال قيد إغلاق (صافي ربح موجب)
```
DR Sales Revenue         (رصيدها)
DR Other Income          (رصيدها)
CR Cost of Goods Sold    (رصيدها)
CR Operating Expenses    (رصيدها)
CR Retained Earnings     (صافي الربح)
```

### حساب Retained Earnings
- من Chart of Accounts (3200 أو من Company settings).
- يجب أن يكون من نوع Liability أو Equity.

---

## 9️⃣ Testing Strategy

| الاختبار | المطلوب |
|----------|---------|
| Modify in closed period | محاولة تعديل قيد في فترة مغلقة → PERIOD_LOCKED. |
| Post in closed period | محاولة ترحيل بتاريخ في فترة مغلقة → PERIOD_LOCKED. |
| Year-End Closing | إغلاق سنة → التحقق من قيد الترحيل وإغلاق السنة. |
| Post after year-end | إنشاء قيد في السنة المغلقة → PERIOD_LOCKED. |
| Reopen period | فتح فترة مغلقة، تعديل، إعادة إغلاق. |
| Reports accuracy | تقارير دقيقة حسب الفترة. |
| Stress test | عمليات كثيفة عند Year-End. |

---

# النتيجة المتوقعة

بعد تنفيذ هذا الملف:
- كل قيد مرتبط **بفترة محددة** (periodId, fiscalYearId).
- **Fiscal Year** و **Accounting Period** موجودان ويعملان.
- **Period Lock** يمنع تعديل المعاملات المغلقة.
- **Year-End Closing** جاهز مع ترحيل P&L إلى Retained Earnings.
- النظام **Audit-Ready** ومتوافق مع معايير التدقيق الدولية.

---

**لا انتقال للمحور الثامن.** هذا الملف يختص بالفترات المحاسبية والإدارة المالية السنوية فقط.
