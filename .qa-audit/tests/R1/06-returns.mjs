// R1-06: sales-return feature (POST /sales/:id/return) deep test
import { setup, glx, dl, jeCheck, L, errc, log, saveLog, must, q, q1, newItem, purchase, sale, showItem, newCust } from './lib2.mjs';
import { openDb, runChecks } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/invariants.mjs';
const { c, db, info } = await setup();
const cash = q1(db, "select id from accounts where code='1111'").id, cap = q1(db, "select id from accounts where code='3100'").id;
{ const r = must(await c.post('/accounting/journal-entries', { description: 'R1 fund', entryDate: new Date().toISOString(), lines: [{ accountId: cash, debit: 5000000, credit: 0 }, { accountId: cap, debit: 0, credit: 5000000 }] }), 'fund'); must(await c.post(`/accounting/journal-entries/${r.id}/post`), 'post'); }
const failIds = (label) => { const rs = runChecks(openDb(info.db), { excludeSeed: true }); const f = rs.filter((x) => x.status === 'FAIL').map((x) => `${x.id}:${JSON.stringify(x.diff ?? x.actual)}`); log(`   [invariants ${label}] FAIL: ${f.join(' ; ') || 'none'}`); };
failIds('baseline');

const RET = (id, lines, extra = {}) => c.post(`/sales/${id}/return`, { lines, refundMethod: 'cash', reason: 'r1', ...extra });
const saleRow = (id) => q1(db, 'select total_amount t, amount_paid p, payment_status s, is_voided v, total_cost tc, discount_amount d, tax_amount tx, total_tax_amount tta, net_total nt from sales where id=?', id);
async function mk(tag, { kgStock = 10, price = 5000, cost = 2000 } = {}) {
  const it = await newItem(c, { name: 'R1 ret ' + tag, sale: price, purchase: cost });
  await purchase(c, [{ itemId: it.id, weightGrams: kgStock * 1000, pricePerKg: cost }]);
  return it;
}
const retJE = (id) => q(db, "select j.entry_number n, a.code, l.debit_amount d, l.credit_amount c from journal_entries j join journal_entry_lines l on l.journal_entry_id=j.id join accounts a on a.id=l.account_id where j.source_type='sale_return' and j.source_id=? order by j.id, l.line_number", id).map((x) => `${x.code} ${x.d ? 'D' + x.d : 'C' + x.c}`);

log('=== R1 resellable partial return, cash refund: sale 4kg@50 (cost 20/kg), return 1kg');
{
  const it = await mk('A'); const s = await sale(c, [L(it.id, 4000, 5000)]); const id = s.data.id;
  const G0 = glx(db);
  const r = await RET(id, [{ itemId: it.id, quantityGrams: 1000, condition: 'resellable' }]);
  log('return 1kg', errc(r), JSON.stringify(r.data)); log('   JE', JSON.stringify(retJE(id)), 'GL', JSON.stringify(dl(G0, glx(db))));
  log('   sale row after', JSON.stringify(saleRow(id)), '(unchanged totals; no returned marker)');
  showItem(db, it.id, 'after return (expect inv 7kg)');
  log('   GET /sales/:id shows returns?', JSON.stringify(Object.keys((await c.get(`/sales/${id}`)).data)).slice(0, 300));
  const r2 = await RET(id, [{ itemId: it.id, quantityGrams: 1000, condition: 'resellable' }]); log('return another 1kg', errc(r2));
  const r3 = await RET(id, [{ itemId: it.id, quantityGrams: 2000, condition: 'resellable' }]); log('return 2kg (total 4 > sold? exactly 4)', errc(r3));
  const r4 = await RET(id, [{ itemId: it.id, quantityGrams: 1, condition: 'resellable' }]); log('return 1g more (over-return)', errc(r4));
  showItem(db, it.id, 'after all returns (expect inv 10kg)');
  log('   total refunded cash', q1(db, "select coalesce(sum(l.credit_amount),0) s from journal_entries j join journal_entry_lines l on l.journal_entry_id=j.id join accounts a on a.id=l.account_id where j.source_type='sale_return' and j.source_id=? and a.code='1111'", id).s, '(sale total 20000)');
  log('   void after full return', errc(await c.post(`/sales/${id}/void`, { reason: 'r1' })));
  showItem(db, it.id, 'after void-after-return (expect still 10kg; BUG if 14kg)'); log('   GL net sale+returns+void', JSON.stringify(dl(G0, glx(db))));
}
failIds('after R1');

