// R1-08: sweep of clusters the teammate did not (fully) touch + C-5 audit + C-6 guards/discount cap + QA-020..025,031,035,036,038,041,047
import { setup, glx, dl, jeCheck, L, errc, log, saveLog, must, q, q1, newItem, purchase, sale, showItem, newCust, bankId } from './lib2.mjs';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
const { c, db, info } = await setup();
const cashA = q1(db, "select id from accounts where code='1111'").id, capA = q1(db, "select id from accounts where code='3100'").id;
{ const r = must(await c.post('/accounting/journal-entries', { description: 'R1 fund', entryDate: new Date().toISOString(), lines: [{ accountId: cashA, debit: 5000000, credit: 0 }, { accountId: capA, debit: 0, credit: 5000000 }] }), 'fund'); must(await c.post(`/accounting/journal-entries/${r.id}/post`), 'post'); }
const bid = await bankId(c, db);
const accRole = (await c.get('/users/roles')).data.find((x) => x.name === 'accountant');
must(await c.post('/users', { username: 'r1acc', password: 'Password@123', fullName: 'R1 acc', roleId: accRole.id }), 'acc');
const acc = await connect(info.baseUrl, 'r1acc', 'Password@123');
const it = await newItem(c, { name: 'R1 sweep', sale: 5000, purchase: 2000 });
await purchase(c, [{ itemId: it.id, weightGrams: 300000, pricePerKg: 2000 }]);

log('=== C-6 RolesGuard: accountant against previously open endpoints (QA-002) and discount cap (QA-008)');
const t = async (label, r) => log(`  ${label}:`, errc(r));
await t('POST /tax/templates (was 201)', await acc.post('/tax/templates', { name: 'acc tmpl', type: 'sales', items: [{ accountId: 18, rate: 9900 }] }));
await t('GET /tax/templates', await acc.get('/tax/templates'));
await t('POST /credit-notes', await acc.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: 1, amount: 1, reason: 'x' }));
await t('GET /accounts', await acc.get('/accounts'));
await t('POST /accounts', await acc.post('/accounts', { code: '9999', name: 'x', rootType: 'Asset', accountType: 'Cash' }));
await t('GET /reconciliation/outstanding/party', await acc.get('/reconciliation/outstanding/party?partyType=customer&partyId=1'));
await t('GET /system/backups (QA-002)', await acc.get('/system/backups'));
await t('POST /system/backups (QA-002)', await acc.post('/system/backups', {}));
await t('GET /settings', await acc.get('/settings'));
await t('POST /users (create admin?)', await acc.post('/users', { username: 'evil', password: 'Password@123', fullName: 'e', roleId: 1 }));
await t('GET /reports/profit-loss (accountant)', await acc.get('/reports/profit-loss?startDate=2026-01-01&endDate=2026-12-31'));
await t('GET /items/ cost visible', await acc.get(`/items/${it.id}`));
const cu = await newCust(c, 'sw');
const sCredit = must(await c.post('/sales', { saleType: 'credit', customerId: cu, lines: [L(it.id, 2000, 5000)] }), 'cs');
const dId = q1(db, "select id from debts where source_type='sale' and source_id=?", sCredit.id).id;
await t('accountant debt write-off (admin-only claimed)', await acc.post(`/debts/${dId}/write-off`, { reason: 'x' }));
const sTot = (b) => acc.post('/sales', { saleType: 'cash', lines: [L(it.id, 1000, 5000)], payments: [], ...b });
await t('accountant discountAmount 2000 on 5000 (40%)', await sTot({ discountAmount: 2000, payments: [{ amount: 3000, paymentMethod: 'cash' }] }));
await t('accountant line discount 4000 on 5000', await acc.post('/sales', { saleType: 'cash', lines: [L(it.id, 1000, 5000, { discountAmount: 4000 })], payments: [{ amount: 1000, paymentMethod: 'cash' }] }));
await t('accountant discountPct 600', await sTot({ discountPct: 600, payments: [{ amount: 4700, paymentMethod: 'cash' }] }));
await t('accountant discount 4.9% (245) OK expected', await sTot({ discountAmount: 245, payments: [{ amount: 4755, paymentMethod: 'cash' }] }));
await t('accountant combined 3% line + 3% header', await acc.post('/sales', { saleType: 'cash', discountAmount: 150, lines: [L(it.id, 1000, 5000, { discountAmount: 150 })], payments: [{ amount: 4700, paymentMethod: 'cash' }] }));
await t('accountant price override pricePerKg 1', await acc.post('/sales', { saleType: 'cash', lines: [L(it.id, 10000, 1)], payments: [{ amount: 10, paymentMethod: 'cash' }] }));
await t('accountant 100% price via discount in 100 tiny lines (split-line bypass) x20 lines each 5% off', await acc.post('/sales', { saleType: 'cash', lines: Array.from({ length: 2 }, () => L(it.id, 1000, 5000, { discountAmount: 250 })), payments: [{ amount: 9500, paymentMethod: 'cash' }] }));
await t('accountant wastage', await acc.post('/wastage', { lotId: q1(db, 'select id from inventory_lots where item_id=?', it.id).id, quantityGrams: 100, reason: 'x' }));
await t('accountant adjustment', await acc.post('/inventory/adjustments', { itemId: it.id, adjustmentType: 'decrease', quantityGrams: 100, reason: 'x' }));
await t('accountant sale void', await acc.post(`/sales/${sCredit.id}/void`, { reason: 'x' }));

