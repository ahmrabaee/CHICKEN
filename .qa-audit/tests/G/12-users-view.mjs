import { connect, BASE, show } from './lib.mjs';
const a = await connect(BASE, 'admin', 'Hacked12345');
const u = (await a.get('/users')).data; console.log(JSON.stringify(u.map(x=>[x.username,x.isActive,x.isLoggedIn,x.lastLoginAt,x.workStartDate])));
const s = (await a.get('/users/active-sessions')).data; console.log(JSON.stringify(s));
await a.post('/auth/logout',{}); 
const b = await connect(BASE, 'admin', 'Hacked12345');
console.log('after logout+login', JSON.stringify((await b.get('/users')).data.filter(x=>x.username==='admin').map(x=>[x.isLoggedIn,x.lastLoginAt])));
// filters
console.log('users?isActive=false', JSON.stringify((await b.get('/users?isActive=false')).data.map(x=>x.username)));
console.log('users?roleId=1', JSON.stringify((await b.get('/users?roleId=1')).data.map(x=>x.username)));
console.log('users?search=gacc', JSON.stringify((await b.get('/users?search=gacc')).data.map(x=>x.username)));
