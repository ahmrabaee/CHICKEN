# Divergence log (t8) — every operation that changed (system − truth) of a metric

## First appearance per metric

| metric | day | time | operation | Δ after (₪ or g) |
|---|---|---|---|---|
| inv_gl | 1 2026-10-01 | 05:00 | stock-transfer cut 115kg lot 1 (allocated) | -0.06 |
| net_income | 1 2026-10-01 | 05:00 | stock-transfer cut 115kg lot 1 (allocated) | -0.06 |
| cash_gl | 1 2026-10-01 | 17:00 | expense rent 6000.00 bank_transfer | -6000.00 |
| bank_gl | 1 2026-10-01 | 17:00 | expense rent 6000.00 bank_transfer | 6000.00 |
| ap_suppBal | 7 2026-10-07 | 17:30 | supplier payment farm PUR#1 2220.53 bank_transfer | 2220.53 |
| ar_custBal | 12 2026-10-12 | 16:00 | credit note SAL-20261009-0046 25.00 | 25.00 |
| ar_debts | 12 2026-10-12 | 16:00 | credit note SAL-20261009-0046 25.00 | 25.00 |
| inv_table | 14 2026-10-14 | 16:00 | stock adjustment thigh decrease 1.35kg | -0.36 |
| inv_lots | 14 2026-10-14 | 16:00 | stock adjustment thigh decrease 1.35kg | 14.47 |
| lotqty_thigh | 14 2026-10-14 | 16:00 | stock adjustment thigh decrease 1.35kg | 1350 g |
| vat_gl | 20 2026-10-20 | 07:21 | sale#667 credit hotel VAT (tax invoice) | -13.91 |
| ar_gl | 27 2026-10-27 | 16:00 | write-off debt of SAL-20261024-0007 48.56 | 48.56 |
| ar_ple | 27 2026-10-27 | 16:00 | write-off debt of SAL-20261024-0007 48.56 | 48.56 |

## Aggregated by operation type → metric (count, cumulative Δ)

| op type → metric | count | cumulative Δ |
|---|---|---|
| supplier payment farm bank_transfer → ap_suppBal | 20 | 28370.00 |
| expense rent bank_transfer → cash_gl | 1 | -6000.00 |
| expense rent bank_transfer → bank_gl | 1 | 6000.00 |
| expense salaries bank_transfer → cash_gl | 1 | -4200.00 |
| expense salaries bank_transfer → bank_gl | 1 | 4200.00 |
| expense elec bank_transfer → cash_gl | 1 | -2350.00 |
| expense elec bank_transfer → bank_gl | 1 | 2350.00 |
| supplier payment whole cash → ap_suppBal | 2 | 2218.51 |
| write-off debt of → ar_gl | 1 | 48.56 |
| write-off debt of → ar_ple | 1 | 48.56 |
| write-off debt of → net_income | 1 | 48.56 |
| credit note → ar_custBal | 1 | 25.00 |
| credit note → ar_debts | 1 | 25.00 |
| stock adjustment thigh decreasekg → inv_lots | 1 | 14.47 |
| sale credit hotel VAT (tax invoice) → vat_gl | 1 | -13.91 |
| sale credit hotel VAT (tax invoice) → net_income | 1 | 13.91 |
| stock adjustment thigh decreasekg → lotqty_thigh | 1 | 1350 g |
| sale card → inv_lots | 17 | 1.28 |
| sale card → inv_gl | 2 | 1.27 |
| sale card → inv_table | 2 | 1.27 |
| sale card → net_income | 2 | 1.27 |
| stock-transfer cut (allocated) → inv_gl | 29 | -0.69 |
| stock-transfer cut (allocated) → net_income | 29 | -0.69 |
| sale credit amir → inv_gl | 3 | -0.57 |
| sale credit amir → inv_table | 3 | -0.57 |
| sale credit amir → net_income | 3 | -0.57 |
| sale credit amir → inv_lots | 4 | -0.55 |
| stock adjustment thigh decreasekg → inv_gl | 1 | -0.36 |
| stock adjustment thigh decreasekg → inv_table | 1 | -0.36 |
| stock adjustment thigh decreasekg → net_income | 1 | -0.36 |
| sale credit sultan → inv_lots | 2 | -0.23 |
| sale credit sultan → inv_gl | 1 | -0.21 |
| sale credit sultan → inv_table | 1 | -0.21 |
| sale credit sultan → net_income | 1 | -0.21 |
| sale cash → inv_lots | 59 | 0.13 |
| sale cash disc400 → inv_gl | 2 | -0.08 |
| sale cash disc400 → inv_table | 2 | -0.08 |
| sale cash disc400 → inv_lots | 2 | -0.08 |
| sale cash disc400 → net_income | 2 | -0.08 |
| sale cash barcode → inv_lots | 5 | -0.05 |
| sale cash disc300 → inv_gl | 1 | 0.03 |
| sale cash disc300 → inv_table | 1 | 0.03 |
| sale cash disc300 → net_income | 1 | 0.03 |
| sale cash → inv_gl | 12 | 0.03 |
| sale cash → inv_table | 12 | 0.03 |
| sale cash → net_income | 12 | 0.03 |
| sale cash disc300 → inv_lots | 4 | 0.02 |
| sale cash disc100 → inv_lots | 3 | -0.01 |
| wastage thigh expired → inv_lots | 1 | -0.01 |
| sale partial noor → inv_lots | 1 | -0.01 |
| sale partial ummoh → inv_lots | 1 | 0.01 |
| void sale (cash) → inv_lots | 1 | -0.01 |
| sale credit ummoh → inv_lots | 2 | 0.00 |

