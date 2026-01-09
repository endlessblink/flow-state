# Database Backup System

Created: January 9, 2026 (TASK-168)

## Overview

Automatic database backup system that works both locally and on VPS deployment.

## Quick Reference

```bash
# Manual backups
npm run db:backup           # Full database backup
npm run db:backup:data      # Data only (no schema)
npm run db:backup:tasks     # Tasks and groups tables only

# List backups
ls -la supabase/backups/
```

## How It Works

### Local Development

1. **Automatic backup before migrations**: The `destructive-command-blocker.sh` hook automatically creates a backup before any `supabase db push` command.

2. **Manual backup**: Run `npm run db:backup` anytime.

3. **Backup location**: `supabase/backups/` (not committed to git)

### VPS Deployment

1. **Set environment variable**:
   ```bash
   export SUPABASE_DB_URL='postgresql://user:pass@host:5432/postgres'
   ```

2. **Run cron setup**:
   ```bash
   ./scripts/deploy/setup-backup-cron.sh
   ```

3. **Schedule**:
   - Every 6 hours: Incremental backup (keeps 28 = 7 days)
   - Daily at 2 AM: Full backup (keeps 14 = 2 weeks)

## Backup Script Options

```bash
./scripts/backup-db.sh [OPTIONS]

Options:
  --data-only       Backup data only (no schema)
  --tables LIST     Backup specific tables (comma-separated)
  --rotate N        Keep only last N backups (default: 10)
  --help            Show help
```

### Examples

```bash
# Full backup
./scripts/backup-db.sh

# Data only
./scripts/backup-db.sh --data-only

# Specific tables
./scripts/backup-db.sh --tables "tasks,groups,projects"

# Keep only last 5 backups
./scripts/backup-db.sh --rotate 5
```

## Restore from Backup

### Local Development

```bash
# Stop supabase first
supabase stop

# Start fresh
supabase start

# Restore from backup
psql "postgresql://postgres:postgres@localhost:54322/postgres" < supabase/backups/backup-YYYYMMDD-HHMMSS.sql
```

### VPS

```bash
# Restore directly
psql "$SUPABASE_DB_URL" < supabase/backups/backup-YYYYMMDD-HHMMSS.sql
```

## Safety Hooks

The `destructive-command-blocker.sh` hook provides automatic protection:

| Command | Protection |
|---------|------------|
| `supabase db reset` | PERMANENTLY BLOCKED |
| `supabase db push` | Auto-creates backup first |
| `DROP DATABASE` | PERMANENTLY BLOCKED |
| `TRUNCATE` | PERMANENTLY BLOCKED |
| `DELETE FROM` (no WHERE) | BLOCKED |

## Files

| File | Purpose |
|------|---------|
| `scripts/backup-db.sh` | Main backup script |
| `scripts/deploy/setup-backup-cron.sh` | VPS cron setup |
| `.claude/hooks/destructive-command-blocker.sh` | Safety hook |
| `supabase/backups/` | Backup storage |

## Troubleshooting

### Backup fails with "command not found"

For local: Make sure Supabase CLI is installed and running:
```bash
supabase status
```

For VPS: Make sure pg_dump is installed:
```bash
apt-get install postgresql-client
```

### Backup is empty

Check if database has data:
```bash
supabase db dump --data-only | head -20
```

### Hook not blocking commands

Verify hook is registered in `.claude/settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/destructive-command-blocker.sh"
          }
        ]
      }
    ]
  }
}
```
