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
  "$root_dir/supabase/migrations/20260715040000_canonical_task_lifecycle.sql"
  "$root_dir/supabase/migrations/20260715050000_canonical_subtask_batch.sql"
  "$root_dir/supabase/migrations/20260715060000_canonical_work_block_batch.sql"
  "$root_dir/supabase/migrations/20260716010000_canonical_recurrence_lifecycle.sql"
  "$root_dir/supabase/migrations/20260716020000_canonical_timer_command.sql"
  "$root_dir/supabase/migrations/20260716030000_canonical_organization_commands.sql"
  "$root_dir/supabase/migrations/20260716040000_task_inventory_change_causes.sql"
)
h3_migration="${migrations[11]}"
h4_migration="${migrations[12]}"
h5_migration="${migrations[13]}"
h6_migration="${migrations[14]}"
h7_recurrence_migration="${migrations[15]}"
h7_timer_migration="${migrations[16]}"
h7_organization_migration="${migrations[17]}"
h8_cause_migration="${migrations[18]}"
h3_rollback="$root_dir/scripts/db/rollback-canonical-domain-receipts.sql"

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
# Force the inverse to fail after its first wrapper drops. Because the inverse
# owns its transaction, the public H3 surface and private bases must remain
# byte-for-byte addressable after psql exits on the injected ALTER failure.
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE OR REPLACE FUNCTION public.h3_test_reject_function_alter()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF tg_tag = 'ALTER FUNCTION' THEN
    RAISE EXCEPTION 'injected H3 rollback DDL failure';
  END IF;
END;
$$;
CREATE EVENT TRIGGER h3_test_reject_function_alter
  ON ddl_command_start
  EXECUTE FUNCTION public.h3_test_reject_function_alter();
SQL
if docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$h3_rollback" >/dev/null 2>&1; then
  echo "FAIL: injected H3 rollback unexpectedly committed" >&2
  exit 1
fi
docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DROP EVENT TRIGGER h3_test_reject_function_alter;
DROP FUNCTION public.h3_test_reject_function_alter();
DO $$
BEGIN
  IF to_regprocedure(
       'public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid,text)'
     ) IS NULL
     OR to_regprocedure(
       'public.flowstate_patch_task_v1_h3_base(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)'
     ) IS NULL THEN
    RAISE EXCEPTION 'failed rollback left a mixed H3 function surface';
  END IF;
  RAISE NOTICE 'H3 rollback failure atomicity probe passed';
END $$;
SQL

# Restore the old exact signatures and prove the inverse is replay-safe.
for _ in 1 2; do
  docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
    < "$h3_rollback" >/dev/null
done
docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DO $$
DECLARE
  v_signature text;
  v_function oid;
  v_signatures text[] := ARRAY[
    'public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamp with time zone,uuid)',
    'public.flowstate_complete_task_v1(text,text,text,text,bigint,boolean,text,timestamp with time zone,uuid)',
    'public.flowstate_done_for_now(text,boolean,date,text,text,uuid)',
    'public.flowstate_merge_tasks(text,text,boolean,text,text,uuid)',
    'public.flowstate_merge_tasks_with_recurrence(text,text,jsonb,boolean,text,text,uuid)'
  ];
BEGIN
  IF to_regprocedure(
       'public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid,text)'
     ) IS NOT NULL
     OR to_regprocedure(
       'public.flowstate_complete_task_v1(text,text,text,text,bigint,boolean,text,timestamptz,uuid)'
     ) IS NULL
     OR to_regprocedure(
       'public.flowstate_done_for_now(text,boolean,date,text,text,uuid)'
     ) IS NULL
     OR to_regprocedure(
       'public.flowstate_merge_tasks(text,text,boolean,text,text,uuid)'
     ) IS NULL
     OR to_regprocedure(
       'public.flowstate_merge_tasks_with_recurrence(text,text,jsonb,boolean,text,text,uuid)'
     ) IS NULL
     OR to_regprocedure('public.flowstate_h3_finalize_receipt(uuid,text,jsonb,jsonb,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'H3 rollback did not restore the exact legacy RPC privilege surface';
  END IF;

  FOREACH v_signature IN ARRAY v_signatures LOOP
    v_function := to_regprocedure(v_signature);
    IF v_function IS NULL
       OR NOT has_function_privilege('authenticated', v_function, 'EXECUTE')
       OR has_function_privilege('anon', v_function, 'EXECUTE')
       OR EXISTS (
         SELECT 1
         FROM pg_proc AS function
         CROSS JOIN LATERAL aclexplode(
           COALESCE(function.proacl, acldefault('f', function.proowner))
         ) AS acl
         WHERE function.oid = v_function
           AND acl.grantee = 0
           AND acl.privilege_type = 'EXECUTE'
       ) THEN
      RAISE EXCEPTION 'H3 rollback privilege mismatch for %', v_signature;
    END IF;
  END LOOP;
  RAISE NOTICE 'H3 rollback legacy surface probe passed';
END $$;
SQL
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-merge-tasks-rpc.sql" >/dev/null
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-canonical-task-contract.sql" >/dev/null
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-complete-task-rpc.sql" >/dev/null

# The forward migration must remain replayable after the inverse and restore
# the request-hash-bearing canonical surface before the canonical suite runs.
for _ in 1 2; do
  docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
    < "$h3_migration" >/dev/null
done
docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
DO $$
BEGIN
  IF to_regprocedure(
       'public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid,text)'
     ) IS NULL
     OR to_regprocedure(
       'public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)'
     ) IS NOT NULL
     OR to_regprocedure('public.flowstate_h3_finalize_receipt(uuid,text,jsonb,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'H3 reapply did not restore the canonical RPC surface';
  END IF;
  RAISE NOTICE 'H3 reapply canonical surface probe passed';
END $$;
SQL
for _ in 1 2; do
  docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
    < "$h4_migration" >/dev/null
done
for _ in 1 2; do
  docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
    < "$h5_migration" >/dev/null
done
for _ in 1 2; do
  docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
    < "$h6_migration" >/dev/null
done
for migration in "$h7_recurrence_migration" "$h7_timer_migration" "$h7_organization_migration"; do
  for _ in 1 2; do
    docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
      < "$migration" >/dev/null
  done
done
for _ in 1 2; do
  docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
    < "$h8_cause_migration" >/dev/null
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
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-task-lifecycle-rpc.sql" >/dev/null
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-subtask-batch-rpc.sql" >/dev/null
FLOWSTATE_DB_CONTAINER="$container" FLOWSTATE_TEST_DB="$test_db" \
  bash "$root_dir/scripts/db/test-subtask-batch-concurrency.sh"
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-work-block-batch-rpc.sql"
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-recurrence-lifecycle-rpc.sql" >/dev/null
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-canonical-timer-command.sql" >/dev/null
FLOWSTATE_DB_CONTAINER="$container" FLOWSTATE_TEST_DB="$test_db" \
  bash "$root_dir/scripts/db/test-canonical-timer-concurrency.sh"
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-canonical-organization-commands.sql" >/dev/null
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$root_dir/scripts/db/test-task-inventory-change-causes.sql" >/dev/null

FLOWSTATE_DB_CONTAINER="$container" FLOWSTATE_TEST_DB="$test_db" \
  bash "$root_dir/scripts/db/test-canonical-notion-concurrency.sh"

echo "PASS: reliable assistant canonical database contract"
