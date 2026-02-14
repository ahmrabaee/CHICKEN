# 02 — General Ledger Engine — تنفيذ مكتمل

## التغييرات المُنفَّذة

### 1. قاعدة البيانات (Prisma + Migration)

- **CostCenter** (جدول جديد): `cost_centers` مع code, name, company_id
- **Company**: إضافة `roundOffAccountId`, `roundOffCostCenterId`, `currencyPrecision`
- **JournalEntryLine**: إضافة الحقول:
  - `debitInAccountCurrency`, `creditInAccountCurrency`, `exchangeRate`
  - `costCenterId`, `companyId`, `partyType`, `partyId`
  - `againstVoucherType`, `againstVoucherId`, `voucherDetailNo`
  - `isOpening`
- **SystemSetting**: `gl_debit_credit_tolerance`, `gl_engine_enabled`

### 2. GL Engine Module (`src/accounting/gl-engine/`)

| الملف | الدور |
|-------|-------|
| `types/gl-map.types.ts` | GLMapEntry, GLPostMetadata |
| `gl-validator.service.ts` | validateBalance, getDebitCreditAllowance |
| `gl-rounding.service.ts` | applyRoundOffIfNeeded |
| `gl-merger.service.ts` | mergeSimilarEntries, toggleDebitCreditIfNegative |
| `gl-entry.factory.ts` | createJournalEntryFromGLMap |
| `gl-engine.service.ts` | post(), reverse() |

### 3. تدفق post()

1. toggleDebitCreditIfNegative
2. mergeSimilarEntries
3. validateBalance (رمي UNBALANCED_ENTRY إذا |diff| > allowance)
4. applyRoundOffIfNeeded إذا needsRoundOff
5. validateBalance مرة أخرى
6. createJournalEntryFromGLMap

### 4. AccountingService Integration

- **GL Maps:** `getSaleGLMap`, `getSaleVoidGLMap`, `getPurchaseGLMap`, `getPaymentReceivedGLMap`, `getPaymentMadeGLMap`, `getWastageGLMap`, `getExpenseGLMap`, `getCreditNoteSaleGLMap`, `getCreditNotePurchaseGLMap`, `getInventoryAdjustmentGLMap`
- **جميع create*JournalEntry:** عند `gl_engine_enabled=true` تستخدم `glEngineService.post()`
- **reverseByVoucher:** عند GL Engine يستخدم `glEngineService.reverse()`
- **createJournalEntry (يدوي):** عند GL Engine يستخدم GL Engine
- `isGlEngineEnabled()`: قراءة من SystemSetting

### 5. Feature Flag و Seed

- `gl_engine_enabled`: `false` افتراضياً (المسار القديم)
- `gl_debit_credit_tolerance`: `5` (في الـ seed و migration)
- عند `true`: استخدام GL Engine لجميع القيود

## تطبيق التغييرات

### قاعدة بيانات جديدة
```bash
cd app/backend
npx prisma db push
npm run db:seed
```

### قاعدة بيانات موجودة
```bash
# تشغيل migration يدوياً
sqlite3 prisma/dev.db < db/migrations/010_gl_engine_enhancements.sql
npx prisma generate
```

## تفعيل GL Engine

```sql
UPDATE system_settings SET value = 'true' WHERE key = 'gl_engine_enabled';
```

## API

- **GlEngineService.post(glMap, metadata, tx?)**: ترحيل GL Map
- **GlEngineService.reverse(voucherType, voucherId, userId, tx?)**: عكس قيد
- **AccountingService.getSaleGLMap(...)**: الحصول على GL Map للبيع

## Frontend (تم تنفيذ 02_FRONTEND_IMPLEMENTATION_PLAN)

- **Types:** تحديث JournalEntryLine (debitInAccountCurrency, costCenter, isRoundOff, إلخ)
- **JournalDetailCard:** عمود مركز التكلفة، عرض العملة بعملة الحساب، مؤشر التدوير
- **Error handling:** تحسين UNBALANCED_ENTRY مع عرض الفرق
- **إعدادات المحاسبة:** تبويب في Settings — تفعيل/تعطيل GL Engine
- **Backend:** تضمين costCenter في include عند جلب JournalEntry

## ما تبقى (اختياري)

- إضافة round_off_account_id لـ Company في واجهة الإعدادات (الـ seed يضبطه حالياً)
- اختبارات الوحدة والدمج للـ GL Engine
