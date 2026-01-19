# SOP: Canvas Position Reset Fix (TASK-089)

**Date**: January 3, 2026
**Status**: RESOLVED
**Severity**: P0-CRITICAL
**Files Modified**: 6 files

## Problem Statement

Canvas positions (tasks, groups, viewport) would reset to old values approximately 10 seconds after user interaction. The pattern was "first move resets, second move stays" - indicating a race condition where locks were being acquired too late.

### Symptoms
- Task positions reset after drag
- Group positions reset after drag
- Group dimensions reset after resize
- All resets occurred ~10 seconds after interaction
- Second drag/resize would stay (because lock existed from first)

## Root Cause Analysis

### Issue 1: Sync Completion Handler Still Called `canvasStore.loadFromDatabase()`
**Location**: `src/composables/app/useAppInitialization.ts:193-201`

The sync completion handler (fires ~10s after app start when sync completes) was still calling `canvasStore.loadFromDatabase()`, wiping all canvas state. The 10-second fallback timer was fixed earlier, but this path was missed.

### Issue 2: Lock Timing Race Condition
**Location**: `useCanvasDragDrop.ts`, `useCanvasResize.ts`

The lock was acquired AFTER the store update:
```typescript
// WRONG ORDER (race condition):
store.update(newPosition)    // Triggers watchers immediately
lockPosition(newPosition)    // Lock acquired too late!
```

When store updates, Vue watchers fire synchronously. The `syncTrigger` watcher calls `syncNodes()` which rebuilds Vue Flow nodes. Without a lock in place, the position could be reset before the lock was acquired.

### Issue 3: Data Structure Mismatch in `updateSectionFromSync`
**Location**: `src/stores/canvas.ts:661-669`

The lock restoration code was putting width/height at the wrong level:
```typescript
// WRONG:
{
  position: { x, y },        // Missing width/height!
  width: lockedWidth,        // At root - WRONG
  height: lockedHeight       // At root - WRONG
}

// CORRECT:
  position: { x, y, width, height }  // All inside position
}
```

### Issue 4: Visual Detachment due to Strict Geometry Check (Jan 11, 2026)
**Location**: `src/composables/canvas/useCanvasNodeSync.ts`

Tasks that were logically inside a group (database `parentId` set correctly) were sometimes visually "detached" or floating because `useCanvasNodeSync` relied **exclusively** on geometric calculation (`findSectionForTask`). If the geometric check failed (e.g., slight border offset, task drifted 1px out), the visual engine set `parentNode: undefined`, causing the task to ignore group drags even though the database said it was inside.

> [!CAUTION]
> **CRITICAL: DO NOT DISABLE GEOMETRIC FALLBACK**
> On Jan 11, 2026, we attempted to switch to "Strict Database Truth" by disabling the geometric check for tasks without a saved `parentId`. This caused a **critical regression** where legacy tasks or tasks dragged into groups without an immediate DB update became "orphans" and refused to move with groups.
>
> **The Fix**: The geometric check ("Visual Adoption") MUST remain enabled as a fallback in `useCanvasNodeSync.ts`.
> 1. Check `task.parentId` FIRST (DB Truth).
> 2. If valid, use it.
> 3. If NO parentId, perform Geometric Check (`findSectionForTask`).
> 4. If found, adopt the task and **CONVERT TO RELATIVE POSITION** to prevent jumping.
>
> **Do NOT remove this fallback logic.** It is essential for "fixing the task and group drifts" for legacy data.

## Solution

### Fix 1: Remove Canvas Reload from Sync Completion
**File**: `src/composables/app/useAppInitialization.ts`
```typescript
// Lines 193-201 - Removed canvasStore.loadFromDatabase()
if (syncCompleted) {
    await taskStore.loadFromDatabase()
    await projectStore.loadProjectsFromPouchDB()
    // REMOVED: await canvasStore.loadFromDatabase()
    // Canvas uses incremental sync via updateSectionFromSync()
}
```

### Fix 2: Lock BEFORE Store Update
**Files**: `useCanvasDragDrop.ts`, `useCanvasResize.ts`

Changed all drag/resize handlers to acquire lock before store update:
```typescript
// CORRECT ORDER:
lockPosition(newPosition)    // Lock acquired FIRST
store.update(newPosition)    // Watchers run, but lock protects
```

