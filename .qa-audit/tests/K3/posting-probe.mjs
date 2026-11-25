// K3 empirical posting probe. Runs against instance k3 (port 3192, fresh dev DB).
// usage: node posting-probe.mjs
import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';
import { DatabaseSync } from 'node:sqlite';
const BASE = 'http://localhost:3192/v1';
const DB = 'E:/DEV/Chicken FMS/.qa-audit/envs/k3/app.db';
const q = (sql, ...p) => { const db = new DatabaseSync(DB, { readOnly: true }); try { return db.prepare(sql).all(...p); } finally { db.close(); } };
const bal = (code) => q(`select coalesce(sum(l.debit_amount),0)-coalesce(sum(l.credit_amount),0) b from journal_entry_lines l join accounts a on a.id=l.account_id join journal_entries e on e.id=l.journal_entry_id where a.code=? and e.is_posted=1`, code)[0].b;
const snap = () => ({ cash: bal('1111'), bank: bal('1112-001'), ar: bal('1120'), inv: bal('1131'), rev: bal('4110'), ap: bal('2110'), exp5400: bal('5400') });
const log = (k, v) => console.log(k.padEnd(48), typeof v === 'string' ? v : JSON.stringify(v));
const out = {};

const a = await connect(BASE, 'admin', 'admin123');

// ---------- setup: bank account, accountant user ----------
const bankAcc = q(`select id from accounts where code='1112-001'`)[0].id;
let r = await a.post('/bank-accounts', { name: 'QA Bank', accountId: bankAcc, isDefault: true });
log('create bank account', `${r.status} id=${r.data?.id}`);
const bankId = r.data?.id;
r = await a.get('/users/roles');
const accRole = (r.data || []).find((x) => x.name === 'accountant');
r = await a.post('/users', { username: 'k3acc', password: 'Password@123', fullName: 'K3 Accountant', roleId: accRole?.id });
log('create accountant', `${r.status}`);
const acc = await connect(BASE, 'k3acc', 'Password@123');

// ---------- AUTHZ: admin-only routes declared with @Roles but no RolesGuard ----------
for (const [m, p, b] of [
  ['GET', '/system/backup/config'], ['GET', '/system/backups'], ['GET', '/accounting/accounts/1/can-delete'],
  ['GET', '/tax/templates'], ['GET', '/credit-notes'], ['GET', '/purchases'], ['GET', '/settings'],
]) {
  const rr = await request(BASE, m, p, { token: acc.token, body: b });
  log(`AUTHZ accountant ${m} ${p}`, `${rr.status}`);
  out[`authz ${m} ${p}`] = rr.status;
}

// ---------- cash in: cash sale of item 2 ----------
const sale = (body) => a.post('/sales', body);
r = await sale({ saleType: 'cash', lines: [{ itemId: 2, weightGrams: 10000, pricePerKg: 3000 }], payments: [{ amount: 30000, paymentMethod: 'cash' }] });
log('cash sale 10kg item2 @30', `${r.status} cost=${r.data?.totalCost}`);
log('  GL after cash sale', snap());

// ---------- K3-001: credit sale + /payments/sale + void ----------
let s0 = snap();
r = await sale({ saleType: 'credit', customerId: 1, lines: [{ itemId: 3, weightGrams: 2000, pricePerKg: 5000 }] });
const creditSaleId = r.data?.id; log('credit sale 10000 cust1', `${r.status} id=${creditSaleId}`);
r = await a.post('/payments/sale', { saleId: creditSaleId, amount: 4000, paymentMethod: 'cash' });
log('payment 4000 via /payments/sale', `${r.status}`);
r = await a.post(`/sales/${creditSaleId}/void`, { reason: 'k3 probe void' });
log('void credit sale', `${r.status} ${r.ok ? '' : JSON.stringify(r.body)}`);
let s1 = snap();
const d1 = Object.fromEntries(Object.keys(s1).map((k) => [k, s1[k] - s0[k]]));
log('  NET GL delta (credit sale+pay+void) expect all 0', d1);
out.k3_001 = d1;
log('  customer1 balance', q(`select current_balance from customers where id=1`)[0]);

// ---------- K3-002: /sales/:id/payments creates no JE ----------
r = await sale({ saleType: 'credit', customerId: 2, lines: [{ itemId: 3, weightGrams: 2000, pricePerKg: 5000 }] });
const cs2 = r.data?.id;
s0 = snap();
r = await a.post(`/sales/${cs2}/payments`, { amount: 3000, paymentMethod: 'cash' });
log('POST /sales/:id/payments 3000', `${r.status} ${r.ok ? '' : JSON.stringify(r.body)}`);
s1 = snap();
const pay2 = q(`select id from payments where reference_type='sale' and reference_id=? order by id desc limit 1`, cs2)[0];
log('  JE rows for that payment', q(`select count(*) n from journal_entries where source_type='payment' and source_id=?`, pay2?.id ?? -1)[0]);
log('  GL delta (expect cash +3000, AR -3000)', { cash: s1.cash - s0.cash, ar: s1.ar - s0.ar });
log('  debt / customer2 balance', { debt: q(`select total_amount,amount_paid,status from debts where source_type='sale' and source_id=?`, cs2)[0], cust: q(`select current_balance from customers where id=2`)[0] });
out.k3_002 = { cash: s1.cash - s0.cash, ar: s1.ar - s0.ar };
// payment on voided sale
r = await a.post('/payments/sale', { saleId: creditSaleId, amount: 1000, paymentMethod: 'cash' });
log('payment 1000 on VOIDED sale', `${r.status} ${r.ok ? 'ACCEPTED' : JSON.stringify(r.body?.error?.code ?? r.body)}`);
out.payOnVoided = r.status;

