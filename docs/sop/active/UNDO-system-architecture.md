# SOP: Undo/Redo System Architecture & Troubleshooting

**Date**: January 18, 2026
**Status**: Reference
**Category**: UNDO
**Priority**: P2-MEDIUM
**Related**: BUG-026, BUG-027, BUG-309-B, TASK-139, TASK-140

## Overview

The FlowState undo/redo system uses a singleton pattern with VueUse's `useManualRefHistory` enhanced by **operation-scoped selective restoration** (BUG-309-B). This prevents position drift where undoing one operation incorrectly affects unrelated entities.

### Key Architectural Principle (BUG-309-B)

**Problem Solved**: Full-state snapshots caused position drift - undoing Task B's creation would revert Task A's position to when the snapshot was taken.

**Solution**: Operation-scoped undo tracks which entities were affected by each operation and only restores those entities during undo/redo.

## System Architecture

### Core Components

| File | Purpose |
|------|---------|
| `src/composables/undoSingleton.ts` | Singleton undo system with `useManualRefHistory` |
| `src/composables/useGlobalKeyboardHandler.ts` | Global Ctrl+Z/Ctrl+Shift+Z keyboard handler |
| `src/composables/useUndoRedo.ts` | Bridge composable for components |
| `src/stores/tasks.ts` | Task operations that trigger undo commits |

### Singleton Pattern

```typescript
// undoSingleton.ts - Core singleton
let refHistoryInstance: ReturnType<typeof useManualRefHistory<UndoRedoState>> | null = null

export function getUndoSystem() {
  if (!refHistoryInstance) {
    refHistoryInstance = useManualRefHistory<UndoRedoState>(state, { capacity: 50 })
  }
  return refHistoryInstance
}
```

### State Structure

```typescript
interface UndoRedoState {
  tasks: Task[]
  groups: CanvasGroup[]
}
```

---

## Operation-Scoped Undo System (BUG-309-B)

### The Position Drift Problem

**Before BUG-309-B fix**:
```
1. User moves Task A to (300, 400)
2. User creates Task B → snapshot captures ALL positions including Task A at (300, 400)
3. User moves Task A to (500, 600)
4. User presses Ctrl+Z to undo Task B creation
5. PROBLEM: Task A jumps back to (300, 400) because full state was restored
```

**After BUG-309-B fix**:
```
1. User moves Task A to (300, 400)
2. User creates Task B → operation tracked: {type: 'task-create', affectedIds: [taskB.id]}
3. User moves Task A to (500, 600)
4. User presses Ctrl+Z to undo Task B creation
5. CORRECT: Only Task B is deleted, Task A stays at (500, 600)
```

### Operation Types

| Type | Description | Undo Action | Redo Action |
|------|-------------|-------------|-------------|
| `task-create` | New task created | Delete the task | Recreate the task |
| `task-delete` | Task deleted | Restore from snapshot | Delete again |
| `task-update` | Task metadata changed | Restore previous state | Reapply changes |
| `task-move` | Task position/parent changed | Restore previous position | Reapply position |
| `task-bulk-delete` | Multiple tasks deleted | Restore all tasks | Delete all again |
| `group-create` | New group created | Delete the group | Recreate the group |
| `group-delete` | Group deleted | Restore from snapshot | Delete again |
| `group-update` | Group metadata changed | Restore previous state | Reapply changes |
| `group-resize` | Group size changed | Restore previous dimensions | Reapply dimensions |
| `legacy` | Pre-BUG-309-B entries | Full state restoration | Full state restoration |

### Operation Interface

```typescript
interface UndoOperation {
  type: UndoOperationType
  affectedIds: string[]  // Which tasks/groups were modified
  description: string    // Human-readable for debugging
  timestamp: number      // When the operation occurred
}

interface OperationSnapshot {
  operation: UndoOperation
  snapshotBefore: UnifiedUndoState  // State before operation (for undo)
  snapshotAfter: UnifiedUndoState   // State after operation (for redo)
}
```

### Using the Operation-Aware API

**Pattern for custom operations**:
```typescript
import { getUndoSystem } from '@/composables/undoSingleton'

const undoSystem = getUndoSystem()

// Step 1: Begin operation BEFORE making changes
await undoSystem.beginOperation({
  type: 'task-update',
  affectedIds: [taskId],
  description: `Update task: ${task.title}`
})

// Step 2: Perform the actual operation
taskStore.updateTask(taskId, updates)

// Step 3: Commit the operation AFTER changes complete
await undoSystem.commitOperation()
```

**Built-in operations** (already use operation-aware pattern):
- `createTaskWithUndo(taskData)`
- `updateTaskWithUndo(taskId, updates)`
- `deleteTaskWithUndo(taskId)`
- `bulkDeleteTasksWithUndo(taskIds)`
- `createGroupWithUndo(groupData)`
- `updateGroupWithUndo(groupId, updates)`
- `deleteGroupWithUndo(groupId)`

### Selective Restoration Logic

The `performSelectiveUndo()` function handles each operation type differently:

```typescript
switch (operation.type) {
  case 'task-create':
    // Undo = delete only the created task
    await taskStore.deleteTask(operation.affectedIds[0])
    break

  case 'task-delete':
    // Undo = restore only the deleted task from snapshot
    const deletedTask = snapshotBefore.tasks.find(t => t.id === taskId)
    await taskStore.createTask(deletedTask)
    break

  case 'task-move':
    // Undo = restore only the moved task's position
    const previousTask = snapshotBefore.tasks.find(t => t.id === taskId)
    taskStore.updateTask(taskId, {
      canvasPosition: previousTask.canvasPosition,
      parentId: previousTask.parentId
    })
    break

  case 'legacy':
    // Fall back to full-state restoration for backward compatibility
    canvasStore.setGroups([...snapshotBefore.groups])
    await taskStore.restoreState(snapshotBefore.tasks)
    break
}
```

### Debugging Operation Stack

```typescript
const undoSystem = getUndoSystem()

// Check operation stack state
console.log('Operation stack:', undoSystem.getOperationStack())
console.log('Redo stack:', undoSystem.getRedoOperationStack())
console.log('Is operation-aware mode:', undoSystem.isOperationAwareMode())
```

---

### Three Intentional Undo Systems

| System | Scope | Purpose |
|--------|-------|---------|
| Main Singleton | App-wide | Task/group state for Board and Canvas views |
| QuickSort Local | QuickSortView only | Local stack for quick sort operations |
| TiptapEditor Built-in | Editor only | Uses Tiptap's native undo/redo |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+Y` | Redo (alternative) |

### Handler Priority

The global keyboard handler operates in **bubble phase** to avoid conflicts:

```typescript
// globalKeyboardHandlerSimple.ts
document.addEventListener('keydown', handler, false) // bubble phase
```

## Common Issues & Solutions

### Issue 1: Undo Not Working

**Symptoms**: Ctrl+Z has no effect

**Checklist**:
1. Check if focus is on an input/textarea (undo is blocked for editable elements)
2. Verify keyboard handler is initialized: look for `✅ Global keyboard handler initialized` in console
3. Check undo history count in console: `🔍 [UNDO-DEBUG] undoCount: X`

**Solution**: Ensure focus is not on an input element before pressing Ctrl+Z

### Issue 2: Excessive Console Logging

**Symptoms**: Console flooded with sync messages

**Root Cause**: Debug logging in sync functions

**Solution**: Comment out or wrap logs in DEV check:
```typescript
// Example fix from BUG-026
// BUG-026: Disabled excessive logging - fires hundreds of times per second
// console.log(`🔗 [SYNC-EDGES] Synced ${validEdges.length} edges`)
```

### Issue 3: Undo History Lost on Refresh

**Symptoms**: Can't undo actions from before page refresh

**Current Status**: Expected behavior (TASK-139 planned to fix)

**Workaround**: None currently - use undo before refreshing

## Verification Steps

### Testing Undo/Redo

1. Create a new task
2. Verify console shows: `✅ Task created: [name]` and `💾 [UNDO-DEBUG] Saving state`
3. Press Ctrl+Z
4. Verify console shows: `↩️ UNDO WORKING NOW` and `✅ Undo successful`
5. Task should disappear
6. Press Ctrl+Shift+Z
7. Verify console shows: `🔄 Redo shortcut detected` and `✅ Redo successful`
8. Task should reappear

### Expected Console Messages

**On task creation**:
```
➕ createTaskWithUndo called with: {title: ...}
💾 [UNDO-DEBUG] Saving state: X canvas tasks, Y groups
✅ Task created: [task name]
```

**On undo**:
```
↩️ UNDO WORKING NOW - Undo shortcut detected (Ctrl+Z)
🔄 [UNDO] Restoring: X tasks, Y groups
✅ Undo successful - task(s) should be restored
```

**On redo**:
```
🔄 Redo shortcut detected (Ctrl+Shift+Z)
🔄 [REDO] Restoring: X tasks, Y groups
✅ Redo successful - task(s) should be re-applied
```

## Related Files

- `src/composables/undoSingleton.ts` - Core undo system
- `src/composables/useGlobalKeyboardHandler.ts` - Keyboard shortcuts
- `src/composables/canvas/useCanvasSync.ts` - Canvas sync (BUG-026 fix location)
- `src/stores/tasks.ts` - Task operations with undo integration

## History

| Date | Change |
|------|--------|
| Jan 18, 2026 | **BUG-309-B**: Implemented operation-scoped undo to fix position drift |
| Jan 18, 2026 | Added `UndoOperation` interface and operation stack |
| Jan 18, 2026 | Added `beginOperation()` / `commitOperation()` API |
| Jan 18, 2026 | Updated all `*WithUndo` functions to use operation-aware pattern |
| Jan 8, 2026 | BUG-026: Fixed excessive SYNC-EDGES logging |
| Jan 8, 2026 | BUG-027: Closed as NOT A BUG (was HMR behavior) |
| Jan 8, 2026 | Verified undo/redo working on Board and Canvas views |
