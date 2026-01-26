# Pending-Write Registry (High Severity Issue #7)

## Problem

When a user drags a task on the canvas, there is a race condition between:
1. The drag operation saving the new position to the database
2. Realtime sync receiving position updates from other clients

**Race Scenario:**
```
Time  | Local Client           | Realtime Sync
------|------------------------|------------------
T0    | User drags task to A   |
T1    | Start save(A)          | Receive update(B)
T2    | Save(A) pending...     | Apply update(B) ✗ OVERWRITES
T3    | Save(A) completes ✗    | (position is now B, not A)
```

The user sees the task "jump back" to position B after dragging it to position A.

## Solution: Pending-Write Registry

A Set-based registry that tracks task IDs currently being written (dragged). Realtime sync checks this registry and skips updates for tasks that are pending local write.

### Architecture

```
┌─────────────────┐
│  Task Store     │
│  ┌───────────┐  │
│  │ Pending   │  │ <- Set<string> of task IDs
│  │ Writes    │  │
│  └───────────┘  │
└─────────────────┘
         ↑
         │ addPendingWrite(id)
         │ removePendingWrite(id)
         │ isPendingWrite(id)
         │
    ┌────┴─────┐
    │          │
┌───┴────┐ ┌──┴────────┐
│ Drag   │ │ Realtime  │
│ Handler│ │ Sync      │
└────────┘ └───────────┘
```

### Implementation

**Files Modified:**
1. `src/stores/tasks.ts` - Registry state and helpers
2. `src/composables/app/useAppInitialization.ts` - Realtime sync guard
3. `src/composables/canvas/useCanvasInteractions.ts` - Drag handlers

**Registry API:**

```typescript
// Add task to pending-write registry
taskStore.addPendingWrite(taskId: string)

// Remove task from registry
taskStore.removePendingWrite(taskId: string)

// Check if task is pending write
taskStore.isPendingWrite(taskId: string): boolean
```

**Safety Features:**
- Auto-cleanup after 5 seconds (safety net for crashed drag operations)
- Set-based (no duplicate entries)
- Thread-safe (synchronous operations)

### Usage Pattern

**Drag Handler:**
```typescript
// Mark task as pending write before save
taskStore.addPendingWrite(task.id)

try {
  await taskStore.updateTask(task.id, updates, 'DRAG')
} finally {
  // Always clear, even on error
  taskStore.removePendingWrite(task.id)
}
```

**Realtime Sync Handler:**
```typescript
const onTaskChange = (payload: any) => {
  const taskId = payload.new?.id || payload.old?.id

  // Skip if task is pending local write
  if (taskStore.isPendingWrite(taskId)) {
    console.log(`[REALTIME] Skipping task ${taskId} - pending local write`)
    return
  }

  // Proceed with sync update
  taskStore.updateTaskFromSync(taskId, payload.new, false)
}
```

## Edge Cases Handled

### 1. Concurrent Drags
Multiple tasks can be dragged simultaneously. Each gets its own entry in the Set.

```typescript
taskStore.addPendingWrite('task-1')
taskStore.addPendingWrite('task-2')

// Both block realtime sync
taskStore.isPendingWrite('task-1') // true
taskStore.isPendingWrite('task-2') // true
```

### 2. Drag Failure
If drag operation throws an error, the `finally` block ensures cleanup.

```typescript
try {
  await taskStore.updateTask(task.id, updates, 'DRAG')
} finally {
  taskStore.removePendingWrite(task.id) // Always runs
}
```

### 3. Stale Pending Writes
If a drag handler crashes and never calls `removePendingWrite`, the 5-second auto-cleanup timer prevents permanent blocking.

```typescript
taskStore.addPendingWrite(taskId)
// Auto-clears after 5000ms
setTimeout(() => pendingWrites.value.delete(taskId), 5000)
```

### 4. Duplicate Adds
Set behavior prevents duplicate entries.

```typescript
taskStore.addPendingWrite('task-1')
taskStore.addPendingWrite('task-1') // No-op (Set deduplicates)
taskStore.removePendingWrite('task-1') // Single remove clears
```

## Testing

**Unit Tests:** `tests/unit/pending-write-registry.test.ts`
- Registry add/remove/check operations
- Auto-cleanup after 5 seconds
- Multiple concurrent tasks
- Duplicate handling

**Integration Tests:** `tests/unit/realtime-drag-race-protection.test.ts`
- Block realtime sync during drag
- Prevent position overwrite race condition
- Allow sync after drag completes
- Concurrent drag operations

**All 9 tests pass.**

## Performance Impact

- **Memory:** O(n) where n = number of concurrent drags (typically 1-3)
- **Time:** O(1) for all operations (Set lookups)
- **Network:** No change (same number of DB saves)

## Limitations

1. **5-Second Safety Net:** If a drag operation takes >5 seconds, the safety net may clear the flag prematurely. This is acceptable since 5 seconds is far beyond normal drag duration (<1s).

2. **Per-Store:** Registry is per-store instance. If multiple stores exist (e.g., in tests), each has its own registry. This is correct behavior.

3. **Task IDs Only:** Registry tracks task IDs, not group IDs. Groups use the same drag handlers but may not need the same protection (groups don't have the same realtime sync frequency).

## Monitoring

To verify the registry is working in production:

```javascript
// Check pending writes
const pendingCount = taskStore.isPendingWrite ? 1 : 0

// Look for this log in realtime sync
// "[REALTIME] Skipping task XXX - pending local write"
```

## Future Improvements

1. **Metrics:** Track how often realtime sync is blocked (measure effectiveness)
2. **Group Support:** Extend to group drag operations if needed
3. **Adaptive Timeout:** Make the 5-second timeout configurable
4. **Telemetry:** Log when auto-cleanup triggers (indicates crashed drag)

## Related Issues

- BUG-1051: Sync race condition (timestamp-based protection)
- TASK-1083: Position version conflicts (version-based protection)
- BUG-1061: Drag/sync reactive loops (canvas sync protection)

This pending-write registry adds a 4th layer of protection specifically for the window between drag start and save completion.

---

**Implementation Date:** 2026-01-26
**Status:** ✅ Complete
**Tests:** 9/9 passing
