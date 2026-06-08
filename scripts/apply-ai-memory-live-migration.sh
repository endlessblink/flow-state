#!/usr/bin/env bash
# Guarded live apply helper for the FlowState server-backed AI memory schema.
#
# Default mode is DRY RUN: generate the SQL bundle and print the exact commands.
# To run only the read-only VPS database preflight, run with:
#   AI_MEMORY_PREFLIGHT_ONLY=1 npm run apply:ai-memory-live-migration
# To mutate the live VPS database, run with:
#   APPLY_AI_MEMORY_LIVE=1 CONFIRM_AI_MEMORY_LIVE=APPLY npm run apply:ai-memory-live-migration

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_PATH="${AI_MEMORY_BUNDLE_PATH:-/tmp/flowstate-ai-memory-live-migration.sql}"
VPS_HOST="${VPS_HOST:-84.46.253.137}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE_BUNDLE_PATH="${REMOTE_BUNDLE_PATH:-/tmp/flowstate-ai-memory-live-migration.sql}"
REMOTE_CONTAINER_LOOKUP='container=$(docker ps --format "{{.Names}}" | grep -E "supabase.*db|postgres" | head -1); if [ -z "$container" ]; then echo "[ai-memory-live] No Supabase/Postgres container found" >&2; exit 3; fi; echo "$container"'

cd "$ROOT_DIR"

run_vps_db_preflight() {
  echo "[ai-memory-live] Running read-only VPS database preflight ..."
  REMOTE_DB_CONTAINER="$(ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" "$REMOTE_CONTAINER_LOOKUP")"
  echo "[ai-memory-live] Found database container: $REMOTE_DB_CONTAINER"
  ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" \
    "docker exec '$REMOTE_DB_CONTAINER' psql -U postgres -d postgres -Atc 'select current_database();' >/dev/null"
}

echo "[ai-memory-live] Generating migration bundle..."
npm run build:ai-memory-migration-bundle -- "$BUNDLE_PATH"

if [[ "${AI_MEMORY_PREFLIGHT_ONLY:-0}" == "1" ]]; then
  run_vps_db_preflight
  echo "[ai-memory-live] Preflight completed. No production database changes were made."
  exit 0
fi

if [[ "${APPLY_AI_MEMORY_LIVE:-0}" != "1" || "${CONFIRM_AI_MEMORY_LIVE:-}" != "APPLY" ]]; then
  cat <<EOF
[ai-memory-live] DRY RUN ONLY. No production database changes were made.

Generated bundle:
  $BUNDLE_PATH

To run only the read-only VPS database preflight:
  AI_MEMORY_PREFLIGHT_ONLY=1 npm run apply:ai-memory-live-migration

To apply to the live VPS database, rerun exactly:
  APPLY_AI_MEMORY_LIVE=1 CONFIRM_AI_MEMORY_LIVE=APPLY npm run apply:ai-memory-live-migration

This will run:
  REMOTE_DB_CONTAINER=\$(ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" '$REMOTE_CONTAINER_LOOKUP')
  ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" "docker exec '\$REMOTE_DB_CONTAINER' psql -U postgres -d postgres -Atc 'select current_database();' >/dev/null"
  scp -i "$SSH_KEY" "$BUNDLE_PATH" "$VPS_USER@$VPS_HOST:$REMOTE_BUNDLE_PATH"
  ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" "docker exec -i '\$REMOTE_DB_CONTAINER' psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f '$REMOTE_BUNDLE_PATH'"
  npm run check:ai-memory-schema

After apply, optionally run the guarded write/read/delete probe:
  AI_MEMORY_CRUD_PROBE=1 npm run check:ai-memory-crud
EOF
  exit 0
fi

echo "[ai-memory-live] APPLY_AI_MEMORY_LIVE=1 and CONFIRM_AI_MEMORY_LIVE=APPLY received."
run_vps_db_preflight

echo "[ai-memory-live] Uploading bundle to $VPS_USER@$VPS_HOST:$REMOTE_BUNDLE_PATH ..."
scp -i "$SSH_KEY" "$BUNDLE_PATH" "$VPS_USER@$VPS_HOST:$REMOTE_BUNDLE_PATH"

echo "[ai-memory-live] Applying bundle with psql ON_ERROR_STOP=1 ..."
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" \
  "docker exec -i '$REMOTE_DB_CONTAINER' psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f '$REMOTE_BUNDLE_PATH'"

echo "[ai-memory-live] Running read-only REST schema readiness check ..."
AI_MEMORY_SCHEMA_RETRIES="${AI_MEMORY_SCHEMA_RETRIES:-12}" \
AI_MEMORY_SCHEMA_RETRY_MS="${AI_MEMORY_SCHEMA_RETRY_MS:-2500}" \
  npm run check:ai-memory-schema

echo "[ai-memory-live] Live migration apply completed and REST schema readiness passed."
echo "[ai-memory-live] Verify now with:"
echo "  AI_MEMORY_CRUD_PROBE=1 npm run check:ai-memory-crud"
