# Canvas View Stabilization: Eliminate Task/Group/Viewport Resets

**Plan ID:** TASK-131 (to be added to MASTER_PLAN.md)
**Created:** January 8, 2026
**Deepened:** January 8, 2026
**Priority:** P1-HIGH (blocking user experience)
**Estimated Complexity:** High (multi-phase refactor)

---

## Enhancement Summary

**Deepened on:** January 8, 2026
**Sections enhanced:** All 6 phases + new architectural recommendations
**Research agents used:** 13 parallel agents

### Key Improvements from Research
1. **Revised phase ordering** based on architecture review (5 -> 4 -> 1 -> 3 -> 2 -> 6)
2. **Simplified approach** - Remove phases 2, 5, 6 as overkill; focus on root cause
3. **Critical bug fix** - NodeUpdateBatcher high-priority bypass causes cascading syncs
4. **Performance fix** - Remove deep:true watchers causing N+1 sync triggers
5. **Race condition mitigation** - Event-driven locks instead of time-based
6. **Security hardening** - Conditional debug exposure, lock count limits

### Critical Finding: Over-Engineering Alert
The simplicity reviewer identified that **the existing codebase already has competing systems**:
- Two lock utilities (`canvasPositionLock.ts` + `canvasStateLock.ts`)
- Two batching systems (`NodeUpdateBatcher` + sync queue)
- Multiple boolean flags (`isNodeDragging`, `isDragSettling`, `isResizeSettling`, etc.)

**Recommendation:** Consolidate before adding more layers.

---

## Overview

Comprehensive stabilization of the canvas view to eliminate all types of state resets:
- Task position resets (tasks jumping to wrong positions)
- Group position/size resets (groups losing their layout)
- Viewport resets (canvas jumping to default position/zoom)

This addresses BUG-020 and implements architectural improvements to prevent future regressions.

---

## Problem Statement / Motivation

Users experience frustrating position resets when:
1. Deleting any task causes OTHER tasks to jump positions (BUG-020)
2. Groups lose their layout after certain operations
3. Viewport jumps to (0,0) unexpectedly when switching views or after operations

**Root Causes Identified:**

| Reset Trigger | Location | Mechanism |
|--------------|----------|-----------|
| Task deletion | `taskOperations.ts:184` | `triggerCanvasSync()` runs full sync while locks expired |
| Array replacement | `canvas.ts:242` | `setGroups()` bypasses lock system |
| Lock expiration | `canvasStateLock.ts:55` | 7-second lock may be too short for slow networks |
| Auto-center watcher | `CanvasView.vue:1875-1905` | Runs if `hasInitialFit` not set |
| Database reload | `canvas.ts:103` | `loadFromDatabase()` replaces entire arrays |
| System restart | `useCanvasSync.ts:500` | `performSystemRestart()` clears all state |

### Research Insights: Root Cause Clarified

**From Architecture Review:**
> The fundamental issue is **temporal coupling via time-based locks**. The lock duration is a guess about how long sync operations take. This is brittle architecture.

**From Performance Analysis:**
> The `deep: true` watcher on `taskStore.tasks` (canvas.ts line 484-486) triggers on ANY nested property change. Combined with CanvasView watchers, a single task status change causes **3 full syncs**.

**From Race Condition Analysis:**
> Lock expiry before persistence completes is a race by design. The lock should be tied to the persistence outcome, not a fixed timeout.

---

## Proposed Solution

### REVISED Implementation Order (Based on Research)

| Order | Phase | Rationale |
|-------|-------|-----------|
| 1 | **Consolidate Existing Systems** | Remove duplicate lock file, unify flags |
| 2 | **Phase 5: Position Validation** | Quick win, foundation for other phases |
| 3 | **Phase 4: Viewport to Store** | Safe state migration, isolated change |
| 4 | **Phase 1: Surgical Deletion** | Fixes BUG-020, builds on validation |
| 5 | **Phase 3: Safe Update API** | Depends on phases 4 & 1 |
| 6 | **Evaluate if Phase 2 & 6 needed** | May not be necessary after above fixes |

---

### Phase 0: Consolidation (NEW - CRITICAL)

**Rationale:** The codebase has competing systems that must be unified before adding more.

**Tasks:**
1. **Delete `canvasPositionLock.ts`** (131 lines) - superseded by `canvasStateLock.ts`
2. **Consolidate boolean flags** into state machine pattern
3. **Remove debug window exports in production**
4. **Fix NodeUpdateBatcher high-priority bypass**

