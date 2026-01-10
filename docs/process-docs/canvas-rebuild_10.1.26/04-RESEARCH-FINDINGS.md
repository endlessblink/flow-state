# Canvas Rebuild - Research Findings

**Date**: January 10, 2026
**Purpose**: Document all findings from comprehensive research before rebuilding canvas

---

## Executive Summary

After thorough research of the existing canvas implementation, Supabase schema, and Vue Flow patterns, here are the **critical discoveries** that will guide the rebuild:

### Key Insight #1: Parent-Child is COMPUTED, Not Stored
**Tasks do NOT store their parent group in the database.** The containment relationship is calculated dynamically based on position overlap. Vue Flow's `parentNode` is set at runtime.

### Key Insight #2: Position Locking Works - Keep It
The existing position locking system (7s timeout) successfully prevents sync from overwriting positions during drag. This pattern should be preserved.

### Key Insight #3: Deep Watchers Are The Enemy
The root cause of position resets was deep watchers calling `syncNodes()`. This was removed in TASK-131 and must NEVER be added back.

---

## 1. Vue Flow Parent-Child Pattern (Official)

### From Vue Flow Documentation & Discussion #1202

**Child node position is RELATIVE to parent:**
```javascript
const initialNodes = [
  { id: '2', data: { label: 'Parent' }, position: { x: 50, y: 100 },
    style: { width: 400, height: 200 } },
  // This position is RELATIVE to parent '2'
  { id: '2a', data: { label: 'Child' }, position: { x: 0, y: 0 }, parentNode: '2' }
];
```

**Critical: The `extent: "parent"` Trick for Preserving Position When Nesting**

