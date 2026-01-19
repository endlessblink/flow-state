# SOP: Canvas Position Debugging

**ID:** SOP-CANVAS-POS-001
**Created:** January 8, 2026
**Last Updated:** January 8, 2026
**Related Task:** TASK-142

## Overview

This SOP provides systematic debugging procedures for canvas position issues in Pomo-Flow, including position resets, coordinate mismatches, and lock-related problems.

## Quick Reference

### Common Symptoms & Quick Fixes

| Symptom | Likely Cause | Quick Check |
|---------|--------------|-------------|
| Position resets on refresh | Lock expired before save | Check localStorage for `canvas-locks` |
| Position snaps during drag | Competing sync | Check console for sync logs during drag |
| Child task jumps on section move | Coordinate conversion error | Verify abs/rel conversion in `positionUtils.ts` |
| Position lost after HMR | Lock not persisted | Check `canvasStateLock.ts` persistence |

## Architecture Overview

### Position Data Flow

```
User Drag → Vue Flow → useCanvasDragDrop → Lock System → Task Store → Database
                                              ↓
                          useCanvasSync ← Lock Check ← Database Sync
```

### Key Files

| File | Role | Key Functions |
|------|------|---------------|
| `src/utils/canvasStateLock.ts` | Lock management | `lockTaskPosition()`, `isTaskPositionLocked()` |
| `src/utils/canvas/positionUtils.ts` | Coordinate utilities | `getAbsolutePosition()`, `isValidPosition()` |
| `src/composables/canvas/useCanvasDragDrop.ts` | Drag handling | `handleNodeDragStop()` |
| `src/composables/canvas/useCanvasSync.ts` | Sync orchestration | `syncNodes()`, `batchedSyncNodes()` |
| `src/stores/tasks/taskOperations.ts` | Task mutations | `updateTask()` |

## Debugging Procedures

### Procedure 1: Position Reset on Page Refresh

**Symptoms:**
- Positions correct before refresh
- Positions wrong after refresh
- No errors in console

**Debugging Steps:**

1. **Check localStorage for persisted locks**
   ```javascript
   // In browser console
   JSON.parse(localStorage.getItem('canvas-position-locks'))
   ```

2. **Verify database has correct positions**
   ```javascript
   // Check task store
   const taskStore = useTaskStore()
   taskStore.tasks.map(t => ({ id: t.id, pos: t.canvasPosition }))
   ```

3. **Check if sync overwrites on load**
   - Add breakpoint at `useCanvasSync.ts:syncNodes()`
   - Refresh page
   - Check if locked positions are respected

4. **Verify lock restoration**
   ```javascript
   // In canvasStateLock.ts - check restoreLocksFromStorage()
   console.log('[DEBUG] Restored locks:', taskLocks)
   ```

**Resolution Checklist:**
- [ ] Locks persisting to localStorage correctly
- [ ] Locks restoring on page load
- [ ] `syncNodes()` checking locks before applying positions
- [ ] Database has correct position values

### Procedure 2: Position Snaps During/After Drag

**Symptoms:**
- Position correct during drag
- Position "jumps" back after release
- Multiple position changes in quick succession

**Debugging Steps:**

1. **Enable verbose drag logging**
   ```javascript
   // Add to useCanvasDragDrop.ts handleNodeDragStop
   console.log('[DRAG] Stop - position:', node.position)
   console.log('[DRAG] Stop - lock acquired:', isLocked)
   console.log('[DRAG] Stop - persisting to store...')
   ```

2. **Check for competing syncs**
   ```javascript
   // Add to useCanvasSync.ts syncNodes
   console.log('[SYNC] Running sync, locked entities:', getLockedTaskIds())
   ```

3. **Verify settling period is blocking sync**
   ```javascript
   // Check isDragSettling flag
   console.log('[SYNC] Guards:', {
     isNodeDragging: isNodeDragging.value,
     isDragSettling: isDragSettlingRef.value,
     isSyncing: isSyncing.value
   })
   ```

4. **Check lock timing**
   - Lock duration: 7 seconds (see `canvasStateLock.ts:55`)
   - Settling period: 500ms (see `useCanvasDragDrop.ts`)
   - If network slow, lock may expire before persist completes

**Resolution Checklist:**
- [ ] Lock acquired immediately on drag start
- [ ] Settling period blocking sync
- [ ] Persist completing before lock expiration
- [ ] No competing watchers triggering sync

### Procedure 3: Parent-Child Position Mismatch

**Symptoms:**
- Child tasks appear at wrong position relative to section
- Position correct in store but wrong visually
- Position changes when section moves

**Debugging Steps:**

1. **Verify coordinate system**
   ```javascript
   // Check what's stored vs. what's displayed
   const task = taskStore.getTaskById(taskId)
   console.log('[POS] Stored (absolute):', task.canvasPosition)

   const node = findNode(taskId)
   console.log('[POS] Vue Flow (relative):', node.position)
   console.log('[POS] Vue Flow computed:', node.computedPosition)
   ```

2. **Check coordinate conversion**
   ```javascript
   // In positionUtils.ts
   console.log('[CONVERT] Parent pos:', parentSection.position)
   console.log('[CONVERT] Task absolute:', absolutePos)
   console.log('[CONVERT] Calculated relative:', relativePos)
   ```

3. **Verify parent assignment**
   ```javascript
   const node = findNode(taskId)
   console.log('[PARENT] parentNode:', node.parentNode)
   console.log('[PARENT] task.sectionId:', task.sectionId)
   // These should match!
   ```

