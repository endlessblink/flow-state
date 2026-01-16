# SOP-005: Canvas Resize Handle Visibility

**Created**: 2026-01-15
**Task**: TASK-290
**Status**: Resolved

## Problem

Canvas group resize handles were either:
1. Always visible (cluttering the UI)
2. Only visible when selected (not discoverable on hover)

Users expected resize handles to appear when hovering over a group, similar to other design tools.

## Root Cause

Multiple conflicting CSS rules in `canvas-view-overrides.css` were fighting for control:

1. **Global rules** (lines ~340-355) set `opacity: 1 !important` on ALL `.vue-flow__resize-control.handle` elements
2. **Section-specific rules** tried to hide handles but were overridden by the global rules
3. **Specificity issues** - global rules applied to all nodes, not just when appropriate

## Solution

### 1. Remove Global Visibility Rules

In `canvas-view-overrides.css`, the base `.vue-flow__resize-control.handle` rule should NOT set `opacity` or `pointer-events`. These must be controlled by more specific selectors.

```css
/* CORRECT - Base styles only, no visibility control */
.vue-flow__resize-control.handle {
    width: 20px !important;
    height: 20px !important;
    border-radius: var(--radius-sm) !important;
    background-color: var(--brand-primary) !important;
    border: 2px solid white !important;
    /* Do NOT set opacity or pointer-events here */
}
```

### 2. Section-Specific Visibility Rules

Add rules that target `.vue-flow__node-sectionNode` specifically:

```css
/* DEFAULT: Hidden */
.vue-flow__node-sectionNode .vue-flow__resize-control.handle {
    opacity: 0 !important;
    pointer-events: none !important;
}

/* HOVER: Visible */
.vue-flow__node-sectionNode:hover .vue-flow__resize-control.handle {
    opacity: 1 !important;
    pointer-events: auto !important;
}

/* SELECTED: Visible */
.vue-flow__node-sectionNode.selected .vue-flow__resize-control.handle,
.vue-flow__node-sectionNode.vue-flow__node--selected .vue-flow__resize-control.handle {
    opacity: 1 !important;
    pointer-events: auto !important;
}
```

### 3. Same Pattern for Lines

```css
.vue-flow__node-sectionNode .vue-flow__resize-control.line {
    opacity: 0 !important;
    pointer-events: none !important;
}

.vue-flow__node-sectionNode:hover .vue-flow__resize-control.line {
    opacity: 0.4 !important;
    pointer-events: auto !important;
}
```

## Key Insights

### Vue Flow Node Structure

```
.vue-flow__node-sectionNode  (Vue Flow wrapper - receives :hover)
  └── .section-node          (Custom component - inner div)
        └── NodeResizer
              └── .vue-flow__resize-control.handle
              └── .vue-flow__resize-control.line
```

- `:hover` must be on `.vue-flow__node-sectionNode` (the Vue Flow wrapper)
- NOT on `.section-node` (the inner component div)
- CSS `:hover` propagates correctly to child elements

### Why Scoped CSS Doesn't Work

Scoped CSS in Vue components (`:deep()`) targets `.section-node` which is INSIDE the Vue Flow wrapper. The hover state needs to be detected on the WRAPPER element, not the inner component.

**Solution**: Use global CSS in `canvas-view-overrides.css` targeting the Vue Flow wrapper class.

## Files Modified

- `src/assets/canvas-view-overrides.css` - Main resize handle CSS rules

## Testing

1. Navigate to Canvas view
2. Hover over a group - resize handles should appear at corners and edges
3. Move mouse away - handles should disappear
4. Click to select group - handles should appear and stay
5. Click elsewhere to deselect - handles should disappear
6. Drag a resize handle - group should resize correctly

## Related

- [SOP-002: Canvas Geometry Invariants](./SOP-002-canvas-geometry-invariants.md)
- [SOP-004: CSS Shadow Overflow Clipping](./SOP-004-css-shadow-overflow-clipping.md)
