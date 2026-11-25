// T1-07: gl_engine_enabled + tax_engine_enabled ON, mixed-mode reversals, numbering (t1b, 3125)
import fs from 'node:fs';
import { env, connect, logger, err, failing, diff } from './lib.mjs';
const [NAME, PORT] = [process.argv[2] ?? 't1b', Number(process.argv[3] ?? 3125)];
const E = env(NAME, PORT); const { log, lines } = logger();
import { request } from './lib.mjs';
if (!E.q("select value from system_settings where key='setup_completed'")[0]?.value?.startsWith("true")) {
  await request(E.BASE, 'POST', '/auth/setup', { body: { businessName: 'QA7', adminUsername: 'admin', adminPassword: 'Admin@12345', adminFullName: 'QA', preferredLanguage: 'en' } });
}
const a = await connect(E.BASE, 'admin', 'Admin@12345'); const id = E.acctId;
if (!E.q("select id from items limit 1").length) {
  await a.post('/bank-accounts', { name: 'Bank', accountId: id('1112-001'), isDefault: true });
  await a.post('/customers', { name: 'C1', phone: '0591111111' }); await a.post('/customers', { name: 'C2', phone: '0591111112' });
  await a.post('/suppliers', { name: 'S1' });
  for (const c of ['IA', 'IB']) await a.post('/items', { name: c, code: c, categoryId: 3, defaultSalePrice: 4000, defaultPurchasePrice: 2000 });
  await a.post('/purchases', { supplierId: 1, lines: [{ itemId: 1, weightGrams: 100000, pricePerKg: 2000 }, { itemId: 2, weightGrams: 50000, pricePerKg: 2000 }] });
  const j = await a.post('/accounting/journal-entries', { description: 'cap', lines: [{ accountId: id('1111'), debit: 100000 }, { accountId: id('3100'), credit: 100000 }] });
  await a.post(`/accounting/journal-entries/${j.data.id}/post`);
}
const item = 1;
const cust = 2, sup = 1, bank = 1;
// fund bank for bank outflows
let c = await a.post('/accounting/journal-entries', { description: 'fund bank', lines: [{ accountId: id('1112-001'), debit: 500000 }, { accountId: id('3100'), credit: 500000 }] });
await a.post(`/accounting/journal-entries/${c.data.id}/post`);

const steps = [];
async function step(name, fn) {
  const jeBefore = E.q(`select coalesce(max(id),0) m from journal_entries`)[0].m;
  const b = E.snap(); const r = await fn(); const d = diff(b, E.snap());
  const newJes = E.q(`select j.id, j.entry_number, j.source_type, j.is_posted, j.entry_date, sum(l.debit_amount) dr, sum(l.credit_amount) cr, sum(l.is_round_off) ro, count(l.id) n,
     group_concat(a.code || ':' || (l.debit_amount - l.credit_amount) || coalesce('[' || l.party_type || l.party_id || ']',''), ' ') lines
     from journal_entries j left join journal_entry_lines l on l.journal_entry_id=j.id left join accounts a on a.id=l.account_id where j.id>? group by j.id`, jeBefore);
  log(`\n## ${name} -> ${r.status} ${err(r).slice(0, 200)}`);
  for (const j of newJes) log(`   ${j.entry_number} ${j.source_type} posted=${j.is_posted} date=${new Date(j.entry_date).toISOString()} Dr=${j.dr} Cr=${j.cr}${j.dr !== j.cr ? ' **UNBALANCED**' : ''} roundOff=${j.ro} | ${j.lines}`);
  log(`   GL Δ balanced=${d.balanced}; metrics Δ ${JSON.stringify(d.metrics)}`);
  steps.push({ name, status: r.status, jes: newJes.length, unbalanced: newJes.filter((j) => j.dr !== j.cr).length });
  return r;
}
// ---- legacy (OFF) documents to reverse later ----
const sOff = await step('[OFF] cash sale 100.00', () => a.post('/sales', { saleType: 'cash', lines: [{ itemId: item, weightGrams: 2500, pricePerKg: 4000 }], payments: [{ amount: 10000, paymentMethod: 'cash' }] }));
const cOff = await step('[OFF] credit sale 100.00', () => a.post('/sales', { saleType: 'credit', customerId: cust, lines: [{ itemId: item, weightGrams: 2500, pricePerKg: 4000 }] }));
const pOff = await step('[OFF] /payments/sale 25.00', () => a.post('/payments/sale', { saleId: cOff.data.id, amount: 2500, paymentMethod: 'cash' }));

