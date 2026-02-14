# 06 — Inventory Valuation & Stock Accounting (ERP-Level)

**Migration Blueprint — Phase 6**  
**Target:** Upgrade inventory and stock accounting to match ERPNext (Stock Ledger, Warehouse→Account mapping, stock_value_difference, Stock vs GL reconciliation) while keeping current FIFO.

> **Prerequisites:** Phase 01 (Chart of Accounts), Phase 02 (GL Engine), Phase 03 (Posting Workflow) must be applied. FIFO (InventoryLot, SaleLineCostAllocation) remains the cost allocation method.

> **ملاحظة:** النظام الحالي يستخدم **Branch** كمستودع. نضيف `stockAccountId` إلى Branch. عند تعدد المستودعات لاحقاً يمكن إدخال نموذج Warehouse منفصل.

---

## 1️⃣ Problem Statement

### لماذا استخدام حساب مخزون واحد خطر في multi-warehouse
- **حالياً:** حساب واحد (1300) لكل المخزون بغض النظر عن الفرع.
- عند تعدد الفروع/المستودعات: لا يمكن معرفة قيمة المخزون لكل موقع من الدفاتر.
- التقارير المالية تفصل الأصول حسب الموقع — لا يمكن تحقيق ذلك بحساب واحد.
- **خلط الفروع:** حركة مخزون من فرع لآخر لا تُسجّل محاسبياً كـ transfer.
- **تدقيق:** المراجع لا يستطيع مطابقة رصيد المخزون الفعلي (per location) مع الدفاتر.

### لماذا عدم وجود Stock Ledger محاسبي يقلل الشفافية
- `stock_movements` يسجّل الحركات لكن بدون `stock_value_difference` ولا ربط رسمي بالـ GL.
- `Inventory.totalValue` و `averageCost` يُحدَّثان يدوياً — قابلان للخطأ والانجراف.
- لا مصدر حقيقة واحد للقيمة: FIFO يحدد التكلفة، لكن التأثير المحاسبي لا يُستنتج من دفتر مستقل.
- **ERPNext:** Stock Ledger Entry (SLE) = المصدر الرسمي. كل حركة تُسجّل مع valuation_rate و stock_value_difference.

### لماذا reconciliation بين المخزون والدفاتر ضروري
- يجب أن يتطابق: `SUM(SLE.stock_value_difference)` مع `رصيد حسابات المخزون في GL`.
- أي فرق يعني خطأ في الترحيل أو حركة مخزون لم تُترحّل.
- تقرير **Stock vs Account Value Comparison** يكتشف الفروقات ويدعم الإصلاح.
- أساس للامتثال والتدقيق.

### مخاطر تعديل المخزون دون أثر محاسبي واضح
- **createAdjustment:** يحدّث Inventory و StockMovement، لكن **لا ينشئ قيداً محاسبياً**.
- النتيجة: المخزون الفعلي يتغير دون تأثير على GL — انفصال تام بين المخزون والدفاتر.
- تلف، جرد، فرق مخزون: يجب أن يُسجّل في GL عبر حساب تعديل (Inventory Adjustment).

---

## 2️⃣ ERPNext Stock Architecture (Target Model)

### Stock Ledger Entry (SLE)
- كل حركة مخزون تُسجّل في SLE.
- الحقول: `item_code`, `warehouse`, `voucher_type`, `voucher_no`, `actual_qty`, `valuation_rate`, `stock_value`, `stock_value_difference`, `posting_date`.
- **qty:** التغيير في الكمية (موجب للدخول، سالب للخروج).
- **valuation_rate:** سعر التقييم عند الحركة.
- **stock_value_difference:** التغيير في قيمة المخزون = الأساس للقيد المحاسبي.
- SLE immutable — لا تعديل ولا حذف بعد الإنشاء.

### عند البيع
1. FIFO يحدد التكلفة (من Lots).
2. إنشاء SLE: qty سالب، valuation_rate = تكلفة الخروج، stock_value_difference = -totalCost.
3. GL Entry: DR COGS (totalCost), CR Stock Account (المرتبط بالمستودع).
4. الربط: voucher_type=voucher_no يربط SLE بالـ GL.

