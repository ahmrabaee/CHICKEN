# Full-Stack API Integration Plan — Financial Management Program

**Purpose:** This document is the single source of truth for integrating all remaining backend APIs into the frontend. Use it as a **prompt-plan** for an AI agent (e.g. Claude Opus 6) or for human developers. The database and backend logic are the **authoritative reference**; the frontend must align to them.

---

## Part 0: Mandatory Pre-Reading (Reference Implementation)

**Before implementing any API group, the agent MUST:**

1. **Read the Inventory frontend as the canonical pattern:**
   - **List page:** `app/frontend/src/pages/Inventory.tsx` — RTL layout, Arabic headings, search/filters, paginated table, primary CTA "إضافة صنف جديد" (or equivalent) linking to the create/profile route.
   - **Profile/Create page:** `app/frontend/src/pages/inventory/ItemProfile.tsx` — Arabic form labels, react-hook-form + zod validation, RTL-friendly form layout, save/cancel actions.
   - **Supporting pieces:** `app/frontend/src/hooks/use-inventory.ts`, `app/frontend/src/services/inventory.service.ts` and `item.service.ts`, `app/frontend/src/types/inventory.ts`, and inventory dialogs under `app/frontend/src/components/inventory/`.

2. **Apply consistently across all modules:**
   - **RTL:** Layout and text direction suitable for Arabic (e.g. `dir="rtl"` where applicable, logical ordering of columns and buttons).
   - **Arabic forms:** All user-facing labels and placeholders in Arabic; keep field names in code in English where they map to API.
   - **Profile pattern:** List page has a prominent "Create new" button that navigates to `/module/new`; detail/edit uses `/module/:id`. Same UX as Inventory/Customers/Suppliers/Branches.

3. **List + Detail data rule (critical):**
   - **List table:** Shows a **curated subset** of fields for scan and quick actions (e.g. code, name, status, main amount). Do not overload the table.
   - **Full record:** Every field that exists on the entity in the backend and is intended for "read" **must** be reachable. Provide an **"Eye" (view) button** per row that opens a **visually appealing detail card/modal** (or slide-over) showing **every** piece of data from that object. The backend/database schema defines what "every piece" means.

---

## Part 1: API Groups and Endpoints (Not Yet Linked)

Below are the API groups and every endpoint to be wired. For each group: implement **services**, **types**, **hooks**, **pages/routes**, and **components** so that the frontend matches backend behavior and the reference patterns above.

---

### 1. Sales (Point of Sale)

| Method | Path | Purpose | Frontend use |
|--------|------|---------|--------------|
| GET | `/v1/sales` | List sales (paginated) | Sales list page, filters, pagination |
| POST | `/v1/sales` | Create new sale (POS transaction) | POS / "new sale" flow |
| GET | `/v1/sales/{id}` | Get sale details with cost allocation | Sale detail view / receipt |
| POST | `/v1/sales/{id}/payments` | Add payment to sale | Payment step in sale detail or POS |
| GET | `/v1/sales/{id}/receipt` | Get receipt data for printing | Print receipt action |
| POST | `/v1/sales/{id}/void` | Void a sale | Admin-only void action (e.g. in dropdown) |

**Notes:** Already have `/sales`, `/sales/new` (POS), `/sales/:id`. Ensure list uses GET `/v1/sales`, detail uses GET `/v1/sales/{id}`, and payments/receipt/void are wired to the correct actions.

---

### 2. Reports & Analytics

| Method | Path | Purpose | Frontend use |
|--------|------|--------|--------------|
| GET | `/v1/reports/dashboard` | Dashboard summary | Dashboard page widgets |
| GET | `/v1/reports/expenses` | Expense report | Reports → expenses |
| GET | `/v1/reports/inventory` | Inventory report | Reports → inventory |
| GET | `/v1/reports/profit-loss` | P&amp;L report | Reports → profit & loss |
| GET | `/v1/reports/purchases` | Purchases report | Reports → purchases |
| GET | `/v1/reports/sales` | Sales report | Reports → sales |
| GET | `/v1/reports/wastage` | Wastage report | Reports → wastage |

