// T3 customer lifecycle + void/credit-note/write-off combinations. Each scenario uses a NEW customer so
// per-customer representations can be compared exactly: GL AR (via JE lines whose source doc belongs to the customer),
// customer.currentBalance, open debts, PLE sum, API party outstanding, statement (log line), /debts summary deltas.
import { connect, BASE, q, q1, gl, diff, log, short, setup, save } from './lib.mjs';
import fs from 'node:fs';
const a = await connect(BASE, 'admin', 'admin123');
const { bankId, acc } = await setup(a);
const L = (itemId, g, p) => ({ itemId, weightGrams: g, pricePerKg: p });
let n = 0;
async function newCust(tag) {
  n++;
  const r = await a.post('/customers', { name: `T3 ${tag}`, phone: `0566${Date.now() % 1000000}${n}` });
  return r.data.id;
}
// GL AR attributable to a customer: AR lines of JEs whose source doc (sale, payment, credit_note, reversal/void of these) belongs to cid
function glArFor(cid) {
  const saleIds = q(`select id from sales where customer_id=?`, cid).map((r) => r.id);
  const payIds = q(`select id from payments where party_type='customer' and party_id=?`, cid).map((r) => r.id);
  const cnIds = q(`select id from credit_notes where original_invoice_type='sale' and original_invoice_id in (${saleIds.join(',') || -1})`).map((r) => r.id);
  const jeIds = q(`select id from journal_entries where (source_type in ('sale','sale_void') and source_id in (${saleIds.join(',') || -1}))
      or (source_type='payment' and source_id in (${payIds.join(',') || -1}))
      or (source_type='credit_note' and source_id in (${cnIds.join(',') || -1}))`).map((r) => r.id);
  const rev = q(`select id from journal_entries where source_type='reversal' and source_id in (${jeIds.join(',') || -1})`).map((r) => r.id);
  const all = [...jeIds, ...rev];
  return q1(`select coalesce(sum(l.debit_amount-l.credit_amount),0) s from journal_entry_lines l join accounts ac on ac.id=l.account_id where ac.code='1120' and l.journal_entry_id in (${all.join(',') || -1})`).s;
}
async function stmt(cid) {
  const logf = 'E:/DEV/Chicken FMS/.qa-audit/logs/t3.log';
  const before = fs.readFileSync(logf, 'utf8').length;
  const r = await a.raw('GET', `/customers/${cid}/statement/pdf?startDate=2026-01-01&endDate=2026-12-31`, { raw: true });
  await r.arrayBuffer();
  await new Promise((res) => setTimeout(res, 150));
  const tail = fs.readFileSync(logf, 'utf8').slice(before);
  const m = tail.match(/customerId=(\d+).*opening=(-?\d+) closing=(-?\d+)/);
  return m ? Number(m[3]) : `(no PLE rows in range; status ${r.status})`;
}
async function views(cid) {
  const po = await a.get(`/reconciliation/outstanding/party?partyType=customer&partyId=${cid}`);
  const cb = await a.get(`/debts/receivables?customerId=${cid}&pageSize=100`);
  const debts = (Array.isArray(cb.data) ? cb.data : []);
  return {
    glAR: glArFor(cid),
    custBal: q1('select current_balance b from customers where id=?', cid).b,
    debtsOpen: debts.filter((d) => !['settled', 'written_off'].includes(d.status)).reduce((s, d) => s + d.remainingAmount, 0),
    ple: q1(`select coalesce(sum(amount),0) s from payment_ledger_entries where party_type='customer' and party_id=? and delinked=0`, cid).s,
    apiOutstanding: po.data,
    stmtClosing: await stmt(cid),
  };
}
const show = async (label, cid) => {
  const v = await views(cid);
  const vals = [v.glAR, v.custBal, v.debtsOpen, v.ple, v.apiOutstanding, v.stmtClosing];
  const agree = vals.every((x) => x === vals[0]);
  log(label, `${agree ? 'AGREE' : 'DISAGREE'} ${JSON.stringify(v)}`);
  return v;
};
const sale = (b) => a.post('/sales', b);