### Warehouse ↔ Account Mapping
- كل Warehouse له `account` (حساب المخزون المحاسبي).
- عند الترحيل: استخدام حساب المستودع المعني.
- يسمح بحسابات منفصلة لكل فرع/مستودع.

### Reconciliation Report (stock_and_account_value_comparison)
- يجمع stock_value من SLE (مجموع stock_value_difference حسب voucher).
- يجمع account_value من GL (مجموع debit - credit لحسابات المخزون).
- يقارن حسب voucher.
- يعرض الفروقات لمعالجة الترحيلات المفقودة أو الخاطئة.

---

## 3️⃣ Target Architecture داخل نظامنا

### هيكل المجلدات والخدمات

```
src/inventory/
├── stock-ledger/
│   ├── stock-ledger.service.ts        # إنشاء SLE
│   ├── stock-valuation.service.ts     # حساب stock_value_difference
│   ├── stock-account-mapper.service.ts # Branch → Account
│   └── stock-reconciliation.service.ts  # تقرير المقارنة
└── inventory.module.ts
```

### دور كل Service

| الخدمة | الدور |
|--------|-------|
| **StockLedgerService** | `createSLE(entry)` — إنشاء SLE لكل حركة (بيع، شراء، تعديل، نقل، إلخ). Immutable. |
| **StockValuationService** | `getStockValueDifference(itemId, branchId, qtyChange, unitCost, movementType)` — يحسب stock_value_difference من FIFO أو متوسط التكلفة حسب نوع الحركة. |
| **StockAccountMapperService** | `getStockAccountId(branchId)` — يرجع accountId للمخزون المرتبط بالفرع. Fallback للحساب الافتراضي إن لم يُحدَّد. |
| **StockReconciliationService** | `generateStockVsGLReport(asOfDate)` — يقارن SUM(SLE.stock_value_difference) مع رصيد GL. يعرض الفروقات. |

---

## 4️⃣ إنشاء Stock Ledger Table

### جدول StockLedgerEntry

```prisma
model StockLedgerEntry {
  id                   Int      @id @default(autoincrement())
  itemId               Int      @map("item_id")
  branchId             Int?     @map("branch_id")   // المستودع/الفرع

  voucherType          String   @map("voucher_type") // 'sale', 'purchase', 'adjustment', 'wastage', 'transfer'
  voucherId            Int      @map("voucher_id")
  voucherDetailNo      String?  @map("voucher_detail_no")

  qtyChange            Int      @map("qty_change")  // موجب للدخول، سالب للخروج (grams)
  valuationRate        Int      @map("valuation_rate") // minor units per kg
  stockValueDifference Int      @map("stock_value_difference") // minor units

  postingDate          DateTime @map("posting_date")
  postingTime          String?  @map("posting_time")
  companyId            Int?     @map("company_id")
  remarks              String?
  createdAt            DateTime @default(now()) @map("created_at")

  item    Item     @relation(fields: [itemId], references: [id], onDelete: Restrict)
  branch  Branch?  @relation("BranchStockLedger", fields: [branchId], references: [id], onDelete: SetNull)
  company Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)

  @@index([itemId, branchId])
  @@index([voucherType, voucherId])
  @@index([postingDate])
  @@index([branchId])
  @@map("stock_ledger_entries")
}
```

### الفرق بين stock_movements و StockLedgerEntry
| stock_movements | StockLedgerEntry |
|-----------------|------------------|
| جدول تشغيلي للعرض والتقارير | دفتر محاسبي للمخزون |
| quantityGrams، unitCost | qtyChange، valuationRate، **stockValueDifference** |
| قد يُستخدم لتسجيل سريع | المصدر الرسمي للتقييم والربط مع GL |
| لا ربط مباشر بالقيود | يربط مع GL عبر voucher_type/voucher_id |

- يمكن الإبقاء على stock_movements للعرض وربطه بـ SLE، أو دمج المنطق لاحقاً.
- SLE يُنشأ مع كل حركة لها أثر محاسبي.

