// T2-03: stock transfer (cutting) — value conservation, yield, FIFO dates, races, chains, purchase delete.
import { writeFileSync } from 'node:fs';
import { setup, gl, glDelta, showItem, itemView, newItem, purchase, sale, must, log, q, q1, logLines } from './lib.mjs';

const { c, db } = await setup('t2a', 3103);
let G = gl(db);
const step = (label) => { const G2 = gl(db); log(`  GL delta [${label}]`, glDelta(G, G2)); G = G2; };
const xfer = (b) => c.post('/stock-transfer', b);
const lotOf = (purchaseId) => q1(db, 'SELECT id, expiry_date, received_at, remaining_quantity_grams rem FROM inventory_lots WHERE purchase_id=?', purchaseId);
const lastSale = (r) => (r.ok ? q1(db, 'SELECT total_cost FROM sales WHERE id=?', r.data.id).total_cost : JSON.stringify(r.body?.error));

// fresh destination items so we can measure cleanly
const RAW = 1; // seed raw chicken (sale price 0, purchase 18.00)
const breast = await newItem(c, { name: 'T2 breast', sale: 3500, purchase: 2800 });
const thigh = await newItem(c, { name: 'T2 thigh', sale: 2800, purchase: 2200 });
const wing = await newItem(c, { name: 'T2 wing', sale: 2600, purchase: 2000 });
const skewer = await newItem(c, { name: 'T2 skewer', sale: 3000, purchase: 2400 });

log('=== T1: raw 10kg @18.00 -> breast 4kg@28 + thigh 3kg@22 + wing 2kg@20 (UI-default costs), 1kg bone loss not entered');
const p = await purchase(c, [{ itemId: RAW, weightGrams: 10000, pricePerKg: 1800 }]);
step('purchase raw');
const src = lotOf(p.id);
log('  source lot', src);
let r = await xfer({ sourceLotId: src.id, lines: [
  { itemId: breast.id, weightGrams: 4000, unitCost: 2800 },
  { itemId: thigh.id, weightGrams: 3000, unitCost: 2200 },
  { itemId: wing.id, weightGrams: 2000, unitCost: 2000 },
] });
log('transfer', r.status, r.ok ? `${r.data.transferNumber} status=${r.data.status} totalCostValue=${r.data.totalCostValue}` : JSON.stringify(r.body));
const t1 = r.data;
step('transfer T1');
showItem(db, RAW, 'raw'); showItem(db, breast.id, 'breast'); showItem(db, thigh.id, 'thigh'); showItem(db, wing.id, 'wing');
log('  JE for transfer:', q(db, "SELECT id, source_type FROM journal_entries WHERE source_type LIKE '%transfer%'").length);
const destLots = q(db, 'SELECT id, item_id, received_at, expiry_date, unit_purchase_price FROM inventory_lots WHERE stock_transfer_id=?', t1.id);
log('  source lot received_at', new Date(src.received_at).toISOString(), 'expiry', src.expiry_date && new Date(src.expiry_date).toISOString());
log('  dest lots', destLots.map((l) => ({ ...l, received_at: new Date(l.received_at).toISOString(), expiry_date: l.expiry_date && new Date(l.expiry_date).toISOString() })));
const srcVal = Math.round(9000 * 1800 / 1000), dstVal = 11200 + 6600 + 4000;
log(`  value consumed from source ${srcVal}; value created in destinations ${dstVal}; created-from-nothing ${dstVal - srcVal}; 1kg loss remains in source lot (rem ${lotOf(p.id).rem}g)`);

// sell all breast at FIFO -> COGS 11200 though GL only ever held 18000 for the whole bird
r = await sale(c, [{ itemId: breast.id, weightGrams: 4000, pricePerKg: 3500 }]);
log('sell 4kg breast: COGS', lastSale(r));
step('sale breast');

log('=== T2: conservation-respecting transfer (allocate 18000 over 9kg = 2000/kg) still leaves 1kg loss at cost in raw lot');
const p2 = await purchase(c, [{ itemId: RAW, weightGrams: 10000, pricePerKg: 1800 }]);
const src2 = lotOf(p2.id);
r = await xfer({ sourceLotId: src2.id, lines: [{ itemId: thigh.id, weightGrams: 7000, unitCost: 2571 }] });
log('transfer 10kg-lot -> 7kg thigh @25.71 (whole bird cost / 7kg)', r.status, r.ok ? `consumed only 7kg; raw lot rem ${lotOf(p2.id).rem}g` : JSON.stringify(r.body));
step('transfer T2 (yield)');
showItem(db, RAW, 'raw');

