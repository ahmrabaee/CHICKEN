import { request, connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const B='http://localhost:3125/v1'; 
let a; try { a=await connect(B,'admin','Admin@12345'); } catch(e){ a=await connect(B,'admin','admin123'); }
for (const d of ['2020-01-01','2026-11-25','2027-01-01']) { const r=await a.get('/accounting/trial-balance?asOfDate='+d); const t=r.data; const rows=t?.accounts||t?.rows||t?.items||[]; console.log('TB asOf',d,r.status,'keys',Object.keys(t||{}).join(','),'totals',JSON.stringify(t?.totals||t?.total||'').slice(0,150),'rows',rows.length); if(rows[0]) console.log('  first row',JSON.stringify(rows[0]).slice(0,220)); }
for (const d of ['2020-01-01','2026-11-25','2027-01-01']) { const r=await a.get('/accounting/trial-balance?asOfDate='+d); const t=r.data; const c=t.find(x=>x.accountCode==='1111'||x.code==='1111'); console.log('TB',d,'row1111',JSON.stringify(c).slice(0,260)); }
