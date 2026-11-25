// POS edge inputs: negative discount, 100% discount, weight-edit rounding (K4-004), Arabic digits / comma / paste / huge in paid
import { launch, instrument, uiLogin, shot, out, API, sleep, connect, getToasts, clearToasts } from './lib.mjs';
import * as P from './pos-lib.mjs';
const R = [];
const say = (s) => { console.log(s); R.push(s); };
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page);
const salesPosts = (q0) => log.requests.slice(q0).filter((x) => x.method === 'POST' && /\/sales$/.test(x.url));
const short = (p) => `${p.status} req=${p.reqBody} res=${(p.resBody.match(/"saleNumber":"[^"]+"|"discountAmount":-?\d+|"totalAmount":-?\d+|"amountPaid":\d+|"paymentStatus":"\w+"|"messageAr":"[^"]+"/g) || []).join(' ')}`;

say('=== negative discount -5 submit');
await P.openPOS(page);
await P.addItem(page, 'شيش طاووق', '0.5');
await P.setDiscount(page, '-5');
let pn = await P.panel(page); say('  panel: ' + JSON.stringify(pn));
await P.setPaid(page, pn.total);
let q0 = log.requests.length;
say('  complete enabled: ' + await P.completeBtn(page).isEnabled());
await P.completeBtn(page).click(); await sleep(1500);
for (const p of salesPosts(q0)) say('  POST ' + short(p));
say('  toasts: ' + JSON.stringify(await getToasts(page)));

say('\n=== 100% discount, pay 0.01');
await P.openPOS(page); await clearToasts(page);
await P.addItem(page, 'شيش طاووق', '0.5');
await P.setDiscount(page, '15');
await P.setPaid(page, '0.01');
pn = await P.panel(page); say('  panel: ' + JSON.stringify(pn));
say('  complete enabled: ' + await P.completeBtn(page).isEnabled());
q0 = log.requests.length;
await P.completeBtn(page).click(); await sleep(1500);
for (const p of salesPosts(q0)) say('  POST ' + short(p));
say('  toasts: ' + JSON.stringify(await getToasts(page)));

say('\n=== K4-004 weight edit 0.255 via dialog re-open');
await P.openPOS(page);
await P.addItem(page, 'فروج كامل', '0.255');
say('  cart after add: ' + JSON.stringify(await P.panel(page)));
await page.locator('button', { hasText: 'فروج كامل' }).first().click();
await page.getByRole('dialog').getByRole('button', { name: 'إضافة للسلة' }).click(); await sleep(300);
pn = await P.panel(page); say('  cart after re-confirm same 0.255: ' + JSON.stringify(pn));
await P.setPaid(page, pn.total);
q0 = log.requests.length;
await P.completeBtn(page).click(); await sleep(1500);
for (const p of salesPosts(q0)) say('  POST ' + short(p));

say('\n=== paid input: Arabic digits, decimal comma, paste, huge');
await P.openPOS(page);
await P.addItem(page, 'فروج كامل', '1');
const inp = page.getByPlaceholder('أدخل المبلغ المدفوع...');
for (const v of ['٢٢', '22,00', '1e3', '99999999999999999']) {
  await inp.fill('');
  await inp.pressSequentially(v);
  await sleep(150);
  const st = await page.evaluate(() => { const i = document.querySelector('input[placeholder="أدخل المبلغ المدفوع..."]'); return { value: i.value, validity: i.validity.badInput }; });
  say(`  typed ${JSON.stringify(v)} -> input.value=${JSON.stringify(st.value)} badInput=${st.validity} completeEnabled=${await P.completeBtn(page).isEnabled()} warn=${await page.locator('text=أدخل المبلغ المدفوع —').count()}`);
}
// paste Arabic digits via clipboard event
await inp.fill('');
await inp.focus();
await page.evaluate(() => { const i = document.querySelector('input[placeholder="أدخل المبلغ المدفوع..."]'); const dt = new DataTransfer(); dt.setData('text/plain', '٢٢٫٥٠'); i.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })); });
await page.keyboard.insertText('٢٢٫٥٠');
say('  insertText "٢٢٫٥٠" -> value=' + JSON.stringify(await inp.inputValue()));
// discount with Arabic digits
await P.setDiscount(page, '').catch(() => {});
const disc = page.locator('span:text-is("خصم ₪")').locator('xpath=..').locator('input');
await disc.focus(); await page.keyboard.insertText('٥');
say('  discount insertText "٥" -> value=' + JSON.stringify(await disc.inputValue()) + ' panel=' + JSON.stringify(await P.panel(page)));
// huge weight via numpad
await P.openPOS(page);
await page.locator('button', { hasText: 'فروج كامل' }).first().click();
const dlg = page.getByRole('dialog');
for (const ch of '99999999') await dlg.getByRole('button', { name: ch, exact: true }).click();
say('  weight dialog 99999999 kg: ' + (await dlg.innerText()).replace(/\s+/g, ' ').slice(0, 90));
await dlg.getByRole('button', { name: 'إضافة للسلة' }).click(); await sleep(300);
pn = await P.panel(page); say('  panel: ' + JSON.stringify(pn));
await P.setPaid(page, pn.total.replace(/,/g, ''));
q0 = log.requests.length;
await P.completeBtn(page).click(); await sleep(2000);
for (const p of salesPosts(q0)) say('  POST ' + short(p));
say('  toasts: ' + JSON.stringify(await getToasts(page)));
await shot(page, 'pos3-huge');
say('\npage errors: ' + JSON.stringify(log.pageErrors));
out('pos3.out.txt', R.join('\n'));
await browser.close();