// ---- switch ON ----
log('\nset gl_engine_enabled', (await a.put('/settings/gl_engine_enabled', { value: 'true' })).status, 'tax_engine_enabled', (await a.put('/settings/tax_engine_enabled', { value: 'true' })).status,
  E.q(`select key,value from system_settings where key in ('gl_engine_enabled','tax_engine_enabled')`));
const sOn = await step('[ON] cash sale 100.00', () => a.post('/sales', { saleType: 'cash', lines: [{ itemId: item, weightGrams: 2500, pricePerKg: 4000 }], payments: [{ amount: 10000, paymentMethod: 'cash' }] }));
await step('[ON] cash sale 100.00 with 5.00 discount', () => a.post('/sales', { saleType: 'cash', discountAmount: 500, lines: [{ itemId: item, weightGrams: 2500, pricePerKg: 4000 }], payments: [{ amount: 9500, paymentMethod: 'cash' }] }));
const tx1 = await step('[ON] cash sale 33.33 + VAT template 1 (15%)', () => a.post('/sales', { saleType: 'cash', taxTemplateId: 1, lines: [{ itemId: item, weightGrams: 1111, pricePerKg: 3000 }], payments: [{ amount: 3833, paymentMethod: 'cash' }] }));
if (!tx1.ok) await step('[ON] same, paying the server-computed total (credit for remainder)', () => a.post('/sales', { saleType: 'cash', customerId: cust, taxTemplateId: 1, lines: [{ itemId: item, weightGrams: 1111, pricePerKg: 3000 }], payments: [{ amount: 3800, paymentMethod: 'cash' }] }));
await step('[ON] VAT sale with 1.00 discount (K3-020)', () => a.post('/sales', { saleType: 'credit', customerId: cust, taxTemplateId: 1, discountAmount: 100, lines: [{ itemId: item, weightGrams: 1000, pricePerKg: 4000 }] }));
const cOn = await step('[ON] credit sale 100.00', () => a.post('/sales', { saleType: 'credit', customerId: cust, lines: [{ itemId: item, weightGrams: 2500, pricePerKg: 4000 }] }));
const pOn = await step('[ON] /payments/sale 25.00 bank', () => a.post('/payments/sale', { saleId: cOn.data.id, amount: 2500, paymentMethod: 'bank_transfer', bankAccountId: bank }));
await step('[ON] mixed tender 50 cash + 50 card', () => a.post('/sales', { saleType: 'cash', lines: [{ itemId: item, weightGrams: 2500, pricePerKg: 4000 }], payments: [{ amount: 5000, paymentMethod: 'cash' }, { amount: 5000, paymentMethod: 'card', bankAccountId: bank }] }));
await step('[ON] credit purchase 20.00 + tax 3.00', () => a.post('/purchases', { supplierId: sup, lines: [{ itemId: item, weightGrams: 1000, pricePerKg: 2000 }], taxAmount: 300 }));
await step('[ON] purchase 20.00 + tax 3.00 paid 23.00 bank', () => a.post('/purchases', { supplierId: sup, lines: [{ itemId: item, weightGrams: 1000, pricePerKg: 2000 }], taxAmount: 300, amountPaid: 2300, paymentMethod: 'bank_transfer', bankAccountId: bank }));
await step('[ON] expense 10.00 bank_transfer (category rent 5210)', () => a.post('/expenses', { categoryId: 2, description: 'rent on', amount: 1000, paymentMethod: 'bank_transfer', bankAccountId: bank }));
await step('[ON] expense 10.00 + tax 1.50 cash', () => a.post('/expenses', { categoryId: 9, description: 'tax exp', amount: 1000, taxAmount: 150, paymentMethod: 'cash' }));
const lot = E.q(`select id from inventory_lots where item_id=? and remaining_quantity_grams>1000 order by id limit 1`, item)[0].id;
await step('[ON] wastage 0.333 kg', () => a.post('/wastage', { lotId: lot, quantityGrams: 333, reason: 'spoiled' }));
await step('[ON] adjustment -0.777 kg', () => a.post('/inventory/adjustments', { itemId: item, adjustmentType: 'decrease', quantityGrams: 777, reason: 'on' }));
await step('[ON] manual JE imbalance 0.03 (within tolerance 5)', () => a.post('/accounting/journal-entries', { description: 'tol', lines: [{ accountId: id('1210'), debit: 1003 }, { accountId: id('3100'), credit: 1000 }] }));
await step('[ON] manual JE imbalance 0.40 (> tolerance 5)', () => a.post('/accounting/journal-entries', { description: 'tol2', lines: [{ accountId: id('1210'), debit: 1040 }, { accountId: id('3100'), credit: 1000 }] }));
await step('[ON] manual JE zero lines', () => a.post('/accounting/journal-entries', { description: 'empty', lines: [] }));
await step('[ON] manual JE fractional 1.6+0.4/2', () => a.post('/accounting/journal-entries', { description: 'frac', lines: [{ accountId: id('1210'), debit: 1.6 }, { accountId: id('1210'), debit: 0.4 }, { accountId: id('3100'), credit: 2 }] }));
// mixed-mode reversals
await step('[ON] void sale posted under OFF', () => a.post(`/sales/${sOff.data.id}/void`, { reason: 'mixed' }));
await step('[ON] cancel payment posted under OFF', () => a.post(`/payments/${pOff.data.id}/cancel`, { reason: 'mixed' }));
await step('[ON] void sale posted under ON', () => a.post(`/sales/${sOn.data.id}/void`, { reason: 'on' }));
// numbering collision (K2-004): delete a purchase whose JE is not the last, then post
const mk = () => a.post('/purchases', { supplierId: sup, lines: [{ itemId: 2, weightGrams: 500, pricePerKg: 2000 }] });
const p1 = await step('[ON] purchase X', mk); await step('[ON] purchase Y', mk);
await step('[ON] DELETE purchase X (hard-deletes its JE)', () => a.del(`/purchases/${p1.data?.id}`));
await step('[ON] next posting after JE delete (cash sale)', () => a.post('/sales', { saleType: 'cash', lines: [{ itemId: item, weightGrams: 100, pricePerKg: 4000 }], payments: [{ amount: 400, paymentMethod: 'cash' }] }));
await step('[ON] and again', () => a.post('/sales', { saleType: 'cash', lines: [{ itemId: item, weightGrams: 100, pricePerKg: 4000 }], payments: [{ amount: 400, paymentMethod: 'cash' }] }));
// switch OFF, reverse ON documents
log('\nset gl_engine_enabled=false', (await a.put('/settings/gl_engine_enabled', { value: 'false' })).status, 'tax_engine_enabled=false', (await a.put('/settings/tax_engine_enabled', { value: 'false' })).status);
await step('[OFF] cancel payment posted under ON', () => a.post(`/payments/${pOn.data.id}/cancel`, { reason: 'mixed2' }));
await step('[OFF] void credit sale posted under ON (after its payment cancelled)', () => a.post(`/sales/${cOn.data.id}/void`, { reason: 'mixed2' }));
log('\nSUMMARY', JSON.stringify(steps.filter((s) => s.unbalanced || s.status >= 400)));
log('invariants:', failing(E.checks()));
fs.writeFileSync(new URL(`./07-engines-on.${NAME}.out.txt`, import.meta.url), lines.join('\n'));