### لماذا SLE يجب أن يكون immutable
- لا تعديل ولا حذف بعد الإنشاء.
- أي تصحيح عبر حركة عكسية (reverse) وليس عبر التعديل.
- يضمن سلامة السجل للمراجعة والتدقيق.

### لماذا هو المصدر الرسمي لقيمة المخزون
- `SUM(stock_value_difference) WHERE item_id, branch_id` = قيمة المخزون في ذلك الموقع.
- التقارير والـ reconciliation تعتمد عليه.
- Inventory.totalValue يمكن اشتقاقه من SLE أو الاحتفاظ به cached مع التحقق الدوري.

---

## 5️⃣ Warehouse → Account Mapping

### تحديث Branch (Warehouse equivalent)

```prisma
// إضافة إلى model Branch:
stockAccountId Int? @map("stock_account_id")

// Relations
stockAccount        Account?            @relation(fields: [stockAccountId], references: [id], onDelete: SetNull)
stockLedgerEntries StockLedgerEntry[]   @relation("BranchStockLedger")
```

### لماذا كل مستودع يحتاج حساب مستقل
- فصل أصول المخزون حسب الموقع.
- تقارير مالية تفصل القيمة per location.
- تحويلات بين المستودعات تُسجّل كحركتين (خروج من واحد، دخول للآخر) مع تأثير محاسبي واضح.

### كيف يؤثر على التقارير
- ميزانية الفرع: رصيد حساب مخزون الفرع.
- تقرير مخزون حسب الموقع: مجموع SLE حسب branch.
- Stock vs GL: مقارنة per account (per branch).

### كيف يمنع خلط الفروع
- كل قيد مخزون يمر عبر StockAccountMapper: يُحدَّد الحساب من branchId.
- لا قيد على حساب مخزون غير مرتبط بمستودع معروف (إلا بالحساب الافتراضي للت compat).

### Migration SQL

```sql
-- 015_inventory_stock_accounting

CREATE TABLE stock_ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  branch_id INTEGER REFERENCES branches(id),
  voucher_type TEXT NOT NULL,
  voucher_id INTEGER NOT NULL,
  voucher_detail_no TEXT,
  qty_change INTEGER NOT NULL,
  valuation_rate INTEGER NOT NULL,
  stock_value_difference INTEGER NOT NULL,
  posting_date TEXT NOT NULL,
  posting_time TEXT,
  company_id INTEGER REFERENCES companies(id),
  remarks TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_sle_item_branch ON stock_ledger_entries(item_id, branch_id);
CREATE INDEX idx_sle_voucher ON stock_ledger_entries(voucher_type, voucher_id);
CREATE INDEX idx_sle_posting ON stock_ledger_entries(posting_date);
CREATE INDEX idx_sle_branch ON stock_ledger_entries(branch_id);

ALTER TABLE branches ADD COLUMN stock_account_id INTEGER REFERENCES accounts(id);
-- تعيين الحساب الافتراضي للمخزون للفروع الحالية
UPDATE branches SET stock_account_id = (SELECT id FROM accounts WHERE code = '1300' LIMIT 1)
WHERE stock_account_id IS NULL;
```

---

## 6️⃣ Refactor Sale Flow

### الوضع الحالي
1. FIFO allocation (allocateFIFO).
2. تحديث lots و inventory.
3. createSaleJournalEntry: DR COGS, CR Inventory (حساب واحد).

### الوضع المستهدف

1. **FIFO allocation** (بدون تغيير) — allocateFIFO يعيد التكلفة الفعلية.
2. **إنشاء StockLedgerEntry** لكل allocation أو كمجموع للبيع:
   - voucherType = 'sale', voucherId = saleId
   - qtyChange = -totalWeightGrams
   - valuationRate = totalCost / (totalWeightGrams/1000)
   - stockValueDifference = -totalCost
3. **حساب stock_value_difference** = -totalCost (من FIFO).
4. **تمرير القيمة إلى GL Engine:**
   - accountId من StockAccountMapper(branchId)
   - CR stockAccount, amount = totalCost
   - DR COGS, amount = totalCost

