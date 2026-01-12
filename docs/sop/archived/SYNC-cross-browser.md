# SOP: Cross-Browser CouchDB Sync Fix (BUG-054)

**Date**: January 1, 2026
**Severity**: P1-HIGH
**Status**: RESOLVED

---

## Problem Summary

Users reported multiple sync issues across browser instances:

1. **Sync not working at all on new browsers** (e.g., Brave) even after configuring Settings
2. **UI blocked for 10+ seconds** waiting for sync to complete before showing data
3. **Deleted projects reappearing** after sync pulled old versions from CouchDB
4. **Sync configuration not portable** - each browser required manual credential entry

**User Expectation**: "Sync should be automatic without configuring each browser"

---

## Root Cause Analysis

### Issue 1: Settings UI Disconnect from Sync Manager

The Settings UI and sync manager used **completely independent configuration systems**:

| System | Storage Location | Used By |
|--------|-----------------|---------|
| Settings UI | `localStorage` keys (`pomo-couchdb-url`, etc.) | `CloudSyncSettings.vue` |
| Sync Manager | Environment variables (`VITE_COUCHDB_*`) | `database.ts` → `useReliableSyncManager.ts` |

**Flow that failed:**
```
User clicks "Save & Test Connection" in Settings
    ↓
CloudSyncSettings.vue saves to localStorage
    ↓
UI shows "CouchDB Connected" ✅
    ↓
User reloads page
    ↓
Sync manager reads from import.meta.env.VITE_COUCHDB_URL (empty!)
    ↓
Logs "No remote URL configured" ❌
```

### Issue 2: Initialization Order Blocked UI

**Original flow:**
```typescript
// useAppInitialization.ts (before fix)
onMounted(async () => {
    await syncManager.waitForInitialSync(10000)  // BLOCKED UI for 10+ seconds
    await taskStore.loadFromDatabase()            // Only loaded AFTER sync
})
```

### Issue 3: Callback Registration Race Condition

Stores were created (triggering `useDatabase()` → sync start) **before** the data-pulled callback was registered:

```typescript
// Before fix - race condition
onMounted(async () => {
    // ⚠️ Sync already started when stores were created above!
    const unregister = syncManager.registerDataPulledCallback(...)  // TOO LATE
})
```

### Issue 4: No Tombstones for Deleted Projects

When projects were deleted, only the local array was updated. No PouchDB tombstone was created, so CouchDB sync would restore the "non-deleted" remote version.

### Issue 5: IndexedDB Corruption (Brave Browser)

The Brave browser had a corrupted IndexedDB with symptoms:
- `Database has a global failure UnknownError: Failed to read large IndexedDB value`
- `InvalidStateError: Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.`
- `Document projects:data has 76 conflicts`

---

## Solution Implementation

### Fix 1: Bridge localStorage to Database Config

**File:** `src/config/database.ts`

Added `getStoredCouchDBConfig()` function that reads from localStorage first, falls back to env vars, then to hardcoded defaults:

```typescript
/**
 * BUG-054 FIX: Get CouchDB configuration with automatic defaults
 *
 * Priority order:
 * 1. localStorage (runtime user settings from Settings UI)
 * 2. Environment variables (build-time configuration)
 * 3. Hardcoded defaults (automatic sync for personal use)
 */
const DEFAULT_COUCHDB_URL = 'http://84.46.253.137:5984/pomoflow-tasks'
const DEFAULT_COUCHDB_USERNAME = 'admin'
const DEFAULT_COUCHDB_PASSWORD = 'pomoflow-2024'

const getStoredCouchDBConfig = () => {
  if (typeof localStorage === 'undefined') {
    return {
      url: import.meta.env.VITE_COUCHDB_URL || DEFAULT_COUCHDB_URL,
      username: import.meta.env.VITE_COUCHDB_USERNAME || DEFAULT_COUCHDB_USERNAME,
      password: import.meta.env.VITE_COUCHDB_PASSWORD || DEFAULT_COUCHDB_PASSWORD
    }
  }

  // IMPORTANT: Use .trim() to handle empty strings properly
  const storedUrl = localStorage.getItem('pomo-couchdb-url')?.trim()
  const storedUsername = localStorage.getItem('pomo-couchdb-username')?.trim()
  const storedPassword = localStorage.getItem('pomo-couchdb-password')?.trim()

  return {
    url: storedUrl || import.meta.env.VITE_COUCHDB_URL || DEFAULT_COUCHDB_URL,
    username: storedUsername || import.meta.env.VITE_COUCHDB_USERNAME || DEFAULT_COUCHDB_USERNAME,
    password: storedPassword || import.meta.env.VITE_COUCHDB_PASSWORD || DEFAULT_COUCHDB_PASSWORD
  }
}
```

