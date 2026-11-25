// T6 shared helpers: login, read-only SQL, own invariant checks, snapshots.
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
export { connect, request };

export const QA = 'E:/DEV/Chicken FMS/.qa-audit';
export function meta(name = 'r2') {
  return JSON.parse(fs.readFileSync(`${QA}/envs/${name}/meta.json`, 'utf8'));
}
export function q(dbFile, sql, ...params) {
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    return db.prepare(sql).all(...params).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])));
  } finally { db.close(); }
}
export function one(dbFile, sql, ...p) { return q(dbFile, sql, ...p)[0]; }

// GL balance per account code (posted only)
export function glBalance(db, code) {
  const r = one(db, `select coalesce(sum(l.debit_amount),0) d, coalesce(sum(l.credit_amount),0) c
    from journal_entry_lines l join journal_entries e on e.id=l.journal_entry_id join accounts a on a.id=l.account_id
    where e.is_posted=1 and (a.code=? or a.code like ?)`, code, code + '-%');
  return r.d - r.c;
}

export function glPrefix(db, p) {
  const r = one(db, `select coalesce(sum(l.debit_amount),0)-coalesce(sum(l.credit_amount),0) b from journal_entry_lines l
    join journal_entries e on e.id=l.journal_entry_id join accounts a on a.id=l.account_id where e.is_posted=1 and a.code like ?`, p + '%');
  return r.b;
}
// Own invariant set (T1 harness may supersede). Returns list of violations.
export function invariants(db) {
  const v = [];
  const push = (id, rows) => { if (rows.length) v.push({ id, n: rows.length, sample: rows.slice(0, 5) }); };
  push('JE-unbalanced', q(db, `select e.id,e.entry_number,e.source_type,e.source_id,sum(l.debit_amount) d,sum(l.credit_amount) c
     from journal_entries e join journal_entry_lines l on l.journal_entry_id=e.id group by e.id having d<>c`));
  push('lot-negative', q(db, `select id,item_id,lot_number,remaining_quantity_grams r from inventory_lots where remaining_quantity_grams<0 or remaining_quantity_grams>total_quantity_grams`));
  push('inv-negative', q(db, `select item_id,current_quantity_grams q,total_value v from inventory where current_quantity_grams<0 or total_value<0`));
  push('inv-vs-lots', q(db, `select i.item_id,i.current_quantity_grams q,(select coalesce(sum(remaining_quantity_grams),0) from inventory_lots l where l.item_id=i.item_id) lots
     from inventory i where i.current_quantity_grams <> (select coalesce(sum(remaining_quantity_grams),0) from inventory_lots l where l.item_id=i.item_id)`));
  push('sale-paid-gt-total', q(db, `select id,sale_number,total_amount,amount_paid from sales where amount_paid>total_amount+1`));
  push('sale-paid-vs-payments', q(db, `select s.id,s.sale_number,s.amount_paid,s.is_voided,(select coalesce(sum(amount),0) from payments p where p.reference_type='sale' and p.reference_id=s.id and p.is_voided=0) pays
     from sales s where s.sale_number not like 'SAL-SEED%' and s.is_voided=0 and s.amount_paid <> (select coalesce(sum(amount),0) from payments p where p.reference_type='sale' and p.reference_id=s.id and p.is_voided=0)`));
  push('dup-JE-per-source', q(db, `select source_type,source_id,count(*) n from journal_entries where source_type in ('sale','purchase','expense','wastage','adjustment','payment','sale_void','void') group by source_type,source_id having n>1`));
  push('debt-overpaid', q(db, `select id,debt_number,total_amount,amount_paid,status from debts where amount_paid>total_amount or amount_paid<0`));
  push('cust-balance-vs-debts', q(db, `select c.id,c.current_balance bal,(select coalesce(sum(total_amount-amount_paid),0) from debts d where d.party_type='customer' and d.party_id=c.id and d.direction='receivable' and d.status in ('open','partial','overdue')) open
     from customers c where c.current_balance <> (select coalesce(sum(total_amount-amount_paid),0) from debts d where d.party_type='customer' and d.party_id=c.id and d.direction='receivable' and d.status in ('open','partial','overdue'))`));
  push('sale-without-JE', q(db, `select s.id,s.sale_number from sales s where s.sale_number not like 'SAL-SEED%' and not exists (select 1 from journal_entries e where e.source_type='sale' and e.source_id=s.id)`));
  push('JE-orphan-sale', q(db, `select e.id,e.entry_number,e.source_id from journal_entries e where e.source_type='sale' and not exists (select 1 from sales s where s.id=e.source_id)`));
  push('sale-without-lines', q(db, `select s.id,s.sale_number from sales s where not exists (select 1 from sale_lines l where l.sale_id=s.id)`));
  push('dup-numbers-sales', q(db, `select sale_number,count(*) n from sales group by sale_number having n>1`));
  return v;
}

export function snapshot(db) {
  return {
    cash: glBalance(db, '1111'), ar: glBalance(db, '1120'), inv: glBalance(db, '1131'), ap: glBalance(db, '2110'),
    rev: -glPrefix(db, '41'), cogs: glBalance(db, '5100'),
    sales: one(db, 'select count(*) n from sales').n, payments: one(db, 'select count(*) n from payments').n,
    je: one(db, 'select count(*) n from journal_entries').n,
  };
}
export function delta(a, b) { const o = {}; for (const k of Object.keys(a)) if (a[k] !== b[k]) o[k] = b[k] - a[k]; return o; }

// Output tee
export function tee(file) {
  const lines = [];
  const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); lines.push(s); console.log(s); };
  log.save = () => fs.writeFileSync(file, lines.join('\n') + '\n');
  return log;
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
import { fileURLToPath } from 'node:url';
export function outFor(metaUrl, suffix = '') { return fileURLToPath(metaUrl).replace(/\.mjs$/, suffix + '.out.txt'); }
