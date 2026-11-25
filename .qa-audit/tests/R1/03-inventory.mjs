// R1-03: inventory: same-item two lines (QA-042), adjustments (QA-043), lost update (QA-051), wastage (QA-046), opening stock (QA-048)
import { setup, glx, dl, jeCheck, L, errc, log, saveLog, must, q, q1, newItem, purchase, sale, showItem, itemView, itemCheck } from './lib2.mjs';
const { c, db } = await setup();
const adj = (b) => c.post('/inventory/adjustments', { reason: 'r1', ...b });
const waste = (b) => c.post('/wastage', { reason: 'spoiled', ...b });
const lots = (id) => q(db, 'select id, remaining_quantity_grams r, unit_purchase_price p, lot_number from inventory_lots where item_id=? order by id', id);
const step = (lbl, G0) => { log(`  GL [${lbl}]`, JSON.stringify(dl(G0, glx(db)))); return glx(db); };

log('=== QA-042 same item two lines in one sale (10kg stock, 6+6 kg)');
{
  const it = await newItem(c, { name: 'R1 dup', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 2000 }]);
  const G0 = glx(db);
  const r = await sale(c, [L(it.id, 6000, 5000), L(it.id, 6000, 5000)]);
  log('sale 6kg+6kg on 10kg', errc(r)); showItem(db, it.id, 'dup'); step('dup', G0);
  const r3 = await sale(c, [L(it.id, 4000, 5000), L(it.id, 4000, 5000), L(it.id, 4000, 5000)]);
  log('3x4kg on remaining', errc(r3));
  showItem(db, it.id, 'dup after');
}

log('=== QA-043 adjustments');
{
  log('A1: buy 10kg@18; decrease 4kg; sell 6kg');
  const it = await newItem(c, { name: 'R1 adjA', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 1800 }]);
  let G = glx(db);
  log('decrease 4kg', errc(await adj({ itemId: it.id, adjustmentType: 'decrease', quantityGrams: 4000 }))); G = step('dec', G);
  showItem(db, it.id, 'after dec (orig: lots untouched 10kg)');
  const r = await sale(c, [L(it.id, 6000, 5000)]); log('sell 6kg', errc(r), 'COGS', r.ok ? q1(db, 'select total_cost t from sales where id=?', r.data.id).t : ''); G = step('sale', G);
  showItem(db, it.id, 'after sale');
  const r2 = await sale(c, [L(it.id, 1000, 5000)]); log('sell 1kg more (should be INSUFFICIENT)', errc(r2));
}
{
  log('A2: increase +5kg with NO unit cost on item with stock (orig: no lot -> unsellable)');
  const it = await newItem(c, { name: 'R1 adjB', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 2000 }]);
  let G = glx(db);
  log('increase 5kg no cost', errc(await adj({ itemId: it.id, adjustmentType: 'increase', quantityGrams: 5000 }))); G = step('inc', G);
  showItem(db, it.id, 'after inc');
  const r = await sale(c, [L(it.id, 15000, 5000)]); log('sell all 15kg', errc(r));
  log('increase 3kg unitCost 0', errc(await adj({ itemId: it.id, adjustmentType: 'increase', quantityGrams: 3000, unitCost: 0 })));
  showItem(db, it.id, 'after inc cost0');
  log('increase 3kg unitCost -1500', errc(await adj({ itemId: it.id, adjustmentType: 'increase', quantityGrams: 3000, unitCost: -1500 })));
  showItem(db, it.id, 'after inc neg');
}
{
  log('A3: two lots @18 and @30, decrease 12kg spanning lots then sell');
  const it = await newItem(c, { name: 'R1 adjC', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 1800 }]);
  await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 3000 }]);
  let G = glx(db);
  log('decrease 12kg', errc(await adj({ itemId: it.id, adjustmentType: 'decrease', quantityGrams: 12000 }))); G = step('dec12', G);
  log('  expected 5320 = 10*1800+2*3000 = 24000');
  showItem(db, it.id, 'after');
  log('adjustment with lotId of another item (second lot), decrease 1kg', errc(await adj({ itemId: it.id, lotId: 999999, adjustmentType: 'decrease', quantityGrams: 1000 })));
  showItem(db, it.id, 'after bogus lotId');
}
{
  log('A4: adjustment after sales; partial lots (sale 3kg of 10kg, then decrease 8kg > available lots? )');
  const it = await newItem(c, { name: 'R1 adjD', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 1800 }]);
  await sale(c, [L(it.id, 3000, 5000)]);
  let G = glx(db);
  log('decrease 8kg of 7kg (should be refused)', errc(await adj({ itemId: it.id, adjustmentType: 'decrease', quantityGrams: 8000 })));
  log('decrease 7kg', errc(await adj({ itemId: it.id, adjustmentType: 'decrease', quantityGrams: 7000 }))); step('dec7', G);
  showItem(db, it.id, 'after');
}
{
  log('A5: legacy skew: allow-negative-stock item');
  const it = await newItem(c, { name: 'R1 adjE', sale: 5000, extra: { allowNegativeStock: true } });
  await purchase(c, [{ itemId: it.id, weightGrams: 2000, pricePerKg: 2000 }]);
  log('decrease 5kg of 2kg (allowNegative)', errc(await adj({ itemId: it.id, adjustmentType: 'decrease', quantityGrams: 5000 })));
  showItem(db, it.id, 'after');
}

