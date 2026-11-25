// R2: latency/failure profile under concurrent writers, with and without backups; audit-row completeness; WAL files.
import fs from 'node:fs';
import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { DatabaseSync } from 'node:sqlite';
const m = JSON.parse(fs.readFileSync('E:/DEV/Chicken FMS/.qa-audit/envs/r2/meta.json','utf8'));
const c = await connect(m.baseUrl, 'admin', 'admin123');
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const q = (sql)=>{const d=new DatabaseSync(m.db,{readOnly:true}); try{return d.prepare(sql).all();}finally{d.close();}};
const pct=(a,p)=>a.sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
async function phase(name, secs, withBackup){
  const lat=[], st={}; let stop=false;
  const w=async()=>{while(!stop){const t=Date.now();const r=await c.post('/sales',{saleType:'cash',lines:[{itemId:4,weightGrams:10,pricePerKg:2800}],payments:[{paymentMethod:'cash',amount:28}]});lat.push(Date.now()-t);st[r.status]=(st[r.status]||0)+1;}};
  const ws=[w(),w(),w()];
  const t0=Date.now(); let bk=[];
  while(Date.now()-t0<secs*1000){ if(withBackup){const t=Date.now(); const r=await c.post('/system/backup',{}); bk.push(Date.now()-t+':'+r.status);} await sleep(1200);}
  stop=true; await Promise.all(ws);
  console.log(name, JSON.stringify({n:lat.length,status:st,p50:pct(lat,.5),p95:pct(lat,.95),p99:pct(lat,.99),max:Math.max(...lat),backups:bk.length}));
}
console.log('journal_mode', JSON.stringify(q('pragma journal_mode')), 'files', fs.readdirSync(m.db.replace(/\/[^/]*$/,'')).filter(f=>f.startsWith('app.db')));
const a0=q("select count(*) n from audit_logs")[0].n, s0=q("select count(*) n from sales")[0].n;
await phase('no-backup', 15, false);
const a1=q("select count(*) n from audit_logs")[0].n, s1=q("select count(*) n from sales")[0].n;
console.log('sales created',s1-s0,'audit rows added',a1-a0);
await phase('with-backup', 25, true);
await sleep(1500);
const a2=q("select count(*) n from audit_logs")[0].n, s2=q("select count(*) n from sales")[0].n;
console.log('sales created',s2-s1,'audit rows added (includes backup POSTs)',a2-a1, 'JE integrity', JSON.stringify(q('pragma integrity_check')));
