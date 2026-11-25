// T4-07: (a) K4-013 "pay full" float vs per-line rounding, reproduced with the exact numbers the UI would send;
// (b) supplier views: /debts/payables, /reconciliation/outstanding/party, supplier advance + allocation, PDFs. Fresh t4b (after 06c).
import { login, snapshot, delta, makeLog, short, fund, q, q1, QA } from './lib.mjs';
const log = makeLog(`${QA}/tests/T4/07-rounding-supplier-views.out.txt`);
const c = await login('t4b');
const DB = c.meta.db;
await fund(c, DB, 500000);
const ui = (kgs, priceMajor) => { // replicate PurchaseProfile.tsx:117-131,182-183,196,539
  const subtotalMajor = kgs.reduce((s, w) => s + w * priceMajor, 0);
  return { lines: kgs.map((w) => ({ itemId: 3, weightGrams: Math.round(w * 1000), pricePerKg: Math.round(priceMajor * 100) })), amountPaid: Math.round(subtotalMajor * 100), shown: subtotalMajor.toFixed(2) };
};
log('# T4-07', new Date().toISOString());
for (const [label, kgs, p] of [['3 × 0.334 kg @ ₪1.00', [0.334, 0.334, 0.334], 1], ['3 × 0.335 kg @ ₪1.00', [0.335, 0.335, 0.335], 1], ['2 × 1.255 kg @ ₪19.99', [1.255, 1.255], 19.99]]) {
  const u = ui(kgs, p);
  const r = await c.post('/purchases', { supplierId: 1, lines: u.lines, amountPaid: u.amountPaid, paymentMethod: 'cash' });
  log(`\nK4-013 ${label}: UI shows ₪${u.shown}, "pay full" sends amountPaid=${u.amountPaid}; backend:`, short(r), r.ok ? `grandTotal=${r.data.grandTotal} status=${r.data.paymentStatus} due=${r.data.grandTotal - r.data.amountPaid}` : '');
}

// supplier views
const P = (await c.post('/purchases', { supplierId: 2, lines: [{ itemId: 4, weightGrams: 10000, pricePerKg: 3000 }], taxAmount: 4500 })).data; // 300 + 45
await c.post('/payments/purchase', { purchaseId: P.id, amount: 10000, paymentMethod: 'cash' });
const adv = await c.post('/payments/advance', { partyType: 'supplier', partyId: 2, amount: 5000, paymentMethod: 'cash' });
log('\nsupplier 2: purchase 345.00 (tax 45.00), paid 100.00, advance 50.00 →', short(adv));
const S = snapshot(DB);
const views = async () => ({
  supplierCurrentBalance: q1(DB, 'select current_balance b from suppliers where id=2').b,
  debtsPayables: (await c.get('/debts/payables?supplierId=2')).data,
  outstandingParty: (await c.get('/reconciliation/outstanding/party?partyType=supplier&partyId=2')).data,
  openInvoices: (await c.get('/reconciliation/open-invoices?partyType=supplier&partyId=2')).data,
  unallocated: (await c.get('/reconciliation/unallocated-payments?partyType=supplier&partyId=2')).data,
  glAP_total: snapshot(DB).gl['2110'],
});
const v1 = await views();
log('views before allocation:', JSON.stringify(v1).slice(0, 1500));
const ap = await c.post('/reconciliation/apply', { partyType: 'supplier', partyId: 2, allocations: [{ paymentId: adv.data.id, invoiceType: 'purchase', invoiceId: P.id, amount: 5000 }] });
log('\nPOST /reconciliation/apply advance→purchase 50.00:', short(ap), JSON.stringify(ap.body).slice(0, 300));
log('after allocation: purchase', q1(DB, 'select amount_paid, payment_status from purchases where id=?', P.id), ' debt', q(DB, "select total_amount, amount_paid, status from debts where source_type='purchase' and source_id=?", P.id));
const v2 = await views();
log('views after allocation:', JSON.stringify(v2).slice(0, 1500));
const pay = await c.post('/payments/purchase', { purchaseId: P.id, amount: 24500, paymentMethod: 'cash' });
log('\npay remaining per purchase (245.00) after allocating advance 50.00:', short(pay), ' PLE outstanding for purchase:', q1(DB, "select coalesce(sum(amount),0) s from payment_ledger_entries where delinked=0 and ((voucher_type='purchase' and voucher_id=?) or (against_voucher_type='purchase' and against_voucher_id=?))", P.id, P.id).s, ' supplier PLE total', q1(DB, "select sum(amount) s from payment_ledger_entries where party_type='supplier' and party_id=2 and delinked=0").s);

// PDFs
for (const path of [`/purchases/${P.id}/pdf?language=ar`, `/suppliers/2/statement/pdf?language=ar`, '/debts/payables/pdf?language=ar', '/purchases/report/pdf?language=ar']) {
  const r = await c.raw('GET', path, { raw: true });
  const buf = Buffer.from(await r.arrayBuffer());
  log(`PDF ${path}: HTTP ${r.status} ${r.headers.get('content-type')} ${buf.length} bytes, header ${buf.slice(0, 5).toString()}`);
}
log('\nsupplier list currentBalance (GET /suppliers):', JSON.stringify(((await c.get('/suppliers')).data?.items ?? (await c.get('/suppliers')).data)?.map?.((s) => ({ id: s.id, bal: s.currentBalance }))));
log.save();