// ---------- K3-003: mixed tender ----------
s0 = snap();
r = await sale({ saleType: 'cash', lines: [{ itemId: 4, weightGrams: 2000, pricePerKg: 5000 }], payments: [{ amount: 5000, paymentMethod: 'cash' }, { amount: 5000, paymentMethod: 'bank_transfer', bankAccountId: bankId }] });
s1 = snap();
log('mixed sale cash5000+bank5000', `${r.status}`);
log('  GL delta (expect cash+5000 bank+5000)', { cash: s1.cash - s0.cash, bank: s1.bank - s0.bank });
out.k3_003 = { cash: s1.cash - s0.cash, bank: s1.bank - s0.bank };

// ---------- expense by bank_transfer (legacy path ignores bank) ----------
s0 = snap();
r = await a.post('/expenses', { amount: 2000, description: 'k3 bank expense', paymentMethod: 'bank_transfer', bankAccountId: bankId });
s1 = snap();
log('expense 2000 bank_transfer', `${r.status} ${r.ok ? '' : JSON.stringify(r.body?.error ?? r.body)}`);
log('  GL delta (expect bank -2000)', { cash: s1.cash - s0.cash, bank: s1.bank - s0.bank, exp: s1.exp5400 - s0.exp5400 });
out.expenseBank = { status: r.status, cash: s1.cash - s0.cash, bank: s1.bank - s0.bank };

// ---------- K3-004: purchase with tax ----------
s0 = snap();
r = await a.post('/purchases', { supplierId: 1, lines: [{ itemId: 2, weightGrams: 1000, pricePerKg: 2000 }], taxAmount: 300 });
s1 = snap();
log('credit purchase 2000 + tax 300', `${r.status} grandTotal=${r.data?.grandTotal}`);
log('  GL AP delta (expect -2300)', { ap: s1.ap - s0.ap, inv: s1.inv - s0.inv });
log('  supplier1 balance / debt', { sup: q(`select current_balance from suppliers where id=1`)[0], debt: q(`select total_amount from debts where source_type='purchase' order by id desc limit 1`)[0] });
out.k3_004 = { ap: s1.ap - s0.ap };
r = await a.post('/purchases', { supplierId: 1, lines: [{ itemId: 2, weightGrams: 1000, pricePerKg: 2000 }], taxAmount: 300, amountPaid: 2300, paymentMethod: 'cash' });
log('purchase paid in full incl tax (cash)', `${r.status} ${r.ok ? '' : JSON.stringify(r.body?.error?.code ?? r.body)}`);
out.k3_004_paid = r.status;

// ---------- K3-007: purchase payment & supplier balance ----------
const purId = q(`select id from purchases order by id desc limit 1`)[0].id;
const unpaidPur = q(`select id, grand_total, amount_paid from purchases where payment_status!='paid' and id>3 order by id limit 1`)[0];
const supB0 = q(`select current_balance b from suppliers where id=1`)[0].b;
r = await a.post('/payments/purchase', { purchaseId: unpaidPur.id, amount: 1000, paymentMethod: 'cash' });
const supB1 = q(`select current_balance b from suppliers where id=1`)[0].b;
log('purchase payment 1000', `${r.status} supplier balance ${supB0} -> ${supB1} (expect -1000)`);
out.k3_007 = { status: r.status, before: supB0, after: supB1 };

// ---------- K3-005: purchase numbering after delete ----------
const mk = () => a.post('/purchases', { supplierId: 2, lines: [{ itemId: 5, weightGrams: 1000, pricePerKg: 1000 }] });
const p1 = await mk(); const p2 = await mk(); const p3 = await mk();
log('3 purchases', [p1, p2, p3].map((x) => `${x.status}:${x.data?.purchaseNumber}`).join(' '));
r = await a.del(`/purchases/${p2.data?.id}`);
log('delete middle purchase', `${r.status}`);
const p4 = await mk();
log('next purchase after delete', `${p4.status} ${p4.ok ? p4.data?.purchaseNumber : JSON.stringify(p4.body?.error ?? p4.body)}`);
const p5 = await mk();
log('and again', `${p5.status} ${p5.ok ? p5.data?.purchaseNumber : JSON.stringify(p5.body?.error?.code ?? p5.body)}`);
out.k3_005 = [p4.status, p5.status];
log('  JE for deleted purchase remaining', q(`select count(*) n from journal_entries where source_type='purchase' and source_id=?`, p2.data?.id ?? -1)[0]);

