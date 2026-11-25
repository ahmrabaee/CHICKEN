// T4-01: cross-validate K3-004 (purchase tax), K3-007 (supplier balance), payment cancel/re-pay, paid-at-creation lock, edit.
// Run on fresh dev instance t4a (port 3107).
import { login, snapshot, delta, makeLog, short, fund, q, q1, QA } from './lib.mjs';
const log = makeLog(`${QA}/tests/T4/01-purchase-xval.out.txt`);
const c = await login('t4a');
const DB = c.meta.db;
let s0 = snapshot(DB);
const step = async (label, fn) => {
  const before = snapshot(DB);
  const r = await fn();
  const after = snapshot(DB);
  log(`\n## ${label}`);
  log('  resp:', short(r), r.ok && r.data?.id ? `id=${r.data.id} number=${r.data.purchaseNumber ?? r.data.paymentNumber ?? ''}` : '');
  log('  delta:', delta(before, after));
  return r;
};
const sup = (id) => q1(DB, 'select current_balance b from suppliers where id=?', id).b;
const view = (pid) => {
  const p = q1(DB, 'select id,purchase_number,grand_total,net_total,tax_amount,amount_paid,payment_status from purchases where id=?', pid);
  const d = q(DB, "select total_amount,amount_paid,status from debts where source_type='purchase' and source_id=?", pid);
  const ple = q1(DB, "select coalesce(sum(amount),0) s from payment_ledger_entries where delinked=0 and ((voucher_type='purchase' and voucher_id=?) or (against_voucher_type='purchase' and against_voucher_id=?))", pid, pid).s;
  const je = q(DB, `select j.id, j.entry_number, j.source_type, a.code, l.debit_amount d, l.credit_amount c from journal_entries j join journal_entry_lines l on l.journal_entry_id=j.id join accounts a on a.id=l.account_id where j.source_type='purchase' and j.source_id=? order by j.id, l.line_number`, pid);
  const pays = q(DB, "select id,payment_number,amount,payment_method,bank_account_id,docstatus from payments where reference_type='purchase' and reference_id=?", pid);
  return { p, debts: d, pleOutstanding: ple, je: je.map((x) => `${x.entry_number}:${x.code} D${x.d} C${x.c}`), pays };
};

log('# T4-01 purchase cross-validation', new Date().toISOString());
await fund(c, DB, 1000000); // 10,000.00 cash
log('funded cash 1111 = ', snapshot(DB).gl['1111']);

// 1. credit purchase with tax
const p1 = await step('1. credit purchase item2 10kg@20.00 + tax 30.00 (grand 230.00)', () =>
  c.post('/purchases', { supplierId: 1, lines: [{ itemId: 2, weightGrams: 10000, pricePerKg: 2000 }], taxAmount: 3000, amountPaid: 0, paymentMethod: 'cash' }));
const P1 = p1.data.id;
log('  view:', view(P1), 'supplier1 bal', sup(1));

// 2. fully paid taxed purchase
await step('2. fully-paid taxed purchase (230.00 cash)', () =>
  c.post('/purchases', { supplierId: 1, lines: [{ itemId: 2, weightGrams: 10000, pricePerKg: 2000 }], taxAmount: 3000, amountPaid: 23000, paymentMethod: 'cash' }));

// 2b. paid exactly net (200.00) with tax 30 -> due 30 in subledger, 0 in GL
const p2b = await step('2b. taxed purchase paid net 200.00 (grand 230.00)', () =>
  c.post('/purchases', { supplierId: 1, lines: [{ itemId: 2, weightGrams: 10000, pricePerKg: 2000 }], taxAmount: 3000, amountPaid: 20000, paymentMethod: 'cash' }));
if (p2b.ok) log('  view:', view(p2b.data.id));

// 3. partial at creation
const p3 = await step('3. taxed purchase partially paid 100.00 cash at creation', () =>
  c.post('/purchases', { supplierId: 1, lines: [{ itemId: 3, weightGrams: 10000, pricePerKg: 2000 }], taxAmount: 3000, amountPaid: 10000, paymentMethod: 'cash' }));
const P3 = p3.data.id;
log('  view:', view(P3));

// 4. pay P1 100.00 via /payments/purchase
const pay4 = await step('4. POST /payments/purchase P1 100.00 cash', () => c.post('/payments/purchase', { purchaseId: P1, amount: 10000, paymentMethod: 'cash' }));
log('  view:', view(P1), 'supplier1 bal', sup(1));

