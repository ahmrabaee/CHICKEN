// Prove accountant can actually WRITE on admin-only (no RolesGuard) controllers.
import { request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import fs from 'node:fs';
const BASE = 'http://localhost:3125/v1';
const P = JSON.parse(fs.readFileSync(new URL('./principals.json', import.meta.url)));
const admin = P.admin.token, acc = P.accountant.token;

async function main() {
  // 1. Backup config path_vps write by accountant (path-control primitive)
  const before = await request(BASE, 'GET', '/system/backup/config', { token: admin });
  const origPath = before.data?.path_vps;
  const w = await request(BASE, 'PUT', '/system/backup/config', { token: acc, body: { path_vps: 'C:/t5-attacker-controlled-path' } });
  const after = await request(BASE, 'GET', '/system/backup/config', { token: admin });
  console.log('[accountant] PUT backup config path_vps ->', w.status, '| persisted path_vps =', after.data?.path_vps,
    after.data?.path_vps === 'C:/t5-attacker-controlled-path' ? '*** GUARD GAP: ACCOUNTANT WROTE BACKUP PATH ***' : '');
  // revert
  await request(BASE, 'PUT', '/system/backup/config', { token: admin, body: { path_vps: origPath } });

  // 2. Tax template create by accountant (controller uses inline type, not a validated class DTO)
  const t = await request(BASE, 'POST', '/tax/templates', { token: acc, body: { name: 'T5-Evil-VAT', type: 'sales', items: [{ accountId: 18, rate: 9900, chargeType: 'on_net_total', displayOrder: 1 }] } });
  console.log('[accountant] POST tax template ->', t.status, t.ok ? `*** GUARD GAP: created id=${t.data?.id} rate=9900bps ***` : JSON.stringify(t.body).slice(0,160));
  if (t.ok && t.data?.id) {
    const del = await request(BASE, 'DELETE', `/tax/templates/${t.data.id}`, { token: acc });
    console.log('[accountant] DELETE tax template ->', del.status, '(cleanup; also a guard gap)');
  }

  // 3. Accountant posts/reverses a JOURNAL ENTRY (accounting.controller @Roles admin,accountant - by design accountant allowed)
  //    and chart-of-accounts account.controller (no RolesGuard) createAccount is admin-only:
  const acctCreate = await request(BASE, 'POST', '/accounting/accounts', { token: acc, body: {} });
  console.log('[accountant] POST /accounting/accounts (admin-only) ->', acctCreate.status, acctCreate.status === 403 ? '(blocked by guarded AccountingController)' : '(reached - check which controller won)');

  // 4. Reconciliation apply (no RolesGuard; writes PLE)
  const recon = await request(BASE, 'POST', '/reconciliation/apply', { token: acc, body: {} });
  console.log('[accountant] POST /reconciliation/apply ->', recon.status, recon.status === 403 ? '(blocked)' : '(guard PASSED - accountant can allocate)');

  // 5. Credit note create (no RolesGuard)
  const cn = await request(BASE, 'POST', '/credit-notes', { token: acc, body: {} });
  console.log('[accountant] POST /credit-notes ->', cn.status, cn.status === 403 ? '(blocked)' : '(guard PASSED)');

  // 6. Wastage create (NO guard at all) + sales create (no guard)
  const wst = await request(BASE, 'POST', '/wastage', { token: acc, body: {} });
  console.log('[accountant] POST /wastage ->', wst.status, wst.status === 403 ? '(blocked)' : '(guard PASSED - any user can post wastage: stock+GL write)');
  const revokedSale = await request(BASE, 'POST', '/sales', { token: P.revoked.token, body: {} });
  console.log('[revoked-pages accountant] POST /sales ->', revokedSale.status, revokedSale.status === 403 ? '(blocked)' : '(guard PASSED - no page gate on sales create)');
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
