// POS page helpers
import { UI, sleep } from './lib.mjs';

export async function openPOS(page) {
  await page.goto(UI + '/sales/new');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('text=نقطة البيع');
  await sleep(500);
}
// Tap product card and enter weight via the numpad, confirm.
export async function addItem(page, name, kg) {
  await page.locator('button', { hasText: name }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.waitFor();
  for (const ch of String(kg)) {
    await dlg.getByRole('button', { name: ch, exact: true }).click();
  }
  await dlg.getByRole('button', { name: 'إضافة للسلة' }).click();
  await dlg.waitFor({ state: 'hidden' }).catch(() => {});
}
export async function selectTax(page, templateName) {
  // tax selector is the first combobox in invoice panel with placeholder "بدون ضريبة"
  const trig = page.getByRole('combobox').filter({ hasText: /بدون ضريبة|VAT|ضريبة|%/ }).first();
  await trig.click();
  await page.getByRole('option', { name: templateName }).click();
  await sleep(200);
}
export async function saleType(page, t) {
  await page.locator('button', { hasText: new RegExp('^' + (t === 'cash' ? 'نقدي' : 'آجل') + '$') }).click();
}
export async function method(page, m) {
  const label = { cash: 'نقداً', card: 'بطاقة', bank_transfer: 'تحويل بنكي' }[m];
  await page.locator('button', { hasText: label }).first().click();
}
export async function setPaid(page, v) {
  const inp = page.getByPlaceholder('أدخل المبلغ المدفوع...');
  await inp.fill('');
  if (v !== '') await inp.pressSequentially(String(v));
}
export async function setDiscount(page, v) {
  const inp = page.locator('span:text-is("خصم ₪")').locator('xpath=..').locator('input');
  await inp.fill(String(v));
}
export async function freeCustomer(page, name, phone) {
  await page.getByPlaceholder(/اسم الزبون/).fill(name);
  await page.getByPlaceholder(/الهاتف/).fill(phone);
}
// Read the totals panel text
export async function panel(page) {
  return page.evaluate(() => {
    const t = document.body.innerText;
    const grab = (label) => { const m = t.match(new RegExp(label + '\\s*[\\n\\s]*[-−]?₪?\\s*([\\d,.]+)')); return m ? m[1] : null; };
    return { subtotal: grab('المجموع الفرعي'), tax: grab('\nالضريبة'), total: grab('الإجمالي'), net: grab('صافي قبل الضريبة') };
  });
}
export function completeBtn(page) { return page.getByRole('button', { name: 'إتمام البيع' }); }