### Flow بالتفصيل

```typescript
// في sales.service - بعد FIFO allocation وقبل accounting
const totalCost = allocations.reduce((s, a) => s + a.totalCost, 0);
const totalGrams = allocations.reduce((s, a) => s + a.quantityGrams, 0);

await this.stockLedgerService.createSLE(tx, {
  itemId: line.itemId,
  branchId: sale.branchId,
  voucherType: 'sale',
  voucherId: sale.id,
  qtyChange: -totalGrams,
  valuationRate: totalGrams > 0 ? Math.round((totalCost * 1000) / totalGrams) : 0,
  stockValueDifference: -totalCost,
  postingDate: sale.saleDate,
});

// في getSaleGLMap:
const stockAccountId = await this.stockAccountMapper.getStockAccountId(sale.branchId);
glMap.push({ accountId: cogsAccountId, debit: totalCost, description: 'COGS' });
glMap.push({ accountId: stockAccountId, credit: totalCost, description: 'Inventory reduction' });
```

### عند Void Sale
- إنشاء SLE عكسي: qtyChange موجب، stockValueDifference موجب.
- GL عكسي: CR COGS, DR Stock Account.

---

## 7️⃣ Purchase Flow

### عند شراء مخزون
1. إنشاء InventoryLot (موجود).
2. **إنشاء StockLedgerEntry:**
   - qtyChange = +totalWeightGrams
   - valuationRate = unitPurchasePrice
   - stockValueDifference = +totalCost
3. **GL Entry:**
   - DR stockAccount (من Branch/warehouse)
   - CR Payable أو Cash

```
DR Warehouse.stockAccount   totalAmount
CR Accounts Payable         amountDue
CR Cash                     amountPaid
```

---

## 8️⃣ Stock Adjustment

### عند تلف، جرد، فرق مخزون
- **إنشاء SLE** — حركة خروج أو دخول حسب نوع التعديل.
- **حساب stock_value_difference** — من متوسط التكلفة أو التكلفة المُدخلة.
- **GL Entry:**
  - تخفيض: DR Inventory Adjustment (مصروف)، CR Stock Account.
  - زيادة: DR Stock Account، CR Inventory Adjustment (دخل) أو إلغاء مصروف سابق.

### حساب Inventory Adjustment
- إضافة حساب 5320 (أو مشابه) — مصروف تعديل المخزون.
- أو استخدام Wastage Expense للحالات المشابهة لتلف معروف.

```typescript
// createAdjustment - إضافة GL
if (dto.adjustmentType === 'decrease') {
  const valueDeduct = ...; // كما هو حالياً
  glMap.push({ accountId: adjustmentExpenseAccountId, debit: valueDeduct });
  glMap.push({ accountId: stockAccountId, credit: valueDeduct });
  await this.stockLedgerService.createSLE(tx, { qtyChange: -dto.quantityGrams, stockValueDifference: -valueDeduct, ... });
} else {
  const addedValue = ...;
  glMap.push({ accountId: stockAccountId, debit: addedValue });
  glMap.push({ accountId: adjustmentExpenseAccountId, credit: addedValue }); // أو دخل
  await this.stockLedgerService.createSLE(tx, { qtyChange: dto.quantityGrams, stockValueDifference: addedValue, ... });
}
```

---

## 9️⃣ Stock vs GL Reconciliation

### generateStockVsGLReport(asOfDate, branchId?)

```typescript
interface StockVsGLRow {
  voucherType: string;
  voucherId: number;
  postingDate: Date;
  stockValue: number;      // من SLE
  accountValue: number;   // من GL
  difference: number;
  ledgerType: 'Stock Ledger Entry' | 'GL Entry (no SLE)';
}
```

### المقارنة
- **Stock value:** `SUM(sle.stock_value_difference)` مجمع حسب voucher_type, voucher_id.
- **Account value:** `SUM(debit - credit)` من JournalEntryLine حيث account في قائمة حسابات المخزون، و voucher يطابق.
- **الربط:** عبر sourceType/sourceId في JournalEntry = voucher_type/voucher_id في SLE.