**Files to Modify:**
- `src/utils/canvasPositionLock.ts` - DELETE
- `src/utils/canvasStateLock.ts` - Remove legacy re-exports
- `src/utils/canvas/NodeUpdateBatcher.ts` - Fix high-priority bypass
- `src/composables/canvas/useCanvasDragDrop.ts` - Update imports

**Implementation:**

```typescript
// NodeUpdateBatcher.ts - FIX the high-priority bypass
schedule(update: () => void, priority: 'high' | 'normal' | 'low' = 'normal') {
  // BEFORE: High priority executed immediately (bypassed batching)
  // if (priority === 'high') { update(); return; }

  // AFTER: High priority uses shorter delay but still batches
  const delay = priority === 'high' ? 8 : priority === 'normal' ? 16 : 32
  this.batchQueue.push({ update, priority })
  this.scheduleBatch(delay)
}
```

```typescript
// Consolidate boolean flags into state machine
type CanvasInteractionState =
  | 'idle'
  | 'dragging'
  | 'resizing'
  | 'settling'
  | 'syncing'

const interactionState = ref<CanvasInteractionState>('idle')
const canSync = computed(() => interactionState.value === 'idle')
```

### Research Insights: Consolidation

**From Pattern Recognition:**
> Two different implementations of `getAbsolutePosition` exist in `useCanvasDragDrop.ts` (line 112) and `useCanvasSelection.ts` (line 80). Extract to shared utility.

**From Code Simplicity:**
> "The brutal truth: The proposed plan layers new abstractions on top of existing abstractions without removing the old ones. This is a recipe for 'competing systems' complexity."

---

### Phase 1: Fix BUG-020 (Task Deletion Reset)

The critical fix - prevent task deletions from resetting other tasks.

**Root Cause:** When a task is deleted, `triggerCanvasSync()` is called, which increments `syncTrigger` and triggers a full `syncNodes()`. By this time, position locks have expired, causing all nodes to recalculate positions from (potentially stale) database state.

**Solution:** Implement "surgical deletion" that removes only the deleted task's node without triggering full sync.

**Files to Modify:**
- `src/stores/tasks/taskOperations.ts` - Remove `triggerCanvasSync()` from delete flow
- `src/composables/canvas/useCanvasSync.ts` - Add `removeTaskNode(taskId)` function
- `src/views/CanvasView.vue` - Watch for task deletions specifically

**Implementation:**

```typescript
// useCanvasSync.ts - Add surgical removal
function removeTaskNode(taskId: string) {
  // Guard: Use cancellation token pattern for safety
  if (cancelToken.canceled) return

  const nodeIndex = deps.nodes.value.findIndex(n => n.id === taskId)
  if (nodeIndex !== -1) {
    deps.nodes.value.splice(nodeIndex, 1)
    // Also remove any edges connected to this node
    deps.edges.value = deps.edges.value.filter(
      e => e.source !== taskId && e.target !== taskId
    )
  }
}
```

### Research Insights: Surgical Deletion

**From Canvas Debug Skill:**
> Add deletion-specific lock type: `export type CanvasLockType = 'task' | 'group' | 'viewport' | 'deletion'`

**From Race Condition Review:**
> "What if the deletion triggers a full store refresh from Supabase? The `filteredTasks` ref would get new objects, but the task object's `canvasPosition` would be stale from the database."

**From Performance Review:**
> Surgical deletion provides **-80% deletion overhead** compared to full rebuild.

---

### Phase 2: Extend Lock Duration & Add Persistence Verification

**STATUS: POTENTIALLY UNNECESSARY**

**From Simplicity Review:**
> "Don't add Phase 2 (Extended locks). Current 7-second timeouts work fine. Complex callback-based extension avoids ~50 LOC of unnecessary abstraction."

**From Architecture Review:**
> "Consider **Optimistic Locking** pattern instead. Store a `version` or `lastModifiedAt` timestamp on each entity and compare before applying sync updates. This is more scalable and avoids arbitrary timeouts."

**Conditional Implementation (only if needed after phases 0-1):**

```typescript
// Event-driven lock release instead of time-based
interface CanvasLock {
  // ... existing fields
  persistenceState: 'pending' | 'succeeded' | 'failed'
}

// Lock expires when BOTH conditions are met:
// 1. Time elapsed > LOCK_DURATION_MS
// 2. persistenceState !== 'pending'
function isLockExpired(lock: CanvasLock): boolean {
  const timeExpired = Date.now() - lock.lockedAt > LOCK_DURATION_MS
  const persistenceComplete = lock.persistenceState !== 'pending'
  return timeExpired && persistenceComplete
}
```

