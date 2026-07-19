#!/usr/bin/env bash
set -euo pipefail

container="${FLOWSTATE_DB_CONTAINER:-supabase_db_flow-state}"
test_db="${FLOWSTATE_TEST_DB:?FLOWSTATE_TEST_DB is required}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,aud,role,confirmation_token,recovery_token)
VALUES ('6bd00000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','work-block-merge-race@test.flowstate','',now(),now(),now(),'{}','{}','authenticated','authenticated','','');
INSERT INTO public.tasks (id,user_id,title,status,is_deleted,instances,subtasks,is_in_inbox)
VALUES
('6bd00000-0000-4000-8000-000000000101','6bd00000-0000-4000-8000-000000000001','Merge lock first','planned',false,'[]','[]',true),
('6bd00000-0000-4000-8000-000000000102','6bd00000-0000-4000-8000-000000000001','Work-block target','planned',false,'[]','[]',true);
SQL

auth_sql="SELECT set_config('request.jwt.claim.sub','6bd00000-0000-4000-8000-000000000001',false); SELECT set_config('request.jwt.claims','{\"sub\":\"6bd00000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}',false);"
command='{"action":"create","workBlock":{"id":"6bd00000-0000-4000-8000-000000000201","scheduledDate":"2026-07-20","scheduledTime":"10:00","duration":30,"timezone":"UTC"}}'
preview="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "$auth_sql SELECT r->>'previewDigest',r->>'previewExpiresAt' FROM (SELECT public.flowstate_work_block_v1('work-block-merge-race','work-block-v1','local-api','6bd00000-0000-4000-8000-000000000102',1,0,'$command',true) r) q;" | tail -n1)"
IFS='|' read -r digest expiry <<< "$preview"

# Reproduce the existing merge lock order with an intentional scheduling gap:
# the lower task is locked first, then the higher task. A work-block apply must
# wait on the lower row before it can hold the higher target row.
docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
  "BEGIN; SET LOCAL lock_timeout='5s'; SELECT 1 FROM public.tasks WHERE id='6bd00000-0000-4000-8000-000000000101' FOR UPDATE; SELECT pg_sleep(0.5); SELECT 1 FROM public.tasks WHERE id='6bd00000-0000-4000-8000-000000000102' FOR UPDATE; COMMIT;" >"$tmp_dir/merge" 2>&1 &
merge_pid=$!
sleep 0.1
docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
  "SET lock_timeout='5s'; $auth_sql SELECT public.flowstate_work_block_v1('work-block-merge-race','work-block-v1','local-api','6bd00000-0000-4000-8000-000000000102',1,0,'$command',false,'$digest','$expiry');" >"$tmp_dir/work-block" 2>&1 &
work_block_pid=$!

wait "$merge_pid"
wait "$work_block_pid"

state="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "SELECT canonical_revision,jsonb_array_length(instances),(SELECT count(*) FROM public.canonical_operations WHERE operation_id='work-block-merge-race' AND state='committed') FROM public.tasks WHERE id='6bd00000-0000-4000-8000-000000000102';")"
if [[ "$state" != "2|1|1" ]] || ! grep -q '"ok": true' "$tmp_dir/work-block"; then
  echo "FAIL: work-block apply and merge-order locks did not complete without deadlock: state=$state" >&2
  cat "$tmp_dir/merge" "$tmp_dir/work-block" >&2
  exit 1
fi

echo "PASS: work-block apply follows merge-compatible task lock order"

