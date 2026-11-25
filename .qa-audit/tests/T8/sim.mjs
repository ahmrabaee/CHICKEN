// T8 — 30-day business simulation of a chicken butcher shop through the API, with an independent
// shadow ledger (what a correct system should show) and day-end + per-operation reconciliation.
// Re-runnable & deterministic:  node sim.mjs [--days=30] [--seed=20261001] [--port=3113] [--name=t8]
//                                         [--transfer-cost=allocated|ui-default] [--no-reset]
// Requires the backend to be launched via t8instance.mjs (fake clock preload).
// Outputs in tests/T8/out-<name>/ : daily-recon.csv, daily-recon.md, divergence-log.md, ops.jsonl, errors.md, final.json
process.removeAllListeners('warning'); process.on('warning', () => {});
import { request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { openDb, snapshot } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/invariants.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const DAYS = Number(arg('days', 30)); const SEED = Number(arg('seed', 20261001));
const PORT = Number(arg('port', 3113)); const NAME = arg('name', 't8');
const TRANSFER_COST = arg('transfer-cost', 'allocated');
const ROOT = `http://localhost:${PORT}`; const B = `${ROOT}/v1`;
const DB = path.resolve(HERE, '..', '..', 'envs', NAME, 'app.db');
const OUT = path.join(HERE, `out-${NAME}`); fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f));
const START = Date.UTC(2026, 9, 1); // 2026-10-01

if (!process.argv.includes('--no-reset')) {
  execFileSync(process.execPath, [path.join(HERE, 't8instance.mjs'), 'reset', NAME, String(PORT), 'baseline'], { stdio: 'inherit' });
}

// ---------- utilities ----------
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(SEED);
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const rpick = (arr) => arr[Math.floor(rnd() * arr.length)];
const wpick = (pairs) => { const tot = pairs.reduce((s, p) => s + p[1], 0); let x = rnd() * tot; for (const [v, w] of pairs) { if ((x -= w) < 0) return v; } return pairs[pairs.length - 1][0]; };
const ils = (m) => (m / 100).toFixed(2);
const v = (x, w) => Math.round((w / 1000) * x); // line value: grams × price/kg
let simDay = 0; let simTime = START;
const dayStr = (d) => new Date(START + (d - 1) * 86400000).toISOString().slice(0, 10);
async function setClock(day, hh, mm = 0) {
  simTime = START + (day - 1) * 86400000 + (hh * 60 + mm) * 60000;
  await fetch(`${ROOT}/__qaclock?set=${new Date(simTime).toISOString()}`);
}
async function tick(min = 7) { simTime += min * 60000 + Math.floor(rnd() * 60000); await fetch(`${ROOT}/__qaclock?set=${new Date(simTime).toISOString()}`); }

const opsLog = fs.createWriteStream(path.join(OUT, 'ops.jsonl'));
const errors = []; const timings = {};
const sessions = {};
async function login(u) {
  const cred = { owner: ['owner', 'Owner@12345'], cashier: ['cashier1', 'Cashier@123'] }[u];
  const r = await request(B, 'POST', '/auth/login', { body: { username: cred[0], password: cred[1] } });
  if (!r.ok) throw new Error(`login ${u} ${r.status} ${JSON.stringify(r.body)}`);
  sessions[u] = r.data.accessToken;
}
async function api(user, method, p, body, label) {
  const t0 = performance.now();
  let r = await request(B, method, p, { body, token: sessions[user] });
  if (r.status === 401) { await login(user); r = await request(B, method, p, { body, token: sessions[user] }); }
  const ms = performance.now() - t0;
  const key = `${method} ${p.replace(/\d+/g, ':id').split('?')[0]}`; (timings[key] ||= []).push(ms);
  if (!r.ok && label !== 'quiet') {
    const e = { day: simDay, at: new Date(simTime).toISOString(), user, method, path: p, status: r.status, code: r.body?.error?.code, msg: r.body?.error?.message, label, body };
    errors.push(e); opsLog.write(JSON.stringify({ type: 'ERROR', ...e }) + '\n');
  }
  return r;
}
const q = (sql, ...a) => { const db = openDb(DB); try { return db.prepare(sql).all(...a); } finally { db.close(); } };

// ---------- master data ----------
const ITEMS = {
  whole:  { code: '100001', name: 'دجاج كامل طازج', cat: 2, sell: 1600, buy: 1100, kg: [1.2, 3.0] },
  breast: { code: '100002', name: 'صدر دجاج', cat: 3, sell: 3200, buy: 2200, kg: [0.5, 2.0], yield: 0.30 },
  thigh:  { code: '100003', name: 'فخذ دجاج', cat: 3, sell: 2200, buy: 1500, kg: [0.5, 2.5], yield: 0.32 },
  wings:  { code: '100004', name: 'جوانح دجاج', cat: 3, sell: 1500, buy: 1000, kg: [0.5, 2.0], yield: 0.11 },
  backs:  { code: '100005', name: 'رقاب وظهور', cat: 3, sell: 600, buy: 300, kg: [0.5, 2.0], yield: 0.18 },
  minced: { code: '100006', name: 'دجاج مفروم', cat: 6, sell: 2800, buy: 1900, kg: [0.5, 1.5], yield: 0.06 },
  liver:  { code: '100007', name: 'كبدة دجاج', cat: 3, sell: 1400, buy: 900, kg: [0.3, 1.0] },
};
const PARTS = ['breast', 'thigh', 'wings', 'backs', 'minced'];
const DEMAND = { whole: [55, 85], breast: [14, 26], thigh: [14, 26], wings: [5, 10], backs: [5, 10], minced: [4, 8], liver: [3, 7] }; // kg/day
const CUSTOMERS = [
  { key: 'amir', name: 'مطعم الأمير', phone: '0599000001', kind: 'restaurant' },
  { key: 'sultan', name: 'مطعم السلطان', phone: '0599000002', kind: 'restaurant' },
  { key: 'hotel', name: 'فندق القدس', phone: '0599000003', kind: 'restaurant' },
  { key: 'abukhalil', name: 'عائلة أبو خليل', phone: '0599000004', kind: 'family' },
  { key: 'ummoh', name: 'أم محمد', phone: '0599000005', kind: 'family' },
  { key: 'noor', name: 'بقالة النور', phone: '0599000006', kind: 'family' },
];
const SUPPLIERS = [
  { key: 'farm', name: 'مزرعة الخليل للدواجن', terms: 'credit' },
  { key: 'whole', name: 'أبو سامي لتجارة الدواجن', terms: 'cash' },
  { key: 'offal', name: 'مسلخ النور', terms: 'bank' },
];
const EXPCAT = { rent: [2, '5210'], elec: [4, '5221'], water: [5, '5222'], salaries: [6, '5230'], maint: [7, '5240'], fuel: [8, '5250'], other: [9, '5400'] };

