// POS: discount, double-submit (K4-006), receipt print content + HTML injection (K4-005), weight edit rounding (K4-004)
import { launch, instrument, uiLogin, shot, out, API, sleep, connect, getToasts, clearToasts } from './lib.mjs';
import * as P from './pos-lib.mjs';
const c = await connect(API, 'admin', 'admin123');
const R = [];
const say = (s) => { console.log(s); R.push(s); };
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page);
const salesPosts = (q0) => log.requests.slice(q0).filter((x) => x.method === 'POST' && /\/sales$/.test(x.url));
const countSales = async () => (await c.get('/sales?pageSize=1')).body?.pagination?.total ?? (await c.get('/sales?pageSize=1')).body?.total;

// --- G discount
say('=== G discount');
await P.openPOS(page);
await P.addItem(page, 'شيش طاووق', '0.5');
await P.setDiscount(page, '100');
say('  panel with discount 100 on subtotal 15.00: ' + JSON.stringify(await P.panel(page)));
await P.setDiscount(page, '-5');
say('  panel with discount -5: ' + JSON.stringify(await P.panel(page)));
await P.setDiscount(page, '5');
let pn = await P.panel(page); say('  panel discount 5: ' + JSON.stringify(pn));
let q0 = log.requests.length;
await P.setPaid(page, pn.total);
await P.completeBtn(page).click(); await sleep(1500);
for (const p of salesPosts(q0)) say(`  POST ${p.status} req=${p.reqBody} res=${p.resBody.slice(0, 260)}`);

// --- K4-006 double submit: two synchronous clicks
say('\n=== K4-006 double submit');
const before = await countSales();
await P.openPOS(page);
await P.addItem(page, 'فروج كامل', '1');
await P.setPaid(page, '22');
q0 = log.requests.length;
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('إتمام البيع')); b.click(); b.click(); b.click(); });
await sleep(2500);
let posts = salesPosts(q0);
say(`  synchronous triple click -> ${posts.length} POST /sales: ${posts.map((p) => p.status + ' ' + (p.resBody.match(/"saleNumber":"[^"]+"/) || [''])[0]).join(' | ')}`);
// Playwright dblclick
await P.openPOS(page);
await P.addItem(page, 'فروج كامل', '1');
await P.setPaid(page, '22');
q0 = log.requests.length;
await P.completeBtn(page).dblclick();
await sleep(2500);
posts = salesPosts(q0);
say(`  dblclick -> ${posts.length} POST /sales: ${posts.map((p) => p.status + ' ' + (p.resBody.match(/"saleNumber":"[^"]+"/) || [''])[0]).join(' | ')}`);
// keyboard: focus button and press Enter twice fast
await P.openPOS(page);
await P.addItem(page, 'فروج كامل', '1');
await P.setPaid(page, '22');
q0 = log.requests.length;
await P.completeBtn(page).focus();
await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
await sleep(2500);
posts = salesPosts(q0);
say(`  Enter x2 -> ${posts.length} POST /sales: ${posts.map((p) => p.status + ' ' + (p.resBody.match(/"saleNumber":"[^"]+"/) || [''])[0]).join(' | ')}`);
say(`  sales count before=${before} after=${await countSales()}`);

// --- K4-005 print content + HTML injection
say('\n=== K4-005 print');
await P.openPOS(page);
await P.addItem(page, 'صدور دجاج', '1');
await P.selectTax(page, 'VAT 16% QA');
await P.freeCustomer(page, '<img src=x onerror="window.top.__xss=(window.top.__xss||0)+1;window.top.__stolen=localStorage.getItem(\'access_token\')">', '0599000111');
await P.setPaid(page, '40.25');
await page.evaluate(() => { window.__prints = []; });
await page.getByRole('button', { name: 'طباعة' }).click();
await sleep(1500);
const pr = await page.evaluate(() => ({ prints: window.__prints, xss: window.__xss, stolen: (window.__stolen || '').slice(0, 25) }));
say('  print calls: ' + JSON.stringify(pr.prints.map((p) => ({ printed: p.printed, imgs: p.imgs, text: p.bodyText }))));
say('  injected script executed: xss=' + pr.xss + ' tokenPrefixRead=' + JSON.stringify(pr.stolen));
await shot(page, 'pos2-print-xss');
// preview dialog
await page.getByRole('button', { name: 'معاينة' }).click(); await sleep(600);
const prev = await page.getByRole('dialog').innerText().catch(() => '');
say('  preview dialog text: ' + JSON.stringify(prev.replace(/\s+/g, ' ').slice(0, 500)));
await shot(page, 'pos2-preview');
await page.keyboard.press('Escape');
// complete sale with customer (XSS name) then try to print after completion
await page.getByPlaceholder(/اسم الزبون/).fill('زبون طباعة');
q0 = log.requests.length;
await P.completeBtn(page).click(); await sleep(1500);
for (const p of salesPosts(q0)) say(`  saved: ${p.status} ${(p.resBody.match(/"saleNumber":"[^"]+"|"totalAmount":\d+|"amountPaid":\d+/g) || []).join(' ')}`);
say('  print button enabled after completion: ' + await page.getByRole('button', { name: 'طباعة' }).isEnabled());

// --- K4-004 weight edit rounding
say('\n=== K4-004 weight edit');
await P.openPOS(page);
await P.addItem(page, 'فروج كامل', '0.255');
say('  after add 0.255: ' + JSON.stringify(await P.panel(page)));
// tap the product again → dialog opens with current qty; replace with 0.255 again
await page.locator('button', { hasText: 'فروج كامل' }).first().click();
const dlg = page.getByRole('dialog'); await dlg.waitFor();
say('  dialog initial value: ' + (await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 120));
for (let i = 0; i < 6; i++) await dlg.getByRole('button', { name: '⌫', exact: true }).click();
for (const ch of '0.255') await dlg.getByRole('button', { name: ch, exact: true }).click();
await dlg.getByRole('button', { name: 'إضافة للسلة' }).click(); await sleep(300);
say('  after edit to 0.255: ' + JSON.stringify(await P.panel(page)));
await P.setPaid(page, (await P.panel(page)).total);
q0 = log.requests.length;
await P.completeBtn(page).click(); await sleep(1500);
for (const p of salesPosts(q0)) say(`  POST ${p.status} req=${p.reqBody}`);
// min weight: 0.05 kg
await P.openPOS(page);
await page.locator('button', { hasText: 'فروج كامل' }).first().click();
for (const ch of '0.05') await page.getByRole('dialog').getByRole('button', { name: ch, exact: true }).click();
say('  0.05 kg confirm enabled: ' + await page.getByRole('dialog').getByRole('button', { name: 'إضافة للسلة' }).isEnabled());
await page.keyboard.press('Escape');

say('\nconsole errors: ' + JSON.stringify(log.console.filter((x) => x.type === 'error').map((x) => x.text.slice(0, 150)).slice(0, 8)));
say('page errors: ' + JSON.stringify(log.pageErrors));
out('pos2.out.txt', R.join('\n'));
await browser.close();