**Locations changed**:
- `useCanvasDragDrop.ts:320-336` - Group drag
- `useCanvasDragDrop.ts:464-469` - Task drag (with parent)
- `useCanvasDragDrop.ts:485-489` - Task drag (no parent)
- `useCanvasResize.ts:128-145` - Group resize

### Fix 3: Correct Data Structure in `updateSectionFromSync`
**File**: `src/stores/canvas.ts:661-669`
```typescript
groups.value[index] = {
    ...data,
    position: {
        x: lockedPosition.x,
        y: lockedPosition.y,
        width: lockedPosition.width,   // INSIDE position
        height: lockedPosition.height  // INSIDE position
    }
}
```

### Fix 4: Add Guard to handleDrop
**File**: `src/composables/canvas/useCanvasEvents.ts:139-141`
```typescript
if (syncNodes && !isAnyCanvasStateLocked()) {
    syncNodes()
}
```

### Fix 5: Respect Locked Positions During Node Rebuild (Jan 3, 2026)
**Issue**: Deleting a node caused OTHER nodes to reset positions. The `syncTasksToCanvas()` and `syncNodes()` functions rebuild all task nodes from `task.canvasPosition`, ignoring any locked positions.

**Root Cause**: When a task is deleted, the task watcher triggers `syncTasksToCanvas()` which rebuilds ALL remaining nodes from the task store. If any remaining tasks had recently been dragged (position locked), those locks were ignored, causing positions to reset.

**Files Fixed**:
- `src/stores/canvas.ts:236-242` - `syncTasksToCanvas()` now checks `getLockedTaskPosition()` before using `task.canvasPosition`
- `src/composables/canvas/useCanvasSync.ts:141-146` - `syncNodes()` task processing now checks `getLockedTaskPosition()` before using `task.canvasPosition`

**Code Pattern**:
```typescript
// Before: Ignored locks
let position = { ...task.canvasPosition }

// After: Respects locks
const lockedPosition = getLockedTaskPosition(task.id)
let position = lockedPosition
    ? { x: lockedPosition.x, y: lockedPosition.y }
    : { ...task.canvasPosition }
```

### Fix 6: Lock Position BEFORE Task Edit Updates (Jan 3, 2026)
**Issue**: Editing a task in the modal and saving caused the task position to reset.

**Root Cause**: The position lock was being set AFTER `updateTaskWithUndo()` was called. Since Vue watchers fire synchronously during the update, the canvas watcher would trigger `syncTasksToCanvas()` BEFORE the lock was acquired.

**Additional Issue**: TaskEditModal was importing from the OLD lock system (`canvasPositionLock.ts`) instead of the unified lock system (`canvasStateLock.ts`).

**Files Fixed**:
- `src/components/tasks/TaskEditModal.vue:297-298` - Updated import to use `canvasStateLock.ts`
- `src/components/tasks/TaskEditModal.vue:664-672` - Lock position BEFORE calling `updateTaskWithUndo()`
- `src/components/tasks/TaskEditModal.vue:577-581` - Lock position before subtask completion updates

**Code Pattern**:
```typescript
// Before: Lock AFTER update (too late!)
taskStore.updateTaskWithUndo(taskId, updates)
if (canvasPosition) {
    lockTaskPosition(taskId, canvasPosition)  // Canvas watcher already fired!
}

// After: Lock BEFORE update
if (canvasPosition) {
    lockTaskPosition(taskId, canvasPosition, 'manual')  // Lock first!
}
taskStore.updateTaskWithUndo(taskId, updates)  // Watcher fires, but position is protected
```

### Fix 7: Prevent Memory Exhaustion During Drag (Jan 3, 2026)
**Issue**: Tasks became "locked and can't be moved" after dragging due to memory exhaustion.

**Root Cause**: The drag handlers were using `updateTaskWithUndo()` which calls `saveState()` TWICE per operation (before and after). Each `saveState()` creates deep copies of ALL tasks + ALL groups. With frequent drags, this rapidly exhausted memory, causing "out of memory" exceptions and breaking drag functionality.

**Files Fixed**:
- `src/composables/canvas/useCanvasDragDrop.ts:468-472, 491-495` - Changed from `updateTaskWithUndo` to `updateTask`

