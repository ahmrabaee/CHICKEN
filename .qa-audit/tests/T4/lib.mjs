// T4 shared helpers: instance connect, DB snapshots, deltas, logging.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
process.removeAllListeners('warning');
process.on('warning', () => {});

export const QA = 'E:/DEV/Chicken FMS/.qa-audit';
export function meta(name = 't4a') {
  return JSON.parse(fs.readFileSync(`${QA}/envs/${name}/meta.json`, 'utf8'));
}
export async function login(name = 't4a', user = 'admin', pass = 'admin123') {
  const m = meta(name);
  const c = await connect(m.baseUrl, user, pass);
  c.meta = m;
  return c;
}
export function q(dbFile, sql, ...params) {
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try { return db.prepare(sql).all(...params).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))); }
  finally { db.close(); }
}
export function q1(dbFile, sql, ...params) { return q(dbFile, sql, ...params)[0]; }

// GL balance (debit - credit) per account code, posted only
export function gl(dbFile) {
  const rows = q(dbFile, `select a.code, coalesce(sum(l.debit_amount),0) d, coalesce(sum(l.credit_amount),0) c
    from journal_entry_lines l join journal_entries j on j.id=l.journal_entry_id join accounts a on a.id=l.account_id
    where j.is_posted=1 group by a.code`);
  const o = {};
  for (const r of rows) o[r.code] = r.d - r.c;
  return o;
}
export function snapshot(dbFile) {
  const s = { gl: gl(dbFile) };
  s.suppliers = Object.fromEntries(q(dbFile, 'select id, current_balance b from suppliers').map((r) => [r.id, r.b]));
  s.payDebt = Object.fromEntries(q(dbFile, `select party_id id, sum(total_amount-amount_paid) o from debts where direction='payable' and status not in ('written_off') group by party_id`).map((r) => [r.id ?? 'null', r.o]));
  s.plePay = Object.fromEntries(q(dbFile, `select party_id id, sum(amount) a from payment_ledger_entries where party_type='supplier' and delinked=0 group by party_id`).map((r) => [r.id, r.a]));
  s.invQty = q1(dbFile, 'select coalesce(sum(current_quantity_grams),0) q, coalesce(sum(total_value),0) v from inventory');
  s.lots = q1(dbFile, 'select coalesce(sum(remaining_quantity_grams),0) q, coalesce(sum(round(remaining_quantity_grams*unit_purchase_price/1000.0)),0) v from inventory_lots');
  s.sle = q1(dbFile, 'select coalesce(sum(qty_change),0) q, coalesce(sum(stock_value_difference),0) v from stock_ledger_entries');
  s.je = q1(dbFile, 'select count(*) n from journal_entries').n;
  s.tb = q1(dbFile, 'select coalesce(sum(debit_amount),0) d, coalesce(sum(credit_amount),0) c from journal_entry_lines l join journal_entries j on j.id=l.journal_entry_id where j.is_posted=1');
  return s;
}
function diffObj(a = {}, b = {}) {
  const o = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = (b[k] ?? 0) - (a[k] ?? 0);
    if (d !== 0) o[k] = d;
  }
  return o;
}
export function delta(a, b) {
  return {
    gl: diffObj(a.gl, b.gl),
    suppliers: diffObj(a.suppliers, b.suppliers),
    payDebt: diffObj(a.payDebt, b.payDebt),
    plePay: diffObj(a.plePay, b.plePay),
    inv: { q: b.invQty.q - a.invQty.q, v: b.invQty.v - a.invQty.v },
    lots: { q: b.lots.q - a.lots.q, v: b.lots.v - a.lots.v },
    sle: { q: b.sle.q - a.sle.q, v: b.sle.v - a.sle.v },
    je: b.je - a.je,
    tbBalanced: b.tb.d === b.tb.c,
  };
}
export function makeLog(file) {
  const lines = [];
  const log = (...a) => {
    const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    lines.push(s);
    console.log(s);
  };
  log.save = () => fs.writeFileSync(file, lines.join('\n') + '\n');
  return log;
}
export function short(r) {
  return { status: r.status, ...(r.ok ? {} : { err: r.body?.error?.code ?? r.body?.message ?? r.body }) };
}
// Inject cash into 1111 (and optionally a bank GL account) via manual JE against capital 3100 + post.
export async function fund(c, dbFile, amount, accountCode = "1111", entryDate = new Date().toISOString()) {
  const acc = q1(dbFile, 'select id from accounts where code=?', accountCode);
  const cap = q1(dbFile, "select id from accounts where code='3100'");
  const r = await c.post('/accounting/journal-entries', {
    description: "QA T4 funding", entryDate,
    lines: [{ accountId: acc.id, debit: amount, credit: 0 }, { accountId: cap.id, debit: 0, credit: amount }],
  });
  if (!r.ok) throw new Error('fund JE failed ' + JSON.stringify(r.body));
  const id = r.data.id;
  const p = await c.post(`/accounting/journal-entries/${id}/post`);
  if (!p.ok && p.body?.error?.code !== 'ALREADY_POSTED') throw new Error('post JE failed ' + JSON.stringify(p.body));
  return id;
}
