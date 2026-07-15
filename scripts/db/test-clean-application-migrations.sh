#!/usr/bin/env bash
set -euo pipefail

container="${FLOWSTATE_DB_CONTAINER:-supabase_db_flow-state}"
source_db="${FLOWSTATE_SOURCE_DB:-postgres}"
test_db="clean_migrations_${$}_${RANDOM}"
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cleanup() {
  docker exec "$container" dropdb -U postgres --if-exists --force "$test_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker exec "$container" createdb -U postgres --template=template0 "$test_db"

# Supabase owns these platform schemas. Restore definitions only so the test
# starts with no FlowState public schema, rows, or production application state.
docker exec "$container" sh -c \
  "pg_dump -U postgres --schema-only --no-owner --no-privileges \
    --schema=auth --schema=extensions '$source_db' \
    | psql -X -U postgres -d '$test_db' -v ON_ERROR_STOP=1" \
  >/dev/null

docker exec "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 -c \
  'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;' \
  >/dev/null
docker exec "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 -c \
  "ALTER DATABASE \"$test_db\" SET search_path TO '\"\$user\"', public, extensions" \
  >/dev/null

# The application uses only this bounded Storage contract. Recreate the clean
# platform tables instead of dumping source policies that may already contain
# FlowState migrations.
docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text NOT NULL,
  owner uuid
);
CREATE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$ SELECT string_to_array(name, '/') $$;
SQL

# Realtime publications are cluster-level Supabase platform infrastructure and
# are not included by a schema-filtered dump.
docker exec "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 -c \
  'CREATE PUBLICATION supabase_realtime' >/dev/null

mapfile -t migrations < <(
  find "$root_dir/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -print | sort
)
migration_count="${#migrations[@]}"
if [[ "$migration_count" -eq 0 ]]; then
  echo "FAIL: no application migrations found" >&2
  exit 1
fi

applied_count=0
for migration in "${migrations[@]}"; do
  docker exec -i "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 \
    < "$migration" >/dev/null
  applied_count=$((applied_count + 1))
done

if [[ "$applied_count" -ne "$migration_count" ]]; then
  echo "FAIL: applied $applied_count of $migration_count migrations" >&2
  exit 1
fi

docker exec "$container" psql -X -U postgres -d "$test_db" -v ON_ERROR_STOP=1 -qAt -c \
  "SELECT CASE WHEN to_regclass('public.tasks') IS NOT NULL THEN 'ok' ELSE 'missing' END" \
  | grep -qx ok

echo "PASS: clean ordered application migration install ($applied_count migrations)"
