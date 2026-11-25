// T1-03: back-dated documents (doc date vs JE date) + freeze date + closed accounting period enforcement matrix
// requires t1 after 01-clean-slate.mjs (admin/Admin@12345, items 1,2, customer 1, suppliers 1,2, bank 1)
import fs from 'node:fs';
import { env, connect, logger, err, failing } from './lib.mjs';
const E = env('t1', 3101); const { log, lines } = logger();
const a = await connect(E.BASE, 'admin', 'Admin@12345');
const iso = (ms) => new Date(ms).toISOString();
const lastJe = () => E.q(`select id from journal_entries order by id desc limit 1`)[0]?.id ?? 0;
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

// ---------- Phase A: back-dated docs, no lock ----------
log('## Phase A: back-dated documents (no lock) — compare document date with JE entry_date');
let r = await a.post('/expenses', { categoryId: 9, description: 'backdated', amount: 1000, paymentMethod: 'credit', supplierId: 1, expenseDate: '2026-10-15' });
let je = E.q(`select entry_date from journal_entries where source_type='expense' and source_id=?`, r.data?.id)[0];
log(`expense expenseDate=2026-10-15 -> ${r.status} doc=${r.data?.expenseDate} JE date=${je && iso(je.entry_date)}`);
r = await a.post('/purchases', { supplierId: 1, purchaseDate: '2026-10-15', lines: [{ itemId: 1, weightGrams: 1000, pricePerKg: 1500 }] });
je = E.q(`select entry_date from journal_entries where source_type='purchase' and source_id=?`, r.data?.id)[0];
log(`purchase purchaseDate=2026-10-15 -> ${r.status} doc=${r.data?.purchaseDate} JE date=${je && iso(je.entry_date)}`);
const credit1 = (await a.post('/sales', { saleType: 'credit', customerId: 1, lines: [{ itemId: 2, weightGrams: 1000, pricePerKg: 4000 }] })).data;
r = await a.post('/payments/sale', { saleId: credit1.id, amount: 500, paymentMethod: 'cash', paymentDate: '2026-10-15' });
je = E.q(`select entry_date from journal_entries where source_type='payment' and source_id=?`, r.data?.id)[0];
log(`sale payment paymentDate=2026-10-15 (for a sale dated today!) -> ${r.status} ${err(r)} doc=${r.data?.paymentDate} JE date=${je && iso(je.entry_date)}`);

