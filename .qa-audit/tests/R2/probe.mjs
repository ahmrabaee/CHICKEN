import fs from 'node:fs';
import { request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const m = JSON.parse(fs.readFileSync('E:/DEV/Chicken FMS/.qa-audit/envs/r2/meta.json','utf8'));
for (const [meth,p,b] of [['POST','/auth/login',{username:'admin',password:'admin123'}]]) { const r=await request(m.baseUrl,meth,p,{body:b}); console.log(meth,p,r.status,JSON.stringify(r.body).slice(0,300)); }
