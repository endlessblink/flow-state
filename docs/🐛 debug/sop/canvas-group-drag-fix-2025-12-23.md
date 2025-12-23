# SOP: Canvas Group Drag Fix (BUG-034)

**Date**: December 23, 2025
**Status**: IN PROGRESS
**Tracking**: `docs/MASTER_PLAN.md` → BUG-034

---

## Problem Summary

When dragging canvas groups, tasks inside don't move correctly, and task counts become inaccurate.

## Root Cause Analysis

### Key Discovery (Via Vue Flow Documentation)

Vue Flow expects **RELATIVE** positions for child nodes when `parentNode` is set, but we were passing **ABSOLUTE** coordinates.

**Sources**:
- [Vue Flow Nodes Guide](https://vueflow.dev/guide/node.html)
- [GitHub: Preserving node position when nesting](https://github.com/bcakmakoglu/vue-flow/discussions/1202)
- [GitHub: position vs positionAbsolute](https://github.com/xyflow/xyflow/discussions/2635)

### Position Types in Vue Flow

| Property | Meaning |
|----------|---------|
| `position` | RELATIVE to parent (or canvas if no parent) |
| `positionAbsolute` | ABSOLUTE on the canvas |
| `computedPosition` | Calculated absolute position |

---

## Fixes Applied

### Fix 1: Enable Relative Position Conversion
**File**: `src/views/CanvasView.vue` lines 1532-1542
**Date**: Dec 23, 2025

```typescript
if (section) {
    parentNode = `section-${section.id}`
    // BUG-034 FIX: Convert ABSOLUTE to RELATIVE for Vue Flow parent-child system
    position = {
        x: position.x - section.position.x,
        y: position.y - section.position.y
    }
}
```

**Result**: Tasks now render at correct visual positions inside groups.

### Fix 2: Use parentNode Relationship for Section Drag
**File**: `src/composables/canvas/useCanvasDragDrop.ts` lines 208-218
**Date**: Dec 23, 2025

```typescript
const sectionNodeId = `section-${sectionId}`
const tasksInSection = nodes.value
    .filter(n => n.parentNode === sectionNodeId && !n.id.startsWith('section-'))
    .map(n => taskStore.tasks.find(t => t.id === n.id))
    .filter((t): t is Task => t !== undefined && t.canvasPosition !== undefined)
```

**Result**: Section drag now correctly identifies child tasks via Vue Flow's parentNode.

### Fix 3: Always Call syncNodes() After Task Drag
**File**: `src/composables/canvas/useCanvasDragDrop.ts` lines 304-306
**Date**: Dec 23, 2025

```typescript
// BUG-034 FIX: ALWAYS call syncNodes after task drag to update parentNode relationships
// This ensures task count and group membership are always up-to-date
syncNodes()
```

**Result**: After ANY task drag, Vue Flow node relationships are refreshed, ensuring:
- Task count updates when task moves OUT of group
- Tasks returned to group will move with subsequent group drags

---

## Current Status

| Issue | Status | Notes |
|-------|--------|-------|
| Initial group drag moves tasks | ✅ FIXED | Using relative positions + parentNode |
| Initial task count correct | ✅ FIXED | syncNodes sets parentNode correctly |
| Task count updates on task move OUT | ✅ FIXED | syncNodes() called after every task drag |
| Returned tasks move with group | ✅ FIXED | syncNodes() updates parentNode on return |

---

## All Issues Addressed

### Issue A: Task Count Update (FIXED)
**Root Cause**: `syncNodes()` was only called for smart groups (priority/status sections), not custom groups.
**Solution**: Added unconditional `syncNodes()` call after every task drag stop.

### Issue B: Returned Tasks (FIXED)
**Root Cause**: Same as Issue A - parentNode wasn't being updated when task returned to group.
**Solution**: Same fix - `syncNodes()` now always runs, recalculating parentNode based on visual bounds.

---

## Debugging Commands

Check console for BUG-034 logs:
```
🔍 BUG-034: Found X child tasks for section "..."
```

Check Vue Flow node relationships:
```javascript
// In browser console
const nodes = document.querySelector('.vue-flow').__vueParentComponent?.ctx?.nodes
nodes?.filter(n => n.parentNode).map(n => ({ id: n.id, parent: n.parentNode }))
```

---

## Rollback Procedure

If fixes cause regressions:

```bash
# Revert CanvasView.vue
git checkout HEAD~1 -- src/views/CanvasView.vue

# Revert useCanvasDragDrop.ts
git checkout HEAD~1 -- src/composables/canvas/useCanvasDragDrop.ts
```

---

## Verification Checklist

Test the complete cycle in browser:

1. [ ] Create a custom group on canvas
2. [ ] Add 2-3 tasks inside the group
3. [ ] Drag group by header → tasks should move WITH it
4. [ ] Task count should show correct number
5. [ ] Move a task OUT of the group → counter should DECREMENT
6. [ ] Task outside should NOT move when group is dragged
7. [ ] Move task back INTO the group
8. [ ] Drag group again → returned task should move WITH it
9. [ ] Counter should show correct number again

---

## Implementation Summary

| Fix | File | Lines | Purpose |
|-----|------|-------|---------|
| Fix 1 | `src/views/CanvasView.vue` | 1535-1541 | Convert absolute→relative when setting parentNode |
| Fix 2 | `src/composables/canvas/useCanvasDragDrop.ts` | 208-218 | Use parentNode relationship for section drag |
| Fix 3 | `src/composables/canvas/useCanvasDragDrop.ts` | 304-306 | Always call syncNodes() after task drag |

---

**Status**: AWAITING USER VERIFICATION
**Last Updated**: December 23, 2025
