# SOP: VPS Supabase Backup System (TASK-358)

## Overview

Automated backup system for VPS Supabase data with local replication.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VPS (84.46.253.137)                         │
│                                                                     │
│   ┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│   │   Supabase      │───►│  pg_dump     │───►│ /var/backups/   │   │
│   │   Postgres      │    │  (cron)      │    │ supabase/       │   │
│   └─────────────────┘    └──────────────┘    └────────┬────────┘   │
│                                                        │            │
└────────────────────────────────────────────────────────┼────────────┘
                                                         │ rsync
                                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Local Machine                               │
│                                                                     │
│   ┌─────────────────┐    ┌──────────────────────────────────────┐  │
│   │ ~/backups/      │◄───│  cron/systemd timer (hourly pull)    │  │
│   │ flowstate-vps/  │    └──────────────────────────────────────┘  │
│   └─────────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Backup Strategy

### 1. Daily Full Backups (VPS)
- **Schedule**: 3:00 AM UTC daily
- **Retention**:
  - Daily: 7 days
  - Weekly: 4 weeks (Sundays)
  - Monthly: 12 months (1st of month)
- **Format**: pg_dump with compression (.sql.gz)

### 2. Local Sync (Home → VPS)
- **Schedule**: Every 6 hours
- **Method**: rsync over SSH
- **Destination**: `~/backups/flowstate-vps/`

### 3. Shadow Mirror (Bonus)
- Existing SQLite shadow backup system provides additional redundancy
- Runs every 5 minutes locally

## Implementation

### VPS Setup

#### Step 1: Create Backup Directory
```bash
ssh deploy@84.46.253.137
sudo mkdir -p /var/backups/supabase/{daily,weekly,monthly}
sudo chown -R deploy:deploy /var/backups/supabase
```

#### Step 2: Create Backup Script
Create `/home/deploy/scripts/supabase-backup.sh`:

```bash
#!/bin/bash
# FlowState VPS Supabase Backup Script

set -e

BACKUP_DIR="/var/backups/supabase"
DATE=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)

# Find Supabase Postgres container
POSTGRES_CONTAINER=$(docker ps --filter "name=supabase-db" --format "{{.Names}}" | head -1)

if [ -z "$POSTGRES_CONTAINER" ]; then
    echo "ERROR: Supabase Postgres container not found"
    exit 1
fi

# Create backup
BACKUP_FILE="flowstate_${DATE}.sql.gz"
docker exec $POSTGRES_CONTAINER pg_dump -U postgres -d postgres \
    --no-owner --no-acl \
    | gzip > "${BACKUP_DIR}/daily/${BACKUP_FILE}"

echo "Created daily backup: ${BACKUP_FILE}"

# Keep only last 7 daily backups
find ${BACKUP_DIR}/daily -name "*.sql.gz" -mtime +7 -delete

# Weekly backup (Sunday)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    cp "${BACKUP_DIR}/daily/${BACKUP_FILE}" "${BACKUP_DIR}/weekly/"
    echo "Created weekly backup"
    # Keep only last 4 weekly backups
    find ${BACKUP_DIR}/weekly -name "*.sql.gz" -mtime +28 -delete
fi

# Monthly backup (1st of month)
if [ "$DAY_OF_MONTH" -eq "01" ]; then
    cp "${BACKUP_DIR}/daily/${BACKUP_FILE}" "${BACKUP_DIR}/monthly/"
    echo "Created monthly backup"
    # Keep only last 12 monthly backups
    find ${BACKUP_DIR}/monthly -name "*.sql.gz" -mtime +365 -delete
fi

# Log completion
echo "$(date): Backup completed successfully" >> /var/log/supabase-backup.log
```

#### Step 3: Set Up Cron Job on VPS
```bash
chmod +x /home/deploy/scripts/supabase-backup.sh

# Add to crontab
crontab -e
# Add line:
0 3 * * * /home/deploy/scripts/supabase-backup.sh >> /var/log/supabase-backup.log 2>&1
```

### Local Setup

