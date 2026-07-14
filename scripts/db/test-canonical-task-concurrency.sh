#!/usr/bin/env bash
set -euo pipefail

container="${FLOWSTATE_DB_CONTAINER:-supabase_db_flow-state}"
source_db="${FLOWSTATE_SOURCE_DB:-postgres}"
test_db="canonical_contract_${$}_${RANDOM}"
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
migration="$root_dir/supabase/migrations/20260713012000_canonical_task_contract.sql"
tmp_dir="$(mktemp -d)"

cleanup() {
  docker exec "$container" dropdb -U postgres --if-exists --force "$test_db" >/dev/null 2>&1 || true
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

docker exec "$container" createdb -U postgres "$test_db"
docker exec "$container" sh -c \
  "pg_dump -U postgres --schema-only --no-owner --no-privileges '$source_db' | sed '/log_min_messages/d' | psql -U postgres -v ON_ERROR_STOP=1 '$test_db'" \
  >/dev/null
docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
  < "$migration" >/dev/null

docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES (
  'ca120000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'canonical-concurrency@test.flowstate', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated', '', ''
);

INSERT INTO public.tasks (
  id, user_id, title, status, is_deleted, instances, subtasks, is_in_inbox
) VALUES (
  'canonical-concurrent', 'ca120000-0000-4000-8000-000000000001',
  'Concurrent base', 'planned', false, '[]', '[]', true
);
SQL

auth_sql="SELECT set_config('request.jwt.claim.sub','ca120000-0000-4000-8000-000000000001',false); SELECT set_config('request.jwt.claims','{\"sub\":\"ca120000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}',false);"

preview() {
  local operation_id="$1"
  local title="$2"
  docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
    "$auth_sql SELECT result->>'previewDigest', result->>'previewExpiresAt', result->>'baseRevision' FROM (SELECT public.flowstate_patch_task_v1('$operation_id','task-v1','concurrency-test','canonical-concurrent',(SELECT canonical_revision FROM public.tasks WHERE id='canonical-concurrent'),jsonb_build_object('title','$title'),true) AS result) AS preview_result;" \
    | tail -n 1
}

preview_sql() {
  local operation_id="$1"
  local title="$2"
  printf "%s SELECT result->>'result', result->>'previewDigest', result->>'previewExpiresAt', result->>'baseRevision' FROM (SELECT public.flowstate_patch_task_v1('%s','task-v1','concurrency-test','canonical-concurrent',(SELECT canonical_revision FROM public.tasks WHERE id='canonical-concurrent'),jsonb_build_object('title','%s'),true) AS result) AS preview_result;" \
    "$auth_sql" "$operation_id" "$title"
}

apply_sql() {
  local operation_id="$1"
  local title="$2"
  local digest="$3"
  local expires_at="$4"
  local base_revision="$5"
  printf "%s SELECT result->>'result', COALESCE(result#>>'{receipt,replayed}',''), COALESCE(result#>>'{error,code}','') FROM (SELECT public.flowstate_patch_task_v1('%s','task-v1','concurrency-test','canonical-concurrent',%s,jsonb_build_object('title','%s'),false,'%s','%s'::timestamptz) AS result) AS apply_result;" \
    "$auth_sql" "$operation_id" "$base_revision" "$title" "$digest" "$expires_at"
}

run_pair() {
  local sql_a="$1"
  local sql_b="$2"
  local prefix="$3"

  docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c "$sql_a" \
    > "$tmp_dir/${prefix}-a" &
  local pid_a=$!
  docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c "$sql_b" \
    > "$tmp_dir/${prefix}-b" &
  local pid_b=$!
  wait "$pid_a"
  wait "$pid_b"
  tail -n 1 "$tmp_dir/${prefix}-a"
  tail -n 1 "$tmp_dir/${prefix}-b"
}

preview_race_results="$(run_pair \
  "$(preview_sql 'same-operation' 'Same operation result')" \
  "$(preview_sql 'same-operation' 'Same operation result')" \
  preview)"
if [[ "$(sort -u <<<"$preview_race_results" | grep -c .)" != "1" ]]; then
  echo "FAIL: concurrent identical previews returned different approvals" >&2
  exit 1
fi
IFS='|' read -r preview_result digest expires_at base_revision <<<"$(head -n 1 <<<"$preview_race_results")"
if [[ "$preview_result" != "preview" ]]; then
  echo "FAIL: concurrent identical preview did not succeed" >&2
  exit 1
fi
same_results="$(run_pair \
  "$(apply_sql 'same-operation' 'Same operation result' "$digest" "$expires_at" "$base_revision")" \
  "$(apply_sql 'same-operation' 'Same operation result' "$digest" "$expires_at" "$base_revision")" \
  same)"
grep -qx 'committed|false|' <<<"$same_results"
grep -qx 'committed|true|' <<<"$same_results"

IFS='|' read -r digest expires_at base_revision <<<"$(preview 'different-payload-operation' 'Approved payload')"
different_results="$(run_pair \
  "$(apply_sql 'different-payload-operation' 'Approved payload' "$digest" "$expires_at" "$base_revision")" \
  "$(apply_sql 'different-payload-operation' 'Unapproved payload' "$digest" "$expires_at" "$base_revision")" \
  different)"
grep -qx 'committed|false|' <<<"$different_results"
grep -Eq '^conflict\|\|(preview_mismatch|idempotency_conflict)$' <<<"$different_results"

IFS='|' read -r digest_a expires_a base_a <<<"$(preview 'different-operation-a' 'Different operation A')"
IFS='|' read -r digest_b expires_b base_b <<<"$(preview 'different-operation-b' 'Different operation B')"
different_operation_results="$(run_pair \
  "$(apply_sql 'different-operation-a' 'Different operation A' "$digest_a" "$expires_a" "$base_a")" \
  "$(apply_sql 'different-operation-b' 'Different operation B' "$digest_b" "$expires_b" "$base_b")" \
  operations)"
grep -qx 'committed|false|' <<<"$different_operation_results"
grep -qx 'conflict||stale_revision' <<<"$different_operation_results"

final_state="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "SELECT canonical_revision, (SELECT count(*) FROM public.canonical_operations WHERE state='committed'), (SELECT count(*) FROM public.canonical_change_log WHERE operation_id IS NOT NULL) FROM public.tasks WHERE id='canonical-concurrent';")"

if [[ "$final_state" != "4|3|3" ]]; then
  echo "FAIL: concurrent canonical state was $final_state, expected 4|3|3" >&2
  exit 1
fi

echo "PASS: canonical preview issuance, same-operation replay, different-payload refusal, and stale-base races"
