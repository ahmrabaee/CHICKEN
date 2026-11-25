// T4-02: bank accounts / cash routing / cheques / guards; API-level execution of docs/BANK_ACCOUNTS_TEST_SCENARIOS.md outcomes.
// Runs on t4a after 01 (deltas only).
import { login, snapshot, delta, makeLog, short, fund, q, q1, QA } from './lib.mjs';
const log = makeLog(`${QA}/tests/T4/02-bank-cash.out.txt`);
const c = await login('t4a');
const DB = c.meta.db;
const step = async (label, fn) => {
  const before = snapshot(DB);
  const r = await fn();
  const after = snapshot(DB);
  const d = delta(before, after);
  log(`\n## ${label}`);
  log('  resp:', short(r), r.ok && r.data?.id ? `id=${r.data.id}` : '');
  log('  GLΔ:', d.gl, 'supΔ', d.suppliers, 'debtΔ', d.payDebt, 'je', d.je);
  return r;
};
const newCreditPurchase = async (amt = 10000, sup = 2) => (await c.post('/purchases', { supplierId: sup, lines: [{ itemId: 5, weightGrams: 1000, pricePerKg: amt }], amountPaid: 0 })).data.id;
log('# T4-02 bank/cash', new Date().toISOString());

// --- before any bank account exists
log('bank_accounts rows:', q(DB, 'select count(*) n from bank_accounts')[0]);
let P = await newCreditPurchase(10000);
await step('A1. NO bank accounts: purchase payment bank_transfer 100.00 (ED-01)', () => c.post('/payments/purchase', { purchaseId: P, amount: 10000, paymentMethod: 'bank_transfer' }));
P = await newCreditPurchase(10000);
await step('A2. purchase payment method=check 100.00 (cheque)', () => c.post('/payments/purchase', { purchaseId: P, amount: 10000, paymentMethod: 'check' }));
P = await newCreditPurchase(10000);
await step('A3. purchase payment method="bitcoin" (free string) 100.00', () => c.post('/payments/purchase', { purchaseId: P, amount: 10000, paymentMethod: 'bitcoin' }));
await step('A4. purchase payment method="credit" 1.00 on same purchase', () => c.post('/payments/purchase', { purchaseId: P - 0, amount: 100, paymentMethod: 'credit' }));
log('  payments methods stored:', q(DB, "select payment_number, payment_method, amount from payments order by id desc limit 3"));

// --- BA scenarios
const l0 = await c.get('/bank-accounts');
log('\nBA-03 GET /bank-accounts (empty):', short(l0), l0.data);
const ba1 = await step('BA-08/09a. POST /bank-accounts name only (auto GL account)', () => c.post('/bank-accounts', { name: 'بنك فلسطين' }));
log('  created:', ba1.data?.code, ba1.data?.account);
const ba2 = await step('BA-09b. POST /bank-accounts with accountId=1112-001 (seed leaf, type Other), isDefault', () => c.post('/bank-accounts', { name: 'بنك القدس', accountId: 6, isDefault: true }));
const ba3 = await step('BA-11. second default bank (auto GL)', () => c.post('/bank-accounts', { name: 'بنك الاستثمار', isDefault: true }));
log('  defaults:', q(DB, 'select id,code,name,account_id,is_default,is_active from bank_accounts'));
log('  GL accounts under 1112:', q(DB, "select id,code,name,account_type,is_group from accounts where code like '1112%'"));
const B1 = ba1.data.id, B2 = ba2.data.id, B3 = ba3.data.id;
const acc = (bid) => q1(DB, 'select a.code from bank_accounts b join accounts a on a.id=b.account_id where b.id=?', bid).code;
log('  bank -> GL code:', { B1: acc(B1), B2: acc(B2), B3: acc(B3) });

// fund B1 GL account
await fund(c, DB, 300000, acc(B1));
log('funded', acc(B1), '=', snapshot(DB).gl[acc(B1)]);

