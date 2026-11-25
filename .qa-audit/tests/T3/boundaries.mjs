// T3 boundaries: discounts, payment types, overpayment, price override, inactive entities, credit limit, huge values
import { connect, BASE, q, q1, gl, diff, log, short, setup, save } from './lib.mjs';
const a = await connect(BASE, 'admin', 'admin123');
const { bankId, acc } = await setup(a);
const L = (itemId, g, p, d) => ({ itemId, weightGrams: g, pricePerKg: p, ...(d != null ? { discountAmount: d } : {}) });
const sale = (b, who = a) => who.post('/sales', b);
async function probe(label, body, who = a) {
  const g0 = gl();
  const r = await sale(body, who);
  const d = r.data || {};
  log(label, `${short(r)}${r.ok ? ` gross=${d.grossTotalAmount} disc=${d.discountAmount} tax=${d.taxAmount} total=${d.totalAmount} paid=${d.amountPaid} due=${d.amountDue} status=${d.paymentStatus} cost=${d.totalCost} profit=${d.totalProfit}` : ''}`);
  if (r.ok) log('   GL Δ', diff(g0, gl()));
  return r;
}

// --- discounts
await probe('header discountAmount > gross (4000 gross, disc 5000, walk-in, no pay)', { saleType: 'cash', discountAmount: 5000, lines: [L(5, 1000, 4000)] });
await probe('header discountAmount > gross, customer 1 credit', { saleType: 'credit', customerId: 1, discountAmount: 5000, lines: [L(5, 1000, 4000)] });
await probe('100% header discount (4000/4000) walk-in no pay', { saleType: 'cash', discountAmount: 4000, lines: [L(5, 1000, 4000)] });
await probe('line discount > line gross (4000, d 6000) + pay 0', { saleType: 'credit', customerId: 1, lines: [L(5, 1000, 4000, 6000)] });
await probe('line discount = line gross (free line) + other paid line', { saleType: 'cash', lines: [L(5, 1000, 4000, 4000), L(6, 1000, 3000)], payments: [{ amount: 3000, paymentMethod: 'cash' }] });
await probe('discountPct 10000 (100%) admin', { saleType: 'cash', discountPct: 10000, lines: [L(5, 1000, 4000)] });
await probe('discountPct 15000 (150%) admin', { saleType: 'cash', discountPct: 15000, lines: [L(5, 1000, 4000)] });
await probe('ACCOUNTANT discountPct 600 (6% > 5% cap)', { saleType: 'cash', discountPct: 600, lines: [L(5, 1000, 4000)], payments: [{ amount: 3760, paymentMethod: 'cash' }] }, acc);
await probe('ACCOUNTANT discountAmount 2000 on 4000 (50%) ', { saleType: 'cash', discountAmount: 2000, lines: [L(5, 1000, 4000)], payments: [{ amount: 2000, paymentMethod: 'cash' }] }, acc);
await probe('ACCOUNTANT line discountAmount 3900 on 4000 (97.5%)', { saleType: 'cash', lines: [L(5, 1000, 4000, 3900)], payments: [{ amount: 100, paymentMethod: 'cash' }] }, acc);
await probe('ACCOUNTANT price override 1 agora/kg on item price 2600 (cost 2000)', { saleType: 'cash', lines: [L(5, 10000, 1)], payments: [{ amount: 10, paymentMethod: 'cash' }] }, acc);
await probe('header disc + pct combined (disc 3000 + 50% of 4000) ', { saleType: 'cash', discountAmount: 3000, discountPct: 5000, lines: [L(5, 1000, 4000)] });

// --- rounding / tiny values
await probe('1 gram @ 1 agora/kg (line=0)', { saleType: 'cash', lines: [L(5, 1, 1)] });
await probe('1 gram @ 2600 (line=round(2.6)=3) pay 3', { saleType: 'cash', lines: [L(5, 1, 2600)], payments: [{ amount: 3, paymentMethod: 'cash' }] });
await probe('weightGrams 0.4 (rounds to 0)', { saleType: 'cash', lines: [L(5, 0.4, 2600)] });
await probe('weightGrams 0.6 (rounds to 1)', { saleType: 'cash', lines: [L(5, 0.6, 2600)], payments: [{ amount: 3, paymentMethod: 'cash' }] });
await probe('weightGrams -1000', { saleType: 'cash', lines: [L(5, -1000, 2600)] });
await probe('pricePerKg 0', { saleType: 'cash', lines: [L(5, 1000, 0)] });
await probe('empty lines []', { saleType: 'cash', lines: [] });
await probe('line weight 333g @ 2999 x3 lines rounding', { saleType: 'cash', lines: [L(5, 333, 2999), L(5, 333, 2999), L(5, 334, 2999)], payments: [{ amount: 2999, paymentMethod: 'cash' }] });

