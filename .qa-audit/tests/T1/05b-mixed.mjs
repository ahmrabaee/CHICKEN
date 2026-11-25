// T1-05b: K3-003 creation delta for a mixed cash+bank sale, and its void
import fs from 'node:fs';
import { env, connect, logger, diff } from './lib.mjs';
const E = env('t1b', 3102); const { log, lines } = logger();
const a = await connect(E.BASE, 'admin', 'Admin@12345');
const item = E.q(`select item_id from inventory where current_quantity_grams>5000 limit 1`)[0].item_id;
let b = E.snap();
const s = await a.post('/sales', { saleType: 'cash', lines: [{ itemId: item, weightGrams: 2500, pricePerKg: 4000 }], payments: [{ amount: 3000, paymentMethod: 'cash' }, { amount: 7000, paymentMethod: 'card', bankAccountId: 1 }] });
let d = diff(b, E.snap()); log('mixed sale 30 cash + 70 card ->', s.status, 'cash/bank delta', d.accounts['1111']?.net, d.accounts['1112-001']?.net ?? 0, 'payments rows', JSON.stringify(E.q(`select payment_method, amount, bank_account_id from payments where reference_type='sale' and reference_id=?`, s.data.id)));
b = E.snap(); const v = await a.post(`/sales/${s.data.id}/void`, { reason: 'x' }); d = diff(b, E.snap());
log('void ->', v.status, 'cash/bank delta', d.accounts['1111']?.net, d.accounts['1112-001']?.net ?? 0);
fs.writeFileSync(new URL('./05b-mixed.out.txt', import.meta.url), lines.join('\n'));
