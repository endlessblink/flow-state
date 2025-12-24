# SOP: Canvas Group Drag Fix (BUG-034)

**Date**: December 23, 2025
**Status**: ✅ COMPLETE (User Verified)
**Tracking**: `docs/MASTER_PLAN.md` → BUG-034

---

## Quick Reference

**If canvas groups/tasks have drag issues, check these 3 things:**

| Check | File | Lines | What to Verify |
|-------|------|-------|----------------|
| 1. Relative position conversion | `src/views/CanvasView.vue` | 1535-1541 | Position converted when `parentNode` is set |
| 2. parentNode-based finding | `src/composables/canvas/useCanvasDragDrop.ts` | 208-218 | Uses `n.parentNode === sectionNodeId` |
| 3. syncNodes() after drag | `src/composables/canvas/useCanvasDragDrop.ts` | 304-306 | `syncNodes()` called unconditionally |

---

## Problem Summary

When dragging canvas groups:
- Tasks inside groups don't move with the group
- Task counts become inaccurate after moving tasks
- Tasks moved back into groups stop moving with subsequent group drags

---

## Root Cause (CRITICAL KNOWLEDGE)

### Vue Flow Position System

**Vue Flow has TWO types of positions:**

| Property | Type | Description |
|----------|------|-------------|
| `position` | RELATIVE | Position relative to `parentNode` (or canvas origin if no parent) |
| `positionAbsolute` | ABSOLUTE | Computed absolute position on the canvas |

### The Bug

When `parentNode` is set, Vue Flow expects `position` to be **RELATIVE to the parent**, not absolute.

**Example of the bug:**
```
Section at (100, 100) with size 300x200
Task stored at ABSOLUTE (150, 150) in database
We set: parentNode = 'section-1', position = { x: 150, y: 150 }

Vue Flow interprets 150,150 as RELATIVE to parent:
  → Renders task at (100+150, 100+150) = (250, 250)
  → Task appears 100px offset from where it should be!

When checking "is task inside section?":
  → We compare stored (150,150) against section bounds → says "inside"
  → But visually, task at (250,250) is OUTSIDE the section!
```

