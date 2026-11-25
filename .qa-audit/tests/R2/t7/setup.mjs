// Setup wizard on baseline (t7b, 3141; UI built as ui-dist-b and served on 5173)
import { launch, instrument, uiLogin, shot, out, UI, sleep, getToasts, request, connect } from './lib.mjs';
const API = 'http://localhost:3141/v1';
const R = []; const say = (s) => { console.log(s); R.push(s); };
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await page.goto(UI + '/');
await page.waitForLoadState('networkidle'); await sleep(800);
say('landing URL (setup not completed): ' + page.url());
await page.goto(UI + '/login'); await sleep(800);
say('direct /login before setup -> ' + page.url());
await page.goto(UI + '/setup'); await page.waitForLoadState('networkidle');
// step 1 validation: empty
await page.getByRole('button', { name: 'التالي' }).click(); await sleep(300);
say('step1 empty errors: ' + JSON.stringify(await page.locator('[id$="-form-item-message"]').allInnerTexts()));
await page.getByPlaceholder('مثال: مطعم الدجاج الذهبي').fill('<b>ملحمة</b> & "QA"');
await page.getByRole('button', { name: 'التالي' }).click(); await sleep(400);
await page.getByPlaceholder('الاسم ثلاثي').fill('مدير الاختبار');
await page.getByPlaceholder('مثال: admin أو مدير').fill('boss');
await page.getByPlaceholder('********').fill('short');
await page.getByRole('button', { name: 'التالي' }).click(); await sleep(300);
say('step2 short password errors: ' + JSON.stringify(await page.locator('[id$="-form-item-message"]').allInnerTexts()));
await page.getByPlaceholder('********').fill('password1');
await page.getByRole('button', { name: 'التالي' }).click(); await sleep(400);
await shot(page, 'setup-step3');
const q0 = log.requests.length;
await page.getByRole('button', { name: 'إنهاء الإعداد' }).click();
await sleep(3000);
for (const r of log.requests.slice(q0).filter((x) => x.method !== 'GET')) say(`  ${r.method} ${r.url} -> ${r.status} ${(r.resBody || '').slice(0, 300)}`);
say('after finish URL: ' + page.url() + ' toasts=' + JSON.stringify(await getToasts(page)));
await page.goto(UI + '/setup'); await sleep(1000);
say('revisit /setup after completion -> ' + page.url());
await uiLogin(page, 'boss', 'password1'); await sleep(1500);
say('login after setup -> ' + page.url());
await shot(page, 'setup-dashboard');
// replay setup via API
const replay = await request(API, 'POST', '/auth/setup', { body: { businessName: 'X', adminFullName: 'Evil Admin', adminUsername: 'evil', adminPassword: 'password1' } });
say('replay POST /auth/setup after completion: ' + replay.status + ' ' + JSON.stringify(replay.body).slice(0, 200));
const c = await connect(API, 'boss', 'password1');
for (const p of ['/bank-accounts', '/tax/templates', '/branches', '/settings/company', '/items', '/customers']) {
  const r = await c.get(p); say(`  baseline after setup GET ${p}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
}
// Business name with HTML rendered where?
const bodyHasRaw = await page.evaluate(() => document.body.innerHTML.includes('<b>ملحمة</b>'));
say('business name HTML rendered as element in DOM: ' + bodyHasRaw);
say('pageErrors: ' + JSON.stringify(log.pageErrors) + ' apiErrors: ' + JSON.stringify(log.apiErrors.map((x) => x.method + ' ' + x.url + ' ' + x.status)));
out('setup.out.txt', R.join('\n'));
await browser.close();
