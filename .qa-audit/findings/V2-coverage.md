# V2 coverage — Phase 3 cross-validation (security/platform re-proof)

Instance used: `v2a` (ports 3117/3118 range, only 3117 actually used), dev profile, reset multiple times between
unrelated test groups. Stopped at end of session (`node harness/instance.mjs status v2a` → not running).

## Executed (independent scripts, own code, against fresh/own instance)
- T5-001, T5-002, T5-005, T5-006 — full API-level reproduction, `tests/V2/01-auth-security.mjs`, `02-accountant-backups.mjs`.
- T5-003 — partial execution (forged-token control test) + source/config/git evidence (`.env` absolute-path load,
  git-ignore status, `DEPLOYMENT.md` content). Did not build an isolated no-`.env` dist/node_modules sandbox to
  execute the "secret truly absent" boot path end-to-end (time/disk budget).
- T6-001 — `08-burst-concurrency.mjs` (20 parallel sales, 9/20 → 500).
- T6-005 — `04b-duplicate-sale.mjs` (duplicate POST under identical Idempotency-Key).
- T6-008 — `04-numbering-and-boundaries.mjs` (negative/zero/fractional purchases, expenses, payments). Adjustment
  negative-unit-cost sub-case inconclusive due to a self-inflicted negative-stock state from an earlier step in
  the same script; not retried on a clean item.
- T6-010 — `05-date-boundary.mjs` using a self-made fake-clock launcher (`v2clock-instance.mjs`/`fakeclock.cjs`,
  adapted from `tests/T8/fakeclock.cjs` to my own ports). Confirmed and broadened.
- T6-011 — `06-backup-overwrite.mjs` (two backups same second, filename collision, checksum mismatch, dangling
  restore point proven by disk-level SHA-256 check).
- T6-012 — `03-restore-fake-db.mjs` (crafted fake "SQLite" archive, import→restore→total outage, confirmed
  `.bak` file exists as the only recovery path).
- T1-006 — ad hoc inline JE create with fractional amount, confirmed truncation.
- T1-018 — `07-gl-engine-delete.mjs` (delete JE in legacy mode, enable GL engine, confirm 409 on sale/purchase/expense,
  confirm permanence via retry).
- T4-012 / K3-005, T4-004 — `04-numbering-and-boundaries.mjs` (purchase + expense numbering block after non-last
  delete; precisely identified the clearing condition by deleting the remaining highest-numbered row next).
- T7-013 — extracted and ran the real `normalizeToEnglishNumberString` function from
  `app/frontend/src/lib/numbers.ts` standalone in Node (not the UI).
- "Verified secure" spot checks: SQLi via search/sort params, PUT /users/me mass-assignment —
  `09-secure-spotchecks.mjs`, both reconfirmed secure.

## Attempted but inconclusive
- Setup re-run (`POST /auth/setup` after setup already complete) — could not determine the exact DTO shape in the
  time available; got no further than `400 VALIDATION_ERROR`, never reached a `SETUP_ALREADY_COMPLETE`-class
  response. Original T5-011 claim not independently re-confirmed either way.

## Reviewed (read findings text + relevant source, not independently re-executed this session)
T5-004, T5-007, T5-008, T5-009, T5-010 (T5-010 actually executed as a byproduct of the T5-002/003 session — see
V2.md), T5-011 (partially executed: SQLi + mass-assignment; deactivated-user-token and prototype-pollution
sub-claims not re-run), T5-012, T5-013; T6-002, T6-003, T6-004, T6-006, T6-007, T6-009, T6-013, T6-014; all of T4
except T4-004/T4-012 (T4-001, T4-002, T4-003, T4-005 through T4-011, T4-013 through T4-020); the UI/Playwright
layer of T7-013 and the rest of T7.md; all of T1.md except T1-006/T1-018; K1–K4 in full. No contradictions were
found anywhere in this pass — every item reviewed read as internally consistent with its own code citations.

## Not tested at all
Full authz matrix re-walk (187 endpoints × 5 principals, T5's own matrix) — out of scope for this pass given time;
spot-checked only the specific findings listed in the brief. Dependency-vuln triage (T5-013) not re-run (would
require a fresh `npm audit`, not performed). T6's hard-kill/mid-restore/WAL-tear scenarios not reattempted.

## Hard-rule compliance
- Only ports 3117 (3118 unused) touched; own instance only; stopped at session end.
- No edits outside `.qa-audit/`; no touching `app/backend/prisma/data/app.db` or `app/backend/data/*`.
- No original testers' scripts executed — every `.mjs` under `tests/V2/` was written fresh from the finding text;
  the only borrowed *mechanism* (not content) is the fake-clock preload module, copied and re-pointed at my own
  ports because it is shared harness infrastructure (per T8's `[FOR:ALL]` bulletin note), not a test script for
  any specific finding.
- No restore of an arbitrary DB performed on anything but my own isolated instance (`v2a`).