// 5. pay remainder 130.00
const pay5 = await step('5. POST /payments/purchase P1 130.00 cash (settles)', () => c.post('/payments/purchase', { purchaseId: P1, amount: 13000, paymentMethod: 'cash' }));
log('  view:', view(P1), 'supplier1 bal', sup(1));
log('  GL AP 2110 now:', snapshot(DB).gl['2110']);

// 5b. overpay by 1 agora
await step('5b. overpay P1 by 0.01', () => c.post('/payments/purchase', { purchaseId: P1, amount: 1, paymentMethod: 'cash' }));

// 6. cancel payment 4
await step('6. cancel payment step4', () => c.post(`/payments/${pay4.data.id}/cancel`, { reason: 'qa cancel' }));
log('  view:', view(P1), 'supplier1 bal', sup(1));
// 6b. cancel again
await step('6b. cancel payment step4 again', () => c.post(`/payments/${pay4.data.id}/cancel`, { reason: 'qa cancel twice' }));
// 7. re-pay 100
await step('7. re-pay P1 100.00', () => c.post('/payments/purchase', { purchaseId: P1, amount: 10000, paymentMethod: 'cash' }));
log('  view:', view(P1), 'supplier1 bal', sup(1));

// 8. paid-at-creation payment of P3: cancel it
const p3pay = view(P3).pays[0];
await step(`8. cancel creation-time payment ${p3pay?.payment_number} of P3`, () => c.post(`/payments/${p3pay.id}/cancel`, { reason: 'qa' }));
await step('8b. edit P3 (no payment change)', () => c.put(`/purchases/${P3}`, { notes: 'edit try' }));
await step('8c. delete P3', () => c.del(`/purchases/${P3}`));

// 9. edit unpaid purchase P6 -> lines change
const p6 = await step('9a. credit purchase P6 item4 5kg@30.00, no tax', () =>
  c.post('/purchases', { supplierId: 2, lines: [{ itemId: 4, weightGrams: 5000, pricePerKg: 3000 }], amountPaid: 0 }));
const P6 = p6.data.id;
const je6before = view(P6).je;
await step('9b. PUT P6 change to 8kg@30.00, amountPaid 0', () => c.put(`/purchases/${P6}`, { lines: [{ itemId: 4, weightGrams: 8000, pricePerKg: 3000 }], amountPaid: 0 }));
log('  JE before edit:', je6before, ' after:', view(P6).je, ' supplier2 bal', sup(2));
log('  audit rows for purchase', q(DB, "select entity_type, action from audit_logs where entity_type like '%urchase%'"));
await step('9c. PUT P6 with amountPaid 100.00 (edit-with-payment)', () => c.put(`/purchases/${P6}`, { amountPaid: 10000, paymentMethod: 'cash' }));
// partial pay P6 then edit
const pay9 = await step('9d. pay P6 50.00', () => c.post('/payments/purchase', { purchaseId: P6, amount: 5000, paymentMethod: 'cash' }));
await step('9e. PUT P6 after payment', () => c.put(`/purchases/${P6}`, { lines: [{ itemId: 4, weightGrams: 9000, pricePerKg: 3000 }], amountPaid: 0 }));
await step('9f. cancel 9d payment then edit', () => c.post(`/payments/${pay9.data.id}/cancel`, { reason: 'qa' }));
await step('9g. PUT P6 after cancel (8kg->9kg)', () => c.put(`/purchases/${P6}`, { lines: [{ itemId: 4, weightGrams: 9000, pricePerKg: 3000 }], amountPaid: 0 }));
log('  view P6:', view(P6), 'supplier2 bal', sup(2));

// Final reconciliation
const S = snapshot(DB);
const debtsBySup = q(DB, "select party_id, sum(total_amount-amount_paid) o from debts where direction='payable' and status!='written_off' group by party_id");
const pleBySup = q(DB, "select party_id, sum(amount) a from payment_ledger_entries where party_type='supplier' and delinked=0 group by party_id");
log('\n## FINAL reconciliation (AP views)');
log('  GL 2110 balance (debit-credit):', S.gl['2110'], '=> AP owed per GL', -(S.gl['2110'] ?? 0));
log('  suppliers.current_balance:', S.suppliers, ' sum', Object.values(S.suppliers).reduce((a, b) => a + b, 0));
log('  debts outstanding by supplier:', debtsBySup);
log('  PLE sum by supplier (neg=owed):', pleBySup);
log('  TB balanced:', S.tb, ' cash 1111', S.gl['1111']);
log.save();
