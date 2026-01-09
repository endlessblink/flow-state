#!/bin/bash
# =============================================================================
# VPS BACKUP CRON SETUP
# =============================================================================
# Sets up automatic database backups on VPS deployment.
#
# Usage:
#   ./scripts/deploy/setup-backup-cron.sh
#
# This script will:
# 1. Create the cron job for automatic backups
# 2. Set up log rotation
# 3. Configure backup retention
#
# Prerequisites:
# - SUPABASE_DB_URL environment variable set
# - PostgreSQL client (pg_dump) installed
#
# Created: January 9, 2026 (TASK-168)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
BACKUP_SCRIPT="$PROJECT_DIR/scripts/backup-db.sh"
BACKUP_DIR="$PROJECT_DIR/supabase/backups"
LOG_FILE="$PROJECT_DIR/logs/backup.log"

echo "=============================================="
echo "VPS BACKUP CRON SETUP"
echo "=============================================="
echo ""
echo "Project directory: $PROJECT_DIR"
echo "Backup script: $BACKUP_SCRIPT"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Check prerequisites
if [ -z "$SUPABASE_DB_URL" ]; then
    echo "WARNING: SUPABASE_DB_URL not set"
    echo "For VPS mode, you need to set this environment variable."
    echo ""
    echo "Add to your ~/.bashrc or /etc/environment:"
    echo "  export SUPABASE_DB_URL='postgresql://user:pass@host:5432/postgres'"
    echo ""
fi

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo "WARNING: pg_dump not found"
    echo "Install PostgreSQL client:"
    echo "  apt-get install postgresql-client"
    echo ""
fi

# Create directories
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# Create the cron job entry
CRON_ENTRY="# Pomo-Flow Database Backup (every 6 hours)
0 */6 * * * cd $PROJECT_DIR && BACKUP_ROTATE=28 $BACKUP_SCRIPT >> $LOG_FILE 2>&1

# Pomo-Flow Full Backup (daily at 2 AM)
0 2 * * * cd $PROJECT_DIR && BACKUP_ROTATE=14 $BACKUP_SCRIPT >> $LOG_FILE 2>&1
"

echo "Proposed cron entries:"
echo "----------------------------------------------"
echo "$CRON_ENTRY"
echo "----------------------------------------------"
echo ""

# Ask user to confirm
read -p "Install these cron jobs? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Add to crontab
    (crontab -l 2>/dev/null | grep -v "Pomo-Flow"; echo "$CRON_ENTRY") | crontab -

    echo ""
    echo "✓ Cron jobs installed"
    echo ""
    echo "Current crontab:"
    crontab -l | grep -A1 "Pomo-Flow" || echo "(no Pomo-Flow entries found)"
else
    echo ""
    echo "Skipped. To install manually:"
    echo "  crontab -e"
    echo ""
    echo "Add these lines:"
    echo "$CRON_ENTRY"
fi

echo ""
echo "=============================================="
echo "BACKUP CONFIGURATION"
echo "=============================================="
echo ""
echo "Backup schedule:"
echo "  - Every 6 hours: Incremental backup (keeps 28 copies = 7 days)"
echo "  - Daily at 2 AM: Full backup (keeps 14 copies = 2 weeks)"
echo ""
echo "Log file: $LOG_FILE"
echo ""
echo "Manual commands:"
echo "  npm run db:backup          # Full backup"
echo "  npm run db:backup:data     # Data only"
echo "  npm run db:backup:tasks    # Tasks and groups only"
echo ""
echo "=============================================="
