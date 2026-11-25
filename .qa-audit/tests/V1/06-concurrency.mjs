import * as L from './lib.mjs';
const a = await L.admin();
const ITEM = 4;
await L.buy(a, ITEM, 50000, 2000);
const mk = async (b = {}) => (await a.post('/sales', { saleType: 'credit', dueDate: '2026-12-31', lines: [{ itemId: ITEM, weightGrams: 2000, pricePerKg: 5000 }], ...b })).data;
const N = 4;
// T3-001/T6-003 concurrent void
{ const cid = await L.newCustomer(a, 'C1'); const s = await mk({ customerId: cid });
  const inv0 = L.invOf(ITEM), lots0 = L.lotsOf(ITEM).reduce((x, l) => x + l.rem, 0), g0 = L.snap(), je0 = L.one(`select count(*) c from journal_entries where source_type='sale_void'`).c;
  const rs = await Promise.all(Array.from({ length: N }, () => a.post(`/sales/${s.id}/void`, { reason: 'v1' })));
  L.say('VOID x4 statuses (exp 1x200 + 3x400)', rs.map(L.st));
  L.say('sale_void JEs created (exp 1)', L.one(`select count(*) c from journal_entries where source_type='sale_void'`).c - je0);
  L.say('stock restored: inv q delta (exp +2000), lots delta', [L.invOf(ITEM).q - inv0.q, L.lotsOf(ITEM).reduce((x, l) => x + l.rem, 0) - lots0]);
  L.say('GL delta vs after sale (exp AR-10000,rev+10000, cogs-5600..)', L.delta(g0, L.snap()));
  L.say('customer balance (exp 0)', L.custBal(cid));
}
// T3-002/T6-004 concurrent payments /payments/sale
{ const cid = await L.newCustomer(a, 'C2'); const s = await mk({ customerId: cid });
  const g0 = L.snap();
  const rs = await Promise.all(Array.from({ length: N }, () => a.post('/payments/sale', { saleId: s.id, amount: 6000, paymentMethod: 'cash' })));
  L.say('PAY x4 6000 on 10000 statuses', rs.map(L.st));
  L.say('sale row (exp paid<=10000)', L.saleRow(s.id)); L.say('GL delta (exp cash<=+10000)', L.delta(g0, L.snap())); L.say('customer bal', L.custBal(cid));
}
// /sales/:id/payments concurrent
{ const cid = await L.newCustomer(a, 'C3'); const s = await mk({ customerId: cid });
  const rs = await Promise.all(Array.from({ length: N }, () => a.post(`/sales/${s.id}/payments`, { amount: 6000, paymentMethod: 'cash' })));
  L.say('SALEPAY x4 statuses', rs.map(L.st)); L.say('sale row (sale.amount_paid vs debts)', L.saleRow(s.id));
  L.say('debt', L.one(`select total_amount t,amount_paid p,status s from debts where source_type='sale' and source_id=?`, s.id)); L.say('customer bal', L.custBal(cid)); }
// T6-002 parallel adjustments
{ const inv0 = L.invOf(ITEM); const g0 = L.snap(); const m0 = L.one(`select count(*) c from stock_ledger_entries`).c;
  const rs = await Promise.all(Array.from({ length: N }, () => a.post('/inventory/adjustments', { itemId: ITEM, adjustmentType: 'decrease', quantityGrams: 1000, reason: 'v1 race' })));
  L.say('ADJ x4 statuses', rs.map(L.st));
  L.say('inventory q before/after (exp -4000)', [inv0.q, L.invOf(ITEM).q, L.invOf(ITEM).q - inv0.q]);
  L.say('inventory value delta, GL1131 delta (exp equal)', [L.invOf(ITEM).v - inv0.v, L.delta(g0, L.snap())['1131']]);
}
