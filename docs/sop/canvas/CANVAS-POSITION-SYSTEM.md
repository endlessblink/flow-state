# Canvas Position System & Architecture

**Last Updated**: January 18, 2026
**Components**: `CanvasView`, `useCanvasStore`, `VueFlow`, `Supabase`
**Related SOPs**: [CANVAS-DRAG-DROP](./CANVAS-DRAG-DROP.md), [CANVAS-DEBUGGING](./CANVAS-DEBUGGING.md)

---

## 1. Overview

The Canvas feature provides a free-form spatial view for tasks and groups using Vue Flow. It relies on a "Fast-Read, Robust-Write" architecture where the database acts as the single source of truth using **absolute world coordinates**.

### Core Principles
1.  **Fully Absolute Storage**: All positions in DB/Store are absolute. Relative positions exist ONLY in the Vue Flow display layer.
2.  **Single Writer**: Only drag handlers and specific user actions (create/move) can mutate geometry. Sync is read-only.
3.  **Optimistic Locking**: Use `position_version` to handle concurrent edits across devices.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CANVAS SYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────┐     ┌─────────────────────┐     ┌────────────────┐  │
│  │   CanvasView.vue   │────→│ useCanvasOrchestrator│────→│  Vue Flow API  │  │
│  │   (Entry Point)    │     │   (Coordinator)      │     │  (Rendering)   │  │
│  └────────────────────┘     └──────────┬──────────┘     └────────────────┘  │
│                                        │                                     │
│            ┌───────────────────────────┼───────────────────────────┐         │
│            │                           │                           │         │
│            ▼                           ▼                           ▼         │
│  ┌─────────────────┐       ┌─────────────────┐        ┌─────────────────┐   │
│  │ useCanvasSync   │       │useCanvasInteract│        │  useNodeSync    │   │
│  │ (READ PATH)     │       │   (Handlers)    │        │  (WRITE PATH)   │   │
│  │ DB → Vue Flow   │       │ Drag/Resize/Sel │        │  Vue Flow → DB  │   │
│  └────────┬────────┘       └────────┬────────┘        └────────┬────────┘   │
│           │                         │                          │            │
│           └─────────────────────────┼──────────────────────────┘            │
│                                     │                                        │
│                                     ▼                                        │
│                          ┌─────────────────────┐                            │
│                          │    canvasStore      │                            │
│                          │  (Pinia - State)    │                            │
│                          │  groups, viewport   │                            │
│                          └──────────┬──────────┘                            │
│                                     │                                        │
│                                     ▼                                        │
│                          ┌─────────────────────┐                            │
│                          │     Supabase        │                            │
│                          │  (PostgreSQL + RLS) │                            │
│                          │  groups, tasks      │                            │
│                          └─────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Coordinate System

The system uses a strict separation between stored data (Absolute) and display data (Relative).

### Golden Rule
**`task.canvasPosition` is always ABSOLUTE.** The node builder handles conversion to relative for Vue Flow when needed.

### Coordinate Types

| Storage Location | Coordinate Type | Notes |
|-----------------|-----------------|-------|
| `task.canvasPosition` | **ABSOLUTE** | Stored in DB, used for sync. Independent of parent. |
| `group.position` | **ABSOLUTE** | Group's position on canvas. |
| Vue Flow node (root) | **ABSOLUTE** | Same as canvasPosition. |
| Vue Flow node (nested) | **RELATIVE** | Relative to parent group. |

### READ PATH (DB → Vue Flow)
*Formula*: `relative = absolute - parentAbsolute`

When loading tasks that are inside groups:
1.  Read `task.canvasPosition` (Absolute: 1200, 500)
2.  Read `group.position` (Absolute: 1000, 400)
3.  Calculate Vue Flow position: `x: 200, y: 100`

### WRITE PATH (Vue Flow → DB)
*Formula*: `absolute = relative + parentAbsolute`

When saving a dragged node:
1.  Get `node.computedPosition` from Vue Flow (Already Absolute: 1200, 500)
2.  **OR** calculate from relative: `1000 + 200 = 1200`
3.  Save `1200, 500` to `task.canvasPosition`

---

## 3. Core Invariants

Validation logic resides in `src/utils/canvas/invariants.ts`.

### Invariant 1: Single Writer for Geometry
Only specific user-initiated actions may mutate `canvasPosition`, `position`, or `parentId`.

