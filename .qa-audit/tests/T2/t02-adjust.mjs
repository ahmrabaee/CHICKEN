// T2-02: stock adjustments vs FIFO lots / inventory / SLE / GL. Quantifies drift.
import { writeFileSync } from 'node:fs';
import { setup, gl, glDelta, showItem, itemView, newItem, purchase, sale, must, log, q, q1, logLines } from './lib.mjs';

const { c, db } = await setup('t2a', 3103);
const adj = (b) => c.post('/inventory/adjustments', { reason: 'T2 count', ...b });
let G = gl(db);
const step = (label) => { const G2 = gl(db); log(`  GL delta [${label}]`, glDelta(G, G2)); G = G2; };

// --- Scenario A: decrease after partial FIFO consumption, then sell the rest
log('=== A: purchase 10kg@20 + 10kg@30, sell 5kg, adjust -5kg, sell 10kg, try sell 5kg more');
const A = await newItem(c, { name: 'T2 adj A' });
await purchase(c, [{ itemId: A.id, weightGrams: 10000, pricePerKg: 2000 }]);
await purchase(c, [{ itemId: A.id, weightGrams: 10000, pricePerKg: 3000 }]);
step('purchases'); showItem(db, A.id);
must(await sale(c, [{ itemId: A.id, weightGrams: 5000, pricePerKg: 4000 }]), 'sale 5kg');
step('sale 5kg'); showItem(db, A.id);
let r = await adj({ itemId: A.id, adjustmentType: 'decrease', quantityGrams: 5000 });
log('adjust -5kg', r.status, JSON.stringify(r.data));
step('adjust -5kg'); showItem(db, A.id);
r = await sale(c, [{ itemId: A.id, weightGrams: 10000, pricePerKg: 4000 }]);
log('sale 10kg', r.status, r.ok ? `totalCost=${q1(db, 'SELECT total_cost FROM sales WHERE id=?', r.data.id).total_cost}` : JSON.stringify(r.body));
step('sale 10kg'); showItem(db, A.id, 'phantom lot?');
r = await sale(c, [{ itemId: A.id, weightGrams: 5000, pricePerKg: 4000 }]);
log('sale 5kg more (lots still have 5kg)', r.status, r.ok ? 'ACCEPTED' : r.body?.error?.code);
const vA = itemView(db, A.id);
log(`  => A residue: inventory ${vA.invQty}g / value ${vA.invVal}; lots ${vA.lotQty}g / ${vA.lotVal}`);

// --- Scenario B: increase WITHOUT unitCost while stock > 0 -> no lot, then sell more than lots
log('=== B: purchase 10kg@20, adjust +5kg without unitCost, sell 15kg');
const B = await newItem(c, { name: 'T2 adj B' });
await purchase(c, [{ itemId: B.id, weightGrams: 10000, pricePerKg: 2000 }]);
step('purchase');
r = await adj({ itemId: B.id, adjustmentType: 'increase', quantityGrams: 5000 });
log('adjust +5kg (no cost)', r.status, JSON.stringify(r.data));
step('adjust +5kg nocost'); showItem(db, B.id);
r = await sale(c, [{ itemId: B.id, weightGrams: 15000, pricePerKg: 4000 }]);
log('sale 15kg', r.status, r.ok ? 'ACCEPTED' : JSON.stringify(r.body?.error));
r = await sale(c, [{ itemId: B.id, weightGrams: 10000, pricePerKg: 4000 }]);
log('sale 10kg', r.status, r.ok ? 'ACCEPTED' : JSON.stringify(r.body?.error));
step('sales B'); showItem(db, B.id);

// --- Scenario C: increase with unitCost 0 / negative while stock > 0
log('=== C: adjust +10kg with unitCost=0 and with unitCost=-1500 (stock>0)');
const C = await newItem(c, { name: 'T2 adj C' });
await purchase(c, [{ itemId: C.id, weightGrams: 10000, pricePerKg: 2000 }]);
step('purchase');
r = await adj({ itemId: C.id, adjustmentType: 'increase', quantityGrams: 10000, unitCost: 0 });
log('adjust +10kg cost 0', r.status, JSON.stringify(r.data ?? r.body?.error));
step('adj cost 0'); showItem(db, C.id);
r = await adj({ itemId: C.id, adjustmentType: 'increase', quantityGrams: 10000, unitCost: -1500 });
log('adjust +10kg cost -1500', r.status, JSON.stringify(r.data ?? r.body?.error));
step('adj cost -1500'); showItem(db, C.id);

