// V2: T6-012 independent re-proof — import/restore of a fake/garbage DB bricks the server
import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3117/v1';
const WORK = 'E:/DEV/Chicken FMS/.qa-audit/tests/V2/fake-restore';
const tarPath = path.join(WORK, 'fake-backup.tar.gz');
console.log('using pre-built archive:', tarPath, fs.existsSync(tarPath) ? fs.statSync(tarPath).size + ' bytes' : 'MISSING');

const admin = await connect(BASE, 'admin', 'admin123');

// sanity before
const preLogin = await request(BASE, 'POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } });
console.log('pre-restore login check ->', preLogin.status);

// Multipart import
const fileBuf = fs.readFileSync(tarPath);
const form = new FormData();
form.append('file', new Blob([fileBuf], { type: 'application/gzip' }), 'fake-backup.tar.gz');
form.append('restoreImmediately', 'false');
const importRes = await fetch(`${BASE}/system/backups/import`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${admin.token}` },
  body: form,
});
const importBody = await importRes.json().catch(() => null);
console.log('T6-012a: import fake DB archive ->', importRes.status, JSON.stringify(importBody).slice(0, 400));

const importedId = importBody?.data?.id ?? importBody?.data?.backupId;
console.log('imported backup id =', importedId);

if (importedId) {
  const restoreRes = await admin.post(`/system/backups/${importedId}/restore`, {});
  console.log('T6-012b: restore imported fake DB ->', restoreRes.status, JSON.stringify(restoreRes.body).slice(0, 400));

  // After restore attempt, probe server health
  await new Promise((r) => setTimeout(r, 1000));
  const loginAfter = await request(BASE, 'POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } });
  console.log('T6-012c: login AFTER restore attempt ->', loginAfter.status, JSON.stringify(loginAfter.body).slice(0, 300));

  const itemsAfter = await fetch(`${BASE}/items`).catch((e) => ({ status: 'FETCH_ERROR:' + e.message }));
  console.log('T6-012d: unauthenticated /items probe (server alive?) ->', itemsAfter.status);
}

console.log('DONE');
