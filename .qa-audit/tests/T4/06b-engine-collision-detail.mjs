// T4-06b: detail of the 409 under gl_engine_enabled=true on t4a (which had purchase edits in 01). Restores flag.
import { login, makeLog, q, QA } from './lib.mjs';
const log = makeLog(`${QA}/tests/T4/06b-engine-collision-detail.out.txt`);
const c = await login('t4a');
const DB = c.meta.db;
log('JE count', q(DB, 'select count(*) n, max(entry_number) mx from journal_entries')[0]);
await c.put('/settings/gl_engine_enabled', { value: 'true' });
const r = await c.post('/purchases', { supplierId: 1, lines: [{ itemId: 2, weightGrams: 10000, pricePerKg: 2000 }], taxAmount: 3000 });
log('credit purchase with GL engine ON:', r.status, JSON.stringify(r.body));
const r2 = await c.post('/payments/advance', { partyType: 'customer', partyId: 1, amount: 100, paymentMethod: 'cash' });
log('customer advance receipt with GL engine ON:', r2.status, JSON.stringify(r2.body));
await c.put('/settings/gl_engine_enabled', { value: 'false' });
const r3 = await c.post('/purchases', { supplierId: 1, lines: [{ itemId: 2, weightGrams: 10000, pricePerKg: 2000 }], taxAmount: 3000 });
log('same purchase, GL engine OFF:', r3.status, r3.data?.purchaseNumber);
log.save();
