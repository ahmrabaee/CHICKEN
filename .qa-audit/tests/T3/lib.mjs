// T3 shared helpers: API client, SQL, GL/subledger snapshots, PDF text extraction.
import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
process.removeAllListeners('warning');
process.on('warning', (w) => { if (w.name !== 'ExperimentalWarning') console.warn(w); });

export const PORT = Number(process.env.T3_PORT || 3105);
export const BASE = `http://localhost:${PORT}/v1`;
export const DB = `E:/DEV/Chicken FMS/.qa-audit/envs/${process.env.T3_ENV || 't3'}/app.db`;
export { connect, request };

export const q = (sql, ...p) => {
  const db = new DatabaseSync(DB, { readOnly: true });
  try { return db.prepare(sql).all(...p).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))); } finally { db.close(); }
};
export const q1 = (sql, ...p) => q(sql, ...p)[0];
export const w = (sql, ...p) => { const db = new DatabaseSync(DB); try { return db.prepare(sql).run(...p); } finally { db.close(); } };

export const bal = (code) => q1(`select coalesce(sum(l.debit_amount),0)-coalesce(sum(l.credit_amount),0) b from journal_entry_lines l join accounts a on a.id=l.account_id join journal_entries e on e.id=l.journal_entry_id where a.code=? and e.is_posted=1`, code).b;
export const CODES = ['1111', '1112-001', '1120', '1125', '1131', '2110', '2120', '4110', '4200', '5100', '5400'];
export const gl = () => Object.fromEntries(CODES.map((c) => [c, bal(c)]));
export const diff = (a, b) => Object.fromEntries(Object.keys(b).map((k) => [k, (b[k] ?? 0) - (a[k] ?? 0)]).filter(([, v]) => v !== 0));

// Customer-level view across ALL representations
export function custView(cid) {
  const c = q1(`select current_balance from customers where id=?`, cid);
  const debtsOpen = q1(`select coalesce(sum(total_amount-amount_paid),0) s from debts where direction='receivable' and party_type='customer' and party_id=? and status not in ('paid','written_off')`, cid).s;
  const pleAll = q1(`select coalesce(sum(amount),0) s from payment_ledger_entries where party_type='customer' and party_id=? and delinked=0`, cid).s;
  return { custBalance: c?.current_balance, debtsOpen, pleSum: pleAll };
}
export async function apiCustView(a, cid) {
  const bal = await a.get(`/debts/receivables?customerId=${cid}&pageSize=100`);
  const party = await a.get(`/reconciliation/outstanding/party?partyType=customer&partyId=${cid}`);
  const cust = await a.get(`/customers/${cid}`);
  return {
    apiCustomerBalance: cust.data?.currentBalance,
    apiDebtsRemaining: (Array.isArray(bal.data) ? bal.data : (bal.data?.items ?? [])).filter((d) => !['settled', 'written_off'].includes(d.status)).reduce((s, d) => s + d.remainingAmount, 0),
    apiPartyOutstanding: party.data?.outstanding ?? party.data,
  };
}

export const out = [];
export function log(k, v) {
  const line = `${String(k).padEnd(58)} ${typeof v === 'string' ? v : JSON.stringify(v)}`;
  console.log(line); out.push(line);
}
export const short = (r) => `${r.status}${r.ok ? '' : ' ' + JSON.stringify(r.body?.error?.code ?? r.body?.message ?? r.body)}`;

export async function setup(a) {
  // bank account + accountant (idempotent)
  let bank = q1(`select id from bank_accounts order by id limit 1`);
  if (!bank) {
    const accId = q1(`select id from accounts where code='1112-001'`).id;
    const r = await a.post('/bank-accounts', { name: 'T3 Bank', accountId: accId, isDefault: true });
    bank = { id: r.data?.id };
  }
  let acc;
  if (!q1(`select id from users where username='t3acc'`)) {
    const roles = await a.get('/users/roles');
    const role = (roles.data || []).find((x) => x.name === 'accountant');
    await a.post('/users', { username: 't3acc', password: 'Password@123', fullName: 'T3 Accountant', roleId: role?.id });
  }
  acc = await connect(BASE, 't3acc', 'Password@123');
  return { bankId: bank.id, acc };
}

// Restock: credit purchase (no cash needed)
export async function restock(a, itemId, grams, pricePerKg, supplierId = 1) {
  return a.post('/purchases', { supplierId, lines: [{ itemId, weightGrams: grams, pricePerKg }] });
}

export async function setSetting(a, key, value) {
  const r = await a.put(`/settings/${key}`, { value });
  if (!r.ok) {
    // fallback: direct write in own DB
    w(`update system_settings set value=? where key=?`, String(value), key);
  }
  return r;
}

export async function pdfText(a, path) {
  const res = await a.raw('GET', path, { raw: true });
  const buf = new Uint8Array(await res.arrayBuffer());
  if (res.status !== 200) return { status: res.status, text: new TextDecoder().decode(buf).slice(0, 300) };
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: buf, disableFontFace: true, verbosity: 0 }).promise;
  let text = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    text += tc.items.map((i) => i.str).join(' ') + '\n';
  }
  return { status: 200, text };
}

export function save(file) {
  fs.writeFileSync(file, out.join('\n') + '\n');
}
