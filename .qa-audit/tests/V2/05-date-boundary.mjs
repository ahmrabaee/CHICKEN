// V2: T6-010 independent re-proof — sale at 00:30 Asia/Jerusalem counts on previous UTC day;
// list filter startDate=endDate=same-day returns 0 for sales.
import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs';

const BASE = 'http://localhost:3117/v1';
async function setClock(iso) {
  const r = await fetch(`http://localhost:3117/__qaclock?set=${encodeURIComponent(iso)}`);
  return r.json();
}

let admin = await connect(BASE, 'admin', 'admin123');
function logJ(label, r) { console.log(label, r.status, JSON.stringify(r.body).slice(0, 300)); }

const fund = await admin.post('/accounting/journal-entries', {
  description: 'V2 cash funding', entryDate: new Date().toISOString(),
  lines: [{ accountId: 4, debit: 10000000, credit: 0 }, { accountId: 21, debit: 0, credit: 10000000 }],
});
if (fund.data?.id) await admin.post(`/accounting/journal-entries/${fund.data.id}/post`, {});
console.log('cash funded:', fund.status);

// Asia/Jerusalem is UTC+2 in winter (no DST in late Nov 2026). 00:30 local 2026-11-26 = 22:30 UTC 2026-11-25.
console.log(await setClock('2026-11-25T22:30:00Z'));
admin = await connect(BASE, 'admin', 'admin123'); // re-login AFTER moving the clock so the token isn't "expired" by the jump

const sale = await admin.post('/sales', {
  saleType: 'cash',
  lines: [{ itemId: 3, weightGrams: 100, pricePerKg: 2000 }],
  payments: [{ amount: 200, paymentMethod: 'cash' }],
});
logJ('sale created at clock=2026-11-25T22:30Z (00:30 local 26-Nov)', sale);
console.log('saleDate stored:', sale.data?.saleDate, 'saleNumber:', sale.data?.saleNumber);

// Reset clock back to normal business hours same UTC day for queries (list endpoints use server "now" for nothing here, just filters by explicit dates)
console.log(await setClock('2026-11-25T22:35:00Z'));
admin = await connect(BASE, 'admin', 'admin123');

const listLocal26 = await admin.get('/sales?startDate=2026-11-26&endDate=2026-11-26');
logJ('T6-010a: GET /sales?startDate=2026-11-26&endDate=2026-11-26 (the LOCAL business day of the sale)', listLocal26);

const listUtc25 = await admin.get('/sales?startDate=2026-11-25&endDate=2026-11-25');
logJ('T6-010b: GET /sales?startDate=2026-11-25&endDate=2026-11-25 (the UTC day the instant actually falls on)', listUtc25);

const reportsSales26 = await admin.get('/reports/sales?startDate=2026-11-26&endDate=2026-11-26');
logJ('T6-010c: GET /reports/sales for local day 26-Nov', reportsSales26);

// Now test the same-day start=end filter in general (independent of TZ edge): create a plain midday sale, then query that exact single day.
console.log(await setClock('2026-11-25T10:00:00Z'));
admin = await connect(BASE, 'admin', 'admin123');
const saleMidday = await admin.post('/sales', {
  saleType: 'cash', lines: [{ itemId: 3, weightGrams: 50, pricePerKg: 2000 }], payments: [{ amount: 100, paymentMethod: 'cash' }],
});
logJ('midday sale on 2026-11-25', saleMidday);
const listSameDay = await admin.get('/sales?startDate=2026-11-25&endDate=2026-11-25');
logJ('T6-010d: GET /sales?startDate=2026-11-25&endDate=2026-11-25 (same-day filter, sale made at 10:00 UTC same day)', listSameDay);

console.log('DONE');
