import { connect, request, BASE, show } from './lib.mjs';
import { DatabaseSync } from 'node:sqlite';
const a = await connect(BASE, 'admin', 'admin123');
const db = new DatabaseSync('E:/DEV/Chicken FMS/.qa-audit/envs/ga/app.db', { readOnly: true });
const q = (s, ...p) => db.prepare(s).all(...p);
const j = (x)=>JSON.stringify(x);
const today = new Date().toISOString().slice(0,10);
const tomorrow = new Date(Date.now()+86400000).toISOString().slice(0,10);
// add more activity
const cats = (await a.get('/expenses/categories')).data; console.log('expense cats', j(cats).slice(0,200));
const cid = (Array.isArray(cats)?cats:cats.items)[0].id;
show('expense cash 120', await a.post('/expenses',{categoryId:cid,amount:12000,paymentMethod:'cash',description:'G exp'}));
{const lot=q('select id from inventory_lots where item_id=2 and remaining_quantity_grams>0 limit 1')[0]; show('wastage 1kg', await a.post('/wastage',{lotId:lot.id,weightGrams:1000,wastageType:'spoilage',reason:'spoiled'}));}
const debts = (await a.get('/debts/receivables')).data; const d = (debts.items||debts)[0]; console.log('debt', d&&[d.id,d.totalAmount,d.status]);
show('pay credit sale part', await a.post('/payments/sale',{saleId:7,amount:5000,paymentMethod:'cash'}));
show('supplier pay', await a.post('/payments/purchase',{purchaseId:4,amount:10000,paymentMethod:'cash'}));
show('void sale 9', await a.post('/sales/9/void',{reason:'g test'}));
console.log('\n=== raw DB truth');
const raw = {
  sales_active: q("select count(*) c, sum(total_amount) t, sum(total_cost) cost, sum(total_profit) p, sum(tax_amount) tax, sum(discount_amount) d from sales where is_voided=0")[0],
  sales_all: q("select is_voided,count(*) c,sum(total_amount) t from sales group by is_voided"),
  purchases: q("select count(*) c, sum(total_amount) t, sum(amount_paid) paid from purchases")[0],
  expenses: q("select count(*) c, sum(amount) t from expenses")[0],
  wastage: q("select count(*) c, sum(estimated_cost_value) v from wastage_records")[0],
};
console.log(j(raw));
console.log(j(q("select sql from sqlite_master where name='wastage_records'")).slice(0,600));
console.log('\n=== reports');
for (const [n,u] of [['sales',`/reports/sales?startDate=${today}&endDate=${today}`],['sales end=tomorrow',`/reports/sales?startDate=${today}&endDate=${tomorrow}`],['purchases',`/reports/purchases?startDate=${today}&endDate=${tomorrow}`],['expenses',`/reports/expenses?startDate=${today}&endDate=${tomorrow}`],['wastage',`/reports/wastage?startDate=${today}&endDate=${tomorrow}`],['profit-loss',`/reports/profit-loss?startDate=${today}&endDate=${tomorrow}`],['inventory','/reports/inventory'],['dashboard','/reports/dashboard'],['vat','/tax/vat-report?startDate='+today+'&endDate='+tomorrow],['expenses summary','/expenses/summary'],['debts summary','/debts/summary'],['stock-vs-gl','/reports/stock-vs-gl']]) {
  const r = await a.get(u); console.log('\n#',n, r.status, j(r.body?.data ?? r.body).slice(0,900));
}
// no-date calls
for (const u of ['/reports/sales','/reports/purchases','/reports/expenses','/reports/wastage','/reports/profit-loss','/reports/sales?startDate=garbage&endDate=garbage','/reports/sales?startDate=2026-12-31&endDate=2026-01-01']) { const r=await a.get(u); console.log('NO/BAD DATE', u, r.status, j(r.body).slice(0,200)); }
// ledger
console.log('\n=== ledgers');
const tb = await a.get('/accounting/trial-balance'); console.log('TB status', tb.status, j(tb.data).slice(0,400));
const led = await a.get('/accounting/ledger/1111'); console.log('cash ledger 1111', led.status, j(led.data).slice(0,500));
const je = await a.get('/accounting/journal-entries?pageSize=5'); console.log('JE', je.status, j(je.data).slice(0,300));
console.log('JE count', j(q('select count(*) c from journal_entries')), 'line sums', j(q('select sum(debit_amount) d,sum(credit_amount) c from journal_entry_lines')));
