import { connect, BASE, show } from './lib.mjs';
import { DatabaseSync } from 'node:sqlite';
const a = await connect(BASE, 'admin', 'Hacked12345');
const db = new DatabaseSync('E:/DEV/Chicken FMS/.qa-audit/envs/ga/app.db', { readOnly: true });
const q = (s, ...p) => db.prepare(s).all(...p); const j=x=>JSON.stringify(x);
const cr = await a.post('/customers',{name:'GPaidOff'+Date.now(),phone:'059'+String(Date.now()).slice(-7)}); show('create cust',cr); const c=cr.data;
const sr = await a.post('/sales',{saleType:'credit',customerId:c.id,lines:[{itemId:2,weightGrams:1000,pricePerKg:3000}]}); show('credit sale',sr); const s=sr.data;
const pay = await a.post('/payments/sale',{saleId:s.id,amount:3000,paymentMethod:'cash'}); console.log('pay', pay.status);
console.log('debt', j(q("select id,status,total_amount,amount_paid from debts where party_id=? and party_type='customer'",c.id)), 'bal', j(q('select current_balance from customers where id=?',c.id)));
show('delete fully-paid customer with sales', await a.del('/customers/'+c.id));
console.log('customer row', j(q('select id,is_active from customers where id=?',c.id)), 'sale cust id', j(q('select customer_id,customer_name from sales where id=?',s.id)));
show('GET sale after', await a.get('/sales/'+s.id));
show('statement pdf of deleted cust', await a.raw('GET','/customers/'+c.id+'/statement/pdf',{raw:true}).then(r=>({status:r.status,body:{}})));
// supplier fully paid delete
const sp = (await a.post('/suppliers',{name:'GPaidSup'})).data;
const pu = (await a.post('/purchases',{supplierId:sp.id,lines:[{itemId:2,weightGrams:1000,pricePerKg:2000}],amountPaid:2000,paymentMethod:'cash'})).data;
show('delete fully paid supplier w/ purchase', await a.del('/suppliers/'+sp.id));
console.log('expenses JE exist for unapproved expense 4?', j(q("select id from journal_entries where source_type='expense' and source_id=4")));
// accountant creating customers; accountant delete
const acc = await connect(BASE,'gacc','Gacc12345');
show('accountant DELETE customer', await acc.del('/customers/'+c.id));
// large payload items list perf
let t=Date.now(); const r = await a.get('/items?pageSize=500'); console.log('items pageSize=500', r.status, Date.now()-t,'ms');
