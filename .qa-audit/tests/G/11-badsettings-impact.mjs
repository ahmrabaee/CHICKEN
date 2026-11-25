import { connect, BASE, show } from './lib.mjs';
const a = await connect(BASE, 'admin', 'Hacked12345');
const set = (k,v)=>a.put('/settings/'+encodeURIComponent(k),{value:v});
const sale = () => a.post('/sales',{saleType:'cash',lines:[{itemId:2,weightGrams:1000,pricePerKg:3000}],payments:[{amount:3000,paymentMethod:'cash'}]});
const bc = '2000002' + '0'.repeat(18);
for (const [k,v,orig] of [['barcode.total_length','abc',25],['barcode.item_code_length','abc',6],['barcode.weight_start',-5,7],['barcode.custom_enabled','banana',true],['gl_engine_enabled','banana',false],['gl_engine_enabled','true',false],['gl_debit_credit_tolerance','abc',5],['tax_engine_enabled','yes',false],['tax.default_rate','abc',1500]]) {
  await set(k,v);
  const r = await a.get('/barcode/lookup?barcode='+bc); const s = await sale(); const p = await a.get('/barcode/parse?barcode='+bc);
  console.log(`${k}=${JSON.stringify(v)}`.padEnd(46), 'lookup', r.status, 'parse', p.status, 'sale', s.status, (s.body?.error?.code||''), (r.body?.error?.code||''));
  await set(k,orig);
}
// gl engine on + sale after restore
await set('gl_engine_enabled', false);
console.log('final sale', (await sale()).status);
