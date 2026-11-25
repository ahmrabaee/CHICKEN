// T6-02: how many concurrent POS sales (each legit, plenty of stock) before the backend returns 5xx?
// Each round fires N parallel 10 g cash sales of item 4. Measures status tally + max latency, checks invariants.
import { connect, meta, one, invariants, snapshot, delta, tee, outFor, sleep } from './lib.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const itemId = Number(process.argv[2] ?? 4);
const Ns = (process.argv[3] ?? '1,2,3,4,5,6,8,10,12,15').split(',').map(Number);
const clients = [];
for (let i = 0; i < 3; i++) clients.push(await connect(m.baseUrl, 'admin', 'admin123'));
const price = one(m.db, 'select default_sale_price p from items where id=?', itemId).p;
const W = 10; const amt = Math.round(W / 1000 * price);
const body = { saleType: 'cash', lines: [{ itemId, weightGrams: W, pricePerKg: price }], payments: [{ paymentMethod: 'cash', amount: amt }] };
for (const N of Ns) {
  const before = snapshot(m.db);
  const t0 = Date.now();
  const res = await Promise.all(Array.from({ length: N }, async (_, i) => {
    const s = Date.now(); const r = await clients[i % 3].post('/sales', body); return { ...r, ms: Date.now() - s };
  }));
  const tally = {};
  for (const r of res) { const k = r.status + (r.ok ? '' : ' ' + (r.body?.error?.code ?? '?')); tally[k] = (tally[k] ?? 0) + 1; }
  const after = snapshot(m.db);
  log(`N=${N} wall=${Date.now() - t0}ms maxLatency=${Math.max(...res.map((r) => r.ms))}ms tally=${JSON.stringify(tally)} dSales=${after.sales - before.sales} dJE=${after.je - before.je}`);
  const inv = invariants(m.db);
  if (inv.length) log('  INVARIANT VIOLATIONS', JSON.stringify(inv));
  await sleep(500);
}
log.save();
