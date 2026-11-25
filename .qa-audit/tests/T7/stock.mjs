// Stock adjustment dialog, wastage (K4-018 label), stock transfer; compare UI with API/DB
import { launch, instrument, uiLogin, shot, out, API, UI, sleep, connect, getToasts, clearToasts } from './lib.mjs';
const R = []; const say = (s) => { console.log(s); R.push(s); };
const c = await connect(API, 'admin', 'admin123');
const inv = async (id) => { const r = (await c.get('/inventory?pageSize=200')).data; const x = (Array.isArray(r) ? r : r.items || []).find((i) => i.itemId === id); return x && Object.fromEntries(Object.entries(x).filter(([k,v])=>typeof v!=='object')); };
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page);
const nonGet = (q0) => log.requests.slice(q0).filter((x) => x.method !== 'GET').map((x) => `${x.method} ${x.url} ${x.status} req=${x.reqBody} res=${(x.resBody || '').slice(0, 220)}`);

async function adjust(itemName, type, qty, cost, reason) {
  await page.goto(UI + '/inventory'); await page.waitForLoadState('networkidle'); await sleep(800);
  await clearToasts(page);
  await page.locator('tr', { hasText: itemName }).first().getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'تعديل الكمية (تسوية يدوية)' }).click();
  const dlg = page.getByRole('dialog');
  if (type === 'decrease') { await dlg.getByRole('combobox').first().click(); await page.getByRole('option', { name: /خصم/ }).click(); }
  await dlg.locator('input[name=quantity]').fill(qty);
  if (cost) await dlg.locator('input[name=costPerUnit]').fill(cost);
  await dlg.getByPlaceholder(/مثلاً/).fill(reason);
  const q0 = log.requests.length;
  await dlg.locator('button[type=submit]').click(); await sleep(1800);
  say(`  adjust ${itemName} ${type} ${qty} cost=${cost}: ${JSON.stringify(nonGet(q0))} toasts=${JSON.stringify(await getToasts(page))}`);
  const row = await page.locator('tr', { hasText: itemName }).first().innerText().catch(() => '');
  say('  inventory row after: ' + row.replace(/\s+/g, ' '));
}
say('=== stock adjustment (أجنحة دجاج id 5)');
say('  API before: ' + JSON.stringify(await inv(5)));
await adjust('أجنحة دجاج', 'increase', '1.5', '20', 'جرد دوري اختبار');
say('  API after increase: ' + JSON.stringify(await inv(5)));
await adjust('أجنحة دجاج', 'decrease', '0.25', null, 'تلف اختبار');
say('  API after decrease: ' + JSON.stringify(await inv(5)));
await adjust('أجنحة دجاج', 'decrease', '99999', null, 'أكبر من المتاح');
await adjust('أجنحة دجاج', 'increase', '1', '1,250.00', 'فاصل آلاف في التكلفة');
say('  API after thousands-cost increase: ' + JSON.stringify(await inv(5)));
await shot(page, 'stock-adjust');

say('\n=== wastage (أفخاذ دجاج)');
await page.goto(UI + '/wastage/new'); await page.waitForLoadState('networkidle'); await sleep(800);
await page.locator('label:has-text("الصنف")').locator('..').getByRole('combobox').click();
await page.getByRole('option', { name: /أفخاذ دجاج/ }).first().click(); await sleep(800);
await page.locator('label:has-text("الدفعة")').locator('..').getByRole('combobox').click();
const lotOpts = await page.getByRole('option').allInnerTexts(); say('  lots offered: ' + JSON.stringify(lotOpts.slice(0, 5)));
await page.getByRole('option').first().click();
await page.getByPlaceholder('0.000').fill('0.3');
await page.locator('label:has-text("سبب الهدر")').locator('..').getByRole('combobox').click();
await page.getByRole('option').first().click();
let q0 = log.requests.length;
await page.locator('button[type=submit]').click(); await sleep(1800);
say('  ' + JSON.stringify(nonGet(q0)) + ' toasts=' + JSON.stringify(await getToasts(page)));
await page.goto(UI + '/wastage'); await page.waitForLoadState('networkidle'); await sleep(800);
await page.locator('tbody tr').first().getByRole('button').first().click().catch(() => {}); await sleep(1000);
const wd = await page.getByRole('dialog').innerText().catch(() => '');
say('  wastage detail: ' + wd.replace(/\s+/g, ' ').slice(0, 600));
await shot(page, 'wastage-detail');
await page.keyboard.press('Escape');

say('\n=== stock transfer page');
await page.goto(UI + '/stock-transfer/new'); await page.waitForLoadState('networkidle'); await sleep(1000);
say('  page: ' + (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(300, 900));
await shot(page, 'stock-transfer-new');
say('\npageErrors: ' + JSON.stringify(log.pageErrors) + ' apiErrors: ' + JSON.stringify(log.apiErrors.map((x) => x.url + ' ' + x.status)));
out('stock.out.txt', R.join('\n'));
await browser.close();
