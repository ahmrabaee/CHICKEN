# خطة شاملة: اعتماد المحاسب وفصل الصلاحيات عن الأدمن

> **التاريخ:** 2025-02-21  
> **الهدف:** إعادة تسمية الكاشير إلى المحاسب، وضمان فصل حقيقي بين الأدمن والمحاسب في الواجهة والباك إند.  
> **التركيز:** الفرونت إند بشكل تفصيلي.

---

## 1. التغيير الأساسي: إعادة التسمية (Cashier → Accountant)

### 1.1 المفهوم
- **الكاشير الحالي** يصبح **المحاسب**
- الاسم في النظام: `accountant` (بدلاً من `cashier`)
- الاسم بالعربية: **محاسب**

### 1.2 الملفات المطلوبة للتعديل

| الموقع | الملف | التعديل |
|--------|------|---------|
| **Database** | `db/seeds/001_roles.sql` | تغيير `cashier` → `accountant`، `كاشير/بائع` → `محاسب` |
| | `db/schema.sql` | تحديث `chk_roles_name` للسماح بـ `accountant` |
| | `db/migrations/*` | migration لإعادة تسمية الدور الموجود |
| **Prisma** | `prisma/schema.prisma` | تحديث التعليق إن وُجد |
| | `prisma/seed.ts` | `CASHIER_PERMISSIONS` → `ACCOUNTANT_PERMISSIONS`، `cashier` → `accountant` |
| **Backend** | `src/sales/sales.service.ts` | `cashierId` يبقى (اسم عمود في DB) أو نغيّر إذا كان مرجعاً للدور |
| | `src/customers/customers.controller.ts` | `@Roles('admin', 'cashier')` → `@Roles('admin', 'accountant')` |
| | `src/items/items.controller.ts` | نفس التعديل |
| | `src/categories/categories.controller.ts` | نفس التعديل |
| | جميع الـ controllers التي تستخدم `cashier` | استبدال بـ `accountant` |
| **Frontend** | `types/auth.ts` | إن وُجد enum أو type للدور |
| | `pages/Users.tsx` | `rolesMap: 'cashier'` → `'accountant'` مع `label: 'محاسب'` |
| **Settings** | `pos.cashier_max_discount_pct` | إعادة تسمية إلى `pos.accountant_max_discount_pct` (اختياري للوضوح) |

> **ملاحظة:** عمود `cashier_id` في جدول `sales` يبقى كما هو لأنه يشير إلى **المستخدم الذي نفّذ البيع** وليس الدور. لا حاجة لتغييره إلا إذا رغبت بإعادة تسمية للوضوح لاحقاً.

---

## 2. إنشاء حساب المحاسب (يُنشأ من الأدمن فقط)

### 2.1 الوضع الحالي
- صفحة **المستخدمين** (`/users`) موجودة
- الـ API `POST /users` يقتصر على `@Roles('admin')` مع `RolesGuard`

### 2.2 المطلوب
| المهمة | الحالة | التوضيح |
|--------|--------|---------|
| إنشاء المستخدم | ✅ Backend محمي | `users.controller` يستخدم `@Roles('admin')` و `RolesGuard` |
| عرض قائمة المستخدمين | ❌ يحتاج حماية | التأكد أن المحاسب لا يصل لصفحة Users أصلاً (حجب في Frontend) |
| تعديل المستخدم | ✅ admin فقط | |
| إلغاء تنشيط | ✅ admin فقط | |

**النتيجة:** إنشاء حساب المحاسب يتم من صفحة `/users` وبصلاحيات الأدمن فقط. يجب **حجب صفحة Users عن المحاسب** في الواجهة والـ API.

---

## 3. صفحات الأدمن (المحاسب لا يدخلها)

### 3.1 الصفحات المحجوبة بالكامل عن المحاسب

