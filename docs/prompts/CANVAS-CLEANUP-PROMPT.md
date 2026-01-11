# Canvas Cleanup - Supplementary Implementation Prompt

**Created**: January 11, 2026
**Supplements**: `CANVAS-HARDENING-PROMPT.md` (TASK-198, TASK-199, TASK-200)
**Priority**: P1

---

## Executive Summary

This prompt addresses additional issues discovered during the canvas deep dive that are NOT covered by the main hardening prompt. These are quick wins and cleanup items.

| Issue | Impact | Effort |
|-------|--------|--------|
| Incomplete Optimistic Sync Integration | TASK-198 partially done | Medium |
| Deprecated Import | 2 files using stub | Low |
| Empty Event Handlers | Missing functionality | Low |
| TypeScript Bypasses | Type safety holes | Medium |
| Magic Numbers | Maintainability | Medium |

---

## Issue 1: Complete Optimistic Sync Integration

### Current State

`useCanvasOptimisticSync.ts` EXISTS (91 LOC) but the old position lock is still imported:

```bash
# Files still importing canvasStateLock.ts
src/composables/canvas/useCanvasTaskDrag.ts
src/composables/canvas/useCanvasGroupDrag.ts
src/composables/canvas/useCanvasResize.ts
src/composables/canvas/useCanvasEvents.ts
```

### Fix: useCanvasTaskDrag.ts

**Find and Replace:**

```typescript
// REMOVE this import
import { lockTaskPosition } from '@/utils/canvasStateLock'

// ADD this import
import { useCanvasOptimisticSync } from './useCanvasOptimisticSync'
```

**Inside the composable function:**

```typescript
// ADD at top of function
const { trackLocalChange, markSynced } = useCanvasOptimisticSync()

// REPLACE lockTaskPosition calls:
// BEFORE:
lockTaskPosition(node.id, { x: absoluteX, y: absoluteY })

// AFTER:
trackLocalChange(node.id, 'task', { x: absoluteX, y: absoluteY })
```

**After successful store update:**

```typescript
try {
  await taskStore.updateTask(node.id, { canvasPosition: { x: absoluteX, y: absoluteY } })
  markSynced(node.id)
} catch (err) {
  console.error(`Failed to save position for task ${node.id}:`, err)
}
```

### Fix: useCanvasGroupDrag.ts

**Find and Replace:**

```typescript
// REMOVE
import { lockGroupPosition, lockTaskPosition } from '@/utils/canvasStateLock'

// ADD
import { useCanvasOptimisticSync } from './useCanvasOptimisticSync'

// Inside function
const { trackLocalChange, markSynced } = useCanvasOptimisticSync()

// REPLACE lockGroupPosition(groupId, position) WITH:
trackLocalChange(groupId, 'group', position)

// REPLACE lockTaskPosition(childId, pos) WITH:
trackLocalChange(childId, 'task', pos)
```

### Fix: useCanvasResize.ts

**Find and Replace:**

```typescript
// REMOVE
import { lockGroupPosition } from '@/utils/canvasStateLock'

// ADD
import { useCanvasOptimisticSync } from './useCanvasOptimisticSync'

// Inside function
const { trackLocalChange } = useCanvasOptimisticSync()

// REPLACE lockGroupPosition calls with trackLocalChange
```

### Fix: useCanvasEvents.ts

**Find and Replace:**

```typescript
// REMOVE
import { isAnyCanvasStateLocked } from '@/utils/canvasStateLock'

// REMOVE any usage of isAnyCanvasStateLocked()
// The optimistic sync handles this via shouldAcceptRemoteChange()
```

### Fix: useCanvasNodeSync.ts

**Find and Replace:**

```typescript
// REMOVE
import { getLockedTaskPosition, isGroupPositionLocked } from '@/utils/canvasStateLock'

// ADD
import { useCanvasOptimisticSync } from './useCanvasOptimisticSync'

// Inside function
const { getPendingPosition, shouldAcceptRemoteChange } = useCanvasOptimisticSync()

// REPLACE getLockedTaskPosition(id) WITH:
getPendingPosition(id)

// REPLACE isGroupPositionLocked(id) WITH:
getPendingPosition(id) !== null
```

### Final Step: Delete canvasStateLock.ts

