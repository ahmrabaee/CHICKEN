// T2-05: oversell (K3-008, concurrency), opening stock on item create, purchase delete after adjustment,
// precision of many small sales, category delete, branches.
import { writeFileSync } from 'node:fs';
import { setup, gl, glDelta, showItem, itemView, newItem, purchase, sale, must, log, q, q1, logLines } from './lib.mjs';

const { c, db } = await setup('t2a', 3103);
let G = gl(db);
const step = (label) => { const G2 = gl(db); log(`  GL delta [${label}]`, glDelta(G, G2)); G = G2; };

log('=== O1 (K3-008): 10kg in stock, one sale with two lines 6kg + 6kg');
const O = await newItem(c, { name: 'T2 oversell' });
await purchase(c, [{ itemId: O.id, weightGrams: 10000, pricePerKg: 2000 }]);
let r = await c.post('/sales', { saleType: 'cash', lines: [{ itemId: O.id, weightGrams: 6000, pricePerKg: 3000 }, { itemId: O.id, weightGrams: 6000, pricePerKg: 3000 }], payments: [{ amount: 36000, paymentMethod: 'cash' }] });
log('two-line sale', r.status, r.body?.error?.code ?? 'ACCEPTED');
showItem(db, O.id);
log('  allocations', r.ok ? q(db, 'SELECT a.lot_id, a.quantity_allocated_grams g, a.total_cost FROM sale_line_cost_allocations a JOIN sale_lines l ON l.id=a.sale_line_id WHERE l.sale_id=?', r.data.id) : '');

log('=== O2: concurrent sales 2 x 8kg on a 10kg item');
const O2 = await newItem(c, { name: 'T2 race' });
await purchase(c, [{ itemId: O2.id, weightGrams: 10000, pricePerKg: 2000 }]);
const res = await Promise.all([1, 2, 3].map(() => sale(c, [{ itemId: O2.id, weightGrams: 8000, pricePerKg: 3000 }])));
log('3 concurrent 8kg sales ->', res.map((x) => `${x.status}${x.ok ? '' : ':' + x.body?.error?.code}`).join(', '));
showItem(db, O2.id);
r = await sale(c, [{ itemId: O2.id, weightGrams: 10001, pricePerKg: 3000 }]);
log('single sale > stock', r.status, r.body?.error?.code);

log('=== S1: seed item 2 (lot from seed, no GL) sale');
G = gl(db);
r = await sale(c, [{ itemId: 2, weightGrams: 1000, pricePerKg: 2200 }]);
log('sale 1kg seed item', r.status); step('seed sale (COGS credited to 1131 that never had value)');

log('=== OP: item created with opening stock (initialQuantityGrams)');
G = gl(db);
const OP = await newItem(c, { name: 'T2 opening', extra: { initialQuantityGrams: 20000, initialCostPrice: 2000 } });
step('item with 20kg opening @20'); showItem(db, OP.id);
r = await sale(c, [{ itemId: OP.id, weightGrams: 20000, pricePerKg: 3000 }]);
log('sell all opening stock', r.status); step('sale of opening stock'); showItem(db, OP.id);

log('=== PD: purchase deleted after an adjustment (adjustment without lotId does not block deletion)');
const PD = await newItem(c, { name: 'T2 purchase-delete' });
const pA = await purchase(c, [{ itemId: PD.id, weightGrams: 10000, pricePerKg: 2000 }]);
G = gl(db);
must(await c.post('/inventory/adjustments', { itemId: PD.id, adjustmentType: 'decrease', quantityGrams: 4000, reason: 'count' }), 'adj');
step('adjust -4kg'); showItem(db, PD.id);
r = await c.del(`/purchases/${pA.id}`);
log('delete purchase', r.status, r.body?.error?.code ?? '');
step('delete purchase'); showItem(db, PD.id);
// same with increase-without-cost
const PD2 = await newItem(c, { name: 'T2 purchase-edit' });
const pB = await purchase(c, [{ itemId: PD2.id, weightGrams: 10000, pricePerKg: 2000 }]);
must(await c.post('/inventory/adjustments', { itemId: PD2.id, adjustmentType: 'increase', quantityGrams: 3000, reason: 'found' }), 'adj+');
G = gl(db);
r = await c.put(`/purchases/${pB.id}`, { supplierId: 1, lines: [{ itemId: PD2.id, weightGrams: 10000, pricePerKg: 3000 }] });
log('edit purchase price 20->30 after +3kg adjustment', r.status, r.body?.error?.code ?? '');
step('edit purchase'); showItem(db, PD2.id);

