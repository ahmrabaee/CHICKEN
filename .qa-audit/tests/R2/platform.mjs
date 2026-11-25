import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const B='http://localhost:3125/v1'; const a=await connect(B,'admin','admin123');
const d1=await fetch('http://localhost:3125/api/docs'); const d2=await fetch('http://localhost:3125/api/docs-json'); console.log('GET /api/docs unauth',d1.status,'| /api/docs-json',d2.status,'paths',Object.keys((await d2.json()).paths||{}).length);
const je=await a.post('/accounting/journal-entries',{description:'big',entryDate:new Date().toISOString(),lines:[{accountId:4,debit:9000000000000000,credit:0},{accountId:21,debit:0,credit:9000000000000000}]}); console.log('JE 9e15 ->',je.status,(je.body?.error?.message||'').slice(0,100).replace(/\n/g,' '));
const bd=await a.post('/accounting/journal-entries',{description:'x',entryDate:'2026-02-30',lines:[{accountId:4,debit:100,credit:0},{accountId:21,debit:0,credit:100}]}); console.log('JE date 2026-02-30 ->',bd.status,JSON.stringify(bd.data||bd.body?.error?.message).slice(0,140));
const big=await a.put('/settings/r2.big',{value:'x'.repeat(200*1024)}); console.log('200KB body ->',big.status,(big.body?.error?.code||''));
const px=await a.post('/purchases',{supplierId:1,lines:[{itemId:5,weightGrams:1000,pricePerKg:2147483647}]}); console.log('price 2147483647 ->',px.status);
