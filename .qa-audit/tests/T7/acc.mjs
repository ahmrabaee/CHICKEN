// Accountant UI: card sale with a bank present, payment form card, sale detail cost/void, 100% discount, live page revocation, logout
import { launch, instrument, uiLogin, shot, out, API, UI, sleep, connect, getToasts, clearToasts } from './lib.mjs';
import * as P from './pos-lib.mjs';
import { DatabaseSync } from 'node:sqlite';
const R = []; const say = (s) => { console.log(s); R.push(s); };
const admin = await connect(API, 'admin', 'admin123');
let banks = (await admin.get('/bank-accounts')).data;
if (!banks.length) { const b = await admin.post('/bank-accounts', { name: 'بنك فلسطين QA', accountId: 6, isDefault: true }); say('bank created ' + b.status + ' ' + JSON.stringify(b.data).slice(0, 120)); }
const accUser = (await admin.get('/users')).data.find?.((u) => u.username === 'acc1') ?? (await admin.get('/users')).data.users?.find((u) => u.username === 'acc1');
say('acc1 id=' + accUser?.id);
// make sure POS allowed at start
await admin.put('/page-access', { userId: accUser.id, pageKey: 'sales-pos', allowed: true });
const jeFor = (saleId) => { const db = new DatabaseSync('E:/DEV/Chicken FMS/.qa-audit/envs/t7/app.db', { readOnly: true }); const r = db.prepare(`SELECT a.code, jl.debit_amount d, jl.credit_amount c FROM journal_entries je JOIN journal_entry_lines jl ON jl.journal_entry_id=je.id JOIN accounts a ON a.id=jl.account_id WHERE je.source_type='sale' AND je.source_id=?`).all(saleId); db.close(); return r.map((x) => `${x.code} D${x.d} C${x.c}`).join(', '); };

const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page, 'acc1', 'Acc12345');
const salePosts = (q0) => log.requests.slice(q0).filter((x) => x.method === 'POST' && /\/sales$/.test(x.url));

say('\n=== accountant POS card sale (bank exists)');
await P.openPOS(page);
await P.addItem(page, 'أجنحة دجاج', '1');
await P.method(page, 'card');
say('  "استلام في" bank selector visible: ' + await page.locator('text=استلام في:').isVisible());
await P.setPaid(page, '26');
let q0 = log.requests.length;
await P.completeBtn(page).click(); await sleep(1800);
for (const p of salePosts(q0)) { const id = Number((p.resBody.match(/"id":(\d+)/) || [])[1]); say(`  POST ${p.status} req=${p.reqBody}\n  JE: ${jeFor(id)}`); }

say('\n=== accountant POS 100% discount');
await P.openPOS(page);
await P.addItem(page, 'أجنحة دجاج', '1');
await P.setDiscount(page, '26');
await P.setPaid(page, '0.01');
q0 = log.requests.length;
await P.completeBtn(page).click(); await sleep(1800);
for (const p of salePosts(q0)) say(`  POST ${p.status} req=${p.reqBody} res=${p.resBody.slice(0, 160)}`);

say('\n=== accountant /payments/new → method card');
await page.goto(UI + '/payments/new'); await page.waitForLoadState('networkidle'); await sleep(800);
const e0 = log.pageErrors.length;
await page.locator('label:has-text("طريقة الدفع")').locator('..').getByRole('combobox').click();
await page.getByRole('option', { name: 'بطاقة', exact: true }).click(); await sleep(800);
say(`  pageErrors=${JSON.stringify(log.pageErrors.slice(e0).map((e) => e.msg))} bodyLen=${(await page.evaluate(() => document.body.innerText)).length}`);
await shot(page, 'acc-payment-card');

say('\n=== accountant sale detail: cost/profit and void');
await page.goto(UI + '/sales'); await page.waitForLoadState('networkidle'); await sleep(800);
say('  void buttons on list: ' + await page.getByTitle('إلغاء الفاتورة').count());
await page.getByTitle('عرض التفاصيل').first().click(); await sleep(1200);
const det = (await page.getByRole('dialog').innerText().catch(() => '')).replace(/\s+/g, ' ');
say('  detail shows التكلفة والربح: ' + det.includes('التكلفة والربح') + ' — ' + (det.match(/التكلفة والربح[^]{0,90}/) || [''])[0]);
await page.keyboard.press('Escape'); await sleep(300);
await clearToasts(page);
await page.getByTitle('إلغاء الفاتورة').first().click(); await sleep(500);
const vd = page.getByRole('dialog');
await vd.locator('textarea, input').first().fill('اختبار إلغاء محاسب');
q0 = log.requests.length;
await vd.getByRole('button', { name: /إلغاء الفاتورة|تأكيد/ }).last().click(); await sleep(1500);
say('  void attempt: ' + JSON.stringify(log.requests.slice(q0).filter((x) => x.method === 'POST').map((x) => x.url + ' ' + x.status + ' ' + (x.resBody || '').slice(0, 160))) + ' toasts=' + JSON.stringify(await getToasts(page)));
await page.keyboard.press('Escape');

say('\n=== live revocation of POS (sales-pos) while logged in');
await P.openPOS(page);
const r = await admin.put('/page-access', { userId: accUser.id, pageKey: 'sales-pos', allowed: false });
say('  admin PUT /page-access sales-pos=false: ' + r.status);
const t0 = Date.now();
let denied = false;
for (let i = 0; i < 9 && !denied; i++) {
  await sleep(5000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  denied = await page.locator('text=لا يمكن لغير المسؤول').count() > 0;
}
say(`  POS replaced by access-denied after ${Math.round((Date.now() - t0) / 1000)}s: ${denied}`);
const me = await connect(API, 'acc1', 'Acc12345');
say('  allowedPages now: ' + JSON.stringify(me.user.allowedPages));
await page.goto(UI + '/sales/new'); await sleep(1500);
say('  direct /sales/new denied: ' + (await page.locator('text=لا يمكن لغير المسؤول').count() > 0));
const apiSale = await me.post('/sales', { saleType: 'cash', lines: [{ itemId: 5, weightGrams: 100, pricePerKg: 2600 }], payments: [{ amount: 260, paymentMethod: 'cash' }] });
say('  API POST /sales by acc1 after POS revoked: ' + apiSale.status + ' ' + JSON.stringify(apiSale.body).slice(0, 160));
await admin.put('/page-access', { userId: accUser.id, pageKey: 'sales-pos', allowed: true });

say('\n=== logout');
await page.goto(UI + '/'); await sleep(800);
await page.getByRole('button', { name: 'تسجيل الخروج' }).click(); await sleep(1500);
const ls = await page.evaluate(() => ({ a: !!localStorage.getItem('access_token'), r: !!localStorage.getItem('refresh_token') }));
say(`  after logout url=${page.url()} tokens in storage=${JSON.stringify(ls)} logout call=${JSON.stringify(log.requests.filter((x) => x.url.includes('/auth/logout')).map((x) => x.status))}`);
await page.goBack(); await sleep(1000);
say('  back button → ' + page.url());
out('acc.out.txt', R.join('\n'));
await browser.close();
