// T4-02b: follow-ups — receipts into mis-mapped bank accounts, non-existent bank id, zero-amount advance JE.
import { login, snapshot, delta, makeLog, short, q, QA } from './lib.mjs';
const log = makeLog(`${QA}/tests/T4/02b-bank-wrong-gl.out.txt`);
const c = await login('t4a');
const DB = c.meta.db;
const step = async (label, fn) => {
  const b = snapshot(DB); const r = await fn(); const d = delta(b, snapshot(DB));
  log(`\n## ${label}`); log('  resp:', short(r)); log('  GLΔ:', d.gl, 'je', d.je); return r;
};
const banks = Object.fromEntries(q(DB, 'select name,id from bank_accounts').map((r) => [r.name, r.id]));
log('banks', banks);
log('zero-amount advance JE (R8) lines:', q(DB, "select j.entry_number, count(l.id) n, coalesce(sum(l.debit_amount),0) d from journal_entries j left join journal_entry_lines l on l.journal_entry_id=j.id where j.source_type='payment' and j.source_id=(select id from payments where amount=0 order by id desc limit 1) group by j.id"));
const P = (await c.post('/purchases', { supplierId: 2, lines: [{ itemId: 5, weightGrams: 1000, pricePerKg: 10000 }], amountPaid: 0 })).data.id;
await step('N1. purchase payment bank_transfer bankAccountId=999', () => c.post('/payments/purchase', { purchaseId: P, amount: 100, paymentMethod: 'bank_transfer', bankAccountId: 999 }));
await step('N2. customer advance (receipt, no guard) 100.00 into bank-on-revenue (4110)', () => c.post('/payments/advance', { partyType: 'customer', partyId: 1, amount: 10000, paymentMethod: 'bank_transfer', bankAccountId: banks['bank-on-revenue'] }));
await step('N3. customer advance 100.00 into bank-on-group (1112 group)', () => c.post('/payments/advance', { partyType: 'customer', partyId: 1, amount: 10000, paymentMethod: 'bank_transfer', bankAccountId: banks['bank-on-group'] }));
await step('N4. customer advance 100.00 into bank-on-AP (2110)', () => c.post('/payments/advance', { partyType: 'customer', partyId: 1, amount: 10000, paymentMethod: 'card', bankAccountId: banks['bank-on-AP'] }));
await step('N5. now supplier payment 50.00 via bank-on-AP (AP balance shifted)', () => c.post('/payments/purchase', { purchaseId: P, amount: 5000, paymentMethod: 'bank_transfer', bankAccountId: banks['bank-on-AP'] }));
log.save();
