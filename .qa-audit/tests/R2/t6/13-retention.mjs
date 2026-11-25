// T6-13: retention. Age runs 1 and 3 in MY instance's backup-meta.db (finished_at - 20 days), trigger a backup, see what gets deleted.
// Runs 1 and 2 share the same filename (T6-011 collision): deleting old run 1 should not delete the file still referenced by run 2.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { connect, meta, q, tee, outFor, sleep, QA } from './lib.mjs';
import { runBackup } from './bk.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const c = await connect(m.baseUrl, 'admin', 'admin123');
const metaDb = `${QA}/envs/r2/backup-meta.db`;
const bdir = `${QA}/envs/r2/backups`;
const w = new DatabaseSync(metaDb);
const old = Date.now() - 20 * 86400000;
w.prepare('update backup_runs set finished_at=?, started_at=? where id in (1,3)').run(old, old);
w.close();
log('runs before:', q(metaDb, 'select id,status,filename,datetime(finished_at/1000,\'unixepoch\') fin from backup_runs order by id'));
log('files before:', fs.readdirSync(bdir).filter((f) => f.endsWith('.gz')));
await sleep(1100);
await runBackup(c, log);
log('runs after:', q(metaDb, 'select id,status,filename from backup_runs order by id').map((r) => `${r.id}:${r.status}:${r.filename}`));
const files = fs.readdirSync(bdir).filter((f) => f.endsWith('.gz'));
log('files after:', files);
const dangling = q(metaDb, `select id,filename from backup_runs where status='success'`).filter((r) => !files.includes(r.filename));
log('SUCCESS runs whose file is gone (dangling):', dangling);
for (const d of dangling) { const r = await c.post(`/system/backups/${d.id}/restore`); log(`restore dangling run ${d.id} → ${r.status} ${r.body?.error?.code ?? ''}`); }
log.save();
