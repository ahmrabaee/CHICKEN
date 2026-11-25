import { connect, request, BASE, show } from './lib.mjs';
const a = await connect(BASE, 'admin', 'admin123');
const U = async()=> (await a.get('/users')).data;
show('POST /users weak pw', await a.post('/users', {username:'gg1',password:'12345678',fullName:'G one',roleId:2}));
show('POST /users short pw', await a.post('/users', {username:'gg1b',password:'1234567',fullName:'G one',roleId:2}));
show('POST /users dup username', await a.post('/users', {username:'gg1',password:'12345678',fullName:'G one',roleId:2}));
show('POST /users dup username CASE', await a.post('/users', {username:'GG1',password:'12345678',fullName:'G one',roleId:2}));
show('POST /users roleId 999', await a.post('/users', {username:'gg2',password:'12345678',fullName:'G two',roleId:999}));
show('POST /users no email dup', await a.post('/users', {username:'gg3',password:'12345678',fullName:'G3',roleId:2,email:'x@y.com'}));
show('POST /users dup email', await a.post('/users', {username:'gg4',password:'12345678',fullName:'G4',roleId:2,email:'x@y.com'}));
show('POST /users 2nd admin', await a.post('/users', {username:'gadm',password:'Admin12345',fullName:'G adm',roleId:1}));
show('POST /users bad branch', await a.post('/users', {username:'gg5',password:'12345678',fullName:'G5',roleId:2,defaultBranchId:999}));
const arr = await U(); console.log(arr.map(u=>[u.id,u.username,u.isActive,u.roles].join(':')).join(' | '));
const g1 = arr.find(u=>u.username==='gg1'), gadm=arr.find(u=>u.username==='gadm');
// role-less user via bad roleId update
show('PUT g1 roleId 999', await a.put('/users/'+g1.id,{roleId:999}));
console.log('g1 after', JSON.stringify((await U()).find(u=>u.username==='gg1')));
show('g1 login (no role?)', await request(BASE,'POST','/auth/login',{body:{username:'gg1',password:'12345678'}}));
show('PUT g1 roleId 2 restore', await a.put('/users/'+g1.id,{roleId:2}));
// self demote when another admin exists / last-admin demotion
show('DELETE gadm (2 admins)', await a.del('/users/'+gadm.id));
console.log('active admins', (await U()).filter(u=>u.isActive&&u.roles.includes('admin')).length);
show('DELETE gadm again (already inactive)', await a.del('/users/'+gadm.id));
show('PUT gadm roleId 2 (demote inactive)', await a.put('/users/'+gadm.id,{roleId:2}));
show('PUT gadm isActive true (reactivate?)', await a.put('/users/'+gadm.id,{isActive:true}));
show('login deactivated gadm', await request(BASE,'POST','/auth/login',{body:{username:'gadm',password:'Admin12345'}}));
// PUT /users/:id password w/o policy
show('PUT g1 password 1char', await a.put('/users/'+g1.id,{password:'a'}));
show('PUT g1 password 8chars', await a.put('/users/'+g1.id,{password:'abcdefgh'}));
show('PUT username to admin (dup)', await a.put('/users/'+g1.id,{username:'admin'}));
show('PUT username ""', await a.put('/users/'+g1.id,{username:''}));
show('reset-password empty', await a.post('/users/'+g1.id+'/reset-password',{newPassword:''}));
show('reset-password 8', await a.post('/users/'+g1.id+'/reset-password',{newPassword:'Newpass123'}));
show('reset-password unknown user', await a.post('/users/9999/reset-password',{newPassword:'Newpass123'}));
// session invalidation on reset
const g = await connect(BASE,'gg1','Newpass123'); const oldTok = g.token;
const rr = await request(BASE,'POST','/auth/login',{body:{username:'gg1',password:'Newpass123'}}); const refresh = rr.data.refreshToken;
show('admin resets g1 pw again', await a.post('/users/'+g1.id+'/reset-password',{newPassword:'Third12345'}));
show('old access token after admin reset', await g.get('/auth/me'));
show('old refresh after admin reset', await request(BASE,'POST','/auth/refresh',{body:{refreshToken:refresh}}));
// change password flow
const g2 = await connect(BASE,'gg1','Third12345');
show('change-pw wrong current', await g2.post('/auth/change-password',{currentPassword:'x',newPassword:'Another123'}));
show('change-pw same as old', await g2.post('/auth/change-password',{currentPassword:'Third12345',newPassword:'Third12345'}));
show('change-pw weak', await g2.post('/auth/change-password',{currentPassword:'Third12345',newPassword:'a'}));
show('change-pw ok', await g2.post('/auth/change-password',{currentPassword:'Third12345',newPassword:'Another123'}));
show('login w/ old', await request(BASE,'POST','/auth/login',{body:{username:'gg1',password:'Third12345'}}));
show('PUT /users/me w/ extra fields', await g2.put('/users/me',{fullName:'Renamed', roleId:1}));
show('GET /auth/me after', await g2.get('/auth/me'));
// self demotion - sole admin
console.log('--- LAST ADMIN');
show('PUT admin roleId 2 (SOLE ADMIN DEMOTES SELF)', await a.put('/users/1',{roleId:2}));
console.log('active admins now', (await (await connect(BASE,'admin','admin123')).get('/users')).status);
// delete user with history (sales)
show('DELETE g1', await a.del('/users/'+g1.id));