**Key insight:** Using `.trim()` to handle empty strings - `localStorage.getItem()` returns `""` if set to empty, which is truthy but should trigger fallback.

### Fix 2: Load Local Data First, Sync in Background

**File:** `src/composables/app/useAppInitialization.ts`

```typescript
export function useAppInitialization() {
    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const canvasStore = useCanvasStore()

    const syncManager = getGlobalReliableSyncManager()

    // BUG-054 FIX: Register callback IMMEDIATELY (outside onMounted)
    const unregisterDataPulledCallback = syncManager.registerDataPulledCallback(async () => {
        console.log('🔄 [APP] Reloading stores after sync pulled data...')
        await taskStore.loadFromDatabase()
        await projectStore.loadProjectsFromPouchDB()
        await canvasStore.loadFromDatabase()
        console.log('✅ [APP] Stores reloaded after sync')
    })

    onMounted(async () => {
        // BUG-054 FIX: Load local data IMMEDIATELY - don't block UI
        console.log('⚡ [APP] Loading local data immediately...')
        await taskStore.loadFromDatabase()
        await projectStore.loadProjectsFromPouchDB()
        await canvasStore.loadFromDatabase()
        console.log('✅ [APP] Local data loaded - UI ready')

        // Sync in background with 30-second timeout
        syncManager.waitForInitialSync(30000).then(syncCompleted => {
            if (syncCompleted) {
                console.log('✅ [APP] Background sync completed')
            } else {
                console.warn('⚠️ [APP] Background sync timed out - using local data')
            }
        }).catch(err => {
            console.warn('⚠️ [APP] Background sync failed:', err)
        })
    })

    onUnmounted(() => {
        if (unregisterDataPulledCallback) {
            unregisterDataPulledCallback()
        }
    })
}
```

### Fix 3: Create Tombstones for Deleted Projects

**File:** `src/stores/projects.ts`

```typescript
const deleteProject = async (projectId: string) => {
    // ... existing deletion logic ...

    // BUG-054 FIX: Actually delete the project document from PouchDB
    // This creates a tombstone that syncs to CouchDB
    const dbInstance = (window as any).pomoFlowDb
    if (dbInstance && STORAGE_FLAGS.INDIVIDUAL_PROJECTS_ONLY) {
        try {
            await deleteProjectDoc(dbInstance, projectId)
            console.log(`🗑️ [PROJECT] Deleted document for project ${projectId}`)
        } catch (deleteErr) {
            console.warn(`⚠️ [PROJECT] Failed to delete document for ${projectId}:`, deleteErr)
        }
    }
}
```

### Fix 4: Data-Pulled Callback Mechanism

**File:** `src/composables/useReliableSyncManager.ts`

Added callback registration for post-sync store reloading:

