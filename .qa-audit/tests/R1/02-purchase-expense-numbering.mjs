// R1-02: purchase VAT (QA-019), expense bank routing (QA-017/018), numbering (QA-029/H-3), purchase edit/delete (QA-030), validation (QA-040)
import { setup, glx, dl, jeCheck, L, errc, log, saveLog, must, q, q1, newItem, bankId } from './lib2.mjs';
const { c, db } = await setup();
const bid = await bankId(c, db);
const cash = q1(db, "select id from accounts where code='1111'").id, bk = q1(db, "select id from accounts where code='1112-001'").id, cap = q1(db, "select id from accounts where code='3100'").id;
for (const acc of [cash, bk]) {
  const r = must(await c.post('/accounting/journal-entries', { description: 'R1 fund', entryDate: new Date().toISOString(), lines: [{ accountId: acc, debit: 5000000, credit: 0 }, { accountId: cap, debit: 0, credit: 5000000 }] }), 'fund');
  must(await c.post(`/accounting/journal-entries/${r.id}/post`), 'post');
}
const item = await newItem(c, { name: 'R1 pitem', sale: 5000, purchase: 3000 });
const sup = (id = 1) => q1(db, 'select current_balance b from suppliers where id=?', id).b;
const step = async (label, fn) => { const g = glx(db), s = sup(); const r = await fn(); log(label, errc(r), 'GL', JSON.stringify(dl(g, glx(db))), 'supBal d', sup() - s); return r; };
const P = (extra = {}, lines) => c.post('/purchases', { supplierId: 1, lines: lines ?? [L(item.id, 10000, 2000)], ...extra });

log('=== QA-019 purchase VAT');
const p1 = await step('1 credit taxed 10kg@20.00 +30.00 tax (expect 1131 +20000, 1125 +3000, 2110 -23000)', () => P({ taxAmount: 3000, amountPaid: 0, paymentMethod: 'credit' }));
await step('2 fully-paid taxed 23000 cash (orig: 400 UNBALANCED)', () => P({ taxAmount: 3000, amountPaid: 23000, paymentMethod: 'cash' }));
await step('2b paid net 20000 only, tax 3000', () => P({ taxAmount: 3000, amountPaid: 20000, paymentMethod: 'cash' }));
await step('2c fully-paid taxed by bank 23000', () => P({ taxAmount: 3000, amountPaid: 23000, paymentMethod: 'bank_transfer', bankAccountId: bid }));
const pay4 = await step('3a pay P1 10000 cash', () => c.post('/payments/purchase', { purchaseId: p1.data.id, amount: 10000, paymentMethod: 'cash' }));
await step('3b pay P1 13000 cash (settles)', () => c.post('/payments/purchase', { purchaseId: p1.data.id, amount: 13000, paymentMethod: 'cash' }));
log('   GL 2110 balance after settled P1 (net of other purchases) / debt status', JSON.stringify(q(db, "select status,total_amount,amount_paid from debts where source_type='purchase' and source_id=?", p1.data.id)));
await step('3c cancel first payment', () => c.post(`/payments/${pay4.data.id}/cancel`, { reason: 'r1' }));
log('   P1 afterwards', JSON.stringify(q1(db, 'select grand_total,amount_paid,payment_status from purchases where id=?', p1.data.id)));
// GL AP vs debts vs supplier balance for a clean slice
log('   AP (2110, includes dev seed 0)', glx(db)['2110'], '| open debts payable', q1(db, "select coalesce(sum(total_amount-amount_paid),0) s from debts where direction='payable' and status not in ('paid','written_off')").s, '| supplier balances', q1(db, 'select sum(current_balance) s from suppliers').s);

log('=== QA-030 paid-at-creation purchase correction');
const p3 = await P({ taxAmount: 0, amountPaid: 20000, paymentMethod: 'cash' });
const pay3 = q1(db, "select id from payments where reference_type='purchase' and reference_id=?", p3.data.id);
log('creation-time payment JE count', q(db, "select id from journal_entries where source_type='payment' and source_id=?", pay3?.id).length);
log('cancel creation payment', errc(await c.post(`/payments/${pay3.id}/cancel`, { reason: 'r1' })));

