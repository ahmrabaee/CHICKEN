# 05 — Tax Engine & VAT Architecture — تنفيذ مكتمل

## التغييرات المُنفَّذة

### 1. قاعدة البيانات (Migration 011 + Prisma)

- **TaxTemplate**: قوالب الضرائب (sales / purchases)
- **TaxTemplateItem**: بنود القالب — حساب، نسبة (basis points)، نوع الحساب (on_net_total، on_previous_row، actual)
- **SaleTaxBreakdown**، **PurchaseTaxBreakdown**: تفصيل الضريبة لكل فاتورة (اختياري)
- **Sale / Purchase**: إضافة `taxTemplateId`, `netTotal`, `totalTaxAmount`, `grandTotal`
- **Account 1125**: VAT Receivable (ضريبة قابلة للاسترداد) للمشتريات
- **SystemSetting**: `tax_engine_enabled` (افتراضي: false)

### 2. Tax Module (`src/accounting/tax/`)

| الملف | الدور |
|-------|-------|
| `types/tax.types.ts` | TaxResult, VATReport, ChargeType |
| `tax-calculation.service.ts` | calculateTaxes(templateId, netTotal, precision) |
| `tax-template.service.ts` | CRUD لقوالب الضرائب |
| `tax-engine.service.ts` | getSalesTaxGLEntries, getPurchaseTaxGLEntries |
| `vat-report.service.ts` | generateVATReport(startDate, endDate, companyId?) |
| `tax-template.controller.ts` | API: templates CRUD، vat-report |

### 3. تدفق الضريبة في المبيعات

1. إنشاء بيع مع `taxTemplateId` → حساب `netTotal`, `totalTaxAmount`, `grandTotal`
2. **getSaleGLMap** (عند tax_engine_enabled):
   - Receivable = grandTotal
   - Revenue = netTotal (صافي)
   - VAT Payable = totalTaxAmount (من TaxEngineService)
3. **createSaleVoidJournalEntry**: عكس الضريبة (DR VAT Payable)

### 4. تدفق الضريبة في المشتريات

1. إنشاء شراء مع `taxTemplateId` → حساب netTotal، totalTaxAmount، grandTotal
2. **getPurchaseGLMap** (عند tax_engine_enabled):
   - Inventory = netTotal
   - VAT Receivable = totalTaxAmount (Input VAT)
   - Payable = grandTotal

### 5. APIs

| Method | Path | الوصف |
|--------|------|-------|
| GET | `/v1/tax/templates` | قائمة قوالب الضرائب |
| GET | `/v1/tax/templates/:id` | قالب بالتفصيل |
| POST | `/v1/tax/templates` | إنشاء قالب |
| PUT | `/v1/tax/templates/:id` | تحديث قالب |
| DELETE | `/v1/tax/templates/:id` | حذف قالب |
| GET | `/v1/tax/vat-report` | تقرير VAT (query: startDate, endDate) |

## تطبيق التغييرات

### قاعدة بيانات جديدة
```bash
cd app/backend
npx prisma db push
npm run db:seed
```

### قاعدة بيانات موجودة
```bash
cd app/backend
sqlite3 prisma/dev.db < db/migrations/011_tax_engine.sql
npx prisma generate
npm run db:seed   # لإضافة tax templates و tax_engine_enabled
```

## تفعيل Tax Engine

```sql
UPDATE system_settings SET value = 'true' WHERE key = 'tax_engine_enabled';
```

## Create Sale مع ضريبة

```json
POST /v1/sales
{
  "saleType": "cash",
  "lines": [...],
  "taxTemplateId": 1
}
```

## Seed

- **VAT 15% Sales**: قالب مبيعات 15% على الحساب 2120 (VAT Payable)
- **VAT 15% Purchases**: قالب مشتريات 15% على الحساب 1125 (VAT Receivable)

## ما تبقى (اختياري)

- واجهة اختيار قالب الضريبة في شاشة البيع/الشراء
- صفحة تقرير VAT في Frontend
- إضافة tax support لـ Purchase creation (مثل Sale)
- Credit Note مع عكس الضريبة
