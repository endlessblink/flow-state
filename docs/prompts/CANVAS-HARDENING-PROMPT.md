# Canvas System Hardening - Complete Implementation Prompt

**Created**: January 10, 2026
**Tasks**: TASK-198, TASK-199, TASK-200
**Priority**: P0-CRITICAL

---

## Executive Summary

The canvas system underwent significant refactoring (CanvasView.vue: 2,098 → 347 LOC), but critical issues remain:

| Issue | Impact | LOC |
|-------|--------|-----|
| Position Lock Bandaid | Masks sync race condition | 451 LOC |
| Console.log Pollution | Performance, noise | 62 statements |
| `any` Type Violations | Type safety | 41 instances |
| Empty Event Handlers | Missing functionality | 2 handlers |
| Bug Workarounds | Technical debt | 13 files |
| Duplicated Logic | Maintenance burden | ~300 LOC |

---

## Phase 1: Optimistic Sync (TASK-198) - P0

### Problem

The 7-second position lock (`src/utils/canvasStateLock.ts`, 451 LOC) is a bandaid:

```
User drags node → Local position update → Supabase sync pulls STALE data → Position resets
```

The lock blocks sync for 7 seconds after any drag, hiding the race condition.

### Solution: Timestamp-Based Conflict Resolution

Create `src/composables/canvas/useCanvasOptimisticSync.ts`:

```typescript
import { ref } from 'vue'

interface PendingChange {
  type: 'task' | 'group'
  position: { x: number; y: number }
  timestamp: number
  synced: boolean
}

const pendingChanges = ref(new Map<string, PendingChange>())

export function useCanvasOptimisticSync() {
  /**
   * Track a local position change with timestamp.
   * Called when user drags a node.
   */
  const trackLocalChange = (
    id: string,
    type: 'task' | 'group',
    position: { x: number; y: number }
  ) => {
    pendingChanges.value.set(id, {
      type,
      position,
      timestamp: Date.now(),
      synced: false
    })
  }

  /**
   * Determine if we should accept a remote position change.
   * Reject if we have a newer local change that hasn't synced yet.
   */
  const shouldAcceptRemoteChange = (
    id: string,
    remoteTimestamp: number
  ): boolean => {
    const pending = pendingChanges.value.get(id)

    // No local change pending - accept remote
    if (!pending) return true

    // Remote is newer than our local change - accept it
    if (remoteTimestamp > pending.timestamp) {
      pendingChanges.value.delete(id)
      return true
    }

    // Our local change is newer - reject remote
    return false
  }

  /**
   * Mark a local change as synced to server.
   * Called after successful Supabase push.
   */
  const markSynced = (id: string) => {
    const pending = pendingChanges.value.get(id)
    if (pending) {
      pending.synced = true
      // Clean up after confirmation window (1s)
      setTimeout(() => pendingChanges.value.delete(id), 1000)
    }
  }

  /**
   * Get the pending local position if it exists.
   * Use this instead of lock position checks.
   */
  const getPendingPosition = (id: string): { x: number; y: number } | null => {
    const pending = pendingChanges.value.get(id)
    return pending ? pending.position : null
  }

  /**
   * Check if any changes are pending.
   */
  const hasPendingChanges = (): boolean => {
    return pendingChanges.value.size > 0
  }

  return {
    trackLocalChange,
    shouldAcceptRemoteChange,
    markSynced,
    getPendingPosition,
    hasPendingChanges,
    pendingChanges
  }
}
```

### Integration Steps

#### 1. Update `useCanvasTaskDrag.ts`

Replace:
```typescript
import { lockTaskPosition } from '@/utils/canvasStateLock'
// ...
lockTaskPosition(node.id, { x: absoluteX, y: absoluteY })
```

