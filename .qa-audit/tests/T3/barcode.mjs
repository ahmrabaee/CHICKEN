// T3 barcode lookup: seeded 25-digit template and 14-digit price-embedded template; K4-002 label total vs saved sale.
import { connect, BASE, q1, log, short, setup, save, setSetting } from './lib.mjs';
const a = await connect(BASE, 'admin', 'admin123');
const { acc } = await setup(a);
log('config (seed)', (await a.get('/barcode/config')).data);
const look = async (bc, who = a) => { const r = await who.get(`/barcode/lookup?barcode=${encodeURIComponent(bc)}`); return r.ok ? { status: r.status, itemId: r.data?.item?.id, code: r.data?.item?.code, active: r.data?.item?.isActive, weightKg: r.data?.weightKg, price: r.data?.price } : short(r); };

// numeric-code items so the scale format can resolve them
const mk = async (code, price, extra = {}) => {
  const ex = q1('select id from items where code=?', code);
  if (ex) { await a.put(`/items/${ex.id}`, { isActive: true }); return ex.id; }
  const r = await a.post('/items', { code, name: `بند ${code}`, categoryId: 1, defaultSalePrice: price, defaultPurchasePrice: 1000, barcode: extra.barcode });
  if (r.ok) await a.post('/purchases', { supplierId: 1, lines: [{ itemId: r.data.id, weightGrams: 50000, pricePerKg: 1000 }] });
  log(`create item ${code} price ${price}`, `${short(r)} id=${r.data?.id}`);
  return r.data?.id;
};
const id1 = await mk('123456', 3000, { barcode: '6291234567890' });
const id2 = await mk('654321', 2999);
const id3 = await mk('111111', 0);
const idIn = await mk('222222', 2500);
await a.put(`/items/${idIn}`, { isActive: false });

// seeded item codes are not numeric -> can't be addressed by scale labels
log('seed item codes', q1(`select group_concat(code) c from items where id<=6`).c);

// ---- 25-digit template: [1][6 item][5 weight g][7 total][5 price/kg][1 check]
const b25 = (item, g, total, price, chk = '0') => '2' + item + String(g).padStart(5, '0') + String(total).padStart(7, '0') + String(price).padStart(5, '0') + chk;
log('25d 1.234 kg item 123456 total 3702 price 3000', await look(b25('123456', 1234, 3702, 3000)));
log('25d same with wrong check digit 9', await look(b25('123456', 1234, 3702, 3000, '9')));
log('25d label price/kg 3500 != system 3000 (scale reprogrammed)', await look(b25('123456', 1000, 3500, 3500)));
log('25d unknown item 999999', await look(b25('999999', 1000, 3000, 3000)));
log('25d INACTIVE item 222222', await look(b25('222222', 1000, 2500, 2500)));
log('25d weight 00000 (weight missing)', await look(b25('123456', 0, 3000, 3000)));
log('25d with dashes/letters "2-123456-01234-0003702-03000-0"', await look('2-123456-01234-0003702-03000-0'));
log('25d by ACCOUNTANT', await look(b25('123456', 1234, 3702, 3000), acc));
log('static EAN-13 6291234567890', await look('6291234567890'));
log('static unknown 0000000000000', await look('0000000000000'));
log('/barcode/parse 25d', (await a.get(`/barcode/parse?barcode=${b25('123456', 1234, 3702, 3000)}`)).data);

// ---- switch to 14-digit template [1][6 item][7 total], weight inferred
const cfg = await a.put('/barcode/config', { totalLength: 14, itemCodeStart: 1, itemCodeLength: 6, weightStart: 7, weightLength: 0, totalPriceStart: 7, totalPriceLength: 7, priceStart: 0, priceLength: 0 });
log('PUT /barcode/config 14-digit (weightLength 0)', short(cfg) + ' ' + JSON.stringify(cfg.body?.error?.details ?? cfg.body?.error?.message ?? ''));
for (const [k, v] of [['total_length', 14], ['weight_length', 0], ['total_price_start', 7], ['price_start', 0], ['price_length', 0]]) log(`  PUT /settings/barcode.${k}=${v}`, short(await setSetting(a, 'barcode.' + k, v)));
log('  config now', (await a.get('/barcode/config')).data);
const b14 = (item, total) => '2' + item + String(total).padStart(7, '0');
const cases = [['123456', 1001], ['123456', 3000], ['654321', 1000], ['654321', 2999], ['111111', 1234]];
for (const [it, total] of cases) {
  const r = await look(b14(it, total));
  if (typeof r === 'string') { log(`14d ${it} label total ${total}`, r); continue; }
  const grams = Math.round(r.weightKg * 1000);
  const itemPrice = q1('select default_sale_price p from items where id=?', r.itemId).p;
  // emulate POS DTO: weightGrams + pricePerKg (system price)  (K4-002)
  const s = itemPrice > 0 ? await a.post('/sales', { saleType: 'cash', customerId: 1, lines: [{ itemId: r.itemId, weightGrams: grams, pricePerKg: itemPrice }], payments: [{ amount: total, paymentMethod: 'cash' }] }) : null;
  log(`14d ${it} label total ${total}`, `lookup weightKg=${r.weightKg} price=${r.price} -> saved line=${s?.data?.totalAmount ?? '(price 0, POS would send pricePerKg 0 -> 400)'} status=${s ? short(s) : ''} due=${s?.data?.amountDue}`);
}
// a 14-digit GTIN that is NOT a scale label (e.g. GTIN-14 starting with 1)
log('14d GTIN-14 10012345678902 treated as scale label?', await look('10012345678902'));
// restore seed config
for (const [k, v] of [['total_length', 25], ['weight_length', 5], ['total_price_start', 12], ['price_start', 19], ['price_length', 5]]) await setSetting(a, 'barcode.' + k, v);
await a.put('/barcode/config', { totalLength: 25, itemCodeStart: 1, itemCodeLength: 6, weightStart: 7, weightLength: 5, totalPriceStart: 12, totalPriceLength: 7, priceStart: 19, priceLength: 5 });
save('E:/DEV/Chicken FMS/.qa-audit/tests/T3/barcode.out.txt');
