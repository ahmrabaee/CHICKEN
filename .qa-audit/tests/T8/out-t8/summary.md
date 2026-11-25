# Summary t8 ({"DAYS":30,"SEED":20261001,"TRANSFER_COST":"allocated"})

## Counts
```
{"sales":1119,"voided":6,"jes":1441,"purchases":40,"payments":1212,"transfers":30,"wastage":44,"expenses":30}
```

## Month-end: truth vs every system representation (₪)

| Quantity | Truth (shadow) | System representations | Δ (system − truth) |
|---|---|---|---|
| Cash in drawer (1111) | 8,520.25 | GL: -4,029.75<br>TB?asOfDate: -4,029.75 | GL: -12,550.00<br>TB?asOfDate: -12,550.00 |
| Bank (1112-001) | 98,716.10 | GL: 111,266.10 | GL: 12,550.00 |
| Receivables | 1,757.91 | GL 1120: 1,806.47<br>Σ customer.currentBalance: 1,782.91<br>open debts: 1,782.91<br>PLE: 1,806.47<br>dashboard: 1,947.98<br>/debts/summary: 1,782.91 | GL 1120: 48.56<br>Σ customer.currentBalance: 25.00<br>open debts: 25.00<br>PLE: 48.56<br>dashboard: 190.07<br>/debts/summary: 25.00 |
| Payables | 5,358.82 | GL 2110: 5,358.82<br>Σ supplier.currentBalance: 35,947.33<br>open debts: 5,358.82<br>dashboard: 5,358.82 | GL 2110: 0.00<br>Σ supplier.currentBalance: 30,588.51<br>open debts: 0.00<br>dashboard: 0.00 |
| Inventory value | 8,833.85 | GL 1131: 8,833.27<br>inventory.total_value: 8,833.96<br>Σ lots: 8,848.84 | GL 1131: -0.58<br>inventory.total_value: 0.11<br>Σ lots: 14.99 |
| Net revenue MTD (excl. VAT, after discounts/allowances) | 81,121.24 | GL 4110: 81,337.15<br>P&L report revenue: 81,160.15 | GL 4110: 215.91<br>P&L report revenue: 38.91 |
| COGS MTD | 47,280.44 | GL 5100: 47,279.97<br>P&L report COGS: 47,279.97 | GL 5100: -0.47<br>P&L report COGS: -0.47 |
| Wastage | 1,179.00 | GL 5300: 1,179.00 | GL 5300: 0.00 |
| Stock adj./transfer variance | 10.86 | GL 5320: 11.91 | GL 5320: 1.05 |
| Operating expenses (incl. bad debt) | 15,195.56 | GL 5400: 15,349.00<br>P&L report expenses: 15,147.00 | GL 5400: 153.44<br>P&L report expenses: -48.56 |
| VAT payable | 13.91 | GL 2120: 0.00 | GL 2120: -13.91 |
| Net income MTD | 17,455.38 | GL income stmt: 17,517.27<br>P&L report: 18,733.18 | GL income stmt: 61.89<br>P&L report: 1,277.80 |

Stock qty (g): truth 952710, inventory 952710, lots 954060. TB Dr−Cr: 0.

## Customers (₪)

| customer | truth owed | customer.currentBalance | open debts | PLE (statement basis) |
|---|---|---|---|---|
| amir | 1,118.55 | 1,143.55 | 1,143.55 | 1,118.55 |
| sultan | 0.41 | 0.41 | 0.41 | 0.41 |
| hotel | 210.28 | 210.28 | 210.28 | 210.28 |
| abukhalil | 211.73 | 211.73 | 211.73 | 211.73 |
| ummoh | 168.03 | 168.03 | 168.03 | 168.03 |
| noor | 48.91 | 48.91 | 48.91 | 97.47 |

## Suppliers (₪)

| supplier | truth owed | supplier.currentBalance | open debts | PLE |
|---|---|---|---|---|
| farm | 5,358.82 | 33,728.82 | 5,358.82 | 5,358.82 |
| whole | 0.00 | 2,218.51 | 0.00 | 0.00 |
| offal | 0.00 | 0.00 | 0.00 | 0.00 |

## Items (qty g / value ₪)

