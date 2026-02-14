# 01 — Chart of Accounts Rebuild (ERP-Level)

**Migration Blueprint — Phase 1**  
**Target:** Transform current flat hierarchy to Nested Set with full accounting controls.

---

## 1️⃣ Problem Statement

### الهندسة
- الحساب مرتبط بالأب عبر `parent_account_code` (string FK to `accounts.code`). الاستعلام عن الشجرة يتطلب recursive CTE أو تحميل كامل الشجرة في الذاكرة.
- لا توجد حقول `lft`/`rgt` — أي استعلام "كل أبناء الحساب X" أو "كل أجداد الحساب Y" غير فعّال.
- لا فصل بين الحساب كمجموعة (Group) والحساب كدفتر (Ledger). أي حساب يمكن استخدامه في القيود.
- لا `report_type` — لا تمييز تلقائي بين حسابات الميزانية وحسابات قائمة الدخل.
- لا `balance_must_be` — لا فحص لطبيعة الرصيد المتوقعة.
- لا `account_currency` — افتراض عملة واحدة للنظام.
- لا `company_id` — لا تحضير لفصل الشركات لاحقاً.
- رموز الحسابات مبعثرة: `accounting.service.ts` يستخدم `1200` كـ AR بينما الـ seed يعرّف `1200` كـ Inventory و `1130` كـ AR.

### المحاسبة
- احتمال القيد على حسابات تجميعية يؤدي لقيود غير صحيحة.
- عدم وجود `root_type`/`report_type` يزيد جهد بناء التقارير المالية.
- لا آلية للتحقق من أن رصيد الحساب يطابق الطبيعة المطلوبة (مدين/دائن).

---

## 2️⃣ Target Architecture (ERP-Level)

### المبادئ
- Nested Set لكل حسابات الشركة لتسهيل استعلام الشجرة.
- `root_type` يحدد الجذر (Asset, Liability, Equity, Income, Expense).
- `report_type` يحدد نوع التقرير (Balance Sheet / Profit and Loss).
- `account_type` التشغيلي (Receivable, Payable, Stock, Bank, Cash, COGS, etc.).
- `is_group = true` → لا يُسمح بالقيود على هذا الحساب.
- `balance_must_be` (Debit | Credit) للتحقق عند تغيير طبيعة الحساب.
- `account_currency` لكل حساب ledger (للتحضير لـ multi-currency).
- `company_id` للتحضير لـ multi-company (nullable حالياً مع company افتراضي).
- طبقة تحقق (Validation Layer) تمنع القيد على الحسابات غير المؤهلة.

### تدفق البيانات
```
Account CRUD → AccountTreeBuilder (يحسب lft/rgt)
            → AccountValidator (يفحص القيود)
            → PreventGroupPostingGuard (يفحص قبل كل قيد)
```

---

## 3️⃣ Database Redesign

### 3.1 جدول `companies` (جديد)

```sql
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT,
    default_currency TEXT NOT NULL DEFAULT 'SAR',
    fiscal_year_start_month INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT chk_companies_active CHECK (is_active IN (0, 1))
);

CREATE UNIQUE INDEX idx_companies_code ON companies(code);
```

### 3.2 Prisma Model — Account (محدّث بالكامل)