log('=== R2 damaged return');
{
  const it = await mk('B'); const s = await sale(c, [L(it.id, 4000, 5000)]); const id = s.data.id; const G0 = glx(db);
  const r = await RET(id, [{ itemId: it.id, quantityGrams: 1000, condition: 'damaged' }]);
  log('damaged 1kg', errc(r), 'JE', JSON.stringify(retJE(id)), 'GL', JSON.stringify(dl(G0, glx(db))));
  showItem(db, it.id, 'after damaged return (inventory unchanged 6kg)');
  log('   SLE rows for return', q1(db, "select count(*) n from stock_ledger_entries where voucher_type='sale_return' and voucher_id=?", id).n, ' movements', JSON.stringify(q(db, "select movement_type m, quantity_grams g from stock_movements where reference_type='sale_return' and reference_id=?", id)));
  log('   damaged then wastage report?', JSON.stringify(q(db, 'select count(*) n from wastage_records where item_id=?', it.id)));
}
failIds('after R2');

log('=== R3 void-then-return, return-then-void');
{
  const it = await mk('C'); const s = await sale(c, [L(it.id, 4000, 5000)]); const id = s.data.id;
  await c.post(`/sales/${id}/void`, { reason: 'r1' });
  log('return after void', errc(await RET(id, [{ itemId: it.id, quantityGrams: 1000, condition: 'resellable' }])));
  const s2 = await sale(c, [L(it.id, 4000, 5000)]); const id2 = s2.data.id; const G0 = glx(db);
  await RET(id2, [{ itemId: it.id, quantityGrams: 4000, condition: 'resellable' }]);
  const G1 = glx(db);
  log('full return then void', errc(await c.post(`/sales/${id2}/void`, { reason: 'r1' })), 'void GL', JSON.stringify(dl(G1, glx(db))), 'NET since sale', JSON.stringify(dl(G0, glx(db))), '(net since pre-return: cash/rev/cogs should net 0 after both)');
  showItem(db, it.id, 'after');
}
failIds('after R3');

log('=== R4 credit sale unpaid, return cash vs credit');
{
  const it = await mk('D'); const cu = await newCust(c, 'ret4');
  const s = await c.post('/sales', { saleType: 'credit', customerId: cu, lines: [L(it.id, 4000, 5000)] }); const id = s.data.id; const G0 = glx(db);
  const r = await RET(id, [{ itemId: it.id, quantityGrams: 1000, condition: 'resellable' }], { refundMethod: 'cash' });
  log('credit sale 20000 UNPAID, return 1kg with CASH refund', errc(r), 'GL', JSON.stringify(dl(G0, glx(db))), '=> cash paid out for goods never paid for');
  log('   customer balance', q1(db, 'select current_balance b from customers where id=?', cu).b, 'debt', JSON.stringify(q(db, "select status,total_amount t,amount_paid p from debts where source_type='sale' and source_id=?", id)));
  const G1 = glx(db);
  const r2 = await RET(id, [{ itemId: it.id, quantityGrams: 1000, condition: 'resellable' }], { refundMethod: 'credit' });
  log('return 1kg credit refund', errc(r2), 'GL', JSON.stringify(dl(G1, glx(db))));
  log('   customer balance', q1(db, 'select current_balance b from customers where id=?', cu).b, 'debt', JSON.stringify(q(db, "select status,total_amount t,amount_paid p from debts where source_type='sale' and source_id=?", id)), 'sale row', JSON.stringify(saleRow(id)));
  const ar = q1(db, "select coalesce(sum(l.debit_amount-l.credit_amount),0) s from journal_entry_lines l join accounts a on a.id=l.account_id join journal_entries e on e.id=l.journal_entry_id where a.code='1120' and e.is_posted=1 and (e.source_type in ('sale','sale_return','sale_void') and e.source_id=?)", id).s;
  log('   GL AR for this sale', ar, 'vs customer balance + ... (cash refund left AR 20000 although cash was refunded)');
  // payments afterwards
  const p = await c.post('/payments/sale', { saleId: id, amount: 20000, paymentMethod: 'cash' });
  log('customer then pays full 20000 on the (partly returned) invoice', errc(p), '=> overcollection vs 10000 goods kept');
  log('credit refund with no customer (walk-in cash sale)'); const s3 = await sale(c, [L(it.id, 1000, 5000)]); const G2 = glx(db);
  log('   ', errc(await RET(s3.data.id, [{ itemId: it.id, quantityGrams: 1000, condition: 'resellable' }], { refundMethod: 'credit' })), 'GL', JSON.stringify(dl(G2, glx(db))));
}
failIds('after R4');

