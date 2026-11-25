// K4-011: Dashboard AR/AP KPI on a later day (browser clock 2026-11-27) vs /debts/summary and GL
import { chromium } from 'playwright';
import { INIT, instrument, uiLogin, shot, out, UI, sleep, connect, API } from './lib.mjs';
const R = []; const say = (s) => { console.log(s); R.push(s); };
const c = await connect(API, 'admin', 'admin123');
say('API /debts/summary: ' + JSON.stringify((await c.get('/debts/summary')).data));
const browser = await chromium.launch();
for (const t of [null, '2026-11-27T10:00:00+02:00']) {
  const context = await browser.newContext({ locale: 'ar', timezoneId: 'Asia/Jerusalem', viewport: { width: 1400, height: 950 } });
  await context.addInitScript(INIT);
  const page = await context.newPage();
  if (t) await page.clock.install({ time: new Date(t) });
  instrument(page);
  await uiLogin(page);
  await page.goto(UI + '/'); await page.waitForLoadState('networkidle'); await sleep(2000);
  const txt = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  const ar = (txt.match(/₪\s*([\d.,]+)\s*ديون الزبائن/) || [])[1];
  const ap = (txt.match(/₪\s*([\d.,]+)\s*ديون الموردين/) || [])[1];
  say(`clock=${t || 'real'}: dashboard ديون الزبائن=${ar} ديون الموردين=${ap}`);
  await shot(page, 'dashboard-' + (t ? 'nov27' : 'today'));
  // Debts page
  await page.goto(UI + '/debts'); await page.waitForLoadState('networkidle'); await sleep(1500);
  say('  debts page: ' + (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 350));
  await context.close();
}
out('dashboard.out.txt', R.join('\n'));
await browser.close();
