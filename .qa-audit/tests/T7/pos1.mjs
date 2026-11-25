// POS scenarios: baseline cash, tax templates != 15% (K4-001), credit without/with customer, discount, card w/o bank (K4-020)
import { launch, instrument, uiLogin, shot, out, API, sleep, connect, getToasts, clearToasts } from './lib.mjs';
import * as P from './pos-lib.mjs';
const c = await connect(API, 'admin', 'admin123');
const R = [];
const say = (s) => { console.log(s); R.push(s); };
// ensure templates
const tpls = (await c.get('/tax/templates')).data;
const list = Array.isArray(tpls) ? tpls : tpls?.data || [];
for (const [name, rate] of [['VAT 16% QA', 1600], ['VAT 10% QA', 1000]]) {
  if (!list.find((t) => t.name === name)) {
    const r = await c.post('/tax/templates', { name, type: 'sales', items: [{ accountId: 18, rate, chargeType: 'on_net_total' }] });
    say(`created template ${name}: ${r.status}`);
  }
}
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page);

async function scenario(name, fn) {
  say(`\n=== ${name}`);
  await P.openPOS(page);
  await clearToasts(page);
  const q0 = log.requests.length;
  try { await fn(); } catch (e) { say('  SCRIPT ERROR: ' + e.message.split('\n')[0]); }
  await sleep(1500);
  const posts = log.requests.slice(q0).filter((x) => x.method === 'POST' && /\/sales$/.test(x.url));
  for (const p of posts) {
    say(`  POST /sales -> ${p.status}\n    req: ${p.reqBody}\n    res: ${p.resBody?.slice(0, 600)}`);
    try {
      const body = JSON.parse(p.resBody);
      const s = body.data;
      if (s?.id) {
        const g = (await c.get('/sales/' + s.id)).data;
        say(`    backend sale ${g.saleNumber}: subtotal=${g.subtotal} discount=${g.discountAmount} tax=${g.taxAmount} total=${g.totalAmount} paid=${g.amountPaid} status=${g.paymentStatus} customerId=${g.customerId}`);
      }
    } catch {}
  }
  say('  toasts: ' + JSON.stringify(await getToasts(page)));
  await shot(page, 'pos1-' + name.replace(/[^a-z0-9]+/gi, '_').slice(0, 40));
}

await scenario('A baseline cash 1kg no tax', async () => {
  await P.addItem(page, 'فروج كامل', '1');
  await P.setPaid(page, '22');
  say('  panel: ' + JSON.stringify(await P.panel(page)));
  await P.completeBtn(page).click();
});
await scenario('B 16pct template walk-in pays shown total (K4-001)', async () => {
  await P.addItem(page, 'صدور دجاج', '1');
  await P.selectTax(page, 'VAT 16% QA');
  const pn = await P.panel(page); say('  panel: ' + JSON.stringify(pn));
  await P.setPaid(page, pn.total.replace(/,/g, ''));
  await P.completeBtn(page).click();
});
await scenario('C 16pct template registered customer pays shown total', async () => {
  await P.addItem(page, 'صدور دجاج', '1');
  await P.selectTax(page, 'VAT 16% QA');
  await P.freeCustomer(page, 'زبون اختبار ضريبة', '0599111222');
  const pn = await P.panel(page); say('  panel: ' + JSON.stringify(pn));
  await P.setPaid(page, pn.total.replace(/,/g, ''));
  await P.completeBtn(page).click();
});
await scenario('D 10pct template pays shown total (K4-001 overpay)', async () => {
  await P.addItem(page, 'صدور دجاج', '1');
  await P.selectTax(page, 'VAT 10% QA');
  const pn = await P.panel(page); say('  panel: ' + JSON.stringify(pn));
  await P.setPaid(page, pn.total.replace(/,/g, ''));
  await P.completeBtn(page).click();
});
await scenario('E 15pct default template sanity', async () => {
  await P.addItem(page, 'أفخاذ دجاج', '1.333');
  await P.selectTax(page, 'VAT 15% Sales');
  const pn = await P.panel(page); say('  panel: ' + JSON.stringify(pn));
  await P.setPaid(page, pn.total.replace(/,/g, ''));
  await P.completeBtn(page).click();
});
await scenario('F credit without customer -> button state', async () => {
  await P.addItem(page, 'أجنحة دجاج', '2');
  await P.saleType(page, 'credit');
  say('  complete enabled (no customer): ' + await P.completeBtn(page).isEnabled());
  await P.freeCustomer(page, 'زبون آجل', '0599333444');
  say('  complete enabled (free name+phone): ' + await P.completeBtn(page).isEnabled());
  await P.completeBtn(page).click();
});
await scenario('G discount 5 and discount > subtotal', async () => {
  await P.addItem(page, 'شيش طاووق', '0.5');
  await P.setDiscount(page, '100');
  say('  panel disc 100 on 15.00: ' + JSON.stringify(await P.panel(page)));
  await P.setDiscount(page, '5');
  const pn = await P.panel(page); say('  panel disc 5: ' + JSON.stringify(pn));
  await P.setPaid(page, pn.total.replace(/,/g, ''));
  await P.completeBtn(page).click();
});
await scenario('H card payment with zero bank accounts (K4-020)', async () => {
  await P.addItem(page, 'فروج كامل', '1');
  await P.method(page, 'card');
  await P.setPaid(page, '22');
  say('  bank select visible: ' + await page.locator('text=استلام في:').isVisible());
  await P.completeBtn(page).click();
});
await scenario('I partial cash walk-in paid 21.99 of 22 (1-agora tolerance)', async () => {
  await P.addItem(page, 'فروج كامل', '1');
  await P.setPaid(page, '21.99');
  say('  complete enabled: ' + await P.completeBtn(page).isEnabled());
  await P.completeBtn(page).click();
});
await scenario('J partial cash walk-in paid 10 of 22 no customer', async () => {
  await P.addItem(page, 'فروج كامل', '1');
  await P.setPaid(page, '10');
  say('  complete enabled (no customer): ' + await P.completeBtn(page).isEnabled());
});
out('pos1.out.txt', R.join('\n'));
await browser.close();