```prisma
model Company {
  id                    Int      @id @default(autoincrement())
  code                  String   @unique
  name                  String
  nameEn                String?  @map("name_en")
  defaultCurrency       String   @default("SAR") @map("default_currency")
  fiscalYearStartMonth  Int      @default(1) @map("fiscal_year_start_month")
  isActive              Boolean  @default(true) @map("is_active")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  accounts Account[]

  @@map("companies")
}

model Account {
  id                Int      @id @default(autoincrement())
  code              String
  name              String
  nameEn            String?  @map("name_en")

  rootType          String   @map("root_type")
  reportType        String   @map("report_type")
  accountType       String   @map("account_type")

  parentId          Int?     @map("parent_id")
  lft               Int      @default(0)
  rgt               Int      @default(0)

  isGroup           Boolean  @default(false) @map("is_group")
  balanceMustBe     String?  @map("balance_must_be")
  accountCurrency   String?  @map("account_currency")
  companyId         Int?     @map("company_id")

  isActive          Boolean  @default(true) @map("is_active")
  isSystemAccount   Boolean  @default(false) @map("is_system_account")
  freezeAccount     Boolean  @default(false) @map("freeze_account")

  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  company           Company?  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  parent            Account?  @relation("AccountHierarchy", fields: [parentId], references: [id], onDelete: Restrict)
  childAccounts     Account[] @relation("AccountHierarchy")
  journalEntryLines JournalEntryLine[]

  @@unique([code, companyId])
  @@index([companyId])
  @@index([parentId])
  @@index([lft, rgt])
  @@index([rootType])
  @@index([reportType])
  @@index([accountType])
  @@index([isGroup])
  @@map("accounts")
}
```

**قيم `rootType`:** `Asset` | `Liability` | `Equity` | `Income` | `Expense`

**قيم `reportType`:** `Balance Sheet` | `Profit and Loss`

**قيم `accountType`:**  
`Bank` | `Cash` | `Receivable` | `Payable` | `Stock` | `Fixed Asset` |  
`Cost of Goods Sold` | `Expense Account` | `Income Account` | `Tax` |  
`Round Off` | `Current Asset` | `Current Liability` | `Equity` | `Liability` |  
`Direct Income` | `Indirect Income` | `Direct Expense` | `Indirect Expense` |  
`Stock Adjustment` | `Other`

**قيم `balanceMustBe`:** `null` | `Debit` | `Credit`

### 3.3 تحديث `journal_entry_lines`

المرجع ينتقل من `account_code` إلى `account_id` لتفادي التعارض عند تغيير الأكواد.

```prisma
model JournalEntryLine {
  id             Int      @id @default(autoincrement())
  journalEntryId Int      @map("journal_entry_id")
  lineNumber     Int      @map("line_number")
  accountId      Int      @map("account_id")
  debitAmount    Int      @default(0) @map("debit_amount")
  creditAmount   Int      @default(0) @map("credit_amount")
  description    String?
  createdAt      DateTime @default(now()) @map("created_at")

  journalEntry JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  account      Account     @relation(fields: [accountId], references: [id], onDelete: Restrict)

  @@unique([journalEntryId, lineNumber])
  @@index([accountId])
  @@map("journal_entry_lines")
}
```

### 3.4 Migration SQL (للانتقال من الـ schema الحالي)

```sql
-- Migration: 011_chart_of_accounts_rebuild
-- Prerequisites: Backup accounts, journal_entries, journal_entry_lines

PRAGMA foreign_keys = OFF;

-- Step 1: Create companies
CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_en TEXT,
    default_currency TEXT NOT NULL DEFAULT 'SAR',
    fiscal_year_start_month INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT chk_companies_active CHECK (is_active IN (0, 1))
);

INSERT INTO companies (id, code, name, default_currency) VALUES (1, 'DEFAULT', 'الشركة الافتراضية', 'SAR');

-- Step 2: Create new accounts table
CREATE TABLE accounts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT,
    root_type TEXT NOT NULL,
    report_type TEXT NOT NULL,
    account_type TEXT NOT NULL,
    parent_id INTEGER REFERENCES accounts_new(id) ON DELETE RESTRICT,
    lft INTEGER NOT NULL DEFAULT 0,
    rgt INTEGER NOT NULL DEFAULT 0,
    is_group INTEGER NOT NULL DEFAULT 0,
    balance_must_be TEXT,
    account_currency TEXT,
    company_id INTEGER REFERENCES companies(id) ON DELETE RESTRICT,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_system_account INTEGER NOT NULL DEFAULT 0,
    freeze_account INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT chk_accounts_root_type CHECK (root_type IN ('Asset', 'Liability', 'Equity', 'Income', 'Expense')),
    CONSTRAINT chk_accounts_report_type CHECK (report_type IN ('Balance Sheet', 'Profit and Loss')),
    CONSTRAINT chk_accounts_balance_must_be CHECK (balance_must_be IS NULL OR balance_must_be IN ('Debit', 'Credit')),
    CONSTRAINT chk_accounts_is_group CHECK (is_group IN (0, 1)),
    CONSTRAINT chk_accounts_is_active_new CHECK (is_active IN (0, 1)),
    CONSTRAINT uq_accounts_code_company UNIQUE (code, company_id)
);

-- Step 3: Add account_id to journal_entry_lines (temporary, before migrate)
ALTER TABLE journal_entry_lines ADD COLUMN account_id INTEGER REFERENCES accounts_new(id);

-- Step 4: Copy and transform accounts (see Data Migration section for mapping)
-- Run nested set rebuild after insert

PRAGMA foreign_keys = ON;
```