With:
```typescript
import { useCanvasOptimisticSync } from './useCanvasOptimisticSync'
// ...
const { trackLocalChange, markSynced } = useCanvasOptimisticSync()
// ...
trackLocalChange(node.id, 'task', { x: absoluteX, y: absoluteY })

// After successful store update:
try {
  await taskStore.updateTask(node.id, { canvasPosition: { x: absoluteX, y: absoluteY } })
  markSynced(node.id)
} catch (err) {
  console.error(`Failed to save position for task ${node.id}:`, err)
}
```

#### 2. Update `useCanvasGroupDrag.ts`

Replace:
```typescript
import { lockGroupPosition, lockTaskPosition } from '@/utils/canvasStateLock'
```

With:
```typescript
import { useCanvasOptimisticSync } from './useCanvasOptimisticSync'
const { trackLocalChange, markSynced } = useCanvasOptimisticSync()
```

#### 3. Update `useCanvasNodeSync.ts`

Replace lock checks:
```typescript
import { getLockedTaskPosition, isGroupPositionLocked } from '@/utils/canvasStateLock'
// ...
const lockedPosition = getLockedTaskPosition(task.id)
if (lockedPosition && taskExistsInNodes && existingPos) { ... }
```

With:
```typescript
import { useCanvasOptimisticSync } from './useCanvasOptimisticSync'
const { getPendingPosition, shouldAcceptRemoteChange } = useCanvasOptimisticSync()
// ...
const pendingPosition = getPendingPosition(task.id)
if (pendingPosition && taskExistsInNodes && existingPos) {
  // Use pending local position instead of store data
}
```

#### 4. Update `useCanvasEvents.ts`

Remove:
```typescript
import { isAnyCanvasStateLocked } from '@/utils/canvasStateLock'
```

#### 5. Delete Position Lock File

```bash
rm src/utils/canvasStateLock.ts
```

### Verification

```bash
# 1. Build passes
npm run build

# 2. No lock imports remaining
grep -r "canvasStateLock" src/

# 3. Functional test
# - Drag task to new position
# - Refresh page
# - Position persists (no reset)
```

---

## Phase 2: Code Quality Pass (TASK-199) - P1

### 2A. Remove Console.log (62 statements)

**Target Files** (by count):

| File | Count |
|------|-------|
| useCanvasSectionProperties.ts | 7 |
| useCanvasGroupActions.ts | 7 |
| useCanvasTaskActions.ts | 7 |
| useNodeAttachment.ts | 5 |
| useCanvasOverdueCollector.ts | 5 |
| useCanvasResize.ts | 5 |
| useCanvasEdgeSync.ts | 4 |
| useCanvasZoom.ts | 4 |
| useCanvasSelection.ts | 3 |
| Others | 15 |

**Commands**:

```bash
# Find all console statements
grep -rn "console\.\(log\|warn\|error\|debug\)" src/composables/canvas/*.ts

# Remove (keep error handling that uses handleError utility)
# Pattern to REMOVE:
# console.log('[CanvasCore]...')
# console.log(`🔒 [CANVAS-LOCK]...`)
# console.log(`✅ [TASK-158]...`)

# Pattern to KEEP:
# handleError(error, ErrorCategory.CANVAS, 'message')
```

### 2B. Fix `any` Types (41 instances)

**Common Patterns**:

```typescript
// BEFORE
const handleEvent = (event: any) => { ... }

// AFTER
import type { NodeDragEvent } from '@vue-flow/core'
const handleEvent = (event: NodeDragEvent) => { ... }
```

```typescript
// BEFORE
const nodes = ref<any[]>([])

// AFTER
import type { Node } from '@vue-flow/core'
const nodes = ref<Node[]>([])
```

```typescript
// BEFORE
(node as any).computedPosition

// AFTER
import type { GraphNode } from '@vue-flow/core'
(node as GraphNode).computedPosition
```

**Target Files**:

| File | Count | Primary Types Needed |
|------|-------|---------------------|
| useCanvasOrchestrator.ts | 6 | `Node`, `Edge`, `GraphNode` |
| useCanvasEvents.ts | 5 | `NodeDragEvent`, `EdgeMouseEvent` |
| useCanvasSync.ts | 5 | `Node[]`, dependency types |
| useCanvasGroupDrag.ts | 4 | `GraphNode`, `CanvasSection` |
| useNodeAttachment.ts | 3 | `GraphNode`, `Coordinates` |