## All changes

| day | time | op | metric | before | after | change |
|---|---|---|---|---|---|---|
| 1 | 05:00 | stock-transfer cut 115kg lot 1 (allocated) | inv_gl | 0 | -6 | -6 |
| 1 | 05:00 | stock-transfer cut 115kg lot 1 (allocated) | net_income | 0 | -6 | -6 |
| 1 | 17:00 | expense rent 6000.00 bank_transfer | cash_gl | 0 | -600000 | -600000 |
| 1 | 17:00 | expense rent 6000.00 bank_transfer | bank_gl | 0 | 600000 | 600000 |
| 2 | 05:00 | stock-transfer cut 169kg lot 8 (allocated) | inv_gl | -6 | 19 | 25 |
| 2 | 05:00 | stock-transfer cut 169kg lot 8 (allocated) | net_income | -6 | 19 | 25 |
| 3 | 05:00 | stock-transfer cut 63kg lot 14 (allocated) | inv_gl | 19 | 22 | 3 |
| 3 | 05:00 | stock-transfer cut 63kg lot 14 (allocated) | net_income | 19 | 22 | 3 |
| 4 | 05:00 | stock-transfer cut 64kg lot 20 (allocated) | inv_gl | 22 | 6 | -16 |
| 4 | 05:00 | stock-transfer cut 64kg lot 20 (allocated) | net_income | 22 | 6 | -16 |
| 5 | 05:00 | stock-transfer cut 112kg lot 27 (allocated) | inv_gl | 6 | 35 | 29 |
| 5 | 05:00 | stock-transfer cut 112kg lot 27 (allocated) | net_income | 6 | 35 | 29 |
| 6 | 05:00 | stock-transfer cut 108kg lot 33 (allocated) | inv_gl | 35 | 29 | -6 |
| 6 | 05:00 | stock-transfer cut 108kg lot 33 (allocated) | net_income | 35 | 29 | -6 |
| 7 | 05:00 | stock-transfer cut 46kg lot 39 (allocated) | inv_gl | 29 | 22 | -7 |
| 7 | 05:00 | stock-transfer cut 46kg lot 39 (allocated) | net_income | 29 | 22 | -7 |
| 7 | 17:30 | supplier payment farm PUR#1 2220.53 bank_transfer | ap_suppBal | 0 | 222053 | 222053 |
| 7 | 17:30 | supplier payment farm PUR#3 1560.99 bank_transfer | ap_suppBal | 222053 | 378152 | 156099 |
| 7 | 17:30 | supplier payment farm PUR#5 1075.35 bank_transfer | ap_suppBal | 378152 | 485687 | 107535 |
| 7 | 17:30 | supplier payment farm PUR#7 393.13 bank_transfer | ap_suppBal | 485687 | 525000 | 39313 |
| 8 | 05:00 | stock-transfer cut 101kg lot 46 (allocated) | inv_gl | 22 | 48 | 26 |
| 8 | 05:00 | stock-transfer cut 101kg lot 46 (allocated) | net_income | 22 | 48 | 26 |
| 9 | 05:00 | stock-transfer cut 165kg lot 52 (allocated) | inv_gl | 48 | 4 | -44 |
| 9 | 05:00 | stock-transfer cut 165kg lot 52 (allocated) | net_income | 48 | 4 | -44 |
| 10 | 05:00 | stock-transfer cut 135kg lot 59 (allocated) | inv_gl | 4 | 22 | 18 |
| 10 | 05:00 | stock-transfer cut 135kg lot 59 (allocated) | net_income | 4 | 22 | 18 |
| 10 | 17:00 | expense elec 2350.00 bank_transfer | cash_gl | -600000 | -835000 | -235000 |
| 10 | 17:00 | expense elec 2350.00 bank_transfer | bank_gl | 600000 | 835000 | 235000 |
| 11 | 05:00 | stock-transfer cut 110kg lot 66 (allocated) | inv_gl | 22 | -6 | -28 |
| 11 | 05:00 | stock-transfer cut 110kg lot 66 (allocated) | net_income | 22 | -6 | -28 |
| 12 | 05:00 | stock-transfer cut 110kg lot 72 (allocated) | inv_gl | -6 | 1 | 7 |
| 12 | 05:00 | stock-transfer cut 110kg lot 72 (allocated) | net_income | -6 | 1 | 7 |
| 12 | 16:00 | credit note SAL-20261009-0046 25.00 | ar_custBal | 0 | 2500 | 2500 |
| 12 | 16:00 | credit note SAL-20261009-0046 25.00 | ar_debts | 0 | 2500 | 2500 |
| 13 | 05:00 | stock-transfer cut 87kg lot 78 (allocated) | inv_gl | 1 | -4 | -5 |
| 13 | 05:00 | stock-transfer cut 87kg lot 78 (allocated) | net_income | 1 | -4 | -5 |
| 14 | 05:00 | stock-transfer cut 112kg lot 85 (allocated) | inv_gl | -4 | -33 | -29 |
| 14 | 05:00 | stock-transfer cut 112kg lot 85 (allocated) | net_income | -4 | -33 | -29 |
| 14 | 16:00 | stock adjustment thigh decrease 1.35kg | inv_gl | -33 | -69 | -36 |
| 14 | 16:00 | stock adjustment thigh decrease 1.35kg | inv_table | 0 | -36 | -36 |
| 14 | 16:00 | stock adjustment thigh decrease 1.35kg | inv_lots | 0 | 1447 | 1447 |
| 14 | 16:00 | stock adjustment thigh decrease 1.35kg | net_income | -33 | -69 | -36 |
| 14 | 16:00 | stock adjustment thigh decrease 1.35kg | lotqty_thigh | 0 | 1350 | 1350 |
| 14 | 17:30 | supplier payment farm PUR#7 1834.04 bank_transfer | ap_suppBal | 525000 | 708404 | 183404 |
| 14 | 17:30 | supplier payment farm PUR#9 416.67 bank_transfer | ap_suppBal | 708404 | 750071 | 41667 |
| 14 | 17:30 | supplier payment farm PUR#11 1573.60 bank_transfer | ap_suppBal | 750071 | 907431 | 157360 |
| 14 | 17:30 | supplier payment farm PUR#13 2098.05 bank_transfer | ap_suppBal | 907431 | 1117236 | 209805 |
| 14 | 17:30 | supplier payment farm PUR#15 1385.64 bank_transfer | ap_suppBal | 1117236 | 1255800 | 138564 |
| 15 | 05:00 | stock-transfer cut 71kg lot 92 (allocated) | inv_gl | -69 | -74 | -5 |
| 15 | 05:00 | stock-transfer cut 71kg lot 92 (allocated) | net_income | -69 | -74 | -5 |
| 15 | 07:18 | sale#502 cash  | inv_lots | 1447 | 1448 | 1 |
| 15 | 08:03 | sale#505 card  | inv_lots | 1448 | 1447 | -1 |
| 15 | 11:10 | sale#517 cash  | inv_lots | 1447 | 1448 | 1 |
| 15 | 12:43 | sale#523 cash  | inv_lots | 1448 | 1447 | -1 |
| 15 | 15:50 | sale#535 card  | inv_lots | 1447 | 1448 | 1 |
| 16 | 05:00 | stock-transfer cut 158kg lot 98 (allocated) | inv_gl | -74 | -54 | 20 |
| 16 | 05:00 | stock-transfer cut 158kg lot 98 (allocated) | net_income | -74 | -54 | 20 |
| 16 | 07:13 | sale#540 cash  | inv_lots | 1448 | 1447 | -1 |
| 16 | 11:16 | sale#553 cash  | inv_lots | 1447 | 1448 | 1 |
| 16 | 11:53 | sale#555 cash  | inv_lots | 1448 | 1447 | -1 |
| 16 | 13:26 | sale#560 credit amir  | inv_gl | -54 | -12 | 42 |
| 16 | 13:26 | sale#560 credit amir  | inv_table | -36 | 6 | 42 |
| 16 | 13:26 | sale#560 credit amir  | inv_lots | 1447 | 1489 | 42 |
| 16 | 13:26 | sale#560 credit amir  | net_income | -54 | -12 | 42 |
| 17 | 05:00 | stock-transfer cut 118kg lot 105 (allocated) | inv_gl | -12 | -3 | 9 |
| 17 | 05:00 | stock-transfer cut 118kg lot 105 (allocated) | net_income | -12 | -3 | 9 |
| 17 | 07:27 | sale#574 cash  | inv_lots | 1489 | 1490 | 1 |
| 17 | 08:02 | sale#576 card  | inv_lots | 1490 | 1489 | -1 |
| 17 | 17:30 | supplier payment whole PUR#16 976.96 cash | ap_suppBal | 1255800 | 1353496 | 97696 |
| 19 | 05:00 | stock-transfer cut 111kg lot 117 (allocated) | inv_gl | -3 | -33 | -30 |
| 19 | 05:00 | stock-transfer cut 111kg lot 117 (allocated) | net_income | -3 | -33 | -30 |
| 19 | 06:32 | sale#625 cash disc300  | inv_gl | -33 | -30 | 3 |
| 19 | 06:32 | sale#625 cash disc300  | inv_table | 6 | 9 | 3 |
| 19 | 06:32 | sale#625 cash disc300  | inv_lots | 1489 | 1492 | 3 |
| 19 | 06:32 | sale#625 cash disc300  | net_income | -33 | -30 | 3 |
| 19 | 06:49 | sale#626 cash  | inv_gl | -30 | 33 | 63 |
| 19 | 06:49 | sale#626 cash  | inv_table | 9 | 72 | 63 |
| 19 | 06:49 | sale#626 cash  | inv_lots | 1492 | 1555 | 63 |
| 19 | 06:49 | sale#626 cash  | net_income | -30 | 33 | 63 |
| 19 | 07:38 | sale#629 cash  | inv_gl | 33 | 38 | 5 |
| 19 | 07:38 | sale#629 cash  | inv_table | 72 | 77 | 5 |
| 19 | 07:38 | sale#629 cash  | inv_lots | 1555 | 1560 | 5 |
| 19 | 07:38 | sale#629 cash  | net_income | 33 | 38 | 5 |
| 19 | 10:06 | sale#638 card  | inv_lots | 1560 | 1561 | 1 |
| 19 | 13:23 | sale#650 credit amir  | inv_gl | 38 | -76 | -114 |
| 19 | 13:23 | sale#650 credit amir  | inv_table | 77 | -37 | -114 |
| 19 | 13:23 | sale#650 credit amir  | inv_lots | 1561 | 1448 | -113 |
| 19 | 13:23 | sale#650 credit amir  | net_income | 38 | -76 | -114 |
| 19 | 13:56 | sale#652 cash disc100  | inv_lots | 1448 | 1447 | -1 |
| 20 | 05:00 | stock-transfer cut 112kg lot 124 (allocated) | inv_gl | -76 | -105 | -29 |
| 20 | 05:00 | stock-transfer cut 112kg lot 124 (allocated) | net_income | -76 | -105 | -29 |
| 20 | 07:21 | sale#667 credit hotel VAT (tax invoice) | vat_gl | 0 | -1391 | -1391 |
| 20 | 07:21 | sale#667 credit hotel VAT (tax invoice) | net_income | -105 | 1286 | 1391 |
| 20 | 08:56 | sale#674 cash  | inv_lots | 1447 | 1448 | 1 |
| 20 | 09:09 | sale#675 cash  | inv_lots | 1448 | 1447 | -1 |
| 20 | 12:30 | sale#690 cash  | inv_lots | 1447 | 1448 | 1 |
| 20 | 14:31 | sale#699 cash  | inv_lots | 1448 | 1447 | -1 |
| 20 | 14:58 | sale#701 cash  | inv_lots | 1447 | 1448 | 1 |
| 20 | 15:11 | sale#702 cash  | inv_lots | 1448 | 1447 | -1 |
| 20 | 15:25 | sale#703 card  | inv_lots | 1447 | 1448 | 1 |
| 21 | 05:00 | stock-transfer cut 90kg lot 130 (allocated) | inv_gl | -105 | -108 | -3 |
| 21 | 05:00 | stock-transfer cut 90kg lot 130 (allocated) | net_income | 1286 | 1283 | -3 |
| 21 | 06:15 | sale#707 cash  | inv_gl | -108 | -77 | 31 |
| 21 | 06:15 | sale#707 cash  | inv_table | -37 | -6 | 31 |
| 21 | 06:15 | sale#707 cash  | inv_lots | 1448 | 1478 | 30 |
| 21 | 06:15 | sale#707 cash  | net_income | 1283 | 1314 | 31 |
| 21 | 06:45 | sale#709 card  | inv_gl | -77 | 53 | 130 |
| 21 | 06:45 | sale#709 card  | inv_table | -6 | 124 | 130 |
| 21 | 06:45 | sale#709 card  | inv_lots | 1478 | 1607 | 129 |
| 21 | 06:45 | sale#709 card  | net_income | 1314 | 1444 | 130 |
| 21 | 07:01 | sale#710 card  | inv_lots | 1607 | 1608 | 1 |
| 21 | 10:06 | sale#722 credit sultan  | inv_lots | 1608 | 1607 | -1 |
| 21 | 10:52 | sale#725 cash  | inv_gl | 53 | -42 | -95 |
| 21 | 10:52 | sale#725 cash  | inv_table | 124 | 29 | -95 |
| 21 | 10:52 | sale#725 cash  | inv_lots | 1607 | 1514 | -93 |
| 21 | 10:52 | sale#725 cash  | net_income | 1444 | 1349 | -95 |
| 21 | 12:56 | sale#733 card  | inv_gl | -42 | -45 | -3 |
| 21 | 12:56 | sale#733 card  | inv_table | 29 | 26 | -3 |
| 21 | 12:56 | sale#733 card  | inv_lots | 1514 | 1510 | -4 |
| 21 | 12:56 | sale#733 card  | net_income | 1349 | 1346 | -3 |
| 21 | 13:27 | sale#735 cash  | inv_lots | 1510 | 1511 | 1 |
| 21 | 14:45 | sale#740 cash barcode  | inv_lots | 1511 | 1510 | -1 |
| 21 | 15:32 | sale#742 cash  | inv_lots | 1510 | 1511 | 1 |
| 21 | 17:30 | supplier payment farm PUR#15 88.88 bank_transfer | ap_suppBal | 1353496 | 1362384 | 8888 |
| 21 | 17:30 | supplier payment farm PUR#17 1140.00 bank_transfer | ap_suppBal | 1362384 | 1476384 | 114000 |
| 21 | 17:30 | supplier payment farm PUR#19 1902.60 bank_transfer | ap_suppBal | 1476384 | 1666644 | 190260 |
| 21 | 17:30 | supplier payment farm PUR#21 2859.36 bank_transfer | ap_suppBal | 1666644 | 1952580 | 285936 |
| 21 | 17:30 | supplier payment farm PUR#23 1062.94 bank_transfer | ap_suppBal | 1952580 | 2058874 | 106294 |
| 21 | 17:30 | supplier payment farm PUR#25 335.22 bank_transfer | ap_suppBal | 2058874 | 2092396 | 33522 |
| 21 | 18:00 | wastage thigh 0.4kg lot 101 expired | inv_lots | 1511 | 1510 | -1 |
| 22 | 05:00 | stock-transfer cut 112kg lot 136 (allocated) | inv_gl | -45 | -49 | -4 |
| 22 | 05:00 | stock-transfer cut 112kg lot 136 (allocated) | net_income | 1346 | 1342 | -4 |
| 22 | 07:57 | sale#751 cash  | inv_lots | 1510 | 1511 | 1 |
| 22 | 11:35 | sale#766 partial noor  | inv_lots | 1511 | 1510 | -1 |
| 22 | 12:47 | sale#771 card  | inv_lots | 1510 | 1511 | 1 |
| 22 | 14:58 | sale#780 cash  | inv_lots | 1511 | 1510 | -1 |
| 22 | 15:55 | sale#784 partial ummoh  | inv_lots | 1510 | 1511 | 1 |
| 23 | 05:00 | stock-transfer cut 169kg lot 143 (allocated) | inv_gl | -49 | -40 | 9 |
| 23 | 05:00 | stock-transfer cut 169kg lot 143 (allocated) | net_income | 1342 | 1351 | 9 |
| 23 | 06:31 | sale#788 card  | inv_lots | 1511 | 1510 | -1 |
| 23 | 07:02 | sale#791 cash  | inv_lots | 1510 | 1511 | 1 |
| 23 | 07:12 | sale#792 cash  | inv_lots | 1511 | 1510 | -1 |
| 23 | 07:54 | sale#796 cash  | inv_lots | 1510 | 1511 | 1 |
| 23 | 08:04 | sale#797 cash  | inv_lots | 1511 | 1510 | -1 |
| 23 | 08:36 | sale#800 cash disc300  | inv_lots | 1510 | 1511 | 1 |
| 23 | 08:46 | sale#801 cash  | inv_lots | 1511 | 1510 | -1 |
| 23 | 09:39 | sale#806 cash  | inv_lots | 1510 | 1511 | 1 |
| 23 | 10:32 | sale#811 cash  | inv_lots | 1511 | 1510 | -1 |
| 23 | 10:53 | sale#813 credit ummoh  | inv_lots | 1510 | 1511 | 1 |
| 23 | 12:18 | sale#821 cash  | inv_gl | -40 | -8 | 32 |
| 23 | 12:18 | sale#821 cash  | inv_table | 26 | 58 | 32 |
| 23 | 12:18 | sale#821 cash  | inv_lots | 1511 | 1542 | 31 |
| 23 | 12:18 | sale#821 cash  | net_income | 1351 | 1383 | 32 |
| 23 | 12:29 | sale#822 cash  | inv_gl | -8 | 56 | 64 |
| 23 | 12:29 | sale#822 cash  | inv_table | 58 | 122 | 64 |
| 23 | 12:29 | sale#822 cash  | inv_lots | 1542 | 1607 | 65 |
| 23 | 12:29 | sale#822 cash  | net_income | 1383 | 1447 | 64 |
| 23 | 13:01 | sale#825 cash  | inv_lots | 1607 | 1606 | -1 |
| 24 | 05:00 | stock-transfer cut 129kg lot 149 (allocated) | inv_gl | 56 | 20 | -36 |
| 24 | 05:00 | stock-transfer cut 129kg lot 149 (allocated) | net_income | 1447 | 1411 | -36 |
| 24 | 07:31 | sale#850 cash  | inv_lots | 1606 | 1607 | 1 |
| 24 | 09:13 | sale#859 cash  | inv_lots | 1607 | 1606 | -1 |
| 24 | 09:35 | sale#861 cash  | inv_lots | 1606 | 1607 | 1 |
| 24 | 11:29 | sale#871 cash disc300  | inv_lots | 1607 | 1606 | -1 |
| 24 | 11:53 | sale#873 cash  | inv_lots | 1606 | 1607 | 1 |
| 24 | 13:23 | sale#881 cash barcode  | inv_lots | 1607 | 1606 | -1 |
| 24 | 15:06 | sale#890 card  | inv_lots | 1606 | 1607 | 1 |
| 24 | 17:30 | supplier payment whole PUR#32 1241.55 cash | ap_suppBal | 2092396 | 2216551 | 124155 |
| 25 | 05:00 | stock-transfer cut 112kg lot 155 (allocated) | inv_gl | 20 | 14 | -6 |
| 25 | 05:00 | stock-transfer cut 112kg lot 155 (allocated) | net_income | 1411 | 1405 | -6 |
| 25 | 06:15 | sale#897 credit ummoh  | inv_lots | 1607 | 1606 | -1 |
| 25 | 07:18 | sale#901 cash  | inv_lots | 1606 | 1607 | 1 |
| 25 | 08:36 | sale#906 cash disc400  | inv_gl | 14 | 11 | -3 |
| 25 | 08:36 | sale#906 cash disc400  | inv_table | 122 | 119 | -3 |
| 25 | 08:36 | sale#906 cash disc400  | inv_lots | 1607 | 1604 | -3 |
| 25 | 08:36 | sale#906 cash disc400  | net_income | 1405 | 1402 | -3 |
| 25 | 09:07 | sale#908 cash  | inv_gl | 11 | 8 | -3 |
| 25 | 09:07 | sale#908 cash  | inv_table | 119 | 116 | -3 |
| 25 | 09:07 | sale#908 cash  | inv_lots | 1604 | 1601 | -3 |
| 25 | 09:07 | sale#908 cash  | net_income | 1402 | 1399 | -3 |
| 25 | 09:23 | sale#909 cash  | inv_lots | 1601 | 1602 | 1 |
| 25 | 09:53 | sale#911 cash  | inv_gl | 8 | -80 | -88 |
| 25 | 09:53 | sale#911 cash  | inv_table | 116 | 28 | -88 |
| 25 | 09:53 | sale#911 cash  | inv_lots | 1602 | 1513 | -89 |
| 25 | 09:53 | sale#911 cash  | net_income | 1399 | 1311 | -88 |
| 25 | 10:24 | sale#913 cash  | inv_gl | -80 | -144 | -64 |
| 25 | 10:24 | sale#913 cash  | inv_table | 28 | -36 | -64 |
| 25 | 10:24 | sale#913 cash  | inv_lots | 1513 | 1450 | -63 |
| 25 | 10:24 | sale#913 cash  | net_income | 1311 | 1247 | -64 |
| 25 | 13:30 | sale#925 card  | inv_lots | 1450 | 1449 | -1 |
| 25 | 13:45 | sale#926 cash  | inv_lots | 1449 | 1450 | 1 |
| 26 | 05:00 | stock-transfer cut 64kg lot 162 (allocated) | inv_gl | -144 | -127 | 17 |
| 26 | 05:00 | stock-transfer cut 64kg lot 162 (allocated) | net_income | 1247 | 1264 | 17 |
| 26 | 07:40 | sale#943 cash barcode  | inv_lots | 1450 | 1449 | -1 |
| 26 | 08:09 | sale#945 cash  | inv_lots | 1449 | 1450 | 1 |
| 26 | 08:11 | void sale SAL-20261026-0009 (cash) | inv_lots | 1450 | 1449 | -1 |
| 26 | 08:56 | sale#949 cash  | inv_lots | 1449 | 1450 | 1 |
| 26 | 10:09 | sale#954 credit amir  | inv_gl | -127 | -112 | 15 |
| 26 | 10:09 | sale#954 credit amir  | inv_table | -36 | -21 | 15 |
| 26 | 10:09 | sale#954 credit amir  | inv_lots | 1450 | 1465 | 15 |
| 26 | 10:09 | sale#954 credit amir  | net_income | 1264 | 1279 | 15 |
| 26 | 10:24 | sale#955 cash  | inv_gl | -112 | -29 | 83 |
| 26 | 10:24 | sale#955 cash  | inv_table | -21 | 62 | 83 |
| 26 | 10:24 | sale#955 cash  | inv_lots | 1465 | 1549 | 84 |
| 26 | 10:24 | sale#955 cash  | net_income | 1279 | 1362 | 83 |
| 26 | 10:53 | sale#957 cash  | inv_lots | 1549 | 1548 | -1 |
| 26 | 12:33 | sale#964 card  | inv_lots | 1548 | 1549 | 1 |
| 27 | 05:00 | stock-transfer cut 74kg lot 168 (allocated) | inv_gl | -29 | -25 | 4 |
| 27 | 05:00 | stock-transfer cut 74kg lot 168 (allocated) | net_income | 1362 | 1366 | 4 |
| 27 | 07:28 | sale#982 card  | inv_lots | 1549 | 1548 | -1 |
| 27 | 07:45 | sale#983 cash  | inv_lots | 1548 | 1549 | 1 |
| 27 | 08:38 | sale#986 cash  | inv_lots | 1549 | 1548 | -1 |
| 27 | 11:14 | sale#995 cash  | inv_lots | 1548 | 1549 | 1 |
| 27 | 11:31 | sale#996 cash  | inv_lots | 1549 | 1548 | -1 |
| 27 | 14:27 | sale#1006 cash  | inv_lots | 1548 | 1549 | 1 |
| 27 | 14:45 | sale#1007 cash barcode  | inv_lots | 1549 | 1548 | -1 |
| 27 | 15:20 | sale#1009 cash  | inv_lots | 1548 | 1549 | 1 |
| 27 | 16:00 | write-off debt of SAL-20261024-0007 48.56 | ar_gl | 0 | 4856 | 4856 |
| 27 | 16:00 | write-off debt of SAL-20261024-0007 48.56 | ar_ple | 0 | 4856 | 4856 |
| 27 | 16:00 | write-off debt of SAL-20261024-0007 48.56 | net_income | 1366 | 6222 | 4856 |
| 28 | 05:00 | stock-transfer cut 112kg lot 174 (allocated) | inv_gl | -25 | -17 | 8 |
| 28 | 05:00 | stock-transfer cut 112kg lot 174 (allocated) | net_income | 6222 | 6230 | 8 |
| 28 | 07:31 | sale#1015 cash disc100  | inv_lots | 1549 | 1548 | -1 |
| 28 | 09:04 | sale#1018 credit sultan  | inv_gl | -17 | -38 | -21 |
| 28 | 09:04 | sale#1018 credit sultan  | inv_table | 62 | 41 | -21 |
| 28 | 09:04 | sale#1018 credit sultan  | inv_lots | 1548 | 1526 | -22 |
| 28 | 09:04 | sale#1018 credit sultan  | net_income | 6230 | 6209 | -21 |
| 28 | 10:35 | sale#1021 card  | inv_lots | 1526 | 1527 | 1 |
| 28 | 11:06 | sale#1022 cash  | inv_lots | 1527 | 1526 | -1 |
| 28 | 14:40 | sale#1029 card  | inv_lots | 1526 | 1527 | 1 |
| 28 | 17:30 | supplier payment farm PUR#25 1147.38 bank_transfer | ap_suppBal | 2216551 | 2331289 | 114738 |
| 28 | 17:30 | supplier payment farm PUR#27 2018.84 bank_transfer | ap_suppBal | 2331289 | 2533173 | 201884 |
| 28 | 17:30 | supplier payment farm PUR#29 996.81 bank_transfer | ap_suppBal | 2533173 | 2632854 | 99681 |
| 28 | 17:30 | supplier payment farm PUR#31 2844.66 bank_transfer | ap_suppBal | 2632854 | 2917320 | 284466 |
| 28 | 17:30 | supplier payment farm PUR#33 1415.31 bank_transfer | ap_suppBal | 2917320 | 3058851 | 141531 |
| 29 | 05:00 | stock-transfer cut 112kg lot 181 (allocated) | inv_gl | -38 | -23 | 15 |
| 29 | 05:00 | stock-transfer cut 112kg lot 181 (allocated) | net_income | 6209 | 6224 | 15 |
| 29 | 11:17 | sale#1044 card  | inv_lots | 1527 | 1526 | -1 |
| 29 | 13:02 | sale#1048 cash  | inv_gl | -23 | -37 | -14 |
| 29 | 13:02 | sale#1048 cash  | inv_table | 41 | 27 | -14 |
| 29 | 13:02 | sale#1048 cash  | inv_lots | 1526 | 1511 | -15 |
| 29 | 13:02 | sale#1048 cash  | net_income | 6224 | 6210 | -14 |
| 29 | 13:28 | sale#1049 cash disc400  | inv_gl | -37 | -42 | -5 |
| 29 | 13:28 | sale#1049 cash disc400  | inv_table | 27 | 22 | -5 |
| 29 | 13:28 | sale#1049 cash disc400  | inv_lots | 1511 | 1506 | -5 |
| 29 | 13:28 | sale#1049 cash disc400  | net_income | 6210 | 6205 | -5 |
| 30 | 05:00 | stock-transfer cut 81kg lot 187 (allocated) | inv_gl | -42 | -47 | -5 |
| 30 | 05:00 | stock-transfer cut 81kg lot 187 (allocated) | net_income | 6205 | 6200 | -5 |
| 30 | 06:37 | sale#1059 cash  | inv_lots | 1506 | 1507 | 1 |
| 30 | 07:44 | sale#1066 cash  | inv_lots | 1507 | 1506 | -1 |
| 30 | 09:48 | sale#1079 cash  | inv_lots | 1506 | 1507 | 1 |
| 30 | 11:24 | sale#1089 cash barcode  | inv_lots | 1507 | 1506 | -1 |
| 30 | 11:43 | sale#1091 cash  | inv_lots | 1506 | 1507 | 1 |
| 30 | 12:11 | sale#1094 cash disc300  | inv_lots | 1507 | 1506 | -1 |
| 30 | 13:27 | sale#1101 cash disc100  | inv_lots | 1506 | 1507 | 1 |
| 30 | 15:02 | sale#1111 cash  | inv_lots | 1507 | 1506 | -1 |
| 30 | 15:20 | sale#1113 credit amir  | inv_lots | 1506 | 1507 | 1 |
| 30 | 15:59 | sale#1117 cash  | inv_gl | -47 | -58 | -11 |
| 30 | 15:59 | sale#1117 cash  | inv_table | 22 | 11 | -11 |
| 30 | 15:59 | sale#1117 cash  | inv_lots | 1507 | 1496 | -11 |
| 30 | 15:59 | sale#1117 cash  | net_income | 6200 | 6189 | -11 |
| 30 | 17:00 | expense salaries 4200.00 bank_transfer | cash_gl | -835000 | -1255000 | -420000 |
| 30 | 17:00 | expense salaries 4200.00 bank_transfer | bank_gl | 835000 | 1255000 | 420000 |