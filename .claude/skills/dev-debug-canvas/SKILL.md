---
name: Debug Canvas Issues
description: DEBUG canvas drag/drop problems, node selection issues, viewport transforms, and mouse event handling. Fix when canvas interactions fail, nodes won't move, selection doesn't work, or viewport is stuck. Use for Vue Flow or custom canvas implementations.
---

# Debug Canvas Issues

## Instructions

### Canvas Debugging Protocol
When canvas interactions aren't working, systematically debug:

#### 1. Mouse Event Issues
- **Check event coordinate systems** (client vs canvas vs viewport)
- **Verify event handlers are attached** to correct elements
- **Debug event propagation** and preventDefault() usage
- **Check element hit detection** boundaries

#### 2. Node Selection Problems
- **Verify selection state** matches UI visual feedback
- **Check multi-selection logic** (Ctrl/Cmd + click)
- **Debug keyboard shortcuts** for selection operations
- **Verify selection persistence** across operations

#### 3. Drag/Drop Failures
- **Check mouse down/move/up event sequence**
- **Verify coordinate transformations** for node positioning
- **Debug drag state management** (isDragging flags)
- **Check viewport transformations** affecting coordinates

## Debug Tools

### Canvas Event Debugger
```typescript
const debugCanvasEvents = (canvasElement) => {
  const logEvent = (e) => {
    console.log(`🖱️ ${e.type}:`, {
      client: { x: e.clientX, y: e.clientY },
      canvas: { x: e.offsetX, y: e.offsetY },
      viewport: transformPoint({ x: e.offsetX, y: e.offsetY }),
      buttons: e.buttons,
      target: e.target.tagName
    })
  }

  ;['mousedown', 'mousemove', 'mouseup', 'click', 'wheel'].forEach(eventType => {
    canvasElement.addEventListener(eventType, logEvent)
  })
}
```

### Selection State Debugger
```typescript
const debugSelection = (canvasStore) => {
  watch(
    () => canvasStore.selectedNodes,
    (selected, oldSelected) => {
      console.group('🎯 Selection changed')
      console.log('From:', oldSelected)
      console.log('To:', selected)

      // Check if selected nodes actually exist
      const availableIds = canvasStore.nodes.map(n => n.id)
      const invalidSelections = selected.filter(id => !availableIds.includes(id))

      if (invalidSelections.length > 0) {
        console.warn('Invalid selections:', invalidSelections)
      }

      console.groupEnd()
    },
    { deep: true }
  )
}
```

### Drag State Debugger
```typescript
const debugDragState = (canvasStore) => {
  const { isDragging, draggedNode, selectedNodes } = storeToRefs(canvasStore)

  watch([isDragging, draggedNode, selectedNodes], ([dragging, dragged, selected]) => {
    console.log(`🖱️ Drag state: ${dragging ? 'dragging' : 'idle'}`)
    console.log(`Dragged node:`, dragged)
    console.log(`Selected count:`, selected.length)

    // Warn about inconsistent states
    if (dragging && !dragged && selected.length === 0) {
      console.warn('Inconsistent drag state: dragging but no node selected')
    }
  })
}
```

### Hit Detection Debugger
```typescript
const debugHitDetection = (node, mousePosition) => {
  const nodeBounds = getNodeBounds(node)
  const isHit = isPointInNode(mousePosition, nodeBounds)

  console.log('🎯 Hit detection:', {
    mouse: mousePosition,
    nodeBounds,
    isHit,
    nodeId: node.id
  })

  return isHit
}
```

This skill activates when you mention canvas interactions, drag/drop problems, node selection issues, Vue Flow debugging, or custom canvas implementation bugs.

---

## Vue Flow Nested Nodes - The Golden Rule

### Core Principle
**Only sync PARENT positions to store. Vue Flow manages children automatically.**

When `parentNode` is set on a Vue Flow node:
- Position is RELATIVE to parent
- When parent drags, Vue Flow auto-moves children visually
- Child position property stays the same (relative)

### The Pattern
```typescript
onNodeDragStop((event) => {
  const { node } = event

  // Only update if this is a parent (no parentNode set)
  if (!node.parentNode) {
    store.updatePosition(node.id, node.position)
  }

  // NEVER update children here!
  // Vue Flow manages them automatically
})
```

### Common Mistakes
- Updating child positions in onNodeDragStop
- Manually calculating child absolute positions after parent drag
- Using syncNodes() to update children after drag
- Fighting Vue Flow's automatic child management

### Debug Checklist for Nested Node Issues
1. Is `parentNode` set correctly on child nodes?
2. Are you updating ONLY parent positions in drag handlers?
3. Is the store position matching Vue Flow position for parents?
4. Are children using relative positions in Vue Flow?

### Position Systems
| Node Type | Store Position | Vue Flow Position | parentNode |
|-----------|---------------|-------------------|------------|
| Parent (Section) | ABSOLUTE | ABSOLUTE | undefined |
| Child (Nested Section) | ABSOLUTE | RELATIVE | parent ID |
| Task | ABSOLUTE | RELATIVE | section ID |

`syncNodes()` handles the absolute→relative conversion automatically.

### References
- Vue Flow Nested Nodes: https://vueflow.dev/examples/nodes/nesting.html
- Position Discussion: https://github.com/bcakmakoglu/vue-flow/discussions/1202
- Node Guide: https://vueflow.dev/guide/node.html