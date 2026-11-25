# T7 coverage (UI/E2E, Playwright headless Chromium, locale ar, TZ Asia/Jerusalem)

## Executed (script → output in tests/T7/)
| Area | Script | Notes |
|---|---|---|
| Route crawl: every route as admin and as accountant (console, page errors, 4xx/5xx, access-denied) | crawl.mjs → crawl-admin/acc1.out.txt | admin clean; accountant 403s listed in T7-010 |
| Setup wizard (baseline t7b) | setup.mjs, setup-replay.mjs | OK; see observation |
| Login errors, user creation, duplicate, weak password, logout | users.mjs, acc.mjs | T7-009, T7-024 |
| Role menus, direct-URL access, live page revocation | crawl acc1, users.mjs, acc.mjs | T7-011, T7-023 |
| ORCH-002 payment form, admin and accountant, with and without banks | orch002.mjs, acc.mjs | T7-001, T7-010 |
| POS: cash, credit, card with and without bank, tax 10/15/16 %, partial, 0.01 short, discounts (neg / 100 %), double submit, print/XSS, preview, weight edit, numeric input edge cases, huge weight, >100 items, scale barcode (weight / inferred / two labels / unknown) | pos1/2/3.mjs, limits.mjs, barcode.mjs | T7-002..008, 015, 022 |
| Purchases: pay-full rounding, Arabic digits / decimal comma / thousands separator, edit paid purchase | purchase.mjs, purchase-edit.mjs | T7-012..014 |
| Payments: >500 sales deep link, overpayment, thousands separator | limits.mjs | T7-016 |
| Expenses: normal, insufficient cash, thousands, tax | expenses.mjs | T7-019 |
| Stock adjustment dialog, wastage create and detail, stock-transfer page render | stock.mjs | T7-021 |
| Reports presets with real and fake clock, PDF dialog params, dashboard vs debts vs GL | reports.mjs, dashboard.mjs | T7-017, T7-018 |
| PDFs (text extracted): sale invoice, customer/supplier statements, debts, sales report today, balance sheet / income statement / trial balance | pdfs.mjs, pdftext.mjs, accounting.mjs, accounting2.mjs | T7-020; accounting PDFs = DB |
| Accounting journals list (ORCH-001) | accounting.mjs | not reproduced |

UI-shown values were compared with POST bodies, GET responses and SQL (journal lines, debts, customer balances, inventory).

## Reviewed only / not executed
- Stock transfer submission (page rendered only; T2 covers posting).
- Credit notes, reconciliation apply UI, branches, settings tabs (tax template UI, barcode config UI, backup), audit page: visited by the crawl only (no errors), no functional flows.
- Customer default-discount label (K4-014), K4-019 margin on tax-inclusive total: seen in the sale detail (31.0 % on 40.60) but not filed separately.
- Tauri WebView specifics (print dialog, CSP): not available headless; the browser-equivalent behaviour was tested.

## Data notes
The t7 DB holds 106+ active items (QA-0xx), 530+ sales (505 × 0.22 cash filler), bank BANK-001 (→1112-001), templates "VAT 16% QA"/"VAT 10% QA", users acc1/acc2/acc3, item 123456 "فخذ ميزان". Some acc1 page access was toggled and restored.
