// T4-06c (fresh t4b copy of 06): same purchasing/expense operations with gl_engine_enabled=true (+tax_engine_enabled=true). t4a, restores flags at end.
import { login, snapshot, delta, makeLog, short, q, q1, fund, QA } from './lib.mjs';
const log = makeLog(`${QA}/tests/T4/06c-engines-on-fresh.out.txt`);
const c = await login('t4b');
const DB = c.meta.db;
const step = async (label, fn) => {
  const b = snapshot(DB); const r = await fn(); const d = delta(b, snapshot(DB));
  log(`\n## ${label}`); log('  resp:', short(r), r.ok && r.data?.id ? `id=${r.data.id}` : '');
  log('  Δ:', JSON.stringify({ gl: d.gl, sup: d.suppliers, debt: d.payDebt, je: d.je, tbBalanced: d.tbBalanced })); return r;
};
const set = async (k, v) => log(`set ${k}=${v}:`, short(await c.put(`/settings/${k}`, { value: v })));
await set('gl_engine_enabled', 'true');
await set('tax_engine_enabled', 'true');
log('settings now', q(DB, "select key,value from system_settings where key like '%engine%'"));
const ba = await c.post('/bank-accounts', { name: 'bank-fresh' }); const B1 = ba.data.id; await fund(c, DB, 1000000); await fund(c, DB, 100000, ba.data.account.code);
const L = (itemId, g, p) => ({ itemId, weightGrams: g, pricePerKg: p });

await step('E1. credit purchase net 200.00 + tax 30.00', () => c.post('/purchases', { supplierId: 1, lines: [L(2, 10000, 2000)], taxAmount: 3000 }));
await step('E2. fully paid taxed purchase 230.00 cash', () => c.post('/purchases', { supplierId: 1, lines: [L(2, 10000, 2000)], taxAmount: 3000, amountPaid: 23000, paymentMethod: 'cash' }));
const e3 = await step('E3. fully paid purchase with tax 0.40 (within 0.50 tolerance) 200.40 cash', () => c.post('/purchases', { supplierId: 1, lines: [L(2, 10000, 2000)], taxAmount: 40, amountPaid: 20040, paymentMethod: 'cash' }));
if (e3.ok) log('  JE lines:', q(DB, "select a.code,l.debit_amount d,l.credit_amount c,l.is_round_off r from journal_entries j join journal_entry_lines l on l.journal_entry_id=j.id join accounts a on a.id=l.account_id where j.source_type='purchase' and j.source_id=?", e3.data.id));
await step('E4. expense 50.00 bank_transfer B1 (GL engine path)', () => c.post('/expenses', { categoryId: 2, description: 'gl engine bank', amount: 5000, paymentMethod: 'bank_transfer', bankAccountId: B1 }));
// JE numbering collision (K2-004): delete a purchase whose JE is not the latest
const px = await step('N1. credit purchase X', () => c.post('/purchases', { supplierId: 2, lines: [L(3, 1000, 2000)] }));
const py = (await c.post('/purchases', { supplierId: 2, lines: [L(3, 1000, 2000)] })).data.id;
await step('N2. payment on another purchase (new JE after X)', () => c.post('/payments/purchase', { purchaseId: py, amount: 500, paymentMethod: 'cash' }));
log('  last JE numbers:', q(DB, 'select entry_number from journal_entries order by id desc limit 3').map((r) => r.entry_number));
// X is not the last purchase now (py is) -> deleting X also collides on PUR numbers; delete py-related? use X anyway to test JE numbering
await step('N3. DELETE purchase X (its JE is not the newest)', () => c.del(`/purchases/${px.data.id}`));
await step('N4. supplier payment after delete (GL engine JE count+1)', () => c.post('/payments/purchase', { purchaseId: py, amount: 500, paymentMethod: 'cash' }));
await step('N5. expense after delete (GL engine)', () => c.post('/expenses', { categoryId: 1, description: 'after', amount: 100, paymentMethod: 'cash' }));
await set('gl_engine_enabled', 'false');
await set('tax_engine_enabled', 'false');
await step('N6. same payment with legacy path', () => c.post('/payments/purchase', { purchaseId: py, amount: 500, paymentMethod: 'cash' }));
log.save();