**Notes:** Reports page exists; wire each report type to the correct endpoint and present data (tables/charts) with RTL and Arabic labels.

---

### 3. Purchases (Purchasing & Goods Receiving)

| Method | Path | Purpose | Frontend use |
|--------|------|--------|--------------|
| GET | `/v1/purchases` | List all purchases | Purchasing list |
| POST | `/v1/purchases` | Create new purchase order | New purchase form / profile |
| GET | `/v1/purchases/{id}` | Get purchase by ID | Purchase detail / profile |
| PUT | `/v1/purchases/{id}/receive` | Receive purchase order goods | "Receive" action on detail |

**Notes:** Routes exist for `/purchasing`, `/purchasing/new`, `/purchasing/:id`. Align list and profile with these endpoints; add receive flow using PUT receive.

---

### 4. Payments (Payment Processing)

| Method | Path | Purpose | Frontend use |
|--------|------|--------|--------------|
| GET | `/v1/payments` | List all payments | Payments list page (add if missing) |
| GET | `/v1/payments/{id}` | Get payment by ID | Payment detail (eye card) |
| POST | `/v1/payments/purchase` | Record a purchase payment | From purchase detail or payments |
| POST | `/v1/payments/sale` | Record a sale payment | From sale detail or POS |

**Notes:** Decide where "List all payments" lives (e.g. Reports, Settings, or dedicated Payments page). Sale/purchase payment recording may be from Sale/Purchase profile or a shared flow.

---

### 5. Expenses (Expense Tracking)

| Method | Path | Purpose | Frontend use |
|--------|------|--------|--------------|
| GET | `/v1/expenses` | List all expenses | Expenses list (e.g. PersonalExpenses or dedicated) |
| POST | `/v1/expenses` | Create new expense | Create expense form |
| GET | `/v1/expenses/{id}` | Get expense by ID | Expense detail (eye card / profile) |
| PUT | `/v1/expenses/{id}` | Update expense | Edit expense form |
| DELETE | `/v1/expenses/{id}` | Delete expense | Delete action with confirmation |
| POST | `/v1/expenses/{id}/approve` | Approve expense | Approve action (e.g. for admins) |
| GET | `/v1/expenses/categories` | Expense categories | Dropdown in form / filters |
| GET | `/v1/expenses/summary` | Summary by type | Summary card or report section |

**Notes:** Align with existing PersonalExpenses page; ensure list + profile (create/edit) + eye card follow the same pattern. Categories and summary drive filters and dashboard.

---

### 6. Debts (Receivables & Payables)

| Method | Path | Purpose | Frontend use |
|--------|------|--------|--------------|
| GET | `/v1/debts/{id}` | Get debt by ID | Debt detail (eye card) |
| GET | `/v1/debts/overdue` | Overdue debts | Dedicated view or filter on debts |
| GET | `/v1/debts/payables` | Supplier payables (we owe) | Payables list/section |
| GET | `/v1/debts/receivables` | Customer receivables (owed to us) | Receivables list/section |
| GET | `/v1/debts/summary` | Debts summary | Dashboard or debts overview |

**Notes:** No POST here; debts are typically created via sales/purchases. Frontend needs list views (receivables/payables/overdue) and detail view (eye card) from GET by ID. Summary for dashboard or a debts page.

---

### 7. Wastage (Wastage & Spoilage Tracking)

| Method | Path | Purpose | Frontend use |
|--------|------|--------|--------------|
| GET | `/v1/wastage` | List all wastage records | Wastage list page |
| POST | `/v1/wastage` | Record wastage | Create wastage form / dialog |
| GET | `/v1/wastage/{id}` | Get wastage by ID | Wastage detail (eye card) |

