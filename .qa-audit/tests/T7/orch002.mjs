// ORCH-002: payment form with card / bank_transfer when there are zero bank accounts.
import { launch, instrument, uiLogin, shot, out, UI, API, sleep, connect } from './lib.mjs';
const c = await connect(API, 'admin', 'admin123');
const banks = await c.get('/bank-accounts');
const lines = [`bank accounts in DB: ${JSON.stringify(banks.data).slice(0, 200)}`];
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page);
for (const method of ['بطاقة', 'تحويل بنكي']) {
  const e0 = log.pageErrors.length;
  await page.goto(UI + '/payments/new');
  await page.waitForLoadState('networkidle');
  const trig = page.locator('label:has-text("طريقة الدفع")').locator('..').getByRole('combobox');
  await trig.click();
  await page.getByRole('option', { name: method, exact: true }).click();
  await sleep(1000);
  const body = await page.evaluate(() => document.body.innerText);
  const f = await shot(page, 'orch002-' + (method === 'بطاقة' ? 'card' : 'transfer'));
  lines.push(`method=${method}: pageErrors=${JSON.stringify(log.pageErrors.slice(e0).map((e) => e.msg))} bodyLen=${body.length} formStillVisible=${body.includes('طريقة الدفع')} screenshot=${f}`);
  lines.push('  body excerpt: ' + body.replace(/\s+/g, ' ').slice(0, 300));
}
// console errors
lines.push('console errors: ' + JSON.stringify(log.console.filter((x) => x.type === 'error').map((x) => x.text.slice(0, 200)).slice(0, 5)));
out('orch002.out.txt', lines.join('\n'));
console.log(lines.join('\n'));
await browser.close();
