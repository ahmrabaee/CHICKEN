// T6-15: restore archives whose DB is (a) an older/different schema (sales.cancel_reason dropped), (b) a header-only fake SQLite (import id from T6-12).
// Is there any schema/version check? Does the running app survive? Can the admin recover through the API?
// DESTRUCTIVE for instance t6 only; reset afterwards.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { connect, meta, q, one, tee, outFor, sleep, QA } from './lib.mjs';
const require = createRequire('E:/DEV/Chicken FMS/app/backend/package.json');
const tar = require('tar');
const log = tee(outFor(import.meta.url));
const m = meta();
let c = await connect(m.baseUrl, 'admin', 'admin123');
const W = `${QA}/tests/T6/_craft2`; fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W + '/src/db', { recursive: true });
// (a) different schema
const d = new DatabaseSync(m.db, { readOnly: true }); d.exec(`VACUUM INTO '${(W + '/src/db/app.db').replace(/'/g, "''")}'`); d.close();
const w = new DatabaseSync(W + '/src/db/app.db'); w.exec('ALTER TABLE sales DROP COLUMN cancel_reason'); w.exec("DELETE FROM schema_versions"); w.close();
await tar.c({ gzip: true, file: W + '/oldschema.tar.gz', cwd: W + '/src' }, ['db/app.db']);
const fd = new FormData(); fd.append('file', new Blob([fs.readFileSync(W + '/oldschema.tar.gz')]), 'old.tar.gz'); fd.append('restoreAfterImport', 'true');
let r = await fetch(m.baseUrl + '/system/backups/import', { method: 'POST', headers: { Authorization: 'Bearer ' + c.token }, body: fd });
log('(a) import+restore old-schema DB →', r.status, (await r.text()).slice(0, 200));
for (const p of ['/sales?pageSize=1', '/items', '/reports/dashboard', '/customers']) { const x = await c.get(p); log(`   GET ${p} → ${x.status} ${x.ok ? '' : JSON.stringify(x.body?.error ?? x.body).slice(0, 140)}`); }
const s = await c.post('/sales', { saleType: 'cash', lines: [{ itemId: 4, weightGrams: 10, pricePerKg: 2800 }], payments: [{ paymentMethod: 'cash', amount: 28 }] });
log('   POST /sales →', s.status, JSON.stringify(s.body?.error ?? '').slice(0, 160));
// recover via API with a good backup
const runs = (await c.get('/system/backups?limit=50')).data.items;
const good = runs.find((x) => x.status === 'success' && x.filename?.startsWith('backup_manual_2'));
r = await c.post(`/system/backups/${good.id}/restore`); log(`   recover: restore good run ${good.id} → ${r.status}`);
log('   GET /sales after recovery →', (await c.get('/sales?pageSize=1')).status);
// (b) header-only fake sqlite (imported in T6-12)
const fake = runs.find((x) => x.filename?.startsWith('backup_manual_import_') && x.status === 'success');
r = await c.post(`/system/backups/${fake.id}/restore`);
log(`(b) restore fake-sqlite run ${fake.id} → ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
await sleep(300);
for (const p of ['/sales?pageSize=1', '/system/backups']) { const x = await c.get(p); log(`   GET ${p} (old token) → ${x.status} ${x.ok ? '' : JSON.stringify(x.body?.error ?? x.body).slice(0, 140)}`); }
let relog; try { await connect(m.baseUrl, 'admin', 'admin123'); relog = 'ok'; } catch (e) { relog = e.message.slice(0, 160); }
log('   login after fake restore →', relog);
const rec = await c.post(`/system/backups/${good.id}/restore`);
log(`   recovery attempt through API → ${rec.status} ${JSON.stringify(rec.body).slice(0, 200)}`);
log('   DB file header now:', fs.readFileSync(m.db).subarray(0, 16).toString('latin1'), 'size', fs.statSync(m.db).size);
log('   .bak files available for manual recovery:', fs.readdirSync(`${QA}/envs/t6`).filter((f) => f.includes('before-restore')));
log.save();
