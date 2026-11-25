// Backup helpers for T6 tests (own instance only).
import crypto from 'node:crypto';
import { q, sleep } from './lib.mjs';

export function fingerprint(db) {
  const tables = q(db, `select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name`).map((r) => r.name);
  const fp = {};
  for (const t of tables) {
    let rows = q(db, `select * from "${t}" order by rowid`);
    if (t === 'system_settings') rows = rows.filter((r) => !String(r.key).startsWith('backup.')).map(({ updated_at, ...r }) => r);
    fp[t] = { n: rows.length, h: crypto.createHash('sha1').update(JSON.stringify(rows)).digest('hex').slice(0, 12) };
  }
  return fp;
}
export function fpDiff(a, b) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out[k] = { backup: a[k], now: b[k] };
  return out;
}
export async function latestRun(c) { const r = await c.get('/system/backups?limit=50'); return r.data?.items ?? r.data; }
export async function runBackup(c, log) {
  const before = (await latestRun(c)).map((x) => x.id);
  const t0 = Date.now();
  const r = await c.post('/system/backup', {});
  if (!r.ok) { log?.('backup trigger failed', r.status, JSON.stringify(r.body)); return null; }
  for (let i = 0; i < 100; i++) {
    await sleep(200);
    const runs = await latestRun(c);
    const n = runs.find((x) => !before.includes(x.id) && x.status !== 'running');
    if (n) { log?.(`backup run ${n.id} ${n.status} ${n.filename} ${n.sizeBytes} B in ${Date.now() - t0} ms ${n.errorMessage ?? ''}`); return n; }
  }
  return null;
}