#### Step 1: Create Local Backup Directory
```bash
mkdir -p ~/backups/flowstate-vps
```

#### Step 2: Create Sync Script
Create `~/scripts/sync-vps-backups.sh`:

```bash
#!/bin/bash
# Sync FlowState VPS backups to local machine

VPS_HOST="deploy@84.46.253.137"
VPS_BACKUP_DIR="/var/backups/supabase"
LOCAL_BACKUP_DIR="$HOME/backups/flowstate-vps"

echo "$(date): Starting VPS backup sync..."

rsync -avz --progress \
    -e "ssh -o StrictHostKeyChecking=no" \
    "${VPS_HOST}:${VPS_BACKUP_DIR}/" \
    "${LOCAL_BACKUP_DIR}/"

echo "$(date): Sync completed"

# Show disk usage
du -sh ${LOCAL_BACKUP_DIR}/*
```

#### Step 3: Set Up Systemd Timer (Alternative to Cron)
Create `~/.config/systemd/user/flowstate-backup-sync.service`:

```ini
[Unit]
Description=Sync FlowState VPS backups

[Service]
Type=oneshot
ExecStart=%h/scripts/sync-vps-backups.sh
```

Create `~/.config/systemd/user/flowstate-backup-sync.timer`:

```ini
[Unit]
Description=Sync FlowState VPS backups every 6 hours

[Timer]
OnBootSec=15min
OnUnitActiveSec=6h

[Install]
WantedBy=timers.target
```

Enable the timer:
```bash
systemctl --user daemon-reload
systemctl --user enable --now flowstate-backup-sync.timer
```

## Verification

### Check VPS Backup Status
```bash
ssh deploy@84.46.253.137 "ls -la /var/backups/supabase/daily/ | tail -5"
```

### Check Local Sync Status
```bash
ls -la ~/backups/flowstate-vps/daily/ | tail -5
systemctl --user status flowstate-backup-sync.timer
```

### Test Restore
```bash
# On VPS - test restore to temporary database
gunzip -c /var/backups/supabase/daily/latest.sql.gz | \
    docker exec -i supabase-db psql -U postgres -d postgres_restore_test
```

## Monitoring

### Backup Size Alerts
Add to backup script:
```bash
BACKUP_SIZE=$(du -b "${BACKUP_DIR}/daily/${BACKUP_FILE}" | cut -f1)
if [ $BACKUP_SIZE -lt 1000000 ]; then  # Less than 1MB is suspicious
    echo "WARNING: Backup file is suspiciously small: $BACKUP_SIZE bytes"
    # Could add email/Telegram notification here
fi
```

### Failed Backup Detection
Check logs for errors:
```bash
grep -i error /var/log/supabase-backup.log | tail -10
```

## Disaster Recovery

### Scenario: VPS Dies

1. Start local Supabase: `supabase start`
2. Restore from latest backup:
   ```bash
   gunzip -c ~/backups/flowstate-vps/daily/latest.sql.gz | \
       psql -h localhost -p 54322 -U postgres
   ```
3. Update app config to use local Supabase

### Scenario: Data Corruption

1. Identify last good backup by timestamp
2. Stop app to prevent further writes
3. Restore from specific backup:
   ```bash
   docker exec supabase-db psql -U postgres -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   gunzip -c /var/backups/supabase/daily/flowstate_20260122_030000.sql.gz | \
       docker exec -i supabase-db psql -U postgres
   ```

## Files Reference

| Location | Purpose |
|----------|---------|
| `/var/backups/supabase/` (VPS) | Backup storage on VPS |
| `~/backups/flowstate-vps/` (Local) | Synced backup copies |
| `/home/deploy/scripts/supabase-backup.sh` (VPS) | Backup script |
| `~/scripts/sync-vps-backups.sh` (Local) | Sync script |
| `/var/log/supabase-backup.log` (VPS) | Backup log |

## Status

- [ ] VPS backup script created
- [ ] VPS cron job configured
- [ ] Local sync script created
- [ ] Local systemd timer enabled
- [ ] Initial backup tested
- [ ] Restore tested
