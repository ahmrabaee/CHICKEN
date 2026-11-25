// T2 shared helpers: instance mgmt, API, DB snapshots, inventory/GL invariants.
import { execFileSync } from 'node:child_process';
import { connect } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });
const { DatabaseSync } = await import('node:sqlite');

export const QA = 'E:/DEV/Chicken FMS/.qa-audit';

export function resetInstance(name, port, profile = 'dev') {
  let out;
  for (let i = 0; i < 6; i++) {
    try { out = execFileSync('node', [`${QA}/harness/instance.mjs`, 'reset', name, String(port), profile], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); break; }
    catch (e) { if (i === 5) throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000); }
  }
  const m = out.match(/ready (\{.*\})/);
  if (!m) throw new Error('instance reset failed: ' + out);
  return JSON.parse(m[1]);
}

export async function setup(name = 'r1', port = 3123, { reset = true } = {}) {
  const info = reset ? resetInstance(name, port) : { baseUrl: `http://localhost:${port}/v1`, db: `${QA}/envs/${name}/app.db` };
  const c = await connect(info.baseUrl, 'admin', 'admin123');
  const db = new DatabaseSync(info.db, { readOnly: true });
  return { c, db, info };
}

export const q = (db, sql, ...p) => db.prepare(sql).all(...p);
export const q1 = (db, sql, ...p) => db.prepare(sql).get(...p);

let logLines = [];
export function log(...a) {
  const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  console.log(s);
  logLines.push(s);
}

export function must(r, label) {
  if (!r.ok) { log(`!! ${label} FAILED ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`); throw new Error(label); }
  return r.data;
}

// GL balance (debit - credit) by account code, posted + unposted separately
export function gl(db) {
  const rows = q(db, `SELECT a.code, SUM(l.debit_amount - l.credit_amount) AS bal
    FROM journal_entry_lines l JOIN journal_entries j ON j.id=l.journal_entry_id JOIN accounts a ON a.id=l.account_id
    WHERE j.is_posted=1 GROUP BY a.code`);
  const o = {};
  for (const r of rows) o[r.code] = r.bal;
  return o;
}
export function glDelta(before, after, codes = ['1111', '1120', '1130', '1131', '1132', '2110', '4110', '5100', '5300', '5320', '5400', '4200']) {
  const o = {};
  for (const k of codes) { const d = (after[k] ?? 0) - (before[k] ?? 0); if (d) o[k] = d; }
  return o;
}

// Per-item view of every inventory representation
export function itemView(db, itemId) {
  const inv = q1(db, 'SELECT current_quantity_grams qty, total_value val, average_cost avg FROM inventory WHERE item_id=?', itemId) ?? { qty: null, val: null, avg: null };
  const lots = q(db, 'SELECT id, lot_number, total_quantity_grams tot, remaining_quantity_grams rem, unit_purchase_price price, received_at, expiry_date FROM inventory_lots WHERE item_id=? ORDER BY id', itemId);
  const lotQty = lots.reduce((s, l) => s + l.rem, 0);
  const lotVal = lots.reduce((s, l) => s + Math.round((l.rem * l.price) / 1000), 0);
  const sle = q1(db, 'SELECT COALESCE(SUM(qty_change),0) q, COALESCE(SUM(stock_value_difference),0) v FROM stock_ledger_entries WHERE item_id=?', itemId);
  const mov = q1(db, 'SELECT COALESCE(SUM(quantity_grams),0) q FROM stock_movements WHERE item_id=?', itemId);
  return { itemId, invQty: inv.qty, invVal: inv.val, avg: inv.avg, lotQty, lotVal, sleQty: sle.q, sleVal: sle.v, movQty: mov.q, lots: lots.map((l) => `${l.id}:${l.lot_number}:${l.rem}/${l.tot}@${l.price}`) };
}
export function itemCheck(v) {
  const issues = [];
  if (v.invQty !== v.lotQty) issues.push(`invQty ${v.invQty} != lotQty ${v.lotQty}`);
  if (v.invVal !== v.lotVal) issues.push(`invVal ${v.invVal} != lotVal ${v.lotVal}`);
  if (v.sleQty !== v.invQty) issues.push(`sleQty ${v.sleQty} != invQty ${v.invQty}`);
  if (v.sleVal !== v.invVal) issues.push(`sleVal ${v.sleVal} != invVal ${v.invVal}`);
  if (v.movQty !== v.invQty) issues.push(`movQty ${v.movQty} != invQty ${v.invQty}`);
  return issues;
}
export function showItem(db, itemId, label = '') {
  const v = itemView(db, itemId);
  const iss = itemCheck(v);
  log(`  [item ${itemId}${label ? ' ' + label : ''}] inv ${v.invQty}g/${v.invVal} avg ${v.avg} | lots ${v.lotQty}g/${v.lotVal} | SLE ${v.sleQty}g/${v.sleVal} | mov ${v.movQty}g | lots=${v.lots.join(' ')}${iss.length ? '  <<' + iss.join('; ') : '  OK'}`);
  return v;
}

let seq = 0;
export async function newItem(c, { name, categoryId = 3, sale = 3000, purchase = 2000, shelf = null, extra = {} } = {}) {
  seq++;
  const code = `T2-${Date.now().toString(36)}-${seq}`;
  const r = await c.post('/items', { code, name: name ?? `T2 item ${seq}`, categoryId, defaultSalePrice: sale, defaultPurchasePrice: purchase, ...(shelf ? { shelfLifeDays: shelf } : {}), ...extra });
  return must(r, 'create item');
}
export async function purchase(c, lines, extra = {}) {
  const r = await c.post('/purchases', { supplierId: 1, lines, amountPaid: 0, paymentMethod: 'credit', ...extra });
  return must(r, 'purchase');
}
export async function sale(c, lines, { cash = true, ...extra } = {}) {
  // compute total to pay in cash
  const total = lines.reduce((s, l) => s + Math.round((l.weightGrams / 1000) * l.pricePerKg), 0);
  const body = { saleType: 'cash', lines, payments: cash ? [{ amount: total, paymentMethod: 'cash' }] : [], ...extra };
  return c.post('/sales', body);
}
export function saveOut(file) {
  // caller writes logLines
  return logLines.join('\n');
}

export { logLines };
