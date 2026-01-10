# Edges in Vue Flow

Source: https://vueflow.dev/guide/edge.html

Edges represent the connections between nodes. They can be simple lines or complex components with their own logic and UI.

## Adding Edges

Edges require a unique `id`, a `source` node ID, and a `target` node ID.

```javascript
const edges = ref([
  { id: 'e1-2', source: '1', target: '2', type: 'smoothstep' }
])
```

## Predefined Edge Types
- `default`: Bezier curve (curved).
- `straight`: A simple straight line.
- `step`: Right-angled line with sharp corners.
- `smoothstep`: Right-angled line with rounded corners.

## User-Defined (Custom) Edges

You can create custom edge components to add labels, buttons, or interactive elements.

```vue
<!-- CustomEdge.vue -->
<script setup>
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@vue-flow/core'

const props = defineProps(['sourceX', 'sourceY', 'targetX', 'targetY'])

const path = computed(() => getBezierPath(props))
</script>

<template>
  <BaseEdge :path="path[0]" />
  <EdgeLabelRenderer>
    <div :style="{ transform: `translate(-50%, -50%) translate(${path[1]}px,${path[2]}px)` }">
      Label
    </div>
  </EdgeLabelRenderer>
</template>
```

### Registering Custom Edges

```vue
<template>
  <VueFlow :edges="edges">
    <template #edge-custom="edgeProps">
      <CustomEdge v-bind="edgeProps" />
    </template>
  </VueFlow>
</template>
```

## Edge Events

Listen to interactions specifically on edges.

```javascript
const { onEdgeClick, onEdgeUpdate } = useVueFlow()

onEdgeClick(({ event, edge }) => {
  console.log('Edge clicked', edge.id)
})
```

## Edge Properties (Props)

Custom edges receive detailed properties:
- `sourceX`, `sourceY`: Coordinates of the source handle.
- `targetX`, `targetY`: Coordinates of the target handle.
- `sourcePosition`, `targetPosition`: Side of the node the handle is on.
- `data`: Custom data object attached to the edge.
- `selected`: Boolean indicating if the edge is selected.
