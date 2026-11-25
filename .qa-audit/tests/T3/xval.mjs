// T3 cross-validation of prior leads (K3-001/002/003/013/014, K2-001, K3-021, K3-022, F-13, D-12/F-09, F-08, F-12/D-23, void rules)
// usage: node xval.mjs   (instance t3 on 3105, fresh dev DB)
import { connect, BASE, q, q1, gl, diff, custView, apiCustView, log, short, setup, restock, save } from './lib.mjs';

const a = await connect(BASE, 'admin', 'admin123');
const { bankId, acc } = await setup(a);
log('setup bankId', bankId);
for (const [it, p] of [[2, 1800], [3, 2800], [4, 2200], [5, 2000], [6, 2400]]) {
  const r = await restock(a, it, 200000, p);
  log(`restock item${it} 200kg credit purchase`, short(r));
}
const sale = (b) => a.post('/sales', b);
const L = (itemId, g, p) => ({ itemId, weightGrams: g, pricePerKg: p });

// ---------- K3-001 (void after /payments/sale) ----------
{
  const g0 = gl(); const c0 = custView(1);
  const s = await sale({ saleType: 'credit', customerId: 1, lines: [L(3, 2000, 5000)] });
  const p = await a.post('/payments/sale', { saleId: s.data.id, amount: 4000, paymentMethod: 'cash' });
  const v = await a.post(`/sales/${s.data.id}/void`, { reason: 't3 xval' });
  log('K3-001 credit 10000 + pay 4000 cash + void', `${short(s)} ${short(p)} ${short(v)}`);
  log('  GL net delta (expect {})', diff(g0, gl()));
  log('  customer1 views delta', { before: c0, after: custView(1) });
}
// K3-001 variant: payment by BANK after a cash-default credit sale, then void
{
  const g0 = gl();
  const s = await sale({ saleType: 'credit', customerId: 1, lines: [L(3, 2000, 5000)] });
  const p = await a.post('/payments/sale', { saleId: s.data.id, amount: 4000, paymentMethod: 'bank_transfer', bankAccountId: bankId });
  const v = await a.post(`/sales/${s.data.id}/void`, { reason: 't3 xval bank' });
  log('K3-001b credit 10000 + pay 4000 BANK + void', `${short(s)} ${short(p)} ${short(v)}`);
  log('  GL net delta (expect {})', diff(g0, gl()));
}

// ---------- K3-002 (/sales/:id/payments no JE) ----------
{
  const s = await sale({ saleType: 'credit', customerId: 2, lines: [L(3, 2000, 5000)] });
  const g0 = gl();
  const p = await a.post(`/sales/${s.data.id}/payments`, { amount: 3000, paymentMethod: 'cash' });
  const pay = q1(`select id from payments where reference_type='sale' and reference_id=? order by id desc limit 1`, s.data.id);
  log('K3-002 /sales/:id/payments 3000', short(p));
  log('  GL delta (expect cash +3000, AR -3000)', diff(g0, gl()));
  log('  JE for payment', q1(`select count(*) n from journal_entries where source_type='payment' and source_id=?`, pay.id));
  log('  by ACCOUNTANT too?', short(await acc.post(`/sales/${s.data.id}/payments`, { amount: 100, paymentMethod: 'cash' })));
  const c = await a.post(`/payments/${pay.id}/cancel`, { reason: 't3' });
  log('  cancel that payment', short(c));
  // bank method on /sales/:id/payments: bankAccountId not in DTO
  const pb = await a.post(`/sales/${s.data.id}/payments`, { amount: 100, paymentMethod: 'bank_transfer', bankAccountId: bankId });
  log('  /sales/:id/payments bank_transfer+bankAccountId', short(pb));
}