### 3.5 الفهارس المطلوبة

```sql
CREATE INDEX idx_accounts_new_company ON accounts_new(company_id);
CREATE INDEX idx_accounts_new_parent ON accounts_new(parent_id);
CREATE INDEX idx_accounts_new_lft_rgt ON accounts_new(lft, rgt);
CREATE INDEX idx_accounts_new_root_type ON accounts_new(root_type);
CREATE INDEX idx_accounts_new_report_type ON accounts_new(report_type);
CREATE INDEX idx_accounts_new_account_type ON accounts_new(account_type);
CREATE INDEX idx_accounts_new_is_group ON accounts_new(is_group);
```

---

## 4️⃣ Backend Refactor Plan

### 4.1 هيكل المجلدات

```
src/accounting/
├── chart-of-accounts/
│   ├── account.repository.ts
│   ├── account-tree-builder.service.ts
│   ├── account-validator.service.ts
│   ├── prevent-group-posting.guard.ts
│   ├── dto/
│   │   ├── create-account.dto.ts
│   │   ├── update-account.dto.ts
│   │   └── account-response.dto.ts
│   └── account.controller.ts
├── accounting.module.ts
└── accounting.service.ts
```

### 4.2 AccountRepository

```typescript
// account.repository.ts
@Injectable()
export class AccountRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: number): Promise<Account | null> {
    return this.prisma.account.findUnique({
      where: { id },
      include: { parent: true, company: true },
    });
  }

  async findByCodeAndCompany(code: string, companyId: number | null): Promise<Account | null> {
    return this.prisma.account.findFirst({
      where: { code, companyId },
    });
  }

  async findDescendants(accountId: number): Promise<Account[]> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return [];
    return this.prisma.account.findMany({
      where: { lft: { gte: account.lft }, rgt: { lte: account.rgt }, companyId: account.companyId },
      orderBy: { lft: 'asc' },
    });
  }

  async findAncestors(accountId: number): Promise<Account[]> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return [];
    return this.prisma.account.findMany({
      where: { lft: { lte: account.lft }, rgt: { gte: account.rgt } },
      orderBy: { lft: 'asc' },
    });
  }

  async hasJournalEntries(accountId: number): Promise<boolean> {
    const count = await this.prisma.journalEntryLine.count({
      where: { accountId },
    });
    return count > 0;
  }

  async hasChildAccounts(accountId: number): Promise<boolean> {
    const count = await this.prisma.account.count({
      where: { parentId: accountId },
    });
    return count > 0;
  }
}
```

### 4.3 AccountTreeBuilder

