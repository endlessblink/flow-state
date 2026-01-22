#!/bin/bash
# Setup FlowState Backup System
# Run this script to deploy backups to VPS and set up local sync

set -e

VPS_HOST="deploy@84.46.253.137"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== FlowState Backup System Setup ==="
echo ""

# Check for required commands
for cmd in ssh scp rsync; do
    if ! command -v $cmd &> /dev/null; then
        echo "ERROR: $cmd is required but not installed"
        exit 1
    fi
done

echo "Step 1: Testing SSH connection to VPS..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$VPS_HOST" "echo 'SSH OK'" > /dev/null 2>&1; then
    echo "ERROR: Cannot connect to VPS. Please ensure:"
    echo "  1. SSH key is set up for $VPS_HOST"
    echo "  2. VPS is reachable"
    exit 1
fi
echo "  SSH connection OK"

echo ""
echo "Step 2: Setting up VPS backup directories..."
ssh "$VPS_HOST" "sudo mkdir -p /var/backups/supabase/{daily,weekly,monthly} && sudo chown -R deploy:deploy /var/backups/supabase"
echo "  Backup directories created"

echo ""
echo "Step 3: Deploying backup script to VPS..."
ssh "$VPS_HOST" "mkdir -p ~/scripts"
scp "${SCRIPT_DIR}/supabase-backup.sh" "${VPS_HOST}:~/scripts/"
ssh "$VPS_HOST" "chmod +x ~/scripts/supabase-backup.sh"
echo "  Backup script deployed to ~/scripts/supabase-backup.sh"

echo ""
echo "Step 4: Setting up cron job on VPS..."
# Check if cron job already exists
CRON_EXISTS=$(ssh "$VPS_HOST" "crontab -l 2>/dev/null | grep -c 'supabase-backup.sh'" || echo "0")
if [ "$CRON_EXISTS" -eq "0" ]; then
    ssh "$VPS_HOST" "(crontab -l 2>/dev/null; echo '0 3 * * * /home/deploy/scripts/supabase-backup.sh >> /var/log/supabase-backup.log 2>&1') | crontab -"
    echo "  Cron job added (runs at 3:00 AM UTC daily)"
else
    echo "  Cron job already exists"
fi

echo ""
echo "Step 5: Running initial backup on VPS..."
ssh "$VPS_HOST" "~/scripts/supabase-backup.sh" || echo "  (Initial backup may fail if container name differs - check manually)"

echo ""
echo "Step 6: Setting up local backup sync..."
mkdir -p ~/scripts ~/backups/flowstate-vps
cp "${SCRIPT_DIR}/sync-vps-backups.sh" ~/scripts/
chmod +x ~/scripts/sync-vps-backups.sh
echo "  Local sync script installed to ~/scripts/sync-vps-backups.sh"

echo ""
echo "Step 7: Setting up systemd timer for local sync..."
mkdir -p ~/.config/systemd/user
cp "${SCRIPT_DIR}/flowstate-backup-sync.service" ~/.config/systemd/user/
cp "${SCRIPT_DIR}/flowstate-backup-sync.timer" ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now flowstate-backup-sync.timer
echo "  Systemd timer enabled (syncs every 6 hours)"

echo ""
echo "Step 8: Running initial local sync..."
~/scripts/sync-vps-backups.sh || echo "  (Initial sync may fail if no backups exist yet)"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Backup schedule:"
echo "  - VPS: Daily at 3:00 AM UTC (pg_dump)"
echo "  - Local: Every 6 hours (rsync from VPS)"
echo ""
echo "Backup locations:"
echo "  - VPS: /var/backups/supabase/{daily,weekly,monthly}"
echo "  - Local: ~/backups/flowstate-vps/{daily,weekly,monthly}"
echo ""
echo "Commands:"
echo "  - Manual VPS backup: ssh $VPS_HOST '~/scripts/supabase-backup.sh'"
echo "  - Manual local sync: ~/scripts/sync-vps-backups.sh"
echo "  - Check timer status: systemctl --user status flowstate-backup-sync.timer"
echo "  - View VPS backup log: ssh $VPS_HOST 'tail -50 /var/log/supabase-backup.log'"
