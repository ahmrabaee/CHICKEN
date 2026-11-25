import * as L from './lib.mjs';
const a = await L.admin();
const c = await a.post('/customers', { name: 'probe', phone: '0591234567' });
console.log(L.st(c), JSON.stringify(c.body).slice(0,300));
const p = await a.post('/purchases', { supplierId: 1, lines: [{ itemId: 2, weightGrams: 10000, pricePerKg: 2000 }] });
console.log(L.st(p), JSON.stringify(p.body).slice(0,500));
console.log(L.lotsOf(2), L.invOf(2));
const j = await L.fundCash(a, 1000000); console.log(L.st(j), JSON.stringify(j.body).slice(0,400));
