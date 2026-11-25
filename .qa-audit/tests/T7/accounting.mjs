// Accounting page: journal list (ORCH-001 .items), trial balance vs DB, PDF buttons
import { launch, instrument, uiLogin, shot, out, API, UI, sleep, connect } from './lib.mjs';
import { DatabaseSync } from 'node:sqlite';
import pdf from 'pdf-parse/lib/pdf-parse.js';
const R = []; const say = (s) => { console.log(s); R.push(s); };
const c = await connect(API, 'admin', 'admin123');
const je = await c.get('/accounting/journal-entries?page=1&pageSize=20');
say('API journal-entries: total=' + JSON.stringify(je.body.pagination) + ' first=' + je.data?.[0]?.entryNumber);
const db = new DatabaseSync('E:/DEV/Chicken FMS/.qa-audit/envs/t7/app.db', { readOnly: true });
const tb = db.prepare(`SELECT a.code, sum(jl.debit_amount)-sum(jl.credit_amount) bal FROM journal_entry_lines jl JOIN accounts a ON a.id=jl.account_id JOIN journal_entries j ON j.id=jl.journal_entry_id GROUP BY a.code`).all();
say('DB posted balances: ' + tb.map((x) => x.code + '=' + (x.bal / 100).toFixed(2)).join(' '));
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
const pdfs = [];
page.on('response', async (r) => { if (/\/pdf/.test(r.url()) && r.status() === 200) { try { pdfs.push({ url: r.url().replace(/^https?:\/\/[^/]+/, ''), text: (await pdf(await r.body())).text.replace(/\s+/g, ' ') }); } catch {} } });
await uiLogin(page);
await page.goto(UI + '/accounting'); await page.waitForLoadState('networkidle'); await sleep(1000);
await page.getByRole('button', { name: 'قيود اليومية' }).click(); await sleep(1500);
const rows = await page.locator('tbody tr').count();
say(`journals tab rows=${rows}; first row: ${(await page.locator('tbody tr').first().innerText().catch(() => '')).replace(/\s+/g, ' ')}`);
await shot(page, 'accounting-journals');
const tbBtn = page.getByRole('button', { name: /ميزان المراجعة/ }).first();
if (await tbBtn.count()) { await tbBtn.click(); await sleep(1500); say('trial tab: ' + (await page.evaluate(() => document.querySelector('main')?.innerText || '')).replace(/\s+/g, ' ').slice(0, 900)); await shot(page, 'accounting-trial'); }
say('buttons: ' + JSON.stringify((await page.getByRole('button').allInnerTexts()).map((s) => s.trim()).filter((s) => /PDF|طباعة|قائمة|ميزانية|ميزان/.test(s))));
for (const name of ['الميزانية العمومية', 'قائمة الدخل']) {
  const b = page.getByRole('button', { name: new RegExp(name) }).first();
  if (await b.count()) { await b.click(); await sleep(3000); const p = pdfs.at(-1); say(`${name} PDF ${p?.url}\n  ${p?.text?.slice(0, 600)}`); await page.keyboard.press('Escape'); await sleep(300); }
}
say('pageErrors: ' + JSON.stringify(log.pageErrors) + ' apiErrors: ' + JSON.stringify(log.apiErrors.map((x) => x.url + ' ' + x.status)));
out('accounting.out.txt', R.join('\n'));
await browser.close();
