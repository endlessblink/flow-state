# Graph Utilities

Source: https://vueflow.dev/guide/utils/graph.html

Vue Flow provides a set of utility functions to help you query and manipulate the graph structure. These are particularly useful for implementing custom business logic, such as finding connected nodes or calculating boundaries.

## Node & Edge Checks

```typescript
import { isNode, isEdge } from '@vue-flow/core'

if (isNode(element)) {
  // Access node properties
}
```

## Traversing the Graph

### `getIncomers` / `getOutgoers`
Returns the immediate neighbors of a node.

```typescript
const { getIncomers, getOutgoers } = useVueFlow()

const incomingNodes = getIncomers(nodeId)
const outgoingNodes = getOutgoers(nodeId)
```

### `getConnectedEdges`
Returns all edges (both source and target) connected to a specific node.

```typescript
const edges = getConnectedEdges([nodeId])
```

## Spatial Utilities

### `getRectOfNodes`
Calculates the bounding box (rect) for a given set of nodes. Useful for centering or "fit view" operations on a subset of the graph.

```typescript
const rect = getRectOfNodes(nodes)
// returns { x, y, width, height }
```

### `getNodesInside`
Returns all nodes that are contained within a specific rectangle.

```typescript
const nodesInArea = getNodesInside(nodes, { x: 0, y: 0, width: 500, height: 500 })
```

### `getTransformForBounds`
Calculates the viewport transformation (x, y, zoom) required to fit a specific boundary.

```typescript
const transform = getTransformForBounds(
  { x, y, width, height }, 
  width, 
  height, 
  minZoom, 
  maxZoom
)
```

## Edge Management

### `updateEdge`
A helper to modify an existing edge's source or target.

```typescript
const onEdgeUpdate = ({ edge, connection }) => {
  edges.value = updateEdge(edge, connection, edges.value)
}
```
