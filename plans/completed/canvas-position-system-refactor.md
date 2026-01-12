# TASK-142: Canvas Position System Refactor - Unified Reliable Position Persistence

## Overview

Refactor the canvas position/persistence system to eliminate constant reset issues with task and group positions. Consolidate the current fragmented architecture (10+ modification points, 5+ state flags, 2 duplicate implementations) into a single, reliable position management system.

**Type:** Refactor
**Priority:** High
**Estimated Complexity:** Large (touches 10+ files, 8 user flows)

## Problem Statement

### Current Symptoms
- Task positions reset unexpectedly after page refresh
- Group/section positions reset during certain operations
- Positions "snap back" during or after database sync
- Multi-select drag sometimes loses positions
- HMR during development causes position resets

### Root Causes Identified

1. **Fragmented Position Modification Points** (10+ locations):
   - `useCanvasDragDrop.ts` - drag operations
   - `useCanvasResize.ts` - resize operations
   - `useCanvasSync.ts` - sync to Vue Flow
   - `taskOperations.ts` - task store updates
   - `canvas.ts` - canvas store operations
   - `CanvasView.vue` - watchers and handlers

2. **Multiple Competing State Flags**:
   - `isNodeDragging`
   - `isDragSettling` (500ms timeout)
   - `isResizeSettling`
   - `isSyncing`
   - `isHandlingNodeChange`

3. **Time-Based Lock System Limitations**:
   - 7-second fixed duration may expire before persistence completes
   - No guarantee lock survives component remount
   - Lock state unclear during HMR

4. **Duplicate Implementations**:
   - `getAbsolutePosition()` exists in both `positionUtils.ts` and `useCanvasDragDrop.ts`

5. **Undefined Coordinate System Contract**:
   - Unclear when positions are stored as absolute vs. parent-relative
   - Coordinate conversion logic scattered across multiple files

## Proposed Solution

### Architecture: Single Position Update Pipeline

Replace fragmented position modifications with a **centralized Position Manager** that:

1. **Acts as single source of truth** for position updates
2. **Manages locks** with event-driven expiration (not time-based)
3. **Handles coordinate transformation** consistently
4. **Queues updates** when locked, applies when safe
5. **Provides conflict resolution** between user actions and database sync

```
┌─────────────────────────────────────────────────────────────────┐
│                      Position Manager                            │
│                  (Single Point of Control)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │ Lock Manager │   │ Coord System │   │ Update Queue │        │
│  │              │   │ Transformer  │   │              │        │
│  │ • Event-based│   │              │   │ • Priority   │        │
│  │ • Persisted  │   │ • abs→rel    │   │ • Batching   │        │
│  │ • Per-entity │   │ • rel→abs    │   │ • Retry      │        │
│  └──────────────┘   └──────────────┘   └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
           │                    │                    │
    ┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐
    │ Drag Handler│      │ Sync Handler│      │ DB Persist  │
    │             │      │             │      │             │
    │ useCanvas   │      │ useCanvas   │      │ taskStore   │
    │ DragDrop    │      │ Sync        │      │ canvasStore │
    └─────────────┘      └─────────────┘      └─────────────┘
```

## Technical Approach

### Phase 1: Foundation - Position Manager Service

**Goal:** Create centralized position management with proper lock semantics

#### Tasks

1. **Create `PositionManager` class** (`src/services/canvas/PositionManager.ts`)
   - Single instance managing all position state
   - Event-driven lock lifecycle (lock on drag start, unlock on persist complete)
   - Coordinate system transformation API
   - Position update queue with priority

2. **Define Position Update Event Schema**
   ```typescript
   interface PositionUpdateEvent {
     entityId: string
     entityType: 'task' | 'section'
     source: 'drag' | 'resize' | 'sync' | 'database'
     position: { x: number; y: number }
     coordinateSystem: 'absolute' | 'relative'
     parentId?: string
     timestamp: number
     priority: 'user' | 'system'
   }
   ```

3. **Implement lock persistence** to localStorage
   - Survive HMR and page refresh
   - Auto-cleanup stale locks on app init

4. **Add conflict resolution policy**
   - User actions (drag/resize) always win over database sync
   - Queued database updates apply after lock release
   - Position tolerance check (2px) prevents micro-shifts

**Files to Create:**
- `src/services/canvas/PositionManager.ts`
- `src/services/canvas/types.ts`

**Files to Modify:**
- `src/utils/canvasStateLock.ts` - Refactor to use PositionManager
- `src/utils/canvas/positionUtils.ts` - Integrate with PositionManager

#### Success Criteria
- [ ] PositionManager can acquire/release locks
- [ ] Locks persist to localStorage and restore on page load
- [ ] Coordinate transformation is centralized

### Phase 2: Consolidate Position Modifications

