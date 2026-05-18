---
name: vue-flow-debug
description: Expert skill for debugging Vue Flow parent-child relationships, coordinate systems, node extent barriers, and nesting logic. Contains deep knowledge on coordinate conversion and event handling.
triggers:
  - debug vue flow
  - fix nested nodes
  - node parent issues
  - dragging nodes wrong
  - group node bugs
  - invisible barrier
  - node extent
  - cant drag node
keywords:
  - vue flow
  - nested
  - coordinates
  - parent
  - computedPosition
  - extent
  - barrier
  - nodeExtent
---

# Vue Flow Nested Nodes & Parent-Child Debugging

## 🎯 **Capabilities**
- **Coordinate Debugging**: Understanding `position` vs `computedPosition`.
- **Relationship Fixes**: Diagnosing parent-child linkage issues.
- **Event Handling**: Correct implementation of drag/drop for nested nodes.
- **Containment Logic**: Advanced geometry checks for "node inside group".

## ⚡ **Action: Debug Protocol**
1.  **Analyze**: Determine if the issue is visual (rendering), logical (state), or persistent (store).
2.  **Verify**: Use the checklists below to validate parent-child integrity.
3.  **Implement**: Apply the robust patterns provided for parent assignment.

---

# expert-knowledge.md

## 1. Vue Flow Coordinate System {#coordinate-system}

### Understanding position vs computedPosition

**node.position (Stored in State)**
*   For root nodes: position = absolute coordinates on the canvas
*   For child nodes (with parentNode set): position = relative to parent's top-left corner
*   Stored in: Your nodes array/Pinia store
*   Used for: Persistence, serialization, state synchronization

```typescript
// Root node - position is absolute
{
  id: 'node-1',
  position: { x: 100, y: 50 },  // 100px from canvas left, 50px from top
  parentNode: undefined
}

// Child node - position is relative to parent
{
  id: 'task-1',
  position: { x: 20, y: 30 },   // 20px from parent's left, 30px from parent's top
  parentNode: 'group-1'
}
```

**node.computedPosition (Calculated at Runtime)**
*   Always absolute: World coordinates regardless of parent
*   Automatically calculated: Vue Flow computes this from position + parent's computedPosition
*   Used for: Rendering, collision detection, drag operations
*   Read-only: Don't set this directly

### Coordinate Transformation Functions

```typescript
// Absolute (world) to Relative (parent-local)
function toRelativePosition(
  absolutePos: { x: number; y: number },
  parentComputedPos: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: absolutePos.x - parentComputedPos.x,
    y: absolutePos.y - parentComputedPos.y
  }
}

// Relative (parent-local) to Absolute (world)
function toAbsolutePosition(
  relativePos: { x: number; y: number },
  parentComputedPos: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: relativePos.x + parentComputedPos.x,
    y: relativePos.y + parentComputedPos.y
  }
}
```

## 2. Common Bugs & Solutions

### Bug #1: Groups Incorrectly Moving Together (Not Nested)
**Symptoms**: When you drag one group, nearby groups move with it.
**Root Cause**: `parentNode` accidentally set or stale references.
**Solution**: Ensure Group nodes have `parentNode: undefined`.

### Bug #2: Positions Jump on Page Load/Refresh
**Root Cause**: Loading state before Vue Flow initializes or mismatched coordinate systems.
**Solution**: Use `onPaneReady` to gate data loading.

### Bug #3: Nested Groups Don't Move with Parent
**Root Cause**: Child's `parentNode` not set correctly or position is absolute instead of relative.
**Solution**: Verify `child.parentNode === parent.id`.

### Bug #4: False Positive Containment (Center-Point Only)
**Problem**: Standard checks only look at the center point. A large node essentially "outside" a group might have its center "inside", verifying it incorrectly.
**Solution**: Use Multi-Corner Containment Check.

```typescript
/**
 * Comprehensive containment check using ALL 4 corners + percentage
 */
function isNodeReallyInsideGroup(node: Node, group: Node, margin = 10) {
    // ... See full implementation in guide ...
}
```

## 3. Debugging Techniques

### Color-Coded Console Logger
Create a consistent logging utility to trace position updates.

### Real-Time Position Visualization
Overlay a transparent div showing live `computedPosition` values to see what Vue Flow "sees".

### Diagnostic Containment Check
Run a script that checks all 4 corners of a node against all groups to definitively prove if it "should" be inside.

---

## 4. Production Ready Patterns

