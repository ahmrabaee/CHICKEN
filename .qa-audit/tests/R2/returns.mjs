// R2: review of NEW sales-return feature (POST /sales/:id/return): discount, tax, credit sale, void, over-return, accountant
import fs from 'node:fs';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { DatabaseSync } from 'node:sqlite';
const m = JSON.parse(fs.readFileSync('E:/DEV/Chicken FMS/.qa-audit/envs/r2/meta.json', 'utf8'));
const a = await connect(m.baseUrl, 'admin', 'admin123');
const q = (sql) => { const d = new DatabaseSync(m.db, { readOnly: true }); try { return d.prepare(sql).all(); } finally { d.close(); } };
const gl = () => Object.fromEntries(q(`select a.code, sum(l.debit_amount)-sum(l.credit_amount) b from journal_entry_lines l join accounts a on a.id=l.account_id join journal_entries e on e.id=l.journal_entry_id where e.is_posted=1 group by 1`).map((r) => [r.code, r.b]));
const delta = (b, n) => { const o = {}; for (const k of new Set([...Object.keys(b), ...Object.keys(n)])) { const d = (n[k] || 0) - (b[k] || 0); if (d) o[k] = d; } return JSON.stringify(o); };
const custBal = (id) => q(`select current_balance b from customers where id=${id}`)[0]?.b;
const inv = (id) => JSON.stringify(q(`select sum(current_quantity_grams) g, sum(total_value) v from inventory where item_id=${id}`)[0]);
const short = (r) => `${r.status} ${r.ok ? 'ok' : (r.body?.error?.code + ' ' + (r.body?.error?.message || '').slice(0, 80))}`;
async function scenario(name, saleBody, retBody, pre) {
  console.log('\n== ' + name);
  const s = await a.post('/sales', saleBody);
  console.log(' sale', short(s), s.data && `gross=${s.data.grossTotalAmount} disc=${s.data.discountAmount} tax=${s.data.taxAmount} total=${s.data.totalAmount} paid=${s.data.amountPaid}`);
  if (!s.ok) return null;
  if (pre) await pre(s.data);
  const g0 = gl(), c0 = saleBody.customerId ? custBal(saleBody.customerId) : null, i0 = inv(saleBody.lines[0].itemId);
  const r = await a.post(`/sales/${s.data.id}/return`, retBody(s.data));
  console.log(' return', short(r), JSON.stringify(r.data ?? '').slice(0, 220));
  console.log('  GL delta (minor units):', delta(g0, gl()), '| cust bal', c0, '->', saleBody.customerId ? custBal(saleBody.customerId) : '-', '| inventory', i0, '->', inv(saleBody.lines[0].itemId));
  return s.data;
}
const line = (item, g, p) => ({ itemId: item, weightGrams: g, pricePerKg: p });
const L = (item, g, c = 'resellable') => ({ itemId: item, quantityGrams: g, condition: c });
// A: header discount 600 on 6000, full return cash
const A = await scenario('A: 2kg@30.00=60.00, discount 6.00, paid 54.00 cash; return all 2kg resellable, refund cash', { saleType: 'cash', discountAmount: 600, lines: [line(6, 2000, 3000)], payments: [{ paymentMethod: 'cash', amount: 5400 }] }, () => ({ lines: [L(6, 2000)], refundMethod: 'cash', reason: 'r2' }));
// B: taxed sale (template 1) return all
const tpl = (await a.get('/tax/templates')).data.find((t) => t.type === 'sales')?.id;
await scenario('B: 1kg@100.00 + 15% VAT (paid 115.00); return all, refund cash', { saleType: 'cash', taxTemplateId: tpl, lines: [line(6, 1000, 10000)], payments: [{ paymentMethod: 'cash', amount: 11500 }] }, () => ({ lines: [L(6, 1000)], refundMethod: 'cash', reason: 'r2' }));
// C: credit sale unpaid, return half, refund cash (customer never paid)
await scenario('C: credit sale 2kg@30.00 unpaid; return 1kg refund CASH', { saleType: 'credit', customerId: 1, lines: [line(6, 2000, 3000)] }, () => ({ lines: [L(6, 1000)], refundMethod: 'cash', reason: 'r2' }));
// D: credit sale unpaid, return half refund credit
await scenario('D: credit sale 2kg@30.00 unpaid; return 1kg refund CREDIT', { saleType: 'credit', customerId: 1, lines: [line(6, 2000, 3000)] }, () => ({ lines: [L(6, 1000)], refundMethod: 'credit', reason: 'r2' }));
// E: over-return and repeat
const E = await scenario('E: 1kg sale; return 1kg ok', { saleType: 'cash', lines: [line(6, 1000, 3000)], payments: [{ paymentMethod: 'cash', amount: 3000 }] }, () => ({ lines: [L(6, 1000)], refundMethod: 'cash' }));
if (E) { for (const [l, b] of [['again 1kg (over-return)', { lines: [L(6, 1000)], refundMethod: 'cash' }], ['1 g after full return', { lines: [L(6, 1)], refundMethod: 'cash' }], ['negative qty', { lines: [L(6, -500)], refundMethod: 'cash' }], ['0 qty', { lines: [L(6, 0)], refundMethod: 'cash' }], ['other item not in sale', { lines: [L(5, 100)], refundMethod: 'cash' }], ['damaged', { lines: [L(6, 100, 'damaged')], refundMethod: 'cash' }]]) console.log(' E-extra', l, short(await a.post(`/sales/${E.id}/return`, b))); }
// F: void then return
const F = await a.post('/sales', { saleType: 'cash', lines: [line(6, 1000, 3000)], payments: [{ paymentMethod: 'cash', amount: 3000 }] });
await a.post(`/sales/${F.data.id}/void`, { reason: 'r2' });
console.log('\n== F: return on a VOIDED sale', short(await a.post(`/sales/${F.data.id}/return`, { lines: [L(6, 1000)], refundMethod: 'cash' })));
// G: duplicate item lines in the same return request exceeding sold
const G = await a.post('/sales', { saleType: 'cash', lines: [line(6, 1000, 3000)], payments: [{ paymentMethod: 'cash', amount: 3000 }] });
console.log('== G: same item twice in one request 700g + 700g on 1000g sold', short(await a.post(`/sales/${G.data.id}/return`, { lines: [L(6, 700), L(6, 700)], refundMethod: 'cash' })));
// H: concurrent returns
const H = await a.post('/sales', { saleType: 'cash', lines: [line(6, 1000, 3000)], payments: [{ paymentMethod: 'cash', amount: 3000 }] });
const rs = await Promise.all(Array.from({ length: 5 }, () => a.post(`/sales/${H.data.id}/return`, { lines: [L(6, 1000)], refundMethod: 'cash' })));
console.log('== H: 5 concurrent full returns of the same 1kg:', JSON.stringify(rs.map((r) => r.status)));
// I: accountant return (allowed) and audit
console.log('\ninvariants (unbalanced JEs):', JSON.stringify(q('select count(*) n from (select journal_entry_id from journal_entry_lines group by 1 having sum(debit_amount)<>sum(credit_amount))')[0]));
console.log('sale_return rows:', JSON.stringify(q("select name from sqlite_master where name like '%return%'")));
