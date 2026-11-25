// T6-05: parallel creation of purchases / expenses / stock transfers (same source lot) / advance payments.
// Checks number collisions (count-based numbering outside tx) and over-consumption of a source lot.
import { connect, meta, q, one, tee, outFor, sleep } from './lib.mjs';
import { openDb, snapshot, diff, formatDiff } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/invariants.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const cs = [await connect(m.baseUrl, 'admin', 'admin123'), await connect(m.baseUrl, 'admin', 'admin123'), await connect(m.baseUrl, 'admin', 'admin123')];
const snap = () => snapshot(openDb(m.db));
const N = Number(process.argv[2] ?? 5);
const tally = (res) => { const t = {}; for (const r of res) { const k = r.status + (r.ok ? '' : ' ' + (r.body?.error?.code ?? JSON.stringify(r.body).slice(0, 100))); t[k] = (t[k] ?? 0) + 1; } return t; };
const fire = (path, mk) => Promise.all(Array.from({ length: N }, (_, i) => cs[i % 3].post(path, mk(i))));

// purchases (credit, no payment)
let res = await fire('/purchases', (i) => ({ supplierId: 1, lines: [{ itemId: 2, weightGrams: 10000, pricePerKg: 1500 }], notes: 'T6 par ' + i }));
log(`purchases x${N}:`, tally(res), res.filter((r) => r.ok).map((r) => r.data.purchaseNumber));
log('  lots created:', q(m.db, `select lot_number from inventory_lots where purchase_id in (select id from purchases where notes like 'T6 par %')`).map((r) => r.lot_number));
await sleep(300);
// expenses (cash; shop has cash from earlier sales)
res = await fire('/expenses', (i) => ({ categoryId: 1, description: 'T6 par exp ' + i, amount: 100, paymentMethod: 'cash' }));
log(`expenses x${N}:`, tally(res), res.filter((r) => r.ok).map((r) => r.data.expenseNumber));
await sleep(300);
// stock transfers from the SAME source lot, each asking for 60% of it
const lot = one(m.db, `select id,lot_number,remaining_quantity_grams r from inventory_lots where purchase_id in (select id from purchases where notes like 'T6 par %') and remaining_quantity_grams>0 order by id limit 1`);
log('source lot', lot);
const w = Math.floor(lot.r * 0.6);
const b = snap();
res = await fire('/stock-transfer', (i) => ({ sourceLotId: lot.id, lines: [{ itemId: 3, weightGrams: w, unitCost: 1500 }], notes: 'T6 par tr ' + i }));
const okT = res.filter((r) => r.ok).length;
log(`transfers x${N} of ${w} g each from lot with ${lot.r} g:`, tally(res));
log(`  source lot after:`, one(m.db, 'select remaining_quantity_grams r from inventory_lots where id=?', lot.id), `consumed ${okT * w} g of ${lot.r} → OVER-CONSUMED ${Math.max(0, okT * w - lot.r)} g`);
log('  delta:\n' + formatDiff(diff(b, snap())));
await sleep(300);
// advance payments (customer receipts — no balance guard)
res = await fire('/payments/advance', (i) => ({ partyType: 'customer', partyId: 3, amount: 100, paymentMethod: 'cash', notes: 'T6 adv ' + i }));
log(`advance payments x${N}:`, tally(res), res.filter((r) => r.ok).map((r) => r.data?.paymentNumber ?? r.data?.payment?.paymentNumber));
log('NUM duplicates:', JSON.stringify(['purchase_number:purchases', 'expense_number:expenses', 'transfer_number:stock_transfers', 'payment_number:payments', 'lot_number:inventory_lots', 'entry_number:journal_entries']
  .map((s) => { const [c, t] = s.split(':'); return [t, q(m.db, `select ${c} v,count(*) n from ${t} group by ${c} having n>1`)]; }).filter(([, r]) => r.length)));
log.save();