log('=== T3: over-transfer and concurrent transfers from the same lot');
const p3 = await purchase(c, [{ itemId: RAW, weightGrams: 10000, pricePerKg: 1800 }]);
const src3 = lotOf(p3.id);
r = await xfer({ sourceLotId: src3.id, lines: [{ itemId: wing.id, weightGrams: 10001, unitCost: 1800 }] });
log('transfer 10001g from 10000g lot', r.status, r.body?.error?.code);
const [ra, rb] = await Promise.all([
  xfer({ sourceLotId: src3.id, lines: [{ itemId: wing.id, weightGrams: 8000, unitCost: 1800 }] }),
  xfer({ sourceLotId: src3.id, lines: [{ itemId: skewer.id, weightGrams: 8000, unitCost: 1800 }] }),
]);
log('concurrent 2x8kg from 10kg lot:', ra.status, ra.body?.error?.code ?? '', rb.status, rb.body?.error?.code ?? '');
log('  raw lot remaining now', lotOf(p3.id).rem);
step('T3');
showItem(db, RAW, 'raw');

log('=== T4: chain breast -> skewer at unitCost 0 (value destroyed), and transfer to the SAME item at higher cost (revaluation)');
const p4 = await purchase(c, [{ itemId: breast.id, weightGrams: 5000, pricePerKg: 2800 }]);
const src4 = lotOf(p4.id);
r = await xfer({ sourceLotId: src4.id, lines: [{ itemId: skewer.id, weightGrams: 2000, unitCost: 0 }] });
log('breast 2kg -> skewer @0', r.status, r.body?.error?.code ?? '');
r = await xfer({ sourceLotId: src4.id, lines: [{ itemId: breast.id, weightGrams: 3000, unitCost: 9999 }] });
log('breast 3kg -> breast @99.99', r.status, r.body?.error?.code ?? '');
step('T4');
showItem(db, breast.id, 'breast'); showItem(db, skewer.id, 'skewer');

log('=== T5: delete / edit the source purchase after transfer');
r = await c.del(`/purchases/${p.id}`);
log('delete source purchase', r.status, r.body?.error?.code ?? '');
r = await c.put(`/purchases/${p.id}`, { supplierId: 1, lines: [{ itemId: RAW, weightGrams: 10000, pricePerKg: 1000 }] });
log('edit source purchase price', r.status, r.body?.error?.code ?? '');

log('=== T6: transfer to inactive item, to non-existent item, to non-existent branch');
const dead = await newItem(c, { name: 'T2 dead' });
// give it history so delete = deactivate
must(await c.post('/inventory/adjustments', { itemId: dead.id, adjustmentType: 'increase', quantityGrams: 1000, unitCost: 1000, reason: 'x' }), 'adj');
r = await c.del(`/items/${dead.id}`); log('deactivate item', r.status, 'isActive=', q1(db, 'SELECT is_active FROM items WHERE id=?', dead.id).is_active);
const p6 = await purchase(c, [{ itemId: RAW, weightGrams: 5000, pricePerKg: 1800 }]);
const src6 = lotOf(p6.id);
r = await xfer({ sourceLotId: src6.id, lines: [{ itemId: dead.id, weightGrams: 1000, unitCost: 1800 }] });
log('transfer -> inactive item', r.status, r.body?.error?.code ?? 'ACCEPTED');
r = await sale(c, [{ itemId: dead.id, weightGrams: 500, pricePerKg: 3000 }]);
log('sell inactive item', r.status, r.body?.error?.code ?? 'ACCEPTED');
r = await xfer({ sourceLotId: src6.id, lines: [{ itemId: 99999, weightGrams: 1000, unitCost: 1800 }] });
log('transfer -> item 99999', r.status, r.body?.error?.code ?? '');
r = await xfer({ sourceLotId: src6.id, branchId: 999, lines: [{ itemId: wing.id, weightGrams: 1000, unitCost: 1800 }] });
log('transfer branchId 999', r.status, r.body?.error?.code ?? '');

const svg = await c.get('/reports/stock-vs-gl');
log('stock-vs-gl summary', JSON.stringify(svg.data?.summary));
log('stock-vs-gl transfer rows', JSON.stringify((svg.data?.rows ?? []).filter((x) => x.voucherType === 'transfer')));
const statuses = q(db, 'SELECT transfer_number, status, total_weight_grams, total_cost_value FROM stock_transfers');
log('transfers', statuses);
const g = gl(db);
const ids = [RAW, breast.id, thigh.id, wing.id, skewer.id, dead.id];
const invTot = q1(db, `SELECT SUM(total_value) v FROM inventory WHERE item_id IN (${ids})`).v;
const lotTot = q1(db, `SELECT SUM(ROUND(remaining_quantity_grams*unit_purchase_price/1000.0)) v FROM inventory_lots WHERE item_id IN (${ids})`).v;
log('FINAL GL 1131', g['1131'], '| Σinventory.total_value', invTot, '| Σlot value', lotTot);
for (const id of ids) showItem(db, id);
writeFileSync(new URL('./t03-transfer.out.txt', import.meta.url), logLines.join('\n'));
