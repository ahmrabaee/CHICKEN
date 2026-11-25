// V2: T4-012/T4-004/K3-005 (numbering block after non-last delete, when it clears),
//     T6-008 (negative/zero/fractional amounts), T6-005 (duplicate sale on parallel retry)
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';

const BASE = 'http://localhost:3117/v1';
const admin = await connect(BASE, 'admin', 'admin123');
function logJ(label, r) { console.log(label, r.status, JSON.stringify(r.body).slice(0, 220)); }

// Fund cash via manual JE Dr 1111 (id=4) / Cr 3100 (id=21), like T4 did.
const fund = await admin.post('/accounting/journal-entries', {
  description: 'V2 cash funding', entryDate: new Date().toISOString(),
  lines: [{ accountId: 4, debit: 10000000, credit: 0 }, { accountId: 21, debit: 0, credit: 10000000 }],
});
logJ('fund cash JE', fund);
if (fund.data?.id) {
  const post = await admin.post(`/accounting/journal-entries/${fund.data.id}/post`, {});
  logJ('post funding JE', post);
}

// ---------- T4-012: purchase numbering block after deleting a non-last purchase ----------
const mkPurchase = () => admin.post('/purchases', { supplierId: 1, purchaseDate: new Date().toISOString(), lines: [{ itemId: 1, weightGrams: 1000, pricePerKg: 2000 }], paymentMethod: 'cash', amountPaid: 0 });
const p1 = await mkPurchase(); logJ('purchase1', p1);
const p2 = await mkPurchase(); logJ('purchase2', p2);
const delNonLast = await admin.del(`/purchases/${p1.data.id}`);
logJ('delete NON-LAST purchase (p1)', delNonLast);
const p3 = await mkPurchase();
logJ('T4-012a: purchase AFTER deleting non-last -> expect 409', p3);
const p3retry = await mkPurchase();
logJ('T4-012a retry: still blocked?', p3retry);
const delP2 = await admin.del(`/purchases/${p2.data.id}`); // delete the LAST/highest-numbered one
logJ('delete p2 (the highest-numbered remaining purchase)', delP2);
const p4 = await mkPurchase();
logJ('T4-012b: purchase after ALSO deleting the highest-numbered one -> does block clear?', p4);

// ---------- T4-004: expense numbering block ----------
const mkExpense = (amount, desc) => admin.post('/expenses', { amount, description: desc, expenseDate: new Date().toISOString(), paymentMethod: 'cash', categoryId: 1 });
const e1 = await mkExpense(1000, 'e1'); logJ('expense1', e1);
const e2 = await mkExpense(1000, 'e2'); logJ('expense2', e2);
const delE1 = await admin.del(`/expenses/${e1.data.id}`);
logJ('delete NON-LAST expense (e1)', delE1);
const e3 = await mkExpense(1000, 'e3');
logJ('T4-004a: expense AFTER deleting non-last -> expect 409', e3);
const delE2 = await admin.del(`/expenses/${e2.data.id}`);
logJ('delete e2 (highest-numbered remaining expense)', delE2);
const e4 = await mkExpense(1000, 'e4');
logJ('T4-004b: expense after ALSO deleting the highest-numbered one -> does block clear?', e4);

console.log('=== boundary / negative amount tests (T6-008) ===');
const negPurchase = await admin.post('/purchases', { supplierId: 1, purchaseDate: new Date().toISOString(), lines: [{ itemId: 1, weightGrams: -5000, pricePerKg: 2000 }], paymentMethod: 'cash', amountPaid: 0 });
logJ('T6-008a: purchase weight -5000g', negPurchase);
const negPrice = await admin.post('/purchases', { supplierId: 1, purchaseDate: new Date().toISOString(), lines: [{ itemId: 1, weightGrams: 1000, pricePerKg: -1000 }], paymentMethod: 'cash', amountPaid: 0 });
logJ('T6-008b: purchase price -1000/kg', negPrice);
const zeroPurchase = await admin.post('/purchases', { supplierId: 1, purchaseDate: new Date().toISOString(), lines: [{ itemId: 1, weightGrams: 0, pricePerKg: 2000 }], paymentMethod: 'cash', amountPaid: 0 });
logJ('T6-008c: purchase weight 0', zeroPurchase);
const fracPurchase = await admin.post('/purchases', { supplierId: 1, purchaseDate: new Date().toISOString(), lines: [{ itemId: 1, weightGrams: 1000.7, pricePerKg: 999.9 }], paymentMethod: 'cash', amountPaid: 0 });
logJ('T6-008d: purchase fractional weight/price', fracPurchase);

const negExpense = await mkExpense(-5000, 'neg');
logJ('T6-008e: expense amount -5000', negExpense);
const zeroExpense = await mkExpense(0, 'zero');
logJ('T6-008f: expense amount 0', zeroExpense);
const fracExpense = await mkExpense(10.55, 'frac');
logJ('T6-008g: expense amount 10.55 (fractional minor unit)', fracExpense);

const negPayment = await admin.post('/payments/sale', { saleId: 1, amount: -1000, paymentMethod: 'cash' }).catch((e) => ({ status: 'ERR', body: e.message }));
logJ('T6-008i: /payments/sale amount -1000', negPayment);

const adjNeg = await admin.post('/inventory/adjustments', { itemId: 1, adjustmentType: 'increase', quantityGrams: 1000, unitCost: -5000, reason: 'test v2' });
logJ('T6-008h: adjustment increase with unitCost -5000', adjNeg);

console.log('=== T6-005: duplicate sale via concurrent identical POST ===');
const saleBody = { saleType: 'cash', lines: [{ itemId: 3, weightGrams: 100, pricePerKg: 2000 }], payments: [{ amount: 20, paymentMethod: 'cash' }] };
const [s1, s2] = await Promise.all([
  admin.post('/sales', saleBody, { headers: { 'Idempotency-Key': 'v2-dup-key-1', 'X-Request-Id': 'v2-dup-key-1' } }),
  admin.post('/sales', saleBody, { headers: { 'Idempotency-Key': 'v2-dup-key-1', 'X-Request-Id': 'v2-dup-key-1' } }),
]);
logJ('T6-005a: parallel sale #1', s1);
logJ('T6-005b: parallel sale #2 (same body + same idempotency key)', s2);
const s3 = await admin.post('/sales', saleBody, { headers: { 'Idempotency-Key': 'v2-dup-key-1', 'X-Request-Id': 'v2-dup-key-1' } });
logJ('T6-005c: sequential "retry" same key', s3);

console.log('DONE');
