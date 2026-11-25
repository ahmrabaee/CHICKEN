// V2: T1-018 — enabling gl_engine_enabled after any JE was hard-deleted blocks ALL postings with 409
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const BASE = 'http://localhost:3125/v1';
const admin = await connect(BASE, 'admin', 'admin123');
function logJ(label, r) { console.log(label, r.status, JSON.stringify(r.body).slice(0, 250)); }

const fund = await admin.post('/accounting/journal-entries', {
  description: 'V2 cash funding', entryDate: new Date().toISOString(),
  lines: [{ accountId: 4, debit: 10000000, credit: 0 }, { accountId: 21, debit: 0, credit: 10000000 }],
});
if (fund.data?.id) await admin.post(`/accounting/journal-entries/${fund.data.id}/post`, {});

// Create + delete a purchase (legacy mode, engine still off) to remove a JE from the middle of the sequence.
const mkPurchase = () => admin.post('/purchases', { supplierId: 1, purchaseDate: new Date().toISOString(), lines: [{ itemId: 1, weightGrams: 1000, pricePerKg: 2000 }], paymentMethod: 'cash', amountPaid: 0 });
const pA = await mkPurchase(); logJ('purchase A (engine off)', pA);
const pB = await mkPurchase(); logJ('purchase B (engine off)', pB);
const delA = await admin.del(`/purchases/${pA.data.id}`);
logJ('delete purchase A (removes its JE from the middle)', delA);

// Now enable the GL engine.
const setEngine = await admin.put('/settings/gl_engine_enabled', { value: 'true' });
logJ('enable gl_engine_enabled', setEngine);

// Try postings: sale, purchase, expense.
const sale = await admin.post('/sales', { saleType: 'cash', lines: [{ itemId: 3, weightGrams: 100, pricePerKg: 2000 }], payments: [{ amount: 200, paymentMethod: 'cash' }] });
logJ('T1-018a: sale with GL engine ON after a mid-sequence JE delete', sale);

const purchase = await mkPurchase();
logJ('T1-018b: purchase with GL engine ON', purchase);

const expense = await admin.post('/expenses', { amount: 1000, description: 'eng', expenseDate: new Date().toISOString(), paymentMethod: 'cash', categoryId: 1 });
logJ('T1-018c: expense with GL engine ON', expense);

// retry same sale again to confirm it NEVER recovers (count never moves)
const sale2 = await admin.post('/sales', { saleType: 'cash', lines: [{ itemId: 3, weightGrams: 100, pricePerKg: 2000 }], payments: [{ amount: 200, paymentMethod: 'cash' }] });
logJ('T1-018d: retry sale (still blocked?)', sale2);

console.log('DONE');
