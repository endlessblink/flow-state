# SOP: Canvas Blurry Text on Zoom Fix

**Date**: December 28, 2025
**Bug ID**: BUG-041
**Priority**: P0-CRITICAL
**Status**: FIXED

## Problem Description

Text on Task Nodes and Group Nodes became blurry/rasterized when zooming out on the canvas (< 100% zoom). The issue was caused by browser GPU layer optimization that cached the canvas as a bitmap texture instead of re-rendering vector text at each zoom level.

## Root Cause Analysis

### Primary Issue
The `vue-flow-overrides.css` file existed with the correct fix (`will-change: auto !important`) but was **never imported** in the application. The CSS file was orphaned and not loaded.

### Secondary Issues
1. **Conflicting CSS Rule**: The CSS had `transform: translateZ(0) !important` on `.vue-flow__node` which broke Vue Flow's transform-based positioning (Vue Flow uses `transform: translate(x, y)` to position nodes)
2. **TaskNode.vue Drag State**: During drag operations, `will-change: transform !important` was applied, causing temporary text rasterization

### Technical Explanation
- Vue Flow applies `will-change: transform` to nodes for performance optimization
- This tells the browser to create a separate GPU layer for the element
- When zooming, the browser scales this cached bitmap instead of re-rendering
- Result: Blurry/pixelated text at non-100% zoom levels

## Solution Applied

### 1. Import the CSS Override (CanvasView.vue)
```typescript
// Import Vue Flow styles
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

// CRITICAL: Import AFTER Vue Flow CSS to override rasterization-causing styles (BUG-041)
import '@/assets/vue-flow-overrides.css'
```

### 2. Remove Problematic Transform (vue-flow-overrides.css)
```css
/* REMOVED - This was breaking Vue Flow's positioning */
/* transform: translateZ(0) !important; */

/* KEPT - Prevents bitmap caching */
.vue-flow__node {
    will-change: auto !important;
    backface-visibility: hidden !important;
    text-rendering: optimizeLegibility !important;
    -webkit-font-smoothing: subpixel-antialiased !important;
}

.vue-flow__transformation-pane,
.vue-flow__viewport {
    transform-style: preserve-3d !important;
    will-change: auto !important;
    backface-visibility: visible !important;
}
```

### 3. Fix TaskNode Drag State (TaskNode.vue)
```css
.task-node.dragging {
    /* Changed from: will-change: transform !important; */
    will-change: auto !important;
}
```

## Files Modified

| File | Change |
|------|--------|
| `src/views/CanvasView.vue` | Added import for `vue-flow-overrides.css` after Vue Flow imports |
| `src/assets/vue-flow-overrides.css` | Removed `transform: translateZ(0) !important` from `.vue-flow__node` |
| `src/components/canvas/TaskNode.vue` | Changed `will-change: transform` to `will-change: auto` in `.dragging` state |

## Verification Steps

1. Navigate to Canvas view
2. Create or view existing tasks/groups
3. Zoom out using mouse wheel or pinch gesture
4. Verify text remains crisp at all zoom levels (50%, 75%, etc.)
5. Verify nodes and groups can still be dragged
6. Verify drag operations work smoothly

## Rollback Procedure

If issues occur, revert the three files:

```bash
git checkout HEAD~1 -- src/views/CanvasView.vue
git checkout HEAD~1 -- src/assets/vue-flow-overrides.css
git checkout HEAD~1 -- src/components/canvas/TaskNode.vue
```

## Prevention

1. **Always import CSS files** - Never leave orphaned CSS files in the codebase
2. **Avoid `transform` overrides** on Vue Flow nodes - Vue Flow uses transform for positioning
3. **Use `will-change: auto`** instead of `will-change: transform` to prevent GPU layer caching
4. **Test zoom functionality** after any canvas CSS changes

## Related Issues

- Previous failed attempts included removing `backdrop-filter` and `overflow: hidden`
- The actual issue was the missing CSS import, not the CSS rules themselves

## References

- [MDN: will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)
- [Chrome DevTools: Compositing Layers](https://developer.chrome.com/docs/devtools/rendering/performance/)
- Vue Flow uses CSS transforms for node positioning
