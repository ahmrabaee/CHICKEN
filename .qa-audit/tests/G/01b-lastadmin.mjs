import { connect, request, BASE, show } from './lib.mjs';
const a = await connect(BASE,'admin','admin123');
console.log('role after relogin', a.user.role, a.user.allowedPages);
show('GET /users (admin demoted)', await a.get('/users'));
show('GET /settings', await a.get('/settings'));
show('PUT /users/1 roleId 1 (self-restore)', await a.put('/users/1',{roleId:1}));
