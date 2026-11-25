// Shared GL / subledger invariant checker (T1).
//
// CLI:
//   node harness/invariants.mjs <db-file> [--json] [--exclude-seed] [--only=ID,ID] [--verbose]
//   node harness/invariants.mjs <db-file> --snapshot=<out.json>        (write snapshot)
//   node harness/invariants.mjs --diff <a.json|a.db> <b.json|b.db> [--json]
// Exit code: 0 = no FAIL, 1 = at least one FAIL, 2 = usage error.
//
// Library:
//   import { openDb, runChecks, snapshot, diff, formatDiff } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/invariants.mjs';
//   const db = openDb(dbPath);            // read-only DatabaseSync
//   const before = snapshot(db);          // plain JSON object
//   ... do API calls ...
//   const after = snapshot(openDb(dbPath));
//   console.log(formatDiff(diff(before, after)));   // GL deltas per account + subledger deltas
//   const res = runChecks(db, { excludeSeed: true });  // [{id,status,title,expected,actual,diff,details}]
//
// Conventions (verified against seeded chart, baseline & dev golden DBs, 2026-11-25):
//   money = integer minor units (x100), weight = grams, lot price = minor units per kg.
//   Accounts are identified by account_type, NOT hard-coded ids:
//     cash      = account_type 'Cash' leaf (1111) ; bank = bank_accounts.account_id (+ any 'Bank' leaf)
//     AR        = account_type 'Receivable' (1120) ; AP = account_type 'Payable' (2110)
//     inventory = account_type 'Stock' leaves (1131,1132) + branches.stock_account_id
//   GL balances use POSTED entries only (is_posted=1); unposted (draft manual) JEs are reported separately.
//   Statuses: PASS | FAIL (invariant violated) | WARN (heuristic / known-by-design divergence) | INFO.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.error(w); });

const n = (v) => (v === null || v === undefined ? 0 : typeof v === 'bigint' ? Number(v) : Number(v));
const fmt = (v) => (Math.round(n(v)) / 100).toFixed(2);

export function openDb(file) {
  return new DatabaseSync(file, { readOnly: true });
}

function all(db, sql, ...p) {
  return db.prepare(sql).all(...p).map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[k] = typeof v === 'bigint' ? Number(v) : v;
    return o;
  });
}
function one(db, sql, ...p) { return all(db, sql, ...p)[0] || {}; }
function hasTable(db, t) { return !!one(db, `select name from sqlite_master where type='table' and name=?`, t).name; }

// ---------- core extraction ----------
export function accountBalances(db, { postedOnly = true, asOf = null } = {}) {
  const where = [];
  if (postedOnly) where.push('je.is_posted = 1');
  if (asOf !== null) where.push(`je.entry_date <= ${Number(asOf)}`);
  const rows = all(db, `
    select a.id, a.code, a.name_en, a.root_type, a.account_type, a.is_group, a.is_active, a.parent_id,
           coalesce(sum(l.debit_amount),0) dr, coalesce(sum(l.credit_amount),0) cr
    from accounts a
    left join journal_entry_lines l on l.account_id = a.id
      and l.journal_entry_id in (select je.id from journal_entries je ${where.length ? 'where ' + where.join(' and ') : ''})
    group by a.id order by a.code`);
  for (const r of rows) {
    r.net = r.dr - r.cr; // debit-positive
    r.normal = ['Asset', 'Expense'].includes(r.root_type) ? r.net : -r.net; // natural-sign balance
  }
  return rows;
}

function accountSets(db) {
  const accts = all(db, `select id, code, account_type, root_type, is_group from accounts`);
  const byType = (t) => accts.filter((a) => a.account_type === t && !a.is_group).map((a) => a.id);
  const bankIds = hasTable(db, 'bank_accounts') ? all(db, `select account_id from bank_accounts where account_id is not null`).map((r) => r.account_id) : [];
  const branchStock = all(db, `select stock_account_id from branches where stock_account_id is not null`).map((r) => r.stock_account_id);
  const uniq = (a) => [...new Set(a)];
  return {
    accts,
    cash: byType('Cash'),
    bank: uniq([...bankIds, ...byType('Bank')]),
    ar: byType('Receivable'),
    ap: byType('Payable'),
    stock: uniq([...byType('Stock'), ...branchStock]),
    taxPay: byType('Tax'),
    taxRec: byType('Tax Receivable'),
  };
}
const sumNet = (bal, ids) => bal.filter((b) => ids.includes(b.id)).reduce((s, b) => s + b.net, 0);

function lotValue(db) {
  // value per lot rounded per lot, consistent with how the app values slices
  return all(db, `select item_id, branch_id, sum(remaining_quantity_grams) q,
     sum(round(remaining_quantity_grams * unit_purchase_price / 1000.0)) v
     from inventory_lots group by item_id, branch_id`);
}

