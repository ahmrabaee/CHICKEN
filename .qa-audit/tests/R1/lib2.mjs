// R1 additions on top of lib.mjs
import { gl, q, q1, must, log, logLines } from './lib.mjs';
import { writeFileSync } from 'node:fs';
export * from './lib.mjs';
export const CODES2 = ['1111','1112-001','1120','1125','1131','1132','2110','2120','3100','4110','4900','5100','5300','5320','5400'];
export const glx = (db) => { const g = gl(db); const o = {}; for (const k of CODES2) o[k] = g[k] ?? 0; return o; };
export const dl = (a, b) => { const o = {}; for (const k of CODES2) { const d = (b[k] ?? 0) - (a[k] ?? 0); if (d) o[k] = d; } return o; };
export function jeCheck(db) {
  return q(db, `select e.id, e.entry_number n, sum(l.debit_amount) d, sum(l.credit_amount) c from journal_entries e join journal_entry_lines l on l.journal_entry_id=e.id group by e.id having d<>c`);
}
export async function newCust(c, tag) {
  const r = await c.post('/customers', { name: `R1 ${tag}`, phone: `0599${Date.now() % 10000000}${Math.floor(Math.random() * 90 + 10)}` });
  return must(r, 'cust').id;
}
export const L = (itemId, weightGrams, pricePerKg, extra = {}) => ({ itemId, weightGrams, pricePerKg, ...extra });
export const errc = (r) => (r.ok ? 'OK' : `${r.status} ${r.body?.error?.code ?? r.body?.message ?? JSON.stringify(r.body).slice(0, 160)}`);
export const saveLog = (name) => writeFileSync(`E:/DEV/Chicken FMS/.qa-audit/tests/R1/${name}.out.txt`, logLines.join('\n'));
export async function bankId(c, db) {
  let b = q1(db, 'select id from bank_accounts limit 1');
  if (b) return b.id;
  const accId = q1(db, "select id from accounts where code='1112-001'").id;
  return must(await c.post('/bank-accounts', { name: 'R1 bank', accountId: accId, isDefault: true }), 'bank').id;
}
