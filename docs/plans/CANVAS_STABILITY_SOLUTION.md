# Canvas System Stability Solution

> **Status:** Proposed
> **Created:** January 11, 2026
> **Goal:** 100% stable and reliable canvas position sync, group counting, and parent-child management

---

## Executive Summary

Based on deep analysis of the current architecture and research into production-grade canvas apps (Figma, Excalidraw, tldraw), this document proposes a **simplified, bulletproof architecture** that eliminates the root causes of position resets and sync conflicts.

### The Core Problem

The current system has **too many moving parts**:
- 30+ composables with overlapping responsibilities
- 5+ lock flags checked in different places
- Complex coordinate conversions (absolute ↔ relative)
- Multiple sync triggers watching the same data
- Optimistic sync, drifting shield, auth guards - all band-aids

### The Solution

**Simplify radically.** Production apps like Figma and tldraw succeed because they:
1. Have ONE source of truth for position
2. Use simple version numbers for conflict resolution
3. Separate "local editing state" from "synced state" cleanly
4. Never fight with the rendering library's internal state

---

## Architecture Changes

### 1. Single Position Authority (Critical)

**Current Problem:** Position exists in 3 places that can drift:
- `task.canvasPosition` (store)
- `node.position` (Vue Flow)
- `position` column (Supabase)

**Solution:** Vue Flow is the ONLY position authority during editing.

```typescript
// NEW PATTERN: Position flows ONE direction
//
// EDIT MODE:  VueFlow.position → Store → Supabase
// LOAD MODE:  Supabase → Store → VueFlow.position
//
// NEVER: Supabase → Store → VueFlow while user is active on canvas

interface PositionAuthority {
  source: 'vueflow' | 'database'
  lockedUntil: number  // Timestamp
}

// When user interacts with canvas, lock position authority to VueFlow
const lockToVueFlow = (durationMs: number = 5000) => {
  positionAuthority.source = 'vueflow'
  positionAuthority.lockedUntil = Date.now() + durationMs
}

// Only accept database positions when not locked
const canAcceptDatabasePosition = (): boolean => {
  return positionAuthority.source === 'database' ||
         Date.now() > positionAuthority.lockedUntil
}
```

### 2. Version-Based Conflict Resolution

**Current Problem:** Timestamps and multiple lock flags are complex and error-prone.

**Solution:** Simple version numbers (like Excalidraw).

```typescript
// Add to Task type
interface Task {
  // ... existing fields
  positionVersion: number  // Increment on every position change
}

// Add to CanvasGroup type
interface CanvasGroup {
  // ... existing fields
  positionVersion: number
}

// Conflict resolution is now trivial
const shouldAcceptRemotePosition = (
  localVersion: number,
  remoteVersion: number
): boolean => {
  return remoteVersion > localVersion
}

// On drag end
const savePosition = async (taskId: string, position: Position) => {
  const task = taskStore.getTask(taskId)
  const newVersion = task.positionVersion + 1

  // Update locally first (optimistic)
  task.canvasPosition = position
  task.positionVersion = newVersion

  // Then persist
  await supabase.from('tasks').update({
    position: { x: position.x, y: position.y, parentId: task.parentId },
    position_version: newVersion  // New column
  }).eq('id', taskId)
}
```

### 3. Eliminate Coordinate Conversion

**Current Problem:** Converting between absolute and relative coordinates is error-prone and causes position drift.

**Solution:** Store and use ONLY relative coordinates. Let Vue Flow handle the math.

```typescript
// BEFORE (complex, error-prone)
const absolutePos = getAbsoluteNodePosition(node)
const relativePos = convertToRelative(absolutePos, parent)
// 50 lines of GROUP_BORDER_WIDTH adjustments...

// AFTER (simple, Vue Flow does the work)
const position = node.position  // Already relative to parent
task.canvasPosition = position  // Store as-is
// Done. Vue Flow handles all coordinate math internally.
```

**Database Change:**
```sql
-- positions are now RELATIVE (to parent if in group, to canvas origin if not)
-- parentId determines the reference frame
ALTER TABLE tasks ADD COLUMN position_version integer DEFAULT 1;
ALTER TABLE groups ADD COLUMN position_version integer DEFAULT 1;
```

### 4. Simplify Composable Structure

**Current Problem:** 30+ composables with overlapping sync logic.