4. **Check tolerance threshold**
   - 2px tolerance in `useCanvasSync.ts:218-232`
   - If calculated differs by <2px, existing position preserved

**Resolution Checklist:**
- [ ] Task `sectionId` matches Vue Flow `parentNode`
- [ ] Absolute-to-relative conversion correct
- [ ] Relative-to-absolute conversion correct
- [ ] Section position updating correctly

### Procedure 4: Multi-Select Drag Issues

**Symptoms:**
- Some selected nodes lose position
- Positions partially saved
- Inconsistent behavior with different selection sizes

**Debugging Steps:**

1. **Log all selected nodes**
   ```javascript
   // In handleNodeDragStop
   console.log('[MULTI] Selected nodes:', selectedNodes.map(n => n.id))
   console.log('[MULTI] Positions:', selectedNodes.map(n => ({ id: n.id, pos: n.position })))
   ```

2. **Verify batch lock acquisition**
   ```javascript
   // Check if all nodes locked
   selectedNodes.forEach(n => {
     console.log(`[LOCK] ${n.id}:`, isTaskPositionLocked(n.id))
   })
   ```

3. **Check batch persistence**
   ```javascript
   // Verify all updates sent to store
   console.log('[PERSIST] Batch update count:', updates.length)
   ```

4. **Check for race conditions**
   - Multiple locks acquired sequentially vs. simultaneously
   - Store updates batched vs. individual

**Resolution Checklist:**
- [ ] All selected nodes getting locked
- [ ] Batch update atomic
- [ ] No partial failures in persist

### Procedure 5: HMR Position Loss (Development)

**Symptoms:**
- Position correct before file save
- Position resets after HMR
- Only happens in dev mode

**Debugging Steps:**

1. **Check lock persistence timing**
   ```javascript
   // Before HMR
   console.log('[HMR] Pre-save locks:', localStorage.getItem('canvas-position-locks'))

   // After HMR
   console.log('[HMR] Post-reload locks:', localStorage.getItem('canvas-position-locks'))
   ```

2. **Verify Pinia state preservation**
   ```javascript
   // Check if Pinia hot module is configured
   // See stores for `if (import.meta.hot)` blocks
   ```

3. **Check Vue Flow instance recreation**
   - Vue Flow may recreate nodes on component remount
   - `syncNodes()` should restore from store

4. **Verify viewport persistence**
   ```javascript
   // Check canvasStateLock.ts for viewport lock
   console.log('[HMR] Viewport lock:', getLockedViewport())
   ```

**Resolution Checklist:**
- [ ] Locks persisting to localStorage before HMR
- [ ] Locks restoring after component remount
- [ ] Pinia state preserved across HMR
- [ ] `syncNodes()` respecting restored locks

## Diagnostic Tools

### Console Commands

```javascript
// Get all current locks
getAllPositionLocks()

// Check specific task lock
isTaskPositionLocked('task-123')

// Get locked position (if any)
getLockedTaskPosition('task-123')

// Force clear all locks (DANGEROUS - use for debugging only)
clearAllPositionLocks()

// Check sync state
{ isNodeDragging, isDragSettling, isSyncing, isResizing }
```

### Useful Breakpoints

| File | Line | Purpose |
|------|------|---------|
| `useCanvasDragDrop.ts` | `handleNodeDragStop` start | Catch drag completion |
| `useCanvasSync.ts` | `syncNodes` entry | Catch sync trigger |
| `taskOperations.ts` | `updateTask` position check | Catch position updates |
| `canvasStateLock.ts` | `lockTaskPosition` | Catch lock acquisition |

### Logging Flags

Add these to enable verbose logging:

```javascript
// In useCanvasSync.ts
const DEBUG_SYNC = true

// In useCanvasDragDrop.ts
const DEBUG_DRAG = true

// In canvasStateLock.ts
const DEBUG_LOCKS = true
```

## Common Fixes

### Fix 1: Extend Lock Duration

If positions reset due to slow network:

```typescript
// In canvasStateLock.ts
const LOCK_DURATION_MS = 15000 // Increase from 7s to 15s
```

### Fix 2: Add Missing Lock Check

If sync overwrites during drag:

```typescript
// In useCanvasSync.ts syncNodes()
if (isTaskPositionLocked(task.id)) {
  const locked = getLockedTaskPosition(task.id)
  position = { x: locked.x, y: locked.y }
}
```

### Fix 3: Force Persist Before Lock Expiry

```typescript
// In useCanvasDragDrop.ts handleNodeDragStop
await taskStore.updateTask(taskId, { canvasPosition: pos })
await taskStore.forcePersist() // Ensure DB write
releaseTaskPositionLock(taskId) // Only after persist confirmed
```

## Escalation

If debugging procedures don't resolve the issue:

1. Check `plans/canvas-position-system-refactor.md` for planned improvements
2. Review `plans/canvas-view-stabilization-eliminate-resets.md` for historical context
3. Search memory for related session observations (use `mem-search` skill)
4. Create new bug entry in `docs/MASTER_PLAN.md`

## Related Documentation

- [Architecture: Canvas System](../claude-md-extension/architecture.md)
- [Plan: Position System Refactor](../../plans/canvas-position-system-refactor.md)
- [Previous Stabilization Work](../../plans/canvas-view-stabilization-eliminate-resets.md)
