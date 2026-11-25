// R1-07: gl_engine_enabled + tax_engine_enabled ON (QA-028, H-2, H-3 engine numbering, H-5 in engine path), on a second instance r1b (3124)
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
process.removeAllListeners('warning');
const QA = 'E:/DEV/Chicken FMS/.qa-audit';
const out = execFileSync('node', [`${QA}/harness/instance.mjs`, 'reset', 'r1b', '3124', 'dev'], { encoding: 'utf8' });
const info = JSON.parse(out.match(/ready (\{.*\})/)[1]);
const c = await connect(info.baseUrl, 'admin', 'admin123');
const db = () => new DatabaseSync(info.db, { readOnly: true });
const q = (sql, ...p) => { const d = db(); try { return d.prepare(sql).all(...p); } finally { d.close(); } };
const q1 = (sql, ...p) => q(sql, ...p)[0];
const lines = []; const log = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); console.log(s); lines.push(s); };
const CODES = ['1111', '1112-001', '1120', '1125', '1131', '2110', '2120', '3100', '4110', '4900', '5100', '5300', '5400'];
const glx = () => { const rows = q(`select a.code, sum(l.debit_amount-l.credit_amount) b from journal_entry_lines l join journal_entries e on e.id=l.journal_entry_id join accounts a on a.id=l.account_id where e.is_posted=1 group by a.code`); const o = {}; for (const r of rows) o[r.code] = r.b; return CODES.reduce((m, k) => ({ ...m, [k]: o[k] ?? 0 }), {}); };
const dl = (a, b) => Object.fromEntries(CODES.map((k) => [k, b[k] - a[k]]).filter(([, v]) => v));
const errc = (r) => (r.ok ? 'OK' : `${r.status} ${r.body?.error?.code ?? r.body?.message ?? JSON.stringify(r.body).slice(0, 140)}`);
const must = (r, l) => { if (!r.ok) throw new Error(l + ' ' + JSON.stringify(r.body)); return r.data; };
const L = (itemId, weightGrams, pricePerKg) => ({ itemId, weightGrams, pricePerKg });

