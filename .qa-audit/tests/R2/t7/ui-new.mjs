// R2: new-UI review: Audit page labels for interceptor rows, /help for revoked user, accounting balance column, sales return dialog
import { launch, instrument, uiLogin, shot, out, UI, API, sleep, connect, request } from './lib.mjs';
const c = await connect(API, 'admin', 'admin123');
const R = []; const say = (s) => { console.log(s); R.push(s); };
// seed some audit-producing mutations
const roles = (await c.get('/users/roles')).data; const accRole = roles.find((r) => r.name === 'accountant').id;
const mk = await c.post('/users', { username: 'r2rev', password: 'password123', fullName: 'R2 Rev', roleId: accRole });
const uid = mk.data?.id;
const pa = await c.get(`/page-access/user/${uid}`);
await c.put('/page-access/bulk', { items: pa.data.pages.map((p) => ({ userId: uid, pageKey: p.key, allowed: false })) });
await c.post(`/users/${uid}/reset-password`, { newPassword: 'password456' });
await c.post('/customers', { name: 'R2 aud cust', phone: '0592223334' });
await c.post('/sales', { saleType: 'cash', lines: [{ itemId: 6, weightGrams: 500, pricePerKg: 3000 }], payments: [{ paymentMethod: 'cash', amount: 1500 }] });

const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page);
// 1. Audit page
await page.goto(UI + '/audit'); await page.waitForLoadState('networkidle'); await sleep(1500);
const rows = await page.evaluate(() => [...document.querySelectorAll('table tbody tr')].slice(0, 14).map((r) => r.innerText.replace(/\s+/g, ' ').slice(0, 120)));
say('AUDIT page rows (first 14):\n  ' + rows.join('\n  '));
await shot(page, 'r2-audit');
// action filter options
await page.locator('button[role="combobox"]').first().click().catch(() => {});
await sleep(500);
const opts = await page.evaluate(() => [...document.querySelectorAll('[role="option"]')].map((o) => o.innerText));
say('AUDIT action filter options: ' + JSON.stringify(opts));
await page.keyboard.press('Escape');
// 2. Accounting tree balances
await page.goto(UI + '/accounting'); await page.waitForLoadState('networkidle'); await sleep(2000);
const tree = await page.evaluate(() => [...document.querySelectorAll('table tbody tr')].slice(0, 12).map((r) => r.innerText.replace(/\s+/g, ' ').slice(0, 140)));
say('ACCOUNTING tree rows:\n  ' + tree.join('\n  '));
await shot(page, 'r2-accounting');
const tb = (await c.get('/accounting/trial-balance')).data;
const t1111 = tb.find((x) => x.accountCode === '1111'); const t4110 = tb.find((x) => x.accountCode === '4110');
say(`TB 1111 ending Dr=${t1111?.endingDebit} Cr=${t1111?.endingCredit}; 4110 Dr=${t4110?.endingDebit} Cr=${t4110?.endingCredit}`);
// 3. Sales return dialog
await page.goto(UI + '/sales'); await page.waitForLoadState('networkidle'); await sleep(1500);
const btns = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 25));
say('SALES page buttons: ' + JSON.stringify(btns));
const ret = page.getByRole('button', { name: /مرتجع/ }).first();
say('return button count: ' + await page.getByRole('button', { name: /مرتجع/ }).count());
if (await ret.count()) { await ret.click(); await sleep(1000); say('RETURN dialog text: ' + (await page.evaluate(() => (document.querySelector('[role="dialog"]')?.innerText || 'NO DIALOG').replace(/\s+/g, ' ').slice(0, 500)))); await shot(page, 'r2-return-dialog'); }
// 4. revoked user /help + sidebar + FAB
const p2 = await context.newPage(); const log2 = instrument(p2);
await p2.goto(UI + '/login'); await p2.evaluate(() => localStorage.clear());
await uiLogin(p2, 'r2rev', 'password456');
await sleep(1500);
say('REVOKED user landed at ' + p2.url() + ' body: ' + (await p2.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200))));
const sb = await p2.evaluate(() => [...document.querySelectorAll('aside a, nav a')].map((a) => a.getAttribute('href') + ' ' + a.innerText.trim()));
say('REVOKED sidebar links: ' + JSON.stringify(sb));
for (const path of ['/help', '/help#pos', '/inventory', '/sales/new']) {
  await p2.goto(UI + path); await sleep(1500);
  say(`REVOKED goto ${path} -> ${p2.url()} | text: ${(await p2.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 120)))}`);
}
await p2.goto(UI + '/help'); await sleep(1000); await shot(p2, 'r2-help-revoked');
// 5. Help FAB mapping
const adminPage = page;
for (const path of ['/stock-transfer', '/adjustments', '/credit-notes', '/categories', '/payments/new', '/sales', '/reports/vat', '/inventory/5']) {
  await adminPage.goto(UI + path); await sleep(900);
  const fab = await adminPage.evaluate(() => { const b = document.querySelector('button[aria-label]'); return [...document.querySelectorAll('button[aria-label]')].map((x) => x.getAttribute('aria-label')).filter((x) => /مساعدة|دليل/.test(x)); });
  say(`FAB at ${path}: ${JSON.stringify(fab)}`);
}
say('page errors: ' + JSON.stringify(log.pageErrors.map((e) => e.msg).slice(0, 5)) + ' / ' + JSON.stringify(log2.pageErrors.map((e) => e.msg).slice(0, 5)));
out('ui-new.out.txt', R.join('\n'));
await browser.close();
