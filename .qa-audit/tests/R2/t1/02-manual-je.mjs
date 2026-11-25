// T1-02: manual journal entry validation matrix + post/draft behaviour + reversal availability
import fs from 'node:fs';
import { env, connect, logger, err, failing } from './lib.mjs';
const E = env('r2', 3125);
const { log, lines } = logger();
const a = await connect(E.BASE, 'admin', 'Admin@12345');
const id = E.acctId;
const lastJe = () => E.q(`select id, entry_number, entry_date, is_posted from journal_entries order by id desc limit 1`)[0];
const cases = [
  ['unbalanced 100/90', { description: 'u', lines: [{ accountId: id('1111'), debit: 10000 }, { accountId: id('3100'), credit: 9000 }] }],
  ['zero lines', { description: 'z', lines: [] }],
  ['single line debit only', { description: 's', lines: [{ accountId: id('1111'), debit: 100 }] }],
  ['all-zero lines', { description: 'z2', lines: [{ accountId: id('1111'), debit: 0 }, { accountId: id('3100'), credit: 0 }] }],
  ['negative amounts (-100 dr / -100 cr)', { description: 'neg', lines: [{ accountId: id('1111'), debit: -10000 }, { accountId: id('3100'), credit: -10000 }] }],
  ['line with both debit and credit', { description: 'both', lines: [{ accountId: id('1111'), debit: 500, credit: 500 }, { accountId: id('3100'), debit: 100, credit: 100 }] }],
  ['fractional minor units 0.5', { description: 'frac', lines: [{ accountId: id('1111'), debit: 0.5 }, { accountId: id('3100'), credit: 0.5 }] }],
  ['group account 1112 (bank group)', { description: 'grp', lines: [{ accountId: id('1112'), debit: 100 }, { accountId: id('3100'), credit: 100 }] }],
  ['group account 1000 root', { description: 'grp2', lines: [{ accountId: id('1000'), debit: 100 }, { accountId: id('3100'), credit: 100 }] }],
  ['non-existent account 99999', { description: 'nx', lines: [{ accountId: 99999, debit: 100 }, { accountId: id('3100'), credit: 100 }] }],
  ['missing accountId', { description: 'na', lines: [{ debit: 100 }, { accountId: id('3100'), credit: 100 }] }],
  ['same account dr/cr (net zero)', { description: 'self', lines: [{ accountId: id('1111'), debit: 100 }, { accountId: id('1111'), credit: 100 }] }],
  ['huge amount 9e15', { description: 'huge', lines: [{ accountId: id('1210'), debit: 9e15 }, { accountId: id('3100'), credit: 9e15 }] }],
  ['huge amount > 2^53', { description: 'huge2', lines: [{ accountId: id('1210'), debit: 2 ** 53 + 2 }, { accountId: id('3100'), credit: 2 ** 53 + 2 }] }],
  ['future date 2030-01-01', { description: 'fut', entryDate: '2030-01-01', lines: [{ accountId: id('1210'), debit: 100 }, { accountId: id('3100'), credit: 100 }] }],
  ['past date 2020-06-30', { description: 'past', entryDate: '2020-06-30', lines: [{ accountId: id('1210'), debit: 100 }, { accountId: id('3100'), credit: 100 }] }],
  ['invalid date string', { description: 'bad', entryDate: 'not-a-date', lines: [{ accountId: id('1210'), debit: 100 }, { accountId: id('3100'), credit: 100 }] }],
  ['credit to AR 1120 with no party (subledger bypass)', { description: 'ar', lines: [{ accountId: id('1111'), debit: 100 }, { accountId: id('1120'), credit: 100 }] }],
  ['to inventory 1131 (no stock)', { description: 'inv', lines: [{ accountId: id('1131'), debit: 100 }, { accountId: id('3100'), credit: 100 }] }],
  ['cash overdraw: credit 1111 by 1,000,000.00', { description: 'overdraw', lines: [{ accountId: id('3300'), debit: 100000000 }, { accountId: id('1111'), credit: 100000000 }] }],
  ['description empty', { description: '', lines: [{ accountId: id('1210'), debit: 100 }, { accountId: id('3100'), credit: 100 }] }],
  ['sourceType injection (sale/1)', { description: 'inj', sourceType: 'sale', sourceId: 1, lines: [{ accountId: id('1210'), debit: 100 }, { accountId: id('3100'), credit: 100 }] }],
  ['referenceType/referenceId (DTO fields)', { description: 'ref', referenceType: 'sale', referenceId: 1, lines: [{ accountId: id('1210'), debit: 100 }, { accountId: id('3100'), credit: 100 }] }],
];
const created = {};
for (const [name, body] of cases) {
  const before = lastJe()?.id ?? 0;
  const r = await a.post('/accounting/journal-entries', body);
  const after = lastJe();
  const made = after && after.id !== before;
  created[name] = made ? after.id : null;
  let detail = '';
  if (made) {
    const ls = E.q(`select a.code, debit_amount dr, credit_amount cr from journal_entry_lines l join accounts a on a.id=l.account_id where journal_entry_id=?`, after.id);
    detail = ` -> JE ${after.entry_number} date=${new Date(after.entry_date).toISOString()} posted=${after.is_posted} src=${JSON.stringify(E.q('select source_type,source_id from journal_entries where id=?', after.id)[0])} lines=${JSON.stringify(ls)}`;
  }
  log(`[${r.status}] ${name}: ${made ? 'CREATED' : 'rejected'} ${err(r)}${detail}`);
}
// inactive account: deactivate 1220 via API then post
let r = await a.put(`/accounting/accounts/${id('1220')}`, { isActive: false });
log('deactivate 1220', r.status, err(r));
r = await a.post('/accounting/journal-entries', { description: 'inactive', lines: [{ accountId: id('1220'), debit: 100 }, { accountId: id('3100'), credit: 100 }] });
log(`[${r.status}] post to INACTIVE 1220: ${r.ok ? 'CREATED' : 'rejected'} ${err(r)}`);
r = await a.put(`/accounting/accounts/${id('1220')}`, { freezeAccount: true, isActive: true });
r = await a.post('/accounting/journal-entries', { description: 'frozen', lines: [{ accountId: id('1220'), debit: 100 }, { accountId: id('3100'), credit: 100 }] });
log(`[${r.status}] post to FROZEN 1220: ${r.ok ? 'CREATED' : 'rejected'} ${err(r)}`);
await a.put(`/accounting/accounts/${id('1220')}`, { freezeAccount: false });

