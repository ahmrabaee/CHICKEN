// T1-05: cross-validation of K3/K2 GL leads + reversal correctness (void / cancel mirror, double reversal)
// instance t1b (3102) after 04 (admin/Admin@12345, cash funded)
import fs from 'node:fs';
import { env, connect, logger, err, failing, diff, formatDiff } from './lib.mjs';
const E = env('t1b', 3102); const { log, lines } = logger();
const a = await connect(E.BASE, 'admin', 'Admin@12345');
// master data
const bankId = (await a.post('/bank-accounts', { name: 'Bank', accountId: E.acctId('1112-001'), isDefault: true })).data?.id;
const c1 = (await a.post('/customers', { name: 'C1', phone: '0591111111' })).data.id;
const c2 = (await a.post('/customers', { name: 'C2', phone: '0591111112' })).data.id;
const s1 = (await a.post('/suppliers', { name: 'S1' })).data.id;
const I = [];
for (const [n, c] of [['A', 'IA'], ['B', 'IB'], ['C', 'IC']]) I.push((await a.post('/items', { name: 'Item ' + n, code: c, categoryId: 3, defaultSalePrice: 4000, defaultPurchasePrice: 2000, shelfLifeDays: 5 })).data.id);
// stock: purchase cash 2 lots per item
await a.post('/purchases', { supplierId: s1, lines: I.map((i) => ({ itemId: i, weightGrams: 50000, pricePerKg: 2000 })) });
await a.post('/purchases', { supplierId: s1, lines: I.map((i) => ({ itemId: i, weightGrams: 50000, pricePerKg: 2200 })) });

const results = {};
async function scenario(key, title, fn) {
  const b = E.snap(); const info = await fn(); const d = diff(b, E.snap());
  log(`\n### ${key}: ${title}`); if (info) log('  info:', info); log(formatDiff(d).split('\n').map((x) => '  ' + x).join('\n'));
  results[key] = { d, info }; return { d, info };
}
const net = (d, code) => d.accounts[code]?.net ?? 0;
const mirror = (aId, bId) => {
  const sig = (j) => Object.fromEntries(E.q(`select a.code, sum(debit_amount)-sum(credit_amount) n from journal_entry_lines l join accounts a on a.id=l.account_id where journal_entry_id=? group by a.code`, j).map((x) => [x.code, x.n]));
  const x = sig(aId), y = sig(bId); const bad = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => (x[k] ?? 0) !== -(y[k] ?? 0));
  return bad.length ? { mirror: false, orig: x, rev: y } : { mirror: true };
};
const jeOf = (t, id) => E.q(`select id from journal_entries where source_type=? and source_id=? order by id`, t, id).map((x) => x.id);

