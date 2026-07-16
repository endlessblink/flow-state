#!/usr/bin/env bash
set -euo pipefail

container="${FLOWSTATE_DB_CONTAINER:-supabase_db_flow-state}"
test_db="${FLOWSTATE_TEST_DB:?FLOWSTATE_TEST_DB is required}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO auth.users (id,instance_id,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,aud,role,confirmation_token,recovery_token)
VALUES ('5bc00000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','subtask-race@test.flowstate','',now(),now(),now(),'{}','{}','authenticated','authenticated','','');
INSERT INTO public.tasks (id,user_id,title,status,is_deleted,instances,subtasks,is_in_inbox)
VALUES
('5bc00000-0000-4000-8000-000000000101','5bc00000-0000-4000-8000-000000000001','Concurrent subtask parent','planned',false,'[]','[]',true),
('5bc00000-0000-4000-8000-000000000102','5bc00000-0000-4000-8000-000000000001','Concurrent replay parent','planned',false,'[]','[]',true);
SQL

auth_sql="SELECT set_config('request.jwt.claim.sub','5bc00000-0000-4000-8000-000000000001',false); SELECT set_config('request.jwt.claims','{\"sub\":\"5bc00000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}',false);"
ops_a='[{"action":"create","subtask":{"id":"5bc00000-0000-4000-8000-000000000201","title":"Winner A","doneEnough":"A is complete"}}]'
ops_b='[{"action":"create","subtask":{"id":"5bc00000-0000-4000-8000-000000000202","title":"Winner B","doneEnough":"B is complete"}}]'

preview_a="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "$auth_sql SELECT r->>'previewDigest',r->>'previewExpiresAt' FROM (SELECT public.flowstate_subtask_batch_v1('subtask-race-a','subtask-batch-v1','local-api','5bc00000-0000-4000-8000-000000000101',1,'$ops_a',true) r) q;" | tail -n1)"
preview_b="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "$auth_sql SELECT r->>'previewDigest',r->>'previewExpiresAt' FROM (SELECT public.flowstate_subtask_batch_v1('subtask-race-b','subtask-batch-v1','local-api','5bc00000-0000-4000-8000-000000000101',1,'$ops_b',true) r) q;" | tail -n1)"
IFS='|' read -r digest_a expiry_a <<< "$preview_a"
IFS='|' read -r digest_b expiry_b <<< "$preview_b"

docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
  "BEGIN; $auth_sql SELECT public.flowstate_subtask_batch_v1('subtask-race-a','subtask-batch-v1','local-api','5bc00000-0000-4000-8000-000000000101',1,'$ops_a',false,'$digest_a','$expiry_a',NULL,'[\"5bc00000-0000-4000-8000-000000000201\"]'); SELECT pg_sleep(1); COMMIT;" >"$tmp_dir/a" &
pid_a=$!
sleep 0.1
docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
  "$auth_sql SELECT public.flowstate_subtask_batch_v1('subtask-race-b','subtask-batch-v1','local-api','5bc00000-0000-4000-8000-000000000101',1,'$ops_b',false,'$digest_b','$expiry_b',NULL,'[\"5bc00000-0000-4000-8000-000000000202\"]');" >"$tmp_dir/b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

committed_count="$(grep -h -o '"ok": true' "$tmp_dir/a" "$tmp_dir/b" | wc -l)"
stale_count="$(grep -h -o '"code": "stale_revision"' "$tmp_dir/a" "$tmp_dir/b" | wc -l)"
state="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "SELECT (SELECT count(*) FROM public.canonical_operations WHERE operation_id IN ('subtask-race-a','subtask-race-b')),(SELECT count(*) FROM public.canonical_change_log WHERE operation_id IN ('subtask-race-a','subtask-race-b')),(SELECT canonical_revision FROM public.tasks WHERE id='5bc00000-0000-4000-8000-000000000101'),(SELECT jsonb_array_length(subtasks) FROM public.tasks WHERE id='5bc00000-0000-4000-8000-000000000101');")"

if [[ "$committed_count" != "1" || "$stale_count" != "1" || "$state" != "1|1|2|1" ]]; then
  echo "FAIL: concurrent subtask batches did not serialize under parent CAS: committed=$committed_count stale=$stale_count state=$state" >&2
  cat "$tmp_dir/a" "$tmp_dir/b" >&2
  exit 1
fi

ops_same='[{"action":"create","subtask":{"id":"5bc00000-0000-4000-8000-000000000203","title":"Exact replay","doneEnough":"One durable result exists"}}]'
preview_same="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "$auth_sql SELECT r->>'previewDigest',r->>'previewExpiresAt' FROM (SELECT public.flowstate_subtask_batch_v1('subtask-race-same','subtask-batch-v1','local-api','5bc00000-0000-4000-8000-000000000102',1,'$ops_same',true) r) q;" | tail -n1)"
IFS='|' read -r digest_same expiry_same <<< "$preview_same"
apply_same="$auth_sql SELECT public.flowstate_subtask_batch_v1('subtask-race-same','subtask-batch-v1','local-api','5bc00000-0000-4000-8000-000000000102',1,'$ops_same',false,'$digest_same','$expiry_same',NULL,'[\"5bc00000-0000-4000-8000-000000000203\"]');"

docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
  "BEGIN; $apply_same SELECT pg_sleep(1); COMMIT;" >"$tmp_dir/same-a" &
pid_same_a=$!
sleep 0.1
docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
  "$apply_same" >"$tmp_dir/same-b" &
pid_same_b=$!
wait "$pid_same_a"
wait "$pid_same_b"

grep -E '^\{' "$tmp_dir/same-a" | tail -n1 >"$tmp_dir/same-receipt-a"
grep -E '^\{' "$tmp_dir/same-b" | tail -n1 >"$tmp_dir/same-receipt-b"
sed -E 's/"replayed": true/"replayed": false/' "$tmp_dir/same-receipt-a" >"$tmp_dir/same-normalized-a"
sed -E 's/"replayed": true/"replayed": false/' "$tmp_dir/same-receipt-b" >"$tmp_dir/same-normalized-b"
same_replay_count="$(grep -h -o '"replayed": true' "$tmp_dir/same-receipt-a" "$tmp_dir/same-receipt-b" | wc -l)"
same_state="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "SELECT (SELECT count(*) FROM public.canonical_operations WHERE operation_id='subtask-race-same' AND state='committed'),(SELECT count(*) FROM public.canonical_change_log WHERE operation_id='subtask-race-same'),(SELECT canonical_revision FROM public.tasks WHERE id='5bc00000-0000-4000-8000-000000000102'),(SELECT jsonb_array_length(subtasks) FROM public.tasks WHERE id='5bc00000-0000-4000-8000-000000000102');")"

if ! cmp -s "$tmp_dir/same-normalized-a" "$tmp_dir/same-normalized-b" \
   || [[ "$same_replay_count" != "1" || "$same_state" != "1|1|2|1" ]] \
   || ! grep -q '"ok": true' "$tmp_dir/same-receipt-a" \
   || ! grep -q '"ok": true' "$tmp_dir/same-receipt-b"; then
  echo "FAIL: identical concurrent subtask apply did not return one exact durable replay: replay=$same_replay_count state=$same_state" >&2
  cat "$tmp_dir/same-receipt-a" "$tmp_dir/same-receipt-b" >&2
  exit 1
fi

echo "PASS: concurrent subtask batches produce one commit, one stale revision, and one exact same-operation replay"