### Key Sources
- [Vue Flow Nodes Guide](https://vueflow.dev/guide/node.html)
- [GitHub: Preserving node position when nesting](https://github.com/bcakmakoglu/vue-flow/discussions/1202)
- [GitHub: position vs positionAbsolute](https://github.com/xyflow/xyflow/discussions/2635)

---

## The Three Fixes

### Fix 1: Enable Relative Position Conversion in syncNodes()

**File**: `src/views/CanvasView.vue` lines 1532-1542
**Purpose**: Convert ABSOLUTE coordinates to RELATIVE when setting parentNode

**Before (BROKEN):**
```typescript
if (section) {
    parentNode = `section-${section.id}`
    // Position stays ABSOLUTE - WRONG!
    // Vue Flow will add section position again, causing offset
}
```

**After (FIXED):**
```typescript
if (section) {
    parentNode = `section-${section.id}`
    // BUG-034 FIX: Convert ABSOLUTE to RELATIVE for Vue Flow parent-child system
    // Vue Flow expects position to be RELATIVE when parentNode is set
    position = {
        x: position.x - section.position.x,
        y: position.y - section.position.y
    }
}
```

**Why it works**: When Vue Flow renders a child node, it adds the parent's position to the child's position. If we store absolute (150,150) but section is at (100,100), Vue Flow would render at (250,250). By converting to relative (50,50), Vue Flow renders at (100+50, 100+50) = (150,150) - the correct visual position.

---

### Fix 2: Use parentNode Relationship for Section Drag

**File**: `src/composables/canvas/useCanvasDragDrop.ts` lines 208-218
**Purpose**: Find child tasks reliably using Vue Flow's parentNode, not bounds re-checking

**Before (BROKEN):**
```typescript
// Re-checking bounds during drag was error-prone
// Because positions were mismatched (absolute vs relative)
const tasksInSection = tasks.filter(task =>
    isTaskInSectionBounds(task.canvasPosition, section)
)
```

**After (FIXED):**
```typescript
// BUG-034 FIX: Find tasks that are VISUALLY inside the section
// Use Vue Flow's parentNode relationship (set by syncNodes based on visual containment)
const sectionNodeId = `section-${sectionId}`
const tasksInSection = nodes.value
    .filter(n => n.parentNode === sectionNodeId && !n.id.startsWith('section-'))
    .map(n => taskStore.tasks.find(t => t.id === n.id))
    .filter((t): t is Task => t !== undefined && t.canvasPosition !== undefined)
```

**Why it works**: `syncNodes()` already calculates which tasks are inside which sections and sets `parentNode` accordingly. Using this existing relationship is more reliable than re-checking bounds (which can have floating-point errors, timing issues, etc.).

---

### Fix 3: Always Call syncNodes() After Task Drag

**File**: `src/composables/canvas/useCanvasDragDrop.ts` lines 304-306
**Purpose**: Refresh parent-child relationships after EVERY task movement

**Before (BROKEN):**
```typescript
// syncNodes() was only called for smart groups (priority/status)
// Custom groups were not refreshed
if (containingSection?.type !== 'custom') {
    syncNodes()
}
```

**After (FIXED):**
```typescript
// BUG-034 FIX: ALWAYS call syncNodes after task drag to update parentNode relationships
// This ensures task count and group membership are always up-to-date
syncNodes()
```

**Why it works**: When a task is dragged out of or into a group, its `parentNode` needs to be updated. Without calling `syncNodes()`, the relationship becomes stale, causing:
- Task counts to stay incorrect
- Tasks to not move with their "visual" group on subsequent drags

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TASK DRAG LIFECYCLE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User drags task                                                 │
│         │                                                           │
│         ▼                                                           │
│  2. handleNodeDragStop() fires                                      │
│         │                                                           │
│         ├─► If task has parentNode:                                 │
│         │       Convert relative→absolute and save to taskStore     │
│         │                                                           │
│         ├─► If task has no parentNode:                              │
│         │       Save position directly to taskStore                 │
│         │                                                           │
│         ▼                                                           │
│  3. syncNodes() called (ALWAYS - Fix 3)                             │
│         │                                                           │
│         ├─► For each task with canvasPosition:                      │
│         │       Check if task center is inside any section          │
│         │       If yes: set parentNode, convert to RELATIVE (Fix 1) │
│         │       If no:  clear parentNode, use ABSOLUTE              │
│         │                                                           │
│         ▼                                                           │
│  4. Vue Flow re-renders with correct positions                      │
│         │                                                           │
│         ▼                                                           │
│  5. Task count updates (based on parentNode relationships)          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       SECTION DRAG LIFECYCLE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User drags section header                                       │
│         │                                                           │
│         ▼                                                           │
│  2. handleNodeDragStop() fires for section node                     │
│         │                                                           │
│         ├─► Save OLD section position (before update)               │
│         │                                                           │
│         ├─► Calculate delta: (newX - oldX, newY - oldY)             │
│         │                                                           │
│         ├─► Find child tasks via parentNode (Fix 2)                 │
│         │       nodes.filter(n => n.parentNode === sectionNodeId)   │
│         │                                                           │
│         ├─► Update section position in canvasStore                  │
│         │                                                           │
│         ├─► For each child task:                                    │
│         │       task.canvasPosition.x += deltaX                     │
│         │       task.canvasPosition.y += deltaY                     │
│         │                                                           │
│         ▼                                                           │
│  3. All child tasks moved with section (correct behavior!)          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Coordinate Systems Reference

### Storage (taskStore)
- Tasks store **ABSOLUTE** canvas coordinates
- `task.canvasPosition = { x: 150, y: 150 }` means 150px from canvas origin

### Vue Flow Nodes
- If `parentNode` is set: `position` must be **RELATIVE** to parent
- If no `parentNode`: `position` is **ABSOLUTE** (same as storage)

### Conversion Formulas

**Absolute → Relative (for Vue Flow when parentNode is set):**
```typescript
relativePosition = {
    x: absolutePosition.x - parentSection.position.x,
    y: absolutePosition.y - parentSection.position.y
}
```

**Relative → Absolute (for storage when saving):**
```typescript
absolutePosition = {
    x: relativePosition.x + parentSection.position.x,
    y: relativePosition.y + parentSection.position.y
}
```

---

## Debugging Guide

### Console Logs to Watch

```
🔍 BUG-034 DEBUG: Section drag detected
🔍 BUG-034: Found X child tasks for section "..."
[handleNodeDragStop] Found section: { name: "...", type: "..." }
[applySectionPropertiesToTask] Called with: ...
```

### Browser Console Commands

**Check node-parent relationships:**
```javascript
// Get all Vue Flow nodes
const vueFlow = document.querySelector('.vue-flow')
const nodes = vueFlow.__vueParentComponent?.ctx?.nodes

// Show all parent-child relationships
nodes?.filter(n => n.parentNode).map(n => ({
    id: n.id.substring(0, 8),
    parent: n.parentNode,
    position: n.position
}))
```

**Check if positions are relative or absolute:**
```javascript
// If task is inside section, position should be RELATIVE (small numbers)
// If task is outside section, position should be ABSOLUTE (larger numbers)
nodes?.filter(n => !n.id.startsWith('section-')).map(n => ({
    id: n.id.substring(0, 8),
    hasParent: !!n.parentNode,
    position: n.position,
    // If hasParent=true, position should be relative (typically 0-300 range)
    // If hasParent=false, position should be absolute (typically 100-1000+ range)
}))
```

---

## Symptoms → Fixes Quick Reference

| Symptom | Likely Cause | Fix to Check |
|---------|--------------|--------------|
| Tasks render offset from where they should be | Absolute/relative mismatch | Fix 1 |
| Group drag doesn't move tasks inside | Using bounds instead of parentNode | Fix 2 |
| Task count doesn't update after drag | syncNodes() not called | Fix 3 |
| Tasks moved back into group don't move with it | syncNodes() not called | Fix 3 |
| Tasks outside group move with it | Wrong tasks found during drag | Fix 2 |

---

## Verification Checklist

Test the complete cycle:

- [x] Create a custom group on canvas
- [x] Add 2-3 tasks inside the group
- [x] Drag group by header → tasks move WITH it
- [x] Task count shows correct number
- [x] Move a task OUT of the group → counter decrements
- [x] Task outside does NOT move when group is dragged
- [x] Move task back INTO the group
- [x] Drag group again → returned task moves WITH it
- [x] Counter shows correct number again

**User Verified**: December 23, 2025

---

## Rollback Procedure

If these fixes cause regressions:

```bash
# View what was changed
git diff HEAD~1 -- src/views/CanvasView.vue
git diff HEAD~1 -- src/composables/canvas/useCanvasDragDrop.ts

# Revert specific files
git checkout HEAD~1 -- src/views/CanvasView.vue
git checkout HEAD~1 -- src/composables/canvas/useCanvasDragDrop.ts

# Or revert the entire commit
git revert HEAD
```

---

## Files Modified Summary

| File | Lines | Change | Purpose |
|------|-------|--------|---------|
| `src/views/CanvasView.vue` | 1535-1541 | Position conversion | Convert absolute→relative when parentNode is set |
| `src/composables/canvas/useCanvasDragDrop.ts` | 208-218 | parentNode lookup | Use Vue Flow's parentNode to find child tasks |
| `src/composables/canvas/useCanvasDragDrop.ts` | 304-306 | Always syncNodes | Refresh relationships after every task drag |

---

## Related Issues

- **ISSUE-008**: Group undo/redo fix (same session, Dec 23 2025)
- **BUG-033**: Group null reference error (fixed, same session)

---

## Key Learnings

1. **Always read the framework documentation** - The Vue Flow position system was documented but not understood
2. **Use framework relationships** - `parentNode` is maintained by Vue Flow, use it instead of re-calculating
3. **Refresh state after mutations** - Call `syncNodes()` after any operation that could change relationships
4. **Understand coordinate systems** - Know when to use relative vs absolute coordinates

---

**Last Updated**: December 23, 2025
**Author**: Claude Code (via debugging session with user)
