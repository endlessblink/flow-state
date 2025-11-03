# Virtual Border Troubleshooting SOP

## Overview
This SOP documents the process for identifying and fixing virtual border issues in Vue Flow canvas that prevent task movement beyond invisible boundaries.

## Problem Identification

### Symptoms
- Tasks cannot be dragged beyond certain coordinates (especially upward or leftward)
- Users report "invisible borders" or "virtual borders" blocking movement
- Tasks get stuck at specific coordinates despite visible space being available

### Common Causes
1. **Node Extent Configuration** - Vue Flow's `node-extent` property creates invisible boundaries
2. **Container Constraints** - CSS overflow or viewport limitations
3. **Z-index Layering** - Elements blocking interaction with canvas areas
4. **Transform Boundaries** - CSS transform or coordinate system limitations

## Troubleshooting Process

### Step 1: Identify the Virtual Border Location

#### Method A: Visual Debugging Overlay
```javascript
// Add debugging overlay to identify boundaries
const debugOverlay = document.createElement('div');
debugOverlay.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 200px;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 10px;
  z-index: 9999;
  font-family: monospace;
  font-size: 12px;
`;

// Get container dimensions
const vueFlowContainer = document.querySelector('.vue-flow');
const taskNode = document.querySelector('.vue-flow__node');

if (vueFlowContainer && taskNode) {
  const containerRect = vueFlowContainer.getBoundingClientRect();
  const nodeRect = taskNode.getBoundingClientRect();

  debugOverlay.innerHTML = `
    <h4>CANVAS BOUNDARY DEBUG</h4>
    ● Vue Flow Container: ${containerRect.width}x${containerRect.height}<br>
    ● Task Position: (${nodeRect.left - containerRect.left}, ${nodeRect.top - containerRect.top})<br>
    ● Node Extent: Check CanvasView.vue line 115<br>
    Try dragging task to see where it stops
  `;

  document.body.appendChild(debugOverlay);
}
```

#### Method B: Console Logging
```javascript
// Monitor node position during drag
const handleNodeDrag = (event) => {
  const { node } = event;
  console.log(`Node position: x=${node.position.x}, y=${node.position.y}`);

  // Check if position is hitting boundaries
  if (node.position.y <= 0) {
    console.warn('Virtual border detected at y=0 (top boundary)');
  }
  if (node.position.x <= 0) {
    console.warn('Virtual border detected at x=0 (left boundary)');
  }
};
```

### Step 2: Check Vue Flow Configuration

#### Locate Node Extent Setting
In `src/views/CanvasView.vue`, find the VueFlow component configuration:

```vue
<VueFlow
  v-model:nodes="nodes"
  v-model:edges="edges"
  :node-extent="[[0, 0], [3000, 3000]]"  <!-- ← This is the virtual border setting -->
  ...
>
```

#### Understand Node Extent Format
- `[[minX, minY], [maxX, maxY]]`
- `minX, minY` = Minimum allowed coordinates (virtual borders)
- `maxX, maxY` = Maximum allowed coordinates

### Step 3: Fix Virtual Border Issues

#### Solution A: Extend Boundaries
```vue
<!-- Before -->
:node-extent="[[0, 0], [3000, 3000]]"

<!-- After - extend boundaries to allow negative coordinates -->
:node-extent="[[-2000, -2000], [5000, 5000]]"
```

#### Solution B: Remove Restrictions
```vue
<!-- Completely remove extent restrictions -->
:node-extent="null"
```

#### Solution C: Conservative Extension
```vue
<!-- Extend just enough to solve the issue -->
:node-extent="[[-500, -500], [3500, 3500]]"
```

### Step 4: Test the Fix

#### Manual Testing Steps
1. **Test Upward Movement**: Drag a task upward beyond the previous boundary
2. **Test Leftward Movement**: Drag a task leftward beyond the previous boundary
3. **Test All Directions**: Ensure movement works in all directions
4. **Test Edge Cases**: Verify tasks can be moved to extreme coordinates

#### Automated Testing
```javascript
// Test movement with Playwright or similar
const testNodeMovement = async () => {
  const taskNode = page.locator('.vue-flow__node').first();

  // Get initial position
  const initialBox = await taskNode.boundingBox();

  // Drag upward
  await taskNode.dragTo(page.locator('.vue-flow').first(), {
    sourcePosition: { x: initialBox.width / 2, y: initialBox.height / 2 },
    targetPosition: { x: initialBox.width / 2, y: 0 }
  });

  // Verify movement beyond previous boundary
  const finalBox = await taskNode.boundingBox();
  console.log(`Task moved from y=${initialBox.y} to y=${finalBox.y}`);
};
```

## Common Scenarios & Solutions

### Scenario 1: Tasks Stuck at Top (y: 0)
**Problem**: Tasks cannot be dragged above y: 0 coordinate
**Solution**: Extend minY to negative value
```vue
:node-extent="[[-1000, -1000], [3000, 3000]]"
```

### Scenario 2: Tasks Stuck at Left (x: 0)
**Problem**: Tasks cannot be dragged left of x: 0 coordinate
**Solution**: Extend minX to negative value
```vue
:node-extent="[[-1000, 0], [3000, 3000]]"
```

### Scenario 3: Both Top and Left Boundaries
**Problem**: Tasks stuck at both x: 0 and y: 0
**Solution**: Extend both minX and minY
```vue
:node-extent="[[-1000, -1000], [3000, 3000]]"
```

### Scenario 4: Canvas Not Loading After Changes
**Problem**: Canvas breaks after node-extent modification
**Solution**:
1. Check for syntax errors in extent array
2. Ensure array format is correct: `[[x, y], [x, y]]`
3. Verify no invalid coordinates (e.g., Infinity, NaN)

## Best Practices

### 1. Use Reasonable Boundaries
- Don't make boundaries excessively large (performance impact)
- Provide enough space for typical use cases
- Consider maximum expected canvas size

### 2. Test Thoroughly
- Test all four directions of movement
- Test with different zoom levels
- Test with multiple nodes selected

### 3. Document Changes
- Keep track of original boundaries
- Document why changes were made
- Note any performance implications

### 4. Consider User Experience
- Ensure grid alignment still works with extended boundaries
- Test mini-map functionality
- Verify auto-arrange features work correctly

## Related Files

- **Primary**: `src/views/CanvasView.vue` - Contains VueFlow configuration
- **Node Component**: `src/components/canvas/TaskNode.vue` - Task rendering and interaction
- **Store**: `src/stores/canvas.js` - Canvas state management
- **Styles**: Global Vue Flow overrides in CanvasView.vue `<style>` section

## Quick Reference

### Node Extent Examples
```vue
<!-- Default restrictive -->
:node-extent="[[0, 0], [3000, 3000]]"

<!-- Extended for free movement -->
:node-extent="[[-2000, -2000], [5000, 5000]]"

<!-- Conservative extension -->
:node-extent="[[-500, -500], [3500, 3500]]"

<!-- No restrictions -->
:node-extent="null"
```

### Debug Commands
```javascript
// Check current node positions
console.log(window.vueFlow?.getNodes());

// Monitor viewport
console.log(window.vueFlow?.getViewport());

// Check extent during runtime
console.log('Node extent should be in CanvasView.vue line 115');
```

## Version History

- **v1.0** - Initial SOP creation
- **v1.1** - Added Playwright testing examples
- **v1.2** - Documented real-world fix from y: 0, x: 0 boundaries issue

---

**Last Updated**: 2025-10-12
**Maintainer**: Development Team
**Related Issue**: Virtual borders preventing upward task dragging