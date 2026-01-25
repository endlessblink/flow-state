# SOP-035: Realtime Sync Position Preservation

**Created**: 2026-01-25
**Related Task**: BUG-1074
**Status**: Active

## Problem

When users move tasks to inbox from the canvas, tasks stay on the canvas instead of moving to inbox. Console logs show `[SYNC-PARENT-CHANGE]` indicating tasks lose their group assignment.

### Root Cause

In `src/stores/tasks.ts`, the "preserve local position" mechanism was too aggressive:

```typescript
// BEFORE (buggy)
if (currentTask.canvasPosition && !normalizedTask.canvasPosition) {
    normalizedTask.canvasPosition = currentTask.canvasPosition  // Restores position
    normalizedTask.isInInbox = currentTask.isInInbox            // Restores isInInbox
    // BUG: parentId was NOT restored!
}
```

**Two bugs in this code:**
1. When `isInInbox: true` (intentional inbox move), position was still being restored - blocking the move
2. When restoring position, `parentId` wasn't restored - causing tasks to lose their group

### Timeline of the Bug

1. Task has `canvasPosition: {x,y}`, `parentId: "group-1"`
2. User clicks "Delete to Inbox"
3. Task updated locally: `canvasPosition: undefined, isInInbox: true`
4. Saved to Supabase: `position: null`
5. Realtime returns: `canvasPosition: undefined, parentId: undefined`
6. Position preservation kicks in (local has position, incoming doesn't)
7. `canvasPosition` is restored → task stays on canvas
8. `parentId` stays `undefined` → task loses its group

## Solution

Add two fixes to the position preservation logic:

```typescript
// AFTER (fixed)
if (currentTask.canvasPosition && !normalizedTask.canvasPosition) {
    // BUG-1074 FIX: Only preserve if NOT an intentional inbox move
    if (!normalizedTask.isInInbox) {
        normalizedTask.canvasPosition = currentTask.canvasPosition
        normalizedTask.isInInbox = currentTask.isInInbox
        normalizedTask.parentId = currentTask.parentId  // Also restore parentId
    }
}
```

### Fix Details

1. **Check `isInInbox` flag**: When `normalizedTask.isInInbox` is `true`, the user explicitly wants to move to inbox - skip position restoration
2. **Restore `parentId`**: When preserving position for sync events, also restore `parentId` to prevent tasks losing their group

## Key Files

- `src/stores/tasks.ts` (lines 247-255) - The `updateTaskFromSync` function contains the position preservation logic

## Verification

1. Create a task inside a group on the canvas
2. Select task → Right-click → "Move to Inbox" (or press Delete)
3. **Verify**: Task disappears from canvas and appears in Inbox panel
4. **Verify**: No `[SYNC-PARENT-CHANGE]` console logs showing task losing its group

### Position Preservation Still Works

1. Open app in two browser tabs
2. In Tab A: Drag a task to new position
3. **Verify**: Task doesn't jump around due to sync
4. In Tab A: Move task to inbox
5. **Verify**: Task properly moves to inbox (doesn't stay on canvas)

## Related SOPs

- [CANVAS-POSITION-SYSTEM.md](canvas/CANVAS-POSITION-SYSTEM.md) - Canvas geometry invariants
- [SOP-032-store-auth-initialization.md](SOP-032-store-auth-initialization.md) - Auth-aware store initialization