log('=== R5 partially paid credit sale; return credit > remaining due');
{
  const it = await mk('E'); const cu = await newCust(c, 'ret5');
  const s = await c.post('/sales', { saleType: 'cash', customerId: cu, lines: [L(it.id, 4000, 5000)], payments: [{ amount: 18000, paymentMethod: 'cash' }] }); const id = s.data.id;
  log('sale 20000 paid 18000 due 2000', errc(s));
  const G0 = glx(db);
  const r = await RET(id, [{ itemId: it.id, quantityGrams: 4000, condition: 'resellable' }], { refundMethod: 'credit' });
  log('return all 4kg credit', errc(r), 'JE', JSON.stringify(retJE(id)), 'GL', JSON.stringify(dl(G0, glx(db))));
  log('   customer balance', q1(db, 'select current_balance b from customers where id=?', cu).b, '(customer paid 18000 got goods back: should be owed 18000 => balance -18000 ok?) debt', JSON.stringify(q(db, "select status,total_amount t,amount_paid p from debts where source_type='sale' and source_id=?", id)), 'sale', JSON.stringify(saleRow(id)));
  log('   void after (admin)', errc(await c.post(`/sales/${id}/void`, { reason: 'r1' })), 'cust bal', q1(db, 'select current_balance b from customers where id=?', cu).b);
}
failIds('after R5');

log('=== R6 taxed sale (15%) return, default mode');
{
  const it = await mk('F'); const s = await c.post('/sales', { saleType: 'cash', taxTemplateId: 1, lines: [L(it.id, 4000, 5000)], payments: [{ amount: 23000, paymentMethod: 'cash' }] }); const id = s.data.id;
  log('taxed sale', errc(s), JSON.stringify(saleRow(id)));
  const G0 = glx(db);
  const r = await RET(id, [{ itemId: it.id, quantityGrams: 1000, condition: 'resellable' }]);
  log('return 1kg', errc(r), JSON.stringify(r.data), 'JE', JSON.stringify(retJE(id)), 'GL', JSON.stringify(dl(G0, glx(db))), '(expect 4110 +5000, 2120 +750, 1111 -5750)');
  const r2 = await RET(id, [{ itemId: it.id, quantityGrams: 3000, condition: 'resellable' }]);
  log('return remaining 3kg', errc(r2), JSON.stringify(r2.data), 'NET GL since sale-return', JSON.stringify(dl(G0, glx(db))), '(total refunded should be 23000; 2120 net back to 0)');
}
failIds('after R6');

log('=== R7 header-discount sale return');
{
  const it = await mk('G'); const s = await c.post('/sales', { saleType: 'cash', discountAmount: 2000, lines: [L(it.id, 4000, 5000)], payments: [{ amount: 18000, paymentMethod: 'cash' }] }); const id = s.data.id;
  const G0 = glx(db);
  const r = await RET(id, [{ itemId: it.id, quantityGrams: 4000, condition: 'resellable' }]);
  log('sale 20000 - 2000 discount = 18000 paid; full return', errc(r), JSON.stringify(r.data), 'GL since sale', JSON.stringify(dl(G0, glx(db))));
  const net = dl(G0, glx(db));
  log('   cash given back vs received: refund 20000 vs paid 18000 => shop loses 2000; 4900 residual', net['4900']);
}
failIds('after R7');

