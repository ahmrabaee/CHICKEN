# Summary t8b ({"DAYS":10,"SEED":20261001,"TRANSFER_COST":"ui-default"})

## Counts
```
{"sales":374,"voided":2,"jes":455,"purchases":14,"payments":376,"transfers":10,"wastage":14,"expenses":14}
```

## Month-end: truth vs every system representation (₪)

| Quantity | Truth (shadow) | System representations | Δ (system − truth) |
|---|---|---|---|
| Cash in drawer (1111) | 10,342.94 | GL: -2,207.06<br>TB?asOfDate: -2,207.06 | GL: -12,550.00<br>TB?asOfDate: -12,550.00 |
| Bank (1112-001) | 79,145.91 | GL: 91,695.91 | GL: 12,550.00 |
| Receivables | 4,414.48 | GL 1120: 4,414.48<br>Σ customer.currentBalance: 4,414.48<br>open debts: 4,414.48<br>PLE: 4,414.48<br>dashboard: 4,414.48<br>/debts/summary: 4,414.48 | GL 1120: 0.00<br>Σ customer.currentBalance: 0.00<br>open debts: 0.00<br>PLE: 0.00<br>dashboard: 0.00<br>/debts/summary: 0.00 |
| Payables | 5,922.36 | GL 2110: 5,922.36<br>Σ supplier.currentBalance: 11,172.36<br>open debts: 5,922.36<br>dashboard: 5,922.36 | GL 2110: 0.00<br>Σ supplier.currentBalance: 5,250.00<br>open debts: 0.00<br>dashboard: 0.00 |
| Inventory value | 4,919.42 | GL 1131: 1,306.21<br>inventory.total_value: 4,919.42<br>Σ lots: 4,919.98 | GL 1131: -3,613.21<br>inventory.total_value: 0.00<br>Σ lots: 0.56 |
| Net revenue MTD (excl. VAT, after discounts/allowances) | 27,159.80 | GL 4110: 27,212.80<br>P&L report revenue: 27,159.80 | GL 4110: 53.00<br>P&L report revenue: 0.00 |
| COGS MTD | 18,639.12 | GL 5100: 18,639.12<br>P&L report COGS: 18,639.12 | GL 5100: 0.00<br>P&L report COGS: 0.00 |
| Wastage | 419.50 | GL 5300: 419.50 | GL 5300: 0.00 |
| Stock adj./transfer variance | -3,613.21 | GL 5320: 0.00 | GL 5320: 3,613.21 |
| Operating expenses (incl. bad debt) | 13,814.00 | GL 5400: 13,867.00<br>P&L report expenses: 13,814.00 | GL 5400: 53.00<br>P&L report expenses: 0.00 |
| VAT payable | 0.00 | GL 2120: 0.00 | GL 2120: 0.00 |
| Net income MTD | -2,099.61 | GL income stmt: -5,712.82<br>P&L report: -5,293.32 | GL income stmt: -3,613.21<br>P&L report: -3,193.71 |

Stock qty (g): truth 410180, inventory 410180, lots 410180. TB Dr−Cr: 0.

## Customers (₪)

| customer | truth owed | customer.currentBalance | open debts | PLE (statement basis) |
|---|---|---|---|---|
| amir | 1,509.21 | 1,509.21 | 1,509.21 | 1,509.21 |
| sultan | 1,644.67 | 1,644.67 | 1,644.67 | 1,644.67 |
| hotel | 786.88 | 786.88 | 786.88 | 786.88 |
| abukhalil | 120.67 | 120.67 | 120.67 | 120.67 |
| ummoh | 159.92 | 159.92 | 159.92 | 159.92 |
| noor | 193.13 | 193.13 | 193.13 | 193.13 |

## Suppliers (₪)

| supplier | truth owed | supplier.currentBalance | open debts | PLE |
|---|---|---|---|---|
| farm | 5,922.36 | 11,172.36 | 5,922.36 | 5,922.36 |
| whole | 0.00 | 0.00 | 0.00 | 0.00 |
| offal | 0.00 | 0.00 | 0.00 | 0.00 |

## Items (qty g / value ₪)

| item | truth qty | inv qty | lot qty | truth value | inv value | lot value | avgCost/kg | neg lots |
|---|---|---|---|---|---|---|---|---|
| whole | 49795 | 49795 | 49795 | 530.32 | 530.40 | 530.32 | 10.65 | 0 |
| breast | 86185 | 86185 | 86185 | 1,896.07 | 1,896.07 | 1,896.07 | 22.00 | 0 |
| thigh | 98860 | 98860 | 98860 | 1,482.90 | 1,482.57 | 1,482.90 | 15.00 | 0 |
| wings | 38290 | 38290 | 38290 | 382.90 | 382.90 | 382.90 | 10.00 | 0 |
| backs | 101055 | 101055 | 101055 | 303.17 | 303.06 | 303.17 | 3.00 | 0 |
| minced | 305 | 305 | 305 | 5.80 | 5.62 | 5.80 | 18.43 | 0 |
| liver | 35690 | 35690 | 35690 | 318.82 | 318.80 | 318.82 | 8.93 | 0 |