### اكتشاف الفروقات
- فرق > tolerance (مثلاً 1 أو precision): تنبيه.
- أسباب محتملة: حركة مخزون بدون قيد، قيد بدون SLE، خطأ في المبلغ، تأخر في الترحيل.

### متى يُسمح بالفارق (rounding)
- فارق صغير ضمن precision (مثلاً 1 في minor units) بسبب التقريب — تحذير فقط.
- فارق كبير — يتطلب تحليل وإصلاح.

### تنفيذ مبسط

```typescript
async generateStockVsGLReport(asOfDate: Date, branchId?: number) {
  const stockAccounts = await this.getStockAccounts(branchId);
  const sleSums = await this.prisma.stockLedgerEntry.groupBy({
    by: ['voucherType', 'voucherId'],
    where: { postingDate: { lte: asOfDate }, branchId: branchId ?? undefined },
    _sum: { stockValueDifference: true },
  });
  const glSums = await this.getGLSumByVoucher(stockAccounts, asOfDate);
  // مقارنة وإرجاع الصفوف ذات الفروق
}
```

---

## 🔟 Multi-Warehouse Readiness

### نقل بين مستودعين
- **SLE مزدوج:**
  - SLE 1: خروج من المستودع المصدر (qtyChange سالب، stockValueDifference سالب).
  - SLE 2: دخول للمستودع الهدف (qtyChange موجب، stockValueDifference موجب).
- **GL:** إذا نفس الشركة ونفس نوع الحساب: قد لا يتطلب قيداً (تحويل داخلي). إذا حسابات مختلفة:
  - DR Stock Account (الهدف)
  - CR Stock Account (المصدر)
- **لا تغيير في إجمالي المخزون** للشركة — نقل فقط.

### إذا مستودع له حساب مختلف
- يجب تسجيل Transfer GL.
- المبلغ = stock_value_difference للحركة.

---

## 1️⃣1️⃣ Average Cost Support

### الحالة الحالية
- `averageCost` في Inventory — يُحدَّث يدوياً عند كل حركة.
- يُستخدم للعرض (في toInventoryResponseDto).

### هل نحافظ عليه كمؤشر؟
- نعم — كمؤشر سريع للعرض.
- يُحدَّث من: `totalValue / (currentQty/1000)` أو يُحسب من آخر SLE.

### هل يصبح مشتق من SLE؟
- **الخيار أ:** اشتقاق من `SUM(stock_value_difference) / SUM(qty)` للفترات المفتوحة.
- **الخيار ب:** الإبقاء على تحديث تدريجي عند كل حركة (كما هو) مع التحقق من SLE دورياً.

### كيف نحافظ على توافقه مع FIFO
- FIFO يحدد تكلفة الخروج — نستخدمها في SLE و GL.
- averageCost للعرض فقط — لا يُستخدم للحساب المحاسبي.
- التكلفة المحاسبية = من FIFO (عند البيع) أو من سعر الشراء (عند الشراء).

### توصية
- الإبقاء على averageCost كـ cached.
- إضافة job دوري أو تحقق: `Inventory.totalValue` يجب أن يقارب `SUM(SLE.stock_value_difference)` للصنف.
- عند وجود فرق كبير — إثارة تنبيه للمراجعة.

---

## 1️⃣2️⃣ Backend Guards

| Guard | المنطق |
|-------|--------|
| **PeriodLockGuard** | منع حركة مخزون (إن تُرحّل) في فترة مغلقة. |
| **PreventInsufficientStock** | منع البيع بدون كمية كافية (موجود في allocateFIFO). |
| **PreventDeleteSLE** | عدم تعرّض API لحذف SLE. |
| **PreventModifyValuationAfterClose** | عدم تعديل valuation أو إلغاء حركة بعد إغلاق الفترة. |

---

## 1️⃣3️⃣ Frontend Refactor

