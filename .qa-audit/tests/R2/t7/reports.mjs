// Reports date presets in Asia/Jerusalem (K4-007), report vs DB vs dashboard (K4-011), PDF buttons (T3-017)
import { chromium } from 'playwright';
import { INIT, instrument, uiLogin, shot, out, UI, sleep } from './lib.mjs';
import { DatabaseSync } from 'node:sqlite';
const R = []; const say = (s) => { console.log(s); R.push(s); };
const db = new DatabaseSync('E:/DEV/Chicken FMS/.qa-audit/envs/r2/app.db', { readOnly: true });
const dbToday = db.prepare(`SELECT count(*) n, sum(total_amount) t FROM sales WHERE is_voided=0 AND date(sale_date/1000,'unixepoch','+2 hours')='2026-11-25'`).get();
say('DB: non-void sales on local 2026-11-25: ' + JSON.stringify(dbToday));
const browser = await chromium.launch();

async function run(label, fakeTime) {
  const context = await browser.newContext({ locale: 'ar', timezoneId: 'Asia/Jerusalem', viewport: { width: 1400, height: 950 } });
  await context.addInitScript(INIT);
  const page = await context.newPage();
  if (fakeTime) await page.clock.install({ time: new Date(fakeTime) });
  const log = instrument(page);
  await uiLogin(page);
  say(`\n=== ${label} (browser now=${await page.evaluate(() => new Date().toString())})`);
  await page.goto(UI + '/reports/sales'); await page.waitForLoadState('networkidle'); await sleep(1200);
  const req = (re) => log.requests.filter((r) => re.test(r.url)).slice(-1)[0];
  let r = req(/\/reports\/sales\?/);
  say('  default preset request: ' + r?.url);
  const cards = async () => (await page.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText)).replace(/\s+/g, ' ').slice(0, 400);
  say('  page: ' + await cards());
  for (const preset of ['اليوم', 'هذه السنة']) {
    await page.getByRole('combobox').filter({ hasText: /هذا الشهر|اليوم|هذه السنة|هذا الأسبوع|هذا الربع/ }).first().click();
    await page.getByRole('option', { name: preset }).click();
    await page.waitForLoadState('networkidle'); await sleep(1000);
    r = req(/\/reports\/sales\?/);
    say(`  preset ${preset}: request ${r?.url}`);
    say('    page: ' + (await cards()).slice(0, 300));
  }
  if (!fakeTime) {
    await shot(page, 'reports-sales-today');
    // PDF export button for "today"
    const q0 = log.requests.length;
    await page.getByRole('button', { name: 'تصدير PDF' }).click(); await sleep(3000);
    const pdfReq = log.requests.slice(q0).filter((x) => /pdf/i.test(x.url));
    say('  PDF requests: ' + JSON.stringify(pdfReq.map((x) => `${x.method} ${x.url} ${x.status}`)));
    const dlgText = await page.getByRole('dialog').innerText().catch(() => '');
    say('  PDF dialog: ' + dlgText.replace(/\s+/g, ' ').slice(0, 200));
    await shot(page, 'reports-pdf-dialog');
    await page.keyboard.press('Escape');
    // Dashboard
    await page.goto(UI + '/'); await page.waitForLoadState('networkidle'); await sleep(2000);
    say('  dashboard: ' + (await cards()).slice(0, 700));
    say('  dashboard requests: ' + JSON.stringify([...new Set(log.requests.filter((x) => /reports|debts/.test(x.url)).slice(-6).map((x) => x.url))]));
    await shot(page, 'dashboard');
  }
  say('  apiErrors: ' + JSON.stringify(log.apiErrors.map((x) => x.url + ' ' + x.status)) + ' pageErrors: ' + JSON.stringify(log.pageErrors.map((x) => x.msg)));
  await context.close();
}
await run('real clock', null);
await run('fake clock 2026-11-26 00:30 Asia/Jerusalem', '2026-11-26T00:30:00+02:00');
await run('fake clock 2026-12-31 23:30 Asia/Jerusalem (last day of year)', '2026-12-31T10:00:00+02:00');
out('reports.out.txt', R.join('\n'));
await browser.close();
