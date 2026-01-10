# Controls Component

Source: https://vueflow.dev/guide/components/controls.html

The Controls component provides a standard UI panel for common viewport actions like zooming and fitting the view.

## Installation

```bash
npm install @vue-flow/controls
```

## Usage

```vue
<script setup>
import { VueFlow } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/controls/dist/style.css'
</script>

<template>
  <VueFlow>
    <Controls />
  </VueFlow>
</template>
```

## Control Actions
- **Zoom In/Out**: Standard zoom control.
- **Fit View**: Adjusts viewport to show all nodes.
- **Lock/Unlock**: Toggles the interactivity of the canvas.

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `showZoom` | `boolean` | `true` | Show +/- buttons. |
| `showFitView` | `boolean` | `true` | Show fit-view button. |
| `showLock` | `boolean` | `true` | Show lock/unlock button. |
| `position` | `string` | `bottom-left` | Controls position. |

## Customization

You can add custom buttons using the default slot:

```vue
<Controls>
  <ControlButton @click="onCustomAction">
    <MyIcon />
  </ControlButton>
</Controls>
```