---

### Phase 3: Replace setGroups() with Safe Update API

**Current Issue:** `setGroups()` completely replaces the groups array, bypassing locks.

**Solution:** Deprecate `setGroups()` and replace with `patchGroups()` that respects locks.

**Files to Modify:**
- `src/stores/canvas.ts` - Add `patchGroups()`, deprecate `setGroups()`

**Implementation (with TypeScript improvements):**

```typescript
// canvas.ts - Improved with branded types and proper return type
import type { GroupId } from '@/types/branded'

// Constrain patchable keys to avoid accidental id changes
type PatchableGroupKeys = Exclude<keyof CanvasGroup, 'id'>
type GroupPatch = Partial<Pick<CanvasGroup, PatchableGroupKeys>>

interface PatchResult {
  readonly patched: readonly string[]
  readonly skipped: readonly string[]
  readonly errors: ReadonlyMap<string, Error>
}

function patchGroups(updates: Map<string, GroupPatch>): PatchResult {
  const result: PatchResult = {
    patched: [],
    skipped: [],
    errors: new Map()
  }

  for (const [groupId, changes] of updates) {
    // Skip locked groups
    if (isGroupLocked(groupId)) {
      console.warn(`Skipping update to locked group: ${groupId}`)
      result.skipped.push(groupId)
      continue
    }

    const group = _rawGroups.value.find(g => g.id === groupId)
    if (group) {
      Object.assign(group, changes, { updatedAt: new Date().toISOString() })
      result.patched.push(groupId)
    }
  }

  return result
}

// Deprecate setGroups with guard
function setGroups(newGroups: CanvasGroup[]) {
  console.warn('setGroups() is deprecated. Use patchGroups() to respect locks.')

  // Guard against empty overwrite
  if (newGroups.length === 0 && _rawGroups.value.length > 0) {
    console.error('Refusing to overwrite existing groups with empty array')
    return
  }

  _rawGroups.value = [...newGroups]
}
```

### Research Insights: Safe Update API

**From Pinia Patterns Analysis:**
> "Use `$patch` for grouped updates - creates single mutation event, reduces subscription callbacks."

**From TypeScript Review:**
> "Should IDs use branded types? YES - HIGHLY RECOMMENDED. The existing codebase uses plain `string` for all IDs. This is a type safety gap."

---

### Phase 4: Fix Viewport Persistence & hasInitialFit Lifecycle

**Current Issue:** `hasInitialFit` is a component-level ref that resets on unmount, causing viewport to auto-center when returning to canvas.

**Solution:** Move `hasInitialFit` to store and persist viewport with debounced localStorage writes.

**Files to Modify:**
- `src/stores/canvas/canvasUi.ts` - Add `hasInitialFit` to store
- `src/views/CanvasView.vue` - Use store instead of local ref

**Implementation:**

```typescript
// canvasUi.ts - Enhanced with session recovery
const hasInitialFit = ref(false)
const viewportInitializedAt = ref<number | null>(null)

function setHasInitialFit(value: boolean) {
  hasInitialFit.value = value
  viewportInitializedAt.value = value ? Date.now() : null
  localStorage.setItem('pomoflow-canvas-has-initial-fit', JSON.stringify({
    value,
    timestamp: Date.now()
  }))
}

function loadHasInitialFit() {
  const saved = localStorage.getItem('pomoflow-canvas-has-initial-fit')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      // Only restore if within 5 minutes (session still active)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      if (parsed.value && parsed.timestamp > fiveMinutesAgo) {
        hasInitialFit.value = true
        viewportInitializedAt.value = parsed.timestamp
      }
    } catch (e) {
      console.warn('Failed to parse hasInitialFit:', e)
    }
  }
}
```

### Research Insights: Viewport Persistence

**From Vue Flow Documentation:**
> Use `v-model:nodes` and `v-model:edges` for bidirectional sync. Use `toObject()` for serialization.

**From Canvas Debug Skill:**
> "Add viewport lock integration during active user interaction."

---

### Phase 5: Add Position Validation Guards

**STATUS: SIMPLIFIED**

