# 01 — Chart of Accounts Rebuild — تنفيذ مكتمل

## التغييرات المُنفَّذة

### 1. Prisma Schema
- إضافة نموذج **Company** مع جدول `companies`
- تحديث **Account**: `parentId`, `lft`, `rgt`, `rootType`, `reportType`, `accountType`, `isGroup`, `balanceMustBe`, `accountCurrency`, `companyId`, `freezeAccount`
- تحديث **JournalEntryLine**: استبدال `accountCode` بـ `accountId`

### 2. Chart of Accounts Module (`src/accounting/chart-of-accounts/`)
- **AccountRepository**: `findById`, `findByCodeAndCompany`, `findDescendants`, `findAncestors`, `hasJournalEntries`, `hasChildAccounts`
- **AccountTreeBuilderService**: `rebuildNestedSet`, `deriveRootAndReportType`
- **AccountValidatorService**: `validateCreate`, `validateUpdate`, `validateForDeletion`
- **PreventGroupPostingGuard**: `validateAccountsForPosting` (يمنع القيد على group/inactive/frozen)
- **ChartOfAccountsService**: إدارة الحسابات CRUD مع التحقق
- **AccountController**: REST API للحسابات

### 3. AccountingService
- استخدام `accountId` بدلاً من `accountCode` في القيود
- إضافة `PreventGroupPostingGuard` قبل كل قيد
- دعم `accountCode` للتحويل التلقائي إلى `accountId`
- تحديث `getTrialBalance`, `getAccountLedger` لاستخدام `accountId`

### 4. Seed
- إضافة Company افتراضي
- تحديث seed الحسابات: `rootType`, `reportType`, `accountType`, `isGroup`, `parentId`
- بناء Nested Set (lft/rgt) تلقائياً

### 5. Migration
- ملف `db/migrations/009_chart_of_accounts_rebuild.sql` للمرجع

## تشغيل النظام

### قاعدة بيانات جديدة
```bash
cd app/backend
npx prisma db push
npm run db:seed
```

### قاعدة بيانات موجودة
يُنصح بإعادة التعيين والتهيئة:
```bash
npx prisma migrate reset
# أو يدوياً: حذف db.sqlite ثم db push + seed
```

## API الجديدة

| Method | Path | الوصف |
|--------|------|-------|
| GET | /accounting/accounts | قائمة الحسابات (postableOnly=true للحسابات القابلة للقيد فقط) |
| GET | /accounting/accounts/:id | حساب بـ id أو code |
| GET | /accounting/accounts/code/:code | حساب بالكود |
| GET | /accounting/accounts/:id/can-delete | هل يمكن حذف الحساب؟ |
| POST | /accounting/accounts | إنشاء حساب |
| PUT | /accounting/accounts/:id | تحديث حساب |
| DELETE | /accounting/accounts/:id | حذف حساب |
| POST | /accounting/accounts/rebuild-tree | إعادة بناء الشجرة |

## Journal Entry
- القيود تستخدم الآن `accountId` في الـ API
- `CreateJournalEntryDto.lines[].accountId` مطلوب
- لا يُسمح بالقيود على حسابات المجموعة أو المعطلة أو المجمّدة

## الفرونت اند
- خطة التنفيذ التفصيلية: `01_FRONTEND_IMPLEMENTATION_PLAN.md`
