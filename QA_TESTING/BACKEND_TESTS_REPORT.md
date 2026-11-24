# 🧪 تقرير تشغيل تستات الباك إند (vitest)

**الأمر:** `npx vitest run` في `app/backend`
**التاريخ:** 2026-11-20

## النتيجة الإجمالية
| | العدد |
|---|---|
| ملفات التست | 14 (13 ناجح / **1 فاشل**) |
| الاختبارات | 77 (**76 ناجح / 1 فاشل**) |
| المدة | ~8.4 ثانية |

## ❌ الاختبار الفاشل الوحيد
**الملف:** [account-tree-builder.service.spec.ts](app/backend/src/accounting/chart-of-accounts/account-tree-builder.service.spec.ts)
**الاختبار:** `AccountTreeBuilderService > rebuildNestedSet > should assign correct lft/rgt values for a simple tree`
**الخطأ:**
```
TypeError: Cannot read properties of undefined (reading 'account')
 ❯ AccountTreeBuilderService.rebuildNestedSet  account-tree-builder.service.ts:15:35
     const accounts = await client.account.findMany({ ... })
                                   ^
 ❯ account-tree-builder.service.spec.ts:68:27
```
**التشخيص:** عند [account-tree-builder.service.ts:14-15](app/backend/src/accounting/chart-of-accounts/account-tree-builder.service.ts#L14): `const client = tx ?? this.prisma;` ثم `client.account.findMany(...)`. في التست، إمّا أن `this.prisma` غير محقون (mock ناقص) أو يُمرَّر `tx` بلا خاصية `account`. النتيجة: `client.account` = undefined.
**الخطورة:** 🟡 Medium — غالباً **خلل في التست نفسه** (mock) وليس بالضرورة في منطق الإنتاج، **لكنه يُبقي حزمة التستات حمراء (CI broken)**. دالة `rebuildNestedSet` تبني ترقيم الشجرة (lft/rgt) الذي يغذّي العرض الهرمي لشجرة المحاسبة — يجب إصلاح التست والتأكد أن الدالة تعمل صحيحاً وقت التشغيل.

## ✅ ما نجح (أبرزها)
- وحدة النسخ الاحتياطي (backup) كاملة: e2e، paths، repository، restore، scheduler، retention، token، import، controller، api — كلها ناجحة.
- `account-validator.service` ناجح (6 تستات).
- بقية تستات بناء الشجرة الثلاثة (`deriveRootAndReportType`) ناجحة.

## ملاحظات
- أثناء تستات النسخ الاحتياطي ظهرت رسائل `WAL checkpoint failed` و`Backup failed: ... missing.db` — هذه **متوقّعة** (تستات تتعمّد سيناريوهات الفشل)، وليست أخطاء حقيقية.
- لا توجد تستات e2e للمسارات الحرجة (بيع/شراء/قيود) ضمن هذه الحزمة — تغطية التست منخفضة خارج وحدة النسخ الاحتياطي، ما يفسّر عدم التقاط الأخطاء المحاسبية الحرجة (انظر CRITICAL_ERRORS.md) تلقائياً.

## قائمة المراجعة
- [ ] إصلاح تست `rebuildNestedSet` الفاشل (الحقن/الـ mock) وإعادة الحزمة خضراء.
- [ ] التأكد أن `rebuildNestedSet` تعمل صحيحاً وقت التشغيل (بناء الشجرة بعد إضافة/نقل حساب).
- [ ] (تحسين) إضافة تستات تكامل للبيع/الشراء/القيود لالتقاط أخطاء التوازن والمخزون مبكراً.
