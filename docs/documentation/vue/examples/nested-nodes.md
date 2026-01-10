# Nested Nodes Example

Source: https://vueflow.dev/examples/nodes/nesting.html

Nested nodes (grouping) allow you to place nodes inside other nodes. The child nodes move with their parent and can be constrained to the parent's boundaries.

## Parent-Child Relationship

Nesting is established using the `parentNode` property on a node object.

```javascript
const nodes = [
  { id: '1', type: 'group', label: 'Parent', position: { x: 0, y: 0 }, style: { width: 200, height: 200 } },
  { id: '2', parentNode: '1', label: 'Child', position: { x: 10, y: 10 }, extent: 'parent' }
]
```

## Key Properties for Nesting

- `parentNode`: ID of the node that acts as the container.
- `extent: 'parent'`: Constrains the child node within the bounds of its parent.
- `expandParent: true`: Automatically increases the parent's size if a child is moved outside its current bounds.

## Use Cases

- Grouping related tasks.
- Logical sections in a flowchart.
- Visual hierarchy of complex data.
