# Divergence log (t8b) — every operation that changed (system − truth) of a metric

## First appearance per metric

| metric | day | time | operation | Δ after (₪ or g) |
|---|---|---|---|---|
| inv_gl | 1 2026-10-01 | 05:00 | stock-transfer cut 115kg lot 1 (ui-default) | -401.42 |
| net_income | 1 2026-10-01 | 05:00 | stock-transfer cut 115kg lot 1 (ui-default) | -401.42 |
| inv_lots | 1 2026-10-01 | 15:11 | sale#38 cash  | 0.01 |
| cash_gl | 1 2026-10-01 | 17:00 | expense rent 6000.00 bank_transfer | -6000.00 |
| bank_gl | 1 2026-10-01 | 17:00 | expense rent 6000.00 bank_transfer | 6000.00 |
| ap_suppBal | 7 2026-10-07 | 17:30 | supplier payment farm PUR#1 2220.53 bank_transfer | 2220.53 |

## Aggregated by operation type → metric (count, cumulative Δ)

| op type → metric | count | cumulative Δ |
|---|---|---|
| expense rent bank_transfer → cash_gl | 1 | -6000.00 |
| expense rent bank_transfer → bank_gl | 1 | 6000.00 |
| supplier payment farm bank_transfer → ap_suppBal | 4 | 5250.00 |
| expense salaries bank_transfer → cash_gl | 1 | -4200.00 |
| expense salaries bank_transfer → bank_gl | 1 | 4200.00 |
| stock-transfer cut (ui-default) → inv_gl | 10 | -3613.21 |
| stock-transfer cut (ui-default) → net_income | 10 | -3613.21 |
| expense elec bank_transfer → cash_gl | 1 | -2350.00 |
| expense elec bank_transfer → bank_gl | 1 | 2350.00 |
| sale cash barcode → inv_lots | 1 | 0.01 |
| sale credit amir → inv_lots | 1 | -0.01 |
| sale cash → inv_lots | 10 | 0.00 |

## All changes

| day | time | op | metric | before | after | change |
|---|---|---|---|---|---|---|
| 1 | 05:00 | stock-transfer cut 115kg lot 1 (ui-default) | inv_gl | 0 | -40142 | -40142 |
| 1 | 05:00 | stock-transfer cut 115kg lot 1 (ui-default) | net_income | 0 | -40142 | -40142 |
| 1 | 15:11 | sale#38 cash  | inv_lots | 0 | 1 | 1 |
| 1 | 17:00 | expense rent 6000.00 bank_transfer | cash_gl | 0 | -600000 | -600000 |
| 1 | 17:00 | expense rent 6000.00 bank_transfer | bank_gl | 0 | 600000 | 600000 |
| 2 | 05:00 | stock-transfer cut 169kg lot 8 (ui-default) | inv_gl | -40142 | -96018 | -55876 |
| 2 | 05:00 | stock-transfer cut 169kg lot 8 (ui-default) | net_income | -40142 | -96018 | -55876 |
| 2 | 06:48 | sale#44 cash  | inv_lots | 1 | 0 | -1 |
| 3 | 05:00 | stock-transfer cut 63kg lot 14 (ui-default) | inv_gl | -96018 | -114159 | -18141 |
| 3 | 05:00 | stock-transfer cut 63kg lot 14 (ui-default) | net_income | -96018 | -114159 | -18141 |
| 4 | 05:00 | stock-transfer cut 64kg lot 20 (ui-default) | inv_gl | -114159 | -138485 | -24326 |
| 4 | 05:00 | stock-transfer cut 64kg lot 20 (ui-default) | net_income | -114159 | -138485 | -24326 |
| 4 | 06:28 | sale#116 cash  | inv_lots | 0 | 1 | 1 |
| 4 | 07:26 | sale#120 cash  | inv_lots | 1 | 0 | -1 |
| 4 | 12:02 | sale#139 cash  | inv_lots | 0 | 1 | 1 |
| 4 | 12:59 | sale#143 cash  | inv_lots | 1 | 0 | -1 |
| 5 | 05:00 | stock-transfer cut 112kg lot 27 (ui-default) | inv_gl | -138485 | -175407 | -36922 |
| 5 | 05:00 | stock-transfer cut 112kg lot 27 (ui-default) | net_income | -138485 | -175407 | -36922 |
| 5 | 12:31 | sale#182 cash  | inv_lots | 0 | 1 | 1 |
| 5 | 12:45 | sale#183 cash  | inv_lots | 1 | 0 | -1 |
| 6 | 05:00 | stock-transfer cut 108kg lot 33 (ui-default) | inv_gl | -175407 | -205458 | -30051 |
| 6 | 05:00 | stock-transfer cut 108kg lot 33 (ui-default) | net_income | -175407 | -205458 | -30051 |
| 7 | 05:00 | stock-transfer cut 46kg lot 39 (ui-default) | inv_gl | -205458 | -223300 | -17842 |
| 7 | 05:00 | stock-transfer cut 46kg lot 39 (ui-default) | net_income | -205458 | -223300 | -17842 |
| 7 | 13:06 | sale#240 cash  | inv_lots | 0 | 1 | 1 |
| 7 | 14:02 | sale#243 cash  | inv_lots | 1 | 0 | -1 |
| 7 | 17:30 | supplier payment farm PUR#1 2220.53 bank_transfer | ap_suppBal | 0 | 222053 | 222053 |
| 7 | 17:30 | supplier payment farm PUR#3 1560.99 bank_transfer | ap_suppBal | 222053 | 378152 | 156099 |
| 7 | 17:30 | supplier payment farm PUR#5 1075.35 bank_transfer | ap_suppBal | 378152 | 485687 | 107535 |
| 7 | 17:30 | supplier payment farm PUR#7 393.13 bank_transfer | ap_suppBal | 485687 | 525000 | 39313 |
| 8 | 05:00 | stock-transfer cut 101kg lot 46 (ui-default) | inv_gl | -223300 | -256400 | -33100 |
| 8 | 05:00 | stock-transfer cut 101kg lot 46 (ui-default) | net_income | -223300 | -256400 | -33100 |
| 8 | 13:28 | sale#269 cash barcode  | inv_lots | 0 | 1 | 1 |
| 8 | 14:13 | sale#271 credit amir  | inv_lots | 1 | 0 | -1 |
| 9 | 05:00 | stock-transfer cut 165kg lot 52 (ui-default) | inv_gl | -256400 | -309353 | -52953 |
| 9 | 05:00 | stock-transfer cut 165kg lot 52 (ui-default) | net_income | -256400 | -309353 | -52953 |
| 10 | 05:00 | stock-transfer cut 135kg lot 59 (ui-default) | inv_gl | -309353 | -361321 | -51968 |
| 10 | 05:00 | stock-transfer cut 135kg lot 59 (ui-default) | net_income | -309353 | -361321 | -51968 |
| 10 | 17:00 | expense elec 2350.00 bank_transfer | cash_gl | -600000 | -835000 | -235000 |
| 10 | 17:00 | expense elec 2350.00 bank_transfer | bank_gl | 600000 | 835000 | 235000 |
| 10 | 17:00 | expense salaries 4200.00 bank_transfer | cash_gl | -835000 | -1255000 | -420000 |
| 10 | 17:00 | expense salaries 4200.00 bank_transfer | bank_gl | 835000 | 1255000 | 420000 |