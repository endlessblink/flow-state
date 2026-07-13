#!/usr/bin/env bash
set -euo pipefail

container="${FLOWSTATE_DB_CONTAINER:-supabase_db_flow-state}"
test_db="${FLOWSTATE_TEST_DB:?FLOWSTATE_TEST_DB must name a disposable database}"
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
  'ca130000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'canonical-notion-race@test.flowstate', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated', '', ''
);
SQL

auth_sql="SELECT set_config('request.jwt.claim.sub','ca130000-0000-4000-8000-000000000001',false); SELECT set_config('request.jwt.claims','{\"sub\":\"ca130000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}',false);"
notion_json='{"pageId":"notion-race-page","dataSourceId":"notion-race-source","url":"https://www.notion.so/notion-race-page","lastEditedAt":"2026-07-14T10:00:00Z"}'
task_json='{"title":"Concurrent Notion activation","description":"Race fixture","priority":"high"}'
block_json='{"scheduledDate":"2026-07-14","scheduledTime":"16:00","duration":25}'

preview() {
  local operation_id="$1"
  docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
    "$auth_sql SELECT result->>'previewDigest',result->>'previewExpiresAt' FROM (SELECT public.flowstate_activate_notion_task_v1('$operation_id','$notion_json'::jsonb,'$task_json'::jsonb,'$block_json'::jsonb,true) AS result) AS preview_result;" \
    | tail -n 1
}

apply_sql() {
  local operation_id="$1"
  local digest="$2"
  local expires_at="$3"
  local requested_task_json="${4:-$task_json}"
  printf "%s SELECT result->>'result',COALESCE(result#>>'{receipt,replayed}',''),COALESCE(result#>>'{error,code}','') FROM (SELECT public.flowstate_activate_notion_task_v1('%s','%s'::jsonb,'%s'::jsonb,'%s'::jsonb,false,'%s','%s'::timestamptz) AS result) AS apply_result;" \
    "$auth_sql" "$operation_id" "$notion_json" "$requested_task_json" "$block_json" "$digest" "$expires_at"
}

run_pair() {
  local sql_a="$1"
  local sql_b="$2"
  local prefix="$3"
  docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c "$sql_a" >"$tmp_dir/${prefix}-a" &
  local pid_a=$!
  docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c "$sql_b" >"$tmp_dir/${prefix}-b" &
  local pid_b=$!
  wait "$pid_a"
  wait "$pid_b"
  tail -n 1 "$tmp_dir/${prefix}-a"
  tail -n 1 "$tmp_dir/${prefix}-b"
}

IFS='|' read -r same_digest same_expiry <<<"$(preview 'same-operation')"
same_results="$(run_pair \
  "$(apply_sql 'same-operation' "$same_digest" "$same_expiry")" \
  "$(apply_sql 'same-operation' "$same_digest" "$same_expiry")" \
  same-operation)"
if [[ "$(grep -c '^committed|' <<<"$same_results")" != "2" ]] \
  || [[ "$(grep -c '^committed|false|' <<<"$same_results")" != "1" ]] \
  || [[ "$(grep -c '^committed|true|' <<<"$same_results")" != "1" ]]; then
  echo "FAIL: same-operation concurrency did not commit once and replay once"
  exit 1
fi

conflict_task='{"title":"Changed concurrent payload"}'
conflict_result="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "$(apply_sql 'same-operation' "$same_digest" "$same_expiry" "$conflict_task")" | tail -n 1)"
if [[ "$conflict_result" != "conflict||idempotency_conflict" ]]; then
  echo "FAIL: same operation accepted a changed payload"
  exit 1
fi

IFS='|' read -r different_digest_a different_expiry_a <<<"$(preview 'different-operation-a')"
IFS='|' read -r different_digest_b different_expiry_b <<<"$(preview 'different-operation-b')"
different_results="$(run_pair \
  "$(apply_sql 'different-operation-a' "$different_digest_a" "$different_expiry_a")" \
  "$(apply_sql 'different-operation-b' "$different_digest_b" "$different_expiry_b")" \
  different-operation)"
if [[ "$(grep -c '^committed|false|' <<<"$different_results")" != "2" ]]; then
  echo "FAIL: different-operation provenance race did not serialize safely"
  exit 1
fi

integrity="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "SELECT
    (SELECT count(*) FROM public.tasks WHERE user_id='ca130000-0000-4000-8000-000000000001' AND external_source='notion' AND external_id='notion-race-page' AND is_deleted=false),
    (SELECT count(*) FROM public.canonical_operations WHERE user_id='ca130000-0000-4000-8000-000000000001' AND operation_id IN ('same-operation','different-operation-a','different-operation-b') AND state='committed'),
    (SELECT count(*) FROM public.canonical_change_log WHERE operation_id IN ('same-operation','different-operation-a','different-operation-b')),
    (SELECT count(*) FROM public.tasks AS task CROSS JOIN LATERAL jsonb_array_elements(task.instances) AS instance WHERE task.user_id='ca130000-0000-4000-8000-000000000001' AND task.external_id='notion-race-page' AND instance->>'scheduledDate'='2026-07-14' AND instance->>'scheduledTime'='16:00' AND instance->>'duration'='25');" | tail -n 1)"
if [[ "$integrity" != "1|3|3|1" ]]; then
  echo "FAIL: concurrent activation violated task, operation, change, or exact-block identity"
  exit 1
fi

fault_notion='{"pageId":"notion-fault-page","dataSourceId":"notion-race-source","url":"https://www.notion.so/notion-fault-page","lastEditedAt":"2026-07-14T10:00:00Z"}'
fault_preview="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "$auth_sql SELECT result->>'previewDigest',result->>'previewExpiresAt' FROM (SELECT public.flowstate_activate_notion_task_v1('fault-operation','$fault_notion'::jsonb,'$task_json'::jsonb,NULL,true) AS result) AS preview_result;" | tail -n 1)"
IFS='|' read -r fault_digest fault_expiry <<<"$fault_preview"

docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE FUNCTION public.test_force_notion_activation_failure()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.external_id = 'notion-fault-page' THEN
    RAISE EXCEPTION 'injected notion activation failure';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER zz_test_force_notion_activation_failure
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.test_force_notion_activation_failure();
SQL

set +e
docker exec "$container" psql -U postgres -d "$test_db" -qAt -v ON_ERROR_STOP=1 -c \
  "$auth_sql SELECT public.flowstate_activate_notion_task_v1('fault-operation','$fault_notion'::jsonb,'$task_json'::jsonb,NULL,false,'$fault_digest','$fault_expiry'::timestamptz);" \
  >"$tmp_dir/fault-output" 2>&1
fault_status=$?
set -e
if [[ "$fault_status" == "0" ]] || ! grep -q 'injected notion activation failure' "$tmp_dir/fault-output"; then
  echo "FAIL: injected Notion activation fault did not abort apply"
  exit 1
fi

fault_integrity="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "SELECT
    (SELECT count(*) FROM public.tasks WHERE external_id='notion-fault-page'),
    (SELECT count(*) FROM public.canonical_operations WHERE operation_id='fault-operation'),
    (SELECT count(*) FROM public.canonical_change_log WHERE operation_id='fault-operation'),
    (SELECT count(*) FROM public.canonical_operation_previews WHERE operation_id='fault-operation' AND consumed_at IS NOT NULL);" | tail -n 1)"
if [[ "$fault_integrity" != "0|0|0|0" ]]; then
  echo "FAIL: failed apply left partial notion activation state"
  exit 1
fi

echo "PASS: canonical Notion same-operation, different-operation, conflict, and fault races"
