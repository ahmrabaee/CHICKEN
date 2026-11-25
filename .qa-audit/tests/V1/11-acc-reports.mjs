import * as L from './lib.mjs';
const acc = await L.connect(L.BASE, 'v1acc', 'Password@123');
const q = '?startDate=2026-11-01&endDate=2026-11-30&dateFrom=2026-11-01&dateTo=2026-11-30&from=2026-11-01&to=2026-11-30';
for (const p of ['/reports/profit-loss', '/reports/sales', '/reports/purchases', '/reports/expenses', '/reports/inventory', '/reports/stock-vs-gl']) {
  const r = await acc.get(p + q); const body = JSON.stringify(r.body || '');
  L.say('ACC GET ' + p, `${r.status} ${r.ok ? '' : body.slice(0, 120)} cost/profit-fields=${/totalCost|totalProfit|grossProfit|netProfit|averageCost|totalValue|costOfGoods/i.test(body)}`);
  if (r.ok && p.includes('profit')) console.log(body.slice(0, 300));
}
const it = await acc.get('/items/3'); L.say('ACC item 3 purchase-price fields', JSON.stringify(it.data).match(/"(defaultPurchasePrice|averageCost|lastPurchasePrice)":[^,]*/g));
const lots = await acc.get('/inventory/3/lots'); L.say('ACC lots unit cost sample', JSON.stringify(lots.data).slice(0, 250));