```typescript
// account-tree-builder.service.ts
@Injectable()
export class AccountTreeBuilderService {
  constructor(private prisma: PrismaService) {}

  async rebuildNestedSet(companyId: number | null): Promise<void> {
    const accounts = await this.prisma.account.findMany({
      where: { companyId },
      orderBy: [{ parentId: 'asc' }, { code: 'asc' }],
    });

    const tree = this.buildTree(accounts, null);
    let counter = 0;

    const assignLftRgt = (node: TreeAccount) => {
      node.lft = ++counter;
      for (const child of node.children) {
        assignLftRgt(child);
      }
      node.rgt = ++counter;
    };

    for (const root of tree) {
      assignLftRgt(root);
    }

    const flat = this.flattenTree(tree);
    await this.prisma.$transaction(
      flat.map((a) =>
        this.prisma.account.update({
          where: { id: a.id },
          data: { lft: a.lft, rgt: a.rgt },
        })
      )
    );
  }

  deriveRootAndReportType(accountType: string, parentAccount?: Account | null): { rootType: string; reportType: string } {
    const rootTypeMap: Record<string, string> = {
      asset: 'Asset', liability: 'Liability', equity: 'Equity', revenue: 'Income', expense: 'Expense',
      Bank: 'Asset', Cash: 'Asset', Receivable: 'Asset', Stock: 'Asset', 'Fixed Asset': 'Asset',
      Payable: 'Liability', Tax: 'Liability', 'Cost of Goods Sold': 'Expense',
      'Expense Account': 'Expense', 'Income Account': 'Income',
    };
    const rootType = rootTypeMap[accountType] ?? (parentAccount?.rootType ?? 'Asset');
    const reportType = ['Asset', 'Liability', 'Equity'].includes(rootType) ? 'Balance Sheet' : 'Profit and Loss';
    return { rootType, reportType };
  }

  private buildTree(accounts: Account[], parentId: number | null): TreeAccount[] {
    return accounts
      .filter((a) => a.parentId === parentId)
      .map((a) => ({
        ...a,
        children: this.buildTree(accounts, a.id),
      }));
  }

  private flattenTree(tree: TreeAccount[]): Array<{ id: number; lft: number; rgt: number }> {
    const result: Array<{ id: number; lft: number; rgt: number }> = [];
    for (const node of tree) {
      result.push({ id: node.id, lft: node.lft, rgt: node.rgt });
      result.push(...this.flattenTree(node.children));
    }
    return result;
  }
}
```

### 4.4 AccountValidator

```typescript
// account-validator.service.ts
@Injectable()
export class AccountValidatorService {
  constructor(
    private accountRepo: AccountRepository,
    private treeBuilder: AccountTreeBuilderService,
  ) {}

  async validateCreate(dto: CreateAccountDto, companyId: number | null): Promise<void> {
    await this.validateParentExists(dto.parentId, companyId);
    await this.validateCodeUnique(dto.code, companyId, null);
    await this.validateParentIsGroup(dto.parentId);
    await this.validateAccountTypeConsistency(dto.accountType, dto.parentId);
  }

  async validateUpdate(id: number, dto: UpdateAccountDto): Promise<void> {
    const account = await this.accountRepo.findById(id);
    if (!account) throw new NotFoundException('Account not found');

    if (dto.parentId !== undefined && dto.parentId !== account.parentId) {
      if (dto.parentId === id) throw new BadRequestException('Account cannot be its own parent');
      const parent = await this.accountRepo.findById(dto.parentId);
      if (!parent?.isGroup) throw new BadRequestException('Parent must be a group account');
      await this.validateNoCycle(id, dto.parentId);
    }

    if (dto.isGroup === false && account.isGroup) {
      const hasChildren = await this.accountRepo.hasChildAccounts(id);
      if (hasChildren) throw new BadRequestException('Cannot convert to ledger: has child accounts');
    }

    if (dto.isGroup === true && account.isGroup === false) {
      const hasEntries = await this.accountRepo.hasJournalEntries(id);
      if (hasEntries) throw new BadRequestException('Cannot convert to group: has ledger entries');
    }

    if (dto.isActive === false && account.isSystemAccount) {
      throw new BadRequestException('Cannot disable system account');
    }
  }

  async validateForDeletion(id: number): Promise<void> {
    const hasEntries = await this.accountRepo.hasJournalEntries(id);
    if (hasEntries) throw new BadRequestException('Cannot delete account with ledger entries');

    const hasChildren = await this.accountRepo.hasChildAccounts(id);
    if (hasChildren) throw new BadRequestException('Delete child accounts first');
  }

  private async validateNoCycle(accountId: number, newParentId: number): Promise<void> {
    const ancestors = await this.accountRepo.findAncestors(newParentId);
    if (ancestors.some((a) => a.id === accountId)) {
      throw new BadRequestException('Cycle detected in hierarchy');
    }
  }
}
```

