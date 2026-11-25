// T4-03: expenses — routing, category account, tax, credit expense, edit/delete, personal, negative, reports vs GL, EXP numbering.
import { login, snapshot, delta, makeLog, short, q, q1, QA } from './lib.mjs';
const log = makeLog(`${QA}/tests/T4/03-expenses.out.txt`);
const c = await login('t4a');
const DB = c.meta.db;
const step = async (label, fn) => {
  const b = snapshot(DB); const r = await fn(); const d = delta(b, snapshot(DB));
  log(`\n## ${label}`); log('  resp:', short(r), r.ok && r.data?.id ? `id=${r.data.id} ${r.data.expenseNumber ?? ''}` : '');
  log('  GLΔ:', d.gl, 'supΔ', d.suppliers, 'debtΔ', d.payDebt, 'pleΔ', d.plePay, 'je', d.je); return r;
};
const jeOf = (id) => q(DB, "select j.entry_number, a.code, l.debit_amount d, l.credit_amount c from journal_entries j join journal_entry_lines l on l.journal_entry_id=j.id join accounts a on a.id=l.account_id where j.source_type='expense' and j.source_id=?", id);
const B1 = q1(DB, "select id from bank_accounts where name='بنك فلسطين'").id;
const today = new Date().toISOString().slice(0, 10);
log('# T4-03 expenses', new Date().toISOString(), 'B1', B1);

const e1 = await step('E1. rent expense (category 2 = 5210) 100.00 cash', () => c.post('/expenses', { categoryId: 2, description: 'rent', amount: 10000, paymentMethod: 'cash' }));
log('  JE:', jeOf(e1.data.id));
const e2 = await step('E2. electricity (cat 4 = 5221) 200.00 bank_transfer B1', () => c.post('/expenses', { categoryId: 4, description: 'elec', amount: 20000, paymentMethod: 'bank_transfer', bankAccountId: B1 }));
log('  JE:', jeOf(e2.data.id), ' expense.bank_account_id', q1(DB, 'select bank_account_id b from expenses where id=?', e2.data.id).b);
const e2b = await step('E2b. card expense 50.00 no bankAccountId', () => c.post('/expenses', { categoryId: 1, description: 'card', amount: 5000, paymentMethod: 'card' }));
const e3 = await step('E3. expense 115.00 with taxAmount 15.00 cash', () => c.post('/expenses', { categoryId: 1, description: 'with tax', amount: 11500, taxAmount: 1500, paymentMethod: 'cash' }));
log('  JE:', jeOf(e3.data.id));
const e4 = await step('E4. credit expense supplier 1, 300.00', () => c.post('/expenses', { categoryId: 7, description: 'maint on credit', amount: 30000, paymentMethod: 'credit', supplierId: 1 }));
log('  debt:', q(DB, "select id,total_amount,amount_paid,status,party_id from debts where source_type='expense' and source_id=?", e4.data.id), ' PLE rows:', q1(DB, "select count(*) n from payment_ledger_entries where against_voucher_type='expense' or voucher_type='expense'").n);
const e4n = await step('E4b. credit expense with NO supplier 80.00', () => c.post('/expenses', { categoryId: 7, description: 'credit no sup', amount: 8000, paymentMethod: 'credit' }));
log('  debt:', q(DB, "select party_type,party_id,party_name from debts where source_type='expense' and source_id=?", e4n.data.id));
// ways to settle credit expense
const ep = await c.post('/payments/expense', { expenseId: e4.data.id, amount: 1000, paymentMethod: 'cash' });
log('\nE4c. POST /payments/expense →', short(ep));
const debtId = q1(DB, "select id from debts where source_type='expense' and source_id=?", e4.data.id).id;
await step('E4d. write-off the payable expense debt', () => c.post(`/debts/${debtId}/write-off`, { reason: 'qa' }));
log('  supplier1 balance:', q1(DB, 'select current_balance b from suppliers where id=1').b, ' debt:', q(DB, 'select status from debts where id=?', debtId));
const dash = await c.get('/reports/dashboard');
log('  dashboard payables:', JSON.stringify(dash.data).match(/"payables":[^,}]+/)?.[0], ' /debts/summary:', JSON.stringify((await c.get('/debts/summary')).data).slice(0, 300));

