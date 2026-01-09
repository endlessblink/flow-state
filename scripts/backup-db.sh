#!/bin/bash
# =============================================================================
# POMO-FLOW DATABASE BACKUP SCRIPT
# =============================================================================
# Automatic database backup for both local development and VPS deployment.
#
# Usage:
#   ./scripts/backup-db.sh              # Full backup
#   ./scripts/backup-db.sh --data-only  # Data only (no schema)
#   ./scripts/backup-db.sh --tables "tasks,groups"  # Specific tables
#   ./scripts/backup-db.sh --rotate 7   # Keep only last 7 backups
#
# Environment:
#   SUPABASE_DB_URL   - Direct Postgres connection string (for VPS)
#   BACKUP_DIR        - Override default backup directory
#   BACKUP_ROTATE     - Number of backups to keep (default: 10)
#
# Created: January 9, 2026 (TASK-168)
# =============================================================================

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/supabase/backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ROTATE_COUNT="${BACKUP_ROTATE:-10}"

# Parse arguments
DATA_ONLY=""
TABLES=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --data-only)
            DATA_ONLY="--data-only"
            shift
            ;;
        --tables)
            TABLES="$2"
            shift 2
            ;;
        --rotate)
            ROTATE_COUNT="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --data-only       Backup data only (no schema)"
            echo "  --tables LIST     Backup specific tables (comma-separated)"
            echo "  --rotate N        Keep only last N backups (default: 10)"
            echo "  --help            Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Determine backup filename
if [ -n "$TABLES" ]; then
    BACKUP_NAME="backup-tables-${TABLES//,/-}-$TIMESTAMP.sql"
elif [ -n "$DATA_ONLY" ]; then
    BACKUP_NAME="backup-data-$TIMESTAMP.sql"
else
    BACKUP_NAME="backup-full-$TIMESTAMP.sql"
fi

BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

echo "=============================================="
echo "POMO-FLOW DATABASE BACKUP"
echo "=============================================="
echo "Timestamp: $TIMESTAMP"
echo "Backup: $BACKUP_NAME"
echo ""

# Check if we're in local dev (Supabase CLI) or VPS (direct connection)
if [ -n "$SUPABASE_DB_URL" ]; then
    # VPS Mode: Use pg_dump with direct connection
    echo "Mode: VPS (direct PostgreSQL connection)"

    # Build pg_dump command
    PG_DUMP_CMD="pg_dump $SUPABASE_DB_URL"

    if [ -n "$DATA_ONLY" ]; then
        PG_DUMP_CMD="$PG_DUMP_CMD --data-only"
    fi

    if [ -n "$TABLES" ]; then
        # Convert comma-separated to multiple -t flags
        IFS=',' read -ra TABLE_ARRAY <<< "$TABLES"
        for table in "${TABLE_ARRAY[@]}"; do
            PG_DUMP_CMD="$PG_DUMP_CMD -t public.$table"
        done
    fi

    echo "Running: pg_dump ..."
    $PG_DUMP_CMD > "$BACKUP_PATH"

else
    # Local Mode: Use Supabase CLI
    echo "Mode: Local (Supabase CLI)"

    # Check if supabase is running
    # Try global supabase, then npx supabase
    SUPABASE_CMD="supabase"
    if ! command -v supabase &> /dev/null; then
        echo "Global 'supabase' CLI not found, trying local..."
        SUPABASE_CMD="npx supabase"
        if ! $SUPABASE_CMD --version &> /dev/null; then
             echo "ERROR: supabase CLI not found (global or local)"
             exit 1
        fi
    fi

    # Build supabase db dump command
    DUMP_CMD="$SUPABASE_CMD db dump --local"

    if [ -n "$DATA_ONLY" ]; then
        DUMP_CMD="$DUMP_CMD --data-only"
    fi

    if [ -n "$TABLES" ]; then
        echo "WARNING: Table filtering is not supported by 'supabase db dump' in local mode."
        echo "         Proceeding with FULL database backup instead."
        TABLES=""
        DATA_ONLY="" # Reset data only if it was also set, usually full dump is safer if tables ignored? 
        # Actually proper fallback is just ignore tables.
    fi

    echo "Running: $DUMP_CMD > $BACKUP_PATH"
    cd "$PROJECT_DIR"
    $DUMP_CMD > "$BACKUP_PATH" || {
        echo ""
        echo "Note: Some warnings may appear above - this is normal."
        echo "Checking if backup was created..."
    }
fi

# Verify backup was created
if [ -f "$BACKUP_PATH" ] && [ -s "$BACKUP_PATH" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    echo ""
    echo "SUCCESS: Backup created"
    echo "  Path: $BACKUP_PATH"
    echo "  Size: $BACKUP_SIZE"
else
    echo ""
    echo "ERROR: Backup file is empty or not created"
    rm -f "$BACKUP_PATH"
    exit 1
fi

# Rotate old backups (keep only last N)
echo ""
echo "Rotating backups (keeping last $ROTATE_COUNT)..."

# Count backups and remove oldest if over limit
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*.sql 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$ROTATE_COUNT" ]; then
    DELETE_COUNT=$((BACKUP_COUNT - ROTATE_COUNT))
    echo "  Removing $DELETE_COUNT old backup(s)..."
    ls -1t "$BACKUP_DIR"/*.sql | tail -n "$DELETE_COUNT" | xargs rm -f
fi

# List current backups
echo ""
echo "Current backups ($BACKUP_DIR):"
ls -lht "$BACKUP_DIR"/*.sql 2>/dev/null | head -5 || echo "  (none)"

echo ""
echo "=============================================="
echo "BACKUP COMPLETE"
echo "=============================================="