### 4.5 PreventGroupPostingGuard

```typescript
// prevent-group-posting.guard.ts
@Injectable()
export class PreventGroupPostingGuard {
  constructor(private prisma: PrismaService) {}

  async validateAccountsForPosting(accountIds: number[]): Promise<void> {
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, code: true, name: true, isGroup: true, isActive: true, freezeAccount: true },
    });

    const groupAccounts = accounts.filter((a) => a.isGroup);
    if (groupAccounts.length > 0) {
      throw new BadRequestException({
        code: 'POSTING_TO_GROUP_ACCOUNT',
        message: `Cannot post to group accounts: ${groupAccounts.map((a) => a.code).join(', ')}`,
        messageAr: `لا يمكن القيد على حسابات المجموعة: ${groupAccounts.map((a) => a.name).join('، ')}`,
      });
    }

    const inactiveAccounts = accounts.filter((a) => !a.isActive);
    if (inactiveAccounts.length > 0) {
      throw new BadRequestException({
        code: 'POSTING_TO_DISABLED_ACCOUNT',
        message: `Cannot post to disabled accounts: ${inactiveAccounts.map((a) => a.code).join(', ')}`,
      });
    }

    const frozenAccounts = accounts.filter((a) => a.freezeAccount);
    if (frozenAccounts.length > 0) {
      throw new BadRequestException({
        code: 'POSTING_TO_FROZEN_ACCOUNT',
        message: `Cannot post to frozen accounts: ${frozenAccounts.map((a) => a.code).join(', ')}`,
      });
    }
  }
}
```

### 4.6 Enforcement Rules

| القاعدة | المكان | الإجراء |
|---------|--------|---------|
| منع القيد على is_group | AccountingService قبل createJournalEntry | استدعاء PreventGroupPostingGuard |
| منع القيد على حساب غير نشط | نفس Guard | رمي BadRequestException |
| منع القيد على حساب مجمد | نفس Guard | رمي BadRequestException |
| منع حذف حساب عليه قيود | AccountValidator.validateForDeletion | رمي BadRequestException |
| منع تحويل group إلى ledger إذا عليه قيود | AccountValidator.validateUpdate | رمي BadRequestException |
| منع تحويل ledger إلى group إذا له أبناء | AccountValidator.validateUpdate | رمي BadRequestException |

---

## 5️⃣ Posting Validation Rules

### قائمة التحققات قبل أي قيد

1. **منع القيد على is_group**
   - المكان: `AccountingService.createJournalEntryInternal` و `createJournalEntry`
   - الكود: استدعاء `preventGroupPostingGuard.validateAccountsForPosting(accountIds)`

2. **فرض balance_must_be**
   - اختياري في Phase 1.
   - عند تفعيله: بعد حفظ القيد، حساب الرصيد الجديد، التحقق من أن الإشارة تطابق balance_must_be.

3. **منع القيد خارج الشركة**
   - إذا وُجد `companyId` في السياق: التأكد أن كل الحسابات المستخدمة تنتمي لنفس الشركة.

4. **منع القيد على حساب غير نشط**
   - متضمن في PreventGroupPostingGuard.

5. **منع القيد على حساب مغلق (freeze)**
   - متضمن في PreventGroupPostingGuard.
   - يمكن إضافة فحص صلاحيات: فقط أدوار معينة تستطيع القيد على حسابات مجمّدة.

