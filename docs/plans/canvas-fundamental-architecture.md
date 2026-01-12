# Canvas Fundamental Architecture Redesign

> **Status:** PROPOSAL
> **Created:** January 12, 2026
> **Purpose:** Replace patchy fixes with a stable, maintainable architecture

---

## Problem Statement

The current canvas system has 29+ composables (5000+ lines) that evolved through incremental bug fixes. Each fix addressed symptoms rather than root causes, leading to:

1. **Competing truth sources** for positions and state
2. **ID format inconsistencies** (section-{id} vs {id})
3. **Coordinate system conversions** scattered throughout the codebase
4. **Lock flag proliferation** (7+ different drag/sync flags)
5. **Incomplete refactors** leaving hybrid legacy/new code

---

## Fundamental Design Principles

### 1. Single Source of Truth (SSOT)

```
┌──────────────────────────────────────────────────────────────┐
│                    PINIA STORES (SSOT)                       │
│  canvasStore.groups[] + taskStore.tasks[]                    │
│  - ALL position data lives here                              │
│  - ALL ID normalization happens here                         │
│  - Vue Flow is a READ-ONLY RENDERER                          │
└──────────────────────────────────────────────────────────────┘
         │
         │ Watch (deep, debounced)
         ▼
┌──────────────────────────────────────────────────────────────┐
│                    VUE FLOW (RENDERER)                       │
│  - Receives computed nodes/edges                             │
│  - NEVER mutates store directly                              │
│  - Emits events → Event Bus → Store Actions                  │
└──────────────────────────────────────────────────────────────┘
         │
         │ User Interaction Events
         ▼
┌──────────────────────────────────────────────────────────────┐
│                    CANVAS EVENT BUS                          │
│  - Serializes all interactions into store actions            │
│  - Single place for lock/conflict management                 │
│  - Defers to OperationManager for state transitions          │
└──────────────────────────────────────────────────────────────┘
```

### 2. Single Coordinate System

**Decision: Store RELATIVE positions everywhere**

Why? Vue Flow is the rendering layer and expects relative positions. Converting absolute→relative on every sync is error-prone.

```typescript
// NEW: Position is always relative to parent
interface CanvasPosition {
  x: number          // Relative to parent (or canvas origin if no parent)
  y: number          // Relative to parent
  parentId?: string  // Explicit parent reference
}

// OLD: Had to convert
absoluteX = parentAbsoluteX + relativeX + GROUP_BORDER_WIDTH  // ERROR-PRONE
```

**Migration Strategy:**
1. Add `positionFormat: 'relative' | 'absolute'` flag to DB records
2. Migrate on read: if `absolute`, convert to relative once
3. Write new records as `relative`
4. After all records migrated, remove conversion code

### 3. Normalized ID Layer

**Single place for ID management:**

```typescript
// src/utils/canvas/canvasIds.ts
export const CanvasIds = {
  // Canonical formats
  groupNodeId: (groupId: string) => `section-${groupId}`,
  taskNodeId: (taskId: string) => taskId,

  // Parsing
  parseNodeId: (nodeId: string): { type: 'group' | 'task', id: string } => {
    if (nodeId.startsWith('section-')) {
      return { type: 'group', id: nodeId.replace('section-', '') }
    }
    return { type: 'task', id: nodeId }
  },

  // Validation
  isGroupNode: (nodeId: string) => nodeId.startsWith('section-'),
  isTaskNode: (nodeId: string) => !nodeId.startsWith('section-'),

  // Edge IDs
  edgeId: (sourceId: string, targetId: string) => `e-${sourceId}-${targetId}`
}
```

**Rule:** All canvas code uses `CanvasIds.*` - never string manipulation inline.

### 4. Operation State Machine

Replace ad-hoc flags with a formal state machine:

