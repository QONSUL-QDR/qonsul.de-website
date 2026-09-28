# D1 Backup/Restore Runbook

Status: **READY (code + procedure)**. Real execution against a live Cloudflare D1 database is **EXECUTION PENDING – CLOUDFLARE EGRESS** (this session's network policy blocks `api.cloudflare.com`; run this from an environment/session with Cloudflare access).

Tool: `scripts/d1-backup-restore-check.sh` (`pnpm d1:backup-restore-check`). Never writes to the source database — only `wrangler d1 export` (read), then creates/deletes a separate throwaway database for the restore proof.

Current Website D1 schema (verified from `db/schema.ts` on this branch): tables `reports`, `rate_limits`, `trends`, `contact_requests`, plus Wrangler's own `d1_migrations`. No analytics tables live in Website D1 — Phase 4 analytics is ingested entirely by Cockpit/MariaDB over HTTP, not stored here.

## 1. Backup the current D1 database

```sh
export CLOUDFLARE_ACCOUNT_ID="<account id>"
export CLOUDFLARE_API_TOKEN="<scoped token: D1 Edit, Workers Scripts Edit, Account Settings Read>"
export CF_D1_DATABASE_NAME="<the actual staging/production D1 database name>"
pnpm d1:backup-restore-check
```

This performs steps 1–5 below as one atomic run. To do only the backup (no restore-check) for a routine backup outside a restore drill:

```sh
pnpm exec wrangler d1 export "$CF_D1_DATABASE_NAME" --remote --output="./backups/d1/${CF_D1_DATABASE_NAME}-$(date -u +%Y%m%dT%H%M%SZ).sql" -y
```

The export is schema + data, taken read-only. `./backups/d1/` is gitignored (`/backups/` in `.gitignore`) — the file must never be committed.

## 2. Integrity check of the backup

- `sha256sum` of the export file is printed automatically by the script — record it in the run log alongside the backup filename and timestamp.
- Sanity-check the file is non-trivial: `wc -l` should be well above the ~10-line "empty database" baseline once real data exists; grep for `CREATE TABLE` occurrences and confirm all five names (`reports`, `rate_limits`, `trends`, `contact_requests`, `d1_migrations`) are present.
- This integrity check is syntactic/structural, not a substitute for step 4's row-count comparison.

## 3. Restore exclusively into an isolated test target

The script creates a **new, separate** D1 database (default name `${CF_D1_DATABASE_NAME}-restore-check`) via `wrangler d1 create`, and restores the export into *that* database only, via `wrangler d1 execute ... --file=`. It never runs `--file` against the source database name.

**Guardrail:** `CF_D1_DATABASE_NAME` and the implied `RESTORE_DB_NAME` are never the same value (the script always appends `-restore-check` unless a name is explicitly overridden — never override it to equal the source name). Before running, visually confirm `CF_D1_DATABASE_NAME` is the *source* you intend to back up, not a value copied from a previous restore-check run.

## 4. Data comparison before/after restore

Automatic: the script reads a baseline row count per table from the source **before** creating the restore target, then re-reads the same counts from the restored database **after** import, and prints `PASS <table>: n/n rows match` per table or `FAIL <table>: restored X, expected Y` with a non-zero exit code if any table's count differs. A `d1_migrations` row-count match is included, which additionally proves the migration history itself survived the round trip intact.

Row-count equality is a strong but not absolute integrity signal (it would not catch, e.g., column-level corruption with row count preserved). For a full drill (not routine backups), spot-check a handful of specific rows (e.g., the most recent `contact_requests.id`) by primary key in both the source and the restore-check database and diff the JSON.

## 5. Cleanup of the restore test target

Automatic via a `trap ... EXIT` in the script — the restore-check database is deleted (`wrangler d1 delete ... -y`) whether the run succeeds or fails, unless `KEEP_RESTORE_DB=1` was set for manual inspection. If cleanup itself fails (printed as a warning, not a fatal error), remove it by hand:

```sh
pnpm exec wrangler d1 delete "${CF_D1_DATABASE_NAME}-restore-check" -y
```

Confirm afterwards with `wrangler d1 list` that only the real source database(s) remain.

## 6. Error / rollback scenarios

| Scenario | Detection | Action |
|---|---|---|
| Export fails (network/auth) | Non-zero exit on step 1, no file written | Fix credentials/connectivity, re-run from step 1. Source DB untouched. |
| Restore-check DB name collision (leftover from a prior failed run) | `wrangler d1 create` fails with "already exists" | Script exits with guidance to `wrangler d1 delete <name>-restore-check -y` first, then re-run. Source DB untouched. |
| Import into restore-check DB fails mid-way | Step 4 errors before row-count comparison runs | `trap` still deletes the partially-populated restore-check DB. Source DB untouched at every point — nothing to roll back there. Re-run from step 1 with a fresh export. |
| Row-count mismatch (FAIL) | Script prints `FAIL <table>` and exits non-zero | **Do not treat the backup as verified.** Do not delete the mismatched restore-check DB immediately — re-run with `KEEP_RESTORE_DB=1` to inspect manually, compare schema (`wrangler d1 execute ... --command "SELECT sql FROM sqlite_master"`) between source and restore-check for a schema drift explanation before assuming data loss. |
| Backup file lost/corrupted after a successful run | `sha256sum` mismatch on later verification, or file missing | Backups are additive (D1 export is a read-only snapshot) — the source database is unaffected; simply re-run step 1 to produce a fresh backup. Retain the previous backup's checksum log entry as evidence a working backup existed at that point in time. |

Real production/staging D1 must never be targeted by `RESTORE_DB_NAME` and must never be deleted by this tool — the delete call in `cleanup()` only ever targets the name the script itself just created.