**Notes:** Add list + create + detail (and eye card) following the same profile pattern. May be under Inventory or a dedicated Wastage section.

---

### 8. Audit (Audit Logs)

| Method | Path | Purpose | Frontend use |
|--------|------|--------|--------------|
| GET | `/v1/audit` | List audit logs | Audit log page (e.g. Settings or Admin) |
| GET | `/v1/audit/counts` | Action counts | Dashboard or audit summary |

**Notes:** Read-only. List with filters (user, action, date) and optional eye card for full log entry.

---

### 9. Accounting (Journal Entries & Chart of Accounts) — High Priority

| Method | Path | Purpose | Frontend use |
|--------|------|--------|--------------|
| GET | `/v1/accounting/accounts` | Chart of accounts | CoA list / settings |
| POST | `/v1/accounting/accounts` | Create new account | Add account form |
| GET | `/v1/accounting/accounts/{code}` | Get account by code | Account detail (eye card) |
| PUT | `/v1/accounting/accounts/{code}` | Update account | Edit account form |
| GET | `/v1/accounting/journal-entries` | List journal entries | Journal list with filters |
| POST | `/v1/accounting/journal-entries` | Create manual journal entry | Create JE form |
| GET | `/v1/accounting/journal-entries/{id}` | Get journal entry by ID | JE detail (eye card) |
| POST | `/v1/accounting/journal-entries/{id}/post` | Post journal entry | Post action (e.g. button on detail) |
| GET | `/v1/accounting/ledger/{accountCode}` | Account ledger | Ledger view per account |
| GET | `/v1/accounting/trial-balance` | Trial balance | Trial balance report page |

**Notes:** This is the most critical business module. Implement CoA list + create/edit account + journal list + create JE + post JE + ledger + trial balance. All with RTL, Arabic labels, and eye card for full object view where relevant.

---

## Part 2: How API Groups Connect (Cross-Module Awareness)

- **Sales** ↔ **Payments:** Sale payments go through POST `/v1/sales/{id}/payments` or POST `/v1/payments/sale` (align with backend design). Receivables come from **Debts** (receivables).
- **Purchases** ↔ **Payments:** Purchase payments via POST `/v1/payments/purchase`. Payables from **Debts** (payables).
- **Expenses** use **Expense categories** (GET categories) and may feed **Reports** (expense report) and **Accounting** (if JEs are auto-generated).
- **Reports** consume data from Sales, Purchases, Inventory, Expenses, Wastage; dashboard from `/v1/reports/dashboard`.
- **Accounting** sits on top: CoA, JEs, ledger, trial balance. Sales/purchases/expenses/payments may create or link to journal entries depending on backend design.
- **Audit** is standalone read-only; link from Settings or Admin.

When implementing a group, check if it feeds or is fed by another (e.g. after creating a sale, payments and receivables should be consistent). Use backend API docs and database schema as the source of truth.

---

## Part 3: The Three-Stage Alignment (Implementation Strategy)

Apply this for **every** API group that has list + entity detail:

### Stage 1 — Database & backend as reference

- **Backend/database** define the list of fields and their types for each entity.
- Ensure **frontend types** (e.g. in `types/sales.ts`, `types/expenses.ts`) match the API response shapes and the database-backed DTOs. No client-side-only "important" fields; if the backend returns it and it’s meant to be read, the frontend must have a place to show it.

### Stage 2 — List table: curated columns + full data behind

- **List table:** Show a **limited set** of columns (e.g. code, name, date, status, main amount) so the table stays scannable. Keep RTL and Arabic headers.
- **Full data:** Every field that the backend returns for that entity and is intended for read **must** be visible somewhere. Do **not** put every field in the table.

### Stage 3 — Eye button + detail card

- Add an **Eye (view)** action per row.
- On click, open a **high-visual-appeal detail card** (modal, drawer, or slide-over). The card displays **every** piece of data from the object (as returned by GET by ID or list item if full). Use clear typography, grouping, and RTL layout. This satisfies “all data that must be shown to read” without cluttering the list.

