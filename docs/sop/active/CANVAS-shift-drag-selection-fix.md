# SOP: Canvas Shift+Drag Selection Fix

**Created**: January 6, 2026
**Related Task**: BUG-001
**Status**: Active

---

## Problem Statement

Rubber-band (shift+drag) selection was failing inside canvas groups while working correctly outside groups. Users could not select multiple tasks within a group using shift+drag.

---

## Root Causes Identified

### 1. CSS `:deep()` Selector in Unscoped Styles
**Issue**: The CSS rule used `:deep()` in an unscoped style block:
```css
/* BROKEN - :deep() doesn't work in unscoped styles */
.shift-selecting :deep(.vue-flow__node-sectionNode) {
  pointer-events: none !important;
}
```

**Why it failed**: The `:deep()` combinator only works in `<style scoped>` blocks. In unscoped styles, it has no effect and the selector doesn't match anything.

**Fix**:
```css
/* WORKING - direct selector in unscoped styles */
.shift-selecting .vue-flow__node-sectionNode,
.shift-selecting .vue-flow__node-taskNode {
  pointer-events: none !important;
}
```

### 2. Stale Viewport from `useVueFlow()`
**Issue**: When `useVueFlow()` is called inside an event handler, it returns stale/default values `{x: 0, y: 0, zoom: 1}` instead of actual viewport state.

**Why it matters**: The selection logic needs accurate viewport values to convert screen coordinates to canvas coordinates for intersection testing.

**Fix**: Read viewport directly from DOM transform:
```typescript
const getViewportFromDOM = (): { x: number, y: number, zoom: number } => {
    const transformPane = document.querySelector('.vue-flow__transformationpane') as HTMLElement
    if (!transformPane) return { x: 0, y: 0, zoom: 1 }

    const transform = transformPane.style.transform
    const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/)

    if (match) {
        return {
            x: parseFloat(match[1]),
            y: parseFloat(match[2]),
            zoom: parseFloat(match[3])
        }
    }
    return { x: 0, y: 0, zoom: 1 }
}
```

### 3. Vue Flow Flat DOM Structure
**Key Learning**: Vue Flow renders all nodes in a flat DOM structure. Child nodes are NOT DOM children of parent nodes. The parent-child relationship is managed via Vue Flow's internal state (`parentNode` property), not DOM hierarchy.

**Implication**: You cannot rely on DOM traversal to find parent/child relationships. Use Vue Flow's node data instead.

### 4. Nested Node Position Calculation
**Issue**: `node.computedPosition` was unreliable for nested nodes.

**Fix**: Recursively calculate absolute position by summing parent offsets:
```typescript
const getAbsolutePosition = (node: Node, allNodes: Node[]): { x: number, y: number } => {
    let x = node.position.x
    let y = node.position.y
    let parentId = node.parentNode

    while (parentId) {
        const parent = allNodes.find(n => n.id === parentId)
        if (parent) {
            x += parent.position.x
            y += parent.position.y
            parentId = parent.parentNode
        } else {
            break
        }
    }
    return { x, y }
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/views/CanvasView.vue` | Removed `:deep()` from CSS, added `handleCanvasContainerClick` |
| `src/composables/canvas/useCanvasSelection.ts` | Added `getViewportFromDOM()` and `getAbsolutePosition()` helpers |
| `src/composables/canvas/useCanvasEvents.ts` | Added Ctrl/Meta+click support for group selection toggle |
| `src/components/canvas/TaskNode.vue` | Fixed modifier key handling for multi-select |

---

## Debug Checklist for Future Selection Issues

1. **Check CSS selector application**:
   - Use browser DevTools to verify `pointer-events: none` is applied during shift-drag
   - Remember: `:deep()` only works in scoped styles

2. **Verify viewport values**:
   - Log viewport values in selection handlers
   - If showing `{x:0, y:0, zoom:1}`, use DOM-based viewport reading

3. **Check coordinate transformations**:
   - Screen coordinates must be converted to canvas coordinates
   - Account for viewport pan and zoom

4. **Verify node positions**:
   - For nested nodes, use recursive position calculation
   - Don't trust `computedPosition` for nested nodes

5. **Test selection intersection**:
   - Log selection box bounds and node bounds
   - Verify intersection math is correct in screen space

---

## Quick Reference: Coordinate Systems

| System | Description | Usage |
|--------|-------------|-------|
| Screen | `clientX/Y` from mouse events | Starting point for all calculations |
| Canvas | After viewport transform | What Vue Flow internally uses |
| Node Local | Relative to parent (if nested) | `node.position.x/y` |
| Node Absolute | World coordinates | Calculated via recursive sum |

**Conversion formula** (screen to canvas):
```typescript
const canvasX = (screenX - rect.left - viewport.x) / viewport.zoom
const canvasY = (screenY - rect.top - viewport.y) / viewport.zoom
```

**Conversion formula** (canvas to screen):
```typescript
const screenX = (canvasX * viewport.zoom) + viewport.x + rect.left
const screenY = (canvasY * viewport.zoom) + viewport.y + rect.top
```

---

## References

- Vue Flow Nested Nodes: https://vueflow.dev/examples/nodes/nesting.html
- Vue Flow Node Guide: https://vueflow.dev/guide/node.html
- Related discussion: https://github.com/bcakmakoglu/vue-flow/discussions/1202
