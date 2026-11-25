import * as L from './lib.mjs';
const a = await L.admin();
const ITEM = 4;
const sale = async (cl = a, extra = {}, line = {}) => cl.post('/sales', { saleType: 'cash', taxTemplateId: 1, lines: [{ itemId: ITEM, weightGrams: 2000, pricePerKg: 5000, ...line }], ...extra });
// accountant user
const roles = await a.get('/users/roles'); const rid = (roles.data || []).find(r => r.name === 'accountant')?.id;
const u = await a.post('/users', { username: 'v1acc', password: 'Password@123', fullName: 'V1 Acc', roleId: rid }); L.say('create accountant', L.st(u));
const acc = await L.connect(L.BASE, 'v1acc', 'Password@123');
// discount cap
const pay = (t) => ({ payments: [{ amount: t, paymentMethod: 'cash' }] });
L.say('ACC discountPct 600 (cap path)', L.st(await acc.post('/sales', { saleType: 'cash', discountPct: 600, lines: [{ itemId: ITEM, weightGrams: 2000, pricePerKg: 5000 }], ...pay(1) })));
const r1 = await acc.post('/sales', { saleType: 'cash', discountAmount: 5000, lines: [{ itemId: ITEM, weightGrams: 2000, pricePerKg: 5000 }], ...pay(5000) });
L.say('ACC header discountAmount 5000 of 10000 (50%)', [L.st(r1), r1.ok && L.saleRow(r1.data.id)]);
const r2 = await acc.post('/sales', { saleType: 'cash', lines: [{ itemId: ITEM, weightGrams: 2000, pricePerKg: 5000, discountAmount: 9500 }], ...pay(500) });
L.say('ACC line discount 9500 of 10000 (95%)', [L.st(r2), r2.ok && L.saleRow(r2.data.id)]);
const r3 = await acc.post('/sales', { saleType: 'cash', lines: [{ itemId: ITEM, weightGrams: 2000, pricePerKg: 1 }], ...pay(2) });
L.say('ACC pricePerKg=1 (list 50.00, cost 22.00)', [L.st(r3), r3.ok && L.saleRow(r3.data.id)]);
const r4 = await a.post('/sales', { saleType: 'cash', discountPct: 600, lines: [{ itemId: ITEM, weightGrams: 2000, pricePerKg: 5000 }], ...pay(9400) });
L.say('ADMIN 6% discountPct (control, admin allowed)', L.st(r4));
// forbidden financials for accountant
const probes = ['/reports/profit-loss', '/reports/sales', '/reports/inventory', '/reports/expenses', '/reports/purchases', '/accounting/trial-balance', '/expenses', '/expenses/summary', '/items', '/suppliers', '/purchases', '/inventory/1/lots', '/sales/' + (r1.data?.id), '/dashboard', '/dashboard/summary', '/users', '/settings', '/tax/vat-report', '/backup'];
for (const p of probes) { const r = await acc.get(p); const body = JSON.stringify(r.body || ''); const costy = /totalCost|totalProfit|unitPurchasePrice|averageCost|grossProfit|defaultPurchasePrice|costPrice/.test(body); L.say('ACC GET ' + p, `${r.status} costFields=${costy}`); }
// engine toggles
const setS = async (k, v) => a.put(`/settings/${k}`, { value: v });
L.say('set tax_engine_enabled=true', L.st(await setS('tax_engine_enabled', 'true')));
{ const g0 = L.snap(); const s = await sale(a, pay(11500)); L.say('TAX ON/GL OFF GL delta', [L.st(s), L.delta(g0, L.snap())]); }
L.say('set gl_engine_enabled=true', L.st(await setS('gl_engine_enabled', 'true')));
{ const g0 = L.snap(); const s = await sale(a, pay(11500)); L.say('TAX ON/GL ON GL delta', [L.st(s), L.delta(g0, L.snap()), s.ok && L.saleRow(s.data.id)]); }
