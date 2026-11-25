// T1-01: clean slate (baseline) -> setup via API -> small realistic set of operations -> compare reports vs DB vs invariants.
// usage: node 01-clean-slate.mjs   (instance t1 on 3125, fresh baseline)
import fs from 'node:fs';
import { env, connect, request, logger, err, failing, diff, formatDiff } from './lib.mjs';
const E = env('r2', 3125);
const { log, lines } = logger();
const OUT = new URL('./01-clean-slate.out.txt', import.meta.url);
const today = new Date().toISOString().slice(0, 10);

let r = await request(E.BASE, 'POST', '/auth/setup', { body: { businessName: 'متجر QA', businessNameEn: 'QA Shop', adminUsername: 'admin', adminPassword: 'Admin@12345', adminFullName: 'QA Admin', preferredLanguage: 'en' } });
log('setup', r.status, err(r));
const a = await connect(E.BASE, 'admin', 'Admin@12345');
log('after setup: JE count', E.q(`select count(*) n from journal_entries`)[0], 'branches', E.q(`select id,code,stock_account_id from branches`));
log('invariants after setup:', failing(E.checks()));

// master data
r = await a.post('/bank-accounts', { name: 'QA Bank', accountId: E.acctId('1112-001'), isDefault: true }); const bankId = r.data?.id; log('bank', r.status, bankId, err(r));
const cust = (await a.post('/customers', { name: 'Restaurant X', phone: '0599000001' })).data; log('customer', cust?.id);
const supA = (await a.post('/suppliers', { name: 'Supplier A', phone: '0599100001' })).data;
const supB = (await a.post('/suppliers', { name: 'Supplier B', phone: '0599100002' })).data; log('suppliers', supA?.id, supB?.id);
const it1 = (await a.post('/items', { name: 'Whole chicken', code: 'WH1', categoryId: 2, defaultSalePrice: 2500, defaultPurchasePrice: 1500, shelfLifeDays: 5 })); log('item1', it1.status, it1.data?.id, err(it1));
const it2 = (await a.post('/items', { name: 'Breast', code: 'BR1', categoryId: 3, defaultSalePrice: 4000, defaultPurchasePrice: 2500, shelfLifeDays: 5 })); log('item2', it2.status, it2.data?.id, err(it2));
const I1 = it1.data.id, I2 = it2.data.id;

const steps = [];
async function step(name, fn, expect) {
  const before = E.snap();
  const res = await fn();
  const after = E.snap();
  const d = diff(before, after);
  const got = Object.fromEntries(Object.entries(d.accounts).map(([k, v]) => [k, v.net]));
  let ok = true;
  if (expect) for (const k of new Set([...Object.keys(expect), ...Object.keys(got)])) if ((expect[k] ?? 0) !== (got[k] ?? 0)) ok = false;
  log(`\n## ${name} -> HTTP ${res.status} ${err(res)}`);
  log(formatDiff(d));
  if (expect) log(ok ? '  GL delta matches expectation' : `  ** GL delta MISMATCH expected ${JSON.stringify(expect)} got ${JSON.stringify(got)}`);
  steps.push({ name, status: res.status, ok, got, expect, metrics: d.metrics });
  return res;
}

// 1. owner capital via manual JE (the only way to bring opening money in)
await step('manual JE capital cash 5000.00 + bank 3000.00 (create)', () => a.post('/accounting/journal-entries', { description: 'Opening capital', lines: [
  { accountId: E.acctId('1111'), debit: 500000 }, { accountId: E.acctId('1112-001'), debit: 300000 }, { accountId: E.acctId('3100'), credit: 800000 }] }), {});
const je1 = E.q(`select id, is_posted from journal_entries order by id desc limit 1`)[0];
await step('post capital JE', () => a.post(`/accounting/journal-entries/${je1.id}/post`), { '1111': 500000, '1112-001': 300000, '3100': -800000 });

