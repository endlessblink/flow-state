# MiniMap Component

Source: https://vueflow.dev/guide/components/minimap.html

The MiniMap provides a zoomed-out overview of the entire graph, allowing for quick navigation in large diagrams.

## Installation

```bash
npm install @vue-flow/minimap
```

## Usage

```vue
<script setup>
import { VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/minimap/dist/style.css'
</script>

<template>
  <VueFlow>
    <MiniMap />
  </VueFlow>
</template>
```

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `nodeColor` | `string \| func` | `#e2e2e2` | Color of nodes in the map. |
| `nodeStrokeColor` | `string \| func` | `none` | Stroke color of nodes. |
| `nodeClassName` | `string \| func` | `''` | Class name for nodes. |
| `nodeBorderRadius` | `number` | `5` | Border radius of nodes. |
| `nodeStrokeWidth` | `number` | `2` | Stroke width of nodes. |
| `maskColor` | `string` | `rgba(240, 240, 240, 0.6)` | Color of the non-visible area. |
| `pannable` | `boolean` | `false` | Allow panning by dragging the map. |
| `zoomable` | `boolean` | `false` | Allow zooming from the map. |

## Slots

You can customize the rendering of nodes in the MiniMap using slots:

```vue
<MiniMap>
  <template #node-custom="{ id, data }">
    <rect :fill="data.color" />
  </template>
</MiniMap>
```
