# QA Audit — Orchestration Charter (READ FIRST, every agent)

System under test: Chicken/butcher shop POS + inventory + double-entry accounting.
Repo root: `E:\DEV\Chicken FMS` (git, 89 commits, 2026-02-02 → 2026-03-19, 3 devs + heavy AI assistance via plan docs).
QA workspace (this folder): `E:\DEV\Chicken FMS\.qa-audit` (git-excluded locally; not part of the project).

## Mission
Independent QA authority. Establish whether the system as a whole is coherent, accurate, reliable and
production-ready for a financially sensitive business. Find what nobody knows is broken.
This is an INVESTIGATION phase, NOT remediation.

## Hard rules (non-negotiable)
1. NEVER modify anything outside `.qa-audit/`. No edits to `app/`, docs, configs, lockfiles. No `npm install` inside `app/*`.
   No git commands that change state (no checkout/commit/stash/reset/pull). Read-only git (`log`, `show`, `diff`, `blame`) is fine.
2. NEVER rebuild `app/backend/dist` or `app/frontend/dist` (shared by every agent). Need a custom frontend build? Use
   `--outDir` inside `.qa-audit/`.
3. NEVER touch `app/backend/prisma/data/app.db` or `app/backend/data/*` (developer DBs). Use ONLY your own instance DB.
4. Use ONLY your assigned port(s). Stop your instances when finished (`node harness/instance.mjs stop <name>`).
5. Put your test code under `.qa-audit/tests/<your-agent-id>/`. If you need npm packages, create
   `.qa-audit/tests/<your-agent-id>/package.json` and install there.
6. Write findings INCREMENTALLY to `.qa-audit/findings/<your-agent-id>.md` (don't wait until the end; context may be lost).

## Harness
- Start isolated backend: `node .qa-audit/harness/instance.mjs start <name> <port> dev --fresh`
  - profile `dev`: setup completed, user `admin`/`admin123`, deterministic fixtures (customers, suppliers, sales, purchases, expenses, payments).
  - profile `baseline`: production baseline, setup NOT completed, no users (for setup-wizard / clean-slate tests).
  - `reset <name> <port> <profile>` = stop + fresh DB + start. Prints `baseUrl`, `db` path, `log` path.
  - You may run several named instances (e.g. `t2a`, `t2b`) but only on your assigned ports.
- API client: `import { connect, request } from 'file:///E:/DEV/Chicken%20FMS/.qa-audit/harness/client.mjs'`
  (responses are `{ status, ok, body, data }`; API envelope is `{ success, data }`; global prefix `/v1`; Swagger at `http://localhost:<port>/api/docs`, JSON at `/api/docs-json`).
- SQL on your DB: `node .qa-audit/harness/sql.mjs <db> "<SELECT ...>" [--json]` (read-only by default; `--write` refuses golden/dev DBs).
  Node's built-in `node:sqlite` (`DatabaseSync`) is available for scripts (Node v24.15). Filter the ExperimentalWarning.
- Value conventions (per Swagger, VERIFY rather than trust): money = integer minor units (×100), weight = integer grams, % = basis points.
- Shells: PowerShell 5.1 and Git Bash both available. Prefer writing `.mjs` files over inline `node -e` (quoting breaks in PowerShell).

## Shared knowledge base (`knowledge/`)
- `business-requirements.md` — what the business needs; workflows; invariants (Phase 1, agent K1)
- `decision-log.md` — historical decisions, fixes, known issues, intentional deviations (Phase 1, agent K2)
- `architecture-backend.md`, `posting-map.md` — modules, data model, every GL posting rule (Phase 1, agent K3)
- `architecture-frontend.md` — pages, API usage, unit conversions, gating (Phase 1, agent K4)
Before declaring something a defect, CHECK `decision-log.md` for an intentional decision. If intentional but
still harmful, report it as `INTENTIONAL-BUT-RISKY` with reasoning.

## Bulletin (cross-agent communication)
`bulletin/<agent-id>.md` — append short entries for discoveries OTHER agents must know
(e.g. "sale void does not reverse COGS — T2 should check valuation impact"). Read ALL bulletin files when you start
and again at least every major step. Prefix entries with `[FOR:<agent-id or ALL>]`.

## Finding format (`findings/<agent-id>.md`)
```
### <AGENT>-<NNN>: <title>
- Status: VERIFIED | SUSPECTED | INTENTIONAL-BUT-RISKY | NOT-VERIFIABLE
- Severity: Critical | High | Medium | Low | Info
- Area / files: path:line refs
- Test executed: yes (script path + key output) | no (code review only)
- Reproduction: numbered steps (API calls / UI actions / SQL)
- Expected (and source: PRD / plan doc / accounting principle) vs Actual
- Root cause (if identified)
- Business / technical impact (concrete: who loses what money / which number is wrong)
- Historical context checked: which decision-log/plan entries you consulted
- Recommendation (what should eventually be done — do NOT fix)
```
VERIFIED = you executed it and observed the defect. SUSPECTED = code reading / reasoning only.
Severity: Critical = misstated money/inventory/ledger, data loss/corruption, or security breach in normal operation;
High = wrong results in plausible edge cases or a broken core workflow; Medium = limited-impact incorrectness or
missing safeguard; Low = cosmetic/minor; Info = observation/recommendation.

Also keep `findings/<agent-id>-coverage.md`: what you tested (executed), what you only reviewed, what you could not test and why.

## Port allocation
| agent | ports |
|---|---|
| orchestrator smoke | 3199 |
| K1–K4 (knowledge) | 3190–3194 if needed |
| Phase 2 testers | assigned in their brief (3101–3130) |
| UI/E2E | backend 3140–3142, frontend preview 5173 (only allowed CORS origins: 1420, 5173) |

## Status board (maintained by orchestrator)
See `01_STATUS.md`.
