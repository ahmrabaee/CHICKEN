# Frontend Architecture (K4)

Scope: `app/frontend/src` (React 18 + Vite + TS + Tailwind/shadcn + TanStack Query v5 + react-hook-form/zod + axios + sonner/shadcn toasts), wrapped by Tauri 2 (`app/src-tauri`). Arabic RTL UI. ~36k LOC (21.6k in pages/hooks/services/lib). Lead findings: `findings/K4.md` (K4-001..K4-020). All paths below relative to `app/frontend/src` unless noted.

## 0. Cross-cutting facts
- API base: `import.meta.env.VITE_API_URL || 'http://localhost:3000/v1'` (lib/axios.ts:5). `.env` = `http://localhost:3000/v1`. Vite dev port 1420 strict (vite.config.ts). The Tauri app does NOT start the backend; backend must be running separately.
- Backend envelope: success `{success:true,data,...pagination}`; error `{success:false,error:{code,message,messageAr}}`. Many UI sites read the wrong level (K4-008).
- QueryClient: `new QueryClient()` defaults (staleTime 0, retry 3 for queries, refetchOnWindowFocus). No optimistic updates except `setQueryData` in BankAccountsSettingsTab.tsx:91 and use-accounting.ts:40.
- Units on the wire: money = integer minor units (agorot, ×100, symbol ₪); weight = integer grams; percentages = basis points (tax rates, customer discount). UI inputs are in ₪ and kg and convert on submit.

## 1. Route / page inventory
Routing (App.tsx). Public: `/login`, `/setup`. Everything else: `ProtectedRoute` (setup check → auth check) → `MainLayout` (sidebar + `PageAccessGate`, which renders AccessDenied if `canAccessPath(pathname)` is false). No route uses `allowedRoles`. Gate logic (hooks/useRole.ts): admin → all; else if `user.allowedPages` non-empty → exact or prefix match; else → deny ADMIN_ONLY_PATHS (constants/roles.ts:23-38: /settings, /users, /branches, /audit, /traders, /expenses, /debts, /wastage, /purchasing, /reports/financial|profit-loss|stock-vs-gl|tax|vat). Backend always sends allowedPages (`['*']` for admin; role-default/user rows for others) via /auth/login and /auth/me (polled every 30 s + on focus, AuthContext.tsx:108-133).