| # | المسار | الاسم العربي | السبب |
|---|--------|--------------|-------|
| 1 | `/settings` | الإعدادات | تعديل إعدادات النظام |
| 2 | `/users` | إدارة المستخدمين | إنشاء/تعديل المحاسبين والمديرين |
| 3 | `/branches` | الفروع | إدارة الفروع والشركات |
| 4 | `/audit` | سجل المراجعة | تدقيق أمني |
| 5 | `/traders` | التجار (الموردين) | حسب PRD: المحاسب لا يرى معلومات الموردين |
| 6 | `/traders/payables` | المستحقات | الديون المستحقة للموردين |
| 7 | `/expenses` | المصروفات | إنشاء/موافقة المصروفات |
| 8 | `/debts` | الديون | تبويب المستحقات (ما نستحق للموردين) + ملخص شامل |
| 9 | `/wastage` | الهدر | الموافقة على سجلات الهدر |
| 10 | `/inventory` (تعديل/إضافة) | المخزون | إضافة أصناف، تعديل كميات، تحويلات |
| 11 | `/purchasing` | المشتريات | إنشاء واستلام أوامر الشراء |
| 12 | `/reports/financial` | التقارير المالية | قوائم مالية مفصلة |
| 13 | `/reports/profit-loss` | قائمة الدخل | الأرباح والخسائر |
| 14 | `/reports/stock-vs-gl` | المخزون مقابل الدفاتر | مقارنة محاسبية |
| 15 | `/reports/tax` | تقارير الضرائب | بيانات ضريبية |
| 16 | `/reports/vat` | تقارير ض.ق.م | |

### 3.2 الصفحات المشتركة (الأدمن والمحاسب)

| المسار | الاسم | صلاحيات المحاسب |
|--------|------|------------------|
| `/` | لوحة التحكم | عرض محدود (بدون ملخص أرباح/مصروفات حساسة) |
| `/sales`, `/sales/new` | المبيعات، نقطة البيع | كامل |
| `/customers`, `/customers/credits` | الزبائن، الحسابات | كامل |
| `/payments`, `/reconciliation`, `/credit-notes` | المدفوعات | استلام دفعات، مطابقة، إشعارات دائنة |
| `/accounting` | المحاسبة | عرض قيود، إضافة قيد يدوي (حسب الصلاحيات) |
| `/reports/sales` | تقارير المبيعات | كامل |
| `/reports/inventory` | تقارير المخزون | عرض (بدون تكلفة إن لزم) |
| `/reports/purchases` | تقارير المشتريات | عرض |
| `/reports/wastage` | تقارير الهدر | عرض |
| `/inventory` (عرض فقط) | المخزون | عرض الأصناف والكميات دون تعديل |

---

## 4. فصل حقيقي في الباك إند (Backend)

### 4.1 المبادئ
1. **توحيد أسماء الأدوار:** استخدام `admin` و `accountant` فقط (أحرف صغيرة).
2. **تفعيل RolesGuard** على كل الـ controllers التي تحتاج حماية.
3. **إزالة الأدوار غير الموجودة:** استبدال `Admin`, `Manager` بـ `admin` في كل الـ controllers.

### 4.2 خريطة الـ Controllers والصلاحيات المطلوبة

| Controller | الصلاحيات | RolesGuard | ملاحظات |
|------------|-----------|------------|---------|
| `auth` | Public / JWT | - | |
| `users` | `admin` | ✅ | |
| `settings` | `admin` | ❌→✅ | إضافة `UseGuards(RolesGuard)` |
| `branches` | `admin` | ✅ | |
| `audit` | `admin` | ❌→✅ | إضافة RolesGuard |
| `suppliers` | `admin` | ❌→✅ | استبدال `manager` بـ `admin` |
| `debts` | `admin` (payables) | ❌→✅ | إضافة RolesGuard، تصحيح `Admin`→`admin` |
| `expenses` | `admin` (create/approve/delete) | ❌→✅ | receivables قد تكون للمحاسب |
| `wastage` | `admin` (approve), `admin`,`accountant` (create/view) | ❌→✅ | |
| `inventory` | `admin` (adjust/transfer), `admin`,`accountant` (view) | ✅ | توحيد الأدوار |
| `purchases` | `admin` (create/receive), `admin`,`accountant` (view) | ❌→✅ | |
| `sales` | `admin`,`accountant` | ✅ | تصحيح إلى `accountant` |
| `customers` | `admin`,`accountant` | ✅ | تصحيح إلى `accountant` |
| `payments` | `admin`,`accountant` | التحقق | |
| `accounting` | `admin` (settings), `admin`,`accountant` (journal) | ✅ | توحيد الأدوار |
| `reports` | `admin` (financial/profit), `admin`,`accountant` (sales) | ❌→✅ | صلاحيات دقيقة لكل endpoint |
| `items` | `admin`,`accountant` (view), `admin` (create/edit) | ✅ | تصحيح إلى `accountant` |
| `categories` | نفس items | ✅ | |