log('=== R8 line-discount + rounding: 3333g @ 29.99, return 1111g x3');
{
  const it = await mk('H', { kgStock: 20, price: 2999 }); const s = await sale(c, [L(it.id, 3333, 2999)]); const id = s.data.id;
  const total = saleRow(id).t; const cost = saleRow(id).tc; const G0 = glx(db);
  for (let i = 0; i < 3; i++) await RET(id, [{ itemId: it.id, quantityGrams: 1111, condition: 'resellable' }]);
  const g = dl(G0, glx(db));
  log('sale total', total, 'cost', cost, '; after 3 returns: GL', JSON.stringify(g), '(cash refunded', -(g['1111'] ?? 0), 'vs sale total', total, ')');
  showItem(db, it.id, 'after');
  // 7 returns of 100g from 700g? many small
  const s2 = await sale(c, [L(it.id, 777, 2999)]); const id2 = s2.data.id; const t2 = saleRow(id2).t; const G1 = glx(db);
  for (let i = 0; i < 7; i++) await RET(id2, [{ itemId: it.id, quantityGrams: i === 6 ? 777 - 6 * 111 : 111, condition: 'resellable' }]);
  const g2 = dl(G1, glx(db)); log('777g sale total', t2, '7 partial returns refunded cash', -(g2['1111'] ?? 0), 'rev reversal', g2['4110']);
}
failIds('after R8');

log('=== R9 two lines of same item in the original sale');
{
  const it = await mk('I', { kgStock: 20 });
  const s = await c.post('/sales', { saleType: 'cash', lines: [L(it.id, 2000, 5000), L(it.id, 2000, 6000)], payments: [{ amount: 22000, paymentMethod: 'cash' }] }); const id = s.data.id;
  log('sale 2kg@50 + 2kg@60', errc(s));
  const G0 = glx(db);
  const r = await RET(id, [{ itemId: it.id, quantityGrams: 4000, condition: 'resellable' }]);
  log('return 4kg (all)', errc(r), JSON.stringify(r.data));
  const r2 = await RET(id, [{ itemId: it.id, quantityGrams: 2000, condition: 'resellable' }]);
  log('return 2kg', errc(r2), JSON.stringify(r2.data), 'GL', JSON.stringify(dl(G0, glx(db))), '(second line @60 => refund should be up to 12000 for the 2kg@60 line)');
}
log('=== R10 same item twice in one return request + validation');
{
  const it = await mk('J'); const s = await sale(c, [L(it.id, 4000, 5000)]); const id = s.data.id;
  log('2 lines same item 1kg+1kg in one request', errc(await RET(id, [{ itemId: it.id, quantityGrams: 1000, condition: 'resellable' }, { itemId: it.id, quantityGrams: 1000, condition: 'resellable' }])));
  showItem(db, it.id, 'after');
  log('lots LOT-RET', JSON.stringify(q(db, "select lot_number, total_quantity_grams g from inventory_lots where item_id=? and lot_number like 'LOT-RET%'", it.id)));
  log('negative qty', errc(await RET(id, [{ itemId: it.id, quantityGrams: -1000, condition: 'resellable' }])));
  log('fraction qty', errc(await RET(id, [{ itemId: it.id, quantityGrams: 100.5, condition: 'resellable' }])));
  log('bad condition', errc(await RET(id, [{ itemId: it.id, quantityGrams: 100, condition: 'x' }])));
  log('empty lines', errc(await RET(id, [])));
  log('no refundMethod', errc(await c.post(`/sales/${id}/return`, { lines: [{ itemId: it.id, quantityGrams: 100, condition: 'resellable' }] })));
  log('item not in sale', errc(await RET(id, [{ itemId: 1, quantityGrams: 100, condition: 'resellable' }])));
  log('unknown sale', errc(await RET(999999, [{ itemId: it.id, quantityGrams: 100, condition: 'resellable' }])));
  const accRole = (await c.get('/users/roles')).data.find((x) => x.name === 'accountant');
  must(await c.post('/users', { username: 'r1acc', password: 'Password@123', fullName: 'R1 acc', roleId: accRole.id }), 'acc');
  const { connect } = await import('file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs');
  const acc = await connect(info.baseUrl, 'r1acc', 'Password@123');
  log('accountant may return (roles admin, accountant)', errc(await acc.post(`/sales/${id}/return`, { lines: [{ itemId: it.id, quantityGrams: 100, condition: 'resellable' }], refundMethod: 'cash' })));
  log('accountant refund w/o limit; cashier role absent here');
  log('audit rows for return', q1(db, "select count(*) n from audit_logs where action='return' or (action like '%return%')").n, '; all audit actions', JSON.stringify(q(db, 'select action, count(*) n from audit_logs group by action')));
}
failIds('after R10');

