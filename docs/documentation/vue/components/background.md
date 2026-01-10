# Background Component

Source: https://vueflow.dev/guide/components/background.html

The Background component adds a customizable pattern (dots or lines) to the Vue Flow canvas.

## Installation

```bash
npm install @vue-flow/background
```

## Usage

```vue
<script setup>
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
</script>

<template>
  <VueFlow>
    <Background />
  </VueFlow>
</template>
```

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `variant` | `BackgroundVariant` | `dots` | `dots` or `lines`. |
| `gap` | `number` | `20` | Gap between patterns. |
| `size` | `number` | `1` | Size of dots or thickness of lines. |
| `patternColor` | `string` | `#81818a` | Color of the pattern. |
| `bgColor` | `string` | `none` | Background color of the pane. |
| `height` | `number` | `100%` | Height of the background. |
| `width` | `number` | `100%` | Width of the background. |
| `x` | `number` | `0` | Horizontal offset. |
| `y` | `number` | `0` | Vertical offset. |
