# BUG-037 Implementation Plan: Prevent Task Resurrection via CouchDB Sync

**For**: Claude Code instance working on tasks.ts
**Created**: December 25, 2025
**Priority**: HIGH

---

## Problem Summary

Tasks deleted by users reappear after refresh because CouchDB sync restores them from remote. The conflict resolution was already fixed in `conflictResolver.ts` to make "deletion wins", but we still need deletion intent tracking in `tasks.ts` for robustness.

---

## What's Already Done

✅ **Conflict Resolution Fixed** (`src/utils/conflictResolver.ts:209-257`):
- `resolvePreserveNonDeleted()` now makes deletions win over non-deletions
- Both local and remote deletions propagate correctly

---

## What You Need to Implement in tasks.ts

### 1. Add Deletion Intent Tracking in `deleteTask()`

**Location**: `src/stores/tasks.ts` - inside `deleteTask()`, after line ~1213 (after `_deleteIndividualTask` succeeds)

**Add this code block**:

```typescript
// BUG-037 FIX: Track deletion intent to prevent sync resurrection
// This _local document survives sync and ensures deleted tasks stay deleted
try {
  interface DeletionTrackingDoc {
    _id: string
    _rev?: string
    taskIds: string[]
    deletedAt: Record<string, string>
  }

  let deletionDoc: DeletionTrackingDoc
  try {
    deletionDoc = await dbInstance.get('_local/deleted-tasks') as DeletionTrackingDoc
  } catch {
    // Document doesn't exist yet, create it
    deletionDoc = {
      _id: '_local/deleted-tasks',
      taskIds: [],
      deletedAt: {}
    }
  }

  // Add this task to the deletion tracking list
  if (!deletionDoc.taskIds.includes(taskId)) {
    deletionDoc.taskIds.push(taskId)
    deletionDoc.deletedAt[taskId] = new Date().toISOString()
    await dbInstance.put(deletionDoc)
    console.log(`🗑️ BUG-037: Tracked deletion intent for task ${taskId}`)
  }
} catch (trackingError) {
  console.warn('⚠️ BUG-037: Failed to track deletion intent:', trackingError)
  // Non-critical - deletion still proceeds
}
```

**Insert after this existing code** (around line 1213):
```typescript
await _deleteIndividualTask(dbInstance, taskId)
console.log(`🗑️[BUG-025] Individual task - ${taskId} deleted from PouchDB`)
// <<< INSERT THE NEW CODE HERE >>>
```

---

### 2. Filter Deleted Tasks in `loadFromDatabase()`

**Location**: `src/stores/tasks.ts` - inside `loadFromDatabase()`, after tasks are loaded from individual docs (around line 684-686)

**Add this code block after `tasks.value = loadedTasks` or the merge logic**:

```typescript
// BUG-037 FIX: Filter out intentionally deleted tasks that sync might have restored
try {
  interface DeletionTrackingDoc {
    _id: string
    _rev?: string
    taskIds: string[]
    deletedAt: Record<string, string>
  }

  const deletionDoc = await dbInstance.get('_local/deleted-tasks') as DeletionTrackingDoc
  const deletedIds = new Set(deletionDoc.taskIds)
  const beforeFilter = tasks.value.length

  // Remove any tasks that are in the deletion tracking list
  tasks.value = tasks.value.filter(t => !deletedIds.has(t.id))

  if (beforeFilter !== tasks.value.length) {
    console.log(`🗑️ BUG-037: Filtered ${beforeFilter - tasks.value.length} deleted tasks from load`)

    // Also delete these tasks from PouchDB to clean up
    for (const taskId of deletedIds) {
      try {
        await _deleteIndividualTask(dbInstance as unknown as PouchDB.Database, taskId)
      } catch {
        // Task doc might not exist, that's fine
      }
    }
  }

  // Clean up old deletion entries (>30 days)
  const DELETION_RETENTION_DAYS = 30
  const cutoffDate = new Date(Date.now() - DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const cleanedTaskIds = deletionDoc.taskIds.filter(id => {
    const deletedAt = deletionDoc.deletedAt[id]
    return deletedAt && new Date(deletedAt) > cutoffDate
  })

  if (cleanedTaskIds.length < deletionDoc.taskIds.length) {
    const cleanedDeletedAt: Record<string, string> = {}
    for (const id of cleanedTaskIds) {
      cleanedDeletedAt[id] = deletionDoc.deletedAt[id]
    }
    await dbInstance.put({
      ...deletionDoc,
      taskIds: cleanedTaskIds,
      deletedAt: cleanedDeletedAt
    })
    console.log(`🗑️ BUG-037: Cleaned ${deletionDoc.taskIds.length - cleanedTaskIds.length} old deletion entries`)
  }
} catch (e) {
  // No deletion tracking doc exists - that's fine, nothing to filter
  if ((e as { status?: number }).status !== 404) {
    console.warn('⚠️ BUG-037: Error checking deletion tracking:', e)
  }
}
```

**Insert after this existing code** (around line 683-686):
```typescript
tasks.value = loadedTasks
// OR after the merge logic:
// tasks.value = [...loadedTasks, ...tasksOnlyInMemory]

taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'loadFromDatabase-Phase4-individualDocs')
// <<< INSERT THE NEW CODE HERE >>>
```

---

## Testing Checklist

After implementing, test these scenarios:

1. **Single Device Test**:
   - Delete a task
   - Refresh the page
   - ✅ Task should stay deleted

2. **Multi-Device Test** (if you have CouchDB sync):
   - Delete a task on Device A
   - Wait for sync
   - ✅ Task should disappear on Device B

3. **Edge Case - Rapid Delete/Create**:
   - Delete a task
   - Immediately create a new task with different title
   - Refresh
   - ✅ Only the new task should exist

4. **Verify Deletion Tracking Doc**:
   - In browser DevTools console:
   ```javascript
   window.pomoFlowDb.get('_local/deleted-tasks').then(console.log)
   ```
   - ✅ Should show list of deleted task IDs

---

## Files to Modify

| File | Lines (approx) | Change |
|------|----------------|--------|
| `src/stores/tasks.ts` | ~1213 | Add deletion tracking in `deleteTask()` |
| `src/stores/tasks.ts` | ~686 | Add filtering in `loadFromDatabase()` |

---

## Rollback (If Issues Occur)

1. Remove the code blocks added above
2. Delete the tracking document:
   ```javascript
   window.pomoFlowDb.get('_local/deleted-tasks').then(doc =>
     window.pomoFlowDb.remove(doc)
   )
   ```
3. Tasks will sync back from remote on next refresh

---

## Context

- **Root Cause Analysis**: `/home/endlessblink/.claude/plans/toasty-puzzling-catmull.md`
- **MASTER_PLAN Entry**: BUG-037 in `docs/MASTER_PLAN.md`
- **Related**: BUG-036 (legacy fallback fix - already done)
