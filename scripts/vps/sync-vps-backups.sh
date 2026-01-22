#!/bin/bash
# Sync FlowState VPS backups to local machine
# Deploy to: ~/scripts/sync-vps-backups.sh
# Timer: Every 6 hours via systemd user timer

set -e

VPS_HOST="deploy@84.46.253.137"
VPS_BACKUP_DIR="/var/backups/supabase"
LOCAL_BACKUP_DIR="$HOME/backups/flowstate-vps"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

echo "$LOG_PREFIX Starting VPS backup sync..."

# Ensure local backup directory exists
mkdir -p "$LOCAL_BACKUP_DIR"

# Test SSH connection
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$VPS_HOST" "echo 'SSH OK'" > /dev/null 2>&1; then
    echo "$LOG_PREFIX ERROR: Cannot connect to VPS via SSH"
    echo "$LOG_PREFIX Make sure SSH keys are configured for $VPS_HOST"
    exit 1
fi

# Sync backups using rsync
echo "$LOG_PREFIX Syncing from $VPS_HOST:$VPS_BACKUP_DIR..."
rsync -avz --progress \
    -e "ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30" \
    --delete \
    "${VPS_HOST}:${VPS_BACKUP_DIR}/" \
    "${LOCAL_BACKUP_DIR}/"

# Show sync summary
echo "$LOG_PREFIX Sync completed"
echo "$LOG_PREFIX Local backup summary:"
echo "  Daily:   $(ls -1 ${LOCAL_BACKUP_DIR}/daily/flowstate_*.sql.gz 2>/dev/null | wc -l) backups"
echo "  Weekly:  $(ls -1 ${LOCAL_BACKUP_DIR}/weekly/flowstate_*.sql.gz 2>/dev/null | wc -l) backups"
echo "  Monthly: $(ls -1 ${LOCAL_BACKUP_DIR}/monthly/flowstate_*.sql.gz 2>/dev/null | wc -l) backups"
echo "  Total size: $(du -sh ${LOCAL_BACKUP_DIR} 2>/dev/null | cut -f1)"

# Show latest backup
LATEST=$(ls -t ${LOCAL_BACKUP_DIR}/daily/flowstate_*.sql.gz 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
    echo "  Latest: $(basename $LATEST)"
fi
