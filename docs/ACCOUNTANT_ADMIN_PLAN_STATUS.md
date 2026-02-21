# تقرير حالة تنفيذ خطة المحاسب والأدمن

> **التاريخ:** 2025-02-21  
> **المرجع:** `ACCOUNTANT_ADMIN_ROLES_PLAN.md`

---

## الملخص التنفيذي

| الحالة | العدد |
|--------|-------|
| تم تنفيذه | 0 |
| لم يُنفّذ | 39 |

**الخلاصة:** لم يتم تنفيذ أي عنصر من الخطة حتّى الآن.

---

## 1. الباك إند (Backend)

### 1.1 إعادة التسمية (Cashier → Accountant)

| المهمة | الحالة | الملف |
|--------|--------|-------|
| تغيير `cashier` → `accountant` في seeds | ❌ | `db/seeds/001_roles.sql` — مازال `cashier` |
| تحديث schema للسماح بـ `accountant` | ❌ | `db/schema.sql` — `chk_roles_name` يسمح بـ `cashier` فقط |
| Migration لإعادة تسمية الدور | ❌ | غير موجود |
| تحديث prisma/seed.ts | ❌ | مازال `cashier` و `CASHIER_PERMISSIONS` |
| تحديث controllers: `cashier` → `accountant` | ❌ | customers, items, categories مازالت `cashier` |

### 1.2 تفعيل RolesGuard وتوحيد الأدوار

| Controller | RolesGuard | الأدوار | الحالة |
|------------|------------|---------|--------|
| settings | ❌ | — | لا يوجد UseGuards |
| audit | ❌ | — | لا يوجد UseGuards |
| debts | ❌ | `Admin`, `Manager` | لا يوجد UseGuards، أدوار غير موجودة |
| expenses | ❌ | `Admin`, `Manager` | لا يوجد UseGuards |
| suppliers | ❌ | `admin`, `manager` | لا يوجد UseGuards |
| purchases | ❌ | — | لا يوجد UseGuards على endpoints |
| wastage | ❌ | — | لا يوجد UseGuards |
| reports | ❌ | — | لا يوجد UseGuards |

### 1.3 Controllers التي تستخدم RolesGuard حاليًا

| Controller | الحالة |
|------------|--------|
| users | ✅ يستخدم RolesGuard |
| sales | ✅ يستخدم RolesGuard (لكن `cashier` بدل `accountant`) |
| customers | ✅ (لكن `cashier` بدل `accountant`) |
| inventory | ✅ |
| items | ✅ (`cashier` بدل `accountant`) |
| categories | ✅ (`cashier` بدل `accountant`) |
| branches | ✅ |
| accounting | ✅ |

---

## 2. الفرونت إند (Frontend)

### 2.1 ملفات جديدة

| الملف | الحالة |
|-------|--------|
| `src/constants/roles.ts` | ❌ غير موجود |
| `src/hooks/useRole.ts` | ❌ غير موجود |

### 2.2 App.tsx

| المهمة | الحالة |
|--------|--------|
| تقسيم Routes (مشتركة vs أدمن فقط) | ❌ كل المسارات بدون حماية دورية |
| إضافة route `/users` | ❌ غير موجود |
| استخدام `ProtectedRoute allowedRoles={['admin']}` لمسارات الأدمن | ❌ غير مُستخدَم |

### 2.3 AppSidebar

| المهمة | الحالة |
|--------|--------|
| إضافة `adminOnly` لعناصر navigation | ❌ غير موجود |
| فلترة navigation حسب الدور | ❌ تعرض كل العناصر لكل المستخدمين |
| عرض الدور الفعلي في Footer | ❌ يعرض "المدير / Admin" ثابتاً |
| استخدام `useAuth` | ❌ لا يستخدم |
| إضافة عنصر "المستخدمين" | ❌ غير موجود (صفحة Users غير مربوطة) |

### 2.4 Dashboard

| المهمة | الحالة |
|--------|--------|
| إخفاء "أرباح اليوم" للمحاسب | ❌ تُعرض للجميع |
| إخفاء "ديون للتجار" للمحاسب | ❌ تُعرض للجميع |
| استخدام `useRole` | ❌ لا يستخدم |

### 2.5 Reports

| المهمة | الحالة |
|--------|--------|
| فلترة reportLinks حسب الدور | ❌ تعرض كل الروابط للجميع |
| إخفاء تقارير المصروفات، الأرباح، المخزون vs GL، الضرائب، ض.ق.م | ❌ غير مُطبّق |
| استخدام `useRole` | ❌ لا يستخدم |

### 2.6 Inventory

| المهمة | الحالة |
|--------|--------|
| إخفاء زر "إضافة صنف جديد" للمحاسب | ❌ ظاهر للجميع |
| إخفاء زر "تعديل الكمية" (Adjust) للمحاسب | ❌ ظاهر للجميع |
| استخدام `useRole` | ❌ لا يستخدم |

### 2.7 Users

| المهمة | الحالة |
|--------|--------|
| تحديث `rolesMap`: `cashier` → `accountant` | ❌ مازال `'cashier': { label: 'محاسب' }` |
| إضافة `'accountant'` في rolesMap | ❌ غير موجود |

### 2.8 ProtectedRoute

| المهمة | الحالة |
|--------|--------|
| إزالة/تقليل console.log | ❌ مازال موجود |

---

## 3. ما يعمل حاليًا

1. **ProtectedRoute** يدعم `allowedRoles` لكنه غير مُستخدَم في أي مسار.
2. **Users API** في الباك إند محمي بـ RolesGuard و `@Roles('admin')`.
3. **بعض Controllers** تستخدم RolesGuard (sales, customers, inventory, ...).
4. **صفحة Users** (`Users.tsx`) موجودة لكن بدون route في App.

---

## 4. ترتيب التنفيذ المقترح

للوصول لوضع يعكس الخطة بالكامل:

### المرحلة 1 — الباك إند
1. إنشاء migration: `cashier` → `accountant`.
2. تحديث `001_roles.sql` و `prisma/seed.ts`.
3. تحديث `chk_roles_name` في schema و migrations.
4. استبدال `cashier` بـ `accountant` في كل الـ controllers.
5. إضافة `UseGuards(RolesGuard)` للـ settings, audit, debts, expenses, suppliers, purchases, wastage, reports.
6. استبدال `Admin`, `Manager` بـ `admin`.

### المرحلة 2 — الفرونت إند
7. إنشاء `src/constants/roles.ts`.
8. إنشاء `src/hooks/useRole.ts`.
9. تعديل `App.tsx`: إضافة `/users`، وتقسيم المسارات مع `allowedRoles`.
10. تعديل `AppSidebar`: `adminOnly`, فلترة, عرض الدور.
11. تعديل `Dashboard.tsx`: إخفاء أرباح وديون التجار.
12. تعديل `Reports.tsx`: فلترة الروابط.
13. تعديل `Inventory.tsx`: إخفاء أزرار التعديل والإضافة.
14. تحديث `Users.tsx`: `rolesMap` لإضافة `accountant`.

---

*تم إنشاء هذا التقرير للمراجعة والتحقق من اكتمال الخطة.*