**From Simplicity Review:**
> "Don't add Phase 5 (Position validation). Already validating with `Number.isNaN()` checks throughout. Avoids ~30 LOC of redundant validation."

**Revised Approach:** Create a single utility instead of scattered checks.

**Files to Modify:**
- `src/utils/canvas/positionUtils.ts` - NEW - Consolidate position utilities

**Implementation:**

```typescript
// utils/canvas/positionUtils.ts - Single source of truth
export interface Position {
  x: number
  y: number
}

// Type guard that narrows unknown to Position
export function isValidPosition(value: unknown): value is Position {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const pos = value as Record<string, unknown>
  return (
    typeof pos.x === 'number' &&
    typeof pos.y === 'number' &&
    Number.isFinite(pos.x) &&
    Number.isFinite(pos.y)
  )
}

// Sanitize with fallback
export function sanitizePosition(
  value: unknown,
  fallback: Position = { x: 0, y: 0 }
): Position {
  if (isValidPosition(value)) {
    return { x: value.x, y: value.y }
  }
  console.warn('[POSITION] Invalid position, using fallback:', value)
  return fallback
}

// Consolidate getAbsolutePosition (duplicate existed in two files)
export function getAbsolutePosition(
  node: { position: Position; parentNode?: string },
  allNodes: Array<{ id: string; position: Position; parentNode?: string }>
): Position {
  let x = node.position.x
  let y = node.position.y
  let currentNode = node

  while (currentNode.parentNode) {
    const parent = allNodes.find(n => n.id === currentNode.parentNode)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    currentNode = parent
  }

  return { x, y }
}
```

### Research Insights: Position Validation

**From Reactivity Analysis:**
> "28+ occurrences of `Number.isNaN()` scattered throughout `useCanvasDragDrop.ts`. This is Defensive Programming Gone Wild."

**From TypeScript Review:**
> "The current signature `isValidPosition(position: { x: number, y: number }): boolean` is a missed opportunity. A type guard provides compile-time safety downstream."

---

### Phase 6: Add Sync Debouncing & Batching

**STATUS: POTENTIALLY UNNECESSARY**

**From Simplicity Review:**
> "Don't add Phase 6 (Sync queue). `NodeUpdateBatcher` already handles batching. Another queue layer avoids ~60 LOC of competing systems."

**From Performance Analysis:**
> "The `NodeUpdateBatcher` has a critical bug - high-priority bypass. Fix this instead of adding another layer."

**Conditional Implementation (only if needed after fixing NodeUpdateBatcher):**

```typescript
// Enhanced NodeUpdateBatcher with VueUse integration
import { useDebounceFn, tryOnScopeDispose } from '@vueuse/core'

// Instead of raw setTimeout, use VueUse for automatic cleanup
const debouncedProcess = useDebounceFn(processBatch, 16, { maxWait: 100 })

// Auto-cleanup on scope dispose
tryOnScopeDispose(() => {
  (debouncedProcess as { cancel?: () => void }).cancel?.()
})
```

### Research Insights: Sync Debouncing

**From VueUse Patterns:**
> "Use `maxWait` option - prevents indefinite delays during continuous updates."

**From Performance Analysis:**
> "The biggest wins come from **consolidating watchers** and **fixing the high-priority bypass**. These changes alone could reduce CPU overhead by 60-70%."

---

## Technical Considerations

### Architecture Impacts
- Lock system becomes more central to state management
- Need to ensure all state mutations go through lock-aware APIs
- May need to refactor any code that directly mutates store state

### Research Insights: Architecture

**From Architecture Review:**
> "The system has two conflicting update mechanisms: Direct Vue Flow Mutations and Reactive Sync. This violates the Single Source of Truth principle."

**Recommendation:** All position changes should flow through the store, with the sync system being the ONLY code that writes to `nodes.value`.

### Performance Implications
- Increased lock duration means more memory for lock maps
- Debouncing reduces sync frequency (positive for performance)
- Position validation adds minor overhead to all position updates

### Research Insights: Performance

**From Performance Analysis:**

| Metric | Current | After Fix | Improvement |
|--------|---------|-----------|-------------|
| Watcher cascades | 3-4x per change | 1x | -75% |
| syncNodes() triggers | 35ms/100 tasks | ~15ms | -57% |
| Hash computation | 1.2ms/100 tasks | ~0.5ms | -58% |