### 4.3 قائمة التعديلات في الباك إند
1. إضافة `UseGuards(RolesGuard)` لـ: `settings`, `audit`, `debts`, `expenses`, `suppliers`, `purchases`, `wastage`, `reports`
2. استبدال كل `cashier` بـ `accountant` في جميع الـ `@Roles()`
3. استبدال `Admin`, `Manager` بـ `admin` (الدور الوحيد للإدارة)
4. تحديث `prisma/seed.ts` و `001_roles.sql` لاستخدام دور `accountant` بدل `cashier`
5. إنشاء migration لإعادة تسمية الدور في قاعدة البيانات إذا وُجدت بيانات حية

---

## 5. فصل حقيقي في الفرونت إند (Frontend) — تفصيل شامل

### 5.1 البنية العامة

| الملف | الغرض |
|------|-------|
| `src/constants/roles.ts` | ثوابت الأدوار والمسارات (جديد) |
| `src/hooks/useRole.ts` | Hook للتحقق من الصلاحيات (جديد) |
| `src/App.tsx` | تقسيم المسارات حسب الصلاحيات |
| `src/components/ProtectedRoute.tsx` | حماية المسارات (موجود، يحتاج استخدام صحيح) |
| `src/components/layout/AppSidebar.tsx` | فلترة القائمة حسب الدور |
| `src/components/layout/MainLayout.tsx` | لا تغيير |
| `src/context/AuthContext.tsx` | لا تغيير (يوفّر `user.role`) |
| `src/types/auth.ts` | إضافة `Role` type إن لزم |

---

### 5.2 ثوابت الأدوار (جديد: `src/constants/roles.ts`)

```ts
// الأدوار المعرّفة في النظام
export const ROLES = {
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// المسارات المحجوبة عن المحاسب (admin فقط)
export const ADMIN_ONLY_PATHS: string[] = [
  '/settings',
  '/users',
  '/branches',
  '/audit',
  '/traders',
  '/traders/new',
  '/traders/payables',
  '/expenses',
  '/expenses/new',
  '/debts',
  '/wastage',
  '/wastage/new',
  '/purchasing',
  '/purchasing/new',
  '/reports/financial',
  '/reports/profit-loss',
  '/reports/stock-vs-gl',
  '/reports/tax',
  '/reports/vat',
];

// التحقق: هل المسار للأدمن فقط؟
export function isAdminOnlyPath(path: string): boolean {
  return ADMIN_ONLY_PATHS.some(p => path === p || path.startsWith(p + '/'));
}

// التحقق: هل المستخدم أدمن؟
export function isAdmin(role: string | undefined): boolean {
  return role === ROLES.ADMIN;
}

// أسماء الأدوار بالعربية
export const ROLE_LABELS: Record<string, string> = {
  [ROLES.ADMIN]: 'مدير',
  [ROLES.ACCOUNTANT]: 'محاسب',
};
```

---

### 5.3 Hook للصلاحيات (جديد: `src/hooks/useRole.ts`)

