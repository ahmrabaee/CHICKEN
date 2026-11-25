// T3 reports & PDFs vs raw data/GL. Run against an instance that already has taxed sales, CNs and voids (t3b after tax.mjs).
// usage: T3_PORT=3106 T3_ENV=t3b node reports.mjs
import { connect, BASE, q, q1, gl, log, short, pdfText, save } from './lib.mjs';
const a = await connect(BASE, 'admin', 'admin123');
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

// --- raw truth
const raw = q1(`select count(*) n, sum(total_amount) total, sum(tax_amount) tax, sum(discount_amount) disc, sum(total_cost) cost, sum(total_profit) profit from sales where is_voided=0 and docstatus=1 and sale_number not like '%SEED%'`);
const cn = q1(`select coalesce(sum(amount),0) s from credit_notes where docstatus=1 and original_invoice_type='sale'`).s;
const G = gl();
log('RAW sales (non-voided, API-created)', raw);
log('RAW submitted sale credit notes', cn);
log('GL: revenue 4110 cr / VAT 2120 cr / COGS 5100 / 5400 (discount+CN+roundoff)', { rev: -G['4110'], vat: -G['2120'], cogs: G['5100'], x5400: G['5400'] });
log('GL gross margin (4110 - 5100 - 5400)', -G['4110'] - G['5100'] - G['5400']);

const sr = await a.get(`/reports/sales?startDate=${today}&endDate=${today}`);
log('/reports/sales summary', sr.data?.summary);
log('  Σ byItem revenue vs summary grossRevenue', { byItem: (sr.data?.byItem ?? []).reduce((s, i) => s + i.revenue, 0), gross: sr.data?.summary?.grossRevenue });
const pl = await a.get(`/reports/profit-loss?startDate=${today}&endDate=${today}`);
log('/reports/profit-loss', pl.data);
const db = await a.get(`/reports/dashboard`);
log('/reports/dashboard today', db.data?.todaySales ?? db.data?.today ?? Object.keys(db.data || {}));
const isr = await a.get(`/accounting/reports/income-statement?startDate=${today}&endDate=${today}`);
log('/accounting/reports/income-statement (JSON) status', short(isr));
const tb = await a.get(`/accounting/trial-balance`);
log('/accounting/trial-balance totals', tb.data?.totals ?? tb.data?.summary ?? short(tb));

// --- PDFs
const taxed = q1(`select id, sale_number, gross_total_amount g, discount_amount d, tax_amount t, total_amount tot, amount_paid p from sales where tax_amount>0 and is_voided=0 order by id desc limit 1`);
const inv = await pdfText(a, `/sales/${taxed.id}/pdf?language=ar`);
log(`invoice PDF ${taxed.sale_number} (g=${taxed.g} d=${taxed.d} t=${taxed.t} tot=${taxed.tot})`, `${inv.status} has total ${(taxed.tot / 100).toFixed(2)}: ${inv.text.includes((taxed.tot / 100).toFixed(2))}; has tax ${(taxed.t / 100).toFixed(2)}: ${inv.text.includes((taxed.t / 100).toFixed(2))}; SAR/ر.س: ${/SAR|ر\.س/.test(inv.text)}; ₪/شيكل/ILS: ${/₪|شيكل|ILS/.test(inv.text)}`);
log('  invoice PDF text sample', inv.text.replace(/\s+/g, ' ').slice(0, 400));
const invEn = await pdfText(a, `/sales/${taxed.id}/pdf?language=en`);
log('  invoice PDF (en) text sample', invEn.text.replace(/\s+/g, ' ').slice(0, 500));
const voided = q1(`select id from sales where is_voided=1 order by id desc limit 1`);
if (voided) { const v = await pdfText(a, `/sales/${voided.id}/pdf?language=en`); log('voided sale invoice PDF marks VOID?', `${v.status} ${/void|ملغ/i.test(v.text)}`); }
const withCn = q1(`select original_invoice_id id from credit_notes where docstatus=1 order by id desc limit 1`);
if (withCn) { const v = await pdfText(a, `/sales/${withCn.id}/pdf?language=en`); log('invoice PDF of sale with credit note mentions CN / net due?', `${/credit/i.test(v.text)} sample=${v.text.replace(/\s+/g, ' ').slice(-300)}`); }

for (const [sd, ed] of [[today, today], [today, tomorrow]]) {
  const s = await pdfText(a, `/sales/report/pdf?language=en&startDate=${sd}&endDate=${ed}`);
  const nums = (s.text.match(/SAL-\d{8}-\d{4}/g) || []).length;
  log(`sales report PDF ${sd}..${ed}`, `${s.status} rows=${nums} (non-voided today=${raw.n}, incl voided=${q1("select count(*) n from sales where sale_number like 'SAL-2%'").n})`);
}
for (const [sd, ed] of [[today, today], [today, tomorrow]]) {
  const v = await pdfText(a, `/reports/vat/pdf?language=en&startDate=${sd}&endDate=${ed}`);
  log(`VAT PDF ${sd}..${ed}`, `${v.status} sample=${v.text.replace(/\s+/g, ' ').slice(0, 300)}`);
}
const rec = await a.get(`/sales/${taxed.id}/receipt`);
log('receipt JSON', { storeName: rec.data?.storeName, total: rec.data?.sale?.totalAmount, tax: rec.data?.sale?.taxAmount, payments: rec.data?.payments });
log('settings currency', q(`select key,value from system_settings where key like 'currency%'`));
const stmt = await pdfText(a, `/customers/2/statement/pdf?language=en&startDate=2026-01-01&endDate=${today}`);
log('customer 2 statement PDF sample', `${stmt.status} ${stmt.text.replace(/\s+/g, ' ').slice(0, 500)}`);
save(`E:/DEV/Chicken FMS/.qa-audit/tests/T3/reports.out.txt`);