**Goal:** Route all position changes through PositionManager

#### Tasks

1. **Refactor `useCanvasDragDrop.ts`**
   - Replace direct position modifications with `PositionManager.updatePosition()`
   - Remove duplicate `getAbsolutePosition()` implementation
   - Simplify to: acquire lock → update → release lock

2. **Refactor `useCanvasResize.ts`**
   - Route resize position updates through PositionManager
   - Handle child position recalculation via PositionManager

3. **Refactor `useCanvasSync.ts`**
   - Check PositionManager for locks before applying sync
   - Queue updates for locked entities
   - Use PositionManager for coordinate transformations

4. **Refactor `taskOperations.ts`**
   - Remove position lock check logic (delegated to PositionManager)
   - All position updates go through PositionManager

5. **Clean up `CanvasView.vue`**
   - Remove redundant state flags
   - Simplify watchers to use PositionManager events

**Files to Modify:**
- `src/composables/canvas/useCanvasDragDrop.ts`
- `src/composables/canvas/useCanvasResize.ts`
- `src/composables/canvas/useCanvasSync.ts`
- `src/stores/tasks/taskOperations.ts`
- `src/stores/canvas.ts`
- `src/views/CanvasView.vue`

#### Success Criteria
- [ ] All position modifications route through PositionManager
- [ ] No duplicate coordinate transformation logic
- [ ] State flags consolidated to PositionManager lock state

### Phase 3: Implement Robust Lock Lifecycle

**Goal:** Event-driven locks that guarantee position persistence

#### Tasks

1. **Replace time-based locks with event-driven locks**
   ```typescript
   // OLD: Time-based (7 seconds)
   lockTaskPosition(id, pos) // expires automatically

   // NEW: Event-driven
   const lockId = positionManager.acquireLock(id, 'drag')
   // ... perform operation ...
   await positionManager.persist(id, position)
   positionManager.releaseLock(lockId) // explicit release after persist
   ```

2. **Add persistence confirmation**
   - Lock only releases after database confirms save
   - Timeout fallback (30s) with warning log
   - Retry logic for failed persists

3. **Implement lock queue for database sync**
   - Sync events queue when entity is locked
   - Queue processed in order when lock releases
   - Stale queue items discarded (older than latest user action)

4. **Handle HMR and page refresh**
   - Serialize pending locks to localStorage
   - Restore locks on app init
   - Resume pending persists

**Files to Create:**
- `src/services/canvas/LockManager.ts` (extracted from PositionManager)

**Files to Modify:**
- `src/services/canvas/PositionManager.ts`
- `src/composables/canvas/useCanvasDragDrop.ts`
- `src/composables/canvas/useCanvasResize.ts`

#### Success Criteria
- [ ] Locks only release after confirmed persistence
- [ ] Database sync queues properly for locked entities
- [ ] Position survives HMR and page refresh

### Phase 4: Standardize Coordinate System

**Goal:** Clear, consistent coordinate handling for parent-child relationships

#### Tasks

1. **Document coordinate contract**
   - Tasks store **absolute** canvas positions
   - Sections store **absolute** canvas positions
   - Vue Flow receives **relative** positions for child nodes
   - Transformation happens in PositionManager only

2. **Centralize coordinate transformation**
   - Remove all inline coordinate math from composables
   - Single `toRelative(pos, parentPos)` and `toAbsolute(pos, parentPos)` in PositionManager

3. **Handle reparenting transitions**
   - Task enters section: preserve visual position, convert to relative, save
   - Task exits section: convert to absolute, clear parentId, save
   - Section moves: no database update for children (relative positions unchanged)

4. **Add position validation**
   - Validate all positions through `isValidPosition()` before save
   - Sanitize NaN/Infinity values
   - Log warnings for invalid position attempts

**Files to Modify:**
- `src/services/canvas/PositionManager.ts`
- `src/utils/canvas/positionUtils.ts`
- `src/composables/canvas/useCanvasDragDrop.ts`

#### Success Criteria
- [ ] All coordinate transformations in one place
- [ ] Parent-child position relationship clearly documented
- [ ] Reparenting preserves visual position

### Phase 5: Polish & Validation

**Goal:** Ensure stability and catch regressions

#### Tasks

1. **Add comprehensive Playwright tests**
   - Single task drag → position persists
   - Section drag → position persists
   - Multi-select drag → all positions persist
   - Task into section → reparenting works
   - Page refresh → positions restored
   - Rapid successive drags → no position loss

2. **Add position change telemetry** (optional)
   - Log position updates with source for debugging
   - Track lock acquisition/release
   - Monitor queue depth

3. **Clean up deprecated code**
   - Remove `canvasPositionLock.ts` (already deleted per git status)
   - Remove unused state flags
   - Remove duplicate implementations

