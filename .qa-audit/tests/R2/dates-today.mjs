import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const a=await connect('http://localhost:3125/v1','admin','admin123');
const s=await a.post('/sales',{saleType:'cash',lines:[{itemId:5,weightGrams:1000,pricePerKg:3000}],payments:[{paymentMethod:'cash',amount:3000}]});
const d=new Date(); const today=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
console.log('sale',s.status,s.data?.saleNumber,s.data?.saleDate,'local today',today);
const l=await a.get(`/sales?startDate=${today}&endDate=${today}`); console.log('GET /sales start=end=today ->',l.status,'totalItems',l.body?.meta?.pagination?.totalItems ?? l.body?.meta?.totalItems ?? JSON.stringify(l.body?.meta).slice(0,120));
const r=await a.get(`/reports/sales?startDate=${today}&endDate=${today}`); console.log('GET /reports/sales today ->',r.status,JSON.stringify(r.data).slice(0,160));
const p=await fetch(`http://localhost:3125/v1/sales/report/pdf?startDate=${today}&endDate=${today}`,{headers:{Authorization:'Bearer '+a.token}}); console.log('sales report PDF today',p.status,(await p.arrayBuffer()).byteLength,'bytes');
const e=await a.get(`/expenses?startDate=2020-01-01&endDate=2020-01-02`); console.log('GET /expenses with 2020 range ->',e.status,'items',e.body?.meta?.pagination?.totalItems ?? JSON.stringify(e.body?.meta).slice(0,100));
const cnt=(r)=>Array.isArray(r.data)?r.data.length:(r.data?.items?.length ?? JSON.stringify(r.data).slice(0,60));
for (const day of [today,'2026-11-25']) { const l2=await a.get(`/sales?startDate=${day}&endDate=${day}&pageSize=100`); const r2=await a.get(`/reports/sales?startDate=${day}&endDate=${day}`); console.log('day',day,'| /sales rows',cnt(l2),'| /reports/sales count',r2.data?.summary?.count); }
const e2=await a.get(`/expenses?startDate=2020-01-01&endDate=2020-01-02&pageSize=100`); console.log('expenses 2020 range rows',cnt(e2));
