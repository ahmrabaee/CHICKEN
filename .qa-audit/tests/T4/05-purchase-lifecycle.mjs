// T4-05: purchase validation, receive, purchase-by-category, delete-after-use, purchase "return" via credit note, numbering after delete.
// t4b after 04 (deltas only).
import { login, snapshot, delta, makeLog, short, fund, q, q1, QA } from './lib.mjs';
const log = makeLog(`${QA}/tests/T4/05-purchase-lifecycle.out.txt`);
const c = await login('t4b');
const DB = c.meta.db;
const step = async (label, fn) => {
  const b = snapshot(DB); const r = await fn(); const d = delta(b, snapshot(DB));
  log(`\n## ${label}`); log('  resp:', short(r), r.ok && r.data?.id ? `id=${r.data.id} ${r.data.purchaseNumber ?? ''} grand=${r.data.grandTotal ?? ''} status=${r.data.paymentStatus ?? ''}` : '');
  log('  Δ:', JSON.stringify({ gl: d.gl, sup: d.suppliers, debt: d.payDebt, ple: d.plePay, inv: d.inv, lots: d.lots, je: d.je })); return r;
};
await fund(c, DB, 1000000);
log('# T4-05', new Date().toISOString());
const L = (itemId, g, p) => ({ itemId, weightGrams: g, pricePerKg: p });

await step('V1. negative weight line -5kg @20.00', () => c.post('/purchases', { supplierId: 1, lines: [L(2, -5000, 2000)] }));
await step('V2. negative price line 5kg @ -20.00', () => c.post('/purchases', { supplierId: 1, lines: [L(2, 5000, -2000)] }));
await step('V3. zero price line 5kg @0', () => c.post('/purchases', { supplierId: 1, lines: [L(2, 5000, 0)] }));
await step('V4. empty lines []', () => c.post('/purchases', { supplierId: 1, lines: [] }));
await step('V5. overpaid at creation (paid 150.00 of 100.00, no tax)', () => c.post('/purchases', { supplierId: 1, lines: [L(2, 5000, 2000)], amountPaid: 15000, paymentMethod: 'cash' }));
await step('V6. negative amountPaid -50.00', () => c.post('/purchases', { supplierId: 1, lines: [L(2, 5000, 2000)], amountPaid: -5000, paymentMethod: 'cash' }));
await step('V7. line with non-existent item 999 + valid line', () => c.post('/purchases', { supplierId: 1, lines: [L(999, 5000, 2000), L(2, 5000, 2000)] }));
const v7 = q1(DB, 'select id, grand_total, net_total from purchases order by id desc limit 1');
log('  last purchase', v7, ' JE', q(DB, "select a.code,l.debit_amount d,l.credit_amount c from journal_entries j join journal_entry_lines l on l.journal_entry_id=j.id join accounts a on a.id=l.account_id where j.source_type='purchase' and j.source_id=?", v7.id));
await step('V8. negative taxAmount -10.00', () => c.post('/purchases', { supplierId: 1, lines: [L(2, 5000, 2000)], taxAmount: -1000 }));
await step('V9. fractional grams 1234.5 @ 19.99/kg', () => c.post('/purchases', { supplierId: 1, lines: [L(2, 1234.5, 1999)] }));
log('  stored line:', q1(DB, 'select weight_grams, line_total_amount from purchase_lines order by id desc limit 1'));
await c.put('/suppliers/2', { isActive: false });
await step('V10. purchase from INACTIVE supplier 2', () => c.post('/purchases', { supplierId: 2, lines: [L(2, 1000, 2000)] }));
await c.put('/suppliers/2', { isActive: true });
await step('V11. huge purchase 1,000,000 kg @ 99,999.99', () => c.post('/purchases', { supplierId: 1, lines: [L(2, 1e9, 9999999)] }));
await step('V12. branchId in body (not in DTO)', () => c.post('/purchases', { supplierId: 1, branchId: 1, lines: [L(2, 1000, 2000)] }));
log('  branch_id of purchases/lots/JE created so far:', q(DB, "select (select count(*) from purchases where branch_id is null and purchase_number not like '%SEED%') pNull, (select count(*) from inventory_lots where branch_id is null) lotNull"));

// purchase by category
const pc = await c.get('/categories/purchaseable');
log('\nGET /categories/purchaseable:', short(pc), (pc.data || []).map((x) => `${x.code}->item${x.purchaseItemId}`));
const raw = await step('C1. buy raw chicken (category CHICKEN_RAW -> item 1) 20kg @ 12.00', () => c.post('/purchases', { supplierId: 1, lines: [L(1, 20000, 1200)] }));
log('  inventory item1:', q(DB, 'select item_id, branch_id, current_quantity_grams q, total_value v, average_cost from inventory where item_id=1'));
await step('C2. live bird line isLiveBird=true 30kg @ 10.00', () => c.post('/purchases', { supplierId: 1, lines: [{ ...L(1, 30000, 1000), isLiveBird: true }] }));

