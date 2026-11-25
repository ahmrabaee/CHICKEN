import { connect, request, BASE, show } from './lib.mjs';
import { DatabaseSync } from 'node:sqlite';
const a = await connect(BASE, 'admin', 'admin123');
const db = new DatabaseSync('E:/DEV/Chicken FMS/.qa-audit/envs/r2/app.db', { readOnly: true });
const q = (s, ...p) => db.prepare(s).all(...p);
const L = (r)=> Array.isArray(r.data)?r.data:(r.data?.items||[]);
const j = (x)=>JSON.stringify(x);

console.log('=== A. master delete rules with history');
// build: new item with purchase + sale
const it = (await a.post('/items',{name:'GScen',categoryId:1,defaultSalePrice:3000,defaultPurchasePrice:2000,minStockLevelGrams:30000,shelfLifeDays:3})).data;
const sup = (await a.post('/suppliers',{name:'GSupHist'})).data;
const cus = (await a.post('/customers',{name:'GCustHist',phone:'0599777000',creditLimit:5000})).data;
const p = await a.post('/purchases',{supplierId:sup.id,lines:[{itemId:it.id,weightGrams:20000,pricePerKg:2000}],amountPaid:0,paymentMethod:'cash'}); show('purchase credit 20kg', p);
const sCash = await a.post('/sales',{saleType:'cash',lines:[{itemId:it.id,weightGrams:3000,pricePerKg:3000}],payments:[{amount:9000,paymentMethod:'cash'}]}); show('cash sale 3kg', sCash);
const sCred = await a.post('/sales',{saleType:'credit',customerId:cus.id,lines:[{itemId:it.id,weightGrams:5000,pricePerKg:3000}]}); show('credit sale 15000 vs limit 5000', sCred);
show('item delete w/ stock+history', await a.del('/items/'+it.id));
console.log('item row', j(q('select id,is_active from items where id=?',it.id)));
show('GET item after delete', await a.get('/items/'+it.id));
show('customer delete w/ balance', await a.del('/customers/'+cus.id));
console.log('cust row', j(q('select id,is_active,current_balance from customers where id=?',cus.id)));
show('supplier delete w/ balance', await a.del('/suppliers/'+sup.id));
console.log('sup row', j(q('select id,is_active,current_balance from suppliers where id=?',sup.id)));
show('sale item inactive', await a.post('/sales',{saleType:'cash',lines:[{itemId:it.id,weightGrams:1000,pricePerKg:3000}],payments:[{amount:3000,paymentMethod:'cash'}]}));
show('credit sale to inactive/deleted customer', await a.post('/sales',{saleType:'credit',customerId:cus.id,lines:[{itemId:2,weightGrams:1000,pricePerKg:3000}]}));
show('purchase from inactive supplier', await a.post('/purchases',{supplierId:sup.id,lines:[{itemId:2,weightGrams:1000,pricePerKg:2000}],amountPaid:0}));
const catItems = await a.post('/categories',{name:'GCatWithItem'}); const cid=catItems.data.id;
await a.post('/items',{name:'GInCat',categoryId:cid,defaultSalePrice:100});
show('delete category with items', await a.del('/categories/'+cid));
console.log('cat row', j(q('select id,is_active from categories where id=?',cid)));

console.log('=== B. price rules');
show('sale below cost (price 100/kg vs cost 2000)', await a.post('/sales',{saleType:'cash',lines:[{itemId:2,weightGrams:1000,pricePerKg:100}],payments:[{amount:100,paymentMethod:'cash'}]}));
console.log('=== C. payment-method list');
show('GET /payments?pageSize=1', await a.get('/payments?pageSize=1'));
for (const m of ['cash','card','bank_transfer','check','cheque','mobile_payment','credit','BITCOIN','']) {
  const r = await a.post('/sales',{saleType:'cash',lines:[{itemId:2,weightGrams:1000,pricePerKg:3000}],payments:[{amount:3000,paymentMethod:m}]});
  console.log('sale method', JSON.stringify(m).padEnd(18), r.status, (r.body?.error?.message||'').slice(0,80));
}
console.log('payment methods stored:', j(q('select payment_method,count(*) c from payments group by 1')));
show('settings payment methods?', await a.get('/settings/group/payment'));

console.log('=== D. alerts');
show('low-stock', await a.get('/inventory/low-stock'));
show('expiring days=30', await a.get('/inventory/expiring?days=30'));
show('overdue debts', await a.get('/debts/overdue'));
show('summary', await a.get('/debts/summary'));
show('dashboard', await a.get('/reports/dashboard'));
for (const p of ['/notifications','/alerts','/notifications/unread','/reports/aging','/debts/aging','/debts/receivables/aging','/reports/cash-flow','/reports/cashier','/reports/items','/reports/z-report','/sales/returns','/returns','/purchases/returns','/purchases/return','/suppliers/returns','/purchase-returns','/sales/return','/customers/1/statement','/suppliers/1/statement','/accounting/cash-ledger','/accounting/day-book','/reports/day-book','/reports/export','/export','/import','/reports/sales/csv','/reports/sales/excel','/reports/sales/export']) {
  const r = await a.get(p); console.log('GET', p.padEnd(32), r.status);
}
for (const p of ['/sales/1/return','/sales/1/refund','/purchases/1/return','/purchases/1/refund','/expenses/1/pay']) { const r = await a.post(p,{}); console.log('POST', p.padEnd(32), r.status); }
