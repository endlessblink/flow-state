#!/usr/bin/env bash
set -euo pipefail

container="${FLOWSTATE_DB_CONTAINER:-supabase_db_flow-state}"
test_db="${FLOWSTATE_TEST_DB:?FLOWSTATE_TEST_DB must name a disposable database}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

user_id='ca160000-0000-4000-8000-000000000001'
task_id='ca160000-0000-4000-8000-000000000101'

docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<SQL
INSERT INTO auth.users (
  id,instance_id,email,encrypted_password,email_confirmed_at,created_at,updated_at,
  raw_app_meta_data,raw_user_meta_data,aud,role,confirmation_token,recovery_token
) VALUES (
  '$user_id','00000000-0000-0000-0000-000000000000',
  'subtask-batch-race@test.flowstate','',now(),now(),now(),'{}','{}',
  'authenticated','authenticated','',''
);

INSERT INTO public.tasks (
  id,user_id,title,status,is_deleted,instances,subtasks,is_in_inbox
) VALUES (
  '$task_id','$user_id','Concurrent subtask parent','planned',false,'[]','[]',true
);
SQL

auth_sql="SELECT set_config('request.jwt.claim.sub','$user_id',false); SELECT set_config('request.jwt.claims','{\"sub\":\"$user_id\",\"role\":\"authenticated\"}',false);"

preview() {
  local operation_id="$1" client_id="$2" title="$3"
  docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
    "$auth_sql SELECT result->>'previewDigest',result->>'previewExpiresAt',result->>'requestHash',result->>'baseRevision' FROM (SELECT public.flowstate_subtask_batch_v1('$operation_id','task-v1','local-api','$task_id',(SELECT canonical_revision FROM public.tasks WHERE id='$task_id'),jsonb_build_array(jsonb_build_object('kind','create','clientId','$client_id','title','$title','order',0)),true,NULL,NULL,NULL,NULL) AS result) AS preview_result;" \
    | tail -n 1
}

apply_sql() {
  local operation_id="$1" client_id="$2" title="$3" digest="$4" expiry="$5" request_hash="$6" base_revision="$7"
  printf "%s SELECT result->>'result',COALESCE(result#>>'{receipt,status}',''),COALESCE(result#>>'{error,code}',''),COALESCE(result#>>'{error,currentRevision}','') FROM (SELECT public.flowstate_subtask_batch_v1('%s','task-v1','local-api','%s',%s,jsonb_build_array(jsonb_build_object('kind','create','clientId','%s','title','%s','order',0)),false,'%s','%s'::timestamptz,NULL,'%s') AS result) AS apply_result;" \
    "$auth_sql" "$operation_id" "$task_id" "$base_revision" "$client_id" "$title" "$digest" "$expiry" "$request_hash"
}

IFS='|' read -r digest_a expiry_a hash_a base_a <<<"$(preview 'subtask-race-a' 'race-step-a' 'Concurrent step A')"
IFS='|' read -r digest_b expiry_b hash_b base_b <<<"$(preview 'subtask-race-b' 'race-step-b' 'Concurrent step B')"

if [[ "$base_a" != "$base_b" || ! "$digest_a" =~ ^[0-9a-f]{64}$ \
   || ! "$digest_b" =~ ^[0-9a-f]{64}$ || ! "$hash_a" =~ ^[0-9a-f]{64}$ \
   || ! "$hash_b" =~ ^[0-9a-f]{64}$ ]]; then
  echo "FAIL: concurrent subtask previews did not bind one valid base revision" >&2
  exit 1
fi

sql_a="$(apply_sql 'subtask-race-a' 'race-step-a' 'Concurrent step A' "$digest_a" "$expiry_a" "$hash_a" "$base_a")"
sql_b="$(apply_sql 'subtask-race-b' 'race-step-b' 'Concurrent step B' "$digest_b" "$expiry_b" "$hash_b" "$base_b")"

# Hold A's transaction open after its canonical write so B overlaps and blocks
# on the same task row. B must observe A's revision after the lock is released.
docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "BEGIN; $sql_a SELECT pg_sleep(1); COMMIT;" >"$tmp_dir/a" &
pid_a=$!
sleep 0.1
docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "$sql_b" >"$tmp_dir/b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

result_a="$(grep -E '^(committed|conflict)\|' "$tmp_dir/a" | tail -n 1)"
result_b="$(grep -E '^(committed|conflict)\|' "$tmp_dir/b" | tail -n 1)"
if [[ "$result_a" != 'committed|committed||' \
   || "$result_b" != "conflict||stale_revision|$((base_a + 1))" ]]; then
  echo "FAIL: distinct subtask operations did not serialize to commit + typed stale conflict" >&2
  echo "A: $result_a" >&2
  echo "B: $result_b" >&2
  exit 1
fi

state="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "SELECT
    canonical_revision,
    jsonb_array_length(subtasks),
    subtasks#>>'{0,clientId}',
    (SELECT count(*) FROM public.canonical_operations WHERE user_id='$user_id' AND operation_id IN ('subtask-race-a','subtask-race-b') AND state='committed'),
    (SELECT count(*) FROM public.canonical_change_log WHERE user_id='$user_id' AND operation_id IN ('subtask-race-a','subtask-race-b')),
    (SELECT count(*) FROM public.canonical_operation_previews WHERE user_id='$user_id' AND operation_id='subtask-race-a' AND consumed_at IS NOT NULL),
    (SELECT count(*) FROM public.canonical_operation_previews WHERE user_id='$user_id' AND operation_id='subtask-race-b' AND consumed_at IS NULL)
  FROM public.tasks WHERE id='$task_id';")"

expected_state="$((base_a + 1))|1|race-step-a|1|1|1|1"
if [[ "$state" != "$expected_state" ]]; then
  echo "FAIL: subtask race lost state or duplicated canonical evidence: $state" >&2
  exit 1
fi

echo 'PASS: distinct simultaneous subtask batches serialize to one commit and one typed stale conflict'
