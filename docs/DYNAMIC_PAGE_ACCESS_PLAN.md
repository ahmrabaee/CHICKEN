# خطة: التحكم الديناميكي في الصفحات المتاحة للمحاسبين

> **التاريخ:** 2026-02-21  
> **الهدف:** تمكين الأدمن من التحكم في الصفحات التي يمكن للمحاسبين الدخول إليها، مع إمكانية التعديل في أي لحظة (On/Off) دون إعادة نشر التطبيق.

---

## 1. ملخص الخدمة والإجابات المختصرة

### 1.1 ماذا سيكلفنا هذا؟

| البند | التقدير | التفاصيل |
|-------|---------|----------|
| **Base** | 2–3 أيام تطوير | DB + Backend APIs + Frontend Settings + ربط الحماية |
| **متوسط** | 3–4 أيام | + تحسينات UX + صلاحيات API مرنة |
| **كامل** | 4–5 أيام | + صلاحيات على مستوى المستخدم (اختياري) |

التكلفة تزيد إذا:
- أردت صلاحيات لكل مستخدم وليس كل دور
- أردت تتبع تاريخ التغييرات (audit للصلاحيات)
- أردت ربط الصفحات بـ API endpoints بشكل ديناميكي

### 1.2 هل الخدمة يجب أن تعمل عبر الإنترنت؟

**لا.** لا يوجد اشتراك أو خدمات خارجية مطلوبة. الخدمة تعمل داخلياً:

- الإعدادات تُخزَّن في قاعدة بياناتك المحلية
- الأدمن يعدّل الصلاحيات من لوحة الإعدادات داخل التطبيق
- التعديلات تُطبَّق فوراً (أو عند إعادة تسجيل الدخول للمحاسبين)

التطبيق يمكن أن يعمل على الإنترنت (ويب)، ولكن آلية التحكم في الصفحات هي داخلية وليست معتمدة على مزود خارجي.

### 1.3 ما الجديد الذي سيطرأ علينا؟

| المجال | الوضع الحالي | الوضع الجديد |
|--------|---------------|---------------|
| **DB** | صلاحيات ثابتة في الكود | جدول جديد يحدد الصفحات المسموحة لكل دور |
| **Backend** | `RolesGuard` + قائمة ثابتة | API للصلاحيات + التحقق من الصفحة في الـ Guard |
| **Auth / Login** | يرجع `role` + `permissions` | + `allowedPages` (أو `pageAccess`) |
| **Frontend** | `ADMIN_ONLY_PATHS` ثابت | قائمة ديناميكية من الـ API |
| **Settings** | لا يوجد واجهة للصلاحيات | صفحة جديدة: "صلاحيات الصفحات" |

---

## 2. التصميم العام

### 2.1 النموذج المقترح (Role-based)

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Role          │────▶│  RolePageAccess       │────▶│  PageDefinition │
│  (admin,        │     │  roleId, pageKey,      │     │  key, path,     │
│   accountant)   │     │  allowed (boolean)     │     │  titleAr, ...   │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
```

- **admin:** يرى كل الصفحات دائماً (لا نحتاج سجلات له).
- **accountant:** الصفحات المسموحة تُحدَّد من جدول `role_page_access`.

### 2.2 بديل: صفحة تعريفات فقط (بدون جدول منفصل)

- جدول واحد: `page_definition` (path, titleAr, defaultForAccountant, ...)
- الأدمن يعدّل `defaultForAccountant` أو حقل مشابه
- أبسط، لكن أقل مرونة إذا أردت لاحقاً أدواراً إضافية

---

## 3. خطة Backend

### 3.1 قاعدة البيانات (Prisma Schema)

```prisma
/// صفحات التطبيق القابلة للتحكم - تُستخدم للصلاحيات الديناميكية
model PageDefinition {
  id          Int    @id @default(autoincrement())
  key         String @unique  // مثلاً: 'debts', 'expenses', 'reports-stock-vs-gl'
  path        String         // المسار الفعلي: '/debts', '/reports/stock-vs-gl'
  titleAr     String @map("title_ar")
  titleEn     String? @map("title_en")
  groupKey    String? @map("group_key")  // للتصنيف: 'reports', 'inventory'
  sortOrder   Int    @default(0) @map("sort_order")
  isAdminOnly Boolean @default(false) @map("is_admin_only") // admin دائماً يرى
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  rolePageAccess RolePageAccess[]

  @@map("page_definitions")
}

/// الصلاحيات لكل دور لكل صفحة
model RolePageAccess {
  id        Int     @id @default(autoincrement())
  roleId    Int     @map("role_id")
  pageId    Int     @map("page_id")
  allowed   Boolean @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  role Role        @relation(fields: [roleId], references: [id], onDelete: Cascade)
  page PageDefinition @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@unique([roleId, pageId])
  @@map("role_page_access")
}

