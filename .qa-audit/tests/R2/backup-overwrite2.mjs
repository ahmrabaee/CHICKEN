import fs from 'node:fs'; import crypto from 'node:crypto';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const a = await connect('http://localhost:3125/v1','admin','admin123');
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const dir='E:/DEV/Chicken FMS/.qa-audit/envs/r2/backups';
for (let attempt=0; attempt<8; attempt++){
  // align to start of a second so two quick backups share the filename second
  const wait = 1000 - (Date.now()%1000) + 20; await sleep(wait);
  const r1=await a.post('/system/backup',{}); await sleep(120); const r2=await a.post('/system/backup',{}); await sleep(600);
  const items=(await a.get('/system/backups?limit=5')).data.items;
  const [n2,n1]=items; 
  if(n1.filename===n2.filename){
    const h=crypto.createHash('sha256').update(fs.readFileSync(`${dir}/${n1.filename}`)).digest('hex');
    console.log('attempt',attempt,'SAME FILENAME',n1.filename,'| run',n1.id,'checksum matches disk:',h===n1.checksumSha256,'| run',n2.id,'matches disk:',h===n2.checksumSha256, '| statuses',n1.status,n2.status);
    process.exit(0);
  }
  console.log('attempt',attempt,'names differ',n1.filename,n2.filename,r1.status,r2.status);
}
