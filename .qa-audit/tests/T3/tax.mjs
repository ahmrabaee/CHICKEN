// T3 tax: templates, engines OFF / tax-only / GL+tax ON, discount + tax, void, CN, VAT report vs GL.
// usage: T3_PORT=3106 T3_ENV=t3b node tax.mjs   (fresh dev instance t3b)
import { connect, BASE, q, q1, gl, diff, log, short, setup, restock, setSetting, save } from './lib.mjs';
const a = await connect(BASE, 'admin', 'admin123');
const { bankId } = await setup(a);
for (const [it, p] of [[2, 1800], [3, 2800], [4, 2200]]) await restock(a, it, 100000, p);
const L = (itemId, g, p, d) => ({ itemId, weightGrams: g, pricePerKg: p, ...(d != null ? { discountAmount: d } : {}) });
const VAT_OUT = q1(`select id from accounts where code='2120'`).id;
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const t16 = await a.post('/tax/templates', { name: 'VAT 16% Sales', type: 'sales', items: [{ accountId: VAT_OUT, rate: 1600 }] });
const tc = await a.post('/tax/templates', { name: 'Compound 15%+2% on total', type: 'sales', items: [{ accountId: VAT_OUT, rate: 1500 }, { accountId: VAT_OUT, rate: 200, chargeType: 'on_previous_row_total', rowId: 1 }] });
const tneg = await a.post('/tax/templates', { name: 'Negative rate', type: 'sales', items: [{ accountId: VAT_OUT, rate: -1500 }] });
const tgrp = await a.post('/tax/templates', { name: 'Group account', type: 'sales', items: [{ accountId: q1(`select id from accounts where code='2100'`).id, rate: 1500 }] });
log('create templates 16% / compound / negative / group-account', [t16, tc, tneg, tgrp].map((r) => `${short(r)}#${r.data?.id}`).join(' '));
log('accountant creates tax template (K3-010)', short(await (await setup(a)).acc.post('/tax/templates', { name: 'acc tmpl', type: 'sales', items: [{ accountId: VAT_OUT, rate: 0 }] })));

async function probe(label, body) {
  const g0 = gl();
  const r = await a.post('/sales', body);
  const d = r.data || {};
  log(label, `${short(r)}${r.ok ? ` sub=${d.grossTotalAmount - d.discountAmount} tax=${d.taxAmount} total=${d.totalAmount} paid=${d.amountPaid} due=${d.amountDue} profit=${d.totalProfit}` : ''}`);
  if (r.ok) log('   GL Δ', diff(g0, gl()));
  return r;
}

// ---------- MODE 1: both engines OFF ----------
log('=== MODE OFF/OFF', '');
await probe('OFF 16% template, walk-in pays UI-15% total 11500 (K4-001 backend side)', { saleType: 'cash', taxTemplateId: t16.data.id, lines: [L(2, 1000, 10000)], payments: [{ amount: 11500, paymentMethod: 'cash' }] });
await probe('OFF 16% template, customer 1 pays 11500 (UI estimate)', { saleType: 'cash', customerId: 1, taxTemplateId: t16.data.id, lines: [L(2, 1000, 10000)], payments: [{ amount: 11500, paymentMethod: 'cash' }] });
await probe('OFF compound template 15% + 2% of (net+15%)', { saleType: 'cash', taxTemplateId: tc.data.id, lines: [L(2, 1000, 10000)], payments: [{ amount: 11730, paymentMethod: 'cash' }] });
await probe('OFF negative-rate template', { saleType: 'cash', taxTemplateId: tneg.data?.id, lines: [L(2, 1000, 10000)], payments: [{ amount: 8500, paymentMethod: 'cash' }] });
await probe('OFF 15% with header discount 1000 (tax after discount?)', { saleType: 'cash', taxTemplateId: 1, discountAmount: 1000, lines: [L(2, 1000, 10000)], payments: [{ amount: 10350, paymentMethod: 'cash' }] });
// rounding: per-invoice vs per-line
await probe('OFF 15% three lines 333g/333g/334g @ 29.99 (per-invoice rounding)', { saleType: 'cash', taxTemplateId: 1, lines: [L(2, 333, 2999), L(2, 333, 2999), L(2, 334, 2999)], payments: [{ amount: 3450, paymentMethod: 'cash' }] });
// deactivate template and still use it
const deact = await a.put(`/tax/templates/${t16.data.id}`, { isActive: false });
log('deactivate 16% template', short(deact));
await probe('OFF sale with INACTIVE template', { saleType: 'cash', taxTemplateId: t16.data.id, lines: [L(2, 1000, 1000)], payments: [{ amount: 1160, paymentMethod: 'cash' }] });

// ---------- MODE 2: tax engine ON, GL engine OFF ----------
await setSetting(a, 'tax_engine_enabled', 'true');
log('=== MODE tax ON / GL OFF', q1(`select value from system_settings where key='tax_engine_enabled'`).value);
await probe('taxON/glOFF 15% sale 10000', { saleType: 'cash', taxTemplateId: 1, lines: [L(2, 1000, 10000)], payments: [{ amount: 11500, paymentMethod: 'cash' }] });