### Reliable Parent Assignment
Do not just check `isInside`. Check `isInside` AND ensures the node fits logically. Only assign if confidence is high (>75% coverage).

### Syncing External Store
Always listen to `onNodesChange` and sync `position` back to your Pinia store. Remember to sync `parentNode` changes too!

```typescript
onNodesChange((changes) => {
  changes.forEach(change => {
    if (change.type === 'position') {
      const node = getNode(change.id)
      nodeStore.update(change.id, {
        position: node.position,
        parentNode: node.parentNode
      })
    }
  })
})
```

---

## 5. Critical: Parent-Child Timing Issues (BUG-152)

### The Problem
When dropping a task from inbox onto a group:
- ❌ Task count doesn't update
- ❌ Task doesn't move with parent group when dragged
- ✓ Page refresh fixes both issues

**Root Cause**: Vue Flow's internal parent-child discovery and coordinate calculations need extra time to settle after you replace the nodes array.

### The Solution: setNodes() + Double nextTick()

**WRONG (Direct Array Mutation)**:
```typescript
// This doesn't trigger Vue Flow's complete initialization
nodes.value = syncNodes()
await nextTick()
// Vue Flow hasn't finished processing parent-child relationships!
```

**CORRECT (Use setNodes)**:
```typescript
import { useVueFlow } from '@vue-flow/core'

const { setNodes, findNode } = useVueFlow()

async function handleDrop(event, taskId, groupId) {
  // 1. Update store
  taskStore.updateTask(taskId, {
    canvasPosition: { x, y },
    isInInbox: false
  })

  // 2. Use setNodes() - triggers Vue Flow's proper initialization
  setNodes(syncNodes())

  // 3. CRITICAL: Double nextTick() for parent-child discovery
  await nextTick()  // First tick: Vue detects change, updates DOM
  await nextTick()  // Second tick: Vue Flow processes parent-child

  // 4. Now safe to read from Vue Flow state
  const task = findNode(`task-${taskId}`)
  console.log('Parent:', task?.parentNode)  // ✓ Populated
}
```

### Why Double nextTick()?

Vue Flow's parent-child discovery needs multiple render cycles:

| Tick | What Happens |
|------|--------------|
| 1st  | Vue detects array change, updates DOM |
| 2nd  | Vue Flow discovers parent-child relationships, recalculates coordinates |

### Alternative: updateNode() for Single Node Changes

```typescript
const { updateNode, findNode } = useVueFlow()

async function handleDrop(taskId, groupId, pos) {
  // 1. Update store
  taskStore.updateTask(taskId, updates)

  // 2. Update only the dropped task
  const relativePos = convertToRelativeCoordinates(pos, groupPos)
  updateNode(taskId, {
    position: relativePos,
    parentNode: `section-${groupId}`
  })

  // 3. Update group's task count
  const groupNode = findNode(`section-${groupId}`)
  if (groupNode) {
    updateNode(`section-${groupId}`, {
      data: {
        ...groupNode.data,
        taskCount: getTaskCountInGroup(groupId)
      }
    })
  }

  // 4. Double nextTick
  await nextTick()
  await nextTick()
}
```

### Best Practice: Track Parent in Pinia Store

For reliable task counts, track parent-child explicitly in Pinia:

```typescript
// In Pinia store
const taskToGroupMap = ref<Record<string, string>>({})

function setTaskParent(taskId: string, parentGroupId: string | null) {
  if (parentGroupId) {
    taskToGroupMap.value[taskId] = parentGroupId
  } else {
    delete taskToGroupMap.value[taskId]
  }
}

const getTaskCountInGroup = computed(() => (groupId: string) => {
  return Object.entries(taskToGroupMap.value)
    .filter(([_, gId]) => gId === groupId).length
})
```

### Common Mistakes

| Mistake | Why It Breaks | Fix |
|---------|---------------|-----|
| Direct `nodes.value =` | Skips Vue Flow initialization | Use `setNodes()` |
| Single `nextTick()` | Parent-child not discovered yet | Double `nextTick()` |
| Reading from `nodes.value` in computed | Stale data | Use `findNode()` |
| Converting to relative twice | Position is wrong | Let Vue Flow handle it OR you handle it, not both |
| Child created before parent | parentNode can't be found | Create parents first in `syncNodes()` |

### Verification Checklist