| Path | Component | Purpose | API endpoints (via hooks/services) | UI gating (default role matrix) |
|---|---|---|---|---|
| / | pages/Dashboard.tsx | KPIs, sales chart, debts & low-stock tables | GET /reports/sales (current + previous range), /debts/receivables?pageSize=500, /debts/payables?pageSize=500, /inventory/low-stock, /branches | all; debt widgets if admin or /debts allowed (and not 403) |
| /inventory (?tab=categories, stock-transfer) | pages/Inventory.tsx | stock list, lots, movements, adjust, categories, transfers tab | GET /inventory, /inventory/:id/lots, /:id/movements, POST /inventory/adjustments, /categories CRUD, DELETE /items/:id | all; create-item if /inventory/new; adjust if /inventory/adjustments |
| /inventory/new, /inventory/:id | pages/inventory/ItemProfile.tsx | item create/edit, initial stock | GET/POST/PUT /items, /categories, /inventory/:id | all (comment in App.tsx says admin-only — not enforced in UI defaults) |
| /categories, /adjustments, /stock-transfer | redirects to /inventory tabs | | | |
| /sales/new | pages/POS.tsx | point of sale | GET /items?isActive&pageSize=100, /customers?pageSize=500, /bank-accounts, /tax/templates?type=sales, /barcode/lookup; POST /sales | all |
| /sales, /sales/:id | pages/Sales.tsx | sales history, detail card, void, credit note | GET /sales, /sales/:id, /reconciliation/outstanding/sale/:id, /credit-notes; POST /sales/:id/void (admin at API), POST /credit-notes | all (void/cost visible to all — K4-009) |
| /purchasing, /purchasing/:id | pages/Purchasing.tsx | purchases list/detail, receive, delete, credit note | GET /purchases, /purchases/:id, PUT /purchases/:id/receive, DELETE /purchases/:id | admin-only |
| /purchasing/new, /purchasing/:id/edit | pages/purchasing/PurchaseProfile.tsx | purchase create/edit (+ paid-at-creation) | GET /suppliers, /categories/purchaseable, /bank-accounts; POST/PUT /purchases | admin-only |
| /customers, /customers/new, /customers/:id | pages/Customers.tsx, customers/CustomerProfile.tsx | customer CRUD, balance, statement PDF | /customers CRUD/search, PDF statement (pdf.service) | all |
| /traders, /traders/new, /traders/:id | pages/Suppliers.tsx, suppliers/SupplierProfile.tsx | supplier CRUD, statement | /suppliers CRUD, PDF | admin-only |
| /payments, /payments/new, /payments/:id | pages/Payments.tsx, payments/PaymentProfile.tsx | list, record sale/purchase/advance payment, cancel | GET /payments, /payments/:id, /sales?pageSize=500, /purchases?pageSize=100, /customers, /suppliers, /bank-accounts; POST /payments/sale, /payments/purchase, /payments/advance, /payments/:id/cancel | all |
| /reconciliation | pages/Reconciliation.tsx | allocate unallocated payments to invoices | GET /reconciliation/unallocated-payments, /open-invoices, /suggest; POST /reconciliation/apply | all |
| /credit-notes, /credit-notes/new, /credit-notes/:id | pages/CreditNotes.tsx, credit-notes/CreditNoteProfile.tsx | credit notes list/create/submit | /credit-notes, /credit-notes/:id/submit, /reconciliation/open-invoices | all |
| /expenses, /expenses/new, /expenses/:id | pages/Expenses.tsx, expenses/ExpenseProfile.tsx | expenses CRUD, approve | /expenses CRUD, /expenses/categories, /expenses/:id/approve, /expenses/summary, /branches, /suppliers | admin-only |
| /debts | pages/Debts.tsx | receivables/payables, detail, write-off | /debts/receivables, /payables, /summary, /debts/:id, POST /debts/:id/write-off | admin-only |
| /wastage, /wastage/new | pages/Wastage.tsx, wastage/WastageProfile.tsx | wastage list/create (lot-based) | /wastage, /inventory/:id/lots, /items | admin-only (API unguarded — K4-009) |
| /stock-transfer/new | pages/stock-transfer/StockTransferProfile.tsx (list = StockTransfer.tsx in inventory tab) | product-to-product transfer | /stock-transfer, /stock-transfer/products, /source-lots | all (API admin+accountant) |
| /reports, /reports/* | pages/Reports.tsx | sales, purchases, inventory, expenses, wastage, P&L, stock-vs-GL, VAT + PDF preview | /reports/sales|purchases|inventory|expenses|wastage|profit-loss|stock-vs-gl, /tax/vat-report, PDF endpoints | links filtered by canAccessPath (P&L/stock-vs-gl/vat/tax/financial admin-only in UI) |
| /accounting | pages/Accounting.tsx | chart of accounts tree, ledger, trial balance, JE list, balance/income/trial PDFs | /accounting/accounts CRUD, /accounts/:id/can-delete, /ledger/:code, /trial-balance, /journal-entries, /journal-entries/:id/post | all (API admin+accountant) |
| /accounting/journal/new | pages/accounting/JournalEntryProfile.tsx | manual JE | POST /accounting/journal-entries | all |
| /audit | pages/Audit.tsx | audit log | GET /audit | admin-only |
| /settings | pages/Settings.tsx (+ components/settings/*, features/backup) | company, accounting settings, bank accounts, barcode config, tax templates, page access, backup, change password | /settings, /settings/company, /settings/bulk, /bank-accounts, /barcode/config, /tax/templates, /page-access*, /system/backup*, /auth/change-password | admin-only |
| /users | pages/Users.tsx | user CRUD, reset password, sessions | /users*, /users/roles, /users/active-sessions, /branches | admin-only |
| /branches, /branches/new, /branches/:id | pages/Branches.tsx, branches/BranchProfile.tsx | branch CRUD + accounts | /branches*, /accounting/accounts | admin-only |
| /login | pages/Login.tsx | login | POST /auth/login | public |
| /setup | pages/Setup.tsx | first-run wizard (business + admin) | POST /auth/check-setup, /auth/setup | public; redirected away when setup complete |
| * | pages/NotFound.tsx | | | |

Counts: 36 page modules, 33 routed paths with real components (+3 redirects, 404); unrouted: PersonalExpenses.tsx, ForgotPassword.tsx.

## 2. Auth flow
- Storage: localStorage keys `access_token`, `refresh_token`, `user` (lib/auth.ts). `isAuthenticated` = access token present (no expiry check).
- Startup (AuthContext.tsx:100-106): POST /auth/check-setup → status `setup_complete|setup_incomplete|backend_unreachable(no response)|backend_error(503/other)`; then read localStorage. ProtectedRoute shows retry screen if backend unreachable, redirects to /setup when incomplete, to /login when no token.
- Setup (Setup.tsx): 2-step zod form (business name ≥2, admin full name ≥3, username ≥3 default "admin", password ≥8) → POST /auth/setup → refreshSetupStatus → navigate "/" → (not logged in) → /login. Tokens returned by setup are ignored.
- Login: Login.tsx uses authService.login directly (useLogin hook exists too, logs credentials). On success stores tokens + user (incl. role, allowedPages).
- Refresh: axios response interceptor (lib/axios.ts:55-143): on 401 for non-auth endpoints → single-flight POST /auth/refresh {refreshToken} with plain axios, queue concurrent requests, retry once; on failure clear storage and hard-redirect to /login. Refresh token is not rotated (kept).
- User refresh: GET /auth/me every 30 s and on focus/visibilitychange → updates role/allowedPages live.
- Logout: useLogout → POST /auth/logout, clear storage, `queryClient.clear()`, navigate /login (also on error). Forced logout (refresh failure) does not call /auth/logout.
- Gating is UI-only for page visibility; backend enforces via global JwtAuthGuard + per-controller RolesGuard / PageAccessGuard. Mismatches listed in K4-009 (wastage unguarded; reports P&L/stock-vs-GL/VAT accountant-accessible; debts receivables & :id; accounting JE for accountant; sales by-id no ownership; PageAccessGuard exact vs UI prefix match). Action-level gating in pages is almost absent (only Inventory create/adjust and Dashboard debts) — void, cancel, delete, JE post buttons rely on backend 403.

## 3. Money / weight / percent conversions
Convention: display `(minor/100).toFixed(2)`; submit `Math.round(major*100)`; weights `Math.round(kg*1000)` / `grams/1000`; bps `pct*100` / `bps/100`.

### 3.1 Every remaining ×/÷1000 — all are WEIGHT (legit); none is stale money
| file:line | conversion | verdict |
|---|---|---|
| dashboard/dashboard-utils.ts:366 | grams/1000 kg display | weight OK |
| inventory/AdjustStockDialog.tsx:78,82,132 | kg↔g | weight OK (unitCost ×100 at :104, fixed in 75b3211) |
| inventory/InventoryLotsDialog.tsx:80 | lot.remainingQuantity/1000 | weight OK |
| inventory/InventoryMovementsDialog.tsx:97 | quantityGrams/1000 | weight OK |
| pos/WeightEntryDialog.tsx:68,89,126 | kg↔g, 3-dec rounding | weight OK |
| lib/scale-barcode.ts:173 | round to 0.001 kg | weight OK (dead code) |
| inventory/ItemProfile.tsx:133-134,166-167,173,589,595 | min/max stock & initial qty kg↔g | weight OK |
| Inventory.tsx:310,451 | totalQuantity/1000 | weight OK |
| POS.tsx:145,157,183,404 | kg rounding, weightGrams | weight OK (321 is a setTimeout ms) |
| purchasing/PurchaseProfile.tsx:69,151 | kg↔g | weight OK |
| Purchasing.tsx:343-344 | weightGrams/1000 | weight OK |
| Reports.tsx:451,478,589,619 | totalWeight/currentWeight/weight /1000 | weight OK (assumes API grams — verify report payload units) |
| Sales.tsx:329 | line.weightGrams/1000 | weight OK |
| stock-transfer/StockTransfer.tsx:34; StockTransferProfile.tsx:50,221,224,260,263 | g↔kg; line value = round(g/1000 × unitCost per-kg minor) | weight OK |
| wastage/WastageProfile.tsx:54,88,171; Wastage.tsx:34,77 | g↔kg | weight OK |
Backend mirror: sales.service.ts:330 `round(weightGrams/1000 * pricePerKg)`, averageCost `totalValue*1000/grams` (per-kg) — consistent.

### 3.2 ×/÷100 money and bps sites (all consistent with ×100 convention)
Display formatters (≈20 local copies): lib/currency.ts:22, lib/formatters.ts:45, POS.tsx:44, WeightEntryDialog.tsx:24, ThermalReceipt.tsx:7, Sales.tsx:42, Payments.tsx:23, Expenses.tsx:21, CreditNotes.tsx:18, Reconciliation.tsx:29, Wastage.tsx:24, StockTransfer*.tsx, PaymentProfile.tsx:66, ExpenseProfile.tsx:64, JournalEntryProfile.tsx:46, CreditNoteProfile.tsx:45, InvoiceReferenceCombobox.tsx:52, CreditNoteCreateDialog.tsx:27, Customers/Suppliers formatAmount, Reports.tsx:53, ChartCard.tsx:77.
Input → minor: POS toMinor :48-51 (discount, paid), CreditNoteCreateDialog:85, CreditNoteProfile:155, PaymentProfile:459, ExpenseProfile:677-678 (+ preview 576-587 `watch*100`), ItemProfile:163-165,174, CustomerProfile:157-159, SupplierProfile:79, PurchaseProfile:65, Reconciliation:283, StockTransferProfile:236, AdjustStockDialog:104, JournalEntryProfile:305,328 (then Math.round at :131-132 on already-minor values — fine).
Basis points: TaxTemplatesTab.tsx:33 `rate/100 %`; ItemProfile.tsx:132,165 taxRatePct (comment "Assuming basis points"); CustomerProfile defaultDiscountPct ×100 (labelled ₪ — K4-014); POS.tsx:328 hard-coded `1500/10000` (K4-001); AccountingSettingsTab.tsx:181 tolerance/100.
Percent displays: Sales.tsx:299 profit/total×100; KpiGrid.tsx:60; Reports.tsx:571 margins (from API).

### 3.3 Float arithmetic on money (rounding risk)
- POS: line total `Math.round(qty*pricePerKg)` per line (matches backend per line); discount `Math.min(toMinor(discount), subtotal)`; tax estimate rounded once on net (backend rounds per tax row) — K4-001.
- PurchaseProfile.tsx:117-131: subtotal/grand/remaining summed in FLOAT ₪, rounded only on submit; "pay full" uses the float total → can disagree with backend's per-line rounded sum (K4-013).
- ExpenseProfile.tsx:576-587 preview `watchAmount*100` without rounding (display only).
- PaymentProfile.tsx:722-723 outstanding shown as `(total-paid)/100`; 933 `Number(amount).toFixed(2)`.
- WeightEntryDialog/POS store kg as JS floats with 3 decimals (then 2-decimal rounding on edit — K4-004).
- No decimal library anywhere; toFixed(2) used for all displays.

## 4. Business logic duplicated in the frontend
| Calculation | Frontend location | Backend authority | Divergence risk |
|---|---|---|---|
| Line total = round(kg × price/kg) | POS.tsx:148,158,223,236; WeightEntryDialog.tsx:67 | sales.service.ts:330 | low; but barcode lines use label total instead (K4-002) |
| Sale discount (₪ amount, capped at subtotal) | POS.tsx:325-326 | sales.service.ts:356-361 (also supports discountPct bps, per-line discount) | backend doesn't cap? (check) |
| Sales tax | POS.tsx:328 hard-coded 15% | tax-calculation.service.ts:34-74 template rows (on_net_total, previous row amount/total, actual) | HIGH (K4-001) |
| Grand total / remaining / overpayment (tolerance 1) / customer-required rule | POS.tsx:329-352 (phone ≥7 chars) | sales.service.ts:374-408 (phone ≥3, remaining >1) | medium (rules differ; edge of 1 minor) |
| Auto cash payment = full total when field empty | POS.tsx:409-414 | n/a (client decides payment amount) | tied to K4-001 |
| Barcode weight inference | lib/scale-barcode.ts (dead) | barcode.service.ts:127-156 | none live |
| Debt original/remaining | lib/formatters.ts:25-40 computeDebtNumbers; dashboard-utils.ts:244-249 | debts.service | low (field-name fallbacks hide API drift) |
| AR/AP KPIs, branch filter, date filter | Dashboard.tsx:159-199 | /debts/summary, GL | medium (K4-011) |
| Sale remaining | lib/currency.ts:31 safeRemaining, Sales.tsx:241, PaymentProfile.tsx:442-447 | PLE outstanding (/reconciliation/outstanding) | medium (credit notes ignored) |
| Purchase subtotal/grand/remaining | PurchaseProfile.tsx:117-131 | purchases.service | medium (K4-013) |
| Stock-transfer value | StockTransferProfile.tsx:50 | stock-transfer.service | display only |
| JE balance check (tolerance 5 minor) | JournalEntryProfile.tsx:52,67-80 | accounting service (verify same tolerance) | low |
| Credit-note limit ≤ outstanding | CreditNoteProfile.tsx:160, CreditNoteCreateDialog.tsx:89 | credit-note service | low |
| Adjust-stock guards (decrease ≤ available; increase-from-zero needs cost) | AdjustStockDialog.tsx:80-95 | inventory service | low |
| Wastage ≤ lot remaining | WastageProfile.tsx:88-92 | wastage service | low |
| Profit margin % | Sales.tsx:299 (on tax-incl. total) | reports.service grossMargin | low (K4-019) |
| FIFO/cost display | only displays backend totalCost/averageCost/effectiveCostPrice | backend FIFO | none |

## 5. POS flow (pages/POS.tsx)
1. Data: active items (first 100 only! pageSize 100 — items beyond 100 not shown/searchable since search is client-side), items with defaultSalePrice ≤ 0 hidden; customers (500); bank accounts; sales tax templates.
2. Manual mode: tap product → WeightEntryDialog (numpad, presets 0.25..2 kg, ±¼/½, min 0.1 kg, ≤3 decimals) → addToCart (new line) or setCartItemQuantity (replace, rounded to 0.01 kg). Cart row ±¼/½ buttons (0.01 rounding, min 0.1). Remove = by itemId.
3. Barcode mode: input + Enter → GET /barcode/lookup → `{item, weightKg, price(total minor)}` → separate line per scan with `total=price` (fromBarcode). Static barcode fallback = 1 kg at default price. Edits/removes affect all lines of that item (K4-003). Submitted as weightGrams+pricePerKg only (K4-002).
4. Customer: CustomerSearchCombobox (registered) or free name + phone; required for credit sale or explicit under-payment (name ≥2, phone ≥7). Backend auto-creates a customer by phone when needed.
5. Discount: ₪ amount input (not %); customer default discount/price level ignored.
6. Tax: template selector; estimated tax fixed 15% (K4-001).
7. Payment: sale type نقدي/آجل. Cash type: method cash/card/bank_transfer (single method only — no split/mixed tender), bank account select (default auto-selected; "— صندوق —" option allowed), paid amount: empty = full total; partial allowed (customer required); 0 not allowed; > total+0.01 blocked (no change-due computation). Credit type: no payments array, whole amount receivable. Later payments via /payments/new or /sales list "add payment".
8. Submit: `createSale.mutateAsync(dto)`; button disabled while pending (only guard; no idempotency key; backend PreventDoubleSubmitGuard only prevents duplicate JE for the same sale id — K4-006). Success → toast + clearCart; error → toast (correct envelope in use-sales).
9. Printing: "معاينة" (ThermalReceipt component, 80 mm) and "طباعة" build plain-text HTML into a hidden iframe and call `print()` (OS print dialog; NOT silent; no Tauri print command). Printed data = unsaved cart with estimated tax and no sale number; HTML not escaped (K4-005). No auto-print after completion; reprint only through Sales PDF (/sales/:id/pdf) or receipt endpoint (useSaleReceipt hook unused by POS).

## 6. Forms & validation (client) vs backend
| Form | Client validation | Notes vs backend |
|---|---|---|
| Sale (POS) | ad-hoc booleans: cart non-empty, paid>0 for cash, no overpayment, customer rule | backend re-validates overpayment & customer (phone ≥3); weightGrams/price not validated client-side beyond min 0.1 kg |
| Purchase | zod: supplier ≥1, line itemId ≥1, weightKg >0, price ≥0, tax ≥0, paid ≥0; filters zero-weight lines | no paid ≤ total check; price 0 allowed |
| Payment | zod: amount ≥0.01, method, date; bank required for card/transfer when banks exist; ref must be in loaded list | no amount ≤ outstanding |
| Expense | zod: category, description ≥3, amount ≥0.01, date | no client cash-balance check (backend INSUFFICIENT_BALANCE; message hidden by K4-008) |
| Stock adjustment | zod qty >0, reason ≥5; decrease ≤ available; cost required from zero stock | |
| Stock transfer | per-line weight ≤ max available displayed | |
| Wastage | item, lot, qty ≤ lot remaining | |
| Credit note | amount >0 and ≤ outstanding | |
| Journal entry | ≥2 lines, balanced within 5 minor | |
| User | username ≥3, password ≥8 (optional on edit), fullName, roleId | backend password policy may differ (errors hidden) |
| Setup | business ≥2, full name ≥3, username ≥3, password ≥8 | |
| Change password | old required, new ≥8, confirm match | |
| Customer/Supplier | name ≥2, phone regex refine, credit limit ≥0, rating 0-5 | discount label wrong (K4-014) |
| Item | name ≥2, category, sale price ≥0, taxRatePct 0-100, min/max stock, initial qty/cost | |
| Reconciliation | none | backend only |

## 7. Error handling patterns
- Two toast systems: shadcn `toast` (hooks/use-toast) and `sonner` (POS, settings, barcode). Mutations show destructive toasts in hook `onError`; pages often `await mutateAsync` inside try/catch that only console.errors (no double toasts) — PurchaseProfile awaits without try (unhandled rejection, toast from hook).
- Wrong envelope level in ~50 sites (K4-008); posting-error toasts dead.
- Swallowed errors: AuthContext.refreshUser catch {} ; BackupAutoSyncAgent logs only (marks backup synced right after triggering a download regardless of outcome); POS `catch {}` after createSale (toast in hook).
- Optimistic updates: none on financial data.
- Invalidation gaps: K4-017. Query keys used: accounting, audit, branches, categories, customers, debts, expenses, inventory, items, payments, purchases, reconciliation, reports, sales, stock-transfer, suppliers, tax, users, wastage, bank-accounts, backup.
- Console logging of all request/response bodies and credentials (K4-010).

## 8. Tauri specifics (`app/src-tauri`)
- tauri.conf.json: productName "Financial Management Program", identifier com.mohdb.financial-management, devUrl http://localhost:1420, frontendDist ../frontend/dist, one window 1080×1920, `security.csp: null`, bundles nsis(perMachine)+msi.
- capabilities/default.json: window "main", permissions `core:default`, `opener:default` only.
- Rust (src/lib.rs): boilerplate `greet` command + tauri-plugin-opener. No printing, filesystem, sidecar, updater or backend-launch commands. Frontend never imports @tauri-apps/api; Tauri detection via `window.__TAURI__`/`__TAURI_INTERNALS__` (main.tsx, BackupAutoSyncAgent.tsx). Printing = browser `window.print()` inside WebView2 (OS dialog, not silent). Backup "auto-sync" = anchor download of a signed link (behaviour in WebView2 not verified).
- CSP null + localStorage tokens + unescaped receipt HTML = XSS-to-token-theft surface (K4-005/K4-010).

## 9. Existing frontend tests (vitest, jsdom) — run 2026-11-24: 10 files, 108 tests, all pass
- src/test/example.test.ts (1, trivial)
- src/test/customers-filter.test.ts (10), branches-filter.test.ts (13) — list filtering helpers
- src/test/money-utils.test.ts (28) — toMoneyNumber, computeDebtNumbers, formatCurrency (lib/formatters)
- src/test/scale-barcode.test.ts (22) — lib/scale-barcode.ts (dead code; POS uses backend)
- src/test/purchasing-helpers.test.ts (16) — purchasing helpers
- src/features/backup/** (5+5+3+5) — backup API client, auto-sync agent, runs table, settings tab
No tests for POS, payments, auth/refresh interceptor, page gating, date ranges, tax, or any page. No E2E suite in frontend.

## 10. Leads for UI/E2E testers (top)
1. POS with a non-15% tax template (K4-001) — POS.tsx:328.
2. Scale barcode total vs saved line total; two scans of same item then edit/remove one (K4-002/003) — POS.tsx:144-245, 709.
3. Reports "this month" request params in Asia/Jerusalem TZ; create doc at 00:30 local (K4-007).
4. Accountant token: POST /wastage, GET /reports/profit-loss, /debts/receivables, journal entry create; UI void/cost buttons (K4-009).
5. Customer named with HTML → POS print (K4-005).
6. Trigger backend errors (insufficient cash expense, locked period, wrong password) and compare toast vs response (K4-008).
7. Purchase "pay full" with fractional kg lines; edit a paid purchase (K4-013).
8. Pay an old invoice (>500 sales) via /payments/new?saleId= (K4-012).
9. Dashboard AR KPI vs Debts page vs trial balance 1120 (K4-011).
10. POS: weight edit 0.255 kg → 0.26; item #101+ missing from POS grid (pageSize 100); double-click "إتمام البيع" (K4-004/006).