```typescript
// src/composables/canvas/useCanvasOperationState.ts
type CanvasOperationState =
  | { type: 'idle' }
  | { type: 'dragging', nodeIds: string[], startPositions: Map<string, Position> }
  | { type: 'drag-settling', nodeIds: string[], settleTimeout: number }
  | { type: 'resizing', groupId: string, handle: string }
  | { type: 'resize-settling', groupId: string, settleTimeout: number }
  | { type: 'syncing', source: 'local' | 'remote' }
  | { type: 'editing', nodeId: string }

export function useCanvasOperationState() {
  const state = ref<CanvasOperationState>({ type: 'idle' })

  // Transitions
  const startDrag = (nodeIds: string[], positions: Map<string, Position>) => {
    if (state.value.type !== 'idle') return false
    state.value = { type: 'dragging', nodeIds, startPositions: positions }
    return true
  }

  const endDrag = () => {
    if (state.value.type !== 'dragging') return
    const settleTimeout = window.setTimeout(() => {
      state.value = { type: 'idle' }
    }, 800)
    state.value = { type: 'drag-settling', nodeIds: state.value.nodeIds, settleTimeout }
  }

  // Guards
  const canAcceptRemoteUpdate = computed(() =>
    state.value.type === 'idle' || state.value.type === 'syncing'
  )

  const canStartDrag = computed(() => state.value.type === 'idle')

  return { state, startDrag, endDrag, canAcceptRemoteUpdate, canStartDrag }
}
```

**Benefits:**
- No more conflicting flags
- Clear state transitions
- Easy to debug (single state variable)
- Impossible to be in "dragging" and "resizing" simultaneously

### 5. Consolidated Composable Architecture

Reduce 29 composables to 6 focused modules:

```
src/composables/canvas/
├── useCanvasCore.ts           # Vue Flow instance, nodes/edges refs
├── useCanvasOperations.ts     # State machine + lock management
├── useCanvasSync.ts           # Store ↔ Vue Flow sync (read-only direction)
├── useCanvasInteractions.ts   # Drag, resize, selection, connections
├── useCanvasModals.ts         # All modal state (keep as-is, it's clean)
└── useCanvasOrchestrator.ts   # Composes above, exposes to CanvasView

DELETED (functionality merged):
- useCanvasDragDrop.ts        → useCanvasInteractions
- useCanvasGroupDrag.ts       → useCanvasInteractions
- useCanvasTaskDrag.ts        → useCanvasInteractions
- useCanvasParentChild.ts     → useCanvasSync (containment is sync concern)
- useCanvasTaskCounts.ts      → canvasStore (counts are store state)
- useCanvasOptimisticSync.ts  → useCanvasOperations (locks are operation concern)
- useCanvasNodeSync.ts        → useCanvasSync
- useCanvasEdgeSync.ts        → useCanvasSync
- useCanvasEvents.ts          → useCanvasInteractions
- useCanvasResize.ts          → useCanvasInteractions
- useCanvasSelection.ts       → useCanvasInteractions
- useCanvasConnections.ts     → useCanvasInteractions
- useCanvasLifecycle.ts       → useCanvasOrchestrator (inline)
- useCanvasFilteredState.ts   → useCanvasSync (filter is sync concern)
- useNodeAttachment.ts        → useCanvasInteractions

KEPT (specialized, small):
- useCanvasHotkeys.ts         # Keyboard shortcuts (keep separate)
- useCanvasZoom.ts            # Zoom controls (keep separate)
- useCanvasNavigation.ts      # Viewport controls (keep separate)
- useCanvasAlignment.ts       # Align/distribute (keep separate)
- useCanvasOverdueCollector.ts # Smart groups (keep separate)
- useCanvasSectionProperties.ts # Section property assignment (keep separate)
- useCanvasContextMenus.ts    # Context menus (keep separate)
- useCanvasGroupActions.ts    # Group CRUD (keep separate)
- useCanvasTaskActions.ts     # Task CRUD (keep separate)
```

**Result:** 15 composables instead of 29, with clear responsibilities.

---

## Implementation Plan

### Phase 1: Foundation (Non-Breaking)

1. **Create `CanvasIds` utility** - Centralized ID management
2. **Create `useCanvasOperationState`** - State machine for locks
3. **Add unit tests** for new utilities

