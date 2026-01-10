# Interaction Options Example

Source: https://vueflow.dev/examples/interaction.html

Vue Flow provides granular control over how users can interact with the graph and individual elements.

## Configurable Options

These can be set via props on `<VueFlow />` or reactively through `useVueFlow()`.

| Option | Description |
| :--- | :--- |
| `nodesDraggable` | Enable/disable node dragging globally. |
| `nodesConnectable` | Enable/disable node connection globally. |
| `elementsSelectable` | Enable/disable selection globally. |
| `zoomOnScroll` | Enable/disable zooming with the mouse wheel. |
| `panOnDrag` | Enable/disable panning by dragging the background. |
| `selectionMode` | Set to 'full' or 'partial' for box selection. |

## Dynamic Interaction

You can toggle these options at runtime:

```javascript
const { nodesDraggable, panOnDrag } = useVueFlow()

const toggleDragging = () => {
  nodesDraggable.value = !nodesDraggable.value
}
```
