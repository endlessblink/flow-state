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
  'dc150000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'recurrence-concurrency@test.flowstate', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated', '', ''
);

INSERT INTO public.workspaces (id, name, owner_id) VALUES (
  'dc150000-0000-4000-8000-000000000101',
  'Recurrence concurrency fixture',
  'dc150000-0000-4000-8000-000000000001'
);
INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (
  'dc150000-0000-4000-8000-000000000101',
  'dc150000-0000-4000-8000-000000000001',
  'owner'
);

INSERT INTO public.tasks (
  id, user_id, workspace_id, title, status, subtasks, instances, attachments,
  recurrence_rule, recurrence_count, is_completion_record, is_deleted, is_in_inbox
) VALUES
  (
    'dc150000-0000-4000-8000-000000000201',
    'dc150000-0000-4000-8000-000000000001',
    'dc150000-0000-4000-8000-000000000101',
    'Concurrent survivor', 'planned', '[]', '[]', '[]',
    '{"pattern":"daily","interval":1,"endType":"never"}', 0, false, false, true
  ),
  (
    'dc150000-0000-4000-8000-000000000202',
    'dc150000-0000-4000-8000-000000000001',
    'dc150000-0000-4000-8000-000000000101',
    'Concurrent duplicate', 'planned', '[]', '[]', '[]',
    '{"pattern":"weekly","interval":1,"weekdays":[1],"endType":"never"}', 0, false, false, true
  ),
  (
    'dc150000-0000-4000-8000-000000000203',
    'dc150000-0000-4000-8000-000000000001',
    'dc150000-0000-4000-8000-000000000101',
    'Related-state survivor', 'planned', '[]', '[]', '[]',
    '{"pattern":"daily","interval":1,"endType":"never"}', 0, false, false, true
  ),
  (
    'dc150000-0000-4000-8000-000000000204',
    'dc150000-0000-4000-8000-000000000001',
    'dc150000-0000-4000-8000-000000000101',
    'Related-state duplicate', 'planned', '[]', '[]', '[]',
    '{"pattern":"weekly","interval":1,"weekdays":[1],"endType":"never"}', 0, false, false, true
  );
SQL

auth_sql="SELECT set_config('request.jwt.claim.sub','dc150000-0000-4000-8000-000000000001',false); SELECT set_config('request.jwt.claims','{\"sub\":\"dc150000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}',false);"

preview_version="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
  "$auth_sql SELECT result->>'previewVersion' FROM (SELECT public.flowstate_merge_tasks_with_recurrence('dc150000-0000-4000-8000-000000000201','dc150000-0000-4000-8000-000000000202','{\"pattern\":\"daily\",\"interval\":3,\"endType\":\"never\"}',true,null,null,'dc150000-0000-4000-8000-000000000101') AS result) AS preview;" \
  | tail -n 1)"

if [[ ! "$preview_version" =~ ^[0-9a-f]{64}$ ]]; then
  echo "FAIL: separate-transaction recurrence preview did not return a stable digest" >&2
  exit 1
fi

apply_sql="$auth_sql SELECT public.flowstate_merge_tasks_with_recurrence('dc150000-0000-4000-8000-000000000201','dc150000-0000-4000-8000-000000000202','{\"pattern\":\"daily\",\"interval\":3,\"endType\":\"never\"}',false,'concurrent-recurrence-request','$preview_version','dc150000-0000-4000-8000-000000000101');"

docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
  "BEGIN; $apply_sql SELECT pg_sleep(1); COMMIT;" > "$tmp_dir/apply-a" &
pid_a=$!
sleep 0.1
docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
  "$apply_sql" > "$tmp_dir/apply-b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

grep -E '^\{' "$tmp_dir/apply-a" | tail -n 1 > "$tmp_dir/receipt-a"
grep -E '^\{' "$tmp_dir/apply-b" | tail -n 1 > "$tmp_dir/receipt-b"

if ! cmp -s "$tmp_dir/receipt-a" "$tmp_dir/receipt-b" \
   || ! grep -q '"ok": true' "$tmp_dir/receipt-a" \
   || ! grep -q '"requestId": "concurrent-recurrence-request"' "$tmp_dir/receipt-a"; then
  echo "FAIL: concurrent identical recurrence applies did not replay one receipt" >&2
  exit 1
fi

state="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "SELECT (SELECT recurrence_rule->>'interval' FROM public.tasks WHERE id='dc150000-0000-4000-8000-000000000201'), (SELECT is_deleted FROM public.tasks WHERE id='dc150000-0000-4000-8000-000000000202'), (SELECT count(*) FROM public.flowstate_action_receipts WHERE operation='merge_tasks_recurrence' AND request_id='concurrent-recurrence-request');")"

if [[ "$state" != "3|t|1" ]]; then
  echo "FAIL: concurrent recurrence merge ended in unexpected state: $state" >&2
  exit 1
fi

related_preview="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
  "$auth_sql SELECT result->>'previewVersion' FROM (SELECT public.flowstate_merge_tasks_with_recurrence('dc150000-0000-4000-8000-000000000203','dc150000-0000-4000-8000-000000000204','{\"pattern\":\"daily\",\"interval\":5,\"endType\":\"never\"}',true,null,null,'dc150000-0000-4000-8000-000000000101') AS result) AS preview;" \
  | tail -n 1)"

docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO public.task_comments (id, task_id, workspace_id, user_id, content) VALUES (
  'dc150000-0000-4000-8000-000000000301',
  'dc150000-0000-4000-8000-000000000204',
  'dc150000-0000-4000-8000-000000000101',
  'dc150000-0000-4000-8000-000000000001',
  'Added after approval'
);
SQL

related_result="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
  "$auth_sql SELECT result#>>'{error,code}' FROM (SELECT public.flowstate_merge_tasks_with_recurrence('dc150000-0000-4000-8000-000000000203','dc150000-0000-4000-8000-000000000204','{\"pattern\":\"daily\",\"interval\":5,\"endType\":\"never\"}',false,'related-state-request','$related_preview','dc150000-0000-4000-8000-000000000101') AS result) AS apply;" \
  | tail -n 1)"

if [[ "$related_result" != "state_conflict" ]]; then
  echo "FAIL: related state changed after approval but apply returned: $related_result" >&2
  exit 1
fi

echo "PASS: separate-transaction preview, related-state binding, and concurrent recurrence apply replay"
