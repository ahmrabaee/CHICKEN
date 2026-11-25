# T2 coverage (Inventory, lots & costing)

Instances: t2a (3103), t2b (3104), fresh `dev` DB per script; both stopped at the end. All measurements on API-created items, GL as deltas.

## Executed (tests/T2, each with *.out.txt)
- t01-fifo.mjs — 3 purchases at different costs, sales spanning lots, per-allocation COGS, GL 1131/5100, void → same lots, sale after void, credit note on paid sale, /inventory/:id, lots, P&L, stock-vs-gl.
- t02-adjust.mjs — adjust down after partial FIFO, sale after adjustment, adjust up without cost, cost 0 / negative, adjust to zero then new lot, decrease with lotId (own / other item), stock-vs-gl, /reports/inventory, drift quantification.
- t03-transfer.mjs — cutting with UI default costs, value conservation, yield loss, expiry/receivedAt, over-transfer, concurrent transfers, chain to cost 0, same-item revaluation, delete/edit source purchase, inactive / unknown item, unknown branch, stock-vs-gl.
- t04-wastage-expiry.mjs — wastage from non-oldest lot, GL/SLE, P&L and wastage report, exceed/zero/fraction/negative, delete/cancel/approve routes, wastage on phantom lot, expired lot sale and transfer, /inventory/expiring (days variants), low-stock, dashboard.
- t05-edge.mjs / t05b-branch.mjs — K3-008, concurrent sales, oversell, seed item sale, opening stock on item create, purchase delete/edit after adjustment, precision of 78 small sales, category delete, second branch / branch filters.
- t06-glengine.mjs — same flow with gl_engine_enabled=true.
- t07-f02.mjs — F-02 regression.
- harness/invariants.mjs --only=INV on final t2a DB.

## Reviewed only (code)
- stock-reconciliation.service.ts (SLE vs GL only), reports.service.ts inventory/P&L/dashboard, items.service delete (soft/hard), purchases assert/rollback, inventory PDF report (uses inventory.totalValue).

## Not tested (why)
- Live-bird purchase (isLiveBird flag) shrinkage — no backend logic found for gross/net (flag only stored); not exercised.
- Purchase returns to supplier — no endpoint (credit note on purchase only touches GL per K3-022).
- Accountant-role access to transfers/adjustments (stock transfer is admin+accountant at API vs PRD admin-only) — noted, left to the authz tester.
- PDFs (inventory/stock-vs-gl/wastage) — not rendered; inventory PDF reads inventory.totalValue so it inherits T2-001/002 drift.
- Period lock / freeze date interaction with adjustments/transfers/wastage — none of these call the period guard (code), not executed.
- Backdated purchase FIFO: lots always get receivedAt = now (code), not executed.
