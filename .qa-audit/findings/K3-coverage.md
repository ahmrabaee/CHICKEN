# K3 coverage

## Executed (instance k3, port 3192, fresh dev DB; scripts in tests/K3/)
- Seed DB invariants (seedcheck.mjs): JE count, Σdr=Σcr, per-entry balance, inventory vs lots, fixture docs, balances, users, banks.
- posting-probe.mjs / posting-probe2.mjs / probe3.mjs: authz of unguarded controllers as accountant (GETs only); cash sale; credit sale + /payments/sale + void; /sales/:id/payments; payment on voided sale; mixed tender; purchase with tax (credit and fully paid); purchase payment vs supplier balance; purchase delete → numbering collision; two lines same item; adjustment decrease vs lots; wastage by accountant (JE yes, SLE no); stock transfer (blocked by lot collision); debt write-off GL effect; bank-transfer expense; expense update/delete; final GL invariants.
- Static endpoint inventory (endpoints.mjs → endpoints.md, 195 handlers).

## Reviewed only (code)
- GL engine & tax engine paths (flags off), credit notes, reconciliation/allocation, advance payments, payment cancel, purchase update/receive, stock transfer valuation, period lock, auth/refresh/setup, page access, settings usage, seed profiles.

## Not tested (why)
- Backup restore/import by accountant — destructive; GET endpoints proved missing guard.
- Concurrency races (parallel sales/voids/payments) — left for Phase-2 testers.
- GL-engine/tax-engine enabled behaviour — would require flipping settings; flagged SUSPECTED.
- Stock transfer valuation (K3-016) — probe blocked by K3-005 lot-number collision; re-test on a fresh instance before any purchase delete.