// ---------- MODE 3: GL engine ON + tax engine ON ----------
await setSetting(a, 'gl_engine_enabled', 'true');
log('=== MODE tax ON / GL ON', q1(`select value from system_settings where key='gl_engine_enabled'`).value);
const s1 = await probe('ON/ON 15% cash sale 10000', { saleType: 'cash', taxTemplateId: 1, lines: [L(3, 1000, 10000)], payments: [{ amount: 11500, paymentMethod: 'cash' }] });
const s2 = await probe('ON/ON 15% credit sale 10000 cust 2', { saleType: 'credit', customerId: 2, taxTemplateId: 1, lines: [L(3, 1000, 10000)] });
await probe('ON/ON 15% with header discount 30 (within 50 tolerance)', { saleType: 'cash', taxTemplateId: 1, discountAmount: 30, lines: [L(3, 1000, 10000)], payments: [{ amount: 11466, paymentMethod: 'cash' }] });
await probe('ON/ON 15% with header discount 1000', { saleType: 'cash', taxTemplateId: 1, discountAmount: 1000, lines: [L(3, 1000, 10000)], payments: [{ amount: 10350, paymentMethod: 'cash' }] });
await probe('ON/ON 15% with LINE discount 1000', { saleType: 'cash', taxTemplateId: 1, lines: [L(3, 1000, 10000, 1000)], payments: [{ amount: 10350, paymentMethod: 'cash' }] });
await probe('ON/ON compound template', { saleType: 'cash', taxTemplateId: tc.data.id, lines: [L(3, 1000, 10000)], payments: [{ amount: 11730, paymentMethod: 'cash' }] });
await probe('ON/ON no template, discount 1000', { saleType: 'cash', discountAmount: 1000, lines: [L(3, 1000, 10000)], payments: [{ amount: 9000, paymentMethod: 'cash' }] });
await probe('ON/ON template on GROUP account 2100', { saleType: 'cash', taxTemplateId: tgrp.data?.id, lines: [L(3, 1000, 10000)], payments: [{ amount: 11500, paymentMethod: 'cash' }] });
// payment + void of taxed credit sale
if (s2.ok) {
  log('ON/ON /payments/sale 5000 on taxed credit sale', short(await a.post('/payments/sale', { saleId: s2.data.id, amount: 5000, paymentMethod: 'cash' })));
  const cn = await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: s2.data.id, amount: 1150 });
  const g0 = gl();
  log('ON/ON CN 1150 (=1000 + VAT 150) on taxed sale', `${short(cn)} ${short(await a.post(`/credit-notes/${cn.data?.id}/submit`, {}))}`);
  log('   GL Δ (expect 4110 +1000, 2120 +150, AR -1150)', diff(g0, gl()));
}
if (s1.ok) {
  const g0 = gl();
  log('ON/ON void taxed cash sale', short(await a.post(`/sales/${s1.data.id}/void`, { reason: 'tax' })));
  log('   GL Δ (expect 2120 +1500, 4110 +10000, cash -11500)', diff(g0, gl()));
}
// VAT report vs GL
for (const [sd, ed] of [[today, today], [today, tomorrow]]) {
  const v = await a.get(`/tax/vat-report?startDate=${sd}&endDate=${ed}`);
  log(`VAT report ${sd}..${ed}`, `${short(v)} output=${v.data?.outputVat} input=${v.data?.inputVat} net=${v.data?.netVatPayable} byRate=${JSON.stringify(v.data?.byRate)}`);
}
log('GL 2120 credit balance (all posted JEs)', -gl()['2120']);
log('Σ sales.tax_amount non-voided (all)', q1(`select sum(tax_amount) s from sales where is_voided=0`).s);
log('Σ sales.tax_amount non-voided posted while GL+tax ON', q1(`select sum(tax_amount) s from sales where is_voided=0 and id in (select source_id from journal_entries where source_type='sale' and id in (select journal_entry_id from journal_entry_lines where account_id=?))`, VAT_OUT).s);
const sr = await a.get(`/reports/sales?startDate=${today}&endDate=${today}`);
log('sales report summary', sr.data?.summary);
log('GL revenue 4110 (credit) total', -gl()['4110']);

// ---------- MODE 4: GL ON, tax OFF ----------
await setSetting(a, 'tax_engine_enabled', 'false');
await probe('GL ON / tax OFF, 15% template 10000', { saleType: 'cash', taxTemplateId: 1, lines: [L(4, 1000, 10000)], payments: [{ amount: 11500, paymentMethod: 'cash' }] });
await probe('GL ON / tax OFF, discount 1000 no template', { saleType: 'cash', discountAmount: 1000, lines: [L(4, 1000, 10000)], payments: [{ amount: 9000, paymentMethod: 'cash' }] });
await setSetting(a, 'gl_engine_enabled', 'false');

log('INVARIANT unbalanced JEs', q(`select journal_entry_id, sum(debit_amount) dr, sum(credit_amount) cr from journal_entry_lines group by 1 having dr<>cr`));
log('JE lines on group accounts', q(`select l.journal_entry_id, a.code from journal_entry_lines l join accounts a on a.id=l.account_id where a.is_group=1`));
save('E:/DEV/Chicken FMS/.qa-audit/tests/T3/tax.out.txt');
