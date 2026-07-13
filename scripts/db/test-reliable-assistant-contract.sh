#!/usr/bin/env bash
set -euo pipefail

container="${FLOWSTATE_DB_CONTAINER:-supabase_db_flow-state}"
source_db="${FLOWSTATE_SOURCE_DB:-postgres}"
test_db="canonical_assistant_${$}_${RANDOM}"
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
task_migration="$root_dir/supabase/migrations/20260713012000_canonical_task_contract.sql"
notion_migration="$root_dir/supabase/migrations/20260714010000_canonical_notion_activation.sql"

cleanup() {
  docker exec "$container" dropdb -U postgres --if-exists --force "$test_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker exec "$container" createdb -U postgres "$test_db"
docker exec "$container" sh -c \
  "pg_dump -U postgres --schema-only --no-owner --no-privileges '$source_db' | sed '/log_min_messages/d' | psql -U postgres -v ON_ERROR_STOP=1 '$test_db'" \
  >/dev/null
docker exec "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 -c \
  'GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated' \
  >/dev/null

docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$task_migration" >/dev/null
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$notion_migration" >/dev/null
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DO $$
BEGIN
  IF to_regprocedure(
       'public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)'
     ) IS NULL
     OR to_regprocedure(
       'public.flowstate_activate_notion_task_v1(text,jsonb,jsonb,jsonb,boolean,text,timestamptz)'
     ) IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_index AS index
       WHERE index.indexrelid = to_regclass(
         'public.tasks_active_external_identity_uidx'
       )
         AND index.indisvalid AND index.indisready AND index.indisunique
     ) THEN
    RAISE EXCEPTION 'TASK-1949 watchdog authority probe failed';
  END IF;
  RAISE NOTICE 'TASK-1949 disposable watchdog authority probe passed';
END $$;
SQL
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-canonical-task-contract.sql" >/dev/null
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-canonical-notion-activation.sql" >/dev/null

FLOWSTATE_DB_CONTAINER="$container" FLOWSTATE_TEST_DB="$test_db" \
  bash "$root_dir/scripts/db/test-canonical-notion-concurrency.sh"

echo "PASS: reliable assistant canonical database contract"