| item | truth qty | inv qty | lot qty | truth value | inv value | lot value | avgCost/kg | neg lots |
|---|---|---|---|---|---|---|---|---|
| whole | 17460 | 17460 | 17460 | 189.44 | 189.49 | 189.44 | 10.85 | 0 |
| breast | 230110 | 230110 | 230110 | 3,724.89 | 3,724.86 | 3,724.89 | 16.19 | 0 |
| thigh | 271745 | 271745 | 273095 | 3,022.86 | 3,023.05 | 3,037.82 | 11.12 | 0 |
| wings | 52755 | 52755 | 52755 | 398.07 | 398.06 | 398.07 | 7.55 | 0 |
| backs | 324150 | 324150 | 324150 | 991.36 | 991.30 | 991.36 | 3.06 | 0 |
| minced | 200 | 200 | 200 | 2.80 | 2.78 | 2.80 | 13.90 | 0 |
| liver | 56290 | 56290 | 56290 | 504.46 | 504.42 | 504.46 | 8.96 | 0 |

## Endpoint timings with a month of data (5 calls each)

| endpoint | status | median ms | max ms |
|---|---|---|---|
| /reports/dashboard | 200 | 2 | 3 |
| /reports/sales?startDate=2026-10-01&endDate=2026-10-30 | 200 | 89 | 95 |
| /reports/profit-loss?startDate=2026-10-01&endDate=2026-10-30 | 200 | 8 | 16 |
| /accounting/trial-balance | 200 | 4 | 5 |
| /accounting/ledger/1111?startDate=2026-10-01&endDate=2026-10-30 | 200 | 35 | 49 |
| /sales?page=1&pageSize=20 | 200 | 4 | 5 |
| /sales?pageSize=500 | 200 | 42 | 66 |
| /debts/receivables?pageSize=500 | 200 | 5 | 6 |
| /inventory | 200 | 3 | 4 |
| /reports/stock-vs-gl | 200 | 31 | 40 |
| /reports/inventory | 200 | 4 | 5 |
| /accounting/journal-entries?page=1&pageSize=20 | 200 | 7 | 8 |
| /accounting/reports/balance-sheet/pdf?asOfDate=2026-10-30 | 200 | 173 | 195 |
| /accounting/reports/income-statement/pdf?startDate=2026-10-01&endDate=2026-10-30 | 200 | 145 | 151 |
| /customers/1/statement/pdf?startDate=2026-10-01&endDate=2026-10-30 | 200 | 43 | 57 |
| /sales/report/pdf?startDate=2026-10-01&endDate=2026-10-30 | 200 | 239 | 275 |
| /payments?pageSize=500 | 200 | 28 | 29 |
| /stock-transfer/source-lots | 200 | 3 | 5 |

## Write-path timings during the simulation

| call | n | p50 | p95 | max |
|---|---|---|---|---|
| POST /expenses | 37 | 259 | 504 | 742 |
| POST /stock-transfer | 30 | 279 | 442 | 712 |
| POST /users | 1 | 429 | 429 | 429 |
| GET /accounting/trial-balance | 30 | 252 | 415 | 635 |
| POST /sales | 1119 | 278 | 329 | 1093 |
| POST /purchases | 45 | 269 | 326 | 803 |
| GET /barcode/lookup | 99 | 9 | 289 | 741 |
| POST /sales/:id/void | 6 | 273 | 287 | 287 |
| POST /inventory/adjustments | 2 | 278 | 278 | 278 |
| POST /payments/purchase | 22 | 19 | 274 | 285 |
| POST /payments/sale | 172 | 16 | 270 | 491 |
| POST /debts/:id/write-off | 1 | 261 | 261 | 261 |
| POST /wastage | 44 | 15 | 259 | 279 |
| POST /credit-notes | 1 | 252 | 252 | 252 |
| GET /customers/:id | 6 | 2 | 248 | 248 |
| GET /accounting/ledger/:id | 30 | 22 | 49 | 50 |
| GET /reports/stock-vs-gl | 30 | 17 | 31 | 34 |
| PUT /purchases/:id | 1 | 29 | 29 | 29 |
| POST /items | 7 | 11 | 22 | 22 |
| POST /accounting/journal-entries | 5 | 11 | 15 | 15 |
| GET /reports/dashboard | 30 | 2 | 14 | 18 |
| POST /credit-notes/:id/submit | 1 | 14 | 14 | 14 |
| POST /bank-accounts | 1 | 12 | 12 | 12 |
| POST /accounting/journal-entries/:id/post | 5 | 7 | 12 | 12 |
| POST /customers | 6 | 9 | 11 | 11 |