// receive endpoint
await step('R1. PUT /purchases/:id/receive on API-created purchase', () => c.put(`/purchases/${raw.data.id}/receive`, { lines: [{ purchaseLineId: raw.data.purchaseLines[0].id, receivedWeightGrams: 10000 }] }));

// delete after stock used (adjustment without lotId does not count as usage)
const pA = await step('U1. purchase item 6 (seed stock 50kg) 10kg @ 30.00 credit', () => c.post('/purchases', { supplierId: 1, lines: [L(6, 10000, 3000)] }));
await step('U2. adjustment decrease item 6 55kg (no lotId)', () => c.post('/inventory/adjustments', { itemId: 6, adjustmentType: 'decrease', quantityGrams: 55000, reason: 'qa' }));
log('  inv item6:', q(DB, 'select current_quantity_grams q,total_value v from inventory where item_id=6'), ' lots item6', q(DB, 'select id,remaining_quantity_grams r,unit_purchase_price u,purchase_id from inventory_lots where item_id=6'));
await step('U3. DELETE purchase after its quantity was adjusted away', () => c.del(`/purchases/${pA.data.id}`));
log('  inv item6 after delete:', q(DB, 'select current_quantity_grams q,total_value v from inventory where item_id=6'), ' lots', q(DB, 'select id,remaining_quantity_grams r from inventory_lots where item_id=6'));
const pW = await step('U4. purchase item 5 10kg @ 25.00', () => c.post('/purchases', { supplierId: 1, lines: [L(5, 10000, 2500)] }));
const lotW = q1(DB, 'select id from inventory_lots where purchase_id=?', pW.data.id).id;
await step('U5. wastage 1kg from that lot', () => c.post('/wastage', { lotId: lotW, quantityGrams: 1000, reason: 'spoilage' }));
await step('U6. DELETE purchase after wastage', () => c.del(`/purchases/${pW.data.id}`));

// purchase return via credit note
const pR = await step('PR1. credit purchase item 4 10kg @ 20.00 (200.00)', () => c.post('/purchases', { supplierId: 1, lines: [L(4, 10000, 2000)] }));
const cn = await c.post('/credit-notes', { originalInvoiceType: 'purchase', originalInvoiceId: pR.data.id, amount: 5000, reason: 'returned 2.5kg' });
log('\nPR2. create purchase credit note 50.00:', short(cn), cn.data?.id);
await step('PR3. submit credit note', () => c.post(`/credit-notes/${cn.data.id}/submit`));
log('  purchase after CN:', q1(DB, 'select amount_paid, payment_status from purchases where id=?', pR.data.id), ' debt', q(DB, "select total_amount,amount_paid,status from debts where source_type='purchase' and source_id=?", pR.data.id), ' lot remaining', q(DB, 'select remaining_quantity_grams from inventory_lots where purchase_id=?', pR.data.id));
await step('PR4. pay remaining as per debt (200.00) after CN 50.00', () => c.post('/payments/purchase', { purchaseId: pR.data.id, amount: 20000, paymentMethod: 'cash' }));
log('  PLE outstanding for purchase:', q1(DB, "select coalesce(sum(amount),0) s from payment_ledger_entries where delinked=0 and ((voucher_type='purchase' and voucher_id=?) or (against_voucher_type='purchase' and against_voucher_id=?))", pR.data.id, pR.data.id).s);
const ret = await c.post(`/purchases/${pR.data.id}/return`, {});
log('PR5. POST /purchases/:id/return →', short(ret));

// numbering after delete (K3-005)
const n1 = await step('N1. purchase A', () => c.post('/purchases', { supplierId: 1, lines: [L(3, 1000, 2000)] }));
const n2 = await step('N2. purchase B', () => c.post('/purchases', { supplierId: 1, lines: [L(3, 1000, 2000)] }));
await step('N3. delete A (non-last)', () => c.del(`/purchases/${n1.data.id}`));
await step('N4. create purchase after delete', () => c.post('/purchases', { supplierId: 1, lines: [L(3, 1000, 2000)] }));
await step('N5. retry', () => c.post('/purchases', { supplierId: 1, lines: [L(3, 1000, 2000)] }));
const st = await c.post('/stock-transfer', { sourceLotId: q1(DB, 'select id from inventory_lots where item_id=1 and remaining_quantity_grams>0 limit 1').id, lines: [{ itemId: 3, weightGrams: 1000, unitCost: 1200 }] });
log('N6. stock transfer after purchase delete (lot numbering):', short(st));
log('  purchase numbers:', q(DB, 'select purchase_number from purchases order by id desc limit 4').map((r) => r.purchase_number));
log.save();