// --- payments
await probe('overpay total+1 (4000 paid 4001)', { saleType: 'cash', lines: [L(5, 1000, 4000)], payments: [{ amount: 4001, paymentMethod: 'cash' }] });
await probe('overpay total+2', { saleType: 'cash', lines: [L(5, 1000, 4000)], payments: [{ amount: 4002, paymentMethod: 'cash' }] });
await probe('cash tendered 5000 for 4000 (change) ', { saleType: 'cash', lines: [L(5, 1000, 4000)], payments: [{ amount: 5000, paymentMethod: 'cash' }] });
await probe('credit sale WITH full payment', { saleType: 'credit', customerId: 1, lines: [L(5, 1000, 4000)], payments: [{ amount: 4000, paymentMethod: 'cash' }] });
await probe('credit sale no customer', { saleType: 'credit', lines: [L(5, 1000, 4000)] });
await probe('credit sale name only (1 char) + phone', { saleType: 'credit', customerName: 'x', customerPhone: '0599', lines: [L(5, 1000, 4000)] });
await probe('payment amount 0', { saleType: 'cash', lines: [L(5, 1000, 4000)], payments: [{ amount: 0, paymentMethod: 'cash' }] });
await probe('payment method credit', { saleType: 'cash', lines: [L(5, 1000, 4000)], payments: [{ amount: 4000, paymentMethod: 'credit' }] });
await probe('3 tenders cash+card+check', { saleType: 'cash', lines: [L(5, 3000, 4000)], payments: [{ amount: 4000, paymentMethod: 'cash' }, { amount: 4000, paymentMethod: 'card', bankAccountId: bankId }, { amount: 4000, paymentMethod: 'check' }] });
await probe('dueDate in the past for credit sale', { saleType: 'credit', customerId: 2, dueDate: '2020-01-01', lines: [L(5, 1000, 4000)] });

// --- credit limit
const cust = await a.post('/customers', { name: 'T3 limit cust', phone: '0599888777', creditLimit: 5000 });
log('create customer creditLimit 5000 (₪50)', `${short(cust)} id=${cust.data?.id} stored=${q1('select credit_limit from customers where id=?', cust.data?.id)?.credit_limit}`);
await probe('credit sale 40000 to customer with creditLimit 5000', { saleType: 'credit', customerId: cust.data?.id, lines: [L(5, 10000, 4000)] });
// inactive customer
const up = await a.put(`/customers/${cust.data?.id}`, { isActive: false });
log('deactivate customer', short(up));
await probe('credit sale to INACTIVE customer', { saleType: 'credit', customerId: cust.data?.id, lines: [L(5, 1000, 4000)] });

// inactive item
const it = await a.post('/items', { code: 'T3-INACT', name: 'صنف معطل', categoryId: 1, defaultSalePrice: 3000, defaultPurchasePrice: 1000 });
log('create item', `${short(it)} id=${it.data?.id}`);
if (it.ok) {
  await a.post('/purchases', { supplierId: 1, lines: [{ itemId: it.data.id, weightGrams: 10000, pricePerKg: 1000 }] });
  log('deactivate item', short(await a.put(`/items/${it.data.id}`, { isActive: false })));
  log('item active flag', q1('select is_active from items where id=?', it.data.id));
  await probe('sale of INACTIVE item', { saleType: 'cash', lines: [L(it.data.id, 1000, 3000)], payments: [{ amount: 3000, paymentMethod: 'cash' }] });
}
// raw chicken (sale price 0, D-34) via API
await probe('sale of raw chicken item1 (price 0 in master, no inventory row)', { saleType: 'cash', lines: [L(1, 1000, 2000)], payments: [{ amount: 2000, paymentMethod: 'cash' }] });

// huge values
await probe('pricePerKg 2,000,000,000 x 1kg (int32 edge)', { saleType: 'credit', customerId: 1, lines: [L(5, 1000, 2000000000)] });
await probe('pricePerKg 3,000,000,000 x 1kg (> int32)', { saleType: 'credit', customerId: 1, lines: [L(5, 1000, 3000000000)] });
await probe('tax template that does not exist (999)', { saleType: 'cash', taxTemplateId: 999, lines: [L(5, 1000, 4000)], payments: [{ amount: 4000, paymentMethod: 'cash' }] });
await probe('PURCHASE tax template (id 2) on a sale', { saleType: 'cash', taxTemplateId: 2, lines: [L(5, 1000, 4000)], payments: [{ amount: 4600, paymentMethod: 'cash' }] });

log('INVARIANT unbalanced JEs', q(`select journal_entry_id, sum(debit_amount) dr, sum(credit_amount) cr from journal_entry_lines group by 1 having dr<>cr`));
log('negative-total sales', q(`select id, sale_number, gross_total_amount, discount_amount, total_amount, total_profit, payment_status from sales where total_amount<=0`));
save('E:/DEV/Chicken FMS/.qa-audit/tests/T3/boundaries.out.txt');
