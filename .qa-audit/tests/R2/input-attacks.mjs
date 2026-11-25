// Input attacks + brute force + password policy + accountant backup-import chain.
import { request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import fs from 'node:fs';
const BASE = 'http://localhost:3125/v1';
const P = JSON.parse(fs.readFileSync(new URL('./principals.json', import.meta.url)));
const admin = P.admin.token, acc = P.accountant.token;
const sec = (t) => console.log(`\n==================== ${t} ====================`);

async function main() {
  // ---------- Password policy ----------
  sec('PASSWORD POLICY (admin creates users)');
  for (const pw of ['1', 'abc', 'password', '12345678', 'aaaaaaaa']) {
    const r = await request(BASE, 'POST', '/users', { token: admin, body: { username: `pwtest_${Math.random().toString(36).slice(2,7)}`, password: pw, fullName: 'x', roleId: 2 } });
    console.log(`  password "${pw}" (len ${pw.length}) -> ${r.status} ${r.ok ? '*** ACCEPTED ***' : '(rejected)'}`);
  }

  // ---------- Brute force / lockout ----------
  sec('BRUTE FORCE / LOCKOUT (10 bad logins for admin)');
  let statuses = [];
  for (let i = 0; i < 10; i++) {
    const r = await request(BASE, 'POST', '/auth/login', { body: { username: 'admin', password: 'wrong' + i } });
    statuses.push(r.status);
  }
  console.log('  10 consecutive bad logins ->', statuses.join(','));
  const stillWorks = await request(BASE, 'POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } });
  console.log('  correct login after 10 failures ->', stillWorks.status, stillWorks.ok ? '(NO lockout: account not locked)' : '(locked)');

  // ---------- Malformed JSON ----------
  sec('MALFORMED JSON / OVERSIZED');
  const badJson = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"username":"admin","password":' });
  const bjText = await badJson.text();
  console.log('  malformed JSON ->', badJson.status, '| leaks stack?', /at \/|\.ts:|\.js:|Error:/.test(bjText) ? 'YES' : 'no', '|', bjText.slice(0, 100));
  const bigStr = 'A'.repeat(5 * 1024 * 1024); // 5MB string
  const big = await request(BASE, 'POST', '/auth/login', { body: { username: bigStr, password: 'x' } });
  console.log('  5MB username payload ->', big.status, '(no body-size limit => accepted/processed)');

  // ---------- Prototype pollution ----------
  sec('PROTOTYPE POLLUTION');
  const pp = await request(BASE, 'POST', '/customers', { token: admin, body: { name: 'pp', __proto__: { polluted: true }, constructor: { prototype: { polluted: true } } } });
  console.log('  __proto__ in body ->', pp.status, '| global polluted?', ({}).polluted === true ? '*** YES ***' : 'no');

  // ---------- SQL injection probe (search/sort params) ----------
  sec('SQL INJECTION PROBE (query params)');
  const sqli1 = await request(BASE, 'GET', `/customers/search?q=${encodeURIComponent("' OR 1=1 --")}`, { token: admin });
  console.log('  customers search q="\' OR 1=1 --" ->', sqli1.status, '| rows:', Array.isArray(sqli1.data) ? sqli1.data.length : JSON.stringify(sqli1.data).slice(0,60));
  const sqli2 = await request(BASE, 'GET', `/users?sortBy=${encodeURIComponent('username; DROP TABLE users;--')}&limit=1`, { token: admin });
  console.log('  users sortBy injection ->', sqli2.status, '(400/200 both fine; 500 w/ SQL error = vuln)');
  const sqli3 = await request(BASE, 'GET', `/sales?page=1&pageSize=5&sortBy=${encodeURIComponent("id)) UNION SELECT passwordHash FROM users--")}`, { token: admin });
  console.log('  sales sortBy UNION ->', sqli3.status);

  // ---------- Accountant backup IMPORT chain (inject arbitrary DB) ----------
  sec('ACCOUNTANT BACKUP IMPORT (inject arbitrary DB archive, no RolesGuard)');
  try {
    const archive = fs.readFileSync(new URL('./r2-exfil-proof.gz', import.meta.url));
    const fd = new FormData();
    fd.append('file', new Blob([archive], { type: 'application/gzip' }), 'attacker.tar.gz');
    fd.append('restoreAfterImport', 'false');
    const res = await fetch(`${BASE}/system/backups/import`, { method: 'POST', headers: { Authorization: `Bearer ${acc}` }, body: fd });
    const txt = await res.text();
    console.log('  [accountant] POST /system/backups/import ->', res.status, res.ok ? '*** GUARD GAP: ACCOUNTANT IMPORTED A DB ARCHIVE ***' : '', '|', txt.slice(0, 160));
  } catch (e) { console.log('  import err', e.message); }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
