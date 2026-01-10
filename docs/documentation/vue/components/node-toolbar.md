# Node Toolbar Component

Source: https://vueflow.dev/guide/components/node-toolbar.html

The Node Toolbar allows you to attach a floating menu to a specific node, providing contextual actions like "Delete", "Copy", or "Settings" when a user interacts with the node.

## Installation

```bash
npm install @vue-flow/node-toolbar
```

## Usage

The `NodeToolbar` should be placed inside a custom node component.

```vue
<!-- MyCustomNode.vue -->
<script setup>
import { Handle, Position } from '@vue-flow/core'
import { NodeToolbar } from '@vue-flow/node-toolbar'

defineProps(['data'])
</script>

<template>
  <NodeToolbar 
    :is-visible="data.toolbarVisible" 
    :position="data.toolbarPosition"
  >
    <button @click="$emit('delete')">Delete</button>
    <button @click="$emit('copy')">Copy</button>
  </NodeToolbar>

  <div class="node-content">
    {{ data.label }}
  </div>

  <Handle type="target" :position="Position.Left" />
  <Handle type="source" :position="Position.Right" />
</template>
```

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `isVisible` | `boolean` | `undefined` | Forces the toolbar to be visible or hidden. |
| `position` | `Position` | `Position.Top` | Position relative to the node. |
| `offset` | `number` | `10` | Offset from the node boundary. |
| `nodeId` | `string` | `undefined` | ID of the node (automatically injected if inside custom node). |

## Slots
- **default**: The content of the toolbar (buttons, icons, etc.).
