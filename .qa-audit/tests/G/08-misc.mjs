import { connect, request, BASE, show } from './lib.mjs';
import { DatabaseSync } from 'node:sqlite';
const a = await connect(BASE, 'admin', 'Hacked12345');
const db = new DatabaseSync('E:/DEV/Chicken FMS/.qa-audit/envs/ga/app.db', { readOnly: true });
const q = (s, ...p) => db.prepare(s).all(...p);
const j = (x)=>JSON.stringify(x);
const today = new Date().toISOString().slice(0,10);
console.log('=== PDF sweep (HTTP status, content-type, bytes, first bytes)');
const pdfs = ['/accounting/reports/balance-sheet/pdf','/accounting/reports/income-statement/pdf','/accounting/reports/trial-balance/pdf','/accounting/reports/ledger/1111/pdf','/customers/4/statement/pdf','/customers/3/statement/pdf','/customers/9999/statement/pdf','/debts/receivables/pdf','/debts/payables/pdf','/expenses/report/pdf','/inventory/report/pdf','/payments/1/pdf','/payments/9999/pdf','/purchases/report/pdf','/purchases/4/pdf','/reports/wastage/pdf','/reports/vat/pdf','/reports/stock-vs-gl/pdf','/sales/report/pdf','/sales/6/pdf','/sales/9999/pdf','/suppliers/3/statement/pdf','/suppliers/1/statement/pdf','/suppliers/9999/statement/pdf'];
for (const p of pdfs) for (const qs of ['', `?language=ar&startDate=${today}&endDate=${today}`, '?startDate=garbage&endDate=garbage', '?language=fr']) {
  const r = await a.raw('GET', p+qs, { raw: true });
  const buf = Buffer.from(await r.arrayBuffer());
  console.log(r.status, (r.headers.get('content-type')||'').slice(0,30).padEnd(30), String(buf.length).padStart(7), buf.slice(0,5).toString().replace(/[^\x20-\x7e]/g,'?'), p+qs, r.status>=400?buf.toString().slice(0,110).replace(/\n/g,' '):'');
}
console.log('=== duplicate handling');
show('cust same name different phone', await a.post('/customers',{name:'GCustHist',phone:'0599777111'}));
show('cust phone w/ spaces dup', await a.post('/customers',{name:'Dup',phone:' 0599777000 '}));
show('cust phone +970 form dup', await a.post('/customers',{name:'Dup2',phone:'+970599777000'}));
show('sup name case dup', await a.post('/suppliers',{name:'gsuphist'}));
show('sup name trailing space dup', await a.post('/suppliers',{name:'GSupHist '}));
show('category dup name case', await a.post('/categories',{name:'دجاج خام'}));
show('item dup barcode vs other item code', await a.post('/items',{name:'BC',categoryId:1,defaultSalePrice:100,barcode:'CHK-RAW-01'}));
show('item code collision', await a.post('/items',{name:'CodeDup',code:'CHK-RAW-01',categoryId:1,defaultSalePrice:100}));
console.log('=== search wildcard');
for (const s of ['%','_','دجاج','chk','CHK']) { const r = await a.get('/items?pageSize=100&search='+encodeURIComponent(s)); console.log('items search', JSON.stringify(s), r.status, r.data.length); }
for (const s of ['%','_']) { const r = await a.get('/customers?pageSize=100&search='+encodeURIComponent(s)); console.log('cust search', JSON.stringify(s), r.status, (r.data.items||r.data).length); }
console.log('=== customer lifecycle / deactivate');
const c = (await a.get('/customers/phone/0599777000')).data;
show('PUT customer isActive=false with open debt', await a.put('/customers/'+c.id,{isActive:false}));
show('PUT customer creditLimit=-1', await a.put('/customers/'+c.id,{creditLimit:-1}));
show('PUT customer discount 20000bp', await a.put('/customers/'+c.id,{defaultDiscountPct:20000}));
console.log('stored discount', j(q('select default_discount_pct from customers where id=?',c.id)));
show('PUT customer priceLevel junk', await a.put('/customers/'+c.id,{priceLevel:'vip'}));
await a.put('/customers/'+c.id,{isActive:true,defaultDiscountPct:0});
console.log('=== expense approval');
console.log('expense approval flags', j(q('select id,is_approved,approved_by,docstatus,amount from expenses')));
show('approve expense 5', await a.post('/expenses/5/approve'));
show('approve unknown', await a.post('/expenses/9999/approve'));
console.log('JE for expense 5?', j(q("select id,entry_number from journal_entries where source_type='expense' and source_id=5")));
console.log('=== purchase approve/receive routes');
show('PUT /purchases/4/receive', await a.put('/purchases/4/receive',{lines:[]}));
console.log('=== wastage approve routes');
for (const m of [['post','/wastage/1/approve'],['put','/wastage/1/approve'],['post','/wastage/1/reject'],['delete','/wastage/1']]) { const r = await a[m[0]===('delete')?'del':m[0]](m[1],{}); console.log(m.join(' ').padEnd(30), r.status); }
console.log('=== inventory adjustments approval/ item price');
show('item PUT price negative', await a.put('/items/2',{defaultSalePrice:-1}));
show('item PUT categoryId unknown', await a.put('/items/2',{categoryId:9999}));
show('item PUT name empty', await a.put('/items/2',{name:''}));
show('GET /items/abc', await a.get('/items/abc'));
show('GET /customers/999999', await a.get('/customers/999999'));
