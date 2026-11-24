# 🔒 تحليل تعارض/قفل قاعدة البيانات (SQLite Concurrency & Locking)

> **السؤال:** "تأكّد أنه لن يكون عندي 2 transactions يعملوا عليها lock".
> ## ⛔ الخلاصة (Verdict): **نعم — يمكن أن يحدث "database is locked"** مع كاشيرين يبيعان في نفس اللحظة، بل والأخطر: يمكن أن يتلف المخزون/التكلفة **بدون أي رسالة خطأ**.

> ## ✅ تم تطبيق الإصلاح الأول (2026-11-20)
> طبّقنا **WAL + busy_timeout=5000 + synchronous=NORMAL** في [prisma.service.ts](app/backend/src/prisma/prisma.service.ts) + `connection_limit=1` في `DATABASE_URL`.
> **تأكيد عملي:** ظهرت ملفات `app.db-wal`/`app.db-shm` (WAL فعّال)، والـ log: `journal_mode=wal, busy_timeout=5000ms`، و12 طلب كتابة متوازي رجعوا **200 بلا أي خطأ قفل**.
> ⚠️ **لسه مطلوب:** الجزء الثاني (سباق FIFO — البند 2 أدناه) لم يُطبَّق بعد (تعديل أعمق).
> **على السيرفر:** أضف `?connection_limit=1` لـ `DATABASE_URL` في `.env` (تم تحديث `setup-server.sh` و`.env.example`).

---

## 🧨 لماذا يحدث القفل (أدلة من الكود، وليست تخميناً)

1. **لا يوجد ضبط للـ pragmas عند الاتصال.** الملف [prisma.service.ts](app/backend/src/prisma/prisma.service.ts) لا يُفعّل:
   - `PRAGMA busy_timeout` (الذي يجعل الكاتب الثاني **ينتظر** بدل أن يفشل فوراً)،
   - `PRAGMA journal_mode=WAL` (الذي يسمح بالقراءة أثناء الكتابة)،
   - `PRAGMA foreign_keys=ON`.
2. **قاعدة البيانات في وضع DELETE journal وليس WAL** (تأكّد المراجع من بايتات ترويسة ملف `app.db`). هذا أسوأ وضع للتزامن: القارئ يحجب الكاتب والكاتب يحجب القارئ.
3. **لا يوجد `connection_limit=1`** في `DATABASE_URL`، فيفتح Prisma حوض اتصالات متعدد ⟵ تنافس حقيقي على القفل.
4. **كل عملية بيع تفتح `$transaction` طويلة** تمسك قفل الكتابة طوال: تخصيص FIFO + ترحيل القيود + دفتر المدفوعات + الديون + دفتر المخزون. نافذة التصادم واسعة جداً.

**النتيجة:** لحظة ما يحاول كاشير B الكتابة أثناء فتح معاملة كاشير A ⟵ `SQLITE_BUSY: database is locked` يُرمى لـ B فوراً.

---

## 🐞 المشاكل الحرجة المرتبطة