// ---------- K3-003 mixed tender ----------
{
  const g0 = gl();
  const s = await sale({ saleType: 'cash', lines: [L(4, 2000, 5000)], payments: [{ amount: 5000, paymentMethod: 'cash' }, { amount: 5000, paymentMethod: 'bank_transfer', bankAccountId: bankId }] });
  log('K3-003 mixed cash5000+bank5000', short(s));
  log('  GL delta (expect 1111 +5000, 1112-001 +5000)', diff(g0, gl()));
  const g1 = gl();
  const v = await a.post(`/sales/${s.data.id}/void`, { reason: 't3' });
  log('  void mixed sale', short(v));
  log('  GL delta of void', diff(g1, gl()));
  // reverse order: bank first then cash
  const g2 = gl();
  const s2 = await sale({ saleType: 'cash', lines: [L(4, 2000, 5000)], payments: [{ amount: 5000, paymentMethod: 'bank_transfer', bankAccountId: bankId }, { amount: 5000, paymentMethod: 'cash' }] });
  log('K3-003b bank first then cash', short(s2));
  log('  GL delta (expect 1111 +5000, 1112-001 +5000)', diff(g2, gl()));
}

// ---------- F-13 POS bank / card payment ----------
{
  for (const m of ['card', 'bank_transfer']) {
    const g0 = gl();
    const s = await sale({ saleType: 'cash', lines: [L(5, 1000, 4000)], payments: [{ amount: 4000, paymentMethod: m, bankAccountId: bankId }] });
    log(`F-13 POS ${m} with bankAccountId`, short(s));
    log('  GL delta (expect 1112-001 +4000)', diff(g0, gl()));
  }
  const g0 = gl();
  const s = await sale({ saleType: 'cash', lines: [L(5, 1000, 4000)], payments: [{ amount: 4000, paymentMethod: 'card' }] });
  log('F-13 POS card WITHOUT bankAccountId (bank exists, default)', short(s));
  log('  GL delta', diff(g0, gl()));
  for (const m of ['check', 'mobile']) {
    const g = gl();
    const r = await sale({ saleType: 'cash', lines: [L(5, 1000, 4000)], payments: [{ amount: 4000, paymentMethod: m }] });
    log(`D-15 POS ${m}`, short(r));
    log('  GL delta', diff(g, gl()));
  }
  const bad = await sale({ saleType: 'cash', lines: [L(5, 1000, 4000)], payments: [{ amount: 4000, paymentMethod: 'bank_transfer', bankAccountId: 999 }] });
  log('POS bank_transfer bankAccountId=999 (nonexistent)', short(bad));
  const cashWithBank = await sale({ saleType: 'cash', lines: [L(5, 1000, 4000)], payments: [{ amount: 4000, paymentMethod: 'cash', bankAccountId: bankId }] });
  log('POS cash with bankAccountId set', `${short(cashWithBank)} sale.bank_account_id=${q1('select bank_account_id b from sales where id=?', cashWithBank.data?.id)?.b}`);
}

// ---------- K3-013 payment on voided sale; payment after write-off ----------
{
  const s = await sale({ saleType: 'credit', customerId: 3, lines: [L(6, 1000, 5000)] });
  await a.post(`/sales/${s.data.id}/void`, { reason: 't3' });
  const g0 = gl(); const c0 = custView(3);
  const p = await a.post('/payments/sale', { saleId: s.data.id, amount: 1000, paymentMethod: 'cash' });
  log('K3-013 /payments/sale on VOIDED sale', short(p));
  log('  GL delta', diff(g0, gl()));
  log('  cust3', { before: c0, after: custView(3) });
  const p2 = await a.post(`/sales/${s.data.id}/payments`, { amount: 1000, paymentMethod: 'cash' });
  log('  /sales/:id/payments on VOIDED sale', short(p2));
  log('  debt row after', q1(`select total_amount,amount_paid,status from debts where source_type='sale' and source_id=?`, s.data.id));
}

// ---------- K2-001 / K3-014 write-off ----------
{
  const s = await sale({ saleType: 'credit', customerId: 3, lines: [L(6, 1000, 5000)] });
  const debt = q1(`select id from debts where source_type='sale' and source_id=?`, s.data.id);
  const g0 = gl(); const c0 = custView(3); const api0 = await apiCustView(a, 3);
  const r = await a.post(`/debts/${debt.id}/write-off`, { reason: 't3' });
  log('K2-001 write-off 5000', short(r));
  log('  GL delta (expect AR -5000, bad-debt +5000)', diff(g0, gl()));
  log('  cust3 db views', { before: c0, after: custView(3) });
  log('  cust3 api views', { before: api0, after: await apiCustView(a, 3) });
  log('  sale outstanding (reconciliation)', (await a.get(`/reconciliation/outstanding/sale/${s.data.id}`)).data);
  log('  sale paymentStatus', q1('select payment_status, amount_paid from sales where id=?', s.data.id));
  const r2 = await acc.post(`/debts/${debt.id}/write-off`, { reason: 'again' });
  log('  write-off twice (accountant)', short(r2));
  // pay after write-off
  const p = await a.post('/payments/sale', { saleId: s.data.id, amount: 2000, paymentMethod: 'cash' });
  log('  pay 2000 after write-off', short(p));
  log('  cust3 db views after pay', custView(3));
  log('  debt row', q1(`select total_amount,amount_paid,status from debts where id=?`, debt.id));
}

