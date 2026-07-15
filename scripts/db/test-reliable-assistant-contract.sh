#!/usr/bin/env bash
set -euo pipefail

container="${FLOWSTATE_DB_CONTAINER:-supabase_db_flow-state}"
source_db="${FLOWSTATE_SOURCE_DB:-postgres}"
test_db="canonical_assistant_${$}_${RANDOM}"
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
migrations=(
  "$root_dir/supabase/migrations/20260713010000_done_for_now_rpc.sql"
  "$root_dir/supabase/migrations/20260713011000_merge_tasks_rpc.sql"
  "$root_dir/supabase/migrations/20260713012000_canonical_task_contract.sql"
  "$root_dir/supabase/migrations/20260713190000_done_for_now_operation.sql"
  "$root_dir/supabase/migrations/20260713200000_merge_tasks_operation.sql"
  "$root_dir/supabase/migrations/20260713213000_notion_task_activation.sql"
  "$root_dir/supabase/migrations/20260714010000_canonical_notion_activation.sql"
  "$root_dir/supabase/migrations/20260714020000_canonical_uuid_compatibility.sql"
  "$root_dir/supabase/migrations/20260714030000_task_scope_departure_change.sql"
  "$root_dir/supabase/migrations/20260715010000_merge_tasks_recurrence_resolution.sql"
  "$root_dir/supabase/migrations/20260715020000_complete_task_rpc.sql"
  "$root_dir/supabase/migrations/20260715030000_canonical_domain_receipts.sql"
)
h3_migration="${migrations[11]}"

cleanup() {
  docker exec "$container" dropdb -U postgres --if-exists --force "$test_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker exec "$container" createdb -U postgres "$test_db"
# This is deliberately a release-replay proof over the current source schema;
# clean-install migration coverage remains the responsibility of the full
# Supabase migration pipeline.
docker exec "$container" sh -c \
  "pg_dump -U postgres --schema-only --no-owner --no-privileges '$source_db' | sed '/log_min_messages/d' | psql -U postgres -v ON_ERROR_STOP=1 '$test_db'" \
  >/dev/null
docker exec "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 -c \
  'GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated' \
  >/dev/null

for migration in "${migrations[@]:0:11}"; do
  docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
    < "$migration" >/dev/null
done
# Prove the pre-H3 domain contracts before the final migration intentionally
# replaces their public apply surfaces with request-hash-enforcing wrappers.
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-merge-tasks-rpc.sql" >/dev/null
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-canonical-task-contract.sql" >/dev/null
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-complete-task-rpc.sql" >/dev/null
# The final migration owns conditional function renames and must remain safe to
# replay during release recovery or an interrupted migration deployment.
for _ in 1 2; do
  docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
    < "$h3_migration" >/dev/null
done
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DO $$
BEGIN
  IF to_regprocedure(
       'public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid,text)'
     ) IS NULL
     OR to_regprocedure(
       'public.flowstate_complete_task_v1(text,text,text,text,bigint,boolean,text,timestamptz,uuid,text)'
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
FLOWSTATE_DB_CONTAINER="$container" FLOWSTATE_TEST_DB="$test_db" \
  bash "$root_dir/scripts/db/test-merge-tasks-recurrence-concurrency.sh"
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-canonical-domain-receipts.sql" >/dev/null
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-canonical-notion-activation.sql" >/dev/null

FLOWSTATE_DB_CONTAINER="$container" FLOWSTATE_TEST_DB="$test_db" \
  bash "$root_dir/scripts/db/test-canonical-notion-concurrency.sh"

echo "PASS: reliable assistant canonical database contract"
