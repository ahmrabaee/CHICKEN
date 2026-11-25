// Privilege escalation, forbidden financial visibility (PRD), and token lifecycle.
import { request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import fs from 'node:fs';
const BASE = 'http://localhost:3125/v1';
const P = JSON.parse(fs.readFileSync(new URL('./principals.json', import.meta.url)));
const admin = P.admin.token, acc = P.accountant.token;
const line = (...a) => console.log(...a);
const brief = (r) => `${r.status} ${JSON.stringify(r.body).slice(0, 120)}`;

async function section(t) { line(`\n==================== ${t} ====================`); }

async function main() {
  // ---------- A. PRIVILEGE ESCALATION (accountant) ----------
  await section('A. PRIVILEGE ESCALATION (as accountant t5acc)');
  const createAdmin = await request(BASE, 'POST', '/users', { token: acc, body: { username: 'evil', password: 'password123', fullName: 'E', roleId: 1 } });
  line('create admin user ->', createAdmin.status, '(403 expected)');
  const editAdmin = await request(BASE, 'PUT', '/users/1', { token: acc, body: { fullName: 'hacked' } });
  line('edit admin (PUT /users/1) ->', editAdmin.status, '(403 expected)');
  const resetAdminPw = await request(BASE, 'POST', '/users/1/reset-password', { token: acc, body: { newPassword: 'password123' } });
  line('reset admin password ->', resetAdminPw.status, '(403 expected)');
  const grantSelf = await request(BASE, 'PUT', '/page-access/bulk', { token: acc, body: { items: [{ userId: P.accountant.id || 2, pageKey: 'settings', allowed: true }] } });
  line('grant self page access ->', grantSelf.status, '(403 expected)');

  // Mass assignment via self-profile: try to inject roleId / isActive / username
  const meBefore = await request(BASE, 'GET', '/users/me', { token: acc });
  const massAssign = await request(BASE, 'PUT', '/users/me', { token: acc, body: { fullName: 'Me', roleId: 1, isActive: true, username: 'superadmin', passwordHash: 'x' } });
  const meAfter = await request(BASE, 'GET', '/users/me', { token: acc });
  line('self PUT with roleId/isActive/username injected ->', massAssign.status);
  line('  roles before:', JSON.stringify(meBefore.data?.roles), '-> after:', JSON.stringify(meAfter.data?.roles), '| username:', meAfter.data?.username);

  // Guard-gap WRITES available to accountant (should be admin-only)
  const taxCreate = await request(BASE, 'POST', '/tax/templates', { token: acc, body: { name: 'T5 Evil Tax', rows: [{ label: 'VAT', rate: 1500, basis: 'on_net_total' }] } });
  line('accountant CREATE tax template ->', taxCreate.status, taxCreate.ok ? '*** GUARD GAP: WROTE ***' : '');
  const cfgBefore = await request(BASE, 'GET', '/system/backup/config', { token: acc });
  const cfgWrite = await request(BASE, 'PUT', '/system/backup/config', { token: acc, body: { ...(cfgBefore.data || {}), retentionDays: 1 } });
  line('accountant WRITE backup config ->', cfgWrite.status, cfgWrite.ok ? '*** GUARD GAP: WROTE ***' : brief(cfgWrite));
  const accRestore = await request(BASE, 'POST', '/system/backups/99999/restore', { token: acc, body: {} });
  line('accountant restore (id 99999) ->', accRestore.status, '(404=guard PASSED; could restore a real id)');

  // ---------- B. FORBIDDEN FINANCIAL VISIBILITY (PRD: cashier/accountant must NOT see cost/profit/supplier prices/expenses/financial reports) ----------
  await section('B. FORBIDDEN FINANCIAL VISIBILITY (as accountant)');
  const pl = await request(BASE, 'GET', '/reports/profit-loss?startDate=2026-01-01&endDate=2026-12-31', { token: acc });
  line('profit-loss ->', pl.status, pl.ok ? `netProfit=${pl.data?.netProfit} COGS=${pl.data?.costOfGoodsSold} *** EXPOSED ***` : '');
  const svg = await request(BASE, 'GET', '/reports/stock-vs-gl', { token: acc });
  line('stock-vs-gl ->', svg.status, svg.ok ? '*** EXPOSED ***' : '');
  const exp = await request(BASE, 'GET', '/reports/expenses?startDate=2026-01-01&endDate=2026-12-31', { token: acc });
  line('expenses report ->', exp.status, exp.ok ? '*** EXPOSED ***' : '');
  const purch = await request(BASE, 'GET', '/purchases/1', { token: acc });
  line('purchase detail (supplier cost prices) ->', purch.status, purch.ok ? `supplier=${purch.data?.supplierId} total=${purch.data?.totalAmount} *** EXPOSED ***` : '');
  const sale = await request(BASE, 'GET', '/sales/1', { token: acc });
  const saleStr = JSON.stringify(sale.data || {});
  const costFields = ['totalCost', 'totalProfit', 'cost', 'profit', 'margin'].filter((f) => saleStr.includes(f));
  line('sale detail ->', sale.status, '| cost/profit fields present:', JSON.stringify(costFields));
  const dash = await request(BASE, 'GET', '/reports/dashboard?startDate=2026-01-01&endDate=2026-12-31', { token: acc });
  line('dashboard report ->', dash.status, dash.ok ? `keys=${Object.keys(dash.data||{}).slice(0,8)}` : '');

  // ---------- C. TOKEN LIFECYCLE ----------
  await section('C. TOKEN LIFECYCLE');
  // Fresh session for lifecycle (do not disturb shared tokens)
  const fresh = await request(BASE, 'POST', '/auth/login', { body: { username: 't5acc', password: 'password123' } });
  const fAccess = fresh.data.accessToken, fRefresh = fresh.data.refreshToken;
  // C1 logout revocation
  const logout = await request(BASE, 'POST', '/auth/logout', { token: fAccess, body: {} });
  const afterLogoutAccess = await request(BASE, 'GET', '/users/me', { token: fAccess });
  const afterLogoutRefresh = await request(BASE, 'POST', '/auth/refresh', { body: { refreshToken: fRefresh } });
  line('C1 logout:', logout.status, '| ACCESS token after logout ->', afterLogoutAccess.status, '(200=NOT revoked)',
    '| REFRESH after logout ->', afterLogoutRefresh.status, '(401=revoked)');

  // C2 refresh rotation / reuse: login fresh, call refresh twice with SAME refresh token
  const s2 = await request(BASE, 'POST', '/auth/login', { body: { username: 't5acc', password: 'password123' } });
  const r1 = await request(BASE, 'POST', '/auth/refresh', { body: { refreshToken: s2.data.refreshToken } });
  const r2 = await request(BASE, 'POST', '/auth/refresh', { body: { refreshToken: s2.data.refreshToken } });
  line('C2 refresh reuse: first ->', r1.status, '| second (same token) ->', r2.status, '(both 200 = NO rotation, replayable)');

  // C3 password change invalidation: login, change password, test old ACCESS + old REFRESH
  const s3 = await request(BASE, 'POST', '/auth/login', { body: { username: 't5acc', password: 'password123' } });
  const oldAccess = s3.data.accessToken, oldRefresh = s3.data.refreshToken;
  const chg = await request(BASE, 'POST', '/auth/change-password', { token: oldAccess, body: { currentPassword: 'password123', newPassword: 'password456' } });
  const accAfterChg = await request(BASE, 'GET', '/users/me', { token: oldAccess });
  const refAfterChg = await request(BASE, 'POST', '/auth/refresh', { body: { refreshToken: oldRefresh } });
  line('C3 change-password:', chg.status, '| old ACCESS after change ->', accAfterChg.status, '(200=still valid until exp)',
    '| old REFRESH ->', refAfterChg.status, '(401=revoked)');
  // revert password
  const reLogin = await request(BASE, 'POST', '/auth/login', { body: { username: 't5acc', password: 'password456' } });
  if (reLogin.ok) await request(BASE, 'POST', '/auth/change-password', { token: reLogin.data.accessToken, body: { currentPassword: 'password456', newPassword: 'password123' } });

  // C4 deactivated user's REFRESH token
  const deRef = await request(BASE, 'POST', '/auth/refresh', { body: { refreshToken: P.deactivated.refresh } });
  line('C4 deactivated user REFRESH ->', deRef.status, '(401 USER_INACTIVE expected)');
  const deAcc = await request(BASE, 'GET', '/users/me', { token: P.deactivated.token });
  line('   deactivated user old ACCESS token ->', deAcc.status, '(401 expected: strategy re-checks isActive)');
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