const e5 = await step('E5. personal expense (expenseType=personal) 70.00 cash', () => c.post('/expenses', { categoryId: 9, description: 'owner groceries', amount: 7000, paymentMethod: 'cash', expenseType: 'personal' }));
log('  JE:', jeOf(e5.data.id));
await step('E6. NEGATIVE expense -500.00 cash', () => c.post('/expenses', { categoryId: 1, description: 'neg', amount: -50000, paymentMethod: 'cash' }));
await step('E6b. zero expense', () => c.post('/expenses', { categoryId: 1, description: 'zero', amount: 0, paymentMethod: 'cash' }));
await step('E6c. fractional expense 10.005 (1000.5 minor)', () => c.post('/expenses', { categoryId: 1, description: 'frac', amount: 1000.5, paymentMethod: 'cash' }));
await step('E6d. expense with non-existent categoryId 999', () => c.post('/expenses', { categoryId: 999, description: 'x', amount: 100, paymentMethod: 'cash' }));
await step('E6e. expense with branchId 1', () => c.post('/expenses', { categoryId: 1, description: 'branch', amount: 100, paymentMethod: 'cash', branchId: 1 }));
log('  last JE branch:', q1(DB, "select branch_id from journal_entries where source_type='expense' order by id desc limit 1"));

// edit / delete
await step('E7. PUT E1 amount 100.00 -> 999.00', () => c.put(`/expenses/${e1.data.id}`, { amount: 99900 }));
log('  E1 row', q1(DB, 'select amount, payment_method from expenses where id=?', e1.data.id), ' JE', jeOf(e1.data.id));
await step('E7b. PUT E1 paymentMethod cash -> credit (supplier 2)', () => c.put(`/expenses/${e1.data.id}`, { paymentMethod: 'credit', supplierId: 2 }));
log('  debts for E1:', q(DB, "select * from debts where source_type='expense' and source_id=?", e1.data.id).length);
await step('E7c. PUT E1 expenseDate change', () => c.put(`/expenses/${e1.data.id}`, { expenseDate: '2026-01-01' }));
log('  E1 date', q1(DB, 'select expense_date from expenses where id=?', e1.data.id));
await step('E7d. PUT E4 (credit) amount 300 -> 100', () => c.put(`/expenses/${e4.data.id}`, { amount: 10000 }));
log('  E4 debt after edit:', q(DB, "select total_amount,status from debts where source_type='expense' and source_id=?", e4.data.id));
await step('E8. DELETE E2 (bank expense)', () => c.del(`/expenses/${e2.data.id}`));
log('  orphan JE for E2:', jeOf(e2.data.id));
await step('E8b. DELETE E4 (credit expense with debt)', () => c.del(`/expenses/${e4.data.id}`));
log('  debts left for deleted E4:', q(DB, "select id,status,total_amount from debts where source_type='expense' and source_id=?", e4.data.id));

// reports vs GL
const rep = await c.get(`/reports/expenses?startDate=${today}&endDate=${today}`);
const pl = await c.get(`/reports/profit-loss?startDate=${today}&endDate=${today}`);
const exTable = q1(DB, "select sum(amount) s from expenses where expense_number not like '%SEED%'").s;
const gl5400 = snapshot(DB).gl['5400'];
const glExpJE = q1(DB, "select sum(l.debit_amount-l.credit_amount) s from journal_entry_lines l join journal_entries j on j.id=l.journal_entry_id where j.source_type='expense'").s;
log('\n## Reports vs GL');
log('  /reports/expenses summary:', short(rep), JSON.stringify(rep.data?.summary), ' byType', JSON.stringify(rep.data?.byType));
log('  /reports/profit-loss expenses:', pl.data?.expenses, ' Σexpenses table (non-seed):', exTable, ' GL from expense JEs:', glExpJE, ' GL 5400 total:', gl5400);
log('  GL 5210/5221/5240/3300:', ['5210', '5221', '5240', '3300'].map((k) => snapshot(DB).gl[k] ?? 0));

// EXP numbering after delete
const before = q(DB, 'select expense_number from expenses order by id desc limit 3');
await step('E9. create expense after deletes (count-based EXP-)', () => c.post('/expenses', { categoryId: 1, description: 'after delete', amount: 100, paymentMethod: 'cash' }));
await step('E9b. again', () => c.post('/expenses', { categoryId: 1, description: 'after delete 2', amount: 100, paymentMethod: 'cash' }));
log('  last numbers before:', before, ' now:', q(DB, 'select expense_number from expenses order by id desc limit 3'));
log.save();
