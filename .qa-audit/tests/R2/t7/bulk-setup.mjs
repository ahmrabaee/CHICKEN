// Data setup via API for K4-021 (POS >100 items) and K4-012 (payment form 500 sales limit)
import { connect, API } from './lib.mjs';
const c = await connect(API, 'admin', 'admin123');
const items = (await c.get('/items?pageSize=200')).body;
const n = items.pagination?.totalItems ?? items.data.length;
console.log('items before', n);
for (let i = n; i < 106; i++) {
  const r = await c.post('/items', { code: `QA-${String(i).padStart(3, '0')}`, name: `صنف اختبار ${String(i).padStart(3, '0')}`, categoryId: 2, defaultSalePrice: 1000 + i, defaultPurchasePrice: 500 });
  if (!r.ok) { console.log('item create fail', r.status, JSON.stringify(r.body).slice(0, 200)); break; }
}
const last = (await c.get('/items?pageSize=200&search=' + encodeURIComponent('صنف اختبار 105'))).data;
console.log('last item', JSON.stringify(last).slice(0, 200));
// target old unpaid credit sale
const t = await c.post('/sales', { saleType: 'credit', customerId: 1, notes: 'T7-K4-012-TARGET', lines: [{ itemId: 2, weightGrams: 500, pricePerKg: 2200 }] });
console.log('target credit sale', t.status, t.data?.id, t.data?.saleNumber);
let ok = 0;
for (let i = 0; i < 505; i++) {
  const r = await c.post('/sales', { saleType: 'cash', lines: [{ itemId: 2, weightGrams: 10, pricePerKg: 2200 }], payments: [{ amount: 22, paymentMethod: 'cash' }] });
  if (r.ok) ok++; else { console.log('sale fail', r.status, JSON.stringify(r.body).slice(0, 200)); break; }
}
console.log('filler cash sales created', ok, 'target id', t.data?.id);
