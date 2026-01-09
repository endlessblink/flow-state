# SOP: Shadow Backup System (Dual-Engine Resilience)

**Last Updated:** 2026-01-09
**Status:** ACTIVE
**Component:** Data Persistence / Backup

## Overview
The Shadow Backup System is a high-reliability, dual-engine backup mechanism designed to protect user data against system resets, accidental deletion, and database corruption. It runs automatically in the background during development.

## Architecture

### Engine A: Postgres Dump (Traceability)
- **Format**: `.sql` (Plain SQL text, human readable)
- **Source**: `supabase db dump` (via CLI)
- **Location**: `supabase/backups/backup-full-TIMESTAMP.sql`
- **Rotation**: Keeps last **50** backups.
- **Use Case**: Full database restoration via `psql`.

### Engine B: Shadow Mirror (Resilience)
- **Format**: SQLite (`.db`) + JSON Snapshots
- **Source**: `scripts/shadow-mirror.cjs` (Direct API fetch)
- **Location**: `backups/shadow.db`
- **Rotation**: Keeps last **1000** snapshots.
- **Use Case**: "Time Machine" recovery, independent of Postgres/Supabase toolchain. Survives `supabase db reset`.

## Operation
- **Daemon**: `scripts/auto-backup-daemon.cjs`
- **Trigger**: Runs automatically with `npm run dev`.
- **Interval**: Every **5 minutes**.
- **Manual run**: `npm run backup:watch`

## Configuration
To ensure the Shadow Mirror captures all data (bypassing RLS):
1.  Open `.env.local`
2.  Add `SUPABASE_SERVICE_ROLE_KEY=ey...` (Get this from Supabase Dashboard)

## Restoration

### Restoring from SQL (Engine A)
```bash
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/backups/YOUR_BACKUP.sql
```

### Restoring from Shadow Mirror (Engine B)
1.  Open `backups/shadow.db` with any SQLite viewer.
2.  Query the `snapshots` table.
3.  Extract the `data_json` field.
4.  Write a script to insert this JSON back into Supabase.
