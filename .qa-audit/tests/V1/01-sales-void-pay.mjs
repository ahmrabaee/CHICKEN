// V1 own repro: void/payment/journal behaviours. Delta-based on a dev instance.
import * as L from './lib.mjs';
const a = await L.admin();
const ITEM = 3, PRICE = 5000; // 2000g @ 50.00/kg => total 10000
await L.buy(a, ITEM, 40000, 2000); // 40kg @ 20.00, ensures stock

const mkSale = async (body) => { const r = await a.post('/sales', { lines: [{ itemId: ITEM, weightGrams: 2000, pricePerKg: PRICE }], ...body }); if (!r.ok) throw new Error('sale ' + L.st(r) + JSON.stringify(r.body)); return r.data; };

// S0: plain cash sale + void => same lots restored, GL net zero
{
  const lotsB = L.lotsOf(ITEM), invB = L.invOf(ITEM), g0 = L.snap();
  const s = await mkSale({ saleType: 'cash', payments: [{ amount: 10000, paymentMethod: 'cash' }] });
  const lotsM = L.lotsOf(ITEM);
  const v = await a.post(`/sales/${s.id}/void`, { reason: 'v1' });
  const lotsA = L.lotsOf(ITEM), invA = L.invOf(ITEM);
  L.say('S0 void status', L.st(v));
  L.say('S0 lots restored identical', JSON.stringify(lotsB) === JSON.stringify(lotsA));
  L.say('S0 inv restored', JSON.stringify(invB) === JSON.stringify(invA) ? 'yes' : { invB, invA });
  L.say('S0 GL net delta (expect {})', L.delta(g0, L.snap()));
  L.say('S0 lots consumed in middle', lotsB.map((l, i) => `${l.id}:${l.rem}->${lotsM[i].rem}`));
}

// S1 K3-001: credit sale 10000, separate payment 4000 cash, void
{
  const cid = await L.newCustomer(a, 'S1');
  const s = await mkSale({ saleType: 'credit', customerId: cid, dueDate: '2026-12-31' });
  const g0 = L.snap();
  const p = await a.post('/payments/sale', { saleId: s.id, amount: 4000, paymentMethod: 'cash' });
  const g1 = L.snap();
  L.say('S1 pay', L.st(p)); L.say('S1 delta after payment (exp cash+4000 AR-4000)', L.delta(g0, g1));
  const v = await a.post(`/sales/${s.id}/void`, { reason: 'v1' });
  const g2 = L.snap();
  L.say('S1 void', L.st(v));
  L.say('S1 delta void-step (exp cash -4000?, AR 0 net vs g0 after total)', L.delta(g1, g2));
  L.say('S1 NET delta vs before-payment (exp {} i.e. cash 0 AR 0 ... see below)', L.delta(g0, g2));
  L.say('S1 sale row', L.saleRow(s.id)); L.say('S1 customer balance', L.custBal(cid));
  L.say('S1 JEs', L.sql(`select id,source_type st,description d,(select sum(debit_amount) from journal_entry_lines where journal_entry_id=e.id) amt from journal_entries e where source_id=? order by id`, s.id));
  L.say('S1 JE lines for void', L.sql(`select e.source_type st,a.code,l.debit_amount dr,l.credit_amount cr from journal_entry_lines l join journal_entries e on e.id=l.journal_entry_id join accounts a on a.id=l.account_id where e.source_id=? and e.id>(select min(id) from journal_entries where source_id=?) order by e.id,l.id`, s.id, s.id));
}
// S2 T3-006: POS partial: 3000 cash at till, later /payments/sale 2000, void
{
  const cid = await L.newCustomer(a, 'S2');
  const g0 = L.snap();
  const s = await mkSale({ saleType: 'credit', customerId: cid, dueDate: '2026-12-31', payments: [{ amount: 3000, paymentMethod: 'cash' }] });
  const g1 = L.snap();
  const p = await a.post('/payments/sale', { saleId: s.id, amount: 2000, paymentMethod: 'cash' });
  const g2 = L.snap();
  L.say('S2 sale+pay', [L.st(p), L.saleRow(s.id)]);
  L.say('S2 delta after sale (rev10000, cash+3000, AR+7000)', L.delta(g0, g1));
  const v = await a.post(`/sales/${s.id}/void`, { reason: 'v1' });
  const g3 = L.snap();
  L.say('S2 void', L.st(v));
  L.say('S2 NET delta from start (expect all zero)', L.delta(g0, g3));
  L.say('S2 customer balance', L.custBal(cid));
}
// S3 K3-002: POST /sales/:id/payments
{
  const cid = await L.newCustomer(a, 'S3');
  const s = await mkSale({ saleType: 'credit', customerId: cid, dueDate: '2026-12-31' });
  const g0 = L.snap();
  const jeB = L.one(`select count(*) c from journal_entries`).c;
  const p = await a.post(`/sales/${s.id}/payments`, { amount: 3000, paymentMethod: 'cash' });
  L.say('S3 addPayment', L.st(p));
  L.say('S3 JEs created', L.one(`select count(*) c from journal_entries`).c - jeB);
  L.say('S3 GL delta (exp cash+3000, AR-3000)', L.delta(g0, L.snap()));
  L.say('S3 sale row', L.saleRow(s.id)); L.say('S3 customer bal (exp 7000)', L.custBal(cid));
  const pay = L.one(`select id,amount,payment_method m,bank_account_id b from payments where reference_type='sale' and reference_id=? order by id desc`, s.id);
  L.say('S3 payment row', pay);
  if (pay) { const c = await a.post(`/payments/${pay.id}/cancel`, { reason: 'v1' }); L.say('S3 cancel that payment', L.st(c)); }
}
// S4 K3-003: mixed tender
{
  const ba0 = await a.post('/bank-accounts', { name: 'V1 Bank', accountId: 6, isDefault: true }); L.say('S4 bank create', L.st(ba0));
  const bid = ba0.data?.id;
  const g0 = L.snap();
  const s = await mkSale({ saleType: 'cash', payments: [{ amount: 5000, paymentMethod: 'cash' }, { amount: 5000, paymentMethod: 'bank_transfer', bankAccountId: bid }] });
  L.say('S4 payments rows', L.sql(`select amount,payment_method m,bank_account_id b from payments where reference_type='sale' and reference_id=?`, s.id));
  L.say('S4 sale (no bankAccountId)', [s.id]);
  L.say('S4 GL delta (exp cash+5000 bank+5000)', L.delta(g0, L.snap()));
  
}