log('=== R11 concurrent returns of the same full quantity');
{
  const it = await mk('K'); const s = await sale(c, [L(it.id, 4000, 5000)]); const id = s.data.id; const G0 = glx(db);
  const rs = await Promise.all(Array.from({ length: 4 }, () => RET(id, [{ itemId: it.id, quantityGrams: 4000, condition: 'resellable' }])));
  log('4 parallel full returns', rs.map(errc).join(' | '));
  showItem(db, it.id, 'after (expect inv 10kg; BUG if >10kg)'); log('   GL', JSON.stringify(dl(G0, glx(db))));
  const it2 = await mk('K2'); const s2 = await sale(c, [L(it2.id, 4000, 5000)]); const id2 = s2.data.id;
  const rs2 = await Promise.all([RET(id2, [{ itemId: it2.id, quantityGrams: 3000, condition: 'resellable' }]), RET(id2, [{ itemId: it2.id, quantityGrams: 3000, condition: 'damaged' }]), c.post(`/sales/${id2}/void`, { reason: 'x' })]);
  log('return 3 + damaged 3 + void in parallel', rs2.map(errc).join(' | ')); showItem(db, it2.id, 'after');
}
failIds('after R11');

log('=== R12 credit note then return; return after payment cancel');
{
  const it = await mk('L'); const cu = await newCust(c, 'ret12');
  const s = await c.post('/sales', { saleType: 'credit', customerId: cu, lines: [L(it.id, 4000, 5000)] }); const id = s.data.id;
  const cn = must(await c.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: id, amount: 20000, reason: 'r1' }), 'cn'); await c.post(`/credit-notes/${cn.id}/submit`, {});
  const G0 = glx(db);
  log('after full-value CN, return all 4kg credit', errc(await RET(id, [{ itemId: it.id, quantityGrams: 4000, condition: 'resellable' }], { refundMethod: 'credit' })), 'GL', JSON.stringify(dl(G0, glx(db))), 'customer bal', q1(db, 'select current_balance b from customers where id=?', cu).b, '(refund twice: CN 20000 + return 20000)');
}
failIds('after R12');

log('=== R13 period lock / old sale date');
log('(not executed: needs period management API; none exists, see QA-032)');

log('=== R14 returns reports: sales report, profit-loss, stock-vs-gl, dashboard reflect returns?');
{
  const today = new Date().toISOString().slice(0, 10);
  const pl = (await c.get(`/reports/profit-loss?startDate=${today}&endDate=${today}`)).data;
  const is = await c.get(`/accounting/reports/income-statement?startDate=${today}&endDate=${today}`);
  const rev = q1(db, "select coalesce(sum(l.credit_amount-l.debit_amount),0) s from journal_entry_lines l join accounts a on a.id=l.account_id join journal_entries e on e.id=l.journal_entry_id where a.code='4110' and e.is_posted=1").s;
  const salesSum = q1(db, 'select coalesce(sum(total_amount),0) s from sales where is_voided=0').s;
  const cogsGL = q1(db, "select coalesce(sum(l.debit_amount-l.credit_amount),0) s from journal_entry_lines l join accounts a on a.id=l.account_id join journal_entries e on e.id=l.journal_entry_id where a.code='5100' and e.is_posted=1").s;
  const cogsSales = q1(db, 'select coalesce(sum(total_cost),0) s from sales where is_voided=0').s;
  log('profit-loss page keys', JSON.stringify(Object.keys(pl)), 'revenue', pl.revenue ?? pl.totalRevenue, 'cogs', pl.cogs ?? pl.costOfGoodsSold, 'netProfit', pl.netProfit);
  log('GL 4110 revenue', rev, 'sum(sales.total_amount non-void)', salesSum, 'GL COGS', cogsGL, 'sum(sales.total_cost)', cogsSales, '(returns reduce GL but not sales rows)');
}
log('JE unbalanced', JSON.stringify(jeCheck(db)));
failIds('final');
saveLog('06-returns');
