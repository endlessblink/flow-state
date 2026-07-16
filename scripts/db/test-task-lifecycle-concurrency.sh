#!/usr/bin/env bash
set -euo pipefail

container="${FLOWSTATE_DB_CONTAINER:-supabase_db_flow-state}"
test_db="${FLOWSTATE_TEST_DB:?FLOWSTATE_TEST_DB is required}"
tmp_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES (
  '1cc40000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'lifecycle-concurrency@test.flowstate', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated', '', ''
);

INSERT INTO public.tasks (
  id, user_id, title, status, is_deleted, instances, subtasks, is_in_inbox
) VALUES (
  '1cc40000-0000-4000-8000-000000000102',
  '1cc40000-0000-4000-8000-000000000001',
  'Concurrent lifecycle status', 'planned', false, '[]', '[]', true
);
SQL

auth_sql="SELECT set_config('request.jwt.claim.sub','1cc40000-0000-4000-8000-000000000001',false); SELECT set_config('request.jwt.claims','{\"sub\":\"1cc40000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}',false);"

run_pair() {
  local label="$1"
  local apply_sql="$2"

  docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
    "BEGIN; $apply_sql SELECT pg_sleep(1); COMMIT;" > "$tmp_dir/$label-a" &
  local pid_a=$!
  sleep 0.1
  docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
    "$apply_sql" > "$tmp_dir/$label-b" &
  local pid_b=$!
  wait "$pid_a"
  wait "$pid_b"

  grep -E '^\{' "$tmp_dir/$label-a" | tail -n 1 > "$tmp_dir/$label-receipt-a"
  grep -E '^\{' "$tmp_dir/$label-b" | tail -n 1 > "$tmp_dir/$label-receipt-b"
  sed -E 's/"replayed": true/"replayed": false/' \
    "$tmp_dir/$label-receipt-a" > "$tmp_dir/$label-normalized-a"
  sed -E 's/"replayed": true/"replayed": false/' \
    "$tmp_dir/$label-receipt-b" > "$tmp_dir/$label-normalized-b"
  local replay_count
  replay_count="$(grep -h -o '"replayed": true' "$tmp_dir/$label-receipt-a" "$tmp_dir/$label-receipt-b" | wc -l)"

  if ! cmp -s "$tmp_dir/$label-normalized-a" "$tmp_dir/$label-normalized-b" \
     || [[ "$replay_count" != "1" ]] \
     || ! grep -q '"ok": true' "$tmp_dir/$label-receipt-a"; then
    echo "FAIL: concurrent lifecycle $label did not return one exact replay" >&2
    exit 1
  fi
}

create_preview="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "$auth_sql SELECT result->>'previewDigest', result->>'previewExpiresAt' FROM (SELECT public.flowstate_task_lifecycle_v1('lifecycle-concurrent-create','task-lifecycle-v1','local-api','create','1cc40000-0000-4000-8000-000000000101',0,'{\"title\":\"Concurrent create\",\"description\":\"Bound\",\"priority\":\"high\",\"dueDate\":\"2026-07-31\"}',true) AS result) AS preview;" | tail -n 1)"
IFS='|' read -r create_digest create_expiry <<< "$create_preview"
create_apply="$auth_sql SELECT public.flowstate_task_lifecycle_v1('lifecycle-concurrent-create','task-lifecycle-v1','local-api','create','1cc40000-0000-4000-8000-000000000101',0,'{\"title\":\"Concurrent create\",\"description\":\"Bound\",\"priority\":\"high\",\"dueDate\":\"2026-07-31\"}',false,'$create_digest','$create_expiry');"
run_pair create "$create_apply"

status_preview="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "$auth_sql SELECT result->>'previewDigest', result->>'previewExpiresAt', result->>'baseRevision' FROM (SELECT public.flowstate_task_lifecycle_v1('lifecycle-concurrent-status','task-lifecycle-v1','local-api','set_status','1cc40000-0000-4000-8000-000000000102',(SELECT canonical_revision FROM public.tasks WHERE id='1cc40000-0000-4000-8000-000000000102'),'{\"status\":\"in_progress\"}',true) AS result) AS preview;" | tail -n 1)"
IFS='|' read -r status_digest status_expiry status_revision <<< "$status_preview"
status_apply="$auth_sql SELECT public.flowstate_task_lifecycle_v1('lifecycle-concurrent-status','task-lifecycle-v1','local-api','set_status','1cc40000-0000-4000-8000-000000000102',$status_revision,'{\"status\":\"in_progress\"}',false,'$status_digest','$status_expiry');"
run_pair status "$status_apply"

state="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "SELECT (SELECT count(*) FROM public.canonical_operations WHERE operation_id IN ('lifecycle-concurrent-create','lifecycle-concurrent-status')), (SELECT count(*) FROM public.canonical_change_log WHERE operation_id IN ('lifecycle-concurrent-create','lifecycle-concurrent-status')), (SELECT canonical_revision FROM public.tasks WHERE id='1cc40000-0000-4000-8000-000000000101'), (SELECT canonical_revision FROM public.tasks WHERE id='1cc40000-0000-4000-8000-000000000102'), (SELECT status FROM public.tasks WHERE id='1cc40000-0000-4000-8000-000000000102');")"

if [[ "$state" != "2|2|1|2|in_progress" ]]; then
  echo "FAIL: concurrent lifecycle commands mutated more than once: $state" >&2
  exit 1
fi

echo "PASS: concurrent lifecycle create and status return exact durable replay"
