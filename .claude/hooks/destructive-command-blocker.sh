#!/bin/bash
# DESTRUCTIVE COMMAND BLOCKER
# This hook BLOCKS dangerous database operations that could cause data loss.
# It runs BEFORE any Bash command is executed.
#
# Created: January 9, 2026 after data loss incident (supabase db reset wiped all user data)
#
# PHILOSOPHY: ANY destructive action requires PROOF of backup
#
# BLOCKED COMMANDS (completely forbidden without backup):
# - supabase db reset
# - DROP DATABASE / DROP TABLE / TRUNCATE
# - DELETE FROM without WHERE clause
# - supabase db push --force
#
# REQUIRES RECENT BACKUP (within 1 hour):
# - supabase migration commands
# - supabase db push
# - DROP TABLE (specific)
# - ALTER TABLE DROP COLUMN

# Read the command from stdin (with timeout to prevent freeze in Zellij)
INPUT=$(timeout 2 cat 2>/dev/null || echo '{}')

# Extract the command from JSON input
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# If no command found, allow (not a bash command)
if [ -z "$COMMAND" ]; then
    exit 0
fi

# Convert to lowercase for pattern matching
COMMAND_LOWER=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

# ============================================================================
# BACKUP CHECK FUNCTION
# ============================================================================

check_backup_exists() {
    local BACKUP_DIR="$CLAUDE_PROJECT_DIR/supabase/backups"
    local BACKUP_AGE_MINUTES=${1:-60}  # Default: 1 hour

    # Check if backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        return 1
    fi

    # Check for recent backup file
    local RECENT_BACKUP=$(find "$BACKUP_DIR" -name "*.sql" -mmin -$BACKUP_AGE_MINUTES 2>/dev/null | head -1)

    if [ -n "$RECENT_BACKUP" ]; then
        echo "✓ Recent backup found: $(basename $RECENT_BACKUP)"
        return 0
    else
        return 1
    fi
}

auto_create_backup() {
    local BACKUP_DIR="$CLAUDE_PROJECT_DIR/supabase/backups"
    local TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    local BACKUP_PATH="$BACKUP_DIR/auto-backup-$TIMESTAMP.sql"

    mkdir -p "$BACKUP_DIR"

    echo "Creating automatic backup before migration..."
    echo "  Target: $BACKUP_PATH"

    # Try to create backup
    cd "$CLAUDE_PROJECT_DIR"
    if supabase db dump > "$BACKUP_PATH" 2>/dev/null; then
        if [ -s "$BACKUP_PATH" ]; then
            local SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
            echo "✓ Backup created successfully ($SIZE)"
            return 0
        fi
    fi

    echo "⚠️  Auto-backup failed - will prompt for manual backup"
    rm -f "$BACKUP_PATH"
    return 1
}

require_backup() {
    local ACTION_DESC="$1"
    local AUTO_BACKUP="${2:-true}"  # Auto-create backup by default

    if ! check_backup_exists 60; then
        echo "═══════════════════════════════════════════════════════════════════"
        echo "⚠️  No recent backup found for: $ACTION_DESC"
        echo "═══════════════════════════════════════════════════════════════════"
        echo ""

        # Try to auto-create backup
        if [ "$AUTO_BACKUP" = "true" ]; then
            if auto_create_backup; then
                echo ""
                echo "✓ Automatic backup created - proceeding with operation"
                return 0
            fi
        fi

        # Manual backup instructions if auto-backup failed
        echo "AUTOMATIC BACKUP FAILED - Please create manually:"
        echo ""
        echo "  mkdir -p supabase/backups"
        echo "  supabase db dump > supabase/backups/backup-\$(date +%Y%m%d-%H%M%S).sql"
        echo ""
        echo "Or for specific tables:"
        echo "  supabase db dump --data-only -t tasks > supabase/backups/tasks-\$(date +%Y%m%d-%H%M%S).sql"
        echo ""
        echo "After creating a backup, you can retry this command."
        echo "═══════════════════════════════════════════════════════════════════"
        return 1
    fi
    return 0
}

# ============================================================================
# CATEGORY 1: ABSOLUTELY BLOCKED (no exceptions, even with backup)
# ============================================================================

# Block: supabase stop (causes data loss when followed by supabase start)
if echo "$COMMAND_LOWER" | grep -qE "supabase\s+stop"; then
    echo "═══════════════════════════════════════════════════════════════════"
    echo "🚫 BLOCKED: 'supabase stop'"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "WHY THIS IS BLOCKED:"
    echo "  - 'supabase stop' followed by 'supabase start' RECREATES the database"
    echo "  - This WIPES all users, data, and configurations"
    echo "  - This caused data loss on January 9 AND January 15, 2026"
    echo ""
    echo "IF YOU NEED TO RESTART SUPABASE:"
    echo "  1. Create a backup: supabase db dump > backup.sql"
    echo "  2. User must run 'supabase stop' MANUALLY"
    echo "  3. User must run 'supabase start' MANUALLY"
    echo "  4. Restore backup if needed"
    echo ""
    echo "SAFER ALTERNATIVE:"
    echo "  - Restart specific service: docker restart supabase_db_pomo-flow"
    echo "  - This preserves your data"
    echo "═══════════════════════════════════════════════════════════════════"
    exit 1
