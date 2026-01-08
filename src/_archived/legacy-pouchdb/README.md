# Archived: Legacy PouchDB Code

**Archived:** January 7, 2026
**Reason:** Migration from PouchDB/CouchDB to Supabase complete

## What's Here

These files contain the original PouchDB-based sync system that was used before the Supabase migration:

| File | Purpose |
|------|---------|
| `useReliableSyncManager.ts` | PouchDB sync orchestration with retry logic |
| `useDatabase.ts` | PouchDB compatibility layer and conflict handling |
| `TransactionManager.ts` | Write-Ahead Log for PouchDB operations |
| `supabaseMigrationCleanup.ts` | One-time migration utility (already ran) |

## Current Architecture

The app now uses:
- **Supabase PostgreSQL** for all data storage
- **Supabase Auth** for authentication
- **Supabase Realtime** for cross-device sync

See `src/composables/useSupabaseDatabase.ts` for the active data layer.

## Stubs Created

To maintain backward compatibility during cleanup, stub files were created at:
- `src/services/sync/TransactionManager.ts` (no-op stub)
- `src/composables/useDatabase.ts` (no-op stub)
- `src/composables/useReliableSyncManager.ts` (no-op stub)

## Cleanup Task

**TASK-117** tracks the full cleanup of remaining PouchDB references:
- Remove all transactionManager calls from task stores
- Remove sync UI components that depend on legacy stubs
- Delete the stub files
- Clean up config/database.ts

## Do Not Restore

This code should NOT be restored to active use. The Supabase architecture is the production system.
