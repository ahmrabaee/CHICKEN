// R2: WAL-mode backups under heavy writes (5 writers, 20 backups) + restore of the last one under live writes.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { DatabaseSync } from 'node:sqlite';
const QA='E:/DEV/Chicken FMS/.qa-audit';
const m = JSON.parse(fs.readFileSync(`${QA}/envs/r2/meta.json`,'utf8'));
const c = await connect(m.baseUrl, 'admin', 'admin123');
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const q=(db,sql)=>{const d=new DatabaseSync(db,{readOnly:true});try{return d.prepare(sql).all();}finally{d.close();}};
let stop=false; const st={}; 
const w=async()=>{while(!stop){const r=await c.post('/sales',{saleType:'cash',lines:[{itemId:4,weightGrams:10,pricePerKg:2800}],payments:[{paymentMethod:'cash',amount:28}]});st[r.status]=(st[r.status]||0)+1;}};
const ws=[w(),w(),w(),w(),w()];
const dir=`${QA}/tests/R2/_bk`; fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir);
const res=[]; let last=null;
for(let i=0;i<20;i++){
  await sleep(1100);
  const before=new Set(((await c.get('/system/backups?limit=100')).data.items).map(x=>x.id));
  const r=await c.post('/system/backup',{});
  let run=null;
  for(let k=0;k<150&&!run;k++){await sleep(200);const it=(await c.get('/system/backups?limit=100')).data.items;run=it.find(x=>!before.has(x.id)&&x.status!=='running');}
  if(!run){res.push({i,err:'no run'});continue;}
  const x=`${dir}/${run.id}`; fs.mkdirSync(x);
  try{
    execFileSync('tar',['-xzf',`/e${m.db.slice(2).replace(/\/app\.db$/,'')}/backups/${run.filename}`,'-C',`/e${x.slice(2)}`]);
    const db=`${x}/db/app.db`;
    const r2={i,run:run.id,status:run.status,integrity:q(db,'pragma integrity_check')[0].integrity_check,
     sales:q(db,'select count(*) n from sales')[0].n,
     saleNoJE:q(db,"select count(*) n from sales s where s.sale_number not like '%SEED%' and not exists(select 1 from journal_entries e where e.source_type='sale' and e.source_id=s.id)")[0].n,
     unbalJE:q(db,'select count(*) n from (select e.id from journal_entries e join journal_entry_lines l on l.journal_entry_id=e.id group by e.id having sum(l.debit_amount)<>sum(l.credit_amount))')[0].n,
     walInArchive:fs.readdirSync(`${x}/db`).join(',')};
    res.push(r2); last=run;
  }catch(e){res.push({i,run:run.id,err:String(e.message).slice(0,150)});}
}
const bad=res.filter(r=>r.err||r.integrity!=='ok'||r.saleNoJE||r.unbalJE);
console.log('backups',res.length,'bad',bad.length, JSON.stringify(bad).slice(0,500));
console.log('sample',JSON.stringify(res[0]),JSON.stringify(res.at(-1)));
// restore under live writes
const t=Date.now(); const rr=await c.post(`/system/backups/${last.id}/restore`,{});
console.log('restore under live writes ->',rr.status,JSON.stringify(rr.body).slice(0,160),Date.now()-t,'ms');
await sleep(2000); stop=true; await Promise.all(ws);
console.log('writer statuses',JSON.stringify(st));
const live=m.db;
console.log('live integrity',JSON.stringify(q(live,'pragma integrity_check')),'journal_mode',JSON.stringify(q(live,'pragma journal_mode')));
console.log('post-restore sales in live',q(live,'select count(*) n from sales')[0].n,'(backup had',res.at(-1)?.sales,')');
console.log('files',fs.readdirSync(m.db.replace(/\/app\.db$/,'')).filter(f=>f.startsWith('app.db')));
const h=await c.get('/sales?limit=1'); console.log('GET /sales after',h.status);
