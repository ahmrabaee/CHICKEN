// R2: QA-029 legacy numbering after delete (purchase, expense, lot) + QA-028 numbering with GL engine on
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const a = await connect('http://localhost:3125/v1','admin','admin123');
const s=(r)=>`${r.status} ${r.data?.purchaseNumber||r.data?.expenseNumber||r.data?.entryNumber||r.body?.error?.code||''}`;
const fund = await a.post('/accounting/journal-entries',{description:'R2 fund',entryDate:new Date().toISOString(),lines:[{accountId:4,debit:10000000,credit:0},{accountId:21,debit:0,credit:10000000}]});
if (fund.data?.id) console.log('post fund',(await a.post(`/accounting/journal-entries/${fund.data.id}/post`,{})).status);
const mk=()=>a.post('/purchases',{supplierId:1,purchaseDate:new Date().toISOString(),lines:[{itemId:1,weightGrams:1000,pricePerKg:2000}],paymentMethod:'cash',amountPaid:0});
const p1=await mk(),p2=await mk(),p3=await mk(); console.log('purchases',s(p1),s(p2),s(p3));
console.log('delete p1 (non-last)',(await a.del(`/purchases/${p1.data.id}`)).status);
const p4=await mk(); console.log('purchase after deleting a non-last one ->',s(p4));
const p5=await mk(); console.log('and again ->',s(p5));
const e=()=>a.post('/expenses',{amount:100,description:'r2',expenseDate:new Date().toISOString(),paymentMethod:'cash',categoryId:1});
const e1=await e(),e2=await e(),e3=await e(); console.log('expenses',s(e1),s(e2),s(e3));
console.log('delete e1',(await a.del(`/expenses/${e1.data.id}`)).status);
const e4=await e(); console.log('expense after delete ->',s(e4));