// ---------- snapshot / diff ----------
export function snapshot(db) {
  const bal = accountBalances(db);
  const S = accountSets(db);
  const t = (sql) => n(one(db, sql).v);
  const counts = {};
  for (const tb of ['journal_entries', 'journal_entry_lines', 'sales', 'sale_lines', 'purchases', 'payments', 'expenses', 'debts',
    'payment_ledger_entries', 'inventory_lots', 'stock_movements', 'stock_ledger_entries', 'wastage_records', 'stock_transfers',
    'credit_notes', 'payment_allocations', 'customers', 'suppliers', 'accounts', 'audit_logs']) {
    if (hasTable(db, tb)) counts[tb] = t(`select count(*) v from ${tb}`);
  }
  const lots = lotValue(db);
  const invRows = all(db, `select i.item_id, i.branch_id, i.current_quantity_grams q, i.total_value v, it.code from inventory i left join items it on it.id=i.item_id`);
  const items = {};
  for (const r of invRows) items[`${r.item_id}@${r.branch_id ?? '-'}`] = { code: r.code, qty: r.q, value: r.v };
  for (const l of lots) {
    const k = `${l.item_id}@${l.branch_id ?? '-'}`;
    items[k] = items[k] || { qty: 0, value: 0 };
    items[k].lotQty = l.q; items[k].lotValue = l.v;
  }
  return {
    takenAt: new Date().toISOString(),
    accounts: Object.fromEntries(bal.map((b) => [b.code, { dr: b.dr, cr: b.cr, net: b.net, name: b.name_en, root: b.root_type }])),
    unposted: t(`select count(*) v from journal_entries where is_posted = 0`),
    metrics: {
      gl_cash: sumNet(bal, S.cash), gl_bank: sumNet(bal, S.bank), gl_ar: sumNet(bal, S.ar), gl_ap: -sumNet(bal, S.ap),
      gl_inventory: sumNet(bal, S.stock),
      gl_total_dr: bal.reduce((s, b) => s + b.dr, 0), gl_total_cr: bal.reduce((s, b) => s + b.cr, 0),
      customers_balance: t(`select sum(current_balance) v from customers`),
      suppliers_balance: t(`select sum(current_balance) v from suppliers`),
      debts_receivable_open: t(`select sum(total_amount - amount_paid) v from debts where direction='receivable' and status not in ('paid','written_off','cancelled')`),
      debts_payable_open: t(`select sum(total_amount - amount_paid) v from debts where direction='payable' and status not in ('paid','written_off','cancelled')`),
      ple_customer: t(`select sum(amount) v from payment_ledger_entries where party_type='customer' and delinked=0`),
      ple_supplier: t(`select sum(amount) v from payment_ledger_entries where party_type='supplier' and delinked=0`),
      inventory_qty: t(`select sum(current_quantity_grams) v from inventory`),
      inventory_value: t(`select sum(total_value) v from inventory`),
      lots_qty: t(`select sum(remaining_quantity_grams) v from inventory_lots`),
      lots_value: lots.reduce((s, l) => s + n(l.v), 0),
      sle_value: hasTable(db, 'stock_ledger_entries') ? t(`select sum(stock_value_difference) v from stock_ledger_entries`) : 0,
      sle_qty: hasTable(db, 'stock_ledger_entries') ? t(`select sum(qty_change) v from stock_ledger_entries`) : 0,
    },
    items,
    counts,
  };
}

function loadSnap(x) {
  if (typeof x !== 'string') return x;
  if (x.endsWith('.json')) return JSON.parse(fs.readFileSync(x, 'utf8'));
  const db = openDb(x); const s = snapshot(db); db.close(); return s;
}

export function diff(a, b) {
  a = loadSnap(a); b = loadSnap(b);
  const accounts = {};
  for (const code of new Set([...Object.keys(a.accounts), ...Object.keys(b.accounts)])) {
    const x = a.accounts[code] || { dr: 0, cr: 0, net: 0 }, y = b.accounts[code] || { dr: 0, cr: 0, net: 0 };
    const d = { dr: y.dr - x.dr, cr: y.cr - x.cr, net: y.net - x.net };
    if (d.dr || d.cr) accounts[code] = { ...d, name: (y.name || x.name) };
  }
  const metrics = {};
  for (const k of new Set([...Object.keys(a.metrics), ...Object.keys(b.metrics)])) {
    const d = n(b.metrics[k]) - n(a.metrics[k]);
    if (d) metrics[k] = d;
  }
  const items = {};
  for (const k of new Set([...Object.keys(a.items || {}), ...Object.keys(b.items || {})])) {
    const x = a.items[k] || {}, y = b.items[k] || {};
    const d = {};
    for (const f of ['qty', 'value', 'lotQty', 'lotValue']) { const v = n(y[f]) - n(x[f]); if (v) d[f] = v; }
    if (Object.keys(d).length) items[k] = { code: y.code || x.code, ...d };
  }
  const counts = {};
  for (const k of new Set([...Object.keys(a.counts), ...Object.keys(b.counts)])) {
    const d = n(b.counts[k]) - n(a.counts[k]); if (d) counts[k] = d;
  }
  const totalDr = Object.values(accounts).reduce((s, v) => s + v.dr, 0);
  const totalCr = Object.values(accounts).reduce((s, v) => s + v.cr, 0);
  return { accounts, metrics, items, counts, balanced: totalDr === totalCr, totalDr, totalCr };
}

export function formatDiff(d) {
  const out = [];
  out.push(`GL delta: Dr ${fmt(d.totalDr)} / Cr ${fmt(d.totalCr)} ${d.balanced ? '(balanced)' : '** UNBALANCED **'}`);
  for (const [code, v] of Object.entries(d.accounts)) out.push(`  ${code.padEnd(9)} ${String(v.name).padEnd(26)} Dr ${fmt(v.dr).padStart(12)} Cr ${fmt(v.cr).padStart(12)} net ${fmt(v.net).padStart(12)}`);
  if (Object.keys(d.metrics).length) out.push('Metric deltas (money in currency units, qty in grams):');
  for (const [k, v] of Object.entries(d.metrics)) out.push(`  ${k.padEnd(24)} ${/qty/.test(k) ? v + ' g' : fmt(v)}`);
  if (Object.keys(d.items).length) out.push('Item deltas:');
  for (const [k, v] of Object.entries(d.items)) out.push(`  ${k} ${v.code ?? ''} ${JSON.stringify(v)}`);
  if (Object.keys(d.counts).length) out.push('Row count deltas: ' + JSON.stringify(d.counts));
  return out.join('\n');
}