4. **Update documentation**
   - Document PositionManager API
   - Update CLAUDE.md if needed
   - Add troubleshooting guide for position issues

**Files to Create:**
- `tests/canvas-position-manager.spec.ts`

**Files to Modify:**
- `tests/canvas-position-persistence.spec.ts` (extend existing)
- `docs/claude-md-extension/troubleshooting.md`

#### Success Criteria
- [ ] All Playwright tests pass
- [ ] No position resets in manual testing
- [ ] Clean build with no warnings

## Alternative Approaches Considered

### Option A: Patch Current System (Rejected)
- **Approach:** Add more guards and flags to existing system
- **Pros:** Faster initial implementation
- **Cons:** Increases complexity, doesn't address root cause, temporary fix
- **Rejection Reason:** Already tried in TASK-131; problems persist

### Option B: Full Vue Flow State Delegation (Rejected)
- **Approach:** Let Vue Flow be sole source of truth, sync to store on idle
- **Pros:** Simpler mental model
- **Cons:** Loses persistence during crash, conflicts with existing Pinia architecture
- **Rejection Reason:** Too invasive, breaks existing sync patterns

### Option C: Centralized Position Manager (Selected)
- **Approach:** Single service managing all position state and updates
- **Pros:** Clear ownership, testable, maintainable
- **Cons:** Requires significant refactoring
- **Selection Reason:** Addresses root cause, provides foundation for future improvements

## Acceptance Criteria

### Functional Requirements
- [ ] Task drag position persists after page refresh
- [ ] Section drag position persists after page refresh
- [ ] Multi-select drag persists all selected positions
- [ ] Dragging task into section works correctly
- [ ] Dragging task out of section works correctly
- [ ] Database sync does not overwrite user's current drag
- [ ] HMR does not reset positions (dev mode)

### Non-Functional Requirements
- [ ] No visible position "snap" or flicker during normal use
- [ ] Position updates complete within 2 seconds of drag end
- [ ] System handles 100+ nodes without performance degradation

### Quality Gates
- [ ] All existing canvas tests pass
- [ ] New Playwright tests cover all 8 user flows
- [ ] Code review approval
- [ ] Manual QA sign-off

## Dependencies & Prerequisites

### Technical Dependencies
- Existing `canvasStateLock.ts` (will be refactored)
- Existing `positionUtils.ts` (will be integrated)
- Vue Flow composables (`useVueFlow`)
- Pinia stores (tasks, canvas)

### Blocked By
- None (can start immediately)

### Blocks
- Future canvas features that depend on position reliability

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Refactor introduces new bugs | Medium | High | Comprehensive test coverage, gradual rollout |
| Performance regression | Low | Medium | Benchmark before/after, optimize hot paths |
| Breaking existing workflows | Medium | High | Characterization tests before refactor |
| Lock deadlocks | Low | High | Timeout fallbacks, lock monitoring |
| Migration issues | Low | Medium | No database schema changes needed |

## Success Metrics

- **Zero position resets** in 1 week of normal use after deployment
- **Test coverage** for all 8 user flows
- **Code reduction** in position-related logic (fewer lines, clearer flow)
- **Reduced state flags** from 5+ to 1-2

## Future Considerations

- **Real-time collaboration:** PositionManager provides foundation for conflict resolution
- **Undo/redo:** Position updates can be captured as commands
- **Position animation:** Centralized updates enable smooth transitions
- **Offline mode:** Queue persistence enables offline position changes

## Documentation Plan

- [ ] Update `docs/claude-md-extension/architecture.md` with PositionManager docs
- [ ] Add `docs/sop/active/canvas-position-debugging.md` for troubleshooting
- [ ] Update code comments in refactored files

## References & Research

### Internal References
- Position lock system: `src/utils/canvasStateLock.ts:55-218`
- Position utilities: `src/utils/canvas/positionUtils.ts:25-98`
- Canvas sync: `src/composables/canvas/useCanvasSync.ts:57-430`
- Drag handling: `src/composables/canvas/useCanvasDragDrop.ts:473-969`
- Task operations: `src/stores/tasks/taskOperations.ts:118-194`
- Existing plan: `plans/canvas-view-stabilization-eliminate-resets.md`

### External References
- Vue Flow State Management: https://vueflow.dev/guide/vue-flow/state.html
- Vue Flow Controlled Flow: https://vueflow.dev/guide/controlled-flow.html
- Vue Flow Nodes Guide: https://vueflow.dev/guide/node.html
- Pinia State Management: https://pinia.vuejs.org/core-concepts/state.html

### Related Work
- TASK-131: Canvas View Stabilization Phase 2 (recent fixes)
- Previous position reset issues in session context

---

**Generated with Claude Code** - January 8, 2026