### 2C. Clean Bug Workaround Comments (13 files)

For each file with BUG-XXX or TASK-XXX comments:

1. **Verify** the fix is complete (check MASTER_PLAN.md)
2. **If DONE**: Remove the comment, keep the code
3. **If NOT DONE**: Keep comment, ensure tracked in MASTER_PLAN.md

**Files to Check**:

| File | References |
|------|------------|
| useNodeAttachment.ts | BUG-153, TASK-UPDATE |
| useCanvasTaskDrag.ts | TASK-DRAG |
| useCanvasGroupDrag.ts | BUG-025, BUG-184 |
| useCanvasOverdueCollector.ts | TASK-100, BUG-061, BUG-022 |
| useCanvasGroupActions.ts | TASK-158 (5x), BUG-091, TASK-149 |
| useCanvasSectionProperties.ts | TASK-130, TASK-114, TASK-144 |
| useCanvasResizeState.ts | BUG-055 |
| useCanvasDragDrop.ts | BUG-184 |
| node/useTaskNodeActions.ts | TASK-075, BUG-007 |
| useCanvasGroupMembership.ts | TASK-106, TASK-144 |
| useCanvasActions.ts | TASK-149, TASK-070 |

### 2D. Fill Empty Event Handlers

**CanvasView.vue:343**:

```typescript
// CURRENT (no-op)
const handleNodeDrag = () => {}

// SHOULD BE (if needed for continuous tracking)
const handleNodeDrag = (event: NodeDragEvent) => {
  // Optional: Update position preview or visual feedback during drag
  // Most logic is in handleNodeDragStop
}
```

```typescript
// CURRENT (stub)
const handleEdgeClick = (e: EdgeMouseEvent) => {
    // Handle edge selection or context menu
}

// SHOULD BE
const handleEdgeClick = (e: EdgeMouseEvent) => {
  const { edge, event } = e
  // Select edge or show context menu
  canvasStore.setSelectedEdge(edge.id)
  // Or delegate to orchestrator
}
```

---

## Phase 3: Architecture Consolidation (TASK-200) - P2

### 3A. Centralize Position Calculation

Create `src/utils/canvas/positionCalculator.ts`:

```typescript
import type { Node } from '@vue-flow/core'
import type { CanvasSection } from '@/stores/canvas'

export interface Coordinates {
  x: number
  y: number
}

/**
 * Get absolute position of a node, traversing parent chain.
 */
export function getAbsolutePosition(node: Node, allNodes: Node[]): Coordinates {
  let x = node.position.x
  let y = node.position.y
  let currentParentId = node.parentNode

  while (currentParentId) {
    const parent = allNodes.find(n => n.id === currentParentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    currentParentId = parent.parentNode
  }

  return { x, y }
}

/**
 * Get absolute position of a section from store data.
 */
export function getSectionAbsolutePosition(
  section: CanvasSection,
  allSections: CanvasSection[]
): Coordinates {
  let x = section.position?.x ?? 0
  let y = section.position?.y ?? 0
  let currentParentId = section.parentGroupId

  let depth = 0
  while (currentParentId && currentParentId !== 'NONE' && depth < 50) {
    const parent = allSections.find(s => s.id === currentParentId)
    if (!parent) break
    x += parent.position?.x ?? 0
    y += parent.position?.y ?? 0
    currentParentId = parent.parentGroupId
    depth++
  }

  return { x, y }
}

/**
 * Convert absolute to relative position for parenting.
 */
export function toRelativePosition(
  absolutePos: Coordinates,
  parentAbsolutePos: Coordinates
): Coordinates {
  return {
    x: absolutePos.x - parentAbsolutePos.x,
    y: absolutePos.y - parentAbsolutePos.y
  }
}

/**
 * Convert relative to absolute position.
 */
export function toAbsolutePosition(
  relativePos: Coordinates,
  parentAbsolutePos: Coordinates
): Coordinates {
  return {
    x: relativePos.x + parentAbsolutePos.x,
    y: relativePos.y + parentAbsolutePos.y
  }
}
```