// ---------- checks ----------
export function runChecks(db, opts = {}) {
  const { excludeSeed = false } = opts;
  const seed = (col) => (excludeSeed ? ` and coalesce(${col},'') not like '%SEED%'` : '');
  const R = [];
  const add = (id, title, status, extra = {}) => R.push({ id, title, status, ...extra });
  const bal = accountBalances(db);
  const S = accountSets(db);
  const acct = Object.fromEntries(S.accts.map((a) => [a.id, a]));
  const codeOf = (ids) => ids.map((i) => acct[i]?.code).join(',');

  // GL-01 every JE balanced
  const unbal = all(db, `select je.id, je.entry_number, je.source_type, je.source_id, sum(l.debit_amount) dr, sum(l.credit_amount) cr
     from journal_entries je join journal_entry_lines l on l.journal_entry_id = je.id group by je.id having dr <> cr`);
  add('GL-01', 'Every journal entry balanced (Σdr = Σcr per JE)', unbal.length ? 'FAIL' : 'PASS',
    { actual: `${unbal.length} unbalanced`, details: unbal.slice(0, 20) });

  // GL-02 JE structure: empty JEs, <2 lines, zero-value, both-sided or negative lines
  const empty = all(db, `select je.id, je.entry_number, je.source_type, count(l.id) nl, coalesce(sum(l.debit_amount),0) dr
     from journal_entries je left join journal_entry_lines l on l.journal_entry_id = je.id group by je.id having nl < 2 or dr = 0`);
  const badLines = all(db, `select l.id, l.journal_entry_id, l.debit_amount, l.credit_amount from journal_entry_lines l
     where l.debit_amount < 0 or l.credit_amount < 0 or (l.debit_amount > 0 and l.credit_amount > 0) or (l.debit_amount = 0 and l.credit_amount = 0)`);
  add('GL-02', 'JE structure: ≥2 lines, non-zero, no negative/two-sided/zero lines', empty.length || badLines.length ? 'FAIL' : 'PASS',
    { actual: `${empty.length} empty/zero JEs, ${badLines.length} bad lines`, details: { empty: empty.slice(0, 20), badLines: badLines.slice(0, 20) } });

  // GL-03 trial balance totals (posted)
  const tDr = bal.reduce((s, b) => s + b.dr, 0), tCr = bal.reduce((s, b) => s + b.cr, 0);
  add('GL-03', 'Trial balance: total debits = total credits (posted)', tDr === tCr ? 'PASS' : 'FAIL',
    { expected: fmt(tDr), actual: fmt(tCr), diff: fmt(tDr - tCr) });

  // GL-04 lines on group / inactive / frozen accounts
  const grp = all(db, `select l.id, je.entry_number, a.code, a.is_group, a.is_active, a.freeze_account from journal_entry_lines l
     join journal_entries je on je.id=l.journal_entry_id join accounts a on a.id = l.account_id
     where a.is_group = 1 or a.is_active = 0 or coalesce(a.freeze_account,0) = 1`);
  add('GL-04', 'No JE line on group / inactive / frozen account (I-04)', grp.length ? 'FAIL' : 'PASS',
    { actual: `${grp.length} lines`, details: grp.slice(0, 20) });

  // GL-05 balance sheet equation
  const by = (rt) => bal.filter((b) => b.root_type === rt).reduce((s, b) => s + b.normal, 0);
  const A = by('Asset'), L = by('Liability'), E = by('Equity'), I = by('Income'), X = by('Expense');
  const other = bal.filter((b) => !['Asset', 'Liability', 'Equity', 'Income', 'Expense'].includes(b.root_type) && (b.dr || b.cr));
  add('GL-05', 'Balance sheet: Assets = Liabilities + Equity + (Income − Expense)', A === L + E + (I - X) && !other.length ? 'PASS' : 'FAIL',
    { expected: fmt(A), actual: fmt(L + E + I - X), diff: fmt(A - (L + E + I - X)),
      details: { assets: fmt(A), liabilities: fmt(L), equity: fmt(E), income: fmt(I), expense: fmt(X), netIncome: fmt(I - X), unclassified: other.map((o) => o.code) } });

  // GL-06 unposted / draft
  const unposted = all(db, `select id, entry_number, source_type from journal_entries where is_posted = 0`);
  add('GL-06', 'Unposted (draft) JEs (excluded from balances above)', unposted.length ? 'INFO' : 'PASS', { actual: `${unposted.length}`, details: unposted.slice(0, 20) });

  // GL-07 reversals: reversal exactly mirrors original; no double reversal; flags consistent
  const revs = all(db, `select id, entry_number, source_id from journal_entries where source_type = 'reversal'`);
  const revIssues = [];
  const lineSig = (jeId) => all(db, `select account_id, sum(debit_amount) dr, sum(credit_amount) cr from journal_entry_lines where journal_entry_id=? group by account_id order by account_id`, jeId);
  const revCount = {};
  for (const r of revs) {
    revCount[r.source_id] = (revCount[r.source_id] || 0) + 1;
    const orig = one(db, `select id, is_reversed, reversed_by_entry_id from journal_entries where id = ?`, r.source_id);
    if (!orig.id) { revIssues.push({ reversal: r.entry_number, issue: 'original JE missing', source_id: r.source_id }); continue; }
    if (!orig.is_reversed) revIssues.push({ reversal: r.entry_number, issue: 'original not flagged is_reversed', orig: r.source_id });
    if (orig.reversed_by_entry_id && orig.reversed_by_entry_id !== r.id) revIssues.push({ reversal: r.entry_number, issue: `original reversed_by=${orig.reversed_by_entry_id}` });
    const a = lineSig(orig.id), b = lineSig(r.id);
    const ok = a.length === b.length && a.every((x, i) => x.account_id === b[i].account_id && (x.dr - x.cr) === -(b[i].dr - b[i].cr));
    if (!ok) revIssues.push({ reversal: r.entry_number, issue: 'not an exact mirror', orig: a, rev: b });
  }
  for (const [k, c] of Object.entries(revCount)) if (c > 1) revIssues.push({ original: Number(k), issue: `reversed ${c} times` });
  const flaggedNoRev = all(db, `select id, entry_number from journal_entries j where is_reversed = 1
     and not exists (select 1 from journal_entries r where r.source_type='reversal' and r.source_id = j.id)`);
  for (const f of flaggedNoRev) revIssues.push({ original: f.entry_number, issue: 'flagged is_reversed but no reversal JE' });
  add('GL-07', 'Reversals mirror originals exactly, at most once, flags consistent (I-06)', revIssues.length ? 'FAIL' : 'PASS',
    { actual: `${revs.length} reversals, ${revIssues.length} issues`, details: revIssues.slice(0, 20) });

  // GL-08 JE number uniqueness
  const dupJe = all(db, `select entry_number, count(*) c from journal_entries group by entry_number having c > 1`);
  add('GL-08', 'Journal entry numbers unique', dupJe.length ? 'FAIL' : 'PASS', { details: dupJe });

  // ---- AR ----
  const glAR = sumNet(bal, S.ar);
  const custBal = n(one(db, `select sum(current_balance) v from customers`).v);
  const debtAR = n(one(db, `select sum(total_amount - amount_paid) v from debts where direction='receivable' and status not in ('paid','written_off','cancelled')`).v);
  const pleAR = n(one(db, `select sum(amount) v from payment_ledger_entries where party_type='customer' and delinked=0`).v);
  const salesDue = n(one(db, `select sum(total_amount - amount_paid) v from sales where is_voided = 0 and coalesce(docstatus,1) <> 2 ${seed('sale_number')}`).v);
  const arVals = { gl_ar: glAR, customers_currentBalance: custBal, open_receivable_debts: debtAR, ple_customer: pleAR, sales_total_minus_paid: salesDue };
  const arSame = new Set(Object.values(arVals)).size === 1;
  add('AR-01', `GL AR (${codeOf(S.ar)}) = Σ customer.currentBalance = open receivable debts = PLE (I-29/I-31)`, arSame ? 'PASS' : 'FAIL',
    { expected: fmt(glAR), actual: Object.fromEntries(Object.entries(arVals).map(([k, v]) => [k, fmt(v)])),
      details: { note: 'sales_total_minus_paid includes walk-in due (≤1 minor) and is informational' } });
  // per-customer: currentBalance vs debts vs PLE
  const perCust = all(db, `select c.id, c.customer_number, c.name, c.current_balance bal,
      coalesce((select sum(total_amount-amount_paid) from debts d where d.direction='receivable' and d.party_type='customer' and d.party_id=c.id and d.status not in ('paid','written_off','cancelled')),0) debt,
      coalesce((select sum(amount) from payment_ledger_entries p where p.party_type='customer' and p.party_id=c.id and p.delinked=0),0) ple
      from customers c`).filter((r) => !(r.bal === r.debt && r.debt === r.ple));
  add('AR-02', 'Per customer: currentBalance = open debts = PLE balance', perCust.length ? 'FAIL' : 'PASS', { actual: `${perCust.length} customers differ`, details: perCust.slice(0, 20) });

  // ---- AP ----
  const glAP = -sumNet(bal, S.ap);
  const supBal = n(one(db, `select sum(current_balance) v from suppliers`).v);
  const debtAP = n(one(db, `select sum(total_amount - amount_paid) v from debts where direction='payable' and status not in ('paid','written_off','cancelled')`).v);
  const pleAP = -n(one(db, `select sum(amount) v from payment_ledger_entries where party_type='supplier' and delinked=0`).v);
  const purDue = n(one(db, `select sum(coalesce(grand_total,total_amount) - amount_paid) v from purchases where coalesce(docstatus,0) <> 2 ${seed('purchase_number')}`).v);
  const apVals = { gl_ap: glAP, suppliers_currentBalance: supBal, open_payable_debts: debtAP, ple_supplier_neg: pleAP, purchases_grand_minus_paid: purDue };
  add('AP-01', `GL AP (${codeOf(S.ap)}) = Σ supplier.currentBalance = open payable debts = −PLE (I-30)`, new Set(Object.values(apVals)).size === 1 ? 'PASS' : 'FAIL',
    { expected: fmt(glAP), actual: Object.fromEntries(Object.entries(apVals).map(([k, v]) => [k, fmt(v)])),
      details: { note: 'open_payable_debts also includes credit expenses (no PLE)' } });
  const perSup = all(db, `select s.id, s.supplier_number, s.name, s.current_balance bal,
      coalesce((select sum(total_amount-amount_paid) from debts d where d.direction='payable' and d.party_type='supplier' and d.party_id=s.id and d.status not in ('paid','written_off','cancelled')),0) debt,
      -coalesce((select sum(amount) from payment_ledger_entries p where p.party_type='supplier' and p.party_id=s.id and p.delinked=0),0) ple
      from suppliers s`).filter((r) => !(r.bal === r.debt && r.debt === r.ple));
  add('AP-02', 'Per supplier: currentBalance = open debts = −PLE balance', perSup.length ? 'FAIL' : 'PASS', { actual: `${perSup.length} suppliers differ`, details: perSup.slice(0, 20) });

  // debt sanity
  const badDebt = all(db, `select id, debt_number, direction, total_amount, amount_paid, status from debts
     where amount_paid < 0 or amount_paid > total_amount or total_amount < 0
        or (status='paid' and amount_paid <> total_amount) or (status in ('open','unpaid') and amount_paid <> 0)
        or (status='partial' and (amount_paid = 0 or amount_paid >= total_amount))`);
  add('DEBT-01', 'Debt rows sane: 0 ≤ paid ≤ total, status consistent (I-33)', badDebt.length ? 'FAIL' : 'PASS', { details: badDebt.slice(0, 20) });

  // ---- Inventory ----
  const glInv = sumNet(bal, S.stock);
  const invVal = n(one(db, `select sum(total_value) v from inventory`).v);
  const lots = lotValue(db);
  const lotVal = lots.reduce((s, l) => s + n(l.v), 0);
  const sleVal = hasTable(db, 'stock_ledger_entries') ? n(one(db, `select sum(stock_value_difference) v from stock_ledger_entries`).v) : null;
  const invVals = { gl_inventory: glInv, inventory_totalValue: invVal, lots_remaining_x_cost: lotVal, stock_ledger_value: sleVal };
  add('INV-01', `GL inventory (${codeOf(S.stock)}) = Σ inventory.totalValue = Σ lot remaining×cost = SLE value (I-14/I-16)`,
    new Set(Object.values(invVals)).size === 1 ? 'PASS' : 'FAIL',
    { expected: fmt(glInv), actual: Object.fromEntries(Object.entries(invVals).map(([k, v]) => [k, v === null ? null : fmt(v)])) });
  // per item qty & value
  const perItem = all(db, `select i.item_id, it.code, i.branch_id, i.current_quantity_grams q, i.total_value v,
      coalesce((select sum(remaining_quantity_grams) from inventory_lots l where l.item_id=i.item_id and (l.branch_id = i.branch_id or l.branch_id is null or i.branch_id is null)),0) lq,
      coalesce((select sum(round(remaining_quantity_grams*unit_purchase_price/1000.0)) from inventory_lots l where l.item_id=i.item_id and (l.branch_id = i.branch_id or l.branch_id is null or i.branch_id is null)),0) lv
      from inventory i left join items it on it.id = i.item_id`);
  const qtyMis = perItem.filter((r) => r.q !== r.lq);
  const valMis = perItem.filter((r) => Math.abs(r.v - r.lv) > 1);
  add('INV-02', 'Per item: inventory qty = Σ lot remaining (I-15)', qtyMis.length ? 'FAIL' : 'PASS', { actual: `${qtyMis.length} items`, details: qtyMis.slice(0, 20) });
  add('INV-03', 'Per item: inventory.totalValue = Σ lot value (±1) (I-16)', valMis.length ? 'FAIL' : 'PASS', { actual: `${valMis.length} items`, details: valMis.slice(0, 20) });
  const lotsOrphanItem = all(db, `select l.item_id, sum(l.remaining_quantity_grams) q from inventory_lots l where not exists (select 1 from inventory i where i.item_id=l.item_id) group by l.item_id having q <> 0`);
  if (lotsOrphanItem.length) add('INV-02b', 'Lots with stock for items without inventory row', 'FAIL', { details: lotsOrphanItem });
  // negatives
  const negInv = all(db, `select item_id, branch_id, current_quantity_grams, total_value from inventory where current_quantity_grams < 0 or total_value < 0`);
  const negLot = all(db, `select id, lot_number, item_id, remaining_quantity_grams, total_quantity_grams from inventory_lots where remaining_quantity_grams < 0 or remaining_quantity_grams > total_quantity_grams`);
  add('INV-04', 'No negative stock / lot remaining within [0, total] (I-17)', negInv.length || negLot.length ? 'FAIL' : 'PASS',
    { actual: `${negInv.length} inventory rows, ${negLot.length} lots`, details: { inventory: negInv, lots: negLot.slice(0, 20) } });
  // SLE qty per item vs inventory qty
  if (hasTable(db, 'stock_ledger_entries')) {
    const sleItem = all(db, `select i.item_id, i.current_quantity_grams q, coalesce((select sum(qty_change) from stock_ledger_entries s where s.item_id=i.item_id),0) sq from inventory i`).filter((r) => r.q !== r.sq);
    add('INV-05', 'Per item: Σ stock_ledger qty = inventory qty (I-19)', sleItem.length ? 'WARN' : 'PASS', { actual: `${sleItem.length} items`, details: sleItem.slice(0, 20) });
  }
  // sale cost allocations
  const costMis = all(db, `select s.id, s.sale_number, s.total_cost,
      coalesce((select sum(a.total_cost) from sale_lines sl join sale_line_cost_allocations a on a.sale_line_id=sl.id where sl.sale_id=s.id),0) alloc,
      coalesce((select sum(line_total_cost) from sale_lines sl where sl.sale_id=s.id),0) lines
      from sales s where 1=1 ${seed('s.sale_number')}`).filter((r) => r.total_cost !== r.alloc || r.alloc !== r.lines);
  add('INV-06', 'Sale totalCost = Σ line cost = Σ FIFO allocations (I-21)', costMis.length ? 'FAIL' : 'PASS', { actual: `${costMis.length} sales`, details: costMis.slice(0, 20) });

  // ---- Cash / bank ----
  const cashRows = [...S.cash, ...S.bank].map((id) => ({ code: acct[id]?.code, type: S.cash.includes(id) ? 'cash' : 'bank', balance: sumNet(bal, [id]) }));
  const negCash = cashRows.filter((r) => r.balance < 0);
  add('CASH-01', 'Cash/bank GL accounts never negative (I-36)', negCash.length ? 'FAIL' : 'PASS', { actual: cashRows.map((r) => `${r.code}=${fmt(r.balance)}`).join(' '), details: negCash });
  const onBankGroup = all(db, `select l.id, je.entry_number from journal_entry_lines l join journal_entries je on je.id=l.journal_entry_id join accounts a on a.id=l.account_id where a.account_type='Bank' and a.is_group=1`);
  if (onBankGroup.length) add('CASH-02', 'Postings to bank group account (I-37)', 'FAIL', { details: onBankGroup });
  // Document-derived cash: non-cancelled payments (customer in, supplier out) and paid expenses vs GL cash+bank from non-manual JEs
  const payActive = `coalesce(p.docstatus,1) <> 2 and coalesce(p.is_voided,0) = 0 ${seed('p.payment_number')}`;
  const payIn = n(one(db, `select sum(amount) v from payments p where ${payActive} and p.party_type='customer'`).v);
  const payOut = n(one(db, `select sum(amount) v from payments p where ${payActive} and p.party_type='supplier'`).v);
  const expPaid = n(one(db, `select sum(amount) v from expenses where coalesce(payment_method,'') not in ('credit','') and coalesce(docstatus,0) <> 2 ${seed('expense_number')}`).v);
  const docCash = payIn - payOut - expPaid;
  const manualIds = `(select id from journal_entries where is_posted=1 and (source_type is null or source_type in ('journal_entry','manual')))`;
  const manualCash = n(one(db, `select sum(debit_amount - credit_amount) v from journal_entry_lines where journal_entry_id in ${manualIds} and account_id in (${[...S.cash, ...S.bank, -1].join(',')})`).v);
  const glCashBank = sumNet(bal, [...S.cash, ...S.bank]);
  add('CASH-03', 'GL cash+bank (excl. manual JEs) = Σ active customer payments − supplier payments − paid expenses (heuristic)',
    glCashBank - manualCash === docCash ? 'PASS' : 'FAIL',
    { expected: fmt(docCash), actual: fmt(glCashBank - manualCash), diff: fmt(glCashBank - manualCash - docCash),
      details: { payIn: fmt(payIn), payOut: fmt(payOut), expensesPaid: fmt(expPaid), manualJeCash: fmt(manualCash) } });
  // per bank account: payments with bank_account_id vs bank GL
  if (hasTable(db, 'bank_accounts')) {
    const banks = all(db, `select b.id, b.code, b.account_id, a.code acode from bank_accounts b left join accounts a on a.id=b.account_id`);
    const perBank = banks.map((b) => {
      const pin = n(one(db, `select sum(amount) v from payments p where ${payActive} and p.bank_account_id=? and p.party_type='customer'`, b.id).v);
      const pout = n(one(db, `select sum(amount) v from payments p where ${payActive} and p.bank_account_id=? and p.party_type='supplier'`, b.id).v);
      const ex = n(one(db, `select sum(amount) v from expenses where bank_account_id=? and coalesce(payment_method,'') not in ('credit','') and coalesce(docstatus,0)<>2`, b.id).v);
      const man = n(one(db, `select sum(debit_amount - credit_amount) v from journal_entry_lines where journal_entry_id in ${manualIds} and account_id = ?`, b.account_id).v);
      return { bank: b.code, gl: b.acode, gl_balance_excl_manual: sumNet(bal, [b.account_id]) - man, docs: pin - pout - ex };
    }).filter((r) => r.gl_balance_excl_manual !== r.docs);
    add('CASH-04', 'Per bank account: GL (excl. manual) = payments/expenses routed to that bank', perBank.length ? 'FAIL' : 'PASS', { details: perBank });
  }

  // ---- Document <-> JE linkage ----
  const jeFor = (type) => `exists (select 1 from journal_entries je where je.source_type='${type}' and je.source_id = d.id)`;
  const missing = {
    sales: all(db, `select id, sale_number num from sales d where not ${jeFor('sale')} ${seed('sale_number')}`),
    voided_sales_without_void_je: all(db, `select id, sale_number num from sales d where is_voided=1 and not ${jeFor('sale_void')} ${seed('sale_number')}`),
    purchases: all(db, `select id, purchase_number num from purchases d where not ${jeFor('purchase')} ${seed('purchase_number')}`),
    expenses: all(db, `select id, expense_number num from expenses d where not ${jeFor('expense')} ${seed('expense_number')}`),
    wastage: all(db, `select id, id num from wastage_records d where not ${jeFor('wastage')}`),
    credit_notes_submitted: hasTable(db, 'credit_notes') ? all(db, `select id, credit_note_number num from credit_notes d where docstatus=1 and not ${jeFor('credit_note')}`) : [],
    adjustments: all(db, `select id, movement_type num from stock_movements d where movement_type like 'adjustment%' and not ${jeFor('adjustment')}`),
  };
  // payments: those not created together with their document should have own JE
  const payNoJe = all(db, `select p.id, p.payment_number num, p.reference_type, p.reference_id, p.created_at,
      (case p.reference_type when 'sale' then (select created_at from sales where id=p.reference_id)
                             when 'purchase' then (select created_at from purchases where id=p.reference_id)
                             when 'expense' then (select created_at from expenses where id=p.reference_id) end) doc_created
      from payments p where not exists (select 1 from journal_entries je where je.source_type='payment' and je.source_id=p.id) ${seed('p.payment_number')}`);
  missing.payments_standalone = payNoJe.filter((p) => p.doc_created === null || p.doc_created === undefined || Math.abs(p.created_at - p.doc_created) > 5000);
  const embeddedPays = payNoJe.length - missing.payments_standalone.length;
  const totMissing = Object.values(missing).reduce((s, a) => s + a.length, 0);
  add('DOC-01', 'Every financial document has its JE (I-05/I-13)', totMissing ? 'FAIL' : 'PASS',
    { actual: Object.fromEntries(Object.entries(missing).map(([k, v]) => [k, v.length])),
      details: { ...Object.fromEntries(Object.entries(missing).map(([k, v]) => [k, v.slice(0, 15).map((x) => x.num ?? x.id)])), note: `${embeddedPays} payments created with their document (covered by document JE) ignored` } });
  const xfers = hasTable(db, 'stock_transfers') ? n(one(db, `select count(*) v from stock_transfers`).v) : 0;
  if (xfers) add('DOC-01b', 'Stock transfers have no JE by design (K3-016) — value created/destroyed not posted', 'WARN',
    { actual: `${xfers} transfers`, details: all(db, `select t.transfer_number, t.total_cost_value out_value,
       (select round(l.unit_purchase_price*t.total_weight_grams/1000.0) from inventory_lots l where l.id=t.source_lot_id) approx_source_value from stock_transfers t limit 20`) });

  // JEs whose source document is gone or cancelled
  const srcTable = { sale: ['sales', 'id'], sale_void: ['sales', 'id'], purchase: ['purchases', 'id'], expense: ['expenses', 'id'], payment: ['payments', 'id'],
    wastage: ['wastage_records', 'id'], credit_note: ['credit_notes', 'id'], adjustment: ['stock_movements', 'id'], reversal: ['journal_entries', 'id'] };
  const orphans = [];
  for (const [st, [tb]] of Object.entries(srcTable)) {
    if (!hasTable(db, tb)) continue;
    for (const r of all(db, `select je.id, je.entry_number, je.source_id from journal_entries je where je.source_type=? and not exists (select 1 from ${tb} d where d.id = je.source_id)`, st))
      orphans.push({ ...r, source_type: st, issue: 'source document missing' });
  }
  // cancelled documents whose JE is not neutralised
  for (const r of all(db, `select je.id, je.entry_number, je.source_id from journal_entries je join sales s on s.id=je.source_id where je.source_type='sale' and s.is_voided=1
       and not exists (select 1 from journal_entries v where v.source_type='sale_void' and v.source_id=s.id) and je.is_reversed=0`))
    orphans.push({ ...r, source_type: 'sale', issue: 'sale voided, JE not reversed' });
  for (const r of all(db, `select je.id, je.entry_number, je.source_id from journal_entries je join payments p on p.id=je.source_id where je.source_type='payment' and (p.docstatus=2 or p.is_voided=1) and je.is_reversed=0`))
    orphans.push({ ...r, source_type: 'payment', issue: 'payment cancelled, JE not reversed' });
  for (const r of all(db, `select je.id, je.entry_number, je.source_id from journal_entries je join expenses e on e.id=je.source_id where je.source_type='expense' and e.docstatus=2 and je.is_reversed=0`))
    orphans.push({ ...r, source_type: 'expense', issue: 'expense cancelled, JE not reversed' });
  // amount mismatch: expense JE vs expense amount (edits not reposted, K3-012)
  for (const r of all(db, `select je.entry_number, e.expense_number, e.amount, (select sum(debit_amount) from journal_entry_lines l where l.journal_entry_id=je.id) jedr
       from journal_entries je join expenses e on e.id=je.source_id where je.source_type='expense'`).filter((r) => r.amount !== r.jedr))
    orphans.push({ ...r, source_type: 'expense', issue: 'expense amount ≠ JE amount' });
  for (const r of all(db, `select je.entry_number, s.sale_number, s.total_amount + coalesce(s.discount_amount,0) exp_rev,
       (select sum(credit_amount) from journal_entry_lines l join accounts a on a.id=l.account_id where l.journal_entry_id=je.id and a.root_type='Income') rev
       from journal_entries je join sales s on s.id=je.source_id where je.source_type='sale'`).filter((r) => r.rev !== r.exp_rev))
    orphans.push({ ...r, source_type: 'sale', issue: 'sale JE income credit ≠ sale total+discount (legacy rule)', severity: 'info' });
  const dupPost = all(db, `select source_type, source_id, count(*) c from journal_entries where source_type in ('sale','purchase','expense','payment','wastage','credit_note','adjustment','sale_void') group by 1,2 having c > 1`);
  for (const d of dupPost) orphans.push({ ...d, issue: 'document posted more than once' });
  add('DOC-02', 'No JE without a live document; cancelled documents neutralised; no duplicate posting (I-13/I-05)',
    orphans.filter((o) => o.severity !== 'info').length ? 'FAIL' : orphans.length ? 'WARN' : 'PASS', { actual: `${orphans.length} issues`, details: orphans.slice(0, 30) });

  // ---- Document numbers ----
  const numCols = [['sales', 'sale_number'], ['purchases', 'purchase_number'], ['payments', 'payment_number'], ['expenses', 'expense_number'],
    ['debts', 'debt_number'], ['inventory_lots', 'lot_number'], ['credit_notes', 'credit_note_number'], ['stock_transfers', 'transfer_number'],
    ['customers', 'customer_number'], ['suppliers', 'supplier_number'], ['journal_entries', 'entry_number']];
  const dups = [];
  for (const [tb, col] of numCols) if (hasTable(db, tb)) for (const r of all(db, `select ${col} num, count(*) c from ${tb} where ${col} is not null group by ${col} having c > 1`, )) dups.push({ table: tb, ...r });
  add('NUM-01', 'Document numbers unique (I-46)', dups.length ? 'FAIL' : 'PASS', { details: dups });

  // ---- Sale / purchase header consistency ----
  const salePay = all(db, `select s.id, s.sale_number, s.total_amount, s.amount_paid, s.payment_status, s.is_voided,
      coalesce((select sum(amount) from payments p where p.reference_type='sale' and p.reference_id=s.id and coalesce(p.docstatus,1)<>2 and coalesce(p.is_voided,0)=0),0) paid_rows
      from sales s where s.is_voided=0 ${seed('s.sale_number')}`).filter((r) => r.amount_paid !== r.paid_rows || r.amount_paid > r.total_amount + 1 || r.amount_paid < 0);
  add('DOC-03', 'Sale.amountPaid = Σ active payments; 0 ≤ paid ≤ total (I-32/I-40)', salePay.length ? 'FAIL' : 'PASS', { actual: `${salePay.length} sales`, details: salePay.slice(0, 20) });
  const purPay = all(db, `select s.id, s.purchase_number, coalesce(s.grand_total,s.total_amount) total, s.amount_paid,
      coalesce((select sum(amount) from payments p where p.reference_type='purchase' and p.reference_id=s.id and coalesce(p.docstatus,1)<>2 and coalesce(p.is_voided,0)=0),0) paid_rows
      from purchases s where 1=1 ${seed('s.purchase_number')}`).filter((r) => r.amount_paid !== r.paid_rows || r.amount_paid > r.total);
  add('DOC-04', 'Purchase.amountPaid = Σ active payments; paid ≤ grand total', purPay.length ? 'FAIL' : 'PASS', { actual: `${purPay.length} purchases`, details: purPay.slice(0, 20) });
  const saleLines = all(db, `select s.id, s.sale_number, s.gross_total_amount, (select sum(line_total_amount) from sale_lines l where l.sale_id=s.id) lines,
      s.discount_amount, s.tax_amount, s.total_amount from sales s where 1=1 ${seed('s.sale_number')}`)
    .filter((r) => r.lines !== r.gross_total_amount || r.total_amount !== r.gross_total_amount - n(r.discount_amount) + n(r.tax_amount));
  add('DOC-05', 'Sale total = Σ lines − discount + tax (I-40)', saleLines.length ? 'FAIL' : 'PASS', { actual: `${saleLines.length} sales`, details: saleLines.slice(0, 20) });

  return R;
}

