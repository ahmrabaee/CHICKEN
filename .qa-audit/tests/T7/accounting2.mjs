// Accounting PDFs: balance sheet / income statement / trial balance from the UI buttons
import { launch, instrument, uiLogin, shot, out, UI, sleep } from './lib.mjs';
import pdf from 'pdf-parse/lib/pdf-parse.js';
const R = []; const say = (s) => { console.log(s); R.push(s); };
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
const pdfs = [];
page.on('response', async (r) => { if (/\/pdf/.test(r.url()) && r.status() === 200) { try { pdfs.push({ url: r.url().replace(/^https?:\/\/[^/]+/, ''), text: (await pdf(await r.body())).text.replace(/\s+/g, ' ') }); } catch {} } });
await uiLogin(page);
await page.goto(UI + '/accounting'); await page.waitForLoadState('networkidle'); await sleep(1000);
for (const name of ['قائمة المركز المالي', 'قائمة الدخل', 'ميزان المراجعة']) {
  const n0 = pdfs.length;
  await page.getByRole('button', { name, exact: true }).first().click(); await sleep(3500);
  const dlg = (await page.getByRole('dialog').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160);
  const p = pdfs.slice(n0).at(-1);
  say(`${name}: dialog="${dlg}"\n  PDF ${p?.url}\n  ${p?.text?.slice(0, 700)}`);
  await page.keyboard.press('Escape'); await sleep(400);
}
say('apiErrors: ' + JSON.stringify(log.apiErrors.map((x) => x.url + ' ' + x.status)));
out('accounting2.out.txt', R.join('\n'));
await browser.close();