**Rationale**: Position updates during drag don't need undo support - users can simply drag again to adjust. The undo system should be reserved for significant actions (task deletion, status changes, etc.).

### Fix 8: Add Lock Guard to Task Watcher (Jan 3, 2026)
**Issue**: Changing task status (e.g., marking as done) caused all task positions to reset REPEATEDLY in a cascade.

**Root Cause**: The task watcher in canvas.ts with `{ deep: true, flush: 'sync' }` was calling `syncTasksToCanvas()` for ANY task property change (including status). This watcher had NO lock check, unlike `syncNodes()`. The cascade:
1. Status change triggers task watcher → syncTasksToCanvas()
2. saveState() in undo system triggers watcher again
3. Status hash watcher triggers batchedSyncNodes()
4. Explicit requestSync() triggers syncNodes()
5. = 4+ sync cycles, each reading from database and resetting positions

**Files Fixed**:
- `src/stores/canvas.ts:312-318` - Added `isAnyCanvasStateLocked()` guard to task watcher

**Code Pattern**:
```typescript
// Before: No guard - synced for ANY task change
syncTasksToCanvas(newTasks)

// After: Respects position locks
if (!isAnyCanvasStateLocked()) {
  syncTasksToCanvas(newTasks)
} else {
  console.log('🛡️ [TASK-089] syncTasksToCanvas blocked in task watcher - canvas state locked')
}
```

### Fix 9: Await Position Saves to Prevent Data Loss on Refresh (Jan 3, 2026)
**Issue**: Task positions were lost when page refreshed immediately after dragging.

**Root Cause**: The `taskStore.updateTask()` calls in `handleNodeDragStop` were NOT awaited. Since `updateTask()` is async (it saves to PouchDB), if the page refreshed before the async save completed, the position was lost.

**Files Fixed**:
- `src/composables/canvas/useCanvasDragDrop.ts:266` - Made `handleNodeDragStop` callback async
- `src/composables/canvas/useCanvasDragDrop.ts:472-478` - Added `await` + try/catch for task-in-section position save
- `src/composables/canvas/useCanvasDragDrop.ts:499-505` - Added `await` + try/catch for free-floating task position save

**Code Pattern**:
```typescript
// Before: Fire-and-forget (could lose data on refresh)
taskStore.updateTask(node.id, {
    canvasPosition: { x: absoluteX, y: absoluteY }
})

// After: Awaited with error handling
try {
    await taskStore.updateTask(node.id, {
        canvasPosition: { x: absoluteX, y: absoluteY }
    })
} catch (err) {
    console.error(`[TASK-089] Failed to save position for task ${node.id}:`, err)
}
```

### Fix 10: Wait for Task Store to Load Before Canvas Sync (Jan 3, 2026)
**Issue**: Canvas showed empty groups on initial page load, then tasks would appear after a delay.

**Root Cause**: Vue's component lifecycle order means child component `onMounted` runs BEFORE parent component `onMounted`. CanvasView.vue mounts and calls `syncNodes()` BEFORE App.vue's `onMounted` completes the `Promise.all([taskStore.loadFromDatabase(), ...])`. This causes `syncNodes()` to run with an empty tasks array.

**Files Fixed**:
- `src/views/CanvasView.vue:2672-2684` - Added wait loop for `taskStore.isLoadingFromDatabase` before calling `syncNodes()`

**Code Pattern**:
```typescript
// Before: syncNodes() runs immediately (with empty tasks)
await canvasStore.loadFromDatabase()
syncNodes()  // Tasks not loaded yet!

// After: Wait for task store to finish loading first
if (taskStore.isLoadingFromDatabase) {
    console.log('⏳ [CANVAS] Waiting for task store to finish loading...')
    let waitAttempts = 0
    while (taskStore.isLoadingFromDatabase && waitAttempts < 50) {
        await new Promise(r => setTimeout(r, 100))
        waitAttempts++
    }
    console.log(`✅ [CANVAS] Task store ready after ${waitAttempts * 100}ms`)
}
syncNodes()  // Now tasks are loaded!
```

### Fix 11: Prioritize Database Truth for Parent Containment (Jan 11, 2026)
**Issue**: Tasks inside groups (per database) were not moving when the group was dragged.

