# Phase 2 — Common brief for all testers (T1–T8)

## Read before testing (in this order)
1. `00_ORCHESTRATION.md` — hard rules, harness, finding format. Rules are absolute: touch nothing outside `.qa-audit/`.
2. `knowledge/business-requirements.md` — the EXPECTED-behavior oracle (53 invariants in §6, contradictions §7, maybe-unimplemented §8).
3. `knowledge/decision-log.md` — 37 deliberate decisions (D-nn), 23 fixes (F-nn). Before reporting a defect, check whether it is a deliberate decision; if deliberate but harmful, report as INTENTIONAL-BUT-RISKY and cite D-nn.
4. `knowledge/posting-map.md` + `knowledge/architecture-backend.md` — what the code does per operation.
5. `knowledge/architecture-frontend.md` (T7 mandatory; others skim §3–4).
6. ALL files in `findings/` (K1–K4, ORCH) and `bulletin/` — known leads. Re-read `bulletin/` after each major step.

## Known facts (do not rediscover; build on them)
- The `dev` seed writes fixtures WITHOUT journal entries/PLE/stock ledger (K2 bulletin). GL starts empty; inventory table has stock with no GL value; cash 1111 = 0 so cash OUTFLOWS are blocked by the deliberate insufficient-balance guard (D-14) until money comes in.
  → For clean accounting tests: start from `baseline` profile + complete setup via API, OR from `dev` but evaluate DELTAS (snapshot before/after each operation), never absolute totals.
- Money ×100 minor units, weight grams, price per kg, rates basis points. `gl_engine_enabled=false`, `tax_engine_enabled=false` by default (legacy posting path).
- Roles in seed: check `roles` table (admin, accountant/cashier). Create extra users via API for role tests.

## Your method (each tester)
A. **Cross-validate first**: for every existing lead in your scope (K1–K4/ORCH findings), write your OWN reproduction script and run it. In your findings, add a section "Cross-validation of prior leads" with: lead ID → CONFIRMED / NOT REPRODUCED / REFINED (with evidence). Do not just copy prior conclusions. If you disagree with a prior conclusion, say why with evidence.
B. **Go beyond**: design scenarios the developers likely never considered: unusual sequences (void after partial payment after credit note…), boundary values (0, 1 agora, 1 gram, huge numbers, negative, fractional), repeated operations, operations across date/period boundaries, on deactivated/deleted entities, across branches, with settings toggled (gl_engine_enabled / tax_engine_enabled / period lock ON — test both modes where relevant).
C. **Check effects system-wide**: after every operation compare deltas across ALL representations: GL accounts (trial balance), subledgers (debts, payment_ledger_entries, customer/supplier currentBalance), inventory (inventory table, lots, stock_movements, stock_ledger_entries), reports endpoints (what the user sees), PDFs where relevant. A number shown to the user that disagrees with the ledger is a finding.
D. Use the shared invariant checker `harness/invariants.mjs` once T1 publishes it (see `bulletin/T1.md`); until then write your own checks.
E. Every executed test lives in `tests/<your-id>/` as a re-runnable script with its saved output (`*.out.txt`). Findings cite the script.

## Output (incremental — save after each finding)
- `findings/<id>.md` — charter format. New IDs `<id>-001…`. Mark VERIFIED only if your script observed it.
- `findings/<id>-coverage.md` — executed tests list; reviewed-only areas; NOT tested + why.
- `bulletin/<id>.md` — cross-agent discoveries, `[FOR:<id>|ALL]`.
- Stop all your instances at the end.

## Final reply to orchestrator (keep under 40 lines)
Counts (verified/suspected/intentional), cross-validation table summary, top findings by severity with IDs, areas not covered, and anything another tester must follow up.
