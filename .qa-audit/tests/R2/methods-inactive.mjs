import fs from 'node:fs';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { DatabaseSync } from 'node:sqlite';
const m = JSON.parse(fs.readFileSync('E:/DEV/Chicken FMS/.qa-audit/envs/r2/meta.json','utf8'));
const a=await connect(m.baseUrl,'admin','admin123');
const q=(sql)=>{const d=new DatabaseSync(m.db,{readOnly:true});try{return d.prepare(sql).all();}finally{d.close();}};
const lastJE=(sid)=>q(`select a.code,l.debit_amount dr,l.credit_amount cr from journal_entries e join journal_entry_lines l on l.journal_entry_id=e.id join accounts a on a.id=l.account_id where e.source_type='sale' and e.source_id=${sid} order by l.id`).map(x=>`${x.code}:${x.dr||0}/${x.cr||0}`).join(' ');
for (const meth of ['cash','card','bank_transfer','check','cheque','mobile_payment','bitcoin']) {
  const r=await a.post('/sales',{saleType:'cash',lines:[{itemId:5,weightGrams:100,pricePerKg:3000}],payments:[{paymentMethod:meth,amount:300}]});
  console.log('sale paymentMethod',meth.padEnd(15),r.status,r.ok?lastJE(r.data.id):(r.body?.error?.code+' '+(r.body?.error?.message||'').slice(0,60)));
}
// 049 inactive item
const it=await a.post('/items',{code:'R2-INACT',name:'inactive r2',categoryId:1,defaultSalePrice:3000,defaultPurchasePrice:1000});
await a.post('/purchases',{supplierId:1,lines:[{itemId:it.data.id,weightGrams:10000,pricePerKg:1000}]});
console.log('soft delete item',(await a.del(`/items/${it.data.id}`)).status,'is_active',q(`select is_active from items where id=${it.data.id}`)[0].is_active);
const s=await a.post('/sales',{saleType:'cash',lines:[{itemId:it.data.id,weightGrams:1000,pricePerKg:3000}],payments:[{paymentMethod:'cash',amount:3000}]});
console.log('sale of INACTIVE item ->',s.status,s.data?.saleNumber||s.body?.error?.code);
const inv=await a.get('/inventory?pageSize=100'); const rows=Array.isArray(inv.data)?inv.data:(inv.data?.items||[]); console.log('inventory list shows inactive item?',rows.some(r=>r.itemId===it.data.id||r.item?.id===it.data.id),'| lots remaining',q(`select sum(remaining_quantity_grams) g from inventory_lots where item_id=${it.data.id}`)[0].g);
const p=await a.post('/purchases',{supplierId:1,lines:[{itemId:it.data.id,weightGrams:1000,pricePerKg:1000}]}); console.log('purchase of INACTIVE item ->',p.status,p.data?.purchaseNumber||p.body?.error?.code);
console.log('branch on new lots', JSON.stringify(q('select branch_id,count(*) n from inventory_lots group by 1')));
// customers inactive
