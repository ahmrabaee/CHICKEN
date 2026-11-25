// Custom launcher variant for ORCH-003 (JWT secret). Starts app/backend/dist on port 3110
// with a controlled JWT_SECRET env to study the fallback behavior.
//   node launch-variant.mjs start no-secret   -> omit JWT_SECRET entirely (does ConfigModule load backend/.env?)
//   node launch-variant.mjs start default      -> set JWT_SECRET='default-secret-change-me' (simulate unset-fallback deploy)
//   node launch-variant.mjs stop
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const QA = path.resolve(HERE, '..', '..');
const BACKEND = path.resolve(QA, 'app', 'backend');
const envDir = path.join(QA, '.qa-audit', 'envs', 't5b');
const dbFile = path.join(envDir, 'app.db');
const pidFile = path.join(envDir, 'pid');
const golden = path.join(QA, '.qa-audit', 'envs', '_golden', 'dev.db');
const fwd = (p) => p.replace(/\\/g, '/');
const [cmd, mode] = process.argv.slice(2);

function alive(pid){ try{process.kill(pid,0);return true;}catch{return false;} }
if (cmd === 'stop') {
  if (fs.existsSync(pidFile)) { const pid=Number(fs.readFileSync(pidFile,'utf8')); try{process.kill(pid);}catch{} fs.rmSync(pidFile,{force:true}); console.log('stopped',pid);} else console.log('not running');
  process.exit(0);
}
fs.mkdirSync(envDir,{recursive:true});
for (const f of ['app.db','app.db-journal','app.db-wal','app.db-shm']) fs.rmSync(path.join(envDir,f),{force:true});
fs.copyFileSync(golden, dbFile);

const env = { ...process.env, DATABASE_URL:`file:${fwd(dbFile)}`, BACKUP_META_DATABASE_URL:`file:${fwd(path.join(envDir,'backup-meta.db'))}`, PORT:'3110', NODE_ENV:'development', BACKUP_SCHEDULE_CRON:'0 3 1 1 *' };
if (mode === 'default') env.JWT_SECRET = 'default-secret-change-me';
else { delete env.JWT_SECRET; } // no-secret: rely on .env / fallback

const logFile = path.join(QA,'.qa-audit','logs','t5b.log');
const out = fs.openSync(logFile,'a');
const child = spawn(process.execPath,['dist/main.js'],{ cwd:BACKEND, detached:true, windowsHide:true, stdio:['ignore',out,out], env });
child.unref();
fs.writeFileSync(pidFile,String(child.pid));
console.log(`[t5b] starting mode=${mode} pid=${child.pid} (JWT_SECRET ${env.JWT_SECRET?('='+env.JWT_SECRET):'OMITTED from process.env'})`);
// wait for ready
(async()=>{ for(let i=0;i<120;i++){ try{ const r=await fetch('http://localhost:3110/api/docs'); if(r.ok){console.log('[t5b] ready on 3110');return;} }catch{} if(!alive(child.pid)){console.error('[t5b] died; see',fwd(logFile));process.exit(1);} await new Promise(r=>setTimeout(r,500)); } console.error('[t5b] timeout'); })();
