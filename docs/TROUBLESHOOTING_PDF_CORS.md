# استكشاف أخطاء تحميل PDF و CORS

## المشكلة: CORS مع التطبيق التاوري (localhost:1420)

### ما تم تعديله في الـ Backend

1. **Middleware لإجبار CORS على كل الاستجابات** (بما فيها 401، 500):
   - حتى عند انتهاء الجلسة (401)، يرسل الخادم رؤوس CORS
   - يعالج طلبات OPTIONS بإرجاع 204

2. **توسيع CORS** في `main.ts`:
   - إضافة `http://127.0.0.1:1420` و `http://127.0.0.1:5173`
   - تحديد `methods`, `allowedHeaders`, `exposedHeaders`

3. **إعادة تشغيل الـ Backend** (مهم جداً):
   ```bash
   cd app/backend
   npm run start:dev
   ```

---

## المشكلة: IDM يعترض التحميل (Intercepted by IDM)

إذا ظهرت رسالة **"Intercepted by the IDM Advanced Integration"** أو **"204"** عند تحميل PDF:

### الحل 1: تعطيل IDM لموقع localhost

1. افتح **Internet Download Manager (IDM)**
2. اذهب إلى **Downloads** → **Options** (أو **Download** → **Options**)
3. في تبويب **General** أو **Sites**، أضف استثناء:
   - `localhost`
   - `127.0.0.1`
4. أو ألغِ تفعيل **"Advanced Browser Integration"** مؤقتاً للاختبار

### الحل 2: التجربة من المتصفح

شغّل التطبيق من Vite على المتصفح بدلاً من Tauri:

```bash
cd app/frontend
npm run dev
```

ثم افتح `http://localhost:5173` في المتصفح — عادة لا يعترض IDM طلبات المتصفح العادي بهذه الطريقة.

---

## التحقق من عمل الـ API

اختبر الـ API مباشرة من المتصفح أو Postman:

```
GET http://localhost:3000/v1/sales/report/pdf?language=ar&startDate=2026-01-01&endDate=2026-02-28
Authorization: Bearer <your-token>
```

- إذا نجح الطلب من المتصفح ولكن فشل من التطبيق، فالمشكلة غالباً من CORS أو IDM.
- إذا فشل من المتصفح أيضاً، فالمشكلة من الـ Backend أو الصلاحيات.

---

## تحذير Dialog (aria-describedby)

تمت إضافة `DialogDescription` لمعاينة الـ PDF لإزالة تحذير Accessibility في الـ console.
