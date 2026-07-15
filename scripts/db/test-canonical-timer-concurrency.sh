#!/usr/bin/env bash
set -euo pipefail

container="${FLOWSTATE_DB_CONTAINER:-supabase_db_flow-state}"
test_db="${FLOWSTATE_TEST_DB:?FLOWSTATE_TEST_DB must name a disposable database}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO auth.users (
  id,instance_id,email,encrypted_password,email_confirmed_at,created_at,updated_at,
  raw_app_meta_data,raw_user_meta_data,aud,role,confirmation_token,recovery_token
) VALUES (
  'ca150000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'canonical-timer-race@test.flowstate','',now(),now(),now(),'{}','{}',
  'authenticated','authenticated','',''
);
SQL

auth_sql="SELECT set_config('request.jwt.claim.sub','ca150000-0000-4000-8000-000000000001',false); SELECT set_config('request.jwt.claims','{\"sub\":\"ca150000-0000-4000-8000-000000000001\",\"role\":\"authenticated\"}',false);"

preview() {
  local operation_id="$1" session_id="$2"
  docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
    "$auth_sql SELECT result->>'previewDigest',result->>'previewExpiresAt',result->>'requestHash' FROM (SELECT public.flowstate_timer_command_v1('$operation_id','timer-v1','web-pwa','start','$session_id',0,'same-device',NULL,'general','2026-07-16T10:00:00Z',1500,false,true,NULL,NULL,NULL) AS result) AS p;" \
    | tail -n 1
}

apply_sql() {
  local operation_id="$1" session_id="$2" digest="$3" expiry="$4" request_hash="$5"
  printf "%s SELECT result->>'result',COALESCE(result#>>'{error,code}','') FROM (SELECT public.flowstate_timer_command_v1('%s','timer-v1','web-pwa','start','%s',0,'same-device',NULL,'general','2026-07-16T10:00:00Z',1500,false,false,'%s','%s'::timestamptz,'%s') AS result) AS a;" \
    "$auth_sql" "$operation_id" "$session_id" "$digest" "$expiry" "$request_hash"
}

session_a='ca150000-0000-4000-8000-000000000101'
session_b='ca150000-0000-4000-8000-000000000102'
IFS='|' read -r digest_a expiry_a hash_a <<<"$(preview 'timer-race-a' "$session_a")"
IFS='|' read -r digest_b expiry_b hash_b <<<"$(preview 'timer-race-b' "$session_b")"

docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "$(apply_sql 'timer-race-a' "$session_a" "$digest_a" "$expiry_a" "$hash_a")" >"$tmp_dir/a" &
pid_a=$!
docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "$(apply_sql 'timer-race-b' "$session_b" "$digest_b" "$expiry_b" "$hash_b")" >"$tmp_dir/b" &
pid_b=$!
wait "$pid_a"
wait "$pid_b"

grep -qx 'committed|' "$tmp_dir/a"
grep -qx 'committed|' "$tmp_dir/b"
state="$(docker exec "$container" psql -U postgres -d "$test_db" -qAt -F '|' -v ON_ERROR_STOP=1 -c \
  "SELECT count(*) FILTER (WHERE is_active),count(*),(SELECT count(*) FROM public.canonical_operations WHERE user_id='ca150000-0000-4000-8000-000000000001' AND state='committed') FROM public.timer_sessions WHERE user_id='ca150000-0000-4000-8000-000000000001';")"
if [[ "$state" != '1|2|2' ]]; then
  echo "FAIL: distinct concurrent starts were not serialized: $state" >&2
  exit 1
fi
echo 'PASS: distinct concurrent timer starts serialize to one active canonical session'
