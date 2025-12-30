# SOP: Nested Groups Drag Fix (TASK-072)

**Date**: December 30, 2025
**Status**: User Verified
**Tracking**: `docs/MASTER_PLAN.md` - TASK-072

---

## Quick Reference

**If nested groups have drag/position/count issues, check these items:**

| Check | File | What to Verify |
|-------|------|----------------|
| 1. No syncNodes() after drag | `useCanvasDragDrop.ts` | syncNodes() should NOT be called after section drag |
| 2. Direct Vue Flow node updates | `useCanvasDragDrop.ts` | Update nodes.value directly for parent/child changes |
| 3. Z-index for nesting | `useCanvasDragDrop.ts` | childZIndex = parentZIndex + 1 |
| 4. CSS allows dynamic z-index | `CanvasView.vue` | No `z-index: !important` on section nodes |
| 5. Recursive task counting | `CanvasView.vue` | Use `getTaskCountInGroupRecursive` for ALL groups |

---

## Problem Summary

When dragging nested groups (groups inside groups):
- Groups reset position after drag stops
- Wrong group moves instead of the dragged one
- Child doesn't follow parent during drag
- Nested group renders behind parent (z-index issue)
- Parent group doesn't count tasks in child groups

---

## Root Cause (CRITICAL KNOWLEDGE)

### The Golden Rule

**Only sync PARENT positions to store. Vue Flow manages children automatically.**

When `parentNode` is set on a Vue Flow node:
- Position is RELATIVE to parent
- When parent is dragged, Vue Flow automatically moves children visually
- Child's `position` property stays the same (it's relative)

### What We Were Doing Wrong

```typescript
// WRONG - What we were doing
onNodeDragStop -> update parent position
              -> call syncNodes()  // THIS BREAKS EVERYTHING!
```

`syncNodes()` rebuilds ALL nodes from store:
1. Reads store positions (absolute)
2. Converts to Vue Flow positions
3. Overwrites ALL nodes

When parent moves but child store positions unchanged, syncNodes() recalculates wrong relative positions = nodes jump back!

### Position Systems

| Node Type | Store Position | Vue Flow Position | parentNode |
|-----------|---------------|-------------------|------------|
| Parent (Section) | ABSOLUTE | ABSOLUTE | undefined |
| Child (Nested Section) | ABSOLUTE | RELATIVE | parent ID |
| Task | ABSOLUTE | RELATIVE | section ID |

---

## The Fixes

### Fix 1: Remove syncNodes() After Section Drag

**File**: `src/composables/canvas/useCanvasDragDrop.ts`

**Before (BROKEN):**
```typescript
// After section drag handling
syncNodes() // WRONG - this rebuilds all nodes and breaks positions
```

**After (FIXED):**
```typescript
// TASK-072 FIX: Do NOT call syncNodes() after drag!
// Vue Flow already moved children visually during drag.
// Calling syncNodes() rebuilds all nodes and breaks position consistency.
// syncNodes() // REMOVED
```

---

### Fix 2: Direct Vue Flow Node Updates for Nesting Changes

**File**: `src/composables/canvas/useCanvasDragDrop.ts`

When a section is dropped inside another (becoming nested):

```typescript
if (containingParent) {
    // Update store
    canvasStore.updateSection(sectionId, { parentGroupId: containingParent.id })

    // TASK-072 FIX: Directly update Vue Flow node instead of syncNodes()
    const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
    if (nodeIndex !== -1) {
        const parentNodeId = `section-${containingParent.id}`
        const relativeX = absoluteX - containingParent.position.x
        const relativeY = absoluteY - containingParent.position.y

        // Calculate z-index for proper layering
        const parentNode = nodes.value.find(n => n.id === parentNodeId)
        const parentZIndex = parentNode?.style?.zIndex ?? 0
        const childZIndex = (typeof parentZIndex === 'number' ? parentZIndex : parseInt(String(parentZIndex)) || 0) + 1

        nodes.value[nodeIndex] = {
            ...nodes.value[nodeIndex],
            parentNode: parentNodeId,
            position: { x: relativeX, y: relativeY },
            style: { ...nodes.value[nodeIndex].style, zIndex: childZIndex }
        }
    }
}
```

