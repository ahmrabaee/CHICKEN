// T6-06: client timeout mid-request — abort the fetch after X ms. Does the server still commit the sale?
import { connect, meta, one, q, tee, outFor, sleep } from './lib.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const c = await connect(m.baseUrl, 'admin', 'admin123');
const item = 4; const price = one(m.db, 'select default_sale_price p from items where id=?', item).p;
for (const ms of [1, 5, 15, 50]) {
  const tag = `T6-abort-${ms}-${Date.now()}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  let outcome;
  try {
    const r = await fetch(m.baseUrl + '/sales', { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.token },
      body: JSON.stringify({ saleType: 'cash', notes: tag, lines: [{ itemId: item, weightGrams: 1000, pricePerKg: price }], payments: [{ paymentMethod: 'cash', amount: price }] }) });
    outcome = 'response ' + r.status;
  } catch (e) { outcome = 'client error: ' + e.name; }
  clearTimeout(t);
  await sleep(1500);
  const s = q(m.db, 'select sale_number,total_amount from sales where notes=?', tag);
  log(`abort after ${ms} ms → client saw "${outcome}"; server committed sales: ${JSON.stringify(s)}`);
}
// burst: 10 aborted at 30 ms while 10 others proceed
const tag = 'T6-abort-burst-' + Date.now();
const body = JSON.stringify({ saleType: 'cash', notes: tag, lines: [{ itemId: item, weightGrams: 10, pricePerKg: price }], payments: [{ paymentMethod: 'cash', amount: Math.round(price / 100) }] });
const res = await Promise.all(Array.from({ length: 10 }, async () => {
  const ac = new AbortController(); setTimeout(() => ac.abort(), 30);
  try { const r = await fetch(m.baseUrl + '/sales', { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.token }, body }); return r.status; } catch (e) { return e.name; }
}));
await sleep(3000);
log('burst of 10 aborted at 30 ms: client outcomes', res, '→ committed on server:', one(m.db, 'select count(*) n from sales where notes=?', tag).n);
log.save();