```ts
import { useAuth } from '@/context/AuthContext';
import { ROLES, isAdminOnlyPath } from '@/constants/roles';

export function useRole() {
  const { user } = useAuth();
  const role = user?.role;

  const isAdmin = role === ROLES.ADMIN;
  const isAccountant = role === ROLES.ACCOUNTANT;
  const canAccessPath = (path: string) => !isAdminOnlyPath(path) || isAdmin;
  const canAccessAdminPages = isAdmin;

  return { role, isAdmin, isAccountant, canAccessPath, canAccessAdminPages };
}
```

---

### 5.4 حماية المسارات في App.tsx

**الهيكل المقترح:**

```
Route (ProtectedRoute بدون allowedRoles)
  └── MainLayout
        ├── [مسارات مشتركة: admin + accountant]
        │     - /, /sales, /customers, /payments, /accounting, /reports/sales, ...
        │
        └── Route (ProtectedRoute allowedRoles={['admin']})
              - /settings, /users, /branches, /audit
              - /traders, /expenses, /debts, /wastage
              - /purchasing, /purchasing/new
              - /reports/financial, /reports/profit-loss, /reports/stock-vs-gl, /reports/tax, /reports/vat
              - /inventory/new (إضافة صنف)
```

**تنفيذ:**

1. إنشاء مسار `/users` في App.tsx (حالياً غير موجود — صفحة المستخدمين موجودة كتبويب في Settings).
2. إما إضافة route منفصل `/users` يعرض `<Users />`، أو الاعتماد على تبويب المستخدمين داخل Settings (المحاسب لا يصل Settings أصلاً).
3. تقسيم Routes إلى:
   - **مشتركة:** داخل `<ProtectedRoute>` بدون `allowedRoles`
   - **أدمن فقط:** داخل `<ProtectedRoute allowedRoles={['admin']}>` كـ Route متداخل

**ملاحظة:** يفضّل إضافة `/users` كصفحة مستقلة للأدمن وتضمين رابط لها من القائمة الجانبية، مع دمج أو استبدال تبويب "المستخدمين" في Settings بالمحتوى الفعلي.

---

### 5.5 القائمة الجانبية (AppSidebar) — تفصيل

#### 5.5.1 تعديل واجهة NavItem

```ts
interface NavItem {
  title: string;
  titleAr: string;
  icon: React.ElementType;
  href?: string;
  adminOnly?: boolean;  // ← إضافة
  children?: {
    title: string;
    titleAr: string;
    href: string;
    icon: React.ElementType;
    adminOnly?: boolean;  // ← إضافة
  }[];
}
```

#### 5.5.2 عناصر القائمة وتصنيفها

| العنصر | adminOnly | ملاحظة |
|--------|-----------|--------|
| لوحة التحكم | ❌ | مشترك |
| المخزون | جزئي | المحاسب: عرض فقط — إخفاء أزرار التعديل/الإضافة داخل الصفحة |
| البيع (Sales, POS) | ❌ | مشترك |
| الشراء | ✅ | أدمن فقط |
| الزبائن | ❌ | مشترك |
| التجار | ✅ | أدمن فقط |
| المدفوعات | ❌ | مشترك |
| المصروفات | ✅ | أدمن فقط |
| الديون | ✅ | أدمن فقط |
| الهدر | ✅ | أدمن فقط |
| التقارير | جزئي | بعض الروابط أدمن فقط |
| المحاسبة | ❌ | مشترك |
| سجل المراجعة | ✅ | أدمن فقط |
| الفروع | ✅ | أدمن فقط |
| الإعدادات | ✅ | أدمن فقط |

#### 5.5.3 منطق الفلترة

```tsx
// في AppSidebar.tsx
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS, isAdmin } from '@/constants/roles';

// دالة لاختبار إخفاء عنصر
function shouldHideNavItem(item: NavItem, userRole: string | undefined): boolean {
  if (isAdmin(userRole)) return false;
  if (item.adminOnly) return true;
  if (item.children) {
    const visibleChildren = item.children.filter(c => !c.adminOnly);
    return visibleChildren.length === 0;
  }
  return false;
}

// في الـ render
const { user } = useAuth();
const visibleNav = navigation.filter(item => !shouldHideNavItem(item, user?.role));
```

#### 5.5.4 إظهار الدور في Footer

