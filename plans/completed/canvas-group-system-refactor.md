# Canvas Group System Refactor - Complete Architecture Rewrite

**ID**: TASK-141
**Type**: Refactor / Architecture
**Priority**: P0-CRITICAL
**Status**: PLANNED
**Created**: January 8, 2026

---

## Overview

A complete rewrite of the canvas group system to eliminate all parent-child relationship bugs by embracing Vue Flow's native `parentNode` system instead of fighting it with manual coordinate conversions and competing lock systems.

**Problems Solved:**
1. Groups don't recognize each other (parent-child detection fails)
2. Nested groups don't always move with parent group
3. Z-depth issues where groups are hidden under others
4. Groups don't recognize all tasks inside them
5. Groups sometimes move items that aren't physically inside them
6. Resizing from some edges causes children to move (shouldn't happen)

---

## Problem Statement

### Root Cause Analysis

The current implementation **fights Vue Flow's native parent-child system** instead of embracing it:

| Problem | Root Cause |
|---------|------------|
| Groups don't move together | Manual position recalculation instead of using Vue Flow's automatic parent-child movement |
| Z-index issues | Dynamic z-index calculation based on depth but inconsistent application |
| Containment detection fails | Uses center point detection which misses edge cases |
| Position resets | Dual coordinate systems (absolute for persistence, relative for Vue Flow) cause conversion errors |
| Resize moves children | Complex inverse delta compensation that fails on certain edges |

### Competing Systems Detected

| System | Location | Problem |
|--------|----------|---------|
| `canvasStateLock.ts` | Position locks | 7-second locks compete with drag operations |
| Position drift correction | `useCanvasSync.ts:106-124` | 2px tolerance check conflicts with intentional moves |
| `NodeUpdateBatcher` | Batch updates | 16ms batching + high-priority bypass defeats batching purpose |
| Store deep watchers | `canvas.ts:547-551` | Disabled but structure remains for triggering cascading updates |
| Dual coordinate systems | Throughout | Absolute (store) vs Relative (Vue Flow) conversion errors |

### Current Architecture Flow (Problematic)

```
User drags group
    ↓
Manual position calculation (error-prone)
    ↓
Store update with absolute coordinates
    ↓
Deep watcher triggers sync
    ↓
Sync converts to relative coordinates (drift introduced)
    ↓
Vue Flow updates nodes
    ↓
Position mismatch detected, "correction" applied
    ↓
Position jumps/resets
```

---

## Proposed Solution

### Core Principle: Trust Vue Flow

**Use Vue Flow's native `parentNode` system completely:**

1. **Single Source of Truth**: Vue Flow's `parentNode` property defines all relationships
2. **Relative Positions Only**: Store relative positions for children, let Vue Flow compute absolute
3. **No Manual Movement**: Let Vue Flow handle parent-child movement automatically
4. **Native Utilities**: Use `getIntersectingNodes`, `getNodesInside` for containment

### New Architecture Flow

```
User drags group
    ↓
Vue Flow moves group + all children automatically (built-in)
    ↓
onNodeDragStop event fires
    ↓
Persist relative positions (simple save)
    ↓
Done - no conversion, no drift
```

---

## Technical Approach

### Architecture

#### 1. Containment Detection Algorithm

```typescript
// Use Vue Flow's native intersection detection
function detectContainment(node: Node, groups: Node[]): string | undefined {
  const { getIntersectingNodes, getNodes } = useVueFlow()

  // Find all groups that intersect with this node
  const intersecting = getIntersectingNodes(node)
    .filter(n => n.type === 'group')
    .filter(n => n.id !== node.id) // Can't be parent of self

  if (intersecting.length === 0) return undefined

  // Select the SMALLEST group (most specific container)
  // This handles nested groups correctly
  return intersecting.reduce((smallest, current) => {
    const currentArea = (current.dimensions?.width ?? 0) * (current.dimensions?.height ?? 0)
    const smallestArea = (smallest.dimensions?.width ?? 0) * (smallest.dimensions?.height ?? 0)
    return currentArea < smallestArea ? current : smallest
  }).id
}
```

**Key Decision**: Smallest containing group wins (most specific container)

#### 2. Z-Index Calculation

```typescript
// Formula: (depth * 10) + 1 for children
// Groups: z = depth * 10
// Tasks inside groups: z = (depth * 10) + 1

function calculateZIndex(node: Node, nodes: Node[]): number {
  const BASE_TASK_Z = 100 // Tasks always above groups

  if (node.type === 'group') {
    const depth = getAncestorDepth(node.id, nodes)
    return depth * 10
  } else {
    // Task node
    if (node.parentNode) {
      const parentDepth = getAncestorDepth(node.parentNode, nodes)
      return BASE_TASK_Z + (parentDepth * 10)
    }
    return BASE_TASK_Z
  }
}

function getAncestorDepth(nodeId: string, nodes: Node[], depth = 0): number {
  if (depth > 10) return depth // Max depth guard
  const node = nodes.find(n => n.id === nodeId)
  if (!node?.parentNode) return depth
  return getAncestorDepth(node.parentNode, nodes, depth + 1)
}
```

#### 3. Database Schema

**New Schema (Simplified)**:
```typescript
interface CanvasNode {
  id: string
  type: 'task' | 'group'
  parentNode?: string // Vue Flow parent reference
  position: { x: number, y: number } // ALWAYS relative if parentNode exists
  dimensions?: { width: number, height: number } // For groups
  zIndex?: number
  data: Record<string, unknown>
}
```

**Migration Rule**: If `parentNode` exists, `position` is relative to parent. If no `parentNode`, `position` is absolute (canvas coordinates).

#### 4. Circular Reference Prevention

```typescript
function canSetParent(childId: string, newParentId: string, nodes: Node[]): boolean {
  // Check if newParentId is already a descendant of childId
  const visited = new Set<string>()

  function isDescendant(nodeId: string, targetId: string): boolean {
    if (visited.has(nodeId)) return false
    visited.add(nodeId)

    const children = nodes.filter(n => n.parentNode === nodeId)
    for (const child of children) {
      if (child.id === targetId) return true
      if (isDescendant(child.id, targetId)) return true
    }
    return false
  }

  // Would setting this parent create a cycle?
  return !isDescendant(childId, newParentId)
}
```

### Implementation Phases

#### Phase 0: Consolidation (Prerequisites)

**Goal**: Remove competing systems before building new

- [ ] Delete `src/utils/canvasPositionLock.ts` (superseded by `canvasStateLock.ts`)
- [ ] Remove high-priority bypass from `NodeUpdateBatcher`
- [ ] Remove deep watchers in `canvas.ts` (already disabled)
- [ ] Remove position drift correction in `useCanvasSync.ts`
- [ ] Audit all callers of old position lock functions

**Files to modify**:
- `src/utils/canvasPositionLock.ts` → DELETE
- `src/utils/canvas/NodeUpdateBatcher.ts:45-60` → Remove bypass logic
- `src/composables/canvas/useCanvasSync.ts:106-124, 219-232` → Remove drift correction
- `src/stores/canvas.ts:547-551` → Remove disabled watcher completely

**Success Criteria**:
- Build passes with no position lock imports
- No "drift correction" or "tolerance check" code remains

#### Phase 1: Foundation - New Parent-Child System

**Goal**: Implement Vue Flow native parent-child relationships

**Tasks**:
- [ ] Create `src/composables/canvas/useCanvasParentChild.ts` composable
- [ ] Implement containment detection using `getIntersectingNodes`
- [ ] Implement z-index calculation based on depth
- [ ] Implement circular reference prevention
- [ ] Add `extent: 'parent'` option for constraining children

**New File**: `src/composables/canvas/useCanvasParentChild.ts`
```typescript
export function useCanvasParentChild() {
  const { getIntersectingNodes, updateNode, getNodes } = useVueFlow()

  return {
    detectContainment,
    calculateZIndex,
    canSetParent,
    setParent,
    removeParent,
    getChildren,
    getAncestors,
  }
}
```

**Success Criteria**:
- Unit tests pass for all utility functions
- Circular reference detection works

#### Phase 2: Core Implementation - Drag & Drop

**Goal**: Implement drag behavior using Vue Flow's automatic parent movement

**Tasks**:
- [ ] Refactor `useCanvasDragDrop.ts` to use new parent-child system
- [ ] Remove manual position calculations for children
- [ ] Implement parent detection on drag stop
- [ ] Convert positions on parent change (absolute ↔ relative)
- [ ] Update z-index on parent change

**Key Changes to `useCanvasDragDrop.ts`**:
```typescript
onNodeDragStop(({ node }) => {
  if (node.type === 'group') {
    // Groups just save their new position, children move automatically
    persistGroupPosition(node.id, node.position)
  } else {
    // Tasks: detect if dropped into/out of a group
    const newParent = detectContainment(node, getGroups())

    if (newParent !== node.parentNode) {
      // Parent changed - convert coordinates
      if (newParent) {
        // Moving INTO a group: convert absolute → relative
        const parentNode = findNode(newParent)
        const relativePos = {
          x: node.positionAbsolute.x - parentNode.positionAbsolute.x,
          y: node.positionAbsolute.y - parentNode.positionAbsolute.y,
        }
        updateNode(node.id, { parentNode: newParent, position: relativePos })
      } else {
        // Moving OUT of a group: position is already absolute from Vue Flow
        updateNode(node.id, { parentNode: undefined })
      }
    }

    persistTaskPosition(node.id, node.position, node.parentNode)
  }
})
```

**Success Criteria**:
- Moving parent group moves all children automatically
- Dropping task into group parents it correctly
- Dragging task out of group unparents it correctly
- No position jumps or drift

#### Phase 3: Resize Handling

**Goal**: Fix resize behavior so children maintain visual position

**Tasks**:
- [ ] Refactor `useCanvasResize.ts` to handle resize properly
- [ ] Remove inverse delta compensation (not needed with relative positions)
- [ ] Detect children that end up outside group after resize
- [ ] Auto-unparent children that are now outside

**Key Insight**: With relative positioning, children automatically "stick" to their position within the parent. The only issue is when resize makes the parent smaller than child positions.

**New Resize Logic**:
```typescript
onResizeEnd(({ node }) => {
  // Check which children are now outside bounds
  const children = getChildren(node.id)

  for (const child of children) {
    const isInside = isPointInRect(
      child.position, // relative position
      { x: 0, y: 0, width: node.dimensions.width, height: node.dimensions.height }
    )

    if (!isInside) {
      // Child is outside, unparent it
      const absolutePos = child.positionAbsolute
      updateNode(child.id, { parentNode: undefined, position: absolutePos })
    }
  }

  persistGroupDimensions(node.id, node.dimensions)
})
```

**Success Criteria**:
- Resizing from any edge works correctly
- Children maintain visual position during resize
- Children outside bounds after resize are unparented

#### Phase 4: Data Migration

**Goal**: Migrate existing canvas data to new format

**Tasks**:
- [ ] Create migration script `scripts/migrate-canvas-positions.ts`
- [ ] Detect current parent-child relationships by spatial containment
- [ ] Convert absolute positions to relative for children
- [ ] Add `parentNode` property to migrated nodes
- [ ] Create rollback mechanism

**Migration Algorithm**:
```typescript
async function migrateCanvasData(canvas: CanvasData): Promise<CanvasData> {
  const groups = canvas.groups.sort((a, b) => {
    // Process largest groups first (parents before children)
    const areaA = a.position.width * a.position.height
    const areaB = b.position.width * b.position.height
    return areaB - areaA
  })

  // Step 1: Detect group nesting
  for (const group of groups) {
    const parent = findSmallestContainingGroup(group, groups)
    if (parent) {
      group.parentNode = `section-${parent.id}`
      group.position = {
        x: group.position.x - parent.position.x,
        y: group.position.y - parent.position.y,
        width: group.position.width,
        height: group.position.height,
      }
    }
  }

  // Step 2: Detect task containment
  for (const task of canvas.tasks) {
    const parent = findSmallestContainingGroup(task, groups)
    if (parent) {
      task.parentNode = `section-${parent.id}`
      task.canvasPosition = {
        x: task.canvasPosition.x - parent.position.x,
        y: task.canvasPosition.y - parent.position.y,
      }
    }
  }

  return canvas
}
```

**Success Criteria**:
- Existing canvases load without visual changes
- All parent-child relationships detected correctly
- Rollback restores original state

#### Phase 5: Polish & Validation

**Goal**: Add visual feedback, handle edge cases, write tests

**Tasks**:
- [ ] Add visual feedback for parent-child relationships (dashed border, highlight)
- [ ] Implement delete group confirmation modal
- [ ] Handle maximum nesting depth (5 levels)
- [ ] Handle empty groups (allow, no auto-delete)
- [ ] Add Playwright E2E tests for all flows
- [ ] Performance test with 100+ node groups

**Visual Feedback**:
```vue
<!-- GroupNodeSimple.vue -->
<template>
  <div
    class="group-node"
    :class="{
      'is-parent': hasChildren,
      'is-child': hasParent,
      'drop-target': isDropTarget,
    }"
  >
    <!-- content -->
  </div>
</template>

<style>
.group-node.is-child {
  border: 2px dashed var(--color-border-secondary);
}
.group-node.drop-target {
  border-color: var(--color-primary);
  background: var(--color-primary-ghost);
}
</style>
```

**Success Criteria**:
- All Playwright tests pass
- No visual regressions
- Performance acceptable with large groups

---

## Acceptance Criteria

### Functional Requirements

- [ ] Moving a parent group moves ALL children (nested groups + tasks) automatically
- [ ] Z-index correctly layers: parent groups below child groups below tasks
- [ ] Dropping task into group correctly parents it with relative positioning
- [ ] Dragging task out of group correctly unparents it
- [ ] Resizing group from ANY edge maintains child visual positions
- [ ] Children outside group bounds after resize are unparented
- [ ] Nested groups up to 5 levels deep work correctly
- [ ] Circular parent references are prevented

### Non-Functional Requirements

- [ ] No position drift over time (verified by 100 move operations)
- [ ] Drag operations feel responsive (<16ms per frame)
- [ ] Canvas loads in <500ms with 50 groups and 200 tasks
- [ ] Memory usage stable (no leaks during drag operations)

### Quality Gates

- [ ] All existing Playwright tests pass
- [ ] New Playwright tests for each user flow
- [ ] Code review approval
- [ ] Manual QA of all 10 user flows
- [ ] Performance benchmark passes

---

## Risk Analysis & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Migration corrupts existing data | Medium | Critical | Backup before migration, rollback script ready, test on copy first |
| Performance regression with many nodes | Low | High | Benchmark before/after, optimize hot paths |
| Vue Flow API changes in future | Low | Medium | Pin Vue Flow version, document API usage |
| Edge cases not covered | Medium | Medium | Extensive Playwright tests, QA checklist |
| User confusion with new behavior | Low | Low | No visible UX change, same visual behavior |

---

## Resource Requirements

- **Estimated Effort**: Multi-session work (4-6 focused sessions)
- **Dependencies**: None (self-contained refactor)
- **Testing**: Playwright E2E tests required
- **Rollback**: Git revert + migration rollback script

---

## Future Considerations

### Potential Enhancements (Post-Refactor)
- Keyboard shortcuts for group operations (G to group, Shift+G to ungroup)
- Touch gestures for tablet users
- Collapsible groups (minimize to show only header)
- Smart group auto-nesting (drop task, auto-detect best group)

### Extensibility
The new `useCanvasParentChild` composable can be extended for:
- Undo/redo integration (track parent changes)
- Multi-select group operations
- Copy/paste with hierarchy preservation

---

## References & Research

### Internal References
- Current drag implementation: `src/composables/canvas/useCanvasDragDrop.ts`
- Current resize implementation: `src/composables/canvas/useCanvasResize.ts`
- Current sync logic: `src/composables/canvas/useCanvasSync.ts`
- Canvas store: `src/stores/canvas.ts`
- Group types: `src/stores/canvas/types.ts:40-69`

### External References
- Vue Flow Nested Nodes: https://vueflow.dev/examples/nodes/nesting
- Vue Flow Node Guide: https://vueflow.dev/guide/node.html
- Vue Flow Node Resizer: https://vueflow.dev/guide/components/node-resizer
- Vue Flow Troubleshooting: https://vueflow.dev/guide/troubleshooting.html
- GitHub Discussion on Nesting: https://github.com/bcakmakoglu/vue-flow/discussions/20

### Design Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Use smallest containing group | Most specific container is intuitive | Largest (rejected - counterintuitive), most recent (rejected - unpredictable) |
| Max 5 nesting levels | Balance between flexibility and performance | Unlimited (rejected - perf risk), 3 levels (rejected - too restrictive) |
| Keep empty groups | User might want to add tasks later | Auto-delete (rejected - data loss risk) |
| Delete group defaults to "Keep tasks" | Data loss prevention | Delete all (rejected - accidental data loss) |

---

## Test Plan

### E2E Tests (Playwright)

```typescript
// tests/canvas-groups.spec.ts

test.describe('Canvas Group System', () => {
  test('moving parent group moves all children', async ({ page }) => {
    // Create group with tasks
    // Move group
    // Verify all children moved proportionally
  })

  test('nested groups move with parent', async ({ page }) => {
    // Create nested group structure
    // Move top-level parent
    // Verify all descendants moved
  })

  test('z-index layering is correct', async ({ page }) => {
    // Create overlapping groups
    // Verify child groups are above parent
    // Verify tasks are above groups
  })

  test('dropping task into group parents it', async ({ page }) => {
    // Create task outside group
    // Drag task into group
    // Move group
    // Verify task moves with group
  })

  test('dragging task out unparents it', async ({ page }) => {
    // Create task inside group
    // Drag task outside group
    // Move group
    // Verify task does NOT move with group
  })

  test('resize does not move children', async ({ page }) => {
    // Create group with tasks
    // Resize from left edge
    // Verify task visual positions unchanged
  })

  test('circular reference prevented', async ({ page }) => {
    // Create group A containing group B
    // Try to drag group A into group B
    // Verify operation blocked or handled gracefully
  })
})
```

---

## Summary

This refactor replaces a complex, bug-prone system with Vue Flow's built-in parent-child support. The key insight is that **we were fighting the framework** instead of using it.

**Before**: Manual coordinate conversions, competing lock systems, drift correction hacks
**After**: Vue Flow's `parentNode` property, automatic movement, simple persistence

The implementation is divided into 5 phases, with Phase 0 (consolidation) being critical to remove competing systems before building the new one.
