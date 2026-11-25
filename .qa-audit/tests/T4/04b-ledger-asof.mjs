// T4-04b: GL as of 2026-11-02 (ledger endpoint) vs operational reports for back-dated documents (t4b after 04).
import { login, makeLog, short, QA } from './lib.mjs';
const log = makeLog(`${QA}/tests/T4/04b-ledger-asof.out.txt`);
const c = await login('t4b');
for (const code of ['1111', '5400', '1131']) {
  const r = await c.get(`/accounting/ledger/${code}?startDate=2026-11-01&endDate=2026-11-02`);
  const rows = Array.isArray(r.data) ? r.data : (r.data?.entries ?? r.data?.lines ?? []);
  log(`ledger ${code} 2026-11-01..02:`, short(r), 'rows', rows.length, 'last balance', rows.at?.(-1)?.balance ?? JSON.stringify(r.data).slice(0, 200));
}
const pl = await c.get('/reports/profit-loss?startDate=2026-11-01&endDate=2026-11-02');
log('/reports/profit-loss 2026-11-01..02:', JSON.stringify(pl.data));
const pr = await c.get('/reports/purchases?startDate=2026-11-01&endDate=2026-11-02');
log('/reports/purchases 2026-11-01..02:', short(pr), JSON.stringify(pr.data).slice(0, 300));
const tb = await c.get('/accounting/trial-balance?asOfDate=2026-11-02');
const r1111 = (tb.data || []).find((x) => x.accountCode === '1111');
log('trial-balance?asOfDate=2026-11-02 row 1111:', JSON.stringify(r1111));
log.save();
