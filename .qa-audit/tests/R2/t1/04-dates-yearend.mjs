// T1-04: as-of dates, fiscal year boundary, retained earnings, ledger opening balance, local-midnight boundaries
// instance t1b (3125) fresh baseline
import fs from 'node:fs';
import { env, connect, request, logger, err, failing } from './lib.mjs';
const E = env('r2', 3125); const { log, lines } = logger();
let r = await request(E.BASE, 'POST', '/auth/setup', { body: { businessName: 'QA2', adminUsername: 'admin', adminPassword: 'Admin@12345', adminFullName: 'QA', preferredLanguage: 'en' } });
const a = await connect(E.BASE, 'admin', 'Admin@12345'); const id = E.acctId;
async function je(desc, entryDate, ls) {
  const c = await a.post('/accounting/journal-entries', { description: desc, entryDate, lines: ls });
  const p = c.ok ? await a.post(`/accounting/journal-entries/${c.data.id}/post`) : c;
  log(`JE "${desc}" date=${entryDate ?? 'now'} -> create ${c.status} post ${p.status} ${err(c)}`);
}
await je('capital today', undefined, [{ accountId: id('1111'), debit: 100000 }, { accountId: id('3100'), credit: 100000 }]);
await je('prior-year revenue 2025-06-30', '2025-06-30', [{ accountId: id('1111'), debit: 10000 }, { accountId: id('4200'), credit: 10000 }]);
await je('prior-year expense 2025-12-31 12:00Z', '2025-12-31T12:00:00Z', [{ accountId: id('5210'), debit: 2000 }, { accountId: id('1111'), credit: 2000 }]);
await je('NYE local 00:30 2026-01-01 (=2025-12-31T22:30Z)', '2025-12-31T22:30:00Z', [{ accountId: id('1111'), debit: 500 }, { accountId: id('4200'), credit: 500 }]);
await je('current-year revenue 2026-03-10', '2026-03-10', [{ accountId: id('1111'), debit: 3000 }, { accountId: id('4200'), credit: 3000 }]);
await je('local 00:30 on 2026-11-25 (=2026-11-24T22:30Z)', '2026-11-24T22:30:00Z', [{ accountId: id('1111'), debit: 70 }, { accountId: id('4200'), credit: 70 }]);

const raw = (end) => Object.fromEntries(E.q(`select a.code, sum(l.debit_amount)-sum(l.credit_amount) b from journal_entry_lines l join accounts a on a.id=l.account_id join journal_entries e on e.id=l.journal_entry_id where e.is_posted=1 and e.entry_date<=? group by a.code`, end).map((x) => [x.code, x.b]));
log('\nRAW GL all:', raw(Date.now() + 1e10));
log('RAW GL as of 2025-12-31 23:59:59.999Z:', raw(Date.UTC(2025, 11, 31, 23, 59, 59, 999)));

// 1. TB API as-of past date
for (const d of ['2025-12-31', '2026-06-30']) {
  const tb = (await a.get(`/accounting/trial-balance?asOfDate=${d}`)).data;
  log(`TB API asOfDate=${d}:`, Object.fromEntries(tb.map((t) => [t.accountCode, t.balance])));
}
// 2. income statement via PDF endpoints is not JSON; use ledger + raw to show expected numbers. Fiscal year start computation:
const fy = new Date(2026, 0, 1); log('fiscal start computed by server code new Date(2026,0,1).toISOString() =', fy.toISOString(), '-> split =', fy.toISOString().split('T')[0]);
// 3. ledger opening balance with date ranges
for (const [s, e] of [['2026-01-01', undefined], ['2026-11-25', '2026-11-25'], ['2026-11-24', '2026-11-24']]) {
  const led = (await a.get(`/accounting/ledger/1111?startDate=${s}${e ? '&endDate=' + e : ''}`)).data;
  log(`ledger 1111 ${s}..${e ?? ''}: rows=${led.length} first.balance=${led[0]?.balance} closing=${led.at(-1)?.balance} entries=${led.map((l) => l.entryNumber + '@' + new Date(l.entryDate).toISOString()).join(',')}`);
}
log('ledger 1111 all: closing =', (await a.get('/accounting/ledger/1111')).data.at(-1)?.balance, ' raw =', raw(Date.now() + 1e10)['1111']);
// 4. PDFs
fs.mkdirSync(new URL('./pdf/', import.meta.url), { recursive: true });
for (const [name, path] of [
  ['bs-today', `/accounting/reports/balance-sheet/pdf?language=en`],
  ['bs-2025-12-31', `/accounting/reports/balance-sheet/pdf?asOfDate=2025-12-31&language=en`],
  ['is-2026', `/accounting/reports/income-statement/pdf?startDate=2026-01-01&endDate=2026-12-31&language=en`],
  ['is-2025', `/accounting/reports/income-statement/pdf?startDate=2025-01-01&endDate=2025-12-31&language=en`],
  ['tb-2025-12-31', `/accounting/reports/trial-balance/pdf?asOfDate=2025-12-31&language=en`],
  ['led1111-2026', `/accounting/reports/ledger/1111/pdf?startDate=2026-01-01&endDate=2026-12-31&language=en`],
]) {
  const res = await a.raw('GET', path, { raw: true }); const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(new URL(`./pdf/04-${name}.pdf`, import.meta.url), buf); log(`PDF ${name}: ${res.status} ${buf.length}b`);
}
log('invariants:', failing(E.checks()));
fs.writeFileSync(new URL('./04-dates-yearend.out.txt', import.meta.url), lines.join('\n'));