When a section is dragged out of its parent (becoming un-nested):

```typescript
if (!stillInside) {
    canvasStore.updateSection(sectionId, { parentGroupId: null })

    // TASK-072 FIX: Directly update Vue Flow node
    const nodeIndex = nodes.value.findIndex(n => n.id === node.id)
    if (nodeIndex !== -1) {
        nodes.value[nodeIndex] = {
            ...nodes.value[nodeIndex],
            parentNode: undefined,
            position: { x: absoluteX, y: absoluteY },
            style: { ...nodes.value[nodeIndex].style, zIndex: 0 }
        }
    }
}
```

---

### Fix 3: CSS Must Allow Dynamic Z-Index

**File**: `src/views/CanvasView.vue` (CSS section)

**Before (BROKEN):**
```css
.vue-flow__node[id^="section-"],
.vue-flow__node-sectionNode {
  z-index: 1 !important;  /* This overrides ALL dynamic z-index! */
}
```

**After (FIXED):**
```css
/* TASK-072 FIX: Don't force z-index - let Vue Flow node.style.zIndex control it */
.vue-flow__node[id^="section-"],
.vue-flow__node-sectionNode {
  /* z-index controlled by node.style.zIndex for proper nested group layering */
  pointer-events: auto !important;
}
```

---

### Fix 4: Recursive Task Counting for All Groups

**File**: `src/views/CanvasView.vue` (syncNodes function)

**Before (BROKEN):**
```typescript
// Only child groups used recursive counting
const taskCount = section.parentGroupId
  ? canvasStore.getTaskCountInGroupRecursive(section.id, tasks)
  : canvasStore.getTasksInSectionBounds(section, tasks).length
```

**After (FIXED):**
```typescript
// TASK-072 FIX: Always use recursive counting so parent groups include child group tasks
const taskCount = canvasStore.getTaskCountInGroupRecursive(section.id, tasks)
```

---

## Data Flow Diagram

```
SECTION DRAG WITH NESTED GROUPS
===============================

1. User drags parent section by header
         |
         v
2. Vue Flow AUTOMATICALLY moves child nodes visually
   (because they have parentNode set)
         |
         v
3. handleNodeDragStop() fires for PARENT section only
         |
         ├─► Save parent's new position to store (ABSOLUTE)
         |
         ├─► Check if parent landed inside another section (new grandparent)
         |       If yes: set parentGroupId, update Vue Flow node directly
         |
         ├─► Check if parent was dragged OUT of its parent
         |       If yes: clear parentGroupId, update Vue Flow node directly
         |
         └─► DO NOT call syncNodes()!
             Vue Flow already has correct visual positions
         |
         v
4. Child positions are unchanged in store (they're relative to parent)
   Vue Flow continues showing them correctly relative to moved parent
```

---

## Z-Index Layering

Nested groups need proper z-index to render above their parents:

```
Z-INDEX CALCULATION
===================

Top-level section:  z-index = 0 (base)
├─ Nested section:  z-index = 1 (parent + 1)
│  ├─ Task:        z-index = 10 (always above sections)
│  └─ Nested-nested: z-index = 2 (parent + 1)
└─ Task:           z-index = 10
```

**In syncNodes()** (initial render):
```typescript
const getDepth = (groupId: string, depth = 0): number => {
  const group = sections.find(s => s.id === groupId)
  if (!group || !group.parentGroupId || depth > 10) return depth
  return getDepth(group.parentGroupId, depth + 1)
}
const zIndex = getDepth(section.id)
```

---

## Debugging Guide

### Console Logs to Watch

```
[TASK-072] Clearing parentGroupId: "X" dragged outside "Y"
[TASK-072] Setting parentGroupId: "X" is now child of "Y"
[TASK-072] DRAG COMPLETE - Vue Flow manages child positions
  Updated Vue Flow node: parentNode=section-xxx, relPos=(50, 30), zIndex=1
```

