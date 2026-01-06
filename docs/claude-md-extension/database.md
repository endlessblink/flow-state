# Database Architecture

## PouchDB + CouchDB Stack
```typescript
// Configuration from src/config/database.ts
export interface DatabaseConfig {
  local: { name: string; adapter?: string }
  remote?: { url: string; auth?: { username: string; password: string } }
  sync?: { live: boolean; retry: boolean; timeout?: number }
}
```

## Local Storage (PouchDB)
- **Adapter**: IndexedDB (`adapter: 'idb'`)
- **Database Name**: `pomoflow-app-dev`
- **Features**: Auto-compaction, revision limiting (5)
- **Singleton**: Single instance shared across all stores

## Remote Sync (CouchDB)
- **Optional**: Configured via environment variables
- **Live Sync**: Real-time bidirectional synchronization
- **Retry Logic**: Automatic reconnection with backoff
- **Conflict Detection**: Built-in with manual resolution UI

## Document Structure
```typescript
export const DB_KEYS = {
  TASKS: 'tasks',           // Main task storage
  PROJECTS: 'projects',     // Project definitions
  CANVAS: 'canvas',         // Canvas layout data
  TIMER: 'timer',           // Timer session history
  SETTINGS: 'settings',     // App preferences
  NOTIFICATIONS: 'notifications'  // Notification state
} as const
```

## Persistence Strategy
- **Debounced saves** (1 second) to prevent excessive writes
- **Auto-migration** for schema changes
- **Backward compatibility** preservation
- **Error recovery** with graceful degradation
- **Conflict resolution** via enterprise-grade system

## Cross-Device Synchronization

### Architecture Overview
- **Local-First**: All data stored locally in PouchDB first
- **Sync Optional**: CouchDB sync is opt-in via settings
- **Conflict Resolution**: Enterprise-grade system with UI

### Configuration
Environment variables for CouchDB sync:
- `VITE_COUCHDB_URL` - CouchDB server URL
- `VITE_COUCHDB_USERNAME` - Authentication username
- `VITE_COUCHDB_PASSWORD` - Authentication password

### Key Files
- `src/config/database.ts` - Database configuration
- `src/composables/useDatabase.ts` - PouchDB abstraction
- `src/composables/useReliableSyncManager.ts` - Sync orchestration
- `src/composables/useCouchDBSync.ts` - CouchDB-specific sync
- `docs/conflict-systems-resolution/` - Conflict resolution docs

## Critical Gotchas
- **Debounced saves** - Don't manually call save, let the system handle it
- **Type safety** - Use generic `<T>` type parameters for database operations
- **Error handling** - Always wrap database operations in try/catch
