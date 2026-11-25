# G coverage (Phase 3 gap analysis)

Instance `ga` (3119, dev profile; reset via tests/G/fresh.sh between scripts). Port 3120 unused. Stopped at the end.

## Executed (tests/G, each with *.out.txt)
| Script | Scope |
|---|---|
| 01-admin, 01b-lastadmin | first user-management probe; discovered sole-admin self-demotion (G-001) |
| 02-users | user create validation (min length, dup username/email/case, bad role/branch), role update atomicity, deactivate/last-admin, isActive via PUT, reset-password, session invalidation after reset, change-password flow, /users/me, sole-admin demotion |
| 03-master | branches rules (main/last active/dup/format), categories CRUD + delete rules, items CRUD validation (price rules, dup, ranges, huge name, html), customers/suppliers CRUD validation + duplicates, pagination bounds on 14 list endpoints + search edge cases |
| 04-scenario | delete rules with history (item/customer/supplier/category), credit-limit, below-cost sale, payment method list, alerts endpoints (low-stock, expiring, overdue), 30 route probes for missing endpoints (notifications, aging, returns, export, day book...) |
| 05-reports | reports/* with real data vs raw SQL, bad/missing dates, TB, ledger 1111, JE list |
| 06-settings-audit | settings honoured? (6 keys), settings validation matrix (16 values), bulk/delete errors, audit log content/filters/immutability, expense approval |
| 07-setup-reopen | setup wizard once-only; re-open via setting and anonymous admin reset |
| 08-misc | PDF sweep (24 endpoints x 4 param sets), duplicate handling, search wildcard, customer lifecycle, expense approval, routes |
| 09-cust-del, 10-reconcile | fully paid customer delete; one-day report vs raw reconciliation; dashboard/debts/supplier balance |
| 11-badsettings-impact | effect of invalid setting values on sales/barcode |
| 12-users-view, 13/14-boolfilter | users view fields; boolean query-filter coercion (G-006) |
| 15-invariants-ga | shared invariants checker on the G database |
| 16-inv-misc | I-25, I-27, I-28 |
| 17-endpoint-usage | static heuristic: which controller routes appear in any tester script (output: 17-endpoint-usage.out.txt; only `POST /accounting/accounts/rebuild-tree` had no hit; routes referenced only by T5 authz probes / T7 renders were run functionally by G) |
| 18-misc2 | rebuild-tree, overdue, reconciliation/suggest, stock-transfer helper routes, cost center, customer default discount (backend does not apply it) |

## Reviewed only (code)
users.service update/delete, auth.service setup, settings.service, branches.service, debts.service aging/overdue, expenses.service approve, all `auditLog.create` call sites, frontend Users.tsx / Customers.tsx / POS.tsx (dueDate), frontend grep for offline/serial/F-keys/drawer/CSV, dead-settings greps over src, dist and frontend.

## Not tested and why
- Frontend execution of G-006/G-007 (Users page toggle, Customers "show inactive"): API behaviour verified, UI path by code reading only; no UI instance allowed in G's port range (frontend preview 5173 reserved for the UI agent).
- Chain "accountant imports baseline backup -> setup_completed=false -> anonymous admin reset": each hop proven separately (T5-002 import by accountant, T6-012 restore without validation, G-003 reset); the combined chain was not fired (would replace a DB under test).
- Offline mode, scale serial integration, shortcuts, drawer kick, draft sales (R8-03/07/17): no runtime surface; code review only -> NOT TESTED.
- Documentation-only contradictions C-01 and C-28 (no feature to exercise).
- GL-engine/tax-engine ON variants of the G scenarios (user/settings/audit areas are engine-independent; reports run with engines OFF).
- Concurrency on user/role/settings updates (two admins editing at once) and UI-level password change/logout flows (T7 did login/logout/duplicate user).
- Page-access (dynamic permissions) beyond the authz matrix: covered by T5/T7; not re-run.
- Backup restore containing assets/* (forbidden path per charter, same as T6).
- Branch-user assignment (users.defaultBranchId effects) — no branch-scoped behaviour exists (T2-014).
