import fs from 'node:fs';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const m = JSON.parse(fs.readFileSync('E:/DEV/Chicken FMS/.qa-audit/envs/r2/meta.json','utf8'));
const c = await connect(m.baseUrl,'admin','admin123');
const items=(await c.get('/system/backups?limit=50')).data.items;
const fake=items.find(x=>/import/.test(x.filename)); const good=items.find(x=>/manual_2/.test(x.filename)&&x.status==='success');
console.log('fake',fake?.id,fake?.filename,'good',good?.id);
const r=await c.post(`/system/backups/${fake.id}/restore`,{}); console.log('restore fake ->',r.status,JSON.stringify(r.body).slice(0,200));
for(const p of ['/sales?pageSize=1','/items','/users/me']){const x=await c.get(p);console.log(' GET',p,x.status);}
let l; try{await connect(m.baseUrl,'admin','admin123');l='ok'}catch(e){l=e.message.slice(0,100)} console.log(' login ->',l);
const rec=await c.post(`/system/backups/${good.id}/restore`,{}); console.log('recovery via API restore good ->',rec.status);
console.log(' GET /sales after recovery',(await c.get('/sales?pageSize=1')).status);
