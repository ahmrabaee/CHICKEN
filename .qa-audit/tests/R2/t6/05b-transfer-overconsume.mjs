// T6-05b: two stock transfers from the same lot, second one delayed by d ms (to dodge the TR number collision),
// each asking 6000 g of a 10000 g lot. Any run with 2×201 = over-consumption (negative lot).
import { connect, meta, q, one, tee, outFor, sleep } from './lib.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const c = await connect(m.baseUrl, 'admin', 'admin123');
const c2 = await connect(m.baseUrl, 'admin', 'admin123');
let over = 0;
for (const d of [0, 3, 6, 9, 12, 15, 20, 25, 30, 40]) {
  const p = await c.post('/purchases', { supplierId: 1, lines: [{ itemId: 5, weightGrams: 10000, pricePerKg: 1500 }], notes: 'T6 05b ' + d });
  if (!p.ok) { log('purchase failed', p.status, JSON.stringify(p.body).slice(0, 150)); await sleep(200); continue; }
  const lot = one(m.db, 'select id,remaining_quantity_grams r from inventory_lots where purchase_id=?', p.data.id);
  const body = { sourceLotId: lot.id, lines: [{ itemId: 6, weightGrams: 6000, pricePerKg: undefined, unitCost: 1500 }] };
  delete body.lines[0].pricePerKg;
  const [r1, r2] = await Promise.all([c.post('/stock-transfer', body), sleep(d).then(() => c2.post('/stock-transfer', body))]);
  const after = one(m.db, 'select remaining_quantity_grams r from inventory_lots where id=?', lot.id).r;
  const ok = [r1, r2].filter((r) => r.ok).length;
  if (ok === 2) over++;
  log(`d=${d}ms: ${r1.status}${r1.ok ? '' : ' ' + r1.body?.error?.code} / ${r2.status}${r2.ok ? '' : ' ' + r2.body?.error?.code}; lot ${lot.id} 10000 -> ${after} g`);
  await sleep(200);
}
log(`runs with BOTH transfers accepted (lot over-consumed): ${over}`);
log('negative lots now:', q(m.db, 'select id,lot_number,remaining_quantity_grams r from inventory_lots where remaining_quantity_grams<0'));
log.save();