// routing
P = await newCreditPurchase(20000);
await step(`R1. purchase payment bank_transfer bankAccountId=B1 200.00`, () => c.post('/payments/purchase', { purchaseId: P, amount: 20000, paymentMethod: 'bank_transfer', bankAccountId: B1 }));
P = await newCreditPurchase(10000);
await step('R2. purchase payment bank_transfer, no bankAccountId (default=B3 has 0 balance)', () => c.post('/payments/purchase', { purchaseId: P, amount: 10000, paymentMethod: 'bank_transfer' }));
await step('R3. purchase payment method=cash but bankAccountId=B1', () => c.post('/payments/purchase', { purchaseId: P, amount: 10000, paymentMethod: 'cash', bankAccountId: B1 }));
log('  last payment row:', q(DB, 'select payment_number,payment_method,bank_account_id,amount from payments order by id desc limit 1'));
await step('R4. purchase fully paid at creation by bank_transfer B1 100.00', () => c.post('/purchases', { supplierId: 2, lines: [{ itemId: 5, weightGrams: 1000, pricePerKg: 10000 }], amountPaid: 10000, paymentMethod: 'bank_transfer', bankAccountId: B1 }));
log('  last payment row (creation, full):', q(DB, 'select payment_number,payment_method,bank_account_id,amount from payments order by id desc limit 1'));
await step('R5. purchase partially paid at creation by card B1 50.00 of 100.00', () => c.post('/purchases', { supplierId: 2, lines: [{ itemId: 5, weightGrams: 1000, pricePerKg: 10000 }], amountPaid: 5000, paymentMethod: 'card', bankAccountId: B1 }));
log('  last payment row (creation, partial):', q(DB, 'select payment_number,payment_method,bank_account_id,amount from payments order by id desc limit 1'));
await step('R6. supplier advance bank_transfer B1 50.00', () => c.post('/payments/advance', { partyType: 'supplier', partyId: 2, amount: 5000, paymentMethod: 'bank_transfer', bankAccountId: B1 }));
await step('R7. supplier advance NEGATIVE amount -500.00 cash', () => c.post('/payments/advance', { partyType: 'supplier', partyId: 2, amount: -50000, paymentMethod: 'cash' }));
log('  last JE lines:', q(DB, 'select j.entry_number,a.code,l.debit_amount d,l.credit_amount c from journal_entries j join journal_entry_lines l on l.journal_entry_id=j.id join accounts a on a.id=l.account_id where j.id=(select max(id) from journal_entries)'));
await step('R8. supplier advance 0 amount', () => c.post('/payments/advance', { partyType: 'supplier', partyId: 2, amount: 0, paymentMethod: 'cash' }));
await step('R9. bank_transfer with non-existent bankAccountId 999', () => c.post('/payments/purchase', { purchaseId: P, amount: 100, paymentMethod: 'bank_transfer', bankAccountId: 999 }));

// bank account pointing to wrong GL accounts
const bAP = await step('W1. POST /bank-accounts accountId=2110 (AP!)', () => c.post('/bank-accounts', { name: 'bank-on-AP', accountId: 17 }));
const bGrp = await step('W2. POST /bank-accounts accountId=1112 (group)', () => c.post('/bank-accounts', { name: 'bank-on-group', accountId: 5 }));
const bInc = await step('W3. POST /bank-accounts accountId=4110 (revenue)', () => c.post('/bank-accounts', { name: 'bank-on-revenue', accountId: 26 }));
const bCash = await step('W4. POST /bank-accounts accountId=1111 (cash box)', () => c.post('/bank-accounts', { name: 'bank-on-cash', accountId: 4 }));
if (bAP.ok) {
  P = await newCreditPurchase(10000);
  await step('W1b. pay supplier via bank-on-AP 100.00', () => c.post('/payments/purchase', { purchaseId: P, amount: 10000, paymentMethod: 'bank_transfer', bankAccountId: bAP.data.id }));
}
if (bCash.ok) {
  P = await newCreditPurchase(10000);
  await step('W4b. pay supplier via bank-on-cash bank_transfer 100.00', () => c.post('/payments/purchase', { purchaseId: P, amount: 10000, paymentMethod: 'bank_transfer', bankAccountId: bCash.data.id }));
}
// BA-14 change GL account of B1 after it has balance
const balB1 = snapshot(DB).gl[acc(B1)];
await step('BA-14. PUT B1 accountId -> B3 GL account (B1 has balance)', () => c.put(`/bank-accounts/${B1}`, { accountId: ba3.data.account.id }));
log('  old GL', '1112-002?', 'balance stays', balB1, ' B1 now maps to', acc(B1));
await step('BA-14b. revert B1 mapping', () => c.put(`/bank-accounts/${B1}`, { accountId: ba1.data.account.id }));

