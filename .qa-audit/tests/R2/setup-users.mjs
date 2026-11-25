// Create test principals: accountant (full default pages), accountant with a page revoked,
// and a to-be-deactivated user whose token is captured BEFORE deactivation.
// Saves tokens to tests/T5/principals.json
import { request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import fs from 'node:fs';
const BASE = 'http://localhost:3125/v1';
const out = {};

async function main() {
  const adminLogin = await request(BASE, 'POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } });
  const admin = adminLogin.data.accessToken;
  out.admin = { token: admin, user: adminLogin.data.user };

  const roles = await request(BASE, 'GET', '/users/roles', { token: admin });
  const accRole = roles.data.find((r) => r.name === 'accountant');
  console.log('accountant roleId =', accRole?.id);

  async function mkUser(username, fullName) {
    const r = await request(BASE, 'POST', '/users', {
      token: admin,
      body: { username, password: 'password123', fullName, roleId: accRole.id },
    });
    if (!r.ok) console.log(`create ${username}:`, r.status, JSON.stringify(r.body));
    return r;
  }

  // 1. Full accountant
  await mkUser('t5acc', 'T5 Accountant');
  const accLogin = await request(BASE, 'POST', '/auth/login', { body: { username: 't5acc', password: 'password123' } });
  out.accountant = { token: accLogin.data?.accessToken, refresh: accLogin.data?.refreshToken, user: accLogin.data?.user };

  // 2. Accountant with page access revoked (revoke /expenses to test PageAccessGuard)
  const rev = await mkUser('t5rev', 'T5 Revoked');
  const revUserId = rev.data?.id;
  // Inspect current page access
  const pa = await request(BASE, 'GET', `/page-access/user/${revUserId}`, { token: admin });
  out._pageAccessShape = pa.body;
  // Try to revoke all pages via bulk
  if (pa.data?.pages) {
    const updates = pa.data.pages.map((p) => ({ path: p.path, allowed: false }));
    const bulk = await request(BASE, 'PUT', '/page-access/bulk', { token: admin, body: { userId: revUserId, pages: updates } });
    out._bulkRevokeResult = { status: bulk.status, body: bulk.body };
  }
  const revLogin = await request(BASE, 'POST', '/auth/login', { body: { username: 't5rev', password: 'password123' } });
  out.revoked = { token: revLogin.data?.accessToken, user: revLogin.data?.user };

  // 3. Deactivated user: capture token BEFORE deactivation
  const deact = await mkUser('t5deact', 'T5 Deactivated');
  const deactId = deact.data?.id;
  const deactLogin = await request(BASE, 'POST', '/auth/login', { body: { username: 't5deact', password: 'password123' } });
  out.deactivated = { id: deactId, token: deactLogin.data?.accessToken, refresh: deactLogin.data?.refreshToken };
  // Deactivate via admin DELETE (soft delete)
  const del = await request(BASE, 'DELETE', `/users/${deactId}`, { token: admin });
  out._deactivateResult = del.status;

  out.accountantRoleId = accRole?.id;
  fs.writeFileSync(new URL('./principals.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log('principals saved. tokens present:',
    { admin: !!out.admin.token, acc: !!out.accountant.token, rev: !!out.revoked.token, deact: !!out.deactivated.token });
  console.log('page-access shape:', JSON.stringify(out._pageAccessShape)?.slice(0, 300));
  console.log('bulk revoke:', JSON.stringify(out._bulkRevokeResult));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
