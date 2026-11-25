// Isolated backend instance manager for QA agents.
//   node instance.mjs start  <name> <port> [dev|baseline] [--fresh]
//   node instance.mjs stop   <name>
//   node instance.mjs reset  <name> <port> [dev|baseline]   (stop + fresh copy + start)
//   node instance.mjs status <name>
// Each instance gets: its own DB copy, backup-meta DB, backup dir, log file, port.
// Uses the prebuilt app/backend/dist. NEVER rebuild dist (shared by all agents).
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QA = path.resolve(HERE, '..');
const BACKEND = path.resolve(QA, '..', 'app', 'backend');
const fwd = (p) => p.replace(/\\/g, '/');

const [cmd, name, portArg, profileArg] = process.argv.slice(2);
const fresh = process.argv.includes('--fresh');
if (!cmd || !name || !/^[a-z0-9_-]+$/i.test(name)) {
  console.error('usage: node instance.mjs start|stop|reset|status <name> [port] [dev|baseline] [--fresh]');
  process.exit(2);
}
const envDir = path.join(QA, 'envs', name);
const dbFile = path.join(envDir, 'app.db');
const pidFile = path.join(envDir, 'pid');
const metaFile = path.join(envDir, 'meta.json');

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function readPid() {
  if (!fs.existsSync(pidFile)) return null;
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  return alive(pid) ? pid : null;
}
async function stop() {
  const pid = readPid();
  if (!pid) { console.log(`[${name}] not running`); return; }
  process.kill(pid);
  for (let i = 0; i < 50 && alive(pid); i++) await new Promise((r) => setTimeout(r, 100));
  fs.rmSync(pidFile, { force: true });
  console.log(`[${name}] stopped pid=${pid}`);
}
function prepareDb(profile) {
  const golden = path.join(QA, 'envs', '_golden', `${profile}.db`);
  if (!fs.existsSync(golden)) throw new Error(`no golden db for profile ${profile}`);
  fs.mkdirSync(envDir, { recursive: true });
  for (const f of ['app.db', 'app.db-journal', 'app.db-wal', 'app.db-shm', 'backup-meta.db']) fs.rmSync(path.join(envDir, f), { force: true });
  fs.rmSync(path.join(envDir, 'backups'), { recursive: true, force: true });
  fs.copyFileSync(golden, dbFile);
  const db = new DatabaseSync(dbFile);
  const now = Date.now();
  db.prepare(`DELETE FROM system_settings WHERE key = 'backup.path_vps'`).run();
  db.prepare(`INSERT INTO system_settings (key, value, description, data_type, setting_group, is_system, created_at, updated_at)
              VALUES ('backup.path_vps', ?, 'QA isolated backup dir', 'string', 'backup', 0, ?, ?)`)
    .run(fwd(path.join(envDir, 'backups')), now, now);
  db.close();
  console.log(`[${name}] fresh ${profile} DB at ${fwd(dbFile)}`);
}
async function start(port, profile) {
  if (readPid()) { console.log(`[${name}] already running`, fs.readFileSync(metaFile, 'utf8')); return; }
  if (!port) throw new Error('port required');
  if (fresh || !fs.existsSync(dbFile)) prepareDb(profile);
  fs.mkdirSync(path.join(QA, 'logs'), { recursive: true });
  const logFile = path.join(QA, 'logs', `${name}.log`);
  const out = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: BACKEND,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      DATABASE_URL: `file:${fwd(dbFile)}`,
      BACKUP_META_DATABASE_URL: `file:${fwd(path.join(envDir, 'backup-meta.db'))}`,
      PORT: String(port),
      NODE_ENV: 'development',
      JWT_SECRET: 'qa-isolated-secret-' + name,
      BACKUP_SCHEDULE_CRON: '0 3 1 1 *',
    },
  });
  child.unref();
  fs.writeFileSync(pidFile, String(child.pid));
  const base = `http://localhost:${port}`;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${base}/api/docs`);
      if (r.ok) {
        const meta = { name, port: Number(port), baseUrl: `${base}/v1`, db: fwd(dbFile), log: fwd(logFile), pid: child.pid };
        fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
        console.log(`[${name}] ready`, JSON.stringify(meta));
        return;
      }
    } catch {}
    if (!alive(child.pid)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(`[${name}] failed to start; see ${fwd(logFile)}`);
  process.exit(1);
}

const profile = profileArg === 'baseline' ? 'baseline' : 'dev';
if (cmd === 'start') await start(portArg, profile);
else if (cmd === 'stop') await stop();
else if (cmd === 'reset') { await stop(); prepareDb(profile); await start(portArg, profile); }
else if (cmd === 'status') console.log(readPid() ? fs.readFileSync(metaFile, 'utf8') : `[${name}] not running`);
else { console.error('unknown command'); process.exit(2); }