After implementing, verify:
- [ ] Drop task on group → count increments immediately
- [ ] Drag group → task moves with it
- [ ] Refresh page → state persists correctly
- [ ] Move task between groups → counts update correctly
- [ ] Rapid drops → no race conditions

## 6. Node Extent Barriers (BUG-1310) {#node-extent}

### The Problem
Nodes hit an invisible barrier when dragged. Some groups can be dragged, others cannot. No error messages appear.

### Root Cause
Vue Flow's `nodeExtent` prop constrains where nodes can be positioned. In FlowState, `dynamicNodeExtent` is computed in `useCanvasFilteredState.ts`. If the extent is too small, nodes near the edge hit an invisible wall.

**Common scenario**: When `taskNodes=0` (tasks not rendered), the extent used to default to `[[-2000, -2000], [5000, 5000]]` — only 7000px. Groups at x=4556 had just 444px of room.

### Diagnostic Steps
1. Check console for `[BUG-1310:EXTENT]` — what are the extent bounds?
2. Check `[NODE-BUILDER]` — are `taskNodes > 0`?
3. Check `[BUG-1310:DRAG-START]` — does node have `extent: 'parent'`? (should be `'none'`)
4. Compare node position vs extent bounds — is it near the edge?

### Key Files
- `src/composables/canvas/useCanvasFilteredState.ts` — `dynamicNodeExtent` computed
- `src/views/CanvasView.vue` — `:node-extent="dynamicNodeExtent"` prop

### Fix Pattern
`dynamicNodeExtent` must include BOTH task AND group positions. Default should be very large (`[-50000, 50000]`).

### SOP Reference
See `docs/sop/canvas/CANVAS-NODE-EXTENT.md` for full details.

## 7. Programmatic Node Position Updates {#programmatic-moves}

### The Problem
Updating `canvasStore.updateGroup(id, { position })` changes the Pinia store but Vue Flow nodes don't visually move. The sync pipeline (`syncStoreToCanvas → setNodes`) either gets blocked by `canAcceptRemoteUpdate` guard or the PositionManager rejects the update.

### Root Cause: Sync Pipeline is NOT Designed for Programmatic Moves
The sync pipeline (`batchedSyncNodes → syncNodes → syncStoreToCanvas → setNodes`) is designed for:
- Initial load (store → Vue Flow projection)
- Remote sync (Supabase realtime → store → Vue Flow)

It has multiple guards that can block execution:
1. `canAcceptRemoteUpdate` — blocks if user is dragging/resizing (opState ≠ idle)
2. `canvasSyncInProgress` — blocks recursive sync
3. PositionManager locks — blocks if node is locked by `user-drag`
4. `batchedSyncNodes` dedup — skips if already scheduled on this tick

### The Correct Approach: `useVueFlow().updateNode()`

**NEVER rely on the sync pipeline for programmatic position changes.** Instead, use Vue Flow's `updateNode()` API directly:

```typescript
import { useVueFlow } from '@vue-flow/core'
const { updateNode } = useVueFlow()

// Move a group node to a new position
updateNode('section-group-123', { position: { x: 500, y: 200 } })
```

**This works because:**
- `updateNode()` does a shallow `Object.assign` into the live reactive node
- Vue Flow immediately re-renders the node at the new position
- No sync pipeline, no guards, no PositionManager — direct mutation

### Full Pattern for Programmatic Batch Moves

```typescript
// 1. Update Pinia store for persistence (suppressing sync)
canvasSyncInProgress.value = true
try {
  canvasStore.updateGroup(groupId, { position: newPos })
  // Also update child task positions if needed
} finally {
  canvasSyncInProgress.value = false
}

// 2. Apply to Vue Flow directly — this is what actually moves the nodes
updateNode(`section-${groupId}`, { position: newPos })
```

### API Comparison

| Method | Moves visually | Persists | Use for |
|--------|---------------|----------|---------|
| `updateNode(id, { position })` | ✅ Yes | ❌ No | Vue Flow visual update |
| `canvasStore.updateGroup(id, { position })` | ❌ No | ✅ Yes | Store persistence |
| `setNodes(allNodes)` | ✅ Yes (but replaces all) | ❌ No | Full graph rebuild only |
| `findNode(id).position = pos` | ✅ Yes | ❌ No | Same as updateNode |
| Sync pipeline (canvasSyncTrigger++) | ⚠️ Maybe (guards) | N/A | Remote sync only |

### Key Insight: Two Sync Triggers Exist (They Are Different!)

