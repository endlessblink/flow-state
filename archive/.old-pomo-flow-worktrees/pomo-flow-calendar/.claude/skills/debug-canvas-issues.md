# 🎨 Canvas Development, Design & Debugging Skill

🔧 **SKILL ACTIVATED: Canvas Development, Design & Debugging**

This skill provides comprehensive guidance for Vue Flow canvas development, design patterns, debugging complex node interactions, and testing with Playwright MCP.

---

## Table of Contents

1. [Vue Flow Architecture & Core Concepts](#vue-flow-architecture)
2. [NodeResizer Deep Dive](#noderesizer-deep-dive)
3. [Parent-Child Node Management](#parent-child-node-management)
4. [Debugging Techniques](#debugging-techniques)
5. [Playwright Testing Strategies](#playwright-testing-strategies)
6. [Common Issues & Solutions](#common-issues-solutions)
7. [Performance Considerations](#performance-considerations)
8. [Testing Checklist](#testing-checklist)

---

## Vue Flow Architecture & Core Concepts {#vue-flow-architecture}

### Node System

Vue Flow uses a **custom node type system** where you define node templates:

```vue
<template #node-sectionNode="nodeProps">
  <NodeResizer ... />
  <SectionNodeSimple :data="nodeProps.data" />
</template>
```

**Node Type Registration**:
```javascript
const nodeTypes = markRaw({
  taskNode: TaskNode,
  sectionNode: SectionNodeSimple
})
```

### Node Positioning

- **Absolute positioning**: Nodes use `position: { x, y, width, height }`
- **Relative positioning**: Child nodes can have positions relative to parent
- **Computed positions**: Vue Flow calculates final screen positions automatically

### Vue Flow Class Naming Convention

**CRITICAL**: Vue Flow generates classes automatically:
- Node wrapper: `.vue-flow__node`
- Node type class: `.vue-flow__node-{nodeType}` (e.g., `.vue-flow__node-sectionNode`)
- Selection state: `.selected` or `.vue-flow__node--selected`
- **NO `data-id` or `id` attributes on nodes by default!**

### Extent Property

The `extent` property controls node boundaries:

```javascript
// Constrain to parent bounds
node.extent = 'parent'

// Constrain to specific coordinates
node.extent = [[-100, -100], [500, 500]]

// No constraints
node.extent = undefined
```

**⚠️ Critical Behavior**: Setting `extent: 'parent'` causes child nodes to **move with parent when parent resizes**!

### Viewport & Zoom Management

```javascript
const {
  fitView,
  zoomIn,
  zoomOut,
  zoomTo,
  viewport
} = useVueFlow()
```

---

## NodeResizer Deep Dive {#noderesizer-deep-dive}

### Basic Configuration

```vue
<NodeResizer
  :min-width="200"
  :min-height="150"
  :max-width="1200"
  :max-height="800"
  :handle-style="customHandleStyle"
  :handle-class="'custom-resize-handle'"
  :line-style="customLineStyle"
  :line-class="'custom-resize-line'"
  color="transparent"
  @resize-start="handleResizeStart"
  @resize="handleResize"
  @resize-end="handleResizeEnd"
/>
```

### Available Props

| Prop | Type | Purpose |
|------|------|---------|
| `nodeId` | string | Attach resizer to specific node (optional) |
| `minWidth` | number | Minimum width constraint |
| `minHeight` | number | Minimum height constraint |
| `maxWidth` | number | Maximum width constraint |
| `maxHeight` | number | Maximum height constraint |
| `handleStyle` | CSSProperties | Custom handle styling |
| `handleClass` | string | CSS class for handles |
| `lineStyle` | CSSProperties | Custom line styling |
| `lineClass` | string | CSS class for lines |
| `color` | string | Visual color for lines/handles |
| `isVisible` | boolean | Control resizer visibility |
| `keepAspectRatio` | boolean/number | Lock aspect ratio during resize |
| `autoScale` | boolean | Scale with zoom level (default: true) |

### Event Lifecycle

```javascript
// 1. Resize starts
handleResizeStart(event) {
  // event.node - The node being resized
  // event.params - { x, y, width, height }
  // Initialize resize state
}

// 2. During resize (fires continuously)
handleResize(event) {
  // event.params - Current dimensions with direction
  // Update preview, validate bounds
}

// 3. Resize completes
handleResizeEnd(event) {
  // event.node - Final node state
  // Commit to store, cleanup
}
```

### Handle Types

**NodeResizer provides 4 corner handles by default**:
- Top-left
- Top-right
- Bottom-left
- Bottom-right

**For edge handles** (top, bottom, left, right), use `NodeResizeControl`:

```vue
import { NodeResizeControl } from '@vue-flow/node-resizer'

<!-- Add individual edge handles -->
<NodeResizeControl position="top" />
<NodeResizeControl position="right" />
<NodeResizeControl position="bottom" />
<NodeResizeControl position="left" />
```

### CSS Control for Handles

**Default state** (hidden):
```css
.vue-flow__node-sectionNode .vue-flow__resize-control.handle {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
```

**Selected state** (visible):
```css
.vue-flow__node-sectionNode.selected .vue-flow__resize-control.handle {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  z-index: 100 !important;
}
```

---

## Parent-Child Node Management {#parent-child-node-management}

### The Critical Problem

**Issue**: When a parent node is resized, child nodes move with it if they have `extent: 'parent'`.

**Why This Happens**:
- `extent: 'parent'` means child position is **constrained within parent bounds**
- Vue Flow **recalculates child positions** when parent resizes
- Children maintain their **relative position within the parent's coordinate system**

### Solution Patterns

#### Pattern 1: Temporary Extent Removal

```javascript
// When adding child to parent without movement
node.extent = "parent"
node.parentNode = parentId

nextTick(() => {
  node.extent = undefined  // Remove constraint after positioning
})
```

#### Pattern 2: Don't Use Parent-Child for Grouping

If you want **visual grouping** without movement behavior:
- Use a section/container as a **visual element only**
- Don't set `parentNode` property on tasks
- Manage positioning independently
- Use filters/queries to determine which tasks appear in sections

#### Pattern 3: Calculate Position Compensation

```javascript
// When parent resizes, recalculate child positions
handleParentResize(parentNode, oldDimensions, newDimensions) {
  const deltaX = newDimensions.x - oldDimensions.x
  const deltaY = newDimensions.y - oldDimensions.y

  childNodes.forEach(child => {
    child.position.x -= deltaX
    child.position.y -= deltaY
  })
}
```

### expandParent Property

**Purpose**: Automatically expand parent to fit all children

```javascript
node.parentNode = parentId
node.expandParent = true  // Parent grows to contain this node
```

**Use Cases**:
- Dynamic content where children determine parent size
- Collapsible groups that should resize when expanded
- Mind maps with growing branches

**⚠️ Caution**: Can conflict with manual resize operations

### Z-Index Management

Vue Flow automatically elevates child nodes:
- Parent z-index: base level
- Children z-index: parent + 1
- Selected nodes: +1000 elevation

---

## Debugging Techniques {#debugging-techniques}

### 1. DOM Inspection with Playwright MCP

**Problem**: Right-click context menu override prevents browser DevTools inspection

**Solution**: Use Playwright MCP for programmatic inspection

```javascript
// Find node by class
await page.evaluate(() => {
  const node = document.querySelector('.vue-flow__node-sectionNode.selected')
  const rect = node.getBoundingClientRect()
  const style = window.getComputedStyle(node)

  return {
    dimensions: { width: rect.width, height: rect.height },
    cssWidth: style.width,
    cssHeight: style.height,
    classes: Array.from(node.classList)
  }
})
```

### 2. Element Selector Strategies

**❌ WRONG** - Vue Flow nodes don't have `data-id`:
```javascript
const node = document.querySelector(`[data-id="${nodeId}"]`)
```

**✅ CORRECT** - Use generated classes:
```javascript
// Strategy 1: By node type and selection
const node = document.querySelector('.vue-flow__node-sectionNode.selected')

// Strategy 2: Handle multiple nodes
const allSections = document.querySelectorAll('.vue-flow__node-sectionNode')
const selected = document.querySelector('.vue-flow__node-sectionNode.selected')

// Strategy 3: Fallback logic
let nodeElement = null
if (allSections.length === 1) {
  nodeElement = allSections[0]
} else {
  nodeElement = document.querySelector('.vue-flow__node-sectionNode.selected')
  if (!nodeElement && allSections.length > 0) {
    nodeElement = allSections[0]  // Fallback to first
  }
}
```

### 3. Console Debugging Patterns

```javascript
// Resize event logging
handleResizeStart(event) {
  console.log('🔧 Resize start:', {
    nodeId: event.node.id,
    initialDimensions: {
      width: event.params.width,
      height: event.params.height
    }
  })
}

handleResize(event) {
  console.log('📏 Resizing:', {
    currentWidth: event.params.width,
    currentHeight: event.params.height,
    direction: event.params.direction
  })
}

handleResizeEnd(event) {
  console.log('✅ Resize complete:', {
    finalDimensions: event.params
  })
}
```

### 4. Vue DevTools Integration

**Inspect Pinia Store State**:
1. Open Vue DevTools
2. Navigate to Pinia tab
3. Watch `canvasStore.sections` for dimension changes
4. Check `canvasStore.nodes` for position updates

**Timeline Debugging**:
1. Enable Timeline in Vue DevTools
2. Track mutations during resize
3. Identify where state updates occur
4. Verify undo/redo state capture

### 5. Checking Computed Styles

```javascript
// Get actual rendered styles (not just CSS)
const element = document.querySelector('.vue-flow__resize-control.handle')
const computed = window.getComputedStyle(element)

console.log({
  opacity: computed.opacity,
  visibility: computed.visibility,
  pointerEvents: computed.pointerEvents,
  zIndex: computed.zIndex
})
```

---

## Playwright Testing Strategies {#playwright-testing-strategies}

### 1. Canvas Screenshot Testing

```javascript
// Take screenshot for visual verification
await page.goto('http://localhost:5546/#/canvas')

// Before action
await page.screenshot({
  path: 'before-resize.png',
  fullPage: false
})

// Perform action
await page.click('[data-testid="section-node"]')

// After action
await page.screenshot({
  path: 'after-resize.png',
  fullPage: false
})
```

### 2. Drag & Drop Simulation

```javascript
// Method 1: Mouse API (most reliable)
const handle = await page.locator('.vue-flow__resize-control.bottom.right')
const box = await handle.boundingBox()

await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(box.x + 100, box.y + 100, { steps: 10 })
await page.mouse.up()

// Method 2: dragTo (simpler but less control)
await page.locator('.draggable-handle').dragTo(
  page.locator('.drop-target')
)
```

### 3. State Verification

```javascript
// Before resize
const beforeDimensions = await page.evaluate(() => {
  const node = document.querySelector('.vue-flow__node-sectionNode.selected')
  const rect = node.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
})

// Perform resize
// ...

// After resize
const afterDimensions = await page.evaluate(() => {
  const node = document.querySelector('.vue-flow__node-sectionNode.selected')
  const rect = node.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
})

// Assert
expect(afterDimensions.width).toBeGreaterThan(beforeDimensions.width)
```

### 4. Handle Visibility Testing

```javascript
test('resize handles visible only when selected', async ({ page }) => {
  await page.goto('http://localhost:5546/#/canvas')

  // Create section
  await page.click('[data-testid="add-section"]')

  // Handles should be hidden initially
  const hiddenHandles = await page.evaluate(() => {
    const handles = document.querySelectorAll('.vue-flow__resize-control.handle')
    return Array.from(handles).map(h => ({
      opacity: window.getComputedStyle(h).opacity,
      visibility: window.getComputedStyle(h).visibility
    }))
  })

  expect(hiddenHandles.every(h => h.opacity === '0')).toBe(true)

  // Click section to select
  await page.click('.vue-flow__node-sectionNode')

  // Handles should now be visible
  const visibleHandles = await page.evaluate(() => {
    const handles = document.querySelectorAll('.vue-flow__resize-control.handle')
    return Array.from(handles).map(h => ({
      opacity: window.getComputedStyle(h).opacity,
      visibility: window.getComputedStyle(h).visibility,
      pointerEvents: window.getComputedStyle(h).pointerEvents
    }))
  })

  expect(visibleHandles.every(h =>
    h.opacity === '1' &&
    h.visibility === 'visible' &&
    h.pointerEvents === 'auto'
  )).toBe(true)
})
```

### 5. Child Node Position Testing

```javascript
test('children do not move when parent resizes', async ({ page }) => {
  await page.goto('http://localhost:5546/#/canvas')

  // Get child positions before parent resize
  const beforePositions = await page.evaluate(() => {
    const children = document.querySelectorAll('[data-parent="section-1"]')
    return Array.from(children).map(child => {
      const rect = child.getBoundingClientRect()
      return { x: rect.x, y: rect.y }
    })
  })

  // Resize parent
  const handle = page.locator('.parent-section .vue-flow__resize-control.bottom.right')
  await handle.dragTo(page.locator('.canvas'), {
    targetPosition: { x: 100, y: 100 }
  })

  // Get child positions after parent resize
  const afterPositions = await page.evaluate(() => {
    const children = document.querySelectorAll('[data-parent="section-1"]')
    return Array.from(children).map(child => {
      const rect = child.getBoundingClientRect()
      return { x: rect.x, y: rect.y }
    })
  })

  // Assert positions unchanged (or calculate expected offset)
  beforePositions.forEach((before, i) => {
    const after = afterPositions[i]
    expect(Math.abs(before.x - after.x)).toBeLessThan(5)  // Allow small rounding
    expect(Math.abs(before.y - after.y)).toBeLessThan(5)
  })
})
```

---

## Common Issues & Solutions {#common-issues-solutions}

### Issue 1: Children Move When Parent Resizes

**Symptoms**:
- Dragging parent resize handle causes child nodes to move
- Children maintain relative position within parent
- Visual layout breaks when resizing

**Cause**: `extent: 'parent'` property on child nodes

**Solutions**:

A. **Remove parent-child relationship**:
```javascript
// Don't use parentNode for visual grouping
section.children = []  // Just visual container
tasks.forEach(task => {
  task.parentNode = undefined
  task.extent = undefined
})
```

B. **Temporary extent for positioning**:
```javascript
// Add child without movement
task.extent = "parent"
task.parentNode = sectionId
nextTick(() => task.extent = undefined)
```

C. **Position compensation** (complex):
```javascript
handleResize(event) {
  if (node.type === 'section') {
    const delta = calculatePositionDelta(oldPos, newPos)
    node.children.forEach(child => {
      child.position.x -= delta.x
      child.position.y -= delta.y
    })
  }
}
```

### Issue 2: Resize Handles Always Visible

**Symptoms**:
- Handles show even when section not selected
- Cannot hide handles
- Multiple sections show handles simultaneously

**Cause**: CSS selectors targeting wrong elements

**Solution**:
```css
/* Default: Hidden */
.vue-flow__node-sectionNode .vue-flow__resize-control.handle {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

/* Selected: Visible */
.vue-flow__node-sectionNode.selected .vue-flow__resize-control.handle {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  z-index: 100 !important;
}
```

### Issue 3: Weird/Inconsistent Resize Behavior

**Symptoms**:
- Resize sometimes works, sometimes doesn't
- Dimensions update in store but not visually
- Handles don't respond to clicks

**Cause**: DOM queries using non-existent `data-id` attribute

**Solution**:
```javascript
// ❌ WRONG
const nodeElement = document.querySelector(`[data-id="${node.id}"]`)

// ✅ CORRECT
const allSectionNodes = document.querySelectorAll('.vue-flow__node-sectionNode')
let nodeElement = null

if (allSectionNodes.length === 1) {
  nodeElement = allSectionNodes[0]
} else {
  nodeElement = document.querySelector('.vue-flow__node-sectionNode.selected')
  if (!nodeElement && allSectionNodes.length > 0) {
    nodeElement = allSectionNodes[0]
  }
}
```

### Issue 4: Only Corner Handles, No Edge Handles

**Symptoms**:
- Can only resize diagonally (corners)
- Cannot resize up/down or left/right only
- No square handles on edges

**Cause**: NodeResizer only provides corner handles by default

**Solution**: Use `NodeResizeControl` for edges

```vue
<template #node-sectionNode="nodeProps">
  <!-- Corner handles -->
  <NodeResizer
    :min-width="200"
    :min-height="150"
  />

  <!-- Edge handles -->
  <NodeResizeControl position="top" />
  <NodeResizeControl position="right" />
  <NodeResizeControl position="bottom" />
  <NodeResizeControl position="left" />

  <SectionNodeSimple :data="nodeProps.data" />
</template>
```

### Issue 5: Cannot Inspect with Browser DevTools

**Symptoms**:
- Right-click doesn't show "Inspect" option
- Context menu is overridden by app
- Cannot use browser DevTools normally

**Cause**: Canvas context menu preventDefault blocks browser menu

**Solution**: Use Playwright MCP for programmatic inspection

```javascript
// In Playwright test or MCP session
await page.evaluate(() => {
  const node = document.querySelector('.vue-flow__node-sectionNode')

  // Inspect structure
  console.log('Classes:', Array.from(node.classList))
  console.log('Attributes:', Array.from(node.attributes).map(a => `${a.name}="${a.value}"`))

  // Check styles
  const style = window.getComputedStyle(node)
  console.log('Opacity:', style.opacity)
  console.log('Visibility:', style.visibility)
  console.log('Pointer Events:', style.pointerEvents)

  // Find children
  console.log('Resize handles:', node.querySelectorAll('.vue-flow__resize-control').length)
})
```

### Issue 6: Resize State Not Persisting

**Symptoms**:
- Resize visually works but dimensions reset on reload
- Pinia store not updating
- Undo/redo doesn't include resize

**Cause**: Missing store update in handleResizeEnd

**Solution**:
```javascript
handleResizeEnd(event) {
  const node = event.node

  if (node && node.id.startsWith('section-')) {
    const sectionId = node.id.replace('section-', '')

    // Update store with undo support
    canvasStore.updateSectionWithUndo(sectionId, {
      position: {
        x: node.position.x,
        y: node.position.y,
        width: event.params.width,
        height: event.params.height
      }
    })

    // Trigger persistence
    await canvasStore.saveToDatabase()
  }
}
```

---

## Performance Considerations {#performance-considerations}

### 1. Debounce Resize Events

```javascript
import { debounce } from 'lodash-es'

const handleResizeDebounced = debounce((event) => {
  // Update store only after user stops resizing
  canvasStore.updateSection(sectionId, newDimensions)
}, 300)

handleResize(event) {
  // Update visual preview immediately
  updatePreview(event.params)

  // Debounce store update
  handleResizeDebounced(event)
}
```

### 2. Minimize Store Updates

```javascript
// ❌ BAD: Update on every pixel change
handleResize(event) {
  canvasStore.updateSection(sectionId, event.params)  // Too frequent!
}

// ✅ GOOD: Update only on resize end
handleResizeEnd(event) {
  canvasStore.updateSectionWithUndo(sectionId, event.params)
}
```

### 3. Efficient Dimension Calculations

```javascript
// Cache calculations
const resizeState = ref({
  isResizing: false,
  startWidth: 0,
  startHeight: 0,
  currentWidth: 0,
  currentHeight: 0
})

handleResize(event) {
  // Use cached start values instead of recalculating
  const deltaWidth = event.params.width - resizeState.value.startWidth
  const deltaHeight = event.params.height - resizeState.value.startHeight

  resizeState.value.currentWidth = resizeState.value.startWidth + deltaWidth
  resizeState.value.currentHeight = resizeState.value.startHeight + deltaHeight
}
```

### 4. Z-Index Management

```javascript
// Don't manipulate z-index directly - use classes
// Vue Flow handles z-index automatically for selection/nesting

// ✅ GOOD: Let Vue Flow manage z-index
<div class="section-node">

// ❌ BAD: Manual z-index manipulation
<div class="section-node" :style="{ zIndex: dynamicZIndex }">
```

---

## Testing Checklist {#testing-checklist}

Use this checklist when implementing or debugging canvas resize functionality:

### Visual Testing
- [ ] Handles are hidden when section is NOT selected
- [ ] Handles become visible when section IS selected
- [ ] 4 corner handles appear (blue circles)
- [ ] 4 edge handles appear if implemented (blue squares)
- [ ] Handles are clickable (cursor changes on hover)
- [ ] Visual feedback during resize (preview)

### Functional Testing
- [ ] Dragging corner handle resizes diagonally
- [ ] Dragging edge handle resizes in one direction
- [ ] Resize respects min-width and min-height
- [ ] Resize respects max-width and max-height
- [ ] Cannot resize smaller than minimum bounds
- [ ] Cannot resize larger than maximum bounds

### Parent-Child Behavior
- [ ] Children DO NOT move when parent resizes (if desired)
- [ ] Children DO move if extent: 'parent' is intended
- [ ] Child positions remain stable visually
- [ ] No children "jump" or "snap" during resize

### State Management
- [ ] Dimensions persist in Pinia canvasStore
- [ ] Resize triggers store update
- [ ] Database saves new dimensions
- [ ] Page reload shows resized dimensions
- [ ] Undo reverts resize operation
- [ ] Redo reapplies resize operation

### Error Handling
- [ ] No console errors during resize
- [ ] No console warnings about DOM mutations
- [ ] No failed store updates
- [ ] No TypeScript errors in DevTools

### Cross-Browser Testing
- [ ] Works in Chrome/Chromium
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge

### Performance
- [ ] Resize feels smooth (60fps)
- [ ] No lag when dragging handles
- [ ] Store updates don't block UI
- [ ] Large canvases remain responsive

---

## Quick Reference Commands

### Debug Current Node
```javascript
// In browser console or Playwright
const node = document.querySelector('.vue-flow__node-sectionNode.selected')
console.log('Node:', node)
console.log('Dimensions:', node.getBoundingClientRect())
console.log('Classes:', Array.from(node.classList))
console.log('Computed Style:', window.getComputedStyle(node))
```

### Check Handle Visibility
```javascript
const handles = document.querySelectorAll('.vue-flow__resize-control.handle')
handles.forEach((handle, i) => {
  const style = window.getComputedStyle(handle)
  console.log(`Handle ${i}:`, {
    opacity: style.opacity,
    visibility: style.visibility,
    pointerEvents: style.pointerEvents
  })
})
```

### Verify Store State
```javascript
// In Vue component or DevTools
import { useCanvasStore } from '@/stores/canvas'
const canvasStore = useCanvasStore()

console.log('Sections:', canvasStore.sections)
console.log('Selected section:', canvasStore.sections.find(s => s.id === 'section-id'))
```

---

## Related Skills

- **`comprehensive-testing`**: Mandatory testing protocols with Playwright
- **`vue-development`**: Vue 3 Composition API patterns
- **`pinia-state-management`**: Store patterns and persistence

---

**Last Updated**: October 23, 2025
**Vue Flow Version**: @vue-flow/core@1.x
**NodeResizer Version**: @vue-flow/node-resizer@1.5.x