// --- Scenario D: adjustment to zero, and increase with cost then sale (cost of sale vs adjustment value)
log('=== D: purchase 10kg@20, sell 3kg, adjust -7kg to zero, adjust +5kg @25 (lot), sell 5kg');
const D = await newItem(c, { name: 'T2 adj D' });
await purchase(c, [{ itemId: D.id, weightGrams: 10000, pricePerKg: 2000 }]);
must(await sale(c, [{ itemId: D.id, weightGrams: 3000, pricePerKg: 4000 }]), 'sale 3kg');
step('purchase+sale');
r = await adj({ itemId: D.id, adjustmentType: 'decrease', quantityGrams: 7000 });
log('adjust -7kg (to zero)', r.status, JSON.stringify(r.data));
step('adj to zero'); showItem(db, D.id);
r = await adj({ itemId: D.id, adjustmentType: 'increase', quantityGrams: 5000, unitCost: 2500 });
log('adjust +5kg @25', r.status, JSON.stringify(r.data));
step('adj +5 @25'); showItem(db, D.id);
r = await sale(c, [{ itemId: D.id, weightGrams: 5000, pricePerKg: 4000 }]);
const sD = r.data;
log('sale 5kg', r.status, r.ok ? `totalCost=${q1(db, 'SELECT total_cost FROM sales WHERE id=?', sD.id).total_cost} (adjustment valued 12500)` : JSON.stringify(r.body?.error));
log('  allocations', q(db, 'SELECT a.lot_id, a.quantity_allocated_grams g, a.unit_cost, a.total_cost FROM sale_line_cost_allocations a JOIN sale_lines l ON l.id=a.sale_line_id WHERE l.sale_id=?', sD?.id ?? 0));
step('sale 5kg'); showItem(db, D.id);

// --- Scenario E: decrease with lotId -> is that lot touched?
log('=== E: decrease 2kg with lotId');
const E = await newItem(c, { name: 'T2 adj E' });
await purchase(c, [{ itemId: E.id, weightGrams: 10000, pricePerKg: 2000 }]);
const lotE = q1(db, 'SELECT id FROM inventory_lots WHERE item_id=?', E.id).id;
r = await adj({ itemId: E.id, adjustmentType: 'decrease', quantityGrams: 2000, lotId: lotE });
log('adjust -2kg lotId', lotE, r.status);
step('adj E'); showItem(db, E.id);
// lotId of a DIFFERENT item
r = await adj({ itemId: E.id, adjustmentType: 'decrease', quantityGrams: 1000, lotId: q1(db, 'SELECT id FROM inventory_lots WHERE item_id=?', A.id).id });
log('adjust -1kg with lotId of another item ->', r.status);

// --- Stock-vs-GL & valuation report
const svg = await c.get('/reports/stock-vs-gl');
log('stock-vs-gl summary', JSON.stringify(svg.data?.summary));
const adjRows = (svg.data?.rows ?? []).filter((x) => x.voucherType === 'adjustment');
log('stock-vs-gl adjustment rows', JSON.stringify(adjRows));
const rep = await c.get('/reports/inventory');
const repItems = (rep.data?.items ?? []).filter((x) => [A.id, B.id, C.id, D.id, E.id].includes(x.itemId));
log('/reports/inventory rows', JSON.stringify(repItems.map((x) => ({ id: x.itemId, w: x.currentWeight, v: x.value }))));
for (const it of [A, B, C, D, E]) { const v = itemView(db, it.id); log(`  item ${it.id}: inv ${v.invQty}g/${v.invVal}  lots ${v.lotQty}g/${v.lotVal}  drift qty ${v.lotQty - v.invQty}g value ${v.lotVal - v.invVal}`); }
const g = gl(db);
const invTot = q1(db, `SELECT SUM(total_value) v FROM inventory WHERE item_id IN (${[A, B, C, D, E].map((x) => x.id)})`).v;
log('GL 1131 total', g['1131'], '| Σ inventory.total_value test items', invTot, '| 5320', g['5320']);
writeFileSync(new URL('./t02-adjust.out.txt', import.meta.url), logLines.join('\n'));