const cat = q1(db, 'select id from expense_categories limit 1').id;
const E = (extra = {}) => c.post('/expenses', { categoryId: cat, description: 'r1', amount: 1000, paymentMethod: 'cash', ...extra });
async function numbering() {
log('=== QA-029 numbering after delete / H-3');
const nums = [];
for (let i = 0; i < 3; i++) { const r = await P({ amountPaid: 0, paymentMethod: 'credit' }); nums.push([r.data?.id, r.data?.purchaseNumber]); }
log('three purchases', JSON.stringify(nums));
log('count', q1(db, 'select count(*) n from purchases').n, 'max', q1(db, 'select max(purchase_number) m from purchases').m);
log('delete the FIRST of the three', errc(await c.del(`/purchases/${nums[0][0]}`)));
for (let i = 0; i < 2; i++) { const r = await P({ amountPaid: 0, paymentMethod: 'credit' }); log(`create after delete #${i + 1}`, errc(r), r.data?.purchaseNumber ?? ''); }
log('delete a middle one, create again');
log(' del', errc(await c.del(`/purchases/${nums[1][0]}`)));
{ const r = await P({ amountPaid: 0, paymentMethod: 'credit' }); log(' create', errc(r), r.data?.purchaseNumber ?? ''); }
log('--- expenses numbering');
// cat defined globally
const e = []; for (let i = 0; i < 3; i++) { const r = await E(); e.push([r.data?.id, r.data?.expenseNumber]); }
log('three expenses', JSON.stringify(e));
log('delete first', errc(await c.del(`/expenses/${e[0][0]}`)));
{ const r = await E(); log('create after delete', errc(r), r.data?.expenseNumber ?? ''); }
{ const r = await E(); log('create after delete #2', errc(r), r.data?.expenseNumber ?? ''); }
log('--- stock-transfer numbering after delete: see script 04');
log('--- lot numbering same day after purchase delete (lot_number unique?)');
{ const r = await P({ amountPaid: 0, paymentMethod: 'credit' }); log(' create', errc(r)); }
log('lots numbers', JSON.stringify(q(db, 'select lot_number from inventory_lots order by id desc limit 6').map((x) => x.lot_number)));

}
log('=== QA-017/018 expenses by bank/card');
const jeOf = (id) => q(db, "select a.code, l.debit_amount d, l.credit_amount c from journal_entries j join journal_entry_lines l on l.journal_entry_id=j.id join accounts a on a.id=l.account_id where j.source_type='expense' and j.source_id=?", id).map((x) => `${x.code} D${x.d} C${x.c}`);
for (const [lbl, extra, categoryId] of [['cash', {}, cat], ['bank_transfer', { paymentMethod: 'bank_transfer', bankAccountId: bid }, cat], ['card no bank', { paymentMethod: 'card' }, cat]]) {
  const g = glx(db); const r = await E({ ...extra, amount: 20000 });
  log(`expense ${lbl} 20000`, errc(r), 'JE', JSON.stringify(r.ok ? jeOf(r.data.id) : []), 'GL', JSON.stringify(dl(g, glx(db))));
}
const cats = q(db, 'select id,name,account_code from expense_categories order by id limit 12');
log('categories', JSON.stringify(cats));
const cats2 = cats.slice(0, 4);
for (const k of cats2) { const r = await E({ categoryId: k.id, amount: 1000 }); log(`cat ${k.id} ${k.account_code}`, errc(r), JSON.stringify(r.ok ? jeOf(r.data.id) : [])); }
{ const g = glx(db); const r = await E({ taxAmount: 1500, amount: 11500 }); log('expense with taxAmount 1500', errc(r), JSON.stringify(r.ok ? jeOf(r.data.id) : [])); }
{ const r = await E({ expenseType: 'personal', amount: 7000 }); log('personal expense', errc(r), JSON.stringify(r.ok ? jeOf(r.data.id) : [])); }
{ const r = await E({ amount: 5000 }); if (!r.ok) log('E fail', errc(r)); const g = glx(db); const u = await c.put(`/expenses/${r.data.id}`, { amount: 9999 }); log('edit expense 5000->9999', errc(u), 'JE', JSON.stringify(jeOf(r.data.id))); const d = await c.del(`/expenses/${r.data.id}`); log('delete', errc(d), 'JE left', JSON.stringify(jeOf(r.data.id))); }

log('=== QA-040 validation');
for (const [lbl, body] of [['neg weight', () => P({}, [L(item.id, -5000, 2000)])], ['neg price', () => P({}, [L(item.id, 5000, -2000)])], ['empty lines', () => P({}, [])], ['neg paid', () => P({ amountPaid: -5000, paymentMethod: 'cash' })], ['neg tax', () => P({ taxAmount: -1000 })], ['fraction grams', () => P({}, [L(item.id, 1234.5, 1999)])], ['unknown item', () => P({}, [L(99999, 1000, 100)])]]) {
  const g = glx(db); const r = await body(); log('purchase', lbl, errc(r), JSON.stringify(dl(g, glx(db))));
}
for (const [lbl, b] of [['neg expense', () => E({ amount: -50000 })], ['zero expense', () => E({ amount: 0 })], ['fraction expense', () => E({ amount: 1000.5 })]]) { const r = await b(); log('expense', lbl, errc(r)); }
{ const cu = await newCustLocal(); const r = await c.post('/payments/advance', { partyType: 'customer', partyId: cu, amount: -500, paymentMethod: 'cash' }); log('neg advance', errc(r)); }
async function newCustLocal() { return must(await c.post('/customers', { name: 'R1 adv', phone: '0599' + (Date.now() % 10000000) }), 'c').id; }
await numbering();
log('JE unbalanced', JSON.stringify(jeCheck(db)));
saveLog('02-purchase-expense-numbering');
