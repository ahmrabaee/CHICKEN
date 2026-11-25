// T6-07: boundary / malformed input matrix. For each case: HTTP status, error code, and what got persisted.
import { connect, meta, q, one, tee, outFor, sleep } from './lib.mjs';
import { openDb, snapshot, diff, formatDiff } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/invariants.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const c = await connect(m.baseUrl, 'admin', 'admin123');
const snap = () => snapshot(openDb(m.db));
const I32 = 2147483647;
const sale = (o = {}, line = {}) => ({ saleType: 'cash', lines: [{ itemId: 4, weightGrams: 100, pricePerKg: 2800, ...line }], payments: [{ paymentMethod: 'cash', amount: 280 }], ...o });
const pur = (line = {}, o = {}) => ({ supplierId: 1, lines: [{ itemId: 6, weightGrams: 1000, pricePerKg: 1000, ...line }], ...o });
const exp = (o = {}) => ({ categoryId: 1, description: 'T6 boundary', amount: 100, paymentMethod: 'cash', ...o });
const credit = async () => (await c.post('/sales', { saleType: 'credit', customerId: 1, lines: [{ itemId: 4, weightGrams: 100, pricePerKg: 2800 }] })).data.id;
const long = 'ج'.repeat(200000);
const cases = [
  ['sale price=INT32 max, 1 kg', 'POST', '/sales', sale({ payments: [{ paymentMethod: 'cash', amount: I32 }] }, { weightGrams: 1000, pricePerKg: I32 })],
  ['sale total > INT32 (2 kg × INT32)', 'POST', '/sales', sale({ payments: undefined, saleType: 'credit', customerId: 1 }, { weightGrams: 2000, pricePerKg: I32 })],
  ['sale price 2^53', 'POST', '/sales', sale({ payments: undefined, saleType: 'credit', customerId: 1 }, { pricePerKg: 2 ** 53 })],
  ['sale weight 0.4 g (rounds to 0)', 'POST', '/sales', sale({}, { weightGrams: 0.4 })],
  ['sale weight 1.5 g (rounds to 2)', 'POST', '/sales', sale({ payments: [{ paymentMethod: 'cash', amount: 4 }] }, { weightGrams: 1.5 })],
  ['sale payment fractional 280.5', 'POST', '/sales', sale({ payments: [{ paymentMethod: 'cash', amount: 280.5 }] })],
  ['sale customerId null', 'POST', '/sales', sale({ customerId: null })],
  ['sale notes 200k Arabic chars', 'POST', '/sales', sale({ notes: long })],
  ['sale dueDate year 9999', 'POST', '/sales', sale({ saleType: 'credit', customerId: 1, payments: undefined, dueDate: '9999-12-31' })],
  ['sale dueDate invalid 2026-02-30', 'POST', '/sales', sale({ saleType: 'credit', customerId: 1, payments: undefined, dueDate: '2026-02-30' })],
  ['sale discountAmount > total', 'POST', '/sales', sale({ discountAmount: 100000, payments: undefined })],
  ['purchase weight NEGATIVE', 'POST', '/purchases', pur({ weightGrams: -5000 })],
  ['purchase price NEGATIVE', 'POST', '/purchases', pur({ pricePerKg: -1000 })],
  ['purchase weight 0', 'POST', '/purchases', pur({ weightGrams: 0 })],
  ['purchase weight fractional 1000.7', 'POST', '/purchases', pur({ weightGrams: 1000.7, pricePerKg: 999.9 })],
  ['purchase weight 1e12', 'POST', '/purchases', pur({ weightGrams: 1e12 })],
  ['purchase date "not-a-date"', 'POST', '/purchases', pur({}, { purchaseDate: 'not-a-date' })],
  ['purchase date 1900-01-01', 'POST', '/purchases', pur({}, { purchaseDate: '1900-01-01' })],
  ['purchase taxAmount negative', 'POST', '/purchases', pur({}, { taxAmount: -500 })],
  ['expense amount NEGATIVE', 'POST', '/expenses', exp({ amount: -5000 })],
  ['expense amount fractional 10.55', 'POST', '/expenses', exp({ amount: 10.55 })],
  ['expense amount 0', 'POST', '/expenses', exp({ amount: 0 })],
  ['expense date invalid', 'POST', '/expenses', exp({ expenseDate: '2026-99-99' })],
  ['expense description emoji', 'POST', '/expenses', exp({ description: '🐔🔥 مصروف 👍' })],
  ['customer name emoji+Arabic+RTL marks', 'POST', '/customers', { name: '\u202Eزبون 🐔 test\u202C', phone: '0599' + Date.now().toString().slice(-6) }],
  ['adjustment increase unitCost NEGATIVE', 'POST', '/inventory/adjustments', { itemId: 4, adjustmentType: 'increase', quantityGrams: 1000, unitCost: -5000, reason: 'T6 neg cost' }],
  ['adjustment quantity INT32 max increase', 'POST', '/inventory/adjustments', { itemId: 4, adjustmentType: 'increase', quantityGrams: I32, unitCost: 1000, reason: 'T6 huge' }],
];
for (const [name, method, path, body] of cases) {
  const b = snap();
  const r = await c.raw(method, path, { body });
  const d = diff(b, snap());
  const rows = Object.entries(d.rows ?? d.rowCounts ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(',');
  log(`[${r.status}] ${name} → ${r.ok ? 'ACCEPTED ' + JSON.stringify({ n: r.data?.saleNumber ?? r.data?.purchaseNumber ?? r.data?.expenseNumber ?? r.data?.id, total: r.data?.totalAmount ?? r.data?.grandTotal ?? r.data?.amount, date: r.data?.purchaseDate ?? r.data?.expenseDate ?? r.data?.dueDate }) : (r.body?.error?.code ?? '') + ' ' + JSON.stringify(r.body?.error?.message ?? r.body).slice(0, 160)}`);
  if (r.ok || r.status >= 500) log('    delta: ' + formatDiff(d).split('\n').filter((l) => /GL delta|^\s+1\d\d\d|^\s+[2-5]\d\d\d|inventory_|lots_|Row count/.test(l)).join(' | '));
  await sleep(80);
}
// payments boundaries on a credit sale
for (const [name, amt] of [['/payments/sale NEGATIVE amount', -1000], ['/payments/sale fractional 0.5', 0.5], ['/payments/sale 0', 0]]) {
  const id = await credit(); const b = snap();
  const r = await c.post('/payments/sale', { saleId: id, amount: amt, paymentMethod: 'cash' });
  log(`[${r.status}] ${name} → ${r.ok ? 'ACCEPTED' : r.body?.error?.code + ' ' + JSON.stringify(r.body?.error?.message).slice(0, 120)}; sale now ${JSON.stringify(one(m.db, 'select amount_paid,payment_status from sales where id=?', id))}`);
  if (r.ok) log('    delta: ' + formatDiff(diff(b, snap())).replace(/\n/g, ' | '));
}
log.save();