// prerequisites per lock phase
async function prereq(tag) {
  const s = (await a.post('/sales', { saleType: 'cash', lines: [{ itemId: 1, weightGrams: 1000, pricePerKg: 2500 }], payments: [{ amount: 2500, paymentMethod: 'cash' }] })).data;
  const c = (await a.post('/sales', { saleType: 'credit', customerId: 1, lines: [{ itemId: 1, weightGrams: 1000, pricePerKg: 2500 }] })).data;
  const p = (await a.post('/payments/sale', { saleId: c.id, amount: 1000, paymentMethod: 'cash' })).data;
  const x = (await a.post('/expenses', { categoryId: 9, description: 'lock ' + tag, amount: 700, paymentMethod: 'cash' })).data;
  const pu = (await a.post('/purchases', { supplierId: 2, lines: [{ itemId: 2, weightGrams: 1000, pricePerKg: 2500 }] })).data;
  const pu2 = (await a.post('/purchases', { supplierId: 2, lines: [{ itemId: 2, weightGrams: 1000, pricePerKg: 2500 }] })).data;
  const c2 = (await a.post('/sales', { saleType: 'credit', customerId: 1, lines: [{ itemId: 1, weightGrams: 1000, pricePerKg: 2500 }] })).data;
  const lot = E.q(`select id from inventory_lots where item_id=1 and remaining_quantity_grams>2000 order by id limit 1`)[0].id;
  return { s, c, p, x, pu, pu2, c2, lot };
}
const ops = (P) => [
  ['create cash sale (today)', () => a.post('/sales', { saleType: 'cash', lines: [{ itemId: 1, weightGrams: 500, pricePerKg: 2500 }], payments: [{ amount: 1250, paymentMethod: 'cash' }] })],
  ['void sale', () => a.post(`/sales/${P.s.id}/void`, { reason: 'lock test' })],
  ['cancel payment', () => a.post(`/payments/${P.p.id}/cancel`, { reason: 'lock test' })],
  ['sale payment dated yesterday', () => a.post('/payments/sale', { saleId: P.c.id, amount: 100, paymentMethod: 'cash', paymentDate: yesterday })],
  ['create expense dated yesterday', () => a.post('/expenses', { categoryId: 9, description: 'x', amount: 100, paymentMethod: 'cash', expenseDate: yesterday })],
  ['update expense amount', () => a.put(`/expenses/${P.x.id}`, { amount: 900 })],
  ['delete expense', () => a.del(`/expenses/${P.x.id}`)],
  ['create purchase dated yesterday', () => a.post('/purchases', { supplierId: 2, purchaseDate: yesterday, lines: [{ itemId: 2, weightGrams: 1000, pricePerKg: 2500 }] })],
  ['update purchase (re-post)', () => a.put(`/purchases/${P.pu2.id}`, { supplierId: 2, lines: [{ itemId: 2, weightGrams: 2000, pricePerKg: 2500 }] })],
  ['delete purchase (hard delete JE)', () => a.del(`/purchases/${P.pu.id}`)],
  ['credit note create+submit', async () => { const cn = await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: P.c2.id, amount: 500, reason: 'lock' }); return cn.ok ? a.post(`/credit-notes/${cn.data.id}/submit`) : cn; }],
  ['wastage', () => a.post('/wastage', { lotId: P.lot, quantityGrams: 100, reason: 'spoiled' })],
  ['stock adjustment', () => a.post('/inventory/adjustments', { itemId: 2, adjustmentType: 'decrease', quantityGrams: 100, reason: 'lock' })],
  ['manual JE dated yesterday + post', async () => { const j = await a.post('/accounting/journal-entries', { description: 'lock', entryDate: yesterday, lines: [{ accountId: E.acctId('1210'), debit: 100 }, { accountId: E.acctId('3100'), credit: 100 }] }); return j.ok ? a.post(`/accounting/journal-entries/${j.data.id}/post`) : j; }],
  ['debt write-off', async () => { const d = E.q(`select id from debts where source_type='sale' and source_id=?`, P.c2.id)[0]; return a.post(`/debts/${d.id}/write-off`, { reason: 'lock' }); }],
  ['advance payment customer', () => a.post('/payments/advance', { partyType: 'customer', partyId: 1, amount: 100, paymentMethod: 'cash', paymentDate: yesterday })],
];
async function runPhase(title, P) {
  log(`\n## ${title}`);
  const res = [];
  for (const [name, fn] of ops(P)) {
    const j0 = lastJe(); const r2 = await fn(); const j1 = lastJe();
    const code = r2.body?.error?.code ?? '';
    const blocked = !r2.ok;
    log(`  ${blocked ? 'BLOCKED' : 'ALLOWED'} [${r2.status}] ${name} ${code} newJEs=${j1 - j0}${blocked && !/FREEZE|PERIOD/.test(code) ? ' (blocked for other reason: ' + err(r2).slice(0, 120) + ')' : ''}`);
    res.push({ name, status: r2.status, code });
  }
  return res;
}
const PB = await prereq('B'); const PC = await prereq('C');
// ---------- Phase B: freeze date tomorrow ----------
r = await a.put('/settings/accounting_freeze_date', { value: tomorrow });
log(`\nset accounting_freeze_date=${tomorrow}:`, r.status, err(r), 'stored:', E.q(`select value from system_settings where key='accounting_freeze_date'`)[0]);
const rb = await runPhase(`Phase B: accounting_freeze_date=${tomorrow} (everything dated today/yesterday is frozen)`, PB);
r = await a.del('/settings/accounting_freeze_date'); log('remove freeze date', r.status, err(r));
// ---------- Phase C: closed accounting period (no API -> SQL) ----------
const now = new Date(); const ms = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1); const me = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999);
E.w(`insert into accounting_periods (start_date,end_date,is_closed,closed_at,company_id,created_at,updated_at) values (?,?,1,?,NULL,?,?)`, ms, me, Date.now(), Date.now(), Date.now());
r = await a.put('/settings/period_lock_enabled', { value: 'true' }); log('\nperiod_lock_enabled=true', r.status, err(r), 'closed period', iso(ms), '..', iso(me), '(company_id NULL)');
const rc = await runPhase('Phase C: current month CLOSED + period_lock_enabled', PC);
E.w(`update accounting_periods set company_id=1`);
const PD = await (async () => { await a.put('/settings/period_lock_enabled', { value: 'false' }); const p = await prereq('D'); await a.put('/settings/period_lock_enabled', { value: 'true' }); return p; })();
const rd = await runPhase('Phase D: same closed period but company_id=1 (guard is called with companyId null/undefined?)', PD);
await a.put('/settings/period_lock_enabled', { value: 'false' });
log('\nSUMMARY freeze:', rb.filter((x) => x.status < 300).map((x) => x.name).join(' | '));
log('SUMMARY closed period (company NULL):', rc.filter((x) => x.status < 300).map((x) => x.name).join(' | '));
log('SUMMARY closed period (company 1):', rd.filter((x) => x.status < 300).map((x) => x.name).join(' | '));
log('invariants:', failing(E.checks()));
fs.writeFileSync(new URL('./03-period-lock.out.txt', import.meta.url), lines.join('\n'));
