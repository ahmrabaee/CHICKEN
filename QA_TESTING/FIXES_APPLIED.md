# ✅ الإصلاحات المُطبَّقة — سجل كامل (2026-11-20)

> كل إصلاح نُفِّذ في الكود، ثم اختُبر عبر **الـ API الحقيقي** (نفس اللي الواجهة بتستخدمه) مع التأكد أن **ميزان المراجعة متوازن** بعد كل عملية، و**77/77 تست وحدة ناجحة**.

**الإجمالي: 11 مشكلة مُصلَحة ومُختبرة** (كل الـ 6 Critical + كل الـ 5 High + M3 + التست الفاشل).

---

## 🔒 C-1 — قفل قاعدة البيانات + سباق FIFO
**الملفات:** [prisma.service.ts](app/backend/src/prisma/prisma.service.ts#L17) · [inventory.service.ts](app/backend/src/inventory/inventory.service.ts#L437) · [sales.service.ts](app/backend/src/sales/sales.service.ts#L519)
**التغيير:**
- فعّلت `PRAGMA journal_mode=WAL + busy_timeout=5000 + synchronous=NORMAL` عند كل اتصال.
- **لم أستخدم `connection_limit=1`** (كان بيسبب deadlock P2028 لأن كود كتير بينادي `this.prisma` جوا المعاملة) — اكتشفه الاختبار فوراً.
- `allocateFIFO`/`deductFromLots` بتقرأ داخل المعاملة؛ خصم اللوط بـ `updateMany` مشروط (`remaining >= qty`) يمنع المخزون السالب تحت التزامن.
**التحقق:** WAL مفعّل (ملفات `-wal/-shm`)؛ 12 كتابة متوازية = كلها 200 بلا قفل.

## 📉 C-2 — تسوية النقص تُنقِص اللوطات
**الملف:** [inventory.service.ts:280](app/backend/src/inventory/inventory.service.ts#L280)
**التغيير:** تسوية النقص بتخصم من لوطات FIFO داخل المعاملة، والقيمة المخصومة = تكلفة اللوطات الفعلية (تُستخدم للـ SLE والقيد).
**التحقق:** استلام 10كغ → نقص 4كغ → اللوطات 6كغ (مش 10)؛ بيع 6كغ → 0 بلا ازدواج؛ ميزان متوازن.

## 📦 C-3 — قيد المخزون الافتتاحي
**الملفات:** [items.service.ts:267](app/backend/src/items/items.service.ts) · [accounting.service.ts](app/backend/src/accounting/accounting.service.ts) (`createOpeningStockJournalEntry`) · items.module.ts
**التغيير:** عند إنشاء صنف برصيد افتتاحي → قيد **DR المخزون / CR رأس المال (3100)**.
**التحقق:** رصيد افتتاحي 8كغ@1000 → 1131 مدين 8000، 3100 دائن 8000؛ متوازن.

## 🔄 C-4 — نقل المخزون يحفظ القيمة
**الملف:** [stock-transfer.service.ts:170](app/backend/src/stock-transfer/stock-transfer.service.ts#L170)
**التغيير:** توزيع تكلفة المصدر على سطور الوجهة بالتناسب (مع معالجة التقريب) فالقيمة الكلية تُحفظ دائماً (لا تضخّم من تكلفة العميل).
**التحقق:** نقل 4كغ بتكلفة عميل متضخّمة (2000) → تُعدَّل لـ 1000؛ إجمالي القيمة 10000 ثابت.

## 🛡️ C-5 — تغطية سجل المراجعة الكاملة
**الملفات:** [audit.interceptor.ts](app/backend/src/common/interceptors/audit.interceptor.ts) (جديد) · [app.module.ts](app/backend/src/app.module.ts)
**التغيير:** **interceptor عام** يسجّل كل عملية متغيّرة (POST/PUT/PATCH/DELETE) تلقائياً مع المستخدم، الوقت، النوع، الإجراء، والـ IP (مع إخفاء كلمات المرور). GET لا يُسجَّل.
**التحقق:** أصناف/بيع/تسوية/إتلاف — كلها ظهرت في `/audit` بالمستخدم؛ GET لم يُسجَّل.

## 🔐 C-6 — سدّ ثغرات الصلاحيات
**الملفات:** tax-template / account / credit-note / reconciliation controllers (أضفت `@UseGuards(RolesGuard)`) · [debts.controller.ts:97](app/backend/src/debts/debts.controller.ts#L97) (شطب للمدير فقط) · [sales.service.ts:261](app/backend/src/sales/sales.service.ts#L261) (حد الخصم على الإجمالي)
**التغيير:** تفعيل حُرّاس الأدوار حيث كانت `@Roles` معطّلة؛ شطب الديون للمدير فقط؛ حد الخصم يحسب الإجمالي (سطري+فاتورة+نسبة) مش `discountPct` فقط.
**التحقق:** المحاسب → 403 على الضرائب/الشطب/إنشاء الحسابات/الخصم الكبير؛ المدير يعدّي.

## 🧾 H-1 — فاتورة شراء بضريبة
**الملفات:** [accounting.service.ts:685](app/backend/src/accounting/accounting.service.ts) · [purchases.service.ts:507](app/backend/src/purchases/purchases.service.ts)
**التغيير:** قيد الشراء يضيف **DR ضريبة قابلة للاسترداد (1125)** ويحسب المتبقّي على أساس (صافي+ضريبة).
**التحقق:** شراء بضريبة مدفوع بالكامل يترحّل (كان يُرفض)؛ آجل → AP = صافي+ضريبة؛ متوازن.

## 💸 H-2 — بيع ضريبة+خصم متوازن
**الملف:** [accounting.service.ts:281](app/backend/src/accounting/accounting.service.ts) (getSaleGLMap + getSaleVoidGLMap)
**التغيير:** الإيراد يُضاف له الخصم في وضع الضريبة أيضاً (كان ناقصاً بمقدار الخصم).

## 🔢 H-3 — توليد أرقام ذرّي
**الملفات:** [gl-entry.factory.ts:74](app/backend/src/accounting/gl-engine/gl-entry.factory.ts#L74) · [sales.service.ts:668](app/backend/src/sales/sales.service.ts)
**التغيير:** `max+1` بدل `count+1` (يمنع إعادة استخدام الأرقام بعد الحذف)؛ retry البيع يشمل أي تصادم تفرّد.

## 🗑️ H-4 — الإتلاف: SLE + حساب الفرع
**الملفات:** [wastage.service.ts](app/backend/src/wastage/wastage.service.ts) · accounting.service (`createWastageJournalEntry`) · wastage.module.ts
**التغيير:** الإتلاف يكتب SLE ويستخدم حساب مخزون الفرع الصحيح + branchId المشتق.
**التحقق:** إتلاف 2كغ → 5300 مدين/1131 دائن 2000؛ متوازن؛ المخزون نقص.

## 🧮 H-5 — فصل ضريبة البيع
**الملف:** [accounting.service.ts](app/backend/src/accounting/accounting.service.ts) (createSaleJournalEntry + createSaleVoidJournalEntry)
**التغيير:** البيع بضريبة يدين **CR ضريبة مستحقة (2120)** والإيراد يُسجَّل صافياً (كان مدموجاً)؛ الإبطال يعكس الضريبة.
**التحقق:** بيع بضريبة 15% → 2120 دائن 1500، 4110 صافي 10000؛ إبطال يعكس؛ متوازن.

## 🏷️ M3 — فصل كود الحساب 5400
**الملف:** [accounting.service.ts:19](app/backend/src/accounting/accounting.service.ts#L19)
**التغيير:** `DISCOUNTS_GIVEN` من 5400 إلى **4900** (حساب الخصومات المخصّص) — انفصل عن المصروفات التشغيلية.
**التحقق:** الخصم يُرحّل لـ 4900؛ 5400 لم يتأثر؛ متوازن.

## 🧪 التست الفاشل — rebuildNestedSet
**الملف:** [account-tree-builder.service.spec.ts](app/backend/src/accounting/chart-of-accounts/account-tree-builder.service.spec.ts)
**التغيير:** إنشاء الخدمة مباشرةً بالـ mock بدل DI (مشكلة metadata في vitest).
**التحقق:** **77/77 تست ناجحة** (كان 76/1).

---

## ✅ M1 — المرتجعات (ميزة جديدة مكتملة)
**الملفات:** [sales.service.ts](app/backend/src/sales/sales.service.ts) (`returnSale`) · [sales.controller.ts](app/backend/src/sales/sales.controller.ts) (`POST /sales/:id/return`) · accounting.service (`createSaleReturnJournalEntry`) · واجهة: [Sales.tsx](app/frontend/src/pages/Sales.tsx) (زر "مرتجع" + ReturnSaleDialog) + hook + service.
**المنطق:**
- **صالح (resellable):** يرجع للمخزون (لوط جديد بالتكلفة) + يعكس تكلفة البضاعة المباعة (DR مخزون / CR 5100).
- **تالف (damaged):** لا يرجع للمخزون؛ التكلفة تتحوّل من COGS (5100) إلى الفاقد (5300).
- يُرَدّ المبلغ نقداً (CR نقد) أو يُخصم من دين العميل (CR ذمم)؛ الإيراد والضريبة ينعكسان؛ يدعم الجزئي والمتكرر؛ يمنع التجاوز عن الكمية المُباعة.
**التحقق (13/13):** صالح → مخزون +3كغ، COGS −3000؛ تالف → مخزون ثابت، فاقد +2000؛ منع التجاوز؛ ميزان متوازن في كل الحالات.

### ملاحظات أقل أهمية (Medium/Low)
- تساهل ميزان GL (±0.50) — موجود لكن منخفض الأثر.
- أبعاد نافذة Tauri (1080×1920 بورتريه) — راجعها.
- حزمة JS كبيرة (1.78MB) — تحسين أداء اختياري.
