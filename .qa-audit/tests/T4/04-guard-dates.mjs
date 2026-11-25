// T4-04: D-14 insufficient-balance guard — date semantics (expense/purchase use document date, payments use current balance),
// back-dated documents vs JE date. Fresh dev instance t4b (cash 1111 = 0).
import { login, snapshot, makeLog, short, fund, q, q1, QA } from './lib.mjs';
const log = makeLog(`${QA}/tests/T4/04-guard-dates.out.txt`);
const c = await login('t4b');
const DB = c.meta.db;
const cash = () => snapshot(DB).gl['1111'] ?? 0;
const run = async (label, fn) => { const r = await fn(); log(`\n## ${label}\n  resp:`, short(r), ' cash 1111 now =', cash()); return r; };
log('# T4-04 guard/dates', new Date().toISOString(), 'cash', cash());

// G1: cash exists today; back-dated expense is refused
await fund(c, DB, 50000); // today
await run('G1. today cash 500.00; expense 100.00 dated 2026-11-01', () => c.post('/expenses', { categoryId: 1, description: 'backdated', amount: 10000, paymentMethod: 'cash', expenseDate: '2026-11-01' }));
await run('G1b. same expense dated today', () => c.post('/expenses', { categoryId: 1, description: 'today', amount: 10000, paymentMethod: 'cash' }));

// G2: money existed in the past, spent today, back-dated expense passes -> negative cash
await fund(c, DB, 100000, '1111', '2026-11-01T10:00:00.000Z'); // dated 1 Nov
log('\ncash after 2nd funding (dated 2026-11-01):', cash());
const P = (await c.post('/purchases', { supplierId: 1, lines: [{ itemId: 2, weightGrams: 10000, pricePerKg: 14000 }], amountPaid: 0 })).data.id;
await run('G2a. pay supplier 1400.00 cash today (all cash)', () => c.post('/payments/purchase', { purchaseId: P, amount: 140000, paymentMethod: 'cash' }));
await run('G2b. purchase payment 1.00 now (current-balance guard)', async () => c.post('/payments/purchase', { purchaseId: (await c.post('/purchases', { supplierId: 1, lines: [{ itemId: 2, weightGrams: 1000, pricePerKg: 100 }], amountPaid: 0 })).data.id, amount: 100, paymentMethod: 'cash' }));
await run('G2c. expense 900.00 dated 2026-11-02 (as-of balance 1000.00)', () => c.post('/expenses', { categoryId: 1, description: 'backdated passes', amount: 90000, paymentMethod: 'cash', expenseDate: '2026-11-02' }));
await run('G2d. purchase paid at creation 800.00 cash, purchaseDate 2026-11-02', () => c.post('/purchases', { supplierId: 1, purchaseDate: '2026-11-02', lines: [{ itemId: 3, weightGrams: 10000, pricePerKg: 8000 }], amountPaid: 80000, paymentMethod: 'cash' }));
await run('G2e. supplier advance 500.00 dated 2026-11-02', () => c.post('/payments/advance', { partyType: 'supplier', partyId: 1, amount: 50000, paymentMethod: 'cash', paymentDate: '2026-11-02' }));
await run('G2f. future-dated expense 2027-01-01 100.00', () => c.post('/expenses', { categoryId: 1, description: 'future', amount: 10000, paymentMethod: 'cash', expenseDate: '2027-01-01' }));

// JE date vs document date
const ex = q(DB, "select e.expense_number, e.expense_date ed, j.entry_date jd from expenses e join journal_entries j on j.source_type='expense' and j.source_id=e.id order by e.id desc limit 3")
  .map((r) => ({ n: r.expense_number, expenseDate: new Date(r.ed).toISOString(), jeDate: new Date(r.jd).toISOString() }));
log('\nJE date vs expense date:', ex);
const pu = q(DB, "select p.purchase_number, p.purchase_date pd, j.entry_date jd from purchases p join journal_entries j on j.source_type='purchase' and j.source_id=p.id order by p.id desc limit 1").map((r) => ({ n: r.purchase_number, purchaseDate: new Date(r.pd).toISOString(), jeDate: new Date(r.jd).toISOString() }));
log('JE date vs purchase date:', pu);
const tbNov2 = await c.get('/accounting/trial-balance?endDate=2026-11-02');
const row5400 = (tbNov2.data || []).find((r) => r.accountCode === '5400');
const plNov2 = await c.get('/reports/profit-loss?startDate=2026-11-02&endDate=2026-11-02');
log('Trial balance to 2026-11-02, 5400:', row5400 ? { d: row5400.endingDebit, c: row5400.endingCredit } : 'absent', ' vs /reports/profit-loss 2026-11-02 expenses:', plNov2.data?.expenses);
const tbNov1 = await c.get('/accounting/trial-balance?endDate=2026-11-01');
log('Trial balance to 2026-11-01, 1111:', (tbNov1.data || []).find((r) => r.accountCode === '1111')?.endingDebit);
log('\nFINAL cash 1111 =', cash(), '(negative => guard bypassed)');
log.save();
