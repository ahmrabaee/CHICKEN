import { connect, request, BASE, show } from './lib.mjs';
const a = await connect(BASE, 'admin', 'admin123');
console.log('--- USERS');
let r = await a.get('/users'); show('GET /users', r);
const me = a.user; console.log('me', JSON.stringify(me));
show('roles', await a.get('/users/roles'));
show('active-sessions', await a.get('/users/active-sessions'));
// last admin protection
const users = (await a.get('/users')).data;
const list = users.items || users.data || users;
console.log('users count', Array.isArray(list)?list.length:Object.keys(users));
show('DELETE self (last admin)', await a.del('/users/'+me.id));
show('PUT self isActive=false', await a.put('/users/'+me.id, {isActive:false}));
show('PUT self role=accountant', await a.put('/users/'+me.id, {role:'accountant'}));
show('PUT self roleId?', await a.put('/users/'+me.id, {roleId:2}));
show('POST /users weak pw', await a.post('/users', {username:'g1',password:'12345678',fullName:'G one',role:'accountant'}));
show('POST /users dup username', await a.post('/users', {username:'g1',password:'12345678',fullName:'G one',role:'accountant'}));
show('POST /users dup username case', await a.post('/users', {username:'G1',password:'12345678',fullName:'G one',role:'accountant'}));
show('POST /users bad role', await a.post('/users', {username:'g2',password:'12345678',fullName:'G two',role:'superuser'}));
show('POST /users admin role', await a.post('/users', {username:'gadm',password:'Admin12345',fullName:'G adm',role:'admin'}));
show('POST /users cashier', await a.post('/users', {username:'gcash',password:'Cash12345',fullName:'G cash',role:'cashier'}));
// second admin: then deactivate/delete original
const list2 = (await a.get('/users')).data; const arr = list2.items||list2.data||list2;
const g1 = arr.find(u=>u.username==='g1'); const gadm = arr.find(u=>u.username==='gadm');
console.log('ids', g1?.id, gadm?.id);
// deactivate gadm (other admin) then try deleting main admin
show('DELETE other admin', await a.del('/users/'+gadm?.id));
show('GET users after', await a.get('/users'));
show('reset-password short', await a.post('/users/'+g1.id+'/reset-password', {newPassword:'1'}));
show('reset-password ok', await a.post('/users/'+g1.id+'/reset-password', {newPassword:'Newpass123'}));
const g1login = await request(BASE,'POST','/auth/login',{body:{username:'g1',password:'Newpass123'}}); show('g1 login new pw', g1login);
show('g1 login old pw', await request(BASE,'POST','/auth/login',{body:{username:'g1',password:'12345678'}}));
// change password flow
const g = await connect(BASE,'g1','Newpass123');
show('change-pw wrong current', await g.post('/auth/change-password',{currentPassword:'x',newPassword:'Another123'}));
show('change-pw same', await g.post('/auth/change-password',{currentPassword:'Newpass123',newPassword:'Newpass123'}));
show('change-pw weak', await g.post('/auth/change-password',{currentPassword:'Newpass123',newPassword:'a'}));
show('change-pw ok', await g.post('/auth/change-password',{currentPassword:'Newpass123',newPassword:'Another123'}));
show('old token after change /auth/me', await g.get('/auth/me'));
show('login with old pw', await request(BASE,'POST','/auth/login',{body:{username:'g1',password:'Newpass123'}}));
show('login new pw', await request(BASE,'POST','/auth/login',{body:{username:'g1',password:'Another123'}}));
show('PUT /users/me', await g.put('/users/me',{fullName:'Renamed', role:'admin'}));
show('GET /users/me', await g.get('/users/me'));
// delete user with history
show('DELETE g1', await a.del('/users/'+g1.id));
show('login deleted g1', await request(BASE,'POST','/auth/login',{body:{username:'g1',password:'Another123'}}));
console.log('--- SETUP');
show('check-setup', await request(BASE,'POST','/auth/check-setup',{body:{}}));
show('setup again', await request(BASE,'POST','/auth/setup',{body:{companyName:'X',adminUsername:'hack',adminPassword:'Hack12345',adminFullName:'H',username:'hack',password:'Hack12345',fullName:'H'}}));
console.log('--- BRANCHES');
show('GET branches', await a.get('/branches'));
const br = (await a.get('/branches')).data; const bl = br.items||br.data||br; console.log(JSON.stringify(bl).slice(0,400));
const main = bl[0];
show('DELETE main branch', await a.del('/branches/'+main.id));
show('PUT main inactive', await a.put('/branches/'+main.id,{isActive:false}));
show('POST branch', await a.post('/branches',{name:'B2',code:'B2'}));
show('POST branch dup code', await a.post('/branches',{name:'B2',code:'B2'}));
show('GET branches 2', await a.get('/branches'));