**Critical Fix Required:**
```typescript
// REMOVE this watcher (canvas.ts line 484-486):
watch(() => taskStore.tasks, (newTasks) => {
  if (newTasks) syncTasksToCanvas(newTasks)
}, { deep: true, immediate: true })

// REPLACE with hash-based watcher:
watch(
  () => taskStore.tasks
    .filter(t => !t.isInInbox && t.canvasPosition)
    .map(t => `${t.id}:${t.canvasPosition?.x}:${t.canvasPosition?.y}:${t.status}`)
    .join('|'),
  () => syncTasksToCanvas(taskStore.tasks),
  { immediate: true }
)
```

### Security Considerations

**From Security Review:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| Lock system DoS (flooding) | HIGH | Add max lock count limit (100) |
| Debug exposure in production | MEDIUM | Conditional export with `import.meta.env.DEV` |
| localStorage tampering | MEDIUM | Add schema validation for loaded data |
| Weak ID generation | MEDIUM | Use `crypto.randomUUID()` instead of `Math.random()` |

**Implementation:**
```typescript
// Conditional debug exposure
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__canvasLocks = { ... }
}

// Max lock count
const MAX_LOCKS = 100
function lockTaskPosition(taskId: string, position: Position) {
  if (taskLocks.size >= MAX_LOCKS) {
    console.warn('Max lock count reached, clearing oldest locks')
    clearExpiredLocks()
    if (taskLocks.size >= MAX_LOCKS) {
      // Force clear oldest
      const oldest = [...taskLocks.entries()]
        .sort((a, b) => a[1].lockedAt - b[1].lockedAt)[0]
      taskLocks.delete(oldest[0])
    }
  }
  // ... rest of lock logic
}
```

---

## Acceptance Criteria

### Functional Requirements
- [ ] Deleting a task does NOT affect positions of other tasks
- [ ] Deleting a task does NOT reset viewport position
- [ ] Group positions persist across page refresh
- [ ] Task positions persist across page refresh
- [ ] Viewport position persists across view switches (Canvas -> Calendar -> Canvas)
- [ ] Dragging a task and immediately refreshing preserves the new position
- [ ] Multi-select drag preserves all selected task positions
- [ ] Guest Mode positions persist across sessions

### Non-Functional Requirements
- [ ] No position resets under 3G network conditions
- [ ] Position lock extends automatically if persistence is slow
- [ ] Invalid positions (NaN, undefined) are caught and sanitized
- [ ] Console warnings for deprecated `setGroups()` usage

### Quality Gates
- [ ] Playwright E2E tests for each reset scenario
- [ ] Unit tests for position validation utilities
- [ ] Manual testing on slow network simulation
- [ ] No TypeScript errors
- [ ] ESLint passes

---

## Success Metrics

1. **Zero reported position resets** after deployment
2. **BUG-020 closed** with verification
3. **Playwright tests pass** for all 8 user flows identified
4. **No regression** in existing canvas functionality
5. **60-70% reduction** in CPU overhead from sync operations

---

## Dependencies & Prerequisites

### Blocking Dependencies
- None (can start immediately)

### Non-Blocking Dependencies
- BUG-020 investigation (partial - some root cause analysis done)

### Files That Will Be Modified

| File | Changes |
|------|---------|
| `src/utils/canvasPositionLock.ts` | DELETE (superseded) |
| `src/stores/canvas.ts` | Add `patchGroups()`, deprecate `setGroups()`, fix deep watcher |
| `src/stores/canvas/canvasUi.ts` | Add `hasInitialFit` to store |
| `src/stores/tasks/taskOperations.ts` | Remove `triggerCanvasSync()` from delete |
| `src/composables/canvas/useCanvasSync.ts` | Add surgical removal |
| `src/composables/canvas/useCanvasDragDrop.ts` | Update imports |
| `src/utils/canvasStateLock.ts` | Remove legacy re-exports, add lock limits |
| `src/utils/canvas/positionUtils.ts` | NEW - Consolidated position utilities |
| `src/utils/canvas/NodeUpdateBatcher.ts` | Fix high-priority bypass |
| `src/views/CanvasView.vue` | Use store `hasInitialFit` |

---

## Risk Analysis & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking existing drag behavior | High | Medium | Extensive Playwright testing before merge |
| Lock duration too long (UX issue) | Low | Low | Event-driven locks instead of time-based |
| Deprecating setGroups breaks external callers | Medium | Low | Add console warnings, search for all call sites |
| Performance regression from validation | Low | Low | Benchmark before/after, optimize if needed |
| Competing systems confusion | High | High | **Phase 0 consolidation FIRST** |