// ---------- shadow ledger (the auditor's independent truth) ----------
const T = {
  gl: {}, lots: {}, cust: {}, supp: {}, saleRec: {}, purchRec: {},
  post(lines, why) { let s = 0; for (const [c, a] of lines) { this.gl[c] = (this.gl[c] || 0) + a; s += a; } if (s !== 0) throw new Error(`shadow JE unbalanced ${why} ${s}`); },
  qty(item) { return (this.lots[item] || []).reduce((s, l) => s + l.q, 0); },
  value() { let s = 0; for (const k in this.lots) for (const l of this.lots[k]) s += v(l.price, l.q); return s; },
  fifo(item, grams) { // consume oldest first, cost per slice = round(q/1000 × lot price) (same rounding as system)
    const out = []; let need = grams;
    for (const l of this.lots[item] || []) { if (need <= 0) break; if (l.q <= 0) continue; const take = Math.min(l.q, need);
      // value removed = value(before) − value(after) keeps Σlot value exact
      const cost = v(l.price, take); l.q -= take; need -= take; out.push({ lot: l.id, q: take, cost }); }
    if (need > 0) throw new Error(`shadow FIFO short ${item} ${need}g`);
    return out;
  },
  takeLot(item, lotId, grams) { const l = (this.lots[item] || []).find((x) => x.id === lotId); const cost = v(l.price, grams); l.q -= grams; return cost; },
  restore(item, allocs) { for (const a of allocs) { const l = this.lots[item].find((x) => x.id === a.lot); l.q += a.q; } },
};
const lotCostNote = 'Shadow lot value uses value(before)-value(after) per slice; system uses round(q/1000*price) per slice. Differences show as rounding.';

// ---------- divergence tracking ----------
const sysMetrics = () => {
  const db = openDb(DB); const s = snapshot(db);
  const items = {}; for (const r of db.prepare('select item_id, current_quantity_grams q from inventory').all()) items[r.item_id] = r.q;
  const lotsByItem = {}; for (const r of db.prepare('select item_id, sum(remaining_quantity_grams) q from inventory_lots group by item_id').all()) lotsByItem[r.item_id] = r.q;
  db.close();
  const acc = (c) => s.accounts[c]?.net || 0;
  let ni = 0; for (const [c, a] of Object.entries(s.accounts)) if (a.root === 'Income' || a.root === 'Expense') ni -= a.net;
  return { s, acc, ni, items, lotsByItem };
};
const truthNI = () => { let ni = 0; for (const [c, a] of Object.entries(T.gl)) if (c[0] === '4' || c[0] === '5') ni -= a; return ni; };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
function divergences() {
  const m = sysMetrics(); const M = m.s.metrics; const tg = (c) => T.gl[c] || 0;
  const tc = sum(T.cust), ts = sum(T.supp), tinv = tg('1131');
  const d = {
    cash_gl: M.gl_cash - tg('1111'), bank_gl: M.gl_bank - tg('1112-001'),
    ar_gl: M.gl_ar - tg('1120'), ar_custBal: M.customers_balance - tc, ar_debts: M.debts_receivable_open - tc, ar_ple: M.ple_customer - tc,
    ap_gl: M.gl_ap - (-tg('2110')), ap_suppBal: M.suppliers_balance - ts, ap_debts: M.debts_payable_open - ts, ap_ple: (-M.ple_supplier) - ts,
    inv_gl: M.gl_inventory - tinv, inv_table: M.inventory_value - tinv, inv_lots: M.lots_value - T.value(),
    vat_gl: (-(m.acc('2120'))) - (-tg('2120')), net_income: m.ni - truthNI(),
    tb_balanced: M.gl_total_dr - M.gl_total_cr,
  };
  for (const [k, it] of Object.entries(IT)) { d[`qty_${k}`] = (m.items[it.id] || 0) - T.qty(k); d[`lotqty_${k}`] = (m.lotsByItem[it.id] || 0) - T.qty(k); }
  return { d, m };
}
let lastD = null; const divLog = [];
async function op(label, fn) {
  const before = lastD;
  const res = await fn();
  const { d } = divergences();
  if (before) for (const k of Object.keys(d)) if (d[k] !== before[k]) divLog.push({ day: simDay, date: dayStr(simDay), at: new Date(simTime).toISOString().slice(11, 16), op: label, metric: k, before: before[k], after: d[k], change: d[k] - before[k] });
  lastD = d; opsLog.write(JSON.stringify({ day: simDay, at: new Date(simTime).toISOString(), op: label, ok: res !== false }) + '\n');
  return res;
}

// ---------- setup ----------
const IT = {}; const CU = {}; const SU = {}; let BANK = null; let ACC = {};
async function setup() {
  await setClock(1, 4, 0); simDay = 1;
  let r = await request(B, 'POST', '/auth/setup', { body: { businessName: 'ملحمة الدجاج الطازج', businessNameEn: 'Fresh Chicken Butcher', adminUsername: 'owner', adminPassword: 'Owner@12345', adminFullName: 'صاحب المحل', preferredLanguage: 'ar' } });
  if (!r.ok) throw new Error('setup ' + JSON.stringify(r.body));
  await login('owner');
  r = await api('owner', 'POST', '/users', { username: 'cashier1', password: 'Cashier@123', fullName: 'كاشير المحل', roleId: 2, preferredLanguage: 'ar' });
  await login('cashier');
  for (const a of q(`select id, code from accounts`)) ACC[a.code] = a.id;
  r = await api('owner', 'POST', '/bank-accounts', { name: 'بنك فلسطين - حساب المحل', accountId: ACC['1112-001'], isDefault: true });
  BANK = r.data.id;
  for (const [k, it] of Object.entries(ITEMS)) {
    r = await api('owner', 'POST', '/items', { code: it.code, name: it.name, categoryId: it.cat, defaultSalePrice: it.sell, defaultPurchasePrice: it.buy, shelfLifeDays: k === 'whole' || k === 'liver' ? 3 : 2, minStockLevelGrams: 5000, requiresScale: true });
    if (!r.ok) throw new Error('item ' + JSON.stringify(r.body));
    IT[k] = { ...it, id: r.data.id }; T.lots[k] = [];
  }
  for (const c of CUSTOMERS) { r = await api('owner', 'POST', '/customers', { name: c.name, phone: c.phone, creditLimit: 500000 }); CU[c.key] = { ...c, id: r.data.id }; T.cust[c.key] = 0; }
  for (const s of SUPPLIERS) { r = await api('owner', 'POST', '/suppliers', { name: s.name, phone: '0598' + rint(100000, 999999), paymentTerms: s.terms }); SU[s.key] = { ...s, id: r.data.id }; T.supp[s.key] = 0; }
  lastD = divergences().d;
  // Opening capital: no opening-balance feature exists -> owner's accountant posts a manual JE (Dr cash, Dr bank / Cr capital)
  await op('opening capital JE', async () => {
    const r1 = await api('owner', 'POST', '/accounting/journal-entries', { description: 'رأس مال افتتاحي', entryDate: new Date(simTime).toISOString(), lines: [
      { accountId: ACC['1111'], debit: 1500000, credit: 0 }, { accountId: ACC['1112-001'], debit: 8000000, credit: 0 }, { accountId: ACC['3100'], debit: 0, credit: 9500000 }] });
    if (!r1.ok) return false;
    const r2 = await api('owner', 'POST', `/accounting/journal-entries/${r1.data.id}/post`, {});
    if (!r2.ok) return false;
    T.post([['1111', 1500000], ['1112-001', 8000000], ['3100', -9500000]], 'capital');
  });
}