From [Discussion #1202](https://github.com/bcakmakoglu/vue-flow/discussions/1202):
```typescript
// When dropping a node INTO a parent:
node.extent = "parent"       // 1. Set extent BEFORE parentNode
node.parentNode = parentId    // 2. Set parent
nextTick(() => {
  node.extent = undefined     // 3. Remove extent after DOM update
})
```

This trick lets Vue Flow automatically calculate the correct relative position!

**Error to Watch For: NODE_MISSING_PARENT**
- Child node references parent that doesn't exist
- Solution: Ensure parent nodes exist BEFORE adding children

**Error to Watch For: NODE_EXTENT_INVALID**
- Extent used on non-child node
- Solution: Only child nodes can use `extent: "parent"`

**Key Rules:**
1. Parent nodes MUST exist before children that reference them
2. Position becomes RELATIVE when `parentNode` is set
3. Use the `extent` trick to preserve visual position during nesting
4. Children automatically move with parent when parent is dragged

Sources:
- [Nested Nodes Example](https://vueflow.dev/examples/nodes/nesting.html)
- [Discussion #1202](https://github.com/bcakmakoglu/vue-flow/discussions/1202)
- [Troubleshooting](https://vueflow.dev/guide/troubleshooting.html)

---

## 2. Database Schema (Supabase)

### Tasks Table - Canvas Fields
| Column | Type | Purpose |
|--------|------|---------|
| `position` | JSONB | `{ x, y }` - Absolute canvas position |
| `is_in_inbox` | BOOLEAN | Whether task is in inbox (not positioned) |
| `parent_task_id` | TEXT | **NOT for groups** - for subtask hierarchy only |

**CRITICAL**: There is NO `parent_group_id` column on tasks. Task-to-group containment is computed dynamically!

### Groups Table - Canvas Fields
| Column | Type | Purpose |
|--------|------|---------|
| `position_json` | JSONB | `{ x, y, width, height }` |
| `parent_group_id` | TEXT | For nested group hierarchy |
| `is_collapsed` | BOOLEAN | Collapse state |
| `collapsed_height` | INTEGER | Height when collapsed |

### Type Mappings (App ↔ DB)
```
App: task.canvasPosition  →  DB: tasks.position
App: task.isInInbox       →  DB: tasks.is_in_inbox
App: group.position       →  DB: groups.position_json
App: group.parentGroupId  →  DB: groups.parent_group_id
```

---

## 3. Existing Canvas Architecture

### What Works Well (KEEP THESE)

1. **Position Locking (TASK-089, TASK-142)**
   - `lockGroupPosition()` and `lockTaskPosition()` with 7-second timeout
   - Prevents `patchGroups()` from overwriting positions during drag
   - Clean, preventive approach to position reset problem

2. **Drag Settling Period (TASK-072)**
   - 500ms settling period after drag ends
   - `isDragSettlingRef` checked in sync guard
   - Prevents immediate sync from resetting positions

3. **Batched Sync with Guards**
   - Guards check: `isHandlingNodeChange`, `isSyncing`, `isNodeDragging`, `isDragSettlingRef`, `isResizeSettling`
   - Prevents cascade syncs during user interactions

4. **Coordinate System Clarity**
   - Tasks: Always store ABSOLUTE positions
   - Groups at root: Store absolute positions
   - Groups nested: Store relative positions
   - Vue Flow nodes: Render relative to `parentNode`

5. **Error Boundaries**
   - `withVueFlowErrorBoundary()` wraps drag handlers
   - Prevents Vue Flow crashes from coordinate errors

### What Causes Bugs (AVOID THESE)

1. **Deep Watchers Calling syncNodes() - BUG FACTORY**
   ```typescript
   // NEVER DO THIS - removed in TASK-131
   watch(() => taskStore.tasks, syncTasksToCanvas(), { deep: true })
   ```
   - Fires on ANY task property change
   - Resets locked positions
   - Only `useCanvasSync.ts` should call sync

2. **Coordinate Conversion Errors (BUG-153)**
   - Tasks have `parentNode` reference but store absolute positions
   - Must convert absolute → relative for Vue Flow when task has parent
   - Use `getAbsoluteNodePosition()` for nested coordinate math

3. **Empty Overwrite Race (BUG-169)**
   - Auth loads before Supabase data
   - Empty groups array overwrites real data
   - Solution: 10-second safety window blocks empty overwrites

4. **NaN Position Corruption (TASK-089)**
   - Positions become NaN during drag operations
   - SVG rendering errors, position loss
   - Solution: Validate with `Number.isFinite()`, restore from store

---

## 4. Parent-Child Implementation Pattern

### Current Approach (Computed Containment)

```typescript
// Containment is COMPUTED, not stored
function findSectionForTask(taskPosition: XYPosition): string | null {
  // 1. Get all groups
  // 2. Filter to groups that CONTAIN the task center point
  // 3. Sort by area ascending (smallest first)
  // 4. Return smallest containing group (most specific)
}
```

### Vue Flow parentNode Usage

```typescript
// When loading canvas:
1. Load tasks from Supabase (absolute positions)
2. For each task, calculate which group contains it
3. If contained, set node.parentNode = `section-${groupId}`
4. Convert position to relative: absolute - parent.position

// When dragging:
1. Lock position (7s timeout)
2. Allow drag to complete
3. On drag stop, recalculate containment
4. Update parentNode if changed
5. Convert new position appropriately
```

### Position Coordinate Rules

| Scenario | Store As | Vue Flow Shows |
|----------|----------|----------------|
| Task NOT in group | Absolute | Absolute |
| Task IN group | Absolute | Relative to parent |
| Group NOT nested | Absolute | Absolute |
| Group nested | Relative | Relative to parent |

---

## 5. Critical Do's and Don'ts

### DO:
- Use `patchGroups()` instead of `setGroups()` (respects locks)
- Call `getAbsoluteNodePosition()` for any nested coordinate math
- Check position locks before modifying positions during drag
- Use `nextTick()` when task positions change, before reading counts
- Validate coordinates with `Number.isFinite()` before using

### DON'T:
- Add watchers that call `syncNodes()` - only `useCanvasSync.ts` should sync
- Rely on Vue Flow's `node.position` for nested nodes - it's relative
- Update `node.parentNode` without converting position coordinates
- Overwrite groups array with empty array early in session
- Store `parent_group_id` on tasks (it's computed, not stored)

---

## 6. Scenario Coverage Analysis

All 36 scenarios from USER-SCENARIOS.md are covered by IMPLEMENTATION-CHECKLIST.md:

| Layer | Scenarios Covered | Key Focus |
|-------|-------------------|-----------|
| Layer 1 | 6, 16, 17, 21, 23 | Position persistence on refresh |
| Layer 2 | 2, 8, 10a, 10b, 13, 19 | Parent-child movement, task counts |
| Layer 3 | 1, 4, 9, 10, 14, 36 | Containment detection |
| Layer 4 | (visual quality) | Z-index layering |
| Layer 5 | 3, 20 | Inbox integration |
| Layer 6 | 5, 7, 11-12, 15, 18, 22, 24-35 | Advanced features |

---

## 7. Failed Rebuild Lessons Learned

### What Went Wrong (January 10, 2026 attempt)

1. **Added `parent_group_id` to tasks table** - WRONG APPROACH
   - The existing architecture computes containment dynamically
   - Adding a stored field created sync conflicts
   - Position reset bugs returned

2. **Called `syncNodes()` after drag stop** - CAUSED POSITION RESET
   - `syncNodes()` overwrites Vue Flow positions from store
   - If store isn't updated yet, positions reset
   - Solution: Only sync on initial load, never during drag operations

3. **Task counter broke when removing sync** - CASCADING FAILURE
   - Counter relied on `syncNodes()` to update node data
   - Removing sync broke counter, fixing counter broke positions
   - Solution: Separate counter updates from position sync

### Correct Approach for Rebuild

1. **Trust Vue Flow's native `parentNode`** - Don't store in DB
2. **Position locking MUST be the first thing implemented**
3. **Never call full sync after drag operations**
4. **Counter updates must be separate from position sync**

---

## 8. Recommended Rebuild Strategy

### Phase 1: Skeleton with Position Locks
```
Files: CanvasViewNew.vue, canvasNew.ts (store)
- Empty Vue Flow canvas renders
- Position lock utilities ready
- No sync operations yet
```

### Phase 2: Groups Load
```
Files: useCanvasGroups.ts, GroupNodeNew.vue
- Groups load from Supabase (one-time)
- Absolute positions for root groups
- Relative positions for nested groups
- Position lock on drag start
```

### Phase 3: Tasks Load
```
Files: useCanvasNodes.ts, TaskNodeNew.vue
- Tasks load from task store
- Compute containment on load
- Set parentNode dynamically
- Convert positions for rendering
```

### Phase 4: Drag Operations
```
Files: useCanvasDrag.ts
- Lock position at drag start
- Compute new containment at drag stop
- Update parentNode if changed
- DO NOT call syncNodes()
```

### Phase 5: Counter Updates
```
Separate from position sync!
- Listen for containment changes
- Recalculate affected group counts
- Use nextTick for reactivity
```

### Phase 6: Inbox Integration
```
Files: CanvasInbox.vue
- Inbox panel shows inbox tasks
- Drag from inbox computes position
- Set isInInbox = false on drop
```

---

## 9. Supabase Queries Needed

### Load Groups
```sql
SELECT * FROM groups
WHERE user_id = auth.uid()
  AND is_deleted = false
ORDER BY created_at
```

### Load Canvas Tasks
```sql
SELECT * FROM tasks
WHERE user_id = auth.uid()
  AND is_in_inbox = false
  AND is_deleted = false
```

### Save Group Position
```sql
UPDATE groups
SET position_json = $position, updated_at = now()
WHERE id = $id AND user_id = auth.uid()
```

### Save Task Position
```sql
UPDATE tasks
SET position = $position, updated_at = now()
WHERE id = $id AND user_id = auth.uid()
```

---

## 10. Test Verification Strategy

For each checklist item:
1. Implement the feature
2. Test in browser
3. Check console for errors
4. **REFRESH PAGE** - verify persistence
5. Mark as verified
6. Move to next

**Position persistence after refresh is the CRITICAL test** - if this fails, stop and fix before moving on.

---

## 11. Summary: The Path Forward

1. **Simpler is better** - Current code is 22,500+ lines, target is ~3,000
2. **Trust Vue Flow** - Use native `parentNode`, don't fight the framework
3. **Compute, don't store** - Containment is dynamic, not a DB column
4. **Lock early, lock often** - Position locks prevent 90% of bugs
5. **Never sync during drag** - Only sync on initial load
6. **Test persistence obsessively** - Refresh after every change

The failed attempt taught us: **patches on patches create circular dependencies**. A fresh rebuild with these principles will succeed.
