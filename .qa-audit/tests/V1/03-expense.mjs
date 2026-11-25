import * as L from './lib.mjs';
const a = await L.admin();
const bid = L.one(`select id from bank_accounts order by id limit 1`).id;
for (const [acc, nm] of [[4,'cash'],[6,'bank']]) {
  const j = await a.post('/accounting/journal-entries', { description: 'V1 capital '+nm, entryDate: new Date().toISOString(), lines: [{ accountId: acc, debit: 100000, credit: 0 }, { accountId: 21, debit: 0, credit: 100000 }] });
  if (j.ok) { const p = await a.post(`/accounting/journal-entries/${j.data.id}/post`, {}); L.say('fund '+nm, [L.st(j), L.st(p)]); } else L.say('fund fail', [L.st(j), j.body]);
}
L.say('balances cash/bank', [L.glOf('1111'), L.glOf('1112-001')]);
const g0 = L.snap();
const e = await a.post('/expenses', { categoryId: 1, description: 'V1 bank expense', amount: 20000, paymentMethod: 'bank_transfer', bankAccountId: bid, expenseDate: new Date().toISOString() });
L.say('expense bank create', L.st(e));
L.say('expense bank GL delta (exp bank -20000 cash 0)', L.delta(g0, L.snap()));
const g1 = L.snap();
const e2 = await a.post('/expenses', { categoryId: 1, description: 'V1 cash expense', amount: 1000, paymentMethod: 'cash', expenseDate: new Date().toISOString() });
L.say('expense cash', [L.st(e2), L.delta(g1, L.snap())]);
L.say('expense rows', L.sql(`select id,amount,payment_method m,bank_account_id b from expenses order by id desc limit 2`));
const g2 = L.snap();
const e3 = await a.post('/expenses', { categoryId: 1, description: 'V1 card expense', amount: 500, paymentMethod: 'card', bankAccountId: bid, expenseDate: new Date().toISOString() });
L.say('expense card w/ bank', [L.st(e3), L.delta(g2, L.snap())]);