```bash
# After all imports removed and verified:
rm src/utils/canvasStateLock.ts

# Verify no remaining imports:
grep -r "canvasStateLock" src/
# Should return empty
```

---

## Issue 2: Deprecated Import Cleanup

### Current State

`useCanvasSmartGroups.ts` is a 9-line stub that just re-exports `useCanvasOverdueCollector`:

```typescript
// src/composables/canvas/useCanvasSmartGroups.ts (DEPRECATED)
export { useCanvasOverdueCollector as useCanvasSmartGroups } from './useCanvasOverdueCollector'
```

Still imported in:
- `src/views/CanvasView.vue:252`
- `src/composables/canvas/useCanvasOrchestrator.ts:28`

### Fix: CanvasView.vue

```typescript
// BEFORE
import { useCanvasSmartGroups } from '@/composables/canvas/useCanvasSmartGroups'

// AFTER
import { useCanvasOverdueCollector } from '@/composables/canvas/useCanvasOverdueCollector'

// UPDATE usage (if any):
// const { ... } = useCanvasSmartGroups()
// becomes:
// const { ... } = useCanvasOverdueCollector()
```

### Fix: useCanvasOrchestrator.ts

```typescript
// BEFORE
import { useCanvasSmartGroups } from './useCanvasSmartGroups'

// AFTER
import { useCanvasOverdueCollector } from './useCanvasOverdueCollector'

// UPDATE all usages in the file
```

### Final Step: Delete Deprecated File

```bash
rm src/composables/canvas/useCanvasSmartGroups.ts
```

---

## Issue 3: Empty Event Handlers

### Current State (CanvasView.vue)

```typescript
// Line 343 - Empty handler
const handleNodeDrag = () => {}

// Line 336 - Stub with comment
const handleEdgeClick = (e: EdgeMouseEvent) => {
    // Handle edge selection or context menu
}
```

### Fix: handleNodeDrag

Either remove if not needed, or implement if continuous drag tracking is desired:

```typescript
// Option A: Remove (if handleNodeDragStop is sufficient)
// Delete the handler and remove from template @nodeDrag binding

// Option B: Implement (for live position preview during drag)
const handleNodeDrag = (event: NodeDragEvent) => {
  // Optional: Update visual feedback during drag
  // Most logic should stay in handleNodeDragStop
}
```

### Fix: handleEdgeClick

```typescript
const handleEdgeClick = (e: EdgeMouseEvent) => {
  const { edge } = e
  // Select the edge for potential deletion or context menu
  if (edge?.id) {
    canvasStore.setSelectedEdge(edge.id)
  }
}
```

If `setSelectedEdge` doesn't exist in the store, either:
1. Add it to the canvas store
2. Or delegate to orchestrator: `orchestrator.handleEdgeClick(e)`

---

## Issue 4: TypeScript Bypasses

### @ts-ignore Comments (5 instances)

**Pattern to fix:**

```typescript
// BEFORE
// @ts-ignore
const position = node.computedPosition

// AFTER
import type { GraphNode } from '@vue-flow/core'
const graphNode = node as GraphNode
const position = graphNode.computedPosition
```

**Files to check:**
- `useCanvasNodeSync.ts`
- `useCanvasOrchestrator.ts`
- `useCanvasActions.ts`

**Search command:**
```bash
grep -rn "@ts-ignore" src/composables/canvas/
```

### eslint-disable Comments (2 instances)

Review each and either:
1. Fix the underlying issue
2. Add specific rule disable with explanation

```typescript
// BEFORE
// eslint-disable-next-line
const result = someOperation()

// AFTER (if rule must be disabled)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- VueFlow event type incomplete
const result = someOperation()
```

---

## Issue 5: Magic Number Constants

### Create Constants File

Create `src/constants/canvas.ts`:

