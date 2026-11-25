// K3 follow-up probe (run after posting-probe.mjs on same instance)
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { DatabaseSync } from 'node:sqlite';
const BASE = 'http://localhost:3192/v1';
const DB = 'E:/DEV/Chicken FMS/.qa-audit/envs/k3/app.db';
const q = (sql, ...p) => { const db = new DatabaseSync(DB, { readOnly: true }); try { return db.prepare(sql).all(...p); } finally { db.close(); } };
const bal = (code) => q(`select coalesce(sum(l.debit_amount),0)-coalesce(sum(l.credit_amount),0) b from journal_entry_lines l join accounts a on a.id=l.account_id where a.code=?`, code)[0].b;
const a = await connect(BASE, 'admin', 'admin123');
const acc = await connect(BASE, 'k3acc', 'Password@123');
const cat = q(`select id from expense_categories limit 1`)[0].id;
const bankId = q(`select id from bank_accounts limit 1`)[0].id;
// put money in bank via bank sale
let r = await a.post('/sales', { saleType: 'cash', lines: [{ itemId: 2, weightGrams: 2000, pricePerKg: 5000 }], payments: [{ amount: 10000, paymentMethod: 'bank_transfer', bankAccountId: bankId }] });
console.log('bank sale', r.status, 'bank bal', bal('1112-001'), 'cash bal', bal('1111'));
const c0 = bal('1111'), b0 = bal('1112-001');
r = await a.post('/expenses', { amount: 2000, description: 'k3 bank expense', paymentMethod: 'bank_transfer', bankAccountId: bankId, categoryId: cat });
console.log('expense bank_transfer 2000', r.status, JSON.stringify(r.body?.error ?? ''), 'cash delta', bal('1111') - c0, 'bank delta', bal('1112-001') - b0);
const expId = r.data?.id;
r = await a.put(`/expenses/${expId}`, { amount: 99900 });
console.log('expense update amount->99900', r.status, 'JE amount still', q(`select sum(debit_amount) d from journal_entry_lines l join journal_entries e on e.id=l.journal_entry_id where e.source_type='expense' and e.source_id=?`, expId)[0].d);
r = await a.del(`/expenses/${expId}`);
console.log('expense delete', r.status, 'expense rows', q(`select count(*) n from expenses where id=?`, expId)[0].n, 'JE rows left', q(`select count(*) n from journal_entries where source_type='expense' and source_id=?`, expId)[0].n);
const lot = q(`select id from inventory_lots where item_id=4 and remaining_quantity_grams>1000 limit 1`)[0];
r = await acc.post('/wastage', { lotId: lot.id, quantityGrams: 1000, wastageType: 'spoilage', reason: 'k3' });
console.log('wastage by accountant', r.status, JSON.stringify(r.body?.error ?? ''), 'SLE wastage rows', q(`select count(*) n from stock_ledger_entries where voucher_type='wastage'`)[0].n);
const acRes = await acc.get('/system/backup/status');
console.log('accountant GET /system/backup/status', acRes.status);
