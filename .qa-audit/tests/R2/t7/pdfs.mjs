// PDF/print buttons: sale invoice PDF (T3-016), customer statement PDF (dates, balance), supplier statement, debts PDF; accountant sale detail
import { launch, instrument, uiLogin, shot, out, API, UI, sleep, connect, getToasts } from './lib.mjs';
import pdf from 'pdf-parse/lib/pdf-parse.js';
const R = []; const say = (s) => { console.log(s); R.push(s); };
const c = await connect(API, 'admin', 'admin123');
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
const pdfs = [];
page.on('response', async (r) => {
  if (/\/pdf/.test(r.url()) && r.status() === 200) {
    try { const b = await r.body(); const t = await pdf(b); pdfs.push({ url: r.url().replace(/^https?:\/\/[^/]+/, ''), text: t.text.replace(/\s+/g, ' ').trim() }); } catch (e) { pdfs.push({ url: r.url(), err: e.message }); }
  }
});
const lastPdf = async () => { await sleep(2500); return pdfs.at(-1); };
await uiLogin(page);

say('=== sale invoice PDF for SAL-…-0002 (id 7: 16% tax, total 40.60, paid 40.25)');
const s7 = (await c.get('/sales/7')).data;
say(`  backend: subtotal=${s7.grossTotalAmount} tax=${s7.taxAmount} total=${s7.totalAmount} paid=${s7.amountPaid} due=${s7.amountDue}`);
await page.goto(UI + '/sales/7'); await page.waitForLoadState('networkidle'); await sleep(1000);
say('  /sales/7 deep link opens detail: ' + (await page.getByRole('dialog').count()));
await page.getByRole('combobox').filter({ hasText: 'جميع الحالات' }).click();
await page.getByRole('option', { name: 'مدفوع جزئياً' }).click(); await sleep(1200);
await page.locator('tr', { hasText: 'SAL-20261125-0002' }).getByTitle('عرض التفاصيل').click(); await sleep(1500);
say('  sale detail page: ' + (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').match(/تفاصيل[^]{0,900}/)?.[0]);
const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await page.getByRole('button', { name: 'تحميل PDF' }).click();
const d = await dl;
let p = await lastPdf();
say('  download event: ' + (d ? d.suggestedFilename() : 'none') + '\n  PDF ' + p?.url + '\n  text: ' + p?.text?.slice(0, 900));
await shot(page, 'sale-7-detail');
await page.getByRole('button', { name: 'طباعة' }).first().click(); await sleep(2500);
say('  print button → pdf fetched: ' + (pdfs.at(-1)?.url) + ' toasts=' + JSON.stringify(await getToasts(page)));

say('\n=== customer statement PDF (customer 4 زبون اختبار ضريبة, currentBalance 35)');
await page.goto(UI + '/customers/4'); await page.waitForLoadState('networkidle'); await sleep(1000);
say('  profile: ' + (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').match(/زبون اختبار ضريبة[^]{0,400}/)?.[0]);
await page.getByRole('button', { name: /كشف حساب PDF/ }).click();
p = await lastPdf();
const dlgDates = await page.getByRole('dialog').innerText().catch(() => '');
say('  dialog: ' + dlgDates.replace(/\s+/g, ' ').slice(0, 200) + '\n  PDF ' + p?.url + '\n  text: ' + p?.text?.slice(0, 900));
await shot(page, 'customer-statement');
await page.keyboard.press('Escape');

say('\n=== customer 1 (seed, مطعم أ) statement');
await page.goto(UI + '/customers/1'); await page.waitForLoadState('networkidle'); await sleep(800);
await page.getByRole('button', { name: /كشف حساب PDF/ }).click();
p = await lastPdf(); say('  PDF ' + p?.url + '\n  text: ' + p?.text?.slice(0, 700));
await page.keyboard.press('Escape');

say('\n=== supplier statement (supplier 1)');
await page.goto(UI + '/traders/1'); await page.waitForLoadState('networkidle'); await sleep(800);
say('  supplier profile: ' + (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').match(/مورد الدواجن المتحدة[^]{0,300}/)?.[0]);
const sb = page.getByRole('button', { name: /كشف حساب/ }).first();
if (await sb.count()) { await sb.click(); p = await lastPdf(); say('  PDF ' + p?.url + '\n  text: ' + p?.text?.slice(0, 700)); await page.keyboard.press('Escape'); }
say('  supplier API: ' + JSON.stringify((await c.get('/suppliers/1')).data).slice(0, 200));

say('\n=== debts receivables PDF');
await page.goto(UI + '/debts'); await page.waitForLoadState('networkidle'); await sleep(800);
await page.getByRole('button', { name: 'تصدير PDF' }).first().click();
p = await lastPdf(); say('  PDF ' + p?.url + '\n  text: ' + p?.text?.slice(0, 500));
say('\npdf API errors: ' + JSON.stringify(log.apiErrors.map((x) => x.url + ' ' + x.status + ' ' + (x.resBody || '').slice(0, 150))));
say('pageErrors: ' + JSON.stringify(log.pageErrors));
out('pdfs.out.txt', R.join('\n'));
await browser.close();
