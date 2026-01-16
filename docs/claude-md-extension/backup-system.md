# Database Backup System

Created: January 9, 2026 (TASK-168)

## Overview

Automatic database backup system with 3 redundant engines that works both locally and on VPS deployment.

## Dual-Engine Architecture (Shadow Mirror)

| Engine | Type | Location | Purpose |
|--------|------|----------|---------|
| **Engine A** | Postgres Dump | `supabase/backups/*.sql` | 50-file rotation, infrastructure recovery |
| **Engine B** | Shadow Mirror | `backups/shadow.db` | SQLite replica, disaster recovery |
| **Engine C** | JSON Hub | `public/shadow-latest.json` | Frontend bridge, cross-device sync |

**Auto-backup interval:** Every 5 minutes via `npm run dev`
**Manual trigger:** `npm run backup:watch` or `node scripts/shadow-mirror.cjs`
**Verification:** `node scripts/verify-shadow-layer.cjs`
**Recovery UI:** Settings > Storage tab
**Configuration:** Service Role Key in `.env.local` required for full Shadow access (bypasses RLS)

## Quick Reference

```bash
# Manual backups
npm run db:backup           # Full database backup
npm run db:backup:data      # Data only (no schema)
npm run db:backup:tasks     # Tasks and groups tables only

# List backups
ls -la supabase/backups/         # SQL Dumps
ls -la backups/shadow.db         # SQLite Shadow Mirror
ls -la public/shadow-latest.json # Frontend Bridge
```

## Layers of Protection

| Layer | System | Scope | Location |
|-------|--------|-------|----------|
| **Layer 1** | Local History | Undo/Recovery | `localStorage` |
| **Layer 2** | Golden Backup | Peak Data Safety | `localStorage` (Smart Filtered) |
| **Layer 3** | Shadow Mirror | Disaster/Cross-Device | SQLite + JSON Export |
| **Layer 4** | SQL Dumps | Infrastructure Loss | `.sql` Files (Rotated) |

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

## Recovery Paths

### 1. In-App Storage Tab (Seamless)
Access via **Settings ⚙️ > Storage 💾**.
- **Golden Backup**: Restores the all-time peak task count. Automatically filters out items marked as `is_deleted: true` in Supabase to prevent data resurrection.
- **Shadow Hub**: Fetches the latest cloud snapshot from the local daemon. One-click recovery relative to the last 5-min sync.

### 2. Standalone Recovery Tool
If the main app fails to load:
- Open `public/restore-backup.html` in your browser.
- This tool bypasses the Vue application logic and attempts to push raw data into `localStorage`.

### 3. Database Restoration
For infrastructure-level loss:
- Use `psql` to restore `.sql` dumps from `supabase/backups/`.
- Use `node scripts/verify-shadow-layer.cjs` to check data fidelity between Supabase and Shadow layers.

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
