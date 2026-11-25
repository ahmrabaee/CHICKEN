// T6-01: N concurrent cashiers sell the LAST 1 kg of the same item. Expect exactly one success.
// usage: node 01-oversell-race.mjs [itemId] [N]
import { connect, meta, q, one, invariants, snapshot, delta, tee, outFor } from './lib.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const itemId = Number(process.argv[2] ?? 6);
const N = Number(process.argv[3] ?? 10);
const c = await connect(m.baseUrl, 'admin', 'admin123');
// second session to emulate another cashier (same user token is fine for the race; we also login twice)
const c2 = await connect(m.baseUrl, 'admin', 'admin123');

const price = one(m.db, 'select default_sale_price p from items where id=?', itemId).p || 3000;
let inv = one(m.db, 'select current_quantity_grams q from inventory where item_id=?', itemId).q;
log(`item ${itemId} stock before prep = ${inv} g, price/kg=${price}`);
// Prep: sell down to exactly 1000 g
if (inv > 1000) {
  const g = inv - 1000;
  const amt = Math.round(g / 1000 * price);
  const r = await c.post('/sales', { saleType: 'cash', lines: [{ itemId, weightGrams: g, pricePerKg: price }], payments: [{ paymentMethod: 'cash', amount: amt }] });
  log('prep sale', r.status, r.data?.saleNumber ?? JSON.stringify(r.body).slice(0, 200));
}
inv = one(m.db, 'select current_quantity_grams q from inventory where item_id=?', itemId).q;
log(`stock now ${inv} g; lots:`, q(m.db, 'select id,lot_number,remaining_quantity_grams r from inventory_lots where item_id=? and remaining_quantity_grams<>0', itemId));
const before = snapshot(m.db);
const W = Number(process.argv[4] ?? 1000); const amt = Math.round(W / 1000 * price);
const body = { saleType: 'cash', lines: [{ itemId, weightGrams: Number(process.argv[4] ?? 1000), pricePerKg: price }], payments: [{ paymentMethod: 'cash', amount: amt }] };
const t0 = Date.now();
const res = await Promise.all(Array.from({ length: N }, (_, i) => (i % 2 ? c2 : c).post('/sales', body)));
log(`fired ${N} parallel 1kg sales in ${Date.now() - t0} ms`);
const tally = {};
for (const r of res) {
  const k = r.status + ' ' + (r.ok ? 'OK' : (r.body?.error?.code ?? JSON.stringify(r.body).slice(0, 120)));
  tally[k] = (tally[k] ?? 0) + 1;
}
log('result tally:', tally);
const okSales = res.filter((r) => r.ok).map((r) => r.data.saleNumber);
log('successful sale numbers:', okSales);
const after = snapshot(m.db);
log('GL/count deltas:', delta(before, after));
log('inventory after:', one(m.db, 'select current_quantity_grams q,total_value v from inventory where item_id=?', itemId));
log('lots after:', q(m.db, 'select id,lot_number,remaining_quantity_grams r from inventory_lots where item_id=?', itemId));
const sold = okSales.length * W;
log(`OVERSOLD grams = ${Math.max(0, sold - inv)} (sold ${sold} g of ${inv} g available)`);
log('invariants:', JSON.stringify(invariants(m.db), null, 1));
log.save();
