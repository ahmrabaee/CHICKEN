// V2: T6-001 — burst of ~20 concurrent sales -> 500s / stall
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const BASE = 'http://localhost:3117/v1';
const admin = await connect(BASE, 'admin', 'admin123');

const fund = await admin.post('/accounting/journal-entries', {
  description: 'V2 cash funding', entryDate: new Date().toISOString(),
  lines: [{ accountId: 4, debit: 10000000, credit: 0 }, { accountId: 21, debit: 0, credit: 10000000 }],
});
if (fund.data?.id) await admin.post(`/accounting/journal-entries/${fund.data.id}/post`, {});

const N = 20;
const t0 = Date.now();
const results = await Promise.all(Array.from({ length: N }, (_, i) =>
  admin.post('/sales', { saleType: 'cash', lines: [{ itemId: 3, weightGrams: 10, pricePerKg: 2000 }], payments: [{ amount: 2, paymentMethod: 'cash' }] })
    .then((r) => ({ i, status: r.status, code: r.body?.error?.code }))
    .catch((e) => ({ i, status: 'ERR', code: e.message }))
));
const dt = Date.now() - t0;
const counts = {};
for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
console.log(`N=${N} parallel sales, wall=${dt}ms, status counts:`, JSON.stringify(counts));
console.log('sample failures:', JSON.stringify(results.filter((r) => r.status !== 201).slice(0, 5)));
console.log('DONE');
