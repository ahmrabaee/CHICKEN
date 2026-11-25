import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const BASE = 'http://localhost:3117/v1';
const admin = await connect(BASE, 'admin', 'admin123');
function logJ(label, r) { console.log(label, r.status, JSON.stringify(r.body).slice(0, 250)); }

const saleBody = { saleType: 'cash', lines: [{ itemId: 3, weightGrams: 100, pricePerKg: 2000 }], payments: [{ amount: 200, paymentMethod: 'cash' }] };
const [s1, s2] = await Promise.all([
  admin.post('/sales', saleBody, { headers: { 'Idempotency-Key': 'v2-dup-key-2', 'X-Request-Id': 'v2-dup-key-2' } }),
  admin.post('/sales', saleBody, { headers: { 'Idempotency-Key': 'v2-dup-key-2', 'X-Request-Id': 'v2-dup-key-2' } }),
]);
logJ('T6-005a: parallel sale #1', s1);
logJ('T6-005b: parallel sale #2 (same body + same Idempotency-Key header)', s2);
const s3 = await admin.post('/sales', saleBody, { headers: { 'Idempotency-Key': 'v2-dup-key-2', 'X-Request-Id': 'v2-dup-key-2' } });
logJ('T6-005c: sequential "retry" same key', s3);
console.log('DONE');