// ---------- K3-021: tax engine OFF, sale with tax template ----------
{
  const g0 = gl();
  const s = await sale({ saleType: 'cash', taxTemplateId: 1, lines: [L(2, 1000, 10000)], payments: [{ amount: 11500, paymentMethod: 'cash' }] });
  log('K3-021 sale 10000 + VAT15% (engines OFF)', `${short(s)} total=${s.data?.totalAmount} tax=${s.data?.taxAmount} profit=${s.data?.totalProfit} cost=${s.data?.totalCost}`);
  log('  GL delta (expect 4110 -10000, 2120 -1500)', diff(g0, gl()));
}

// ---------- K3-022 credit note on credit sale ----------
{
  const s = await sale({ saleType: 'credit', customerId: 2, lines: [L(2, 5000, 2000)] });
  const inv0 = q1('select current_quantity_grams q,total_value v from inventory where item_id=2');
  const g0 = gl(); const c0 = custView(2); const api0 = await apiCustView(a, 2);
  const cn = await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: s.data.id, amount: 4000, reason: 'return 2kg' });
  const sub = await a.post(`/credit-notes/${cn.data?.id}/submit`, {});
  log('K3-022 CN 4000 on credit sale 10000', `${short(cn)} ${short(sub)}`);
  log('  GL delta (expect 4110 +4000 [or 4900], AR -4000; COGS/stock if goods returned)', diff(g0, gl()));
  log('  cust2 db views', { before: c0, after: custView(2) });
  log('  cust2 api views', { before: api0, after: await apiCustView(a, 2) });
  log('  sale amountPaid/status/due', (await a.get(`/sales/${s.data.id}`)).data && (({ amountPaid, amountDue, paymentStatus }) => ({ amountPaid, amountDue, paymentStatus }))((await a.get(`/sales/${s.data.id}`)).data));
  log('  inventory item2 unchanged?', { before: inv0, after: q1('select current_quantity_grams q,total_value v from inventory where item_id=2') });
  // can the customer still be charged the full original amount?
  const p = await a.post('/payments/sale', { saleId: s.data.id, amount: 10000, paymentMethod: 'cash' });
  log('  pay FULL 10000 after CN 4000', short(p));
  log('  cust2 after full pay', custView(2));
  log('  sale outstanding (PLE)', (await a.get(`/reconciliation/outstanding/sale/${s.data.id}`)).data);
}

// ---------- D-12 / F-09 partial & walk-in ----------
{
  const g0 = gl();
  const r = await sale({ saleType: 'cash', lines: [L(5, 2000, 4000)], payments: [{ amount: 5000, paymentMethod: 'cash' }] });
  log('D-12 partial walk-in no customer 8000 paid 5000', short(r));
  const r2 = await sale({ saleType: 'cash', customerName: 'زبون جديد', customerPhone: '0599000111', lines: [L(5, 2000, 4000)], payments: [{ amount: 5000, paymentMethod: 'cash' }] });
  log('F-09 partial name+phone 8000 paid 5000', `${short(r2)} customerId=${r2.data?.customerId}`);
  const cid = r2.data?.customerId;
  log('  auto customer views', cid ? custView(cid) : null);
  log('  GL delta', diff(g0, gl()));
  const r3 = await sale({ saleType: 'cash', lines: [L(5, 2000, 4000)], payments: [{ amount: 7999, paymentMethod: 'cash' }] });
  log('C-30 walk-in paid total-1 (8000/7999)', `${short(r3)} status=${r3.data?.paymentStatus} due=${r3.data?.amountDue}`);
  const g1 = gl();
  const r4 = await sale({ saleType: 'cash', customerName: 'زبون جديد', customerPhone: '0599000111', lines: [L(5, 1000, 4000)], payments: [{ amount: 1000, paymentMethod: 'cash' }] });
  log('second partial same phone -> reuses customer?', `${short(r4)} customerId=${r4.data?.customerId}`);
  log('  unowned AR (AR lines on sales without customer)', q1(`select coalesce(sum(l.debit_amount),0) s from journal_entry_lines l join journal_entries e on e.id=l.journal_entry_id join accounts ac on ac.id=l.account_id join sales s on s.id=e.source_id and e.source_type='sale' where ac.code='1120' and s.customer_id is null`));
  const r5 = await sale({ saleType: 'cash', lines: [L(5, 1000, 4000)] });
  log('cash sale with NO payments (paid 0, walk-in)', short(r5));
  const r6 = await sale({ saleType: 'cash', customerId: 1, lines: [L(5, 1000, 4000)] });
  log('cash sale with NO payments, customer 1', `${short(r6)} status=${r6.data?.paymentStatus}`);
}

