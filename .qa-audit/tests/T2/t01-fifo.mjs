// T2-01: Full FIFO scenario: 3 purchases at different costs, sales spanning lots, void, credit note, reports.
import { writeFileSync } from 'node:fs';
import { setup, gl, glDelta, showItem, itemView, newItem, purchase, sale, must, log, q, q1, logLines } from './lib.mjs';

const { c, db } = await setup('t2a', 3103);
const today = new Date().toISOString().slice(0, 10);
const G0 = gl(db);
const it = await newItem(c, { name: 'T2 FIFO item', sale: 3000, purchase: 2000 });
log('item', it.id, 'inventory after create:'); showItem(db, it.id);

const p1 = await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 2000 }]);
const p2 = await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 2200 }]);
const p3 = await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 2500 }]);
log('3 purchases 10kg @20.00/22.00/25.00 ->', p1.purchaseNumber ?? p1.id, p2.purchaseNumber ?? p2.id, p3.purchaseNumber ?? p3.id);
showItem(db, it.id, 'after purchases');
let G1 = gl(db); log('GL delta purchases', glDelta(G0, G1));

// Sale A 15 kg -> expect 10kg@2000 + 5kg@2200 = 20000 + 11000 = 31000
let r = await sale(c, [{ itemId: it.id, weightGrams: 15000, pricePerKg: 3000 }]);
const sA = must(r, 'sale A');
const allocA = q(db, `SELECT a.lot_id, a.quantity_allocated_grams g, a.unit_cost, a.total_cost FROM sale_line_cost_allocations a JOIN sale_lines l ON l.id=a.sale_line_id WHERE l.sale_id=?`, sA.id);
log('Sale A 15kg @30: totalCost', q1(db, 'SELECT total_cost FROM sales WHERE id=?', sA.id).total_cost, 'expected 31000; allocations', allocA);
let G2 = gl(db); log('GL delta sale A', glDelta(G1, G2));
showItem(db, it.id, 'after sale A');

// Sale B 8 kg -> 5kg@2200 + 3kg@2500 = 11000 + 7500 = 18500
r = await sale(c, [{ itemId: it.id, weightGrams: 8000, pricePerKg: 3000 }]);
const sB = must(r, 'sale B');
log('Sale B 8kg: totalCost', q1(db, 'SELECT total_cost FROM sales WHERE id=?', sB.id).total_cost, 'expected 18500');
let G3 = gl(db); log('GL delta sale B', glDelta(G2, G3));
showItem(db, it.id, 'after sale B');

// Void Sale A -> lots back to lot1 +10kg, lot2 +5kg; value +31000
r = await c.post(`/sales/${sA.id}/void`, { reason: 'T2 test void' });
log('void A', r.status, r.ok ? '' : JSON.stringify(r.body));
let G4 = gl(db); log('GL delta void A', glDelta(G3, G4));
showItem(db, it.id, 'after void A');
log('  avg cost after void (not recomputed?)', itemView(db, it.id).avg, 'expected', Math.round(itemView(db, it.id).invVal * 1000 / itemView(db, it.id).invQty));

// Sale C 4kg -> should take restored oldest lot @2000 -> 8000
r = await sale(c, [{ itemId: it.id, weightGrams: 4000, pricePerKg: 3000 }]);
const sC = must(r, 'sale C');
log('Sale C 4kg after void: totalCost', q1(db, 'SELECT total_cost FROM sales WHERE id=?', sC.id).total_cost, 'expected 8000 (restored lot1)');
showItem(db, it.id, 'after sale C');

// Credit note on sale B (full amount) -> does stock come back?
const totB = q1(db, 'SELECT total_amount FROM sales WHERE id=?', sB.id).total_amount;
r = await c.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: sB.id, amount: totB, reason: 'T2 return' });
log('credit note create', r.status, JSON.stringify(r.data ?? r.body).slice(0, 200));
const cn = r.data;
if (cn?.id) {
  const rs = await c.post(`/credit-notes/${cn.id}/submit`, {});
  log('credit note submit', rs.status, JSON.stringify(rs.body).slice(0, 200));
}
let G5 = gl(db); log('GL delta credit note', glDelta(G4, G5));
showItem(db, it.id, 'after CN on sale B');

// Reports
const inv = await c.get(`/inventory/${it.id}`); log('GET /inventory/:id', JSON.stringify(inv.data));
const lots = await c.get(`/inventory/${it.id}/lots`); log('GET lots', JSON.stringify(lots.data));
const pl = await c.get(`/reports/profit-loss?startDate=${today}&endDate=${today}`); log('P&L', JSON.stringify(pl.data));
const sales = q(db, 'SELECT id, sale_number, total_amount, total_cost, total_profit, is_voided FROM sales WHERE id IN (?,?,?)', sA.id, sB.id, sC.id); log('sales rows', sales);
const svg = await c.get('/reports/stock-vs-gl'); log('stock-vs-gl summary', JSON.stringify(svg.data?.summary));
const G6 = gl(db); log('GL total delta (whole script)', glDelta(G0, G6));
const v = itemView(db, it.id);
log('FINAL item inv value', v.invVal, 'lot value', v.lotVal, '| GL 1131 delta', (G6['1131'] ?? 0) - (G0['1131'] ?? 0), '| COGS 5100 delta', (G6['5100'] ?? 0) - (G0['5100'] ?? 0));
writeFileSync(new URL('./t01-fifo.out.txt', import.meta.url), logLines.join('\n'));
