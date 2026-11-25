// R1-01: sales/void/payments/mixed tender/tax (QA-014, 015, 016, 026, discount account)
import { setup, glx, dl, jeCheck, newCust, L, errc, log, saveLog, must, q, q1, purchase, newItem, bankId } from './lib2.mjs';
const { c, db } = await setup();
const item = await newItem(c, { name: 'R1 sale item', sale: 5000, purchase: 3000 });
await purchase(c, [{ itemId: item.id, weightGrams: 200000, pricePerKg: 3000 }]);
const bid = await bankId(c, db);

log('=== A. QA-014: credit sale 10000, pay 4000 cash separately, void');
const cA = await newCust(c, 'A');
const g00 = glx(db);
const sA = must(await c.post('/sales', { saleType: 'credit', customerId: cA, lines: [L(item.id, 2000, 5000)] }), 'saleA');
const g0 = glx(db);
log('sale delta', JSON.stringify(dl(g00, g0)));
log('pay 4000', errc(await c.post('/payments/sale', { saleId: sA.id, amount: 4000, paymentMethod: 'cash' })));
const g1 = glx(db); log('GL delta pay', JSON.stringify(dl(g0, g1)));
log('void', errc(await c.post(`/sales/${sA.id}/void`, { reason: 'r1' })));
log('GL delta VOID only', JSON.stringify(dl(g1, glx(db))), '(orig bug: cash -4000 double refund, AR +4000 phantom)');
log('NET delta whole life (expect {} )', JSON.stringify(dl(g00, glx(db))));
log('customer balance', q1(db, 'select current_balance b from customers where id=?', cA).b, 'debt', JSON.stringify(q(db, 'select status,total_amount,amount_paid from debts where source_type=? and source_id=?', 'sale', sA.id)));

log('=== A2. payment by bank');
const cA2 = await newCust(c, 'A2');
const sA2 = must(await c.post('/sales', { saleType: 'credit', customerId: cA2, lines: [L(item.id, 2000, 5000)] }), 'saleA2');
const h0 = glx(db);
log('pay 4000 bank', errc(await c.post('/payments/sale', { saleId: sA2.id, amount: 4000, paymentMethod: 'bank_transfer', bankAccountId: bid })));
const h1 = glx(db); log('GL delta pay', JSON.stringify(dl(h0, h1)));
log('void', errc(await c.post(`/sales/${sA2.id}/void`, { reason: 'r1' })));
log('GL delta VOID', JSON.stringify(dl(h1, glx(db))), ' NET since before pay', JSON.stringify(dl(h0, glx(db))));

log('=== A3. POS sale with payments[] 3000 + later payment 2000, void');
const cA3 = await newCust(c, 'A3');
const sA3 = must(await c.post('/sales', { saleType: 'cash', customerId: cA3, lines: [L(item.id, 2000, 5000)], payments: [{ amount: 3000, paymentMethod: 'cash' }] }), 'saleA3');
const i0 = glx(db);
log('pay 2000', errc(await c.post('/payments/sale', { saleId: sA3.id, amount: 2000, paymentMethod: 'cash' })));
const i1 = glx(db);
log('void', errc(await c.post(`/sales/${sA3.id}/void`, { reason: 'r1' })));
log('GL delta VOID', JSON.stringify(dl(i1, glx(db))), '(orig: cash -7000 vs -5000 expected)');

log('=== A4. POST /sales/:id/payments (QA-015)');
const cA4 = await newCust(c, 'A4');
const sA4 = must(await c.post('/sales', { saleType: 'credit', customerId: cA4, lines: [L(item.id, 1000, 5000)] }), 'saleA4');
const j0 = glx(db);
const pp = await c.post(`/sales/${sA4.id}/payments`, { amount: 3000, paymentMethod: 'cash' });
log('POST /sales/:id/payments 3000', errc(pp), 'GL delta', JSON.stringify(dl(j0, glx(db))));
const pay = q1(db, "select id from payments where reference_type='sale' and reference_id=? order by id desc", sA4.id);
log('JE for that payment', q(db, "select id from journal_entries where source_type='payment' and source_id=?", pay?.id).length);

