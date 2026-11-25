import * as L from './lib.mjs';
const a = await L.admin();
const tt = await a.get('/tax/templates'); L.say('tax templates', (tt.data || []).map(t => ({ id: t.id, name: t.name, rate: t.rate ?? t.taxRate, active: t.isActive })));
const tid = tt.data?.[0]?.id;
const ITEM = 4; await L.buy(a, ITEM, 30000, 2000);
const settings = async () => L.sql(`select key,value from system_settings where key in ('tax_engine_enabled','tax.prices_include_tax')`);
L.say('settings', await settings());
// engine OFF, with taxTemplateId
{ const g0 = L.snap(); const s = await a.post('/sales', { saleType: 'cash', taxTemplateId: tid, lines: [{ itemId: ITEM, weightGrams: 2000, pricePerKg: 5000 }], payments: [{ amount: 11500, paymentMethod: 'cash' }] });
  L.say('OFF sale', [L.st(s), s.ok && { total: s.data.totalAmount, tax: s.data.taxAmount ?? s.data.totalTaxAmount, subtotal: s.data.subtotal }]);
  if (s.ok) { L.say('OFF GL delta', L.delta(g0, L.snap())); L.say('OFF sale row', L.saleRow(s.data.id)); L.say('OFF sale tax cols', L.one(`select * from sales where id=?`, s.data.id)); } }
const vr = await a.get(`/tax/vat-report?startDate=2026-11-01&endDate=2026-11-30`); L.say('VAT report (engine off)', JSON.stringify(vr.data).slice(0, 400));
// turn engine ON (admin) and gl engine?
const keys = L.sql(`select key,value from system_settings where key like '%engine%' or key like '%gl%' or key like '%tax%'`); L.say('all tax/engine settings', keys);
