// R1-04: same-item two lines across multiple lots (false rejection?), WAL/burst concurrency (QA-052), parallel sales oversell, parallel void/payment (QA-050), idempotency (QA-053)
import { setup, glx, dl, jeCheck, L, errc, log, saveLog, must, q, q1, newItem, purchase, sale, showItem, newCust } from './lib2.mjs';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const { c, db, info } = await setup();

log('=== multi-lot same item in two lines: lots 10kg@20 and 10kg@30, cart 6kg + 6kg (12 <= 20 available)');
{
  const it = await newItem(c, { name: 'R1 ml', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 2000 }]);
  await new Promise((r) => setTimeout(r, 20));
  await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 3000 }]);
  const G0 = glx(db);
  const r = await sale(c, [L(it.id, 6000, 5000), L(it.id, 6000, 5000)]);
  log('sale 6+6 on 20kg in two lots', errc(r), r.ok ? 'COGS ' + q1(db, 'select total_cost t from sales where id=?', r.data.id).t + ' (correct = 10*20+2*30 = 26000)' : '');
  showItem(db, it.id, 'after');
  const r2 = await sale(c, [L(it.id, 12000, 5000)]);
  log('same 12kg as ONE line', errc(r2));
  showItem(db, it.id, 'after one-line');
  const r3 = await sale(c, [L(it.id, 1000, 5000), L(it.id, 1000, 5000)]);
  log('two 1kg lines (4kg avail?)', errc(r3), r3.ok ? 'COGS ' + q1(db, 'select total_cost t from sales where id=?', r3.data.id).t : '');
  showItem(db, it.id, 'end');
}
log('=== same item two lines, SINGLE lot, fits (4+4 on 10) -> allowed?');
{
  const it = await newItem(c, { name: 'R1 ml2', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 2000 }]);
  const r = await sale(c, [L(it.id, 4000, 5000), L(it.id, 4000, 5000)]);
  log('4+4 on 10kg single lot', errc(r)); showItem(db, it.id, 'after');
}

log('=== QA-052 burst of concurrent sales (item with 500kg)');
{
  const it = await newItem(c, { name: 'R1 burst', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 500000, pricePerKg: 2000 }]);
  const clients = []; for (let i = 0; i < 3; i++) clients.push(await connect(info.baseUrl, 'admin', 'admin123'));
  const body = { saleType: 'cash', lines: [L(it.id, 100, 5000)], payments: [{ amount: 500, paymentMethod: 'cash' }] };
  for (const N of [10, 15, 20, 30, 50]) {
    const t0 = Date.now(); const before = q1(db, 'select count(*) n from sales').n;
    const res = await Promise.all(Array.from({ length: N }, async (_, i) => { const s = Date.now(); const r = await clients[i % 3].post('/sales', body); return { ...r, ms: Date.now() - s }; }));
    const tally = {}; for (const r of res) { const k = r.status + (r.ok ? '' : ' ' + (r.body?.error?.code ?? '?')); tally[k] = (tally[k] ?? 0) + 1; }
    log(`N=${N} wall=${Date.now() - t0}ms maxLat=${Math.max(...res.map((r) => r.ms))}ms tally=${JSON.stringify(tally)} newSales=${q1(db, 'select count(*) n from sales').n - before}`);
    showItem(db, it.id, `N=${N}`);
    await new Promise((r) => setTimeout(r, 400));
  }
  log('journal_mode', JSON.stringify(q(db, 'pragma journal_mode')));
}

log('=== parallel sales oversell race: 10kg item, 5 parallel x 4kg');
{
  const it = await newItem(c, { name: 'R1 race', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 2000 }]);
  const res = await Promise.all(Array.from({ length: 5 }, () => sale(c, [L(it.id, 4000, 5000)])));
  log('statuses', res.map((r) => r.status + (r.ok ? '' : ':' + r.body?.error?.code)).join(','));
  showItem(db, it.id, 'after');
}

log('=== QA-050 concurrent voids / payments');
{
  const it = await newItem(c, { name: 'R1 conc', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 100000, pricePerKg: 2000 }]);
  const cu = await newCust(c, 'conc');
  const s = must(await c.post('/sales', { saleType: 'credit', customerId: cu, lines: [L(it.id, 2000, 5000)] }), 'sale');
  const G0 = glx(db);
  const rs = await Promise.all(Array.from({ length: 4 }, () => c.post(`/sales/${s.id}/void`, { reason: 'dup' })));
  log('4 parallel voids', rs.map((r) => r.status).join(','), 'GL', JSON.stringify(dl(G0, glx(db))), '(single void should reverse once: 1120 -10000 etc)');
  showItem(db, it.id, 'after voids');
  log('customer balance', q1(db, 'select current_balance b from customers where id=?', cu).b);
  const s2 = must(await c.post('/sales', { saleType: 'credit', customerId: cu, lines: [L(it.id, 2000, 5000)] }), 'sale2');
  const pr = await Promise.all(Array.from({ length: 5 }, () => c.post('/payments/sale', { saleId: s2.id, amount: 4000, paymentMethod: 'cash' })));
  log('5 parallel payments of 4000 on 10000 invoice', pr.map((r) => r.status).join(','), 'collected', q1(db, "select coalesce(sum(amount),0) s from payments where reference_type='sale' and reference_id=? and is_voided=0", s2.id).s);
  // credit notes
  const s3 = must(await c.post('/sales', { saleType: 'credit', customerId: cu, lines: [L(it.id, 2000, 5000)] }), 'sale3');
  const cn = await Promise.all([0, 1].map(async () => { const r = await c.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: s3.id, amount: 6000, reason: 'r1' }); if (!r.ok) return r; return c.post(`/credit-notes/${r.data.id}/submit`, {}); }));
  log('2 parallel credit notes 6000 on 10000', cn.map(errc).join(' | '));
}

log('=== QA-053 idempotency: same sale posted twice with same Idempotency-Key');
{
  const it = await newItem(c, { name: 'R1 idem', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 100000, pricePerKg: 2000 }]);
  const body = { saleType: 'cash', lines: [L(it.id, 1000, 5000)], payments: [{ amount: 5000, paymentMethod: 'cash' }] };
  const before = q1(db, 'select count(*) n from sales').n;
  const rs = await Promise.all([1, 2, 3].map(() => c.post('/sales', body, { headers: { 'Idempotency-Key': 'r1-key-1' } })));
  log('3 sales same key', rs.map((r) => r.status).join(','), 'new sales', q1(db, 'select count(*) n from sales').n - before);
}
log('JE unbalanced', JSON.stringify(jeCheck(db)));
saveLog('04-multilot-concurrency');
