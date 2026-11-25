# K4 coverage

## Executed
- Frontend unit tests (read-only): `cd app/frontend && npx vitest run` → 10 files, 108 tests, ALL PASS (vitest 3.2.4, 9.7 s). Log: `.qa-audit/logs/K4-vitest.log`. Only stderr noise: expected `[money] toMoneyNumber: non-finite` warnings.
- `.qa-audit/tests/K4/tz-date-range.mjs` — reproduces Reports/PDF/statement default date-range logic under TZ=Asia/Jerusalem, Asia/Gaza, UTC → VERIFIED K4-007 (one-day shift).
- Greps: all ×/÷1000 and ×/÷100 sites, error-envelope access patterns, query-key invalidations, backend controller guard decorators, frontend service endpoints vs backend controllers.

## Reviewed (code only)
- App.tsx routing, ProtectedRoute, PageAccessGate, useRole, roles.ts, AuthContext, lib/auth, lib/axios (refresh), use-auth, Login, Setup.
- lib/currency, formatters, numbers, scale-barcode, api-errors; dashboard-utils; Dashboard.
- POS.tsx (full), WeightEntryDialog, barcode.service + backend barcode.service lookup, use-sales, sales.service, backend sales.service create totals (L330-415) and tax-calculation.service.
- PaymentProfile (create path), use-payments, PurchaseProfile, CreditNote dialog/profile, Reconciliation (apply), Debts (write-off), Sales detail, CustomerProfile/Customers discount, JournalEntryProfile, AdjustStockDialog, TransferStockDialog, Wastage.
- Backend guards: page-access.guard, roles.guard, global JwtAuthGuard, per-controller decorators summary; http-exception filter envelope.
- Tauri: tauri.conf.json, capabilities/default.json, src/lib.rs, main.rs, Cargo.toml.

## Not tested / not reviewed in depth
- No UI execution (no browser/E2E run) — all POS/gating/print findings are SUSPECTED; assigned to UI/E2E tester.
- Pages only skimmed: Accounting.tsx (944 lines), Reports.tsx rendering, ExpenseProfile beyond conversions, ItemProfile, SupplierProfile, BranchProfile, Users/UserForm, Settings tabs, StockTransferProfile, Inventory lists, backup feature.
- Tauri runtime behaviour (WebView2 print dialog, anchor downloads, devtools) — NOT-VERIFIABLE without building the desktop app (forbidden to rebuild dist).
- Backend semantics of date-only bounds and whether backend caps discount ≤ subtotal — left to backend testers.
- decision-log.md was not yet available; K2 bulletin consulted (money ×100 history, wastage raw units, write-off no GL, purchase edit deletes JEs).
