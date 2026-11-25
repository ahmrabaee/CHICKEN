# T3 coverage

Instances: `t3` (3105, fresh dev, legacy path) and `t3b` (3106, fresh dev; tax/GL engines toggled during tax.mjs, restored OFF at end). Both stopped at the end.
All scripts are re-runnable against a FRESH instance in this order: t3: xval → boundaries → lifecycle → barcode → statement; t3b: tax → reports.

## Executed (scripts + saved output in tests/T3/)
| Script | Covers |
|---|---|
| xval.mjs / xval.out.txt | Cross-validation of K3-001/002/003/013/014/021/022, K2-001, F-08, F-13, D-12, D-15, F-09, C-30, void rules (role, twice, no reason, seeded sale) |
| boundaries.mjs / .out.txt | header/line/pct discounts (0, 100%, > total), accountant cap bypass, price override, 1 g / 1 agora rounding, fractional/negative/zero weights & prices, empty lines, overpay +1/+2/change, credit without customer, 0 payment, invalid method, 3 tenders, past due date, credit limit, inactive customer/item, raw chicken, int32 overflow, invalid/purchase tax templates |
| lifecycle.mjs / .out.txt | Customer lifecycle with 6 representations compared at every step (GL AR by source docs, currentBalance, /debts, PLE, /reconciliation party outstanding, statement closing); void after CN; void after write-off; POS-partial + later payment + void; CN edges (> outstanding, 0, fractional, concurrent submit, double submit, cash sale, walk-in, voided sale, draft-before-void, accountant 100%); concurrent voids; concurrent payments; advance + allocation + re-collection |
| tax.mjs / .out.txt (t3b) | templates 15/16/compound/negative/group-account/inactive; engines OFF/OFF, tax-only, GL+tax ON, GL-only; discount+tax; taxed credit sale payment; CN on taxed sale; void taxed sale; VAT report vs GL; per-invoice rounding |
| reports.mjs / .out.txt (t3b) | /reports/sales, /reports/profit-loss, dashboard vs GL; invoice PDF (ar/en) contents incl. tax line, voided, with CN; sales-report PDF and VAT PDF date boundaries; receipt JSON; statement PDF |
| barcode.mjs / .out.txt | 25-digit seeded template (weight-embedded, price-embedded, check digit, unknown, inactive, non-digits, accountant), static EAN, 14-digit price-embedded template via settings, label total vs saved line, config API validation |
| statement.mjs / .out.txt | statement PLE path vs fallback path continuity |
| invariants-t3*.out.txt | T1 shared checker on both DBs (flags DEBT-01/DOC-02/DOC-03/DOC-05 from T3 scenarios; INV-01 5600.00 = dev seed stock without GL, expected) |

## Reviewed only (code)
- getReceipt JSON (store name from non-seeded keys → always 'Chicken Shop'); invoice PDF payments list includes voided payments; sales list for non-admin filtered by cashier but /sales/:id is not (T5 area).
- VAT report `isReversed:false` filter (GL-engine reversal semantics) — only the void path exercised.
- Dashboard "today" uses server-local midnight (not executed across timezones; see K4-007).

## Not tested (why)
- UI/POS behaviour (receipt printing, cart rounding) — T7 scope; backend halves of K4-001/K4-002 verified.
- Period lock / freeze date on void/CN — no API to create periods; would need SQL seeding of `accounting_freeze_date`; left to T1 (period scope).
- Void of an "old" sale across a month boundary — sale dates are always `now` (no backdating API), can only be simulated by SQL; not done.
- Partial return then void — no partial-return feature exists in the backend (only CN amount without goods).
- Payment allocation FIFO vs specific invoice: payments are always bound to one sale (no FIFO auto-allocation exists); advance allocation tested.
- GL-engine-ON variants of K3-001/K3-002/K3-003 — not repeated (T1 runs engines-ON).