### 3B. Standardize Containment Logic

**Rule**:
- Tasks use **center point** containment (`isPointInRect`)
- Groups use **>50% area** containment (`isNodeMoreThanHalfInside`)

Update all composables to follow this consistently.

### 3C. Update Consumers

Replace local implementations with centralized utilities:

```typescript
// BEFORE (in useCanvasTaskDrag.ts)
if (node.parentNode) {
  const sectionId = node.parentNode.replace('section-', '')
  const section = canvasStore.groups.find(s => s.id === sectionId)
  if (section) {
    const parentAbsPos = getSectionAbsolutePosition(section)
    absoluteX = parentAbsPos.x + targetX
    absoluteY = parentAbsPos.y + targetY
  }
}

// AFTER
import { getAbsolutePosition } from '@/utils/canvas/positionCalculator'
const { x: absoluteX, y: absoluteY } = getAbsolutePosition(node, nodes.value)
```

---

## Verification Checklist

### After Phase 1 (Optimistic Sync)

- [ ] Build passes: `npm run build`
- [ ] No canvasStateLock imports: `grep -r "canvasStateLock" src/` returns empty
- [ ] Functional: Drag task → refresh → position persists
- [ ] Functional: Drag group → children follow → refresh → positions persist
- [ ] No 7-second blocking behavior

### After Phase 2 (Code Quality)

- [ ] Console statements: `grep -r "console\." src/composables/canvas/ | wc -l` = 0
- [ ] Type safety: `grep -r ": any\|as any" src/composables/canvas/ | wc -l` = 0
- [ ] Empty handlers filled with logic or proper delegation

### After Phase 3 (Consolidation)

- [ ] Single source of truth for position calculation
- [ ] Containment logic consistent across all composables
- [ ] No duplicate helper functions

---

## Files Summary

### Create

| File | Purpose |
|------|---------|
| `src/composables/canvas/useCanvasOptimisticSync.ts` | Timestamp-based sync conflict resolution |
| `src/utils/canvas/positionCalculator.ts` | Centralized coordinate utilities |

### Modify (Phase 1)

| File | Changes |
|------|---------|
| `useCanvasTaskDrag.ts` | Replace lockTaskPosition with trackLocalChange |
| `useCanvasGroupDrag.ts` | Replace lockGroupPosition with trackLocalChange |
| `useCanvasNodeSync.ts` | Replace getLockedTaskPosition with getPendingPosition |
| `useCanvasEvents.ts` | Remove isAnyCanvasStateLocked import |
| `useCanvasResize.ts` | Update lock usage |

### Modify (Phase 2)

All 15 files with console.log statements.
All 14 files with `any` types.
All 13 files with bug workaround comments.

### Delete

| File | LOC | Reason |
|------|-----|--------|
| `src/utils/canvasStateLock.ts` | 451 | Replaced by optimistic sync |

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Position Lock Bandaid | 451 LOC | 0 (deleted) |
| Console.log | 62 | 0 |
| `any` types | 41 | 0 |
| Empty handlers | 2 | 0 |
| Duplicated position logic | 3 files | 1 file |
| Total composable LOC | 5,658 | ~5,200 |

---

## Order of Operations

1. **TASK-198**: Create optimistic sync, integrate, delete lock (2-3 hours)
2. **TASK-199**: Remove console.log, fix types, fill handlers (2-3 hours)
3. **TASK-200**: Consolidate utilities, update consumers (2-3 hours)

**Total Estimated Effort**: 6-9 hours

---

## Risk Mitigation

1. **Test after each phase** - Run build + functional tests
2. **Create branch** - `feature/canvas-hardening`
3. **Commit incrementally** - One commit per sub-task
4. **Backup lock file** - Don't delete until optimistic sync verified