// ===== Scenario A: full lifecycle =====
{
  const c = await newCust('A');
  log('--- A lifecycle customer', c);
  const s1 = await sale({ saleType: 'credit', customerId: c, lines: [L(3, 4000, 5000)] }); // 20000
  await show('A1 credit sale 20000', c);
  const p1 = await a.post('/payments/sale', { saleId: s1.data.id, amount: 7000, paymentMethod: 'cash' });
  log('   pay 7000', short(p1)); await show('A2 after partial collection 7000', c);
  const s2 = await sale({ saleType: 'cash', customerId: c, lines: [L(3, 2000, 5000)], payments: [{ amount: 4000, paymentMethod: 'cash' }] }); // 10000, due 6000
  await show('A3 2nd sale 10000 paid 4000 (due 6000)', c);
  const cn = await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: s1.data.id, amount: 3000, reason: 'A' });
  log('   CN 3000 on sale1', `${short(cn)} ${short(await a.post(`/credit-notes/${cn.data.id}/submit`, {}))}`);
  await show('A4 after credit note 3000', c);
  const d1 = q1(`select id from debts where source_type='sale' and source_id=?`, s1.data.id);
  log('   write-off remainder of sale1', short(await a.post(`/debts/${d1.id}/write-off`, { reason: 'A' })));
  await show('A5 after write-off of sale1 remainder', c);
  const adv = await a.post('/payments/advance', { partyType: 'customer', partyId: c, amount: 2500, paymentMethod: 'cash' });
  log('   advance 2500', short(adv)); await show('A6 after advance payment 2500', c);
  const ap = await a.post('/reconciliation/apply', { partyType: 'customer', partyId: c, allocations: [{ paymentId: adv.data?.id ?? adv.data?.payment?.id, invoiceType: 'sale', invoiceId: s2.data.id, amount: 2500 }] });
  log('   allocate advance 2500 -> sale2', short(ap));
  await show('A7 after allocation', c);
  log('   sale2 status after allocation', q1('select amount_paid, payment_status from sales where id=?', s2.data.id));
  const p2 = await a.post('/payments/sale', { saleId: s2.data.id, amount: 6000, paymentMethod: 'cash' });
  log('   pay sale2 full remaining 6000 AFTER allocation of 2500 (double collection?)', short(p2));
  await show('A8 end', c);
}

// ===== Scenario B: void after credit note =====
{
  const c = await newCust('B');
  log('--- B void after credit note, customer', c);
  const s = await sale({ saleType: 'credit', customerId: c, lines: [L(3, 2000, 5000)] }); // 10000
  const cn = await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: s.data.id, amount: 4000 });
  await a.post(`/credit-notes/${cn.data.id}/submit`, {});
  const g0 = gl();
  const v = await a.post(`/sales/${s.data.id}/void`, { reason: 'B' });
  log('B void after CN 4000', short(v));
  log('   GL Δ of void', diff(g0, gl()));
  await show('B end (expect all 0)', c);
}

// ===== Scenario C: void after write-off =====
{
  const c = await newCust('C');
  log('--- C void after write-off, customer', c);
  const s = await sale({ saleType: 'credit', customerId: c, lines: [L(3, 2000, 5000)] });
  const d = q1(`select id from debts where source_type='sale' and source_id=?`, s.data.id);
  await a.post(`/debts/${d.id}/write-off`, { reason: 'C' });
  await show('C after write-off', c);
  const v = await a.post(`/sales/${s.data.id}/void`, { reason: 'C' });
  log('C void after write-off', short(v));
  await show('C end (expect all 0)', c);
}

// ===== Scenario D: partial payment (POS) then void =====
{
  const c = await newCust('D');
  log('--- D POS partial then /payments then void, customer', c);
  const s = await sale({ saleType: 'cash', customerId: c, lines: [L(3, 2000, 5000)], payments: [{ amount: 3000, paymentMethod: 'cash' }] });
  await a.post('/payments/sale', { saleId: s.data.id, amount: 2000, paymentMethod: 'cash' });
  const g0 = gl();
  const v = await a.post(`/sales/${s.data.id}/void`, { reason: 'D' });
  log('D void (POS paid 3000 + later 2000)', short(v));
  log('   GL Δ of void (expect cash -5000, AR -5000)', diff(g0, gl()));
  await show('D end (expect all 0)', c);
}