### Quick Checks

1. **Position resets after drag?** - Check if syncNodes() is being called
2. **Wrong group moves?** - Check parentNode relationships in Vue Flow
3. **Child behind parent?** - Check z-index in node.style and CSS overrides

---

## Verification Checklist

- [x] Drag parent group - child moves smoothly WITH it
- [x] Release drag - positions do NOT reset
- [x] Drag child inside parent - stays with parent
- [x] Drag child outside parent - becomes independent
- [x] Drag section into another - nests correctly
- [x] Nested group renders ABOVE parent (z-index)
- [x] Parent group counts tasks in child groups
- [x] Refresh page - positions persist correctly

---

## Fix 5: Recursive Absolute Position for 3+ Level Nesting

**File**: `src/composables/canvas/useCanvasDragDrop.ts`

**Problem:** When dragging a section nested 3+ levels deep (grandchild), the absolute position calculation was wrong because it only looked at the immediate parent's position, which was itself relative.

**Before (BROKEN for 3+ levels):**
```typescript
// Only checks immediate parent - WRONG for 3+ levels
if (node.parentNode) {
    const parentVFNode = nodes.value.find(n => n.id === node.parentNode)
    if (parentVFNode) {
        absoluteX = parentVFNode.position.x + node.position.x  // parent position may be relative!
        absoluteY = parentVFNode.position.y + node.position.y
    }
}
```

**After (FIXED - works for any depth):**
```typescript
// TASK-072 FIX: Recursively calculate absolute position for any nesting depth
const getAbsolutePosition = (nodeId: string): { x: number, y: number } => {
    const node = nodes.value.find(n => n.id === nodeId)
    if (!node) return { x: 0, y: 0 }

    if (!node.parentNode) {
        return { x: node.position.x, y: node.position.y }  // Already absolute
    }

    const parentAbsolute = getAbsolutePosition(node.parentNode)  // Recurse up!
    return {
        x: parentAbsolute.x + node.position.x,
        y: parentAbsolute.y + node.position.y
    }
}

const absolutePos = getAbsolutePosition(node.id)
```

**Why it works:** Recursively walks up the ancestor chain (grandchild → child → parent → ...) accumulating positions until reaching a top-level node.

**Supported depth:** 3+ levels now work. Technical limit is 10 levels (z-index guard).

---

## Rollback Procedure

```bash
# Revert the specific fixes
git checkout HEAD~1 -- src/composables/canvas/useCanvasDragDrop.ts
git checkout HEAD~1 -- src/views/CanvasView.vue
git checkout HEAD~1 -- .claude/skills/dev-debug-canvas/SKILL.md
```

---

## Files Modified Summary

| File | Change | Purpose |
|------|--------|---------|
| `useCanvasDragDrop.ts` | Remove syncNodes(), add direct node updates | Prevent position resets |
| `useCanvasDragDrop.ts` | Add z-index calculation | Nested groups render above parents |
| `CanvasView.vue` (CSS) | Remove `z-index: 1 !important` | Allow dynamic z-index |
| `CanvasView.vue` (syncNodes) | Use recursive counting for all groups | Parent counts include child tasks |
| `dev-debug-canvas/SKILL.md` | Add nested nodes section | Document the golden rule |

---

## Key Learnings

1. **Don't fight Vue Flow** - It manages parent-child relationships automatically
2. **Only update parents** - Children positions are relative, Vue Flow handles the rest
3. **Direct node mutations** - For immediate changes, update nodes.value directly
4. **CSS specificity matters** - `!important` can break dynamic styling
5. **Recursive counting** - Parents need to know about ALL descendants

---

## Related Issues

- **BUG-034**: Canvas group drag fix (simpler case, non-nested)
- **SKILL**: dev-debug-canvas updated with nested nodes golden rule

---

**Last Updated**: December 30, 2025
**Author**: Claude Code