log('=== PR: precision — 10kg lot @19.99 sold in 78 pieces (77 x 129g + 67g)');
const PR = await newItem(c, { name: 'T2 precision' });
await purchase(c, [{ itemId: PR.id, weightGrams: 10000, pricePerKg: 1999 }]);
G = gl(db);
let rev = 0;
for (let i = 0; i < 78; i++) {
  const g = i < 77 ? 129 : 67;
  const rr = await sale(c, [{ itemId: PR.id, weightGrams: g, pricePerKg: 2999 }]);
  if (!rr.ok) { log('sale fail', i, rr.status, JSON.stringify(rr.body)); break; }
}
step('78 small sales'); const vPR = showItem(db, PR.id);
const cogs = q1(db, `SELECT SUM(s.total_cost) c, SUM(s.total_amount) a FROM sales s JOIN sale_lines l ON l.sale_id=s.id WHERE l.item_id=?`, PR.id);
log(`  lot value 19990; Σ COGS ${cogs.c}; residue in inventory at 0 kg: ${vPR.invVal}; revenue Σ ${cogs.a} vs 10kg x 29.99 = 29990`);

log('=== CAT: delete category with items / with stock');
const cat = must(await c.post('/categories', { name: `T2 cat ${Date.now()}`, code: `T2C${Date.now() % 100000}` }), 'cat');
const ci = await newItem(c, { name: 'T2 cat item', categoryId: cat.id });
await purchase(c, [{ itemId: ci.id, weightGrams: 2000, pricePerKg: 2000 }]);
r = await c.del(`/categories/${cat.id}`);
log('delete category with stocked item', r.status, r.body?.error?.code ?? '', '| category row', JSON.stringify(q1(db, 'SELECT id, is_active FROM categories WHERE id=?', cat.id)), '| item', JSON.stringify(q1(db, 'SELECT is_active, category_id FROM items WHERE id=?', ci.id)));

log('=== BR: second branch, purchases/lots/inventory per branch');
r = await c.post('/branches', { code: `B${Date.now() % 100000}`, name: 'T2 branch 2', stockAccountId: 11 });
log('create branch (stock account 1132)', r.status, r.body?.error?.code ?? r.data?.id);
const b2 = r.data?.id;
const BR = await newItem(c, { name: 'T2 branch item' });
r = await c.post('/purchases', { supplierId: 1, branchId: b2, lines: [{ itemId: BR.id, weightGrams: 5000, pricePerKg: 2000 }], amountPaid: 0, paymentMethod: 'credit' });
log('purchase with branchId', r.status, r.body?.error?.code ?? '', '| lot branch', JSON.stringify(q(db, 'SELECT branch_id FROM inventory_lots WHERE item_id=?', BR.id)), '| inventory rows', JSON.stringify(q(db, 'SELECT branch_id, current_quantity_grams FROM inventory WHERE item_id=?', BR.id)));
r = await c.get(`/inventory?branchId=${b2}`); log('GET /inventory?branchId=b2', r.status, 'items', r.data?.items?.length ?? JSON.stringify(r.body).slice(0, 150));
r = await c.get('/inventory?branchId=1&pageSize=200'); log('GET /inventory?branchId=1', r.status, 'items', r.data?.items?.length, 'branchIds', JSON.stringify([...new Set((r.data?.items ?? []).map((x) => x.branchId))]));
log('  inventory unique key: one row per item ->', JSON.stringify(q(db, "SELECT sql FROM sqlite_master WHERE name='inventory'")[0]?.sql?.match(/item_id[^,]*UNIQUE|UNIQUE[^)]*item_id[^)]*\)/i)?.[0] ?? q(db, "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='inventory'")));

writeFileSync(new URL('./t05-edge.out.txt', import.meta.url), logLines.join('\n'));
