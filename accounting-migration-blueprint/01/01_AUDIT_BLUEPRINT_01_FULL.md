# Blueprint 01 — مراجعة شاملة لتنفيذ الخطة (Chart of Accounts Rebuild)

**التاريخ:** فبراير 2026  
**النطاق:** `01_chart_of_accounts_rebuild.md` + `01_FRONTEND_IMPLEMENTATION_PLAN.md`  
**الغرض:** مراجعة منطق الخطة في الكود — Backend + Frontend

---

## 1️⃣ ما لم يتم تطبيقه من الخطة

### 1.1 من الخطة الرئيسية (01_chart_of_accounts_rebuild.md)

| البند | الوصف | الحالة |
|-------|-------|--------|
| **4.1 هيكل المجلدات** | الخطة تتوقع `account.controller.ts` داخل chart-of-accounts | **مخالف** — Controller موجود في `accounting.controller.ts` (توحيد مقصود) |
| **6.4 حل تعارض الأكواد** | تحديث ACCOUNT_CODES: `ACCOUNTS_RECEIVABLE: '1130'`, `INVENTORY: '1200'` | **غير مطبق** — الحالي: `1120` (AR), `1130` (Inventory) متوافق مع الـ seed الفعلي |
| **2. فرض balance_must_be** | اختياري Phase 1 — التحقق من طبيعة الرصيد بعد القيد | **غير مطبق** — لا فحص لـ balanceMustBe |
| **3. منع القيد خارج الشركة** | إذا وُجد companyId: التأكد أن كل الحسابات تنتمي لنفس الشركة | **غير مطبق** |
| **10.1 Feature Flag** | `coa_rebuild_enabled` للتبديل بين schema قديم/جديد | **غير مطبق** — تم اعتماد الـ schema الجديد مباشرة |
| **10.3 Backward Compatibility** | دعم `accountCode` و `accountId` في API مع تحذير عند استخدام accountCode | **غير مطبق** — الـ API يقبل `accountId` فقط في إنشاء القيود |
| **9. Testing Plan** | Unit Tests لـ AccountTreeBuilderService، AccountValidatorService، PreventGroupPostingGuard | **غير مطبق** — لا توجد unit tests للـ chart-of-accounts |
| **8.2 Locking Subtree** | `SELECT ... FOR UPDATE` عند نقل حساب | **غير مطبق** — SQLite لا يدعمه بشكل كامل |
| **7.4 تحقق الـ Drag & Drop** | سحب حساب تحت آخر — التأكد أن المستهدف مجموعة | **غير مطبق** — لا يوجد Drag & Drop في الواجهة |

### 1.2 من خطة الفرونت إند (01_FRONTEND_IMPLEMENTATION_PLAN.md)

| البند | الحالة |
|-------|--------|
| **rebuildAccountTree** في الـ hooks أو واجهة إعادة بناء الشجرة | **غير مؤكد** — لا يوجد استدعاء واضح لـ rebuild-tree من الواجهة |
| **توضيح "المبلغ بالشيكل"** في نماذج القيود | **غير مطبق** — التقرير 01_REPORT_MONETARY_UNITS يوصي به |

---

## 2️⃣ نقاط الضعف في الـ Backend

### 2.1 التكامل والمعاملات (Transactions)

| النقطة | التفصيل |
|--------|---------|
| **إنشاء/تحديث حساب خارج transaction واحدة** | `createAccount` ينفذ: 1) create ثم 2) rebuildNestedSet — إذا فشل rebuild بعد create تُترك بيانات غير متناسقة |
| **تحديث الحساب** | `updateAccount` يُنفذ update ثم rebuildNestedSet عند تغيير parentId — نفس المخاطرة |

### 2.2 AccountRepository

| النقطة | التفصيل |
|--------|---------|
| **findDescendants يشمل العقدة نفسها** | الاستعلام `lft >= account.lft AND rgt <= account.rgt` يعيد العقدة مع أحفادها؛ إن كان المطلوب "الأحفاد فقط" فيفضل استخدام `lft > account.lft AND rgt < account.rgt` |
| **findAncestors** | `lft <= account.lft AND rgt >= account.rgt` يعيد العقدة مع الأجداد — قد يكون مقصوداً حسب الاستخدام |

### 2.3 تحديث الحساب (updateAccount)

| النقطة | التفصيل |
|--------|---------|
| **استدعاء rebuildNestedSet** | تم إصلاح خطأ 500 سابقاً بإزالته من داخل transaction؛ لكنه يُستدعى بعد التحديث — إذا فشل قد تبقى الشجرة غير متماسكة |

### 2.4 رموز الحسابات (ACCOUNT_CODES)