```tsx
<p className="text-sm font-medium truncate">{ROLE_LABELS[user?.role || ''] || user?.fullName}</p>
<p className="text-xs text-sidebar-muted truncate">{user?.role === 'admin' ? 'Admin' : 'Accountant'}</p>
```

---

### 5.6 لوحة التحكم (Dashboard)

**التعديلات:**
- **أرباح اليوم** (`totalProfit`): إخفاء للمحاسب.
- **ديون للتجار (ذمم دائنة)** (`payables`): إخفاء للمحاسب.

```tsx
const { isAdmin } = useRole();

// في الـ JSX: عرض StatCard لأرباح اليوم فقط إذا isAdmin
{isAdmin && (
  <StatCard title="أرباح اليوم" value={...} />
)}
{isAdmin && (
  <StatCard title="ديون للتجار (ذمم دائنة)" value={...} />
)}
```

**Backend:** إذا كان `GET /reports/dashboard` يعيد `payables` و `totalProfit`، يمكن إما:
- حذفها من الاستجابة حسب الدور، أو
- إخفاء العرض في الواجهة فقط (الأبسط).

---

### 5.7 التقارير (Reports)

**الوضع الحالي:** صفحة واحدة `/reports/:tab` مع روابط:
- المبيعات، المشتريات، المخزون، المصروفات، الأرباح والخسائر، الهدر، المخزون vs الدفاتر، ض.ق.م.

**التعديل:** فلترة `reportLinks` حسب الدور:

```tsx
const ADMIN_ONLY_REPORTS = ['/reports/expenses', '/reports/profit-loss', '/reports/stock-vs-gl', '/reports/vat', '/reports/tax', '/reports/financial'];

const visibleReportLinks = reportLinks.filter(link =>
  isAdmin ? true : !ADMIN_ONLY_REPORTS.includes(link.href)
);
```

- إذا كتب المحاسب رابط تقرير أدمن يدوياً (`/reports/profit-loss`) سيُعاد توجيهه من `ProtectedRoute` إلى `/`.

---

### 5.8 المخزون (Inventory)

**التعديلات:**
- **عرض الصنف:** للمحاسب والأدمن.
- **إضافة صنف جديد** (`/inventory/new`): حجب عن المحاسب (route أدمن فقط أو إخفاء الزر).
- **تعديل الكمية (Adjust):** إخفاء زر "تعديل الكمية" للمحاسب.
- **تبويب الفئات (Categories):** إدارة الفئات (إضافة/تعديل/حذف) للأدمن فقط — إخفاء الأزرار للمحاسب أو جعل التبويب للعرض فقط.

```tsx
const { isAdmin } = useRole();

// إخفاء زر "إضافة صنف"
{isAdmin && (
  <Button onClick={() => navigate('/inventory/new')}>إضافة صنف</Button>
)}

// إخفاء زر "تعديل الكمية" في الصف
{isAdmin && (
  <DropdownMenuItem onClick={() => setAdjustingItem(item)}>تعديل الكمية</DropdownMenuItem>
)}
```

---

### 5.9 الإعدادات (Settings)

- الصفحة كاملة أدمن فقط.
- عند الدخول عبر route protection، المحاسب يُعاد توجيهه.
- تبويب **المستخدمين** داخل Settings: يُعرض فقط للأدمن، ويمكن دمجه لاحقاً مع صفحة `/users` إن وُجدت.

---

### 5.10 التعامل مع الوصول المباشر (Direct URL)

- `ProtectedRoute` مع `allowedRoles={['admin']}` يوجّه المحاسب إلى `/` عند محاولة فتح مسار أدمن.
- يُفضّل إزالة أو تقليل `console.log` في `ProtectedRoute` في بيئة الإنتاج.

---

### 5.11 صفحة المستخدمين (Users)

**الوضع الحالي:** 
- يوجد `Users.tsx` كصفحة كاملة.
- لا يوجد route `/users` في App.tsx.
- تبويب "المستخدمين" في Settings يعرض نص مؤقت.

