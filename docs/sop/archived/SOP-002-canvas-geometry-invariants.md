# SOP-002: Canvas Geometry Invariants

**Created**: January 13, 2026
**Related Task**: TASK-255
**Severity**: P0-CRITICAL
**Component**: Canvas System (Vue Flow + Pinia + Supabase)

---

## Problem Statement

The canvas system experienced position drift and "jumping" tasks/groups when multiple code paths mutated geometry properties (position, parentId). This caused:
- Tasks/groups moving unexpectedly during sync operations
- Positions resetting after Smart-Group property application
- Feedback loops where sync → update → sync → update...

### Root Cause

Multiple uncoordinated writers to geometry properties:
- Drag handlers (intended)
- Smart-Group logic (unintended)
- Sync retry mechanisms (unintended)
- Watchers on store changes (unintended)

---

## Core Invariants

### Invariant 1: Single Writer for Geometry

**Only these code paths may mutate geometry properties:**

| Property | Allowed Writers |
|----------|-----------------|
| `task.parentId` | Drag handlers, explicit move actions |
| `task.canvasPosition` | Drag handlers, task creation, move-to-inbox |
| `group.parentGroupId` | Drag handlers |
| `group.position` | Drag handlers, group resize |

**All other modules must treat geometry as READ-ONLY.**

### Invariant 2: Sync is Projection Only

The sync layer (`useCanvasSync.ts`) reads store state and projects it to Vue Flow nodes.

**Sync MUST NEVER:**
- Call `updateTask()` or `updateGroup()`
- Directly mutate `parentId`, `position`, or `canvasPosition`
- Write back to the store on mismatch or retry failure

**Sync MAY:**
- Read from stores
- Call `setNodes()` to update Vue Flow display
- Update `nodeVersionMap` (metadata, not user data)

### Invariant 3: Metadata vs Layout Separation

Smart-Groups and business logic:
- **MAY update**: `dueDate`, `status`, `priority`, `tags`, `duration`
- **MUST NOT update**: `parentId`, `canvasPosition`, `parentGroupId`, `position`

---

## Allowed Geometry Writers (Reference)

| File | Function | What it Writes | Classification |
|------|----------|----------------|----------------|
| `useCanvasInteractions.ts:545` | `onMoveEnd()` | `parentId`, `canvasPosition` | **ALLOWED** - Primary drag handler |
| `useCanvasTaskActions.ts:104` | `handleQuickTaskCreate()` | `canvasPosition`, `parentId` | **ALLOWED** - Task creation |
| `useCanvasTaskActions.ts:145` | `moveSelectedTasksToInbox()` | `canvasPosition = undefined` | **ALLOWED** - Explicit move |
| `spatialContainment.ts:247` | `reconcileTaskParentsByContainment()` | `parentId` | **CONTROLLED** - One-time on load |
| `canvas.ts:86` | `breakGroupCycles()` | `parentGroupId = null` | **CONTROLLED** - Safety fix on load |

---

## Disabled Features (Feature Flags)

These features contain geometry writes and are disabled to prevent drift:

### 1. Midnight Task Mover
- **File**: `src/composables/canvas/useMidnightTaskMover.ts`
- **Flag**: `ENABLE_MIDNIGHT_TASK_MOVER = false`
- **What it does**: Moves tasks from "Today" to "Overdue" at midnight
- **Why disabled**: Mutates `canvasPosition`, causes drift

### 2. Overdue Task Collector
- **File**: `src/composables/canvas/useCanvasOverdueCollector.ts`
- **Flag**: `ENABLE_SMART_GROUP_REPARENTING = false`
- **What it does**: Auto-collects overdue tasks into Overdue group
- **Why disabled**: Mutates `canvasPosition`, triggers sync cascades

---

## Drift Detection

### Console Warnings

The task store logs geometry changes with their source:

```
📍 [GEOMETRY-DRAG] Task abc123... parentId: "none" → "group-xyz"
📍 [GEOMETRY-USER] Task abc123... pos: (100,200) → (300,400)
⚠️ [GEOMETRY-DRIFT] Source 'SYNC' is changing geometry - this may cause position drift!
```

### Source Parameter

`updateTask()` accepts an optional source parameter:

```typescript
taskStore.updateTask(taskId, updates, 'DRAG')  // Allowed
taskStore.updateTask(taskId, updates, 'SMART-GROUP')  // Warning if geometry
taskStore.updateTask(taskId, updates, 'SYNC')  // Warning if geometry
```

**Valid sources**: `'DRAG' | 'RECONCILE' | 'USER' | 'SYNC' | 'SMART-GROUP'`

---

## How to Add New Geometry Features Safely

### Checklist

1. [ ] Does the feature NEED to change position/parent, or can it work with metadata only?
2. [ ] Is this a user-initiated action (allowed) or automated process (requires review)?
3. [ ] Add feature flag if automated (disabled by default)
4. [ ] Use correct source parameter: `updateTask(id, updates, 'DRAG')` or appropriate source
5. [ ] Test: Does dragging a task still work after your change?
6. [ ] Test: Does page refresh preserve positions?
7. [ ] Test: Do Smart-Group drops only change metadata, not position?

### Safe Pattern for New Features

```typescript
// If you MUST add geometry writes:

// 1. Add feature flag
const ENABLE_MY_FEATURE = false

// 2. Guard the feature
if (!ENABLE_MY_FEATURE) {
    return { success: false, reason: 'feature-disabled' }
}

// 3. Use correct source
taskStore.updateTask(taskId, {
    canvasPosition: newPos,
    parentId: newParentId
}, 'USER')  // or 'DRAG' if triggered by drag

// 4. Add invariant comment
// GEOMETRY WRITER: [Feature name] (TASK-XXX)
```

---

## Sync Request Control

### Controlled Sync Triggering

Sync requests must go through `requestSync(source)`:

```typescript
// In canvasUi.ts
const USER_ACTION_SOURCES = [
    'user:drag-drop',
    'user:create',
    'user:delete',
    'user:resize',
    // ...
] as const

const requestSync = (source: SyncSource) => {
    if (isUserAction) {
        syncTrigger.value++  // Allowed
    } else {
        console.log(`⏭️ [SYNC-TRIGGER] Blocked from ${source}`)  // Logged but ignored
    }
}
```

**Never increment `syncTrigger` directly.** Always use `requestSync(source)`.

---

## Related Documentation

- **Architecture**: `docs/sop/canvas-architecture.md`
- **Coordinate System**: `src/utils/canvas/coordinates.ts`
- **Read-Only Contract**: `src/composables/canvas/useCanvasSync.ts:125-139`

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-01-13 | Initial SOP creation (TASK-255) | Claude |