// ---------- Void rules ----------
{
  const s = await sale({ saleType: 'cash', lines: [L(6, 1000, 5000)], payments: [{ amount: 5000, paymentMethod: 'cash' }] });
  log('void by ACCOUNTANT', short(await acc.post(`/sales/${s.data.id}/void`, { reason: 'x' })));
  log('void by admin', short(await a.post(`/sales/${s.data.id}/void`, { reason: 'x' })));
  log('void twice', short(await a.post(`/sales/${s.data.id}/void`, { reason: 'x' })));
  log('void without reason', short(await a.post(`/sales/${s.data.id}/void`, {})));
  // void seeded (old) fixture sale: no JE, no lines alloc
  const g0 = gl();
  const v = await a.post('/sales/1/void', { reason: 'old fixture' });
  log('void seeded fixture sale #1 (no original JE)', short(v));
  log('  GL delta of voiding a sale that never posted', diff(g0, gl()));
}

// ---------- F-08 payment then cancel ----------
{
  const s = await sale({ saleType: 'credit', customerId: 1, lines: [L(4, 1000, 10000)] });
  const c0 = custView(1);
  const p = await a.post('/payments/sale', { saleId: s.data.id, amount: 4000, paymentMethod: 'cash' });
  const c1 = custView(1);
  const c = await a.post(`/payments/${p.data.id}/cancel`, { reason: 't3' });
  log('F-08 credit 10000, pay 4000, cancel', `${short(p)} ${short(c)}`);
  log('  cust1 views', { c0, afterPay: c1, afterCancel: custView(1) });
  // payment created inside sale (no own JE) -> cancel
  const s2 = await sale({ saleType: 'cash', customerId: 1, lines: [L(4, 1000, 10000)], payments: [{ amount: 6000, paymentMethod: 'cash' }] });
  const pid = q1(`select id from payments where reference_type='sale' and reference_id=?`, s2.data.id).id;
  log('cancel POS payment (created with the sale)', short(await a.post(`/payments/${pid}/cancel`, { reason: 't3' })));
}

// ---------- F-12 / D-23 statement fallback ----------
{
  // fixture customer 1 has fixture sales without PLE but now also API PLE; check log-based statement numbers
  const r = await a.raw('GET', `/customers/1/statement/pdf?startDate=2020-01-01&endDate=2030-12-31`, { raw: true });
  log('statement pdf customer1', r.status);
}

log('INVARIANT unbalanced JEs', q(`select journal_entry_id, sum(debit_amount) dr, sum(credit_amount) cr from journal_entry_lines group by 1 having dr<>cr`));
log('INVARIANT Σcustomer.current_balance vs GL AR', { custSum: q1('select sum(current_balance) s from customers').s, debtsOpen: q1(`select sum(total_amount-amount_paid) s from debts where direction='receivable' and status not in ('paid','written_off')`).s, pleSum: q1(`select sum(amount) s from payment_ledger_entries where party_type='customer' and delinked=0`).s, glAR: gl()['1120'] });
save('E:/DEV/Chicken FMS/.qa-audit/tests/T3/xval.out.txt');