log('=== C-5 audit interceptor coverage');
const a0 = q1(db, 'select count(*) n from audit_logs').n;
const ops = [
  ['POST /users', () => c.post('/users', { username: 'r1aud', password: 'Password@123', fullName: 'aud', roleId: accRole.id })],
  ['PUT /settings/pos.x', () => c.put('/settings/pos.max_discount', { value: '7' })],
  ['POST /purchases', () => c.post('/purchases', { supplierId: 1, lines: [L(it.id, 1000, 2000)] })],
  ['POST /expenses', () => c.post('/expenses', { categoryId: 1, description: 'aud', amount: 1000, paymentMethod: 'cash' })],
  ['POST /system/backups', () => c.post('/system/backups', {})],
  ['POST /tax/templates', () => c.post('/tax/templates', { name: 'aud tmpl', type: 'sales', items: [{ accountId: 18, rate: 100 }] })],
  ['POST /accounting/journal-entries', () => c.post('/accounting/journal-entries', { description: 'aud', entryDate: new Date().toISOString(), lines: [{ accountId: cashA, debit: 100, credit: 0 }, { accountId: capA, debit: 0, credit: 100 }] })],
  ['POST /customers', () => c.post('/customers', { name: 'aud cust', phone: '0599000111' })],
  ['PUT /users/:id password change', () => c.put(`/users/${q1(db, "select id from users where username='r1aud'").id}`, { fullName: 'aud2' })],
];
for (const [l, f] of ops) { const n0 = q1(db, 'select count(*) n from audit_logs').n; const r = await f(); await new Promise((r) => setTimeout(r, 120)); log(`  ${l}`, errc(r), '-> audit rows +', q1(db, 'select count(*) n from audit_logs').n - n0); }
log('  denied attempt (accountant POST /users) audited?', (() => { const n0 = q1(db, 'select count(*) n from audit_logs').n; return n0; })());
{ const n0 = q1(db, 'select count(*) n from audit_logs').n; await acc.post('/users', { username: 'evil2', password: 'Password@123', fullName: 'e', roleId: 1 }); await new Promise((r) => setTimeout(r, 120)); log('  403/400 attempt audit rows +', q1(db, 'select count(*) n from audit_logs').n - n0); }
{ const n0 = q1(db, 'select count(*) n from audit_logs').n; const r = await c.post(`/sales/${sCredit.id}/void`, { reason: 'dupe-audit' }); await new Promise((r) => setTimeout(r, 120)); log('  sale void audit rows +', q1(db, 'select count(*) n from audit_logs').n - n0, '(service row + interceptor row)'); }
log('  latest rows', JSON.stringify(q(db, 'select action, entity_type, entity_id, username, ip_address ip, substr(changes,1,110) ch from audit_logs order by id desc limit 6')));
log('  password in audit?', q1(db, "select count(*) n from audit_logs where changes like '%Password@123%'").n);
{ const r = await c.post('/customers', { name: 'spoof', phone: '0599000222' }, { headers: { 'x-forwarded-for': '6.6.6.6' } }); await new Promise((r) => setTimeout(r, 120)); log('  X-Forwarded-For spoof recorded as ip:', q1(db, 'select ip_address ip from audit_logs order by id desc limit 1').ip); }
log('  audit rows before/after setting change contain old value?', q1(db, "select count(*) n from audit_logs where entity_type='settings'").n, JSON.stringify(q1(db, "select changes from audit_logs where entity_type='settings' order by id desc limit 1")));

