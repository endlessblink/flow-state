#!/bin/bash
set -euo pipefail

# FlowState Migration Runner
# Runs AFTER GoTrue has created auth schema, users table, and auth functions.
# Called by the 'migrate' Docker service.

PGHOST="${POSTGRES_HOST:-db}"
PGPORT="5432"
PGUSER="${POSTGRES_USER:-supabase_admin}"
PGPASSWORD="${POSTGRES_PASSWORD}"
PGDATABASE="${POSTGRES_DB:-postgres}"
MIGRATIONS_DIR="/migrations"

export PGPASSWORD

log() { echo "[migrate] $(date '+%Y-%m-%d %H:%M:%S') $1"; }

# Wait for GoTrue auth service to be ready (creates auth.users)
wait_for_auth() {
    local retries=60
    local count=0
    log "Waiting for auth service at ${AUTH_URL:-http://auth:9999}/health..."
    until curl -sf "${AUTH_URL:-http://auth:9999}/health" > /dev/null 2>&1; do
        count=$((count + 1))
        if [ $count -ge $retries ]; then
            log "ERROR: Auth service not ready after ${retries} attempts."
            exit 1
        fi
        sleep 2
    done
    log "Auth service is ready."
}

# Check if migrations already applied
check_already_migrated() {
    local result
    result=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc \
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tasks');" 2>/dev/null || echo "f")
    [ "$result" = "t" ]
}

run_migrations() {
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        log "ERROR: Migrations directory not found: ${MIGRATIONS_DIR}"
        exit 1
    fi

    local migrations=(
        "20260105000000_initial_schema.sql"
        "20260106000000_fix_id_types.sql"
        "20260109000000_enable_rls_security.sql"
        "20260111000000_add_position_versions.sql"
        "20260112000000_position_versioning_triggers.sql"
        "20260120000000_add_groups_deleted_at.sql"
        "20260120000001_create_tombstones.sql"
        "20260120000002_immutable_task_ids.sql"
        "20260124000000_add_task_scheduling_columns.sql"
        "20260126000000_add_done_for_now_column.sql"
        "20260131000000_gamification.sql"
        "20260206163002_challenges.sql"
        "20260208151150_quick_tasks.sql"
        "20260212000000_arena.sql"
        "20260214000000_create_ai_work_profiles.sql"
        "20260214100000_add_memory_graph_to_ai_work_profiles.sql"
        "20260217000000_push_subscriptions.sql"
        "20260218000000_ai_sync.sql"
        "20260219000000_task_reminders.sql"
        "20260221000000_add_personal_context_to_work_profiles.sql"
        "20260222000001_recurrence_rule.sql"
        "20260223000000_add_task_attachments.sql"
        "20260304000000_tombstone_rls_update_policy.sql"
        "20260305000000_add_whatsapp_conversations.sql"
        "20260307155641_bug_1477_tombstone_cleanup_trigger.sql"
        "20260308_add_is_pinned_to_tasks.sql"
        "20260313210000_atomic_timer_leadership.sql"
        "20260314120000_recurrence_dedup_constraint.sql"
        "20260315130000_add_is_completion_record_to_tasks.sql"
        "20260317000000_workspace_collaboration.sql"
        "20260322100000_canvas_images_bucket.sql"
        "20260327120000_drop_tasks_parent_id_fkey.sql"
        "20260329120000_task_audit_log.sql"
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
            psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
                -v ON_ERROR_STOP=1 -f "$filepath" 2>&1 || true
            exit 1
        fi
        log "[${count}/${total}] OK: ${migration}"
    done

    log "All ${total} migrations applied successfully."
}

# Existing self-hosted databases were initialized before the migration runner
# learned about the atomic backup/restore schema. Keep this late migration
# idempotent and run it on every already-initialized database so a restart can
# repair schema drift instead of silently skipping it.
run_post_init_migrations() {
    local migration="20260724030000_atomic_backup_restore.sql"
    local filepath="${MIGRATIONS_DIR}/${migration}"

    if [ ! -f "$filepath" ]; then
        log "WARNING: Post-init migration file not found, skipping: ${migration}"
        return
    fi

    log "Running post-init migration: ${migration}"
    psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
        -v ON_ERROR_STOP=1 -f "$filepath" > /dev/null
    log "Post-init migration OK: ${migration}"
}

# Main
wait_for_auth

if check_already_migrated; then
    log "Database already initialized (public.tasks exists). Applying post-init migrations."
    run_post_init_migrations
    exit 0
fi

log "First boot: running FlowState migrations..."
run_migrations
log "Migration complete."