fi

# Block: supabase db reset
if echo "$COMMAND_LOWER" | grep -qE "supabase\s+(db\s+)?reset"; then
    echo "═══════════════════════════════════════════════════════════════════"
    echo "🚫 PERMANENTLY BLOCKED: 'supabase db reset'"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "This command is NEVER allowed to run automatically."
    echo ""
    echo "WHAT THIS COMMAND DOES:"
    echo "  - Drops ALL tables, data, users, and configurations"
    echo "  - CANNOT be undone"
    echo "  - Data loss is PERMANENT"
    echo ""
    echo "IF THE USER TRULY NEEDS TO RESET:"
    echo "  1. User must run this command MANUALLY in their terminal"
    echo "  2. User must export a backup first"
    echo "  3. Claude Code cannot and will not run this command"
    echo ""
    echo "ALTERNATIVES:"
    echo "  - To apply migrations: supabase db push"
    echo "  - To fix schema: Create a new migration file"
    echo "  - To remove specific data: DELETE with WHERE clause"
    echo "═══════════════════════════════════════════════════════════════════"
    exit 1
fi

# Block: supabase db push --force (bypasses safety checks)
if echo "$COMMAND_LOWER" | grep -qE "supabase\s+db\s+push.*--force"; then
    echo "═══════════════════════════════════════════════════════════════════"
    echo "🚫 PERMANENTLY BLOCKED: 'supabase db push --force'"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "This flag bypasses safety checks and can cause data loss."
    echo "Use 'supabase db push' without --force instead."
    echo "═══════════════════════════════════════════════════════════════════"
    exit 1
fi

# Block: DROP DATABASE
if echo "$COMMAND_LOWER" | grep -qE "drop\s+database"; then
    echo "═══════════════════════════════════════════════════════════════════"
    echo "🚫 PERMANENTLY BLOCKED: 'DROP DATABASE'"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "This command deletes the ENTIRE database."
    echo "User must run this manually if truly needed."
    echo "═══════════════════════════════════════════════════════════════════"
    exit 1
fi

# Block: TRUNCATE (deletes all rows from table)
if echo "$COMMAND_LOWER" | grep -qE "truncate\s+"; then
    echo "═══════════════════════════════════════════════════════════════════"
    echo "🚫 PERMANENTLY BLOCKED: 'TRUNCATE'"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "TRUNCATE deletes ALL data from a table without logging."
    echo "Use DELETE with WHERE clause to remove specific records."
    echo "═══════════════════════════════════════════════════════════════════"
    exit 1
fi

# Block: DELETE FROM without WHERE (deletes all rows)
if echo "$COMMAND_LOWER" | grep -qE "delete\s+from\s+[a-z_]+" && ! echo "$COMMAND_LOWER" | grep -qE "where"; then
    echo "═══════════════════════════════════════════════════════════════════"
    echo "🚫 BLOCKED: 'DELETE FROM' without WHERE clause"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "This would delete ALL rows from the table."
    echo "Add a WHERE clause to specify which rows to delete."
    echo ""
    echo "Example: DELETE FROM tasks WHERE is_deleted = true;"
    echo "═══════════════════════════════════════════════════════════════════"
    exit 1
fi

# ============================================================================
# CATEGORY 2: REQUIRES BACKUP (blocked if no recent backup)
# ============================================================================

# Migrations require backup
if echo "$COMMAND_LOWER" | grep -qE "supabase\s+(db\s+)?push|supabase\s+migration.*up"; then
    if ! require_backup "Database migration"; then
        exit 1
    fi
fi

# DROP TABLE requires backup
if echo "$COMMAND_LOWER" | grep -qE "drop\s+table"; then
    if ! require_backup "DROP TABLE"; then
        exit 1
    fi
    echo "⚠️  WARNING: DROP TABLE will permanently delete table and all its data!"
fi

# ALTER TABLE DROP COLUMN requires backup
if echo "$COMMAND_LOWER" | grep -qE "alter\s+table.*drop\s+column"; then
    if ! require_backup "DROP COLUMN"; then
        exit 1
    fi
    echo "⚠️  WARNING: DROP COLUMN will permanently delete column data!"
fi

# DELETE with WHERE (allowed but warned, backup recommended)
if echo "$COMMAND_LOWER" | grep -qE "delete\s+from.*where"; then
    if ! check_backup_exists 60; then
        echo "⚠️  WARNING: DELETE operation without recent backup."
        echo "   Consider creating a backup first for safety."
    fi
fi

# ============================================================================
# ALL CHECKS PASSED
# ============================================================================

exit 0