### 1. Warehouse/Branch Screen
- **اختيار stock account:** قائمة منسدلة لحسابات المخزون.
- **عرض قيمة المخزون لكل فرع:** مجموع SLE أو من Inventory.

### 2. Inventory Item Screen
- **عرض Quantity per branch:** إن وُجدت بيانات per-branch.
- **عرض Value per branch:** من SLE أو Inventory.
- **عرض FIFO layers:** من InventoryLot (موجود جزئياً).

### 3. Stock Movement Screen
- **عرض SLE history:** بدل أو بالإضافة لـ stock_movements.
- **عرض valuation rate** و **stock value difference** لكل حركة.
- فلترة حسب الصنف، الفرع، التاريخ.

### 4. Stock Reconciliation Report UI
- **صفحة جديدة:** `/reports/stock-vs-gl` أو ضمن Reports.
- **تحديد تاريخ** واختياريًا الفرع.
- **عرض Summary:** Stock Value vs Account Value.
- **عرض Drilldown:** تفاصيل الفروقات، رابط للقيود والحركات.
- **Export** Excel/PDF.

### مكونات مقترحة
```tsx
// BranchProfile.tsx - إضافة Stock Account selector
// InventoryItemDetail.tsx - عرض SLE + FIFO layers
// StockVsGLReport.tsx - تقرير المقارنة
```

---

## 1️⃣4️⃣ Data Migration Strategy

### إنشاء StockLedgerEntry من البيانات الحالية

1. **من stock_movements:** تحويل الحركات إلى SLE مع حساب stock_value_difference تقريبياً (من unitCost إن وُجد).
2. **من InventoryLot:** عند الشراء — SLE دخول. عند البيع — يُستنتج من SaleLineCostAllocation.
3. **توزيع المخزون الحالي:** إذا multi-branch — توزيع أولي حسب branchId في Inventory/InventoryLot.
4. **تعيين حساب افتراضي:** لكل Branch — stockAccountId = حساب المخزون الأساسي (1300).
5. **Feature flag:** `stock_ledger_enabled` — عند false: السلوك الحالي. عند true: إنشاء SLE مع كل حركة.

### Script Migration (مبسط)

```typescript
// للمشتريات: من InventoryLot + Purchase
for (const lot of lots) {
  await createSLE({
    itemId: lot.itemId,
    branchId: lot.branchId,
    voucherType: 'purchase',
    voucherId: lot.purchaseId,
    qtyChange: lot.totalQuantityGrams,
    valuationRate: lot.unitPurchasePrice,
    stockValueDifference: lot.totalQuantityGrams * lot.unitPurchasePrice / 1000,
    postingDate: lot.receivedAt,
  });
}
// للمبيعات: من SaleLineCostAllocation
// ...
```

---

## 1️⃣5️⃣ Testing Strategy

| الاختبار | المطلوب |
|----------|---------|
| FIFO sale | بيع مع FIFO — التحقق من SLE و GL متطابقان. |
| Multi warehouse transfer | نقل بين فرعين — SLE مزدوج، GL إن لزم. |
| Stock adjustment | تعديل زيادة/نقصان — SLE و GL. |
| Reconciliation accuracy | مقارنة يدوية — التقرير يعكس الواقع. |
| 10k stock movements stress test | أداء مقبول. |
| Concurrency test | عمليات متزامنة — عدم فقدان أو تكرار SLE. |

---

# النتيجة المتوقعة

بعد تنفيذ هذا الملف:
- يصبح لدينا **Stock Ledger رسمي** (SLE).
- كل فرع/مستودع له **حساب مخزون مستقل** (عبر stockAccountId).
- يمكن **مقارنة المخزون بالدفاتر** (تقرير Stock vs GL).
- يمكن **اكتشاف الفروقات** ومعالجتها.
- يصبح النظام **جاهز لمستودعات متعددة**.
- يصبح **Costing Audit-Ready** مع مصدر حقيقة واحد للمخزون.

---

**لا انتقال للمحور السابع.** هذا الملف يختص بتقييم المخزون والمحاسبة المخزنية فقط.
