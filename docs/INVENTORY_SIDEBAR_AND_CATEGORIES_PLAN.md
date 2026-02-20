# خطة شاملة: تبسيط السايد بار وإدارة الفئات

**التاريخ:** 2025-02-19  
**النطاق:** Frontend + Backend

---

## 1. ملخص تنفيذي

| البند | الوضع الحالي | الهدف |
|-------|--------------|-------|
| السايد بار (المخزون) | 4 روابط تؤدي لنفس الصفحة | زر واحد «المخزون» |
| الفئات | لا واجهة إدارة؛ تُستخدم للتصفية فقط | تبويب/قسم إدارة الفئات داخل صفحة المخزون |
| Routes | `/inventory`, `/categories`, `/adjustments` | `/inventory` فقط |

---

## 2. خطة الفرونت إند (Frontend)

### 2.1 السايد بار - AppSidebar.tsx

**الملف:** `app/frontend/src/components/layout/AppSidebar.tsx`

| المهمة | الوصف |
|--------|-------|
| إزالة القائمة الفرعية | تحويل "المخزون" من group بـ children إلى رابط مباشر |
| قبل | `children: [العناصر, الفئات, التعديلات]` |
| بعد | `href: "/inventory"` بدون children |
| أيقونة | الإبقاء على `Package` |
| `openGroups` | إزالة `"Inventory"` من القيمة الافتراضية لأنها لن تكون group |

**التعديل المقترح:**
```tsx
// قبل
{
  title: "Inventory",
  titleAr: "المخزون",
  icon: Package,
  children: [
    { title: "Items", titleAr: "العناصر", href: "/inventory", icon: Boxes },
    { title: "Categories", titleAr: "الفئات", href: "/categories", icon: Layers },
    { title: "Adjustments", titleAr: "التعديلات", href: "/adjustments", icon: ClipboardList },
  ],
},

// بعد
{
  title: "Inventory",
  titleAr: "المخزون",
  icon: Package,
  href: "/inventory",
},
```

---

### 2.2 المسارات - App.tsx

**الملف:** `app/frontend/src/App.tsx`

| المهمة | الوصف |
|--------|-------|
| إزالة routes مكررة | حذف `/categories` و `/adjustments` |
| إعادة التوجيه (اختياري) | إضافة redirect من `/categories` و `/adjustments` إلى `/inventory` لتجنب روابط قديمة |

**التعديل المقترح:**
```tsx
{/* Inventory */}
<Route path="/inventory" element={<Inventory />} />
<Route path="/inventory/new" element={<ItemProfile />} />
<Route path="/inventory/:id" element={<ItemProfile />} />
{/* حذف: /categories و /adjustments */}
```

---

### 2.3 صفحة المخزون - Inventory.tsx

**الملف:** `app/frontend/src/pages/Inventory.tsx`

| المهمة | الوصف |
|--------|-------|
| إضافة Tabs | تبويبان: «الأصناف» و «الفئات» |
| تبويب الأصناف | محتوى الصفحة الحالي (جدول + فلتر + dialogs) |
| تبويب الفئات | جدول CRUD للفئات |

**هيكل الـ Tabs:**
```
┌─────────────────────────────────────────────────┐
│  المخزون وإدارة الأصناف                         │
│  [إضافة صنف جديد] [تصدير] [إدارة الفئات]       │
├─────────────────────────────────────────────────┤
│  [الأصناف]  [الفئات]                             │  ← Tabs
├─────────────────────────────────────────────────┤
│  Tab: الأصناف → جدول الأصناف الحالي + فلتر       │
│  Tab: الفئات  → جدول الفئات + إضافة/تعديل/حذف   │
└─────────────────────────────────────────────────┘
```

---

### 2.4 مكوّن إدارة الفئات (جديد)

**الملف المقترح:** `app/frontend/src/components/inventory/CategoriesManagement.tsx`

| الوظيفة | التفاصيل |
|---------|----------|
| عرض الفئات | جدول: الاسم، الكود، ترتيب العرض، الحالة |
| إضافة فئة | زر + Dialog (CreateCategoryDto) |
| تعديل فئة | زر على كل صف + Dialog |
| حذف/تعطيل | زر مع تأكيد؛ منطق الباك يُعطّل إن وُجدت أصناف |
| دمج مع useCategories | القراءة من `useCategories(includeInactive: true)` |
| الطفرات | `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory` |

