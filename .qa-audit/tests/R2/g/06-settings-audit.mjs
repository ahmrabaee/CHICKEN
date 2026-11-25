import { connect, request, BASE, show } from './lib.mjs';
import { DatabaseSync } from 'node:sqlite';
const a = await connect(BASE, 'admin', 'admin123');
const db = new DatabaseSync('E:/DEV/Chicken FMS/.qa-audit/envs/r2/app.db', { readOnly: true });
const q = (s, ...p) => db.prepare(s).all(...p);
const j = (x)=>JSON.stringify(x);
const sale = (extra={}) => a.post('/sales',{saleType:'cash',lines:[{itemId:2,weightGrams:1000,pricePerKg:3000}],payments:[{amount:3000,paymentMethod:'cash'}],...extra});
const set = (k,v)=>a.put('/settings/'+encodeURIComponent(k),{value:v});

console.log('=== A. are settings honoured?');
show('set pos.allow_credit_sale=false', await set('pos.allow_credit_sale',false));
show('credit sale with allow_credit_sale=false', await a.post('/sales',{saleType:'credit',customerId:1,lines:[{itemId:2,weightGrams:1000,pricePerKg:3000}]}));
await set('pos.allow_credit_sale',true);
show('set pos.require_customer=true', await set('pos.require_customer',true));
show('walk-in sale with require_customer=true', await sale());
await set('pos.require_customer',false);
show('set pos.accountant_max_discount_pct=100 (1%)', await set('pos.accountant_max_discount_pct',100));
// accountant with 5% discount
await a.post('/users',{username:'gacc',password:'Gacc12345',fullName:'G acc',roleId:2});
const acc = await connect(BASE,'gacc','Gacc12345');
show('accountant 4% discount while cap setting=1%', await acc.post('/sales',{saleType:'cash',discountPct:400,lines:[{itemId:2,weightGrams:1000,pricePerKg:3000}],payments:[{amount:2880,paymentMethod:'cash'}]}));
await set('pos.accountant_max_discount_pct',500);
show('set inventory.allow_negative_stock=true', await set('inventory.allow_negative_stock',true));
show('oversell item 2 (stock ~46kg) 500kg', await a.post('/sales',{saleType:'cash',lines:[{itemId:2,weightGrams:500000,pricePerKg:3000}],payments:[{amount:1500000,paymentMethod:'cash'}]}));
await set('inventory.allow_negative_stock',false);
show('set tax.default_rate=0 / prices_include_tax=false', await set('tax.default_rate',0));
show('set inventory.fifo_enabled=false', await set('inventory.fifo_enabled',false));
show('set numbering.sale_prefix=XYZ-', await set('numbering.sale_prefix','XYZ-'));
const s2 = await sale(); console.log('sale number after prefix change:', s2.data?.saleNumber);
await set('numbering.sale_prefix','SAL-');
show('set numbering.sale_next=999999', await set('numbering.sale_next',999999)); const s3 = await sale(); console.log('sale number after sale_next:', s3.data?.saleNumber);

console.log('=== B. settings validation');
for (const [k,v] of [['currency.decimals','abc'],['currency.decimals',-3],['tax.default_rate','banana'],['tax.default_rate',999999],['barcode.total_length','abc'],['barcode.weight_start',-5],['backup.frequency_hours',0],['backup.frequency_hours','x'],['backup.retention_days',-1],['app.timezone','Mars/Phobos'],['app.default_language','xx'],['scale.baud_rate','fast'],['gl_debit_credit_tolerance',-100],['pos.receipt_copies',-1],['totally.new.key','x'],['setup_completed',false]]) {
  const r = await set(k,v); console.log('SET', (k+'='+JSON.stringify(v)).padEnd(46), r.status, (r.body?.error?.message||'').slice(0,60));
}
console.log('stored setup_completed', j(q("select value from system_settings where key='setup_completed'")), 'check-setup:', j((await request(BASE,'POST','/auth/check-setup',{body:{}})).body));
await set('setup_completed',true);
show('bulk update w/ non-array', await a.post('/settings/bulk',{settings:'x'}));
show('bulk update w/ missing key', await a.post('/settings/bulk',{settings:[{value:1}]}));
show('DELETE setting', await a.del('/settings/app.name'));
show('DELETE setting unknown', await a.del('/settings/nope'));
show('company update with weird', await a.put('/settings/company',{name:'', roundOffAccountId:999999}));
console.log('settings after barcode.total_length=abc:'); show('barcode config', await a.get('/barcode/config'));
show('barcode lookup', await a.get('/barcode/lookup?barcode=1234567890123'));
// restore sane
await set('barcode.total_length',25); await set('barcode.weight_start',7); await set('currency.decimals',2); await set('tax.default_rate',1500);
show('backup.path_vps garbage', await a.put('/system/backup/config',{path:'Z:\\nonexistent\\dir', backupPath:'Z:\\nonexistent\\dir'}));

console.log('=== C. audit log');
show('GET /audit', await a.get('/audit?pageSize=5'));
show('GET /audit/counts', await a.get('/audit/counts'));
console.log('audit actions by entity:', j(q('select entity_type,action,count(*) c from audit_logs group by 1,2')));
console.log('audit row sample:', j(q('select * from audit_logs order by id desc limit 2')));
for (const f of ['entityType=sale','action=void','userId=1','startDate=2020-01-01&endDate=2030-01-01','search=x']) { const r = await a.get('/audit?'+f); console.log('AUDIT filter', f.padEnd(40), r.status, (r.data?.length ?? r.body?.data?.items?.length ?? j(r.body).slice(0,80))); }
show('audit as accountant', await acc.get('/audit'));
show('DELETE /audit/1', await a.del('/audit/1'));
show('PUT /audit/1', await a.put('/audit/1',{action:'x'}));
console.log('audit has voids?', j(q("select count(*) c from audit_logs where action like '%void%'")), 'sales voided:', j(q('select count(*) c from sales where is_voided=1')));
console.log('audit covers: ', j(q('select distinct entity_type, action from audit_logs')));

console.log('=== D. expense approval / threshold');
const e = await acc.post('/expenses',{categoryId:1,amount:100,paymentMethod:'cash',description:'acc exp'}); show('accountant creates expense', e);
if (e.ok) { show('accountant approves own expense', await acc.post('/expenses/'+e.data.id+'/approve')); show('approve twice', await acc.post('/expenses/'+e.data.id+'/approve')); }
const big = await a.post('/expenses',{categoryId:1,amount:50,paymentMethod:'cash',description:'big'});show('expense', big);
console.log('=== E. cashier role?');
show('roles', await a.get('/users/roles'));
