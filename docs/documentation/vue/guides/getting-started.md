# Getting Started with Vue Flow

Source: https://vueflow.dev/guide/getting-started.html

## Installation

```bash
npm install @vue-flow/core
```

## Quick Start

Basic setup for a Vue Flow component:

```vue
<script setup>
import { ref } from 'vue'
import { VueFlow } from '@vue-flow/core'

const nodes = ref([
  { id: '1', type: 'input', label: 'Node 1', position: { x: 250, y: 5 } },
  { id: '2', label: 'Node 2', position: { x: 100, y: 100 } },
])

const edges = ref([
  { id: 'e1-2', source: '1', target: '2' },
])
</script>

<template>
  <div style="height: 500px">
    <VueFlow v-model="nodes" :edges="edges" />
  </div>
</template>

<style>
/* Basic styles are included in the package */
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
</style>
```

## Prerequisites

- Vue 3.2.25+
- Vite or other modern bundler recommended

## TypeScript Support

Vue Flow is written in TypeScript and provides full type definitions for all components and composables.