```typescript
/**
 * Canvas dimension and layout constants
 */
export const CANVAS = {
  // Node dimensions
  DEFAULT_GROUP_WIDTH: 300,
  DEFAULT_GROUP_HEIGHT: 200,
  DEFAULT_TASK_WIDTH: 200,
  DEFAULT_TASK_HEIGHT: 100,
  MIN_GROUP_WIDTH: 150,
  MIN_GROUP_HEIGHT: 100,

  // Z-index layers
  Z_INDEX_BASE: 1000,
  Z_INDEX_TASK: 1000,
  Z_INDEX_GROUP: 500,
  Z_INDEX_DRAGGING: 2000,
  Z_INDEX_SELECTED: 1500,

  // Timing
  SYNC_DEBOUNCE_MS: 300,
  POSITION_LOCK_TIMEOUT_MS: 7000,
  ANIMATION_DURATION_MS: 200,

  // Limits
  MAX_RECURSION_DEPTH: 50,
  MAX_NESTING_LEVEL: 10,

  // Spacing
  GROUP_PADDING: 20,
  TASK_MARGIN: 10,
  GRID_SNAP_SIZE: 10,
} as const

export type CanvasConstants = typeof CANVAS
```

### Update Consumers

```typescript
// BEFORE
const defaultWidth = 300
const defaultHeight = 200

// AFTER
import { CANVAS } from '@/constants/canvas'
const defaultWidth = CANVAS.DEFAULT_GROUP_WIDTH
const defaultHeight = CANVAS.DEFAULT_GROUP_HEIGHT
```

**Files with magic numbers to update:**
- `useCanvasGroupActions.ts`
- `useCanvasSectionProperties.ts`
- `useCanvasResize.ts`
- `useCanvasResizeCalculation.ts`
- `useCanvasNodeSync.ts`

---

## Verification Checklist

### After Optimistic Sync Integration
- [ ] `grep -r "canvasStateLock" src/` returns empty
- [ ] `npm run build` passes
- [ ] Drag task → refresh → position persists
- [ ] Drag group → children follow → refresh → positions persist

### After Deprecated Import Cleanup
- [ ] `grep -r "useCanvasSmartGroups" src/` returns empty
- [ ] `useCanvasSmartGroups.ts` deleted
- [ ] `npm run build` passes

### After Empty Handler Fixes
- [ ] No empty function bodies in CanvasView.vue
- [ ] Edge click selects edge (or handler removed)

### After TypeScript Fixes
- [ ] `grep -rn "@ts-ignore" src/composables/canvas/` returns empty
- [ ] `npm run build` passes with no type errors

### After Magic Number Constants
- [ ] Constants file created
- [ ] At least 5 files updated to use constants
- [ ] `npm run build` passes

---

## Order of Operations

1. **Optimistic Sync Integration** (30 min)
   - Update 4 files to use optimistic sync
   - Delete canvasStateLock.ts
   - Test drag-refresh-persist cycle

2. **Deprecated Import Cleanup** (5 min)
   - Update 2 import statements
   - Delete useCanvasSmartGroups.ts

3. **Empty Handler Fixes** (10 min)
   - Implement or remove handleNodeDrag
   - Implement handleEdgeClick

4. **TypeScript Bypasses** (20 min)
   - Fix 5 @ts-ignore comments
   - Review 2 eslint-disable comments

5. **Magic Number Constants** (30 min)
   - Create constants file
   - Update high-impact files

**Total Estimated Effort**: 1.5-2 hours

---

## Files Summary

### Create
| File | Purpose |
|------|---------|
| `src/constants/canvas.ts` | Centralized canvas constants |

### Modify
| File | Changes |
|------|---------|
| `useCanvasTaskDrag.ts` | Replace lock imports with optimistic sync |
| `useCanvasGroupDrag.ts` | Replace lock imports with optimistic sync |
| `useCanvasResize.ts` | Replace lock imports with optimistic sync |
| `useCanvasEvents.ts` | Remove lock import |
| `useCanvasNodeSync.ts` | Replace lock checks with optimistic sync |
| `CanvasView.vue` | Fix deprecated import, fill empty handlers |
| `useCanvasOrchestrator.ts` | Fix deprecated import |

### Delete
| File | Reason |
|------|--------|
| `src/utils/canvasStateLock.ts` | Replaced by optimistic sync |
| `src/composables/canvas/useCanvasSmartGroups.ts` | Deprecated stub |

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| canvasStateLock imports | 4 files | 0 |
| Position lock LOC | 451 | 0 (deleted) |
| Deprecated imports | 2 files | 0 |
| Empty handlers | 2 | 0 |
| @ts-ignore | 5 | 0 |
| Magic numbers | 40+ | <10 (in constants) |
