// T1 shared helpers
import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { openDb, snapshot, diff, formatDiff, runChecks } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/invariants.mjs';
import { DatabaseSync } from 'node:sqlite';
export { connect, request, snapshot, diff, formatDiff, runChecks, openDb };

export function env(name, port) {
  const DB = `E:/DEV/Chicken FMS/.qa-audit/envs/${name}/app.db`;
  const BASE = `http://localhost:${port}/v1`;
  const q = (sql, ...p) => { const db = new DatabaseSync(DB, { readOnly: true }); try { return db.prepare(sql).all(...p.map((x) => (x === undefined ? null : x))).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))); } finally { db.close(); } };
  const w = (sql, ...p) => { const db = new DatabaseSync(DB); try { return db.prepare(sql).run(...p); } finally { db.close(); } };
  const snap = () => { const db = openDb(DB); try { return snapshot(db); } finally { db.close(); } };
  const checks = (o) => { const db = openDb(DB); try { return runChecks(db, o); } finally { db.close(); } };
  const acctId = (code) => q(`select id from accounts where code=?`, code)[0]?.id;
  const bal = (code) => q(`select coalesce(sum(l.debit_amount),0)-coalesce(sum(l.credit_amount),0) b from journal_entry_lines l join accounts a on a.id=l.account_id join journal_entries e on e.id=l.journal_entry_id where a.code=? and e.is_posted=1`, code)[0].b;
  return { DB, BASE, q, w, snap, checks, acctId, bal };
}

export function logger() {
  const lines = [];
  const log = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); lines.push(s); console.log(s); };
  return { log, lines };
}
export const err = (r) => (r.ok ? '' : JSON.stringify(r.body?.error ?? r.body).slice(0, 300));
export const failing = (res) => res.filter((r) => r.status === 'FAIL').map((r) => `${r.id}:${typeof r.actual === 'object' ? JSON.stringify(r.actual) : r.actual ?? ''}${r.diff ? ' diff=' + r.diff : ''}`);
