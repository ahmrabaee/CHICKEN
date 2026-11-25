// T2-04: wastage (lot, SLE, GL, reports, P&L) and expiry handling (sale/transfer from expired lots, alerts).
import { writeFileSync } from 'node:fs';
import { setup, gl, glDelta, showItem, itemView, newItem, purchase, sale, must, log, q, q1, logLines } from './lib.mjs';

const { c, db } = await setup('t2a', 3103);
const today = new Date().toISOString().slice(0, 10);
let G = gl(db);
const step = (label) => { const G2 = gl(db); log(`  GL delta [${label}]`, glDelta(G, G2)); G = G2; };
const waste = (b) => c.post('/wastage', { reason: 'spoiled', ...b });
const lotsOf = (id) => q(db, 'SELECT id, remaining_quantity_grams rem, unit_purchase_price p FROM inventory_lots WHERE item_id=? ORDER BY id', id);

log('=== W1: buy 10kg@20 + 10kg@30; waste 2kg from the NEWER lot; sell 15kg');
const W = await newItem(c, { name: 'T2 waste' });
await purchase(c, [{ itemId: W.id, weightGrams: 10000, pricePerKg: 2000 }]);
await purchase(c, [{ itemId: W.id, weightGrams: 10000, pricePerKg: 3000 }]);
step('purchases');
const [l1, l2] = lotsOf(W.id);
const pl0 = (await c.get(`/reports/profit-loss?startDate=${today}&endDate=${today}`)).data;
let r = await waste({ lotId: l2.id, quantityGrams: 2000 });
log('waste 2kg lot2', r.status, r.ok ? `estimatedCostValue=${r.data.estimatedCostValue}` : JSON.stringify(r.body));
const w1 = r.data;
step('wastage'); showItem(db, W.id);
log('  SLE rows for wastage:', q1(db, "SELECT COUNT(*) n FROM stock_ledger_entries WHERE voucher_type='wastage'").n);
const pl1 = (await c.get(`/reports/profit-loss?startDate=${today}&endDate=${today}`)).data;
log('  P&L before/after wastage: netProfit', pl0.netProfit, '->', pl1.netProfit, '| expenses', pl0.expenses, '->', pl1.expenses, '| GL 5300 =', gl(db)['5300']);
const wr = (await c.get(`/reports/wastage?startDate=${today}&endDate=${today}`)).data;
log('  /reports/wastage summary', JSON.stringify(wr.summary));

log('=== W2: exceed lot; zero; fractional; negative; lot of other item; delete/void endpoint');
r = await waste({ lotId: l1.id, quantityGrams: 10001 }); log('10001g from 10000g lot', r.status, r.body?.error?.code);
r = await waste({ lotId: l1.id, quantityGrams: 0.4 }); log('0.4g', r.status, r.body?.error?.code ?? `accepted weight=${r.data?.weightGrams}`);
r = await waste({ lotId: l1.id, quantityGrams: 1.5 }); log('1.5g', r.status, r.body?.error?.code ?? `accepted weight=${r.data?.weightGrams} value=${r.data?.estimatedCostValue}`);
r = await waste({ lotId: l1.id, quantityGrams: -500 }); log('-500g', r.status, r.body?.error?.code);
r = await c.del(`/wastage/${w1.id}`); log('DELETE /wastage/:id', r.status);
r = await c.post(`/wastage/${w1.id}/cancel`, {}); log('POST /wastage/:id/cancel', r.status);
r = await c.post(`/wastage/${w1.id}/approve`, {}); log('POST /wastage/:id/approve', r.status);

log('=== W3: wastage on a phantom lot (after adjustment to zero) -> inventory negative?');
const P = await newItem(c, { name: 'T2 phantom' });
await purchase(c, [{ itemId: P.id, weightGrams: 5000, pricePerKg: 2000 }]);
must(await c.post('/inventory/adjustments', { itemId: P.id, adjustmentType: 'decrease', quantityGrams: 5000, reason: 'count' }), 'adj');
step('purchase + adjust to 0'); showItem(db, P.id);
r = await waste({ lotId: lotsOf(P.id)[0].id, quantityGrams: 5000 });
log('waste 5kg of phantom lot', r.status, r.body?.error?.code ?? 'ACCEPTED');
step('waste phantom'); showItem(db, P.id);
log('  => the same 5kg expensed twice (5320 adjustment + 5300 wastage)');

log('=== E1: expired lot (via adjustment increase with past expiryDate) -> sale / transfer / alerts');
const X = await newItem(c, { name: 'T2 expired', shelf: 2 });
r = await c.post('/inventory/adjustments', { itemId: X.id, adjustmentType: 'increase', quantityGrams: 5000, unitCost: 2000, expiryDate: '2026-11-01', reason: 'opening' });
log('adjust +5kg expiry 2026-11-01', r.status, r.body?.error?.code ?? '');
await purchase(c, [{ itemId: X.id, weightGrams: 5000, pricePerKg: 2500 }]);
log('  lots', q(db, 'SELECT id, remaining_quantity_grams rem, unit_purchase_price p, expiry_date FROM inventory_lots WHERE item_id=?', X.id).map((l) => ({ ...l, expiry_date: l.expiry_date && new Date(l.expiry_date).toISOString().slice(0, 10) })));
r = await sale(c, [{ itemId: X.id, weightGrams: 3000, pricePerKg: 4000 }]);
log('sale 3kg', r.status, r.ok ? 'ACCEPTED' : r.body?.error?.code, 'allocations', r.ok ? q(db, 'SELECT a.lot_id, a.quantity_allocated_grams g FROM sale_line_cost_allocations a JOIN sale_lines l ON l.id=a.sale_line_id WHERE l.sale_id=?', r.data.id) : '');
const expLot = q1(db, "SELECT id FROM inventory_lots WHERE item_id=? AND lot_number LIKE 'LOT-ADJ%'", X.id).id;
r = await c.post('/stock-transfer', { sourceLotId: expLot, lines: [{ itemId: W.id, weightGrams: 1000, unitCost: 2000 }] });
log('transfer from expired lot', r.status, r.ok ? `dest expiry ${r.data.expiryDate}` : r.body?.error?.code);
for (const d of [undefined, 0, 1, 7, 30]) {
  r = await c.get(`/inventory/expiring${d === undefined ? '' : '?days=' + d}`);
  log(`GET /inventory/expiring days=${d}`, r.status, Array.isArray(r.data) ? `${r.data.length} lots: ${r.data.map((x) => `${x.lotNumber}(${x.daysUntilExpiry}d)`).join(',')}` : JSON.stringify(r.body).slice(0, 200));
}
r = await c.get('/inventory/low-stock'); log('GET /inventory/low-stock', r.status, Array.isArray(r.data) ? r.data.length + ' items: ' + r.data.map((x) => `${x.itemId}:${x.currentQuantityGrams}/${x.minStockLevel}`).join(',') : '');
r = await c.get('/reports/dashboard'); log('dashboard lowStockCount', r.data?.inventory?.lowStockCount);

const svg = (await c.get('/reports/stock-vs-gl')).data;
log('stock-vs-gl summary', JSON.stringify(svg.summary), 'wastage rows', JSON.stringify(svg.rows.filter((x) => x.voucherType === 'wastage')));
writeFileSync(new URL('./t04-wastage-expiry.out.txt', import.meta.url), logLines.join('\n'));