// إضافة للـ Role model:
model Role {
  // ... existing fields
  rolePageAccess RolePageAccess[]
}
```

### 3.2 Migration و Seed

**Migration:** `db/migrations/0XX_add_page_access.sql`

```sql
CREATE TABLE page_definitions (...);
CREATE TABLE role_page_access (...);
INSERT INTO page_definitions (key, path, title_ar, group_key, is_admin_only, sort_order) VALUES
  ('dashboard', '/', 'لوحة التحكم', NULL, 0, 0),
  ('inventory', '/inventory', 'المخزون', NULL, 0, 10),
  ('inventory-new', '/inventory/new', 'إضافة صنف', 'inventory', 1, 11),
  ('sales', '/sales', 'البيع', NULL, 0, 20),
  ('sales-pos', '/sales/new', 'نقطة البيع', 'sales', 0, 21),
  -- ... بقية الصفحات
  ('debts', '/debts', 'الديون', NULL, 1, 100),
  ('expenses', '/expenses', 'المصروفات', NULL, 1, 110),
  -- ...
```

**Seed:** إنشاء سجلات `role_page_access` للدور `accountant` بحسب الخطة الحالية (مثلاً: ممنوع: debts, expenses, traders, ...).

### 3.3 APIs جديدة

| Method | Endpoint | الصلاحيات | الوصف |
|--------|----------|-----------|-------|
| GET | `/page-access` | admin | قائمة كل الصفحات مع صلاحية كل دور |
| PUT | `/page-access` | admin | تحديث صلاحية صفحة لدور معين |
| PUT | `/page-access/bulk` | admin | تحديث عدة صفحات مرة واحدة |
| GET | `/auth/me` (تعديل) | مصادق | إرجاع `allowedPages` للمستخدم الحالي |

**مثال استجابة `GET /page-access`:**

```json
{
  "success": true,
  "data": {
    "pages": [
      {
        "id": 1,
        "key": "debts",
        "path": "/debts",
        "titleAr": "الديون",
        "groupKey": null,
        "isAdminOnly": true,
        "roles": {
          "accountant": false
        }
      },
      {
        "id": 2,
        "key": "sales",
        "path": "/sales",
        "titleAr": "البيع",
        "roles": {
          "accountant": true
        }
      }
    ]
  }
}
```

**مثال `PUT /page-access`:**

```json
{ "roleKey": "accountant", "pageKey": "debts", "allowed": true }
```

### 3.4 تعديل Auth (Login / Me)

- في `AuthUserResponse` إضافة حقل: `allowedPages: string[]` (قائمة paths أو keys).
- في `auth.service.ts` (login + أي endpoint يُرجع المستخدم الحالي):
  - جلب `role_page_access` للدور الحالي.
  - إذا كان admin: `allowedPages = ['*']` أو قائمة كل الصفحات.
  - إذا كان accountant: قائمة الصفحات التي `allowed = true`.

### 3.5 حماية الـ API حسب الصفحة

خياران:

**أ) الاعتماد على الدور فقط (الأبسط):**

- الإبقاء على `RolesGuard` الحالي.
- الصلاحيات الديناميكية للواجهة فقط؛ الباك إند يبقى role-based.

**ب) Guard جديد حسب الصفحة (أكثر أماناً):**

- إضافة `PageAccessGuard` أو توسيع `RolesGuard`.
- كل endpoint يرتبط بـ `pageKey` (مثلاً من decorator).
- الـ Guard يتحقق: هل المستخدم لديه صلاحية لهذه الصفحة؟

الخطة الأساسية: أ) كفاية؛ يمكن التوسع لـ ب) لاحقاً إذا رغبت.

---

## 4. خطة Frontend

### 4.1 صفحة الإعدادات الجديدة

**المسار:** `/settings/page-access` (أو تبويب داخل `/settings`).

**المحتوى:**

1. **قائمة الصفحات** مصنفة (مخزون، مبيعات، تقارير، ...).
2. لكل صفحة: عمود "محاسب" مع **Switch (On/Off)**.
3. زر "حفظ التغييرات".
4. رسالة نجاح/خطأ بعد الحفظ.

**مثال واجهة (مبسّط):**

```
┌─────────────────────────────────────────────────────────────┐
│  صلاحيات الصفحات للمحاسبين                                   │
├─────────────────────────────────────────────────────────────┤
│  المجموعة        │ الصفحة              │ محاسب (مُتاح)        │
│  المخزون         │ المخزون             │ ✓                    │
│  المخزون         │ إضافة صنف           │ ✗ (أدمن فقط)         │
│  المبيعات        │ المبيعات / نقطة البيع│ ✓                    │
│  ...             │ ...                 │                      │
└─────────────────────────────────────────────────────────────┘
                    [ حفظ التغييرات ]