const cap = q1("select id from accounts where code='3100'").id;
for (const code of ['1111', '1112-001']) { const a = q1('select id from accounts where code=?', code).id; const j = must(await c.post('/accounting/journal-entries', { description: 'fund', entryDate: new Date().toISOString(), lines: [{ accountId: a, debit: 5000000, credit: 0 }, { accountId: cap, debit: 0, credit: 5000000 }] }), 'fund'); must(await c.post(`/accounting/journal-entries/${j.id}/post`), 'post'); }
const bank = q1('select id from bank_accounts limit 1')?.id ?? must(await c.post('/bank-accounts', { name: 'R1b bank', accountId: q1("select id from accounts where code='1112-001'").id, isDefault: true }), 'bank').id;
const it = must(await c.post('/items', { code: 'R1B-1', name: 'R1b item', categoryId: 3, defaultSalePrice: 5000, defaultPurchasePrice: 2000 }), 'item');
const P = (extra = {}) => c.post('/purchases', { supplierId: 1, lines: [L(it.id, 50000, 2000)], ...extra });
await P(); const pDel = await P(); await P();
if (!process.env.NODEL) log('legacy-mode: delete middle purchase (T1-018 trigger)', errc(await c.del(`/purchases/${pDel.data.id}`)));
log('set engines', (await c.put('/settings/gl_engine_enabled', { value: 'true' })).status, (await c.put('/settings/tax_engine_enabled', { value: 'true' })).status);
const step = async (label, fn) => { const g = glx(); const r = await fn(); log(label, errc(r), 'GL', JSON.stringify(dl(g, glx()))); return r; };
const S = (b) => c.post('/sales', b);
const s1 = await step('[ON] cash sale 10000', () => S({ saleType: 'cash', lines: [L(it.id, 2000, 5000)], payments: [{ amount: 10000, paymentMethod: 'cash' }] }));
const s2 = await step('[ON] taxed 15% 10000 -> 11500', () => S({ saleType: 'cash', taxTemplateId: 1, lines: [L(it.id, 2000, 5000)], payments: [{ amount: 11500, paymentMethod: 'cash' }] }));
log('   sale row', JSON.stringify(q1('select total_amount t, tax_amount tx, net_total nt, grand_total gt, total_profit p, total_cost tc from sales where id=?', s2.data?.id)));
const s3 = await step('[ON] taxed + header discount 1000 (K3-020; orig 400 UNBALANCED)', () => S({ saleType: 'cash', taxTemplateId: 1, discountAmount: 1000, lines: [L(it.id, 2000, 5000)], payments: [{ amount: 10350, paymentMethod: 'cash' }] }));
const s4 = await step('[ON] taxed + discount 20 (small: orig rounded away)', () => S({ saleType: 'cash', taxTemplateId: 1, discountAmount: 20, lines: [L(it.id, 2000, 5000)], payments: [{ amount: 11477, paymentMethod: 'cash' }] }));
if (!s4.ok) await step('   retry paying total 11477.? ask server', () => S({ saleType: 'credit', customerId: 1, taxTemplateId: 1, discountAmount: 20, lines: [L(it.id, 2000, 5000)] }));
const s5 = await step('[ON] discount only 500 (no tax)', () => S({ saleType: 'cash', discountAmount: 500, lines: [L(it.id, 2000, 5000)], payments: [{ amount: 9500, paymentMethod: 'cash' }] }));
const s6 = await step('[ON] mixed tender 5000 cash + 5000 bank', () => S({ saleType: 'cash', lines: [L(it.id, 2000, 5000)], payments: [{ amount: 5000, paymentMethod: 'cash' }, { amount: 5000, paymentMethod: 'bank_transfer', bankAccountId: bank }] }));
const s7 = await step('[ON] credit sale 10000 customer 1', () => S({ saleType: 'credit', customerId: 1, lines: [L(it.id, 2000, 5000)] }));
await step('   pay 4000 cash', () => c.post('/payments/sale', { saleId: s7.data.id, amount: 4000, paymentMethod: 'cash' }));
await step('   void (QA-014 in ON mode)', () => c.post(`/sales/${s7.data.id}/void`, { reason: 'r1b' }));
for (const [l, s] of [['taxed', s2], ['taxed+disc', s3], ['discount', s5], ['mixed', s6]]) if (s?.ok) await step(`[ON] void ${l}`, () => c.post(`/sales/${s.data.id}/void`, { reason: 'r1b' }));
await step('[ON] taxed purchase 10000+1500 credit (QA-019 in ON mode)', () => P({ lines: [L(it.id, 5000, 2000)], taxAmount: 1500 }));
await step('[ON] taxed purchase paid 11500 bank', () => P({ lines: [L(it.id, 5000, 2000)], taxAmount: 1500, amountPaid: 11500, paymentMethod: 'bank_transfer', bankAccountId: bank }));
await step('[ON] expense 1000 bank_transfer', () => c.post('/expenses', { categoryId: 2, description: 'rent', amount: 1000, paymentMethod: 'bank_transfer', bankAccountId: bank }));
const lot = q1('select id from inventory_lots where item_id=? and remaining_quantity_grams>1000 order by id limit 1', it.id).id;
await step('[ON] wastage 2kg', () => c.post('/wastage', { lotId: lot, quantityGrams: 2000, reason: 'r1b' }));
await step('[ON] adjustment decrease 1kg', () => c.post('/inventory/adjustments', { itemId: it.id, adjustmentType: 'decrease', quantityGrams: 1000, reason: 'r1b' }));
// returns in ON mode
const sr = await S({ saleType: 'cash', taxTemplateId: 1, discountAmount: 1000, lines: [L(it.id, 4000, 5000)], payments: [{ amount: 21850, paymentMethod: 'cash' }] });
log('[ON] sale for return: taxed 15% + discount 1000, 4kg@50', errc(sr), JSON.stringify(q1('select total_amount t, tax_amount tx, net_total nt, grand_total gt, total_tax_amount tta, discount_amount d from sales where id=?', sr.data?.id)));
if (sr.ok) {
  await step('[ON] return 1kg resellable (taxed+discount)', () => c.post(`/sales/${sr.data.id}/return`, { lines: [{ itemId: it.id, quantityGrams: 1000, condition: 'resellable' }], refundMethod: 'cash' }));
  await step('[ON] return remaining 3kg', () => c.post(`/sales/${sr.data.id}/return`, { lines: [{ itemId: it.id, quantityGrams: 3000, condition: 'resellable' }], refundMethod: 'cash' }));
  log('   total JE for sale+returns of this sale', JSON.stringify(q("select j.source_type, j.entry_number, sum(l.debit_amount) d, sum(l.credit_amount) c from journal_entries j join journal_entry_lines l on l.journal_entry_id=j.id where (j.source_type in ('sale','sale_return') and j.source_id=?) group by j.id", sr.data.id)));
}
log('JE numbering: duplicates', JSON.stringify(q('select entry_number, count(*) n from journal_entries group by entry_number having n>1')), 'unbalanced', JSON.stringify(q('select e.id from journal_entries e join journal_entry_lines l on l.journal_entry_id=e.id group by e.id having sum(l.debit_amount)<>sum(l.credit_amount)')));
log('numbering: last JE numbers', JSON.stringify(q('select entry_number from journal_entries order by id desc limit 3').map((r) => r.entry_number)));
writeFileSync(`${QA}/tests/R1/07-engines-on${process.env.NODEL ? "b" : ""}.out.txt`, lines.join('\n'));