log('=== QA-051 parallel adjustments (5 x decrease 1000g on 50kg) and adjustments parallel with sales');
{
  const it = await newItem(c, { name: 'R1 par', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 50000, pricePerKg: 2000 }]);
  const G0 = glx(db);
  const rs = await Promise.all(Array.from({ length: 5 }, () => adj({ itemId: it.id, adjustmentType: 'decrease', quantityGrams: 1000 })));
  log('5 parallel decrease 1000g ->', rs.map((r) => r.status).join(','));
  showItem(db, it.id, 'after parallel (expected inv 45000)'); step('par', G0);
  const G1 = glx(db);
  const mix = await Promise.all([
    ...Array.from({ length: 4 }, () => adj({ itemId: it.id, adjustmentType: 'decrease', quantityGrams: 1000 })),
    ...Array.from({ length: 4 }, () => sale(c, [L(it.id, 1000, 5000)])),
  ]);
  log('4 adj + 4 sales parallel ->', mix.map((r) => r.status).join(','));
  showItem(db, it.id, 'after mixed (expected 37000 if all 8 succeeded)'); step('mix', G1);
}

log('=== QA-046 wastage');
{
  const it = await newItem(c, { name: 'R1 waste', sale: 5000 });
  await purchase(c, [{ itemId: it.id, weightGrams: 10000, pricePerKg: 2000 }]);
  const l = lots(it.id)[0];
  let G = glx(db);
  const r = await waste({ lotId: l.id, quantityGrams: 2000 });
  log('waste 2kg', errc(r), r.ok ? 'value ' + r.data.estimatedCostValue : ''); G = step('waste', G);
  showItem(db, it.id, 'after waste');
  log('SLE wastage rows', q1(db, "select count(*) n from stock_ledger_entries where voucher_type='wastage'").n);
  log('DELETE/cancel route', (await c.del(`/wastage/${r.data.id}`)).status, (await c.post(`/wastage/${r.data.id}/cancel`, {})).status);
  const p = await newItem(c, { name: 'R1 phantom', sale: 5000 });
  await purchase(c, [{ itemId: p.id, weightGrams: 5000, pricePerKg: 2000 }]);
  must(await adj({ itemId: p.id, adjustmentType: 'decrease', quantityGrams: 5000 }), 'adj');
  showItem(db, p.id, 'adjusted to zero');
  log('waste 5kg of lot already adjusted away', errc(await waste({ lotId: lots(p.id)[0].id, quantityGrams: 5000 })));
  showItem(db, p.id, 'after');
  log('waste sale-after-C2: lot consumption after waste then adjust', '');
  const k = await newItem(c, { name: 'R1 wasteB', sale: 5000 });
  await purchase(c, [{ itemId: k.id, weightGrams: 10000, pricePerKg: 2000 }]);
  const lk = lots(k.id)[0];
  await waste({ lotId: lk.id, quantityGrams: 3000 });
  log('adjust decrease 7kg then 1kg more', errc(await adj({ itemId: k.id, adjustmentType: 'decrease', quantityGrams: 7000 })), errc(await adj({ itemId: k.id, adjustmentType: 'decrease', quantityGrams: 1000 })));
  showItem(db, k.id, 'after');
  // branch stock account: look at JE account for wastage
  const je = q(db, "select a.code, l.debit_amount d, l.credit_amount c from journal_entries j join journal_entry_lines l on l.journal_entry_id=j.id join accounts a on a.id=l.account_id where j.source_type='wastage' order by j.id desc limit 2");
  log('wastage JE lines', JSON.stringify(je));
  // frozen item category? try wastage on item whose category uses 1132
}

