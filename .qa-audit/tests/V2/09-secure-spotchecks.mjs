// V2: spot-check "verified secure" items — SQLi via sort/search, setup re-run, PUT /users/me mass-assignment
import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const BASE = 'http://localhost:3117/v1';
const admin = await connect(BASE, 'admin', 'admin123');
function logJ(label, r) { console.log(label, r.status, JSON.stringify(r.body).slice(0, 300)); }

// SQLi via search/sort
const sqli1 = await admin.get(`/items?search=${encodeURIComponent("' OR '1'='1")}`);
logJ('SQLi search payload on /items', sqli1);
const sqli2 = await admin.get(`/items?sortBy=${encodeURIComponent("name; DROP TABLE items;--")}`);
logJ('SQLi sortBy payload on /items', sqli2);
const sqli3 = await admin.get(`/customers?search=${encodeURIComponent("x' UNION SELECT username,password_hash,3,4,5 FROM users--")}`);
logJ('SQLi UNION payload on /customers search', sqli3);

// confirm table still exists after attempts
const itemsAfter = await admin.get('/items');
console.log('items table intact after SQLi attempts:', itemsAfter.status, 'count=', itemsAfter.data?.length ?? itemsAfter.body?.pagination?.totalItems);

// setup re-run
const setupStatus = await request(BASE, 'GET', '/setup/status', {});
logJ('GET /setup/status', setupStatus);
const setupRerun = await request(BASE, 'POST', '/setup/complete', { body: { username: 'hacker', password: 'Hacker123!', fullName: 'Hacker' } });
logJ('POST /setup/complete (re-run attempt)', setupRerun);

// mass assignment via PUT /users/me
const meBefore = await admin.get('/users/me');
logJ('me before', meBefore);
const massAssign = await admin.put('/users/me', { fullName: 'Admin Updated', roleId: 2, isActive: false, username: 'pwned', passwordHash: 'x', role: 'accountant' });
logJ('PUT /users/me mass-assignment attempt', massAssign);
const meAfter = await admin.get('/users/me');
logJ('me after', meAfter);
console.log('role unchanged?', meBefore.data?.roles?.[0] === meAfter.data?.roles?.[0], 'username unchanged?', meBefore.data?.username === meAfter.data?.username, 'isActive unchanged?', meBefore.data?.isActive === meAfter.data?.isActive);

console.log('DONE');