```typescript
// BUG-054 FIX: Callbacks for when data is pulled from remote
const dataPulledCallbacks: Array<() => Promise<void> | void> = []

const registerDataPulledCallback = (callback: () => Promise<void> | void): (() => void) => {
    dataPulledCallbacks.push(callback)
    return () => {
        const index = dataPulledCallbacks.indexOf(callback)
        if (index > -1) {
            dataPulledCallbacks.splice(index, 1)
        }
    }
}

const notifyDataPulled = async () => {
    console.log(`🔄 [SYNC] Notifying ${dataPulledCallbacks.length} callbacks that data was pulled`)
    for (const callback of dataPulledCallbacks) {
        try {
            await callback()
        } catch (err) {
            console.warn('⚠️ Data pulled callback failed:', err)
        }
    }
}

// In live sync handler, when pull direction:
if (syncChange.direction === 'pull' && docCount > 0) {
    await notifyDataPulled()
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/config/database.ts` | Added `getStoredCouchDBConfig()`, hardcoded defaults, `.trim()` handling |
| `src/composables/app/useAppInitialization.ts` | Load local first, sync in background, early callback registration |
| `src/stores/projects.ts` | Added `deleteProjectDoc()` calls for tombstone creation |
| `src/composables/useReliableSyncManager.ts` | Added callback mechanism for data-pulled events |

---

## Testing Steps

### Test 1: Fresh Browser Sync
1. Open app in a browser with no localStorage (incognito/new profile)
2. App should show local data immediately (within 1 second)
3. Check console for `🔧 [DATABASE CONFIG] Sync enabled - URL: http://...`
4. Within 10 seconds, data from CouchDB should appear

### Test 2: Project Deletion Sync
1. Create a project in Browser A
2. Wait for sync to complete (check Browser B sees it)
3. Delete the project in Browser A
4. Refresh Browser B - project should be gone
5. Verify console shows `🗑️ [PROJECT] Deleted document for project...`

### Test 3: Settings UI to Sync Manager
1. Go to Settings → Sync
2. Enter custom CouchDB credentials
3. Click "Save & Test Connection"
4. Reload page
5. Check console for `🔧 [DATABASE CONFIG] Sync enabled - URL: [your-custom-url]`

---

## Troubleshooting

### IndexedDB Corruption

**Symptoms:**
- `Database has a global failure UnknownError: Failed to read large IndexedDB value`
- `InvalidStateError: The database connection is closing`
- Massive conflict counts (76+)

**Resolution:**
1. Open DevTools → Application → Storage → IndexedDB
2. Find database: `_pouch_pomoflow-app-dev`
3. Right-click → Delete
4. Refresh page
5. App will sync fresh data from CouchDB

### Sync Not Starting

**Check:**
1. Console should show `🔧 [DATABASE CONFIG] Sync enabled - URL: ...`
2. If it shows "Local-only mode", check:
   - localStorage keys exist (`pomo-couchdb-url`, etc.)
   - Values are not empty strings
   - CouchDB server is reachable

### Deleted Items Reappearing

**Cause:** Tombstones not created or sync conflict resolution chose remote version

**Check:**
1. Console for `🗑️ [PROJECT] Deleted document for project...`
2. CouchDB directly for `_deleted: true` documents
3. Conflict detector logs for resolution decisions

---

## Rollback Procedure

If sync issues resurface:

1. **Disable automatic defaults** - Remove hardcoded credentials from `database.ts`
2. **Revert to sync-blocking** - Change `useAppInitialization.ts` to await sync before loading
3. **Remove callback mechanism** - Revert `useReliableSyncManager.ts` changes

---

## Related Issues

- **BUG-053**: Projects/tasks disappeared from IndexedDB (data recovered from CouchDB)
- **BUG-037**: CouchDB sync resurrects deleted tasks (deletion-wins conflict resolution)
- **BUG-036**: Deleted tasks recreated (intelligent initialization)

---

## Lessons Learned

1. **Configuration systems must be unified** - Settings UI and sync manager must read from the same source
2. **Empty strings are truthy** - Always use `.trim()` and check for empty strings, not just null
3. **Local-first is non-negotiable** - Users expect instant UI, sync is background optimization
4. **Tombstones are required** - PouchDB/CouchDB sync requires proper deletion markers
5. **IndexedDB can corrupt** - Have clear recovery steps documented
