import * as L from './lib.mjs';
const a = await L.admin();
let k = 0;
const newItem = async () => { const r = await a.post('/items', { name: `V1 item ${Date.now()}${k++}`, categoryId: 1, defaultSalePrice: 5000 }); if (!r.ok) throw new Error(JSON.stringify(r.body)); return r.data.id; };
const sell = async (item, g, cust) => a.post('/sales', { saleType: 'cash', lines: [{ itemId: item, weightGrams: g, pricePerKg: 5000 }], payments: [{ amount: Math.round(g * 5), paymentMethod: 'cash' }] });
const adj = (item, type, g, extra = {}) => a.post('/inventory/adjustments', { itemId: item, adjustmentType: type, quantityGrams: g, reason: 'v1', ...extra });
const state = (tag, item) => L.say(tag, { inv: L.invOf(item), lots: L.lotsOf(item).map(l => `${l.id}:${l.rem}@${l.cost}`), sumLots: L.lotsOf(item).reduce((s, l) => s + l.rem, 0), sumLotVal: L.lotsOf(item).reduce((s, l) => s + Math.round(l.rem * l.cost / 1000), 0) });

// A
{ const it = await newItem(); await L.buy(a, it, 10000, 2000); await L.buy(a, it, 10000, 3000);
  const g0 = L.snap(); const s1 = await sell(it, 5000); L.say('A sale 5kg', [L.st(s1), L.saleRow(s1.data.id).c]);
  const g1 = L.snap(); const r = await adj(it, 'decrease', 5000); L.say('A adjust -5kg', L.st(r)); L.say('A adj GL delta', L.delta(g1, L.snap()));
  state('A after adjust', it);
  const s2 = await sell(it, 10000); L.say('A sale 10kg', [L.st(s2), s2.ok && L.saleRow(s2.data.id).c]);
  state('A end', it); L.say('A GL1131 delta total vs start', L.delta(g0, L.snap())['1131']);
}
// D
{ const it = await newItem(); await L.buy(a, it, 10000, 2000);
  await sell(it, 3000); const r1 = await adj(it, 'decrease', 7000); L.say('D adj -7kg', L.st(r1));
  state('D after zero-out', it);
  const r2 = await adj(it, 'increase', 5000, { unitCost: 2500 }); L.say('D adj +5kg@25', L.st(r2)); state('D after increase', it);
  const s = await sell(it, 5000); L.say('D sale 5kg COGS (exp 12500 if new lot cost, 10000 if old lot)', [L.st(s), s.ok && L.saleRow(s.data.id).c]);
  state('D end', it); L.say('D GL1131 for item? (inventory.total_value vs lots)', '');
}
// B increase without cost
{ const it = await newItem(); await L.buy(a, it, 10000, 2000);
  const g = L.snap(); const r = await adj(it, 'increase', 5000); L.say('B adj +5kg no cost', L.st(r)); L.say('B GL delta', L.delta(g, L.snap())); state('B after', it);
  const s = await sell(it, 15000); L.say('B sell 15kg', L.st(s)); }
// E decrease with lotId
{ const it = await newItem(); await L.buy(a, it, 10000, 2000); const lot = L.lotsOf(it)[0];
  const r = await adj(it, 'decrease', 2000, { lotId: lot.id }); L.say('E adj -2kg w/ lotId', L.st(r)); state('E after', it);
  const other = await newItem(); await L.buy(a, other, 5000, 2000);
  const r2 = await adj(other, 'decrease', 1000, { lotId: lot.id }); L.say('E lotId of another item accepted?', L.st(r2)); }

// T2-005 transfer
{ const raw = await newItem(); await L.buy(a, raw, 10000, 1800);
  const tgt1 = await newItem(), tgt2 = await newItem(), tgt3 = await newItem();
  const lot = L.lotsOf(raw)[0];
  const g = L.snap(); const invGl = () => L.glOf('1131');
  const t = await a.post('/stock-transfer', { sourceLotId: lot.id, lines: [{ itemId: tgt1, weightGrams: 4000, unitCost: 2800 }, { itemId: tgt2, weightGrams: 3000, unitCost: 2200 }, { itemId: tgt3, weightGrams: 2000, unitCost: 2000 }] });
  L.say('T2-005 transfer', [L.st(t), t.data?.status]);
  const dest = [tgt1, tgt2, tgt3].map(i => L.lotsOf(i)[0]).map(l => Math.round(l.rem * l.cost / 1000));
  const srcVal = Math.round(9000 * 1800 / 1000);
  L.say('T2-005 src consumed value (9kg@18)', srcVal); L.say('T2-005 dest values', dest); L.say('T2-005 dest sum - src', dest.reduce((a, b) => a + b, 0) - srcVal);
  L.say('T2-005 GL delta (exp {})', L.delta(g, L.snap()));
  L.say('T2-005 JEs with transfer source', L.sql(`select count(*) c from journal_entries where source_type like '%transfer%'`));
  const r2 = await a.post('/stock-transfer', { sourceLotId: L.lotsOf(tgt1)[0].id, lines: [{ itemId: tgt1, weightGrams: 3000, unitCost: 9999 }] });
  L.say('T2-005 same-item revalue @99.99', [L.st(r2), L.lotsOf(tgt1).map(l => `${l.id}:${l.rem}@${l.cost}`)]);
  const r3 = await a.post('/stock-transfer', { sourceLotId: L.lotsOf(tgt2)[0].id, lines: [{ itemId: tgt3, weightGrams: 1000, unitCost: 0 }] });
  L.say('T2-005 cost 0 accepted', L.st(r3));
}
