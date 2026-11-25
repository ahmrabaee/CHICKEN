// K4-021 POS item list > 100; K4-012 payment form beyond first 500 sales; payment amount > outstanding / decimal comma
import { launch, instrument, uiLogin, shot, out, API, UI, sleep, connect, getToasts, clearToasts } from './lib.mjs';
import * as P from './pos-lib.mjs';
const c = await connect(API, 'admin', 'admin123');
const R = []; const say = (s) => { console.log(s); R.push(s); };
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page);

say('=== K4-021 POS >100 items');
const tot = (await c.get('/items?pageSize=1&isActive=true')).body.pagination;
say('  active items in backend: ' + JSON.stringify(tot));
await P.openPOS(page);
const cards = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /\/ كجم/.test(b.innerText)).map((b) => b.innerText.split('\n')[0]));
say(`  product cards rendered: ${cards.length}; has 'صنف اختبار 105': ${cards.some((x) => x.includes('105'))}; has 'صنف اختبار 006': ${cards.some((x) => x.includes('006'))}`);
const itemsReq = log.requests.filter((r) => r.url.includes('/items')).map((r) => r.url);
say('  items requests: ' + JSON.stringify([...new Set(itemsReq)]));
for (const q of ['صنف اختبار 105', 'QA-105', 'فروج']) {
  await page.getByPlaceholder('ابحث عن منتج بالاسم أو الكود...').fill(q); await sleep(500);
  const txt = await page.evaluate(() => document.body.innerText.includes('لا توجد منتجات تطابق البحث'));
  const n = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /\/ كجم/.test(b.innerText)).length);
  say(`  search "${q}": cards=${n} noMatchMessage=${txt}`);
}
await shot(page, 'pos-101-items');

say('\n=== K4-012 payment for old unpaid sale beyond first 500 (saleId=23)');
const target = (await c.get('/sales/23')).data;
say(`  target ${target.saleNumber} total=${target.totalAmount} paid=${target.amountPaid}; total sales=${(await c.get('/sales?pageSize=1')).body.pagination?.totalItems}`);
await page.goto(UI + '/payments/new?saleId=23'); await page.waitForLoadState('networkidle'); await sleep(1000);
const salesReq = log.requests.filter((r) => r.url.includes('/sales?')).slice(-1)[0];
say('  sales request: ' + salesReq?.url);
const refText = await page.locator('label:has-text("فاتورة البيع")').locator('..').innerText().catch(() => '');
say('  invoice field shows: ' + JSON.stringify(refText.replace(/\s+/g, ' ').slice(0, 200)));
await page.locator('input[name="amount"]').fill('5');
await clearToasts(page);
let q0 = log.requests.length;
await page.getByRole('button', { name: /حفظ|تسجيل/ }).last().click(); await sleep(1500);
say('  submit -> toasts=' + JSON.stringify(await getToasts(page)) + ' posts=' + JSON.stringify(log.requests.slice(q0).filter((x) => x.method === 'POST').map((x) => x.url + ' ' + x.status + ' ' + x.reqBody)));
await shot(page, 'payment-old-sale');

say('\n=== payment: amount > outstanding, decimal comma "1,250.00"');
// newest credit sale for customer: create one 10.00
const s2 = (await c.post('/sales', { saleType: 'credit', customerId: 2, lines: [{ itemId: 2, weightGrams: 1000, pricePerKg: 1000 }] })).data;
say(`  new credit sale ${s2.saleNumber} id=${s2.id} total=${s2.totalAmount}`);
for (const amt of ['1,250.00', '25']) {
  await page.goto(UI + '/payments/new?saleId=' + s2.id); await page.waitForLoadState('networkidle'); await sleep(1000);
  await page.locator('input[name="amount"]').fill(amt);
  const v = await page.locator('input[name="amount"]').inputValue();
  await clearToasts(page);
  q0 = log.requests.length;
  await page.getByRole('button', { name: /حفظ|تسجيل/ }).last().click(); await sleep(1500);
  const ps = log.requests.slice(q0).filter((x) => x.method === 'POST');
  say(`  amount typed ${amt} -> input "${v}" -> ${JSON.stringify(ps.map((x) => x.url + ' ' + x.status + ' req=' + x.reqBody + ' res=' + (x.resBody || '').slice(0, 200)))} toasts=${JSON.stringify(await getToasts(page))}`);
}
const s2b = (await c.get('/sales/' + s2.id)).data;
say(`  sale ${s2.saleNumber} after: total=${s2b.totalAmount} paid=${s2b.amountPaid} status=${s2b.paymentStatus}`);
say('\npageErrors: ' + JSON.stringify(log.pageErrors));
out('limits.out.txt', R.join('\n'));
await browser.close();
