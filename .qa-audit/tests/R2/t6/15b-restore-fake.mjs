// T6-15b: (b) proper: restore the header-only fake SQLite archive (import run 13 from T6-12) after recovering with a good backup.
import fs from 'node:fs';
import { connect, meta, tee, outFor, sleep, QA } from './lib.mjs';
const log = tee(outFor(import.meta.url));
const m = meta(); const c = await connect(m.baseUrl, 'admin', 'admin123');
log('recover first: restore run 16 →', (await c.post('/system/backups/16/restore')).status, '; GET /sales →', (await c.get('/sales?pageSize=1')).status);
const r = await c.post('/system/backups/13/restore');
log(`restore fake-sqlite run 13 → ${r.status} ${JSON.stringify(r.body?.data ?? r.body?.error).slice(0, 160)}`);
await sleep(300);
for (const p of ['/sales?pageSize=1', '/items', '/users/me']) { const x = await c.get(p); log(`  GET ${p} (old token) → ${x.status} ${x.ok ? '' : JSON.stringify(x.body?.error ?? x.body).slice(0, 140)}`); }
let relog; try { await connect(m.baseUrl, 'admin', 'admin123'); relog = 'ok'; } catch (e) { relog = e.message.slice(0, 160); }
log('  login after fake restore →', relog);
const rec = await c.post('/system/backups/16/restore');
log(`  recovery attempt through API (restore 16) → ${rec.status} ${JSON.stringify(rec.body?.data ?? rec.body?.error).slice(0, 160)}`);
log('  GET /sales after recovery attempt →', (await c.get('/sales?pageSize=1')).status);
log('  DB size now', fs.statSync(m.db).size, '; before-restore .bak files:', fs.readdirSync(`${QA}/envs/r2`).filter((f) => f.includes('before-restore')).length);
log.save();