**Solution:** Consolidate to 5 core composables.

```
BEFORE (30+ files):
├── useCanvasSync.ts
├── useCanvasNodeSync.ts
├── useCanvasEdgeSync.ts
├── useCanvasDragDrop.ts
├── useCanvasGroupDrag.ts
├── useCanvasTaskDrag.ts
├── useCanvasParentChild.ts
├── useCanvasOptimisticSync.ts
├── useCanvasTaskCounts.ts
├── useNodeAttachment.ts
├── ... 20 more files

AFTER (5 files):
├── useCanvasCore.ts        # Nodes, edges, basic operations
├── useCanvasDrag.ts        # All drag operations (unified)
├── useCanvasGroups.ts      # Group operations + task counts
├── useCanvasPersistence.ts # All Supabase sync (single file)
├── useCanvasSelection.ts   # Selection + context menus
```

### 5. Remove the Drifting Shield

**Current Problem:** 5+ lock flags checked inconsistently across files.

**Solution:** Replace with simple "editing session" concept.

```typescript
// BEFORE (scattered locks)
if (isNodeDragging.value ||
    isDragSettlingRef.value ||
    canvasStore.isDragging ||
    window.__PomoFlowIsDragging ||
    window.__PomoFlowIsResizing ||
    window.__PomoFlowIsSettling) {
  return // ignore
}

// AFTER (single editing session)
const editingSession = ref<{
  active: boolean
  startedAt: number
  type: 'drag' | 'resize' | 'edit'
} | null>(null)

const startEditing = (type: 'drag' | 'resize' | 'edit') => {
  editingSession.value = { active: true, startedAt: Date.now(), type }
}

const endEditing = () => {
  // Grace period: ignore remote updates for 1s after editing ends
  setTimeout(() => {
    editingSession.value = null
  }, 1000)
}

const shouldIgnoreRemote = (): boolean => {
  return editingSession.value !== null
}
```

---

## Implementation Plan

### Phase 1: Database Migration (1 task)

Add version columns to enable conflict resolution:

```sql
-- Migration: add_position_versions
ALTER TABLE tasks ADD COLUMN position_version integer DEFAULT 1;
ALTER TABLE groups ADD COLUMN position_version integer DEFAULT 1;

-- Update existing records
UPDATE tasks SET position_version = 1 WHERE position_version IS NULL;
UPDATE groups SET position_version = 1 WHERE position_version IS NULL;
```

### Phase 2: Simplify Position Storage (2 tasks)

1. **Remove absolute/relative conversion logic**
   - Delete `getAbsoluteNodePosition`, `convertToRelative`, etc.
   - Store positions exactly as Vue Flow provides them
   - Update mappers to pass through positions unchanged

2. **Update type definitions**
   - Add `positionVersion` to Task and CanvasGroup interfaces
   - Update Supabase mappers

### Phase 3: Consolidate Composables (3 tasks)

1. **Create `useCanvasCore.ts`**
   - Merge: useCanvasOrchestrator, useCanvasNodeSync, useCanvasEdgeSync
   - Single file for all node/edge operations

2. **Create `useCanvasDrag.ts`**
   - Merge: useCanvasDragDrop, useCanvasGroupDrag, useCanvasTaskDrag
   - Unified drag handling with version incrementing

3. **Create `useCanvasPersistence.ts`**
   - Merge: useCanvasSync, useCanvasOptimisticSync
   - Single file for all Supabase operations
   - Simple version-based conflict resolution

### Phase 4: Implement Editing Session (1 task)

Replace all lock flags with single editing session:

```typescript
// useCanvasEditingSession.ts
export const useCanvasEditingSession = () => {
  const session = ref<EditingSession | null>(null)

  const start = (type: EditingType) => { ... }
  const end = () => { ... }
  const isActive = computed(() => session.value !== null)

  return { start, end, isActive, session }
}
```

### Phase 5: Clean Up (2 tasks)

1. **Delete deprecated files**
   - Remove old composables that were consolidated
   - Remove position conversion utilities
   - Remove multiple lock flag references

2. **Update tests**
   - Simplify test setup (fewer mocks needed)
   - Add version-based conflict resolution tests

---

## Task Count Simplification

### Current Problem

Task counting has complex recursive logic with spatial fallbacks.

### Solution

Use ONLY `parentId` for counting. No spatial calculations.

