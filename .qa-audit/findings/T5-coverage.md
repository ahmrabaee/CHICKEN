# T5 Coverage — Security, Auth & Authorization

## Executed (scripts in tests/T5/, outputs saved)
- `setup-users.mjs` / `fix-revoke.mjs` — created 4 principals (admin, accountant, page-revoked accountant, deactivated-before-token).
- `authz-matrix.mjs` — 187 endpoints (from `/api/docs-json`) × 5 principals → `authz-matrix.csv`, `authz-violations.txt`. GET fully; POST/PUT/PATCH/DELETE probed with sentinel ids (99999) + empty body so guards (pre-pipe) surface 403 vs 400/404. SKIP_EXECUTE: `POST /system/backup`, `POST /system/backups/import` (tested in dedicated scripts).
- `backup-exfil.mjs` — unauthenticated forged-token DB download (T5-001) + accountant backup chain (T5-002). Downloaded 35839-byte gzip DB saved as `exfil-proof.gz`.
- `deep-checks.mjs` — privilege escalation (A), forbidden financial visibility (B), token lifecycle logout/refresh-reuse/password-change/deactivation (C).
- `guard-gap-writes.mjs` — real writes by accountant (backup config path, tax template create/delete), reconciliation/credit-note/wastage/sales guard-pass.
- `input-attacks.mjs` — password policy, brute-force/lockout, malformed JSON, oversized body, prototype pollution, SQLi probes, accountant backup import (201).
- `forge-default-proof.mjs` / `jwt-forgery.mjs` / `launch-variant.mjs` — ORCH-003: default-secret forgery accepted; `.env` absolute-path loading documented.
- `npm audit` in `sandbox/backend` → `npm-audit.json`, triaged (T5-013).
- CORS (allowed vs evil origin), Swagger unauth exposure, audit_logs coverage query — inline Bash.

## Reviewed (code/config, not executed as a live exploit)
- K4-005 receipt XSS (frontend/Tauri runtime — belongs to UI/E2E; confirmed by code).
- tar hardlink path-traversal exploit not weaponized (node-tar `strict:true` mitigates classic slip; import/restore reachability proven instead).
- pdfmake SSRF not weaponized (no confirmed user-controlled URL sink in PDF templates).
- Client-side token logging / localStorage storage (K4-010) — code-confirmed, is K4/T7 scope.
- http-exception filter, period-lock and permission-JSON non-enforcement — read, cross-referenced to K3.

## NOT tested / out of scope + why
- Frontend/Tauri runtime XSS execution, CSP, webview token exfil — no frontend instance in T5 scope (UI/E2E agent).
- Live backup *restore* execution was not fired against a shared-state concern-free target to avoid disrupting the running instance mid-session; guard-pass + import (201) + code path prove reachability. A dedicated throwaway instance could execute full restore-of-arbitrary-DB end to end.
- TLS/Caddy config, OS-level file permissions on backup dir, network firewalling — deployment/infra, not in the app code under test.
- Concurrency/race double-submit on auth endpoints (K3 noted elsewhere) — not security-specific; left to posting testers.
- Exhaustive per-endpoint response-body field audit for cost/profit leakage beyond sales/purchases/reports/dashboard sampled.

## Instances
- `t5a` (3109) — primary, to be stopped at end.
- `t5b` (3110) — ephemeral, launched only inside `forge-*`/`launch-variant` scripts and killed by them; `instance.mjs`-style pid under `envs/t5b` cleared.
