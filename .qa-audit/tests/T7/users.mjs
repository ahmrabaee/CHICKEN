// Create accountant via UI (and error cases), then inspect accountant menu.
import { launch, instrument, uiLogin, shot, out, API, UI, sleep, connect, getToasts, clearToasts } from './lib.mjs';
const R = [];
const say = (s) => { console.log(s); R.push(s); };
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page);

async function createUser(full, username, password, roleLabel) {
  await page.goto(UI + '/users'); await page.waitForLoadState('networkidle');
  await clearToasts(page);
  await page.getByRole('button', { name: 'مستخدم جديد' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('أدخل اسم الموظف').fill(full);
  await dlg.getByPlaceholder('أدخل اسم الدخول').fill(username);
  await dlg.getByPlaceholder('********').fill(password);
  await dlg.locator('label:has-text("دور المستخدم")').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: roleLabel }).click();
  const q0 = log.requests.length;
  await dlg.locator('button[type=submit]').click();
  await sleep(1500);
  const posts = log.requests.slice(q0).filter((x) => x.method === 'POST' && x.url.includes('/users'));
  const formErr = await dlg.locator('[id$="-form-item-message"], p.text-destructive, .text-destructive').allInnerTexts().catch(() => []);
  say(`create ${username}/${password}: ${posts.map((p) => p.status + ' ' + (p.resBody || '').slice(0, 220)).join(' | ') || 'NO REQUEST'}\n   toasts=${JSON.stringify(await getToasts(page))} formErrors=${JSON.stringify(formErr)}`);
  if (await dlg.isVisible()) await page.keyboard.press('Escape');
}
await createUser('محاسب اختبار', 'acc1', 'Acc12345', 'محاسب (Cashier)');
await createUser('مكرر', 'acc1', 'Acc12345', 'محاسب (Cashier)');          // duplicate username
await createUser('كلمة ضعيفة', 'acc2', 'password', 'محاسب (Cashier)');   // policy?
await createUser('<b>bold</b>', 'acc3', '12345678', 'محاسب (Cashier)');
await shot(page, 'users-list');

// Login as accountant and read the sidebar
const p2 = await context.browser().newContext({ locale: 'ar', timezoneId: 'Asia/Jerusalem', viewport: { width: 1400, height: 950 } }).then((c) => c.newPage());
await uiLogin(p2, 'acc1', 'Acc12345');
await sleep(1500);
const links = await p2.evaluate(() => [...document.querySelectorAll('nav a, aside a')].map((a) => a.getAttribute('href') + ' ' + a.innerText.trim().replace(/\s+/g, ' ')));
say('accountant sidebar links: ' + JSON.stringify(links));
await shot(p2, 'acc-dashboard');
// wrong password message (K4-008)
const p3 = await context.browser().newContext({ locale: 'ar' }).then((c) => c.newPage());
const l3 = instrument(p3);
await uiLogin(p3, 'acc1', 'wrongpass');
await sleep(800);
say('wrong password: login error text=' + JSON.stringify(await p3.locator('.text-red-500').allInnerTexts()) + ' api=' + JSON.stringify(l3.apiErrors.map((x) => x.status + ' ' + x.resBody)));
for (let i = 0; i < 6; i++) { await p3.fill('#password', 'wrong' + i); await p3.getByRole('button', { name: 'تسجيل الدخول' }).click(); await sleep(400); }
say('after 7 wrong attempts: login error text=' + JSON.stringify(await p3.locator('.text-red-500').allInnerTexts()) + ' last api=' + JSON.stringify(l3.apiErrors.slice(-1).map((x) => x.status + ' ' + x.resBody)));
// console leak of password (K4-010)
const leak = l3.console.concat().length;
out('users.out.txt', R.join('\n'));
await browser.close();