log('=== B. QA-016 mixed tender 5000 cash + 5000 bank');
const k0 = glx(db);
const sB = await c.post('/sales', { saleType: 'cash', lines: [L(item.id, 2000, 5000)], payments: [{ amount: 5000, paymentMethod: 'cash' }, { amount: 5000, paymentMethod: 'bank_transfer', bankAccountId: bid }] });
log('mixed sale', errc(sB), 'GL delta', JSON.stringify(dl(k0, glx(db))));
if (sB.ok) { const k1 = glx(db); log('void mixed', errc(await c.post(`/sales/${sB.data.id}/void`, { reason: 'r1' })), JSON.stringify(dl(k1, glx(db)))); }
const k2 = glx(db);
const sB2 = await c.post('/sales', { saleType: 'cash', lines: [L(item.id, 2000, 5000)], payments: [{ amount: 6000, paymentMethod: 'bank_transfer', bankAccountId: bid }, { amount: 4000, paymentMethod: 'cash' }] });
log('mixed bank-first 6000 bank + 4000 cash', errc(sB2), JSON.stringify(dl(k2, glx(db))));

log('=== C. taxed sale (template 1 = 15%), default mode: net 10000');
const t0 = glx(db);
const sC = await c.post('/sales', { saleType: 'cash', taxTemplateId: 1, lines: [L(item.id, 2000, 5000)], payments: [{ amount: 11500, paymentMethod: 'cash' }] });
log('taxed sale', errc(sC), sC.ok ? JSON.stringify({ total: sC.data.totalAmount, tax: sC.data.taxAmount, profit: sC.data.totalProfit, cost: sC.data.totalCost }) : '');
log('GL delta (expect 1111 +11500, 4110 -10000, 2120 -1500, 1131 -6000, 5100 +6000)', JSON.stringify(dl(t0, glx(db))));
if (sC.ok) {
  const vr = await c.get('/tax/vat-report?startDate=2026-01-01&endDate=2026-12-31'); log('vat-report', JSON.stringify(vr.data).slice(0, 500));
  const t1 = glx(db);
  log('void taxed', errc(await c.post(`/sales/${sC.data.id}/void`, { reason: 'r1' })), JSON.stringify(dl(t1, glx(db))));
  log('NET after void (expect {})', JSON.stringify(dl(t0, glx(db))));
}
log('=== C2. taxed + header discount 1000 (default mode)');
const u0 = glx(db);
const sC2 = await c.post('/sales', { saleType: 'cash', taxTemplateId: 1, discountAmount: 1000, lines: [L(item.id, 2000, 5000)], payments: [{ amount: 10350, paymentMethod: 'cash' }] });
log('taxed+disc', errc(sC2), sC2.ok ? JSON.stringify({ total: sC2.data.totalAmount, tax: sC2.data.taxAmount, disc: sC2.data.discountAmount }) : '');
log('GL delta', JSON.stringify(dl(u0, glx(db))));
if (sC2.ok) { const u1 = glx(db); log('void', errc(await c.post(`/sales/${sC2.data.id}/void`, { reason: 'r1' })), JSON.stringify(dl(u1, glx(db))), 'NET', JSON.stringify(dl(u0, glx(db)))); }

log('=== D. untaxed discount sale: discount account');
const w0 = glx(db);
const sD = await c.post('/sales', { saleType: 'cash', discountAmount: 500, lines: [L(item.id, 2000, 5000)], payments: [{ amount: 9500, paymentMethod: 'cash' }] });
log('disc sale', errc(sD), JSON.stringify(dl(w0, glx(db))));
log('JE unbalanced entries:', JSON.stringify(jeCheck(db)));
saveLog('01-sales-void');
