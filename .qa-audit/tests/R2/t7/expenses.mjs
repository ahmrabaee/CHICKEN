// Expenses UI: normal save, amount > cash (INSUFFICIENT_BALANCE toast, K4-008), decimal/thousands input, preview vs saved
import { launch, instrument, uiLogin, shot, out, API, UI, sleep, connect, getToasts, clearToasts } from './lib.mjs';
const R = []; const say = (s) => { console.log(s); R.push(s); };
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page);
async function expense(amount, desc, tax) {
  await page.goto(UI + '/expenses/new'); await page.waitForLoadState('networkidle'); await sleep(600);
  await clearToasts(page);
  await page.locator('label:has-text("تصنيف المصروف")').locator('..').getByRole('combobox').click();
  await page.getByRole('option').first().click();
  await page.locator('input[name="amount"]').fill(amount);
  if (tax) await page.locator('input[name="taxAmount"]').fill(tax);
  await page.getByPlaceholder('وصف مختصر للمصروف...').fill(desc);
  await sleep(300);
  const preview = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').match(/(ملخص|الإجمالي)[^]{0,160}/)?.[0];
  const q0 = log.requests.length;
  await page.getByRole('button', { name: 'حفظ المصروف' }).click(); await sleep(2000);
  const ps = log.requests.slice(q0).filter((x) => x.method === 'POST');
  say(`expense amount "${amount}" tax "${tax || ''}": input=${await page.locator('input[name="amount"]').inputValue().catch(() => '(left page)')} preview=${JSON.stringify(preview)}\n  ${ps.map((x) => x.url + ' ' + x.status + ' req=' + x.reqBody + ' res=' + (x.resBody || '').slice(0, 260)).join('\n  ')}\n  toasts=${JSON.stringify(await getToasts(page))}`);
}
await expense('12.5', 'مصروف اختبار عادي');
await expense('99999', 'مصروف أكبر من الصندوق');
await shot(page, 'expense-insufficient');
await expense('1,234.50', 'فاصل آلاف');
await expense('10', 'مع ضريبة', '1.5');
say('pageErrors: ' + JSON.stringify(log.pageErrors));
out('expenses.out.txt', R.join('\n'));
await browser.close();