## Errors / blocked operations

- {"day":9,"at":"2026-10-09T04:30:00.000Z","user":"owner","method":"POST","path":"/purchases","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: 286.63 ₪, required: 3172.46 ₪. Shortfall: 2885.83 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"supplierId":2,"purchaseDate":"2026-10-09T04:30:00.000Z","lines":[
- {"day":15,"at":"2026-10-15T04:30:00.000Z","user":"owner","method":"POST","path":"/purchases","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: -3264.04 ₪, required: 1392.38 ₪. Shortfall: 4656.42 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"supplierId":2,"purchaseDate":"2026-10-15T04:30:00.000Z","lines
- {"day":15,"at":"2026-10-15T17:00:00.000Z","user":"owner","method":"POST","path":"/expenses","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: -1863.78 ₪, required: 116.00 ₪. Shortfall: 1979.78 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"categoryId":8,"description":"وقود سيارة التوصيل","amount":11600,
- {"day":15,"at":"2026-10-15T17:00:00.000Z","user":"owner","method":"POST","path":"/expenses","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: -1863.78 ₪, required: 280.00 ₪. Shortfall: 2143.78 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"categoryId":5,"description":"فاتورة مياه","amount":28000,"expens
- {"day":16,"at":"2026-10-16T17:00:00.000Z","user":"owner","method":"POST","path":"/expenses","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: -222.68 ₪, required: 109.00 ₪. Shortfall: 331.68 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"categoryId":8,"description":"وقود سيارة التوصيل","amount":10900,"e
- {"day":17,"at":"2026-10-17T04:30:00.000Z","user":"owner","method":"POST","path":"/purchases","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: -222.68 ₪, required: 1062.00 ₪. Shortfall: 1284.68 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"supplierId":1,"purchaseDate":"2026-10-17T04:30:00.000Z","lines"
- {"day":22,"at":"2026-10-22T04:30:00.000Z","user":"owner","method":"POST","path":"/purchases","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: -3297.40 ₪, required: 996.00 ₪. Shortfall: 4293.40 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"supplierId":1,"purchaseDate":"2026-10-22T04:30:00.000Z","lines"
- {"day":22,"at":"2026-10-22T17:00:00.000Z","user":"owner","method":"POST","path":"/expenses","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: -650.07 ₪, required: 71.00 ₪. Shortfall: 721.07 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"categoryId":8,"description":"وقود سيارة التوصيل","amount":7100,"exp
- {"day":22,"at":"2026-10-22T17:00:00.000Z","user":"owner","method":"POST","path":"/expenses","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: -650.07 ₪, required: 450.00 ₪. Shortfall: 1100.07 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"categoryId":7,"description":"صيانة ثلاجة","amount":45000,"expense
- {"day":29,"at":"2026-10-29T17:00:00.000Z","user":"owner","method":"POST","path":"/expenses","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: -2365.30 ₪, required: 109.00 ₪. Shortfall: 2474.30 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"categoryId":8,"description":"وقود سيارة التوصيل","amount":10900,
- {"day":30,"at":"2026-10-30T04:30:00.000Z","user":"owner","method":"POST","path":"/purchases","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: -2365.30 ₪, required: 1741.43 ₪. Shortfall: 4106.73 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"supplierId":2,"purchaseDate":"2026-10-30T04:30:00.000Z","lines
- {"day":30,"at":"2026-10-30T17:00:00.000Z","user":"owner","method":"POST","path":"/expenses","status":400,"code":"INSUFFICIENT_BALANCE","msg":"Insufficient balance in النقد في الصندوق. Available: 170.25 ₪, required: 4200.00 ₪. Shortfall: 4029.75 ₪. Use bank transfer or card if balance suffices, or record as credit purchase.","body":{"categoryId":6,"description":"راتب عامل 1","amount":420000,"expens