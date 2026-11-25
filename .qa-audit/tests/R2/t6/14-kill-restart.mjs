// T6-14: hard-kill the backend (TerminateProcess) in the middle of a batch of sales + adjustments + purchases, restart, check consistency.
import { execFileSync } from 'node:child_process';
import { connect, meta, q, one, tee, outFor, sleep, QA } from './lib.mjs';
import { openDb, runChecks } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/invariants.mjs';
const log = tee(outFor(import.meta.url));
let m = meta();
const c = await connect(m.baseUrl, 'admin', 'admin123');
const failsBefore = runChecks(openDb(m.db), { excludeSeed: true }).filter((r) => r.status === 'FAIL').map((r) => r.id);
const cnt = () => ({ sales: one(m.db, 'select count(*) n from sales').n, je: one(m.db, 'select count(*) n from journal_entries').n, lines: one(m.db, 'select count(*) n from sale_lines').n, pur: one(m.db, 'select count(*) n from purchases').n });
const c0 = cnt();
let acked = { sale: 0, pur: 0 }; let errs = {};
let stop = false;
const loop = async (kind) => {
  while (!stop) {
    try {
      const r = kind === 'sale'
        ? await c.post('/sales', { saleType: 'cash', notes: 'T6 kill', lines: [{ itemId: 4, weightGrams: 10, pricePerKg: 2800 }, { itemId: 3, weightGrams: 10, pricePerKg: 3500 }], payments: [{ paymentMethod: 'cash', amount: 63 }] })
        : await c.post('/purchases', { supplierId: 1, notes: 'T6 kill', lines: [{ itemId: 4, weightGrams: 1000, pricePerKg: 1000 }] });
      if (r.ok) acked[kind]++; else errs[r.status] = (errs[r.status] ?? 0) + 1;
    } catch (e) { errs[e.cause?.code ?? e.name] = (errs[e.cause?.code ?? e.name] ?? 0) + 1; await sleep(50); }
  }
};
const loops = [loop('sale'), loop('sale'), loop('pur')];
await sleep(1500);
log(`killing backend pid ${m.pid} after 1.5 s of load (acked so far ${JSON.stringify(acked)})`);
process.kill(m.pid);
await sleep(800);
stop = true; await Promise.all(loops);
log('client errors during/after kill:', errs);
const files = execFileSync('ls', ['-la', `/e${QA.slice(2)}/envs/r2`]).toString();
log('env dir after kill (hot journal present?):\n' + files.split('\n').filter((l) => /app\.db/.test(l)).join('\n'));
log('restart:', execFileSync('node', [`${QA}/harness/instance.mjs`, 'start', 'r2', '3125', 'dev']).toString().trim().split('\n').pop());
m = meta();
const c1 = cnt();
log(`rows: sales +${c1.sales - c0.sales} (acked ${acked.sale}), purchases +${c1.pur - c0.pur} (acked ${acked.pur}), JE +${c1.je - c0.je}, sale_lines +${c1.lines - c0.lines} (expect 2/sale)`);
log('integrity_check:', q(m.db, 'pragma integrity_check'));
log('sale without JE / JE without doc / sale lines≠2 (T6 kill):', one(m.db, `select count(*) n from sales s where notes='T6 kill' and not exists(select 1 from journal_entries e where e.source_type='sale' and e.source_id=s.id)`).n,
  one(m.db, `select count(*) n from journal_entries e where e.source_type in ('sale','purchase') and not exists(select 1 from sales s where e.source_type='sale' and s.id=e.source_id) and not exists(select 1 from purchases p where e.source_type='purchase' and p.id=e.source_id)`).n,
  one(m.db, `select count(*) n from sales s where notes='T6 kill' and (select count(*) from sale_lines l where l.sale_id=s.id)<>2`).n,
  'purchase without lot:', one(m.db, `select count(*) n from purchases p where notes='T6 kill' and not exists(select 1 from inventory_lots l where l.purchase_id=p.id)`).n);
const failsAfter = runChecks(openDb(m.db), { excludeSeed: true }).filter((r) => r.status === 'FAIL').map((r) => r.id);
log('checker FAIL ids before:', failsBefore, 'after:', failsAfter, 'NEW:', failsAfter.filter((x) => !failsBefore.includes(x)));
const c2 = await connect(m.baseUrl, 'admin', 'admin123');
log('post-restart sale:', (await c2.post('/sales', { saleType: 'cash', lines: [{ itemId: 4, weightGrams: 10, pricePerKg: 2800 }], payments: [{ paymentMethod: 'cash', amount: 28 }] })).status);
log('backup status after restart:', JSON.stringify((await c2.get('/system/backup/status')).data));
log.save();
