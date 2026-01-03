# SOP: Canvas Resize Jump Fix (BUG-055)

**Date**: January 1, 2026
**Status**: FIXED - AWAITING USER VERIFICATION
**Severity**: P1-HIGH

## Problem Description

When resizing groups on the canvas, tasks inside would **move with the group boundary** instead of staying at their absolute position. The user's expected behavior was:
- Tasks should stay at their absolute canvas position
- Only the group boundary should change
- Tasks should NOT slide/move when the group is resized

## Root Cause Analysis

The `handleSectionResizeEnd()` function contained ~70 lines of code that:
1. Calculated position delta when resizing from left/top edges
2. Found all tasks inside the section
3. **Moved each task by the delta** (this was the unwanted behavior)
4. Also moved any child groups by the delta

This "helpful" feature was moving tasks to keep them in the same relative position within the group, but the user wanted tasks to maintain their **absolute** canvas position.

## Solution

### Removed task position adjustment code (lines 2736-2808 → simplified to 4 lines)

**Before (70+ lines):**
```typescript
// If position changed significantly, update child task positions
if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
  // Find all tasks inside this section...
  // Update each task's absolute position by the delta...
  // Also adjust child groups recursively...
}
```

**After (4 lines):**
```typescript
// BUG-055 FIX: Tasks should NOT move when group is resized
// Tasks stay at their absolute canvas position - only the group boundary changes
// This means tasks may end up outside the group after resize, which is expected behavior
console.log('ℹ️ [CanvasView] Group resized - tasks maintain absolute positions (no movement)')
```

## Files Modified

| File | Change |
|------|--------|
| `src/views/CanvasView.vue` | Removed ~70 lines of task position adjustment code from `handleSectionResizeEnd` |

## Verification

1. Build passes: `npm run build` ✅
2. **User must verify**: Resize a group from any edge and confirm tasks stay at their absolute position

## Rollback Procedure

If the old behavior (tasks move with group) is needed, restore the removed code block from git history:

```bash
git show HEAD~1:src/views/CanvasView.vue | grep -A 80 "If position changed significantly"
```

## Note on Behavior Change

With this fix:
- Tasks maintain their **absolute canvas position** when groups are resized
- If you resize a group smaller, tasks may end up **outside** the group boundary
- This is the **expected behavior** per user requirement

## Related Issues

- **BUG-043**: Group resize only works from corners (FIXED Dec 30)
- **TASK-072**: Nested groups support (FIXED Dec 30)
- **BUG-052**: Viewport jumping on view switch (FIXED Dec 31)

## Key Insight

Vue Flow's parent-child relationship system uses relative positioning. When the store (source of truth) has absolute positions but Vue Flow uses relative ones, any direct manipulation of Vue Flow nodes (like NodeResizer does) can cause desync. The solution is to always call `syncNodes()` after operations that update the store to push the correct relative positions back to Vue Flow.

## Architecture Note

This fix follows the established pattern in the codebase where:
- **Store is source of truth** (absolute positions)
- **Vue Flow is the view** (relative positions for children)
- **`syncNodes()` bridges the gap** (converts store → Vue Flow)