// posting: post the created drafts that were created, double post
for (const [name, jid] of Object.entries(created)) {
  if (!jid) continue;
  const p = await a.post(`/accounting/journal-entries/${jid}/post`);
  log(`post "${name}" JE ${jid}: ${p.status} ${err(p)}`);
}
const fut = created['future date 2030-01-01'];
if (fut) { const p2 = await a.post(`/accounting/journal-entries/${fut}/post`); log('double post:', p2.status, err(p2)); }

// reversal / edit / delete routes
for (const [m, p] of [['POST', `/accounting/journal-entries/${fut}/reverse`], ['PUT', `/accounting/journal-entries/${fut}`], ['DELETE', `/accounting/journal-entries/${fut}`], ['POST', `/accounting/journal-entries/${fut}/cancel`]]) {
  const rr = await a.raw(m, p, { body: m === 'PUT' ? { description: 'x' } : undefined });
  log(`route ${m} ${p}: ${rr.status}`);
}
// draft visibility in reports: create a draft and check TB/ledger
const d0 = (await a.post('/accounting/journal-entries', { description: 'draft only', lines: [{ accountId: id('1210'), debit: 777 }, { accountId: id('3100'), credit: 777 }] })).data;
const tb = (await a.get('/accounting/trial-balance')).data;
log('draft JE', d0?.id, 'TB 1210 balance (draft 7.77 must be excluded):', tb.find((t) => t.accountCode === '1210')?.balance);
const jl = (await a.get('/accounting/journal-entries?page=1&pageSize=100')).data;
log('journal list shows draft?', JSON.stringify(jl).includes('draft only'));
// cash negative check
log('GL 1111 balance now', E.bal('1111'), ' (D-14 guard applies to documents only?)');
log('invariants:', failing(E.checks()));
fs.writeFileSync(new URL('./02-manual-je.out.txt', import.meta.url), lines.join('\n'));