// deactivate with balance
await step('ED-04. deactivate B1 (balance ' + snapshot(DB).gl[acc(B1)] + ')', () => c.put(`/bank-accounts/${B1}`, { isActive: false }));
const lst = await c.get('/bank-accounts');
log('  GET /bank-accounts after deactivate:', lst.data?.map?.((b) => b.code + ':' + b.isActive));
P = await newCreditPurchase(10000);
await step('ED-04b. pay supplier with INACTIVE bank B1', () => c.post('/payments/purchase', { purchaseId: P, amount: 10000, paymentMethod: 'bank_transfer', bankAccountId: B1 }));
await step('ED-04c. re-activate B1', () => c.put(`/bank-accounts/${B1}`, { isActive: true }));

// delete
await step('BA-19. delete B1 (used by payments)', () => c.del(`/bank-accounts/${B1}`));
// bank used only by a full-paid-at-creation purchase (no bank_account_id on payment)
const b5 = await c.post('/bank-accounts', { name: 'bank-only-purchase' });
await fund(c, DB, 50000, b5.data.account.code);
await step('D1. full-paid-at-creation purchase via bank b5 100.00', () => c.post('/purchases', { supplierId: 2, lines: [{ itemId: 5, weightGrams: 1000, pricePerKg: 10000 }], amountPaid: 10000, paymentMethod: 'bank_transfer', bankAccountId: b5.data.id }));
await step('D2. delete bank b5 (GL account has movements)', () => c.del(`/bank-accounts/${b5.data.id}`));
log('  GL balance of deleted bank account', b5.data.account.code, '=', snapshot(DB).gl[b5.data.account.code], ' bank row exists:', q(DB, 'select count(*) n from bank_accounts where id=?', b5.data.id)[0].n);
const b6 = await step('D3. create next bank account after delete (count-based BANK-nnn code)', () => c.post('/bank-accounts', { name: 'bank-after-delete' }));
log('  bank codes:', q(DB, 'select id, code, name from bank_accounts'));

// guard by bank: B2 (1112-001) zero balance
P = await newCreditPurchase(10000);
await step('G1. pay via B2 with 0 balance (guard per bank)', () => c.post('/payments/purchase', { purchaseId: P, amount: 10000, paymentMethod: 'bank_transfer', bankAccountId: B2 }));

// AC: trial balance / ledger visibility
const tb = await c.get('/accounting/trial-balance');
const rows = tb.data?.accounts ?? tb.data?.rows ?? tb.data;
log('\nAC-04 trial balance resp:', short(tb), JSON.stringify(tb.data).slice(0, 300));
const led = await c.get(`/accounting/ledger/${acc(B1)}`);
log('AC-06 ledger', acc(B1), short(led), JSON.stringify(led.data).slice(0, 300));
log('\nFINAL GL cash/bank:', Object.fromEntries(Object.entries(snapshot(DB).gl).filter(([k]) => k.startsWith('111'))));
log.save();
