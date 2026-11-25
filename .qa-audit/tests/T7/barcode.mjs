// Scale barcode in POS: label total vs saved line (K4-002), two labels same item edit/remove (K4-003), unknown barcode message
import { launch, instrument, uiLogin, shot, out, API, UI, sleep, connect, getToasts, clearToasts } from './lib.mjs';
import * as P from './pos-lib.mjs';
const R = []; const say = (s) => { console.log(s); R.push(s); };
const c = await connect(API, 'admin', 'admin123');
let it = (await c.get('/items?search=123456')).data?.find?.((x) => x.code === '123456');
if (!it) {
  const r = await c.post('/items', { code: '123456', name: 'فخذ ميزان', categoryId: 2, defaultSalePrice: 2999, defaultPurchasePrice: 1500 });
  it = r.data; say('created item ' + r.status + ' id=' + it?.id);
  const a = await c.post('/inventory/adjustments', { itemId: it.id, branchId: 1, adjustmentType: 'increase', quantityGrams: 10000, reason: 'رصيد اختبار باركود', unitCost: 1500 });
  say('stock ' + a.status);
}
// [2][item 6][weight g 5][total 7][price 5][check 1]
const label = (w, total) => '2' + '123456' + String(w).padStart(5, '0') + String(total).padStart(7, '0') + '02999' + '0';
const L1 = label(334, 1000), L2 = label(500, 1500), L3 = label(0, 1000);
say(`labels: L1=${L1} (0.334 kg, total 10.00) L2=${L2} (0.500 kg, total 15.00) L3=${L3} (no weight, total 10.00)`);
for (const l of [L1, L2, L3]) { const r = await c.get('/barcode/lookup?barcode=' + l); say(`  API lookup ${l}: ${r.status} weightKg=${r.data?.weightKg} price=${r.data?.price}`); }

const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page);
const scan = async (code) => {
  const inp = page.getByPlaceholder('امسح الباركود أو اكتبه ثم اضغط Enter...');
  await inp.fill(code); await inp.press('Enter'); await sleep(900);
};
const cartRows = () => page.evaluate(() => [...document.querySelectorAll('tbody tr')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()));
const posts = (q0) => log.requests.slice(q0).filter((x) => x.method === 'POST' && /\/sales$/.test(x.url)).map((x) => `${x.status} req=${x.reqBody} res=${(x.resBody || '').slice(0, 250)}`);

say('\n=== K4-002 single label 0.334 kg / 10.00');
await P.openPOS(page);
await page.locator('button', { hasText: /باركود/ }).first().click(); await sleep(300);
await scan(L1);
say('  cart: ' + JSON.stringify(await cartRows()) + ' panel=' + JSON.stringify(await P.panel(page)));
await P.setPaid(page, '10');
let q0 = log.requests.length;
await P.completeBtn(page).click(); await sleep(1800);
say('  POST: ' + JSON.stringify(posts(q0)) + ' toasts=' + JSON.stringify(await getToasts(page)));

say('\n=== K4-002 label without weight (inferred) total 10.00');
await P.openPOS(page); await clearToasts(page);
await page.locator('button', { hasText: /باركود/ }).first().click(); await sleep(300);
await scan(L3);
say('  cart: ' + JSON.stringify(await cartRows()));
await P.setPaid(page, '10');
q0 = log.requests.length;
await P.completeBtn(page).click(); await sleep(1800);
say('  POST: ' + JSON.stringify(posts(q0)) + ' toasts=' + JSON.stringify(await getToasts(page)));

say('\n=== K4-003 two labels same item, then +¼ on second row, then remove first row');
await P.openPOS(page); await clearToasts(page);
await page.locator('button', { hasText: /باركود/ }).first().click(); await sleep(300);
await scan(L2); await scan(label(250, 750));
say('  cart after 2 scans: ' + JSON.stringify(await cartRows()) + ' panel=' + JSON.stringify(await P.panel(page)));
const row2 = page.locator('tbody tr').nth(1);
await row2.getByRole('button').nth(3).click().catch((e) => say('  +btn err ' + e.message.split('\n')[0])); await sleep(300);
say('  cart after + on row 2: ' + JSON.stringify(await cartRows()) + ' panel=' + JSON.stringify(await P.panel(page)));
await page.locator('tbody tr').first().getByRole('button').last().click(); await sleep(300);
say('  cart after trash on row 1: ' + JSON.stringify(await cartRows()));
say('  React duplicate-key warnings: ' + log.console.filter((x) => /same key/.test(x.text)).length);
await shot(page, 'barcode-two-labels');

say('\n=== unknown / wrong-length barcode message');
await clearToasts(page);
if (!(await page.getByPlaceholder('امسح الباركود أو اكتبه ثم اضغط Enter...').count())) await page.locator('button', { hasText: /باركود/ }).first().click();
await scan('2999999000500001000029990');
await scan('12345');
const lookups = log.requests.filter((x) => x.url.includes('/barcode/lookup') && x.status >= 400).slice(-2).map((x) => x.status + ' ' + (x.resBody || '').slice(0, 200));
say('  API: ' + JSON.stringify(lookups) + '\n  toasts: ' + JSON.stringify(await getToasts(page)));
out('barcode.out.txt', R.join('\n'));
await browser.close();