**المطلوب:**
1. إضافة route: `<Route path="/users" element={<Users />} />` داخل مجموعة المسارات المحمية بـ `allowedRoles={['admin']}`.
2. إضافة عنصر "المستخدمين" في القائمة الجانبية بـ `adminOnly: true` يربط إلى `/users`.
3. استبدال محتوى تبويب المستخدمين في Settings بمكون `Users` أو رابط يوجّه إلى `/users`.

---

### 5.12 قائمة ملفات الفرونت إند المتأثرة

| الملف | التعديل |
|-------|---------|
| `src/constants/roles.ts` | **جديد** |
| `src/hooks/useRole.ts` | **جديد** |
| `src/App.tsx` | تقسيم Routes، إضافة `/users` |
| `src/components/ProtectedRoute.tsx` | إزالة/تقليل console (اختياري) |
| `src/components/layout/AppSidebar.tsx` | `adminOnly`، فلترة، عرض الدور |
| `src/pages/Dashboard.tsx` | إخفاء أرباح وديون التجار للمحاسب |
| `src/pages/Reports.tsx` | فلترة reportLinks |
| `src/pages/Inventory.tsx` | إخفاء أزرار التعديل/الإضافة للمحاسب |
| `src/pages/Users.tsx` | تحديث `rolesMap`: `cashier` → `accountant` |
| `src/pages/Settings.tsx` | إخفاء تبويب المستخدمين للمحاسب (اختياري — المحاسب لا يصل أصلاً) |

---

## 6. ترتيب التنفيذ المقترح

### المرحلة الأولى: الباك إند
| # | المهمة | الأولوية |
|---|--------|----------|
| 1 | إنشاء migration لإعادة تسمية الدور `cashier`→`accountant` في DB | عالية |
| 2 | تحديث seeds وكل المراجع في Backend من `cashier` إلى `accountant` | عالية |
| 3 | إصلاح الـ controllers (إضافة RolesGuard، توحيد الأدوار) | عالية |

### المرحلة الثانية: الفرونت إند (التركيز الأساسي)
| # | المهمة | الأولوية |
|---|--------|----------|
| 4 | إنشاء `src/constants/roles.ts` | عالية |
| 5 | إنشاء `src/hooks/useRole.ts` | عالية |
| 6 | تعديل `App.tsx`: تقسيم Routes، إضافة `/users`، حماية مسارات الأدمن | عالية |
| 7 | تعديل `AppSidebar`: إضافة `adminOnly`، فلترة navigation، عرض الدور في Footer | عالية |
| 8 | تعديل `Dashboard.tsx`: إخفاء أرباح اليوم وديون التجار للمحاسب | عالية |
| 9 | تعديل `Reports.tsx`: فلترة reportLinks حسب الدور | عالية |
| 10 | تعديل `Inventory.tsx`: إخفاء أزرار التعديل/الإضافة للمحاسب | عالية |
| 11 | تحديث `Users.tsx`: `rolesMap` من `cashier` إلى `accountant` | عالية |
| 12 | ربط صفحة Users بالقائمة الجانبية و route `/users` | عالية |

### المرحلة الثالثة: التحسينات
| # | المهمة | الأولوية |
|---|--------|----------|
| 13 | تحديث إعدادات `pos.accountant_max_discount_pct` | منخفضة |
| 14 | إزالة/تقليل console.log في ProtectedRoute | منخفضة |
| 15 | مراجعة صلاحيات دقيقة لكل report/endpoint في الباك إند | متوسطة |

---

## 7. ملخص الصلاحيات النهائية

### 7.1 الأدمن
- الوصول الكامل لجميع الصفحات والـ APIs.
- إنشاء وتعديل وإلغاء المستخدمين (بما في ذلك المحاسبين).

### 7.2 المحاسب
- **يصل:** المبيعات، الزبائن، المدفوعات، المحاسبة (عرض/قيود يدوية)، تقارير المبيعات والمخزون، عرض المخزون، إنشاء سجل هدر.
- **لا يصل:** الإعدادات، المستخدمين، الفروع، سجل المراجعة، التجار، المستحقات، المصروفات، الديون (المستحقات)، موافقة الهدر، تعديل المخزون، المشتريات (إنشاء/استلام)، التقارير المالية والأرباح والضرائب.