**Root Cause**: `useCanvasNodeSync` completely ignored `task.parentId` from the store, relying 100% on geometric overlap calculation to assign the visual `parentNode`.

**Files Fixed**:
- `src/composables/canvas/useCanvasNodeSync.ts:273-306` - Added logic to check `task.parentId` BEFORE running geometric checks.

**Code Pattern**:
```typescript
// Before: Pure geometry
// If geometry check fails (even slightly), parentNode is undefined
const section = findSectionForTask(center)
if (section) { parentNode = section.id }

// After: Trust the Database First
if ((task as any).parentId) {
    // 1. Trust the store
    const parent = sections.find(s => s.id === task.parentId)
    if (parent) {
        parentNode = `section-${parent.id}`
        // 2. Calculate relative position manually to keep it visual
        position = calculateRelativePosition(...)
        skipContainmentCalc = true
    }
}
```

## Files Modified

| File | Changes |
|------|---------|
| `src/composables/app/useAppInitialization.ts` | Removed `canvasStore.loadFromDatabase()` from sync completion handler |
| `src/stores/canvas.ts` | Fixed position structure in `updateSectionFromSync()`, **Fix 5**: `syncTasksToCanvas()` respects locks, **Fix 8**: Task watcher guards against sync during locks |
| `src/composables/canvas/useCanvasDragDrop.ts` | Lock before store update (3 locations), **Fix 7**: Use `updateTask` instead of `updateTaskWithUndo`, **Fix 9**: Await position saves with error handling |
| `src/composables/canvas/useCanvasResize.ts` | Lock before store update |
| `src/composables/canvas/useCanvasEvents.ts` | Added lock guard to handleDrop |
| `src/composables/canvas/useCanvasSync.ts` | **Fix 5**: `syncNodes()` now respects locked task positions |
| `src/components/tasks/TaskEditModal.vue` | **Fix 6**: Updated import to unified lock system, lock BEFORE updates |
| `src/utils/canvasStateLock.ts` | Created in earlier session (unified lock system) |
| `src/views/CanvasView.vue` | **Fix 10**: Wait for task store to load before syncing nodes |

## Lock System Overview

The `canvasStateLock.ts` utility provides:
- **Task locks**: 7-second protection after drag
- **Group locks**: 7-second protection after drag/resize
- **Viewport locks**: 7-second protection after pan/zoom
- **Lock checking**: `isAnyCanvasStateLocked()` for guards

## Testing Verification

1. **Task Drag**: Move a task, verify it stays in place after 15+ seconds
2. **Group Drag**: Move a group, verify it stays in place after 15+ seconds
3. **Group Resize**: Resize a group, verify dimensions persist after 15+ seconds
4. **Viewport**: Pan/zoom, verify viewport persists after 15+ seconds
5. **First Move**: Verify FIRST move now works (no reset on first interaction)

## Console Indicators

When working correctly, you should see:
```
🔒 [CANVAS-LOCK] Group xxx locked at (x, y) WxH [drag/resize]
🔒 [CANVAS-LOCK] Task xxx locked at (x, y) [drag]
🛡️ [TASK-089] syncNodes blocked in syncTrigger watcher - canvas state locked
```

## Rollback Procedure

If issues occur:
1. Revert `useAppInitialization.ts` to re-add `canvasStore.loadFromDatabase()`
2. Revert lock ordering in drag/resize handlers
3. Delete `canvasStateLock.ts` and remove all imports

## Related Issues

- **BUG-055**: Canvas group resize breaks positions (fixed earlier, this completes the fix)
- **BUG-057**: Firefox/Zen browser sync issues
- **TASK-072**: Nested groups (related to position management)

## Key Learnings

1. **Lock timing matters**: Acquire locks BEFORE triggering watchers
2. **Data structure consistency**: Section positions use `position.width`, not root `width`
3. **Multiple reset vectors**: Full `loadFromDatabase()` vs incremental sync - avoid full reloads
4. **Vue reactivity**: Store updates trigger watchers synchronously - be aware of side effects
5. **Undo system memory**: `saveState()` copies ALL tasks + groups - use sparingly, especially for frequent operations like drag. Use lightweight `updateTask` for position updates.
