// T6-10: backup → more data → restore: is the DB exactly the backup state? does the running app keep working?
// Also: backup taken DURING a burst of writes — is the archive's DB consistent (integrity_check, invariants)?
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { connect, meta, q, one, tee, outFor, sleep, QA } from './lib.mjs';
import { fingerprint, fpDiff, runBackup, latestRun } from './bk.mjs';
import { openDb, runChecks } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/invariants.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const c = await connect(m.baseUrl, 'admin', 'admin123');
const bdir = `${QA}/envs/t6/backups`;
const price = 2800;
const sale = (tag, g = 10) => c.post('/sales', { saleType: 'cash', notes: tag, lines: [{ itemId: 4, weightGrams: g, pricePerKg: price }], payments: [{ paymentMethod: 'cash', amount: Math.round(g / 1000 * price) }] });

// 1. baseline backup
const fp0 = fingerprint(m.db);
const run = await runBackup(c, log);
const fpAtBackup = fingerprint(m.db);
log('fingerprint changed during backup itself?', JSON.stringify(fpDiff(fp0, fpAtBackup)));
// 2. more data
for (let i = 0; i < 3; i++) log('post-backup sale', (await sale('T6 after backup ' + i)).data?.saleNumber);
log('post-backup expense', (await c.post('/expenses', { categoryId: 1, description: 'T6 after backup', amount: 100, paymentMethod: 'cash' })).data?.expenseNumber);
const salesBeforeRestore = one(m.db, 'select count(*) n from sales').n;
// 3. restore
const t0 = Date.now();
const rr = await c.post(`/system/backups/${run.id}/restore`);
log(`restore ${run.id} → ${rr.status} ${JSON.stringify(rr.data ?? rr.body).slice(0, 200)} in ${Date.now() - t0} ms`);
const fp1 = fingerprint(m.db);
log(`sales before restore ${salesBeforeRestore}, after ${one(m.db, 'select count(*) n from sales').n}`);
log('DIFF backup-state vs restored DB (system_settings backup.* and updated_at excluded):', JSON.stringify(fpDiff(fpAtBackup, fp1), null, 1));
// 4. app still works with the SAME token?
const g = await c.get('/sales?pageSize=1'); log('GET /sales with pre-restore token →', g.status);
const s = await sale('T6 after restore'); log('POST /sales after restore →', s.status, s.data?.saleNumber ?? JSON.stringify(s.body).slice(0, 200));
const rf = await c.post('/auth/refresh', {}); log('(info) refresh endpoint →', rf.status);
log('files left in db dir:', fs.readdirSync(path.dirname(m.db)).filter((f) => f.includes('before-restore') || f.endsWith('-journal')));
log('staging leftovers:', fs.existsSync(bdir + '/.staging') ? fs.readdirSync(bdir + '/.staging') : []);

// 5. backup during concurrent writes
const tag = 'T6 burst ' + Date.now();
const burst = (async () => { const out = []; for (let k = 0; k < 4; k++) { out.push(...await Promise.all(Array.from({ length: 5 }, () => sale(tag)))); } return out; })();
await sleep(30);
const run2 = await runBackup(c, log);
const res = await burst;
log(`burst: ${res.filter((r) => r.ok).length}/20 sales OK, statuses ${JSON.stringify(res.map((r) => r.status))}`);
if (run2?.filename) {
  const x = `${QA}/tests/T6/_extract-${run2.id}`; fs.rmSync(x, { recursive: true, force: true }); fs.mkdirSync(x);
  execFileSync('tar', ['-xzf', `${bdir}/${run2.filename}`.replace(/^E:/, '/e'), '-C', x.replace(/^E:/, '/e')], { shell: 'C:/Program Files/Git/usr/bin/bash.exe' === '' ? undefined : undefined });
  const edb = `${x}/db/app.db`;
  log('archive entries:', fs.readdirSync(x, { recursive: true }));
  log('archived DB integrity_check:', q(edb, 'pragma integrity_check'));
  log('archived DB has burst sales:', one(edb, 'select count(*) n from sales where notes=?', tag).n, 'of', res.filter((r) => r.ok).length);
  const fails = runChecks(openDb(edb), { excludeSeed: true }).filter((r) => r.status === 'FAIL').map((r) => r.id);
  log('archived DB checker FAIL ids (compare with live):', fails, '| live:', runChecks(openDb(m.db), { excludeSeed: true }).filter((r) => r.status === 'FAIL').map((r) => r.id));
  log('archived sale-without-JE / JE-without-sale:', q(edb, `select count(*) n from sales s where s.sale_number not like '%SEED%' and not exists(select 1 from journal_entries e where e.source_type='sale' and e.source_id=s.id)`), q(edb, `select count(*) n from journal_entries e where e.source_type='sale' and not exists(select 1 from sales s where s.id=e.source_id)`));
}
log('runs:', (await latestRun(c)).map((r) => `${r.id}:${r.type}:${r.status}:${r.filename}`));
log.save();
