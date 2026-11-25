// R1-05: stock transfer value conservation (QA-044/045), costs 0 / 99.99, rounding, zero-cost source, same-item, races, numbering
import { setup, glx, dl, jeCheck, L, errc, log, saveLog, must, q, q1, newItem, purchase, sale, showItem } from './lib2.mjs';
const { c, db } = await setup();
const xfer = (b) => c.post('/stock-transfer', b);
const lotOf = (pid) => q1(db, 'select id, remaining_quantity_grams rem, unit_purchase_price p, expiry_date, received_at from inventory_lots where purchase_id=?', pid);
const val = (id) => q1(db, 'select current_quantity_grams q, total_value v from inventory where item_id=?', id);
const RAW = 1;
const dest = [];
for (const n of ['breast', 'thigh', 'wing', 'skew']) dest.push(await newItem(c, { name: 'R1 ' + n, sale: 3000, purchase: 2000 }));
const [breast, thigh, wing, skew] = dest;
const destVal = (ids) => ids.reduce((s, i) => s + (val(i)?.v ?? 0), 0);

async function scenario(label, lines, rawG = 10000, rawPrice = 1800) {
  const p = await purchase(c, [{ itemId: RAW, weightGrams: rawG, pricePerKg: rawPrice }]);
  const src = lotOf(p.id);
  const G0 = glx(db); const v0 = destVal(lines.map((l) => l.itemId)); const rawBefore = val(RAW);
  const r = await xfer({ sourceLotId: src.id, lines });
  const consumed = lines.reduce((s, l) => s + l.weightGrams, 0);
  const srcAfter = lotOf(p.id);
  const created = destVal(lines.map((l) => l.itemId)) - v0;
  const removed = Math.round(consumed * rawPrice / 1000);
  log(`${label}: ${errc(r)} status=${r.data?.status} totalCostValue=${r.data?.totalCostValue}`);
  log(`   source consumed ${consumed}g value ${removed}; destination value created ${created}; delta ${created - removed}; GL ${JSON.stringify(dl(G0, glx(db)))}`);
  if (r.ok) log('   dest lots', JSON.stringify(q(db, 'select item_id, remaining_quantity_grams r, unit_purchase_price p from inventory_lots where stock_transfer_id=?', r.data.id)), 'source lot rem', srcAfter.rem);
  const rawNow = val(RAW);
  log(`   raw inventory ${JSON.stringify(rawBefore)} -> ${JSON.stringify(rawNow)}`);
  return r;
}

log('=== T1 UI-default client costs (28/22/20) 4+3+2 kg from 10kg@18.00');
await scenario('T1', [{ itemId: breast.id, weightGrams: 4000, unitCost: 2800 }, { itemId: thigh.id, weightGrams: 3000, unitCost: 2200 }, { itemId: wing.id, weightGrams: 2000, unitCost: 2000 }]);
log('=== T2 all costs 0');
await scenario('T2', [{ itemId: breast.id, weightGrams: 4000, unitCost: 0 }, { itemId: thigh.id, weightGrams: 5000, unitCost: 0 }]);
log('=== T3 costs 99.99 (9999)');
await scenario('T3', [{ itemId: breast.id, weightGrams: 4000, unitCost: 9999 }, { itemId: thigh.id, weightGrams: 5000, unitCost: 9999 }]);
log('=== T4 odd weights 333g+333g+334g from 1kg @ 18.01 (rounding)');
await scenario('T4', [{ itemId: breast.id, weightGrams: 333, unitCost: 2000 }, { itemId: thigh.id, weightGrams: 333, unitCost: 2000 }, { itemId: wing.id, weightGrams: 334, unitCost: 2000 }], 1000, 1801);
log('=== T5 source lot cost 0 (free stock) -> dest');
{
  const it0 = await newItem(c, { name: 'R1 freeraw', sale: 0, purchase: 0 });
  const r0 = await c.post('/items', { code: 'R1-FREE', name: 'R1 free src', categoryId: 3, defaultSalePrice: 3000, defaultPurchasePrice: 0, initialQuantityGrams: 5000, initialCostPrice: 0 });
  const lot = q1(db, 'select id from inventory_lots where item_id=?', r0.data.id);
  const G0 = glx(db);
  const r = await xfer({ sourceLotId: lot.id, lines: [{ itemId: breast.id, weightGrams: 5000, unitCost: 2800 }] });
  log('transfer 5kg of zero-cost lot with client cost 28.00', errc(r), 'dest lot price', JSON.stringify(q(db, 'select unit_purchase_price p from inventory_lots where stock_transfer_id=?', r.data?.id)), 'GL', JSON.stringify(dl(G0, glx(db))));
}
log('=== T6 same-item transfer (source item = destination)');
{
  const p = await purchase(c, [{ itemId: RAW, weightGrams: 10000, pricePerKg: 1800 }]);
  const src = lotOf(p.id);
  const r = await xfer({ sourceLotId: src.id, lines: [{ itemId: RAW, weightGrams: 5000, unitCost: 4000 }] });
  log('same-item, client cost 40.00', errc(r), JSON.stringify(q(db, 'select item_id, unit_purchase_price p from inventory_lots where stock_transfer_id=?', r.data?.id)));
  showItem(db, RAW, 'raw');
}
log('=== T7 sale profit after transfer: sell 4kg breast sale price 30; true cost?');
{
  const p = await purchase(c, [{ itemId: RAW, weightGrams: 10000, pricePerKg: 1800 }]);
  const src = lotOf(p.id);
  const bn = await newItem(c, { name: 'R1 breastX', sale: 3500 });
  const r = await xfer({ sourceLotId: src.id, lines: [{ itemId: bn.id, weightGrams: 9000, unitCost: 2800 }] });
  const s = await sale(c, [L(bn.id, 9000, 3500)]);
  log('9kg of 10kg raw -> breast; sell 9kg', errc(s), 'COGS', q1(db, 'select total_cost t from sales where id=?', s.data?.id).t, '(= 16200 source cost of 9kg @18) ; 1kg remains in raw lot', lotOf(p.id).rem);
}
log('=== T8 concurrent transfers from same lot');
{
  const p = await purchase(c, [{ itemId: RAW, weightGrams: 10000, pricePerKg: 1800 }]);
  const src = lotOf(p.id);
  const rs = await Promise.all([wing, skew].map((d) => xfer({ sourceLotId: src.id, lines: [{ itemId: d.id, weightGrams: 8000, unitCost: 1800 }] })));
  log('two parallel 8kg transfers from 10kg lot', rs.map(errc).join(' | '), 'source rem', lotOf(p.id).rem);
}
log('=== T9 numbering after transfer delete (is there a delete?)');
{
  const t = q(db, 'select id, transfer_number from stock_transfers order by id');
  log('transfers', JSON.stringify(t.slice(-3)));
  log('delete route', (await c.del(`/stock-transfer/${t[0].id}`)).status);
}
log('JE unbalanced', JSON.stringify(jeCheck(db)));
saveLog('05-transfer');
