// T6-03: lost updates in stock adjustments (qty/value read before tx, written as absolute values).
// A) 5 parallel "decrease 1000 g" adjustments on one item. B) 5 parallel sales of 500 g + 5 parallel decrease-500 g adjustments interleaved.
import { connect, meta, q, one, tee, outFor, sleep } from './lib.mjs';
import { openDb, snapshot, diff, formatDiff } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/invariants.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const c = await connect(m.baseUrl, 'admin', 'admin123');
const c2 = await connect(m.baseUrl, 'admin', 'admin123');
const snap = () => snapshot(openDb(m.db));
const invRow = (id) => one(m.db, 'select current_quantity_grams q,total_value v from inventory where item_id=?', id);
const lots = (id) => one(m.db, 'select coalesce(sum(remaining_quantity_grams),0) g from inventory_lots where item_id=?', id).g;
const jeAdj = () => one(m.db, `select count(*) n, coalesce(sum(l.credit_amount),0) cr from journal_entries e join journal_entry_lines l on l.journal_entry_id=e.id
  join accounts a on a.id=l.account_id where e.source_type in ('adjustment','stock_adjustment','inventory_adjustment') and a.code like '113%'`);

// ---- A
const A = 3; // item 3 (breast, 50 kg seeded)
let s0 = invRow(A); let j0 = jeAdj();
log('A) item', A, 'before', s0, 'lots', lots(A), 'adjJE', j0);
const resA = await Promise.all(Array.from({ length: 5 }, (_, i) => (i % 2 ? c2 : c).post('/inventory/adjustments', { itemId: A, adjustmentType: 'decrease', quantityGrams: 1000, reason: `T6 race ${i}` })));
log('A) statuses', resA.map((r) => r.status + (r.ok ? '' : ' ' + r.body?.error?.code)));
log('A) responses previous->new', resA.filter((r) => r.ok).map((r) => `${r.data.previousQuantityGrams}->${r.data.newQuantityGrams}`));
let s1 = invRow(A); let j1 = jeAdj();
log('A) after', s1, 'adjJE', j1, `=> qty removed ${s0.q - s1.q} g (expected ${resA.filter((r) => r.ok).length * 1000}); GL inventory credited ${j1.cr - j0.cr}; inventory.total_value dropped ${s0.v - s1.v}`);
log('A) stock movements sum (adjustment_out):', one(m.db, `select sum(quantity_grams) s,count(*) n from stock_movements where item_id=? and movement_type='adjustment_out'`, A));

// ---- B
await sleep(300);
const B = 2;
const price = one(m.db, 'select default_sale_price p from items where id=?', B).p;
const b0 = snap(); const sB0 = invRow(B); const lB0 = lots(B);
log('B) item', B, 'before', sB0, 'lots', lB0);
const jobs = [];
for (let i = 0; i < 5; i++) {
  jobs.push(c.post('/sales', { saleType: 'cash', lines: [{ itemId: B, weightGrams: 500, pricePerKg: price }], payments: [{ paymentMethod: 'cash', amount: Math.round(0.5 * price) }] }).then((r) => ['sale', r]));
  jobs.push(c2.post('/inventory/adjustments', { itemId: B, adjustmentType: 'decrease', quantityGrams: 500, reason: `T6 mix ${i}` }).then((r) => ['adj', r]));
}
const resB = await Promise.all(jobs);
const okS = resB.filter(([k, r]) => k === 'sale' && r.ok).length, okA = resB.filter(([k, r]) => k === 'adj' && r.ok).length;
log('B) statuses', resB.map(([k, r]) => k + ':' + r.status + (r.ok ? '' : ' ' + r.body?.error?.code)));
const sB1 = invRow(B); const lB1 = lots(B);
log(`B) after inventory ${JSON.stringify(sB1)} lots ${lB1}; ok sales=${okS} ok adj=${okA}; expected inventory qty = ${sB0.q - 500 * (okS + okA)}; actual ${sB1.q}; DRIFT ${sB1.q - (sB0.q - 500 * (okS + okA))} g`);
log('B) delta (T1 snapshot):\n' + formatDiff(diff(b0, snap())));
log.save();