| النقطة | التفصيل |
|--------|---------|
| **تعارض مع خطة 6.4** | الخطة اقترحت 1130=AR و 1200=Inventory؛ الحالي 1120=AR و 1130=Inventory — الـ seed يستخدم 1120 و 1130، والكود متوافق معه |
| **اعتماد على الأكواد** | الأنظمة الأخرى تعتمد على codes بدلاً من IDs — قد يسبب مشاكل عند إعادة هيكلة دليل الحسابات |

### 2.5 غياب التحقق من balance_must_be

- لا يُتحقق من أن رصيد الحساب يطابق `balanceMustBe` (Debit/Credit) بعد القيد.

### 2.6 غياب التحقق من companyId

- لا فحص عند القيد أن كل الحسابات المستخدمة تنتمي لنفس الشركة (عند تعدد الشركات لاحقاً).

---

## 3️⃣ نقاط الضعف أو النقص في الـ Frontend

### 3.1 واجهة إعادة بناء الشجرة

| النقطة | التفصيل |
|--------|---------|
| **زر rebuild-tree** | الـ API موجود (`POST /accounting/accounts/rebuild-tree`) لكن لا يبدو أن هناك زر أو إجراء في الواجهة لاستدعائه |
| **صلاحيات** | الخطة تتطلب دور admin — الـ API يفرض `@Roles('admin')` ولا يظهر للمستخدمين العاديين |

### 3.2 بناء الشجرة (buildAccountTree)

| النقطة | التفصيل |
|--------|---------|
| **إعادة بناء من parentId** | الواجهة تبني الشجرة من `parentId` بدلاً من استخدام ترتيب `lft` من الـ API — قد يختلف الترتيب إذا لم يكن الـ Backend يرتب بـ lft |
| **childAccounts vs _children** | الـ API يُرجع `childAccounts` لكن `buildAccountTree` يبني `_children` — لا يستخدم `childAccounts` مباشرة |

### 3.3 نموذج إنشاء القيد (JournalEntryProfile)

| النقطة | التفصيل |
|--------|---------|
| **توضيح المبلغ بالشيكل** | لا يوجد نص أو placeholder مثل "المبلغ بالشيكل" أو "10 = 10.00 ₪" (التوصية من 01_REPORT_MONETARY_UNITS) |
| **postableOnly** | ✅ مُطبق — `useAccounts(true)` يُستدعى بشكل صحيح |

### 3.4 حذف الحساب (Delete Flow)

| النقطة | التفصيل |
|--------|---------|
| **can-delete** | ✅ مُطبق — يُستدعى قبل الحذف وتعرض الرسائل المناسبة |
| **تأكيد الحذف** | يُستخدم `AlertDialog` — ✅ مناسب |

### 3.5 عرض تفاصيل الحساب (AccountProfileDialog)

| النقطة | التفصيل |
|--------|---------|
| **زر "كشف حساب"** | ✅ مُطبق — يظهر لحسابات الدفتر فقط |

### 3.6 معالجة الأخطاء

| النقطة | التفصيل |
|--------|---------|
| **أخطاء القيود** | ✅ مُطبقة — POSTING_TO_GROUP_ACCOUNT، POSTING_TO_DISABLED_ACCOUNT، POSTING_TO_FROZEN_ACCOUNT، UNBALANCED_ENTRY |
| **أخطاء الحذف** | useDeleteAccount لا يميز بوضوح بين hasEntries و hasChildren في onError — الحذف يتم عبر can-delete قبل ذلك |

### 3.7 نموذج الحساب (AccountFormDialog)

| النقطة | التفصيل |
|--------|---------|
| **قائمة نوع الحساب** | يجب أن تتطابق مع ACCOUNT_TYPES في الـ Backend |
| **حقل freezeAccount** | يجب التأكد من وجوده في نموذج التعديل |

### 3.8 BranchProfile — حسابات المخزون

| النقطة | التفصيل |
|--------|---------|
| **فلتر !a.isGroup** | ✅ مُطبق — `stockAccounts` يفلتر `!a.isGroup` |

### 3.9 Drag & Drop

| النقطة | التفصيل |
|--------|---------|
| **سحب وإفلات الحسابات** | الخطة تذكرها كـ "إن وُجد" — غير مُطبقة في الواجهة |

---

## 4️⃣ ملخص التوصيات

### أولوية عالية
1. **Transaction للـ createAccount/updateAccount** — تنفيذ create/update + rebuildNestedSet داخل transaction واحدة إن أمكن.
2. **توضيح المبلغ بالشيكل** في JournalEntryProfile.

### أولوية متوسطة
3. إضافة **زر rebuild-tree** في صفحة المحاسبة (للـ admin فقط).
4. **فحص balance_must_be** عند تفعيله (اختياري حسب متطلبات العمل).

### أولوية منخفضة
5. فحص **companyId** عند تفعيل multi-company.
6. **Unit Tests** للـ chart-of-accounts.
7. **Feature Flag** إذا لزم الدعم المزدوج لـ schema قديم/جديد.

---

**نهاية التقرير**