| Property | Allowed Writers |
|----------|-----------------|
| `task.parentId` | `onMoveEnd` (Drag), `createTask`, `moveToInbox` |
| `task.canvasPosition` | `onMoveEnd` (Drag), `createTask`, `moveToInbox` |
| `group.parentGroupId` | `onMoveEnd` (Drag) |
| `group.position` | `onMoveEnd` (Drag), `onResize` |

**All other modules (Sync, Smart Groups, Auto-Collectors) must treat geometry as READ-ONLY.**

#### Accepted Exceptions

The following geometry writes from non-drag contexts are **intentional** and documented:

| Exception | Source | What it writes | Why it's allowed |
|-----------|--------|----------------|------------------|
| **Auto-archive on done** | `taskOperations.ts` `updateTask` (any source) | Clears `canvasPosition` + `parentId` | Done tasks must leave the canvas. Direction is always "remove", never "reposition", so no drift risk. |
| **Stale parentId reconciliation** | `useCanvasSync.ts` post-sync write-back | Clears stale `parentId` via `'RECONCILE'` source | Repairs corruption where task claims parent membership but is spatially outside. Without write-back, stale parentId persists if task is never dragged. Guarded by `isWritingBackStaleParents` to prevent re-sync loops. |

### Invariant 2: Hierarchy Consistency
*   If `group.parentGroupId === null` → `node.parentNode` must be undefined.
*   If `group.parentGroupId !== null` → `node.parentNode` must match `section-{parentGroupId}`.
*   Parent group MUST exist in the store.

### Invariant 3: Recursion Safety
All recursive functions (e.g., `collectDescendantGroups`) MUST use a `visited` set to prevent infinite loops caused by cycle data errors.

---

## 4. Spatial Containment

Determining which group a task or group belongs to is done via **Center-Based Containment**.

*   **Logic**: A node is "inside" a group if its **center point** is within the group's bounding box (minus padding).
*   **Deepest Group**: If a node is inside multiple nested groups, the **smallest group by area** is selected as the parent.
*   **Drift Prevention**: The system prioritizes explicit `parentId` relationships over spatial position during sync. Spatial calculations are primarily used during drag-end events to *update* the relationship.

---

## 5. Viewport & Reactivity

### Problem
Vue Flow's `useVueFlow()` returns refs. Copying `viewport.value` directly into a local ref destroys reactivity, causing components to render with stale data (e.g., zoom=0) on load.

### Solution Pattern
Always store the Vue Flow context and access the viewport via a `computed` property with safeguards.

```typescript
// CORRECT PATTERN
const vf = useVueFlow()
const zoom = computed(() => {
  const z = vf.viewport.value?.zoom
  // Guard against 0, undefined, NaN
  return (typeof z === 'number' && Number.isFinite(z) && z > 0) ? z : 1
})
```

---

## 6. Debugging & Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Position Drift** | Storing relative coords in `canvasPosition` or unchecked writes from Smart Groups | Ensure all writes are Absolute. Enforce Single Writer invariant. |
| **Position Resets** | Stale positions winning over DB | `useCanvasSync` must always prioritise fresh store positions. |
| **Infinite Recursion** | Parent cycle (A→B→A) | Use `breakGroupCycles()` on load and `visited` sets in recursion. |
| **Tasks jumping** | Double conversion (Rel → Abs → Rel) | Verify `nodeBuilder` logic and ensure DB only holds Absolute. |

### Console Debugging
Use specific prefixes in your console logs. Add these to `consoleFilter.ts` whitelist to see them:
*   `[GEOMETRY-DRAG]`: Drag operations
*   `[NODE-SYNC]`: Database writes
*   `[INVARIANT]`: Invariant violations
*   `[RECONCILE]`: Parent/Child fixups

### Data Recovery
If positions are corrupted:
1.  The system has `reconcileTaskParentsByContainment()` which runs on mount to fix `parentId` based on physical location.
2.  `breakGroupCycles()` runs on load to sever circular group relationships.

---

## 7. File Reference

| Module | File | Purpose |
|--------|------|---------|
| **Coordinates** | `src/utils/canvas/coordinates.ts` | Single source of truth for Abs/Rel conversion. |
| **Invariants** | `src/utils/canvas/invariants.ts` | Validation logic for hierarchy and position. |
| **Sync** | `src/composables/canvas/useCanvasSync.ts` | Read-only sync from DB to UI. |
| **Interactions** | `src/composables/canvas/useCanvasInteractions.ts` | Drag/Drop handlers (The Writer). |
| **Store** | `src/stores/canvas.ts` | Pinia store holding Absolute state. |
