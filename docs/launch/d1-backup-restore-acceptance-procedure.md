# D1 Backup/Restore Acceptance Procedure (production)

Status: **READY as a procedure.** This does not reimplement PR #15's tooling — it sequences the *existing* `scripts/d1-backup-restore-check.sh` (documented in `docs/launch/d1-backup-restore-runbook.md`) specifically as the production-D1 acceptance gate. Read that runbook for the tool's exact mechanics (integrity check, cleanup, failure handling); this document only fixes the sequence and the hard safety rule.

## Hard rule

**The isolated restore target is never the active production or staging D1.** `scripts/d1-backup-restore-check.sh` already enforces this by construction (it creates a new database named `${CF_D1_DATABASE_NAME}-restore-check` and only ever imports into *that*, then deletes it) — this procedure adds no new mechanism, it exists to make the rule explicit as a pre-execution check by a human/process running it, not just an implicit property of the script.

## Sequence

1. **Confirm which D1 is "production"** — via the Cloudflare Inventory Checklist's step 4 result, not assumed. Do not run this against a database whose identity is unconfirmed.
2. **Production D1 → Backup export**
   ```sh
   CF_D1_DATABASE_NAME="<confirmed production D1 name>" pnpm d1:backup-restore-check
   ```
   This single command performs steps 2–5 below as one run; broken out here only to name each checkpoint explicitly.
3. **→ Isolated restore target** — the script creates `<production-d1-name>-restore-check` automatically. Before running, visually confirm the `CF_D1_DATABASE_NAME` value entered is actually the production name and not, e.g., a value left over from a prior staging run.
4. **→ Schema / row-count / integrity check** — automatic: the script compares baseline vs. restored row counts per table and fails loudly (non-zero exit, `FAIL <table>` printed) on any mismatch. For the *first* run against a freshly-initialized production D1 (see Production D1 Schema section 5 of the original mission — no staging data carried over), expect all counts to be low/zero except `d1_migrations`, which should show exactly 2 entries matching the two migration files in `drizzle/`. A count mismatch here on a fresh database is a schema-initialization problem, not a backup-tool problem — investigate the migration application, not the script.
5. **→ Cleanup isolated test target** — automatic via the script's `trap ... EXIT` (deletes `<name>-restore-check` whether the run succeeds or fails, unless `KEEP_RESTORE_DB=1` is deliberately set for manual inspection of a failure). Confirm afterward with `wrangler d1 list` that only the real production (and staging, if still present) databases remain — no leftover `-restore-check` database.

## Recording the result

On success, record in the Rollback Runbook's reference table: backup filename, SHA-256, size, timestamp — this becomes "the D1 backup immediately before cutover" referenced there, satisfying the Production Cutover Runbook's Phase 2 exit criterion.

## Failure handling

Identical to `docs/launch/d1-backup-restore-runbook.md`'s existing "Error / rollback scenarios" table — this procedure does not introduce new failure modes, it only adds the "confirm production identity first" and "expect near-zero counts on first run" context specific to a freshly-initialized production database rather than an established one with real traffic history.
