# Composables Guide

Source: https://vueflow.dev/guide/composables.html

Composables are the primary way to interact with Vue Flow's state and logic in your components.

## useVueFlow

The `useVueFlow` composable provides access to the entire Vue Flow store and its methods.

```typescript
import { useVueFlow } from '@vue-flow/core'

const { 
  onInit, 
  findNode, 
  fitView, 
  nodes, 
  edges, 
  onNodeClick 
} = useVueFlow()
```

- **State creation and injection**: The first call to `useVueFlow` creates a new instance of the store and injects it. Subsequent calls within the same component tree access this injected store.
- **Enforcing specific instances**: You can pass an `id` to `useVueFlow({ id: 'my-flow' })` to ensure you're accessing a specific instance.

## useHandleConnections

Provides an array of connections connected to a specific handle.

```typescript
const connections = useHandleConnections({
  type: 'target', // 'source' or 'target'
  nodeId: '1',    // optional, defaults to injected nodeId
  id: 'handle-1'  // optional handle ID
})
```

## useNodeConnections

Provides an array of connections for a specific node, across all its handles.

```typescript
const connections = useNodeConnections({
  handleType: 'source' // or 'target'
})
```

## useNodesData

Accesses data from specific nodes reactively.

```typescript
const data = useNodesData(['1', '2'])
// or with handle connections
const data = useNodesData(() => connections.value.map(c => c.source))
```

## useNodeId

Returns the ID of the current node (must be used inside a custom node component).

```typescript
const nodeId = useNodeId()
```

## useHandle

Create your own custom handle components with custom event handling.

```typescript
const { handlePointerDown, handleClick } = useHandle({
  nodeId: '1',
  type: 'source'
})
```
