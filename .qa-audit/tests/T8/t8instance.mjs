// T8 launcher = harness/instance.mjs + fake-clock preload (--require fakeclock.cjs). Ports 3113-3114 only.
//   node t8instance.mjs start|stop|reset <name> <port> [baseline|dev]
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const QA = path.resolve(HERE, '..', '..');
const BACKEND = path.resolve(QA, '..', 'app', 'backend');
const fwd = (p) => p.split(path.sep).join('/');
const [cmd, name, portArg, profileArg] = process.argv.slice(2);
if (!['3113', '3114', undefined].includes(portArg)) { console.error('T8 ports are 3113-3114'); process.exit(2); }
const envDir = path.join(QA, 'envs', name); const dbFile = path.join(envDir, 'app.db');
const pidFile = path.join(envDir, 'pid'); const metaFile = path.join(envDir, 'meta.json');
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const readPid = () => { if (!fs.existsSync(pidFile)) return null; const p = Number(fs.readFileSync(pidFile, 'utf8')); return alive(p) ? p : null; };
async function stop() { const pid = readPid(); if (!pid) return console.log(`[${name}] not running`); process.kill(pid);
  for (let i = 0; i < 50 && alive(pid); i++) await new Promise((r) => setTimeout(r, 100)); fs.rmSync(pidFile, { force: true }); console.log(`[${name}] stopped`); }
async function prepareDb(profile) {
  for (let i = 0; i < 40; i++) { try { for (const f of ['app.db','app.db-journal']) fs.rmSync(path.join(envDir, f), { force: true }); break; } catch (e) { await new Promise((r) => setTimeout(r, 250)); } }
  const golden = path.join(QA, 'envs', '_golden', `${profile}.db`);
  fs.mkdirSync(envDir, { recursive: true });
  for (const f of ['app.db', 'app.db-journal', 'app.db-wal', 'app.db-shm', 'backup-meta.db']) fs.rmSync(path.join(envDir, f), { force: true });
  fs.rmSync(path.join(envDir, 'backups'), { recursive: true, force: true });
  fs.copyFileSync(golden, dbFile);
  const db = new DatabaseSync(dbFile); const now = Date.now();
  db.prepare(`DELETE FROM system_settings WHERE key = 'backup.path_vps'`).run();
  db.prepare(`INSERT INTO system_settings (key, value, description, data_type, setting_group, is_system, created_at, updated_at) VALUES ('backup.path_vps', ?, 'QA isolated backup dir', 'string', 'backup', 0, ?, ?)`).run(fwd(path.join(envDir, 'backups')), now, now);
  db.close();
}
async function start(port) {
  if (readPid()) return console.log(`[${name}] already running`);
  const logFile = path.join(QA, 'logs', `${name}.log`); fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const out = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, ['--require', path.join(HERE, 'fakeclock.cjs'), 'dist/main.js'], {
    cwd: BACKEND, detached: true, windowsHide: true, stdio: ['ignore', out, out],
    env: { ...process.env, DATABASE_URL: `file:${fwd(dbFile)}`, BACKUP_META_DATABASE_URL: `file:${fwd(path.join(envDir, 'backup-meta.db'))}`,
      PORT: String(port), NODE_ENV: 'development', JWT_SECRET: 'qa-isolated-secret-' + name, BACKUP_SCHEDULE_CRON: '0 3 1 1 *' } });
  child.unref(); fs.writeFileSync(pidFile, String(child.pid));
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`${base}/api/docs`); if (r.ok) { const meta = { name, port: Number(port), baseUrl: `${base}/v1`, db: fwd(dbFile), log: fwd(logFile), pid: child.pid };
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2)); console.log(`[${name}] ready`, JSON.stringify(meta)); return; } } catch {}
    if (!alive(child.pid)) break; await new Promise((r) => setTimeout(r, 500)); }
  console.error(`[${name}] failed to start; see ${fwd(logFile)}`); process.exit(1);
}
const profile = profileArg === 'dev' ? 'dev' : 'baseline';
if (cmd === 'start') await start(portArg);
else if (cmd === 'stop') await stop();
else if (cmd === 'reset') { await stop(); await prepareDb(profile); await start(portArg); }