```typescript
// BEFORE (complex)
const getTaskCountInGroupRecursive = (groupId, tasks) => {
  // 30 lines of spatial calculations, child exclusions, etc.
}

// AFTER (simple)
const getTaskCount = (groupId: string): number => {
  const directTasks = tasks.filter(t =>
    t.parentId === groupId && !t._soft_deleted
  )

  const childGroups = groups.filter(g => g.parentGroupId === groupId)
  const childCounts = childGroups.reduce((sum, g) =>
    sum + getTaskCount(g.id), 0
  )

  return directTasks.length + childCounts
}
```

**Key Change:** When a task is dropped into a group, we MUST update `task.parentId`. No spatial fallback. This makes the system deterministic.

---

## Realtime Sync Simplification

### Current Flow (Complex)

```
Supabase Realtime → onTaskChange → Check 5 locks →
Map types → Check optimistic → Check auth race →
Maybe update store → Trigger watchers → Maybe sync nodes
```

### New Flow (Simple)

```
Supabase Realtime → onRemoteChange →
  if (editingSession.active) return
  if (remoteVersion <= localVersion) return
  updateStore(mapped)
  // Vue reactivity handles the rest
```

```typescript
// useCanvasPersistence.ts
const handleRemoteTaskChange = (payload: RealtimePayload) => {
  // Guard 1: Editing session active
  if (editingSession.isActive.value) {
    console.debug('[SYNC] Ignoring - editing session active')
    return
  }

  // Guard 2: Version check
  const localTask = taskStore.getTask(payload.new.id)
  if (localTask && payload.new.position_version <= localTask.positionVersion) {
    console.debug('[SYNC] Ignoring - local version is same or newer')
    return
  }

  // Accept the update
  const mapped = fromSupabaseTask(payload.new)
  taskStore.updateTask(mapped.id, mapped)
}
```

---

## Summary: What Changes

| Area | Before | After |
|------|--------|-------|
| Position authority | 3 sources (store, VueFlow, DB) | 1 source (VueFlow during edit, DB on load) |
| Conflict resolution | Timestamps + 5 lock flags | Version numbers only |
| Coordinates | Absolute ↔ Relative conversions | Relative only (Vue Flow native) |
| Composables | 30+ files | 5 files |
| Lock mechanism | Drifting Shield (scattered) | Editing Session (centralized) |
| Task counting | Spatial + parentId fallback | parentId only |
| Sync triggers | Multiple watchers | Single persistence composable |

---

## Risk Mitigation

### Breaking Changes

1. **Position format changes** - Existing positions may need migration
   - Mitigation: Write migration script to convert existing positions

2. **Composable API changes** - Components using old APIs will break
   - Mitigation: Implement in feature branch, update all call sites

### Rollback Plan

1. Keep old composables as `*.deprecated.ts` during transition
2. Feature flag for new vs old sync logic
3. Backup positions before migration

---

## Success Criteria

After implementation:

- [ ] Zero position resets during drag operations
- [ ] Zero position resets on page refresh
- [ ] Zero position resets during realtime sync
- [ ] Task counts always accurate
- [ ] Code reduced by ~50% (composables)
- [ ] No more than 2 guards in sync path (editing session + version)

---

## Appendix: File Consolidation Map

```
DELETE (merge into new files):
├── useCanvasSync.ts → useCanvasPersistence.ts
├── useCanvasNodeSync.ts → useCanvasCore.ts
├── useCanvasEdgeSync.ts → useCanvasCore.ts
├── useCanvasDragDrop.ts → useCanvasDrag.ts
├── useCanvasGroupDrag.ts → useCanvasDrag.ts
├── useCanvasTaskDrag.ts → useCanvasDrag.ts
├── useCanvasOptimisticSync.ts → useCanvasPersistence.ts
├── useCanvasTaskCounts.ts → useCanvasGroups.ts
├── useNodeAttachment.ts → useCanvasDrag.ts

KEEP (rename/refactor):
├── useCanvasParentChild.ts → useCanvasGroups.ts (merge)
├── useCanvasSelection.ts → useCanvasSelection.ts (keep)
├── useCanvasActions.ts → useCanvasCore.ts (merge)
├── useCanvasHotkeys.ts → useCanvasCore.ts (merge)
├── useCanvasResize.ts → useCanvasDrag.ts (merge)
```
