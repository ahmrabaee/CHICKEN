# تشغيل صلاحيات الصفحات الديناميكية

## الخطوات المطلوبة

1. **إيقاف خادم التطوير** (إن كان يعمل)

2. **تطبيق تغييرات قاعدة البيانات:**
   ```bash
   cd app/backend
   npx prisma generate
   npx prisma db push
   ```

3. **تشغيل البذور (Seed):**
   ```bash
   npm run db:seed
   ```
   سيقوم بإنشاء جداول `page_definitions` و `role_page_access` وتعبئتها.

4. **إعادة تشغيل الخادم:**
   ```bash
   npm run dev
   ```

## أو استخدام الـ Migration اليدوي (SQLite)

إذا استخدمت `prisma db push` وكانت قاعدة البيانات موجودة مسبقاً:

```bash
# من مجلد app/backend
sqlite3 prisma/data/chicken_shop.db < db/migrations/014_add_page_access.sql
sqlite3 prisma/data/chicken_shop.db < db/migrations/015_add_user_page_access.sql
npm run db:seed
```

**ملاحظة:** الصلاحيات الآن لكل محاسب على حدة (user_page_access)، ويمكن للأدمن منح أي صفحة لأي محاسب.