| Ref | Location | Watcher uses `force` | Purpose |
|-----|----------|---------------------|---------|
| `canvasStore.syncTrigger` | `src/stores/canvas.ts` | YES (`force: true`) | User-initiated re-sync |
| `canvasSyncTrigger` | `src/stores/canvasTaskBridge.ts` | NO | Remote/automatic sync |

If you bump the wrong one, the sync runs without `force` and gets blocked by `canAcceptRemoteUpdate`.

### Never Use `updateNodePositions` (Internal API)

Vue Flow exports `updateNodePositions(dragItems, changed, dragging)` but the docs explicitly say "you probably don't want to use this" — it's the internal drag handler callback.

## Resources

### references/
- `canvas-group-task-counting-tests.md` - E2E test patterns for validating group-task counting, coordinate verification, and parent-child relationships

---

## Upstream Vue Flow gotchas (research, May 2026)

The following items come from the upstream Vue Flow repo and apply to FlowState. They are **not Electron-specific** — they affect web builds the same way.

### 1. Reparenting race: coordinate space flips silently

When you set `node.parentNode = newGroupId`, Vue Flow interprets `node.position` as relative to the new parent **starting from the very next tick**. If `node.position` was still absolute (or relative to the OLD parent) at that moment, the child renders at the wrong absolute coordinate — or fully outside the parent rect.

**Symptoms in FlowState:**
- Tasks visible in canvas but floating off-screen / below their group
- Group count badge shows N but group rectangle appears empty
- "Disappeared after rotation/tidy" is almost always this bug

