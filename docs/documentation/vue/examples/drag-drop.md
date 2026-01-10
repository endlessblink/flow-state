# Drag & Drop Example

Source: https://vueflow.dev/examples/dnd.html

This example demonstrates how to implement dragging external elements onto the Vue Flow canvas to create new nodes.

## Implementation Pattern

1. **Sidebar Elements**: Mark elements as draggable.
2. **Drag Start**: Store the node type in `dataTransfer`.
3. **Drop Handler**:
   - Get drop coordinates from the event.
   - Use `project()` from `useVueFlow` to convert screen coordinates to flow coordinates.
   - Add the new node to the store.

## Key Snippets

```javascript
const { project, addNodes } = useVueFlow()

const onDrop = (event) => {
  const type = event.dataTransfer.getData('application/vueflow')
  
  // Convert position
  const position = project({ 
    x: event.clientX, 
    y: event.clientY - 40 // Offset for header or toolbar
  })

  // Create node
  const newNode = {
    id: nextId(),
    type,
    position,
    label: `${type} node`,
  }

  addNodes([newNode])
}
```
