// Purchases UI: pay-full rounding (K4-013), paid-at-creation then edit (payment reset), decimal comma / Arabic digits / thousands paste
import { launch, instrument, uiLogin, shot, out, API, UI, sleep, connect, getToasts, clearToasts } from './lib.mjs';
const c = await connect(API, 'admin', 'admin123');
const R = []; const say = (s) => { console.log(s); R.push(s); };
const { browser, context } = await launch();
const page = await context.newPage();
const log = instrument(page);
await uiLogin(page);
const posts = (q0, re) => log.requests.slice(q0).filter((x) => x.method !== 'GET' && re.test(x.url));

async function newPurchase(lines, { payFull = false, paid = null, tax = null } = {}) {
  await page.goto(UI + '/purchasing/new'); await page.waitForLoadState('networkidle'); await sleep(500);
  await clearToasts(page);
  await page.locator('label:has-text("التاجر")').locator('..').getByRole('combobox').click();
  await page.getByRole('option', { name: 'مورد الدواجن المتحدة' }).click();
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) await page.getByRole('button', { name: /إضافة|فئة/ }).filter({ hasText: /إضافة/ }).first().click();
    const row = page.locator(`[name="lines.${i}.weightKg"]`);
    await page.getByRole('combobox').filter({ hasText: /اختر الفئة/ }).first().click();
    await page.getByRole('option', { name: lines[i].cat }).click();
    await page.locator(`input[name="lines.${i}.weightKg"]`).fill(lines[i].kg);
    await page.locator(`input[name="lines.${i}.pricePerKg"]`).fill(lines[i].price);
  }
  if (tax) await page.locator('input[name="taxAmount"]').fill(tax);
  if (payFull) await page.getByRole('button', { name: 'دفع الكل' }).click();
  if (paid !== null) await page.locator('input[name="amountPaid"]').fill(paid);
  await sleep(300);
  const ui = await page.evaluate(() => {
    const t = document.body.innerText;
    const g = (l) => (t.match(new RegExp(l + '\\s*₪\\s*([\\d.,]+)')) || [])[1];
    return { subtotal: g('المجموع'), grand: g('الإجمالي النهائي'), paid: document.querySelector('input[name="amountPaid"]')?.value, lineInputs: [...document.querySelectorAll('input[name$="weightKg"],input[name$="pricePerKg"]')].map((i) => i.value) };
  });
  say('  UI: ' + JSON.stringify(ui));
  const q0 = log.requests.length;
  await page.getByRole('button', { name: 'حفظ أمر الشراء' }).click();
  await sleep(2000);
  for (const p of posts(q0, /\/purchases/)) say(`  ${p.method} ${p.url} -> ${p.status}\n    req=${p.reqBody}\n    res=${(p.resBody || '').slice(0, 350)}`);
  say('  toasts: ' + JSON.stringify(await getToasts(page)) + ' url=' + page.url());
  const p = posts(q0, /\/purchases$/)[0];
  const m=(p?.resBody||'').match(/"id":(d+)/); return m?{id:Number(m[1])}:null;
}

const paidP={id:Number(process.argv[2])};

if (paidP?.id) {
  const before = (await c.get('/purchases/' + paidP.id)).data;
  say(`  before edit: id=${paidP.id} grand=${before.grandTotal} paid=${before.amountPaid} status=${before.paymentStatus ?? before.status}`);
  await page.goto(UI + `/purchasing/${paidP.id}/edit`); await page.waitForLoadState('networkidle'); await sleep(800);
  say('  edit form shows paid field: ' + (await page.locator('input[name="amountPaid"]').count()));
  await page.locator('textarea').first().fill('edited by T7');
  const q0 = log.requests.length;
  await page.getByRole('button', { name: 'حفظ التعديلات' }).click(); await sleep(2000);
  for (const p of posts(q0, /\/purchases/)) say(`  ${p.method} ${p.url} -> ${p.status} req=${p.reqBody} res=${(p.resBody || '').slice(0, 300)}`);
  say('  toasts: ' + JSON.stringify(await getToasts(page)));
  const after = (await c.get('/purchases/' + paidP.id)).data;
  say(`  after edit: grand=${after?.grandTotal} paid=${after?.amountPaid} status=${after?.paymentStatus ?? after?.status}`);
  await shot(page, 'purchase-edit-paid');
}
say('\npageErrors: ' + JSON.stringify(log.pageErrors));
out('purchase-edit.out.txt', R.join('\n'));
await browser.close();
