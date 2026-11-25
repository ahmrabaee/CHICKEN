# 🖥️ التحقق من بناء تطبيق سطح المكتب (Tauri)

**الإعداد:** `app/src-tauri/` — Tauri **v2** · المنتج "Financial Management Program" · الأهداف `nsis` + `msi` (مثبّت ويندوز).

## الحالة
| العنصر | الحالة |
|---|---|
| إعداد `tauri.conf.json` | ✅ سليم (v2 schema, frontendDist صحيح, beforeBuildCommand = `npm run build`) |
| كود Rust (`src-tauri/src`) | ✅ قالب افتراضي بسيط (أمر `greet`) + plugin-opener |
| `Cargo.toml` | ✅ موجود (tauri 2, serde) |
| **بناء الواجهة (`npm run build`)** | ✅ **نجح** — `dist/` تولّدت في 12.8 ثانية |
| **سلسلة أدوات Rust (cargo/rustc)** | ❌ **غير مثبّتة على الجهاز** |

## ⛔ العائق الرئيسي
`tauri build` يتطلّب **Rust toolchain**، وهي **غير موجودة** (لا `cargo` ولا `rustc` ولا مجلد `~/.cargo`). لذلك **لا يمكن بناء تطبيق سطح المكتب الآن** حتى تُثبَّت Rust.

### الحل
1. ثبّت Rust من https://rustup.rs (يثبّت `cargo` + `rustc` + MSVC toolchain على ويندوز).
2. ثبّت **Microsoft C++ Build Tools** (مطلوبة لـ MSVC على ويندوز).
3. ثم:
   ```powershell
   cd app/frontend ; npm run tauri:build
   ```
   (أو من `app`: `npm --prefix frontend run tauri:build`).

## ملاحظات
- ⚠️ **حجم حزمة الواجهة كبير:** ملف JS واحد **1.77MB** (489KB مضغوط) — تحذير أداء من Vite. يُنصح بتقسيم الحزم (`manualChunks`) لتسريع الإقلاع. غير مانع للبناء.
- ⚠️ **أبعاد النافذة `1080×1920` (بورتريه عمودي)** في `tauri.conf.json` — غريبة لتطبيق كاشير سطح مكتب (تبدو أبعاد هاتف). تأكد أنها مقصودة؛ غالباً يجب أن تكون أفقية (مثلاً 1920×1080) أو أصغر مع قابلية تكبير.
- `capabilities/default.json` موجود (صلاحيات Tauri).
- الواجهة تتصل بالباك إند عبر `VITE_API_URL` — في نسخة سطح المكتب يجب تغييرها من `localhost` إلى عنوان السيرفر الفعلي.

## قائمة المراجعة
- [ ] تثبيت Rust + C++ Build Tools
- [ ] `npm run tauri:build` ينتج `.msi`/`.exe` بنجاح
- [ ] مراجعة أبعاد النافذة (1080×1920؟)
- [ ] ضبط `VITE_API_URL` لنسخة الإنتاج
- [ ] (تحسين) تقسيم حزمة JS الكبيرة
