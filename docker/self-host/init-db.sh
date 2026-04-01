#!/bin/bash
set -euo pipefail

# FlowState Database Initializer
# Runs during DB container init (docker-entrypoint-initdb.d).
# Only creates roles, schemas, extensions, and the realtime publication.
# FlowState migrations run AFTER GoTrue starts (see 'migrate' service in docker-compose.self-host.yml).

# When running as docker-entrypoint-initdb.d script, connect via Unix socket
PGHOST="${POSTGRES_HOST:-/var/run/postgresql}"
PGPORT="${POSTGRES_PORT:-5432}"
PGUSER="${POSTGRES_USER:-supabase_admin}"
PGPASSWORD="${POSTGRES_PASSWORD}"
PGDATABASE="${POSTGRES_DB:-postgres}"

export PGPASSWORD

log() {
    echo "[init-db] $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# Wait for PostgreSQL to be ready
wait_for_db() {
    local retries=30
    local count=0
    log "Waiting for PostgreSQL at ${PGHOST}:${PGPORT}..."
    until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" > /dev/null 2>&1; do
        count=$((count + 1))
        if [ $count -ge $retries ]; then
            log "ERROR: PostgreSQL not ready after ${retries} attempts. Exiting."
            exit 1
        fi
        sleep 2
    done
    log "PostgreSQL is ready."
}

create_roles() {
    log "Creating required Supabase service roles and schemas..."
    psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" <<SQL
-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS _realtime;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

-- Enable extensions (pgjwt may not be bundled in all images — GoTrue handles JWT internally)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;
DO \$ext\$ BEGIN CREATE EXTENSION IF NOT EXISTS "pgjwt" SCHEMA extensions; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pgjwt not available, skipping'; END \$ext\$;

-- Make extensions available in search path
ALTER DATABASE postgres SET search_path TO public, extensions;

-- Create roles (idempotent)
DO \$\$
BEGIN
  -- Auth admin
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN PASSWORD '${POSTGRES_PASSWORD}' CREATEROLE;
  ELSE
    ALTER ROLE supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
  END IF;

  -- Authenticator (PostgREST entry point)
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN PASSWORD '${POSTGRES_PASSWORD}' NOINHERIT;
  ELSE
    ALTER ROLE authenticator WITH PASSWORD '${POSTGRES_PASSWORD}';
  END IF;

  -- anon
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;

  -- authenticated
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;

  -- service_role
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;

  -- Storage admin
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;

  -- Realtime admin
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    CREATE ROLE supabase_realtime_admin LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END
\$\$;

-- Grants
GRANT anon, authenticated, service_role TO authenticator;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role, supabase_auth_admin;
ALTER SCHEMA _realtime OWNER TO supabase_realtime_admin;
ALTER SCHEMA storage OWNER TO supabase_storage_admin;

-- supabase_auth_admin needs CREATE on public for schema_migrations table
GRANT CREATE ON SCHEMA public TO supabase_auth_admin;

-- Create Realtime publication so migrations can add tables to it
CREATE PUBLICATION IF NOT EXISTS supabase_realtime;

-- Allow auth admin to manage auth schema tables
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON FUNCTIONS TO supabase_auth_admin;

-- Pre-create auth enum types that GoTrue migrations expect.
-- GoTrue's init migration creates tables but not enums; later migrations
-- reference these types and fail if they don't exist.
DO \$\$
BEGIN
  CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
EXCEPTION WHEN duplicate_object THEN NULL;
END \$\$;

DO \$\$
BEGIN
  CREATE TYPE auth.code_challenge_method AS ENUM ('s256', 'plain');
EXCEPTION WHEN duplicate_object THEN NULL;
END \$\$;

DO \$\$
BEGIN
  CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
EXCEPTION WHEN duplicate_object THEN NULL;
END \$\$;

DO \$\$
BEGIN
  CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn');
EXCEPTION WHEN duplicate_object THEN NULL;
END \$\$;

DO \$\$
BEGIN
  CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token', 'reauthentication_token', 'recovery_token',
    'email_change_token_new', 'email_change_token_current', 'phone_change_token'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END \$\$;

-- Transfer ownership of auth types to supabase_auth_admin so GoTrue can ALTER them
ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;
ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;
ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;
ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;
ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;
SQL
    log "Roles and schemas created successfully."
}

# Main
wait_for_db
create_roles
log "Database pre-init complete. FlowState migrations will run after GoTrue starts (see 'migrate' service)."