### تدفق التحقق في AccountingService

```typescript
async createJournalEntryInternal(tx, params) {
  const accountIds = params.lines.map((l) => l.accountId).filter(Boolean);
  await this.preventGroupPostingGuard.validateAccountsForPosting(accountIds);

  // existing debit/credit validation
  // create entry...
}
```

---

## 6️⃣ Data Migration Strategy

### 6.1 خريطة root_type و report_type من account_type الحالي

| account_type (قديم) | root_type | report_type |
|---------------------|-----------|-------------|
| asset | Asset | Balance Sheet |
| liability | Liability | Balance Sheet |
| equity | Equity | Balance Sheet |
| revenue | Income | Profit and Loss |
| expense | Expense | Profit and Loss |

### 6.2 خريطة account_type القديم → account_type التشغيلي

| code prefix | account_type تشغيلي |
|-------------|---------------------|
| 11xx (نقد، بنك) | Bank / Cash |
| 12xx, 1130 | Receivable (1130 فقط) / Stock (1200) |
| 13xx | Fixed Asset |
| 21xx | Payable |
| 2120 | Tax |
| 31xx, 32xx, 33xx | Equity |
| 4xxx | Income Account |
| 51xx | Cost of Goods Sold |
| 52xx | Expense Account |
| 53xx, 525x | Expense Account (Wastage) |
| 54xx | Expense Account (Discounts) |

### 6.3 تحديد is_group

- أي حساب له أبناء في البيانات الحالية → `is_group = true`.
- الحسابات الورقية (بدون أبناء) → `is_group = false`.

### 6.4 حل تعارض الأكواد

الـ seed الحالي:
- `1130` = Accounts Receivable
- `1200` = Inventory
- `1300` = Fixed Assets

في `accounting.service.ts`:
- `ACCOUNTS_RECEIVABLE: '1200'` ← خاطئ
- `INVENTORY: '1300'` ← خاطئ

الإجراء: تحديث `ACCOUNT_CODES` ليستخدم:
- `ACCOUNTS_RECEIVABLE: '1130'`
- `INVENTORY: '1200'`
- (لا استخدام لـ 1300 كمخزون — 1300 للأصول الثابتة)

وبعد ترحيل الـ schema:
- الانتقال من `account_code` إلى `account_id` في JournalEntryLine.
- إنشاء mapping من code إلى id عند القراءة من القيود القديمة.

### 6.5 خطوات Migration

1. إنشاء `companies` وإدخال الصف الافتراضي.
2. إنشاء `accounts_new` بالحقول الجديدة.
3. نسخ الحسابات من `accounts` إلى `accounts_new` مع تطبيق الخرائط أعلاه.
4. تشغيل `AccountTreeBuilder.rebuildNestedSet(1)`.
5. إضافة `account_id` إلى `journal_entry_lines` وملؤه بناءً على `account_code` وربط code بـ id.
6. حذف `account_code` من `journal_entry_lines` بعد التحقق.
7. إعادة تسمية الجداول: حذف `accounts` القديم، إعادة تسمية `accounts_new` إلى `accounts`.

---

## 7️⃣ Frontend Refactor

### 7.1 Tree Component

- استخدام مكون شجرة (مثلاً `@atlaskit/tree` أو `react-arborist`).
- عرض الحسابات بنظام expand/collapse.
- عرض `root_type` بصرياً (لون أو أيقونة: Asset=أزرق، Liability=أحمر، Equity=أخضر، Income=ذهبي، Expense=برتقالي).
- عرض `report_type` كنص ثانوي أو badge.

### 7.2 منع اختيار Group Account

- عند اختيار حساب للقيد (Journal Entry، أو أي مكان يُستخدم فيه الحساب): فلترة القائمة لإظهار فقط الحسابات التي `is_group = false`.
- في الـ API: `GET /accounts?postableOnly=true` يرجع فقط `is_group = false`.

### 7.3 منع حذف حساب عليه قيود

