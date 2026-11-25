import * as L from './lib.mjs';
const a = await L.admin();
const ITEM = 3;
await L.buy(a, ITEM, 20000, 2000);
const bid = L.one(`select id from bank_accounts order by id limit 1`).id;
const mk = async (b) => (await a.post('/sales', { lines: [{ itemId: ITEM, weightGrams: 2000, pricePerKg: 5000 }], ...b })).data;
// F-13 pure bank sale
{ const g0 = L.snap(); const s = await mk({ saleType: 'cash', payments: [{ amount: 10000, paymentMethod: 'bank_transfer', bankAccountId: bid }] });
  L.say('F13 bank_transfer sale GL delta (exp bank+10000, cash 0)', L.delta(g0, L.snap()));
  const g1 = L.snap(); const s2 = await mk({ saleType: 'cash', payments: [{ amount: 10000, paymentMethod: 'card', bankAccountId: bid }] });
  L.say('F13 card sale GL delta', L.delta(g1, L.snap()));
  const g2 = L.snap(); await a.post(`/sales/${s.id}/void`, { reason: 'v1' });
  L.say('F13 void of bank sale: delta (exp bank -10000, cash 0)', L.delta(g2, L.snap())); }
// F-08 payment cancel restores balance
{ const cid = await L.newCustomer(a, 'F08'); const s = await mk({ saleType: 'credit', customerId: cid, dueDate: '2026-12-31' });
  const p = await a.post('/payments/sale', { saleId: s.id, amount: 4000, paymentMethod: 'cash' });
  const b1 = L.custBal(cid); const g1 = L.snap();
  const c = await a.post(`/payments/${p.data.id}/cancel`, { reason: 'v1' });
  L.say('F08 balance: after sale/after pay/after cancel (exp 10000/6000/10000)', [10000, b1, L.custBal(cid)]);
  L.say('F08 cancel', L.st(c)); L.say('F08 sale row', L.saleRow(s.id));
  L.say('F08 GL delta cancel (exp cash-4000, AR+4000)', L.delta(g1, L.snap()));
  L.say('F08 debt', L.one(`select total_amount t,amount_paid p,status s from debts where source_type='sale' and source_id=?`, s.id)); }
// T8-001/T4-006 expense by bank
{ const cats = await a.get('/expenses/categories'); const cat = (cats.data?.[0] ?? cats.data?.items?.[0]);
  L.say('expense category', cat && { id: cat.id, name: cat.name });
  await a.post('/bank-accounts', {}); // noop
  const g0 = L.snap();
  const e = await a.post('/expenses', { categoryId: cat.id, description: 'V1 bank expense', amount: 20000, paymentMethod: 'bank_transfer', bankAccountId: bid, expenseDate: new Date().toISOString() });
  L.say('expense bank create', L.st(e));
  L.say('expense bank GL delta (exp bank -20000 cash 0)', L.delta(g0, L.snap()));
  const g1 = L.snap();
  const e2 = await a.post('/expenses', { categoryId: cat.id, description: 'V1 cash expense', amount: 1000, paymentMethod: 'cash', expenseDate: new Date().toISOString() });
  L.say('expense cash', [L.st(e2), L.delta(g1, L.snap())]);
  L.say('expense rows', L.sql(`select id,amount,payment_method m,bank_account_id b,status from expenses order by id desc limit 2`)); }
