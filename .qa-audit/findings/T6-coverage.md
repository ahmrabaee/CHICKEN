# T6 coverage

Instance t6 (port 3111, dev profile, fresh at start; left bricked by T6-012 test and STOPPED — reset before reuse: `node harness/instance.mjs reset t6 3111 dev`). Port 3112 unused.

## Executed (tests/T6, each with *.out.txt)
| script | topic |
|---|---|
| 01-oversell-race, 01b-oversell-race-partial | N parallel sales of the last stock (oversell; 500s) |
| 02-concurrency-threshold (02-run1/02-run2) | 1..30 concurrent sales → 500 threshold (T6-001) |
| 03-adjustment-lost-update | parallel adjustments; adjustments vs sales (T6-002) |
| 04-void-pay-races | double void, parallel payments (2 endpoints), idempotency (T6-003/004/005) |
| 05-parallel-create-numbering (05-run-N2/N5), 05b-transfer-overconsume | PUR/EXP/TR/LOT/PAY numbering under concurrency, transfer over-consumption (T6-006) |
| 06-client-abort | aborted fetch vs commit (T6-007) |
| 07-boundaries | 30 boundary/malformed inputs (T6-008/009) |
| 08-forced-late-failure | late failure rollback, K3-012 |
| 09-dates-tz, 09b-report-check | date storage, filters, UTC vs local day, DST (T6-010) |
| 10-backup-restore | backup→data→restore exactness, token after restore, backup during burst |
| 11-backup-under-load | 7 backups under 3 writers, integrity |
| 12-backup-crafted | garbage/truncated/ext/fake-sqlite/traversal/absolute-path archives |
| 13-retention (+13b) | retention + filename collision (T6-011) |
| 14-kill-restart | hard kill during write load, restart consistency |
| 15-restore-incompatible, 15b-restore-fake | schema-mismatch & fake DB restore, API recovery (T6-012) |

## Reviewed only (code)
- Prisma/SQLite config: journal_mode=delete, no WAL/busy_timeout tuning, 5 s interactive tx default.
- Backup: asset dirs resolved against backend install dir; restore without maintenance mode; snapshot via copyFile; .bak accumulation; no encryption.
- Sale number 4-digit suffix sorted as string (would break after 9 999 sales/day — not realistic, not filed).

## NOT tested (and why)
- Restore of archives containing `assets/*` — would write into `app/backend/data` (forbidden by charter).
- Symlink entries in tar — Windows denied symlink creation (EPERM).
- Kill during restore file swap (window ~ms; not timeable reliably).
- GL-engine / tax-engine modes under concurrency (flags off; other testers).
- Credit-note double submit, reconciliation apply races, debt write-off double — out of time; same pre-tx-read pattern by code (architecture-backend §3.1).
- Two server processes on one DB (not a supported deployment).
