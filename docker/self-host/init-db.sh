#!/bin/bash
set -euo pipefail

# FlowState Database Initializer
# Runs all migrations in order on first boot.
# Skips if the migrations have already been applied (checks for public.tasks table).

PGHOST="${POSTGRES_HOST:-db}"
PGPORT="${POSTGRES_PORT:-5432}"
PGUSER="${POSTGRES_USER:-supabase_admin}"
PGPASSWORD="${POSTGRES_PASSWORD}"
PGDATABASE="${POSTGRES_DB:-postgres}"
MIGRATIONS_DIR="/docker-entrypoint-initdb.d/migrations"

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

# Check if migrations have already been applied
check_already_migrated() {
    local result
    result=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc \
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tasks');" 2>/dev/null || echo "f")
    if [ "$result" = "t" ]; then
        return 0  # Already migrated
    fi
    return 1  # Not yet migrated
}

run_migrations() {
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        log "ERROR: Migrations directory not found: ${MIGRATIONS_DIR}"
        exit 1
    fi

    # Ordered migration files - these must run in sequence
    local migrations=(
        "20260105000000_initial_schema.sql"
        "20260109000000_enable_rls_security.sql"
        "20260111000000_add_position_versions.sql"
        "20260112000000_position_versioning_triggers.sql"
        "fix_id_types.sql"
        "20260120000000_add_groups_deleted_at.sql"
        "20260120000001_create_tombstones.sql"
        "20260120000002_immutable_task_ids.sql"
        "20260124000000_add_task_scheduling_columns.sql"
        "20260126000000_add_done_for_now_column.sql"
        "20260131000000_gamification.sql"
        "20260206163002_challenges.sql"
    )

    local total=${#migrations[@]}
    local count=0

    for migration in "${migrations[@]}"; do
        count=$((count + 1))
        local filepath="${MIGRATIONS_DIR}/${migration}"

        if [ ! -f "$filepath" ]; then
            log "WARNING: Migration file not found, skipping: ${migration}"
            continue
        fi

        log "[${count}/${total}] Running: ${migration}"
        if ! psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
            -v ON_ERROR_STOP=1 -f "$filepath" > /dev/null 2>&1; then
            log "ERROR: Migration failed: ${migration}"
            log "Attempting to show error details..."
            psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
                -v ON_ERROR_STOP=1 -f "$filepath" 2>&1 || true
            exit 1
        fi
        log "[${count}/${total}] OK: ${migration}"
    done

    log "All ${total} migrations applied successfully."
}

# Main
wait_for_db

if check_already_migrated; then
    log "Database already initialized (public.tasks exists). Skipping migrations."
    exit 0
fi

log "First boot detected. Running migrations..."
run_migrations
log "Database initialization complete."
