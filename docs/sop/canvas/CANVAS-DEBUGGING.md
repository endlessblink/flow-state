# Canvas Debugging Guide

**Last Updated**: January 18, 2026
**Components**: `CanvasView`, `Sync`, `Locking System`
**Related SOPs**: [CANVAS-POSITION-SYSTEM](./CANVAS-POSITION-SYSTEM.md)

---

## 1. Architecture & Data Flow

Understanding the flow of position data is critical for debugging.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User Drag   │────→│  Lock System │────→│  Task Store  │
└──────────────┘     └──────────────┘     └──────┬───────┘
       │                                         │
       ▼                                         ▼
┌──────────────┐                          ┌──────────────┐
│   Vue Flow   │◄──── 🛡️ Lock Check ◄────│   Database   │
└──────────────┘                          └──────────────┘
```

**Key Concept**: The **Lock System** acts as a shield. When a user moves a node, we "lock" that node's position for **7 seconds**. If a background sync occurs during this window (e.g., from a watcher), the sync engine sees the lock and uses the *locked* position instead of the (potentially stale) database position.

---

## 2. Common Symptoms & Root Causes

| Symptom | Probable Cause | Fix to Check |
|---------|----------------|--------------|
| **Position Reset** (10s after move) | Sync triggered w/o lock check OR lock expired. | Verify `lockNode` called before store update. Extent lock duration if network slow. |
| **"Bouncing" Task** | Double conversion (Abs->Rel->Abs). | Check `nodeBuilder` conversion logic. |
| **Ghost Task** (Visible but unclickable) | ID mismatch between Store/VueFlow. | Check `CanvasIds` helper usage. |
| **Parent-Child Drift** | `parentId` set but `parentNode` undefined. | Verify `spatialContainment` logic and `breakGroupCycles`. |
| **Infinite Loop** | `deep: true` watcher on tasks. | Remove deep watcher. Use hash-based watcher. |

---

## 3. Diagnostic Tools (Console)

You can inspect the state of the canvas system directly from the browser console.

### Lock System
```typescript
// Check if a specific task is locked
isTaskPositionLocked('task-123')

// Get the locked position (if any)
getLockedTaskPosition('task-123')

// View all active locks
getAllPositionLocks()

// Force clear locks (Use with caution)
clearAllPositionLocks()
```

### Sync State
```typescript
// Check guard flags
console.log({
  isNodeDragging: isNodeDragging.value,
  isDragSettling: isDragSettlingRef.value,
  isSyncing: isSyncing.value
})
```

---

## 4. Debugging Procedures

### Procedure A: Analyzing a "Position Jump"
1.  **Enable Logging**: Add `[CANVAS-LOCK]` and `[SYNC]` to your console filter.
2.  **Reproduce**: Move the task.
3.  **Observe**:
    *   Do you see `🔒 [CANVAS-LOCK] ...` immediately?
    *   Do you see `🛡️ [SYNC-BLOCK] ...` during the settling period?
    *   Does a `[SYNC]` occur *after* the lock expires (7s)?

**If lock never appears**: The drag handler failed to acquire lock.
**If sync happens without block**: The sync path is missing a `isAnyCanvasStateLocked()` check.

### Procedure B: Debugging Parent/Child Mismatches
1.  **Check Store State**:
    ```javascript
    const task = taskStore.getTaskById('task-1')
    console.log(task.parentId, task.canvasPosition)
    ```
2.  **Check Vue Flow State**:
    ```javascript
    const node = findNode('task-1')
    console.log(node.parentNode, node.position)
    ```
3.  **Compare**:
    *   If `task.parentId` exists but `node.parentNode` is undefined, the `nodeBuilder` failed to map the relationship.
    *   If `node.position` is absolute coordinates but it has a parent, standard relative sizing is broken.

### Procedure C: Visual Regression Testing
For critical bugs, creating a Playwright test is mandatory.
Refer to `tests/canvas.spec.ts` for examples of:
*   Task Edit stability tests
*   Drag & Drop verification
*   Nested group containment tests

---

## 5. Critical Log Prefixes

Filter via `consoleFilter.ts` to see these:
*   `[CANVAS-LOCK]`: Lock acquisition and release.
*   `[GEOMETRY-DRAG]`: User-initiated geometry changes.
*   `[NODE-SYNC]`: Database writes.
*   `[INVARIANT]`: Hierarchy/Geometry violations.
*   `[RECONCILE]`: Automatic parent ID fixups.

---

## 6. Known "Heisenbugs"

*   **Float Precision**: Tasks exactly on a group border (e.g., 299.99px vs 300px) may flip parentage. *Fix: Use epsilon tolerance (0.5px).*
*   **HMR Reset**: Hot Module Reload often clears locks in development. *Fix: Don't rely on generic HMR for state; use hard refresh if positions get weird.*