### Phase 2: Gradual Migration

4. **Migrate ID usage** - Replace inline string manipulation with CanvasIds.*
5. **Migrate lock flags** - Replace individual flags with operation state machine
6. **Add position format flag** - Prepare for coordinate system migration

### Phase 3: Consolidation

7. **Merge composables** - Combine related functionality per plan above
8. **Convert to relative coordinates** - Migrate existing absolute positions
9. **Remove conversion code** - Clean up after migration complete

### Phase 4: Verification

10. **Integration tests** - Canvas operations, sync, persistence
11. **Manual testing** - Drag, resize, nesting, reload
12. **Performance validation** - No regression in sync latency

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing behavior | Feature flags for each phase |
| Lost work during migration | Separate git branch per phase |
| Performance regression | Benchmark before/after |
| Incomplete migration | Each phase is independently deployable |

---

## Success Criteria

1. **Single place for ID format** - No more section-{id} vs {id} bugs
2. **Single state machine for locks** - No conflicting flags
3. **Fewer composables** - <20 canvas composables total
4. **No coordinate conversion bugs** - Positions persist correctly
5. **Faster debugging** - State is inspectable via Vue DevTools

---

## Appendix: Current Composable Inventory

| File | Lines | Purpose | Action |
|------|-------|---------|--------|
| useCanvasOrchestrator.ts | ~400 | Aggregator | REFACTOR |
| useCanvasSync.ts | ~200 | Store→Vue Flow sync | REFACTOR |
| useCanvasCore.ts | ~100 | Vue Flow refs | KEEP |
| useCanvasDrag.ts | ~200 | Unified drag | MERGE→Interactions |
| useCanvasGroups.ts | ~150 | Group operations | MERGE→Interactions |
| useCanvasResize.ts | ~300 | Resize handling | MERGE→Interactions |
| useCanvasEvents.ts | ~200 | Event handlers | MERGE→Interactions |
| useCanvasSelection.ts | ~150 | Selection handling | MERGE→Interactions |
| useCanvasConnections.ts | ~150 | Edge connections | MERGE→Interactions |
| useCanvasParentChild.ts | ~250 | Containment logic | MERGE→Sync |
| useCanvasGroupMembership.ts | ~100 | Group queries | MERGE→Sync |
| useCanvasFilteredState.ts | ~100 | Task filtering | MERGE→Sync |
| useCanvasEditingSession.ts | ~50 | Edit state | MERGE→Operations |
| useCanvasHotkeys.ts | ~100 | Keyboard | KEEP |
| useCanvasZoom.ts | ~80 | Zoom | KEEP |
| useCanvasNavigation.ts | ~100 | Viewport | KEEP |
| useCanvasAlignment.ts | ~150 | Align/distribute | KEEP |
| useCanvasOverdueCollector.ts | ~100 | Smart groups | KEEP |
| useCanvasSectionProperties.ts | ~80 | Section props | KEEP |
| useCanvasContextMenus.ts | ~80 | Context menus | KEEP |
| useCanvasGroupActions.ts | ~150 | Group CRUD | KEEP |
| useCanvasTaskActions.ts | ~200 | Task CRUD | KEEP |
| useCanvasModals.ts | ~80 | Modal state | KEEP |
| useCanvasLifecycle.ts | ~80 | Lifecycle hooks | INLINE |
| useNodeAttachment.ts | ~100 | Node attachment | MERGE→Interactions |
| useCanvasResizeState.ts | ~50 | Resize state | MERGE→Resize |
| useCanvasResizeCalculation.ts | ~100 | Resize math | MERGE→Resize |
| useMidnightTaskMover.ts | ~80 | Midnight scheduler | KEEP |

**Total current:** 29 composables, ~4000 lines
**Target:** 15 composables, ~2500 lines

---

## Decision Required

Before proceeding, confirm:

1. **Coordinate system choice:** Relative-first (recommended) or stay with absolute?
2. **Migration approach:** Big-bang refactor or incremental phases?
3. **Timeline priority:** Speed (riskier) or stability (slower)?
