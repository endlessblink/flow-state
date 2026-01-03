# SOP: Preventing Deleted Task Recreation (BUG-036)

**Last Updated**: 2025-12-25
**Related Issue**: BUG-036 (Deleted Tasks Recreated)
**Status**: ✅ FIXED

## Problem Description
Users reported that after deleting all tasks, the tasks would "reappear" upon reloading the page.

### Root Cause
The `loadFromDatabase` function in `src/stores/tasks.ts` contained a fallback mechanism intended for backward compatibility:
1.  It attempted to load tasks from individual `task-{id}` documents (Phase 4 storage).
2.  If the loaded list was empty (0 tasks), it assumed the new storage was empty or failed.
3.  It then fell back to loading from the legacy `tasks:data` monolithic document.
4.  Since the legacy document was never deleted during the migration to individual storage, it still contained old tasks.
5.  Result: Use deletes all tasks -> Individual storage is empty -> App reloads -> Falls back to legacy data -> Old tasks reappear.

## The Fix

### 1. Stricer Fallback Logic via `INDIVIDUAL_ONLY` Flag
We modified the condition for loading legacy data to strictly respect the `INDIVIDUAL_ONLY` flag.

**File**: `src/stores/tasks.ts`

```typescript
// BEFORE
if (tasks.value.length === 0 || !STORAGE_FLAGS.READ_INDIVIDUAL_TASKS) {
  // Load legacy...
}

// AFTER
// If INDIVIDUAL_ONLY is true, we NEVER fall back to legacy, even if tasks are empty.
if ((tasks.value.length === 0 || !STORAGE_FLAGS.READ_INDIVIDUAL_TASKS) && !STORAGE_FLAGS.INDIVIDUAL_ONLY) {
  // Load legacy...
}
```

### 2. Auto-Cleanup of Stale Data
We added a cleanup step that runs after a successful load from individual documents when in `INDIVIDUAL_ONLY` mode. This ensures that the stale `tasks:data` document is physically removed from the database to prevent any future confusion or accidental restoration.

```typescript
// AFTER successful individual load
if (STORAGE_FLAGS.INDIVIDUAL_ONLY) {
  deleteLegacyTasksDocument().catch(e => console.warn('⚠️ Legacy cleanup warning:', e))
}
```

### 3. Intelligent Initialization (Attempt 3 Fix - Final)
We replaced the fragile `localStorage` flag with a **PouchDB Local Document** (`_local/app-init`). This ensures that the "initialized" state travels with the database itself.

*   If you delete the PouchDB database (IndexedDB), the `_local` doc is gone, and the app correctly sees it as a "Fresh Install" -> Auto-seeds.
*   If you delete just the tasks, the `_local` doc remains, and the app respects the empty state -> No auto-seed.

```typescript
// src/stores/tasks.ts
try {
  await db.get('_local/app-init')
  // Document exists -> Initialized -> Skip Seed
} catch (e) {
  // Document missing -> Fresh -> Allow Seed
  await seed()
  await db.put({ _id: '_local/app-init', ... })
}
```

## Verification Steps
To verify this fix (or if you suspect it has regressed):

1.  **Delete All Tasks**: Manually delete all tasks. Reload. Tasks should be **0**.
2.  **Simulate Fresh Install**:
    *   Open DevTools -> Application -> Storage -> IndexedDB -> Delete `pomoflow-app`.
    *   Reload.
    *   Tasks should be **restored** (from seed/backup), and `_local/app-init` created.


## Rollback / Emergency
If this fix causes data loss (e.g., users *needed* that legacy data because migration failed):

1.  **Clear Flag**: Run `localStorage.removeItem('pomo-flow-initialized')` in the console.
2.  **Reload**: The app will attempt to auto-seed again.
3.  **Disable Individual Only**: Set `INDIVIDUAL_TASKS_ONLY: false` in `src/config/database.ts` to restore legacy fallback.
