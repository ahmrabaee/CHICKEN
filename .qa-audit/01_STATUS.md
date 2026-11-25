# Status Board (orchestrator-maintained)

## Phase 0 — Setup (orchestrator) — DONE
- Repo cloned, deps installed, backend dist + frontend dist built, cargo check OK.
- Golden DBs: `envs/_golden/{baseline,dev}.db` (prisma db push + seed profiles).
- Harness verified (isolated instance on 3199: login, items, backup path override).
- Early observations to verify later:
  - O-1: `jwt.strategy.ts:16` falls back to secret `'default-secret-change-me'` when JWT_SECRET is unset.
  - O-2: `DB_INIT_GUIDE.md` documents admin password `Admin@123`; seed uses `admin123`.
  - O-3: Backup dir defaults to `./data/backups` under backend root via setting `backup.path_vps` (not seeded).
  - O-4: Commit `75b3211` "weighted average cost wrong after stock adjustment" vs Swagger text "FIFO inventory costing" — costing method must be pinned down.
  - O-5: Root `node_modules` (19 files) and `app/frontend/.env` tracked in git; large stray files at root.
  - O-6: npm audit: backend 57 vulns (4 critical), frontend 31 (2 critical).

## Phase 1 — Knowledge building — DONE (K1 53 invariants/33 contradictions; K2 37 decisions/23 fixes; K3 15 VERIFIED posting/authz defects; K4 36 pages, K4-007 verified)
| id | role | output |
|---|---|---|
| K1 | Business & requirements analyst | knowledge/business-requirements.md |
| K2 | Development historian | knowledge/decision-log.md |
| K3 | Backend architecture & posting-map | knowledge/architecture-backend.md, knowledge/posting-map.md |
| K4 | Frontend architecture | knowledge/architecture-frontend.md |

## Phase 2 — Testing — DONE (T1-T8; raw ~217 finding entries incl. duplicates; T7 resumed once to finish)
| id | scope | ports |
|---|---|---|
| T1 | GL integrity, financial statements, periods, engines ON, shared invariant checker (harness/invariants.mjs) | 3101-3102 |
| T2 | Inventory, lots, costing, adjustments, wastage, transfers, valuation | 3103-3104 |
| T3 | Sales/POS, tax, discounts, void, credit notes, receivables, statements, write-off | 3105-3106 |
| T4 | Purchasing, payables, supplier payments, cash/bank, expenses, guards | 3107-3108 |
| T5 | Security & authorization matrix, auth lifecycle, setup, backup exposure, deps | 3109-3110 |
| T6 | Concurrency, idempotency, numbering, boundaries, backup/restore integrity, dates/TZ | 3111-3112 |
| T7 | UI/E2E (Playwright) — what user sees vs what system does | 3140-3142, 5173 |
| T8 | Business-month simulation + auditor-style end-to-end reconciliation | 3113-3114 |
## Phase 3 — Cross-validation & gap analysis — DONE (V1 16/16 confirmed, V2 16 confirmed/1 inconclusive, G matrix 114 rows: 95 fail/14 pass/5 not testable; 17 new G findings)
V1 aff4536b8afd989bb (financial criticals re-proof) · V2 a0f9838ece494ebd6 (security/platform re-proof) · G a76c8c23e0d96e9d0 (coverage matrix + untested requirements). Then: consolidation into master register (dedupe), final report.
## Phase 4 — Final report — DONE (reports/FINAL-QA-REPORT.md, reports/MASTER-REGISTER.md)
Consolidator C aafe302c0727d5386 -> reports/MASTER-REGISTER.md; then orchestrator writes reports/FINAL-QA-REPORT.md.

## Agent handles (orchestrator use; SendMessage to resume after rate limits)
K1 ad8e1e551eeee9b38 · K2 a01945dc9a8fe59db · K3 a1ee5a86e08004a07 · K4 ae70218e1a2ee5939 (all DONE)
T1 ac9ba91b72c82b560 · T2 adde933bad0f1dd1e · T3 a06ad09b7f8054f47 · T4 afed6deb574bdbaa7
T5 a58d0ec66c8a02494 · T6 a523b040ccdc2bdba · T7 a710b20e50b533c4a · T8 afd5ef663a1a06794