// 2. purchases
await step('credit purchase supplier A 100kg item1 @15.00', () => a.post('/purchases', { supplierId: supA.id, lines: [{ itemId: I1, weightGrams: 100000, pricePerKg: 1500 }] }), { '1131': 150000, '2110': -150000 });
await step('cash purchase supplier B 50kg item2 @25.00 paid', () => a.post('/purchases', { supplierId: supB.id, lines: [{ itemId: I2, weightGrams: 50000, pricePerKg: 2500 }], amountPaid: 125000, paymentMethod: 'cash' }), { '1131': 125000, '1111': -125000 });
// 3. sales
await step('cash sale 10kg item1 @25', () => a.post('/sales', { saleType: 'cash', lines: [{ itemId: I1, weightGrams: 10000, pricePerKg: 2500 }], payments: [{ amount: 25000, paymentMethod: 'cash' }] }), { '1111': 25000, '4110': -25000, '5100': 15000, '1131': -15000 });
const credit = await step('credit sale 5kg item2 @40 to customer', () => a.post('/sales', { saleType: 'credit', customerId: cust.id, lines: [{ itemId: I2, weightGrams: 5000, pricePerKg: 4000 }] }), { '1120': 20000, '4110': -20000, '5100': 12500, '1131': -12500 });
await step('bank sale 4kg item1 @25', () => a.post('/sales', { saleType: 'cash', lines: [{ itemId: I1, weightGrams: 4000, pricePerKg: 2500 }], payments: [{ amount: 10000, paymentMethod: 'bank_transfer', bankAccountId: bankId }] }), { '1112-001': 10000, '4110': -10000, '5100': 6000, '1131': -6000 });
await step('cash sale 2kg item1 @25 with 10.00 discount', () => a.post('/sales', { saleType: 'cash', discountAmount: 1000, lines: [{ itemId: I1, weightGrams: 2000, pricePerKg: 2500 }], payments: [{ amount: 4000, paymentMethod: 'cash' }] }),
  { '1111': 4000, '4110': -5000, '5400': 1000, '5100': 3000, '1131': -3000 }); // legacy rule: discount to 5400 (K3 posting map)
// 4. settlements
await step('customer payment 80.00 cash via /payments/sale', () => a.post('/payments/sale', { saleId: credit.data.id, amount: 8000, paymentMethod: 'cash' }), { '1111': 8000, '1120': -8000 });
const purA = E.q(`select id from purchases where supplier_id=?`, supA.id)[0].id;
await step('supplier payment 500.00 cash via /payments/purchase', () => a.post('/payments/purchase', { purchaseId: purA, amount: 50000, paymentMethod: 'cash' }), { '2110': 50000, '1111': -50000 });
// 5. expenses
await step('expense rent 300.00 cash', () => a.post('/expenses', { categoryId: 2, description: 'rent', amount: 30000, paymentMethod: 'cash' }), { '5210': 30000, '1111': -30000 }); // ideal: category account 5210
await step('expense electricity 200.00 bank', () => a.post('/expenses', { categoryId: 4, description: 'electricity', amount: 20000, paymentMethod: 'bank_transfer', bankAccountId: bankId }), { '5221': 20000, '1112-001': -20000 });
// 6. wastage + adjustment
const lot1 = E.q(`select id from inventory_lots where item_id=? order by id limit 1`, I1)[0].id;
await step('wastage 1kg item1 lot', () => a.post('/wastage', { lotId: lot1, quantityGrams: 1000, reason: 'spoiled', notes: 't1' }), { '5300': 1500, '1131': -1500 });
await step('adjustment decrease 1kg item2', () => a.post('/inventory/adjustments', { itemId: I2, adjustmentType: 'decrease', quantityGrams: 1000, reason: 't1 count' }), { '5320': 2500, '1131': -2500 });

// ---- invariants ----
const res = E.checks();
log('\n#### INVARIANTS after clean-slate scenario');
for (const c of res) log(`[${c.status}] ${c.id} ${c.title}`, c.status === 'PASS' ? '' : JSON.stringify({ e: c.expected, a: c.actual, d: c.diff, det: c.details }).slice(0, 700));