// K3-001
await scenario('K3-001', 'credit sale 100.00 -> /payments/sale 40.00 -> void (expect net zero everywhere)', async () => {
  const s = (await a.post('/sales', { saleType: 'credit', customerId: c1, lines: [{ itemId: I[0], weightGrams: 2500, pricePerKg: 4000 }] })).data;
  const p = await a.post('/payments/sale', { saleId: s.id, amount: 4000, paymentMethod: 'cash' });
  const v = await a.post(`/sales/${s.id}/void`, { reason: 't1' });
  const v2 = await a.post(`/sales/${s.id}/void`, { reason: 't1 again' });
  return { pay: p.status, void: v.status, doubleVoid: `${v2.status} ${err(v2).slice(0, 80)}`, saleJE: jeOf('sale', s.id), voidJE: jeOf('sale_void', s.id), mirror: mirror(jeOf('sale', s.id)[0], jeOf('sale_void', s.id)[0]) };
});
// K3-002
await scenario('K3-002', 'credit sale 100.00 -> POST /sales/:id/payments 30.00 (expect cash +30, AR -30)', async () => {
  const s = (await a.post('/sales', { saleType: 'credit', customerId: c2, lines: [{ itemId: I[0], weightGrams: 2500, pricePerKg: 4000 }] })).data;
  const b = E.snap(); const p = await a.post(`/sales/${s.id}/payments`, { amount: 3000, paymentMethod: 'cash' }); const d = diff(b, E.snap());
  const pid = E.q(`select id from payments where reference_type='sale' and reference_id=? order by id desc limit 1`, s.id)[0]?.id;
  const cancel = await a.post(`/payments/${pid}/cancel`, { reason: 't1' });
  return { saleId: s.id, addPayment: p.status, glDeltaOfPaymentOnly: Object.fromEntries(Object.entries(d.accounts).map(([k, v]) => [k, v.net])), subledgerDelta: d.metrics, cancelThatPayment: `${cancel.status} ${err(cancel).slice(0, 100)}` };
});
// K3-003
await scenario('K3-003', 'cash sale 100.00 paid 50 cash + 50 bank (expect 1111 +50, 1112-001 +50)', async () => {
  const s = await a.post('/sales', { saleType: 'cash', lines: [{ itemId: I[1], weightGrams: 2500, pricePerKg: 4000 }], payments: [{ amount: 5000, paymentMethod: 'cash' }, { amount: 5000, paymentMethod: 'bank_transfer', bankAccountId: bankId }] });
  const v = await a.post(`/sales/${s.data.id}/void`, { reason: 'mixed void' });
  return { status: s.status, saleId: s.data.id, void: v.status };
});
// K3-004
await scenario('K3-004a', 'credit purchase 20.00 + tax 3.00 (expect AP -23, VAT receivable +3)', async () => { const r = await a.post('/purchases', { supplierId: s1, lines: [{ itemId: I[2], weightGrams: 1000, pricePerKg: 2000 }], taxAmount: 300 }); return { status: r.status, grandTotal: r.data?.grandTotal }; });
await scenario('K3-004b', 'same purchase fully paid cash 23.00', async () => { const r = await a.post('/purchases', { supplierId: s1, lines: [{ itemId: I[2], weightGrams: 1000, pricePerKg: 2000 }], taxAmount: 300, amountPaid: 2300, paymentMethod: 'cash' }); return { status: r.status, err: err(r).slice(0, 120) }; });
// K3-007
await scenario('K3-007', 'supplier payment 5.00 on the credit purchase (expect supplier.currentBalance -5)', async () => {
  const pu = E.q(`select id from purchases where payment_status!='paid' order by id desc limit 1`)[0].id;
  const b0 = E.q(`select current_balance b from suppliers where id=?`, s1)[0].b; const r = await a.post('/payments/purchase', { purchaseId: pu, amount: 500, paymentMethod: 'cash' });
  const b1 = E.q(`select current_balance b from suppliers where id=?`, s1)[0].b;
  const pid = r.data?.id; const c = await a.post(`/payments/${pid}/cancel`, { reason: 't1' }); const b2 = E.q(`select current_balance b from suppliers where id=?`, s1)[0].b;
  const c2b = await a.post(`/payments/${pid}/cancel`, { reason: 'twice' });
  const rev = E.q(`select id from journal_entries where source_type='reversal' order by id desc limit 1`)[0]?.id;
  return { pay: r.status, supplierBalance: [b0, b1, b2], cancel: c.status, cancelTwice: `${c2b.status} ${err(c2b).slice(0, 80)}`, reversalMirror: mirror(jeOf('payment', pid)[0], rev) };
});
// K3-005 / K3-006
await scenario('K3-005/006', 'create 3 purchases, delete middle, create next (numbering) + JE of deleted purchase', async () => {
  const mk = () => a.post('/purchases', { supplierId: s1, lines: [{ itemId: I[2], weightGrams: 1000, pricePerKg: 1000 }] });
  const p = [await mk(), await mk(), await mk()]; const del = await a.del(`/purchases/${p[1].data.id}`);
  const n1 = await mk(); const n2 = await mk();
  return { created: p.map((x) => x.data?.purchaseNumber), delete: del.status, jeLeftForDeleted: jeOf('purchase', p[1].data.id).length, next: `${n1.status} ${n1.data?.purchaseNumber ?? err(n1).slice(0, 80)}`, next2: `${n2.status} ${n2.data?.purchaseNumber ?? err(n2).slice(0, 60)}` };
});
// K3-008
await scenario('K3-008', 'sale with 2 lines same item exceeding stock (item C has ~102kg; sell 60kg+60kg)', async () => {
  const q0 = E.q(`select current_quantity_grams q from inventory where item_id=?`, I[2])[0].q;
  const r = await a.post('/sales', { saleType: 'cash', lines: [{ itemId: I[2], weightGrams: 60000, pricePerKg: 4000 }, { itemId: I[2], weightGrams: 60000, pricePerKg: 4000 }], payments: [{ amount: 480000, paymentMethod: 'cash' }] });
  return { before: q0, status: r.status, err: err(r).slice(0, 100), after: E.q(`select current_quantity_grams q from inventory where item_id=?`, I[2])[0].q, lots: E.q(`select id, remaining_quantity_grams r from inventory_lots where item_id=?`, I[2]) };
});
// K3-009
await scenario('K3-009', 'adjustment decrease 2kg item B (expect lots -2kg, value at FIFO lot cost)', async () => { const r = await a.post('/inventory/adjustments', { itemId: I[1], adjustmentType: 'decrease', quantityGrams: 2000, reason: 't1' }); return { status: r.status }; });
// K3-011 (re-check)
await scenario('K3-011', 'expense 10.00 bank_transfer (expect 1112-001 -10)', async () => { const r = await a.post('/expenses', { categoryId: 9, description: 'bank exp', amount: 1000, paymentMethod: 'bank_transfer', bankAccountId: bankId }); return { status: r.status, err: err(r).slice(0, 120) }; });
// K2-001 / K3-014
await scenario('K2-001', 'credit sale 50.00 then debt write-off (expect AR -50, bad-debt expense +50)', async () => {
  const s = (await a.post('/sales', { saleType: 'credit', customerId: c1, lines: [{ itemId: I[1], weightGrams: 1250, pricePerKg: 4000 }] })).data;
  const b = E.snap(); const d = E.q(`select id from debts where source_type='sale' and source_id=?`, s.id)[0]; const w = await a.post(`/debts/${d.id}/write-off`, { reason: 't1' }); const dd = diff(b, E.snap());
  return { writeOff: w.status, deltaOfWriteOffOnly: { gl: dd.accounts, metrics: dd.metrics } };
});
// Reversal mirror: void cash sale with discount, void partially-paid sale (paid at creation)
await scenario('VOID-disc', 'cash sale 2.5kg@40 with 5.00 discount -> void (expect exact mirror, net 0)', async () => {
  const s = (await a.post('/sales', { saleType: 'cash', discountAmount: 500, lines: [{ itemId: I[0], weightGrams: 2500, pricePerKg: 4000 }], payments: [{ amount: 9500, paymentMethod: 'cash' }] })).data;
  const v = await a.post(`/sales/${s.id}/void`, { reason: 't1' }); return { void: v.status, mirror: mirror(jeOf('sale', s.id)[0], jeOf('sale_void', s.id)[0]) };
});
await scenario('VOID-partial', 'partial sale 100.00 paid 30 at creation (customer) -> /payments/sale 20 -> cancel that payment -> void', async () => {
  const s = (await a.post('/sales', { saleType: 'cash', customerId: c2, lines: [{ itemId: I[0], weightGrams: 2500, pricePerKg: 4000 }], payments: [{ amount: 3000, paymentMethod: 'cash' }] })).data;
  const p = (await a.post('/payments/sale', { saleId: s.id, amount: 2000, paymentMethod: 'bank_transfer', bankAccountId: bankId })).data;
  const c = await a.post(`/payments/${p.id}/cancel`, { reason: 't1' });
  const embedded = E.q(`select id from payments where reference_type='sale' and reference_id=? order by id limit 1`, s.id)[0].id;
  const ce = await a.post(`/payments/${embedded}/cancel`, { reason: 'embedded' });
  const v = await a.post(`/sales/${s.id}/void`, { reason: 't1' });
  return { cancelLater: c.status, cancelEmbedded: `${ce.status} ${err(ce).slice(0, 80)}`, void: v.status, mirror: mirror(jeOf('sale', s.id)[0], jeOf('sale_void', s.id)[0]) };
});
await scenario('VOID-bank', 'bank sale 100.00 (bank) -> void (refund must leave bank, not cash)', async () => {
  const s = (await a.post('/sales', { saleType: 'cash', lines: [{ itemId: I[0], weightGrams: 2500, pricePerKg: 4000 }], payments: [{ amount: 10000, paymentMethod: 'card', bankAccountId: bankId }] })).data;
  const v = await a.post(`/sales/${s.id}/void`, { reason: 't1' }); return { void: v.status, mirror: mirror(jeOf('sale', s.id)[0], jeOf('sale_void', s.id)[0]) };
});
await scenario('VOID-cn', 'credit sale 100 -> credit note 40 submitted -> void sale', async () => {
  const s = (await a.post('/sales', { saleType: 'credit', customerId: c1, lines: [{ itemId: I[1], weightGrams: 2500, pricePerKg: 4000 }] })).data;
  const cn = await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: s.id, amount: 4000, reason: 't1' });
  const sub = await a.post(`/credit-notes/${cn.data.id}/submit`); const v = await a.post(`/sales/${s.id}/void`, { reason: 'after cn' });
  return { cn: cn.status, submit: sub.status, void: `${v.status} ${err(v).slice(0, 80)}`, customerBalance: E.q(`select current_balance b from customers where id=?`, c1)[0].b };
});
log('\n#### invariants after scenarios');
for (const c of E.checks()) if (c.status !== 'PASS') log(`[${c.status}] ${c.id}`, JSON.stringify({ e: c.expected, a: c.actual, d: c.diff, det: c.details }).slice(0, 600));
fs.writeFileSync(new URL('./05-reversals-crossval.out.txt', import.meta.url), lines.join('\n'));
