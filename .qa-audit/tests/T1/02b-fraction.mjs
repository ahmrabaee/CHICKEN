// T1-02b: fractional minor units — float balance check vs integer storage
import fs from 'node:fs';
import { env, connect, logger, err } from './lib.mjs';
const E = env('t1', 3101); const { log, lines } = logger();
const a = await connect(E.BASE, 'admin', 'Admin@12345'); const id = E.acctId;
for (const [name, ls] of [
  ['1.6 + 0.4 dr / 2 cr', [{ accountId: id('1210'), debit: 1.6 }, { accountId: id('1210'), debit: 0.4 }, { accountId: id('3100'), credit: 2 }]],
  ['0.5+0.5+0.5+0.5 dr / 2 cr', [{ accountId: id('1210'), debit: 0.5 }, { accountId: id('1210'), debit: 0.5 }, { accountId: id('1210'), debit: 0.5 }, { accountId: id('1210'), debit: 0.5 }, { accountId: id('3100'), credit: 2 }]],
  ['99.9 dr / 99.9 cr', [{ accountId: id('1210'), debit: 99.9 }, { accountId: id('3100'), credit: 99.9 }]],
]) {
  const r = await a.post('/accounting/journal-entries', { description: 'frac ' + name, lines: ls });
  const jid = r.data?.id;
  if (jid) await a.post(`/accounting/journal-entries/${jid}/post`);
  const s = jid ? E.q(`select sum(debit_amount) dr, sum(credit_amount) cr from journal_entry_lines where journal_entry_id=?`, jid)[0] : null;
  log(`[${r.status}] ${name}: ${err(r)} stored Σdr=${s?.dr} Σcr=${s?.cr} ${s && s.dr !== s.cr ? '** UNBALANCED JE PERSISTED & POSTED **' : ''}`);
}
const t = E.q(`select sum(debit_amount) dr, sum(credit_amount) cr from journal_entry_lines l join journal_entries j on j.id=l.journal_entry_id where j.is_posted=1`)[0];
log('ledger totals posted', t, 'diff', t.dr - t.cr);
const tb = (await a.get('/accounting/trial-balance?asOfDate=2099-01-01')).data;
log('TB API Σ endingDr', tb.reduce((s, x) => s + x.endingDebit, 0), 'Σ endingCr', tb.reduce((s, x) => s + x.endingCredit, 0));
fs.writeFileSync(new URL('./02b-fraction.out.txt', import.meta.url), lines.join('\n'));