---

## 8. ملحق: هيكل الملفات المتأثرة

```
app/
├── backend/
│   ├── db/
│   │   ├── seeds/001_roles.sql
│   │   ├── schema.sql
│   │   └── migrations/ (جديد: rename_cashier_to_accountant.sql)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── auth/auth.service.ts
│       ├── settings/settings.controller.ts
│       ├── audit/audit.controller.ts
│       ├── debts/debts.controller.ts
│       ├── expenses/expenses.controller.ts
│       ├── suppliers/suppliers.controller.ts
│       ├── purchases/purchases.controller.ts
│       ├── wastage/wastage.controller.ts
│       ├── reports/reports.controller.ts
│       ├── sales/sales.service.ts
│       ├── customers/customers.controller.ts
│       ├── items/items.controller.ts
│       └── categories/categories.controller.ts
├── frontend/
│   └── src/
│       ├── constants/
│       │   └── roles.ts                    ← جديد
│       ├── hooks/
│       │   └── useRole.ts                  ← جديد
│       ├── App.tsx                         ← تعديل (تقسيم Routes)
│       ├── components/
│       │   ├── ProtectedRoute.tsx         ← تعديل طفيف (اختياري)
│       │   └── layout/
│       │       └── AppSidebar.tsx         ← تعديل (فلترة، adminOnly، عرض الدور)
│       ├── context/
│       │   └── AuthContext.tsx            (بدون تغيير)
│       └── pages/
│           ├── Dashboard.tsx              ← تعديل (إخفاء أرباح/ديون التجار)
│           ├── Reports.tsx                ← تعديل (فلترة الروابط)
│           ├── Inventory.tsx               ← تعديل (إخفاء أزرار التعديل)
│           ├── Users.tsx                  ← تعديل (rolesMap)
│           └── Settings.tsx               (بدون تغيير أو ربط بـ /users)
docs/
└── ACCOUNTANT_ADMIN_ROLES_PLAN.md         (هذا الملف)
```

---

## 9. ملخص مرئي: ما يراه المحاسب vs الأدمن

### القائمة الجانبية

| العنصر | الأدمن | المحاسب |
|--------|--------|---------|
| لوحة التحكم | ✅ | ✅ |
| المخزون | ✅ كامل | ✅ عرض فقط (بدون تعديل) |
| البيع (POS، سجل المبيعات) | ✅ | ✅ |
| الشراء | ✅ | ❌ |
| الزبائن | ✅ | ✅ |
| التجار + المستحقات | ✅ | ❌ |
| المدفوعات + مطابقة + إشعارات دائنة | ✅ | ✅ |
| المصروفات | ✅ | ❌ |
| الديون | ✅ | ❌ |
| الهدر | ✅ | ❌ |
| التقارير → المبيعات، المشتريات، المخزون، الهدر | ✅ | ✅ |
| التقارير → المصروفات، الأرباح، المخزون vs GL، الضرائب، ض.ق.م | ✅ | ❌ |
| المحاسبة | ✅ | ✅ |
| سجل المراجعة | ✅ | ❌ |
| الفروع | ✅ | ❌ |
| الإعدادات | ✅ | ❌ |
| المستخدمين | ✅ | ❌ |

### لوحة التحكم (Dashboard)

| البطاقة | الأدمن | المحاسب |
|---------|--------|---------|
| مبيعات اليوم، إيرادات اليوم | ✅ | ✅ |
| أرباح اليوم | ✅ | ❌ |
| قطع منخفضة المخزون | ✅ | ✅ |
| ديون الزبائن | ✅ | ✅ |
| ديون للتجار | ✅ | ❌ |

---

*انتهى المستند. جاهز للتنفيذ حسب المراحل أعلاه. التركيز على الفرونت إند كما طُلب.*