**Summary:** Database/backend = source of truth → Frontend types and API calls align → List shows curated columns → Eye opens a full-detail card for the whole object.

---

## Part 4: Implementation Checklist (Per API Group)

For each API group, complete in this order:

1. **Types:** Add or extend types in `app/frontend/src/types/` (e.g. `sales.ts`, `purchases.ts`, `expenses.ts`, `payments.ts`, `debts.ts`, `wastage.ts`, `audit.ts`, `accounting.ts`) so they match backend DTOs and list/detail responses.
2. **Service:** Create or extend a service in `app/frontend/src/services/` that calls the endpoints (using the app’s axios instance / auth). Handle errors and return typed data.
3. **Hooks:** Add React Query hooks in `app/frontend/src/hooks/` (e.g. `useSales`, `useSale(id)`, `useCreateSale`, etc.) that use the service and expose loading/error states.
4. **Routes:** Add or adjust routes in `App.tsx` (list, `/new`, `/:id`) to match the module.
5. **List page:** Implement or update the list page: RTL, Arabic, search/filters, pagination, curated table, **Eye** button opening the full-detail card, and a primary “Create” button linking to the profile/create route.
6. **Profile/Create/Edit page:** Where applicable, implement create/edit form (Arabic labels, zod + react-hook-form, same layout pattern as Inventory). For read-only modules (e.g. Audit), list + eye card is enough.
7. **Detail card (Eye):** Implement the full-detail view (modal/drawer/slide-over) that shows every field of the entity. Use the same type as the API response so nothing is omitted.
8. **Sidebar:** Ensure `AppSidebar` has correct links to new or updated pages (Sales, Purchasing, Reports, Expenses, Payments, Debts, Wastage, Audit, Accounting as applicable).

---

## Part 5: Suggested Implementation Order (Dependencies First)

1. **Sales** — list, detail, payments, receipt, void (core POS).
2. **Purchases** — list, create, detail, receive (core procurement).
3. **Payments** — list, detail, purchase/sale payment actions (needed for sales/purchases).
4. **Expenses** — list, create/edit/delete, categories, summary, approve (standalone but used in reports).
5. **Debts** — receivables, payables, overdue, summary, detail (depends on sales/purchases).
6. **Wastage** — list, create, detail (can follow inventory pattern).
7. **Reports** — wire dashboard and all report endpoints to the Reports page.
8. **Audit** — list, counts (read-only).
9. **Accounting** — CoA CRUD, journal entries list/create/post, ledger, trial balance (most critical and dependent on others).

---

## Part 6: Acceptance Criteria (Global)

- All endpoints listed in this document are called from the frontend where a UI exists for that action (list, create, edit, view, report, etc.).
- Every list that represents an entity has an **Eye** button that opens a **full-detail card** with **all** fields from the backend object.
- All forms and labels that are user-facing use **Arabic** and **RTL**-friendly layout, consistent with Inventory.
- List pages have a clear **profile/create** entry point (e.g. “إضافة …”) matching the Inventory pattern.
- Types and API contracts align with the **backend and database**; no arbitrary omission of fields that the backend returns for read.
- New pages are reachable via **sidebar** and **routing**; no dead ends.

---

## Quick Reference: API Base and Auth

- Use the existing **axios instance** and **auth** from `app/frontend/src/lib/axios.ts` and auth context so all requests send credentials and handle 401/403.
- Base URL and API prefix (e.g. `/v1/`) should match the backend; confirm in `axios` config or env.

---

*End of Full-Stack API Integration Plan. Use this document as the prompt-plan for implementing the remaining API integrations with Opus 6 or any full-stack agent.*







C:\Users\Extreme\.gemini\antigravity\brain\e8c9ac25-9e2f-49f0-96f8-54db9bf68859\implementation_plan.md.resolved