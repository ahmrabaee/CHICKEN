// T6-11: repeated backups (≥1.1 s apart, to avoid filename collision) while 3 writers post sales continuously.
// For each archive: integrity_check, sales↔JE↔lines consistency.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { connect, meta, q, one, tee, outFor, sleep, QA } from './lib.mjs';
import { runBackup } from './bk.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const c = await connect(m.baseUrl, 'admin', 'admin123');
const bdir = `${QA}/envs/t6/backups`;
let stop = false; let ok = 0, bad = {};
const writer = async () => { while (!stop) { const r = await c.post('/sales', { saleType: 'cash', notes: 'T6 load', lines: [{ itemId: 4, weightGrams: 10, pricePerKg: 2800 }], payments: [{ paymentMethod: 'cash', amount: 28 }] }); if (r.ok) ok++; else bad[r.status] = (bad[r.status] ?? 0) + 1; } };
const ws = [writer(), writer(), writer()];
const results = [];
for (let i = 0; i < 8; i++) {
  await sleep(1100);
  const run = await runBackup(c, log);
  if (!run?.filename) { results.push('no run'); continue; }
  const x = `${QA}/tests/T6/_load-${run.id}`; fs.rmSync(x, { recursive: true, force: true }); fs.mkdirSync(x);
  execFileSync('tar', ['-xzf', `/e${bdir.slice(2)}/${run.filename}`, '-C', `/e${x.slice(2)}`]);
  const db = `${x}/db/app.db`;
  let r;
  try {
    r = {
      integrity: q(db, 'pragma integrity_check').map((z) => z.integrity_check).join(';'),
      sales: one(db, 'select count(*) n from sales').n,
      saleNoJE: one(db, `select count(*) n from sales s where s.sale_number not like '%SEED%' and not exists(select 1 from journal_entries e where e.source_type='sale' and e.source_id=s.id)`).n,
      jeNoSale: one(db, `select count(*) n from journal_entries e where e.source_type='sale' and not exists(select 1 from sales s where s.id=e.source_id)`).n,
      saleNoLines: one(db, 'select count(*) n from sales s where not exists(select 1 from sale_lines l where l.sale_id=s.id)').n,
    };
  } catch (e) { r = { error: String(e.message) }; }
  results.push({ run: run.id, file: run.filename, ...r });
  log(JSON.stringify(results.at(-1)));
  fs.rmSync(x, { recursive: true, force: true });
}
stop = true; await Promise.all(ws);
log(`writers: ${ok} sales OK, failures ${JSON.stringify(bad)}`);
log.save();
