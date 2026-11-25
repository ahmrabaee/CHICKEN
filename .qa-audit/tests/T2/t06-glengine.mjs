// T2-06: same inventory operations with gl_engine_enabled=true (GL engine posting path).
import { writeFileSync } from 'node:fs';
import { setup, gl, glDelta, showItem, newItem, purchase, sale, must, log, q, q1, logLines } from './lib.mjs';

const { c, db } = await setup('t2b', 3104);
let r = await c.put('/settings/gl_engine_enabled', { value: 'true' });
log('enable gl engine', r.status, JSON.stringify(r.data ?? r.body).slice(0, 150), '| db value', q1(db, "SELECT value FROM system_settings WHERE key='gl_engine_enabled'")?.value);
let G = gl(db);
const step = (label) => { const G2 = gl(db); const d = glDelta(G, G2); const sum = Object.values(d).reduce((a, b) => a + b, 0); log(`  GL delta [${label}]`, d, sum ? `UNBALANCED by ${sum}` : ''); G = G2; };
const it = await newItem(c, { name: 'T2 gle' });
await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 2000 }]); step('purchase 10kg@20');
await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 3000 }]); step('purchase 10kg@30');
r = await sale(c, [{ itemId: it.id, weightGrams: 12000, pricePerKg: 4000 }]); log('sale', r.status, r.body?.error?.code ?? ''); const s1 = r.data; step('sale 12kg (FIFO 24000)');
r = await c.post('/inventory/adjustments', { itemId: it.id, adjustmentType: 'decrease', quantityGrams: 1000, reason: 'count' }); log('adj', r.status, r.body?.error?.code ?? ''); step('adjust -1kg');
r = await c.post('/inventory/adjustments', { itemId: it.id, adjustmentType: 'increase', quantityGrams: 1000, unitCost: 2500, reason: 'found' }); log('adj+', r.status, r.body?.error?.code ?? ''); step('adjust +1kg @25');
const lot = q1(db, 'SELECT id FROM inventory_lots WHERE item_id=? AND remaining_quantity_grams>0 ORDER BY id', it.id).id;
r = await c.post('/wastage', { lotId: lot, quantityGrams: 1000, reason: 'spoiled' }); log('wastage', r.status, r.body?.error?.code ?? ''); step('wastage 1kg');
r = await c.post('/stock-transfer', { sourceLotId: lot, lines: [{ itemId: 3, weightGrams: 1000, unitCost: 5000 }] }); log('transfer', r.status, r.body?.error?.code ?? ''); step('transfer 1kg @50');
r = await c.post(`/sales/${s1.id}/void`, { reason: 'x' }); log('void', r.status, r.body?.error?.code ?? ''); step('void sale');
log('JE sources', JSON.stringify(q(db, 'SELECT source_type, COUNT(*) n, MIN(is_posted) p FROM journal_entries GROUP BY source_type')));
showItem(db, it.id);
writeFileSync(new URL('./t06-glengine.out.txt', import.meta.url), logLines.join('\n'));
