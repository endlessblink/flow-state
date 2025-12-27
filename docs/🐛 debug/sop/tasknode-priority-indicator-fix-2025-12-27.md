# SOP: TaskNode Priority Indicator Visual Fix

**Date**: 2025-12-27
**Component**: `src/components/canvas/TaskNode.vue`
**Issue**: Priority indicator bar appeared "cut out" instead of filling the top edge of the task card
**Status**: RESOLVED

---

## Problem Description

The priority indicator bar on canvas TaskNode components was rendering with a visual artifact where it appeared to be "cut out" from the top of the card rather than seamlessly filling the top edge. Additionally, after the initial fix was applied, Vue Flow connection handles (green dots) were getting clipped and not visible above the card.

### Visual Issue
- Priority bar had border-radius that didn't match the parent card's rounded corners
- The bar appeared to float/hover above the card rather than being integrated into it
- After applying `overflow: hidden` to fix the priority bar, connection handles became invisible

---

## Root Cause Analysis

### Issue 1: Priority Bar "Cut Out" Appearance
1. **CSS Inheritance Mismatch**: The priority indicator had its own border-radius (`calc(var(--radius-xl) - 1px)`) that didn't perfectly align with the parent's border-radius
2. **Missing Overflow Clipping**: Without `overflow: hidden` on the parent, the priority bar's edges weren't clipped to match the card's rounded corners
3. **Positioning**: The bar was positioned at `top: 0` but the card's rounded corners created a visual gap

### Issue 2: Connection Handles Clipped
1. **Overflow Hidden Side Effect**: Adding `overflow: hidden` to `.task-node` also clipped the Vue Flow Handle components
2. **Handle Positioning**: Handles are positioned absolutely and extend beyond the card boundary
3. **Z-Index Ineffective**: Z-index cannot override `overflow: hidden` clipping

---

## Solution

### Strategy: Content Wrapper Pattern
Restructure the component HTML to separate clipped content from non-clipped elements:
- Create an inner `.task-node-content` wrapper with `overflow: hidden`
- Keep Vue Flow Handles outside the wrapper so they're not clipped

### Implementation

#### Template Changes (TaskNode.vue)

**Before:**
```vue
<template>
  <div class="task-node" :class="{...}">
    <!-- Priority Badge -->
    <div v-if="showPriority" class="priority-indicator" :class="priorityClass" />

    <!-- Content... -->

    <!-- Selection Indicator -->
    <div v-if="isSelected" class="selection-indicator">...</div>

    <!-- Connection Handles -->
    <Handle v-if="isInVueFlowContext" type="target" :position="Position.Top" />
    <Handle v-if="isInVueFlowContext" type="source" :position="Position.Bottom" />
  </div>
</template>
```

**After:**
```vue
<template>
  <div class="task-node" :class="{...}">
    <!-- Content wrapper - clips priority bar to rounded corners -->
    <div class="task-node-content">
      <!-- Priority Badge -->
      <div v-if="showPriority" class="priority-indicator" :class="priorityClass" />

      <!-- Content (timer badge, title, description, metadata)... -->
    </div>

    <!-- Selection Indicator - outside content wrapper so it's not clipped -->
    <div v-if="isSelected" class="selection-indicator">...</div>

    <!-- Connection Handles - outside content wrapper so they're not clipped -->
    <Handle v-if="isInVueFlowContext" type="target" :position="Position.Top" />
    <Handle v-if="isInVueFlowContext" type="source" :position="Position.Bottom" />
  </div>
</template>
```

#### CSS Changes

**Before:**
```css
.task-node {
  position: relative;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  /* No overflow control */
}

.priority-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  border-radius: calc(var(--radius-xl) - 1px) calc(var(--radius-xl) - 1px) 0 0;
}
```

**After:**
```css
.task-node {
  position: relative;
  border-radius: var(--radius-xl);
  /* No padding - moved to content wrapper */
  /* No overflow hidden - handles need to extend beyond */
}

/* Content wrapper - clips priority bar to card's rounded corners */
.task-node-content {
  position: relative;
  padding: var(--space-6);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.priority-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  border-radius: 0;  /* Parent's overflow:hidden clips to rounded corners */
}
```

---

## Key Learnings

### CSS Overflow Clipping Pattern
1. `overflow: hidden` on a parent with `border-radius` clips children to the rounded shape
2. This is more reliable than trying to match border-radius values manually
3. Elements that need to extend beyond (like handles, indicators) must be outside the clipped container

### Vue Component Structure for Mixed Clipping
When you need both:
- Some elements clipped to rounded corners
- Some elements extending beyond the boundary

Use a content wrapper pattern:
```vue
<div class="outer-container">
  <div class="clipped-content">
    <!-- Elements that should be clipped -->
  </div>
  <!-- Elements that extend beyond -->
</div>
```

### Vue Flow Handle Positioning
- Vue Flow Handles are positioned absolutely relative to their parent node
- They extend beyond the node boundary by design (for connection UX)
- Never apply `overflow: hidden` to the same element that contains Handles

---

## Verification Steps

1. **Visual Check**: Priority bar should fill the top edge seamlessly with no gaps
2. **Priority Variants**: Test with high (red), medium (orange), and low (blue) priorities
3. **Connection Handles**: Green dots should be visible above the card
4. **Selection State**: Selection indicator should remain visible around the card
5. **Hover States**: Ensure all hover effects still work

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/canvas/TaskNode.vue` | Template restructure, CSS updates |

---

## Rollback Procedure

If issues occur:
```bash
git checkout HEAD~1 -- src/components/canvas/TaskNode.vue
```

Or manually:
1. Remove the `.task-node-content` wrapper div
2. Move padding back to `.task-node`
3. Remove `overflow: hidden` from `.task-node-content`
4. Restore original border-radius on `.priority-indicator`

---

## Related Issues

- Previous fix attempt: Added `overflow: hidden` to `.task-node` directly (broke handles)
- Memory observation #2323: Documented removal of `overflow: hidden` - this SOP supersedes that approach with the correct solution

---

## Tags

`canvas` `visual-fix` `css` `vue-flow` `overflow` `border-radius`
