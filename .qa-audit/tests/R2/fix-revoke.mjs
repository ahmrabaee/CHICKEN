// Revoke all page access for t5rev and re-login to refresh its token/allowedPages.
import { request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import fs from 'node:fs';
const BASE = 'http://localhost:3125/v1';
const P = JSON.parse(fs.readFileSync(new URL('./principals.json', import.meta.url)));
const admin = P.admin.token;

const users = await request(BASE, 'GET', '/users', { token: admin });
const list = Array.isArray(users.data) ? users.data : users.data.items;
const rev = list.find((u) => u.username === 't5rev');
const acc = list.find((u) => u.username === 't5acc');
console.log('t5rev id', rev.id, 't5acc id', acc.id);

const pa = await request(BASE, 'GET', `/page-access/user/${rev.id}`, { token: admin });
const items = pa.data.pages.map((p) => ({ userId: rev.id, pageKey: p.key, allowed: false }));
const bulk = await request(BASE, 'PUT', '/page-access/bulk', { token: admin, body: { items } });
console.log('bulk revoke status', bulk.status, JSON.stringify(bulk.body).slice(0, 150));

// Verify
const pa2 = await request(BASE, 'GET', `/page-access/user/${rev.id}`, { token: admin });
console.log('allowed pages after revoke:', pa2.data.pages.filter((p) => p.allowed).map((p) => p.path));

// Re-login t5rev so its JWT carries the revoked allowedPages
const revLogin = await request(BASE, 'POST', '/auth/login', { body: { username: 't5rev', password: 'password123' } });
P.revoked = { token: revLogin.data.accessToken, user: revLogin.data.user, id: rev.id };
P.accountant.id = acc.id;
console.log('t5rev allowedPages in token user obj:', revLogin.data.user.allowedPages);
fs.writeFileSync(new URL('./principals.json', import.meta.url), JSON.stringify(P, null, 2));
