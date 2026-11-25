# Bulletin — G (coverage gaps)

[FOR:ALL] 2026-11-25 — G-001: `PUT /users/:id {roleId}` lets the SOLE admin demote himself (last-admin guard only on DELETE) -> no admin left, 403 on everything admin; do not try this on a shared instance.
[FOR:ALL] G-003: `PUT /settings/setup_completed {value:false}` re-opens `/auth/setup`; anonymous call with `adminUsername:"admin"` resets that admin's password (existing admin reused, data intact). Settings API accepts any key/value (G-004); most seeded settings are dead (G-005).
[FOR:ALL] G-006: `?isActive=false` (and lowStock/hasBalance=false) is coerced to TRUE by `@Type(()=>Boolean)` — deactivated customers/items cannot be listed from the UI; G-007: Users-page enable/disable sends isActive which the API rejects (400), no reactivation exists.
[FOR:ALL] G-010: POS credit sales never get a due date -> `/debts/overdue` is empty for them. G-008: audit_logs only has login/void/adjustment/write-off/payment-cancel/COA/setup rows.
