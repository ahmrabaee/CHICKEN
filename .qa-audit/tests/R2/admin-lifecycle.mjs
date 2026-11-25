// R2: QA-009/010 quick re-check on fresh instance
import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const B='http://localhost:3125/v1'; const j=(r)=>`${r.status} ${JSON.stringify(r.body).slice(0,130)}`;
const a=await connect(B,'admin','admin123');
// 010 bool filters
for (const [p,l] of [['/items?isActive=false&pageSize=100','items isActive=false'],['/customers?isActive=false&pageSize=100','customers isActive=false'],['/users?isActive=false','users isActive=false']]) { const r=await a.get(p); const arr=Array.isArray(r.data)?r.data:(r.data?.items||[]); console.log(l.padEnd(28),r.status,'rows',arr.length,'inactive among them',arr.filter(x=>x.isActive===false).length); }
// deactivate an item then list inactive
const it=await a.post('/items',{code:'R2-X',name:'r2x',categoryId:1,defaultSalePrice:1000,defaultPurchasePrice:500}); await a.del(`/items/${it.data.id}`);
const l=await a.get('/items?isActive=false&pageSize=100'); const arr=Array.isArray(l.data)?l.data:(l.data?.items||[]); console.log('after soft-deleting item',it.data.id,': isActive=false list contains it?',arr.some(x=>x.id===it.data.id),'| rows',arr.length);
// 009 self demote sole admin
const roles=(await a.get('/users/roles')).data; const acc=roles.find(r=>r.name==='accountant').id;
console.log('self-demote sole admin PUT /users/1 {roleId:accountant} ->',j(await a.put('/users/1',{roleId:acc})));
const r2=await request(B,'POST','/auth/login',{body:{username:'admin',password:'admin123'}}); console.log('admin relogin roles',JSON.stringify(r2.data?.user?.role||r2.data?.user?.roles));
const tok=r2.data?.accessToken; const g=await request(B,'GET','/users',{token:tok}); console.log('GET /users as demoted ->',g.status);
// settings garbage (009/065)
console.log('PUT /settings/arbitrary_key ->',j(await request(B,'PUT','/settings/zzz.anything',{token:tok,body:{value:'x'}})));