**Upstream-recommended pattern (Vue Flow Discussion #1202):**
```ts
// Set extent first so the library handles the coordinate-space transition
node.extent = 'parent'
node.parentNode = newGroupId
nextTick(() => { node.extent = undefined })
```

**FlowState's current pattern** (`useCanvasInteractions.ts:879-891`, `CanvasView.vue:applyCanonicalTaskMoves`):
- Sets `position` (relative) BEFORE `parentNode` in the same tick — this is the right ordering but does NOT use the `extent: 'parent'` dance.
- Works for drag because Vue Flow already has the node mounted with its current parent and the per-tick mutation is consistent.
- Can fail for batch programmatic moves (`rotateDayGroupPositions`, `tidyDayGroups`) when `findNode` returns `null` for a sub-set of nodes because the prior sync hasn't flushed them yet → those nodes get silently skipped → they keep stale state.

**Diagnostic command for FlowState:**
```bash
# After a rotation/tidy regression, dump the affected store state
docker exec supabase_db_flow-state psql -U postgres -c "
SELECT id, LEFT(title,30), due_date::date,
       position->>'parentId' as canvas_parent,
       position->>'x' as x, position->>'y' as y
FROM tasks WHERE is_deleted=false AND updated_at > now() - interval '15 minutes'
ORDER BY updated_at DESC LIMIT 20;"
```
If `canvas_parent` is correct but the UI shows tasks orphaned, the bug is the reparenting race — not data corruption.

### 2. Vue Flow does NOT track mutations to `node.data`

Mutating `node.data.foo = 'x'` does NOT trigger a re-render. Replacing `node.data = {...}` also breaks reactivity tracking. Use `updateNode(id, { data: newData })` or `updateNodeData(id, partial)`.

**FlowState dodges this** by having `TaskNode.vue` pull a reactive `task` from the Pinia store via `useTaskNodeState.ts:20`:
```ts
const task = computed(() => taskStore.tasks.find(t => t.id === props.task?.id))
```
This means **the badge / metadata DO auto-update when Pinia changes** — without needing `updateNodeData()`. If you ever see a stale badge after a Pinia write succeeded, the bug is in the **Pinia write itself** (was it persisted? did a watcher overwrite?), not in Vue Flow.

### 3. Race condition in change handlers (Issue #1630)

Mutations inside Vue Flow change handlers (`onNodesChange`, `onEdgesChange`) can require multiple invocations to fully apply. FlowState's `useCanvasSync.ts` runs in watchers, which is the same pattern — but the `canvasSyncInProgress` guard works around the worst of it. **Never mutate Vue Flow nodes inside a `handleNodesChange` callback without also gating `canvasSyncInProgress`.**

### 4. `setNodes([])` + `nextTick` + `setNodes(refreshed)` is the nuclear option

`refreshRenderedNodesFromModel` in `CanvasView.vue:484` does exactly this. It's the only reliable way to force Vue Flow to re-evaluate parent-child relationships after a batch write. The `releaseOnDoubleNextTick` helper calls it after `rotateDayGroupPositions` to recover from the race in (1). If you suspect a rendering gap, calling this helper from your code path is the documented escape hatch.

### 5. Two sync triggers and the SMART-GROUP source

`taskOperations.ts:updateTask` accepts a `source` parameter:
- `'DRAG'` — caller manages `parentId`/`canvasPosition`; BUG-1757 guard SKIPPED.
- `'SMART-GROUP'` — used by `rotateDayGroups`; BUG-1757 guard SKIPPED; sync watcher still fires.
- `'USER'` — default; BUG-1757 guard ACTIVE (may auto-detach from non-matching day group).

`rotateDayGroups` writes with `'SMART-GROUP'` source which fires the sync watcher **before** `rotateDayGroupPositions` has set `canvasSyncInProgress = true`. This can leave Vue Flow measuring stale positions. **Fix shape: hold the sync guard across BOTH calls in the toolbar handler**, not just inside `rotateDayGroupPositions`.

### 6. "Counted but invisible" — diagnostic checklist

When a group's count badge shows N but the rect is empty, work the list in order:

1. **DB check** — query for `position->>'parentId'` and `position->>'x/y'`. If DB shows tasks correctly parented, the bug is rendering; if DB is wrong, the bug is in the writer.
2. **Vue Flow node check** — in the DevTools console:
   ```js
   const { findNode } = useVueFlow()
   findNode('<task-uuid>')?.parentNode  // should equal `section-<group-id>`
   findNode('<task-uuid>')?.position     // should be RELATIVE to parent
   ```
3. **Pinia store check** — `taskStore.tasks.find(t => t.id === '<uuid>')?.parentId` should equal group id; `canvasPosition` is ABSOLUTE.
4. **Pinia ≠ Vue Flow** — if (2) and (3) disagree, it's a sync gap. Call `refreshRenderedNodesFromModel()` or bump `canvasStore.syncTrigger` with `{ force: true }`.
5. **Vue Flow has the wrong parent** — call `findNode(id)` and check `parentNode`. If it's stale, you've hit Gotcha 1. The fix is the extent dance or an explicit `updateNode(id, { position, parentNode })` followed by `refreshRenderedNodesFromModel()`.

### 7. FlowState code paths that write parent/position

When a bug touches reparenting, audit every writer below — fixing only one leaves the others stale:

| Path | File | Source | Writes |
|------|------|--------|--------|
| Drag (canvas) | `useCanvasInteractions.ts:907` | `'DRAG'` | parentId, canvasPosition, dueDate (smart), instances (BUG-1786) |
| Move-to-group menu | `useMoveToCanvasGroup.ts:moveTaskToGroup` | `updateTaskWithUndo` (USER) | parentId, canvasPosition, dueDate (inherited) |
| Right-click date | `useTaskContextMenuActions.ts:setDueDate` | `updateTaskWithUndo` (USER) | dueDate, instances (BUG-1786), parentId via `moveToGroupWithToast` |
| Overdue reschedule | `useTaskNodeActions.ts:295` | `'USER'` | dueDate, instances (BUG-1786); parentId via `moveTaskToSmartGroup` |
| Rotation (toolbar) | `useDayGroupRotation.ts:rotateDayGroups + rotateDayGroupPositions` | `'SMART-GROUP'` then `'DRAG'` | dueDate (rotate), canvasPosition (positions), group position |
| Tidy (toolbar) | `useTidyLayout.ts:tidyDayGroups` | `'DRAG'` | canvasPosition, group position/size |
| Auto-place | `useCanvasAutoPlacement.ts:autoPlaceEligibleTasks` | `'USER'` | canvasPosition, parentId, isInInbox |
| Catchup (mount) | `useDayGroupRotation.ts:runCatchupIfNeeded` | `'SMART-GROUP'` | dueDate only (no positions per BUG-1780) |

Sources:
- [Vue Flow Discussion #1202 — preserve position when nesting](https://github.com/bcakmakoglu/vue-flow/discussions/1202)
- [Vue Flow Discussion #1926 — reactive behaviors not triggering](https://github.com/bcakmakoglu/vue-flow/discussions/1926)
- [Vue Flow Issue #1630 — race condition in change handlers](https://github.com/bcakmakoglu/vue-flow/issues/1630)
- [Vue Flow Update Node API](https://vueflow.dev/examples/nodes/update-node.html)