// ===== Scenario E: credit notes edge cases =====
{
  const c = await newCust('E');
  log('--- E credit note edges, customer', c);
  const s = await sale({ saleType: 'credit', customerId: c, lines: [L(3, 2000, 5000)] }); // 10000
  log('E CN amount > outstanding (10001)', short(await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: s.data.id, amount: 10001 })));
  log('E CN amount 0', short(await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: s.data.id, amount: 0 })));
  const fr = await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: s.data.id, amount: 1.5 });
  log('E CN amount 1.5 (fractional agora)', `${short(fr)} stored=${fr.data?.amount}`);
  // two drafts each 6000 (each <= outstanding at creation), submit both
  const c1 = await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: s.data.id, amount: 6000 });
  const c2 = await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: s.data.id, amount: 6000 });
  log('E two drafts 6000+6000 on 10000', `${short(c1)} ${short(c2)}`);
  const [r1, r2] = await Promise.all([a.post(`/credit-notes/${c1.data.id}/submit`, {}), a.post(`/credit-notes/${c2.data.id}/submit`, {})]);
  log('E submit both CONCURRENTLY', `${short(r1)} ${short(r2)}`);
  const sub2 = await a.post(`/credit-notes/${c2.data.id}/submit`, {});
  log('E re-submit second sequentially', short(sub2));
  log('E submit first again (double submit)', short(await a.post(`/credit-notes/${c1.data.id}/submit`, {})));
  log('E CN rows for sale', q(`select id, credit_note_number, amount, docstatus from credit_notes where original_invoice_id=? and original_invoice_type='sale'`, s.data.id));
  await show('E after CNs', c);
  // CN on cash, fully paid sale (refund?)
  const cs = await sale({ saleType: 'cash', customerId: c, lines: [L(3, 1000, 5000)], payments: [{ amount: 5000, paymentMethod: 'cash' }] });
  log('E CN on fully-paid cash sale 2000', short(await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: cs.data.id, amount: 2000 })));
  // CN on walk-in partial (no customer, no PLE)
  const ws = await sale({ saleType: 'cash', lines: [L(3, 1000, 5000)], payments: [{ amount: 4999, paymentMethod: 'cash' }] });
  log('E CN on walk-in sale with 1 agora AR', short(await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: ws.data.id, amount: 1 })));
  // CN on voided sale
  const vs = await sale({ saleType: 'credit', customerId: c, lines: [L(3, 1000, 5000)] });
  const vdraft = await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: vs.data.id, amount: 1000 });
  await a.post(`/sales/${vs.data.id}/void`, { reason: 'E' });
  log('E CN create on VOIDED sale', short(await a.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: vs.data.id, amount: 1000 })));
  log('E submit draft created BEFORE the void', short(await a.post(`/credit-notes/${vdraft.data.id}/submit`, {})));
  // CN by accountant
  const as = await sale({ saleType: 'credit', customerId: c, lines: [L(3, 1000, 5000)] });
  const ac = await acc.post('/credit-notes', { originalInvoiceType: 'sale', originalInvoiceId: as.data.id, amount: 5000 });
  log('E accountant CN 100% of invoice', `${short(ac)} submit ${short(await acc.post(`/credit-notes/${ac.data?.id}/submit`, {}))}`);
  // CN for sale of another customer? (party check) – not applicable (CN has no party)
  await show('E end', c);
}

// ===== Scenario F: concurrent double void =====
{
  const c = await newCust('F');
  const s = await sale({ saleType: 'credit', customerId: c, lines: [L(4, 2000, 5000)], payments: [] });
  const inv0 = q1('select current_quantity_grams q from inventory where item_id=4').q;
  const g0 = gl();
  const rs = await Promise.all([1, 2, 3].map(() => a.post(`/sales/${s.data.id}/void`, { reason: 'race' })));
  log('F 3 concurrent voids', rs.map(short).join(' | '));
  log('   GL Δ (expect AR -10000, 4110 +10000, COGS/stock once)', diff(g0, gl()));
  log('   item4 qty Δ (expect +2000)', q1('select current_quantity_grams q from inventory where item_id=4').q - inv0);
  log('   sale_void JEs', q1(`select count(*) n from journal_entries where source_type='sale_void' and source_id=?`, s.data.id));
  await show('F end', c);
}

// ===== Scenario G: concurrent payments overpay =====
{
  const c = await newCust('G');
  const s = await sale({ saleType: 'credit', customerId: c, lines: [L(4, 2000, 5000)] });
  const rs = await Promise.all([1, 2, 3].map(() => a.post('/payments/sale', { saleId: s.data.id, amount: 6000, paymentMethod: 'cash' })));
  log('G 3 concurrent payments of 6000 on 10000 due', rs.map(short).join(' | '));
  log('   sale amountPaid', q1('select amount_paid, payment_status from sales where id=?', s.data.id));
  await show('G end', c);
}

log('INVARIANT unbalanced JEs', q(`select journal_entry_id, sum(debit_amount) dr, sum(credit_amount) cr from journal_entry_lines group by 1 having dr<>cr`));
save('E:/DEV/Chicken FMS/.qa-audit/tests/T3/lifecycle.out.txt');
