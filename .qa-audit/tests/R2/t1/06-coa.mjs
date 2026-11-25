// T1-06: chart-of-accounts changes on accounts in use (t1, 3125)
import fs from 'node:fs';
import { env, connect, logger, err, failing } from './lib.mjs';
const E = env('r2', 3125); const { log, lines } = logger();
const a = await connect(E.BASE, 'admin', 'Admin@12345'); const id = E.acctId;
const tbMap = async () => Object.fromEntries(((await a.get('/accounting/trial-balance')).data).map((t) => [t.accountCode, `${t.rootType}:${t.balance}`]));
const acct = (code) => E.q(`select id,code,root_type,account_type,is_group,is_active,parent_id from accounts where code=?`, code)[0];
const sale = () => a.post('/sales', { saleType: 'cash', lines: [{ itemId: 1, weightGrams: 100, pricePerKg: 2500 }], payments: [{ amount: 250, paymentMethod: 'cash' }] });

log('can-delete 1111:', JSON.stringify((await a.get(`/accounting/accounts/${id('1111')}/can-delete`)).data));
let r = await a.del(`/accounting/accounts/${id('1111')}`); log('DELETE 1111 (has entries):', r.status, err(r));
r = await a.del(`/accounting/accounts/${id('4120')}`); log('DELETE 4120 (unused leaf):', r.status, err(r));
r = await a.del(`/accounting/accounts/${id('1110')}`); log('DELETE 1110 (group with children):', r.status, err(r));

// deactivate 1111 then sell
r = await a.put(`/accounting/accounts/${id('1111')}`, { isActive: false }); log('\ndeactivate 1111 (cash, balance', E.bal('1111'), '):', r.status, err(r));
r = await sale(); log('  cash sale with 1111 inactive:', r.status, err(r).slice(0, 150));
r = await a.put(`/accounting/accounts/${id('1111')}`, { isActive: true }); log('  reactivate:', r.status);

// change root/report type of an account with balance: 5400 (expense) -> Income
const before = await tbMap();
r = await a.put(`/accounting/accounts/${id('5400')}`, { rootType: 'Income', reportType: 'Profit and Loss', accountType: 'Income Account' });
log('\nchange 5400 Other Expenses rootType Expense->Income (balance', E.bal('5400'), '):', r.status, err(r));
log('  TB 5400 before/after:', before['5400'], '->', (await tbMap())['5400']);
log('  invariants GL-05:', failing(E.checks()).filter((x) => x.startsWith('GL')));
r = await a.put(`/accounting/accounts/${id('5400')}`, { rootType: 'Expense', reportType: 'Profit and Loss', accountType: 'Expense Account' }); log('  revert:', r.status);

// move an asset account with balance to Liability root
r = await a.put(`/accounting/accounts/${id('1112-001')}`, { rootType: 'Liability', reportType: 'Balance Sheet' });
log('\nchange 1112-001 (bank, balance', E.bal('1112-001'), ') rootType Asset->Liability:', r.status, err(r), JSON.stringify(acct('1112-001')));
await a.put(`/accounting/accounts/${id('1112-001')}`, { rootType: 'Asset', reportType: 'Balance Sheet' });

// rename code of a hard-coded account
r = await a.put(`/accounting/accounts/${id('4110')}`, { code: '4111' });
log('\nchange code 4110 -> 4111 (hard-coded SALES_REVENUE):', r.status, err(r));
r = await sale(); log('  cash sale after code change:', r.status, err(r).slice(0, 150));
log('  JE lines of that sale:', JSON.stringify(E.q(`select a.code, l.debit_amount dr, l.credit_amount cr from journal_entry_lines l join accounts a on a.id=l.account_id join journal_entries j on j.id=l.journal_entry_id where j.source_type='sale' and j.source_id=?`, r.data?.id ?? -1)));
await a.put(`/accounting/accounts/${E.q(`select id from accounts where code in ('4111','4110')`)[0].id}`, { code: '4110' });

// convert leaf with balance into group
r = await a.put(`/accounting/accounts/${id('5320')}`, { isGroup: true });
log('\nmake 5320 (balance', E.bal('5320'), ') a GROUP:', r.status, err(r), JSON.stringify(acct('5320')));
log('  invariants GL-04:', failing(E.checks()).filter((x) => x.startsWith('GL-04')));
r = await a.post('/inventory/adjustments', { itemId: 2, adjustmentType: 'decrease', quantityGrams: 100, reason: 'coa test' });
log('  adjustment while 5320 is group:', r.status, err(r).slice(0, 150));
await a.put(`/accounting/accounts/${id('5320')}`, { isGroup: false });

// re-parent leaf under another root
r = await a.put(`/accounting/accounts/${id('1131')}`, { parentId: id('2100') });
log('\nmove 1131 Inventory under 2100 Current Liabilities (parent root mismatch):', r.status, err(r), JSON.stringify(acct('1131')));
await a.put(`/accounting/accounts/${id('1131')}`, { parentId: id('1130') });
// create account with duplicate code / child under leaf
r = await a.post('/accounting/accounts', { code: '1111', name: 'dup', accountType: 'Cash', rootType: 'Asset' }); log('\ncreate duplicate code 1111:', r.status, err(r).slice(0, 100));
r = await a.post('/accounting/accounts', { code: '1111-01', name: 'child of leaf', accountType: 'Cash', rootType: 'Asset', parentId: id('1111') }); log('create child under leaf 1111 (which has entries):', r.status, err(r).slice(0, 120), JSON.stringify(acct('1111')));
log('final invariants:', failing(E.checks()).filter((x) => x.startsWith('GL')));
fs.writeFileSync(new URL('./06-coa.out.txt', import.meta.url), lines.join('\n'));