// ---------- operations ----------
const cashAcc = (method) => (method === 'cash' ? '1111' : '1112-001');
async function purchase(supKey, item, grams, pricePerKg, payMode, label) {
  return op(`purchase ${SU[supKey].key} ${item} ${grams / 1000}kg ${payMode}`, async () => {
    const total = v(pricePerKg, grams);
    let paid = 0, method = 'cash';
    if (payMode === 'cash') paid = total; else if (payMode === 'bank') { paid = total; method = 'bank_transfer'; } else if (payMode === 'partial') paid = Math.round(total / 2 / 100) * 100;
    const body = { supplierId: SU[supKey].id, purchaseDate: new Date(simTime).toISOString(), lines: [{ itemId: IT[item].id, weightGrams: grams, pricePerKg }], amountPaid: paid, paymentMethod: method, ...(method === 'bank_transfer' ? { bankAccountId: BANK } : {}) };
    let r = await api('owner', 'POST', '/purchases', body, label);
    if (!r.ok && r.body?.error?.code === 'INSUFFICIENT_BALANCE' && method === 'cash') { // workaround: pay the supplier by bank instead (what the error message suggests)
      method = 'bank_transfer'; Object.assign(body, { paymentMethod: method, bankAccountId: BANK }); r = await api('owner', 'POST', '/purchases', body, 'retry-bank');
    }
    if (!r.ok) return false;
    const lot = q('select id from inventory_lots where purchase_id=?', r.data.id)[0];
    T.lots[item].push({ id: lot.id, q: grams, price: pricePerKg });
    T.post([['1131', total], [cashAcc(method), -paid], ['2110', -(total - paid)]].filter((x) => x[1]), 'purchase');
    T.supp[supKey] += total - paid;
    T.purchRec[r.data.id] = { sup: supKey, total, paid, item, lot: lot.id, grams, price: pricePerKg };
    return r.data.id;
  });
}
async function editPurchase(pid, newGrams) {
  return op(`purchase EDIT ${pid} -> ${newGrams / 1000}kg`, async () => {
    const P = T.purchRec[pid];
    const r = await api('owner', 'PUT', `/purchases/${pid}`, { supplierId: SU[P.sup].id, lines: [{ itemId: IT[P.item].id, weightGrams: newGrams, pricePerKg: P.price }] });
    if (!r.ok) return false;
    const oldTotal = P.total; const newTotal = v(P.price, newGrams);
    T.lots[P.item] = T.lots[P.item].filter((l) => l.id !== P.lot);
    const lot = q('select id, received_at from inventory_lots where purchase_id=?', pid)[0];
    // system re-creates the lot with receivedAt=now -> it is now the NEWEST lot (FIFO order changes); mirror that
    T.lots[P.item].push({ id: lot.id, q: newGrams, price: P.price });
    T.post([['1131', newTotal - oldTotal], ['2110', -(newTotal - oldTotal)]], 'purchase edit');
    T.supp[P.sup] += newTotal - oldTotal; Object.assign(P, { total: newTotal, grams: newGrams, lot: lot.id, paid: 0 });
    return true;
  });
}
async function cutChickens(lotId, inGrams) {
  // whole chicken -> parts (97% yield). System has no yield concept: transfer the 97% and record the 3% as processing-loss wastage.
  const srcLot = T.lots.whole.find((l) => l.id === lotId); const c = srcLot.price;
  const lines = PARTS.map((k) => ({ k, w: Math.round(inGrams * ITEMS[k].yield / 10) * 10 }));
  const outW = lines.reduce((s, l) => s + l.w, 0);
  if (TRANSFER_COST === 'allocated') { // joint cost by relative sales value, normalised so Σ output value ≈ consumed source value
    const sv = lines.reduce((s, l) => s + l.w * ITEMS[l.k].sell, 0);
    for (const l of lines) l.u = Math.round(c * outW * ITEMS[l.k].sell / sv);
  } else for (const l of lines) l.u = ITEMS[l.k].buy; // what the UI pre-fills (item.defaultPurchasePrice)
  const ok = await op(`stock-transfer cut ${inGrams / 1000}kg lot ${lotId} (${TRANSFER_COST})`, async () => {
    const r = await api('owner', 'POST', '/stock-transfer', { sourceLotId: lotId, lines: lines.map((l) => ({ itemId: IT[l.k].id, weightGrams: l.w, unitCost: l.u })), notes: 'تقطيع صباحي' });
    if (!r.ok) return false;
    const srcVal = T.takeLot('whole', lotId, outW);
    const newLots = q('select id, item_id from inventory_lots where stock_transfer_id=? order by id', r.data.id);
    let outVal = 0;
    for (const l of lines) { const nl = newLots.find((x) => x.item_id === IT[l.k].id); T.lots[l.k].push({ id: nl.id, q: l.w, price: l.u }); outVal += v(l.u, l.w); }
    // truth: value is conserved; any difference between output lot values and consumed value is a transfer variance (P&L)
    T.post([['1131', outVal - srcVal], ['5320', -(outVal - srcVal)]].filter((x) => x[1]), 'transfer variance');
    return true;
  });
  if (ok === false) return false;
  const loss = Math.min(inGrams - outW, T.lots.whole.find((l) => l.id === lotId).q);
  if (loss > 0) await wastage('whole', lotId, loss, 'processing_loss');
  return true;
}
async function wastage(item, lotId, grams, reason) {
  return op(`wastage ${item} ${grams / 1000}kg lot ${lotId} ${reason}`, async () => {
    const r = await api('owner', 'POST', '/wastage', { lotId, quantityGrams: grams, reason, notes: 'نهاية الأسبوع' });
    if (!r.ok) return false;
    const cost = T.takeLot(item, lotId, grams);
    T.post([['5300', cost], ['1131', -cost]], 'wastage');
    return true;
  });
}
function barcodeFor(item, grams) {
  const total = v(ITEMS[item].sell, grams);
  return '2' + ITEMS[item].code + String(grams).padStart(5, '0') + String(total).padStart(7, '0') + String(ITEMS[item].sell).padStart(5, '0') + '0';
}
let saleSeq = 0;
async function sale({ user = 'cashier', lines, mode = 'cash', cust = null, discount = 0, discountPct = 0, barcode = false, tax = false, partialPaid = 0, label = '' }) {
  saleSeq++;
  return op(`sale#${saleSeq} ${mode}${cust ? ' ' + cust : ''}${barcode ? ' barcode' : ''}${discount ? ' disc' + discount : ''}${tax ? ' VAT' : ''} ${label}`, async () => {
    const dl = [];
    for (const l of lines) {
      if (barcode) { // scan the scale label -> /barcode/lookup -> weight & item
        const r = await api(user, 'GET', `/barcode/lookup?barcode=${barcodeFor(l.item, l.grams)}`);
        if (!r.ok) return false;
        dl.push({ itemId: r.data.item.id, weightGrams: Math.round(r.data.weightKg * 1000), pricePerKg: r.data.item.defaultSalePrice, _k: l.item });
      } else dl.push({ itemId: IT[l.item].id, weightGrams: l.grams, pricePerKg: ITEMS[l.item].sell, _k: l.item });
    }
    const gross = dl.reduce((s, l) => s + v(l.pricePerKg, l.weightGrams), 0);
    const disc = discount + Math.round(gross * discountPct / 10000);
    const sub = gross - disc; const vat = tax ? Math.round(sub * 1500 / 10000) : 0; const total = sub + vat;
    const body = { saleType: mode === 'credit' ? 'credit' : 'cash', lines: dl.map(({ _k, ...x }) => x), ...(discount ? { discountAmount: discount } : {}), ...(discountPct ? { discountPct } : {}), ...(tax ? { taxTemplateId: 1 } : {}) };
    if (cust) body.customerId = CU[cust].id;
    let paid = 0, method = 'cash';
    if (mode === 'cash') { paid = total; body.payments = [{ amount: total, paymentMethod: 'cash' }]; }
    if (mode === 'card') { paid = total; method = 'card'; body.payments = [{ amount: total, paymentMethod: 'card', bankAccountId: BANK }]; }
    if (mode === 'partial') { paid = partialPaid; body.payments = [{ amount: paid, paymentMethod: 'cash' }]; }
    if (mode === 'credit') body.dueDate = new Date(simTime + 14 * 86400000).toISOString();
    const r = await api(user, 'POST', '/sales', body);
    if (!r.ok) return false;
    if (r.data.totalAmount !== total) errors.push({ day: simDay, note: `sale total mismatch expected ${total} got ${r.data.totalAmount}`, sale: r.data.saleNumber });
    let cogs = 0; const allocs = {};
    for (const l of dl) { const a = T.fifo(l._k, l.weightGrams); allocs[l._k] = a; cogs += a.reduce((s, x) => s + x.cost, 0); }
    const due = total - paid;
    T.post([[cashAcc(method), paid], ['1120', due], ['4900', disc], ['4110', -gross], ['2120', -vat], ['5100', cogs], ['1131', -cogs]].filter((x) => x[1]), 'sale');
    if (cust) T.cust[cust] += due;
    T.saleRec[r.data.id] = { id: r.data.id, no: r.data.saleNumber, day: simDay, cust, mode, method, total, paid, due, gross, disc, vat, cogs, allocs, open: due, sysCost: r.data.totalCost };
    return r.data.id;
  });
}
async function voidSale(id, reason) {
  return op(`void sale ${T.saleRec[id].no} (${T.saleRec[id].mode})`, async () => {
    const r = await api('owner', 'POST', `/sales/${id}/void`, { reason });
    if (!r.ok) return false;
    const S = T.saleRec[id];
    for (const [k, a] of Object.entries(S.allocs)) T.restore(k, a);
    T.post([[cashAcc(S.method), -S.paid], ['1120', -S.open], ['4900', -S.disc], ['4110', S.gross], ['2120', S.vat], ['5100', -S.cogs], ['1131', S.cogs],
      // money already collected on a credit sale is owed back to the customer (refund in cash) — not used in this sim
    ].filter((x) => x[1]), 'void');
    if (S.cust) T.cust[S.cust] -= S.open;
    S.voided = true; S.open = 0;
    return true;
  });
}
async function collect(cust, amountWanted, method) {
  // customer pays: settle oldest open invoices first (how a cashier would do it in /payments/new)
  const open = Object.values(T.saleRec).filter((s) => s.cust === cust && s.open > 0 && !s.voided).sort((a, b) => a.id - b.id);
  let left = amountWanted;
  for (const s of open) {
    if (left <= 0) break;
    const amt = Math.min(s.open, left);
    await op(`collection ${cust} ${s.no} ${ils(amt)} ${method}`, async () => {
      const r = await api('owner', 'POST', '/payments/sale', { saleId: s.id, amount: amt, paymentMethod: method, ...(method === 'bank_transfer' ? { bankAccountId: BANK } : {}), paymentDate: new Date(simTime).toISOString() });
      if (!r.ok) return false;
      T.post([[cashAcc(method), amt], ['1120', -amt]], 'collection'); T.cust[cust] -= amt; s.open -= amt; left -= amt; return true;
    });
  }
}
async function paySupplier(supKey, amountWanted, method) {
  const open = Object.entries(T.purchRec).filter(([, p]) => p.sup === supKey && p.total - p.paid > 0).sort((a, b) => a[0] - b[0]);
  let left = amountWanted;
  for (const [pid, p] of open) {
    if (left <= 0) break;
    const amt = Math.min(p.total - p.paid, left);
    await op(`supplier payment ${supKey} PUR#${pid} ${ils(amt)} ${method}`, async () => {
      const r = await api('owner', 'POST', '/payments/purchase', { purchaseId: Number(pid), amount: amt, paymentMethod: method, ...(method === 'bank_transfer' ? { bankAccountId: BANK } : {}), paymentDate: new Date(simTime).toISOString() });
      if (!r.ok) return false;
      T.post([['2110', amt], [cashAcc(method), -amt]], 'supplier payment'); T.supp[supKey] -= amt; p.paid += amt; left -= amt; return true;
    });
  }
}
async function expense(key, amount, method, desc) {
  return op(`expense ${key} ${ils(amount)} ${method}`, async () => {
    const r = await api('owner', 'POST', '/expenses', { categoryId: EXPCAT[key][0], description: desc, amount, expenseDate: new Date(simTime).toISOString(), paymentMethod: method, ...(method === 'bank_transfer' ? { bankAccountId: BANK } : {}) });
    if (!r.ok) return false;
    T.post([[EXPCAT[key][1], amount], [cashAcc(method), -amount]], 'expense'); return true;
  });
}
async function depositCash(amount) {
  return op(`cash deposit to bank ${ils(amount)} (manual JE)`, async () => {
    const r1 = await api('owner', 'POST', '/accounting/journal-entries', { description: 'إيداع نقدية في البنك', entryDate: new Date(simTime).toISOString(), lines: [
      { accountId: ACC['1112-001'], debit: amount, credit: 0 }, { accountId: ACC['1111'], debit: 0, credit: amount }] });
    if (!r1.ok) return false;
    const r2 = await api('owner', 'POST', `/accounting/journal-entries/${r1.data.id}/post`, {});
    if (!r2.ok) return false;
    T.post([['1112-001', amount], ['1111', -amount]], 'deposit'); return true;
  });
}
async function creditNote(saleId, amount, reason) {
  return op(`credit note ${T.saleRec[saleId].no} ${ils(amount)}`, async () => {
    const r = await api('owner', 'POST', '/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: saleId, amount, reason });
    if (!r.ok) return false;
    const r2 = await api('owner', 'POST', `/credit-notes/${r.data.id}/submit`, {});
    if (!r2.ok) return false;
    const S = T.saleRec[saleId];
    T.post([['4900', amount], ['1120', -amount]], 'credit note'); T.cust[S.cust] -= amount; S.open -= amount; return true;
  });
}
async function writeOff(saleId) {
  const S = T.saleRec[saleId];
  return op(`write-off debt of ${S.no} ${ils(S.open)}`, async () => {
    const d = q(`select id from debts where direction='receivable' and source_type='sale' and source_id=?`, saleId)[0]
      || q(`select id from debts where direction='receivable' and party_id=? order by id desc`, CU[S.cust].id)[0];
    const r = await api('owner', 'POST', `/debts/${d.id}/write-off`, { reason: 'العميل غادر البلد' });
    if (!r.ok) return false;
    T.post([['5400', S.open], ['1120', -S.open]], 'write-off'); T.cust[S.cust] -= S.open; S.open = 0; return true;
  });
}
async function adjust(item, type, grams, reason) {
  return op(`stock adjustment ${item} ${type} ${grams / 1000}kg`, async () => {
    const body = { itemId: IT[item].id, adjustmentType: type, quantityGrams: grams, reason };
    let price;
    if (type === 'increase') { price = T.lots[item].filter((l) => l.q > 0).slice(-1)[0]?.price ?? ITEMS[item].buy; body.unitCost = price; }
    const r = await api('owner', 'POST', '/inventory/adjustments', body);
    if (!r.ok) return false;
    if (type === 'decrease') { const a = T.fifo(item, grams); const c = a.reduce((s, x) => s + x.cost, 0); T.post([['5320', c], ['1131', -c]], 'adj-'); }
    else { const lot = q(`select id from inventory_lots where item_id=? order by id desc limit 1`, IT[item].id)[0]; T.lots[item].push({ id: lot.id, q: grams, price }); const c = v(price, grams); T.post([['1131', c], ['5320', -c]], 'adj+'); }
    return true;
  });
}

// ---------- day-end reconciliation ----------
const rows = [];
const reportCache = {};
async function dayEnd(d) {
  await setClock(d, 18, 30);
  const ds = dayStr(d); const ms = dayStr(1);
  const { d: D, m } = divergences(); const M = m.s.metrics; const tg = (c) => T.gl[c] || 0;
  const tb = await api('owner', 'GET', `/accounting/trial-balance?asOfDate=${ds}`);
  const dash = await api('owner', 'GET', '/reports/dashboard');
  const pl = await api('owner', 'GET', `/reports/profit-loss?startDate=${ms}&endDate=${ds}`);
  const sr = await api('owner', 'GET', `/reports/sales?startDate=${ds}&endDate=${ds}`);
  const ds2 = await api('owner', 'GET', '/debts/summary');
  const svg = await api('owner', 'GET', `/reports/stock-vs-gl?asOfDate=${ds}`);
  const cashLedger = await api('owner', 'GET', `/accounting/ledger/1111?startDate=${ms}&endDate=${ds}`);
  reportCache[d] = { tb: tb.data, dash: dash.data, pl: pl.data, sr: sr.data, debtsSummary: ds2.data, stockVsGl: svg.data };
  const tbRows = Array.isArray(tb.data) ? tb.data : (tb.data?.accounts || []);
  const tbCash = tbRows.find((a) => a.accountCode === '1111');
  const daySales = Object.values(T.saleRec).filter((s) => s.day === d && !s.voided);
  const tDayRevenue = daySales.reduce((s, x) => s + x.total, 0);
  const tMtdNetRev = -(tg('4110')) - tg('4900');
  const tCogs = tg('5100');
  const tOpex = ['5210', '5221', '5222', '5230', '5240', '5250', '5400'].reduce((s, c) => s + tg(c), 0);
  const row = {
    day: d, date: ds, sales: daySales.length,
    T_cash: tg('1111'), S_cash_gl: M.gl_cash, S_cash_tb: tbCash ? (tbCash.balance ?? (tbCash.debit - tbCash.credit)) : null,
    T_bank: tg('1112-001'), S_bank_gl: M.gl_bank,
    T_AR: tg('1120'), S_AR_gl: M.gl_ar, S_AR_custBal: M.customers_balance, S_AR_debtsOpen: M.debts_receivable_open, S_AR_ple: M.ple_customer, S_AR_dash: dash.data?.receivables, S_AR_debtsSummary: ds2.data?.totalReceivables,
    T_AP: -tg('2110'), S_AP_gl: M.gl_ap, S_AP_suppBal: M.suppliers_balance, S_AP_debtsOpen: M.debts_payable_open, S_AP_dash: dash.data?.payables,
    T_inv: tg('1131'), S_inv_gl: M.gl_inventory, S_inv_table: M.inventory_value, S_inv_lots: M.lots_value,
    T_qty: Object.keys(IT).reduce((s, k) => s + T.qty(k), 0), S_qty_inv: M.inventory_qty, S_qty_lots: M.lots_qty,
    T_dayRevenue: tDayRevenue, S_dash_todaySales: dash.data?.sales?.today?.totalAmount, S_salesReport_day: sr.data?.summary?.totalAmount ?? sr.data?.totalAmount ?? sr.data?.totalSales,
    T_mtdNetRevenue: tMtdNetRev, S_GL_4110: -(m.acc('4110')), S_PL_revenue: pl.data?.revenue,
    T_mtdCOGS: tCogs, S_GL_5100: m.acc('5100'), S_PL_cogs: pl.data?.costOfGoodsSold,
    T_wastage: tg('5300'), S_GL_5300: m.acc('5300'), T_adj: tg('5320'), S_GL_5320: m.acc('5320'),
    T_opex: tOpex, S_GL_5400: m.acc('5400'), S_PL_expenses: pl.data?.expenses,
    T_VAT: -tg('2120'), S_VAT_gl: -m.acc('2120'),
    T_netIncome: truthNI(), S_netIncome_gl: m.ni, S_PL_netProfit: pl.data?.netProfit,
    S_tb_dr_minus_cr: M.gl_total_dr - M.gl_total_cr,
    S_stockVsGl_diff: svg.data?.totalDifference ?? svg.data?.summary?.difference ?? null,
    errors_today: errors.filter((e) => e.day === d).length,
  };
  rows.push(row);
  // shadow self-check: inventory GL must equal Σ shadow lots
  if (Math.abs(tg('1131') - T.value()) > 500) errors.push({ day: d, note: `SHADOW SELF-CHECK inv ${tg('1131')} vs lots ${T.value()}` });
  const hdr = Object.keys(rows[0]);
  fs.writeFileSync(path.join(OUT, 'daily-recon.csv'), [hdr.join(','), ...rows.map((r) => hdr.map((h) => r[h] ?? '').join(','))].join('\n'));
  console.log(`day ${d} ${ds} sales=${row.sales} cashΔ=${ils(D.cash_gl)} bankΔ=${ils(D.bank_gl)} ARΔgl=${ils(D.ar_gl)} APΔgl=${ils(D.ap_gl)} invΔgl=${ils(D.inv_gl)} NIΔ=${ils(D.net_income)} err=${row.errors_today}`);
}

// ---------- the month ----------
const expectedDemand = (k) => (DEMAND[k][0] + DEMAND[k][1]) / 2 * 1000;
async function runDay(d) {
  simDay = d; const ds = dayStr(d); const dow = new Date(ds).getUTCDay(); // 5 = Friday (busy)
  const busy = dow === 5 ? 1.5 : dow === 6 ? 1.2 : 1;
  await setClock(d, 4, 30);
  // morning purchase of whole chickens (crate ≈ 20 kg). need = whole demand + cut input for parts
  const cutIn = Math.max(0, ...PARTS.map((k) => (expectedDemand(k) * 1.15 * busy - T.qty(k)) / ITEMS[k].yield));
  const wholeNeed = expectedDemand('whole') * 1.1 * busy - T.qty('whole');
  let grams = Math.max(0, Math.ceil((cutIn + wholeNeed) / 1000)) * 1000; grams = Math.ceil(grams / 20000) * 20000 + rint(-3, 3) * 500;
  const price = rint(1050, 1180);
  const sup = d % 3 === 0 ? 'whole' : 'farm';
  const mode = sup === 'farm' ? (d % 5 === 2 ? 'partial' : 'credit') : (d === 12 || d === 24 ? 'partial' : 'cash');
  let pid = null;
  if (grams > 0) pid = await purchase(sup, 'whole', grams, price, mode);
  if (d === 10 && pid) { await tick(10); await editPurchase(pid, grams - 1500); } // weight typo corrected right away
  if (d % 3 === 1) { await tick(5); await purchase('offal', 'liver', rint(15, 25) * 1000, rint(850, 950), 'bank'); }
  // cutting
  await setClock(d, 5, 0);
  const lot = T.lots.whole.filter((l) => l.q > 0).slice(-1)[0];
  if (lot && cutIn > 0) { const inG = Math.min(Math.round(cutIn / 1000) * 1000, lot.q - 1000); if (inG > 5000) await cutChickens(lot.id, inG); }
  // sales 06:00..17:00
  await setClock(d, 6, 0);
  const n = Math.round(rint(20, 45) * busy);
  const voidAt = [3, 8, 13, 19, 26].includes(d) ? rint(3, n - 3) : -1;
  for (let i = 0; i < n; i++) {
    await tick(Math.floor(600 / n));
    const mode = wpick([['cash', 70], ['card', 12], ['credit', 10], ['partial', 4], ['barcode', 4]]);
    const isRest = mode === 'credit' && rnd() < 0.6;
    const cust = mode === 'credit' || mode === 'partial' ? (isRest ? rpick(['amir', 'sultan', 'hotel']) : rpick(['abukhalil', 'ummoh', 'noor'])) : null;
    const nl = rint(1, 3); const picks = new Set(); const lines = [];
    while (picks.size < nl) picks.add(wpick([['whole', 40], ['breast', 18], ['thigh', 16], ['wings', 7], ['backs', 6], ['minced', 7], ['liver', 6]]));
    for (const k of picks) {
      const [a, b] = ITEMS[k].kg; let g = Math.round((a + rnd() * (b - a)) * (isRest ? 5 : 1) * 1000 / 5) * 5;
      g = Math.min(g, T.qty(k) - 200); if (g >= 200) lines.push({ item: k, grams: g });
    }
    if (!lines.length) continue;
    const discount = mode === 'cash' && rnd() < 0.08 ? rint(1, 5) * 100 : 0;
    const opts = { lines, mode: mode === 'barcode' ? 'cash' : mode, cust, discount, barcode: mode === 'barcode' };
    if (mode === 'partial') { const g = lines.reduce((s, l) => s + v(ITEMS[l.item].sell, l.grams), 0); opts.partialPaid = Math.max(100, Math.round(g * 0.4 / 100) * 100); }
    if (d === 20 && i === 5) { opts.mode = 'credit'; opts.cust = 'hotel'; opts.tax = true; opts.label = '(tax invoice)'; }
    const id = await sale(opts);
    if (i === voidAt && id && T.saleRec[id].mode === 'cash') { // cashier typed wrong weight -> owner voids, cashier re-enters
      await tick(2); await voidSale(id, 'خطأ في الوزن');
      await tick(1); await sale({ ...opts, lines: opts.lines.map((l) => ({ ...l, grams: Math.max(200, l.grams - 250) })), label: '(re-entry)' });
    }
  }
  // specials
  await setClock(d, 16, 0);
  if (d === 18) { const s = Object.values(T.saleRec).find((x) => x.day === 17 && x.mode === 'credit' && !x.voided && x.open === x.total); if (s) await voidSale(s.id, 'العميل أرجع البضاعة'); }
  if (d === 12) { const s = Object.values(T.saleRec).find((x) => x.mode === 'credit' && x.cust === 'amir' && x.open >= 5000 && !x.voided); if (s) await creditNote(s.id, 2500, 'شكوى جودة'); }
  if (d === 27) { const s = Object.values(T.saleRec).find((x) => x.cust === 'noor' && x.open > 0 && !x.voided && x.mode === 'credit'); if (s) await writeOff(s.id); }
  if (d === 14) { await adjust('thigh', 'decrease', 1350, 'جرد فعلي - نقص'); await adjust('wings', 'increase', 400, 'جرد فعلي - زيادة'); }
  // collections
  await setClock(d, 16, 30);
  for (const c of Object.keys(CU)) if (T.cust[c] > 0 && rnd() < (CU[c].kind === 'restaurant' ? 0.25 : 0.3)) { await tick(3); await collect(c, Math.round(T.cust[c] * (rnd() < 0.5 ? 1 : 0.5) / 100) * 100, rnd() < 0.6 ? 'cash' : 'bank_transfer'); }
  // expenses
  await setClock(d, 17, 0);
  await expense('fuel', rint(60, 120) * 100, 'cash', 'وقود سيارة التوصيل');
  if (d === 1) await expense('rent', 600000, 'bank_transfer', 'إيجار شهر 10');
  if (d === 5) await expense('other', 32000, 'cash', 'أكياس وتغليف');
  if (d === 10) await expense('elec', 235000, 'bank_transfer', 'فاتورة كهرباء');
  if (d === 15) await expense('water', 28000, 'cash', 'فاتورة مياه');
  if (d === 22) await expense('maint', 45000, 'cash', 'صيانة ثلاجة');
  if (d === DAYS) { await expense('salaries', 420000, 'cash', 'راتب عامل 1'); await expense('salaries', 420000, 'bank_transfer', 'راتب عامل 2'); }
  // supplier payments (weekly to the farm by bank, partial)
  await setClock(d, 17, 30);
  if (d % 7 === 0) await paySupplier('farm', Math.round(T.supp.farm * 0.7 / 100) * 100, 'bank_transfer');
  if (d % 7 === 3 && T.supp.whole > 0) await paySupplier('whole', T.supp.whole, 'cash');
  // end of week: wastage of old parts lots, cash deposit
  await setClock(d, 18, 0);
  if (d % 7 === 0) {
    for (const k of ['breast', 'thigh', 'minced', 'liver']) { const l = T.lots[k].find((x) => x.q > 300); if (l) await wastage(k, l.id, Math.min(l.q - 100, rint(4, 12) * 100), 'expired'); }
    const T1111 = T.gl['1111']; if (T1111 > 800000) await depositCash(Math.floor((T1111 - 500000) / 10000) * 10000);
  }
  await dayEnd(d);
}

await setup();
for (let d = 1; d <= DAYS; d++) await runDay(d);

// ---------- final: per-customer / per-supplier / per-item, timings ----------
await setClock(DAYS, 19, 0);
const final = { params: { DAYS, SEED, TRANSFER_COST }, customers: [], suppliers: [], items: [], timings: {}, shadowGL: T.gl };
for (const [k, c] of Object.entries(CU)) {
  const sysC = q('select current_balance b from customers where id=?', c.id)[0].b;
  const debt = q(`select coalesce(sum(total_amount-amount_paid),0) v from debts where direction='receivable' and party_id=? and status in ('open','partial','overdue')`, c.id)[0].v;
  const ple = q(`select coalesce(sum(amount),0) v from payment_ledger_entries where party_type='customer' and party_id=? and delinked=0`, c.id)[0].v;
  const api1 = await api('owner', 'GET', `/customers/${c.id}`);
  final.customers.push({ key: k, name: c.name, truth: T.cust[k], customerBalance: sysC, apiCurrentBalance: api1.data?.currentBalance, debtsOpen: debt, ple });
}
for (const [k, s] of Object.entries(SU)) {
  const sysS = q('select current_balance b from suppliers where id=?', s.id)[0].b;
  const debt = q(`select coalesce(sum(total_amount-amount_paid),0) v from debts where direction='payable' and party_id=? and status in ('open','partial','overdue')`, s.id)[0].v;
  const ple = q(`select coalesce(sum(amount),0) v from payment_ledger_entries where party_type='supplier' and party_id=? and delinked=0`, s.id)[0].v;
  final.suppliers.push({ key: k, name: s.name, truth: T.supp[k], supplierBalance: sysS, debtsOpen: debt, ple: -ple });
}
const invRep = await api('owner', 'GET', '/reports/inventory');
for (const [k, it] of Object.entries(IT)) {
  const inv = q('select current_quantity_grams q, total_value v, average_cost a from inventory where item_id=?', it.id)[0] || {};
  const lots = q('select coalesce(sum(remaining_quantity_grams),0) q, coalesce(sum(round(remaining_quantity_grams*unit_purchase_price/1000.0)),0) v, sum(case when remaining_quantity_grams<0 then 1 else 0 end) neg from inventory_lots where item_id=?', it.id)[0];
  final.items.push({ key: k, truthQty: T.qty(k), truthValue: (T.lots[k] || []).reduce((s, l) => s + v(l.price, l.q), 0), invQty: inv.q, invValue: inv.v, avgCost: inv.a, lotQty: lots.q, lotValue: lots.v, negLots: lots.neg });
}
final.inventoryReport = invRep.data;
final.lastDayReports = reportCache[DAYS];
// performance with a month of data (5 calls each)
const perf = [
  ['GET', '/reports/dashboard'], ['GET', `/reports/sales?startDate=${dayStr(1)}&endDate=${dayStr(DAYS)}`], ['GET', `/reports/profit-loss?startDate=${dayStr(1)}&endDate=${dayStr(DAYS)}`],
  ['GET', '/accounting/trial-balance'], ['GET', `/accounting/ledger/1111?startDate=${dayStr(1)}&endDate=${dayStr(DAYS)}`], ['GET', '/sales?page=1&pageSize=20'], ['GET', '/sales?pageSize=500'],
  ['GET', '/debts/receivables?pageSize=500'], ['GET', '/inventory'], ['GET', '/reports/stock-vs-gl'], ['GET', '/reports/inventory'], ['GET', '/accounting/journal-entries?page=1&pageSize=20'],
  ['GET', `/accounting/reports/balance-sheet/pdf?asOfDate=${dayStr(DAYS)}`], ['GET', `/accounting/reports/income-statement/pdf?startDate=${dayStr(1)}&endDate=${dayStr(DAYS)}`],
  ['GET', `/customers/${CU.amir.id}/statement/pdf?startDate=${dayStr(1)}&endDate=${dayStr(DAYS)}`], ['GET', `/sales/report/pdf?startDate=${dayStr(1)}&endDate=${dayStr(DAYS)}`],
  ['GET', '/payments?pageSize=500'], ['GET', '/stock-transfer/source-lots'],
];
for (const [m, p] of perf) { const t = []; let st; for (let i = 0; i < 5; i++) { const t0 = performance.now(); const r = await request(B, m, p, { token: sessions.owner, raw: true }); await r.arrayBuffer(); st = r.status; t.push(performance.now() - t0); }
  t.sort((a, b) => a - b); final.timings[p] = { status: st, medianMs: Math.round(t[2]), maxMs: Math.round(t[4]) }; }
final.writeTimings = Object.fromEntries(Object.entries(timings).map(([k, a]) => { a.sort((x, y) => x - y); return [k, { n: a.length, p50: Math.round(a[Math.floor(a.length / 2)]), p95: Math.round(a[Math.floor(a.length * 0.95)]), max: Math.round(a[a.length - 1]) }]; }));
final.errors = errors; final.counts = q(`select (select count(*) from sales) sales, (select count(*) from sales where is_voided=1) voided, (select count(*) from journal_entries) jes, (select count(*) from purchases) purchases, (select count(*) from payments) payments, (select count(*) from stock_transfers) transfers, (select count(*) from wastage_records) wastage, (select count(*) from expenses) expenses`)[0];
fs.writeFileSync(path.join(OUT, 'final.json'), JSON.stringify(final, null, 2));

// ---------- markdown outputs ----------
const md = []; const cols = ['day', 'date', 'sales', 'T_cash', 'S_cash_gl', 'T_bank', 'S_bank_gl', 'T_AR', 'S_AR_gl', 'S_AR_custBal', 'S_AR_debtsOpen', 'S_AR_dash', 'T_AP', 'S_AP_gl', 'S_AP_suppBal', 'S_AP_debtsOpen', 'T_inv', 'S_inv_gl', 'S_inv_table', 'S_inv_lots', 'T_netIncome', 'S_netIncome_gl', 'S_PL_netProfit', 'errors_today'];
md.push(`# T8 daily reconciliation (${NAME}, seed ${SEED}, transfer-cost=${TRANSFER_COST}) — amounts in ₪`, '', 'T_ = shadow ledger (independent truth), S_ = system. Full columns in daily-recon.csv (minor units).', '');
md.push('| ' + cols.join(' | ') + ' |', '|' + cols.map(() => '---').join('|') + '|');
for (const r of rows) md.push('| ' + cols.map((c) => (typeof r[c] === 'number' && !['day', 'sales', 'errors_today'].includes(c) ? ils(r[c]) : r[c] ?? '')).join(' | ') + ' |');
fs.writeFileSync(path.join(OUT, 'daily-recon.md'), md.join('\n'));
// divergence log: first appearance per metric + all changes
const first = {}; for (const e of divLog) if (!(e.metric in first)) first[e.metric] = e;
const dl = [`# Divergence log (${NAME}) — every operation that changed (system − truth) of a metric`, '', '## First appearance per metric', '', '| metric | day | time | operation | Δ after (₪ or g) |', '|---|---|---|---|---|'];
for (const [k, e] of Object.entries(first)) dl.push(`| ${k} | ${e.day} ${e.date} | ${e.at} | ${e.op} | ${k.startsWith('qty') || k.startsWith('lotqty') ? e.after + ' g' : ils(e.after)} |`);
const byOpType = {}; for (const e of divLog) { const t = e.op.replace(/sale#\d+/, 'sale').replace(/[\d.]+kg|lot \d+|PUR#\d+|SAL-\S+|[\d.]+ (cash|bank_transfer)| \d+\.\d\d/g, '').replace(/\s+/g, ' ').trim(); const k = `${t} → ${e.metric}`; byOpType[k] = byOpType[k] || { n: 0, total: 0 }; byOpType[k].n++; byOpType[k].total += e.change; }
dl.push('', '## Aggregated by operation type → metric (count, cumulative Δ)', '', '| op type → metric | count | cumulative Δ |', '|---|---|---|');
for (const [k, x] of Object.entries(byOpType).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))) dl.push(`| ${k} | ${x.n} | ${k.includes('qty') ? x.total + ' g' : ils(x.total)} |`);
dl.push('', '## All changes', '', '| day | time | op | metric | before | after | change |', '|---|---|---|---|---|---|---|');
for (const e of divLog) dl.push(`| ${e.day} | ${e.at} | ${e.op} | ${e.metric} | ${e.before} | ${e.after} | ${e.change} |`);
fs.writeFileSync(path.join(OUT, 'divergence-log.md'), dl.join('\n'));
fs.writeFileSync(path.join(OUT, 'errors.md'), ['# Errors / blocked operations', '', ...errors.map((e) => '- ' + JSON.stringify(e))].join('\n'));
console.log('DONE', JSON.stringify(final.counts), 'errors', errors.length);