**الحقول في نموذج الفئة:**
- `code` (مطلوب)
- `name` (مطلوب)
- `nameEn` (اختياري)
- `displayOrder` (اختياري)
- `isActive` (اختياري، افتراضي true)

---

### 2.5 Hooks إضافية للفئات

**الملف:** `app/frontend/src/hooks/use-inventory.ts`

| الوظيفة | الحالة | ملاحظات |
|---------|--------|---------|
| `useCategories` | موجود | دعم `includeInactive` عند الحاجة |
| `useCreateCategory` | موجود | |
| `useUpdateCategory` | مطلوب | إضافته |
| `useDeleteCategory` | مطلوب | إضافته |

---

### 2.6 خدمة الفئات - category.service.ts

**الملف:** `app/frontend/src/services/category.service.ts`

| الوظيفة | الحالة |
|---------|--------|
| `getCategories(params?)` | موجود؛ إضافة `includeInactive` كـ query param |
| `createCategory` | موجود |
| `updateCategory` | موجود |
| `deleteCategory` | موجود |

---

### 2.7 تنظيف الـ imports

| الملف | الإجراء |
|-------|---------|
| AppSidebar.tsx | إزالة `Boxes`, `Layers`, `ClipboardList` إن لم تُستخدم في أماكن أخرى |

---

## 3. خطة الباك إند (Backend)

### 3.1 الحالة الحالية للـ Categories API

| Method | Endpoint | الوصف | الحالة |
|--------|----------|-------|--------|
| GET | `/categories` | قائمة الفئات | ✅ جاهز |
| GET | `/categories/:id` | فئة بـ ID | ✅ جاهز |
| GET | `/categories/code/:code` | فئة بـ code | ✅ جاهز |
| POST | `/categories` | إنشاء فئة | ✅ جاهز |
| PUT | `/categories/:id` | تحديث فئة | ✅ جاهز |
| DELETE | `/categories/:id` | حذف/تعطيل | ✅ جاهز |

**الخلاصة:** لا حاجة لتعديلات جوهرية في الباك إند.

---

### 3.2 تحسينات اختيارية (Backend)

| البند | الوصف | الأولوية |
|-------|-------|----------|
| GET `/categories?includeInactive=true` | دعم بالفعل | - |
| عَدّ الأصناف لكل فئة | إضافة `itemCount` في response لتحسين UX | منخفضة |
| ترتيب الفئات | `displayOrder` مدعوم | - |

---

## 4. ترتيب التنفيذ المقترح

| # | المهمة | الملف | النوع |
|---|--------|-------|-------|
| 1 | تبسيط السايد بار | AppSidebar.tsx | Frontend |
| 2 | حذف المسارات المكررة | App.tsx | Frontend |
| 3 | إضافة useUpdateCategory و useDeleteCategory | use-inventory.ts | Frontend |
| 4 | مكوّن CategoriesManagement | components/inventory/ | Frontend |
| 5 | دمج Tabs في صفحة المخزون | Inventory.tsx | Frontend |
| 6 | (اختياري) itemCount في GET categories | categories.service.ts (backend) | Backend |

---

## 5. ملاحظات إضافية

1. **إعادة التوجيه:** إن وُجدت روابط خارجية أو إشارات لـ `/categories` أو `/adjustments`، يُفضّل إضافة redirect في React Router.
2. **الصلاحيات:** إدارة الفئات (إنشاء/تعديل/حذف) للـ admin فقط؛ القراءة متاحة للـ cashier.
3. **أصناف مرتبطة بفئة:** عند الحذف، الباك يُعطّل الفئة (soft delete) إن وُجدت أصناف مرتبطة بها.

---

## 6. الملفات المتأثرة

| الملف | التعديل |
|-------|---------|
| `AppSidebar.tsx` | تبسيط قائمة المخزون |
| `App.tsx` | حذف routes مكررة |
| `Inventory.tsx` | إضافة Tabs + دمج CategoriesManagement |
| `use-inventory.ts` | إضافة update/delete للفئات |
| `CategoriesManagement.tsx` | مكوّن جديد |