### 🔴 1. قفل قاعدة البيانات مع كاتبَين متزامنين
**المكان:** [prisma.service.ts](app/backend/src/prisma/prisma.service.ts) + `DATABASE_URL`.
**السيناريو:** كاشير A يبدأ بيعاً ([sales.service.ts:292](app/backend/src/sales/sales.service.ts#L292)) ⟵ قفل ملف. كاشير B يبدأ بيعاً على اتصال آخر ⟵ `database is locked` فوراً.
**الإصلاح المقترح:** في `onModuleInit` نفّذ:
```sql
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
PRAGMA foreign_keys=ON;
PRAGMA synchronous=NORMAL;
```
(وملاحظة: `journal_mode`/`wal_checkpoint` يُرجعان صفوفاً فتُنفّذ بـ `$queryRawUnsafe`). ويُفضَّل إضافة `?connection_limit=1` لتسلسل الكتابة داخل العملية.

### 🔴 2. سباق FIFO: قراءة المخزون تتم **خارج** المعاملة ⟵ مخزون سالب بلا خطأ
**المكان:** [sales.service.ts:328](app/backend/src/sales/sales.service.ts#L328) ينادي `allocateFIFO` الذي يقرأ الكميات عبر `this.prisma` (اتصال منفصل خارج المعاملة) — [inventory.service.ts:437](app/backend/src/inventory/inventory.service.ts#L437).
**السيناريو:** صنف برصيد 1000غ. كاشير A و B يبيعان 1000غ معاً ⟵ كلاهما يقرأ 1000 ⟵ كلاهما يمرّ فحص الرصيد ⟵ الرصيد يصبح **−1000غ** وتتضاعف التكلفة ويفسد متوسط التكلفة. **بلا أي رسالة خطأ.**
**الإصلاح:** القراءة والخصم داخل نفس `tx` مع تحديث مشروط `WHERE remainingQuantityGrams >= :qty`، وتمرير `tx` إلى `allocateFIFO`.

### 🟠 3. توليد الأرقام غير ذرّي (count+1) ⟵ تصادم يُفشل البيعة كاملة
**المكان:** [gl-entry.factory.ts:74](app/backend/src/accounting/gl-engine/gl-entry.factory.ts#L74) `generateEntryNumber = count()+1` بلا فحص تفرّد ولا إعادة محاولة؛ وكذلك `generatePaymentNumber` ([sales.service.ts:979](app/backend/src/sales/sales.service.ts#L979))، `generatePurchaseNumber` ([purchases.service.ts:1062](app/backend/src/purchases/purchases.service.ts#L1062))، و`generateLotNumber`.
**الأثر:** رقمان متطابقان ⟵ خرق قيد التفرّد (P2002) ⟵ **تراجع المعاملة بأكملها** ⟵ البيعة تفشل. (رقم البيع وحده محميّ بحلقة إعادة محاولة، أما رقم القيد/الدفعة/اللوط فلا.)
**الإصلاح:** عدّاد ذرّي عبر `UPDATE ... RETURNING`/upsert داخل المعاملة، أو فحص+إعادة محاولة لكل مولّد.

### 🟡 4. نسخة احتياطية الساعة 2 صباحاً تتصادم مع الكتابة المتأخرة
**المكان:** [backup.service.ts:260](app/backend/src/modules/backup/backup.service.ts#L260). `wal_checkpoint(TRUNCATE)` بلا فائدة لأن الوضع DELETE؛ ونسخ ملف `app.db` أثناء كتابة متزامنة قد يلتقط **لقطة ممزّقة/غير متّسقة**، والنسخ منافس آخر على القفل.
**الإصلاح:** فعّل WAL، واستخدم `VACUUM INTO`/online backup API بدل نسخ الملف الخام.

### ⚪ 5. (كامن) عميل Prisma ثانٍ في `lib/db.ts`
`lib/db.ts` يستورد عميل Prisma منفصل (حوض اتصالات ثانٍ) وفيه دوال تفتح معاملاتها الخاصة. حالياً **لا تُستدعى من أي خدمة** (كود ميت)، لكن لو وُصِلت مستقبلاً ⟵ تنافس أعلى أو معاملة متداخلة (يرفضها Prisma على SQLite). يُنصح بحذف المسار غير المستخدم.

### ✅ خبر جيد: لا توجد معاملات متداخلة في المسارات الساخنة
ترحيل القيود (`gl-engine post/reverse`) يعيد استخدام `tx` الممرَّر من البيعة، فلا تتولّد معاملة متداخلة.

---

## ✅ خطة الإصلاح بالأولوية
1. (🔴 فوري) WAL + busy_timeout=5000 + foreign_keys=ON عند كل اتصال.
2. (🔴) نقل قراءة FIFO وخصم اللوطات داخل معاملة واحدة بتحديث مشروط.
3. (🟠) جعل كل مولّدات الأرقام ذرّية.
4. (🟡) تحويل النسخ الاحتياطي إلى SQLite backup API بعد تفعيل WAL.

> **ملاحظة:** هذه إصلاحات **لم أطبّقها** — تحتاج موافقتك. إصلاح #1 بسيط ومنخفض المخاطر ويحلّ الجزء الأكبر من مشكلة القفل. أخبرني إن أردت أن أطبّقه.
