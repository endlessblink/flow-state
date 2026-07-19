#!/usr/bin/env bash
set -euo pipefail

container="${FLOWSTATE_DB_CONTAINER:-supabase_db_flow-state}"
test_db="${FLOWSTATE_TEST_DB:?FLOWSTATE_TEST_DB is required}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,aud,role,confirmation_token,recovery_token)
VALUES ('6bc00000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','work-block-race@test.flowstate','',now(),now(),now(),'{}','{}','authenticated','authenticated','','');
INSERT INTO public.tasks (id,user_id,title,status,is_deleted,instances,subtasks,is_in_inbox)
VALUES ('6bc00000-0000-4000-8000-000000000101','6bc00000-0000-4000-8000-000000000001','Concurrent work blocks','planned',false,'[]','[]',true);
SQL

auth_sql="SELECT set_config('request.jwt.claim.sub','6bc00000-0000-4000-8000-000000000001',false); SELECT set_config('request.jwt.claims','{\"sub\":\"6bc00000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}',false);"
cmd_a='{"action":"create","workBlock":{"id":"6bc00000-0000-4000-8000-000000000201","scheduledDate":"2026-07-18","scheduledTime":"09:00","duration":30,"timezone":"UTC"}}'
cmd_b='{"action":"create","workBlock":{"id":"6bc00000-0000-4000-8000-000000000202","scheduledDate":"2026-07-18","scheduledTime":"10:00","duration":30,"timezone":"UTC"}}'
preview_a="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c "$auth_sql SELECT r->>'previewDigest',r->>'previewExpiresAt' FROM (SELECT public.flowstate_work_block_v1('work-block-race-a','work-block-v1','local-api','6bc00000-0000-4000-8000-000000000101',1,0,'$cmd_a',true) r) q;" | tail -n1)"
preview_b="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c "$auth_sql SELECT r->>'previewDigest',r->>'previewExpiresAt' FROM (SELECT public.flowstate_work_block_v1('work-block-race-b','work-block-v1','local-api','6bc00000-0000-4000-8000-000000000101',1,0,'$cmd_b',true) r) q;" | tail -n1)"
IFS='|' read -r digest_a expiry_a <<< "$preview_a"
IFS='|' read -r digest_b expiry_b <<< "$preview_b"

docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c "BEGIN; $auth_sql SELECT public.flowstate_work_block_v1('work-block-race-a','work-block-v1','local-api','6bc00000-0000-4000-8000-000000000101',1,0,'$cmd_a',false,'$digest_a','$expiry_a'); SELECT pg_sleep(1); COMMIT;" >"$tmp_dir/a" &
pid_a=$!
sleep 0.1
docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c "$auth_sql SELECT public.flowstate_work_block_v1('work-block-race-b','work-block-v1','local-api','6bc00000-0000-4000-8000-000000000101',1,0,'$cmd_b',false,'$digest_b','$expiry_b');" >"$tmp_dir/b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

committed_count="$(grep -h -o '"result": "committed"' "$tmp_dir/a" "$tmp_dir/b" | wc -l)"
stale_count="$(grep -h -o '"code": "stale_revision"' "$tmp_dir/a" "$tmp_dir/b" | wc -l)"
state="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM canonical_operations WHERE operation_id IN ('work-block-race-a','work-block-race-b')),(SELECT count(*) FROM canonical_change_log WHERE operation_id IN ('work-block-race-a','work-block-race-b')),(SELECT canonical_revision FROM tasks WHERE id='6bc00000-0000-4000-8000-000000000101'),(SELECT jsonb_array_length(instances) FROM tasks WHERE id='6bc00000-0000-4000-8000-000000000101');")"
if [[ "$committed_count" != "1" || "$stale_count" != "1" || "$state" != "1|1|2|1" ]]; then
  echo "FAIL: concurrent work-block appends escaped parent CAS: committed=$committed_count stale=$stale_count state=$state" >&2
  cat "$tmp_dir/a" "$tmp_dir/b" >&2
  exit 1
fi
echo "PASS: concurrent work-block appends preserve one winner without overwrite"
