// V2: T5-002 independent re-proof — accountant list/import/restore backups
import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';

const BASE = 'http://localhost:3117/v1';
const admin = await connect(BASE, 'admin', 'admin123');

const roles = await admin.get('/users/roles');
console.log('roles:', JSON.stringify(roles.data));

const roleId = (roles.data || []).find((r) => /account/i.test(r.name))?.id;
console.log('accountant roleId=', roleId);

const username = 'v2acc';
const password = 'Accountant123!';
const createR = await admin.post('/users', {
  username, password, fullName: 'V2 Accountant', fullNameEn: 'V2 Accountant',
  email: 'v2acc@test.local', roleId, preferredLanguage: 'ar', defaultBranchId: 1,
});
console.log('create accountant ->', createR.status, JSON.stringify(createR.body).slice(0, 300));

const acc = await connect(BASE, username, password);
console.log('accountant login OK, role=', acc.user.role ?? JSON.stringify(acc.user.roles));

const list = await acc.get('/system/backups');
console.log('T5-002a: accountant GET /system/backups ->', list.status, JSON.stringify(list.data).slice(0, 300));

const cfg = await acc.get('/system/backup/config');
console.log('T5-002b: accountant GET /system/backup/config ->', cfg.status);

const cfgPut = await acc.put('/system/backup/config', { path_vps: 'C:/tmp/attacker-backups' });
console.log('T5-002c: accountant PUT /system/backup/config (redirect backup dir) ->', cfgPut.status, JSON.stringify(cfgPut.body).slice(0, 200));

const create = await acc.post('/system/backup', {});
console.log('T5-002d: accountant POST /system/backup (trigger backup) ->', create.status, JSON.stringify(create.body).slice(0, 200));

// wait for admin's earlier backup (id known) or this one to complete, then try download-link + restore as accountant
await new Promise((r) => setTimeout(r, 3000));
const list2 = await acc.get('/system/backups');
const items = list2.data?.items ?? [];
console.log('backups visible to accountant:', items.length, JSON.stringify(items.slice(0, 3)));
const done = items.find((x) => x.status === 'success' || x.status === 'completed');
if (done) {
  const dlLink = await acc.post(`/system/backups/${done.id}/download-link`, {});
  console.log('T5-002e: accountant mint download-link for backup', done.id, '->', dlLink.status, JSON.stringify(dlLink.body).slice(0, 200));

  // RESTORE as accountant — do this LAST since it mutates the DB irreversibly on this instance (our own isolated instance, allowed)
  const restore = await acc.post(`/system/backups/${done.id}/restore`, {});
  console.log('T5-002f: accountant POST /system/backups/:id/restore ->', restore.status, JSON.stringify(restore.body).slice(0, 300));
} else {
  console.log('no completed backup found to test download-link/restore');
}

console.log('DONE');
