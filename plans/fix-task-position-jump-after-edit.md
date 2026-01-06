# fix: Task jumps to another location after editing on Canvas

**Type:** Bug Fix
**Priority:** High
**Created:** January 6, 2026
**Status:** Planning

---

## Overview

After editing a task on the Canvas view and saving/approving changes, the task unexpectedly jumps to a different location instead of staying where it was. This breaks user expectations and disrupts workflow on the canvas.

---

## Problem Statement / Motivation

**Current Behavior:**
- User edits a task on the Canvas (via double-click or context menu)
- User makes changes and saves/approves the edit
- Task jumps to a different position on the canvas

**Expected Behavior:**
- Task should remain in its exact position after editing
- Only explicit position changes (drag-drop, section move) should relocate tasks

**Impact:**
- Disrupts visual organization users carefully arranged
- Forces manual repositioning after every edit
- Creates distrust in the canvas as a reliable workspace

---

## Proposed Solution

### Root Cause Analysis

Based on code research, the likely root causes (ranked by probability):

| Probability | Cause | Location |
|-------------|-------|----------|
| **80%** | Watcher triggers sync without lock check | `CanvasView.vue:1836` |
| **70%** | Containment recalculation ignores position lock | `useCanvasSync.ts:195` |
| **40%** | Section bounds mismatch in containment logic | `useCanvasSync.ts:206` |
| **40%** | Floating point precision in bounds checking | `useCanvasSync.ts:210` |
| **20%** | `canvasPosition` not preserved in modal save | `TaskEditModal.vue:654` |

### Solution Approach

1. **Add lock check to property hash watcher** (`CanvasView.vue`)
   - The filteredTasks hash watcher (line 1759) triggers high-priority sync after edits
   - Add guard: `if (isTaskPositionLocked(taskId)) return` before sync

2. **Guard containment recalculation with lock status** (`useCanvasSync.ts`)
   - Before recalculating if task is inside/outside a section
   - Check if task position is locked and skip containment logic if so

3. **Add epsilon tolerance for floating point comparisons** (`useCanvasSync.ts`)
   - Bounds checking uses exact comparisons that can fail due to float precision
   - Add `±0.5px` tolerance to containment boundary checks

---

## Technical Considerations

### Architecture Impact

**Files to Modify:**
| File | Purpose | Changes |
|------|---------|---------|
| `src/views/CanvasView.vue` | Main canvas watchers | Add lock checks to watchers |
| `src/composables/canvas/useCanvasSync.ts` | Node sync logic | Guard containment with lock status |
| `src/utils/canvasStateLock.ts` | Position locking | May need to expose more utilities |

### Position Locking System

The codebase has a position locking mechanism (`canvasStateLock.ts`) that prevents sync from overwriting positions for 7 seconds. Key functions:
- `lockTaskPosition(taskId, position, source)` - Lock position after drag/edit
- `isTaskPositionLocked(taskId)` - Check if locked
- `getLockedTaskPosition(taskId)` - Get locked position value

**Current Gap:** Not all sync paths check lock status before processing.

### Watcher Chain After Edit

When a task is saved from `TaskEditModal.vue`:
1. `updateTaskWithUndo()` updates the task store
2. Multiple watchers fire in CanvasView.vue:
   - `filteredTasks hash` (line 1759) - HIGH priority sync
   - `canvasPosition` (line 1790) - LOW priority sync
   - `isInInbox` (line 1803) - HIGH priority sync
3. If any watcher triggers sync before position lock is respected, task jumps

### Vue Flow Considerations

Per Vue Flow best practices:
- Use `updateNodeData()` for data-only updates (preserves position)
- Position is stored in `position` property (relative to parent)
- `computedPosition` is absolute canvas position (internal use only)
- Parent-child relationships affect position interpretation

---

## Acceptance Criteria

- [ ] Task remains in exact position after editing title
- [ ] Task remains in exact position after editing description
- [ ] Task remains in exact position after changing priority
- [ ] Task remains in exact position after changing status
- [ ] Task inside a section stays in section after edit
- [ ] Task outside sections stays outside after edit
- [ ] Rapid edit-save cycles don't cause position drift
- [ ] Position lock is respected in ALL sync code paths
- [ ] No regression in drag-drop functionality
- [ ] No regression in section containment logic

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Position deviation after edit | 0px (exact same position) |
| User-reported position jump bugs | 0 after fix |
| Regression tests passing | 100% |

---

## Dependencies & Risks

### Dependencies
- Understanding of current position locking mechanism
- Access to debug the watcher execution order
- Ability to reproduce the bug consistently

### Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Fix causes regression in drag-drop | Medium | Test drag operations after fix |
| Fix causes regression in section containment | Medium | Test task-in-section logic |
| Multiple root causes require multiple fixes | Low | Investigate systematically |
| Fix doesn't work for edge cases | Low | Test all edge cases listed |

### Edge Cases to Test
1. Task positioned at exact section boundary
2. Task edited while sync is in progress
3. Multiple rapid edits in succession
4. Task in nested group structure
5. Task edited after position lock expires (7+ seconds)

---

## Implementation Steps

### Phase 1: Reproduce & Instrument (Investigation)
- [ ] Reproduce the bug consistently with steps
- [ ] Add console logging to watcher execution
- [ ] Log lock status when watchers fire
- [ ] Identify which specific code path causes the jump

### Phase 2: Implement Fix
- [ ] Add lock check to property hash watcher (`CanvasView.vue:1836`)
- [ ] Add lock check before containment recalculation (`useCanvasSync.ts:195`)
- [ ] Consider adding epsilon tolerance if float precision is an issue

### Phase 3: Verify & Test
- [ ] Verify fix resolves the original bug
- [ ] Test all acceptance criteria
- [ ] Run regression tests for drag-drop
- [ ] Run regression tests for section containment
- [ ] Test edge cases

---

## References & Research

### Internal References
- `src/views/CanvasView.vue:1759,1790,1803` - Canvas watchers
- `src/composables/canvas/useCanvasSync.ts:152-257` - Sync node logic
- `src/components/tasks/TaskEditModal.vue:608-778` - Task edit save flow
- `src/utils/canvasStateLock.ts:60-76` - Position locking system

### External References
- [Vue Flow: Update Node](https://vueflow.dev/examples/nodes/update-node.html) - Proper update patterns
- [Vue Flow: Controlled Flow](https://vueflow.dev/guide/controlled-flow.html) - Manual change handling
- [Vue Flow: Troubleshooting](https://vueflow.dev/guide/troubleshooting.html) - Common issues

### Related Work
- TASK-089: Position locking system implementation
- Recent canvas sync fixes in git history

---

## Files Changed (Expected)

```
src/views/CanvasView.vue              # Add lock checks to watchers
src/composables/canvas/useCanvasSync.ts  # Guard containment logic
```

---

**Estimated Effort:**
- Investigation: 2-3 hours
- Implementation: 1-2 hours
- Testing: 1-2 hours
- **Total: 4-7 hours**