```

### 4.2 Context / Hook للصلاحيات

**ملف جديد:** `src/context/PageAccessContext.tsx` (أو توسيع `AuthContext`).

- يحمّل `allowedPages` من `user` (يأتي من Login/Me).
- يوفر:
  - `allowedPages: string[]`
  - `canAccessPage(path: string): boolean`
  - `canAccessPageByKey(key: string): boolean`

### 4.3 استبدال الثوابت الثابتة

| الملف الحالي | التعديل |
|--------------|---------|
| `constants/roles.ts` | إزالة أو تقليل `ADMIN_ONLY_PATHS`؛ استخدام البيانات من الـ API |
| `App.tsx` | بناء المسارات المحمية من `allowedPages` أو من Config |
| `AppSidebar.tsx` | إخفاء/إظهار العناصر حسب `canAccessPage` |
| `ProtectedRoute` | التحقق من `canAccessPage(location.pathname)` بدل `allowedRoles` فقط |
| `Reports.tsx` | فلترة تبويبات التقارير حسب `canAccessPage` |

### 4.4 متى تُطبَّق التغييرات؟

- **فوراً:** بعد حفظ الأدمن، نرسل evento أو نحدّث الـ context. المحاسبون الذين في الجلسة يرون التغيير في الطلبات التالية (مثلاً عند التنقل).
- **عند إعادة تسجيل الدخول:** إذا أبقينا `allowedPages` في الـ JWT أو في استجابة `/auth/me`، نحدّثها عند كل refresh أو عند طلب `/auth/me`.

التوصية: جعل `/auth/me` يرجع `allowedPages` حديثة، والفرونت إند يستدعيه عند بداية الجلسة أو عند العودة من الخلفية.

---

## 5. قائمة الملفات المتوقعة

### 5.1 Backend

| الملف | الإجراء |
|------|---------|
| `prisma/schema.prisma` | إضافة `PageDefinition`, `RolePageAccess` |
| `db/migrations/0XX_*.sql` | إنشاء الجداول والـ seed الأساسي |
| `prisma/seed.ts` | تعبئة `page_definitions` و `role_page_access` الأولى |
| `src/page-access/` (وحدة جديدة) | `page-access.module.ts`, `page-access.service.ts`, `page-access.controller.ts` |
| `src/page-access/dto/*.ts` | DTOs للطلبات والاستجابات |
| `src/auth/auth.service.ts` | إضافة `allowedPages` في Login و Me |
| `src/auth/dto/auth.dto.ts` | إضافة `allowedPages` في `AuthUserResponse` |

### 5.2 Frontend

| الملف | الإجراء |
|------|---------|
| `src/pages/settings/PageAccessSettings.tsx` | صفحة إعدادات الصلاحيات |
| `src/context/PageAccessContext.tsx` | أو توسيع `AuthContext` |
| `src/hooks/usePageAccess.ts` | Hook لـ `canAccessPage` |
| `src/constants/roles.ts` | استخدام بيانات من API بدل القوائم الثابتة |
| `src/App.tsx` | ربط المسارات بـ `canAccessPage` |
| `src/components/layout/AppSidebar.tsx` | فلترة القائمة حسب الصلاحيات الديناميكية |
| `src/components/ProtectedRoute.tsx` | التحقق من `canAccessPage` |
| `src/services/page-access.service.ts` | استدعاءات API للصلاحيات |
| `src/types/page-access.ts` | واجهات TypeScript |

---

## 6. خطة تنفيذ مقترحة (مراحل)

### المرحلة 1 – الأساس (Backend)
1. إضافة الجداول والـ migration.
2. Seed لـ `page_definitions` و `role_page_access` الأولية.
3. APIs: `GET/PUT /page-access` (admin فقط).
4. تعديل Login/Me لإرجاع `allowedPages`.

### المرحلة 2 – Frontend الأساسي
1. صفحة الإعدادات `PageAccessSettings`.
2. `PageAccessContext` أو توسيع `AuthContext` مع `allowedPages`.
3. تعديل `ProtectedRoute` و `AppSidebar` لاستخدام الصلاحيات الديناميكية.
4. إزالة الاعتماد الكلي على `ADMIN_ONLY_PATHS` الثابت.

### المرحلة 3 – تحسينات
1. تحديث فوري للمحاسبين (مثلاً عبر polling أو WebSocket).
2. زر "استعادة الافتراضي" في الإعدادات.
3. تجميع الصفحات (groups) في الواجهة.
4. (اختياري) `PageAccessGuard` في الباك إند لربط الـ endpoints بالصفحات.

---

## 7. ملخص التكلفة والعوائد

| البند | القيمة |
|-------|--------|
| **جهد التطوير** | 3–4 أيام (بدون صلاحيات على مستوى المستخدم) |
| **تعقيد صيانة الكود** | متوسط – وحدة جديدة واضحة |
| **اعتماديات خارجية** | لا يوجد |
| **متطلبات إنترنت** | لا (فقط إذا التطبيق نفسه يعمل عبر الويب) |
| **الفائدة** | مرونة كاملة للأدمن في تحديد ما يراه المحاسبون دون نشر جديد |

---

## 8. القرارات المعلقة

1. **هل نبقي قائمة ثابتة كـ fallback** إذا فشل تحميل `allowedPages`؟
2. **هل نحتاج audit** لتغييرات الصلاحيات؟
3. **هل نطبق الصلاحيات على مستوى المستخدم** لاحقاً (وليس الدور فقط)؟