## Endpoint timings with a month of data (5 calls each)

| endpoint | status | median ms | max ms |
|---|---|---|---|
| /reports/dashboard | 200 | 2 | 15 |
| /reports/sales?startDate=2026-10-01&endDate=2026-10-10 | 200 | 34 | 35 |
| /reports/profit-loss?startDate=2026-10-01&endDate=2026-10-10 | 200 | 2 | 7 |
| /accounting/trial-balance | 200 | 3 | 3 |
| /accounting/ledger/1111?startDate=2026-10-01&endDate=2026-10-10 | 200 | 14 | 15 |
| /sales?page=1&pageSize=20 | 200 | 4 | 5 |
| /sales?pageSize=500 | 200 | 33 | 43 |
| /debts/receivables?pageSize=500 | 200 | 3 | 4 |
| /inventory | 200 | 4 | 4 |
| /reports/stock-vs-gl | 200 | 13 | 14 |
| /reports/inventory | 200 | 3 | 5 |
| /accounting/journal-entries?page=1&pageSize=20 | 200 | 7 | 8 |
| /accounting/reports/balance-sheet/pdf?asOfDate=2026-10-10 | 200 | 78 | 99 |
| /accounting/reports/income-statement/pdf?startDate=2026-10-01&endDate=2026-10-10 | 200 | 68 | 71 |
| /customers/1/statement/pdf?startDate=2026-10-01&endDate=2026-10-10 | 200 | 32 | 41 |
| /sales/report/pdf?startDate=2026-10-01&endDate=2026-10-10 | 200 | 103 | 108 |
| /payments?pageSize=500 | 200 | 26 | 29 |
| /stock-transfer/source-lots | 200 | 2 | 3 |

## Write-path timings during the simulation

| call | n | p50 | p95 | max |
|---|---|---|---|---|
| POST /sales | 374 | 296 | 791 | 1069 |
| POST /expenses | 15 | 271 | 716 | 716 |
| POST /stock-transfer | 10 | 311 | 711 | 711 |
| POST /purchases | 15 | 281 | 691 | 691 |
| GET /barcode/lookup | 24 | 11 | 582 | 600 |
| GET /accounting/trial-balance | 10 | 281 | 440 | 440 |
| POST /users | 1 | 434 | 434 | 434 |
| POST /payments/sale | 31 | 31 | 306 | 520 |
| POST /sales/:id/void | 2 | 285 | 285 | 285 |
| POST /payments/purchase | 4 | 20 | 273 | 273 |
| POST /wastage | 14 | 18 | 270 | 270 |
| GET /customers/:id | 6 | 2 | 262 | 262 |
| PUT /purchases/:id | 1 | 29 | 29 | 29 |
| GET /accounting/ledger/:id | 10 | 13 | 18 | 18 |
| POST /items | 7 | 14 | 17 | 17 |
| POST /bank-accounts | 1 | 16 | 16 | 16 |
| GET /reports/profit-loss | 10 | 3 | 16 | 16 |
| POST /accounting/journal-entries | 2 | 15 | 15 | 15 |
| GET /reports/dashboard | 10 | 3 | 15 | 15 |
| GET /reports/stock-vs-gl | 10 | 9 | 12 | 12 |
| POST /customers | 6 | 10 | 11 | 11 |
| POST /suppliers | 3 | 9 | 11 | 11 |
| POST /accounting/journal-entries/:id/post | 2 | 10 | 10 | 10 |
| GET /reports/sales | 10 | 7 | 8 | 8 |
| GET /debts/summary | 10 | 3 | 4 | 4 |

## Errors / blocked operations

- {"day":9,"at":"2026-10-09T04:30:00.000Z","user":"owner","method":"POST","path":"/purchases","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: 286.63 ₪, required: 3172.46 ₪. Shortfall: 2885.83 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"supplierId":2,"purchaseDate":"2026-10-09T04:30:00.000Z","lines":[
- {"day":10,"at":"2026-10-10T17:00:00.000Z","user":"owner","method":"POST","path":"/expenses","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: 1992.94 ₪, required: 4200.00 ₪. Shortfall: 2207.06 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"categoryId":6,"description":"راتب عامل 1","amount":420000,"expen