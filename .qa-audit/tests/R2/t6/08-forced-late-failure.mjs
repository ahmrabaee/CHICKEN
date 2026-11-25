// T6-08: force failures LATE in multi-step operations and look for half-written data.
// a) sale with auto-created walk-in customer + invalid taxTemplateId (fails after customer/sale rows would be written)
// b) purchase UPDATE that deletes derived data then fails on INSUFFICIENT_BALANCE (paid at creation, huge cash)
// c) cross-validate K3-012: expense update/delete vs posted JE
import { connect, meta, q, one, tee, outFor } from './lib.mjs';
import { openDb, snapshot, diff, formatDiff } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/invariants.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const c = await connect(m.baseUrl, 'admin', 'admin123');
const snap = () => snapshot(openDb(m.db));
const counts = (s) => JSON.stringify(s.counts ?? s.rowCounts ?? {});
// a
{
  const phone = '0598' + Date.now().toString().slice(-6);
  const b = snap();
  const r = await c.post('/sales', { saleType: 'credit', customerName: 'T6 late fail', customerPhone: phone, taxTemplateId: 99999, lines: [{ itemId: 4, weightGrams: 500, pricePerKg: 2800 }] });
  log(`a) sale w/ invalid tax template → ${r.status} ${r.body?.error?.code} ${JSON.stringify(r.body?.error?.message).slice(0, 100)}`);
  log('   customers with that phone:', one(m.db, 'select count(*) n from customers where phone=?', phone).n, '| delta:', formatDiff(diff(b, snap())).replace(/\n/g, ' | '));
}
// b
{
  const p = await c.post('/purchases', { supplierId: 2, lines: [{ itemId: 5, weightGrams: 2000, pricePerKg: 1200 }], notes: 'T6 08b' });
  const id = p.data.id;
  const before = { pur: one(m.db, 'select purchase_number,total_amount,amount_paid from purchases where id=?', id), lots: q(m.db, 'select lot_number,remaining_quantity_grams from inventory_lots where purchase_id=?', id), je: q(m.db, `select entry_number from journal_entries where source_type='purchase' and source_id=?`, id), debt: q(m.db, `select total_amount from debts where source_type='purchase' and source_id=?`, id) };
  const b = snap();
  const r = await c.put(`/purchases/${id}`, { supplierId: 2, lines: [{ itemId: 5, weightGrams: 3000, pricePerKg: 1200 }], amountPaid: 3600, paymentMethod: 'cash' });
  const after = { pur: one(m.db, 'select purchase_number,total_amount,amount_paid from purchases where id=?', id), lots: q(m.db, 'select lot_number,remaining_quantity_grams from inventory_lots where purchase_id=?', id), je: q(m.db, `select entry_number from journal_entries where source_type='purchase' and source_id=?`, id), debt: q(m.db, `select total_amount from debts where source_type='purchase' and source_id=?`, id) };
  log(`b) purchase ${before.pur.purchase_number} update paying 36.00 cash → ${r.status} ${r.body?.error?.code ?? ''}`);
  log('   before', JSON.stringify(before)); log('   after ', JSON.stringify(after));
  log('   delta:', formatDiff(diff(b, snap())).replace(/\n/g, ' | '));
}
// c
{
  const e = await c.post('/expenses', { categoryId: 1, description: 'T6 08c', amount: 300, paymentMethod: 'cash' });
  const id = e.data.id; const jeQ = () => q(m.db, `select e.entry_number, sum(l.debit_amount) d from journal_entries e join journal_entry_lines l on l.journal_entry_id=e.id where e.source_type='expense' and e.source_id=? group by e.id`, id);
  log(`c) expense ${e.data.expenseNumber} 3.00 JE:`, jeQ());
  const u = await c.put(`/expenses/${id}`, { amount: 99900 });
  log(`   PUT amount 999.00 → ${u.status}; expense row amount=${one(m.db, 'select amount from expenses where id=?', id).amount}; JE:`, jeQ());
  const d = await c.del(`/expenses/${id}`);
  log(`   DELETE → ${d.status}; expense rows=${one(m.db, 'select count(*) n from expenses where id=?', id).n}; JE still:`, jeQ());
}
log.save();