function printReport(dbFile, res, verbose) {
  const counts = res.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
  console.log(`Invariants for ${dbFile}  ->  ${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' ')}`);
  for (const r of res) {
    console.log(`[${r.status.padEnd(4)}] ${r.id.padEnd(8)} ${r.title}`);
    if (r.status !== 'PASS' || verbose) {
      if (r.expected !== undefined) console.log(`          expected: ${JSON.stringify(r.expected)}`);
      if (r.actual !== undefined) console.log(`          actual:   ${JSON.stringify(r.actual)}`);
      if (r.diff !== undefined) console.log(`          diff:     ${r.diff}`);
      const d = r.details;
      if (d && (Array.isArray(d) ? d.length : Object.keys(d).length)) {
        const s = JSON.stringify(d);
        console.log(`          details:  ${s.length > 1500 && !verbose ? s.slice(0, 1500) + ' …' : s}`);
      }
    }
  }
}

// ---------- CLI ----------
const isMain = process.argv[1] && import.meta.url.toLowerCase().endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop().toLowerCase());
if (isMain) {
  const args = process.argv.slice(2);
  const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
  const pos = args.filter((a) => !a.startsWith('--'));
  if (flags.diff) {
    if (pos.length < 2) { console.error('usage: --diff <a.json|a.db> <b.json|b.db>'); process.exit(2); }
    const d = diff(pos[0], pos[1]);
    console.log(flags.json ? JSON.stringify(d, null, 2) : formatDiff(d));
    process.exit(0);
  }
  if (!pos[0]) { console.error('usage: node invariants.mjs <db-file> [--json] [--exclude-seed] [--only=ID,..] [--verbose] [--snapshot=out.json]\n       node invariants.mjs --diff <a> <b>'); process.exit(2); }
  const db = openDb(pos[0]);
  if (flags.snapshot) { fs.writeFileSync(flags.snapshot, JSON.stringify(snapshot(db), null, 2)); console.log(`snapshot written to ${flags.snapshot}`); process.exit(0); }
  let res = runChecks(db, { excludeSeed: !!flags['exclude-seed'] });
  if (flags.only) { const ids = String(flags.only).split(','); res = res.filter((r) => ids.some((i) => r.id.startsWith(i))); }
  if (flags.json) console.log(JSON.stringify({ db: pos[0], results: res, snapshot: snapshot(db).metrics }, null, 2));
  else printReport(pos[0], res, !!flags.verbose);
  process.exit(res.some((r) => r.status === 'FAIL') ? 1 : 0);
}
