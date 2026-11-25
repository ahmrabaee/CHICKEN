// T6-13b: state after retention run triggered by 13-retention.mjs (13 crashed reading the meta DB while retention was deleting rows).
import fs from 'node:fs';
import { connect, meta, q, tee, outFor, sleep, QA } from './lib.mjs';
const log = tee(outFor(import.meta.url));
const m = meta(); const c = await connect(m.baseUrl, 'admin', 'admin123');
const metaDb = `${QA}/envs/r2/backup-meta.db`; const bdir = `${QA}/envs/r2/backups`;
await sleep(1000);
log('runs after:', q(metaDb, 'select id,status,filename from backup_runs order by id').map((r) => `${r.id}:${r.status}:${r.filename}`));
const files = fs.readdirSync(bdir).filter((f) => f.endsWith('.gz'));
log('files after:', files);
const dangling = q(metaDb, `select id,filename from backup_runs where status='success'`).filter((r) => !files.includes(r.filename));
log('SUCCESS runs whose file is gone (dangling):', dangling);
for (const d of dangling) { const r = await c.post(`/system/backups/${d.id}/restore`); log(`restore dangling run ${d.id} → ${r.status} ${r.body?.error?.code ?? ''} ${r.body?.error?.message ?? ''}`); }
const st = await c.get('/system/backup/status'); log('status:', JSON.stringify(st.data));
log.save();
