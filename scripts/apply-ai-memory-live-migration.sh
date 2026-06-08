#!/usr/bin/env bash
# Guarded live apply helper for the FlowState server-backed AI memory schema.
#
# Default mode is DRY RUN: generate the SQL bundle and print the exact commands.
# To mutate the live VPS database, run with:
#   APPLY_AI_MEMORY_LIVE=1 CONFIRM_AI_MEMORY_LIVE=APPLY npm run apply:ai-memory-live-migration

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_PATH="${AI_MEMORY_BUNDLE_PATH:-/tmp/flowstate-ai-memory-live-migration.sql}"
VPS_HOST="${VPS_HOST:-84.46.253.137}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
REMOTE_BUNDLE_PATH="${REMOTE_BUNDLE_PATH:-/tmp/flowstate-ai-memory-live-migration.sql}"
PGCONTAINER_CMD='docker ps --format "{{.Names}}" | grep -E "supabase.*db|postgres" | head -1'

cd "$ROOT_DIR"

echo "[ai-memory-live] Generating migration bundle..."
npm run build:ai-memory-migration-bundle -- "$BUNDLE_PATH"

if [[ "${APPLY_AI_MEMORY_LIVE:-0}" != "1" || "${CONFIRM_AI_MEMORY_LIVE:-}" != "APPLY" ]]; then
  cat <<EOF
[ai-memory-live] DRY RUN ONLY. No production database changes were made.

Generated bundle:
  $BUNDLE_PATH

To apply to the live VPS database, rerun exactly:
  APPLY_AI_MEMORY_LIVE=1 CONFIRM_AI_MEMORY_LIVE=APPLY npm run apply:ai-memory-live-migration

This will run:
  scp -i "$SSH_KEY" "$BUNDLE_PATH" "$VPS_USER@$VPS_HOST:$REMOTE_BUNDLE_PATH"
  ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" 'docker exec -i \$($PGCONTAINER_CMD) psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f "$REMOTE_BUNDLE_PATH"'

After apply, verify:
  npm run check:ai-memory-schema
  AI_MEMORY_CRUD_PROBE=1 npm run check:ai-memory-crud
EOF
  exit 0
fi

echo "[ai-memory-live] APPLY_AI_MEMORY_LIVE=1 and CONFIRM_AI_MEMORY_LIVE=APPLY received."
echo "[ai-memory-live] Uploading bundle to $VPS_USER@$VPS_HOST:$REMOTE_BUNDLE_PATH ..."
scp -i "$SSH_KEY" "$BUNDLE_PATH" "$VPS_USER@$VPS_HOST:$REMOTE_BUNDLE_PATH"

echo "[ai-memory-live] Applying bundle with psql ON_ERROR_STOP=1 ..."
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" \
  "docker exec -i \$($PGCONTAINER_CMD) psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f '$REMOTE_BUNDLE_PATH'"

echo "[ai-memory-live] Live migration apply completed."
echo "[ai-memory-live] Verify now with:"
echo "  npm run check:ai-memory-schema"
echo "  AI_MEMORY_CRUD_PROBE=1 npm run check:ai-memory-crud"