// ---- reports vs DB ----
const raw = Object.fromEntries(E.q(`select a.code, coalesce(sum(l.debit_amount),0)-coalesce(sum(l.credit_amount),0) b from accounts a join journal_entry_lines l on l.account_id=a.id join journal_entries e on e.id=l.journal_entry_id where e.is_posted=1 group by a.code`).map((x) => [x.code, x.b]));
log('\n#### RAW GL balances', raw);
const tb = (await a.get('/accounting/trial-balance')).data;
const tbMap = Object.fromEntries(tb.map((t) => [t.accountCode, t.balance]));
log('TB (no params) balances', tbMap, 'Σ endingDr', tb.reduce((s, t) => s + t.endingDebit, 0), 'Σ endingCr', tb.reduce((s, t) => s + t.endingCredit, 0));
log('TB == raw ?', JSON.stringify(tbMap) === JSON.stringify(Object.fromEntries(Object.keys(tbMap).map((k) => [k, raw[k]]))) && Object.keys(raw).length === Object.keys(tbMap).length);
const tbAsOf = (await a.get(`/accounting/trial-balance?asOfDate=${today}`)).data;
log('TB asOfDate=today: Σ opening', tbAsOf.reduce((s, t) => s + t.openingDebit - t.openingCredit, 0), 'Σ period dr', tbAsOf.reduce((s, t) => s + t.periodDebit, 0), 'balances equal raw?', tbAsOf.every((t) => t.balance === raw[t.accountCode]));
const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const tbYest = (await a.get(`/accounting/trial-balance?asOfDate=${yest}`)).data;
log(`TB asOfDate=${yest} (before any entry) -> non-zero balances (expected none):`, tbYest.filter((t) => t.balance).map((t) => `${t.accountCode}=${t.balance}`).join(' '));
for (const code of ['1111', '1112-001', '1120', '1131', '2110', '4110']) {
  const led = (await a.get(`/accounting/ledger/${code}`)).data;
  const last = led.at(-1)?.balance; log(`ledger ${code}: rows=${led.length} closing=${last} raw=${raw[code]} ${last === raw[code] ? 'OK' : 'MISMATCH'}`);
}
const pl = (await a.get(`/reports/profit-loss?startDate=${today}&endDate=${today}`)).data;
const glRev = -(raw['4110'] ?? 0) - (raw['4200'] ?? 0), glExp = Object.entries(raw).filter(([k]) => k.startsWith('5')).reduce((s, [, v]) => s + v, 0);
log('/reports/profit-loss', pl, ' vs GL revenue', glRev, 'GL expenses(5xxx)', glExp, 'GL net', glRev - glExp);
const svg = await a.get(`/reports/stock-vs-gl?asOfDate=${today}`);
log('/reports/stock-vs-gl summary', svg.status, JSON.stringify(svg.data?.summary), 'raw 1131', raw['1131'], 'inventory.total_value', E.q(`select sum(total_value) v from inventory`)[0].v);
const svg2 = await a.get(`/reports/stock-vs-gl`);
log('/reports/stock-vs-gl (no date) summary', svg2.status, JSON.stringify(svg2.data?.summary ?? svg2.body).slice(0, 300));
const dash = await a.get('/reports/dashboard');
log('/reports/dashboard', JSON.stringify(dash.data).slice(0, 600));

// PDFs
fs.mkdirSync(new URL('./pdf/', import.meta.url), { recursive: true });
for (const [name, path] of [['bs', `/accounting/reports/balance-sheet/pdf?asOfDate=${today}&language=en`], ['is', `/accounting/reports/income-statement/pdf?startDate=${today}&endDate=${today}&language=en`],
  ['tb', `/accounting/reports/trial-balance/pdf?asOfDate=${today}&language=en`], ['led1111', `/accounting/reports/ledger/1111/pdf?language=en`], ['svg', `/reports/stock-vs-gl/pdf?asOfDate=${today}&language=en`]]) {
  const res2 = await a.raw('GET', path, { raw: true });
  const buf = Buffer.from(await res2.arrayBuffer());
  fs.writeFileSync(new URL(`./pdf/01-${name}.pdf`, import.meta.url), buf);
  log(`PDF ${name}: HTTP ${res2.status} ${buf.length} bytes`);
}
log('\nSTEP SUMMARY', steps.map((s) => `${s.ok ? 'OK ' : 'MISMATCH'} ${s.name}`).join('\n'));
fs.writeFileSync(OUT, lines.join('\n'));
