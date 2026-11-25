// F-02 regression (75b3211): stock 10kg@20, increase 10kg @30 -> avg 25.00 (2500), lot price 3000
import { writeFileSync } from 'node:fs';
import { setup, showItem, newItem, purchase, log, logLines, q1 } from './lib.mjs';
const { c, db } = await setup('t2b', 3104, { reset: false });
const it = await newItem(c, { name: 'T2 F02' });
await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 2000 }]);
const r = await c.post('/inventory/adjustments', { itemId: it.id, adjustmentType: 'increase', quantityGrams: 10000, unitCost: 3000, reason: 'F-02' });
log('adjust', r.status, JSON.stringify(r.data));
showItem(db, it.id);
log('GET /inventory/:id avgCostPrice', (await c.get(`/inventory/${it.id}`)).data.avgCostPrice, 'expected 2500');
writeFileSync(new URL('./t07-f02.out.txt', import.meta.url), logLines.join('\n'));