// ---------- K3-008: two lines same item double-allocate ----------
// item 6 has a single seed lot of 50 kg. Sell 30kg + 30kg in one sale.
r = await sale({ saleType: 'cash', lines: [{ itemId: 6, weightGrams: 30000, pricePerKg: 4000 }, { itemId: 6, weightGrams: 30000, pricePerKg: 4000 }], payments: [{ amount: 240000, paymentMethod: 'cash' }] });
log('sale 2x30kg of item6 (only 50kg in stock)', `${r.status} ${r.ok ? 'ACCEPTED' : JSON.stringify(r.body?.error?.code ?? r.body)}`);
log('  item6 inventory/lots', { inv: q(`select current_quantity_grams q, total_value v from inventory where item_id=6`)[0], lots: q(`select id, remaining_quantity_grams from inventory_lots where item_id=6`) });
out.k3_008 = r.status;

// ---------- K3-009: adjustment decrease leaves lots untouched ----------
r = await a.post('/inventory/adjustments', { itemId: 5, adjustmentType: 'decrease', quantityGrams: 5000, reason: 'k3 shrink' });
log('adjust item5 -5kg', `${r.status} ${r.ok ? '' : JSON.stringify(r.body?.error ?? r.body)}`);
log('  item5 inv vs lots', { inv: q(`select current_quantity_grams q from inventory where item_id=5`)[0], lots: q(`select sum(remaining_quantity_grams) q from inventory_lots where item_id=5`)[0] });

// ---------- wastage: no SLE, stock acct ----------
const lot4 = q(`select id from inventory_lots where item_id=4 and remaining_quantity_grams>1000 limit 1`)[0];
r = await acc.post('/wastage', { lotId: lot4.id, quantityGrams: 1000, wastageType: 'spoilage', reason: 'k3' });
log('wastage 1kg by ACCOUNTANT', `${r.status}`);
log('  SLE rows for wastage', q(`select count(*) n from stock_ledger_entries where voucher_type='wastage'`)[0]);

// ---------- stock transfer: no JE ----------
const lot3 = q(`select id from inventory_lots where item_id=3 and remaining_quantity_grams>=5000 limit 1`)[0];
const invTot0 = q(`select sum(total_value) v from inventory`)[0].v; s0 = snap();
r = await a.post('/stock-transfer', { sourceLotId: lot3.id, lines: [{ itemId: 4, weightGrams: 5000, unitCost: 99999 }] });
const invTot1 = q(`select sum(total_value) v from inventory`)[0].v; s1 = snap();
log('stock transfer 5kg with inflated unitCost', `${r.status} ${r.ok ? '' : JSON.stringify(r.body?.error ?? r.body)}`);
log('  inventory.total_value delta vs GL 1131 delta', { invTable: invTot1 - invTot0, gl1131: s1.inv - s0.inv, jeForTransfer: q(`select count(*) n from journal_entries where source_type in ('transfer','stock_transfer')`)[0].n });
out.transfer = { invTable: invTot1 - invTot0, gl: s1.inv - s0.inv };

// ---------- debt write-off: no GL ----------
r = await sale({ saleType: 'credit', customerId: 3, lines: [{ itemId: 4, weightGrams: 1000, pricePerKg: 5000 }] });
const debt = q(`select id from debts where source_type='sale' and source_id=?`, r.data?.id)[0];
s0 = snap();
r = await a.post(`/debts/${debt.id}/write-off`, { reason: 'k3' });
s1 = snap();
log('debt write-off 5000', `${r.status} AR delta=${s1.ar - s0.ar} (expect -5000), JE count unchanged`);

// ---------- invariants ----------
log('INVARIANT total dr/cr', q(`select sum(debit_amount) dr, sum(credit_amount) cr from journal_entry_lines`)[0]);
log('INVARIANT unbalanced JEs', q(`select journal_entry_id, sum(debit_amount) dr, sum(credit_amount) cr from journal_entry_lines group by 1 having dr<>cr`));
log('INVARIANT negative lots', q(`select id,item_id,remaining_quantity_grams from inventory_lots where remaining_quantity_grams<0`));
log('INVARIANT inv vs lots', q(`select i.item_id, i.current_quantity_grams inv, (select coalesce(sum(remaining_quantity_grams),0) from inventory_lots l where l.item_id=i.item_id) lots from inventory i`));
log('INVARIANT GL1131 vs inventory.total_value', { gl: bal('1131'), table: q(`select sum(total_value) v from inventory`)[0].v });
log('JE by source', q(`select source_type, count(*) n from journal_entries group by 1`));
console.log('\nSUMMARY ' + JSON.stringify(out));