log('=== QA-048 opening stock');
{
  const G0 = glx(db);
  const r = await c.post('/items', { code: 'R1-OP-1', name: 'R1 opening', categoryId: 3, defaultSalePrice: 5000, defaultPurchasePrice: 2000, initialQuantityGrams: 8000, initialCostPrice: 1000 });
  log('create item opening 8kg@10.00', errc(r)); const G1 = step('open', G0);
  const id = r.data?.id;
  showItem(db, id, 'opening');
  log('JE', JSON.stringify(q(db, "select j.entry_number, a.code, l.debit_amount d, l.credit_amount c from journal_entries j join journal_entry_lines l on l.journal_entry_id=j.id join accounts a on a.id=l.account_id where j.source_type='opening_stock' and j.source_id=?", id)));
  const s = await sale(c, [L(id, 8000, 5000)]); log('sell all 8kg', errc(s)); const G2 = step('sale', G1);
  log('edit item (PUT) with initial qty', errc(await c.put(`/items/${id}`, { name: 'R1 opening2', initialQuantityGrams: 9000, initialCostPrice: 5000 })));
  showItem(db, id, 'after PUT'); step('put', G2);
  log('delete item', errc(await c.del(`/items/${id}`)));
  log('opening JE remain', q(db, "select count(*) n from journal_entries where source_type='opening_stock' and source_id=?", id)[0].n, 'item active', q1(db, 'select is_active a from items where id=?', id)?.a);
  // opening with fractional cost, huge, negative, quantity but no cost
  const G3 = glx(db);
  const r2 = await c.post('/items', { code: 'R1-OP-2', name: 'R1 open nocost', categoryId: 3, defaultSalePrice: 5000, defaultPurchasePrice: 2000, initialQuantityGrams: 5000 });
  log('opening qty 5kg no cost', errc(r2)); step('nocost', G3); if (r2.ok) showItem(db, r2.data.id, 'nocost');
  const G4 = glx(db);
  const r3 = await c.post('/items', { code: 'R1-OP-3', name: 'R1 open neg', categoryId: 3, defaultSalePrice: 5000, defaultPurchasePrice: 2000, initialQuantityGrams: 3333, initialCostPrice: 1999 });
  log('opening 3333g@19.99', errc(r3)); step('frac', G4); if (r3.ok) showItem(db, r3.data.id, 'frac');
  log('JE for 3333g@19.99 amount', JSON.stringify(q(db, "select l.debit_amount d from journal_entries j join journal_entry_lines l on l.journal_entry_id=j.id where j.source_type='opening_stock' and j.source_id=? and l.debit_amount>0", r3.data?.id)), 'inventory.total_value', q1(db, 'select total_value v from inventory where item_id=?', r3.data?.id)?.v);
  const sleN = q1(db, "select count(*) n from stock_ledger_entries where item_id=?", id).n;
  log('SLE rows for opening item (orig none)', sleN);
}
log('JE unbalanced', JSON.stringify(jeCheck(db)));
saveLog('03-inventory');
