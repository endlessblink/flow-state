# Node Resizer Component

Source: https://vueflow.dev/guide/components/node-resizer.html

The Node Resizer provides visual handles for users to drag and adjust a node's dimensions.

## Installation

```bash
npm install @vue-flow/node-resizer
```

## Usage

Place the `NodeResizer` inside your custom node component.

```vue
<!-- MyResizableNode.vue -->
<script setup>
import { Handle, Position } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css' // IMPORTANT

defineProps(['data'])
</script>

<template>
  <NodeResizer 
    :min-width="100" 
    :min-height="50" 
    :is-visible="data.selected"
  />
  
  <div class="resizable-content">
    {{ data.label }}
  </div>

  <Handle type="source" :position="Position.Bottom" />
</template>
```

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `isVisible` | `boolean` | `true` | Visibility of the resizer handles. |
| `minWidth` | `number` | `10` | Minimum width allowed. |
| `minHeight` | `number` | `10` | Minimum height allowed. |
| `maxWidth` | `number` | `undefined` | Maximum width allowed. |
| `maxHeight` | `number` | `undefined` | Maximum height allowed. |
| `keepAspectRatio` | `boolean` | `false` | Lock the aspect ratio. |
| `handleClassName` | `string` | `''` | Custom class for resizer handles. |
| `lineClassName` | `string` | `''` | Custom class for resizer lines. |

## Emits
- `resizeStart`: Triggered when dragging starts.
- `resize`: Triggered during dragging.
- `resizeEnd`: Triggered when dragging finishes.
