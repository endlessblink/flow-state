#!/bin/bash
# FlowState VPS Supabase Backup Script
# Deploy to: /home/deploy/scripts/supabase-backup.sh
# Cron: 0 3 * * * /home/deploy/scripts/supabase-backup.sh >> /var/log/supabase-backup.log 2>&1

set -e

BACKUP_DIR="/var/backups/supabase"
DATE=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

echo "$LOG_PREFIX Starting FlowState Supabase backup..."

# Ensure backup directories exist
mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly" "${BACKUP_DIR}/monthly"

# Find Supabase Postgres container
POSTGRES_CONTAINER=$(docker ps --filter "name=supabase.*db\|supabase_db\|postgres" --format "{{.Names}}" | grep -E "supabase|postgres" | head -1)

if [ -z "$POSTGRES_CONTAINER" ]; then
    echo "$LOG_PREFIX ERROR: Supabase Postgres container not found"
    echo "$LOG_PREFIX Available containers:"
    docker ps --format "{{.Names}}"
    exit 1
fi

echo "$LOG_PREFIX Found Postgres container: $POSTGRES_CONTAINER"

# Create backup filename
BACKUP_FILE="flowstate_${DATE}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/daily/${BACKUP_FILE}"

# Create backup using pg_dump
echo "$LOG_PREFIX Creating backup: $BACKUP_FILE"
docker exec "$POSTGRES_CONTAINER" pg_dump -U postgres -d postgres \
    --no-owner --no-acl \
    --exclude-table-data='auth.audit_log_entries' \
    --exclude-table-data='auth.refresh_tokens' \
    | gzip > "$BACKUP_PATH"

# Verify backup was created and has content
BACKUP_SIZE=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null)
if [ "$BACKUP_SIZE" -lt 1000 ]; then
    echo "$LOG_PREFIX ERROR: Backup file is suspiciously small: $BACKUP_SIZE bytes"
    exit 1
fi

echo "$LOG_PREFIX Daily backup created: $BACKUP_FILE ($BACKUP_SIZE bytes)"

# Create latest symlink
ln -sf "$BACKUP_PATH" "${BACKUP_DIR}/daily/latest.sql.gz"

# Cleanup: Keep only last 7 daily backups
echo "$LOG_PREFIX Cleaning up old daily backups..."
find "${BACKUP_DIR}/daily" -name "flowstate_*.sql.gz" -type f -mtime +7 -delete

# Weekly backup (Sunday)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    cp "$BACKUP_PATH" "${BACKUP_DIR}/weekly/"
    ln -sf "${BACKUP_DIR}/weekly/${BACKUP_FILE}" "${BACKUP_DIR}/weekly/latest.sql.gz"
    echo "$LOG_PREFIX Weekly backup created"
    # Keep only last 4 weekly backups
    find "${BACKUP_DIR}/weekly" -name "flowstate_*.sql.gz" -type f -mtime +28 -delete
fi

# Monthly backup (1st of month)
if [ "$DAY_OF_MONTH" -eq "01" ]; then
    cp "$BACKUP_PATH" "${BACKUP_DIR}/monthly/"
    ln -sf "${BACKUP_DIR}/monthly/${BACKUP_FILE}" "${BACKUP_DIR}/monthly/latest.sql.gz"
    echo "$LOG_PREFIX Monthly backup created"
    # Keep only last 12 monthly backups
    find "${BACKUP_DIR}/monthly" -name "flowstate_*.sql.gz" -type f -mtime +365 -delete
fi

# Show backup summary
echo "$LOG_PREFIX Backup summary:"
echo "  Daily:   $(ls -1 ${BACKUP_DIR}/daily/flowstate_*.sql.gz 2>/dev/null | wc -l) backups"
echo "  Weekly:  $(ls -1 ${BACKUP_DIR}/weekly/flowstate_*.sql.gz 2>/dev/null | wc -l) backups"
echo "  Monthly: $(ls -1 ${BACKUP_DIR}/monthly/flowstate_*.sql.gz 2>/dev/null | wc -l) backups"
echo "  Total size: $(du -sh ${BACKUP_DIR} | cut -f1)"

echo "$LOG_PREFIX Backup completed successfully"
