// T6-09: backend date semantics. Storage = epoch ms (UTC). How do date-only filters and "today" behave vs Asia/Jerusalem local days?
import { connect, meta, q, one, tee, outFor } from './lib.mjs';
const log = tee(outFor(import.meta.url));
const m = meta();
const c = await connect(m.baseUrl, 'admin', 'admin123');
log('server process TZ offset (this machine) =', -new Date().getTimezoneOffset() / 60, 'h; Intl:', Intl.DateTimeFormat().resolvedOptions().timeZone);
log('storage sample:', q(m.db, `select sale_number, sale_date, typeof(sale_date) t, datetime(sale_date/1000,'unixepoch') utc, datetime(sale_date/1000,'unixepoch','+2 hours') jerusalem from sales order by id desc limit 1`));
const today = new Date().toISOString().slice(0, 10);
const todaySalesDb = one(m.db, `select count(*) n from sales where is_voided=0 and date(sale_date/1000,'unixepoch')=?`, today).n;
// 1) list endpoints with startDate=endDate=today
const ls = await c.get(`/sales?startDate=${today}&endDate=${today}&pageSize=500`);
log(`1) GET /sales?startDate=${today}&endDate=${today} → ${ls.status} totalItems=${ls.body?.pagination?.totalItems}; DB has ${todaySalesDb} non-voided sales today`);
const rs = await c.get(`/reports/sales?startDate=${today}&endDate=${today}`);
log(`   GET /reports/sales same range → ${rs.status} ${JSON.stringify(rs.data?.summary ?? rs.data).slice(0, 200)}`);
const le = await c.get(`/expenses?startDate=${today}&endDate=${today}&pageSize=500`);
const expToday = one(m.db, `select count(*) n from expenses where date(expense_date/1000,'unixepoch')=?`, today).n;
log(`   GET /expenses?startDate=endDate=${today} → ${le.status} totalItems=${le.body?.pagination?.totalItems} (list ignores startDate/endDate?); DB has ${expToday} expenses today`);
// 2) local-day boundary: expenses dated 00:30 local (= 22:30Z previous day) and 23:30 local
const D = '2026-11-25';
const mk = async (iso, tag) => (await c.post('/expenses', { categoryId: 1, description: tag, amount: 100, paymentMethod: 'cash', expenseDate: iso }));
const e1 = await mk('2026-11-25T10:00:00.000Z', 'T6 tz 12:00 local Nov-25');
const e2 = await mk('2026-11-25T21:30:00.000Z', 'T6 tz 23:30 local Nov-25');
const e3 = await mk('2026-11-25T22:30:00.000Z', 'T6 tz 00:30 local Nov-26');
log('2) created expenses', [e1, e2, e3].map((r) => r.status + ' ' + (r.data?.expenseNumber ?? r.body?.error?.code) + ' ' + r.data?.expenseDate));
const rep = await c.get(`/reports/expenses?startDate=${D}&endDate=${D}`);
const txt = JSON.stringify(rep.data);
log(`   GET /reports/expenses?startDate=endDate=${D} (a Jerusalem business day) → ${rep.status}; includes: 12:00-local-Nov25=${txt.includes(e1.data?.expenseNumber) || false} 23:30-local-Nov25=${txt.includes(e2.data?.expenseNumber) || false} 00:30-local-Nov26(should be EXCLUDED)=${txt.includes(e3.data?.expenseNumber) || false}`);
log('   report total:', JSON.stringify(rep.data?.summary ?? rep.data?.total ?? rep.data?.totalAmount ?? txt.slice(0, 200)));
const le2 = await c.get(`/expenses?startDate=${D}&endDate=${D}&pageSize=500`);
const t2 = JSON.stringify(le2.data);
log(`   GET /expenses list same day → includes e1=${t2.includes(e1.data?.expenseNumber)} e2=${t2.includes(e2.data?.expenseNumber)} e3=${t2.includes(e3.data?.expenseNumber)}`);
// date-only input
const e4 = await mk('2026-11-25', 'T6 tz date-only');
log(`3) expenseDate "2026-11-20" stored as ${e4.data?.expenseDate} (= ${new Date(e4.data?.expenseDate).toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem' })} Jerusalem); JE entry_date:`, q(m.db, `select datetime(entry_date/1000,'unixepoch') d from journal_entries where source_type='expense' and source_id=?`, e4.data?.id ?? -1));
// DST: Asia/Jerusalem 2026-03-27 02:00 -> 03:00 ; 2026-10-25 02:00 -> 01:00
for (const iso of ['2026-03-27T00:30:00.000Z', '2026-10-24T22:30:00.000Z']) {
  log(`DST note: ${iso} is ${new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem' })} Jerusalem but UTC date ${iso.slice(0, 10)}`);
}
log.save();

const r26 = await c.get('/reports/expenses?startDate=2026-11-26&endDate=2026-11-26');
log('   GET /reports/expenses for local day 2026-11-26 →', JSON.stringify(r26.data).slice(0, 200), '(00:30 local Nov-26 expense should be here)');
log.save();
