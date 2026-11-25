import * as L from './lib.mjs';
const a = await L.admin();
const pick = (r) => (r.data || []).filter(x => x.accountCode === '1111').map(x => ({ openD: x.openingDebit, perD: x.periodDebit, perC: x.periodCredit, endD: x.endingDebit, bal: x.balance }));
for (const d of ['2025-12-31', '2026-11-24', '2026-11-25', '2027-01-01'])
  L.say(`TB 1111 asOfDate=${d}`, pick(await a.get(`/accounting/trial-balance?asOfDate=${d}`)));
L.say('TB 1111 startDate=2026-11-25 endDate=2026-11-25', pick(await a.get(`/accounting/trial-balance?startDate=2026-11-25&endDate=2026-11-25`)));
L.say('TB 1111 endDate=2025-12-31 only', pick(await a.get(`/accounting/trial-balance?endDate=2025-12-31`)));
L.say('GL truth 1111 (all entries today)', L.glOf('1111'));
