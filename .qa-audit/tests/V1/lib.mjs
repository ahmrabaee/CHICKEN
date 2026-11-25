// V1 independent verification helpers (own code, not derived from T/K scripts).
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { DatabaseSync } from 'node:sqlite';
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });
export const PORT = Number(process.env.V1_PORT || 3115);
export const NAME = process.env.V1_ENV || 'v1';
export const BASE = `http://localhost:${PORT}/v1`;
export const DB = `E:/DEV/Chicken FMS/.qa-audit/envs/${NAME}/app.db`;
export { connect };
export function sql(s, ...p) {
  const db = new DatabaseSync(DB, { readOnly: true });
  try { return db.prepare(s).all(...p).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))); } finally { db.close(); }
}
export const one = (s, ...p) => sql(s, ...p)[0];
export const glOf = (code) => one(`select coalesce(sum(l.debit_amount),0)-coalesce(sum(l.credit_amount),0) b from journal_entry_lines l join accounts a on a.id=l.account_id join journal_entries e on e.id=l.journal_entry_id where a.code=? and e.is_posted=1`, code).b;
export const CODES = ['1111', '1112-001', '1120', '1125', '1131', '2110', '2120', '4110', '5100', '5400', '3100'];
export const snap = () => Object.fromEntries(CODES.map(c => [c, glOf(c)]));
export const delta = (a, b) => Object.fromEntries(CODES.map(c => [c, b[c] - a[c]]).filter(([, v]) => v !== 0));
export const lines = [];
export function say(k, v) { const l = `${k.padEnd(46)} ${typeof v === 'string' ? v : JSON.stringify(v)}`; console.log(l); lines.push(l); }
export const st = (r) => `${r.status}${r.ok ? '' : ' ' + JSON.stringify(r.body?.error?.code ?? r.body?.message ?? r.body).slice(0, 120)}`;
export async function admin() { return connect(BASE, 'admin', 'admin123'); }
let n = 0;
export async function newCustomer(a, label = 'V1') {
  const r = await a.post('/customers', { name: `${label}-${Date.now()}-${n++}`, phone: `059${String(Date.now()).slice(-7)}${n}`.slice(0, 10) });
  if (!r.ok) throw new Error('customer ' + st(r) + JSON.stringify(r.body));
  return r.data.id;
}
// restock: credit purchase to supplier 1 (no cash needed)
export async function buy(a, itemId, grams, pricePerKg, extra = {}) {
  const r = await a.post('/purchases', { supplierId: 1, lines: [{ itemId, weightGrams: grams, pricePerKg }], ...extra });
  if (!r.ok) throw new Error('purchase ' + st(r) + JSON.stringify(r.body));
  return r.data;
}
export const lotsOf = (itemId) => sql(`select id,remaining_quantity_grams rem,total_quantity_grams tot,unit_purchase_price cost from inventory_lots where item_id=? order by id`, itemId);
export const invOf = (itemId) => one(`select current_quantity_grams q,total_value v from inventory where item_id=?`, itemId);
export const saleRow = (id) => one(`select id,total_amount t,amount_paid p,payment_status ps,is_voided v,total_cost c,total_profit pr from sales where id=?`, id);
export const custBal = (id) => one(`select current_balance b from customers where id=?`, id).b;
export const fundCash = async (a, amt) => {
  // owner capital manual JE: DR cash / CR 3100
  const r = await a.post('/accounting/journal-entries', { entryDate: new Date().toISOString(), description: 'V1 capital', lines: [{ accountId: 4, debit: amt, credit: 0 }, { accountId: 21, debit: 0, credit: amt }] });
  return r;
};
