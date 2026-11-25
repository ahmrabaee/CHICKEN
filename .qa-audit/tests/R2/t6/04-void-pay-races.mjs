// T6-04: races on existing documents.
// a) same sale voided 5x concurrently  b) 5 concurrent /payments/sale exceeding balance
// c) 5 concurrent /sales/:id/payments exceeding balance  d) double submit / retry of POST /sales (idempotency)
import { connect, meta, q, one, tee, outFor, sleep } from './lib.mjs';
import { openDb, snapshot, diff, formatDiff, runChecks } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/invariants.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const c = await connect(m.baseUrl, 'admin', 'admin123');
const c2 = await connect(m.baseUrl, 'admin', 'admin123');
const snap = () => snapshot(openDb(m.db));
const tally = (res) => { const t = {}; for (const r of res) { const k = r.status + (r.ok ? '' : ' ' + (r.body?.error?.code ?? JSON.stringify(r.body).slice(0, 80))); t[k] = (t[k] ?? 0) + 1; } return t; };
const item = 4; const price = one(m.db, 'select default_sale_price p from items where id=?', item).p;
const creditSale = async (cust, g = 2000) => (await c.post('/sales', { saleType: 'credit', customerId: cust, lines: [{ itemId: item, weightGrams: g, pricePerKg: price }] }));

// a) double void
{
  const s = await creditSale(1); const id = s.data.id; const total = s.data.totalAmount;
  log(`a) credit sale ${s.data.saleNumber} id=${id} total=${total}`);
  const inv0 = one(m.db, 'select current_quantity_grams q from inventory where item_id=?', item).q;
  const b = snap();
  const res = await Promise.all(Array.from({ length: 5 }, (_, i) => (i % 2 ? c2 : c).post(`/sales/${id}/void`, { reason: 'T6 double void ' + i })));
  log('a) void tally', tally(res));
  const inv1 = one(m.db, 'select current_quantity_grams q from inventory where item_id=?', item).q;
  log(`a) inventory restored ${inv1 - inv0} g (expected 2000)`);
  log('a) JEs for sale', q(m.db, `select id,entry_number,source_type,is_reversed from journal_entries where source_id=? and source_type like '%sale%' or (source_type='reversal' and description like ?)`, id, `%${s.data.saleNumber}%`));
  log('a) delta:\n' + formatDiff(diff(b, snap())));
}
await sleep(300);
// b) overpayment race via /payments/sale
for (const [label, path, mk] of [
  ['b) /payments/sale', '/payments/sale', (id) => ({ saleId: id, amount: 4000, paymentMethod: 'cash' })],
  ['c) /sales/:id/payments', null, () => ({ amount: 4000, paymentMethod: 'cash' })],
]) {
  const s = await creditSale(2); const id = s.data.id; const total = s.data.totalAmount;
  const b = snap();
  const res = await Promise.all(Array.from({ length: 5 }, (_, i) => (i % 2 ? c2 : c).post(path ?? `/sales/${id}/payments`, mk(id))));
  const okN = res.filter((r) => r.ok).length;
  log(`${label}: sale ${s.data.saleNumber} total=${total}; 5 x 4000 → tally ${JSON.stringify(tally(res))}; accepted ${okN * 4000} vs total ${total} → OVERPAID ${Math.max(0, okN * 4000 - total)}`);
  log('   sale row', one(m.db, 'select amount_paid,payment_status from sales where id=?', id), 'debt', one(m.db, `select total_amount,amount_paid,status from debts where source_type='sale' and source_id=?`, id),
    'customer bal', one(m.db, 'select current_balance from customers where id=2'));
  log('   delta:\n' + formatDiff(diff(b, snap())));
  await sleep(300);
}
// d) idempotency: identical POST /sales twice in parallel, then a sequential "retry"
{
  const body = { saleType: 'cash', notes: 'T6-idem-' + Date.now(), lines: [{ itemId: item, weightGrams: 1000, pricePerKg: price }], payments: [{ paymentMethod: 'cash', amount: price }] };
  const hdr = { headers: { 'Idempotency-Key': 'T6-key-1', 'X-Request-Id': 'T6-key-1' } };
  const par = await Promise.all([c.post('/sales', body, hdr), c.post('/sales', body, hdr)]);
  const seq = await c.post('/sales', body, hdr);
  log('d) parallel double submit:', par.map((r) => r.status + ' ' + r.data?.saleNumber), '| sequential retry:', seq.status, seq.data?.saleNumber);
  log('d) sales with that note:', one(m.db, 'select count(*) n, sum(total_amount) t from sales where notes=?', body.notes));
}
log('invariants:', runChecks ? JSON.stringify(runChecks(openDb(m.db), { excludeSeed: true }).filter((r) => r.status === 'FAIL').map((r) => r.id + ': ' + (r.summary ?? r.message ?? ''))) : 'n/a');
log.save();