log('=== QA-020 credit note vs invoice/debt');
{
  const cu2 = await newCust(c, 'cn'); const s = must(await c.post('/sales', { saleType: 'credit', customerId: cu2, lines: [L(it.id, 2000, 5000)] }), 's');
  const G0 = glx(db);
  const cn = must(await c.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: s.id, amount: 4000, reason: 'r1' }), 'cn'); log('submit', errc(await c.post(`/credit-notes/${cn.id}/submit`, {})));
  log('  GL', JSON.stringify(dl(G0, glx(db))), '(orig: 5400 +4000 / AR -4000)', '| sale', JSON.stringify(q1(db, 'select total_amount t, amount_paid p, payment_status s from sales where id=?', s.id)), 'cust bal', q1(db, 'select current_balance b from customers where id=?', cu2).b);
  log('  customer then pays full 10000', errc(await c.post('/payments/sale', { saleId: s.id, amount: 10000, paymentMethod: 'cash' })));
}
log('=== QA-021 / QA-022 write-off, payment after void');
{
  const cu3 = await newCust(c, 'wo'); const s = must(await c.post('/sales', { saleType: 'credit', customerId: cu3, lines: [L(it.id, 2000, 5000)] }), 's');
  const d = q1(db, "select id from debts where source_type='sale' and source_id=?", s.id).id; const G0 = glx(db);
  log('write-off by admin', errc(await c.post(`/debts/${d}/write-off`, { reason: 'r1' })), 'GL', JSON.stringify(dl(G0, glx(db))), '(orig: no GL)', 'cust bal', q1(db, 'select current_balance b from customers where id=?', cu3).b);
  log('payment after write-off', errc(await c.post('/payments/sale', { saleId: s.id, amount: 1000, paymentMethod: 'cash' })));
  const s2 = must(await c.post('/sales', { saleType: 'credit', customerId: cu3, lines: [L(it.id, 2000, 5000)] }), 's2');
  await c.post(`/sales/${s2.id}/void`, { reason: 'r1' });
  log('payment on voided sale', errc(await c.post('/payments/sale', { saleId: s2.id, amount: 1000, paymentMethod: 'cash' })));
  log('POST /sales/:id/payments on voided sale', errc(await c.post(`/sales/${s2.id}/payments`, { amount: 1000, paymentMethod: 'cash' })));
}
log('=== QA-041 sale validation');
{
  log('empty lines sale', errc(await c.post('/sales', { saleType: 'cash', lines: [], payments: [] })));
  log('100% discount sale', errc(await c.post('/sales', { saleType: 'cash', discountAmount: 5000, lines: [L(it.id, 1000, 5000)], payments: [] })));
  log('overpay by 1 agora', errc(await c.post('/sales', { saleType: 'cash', lines: [L(it.id, 1000, 5000)], payments: [{ amount: 5001, paymentMethod: 'cash' }] })));
  const cuL = must(await c.post('/customers', { name: 'R1 limit', phone: '0599333444', creditLimit: 5000 }), 'cl').id;
  log('credit sale 10000 vs limit 5000', errc(await c.post('/sales', { saleType: 'credit', customerId: cuL, lines: [L(it.id, 2000, 5000)] })));
}
log('=== QA-047 expired lot sold');
{
  const ex = await newItem(c, { name: 'R1 expired', sale: 5000, shelf: 2 });
  must(await c.post('/inventory/adjustments', { itemId: ex.id, adjustmentType: 'increase', quantityGrams: 5000, unitCost: 2000, expiryDate: '2026-11-01', reason: 'r1' }), 'adj');
  log('sell 3kg from lot expired 2026-11-01', errc(await sale(c, [L(ex.id, 3000, 5000)])));
}
log('=== QA-031 manual JE validation');
{
  const mj = (lines, extra = {}) => c.post('/accounting/journal-entries', { description: 'r1', entryDate: new Date().toISOString(), lines, ...extra });
  log('fractional 1.6+0.4 vs 2', errc(await mj([{ accountId: cashA, debit: 1.6, credit: 0 }, { accountId: cashA, debit: 0.4, credit: 0 }, { accountId: capA, debit: 0, credit: 2 }])));
  log('negative amounts', errc(await mj([{ accountId: cashA, debit: -500, credit: 0 }, { accountId: capA, debit: 0, credit: -500 }])));
  log('empty lines', errc(await mj([])));
  log('date 2030', errc(await mj([{ accountId: cashA, debit: 100, credit: 0 }, { accountId: capA, debit: 0, credit: 100 }], { entryDate: '2030-01-01T00:00:00Z' })));
}
log('=== QA-036 stock-vs-gl report; QA-035 P&L page vs GL');
{
  const today = new Date().toISOString().slice(0, 10);
  const sv = await c.get(`/reports/stock-vs-gl?asOfDate=${today}`); log('stock-vs-gl asOf today', JSON.stringify(sv.data).slice(0, 300));
  const pl = (await c.get(`/reports/profit-loss?startDate=${today}&endDate=${today}`)).data;
  const gsum = (codes, sign) => q1(db, `select coalesce(sum(l.credit_amount-l.debit_amount),0) s from journal_entry_lines l join accounts a on a.id=l.account_id join journal_entries e on e.id=l.journal_entry_id where e.is_posted=1 and a.code in (${codes.map((x) => `'${x}'`).join(',')})`).s * sign;
  log('P&L page', JSON.stringify(pl));
  log('GL: revenue(4110)', gsum(['4110'], 1), 'discount(4900)', gsum(['4900'], -1), 'COGS 5100', gsum(['5100'], -1), 'wastage 5300', gsum(['5300'], -1), 'adjust 5320', gsum(['5320'], -1), 'other exp 5400', gsum(['5400'], -1), 'VAT 2120', gsum(['2120'], 1));
}
log('JE unbalanced', JSON.stringify(jeCheck(db)));
saveLog('08-sweep');
