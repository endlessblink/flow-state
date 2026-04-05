#!/bin/bash
set -euo pipefail

# FlowState Database Initializer
# Runs during DB container init (docker-entrypoint-initdb.d).
# Creates roles, schemas, extensions, auth seed tables, and realtime publication.
# Based on the official Supabase self-hosted Postgres bootstrap.
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
    log "Creating required Supabase service roles, schemas, and auth seed tables..."
    psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" <<SQL
-- ==========================================================================
-- A. Extensions and schemas
-- ==========================================================================
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS _realtime;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
DO \$ext\$ BEGIN CREATE EXTENSION IF NOT EXISTS pgjwt SCHEMA extensions; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pgjwt not available'; END \$ext\$;

-- Make extensions available in search path
ALTER DATABASE postgres SET search_path TO public, extensions;

-- ==========================================================================
-- B. API roles (PostgREST model) — idempotent
-- ==========================================================================
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_realtime_admin') THEN
    CREATE ROLE supabase_realtime_admin LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END
\$\$;

-- ==========================================================================
-- C. Role grants
-- ==========================================================================
GRANT anon, authenticated, service_role, supabase_admin TO authenticator;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, supabase_auth_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

GRANT CREATE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;

ALTER SCHEMA auth OWNER TO supabase_auth_admin;
ALTER SCHEMA _realtime OWNER TO supabase_realtime_admin;
ALTER SCHEMA storage OWNER TO supabase_storage_admin;

ALTER USER supabase_auth_admin SET search_path = 'auth';

ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON FUNCTIONS TO supabase_auth_admin;

-- ==========================================================================
-- D. Auth seed schema (CRITICAL — GoTrue expects these tables + migration entries)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS auth.users (
    instance_id uuid,
    id uuid NOT NULL UNIQUE,
    aud varchar(255),
    "role" varchar(255),
    email varchar(255) UNIQUE,
    encrypted_password varchar(255),
    confirmed_at timestamptz,
    invited_at timestamptz,
    confirmation_token varchar(255),
    confirmation_sent_at timestamptz,
    recovery_token varchar(255),
    recovery_sent_at timestamptz,
    email_change_token varchar(255),
    email_change varchar(255),
    email_change_sent_at timestamptz,
    last_sign_in_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin bool,
    created_at timestamptz,
    updated_at timestamptz,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);
ALTER TABLE auth.users OWNER TO supabase_auth_admin;

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    instance_id uuid,
    id bigserial NOT NULL,
    token varchar(255),
    user_id varchar(255),
    revoked bool,
    created_at timestamptz,
    updated_at timestamptz,
    CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id)
);
ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

CREATE TABLE IF NOT EXISTS auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamptz,
    updated_at timestamptz,
    CONSTRAINT instances_pkey PRIMARY KEY (id)
);
ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

CREATE TABLE IF NOT EXISTS auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamptz,
    CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id)
);
ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    "version" varchar(255) NOT NULL,
    CONSTRAINT schema_migrations_pkey PRIMARY KEY ("version")
);
ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

-- Seed migration versions so GoTrue knows which migrations are already applied.
-- Without these, GoTrue tries to create tables that already exist and fails on ALTER TYPE.
INSERT INTO auth.schema_migrations (version) VALUES
    ('20171026211738'),('20171026211808'),('20171026211834'),
    ('20180103212743'),('20180108183307'),('20180119214651'),('20180125194653')
ON CONFLICT DO NOTHING;

-- ==========================================================================
-- E. Auth helper functions (used by RLS policies)
-- ==========================================================================
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS \$\$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
\$\$ LANGUAGE sql STABLE;
ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS \$\$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '')::text;
\$\$ LANGUAGE sql STABLE;
ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text AS \$\$
  SELECT nullif(current_setting('request.jwt.claim.email', true), '')::text;
\$\$ LANGUAGE sql STABLE;
ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

-- ==========================================================================
-- F. Realtime publication
-- ==========================================================================
CREATE PUBLICATION IF NOT EXISTS supabase_realtime;

-- ==========================================================================
-- G. JWT config GUCs
-- ==========================================================================
ALTER DATABASE postgres SET "app.settings.jwt_secret" TO '${JWT_SECRET}';
ALTER DATABASE postgres SET "app.settings.jwt_exp" TO '3600';
SQL
    log "Roles, schemas, and auth seed tables created successfully."
}

# Main
wait_for_db
create_roles
log "Database pre-init complete. FlowState migrations will run after GoTrue starts (see 'migrate' service)."
