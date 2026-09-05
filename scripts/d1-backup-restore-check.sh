#!/usr/bin/env bash
# Exports a remote D1 database, restores the export into a throwaway D1
# database, and compares per-table row counts to prove the backup is
# actually restorable. Never writes to the source database.
#
# Required env:
#   CF_D1_DATABASE_NAME   name of the source D1 database to back up
#   CLOUDFLARE_API_TOKEN  scoped API token (Workers Scripts + D1 edit)
#   CLOUDFLARE_ACCOUNT_ID account that owns the database
#
# Optional env:
#   RESTORE_DB_NAME  name for the throwaway restore-check database
#                    (default: "${CF_D1_DATABASE_NAME}-restore-check")
#   BACKUP_DIR       where to write the .sql export (default: ./backups/d1)
#   KEEP_RESTORE_DB  set to 1 to skip deleting the restore-check database
#                    afterwards (useful for manual inspection)
#
# Usage:
#   CF_D1_DATABASE_NAME=qonsul-website-d1 ./scripts/d1-backup-restore-check.sh

set -euo pipefail

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

require_env CF_D1_DATABASE_NAME
require_env CLOUDFLARE_API_TOKEN
require_env CLOUDFLARE_ACCOUNT_ID

SOURCE_DB="$CF_D1_DATABASE_NAME"
RESTORE_DB="${RESTORE_DB_NAME:-${SOURCE_DB}-restore-check}"
BACKUP_DIR="${BACKUP_DIR:-./backups/d1}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/${SOURCE_DB}-${STAMP}.sql"
WRANGLER=(pnpm exec wrangler)

mkdir -p "$BACKUP_DIR"

echo "== 1/5 Exporting '$SOURCE_DB' (schema + data, remote, read-only) =="
"${WRANGLER[@]}" d1 export "$SOURCE_DB" --remote --output="$BACKUP_FILE" -y

CHECKSUM="$(sha256sum "$BACKUP_FILE" | cut -d' ' -f1)"
SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "Backup written: $BACKUP_FILE ($SIZE, sha256 $CHECKSUM)"
echo "Store this file outside the repo, encrypted, with restricted access."

table_names() {
  local db="$1"
  "${WRANGLER[@]}" d1 execute "$db" --remote --json \
    --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;" \
    | node -e '
        const chunks=[];process.stdin.on("data",c=>chunks.push(c));
        process.stdin.on("end",()=>{
          const rows=JSON.parse(Buffer.concat(chunks).toString())[0].results;
          for(const r of rows) console.log(r.name);
        });'
}

row_count() {
  local db="$1" table="$2"
  "${WRANGLER[@]}" d1 execute "$db" --remote --json \
    --command "SELECT COUNT(*) AS n FROM \"$table\";" \
    | node -e '
        const chunks=[];process.stdin.on("data",c=>chunks.push(c));
        process.stdin.on("end",()=>{
          const rows=JSON.parse(Buffer.concat(chunks).toString())[0].results;
          console.log(rows[0].n);
        });'
}

echo "== 2/5 Reading baseline row counts from '$SOURCE_DB' =="
mapfile -t TABLES < <(table_names "$SOURCE_DB")
declare -A BASELINE
for t in "${TABLES[@]}"; do
  BASELINE["$t"]="$(row_count "$SOURCE_DB" "$t")"
  echo "  $t: ${BASELINE[$t]} rows"
done

echo "== 3/5 Creating throwaway restore-check database '$RESTORE_DB' =="
"${WRANGLER[@]}" d1 create "$RESTORE_DB" || {
  echo "Could not create '$RESTORE_DB'. If it already exists from a failed" >&2
  echo "previous run, delete it manually first: wrangler d1 delete $RESTORE_DB -y" >&2
  exit 1
}

cleanup() {
  if [ "${KEEP_RESTORE_DB:-0}" = "1" ]; then
    echo "KEEP_RESTORE_DB=1 set, leaving '$RESTORE_DB' in place for inspection."
    return
  fi
  echo "== 5/5 Deleting throwaway restore-check database '$RESTORE_DB' =="
  "${WRANGLER[@]}" d1 delete "$RESTORE_DB" -y || \
    echo "Warning: could not delete '$RESTORE_DB' automatically; remove it by hand." >&2
}
trap cleanup EXIT

echo "== 4/5 Restoring backup into '$RESTORE_DB' and comparing row counts =="
"${WRANGLER[@]}" d1 execute "$RESTORE_DB" --remote --file="$BACKUP_FILE" -y

FAILED=0
for t in "${TABLES[@]}"; do
  restored="$(row_count "$RESTORE_DB" "$t")"
  expected="${BASELINE[$t]}"
  if [ "$restored" = "$expected" ]; then
    echo "  PASS $t: $restored/$expected rows match"
  else
    echo "  FAIL $t: restored $restored, expected $expected" >&2
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "Restore check FAILED — do not treat this backup as verified." >&2
  exit 1
fi

echo "Restore check PASSED for all $(( ${#TABLES[@]} )) table(s). Backup is verified restorable."