---

## Testing Plan

### Unit Tests (Vitest)
```typescript
// tests/utils/positionUtils.test.ts
describe('positionUtils', () => {
  it('type guard narrows unknown to Position')
  it('rejects NaN positions')
  it('rejects undefined positions')
  it('accepts valid positions')
  it('sanitizes invalid to fallback')
  it('calculates absolute position with nested parents')
})

// tests/utils/canvasStateLock.test.ts
describe('canvasStateLock', () => {
  it('locks task position for configured duration')
  it('respects max lock count')
  it('clears oldest lock when limit reached')
  it('releases lock after persistence verified')
})
```

### E2E Tests (Playwright)
```typescript
// tests/e2e/canvas-stability.spec.ts
describe('Canvas Stability', () => {
  it('task deletion does not reset other task positions')
  it('task deletion does not reset viewport')
  it('viewport persists across view switches')
  it('positions persist after page refresh')
  it('multi-drag preserves all positions')
  it('slow network does not cause position reset')
  it('rapid operations do not flood lock system')
})
```

### Performance Tests
```typescript
// tests/performance/canvas-sync.bench.ts
describe('Canvas Sync Performance', () => {
  it('syncNodes() completes in < 16ms for 100 tasks')
  it('hash computation completes in < 0.5ms for 100 tasks')
  it('watcher cascade count is 1 for single task update')
})
```

---

## References & Research

### Internal References
- `src/stores/canvas.ts:103-142` - loadFromDatabase reset trigger
- `src/stores/canvas.ts:242-244` - setGroups reset trigger
- `src/stores/canvas.ts:484-486` - deep:true watcher (FIX THIS)
- `src/composables/canvas/useCanvasSync.ts:57-392` - syncNodes implementation
- `src/composables/canvas/useCanvasSync.ts:500-576` - performSystemRestart
- `src/utils/canvasStateLock.ts:55` - LOCK_DURATION_MS (7 seconds)
- `src/utils/canvasPositionLock.ts` - DUPLICATE SYSTEM (DELETE)
- `src/utils/canvas/NodeUpdateBatcher.ts:22-26` - high-priority bypass (FIX THIS)
- `src/views/CanvasView.vue:1875-1905` - Auto-center watcher
- `src/views/CanvasView.vue:1772` - redundant deep watcher
- `docs/MASTER_PLAN.md:BUG-020` - Task Positions Reset on Deletion

### External References
- [Vue Flow Save & Restore](https://vueflow.dev/examples/save.html)
- [Vue Flow Controlled Flow](https://vueflow.dev/guide/controlled-flow)
- [Pinia State Persistence](https://pinia.vuejs.org/core-concepts/state.html)
- [Pinia $patch for Atomic Updates](https://github.com/vuejs/pinia/blob/v3/packages/docs/core-concepts/state.md)
- [VueUse useDebounceFn](https://vueuse.org/shared/usedebouncefn/)

### Related Work
- BUG-002: Multi-drag position corruption (FIXED)
- BUG-003: Task jumps after edit (FIXED)
- BUG-004: Multi-drag positions reset after click (FIXED)
- TASK-089: Position lock system (DONE)
- TASK-072: Section position resets (DONE)

---

## AI-Era Notes

This plan was generated and deepened using multi-agent research with:
- **repo-research-analyst**: Deep codebase analysis of canvas implementation
- **best-practices-researcher**: State persistence patterns for Vue/Pinia/VueFlow
- **framework-docs-researcher**: Official documentation for Vue 3.4+, Pinia, Vue Flow
- **spec-flow-analyzer**: User flow analysis and edge case identification
- **architecture-strategist**: Architectural review and phase ordering
- **code-simplicity-reviewer**: Over-engineering detection and YAGNI analysis
- **performance-oracle**: N+1 bug detection and scalability analysis
- **pattern-recognition-specialist**: Pattern/anti-pattern identification
- **kieran-typescript-reviewer**: TypeScript quality improvements
- **julik-frontend-races-reviewer**: Race condition analysis
- **security-sentinel**: Security audit and hardening recommendations
- **Context7**: Vue Flow and Pinia documentation queries

**Key insight from research:** The plan was significantly simplified after discovering that the codebase already has competing systems. The recommended approach changed from "add more layers" to "consolidate and fix root causes."

All code examples should be reviewed by a human developer before implementation.