- عند الضغط على "حذف": استدعاء `GET /accounts/:id/can-delete` أو تضمين `canDelete` في تفاصيل الحساب.
- إظهار رسالة: "لا يمكن حذف الحساب لوجود قيود عليه" إذا `hasJournalEntries`.

### 7.4 تحقق الـ Drag & Drop (إن وُجد)

- عند سحب حساب تحت حساب آخر: التأكد أن الحساب المستهدف `is_group = true`.
- منع إنشاء دورات في الشجرة.

---

## 8️⃣ Concurrency & Integrity

### 8.1 Transactional Insertion

- عند إضافة/تعديل/حذف حساب: تنفيذ كل العمليات داخل `prisma.$transaction`.
- تحديث `lft`/`rgt` للشجرة داخل نفس الـ transaction.

### 8.2 Locking Subtree

- عند نقل حساب أو تغيير الأب: قفل الصفوف المتأثرة.
- استخدام `SELECT ... FOR UPDATE` إن أمكن (في SQLite يتحقق عبر transaction وعدم السماح بقراءة dirty).

### 8.3 منع الدورات في الهيكل

- قبل تغيير `parentId`: التحقق من أن الحساب الجديد ليس من نسل الحساب الحالي.
- `AccountValidator.validateNoCycle(accountId, newParentId)`.

### 8.4 Unique Constraint

- `@@unique([code, companyId])` يمنع تكرار نفس الكود في نفس الشركة.

---

## 9️⃣ Testing Plan

### 9.1 Unit Tests

- `AccountTreeBuilderService`: بناء الشجرة من قائمة flat، التحقق من lft/rgt صحيحين.
- `AccountValidatorService`: كل سيناريو (cycle، group→ledger مع قيود، إلخ).
- `PreventGroupPostingGuard`: رفض قائمة تحتوي على account بـ is_group.

### 9.2 Integration Tests

- إنشاء حساب جديد → التحقق من lft/rgt.
- نقل حساب → إعادة بناء الشجرة والتحقق من النتيجة.
- محاولة القيد على group account → رفض مع رسالة مناسبة.

### 9.3 Accounting Validation Tests

- قيد على ledger account → نجاح.
- قيد على group account → فشل.
- قيد على حساب معطّل → فشل.
- قيد على حساب مجمد → فشل.

### 9.4 Edge Case Tests

- حساب وحيد (بدون أبناء، root).
- عمق كبير (مثلاً 10 مستويات).
- نقل حساب له مئات الأحفاد.
- حذف حساب له أبناء (يفشل).

---

## 🔟 Deployment & Rollback

### 10.1 Feature Flag

- استخدام `SystemSetting`: `coa_rebuild_enabled` (boolean).
- عند `false`: استخدام الـ schema القديم و`account_code`.
- عند `true`: استخدام الـ schema الجديد و`account_id`.
- AccountingService يتحقق من الـ flag ويختار المسار المناسب.

### 10.2 Safe Migration

- تشغيل الـ migration في نافذة صيانة.
- أخذ backup قبل migration.
- تشغيل migration ضمن transaction واحدة إن أمكن.
- التحقق من عدد الصفوف قبل/بعد.
- التحقق من أن كل القيود ما زالت مرتبطة بحسابات صحيحة.

### 10.3 Backward Compatibility

- خلال فترة الانتقال: دعم كل من `account_code` و`account_id` في الـ API.
- الـ API يقبل `accountCode` أو `accountId`؛ إن وُجد `accountId` يُستخدم، وإلا يُحسب من `accountCode`.
- إيداع تنبيه عند استخدام `accountCode` لتشجيع الانتقال.

### 10.4 Rollback Plan

- استعادة backup للجداول `accounts` و`journal_entry_lines` و`companies`.
- إرجاع `ACCOUNT_CODES` إلى القيم الأصلية.
- تعطيل Feature Flag.
- إعادة تشغيل الخدمة على الـ schema القديم.
