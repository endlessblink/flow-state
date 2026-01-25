<template>
  <div
    v-if="selectionBox.isVisible"
    class="canvas-selection-box"
    :style="{
      left: `${selectionBox.x}px`,
      top: `${selectionBox.y}px`,
      width: `${selectionBox.width}px`,
      height: `${selectionBox.height}px`
    }"
  />
</template>

<script setup lang="ts">
export interface SelectionBoxState {
  x: number
  y: number
  width: number
  height: number
  isVisible: boolean
}

defineProps<{
  selectionBox: SelectionBoxState
}>()
</script>

<style scoped>
.canvas-selection-box {
  /* BUG-1067: Use absolute positioning relative to canvas container
     instead of fixed positioning to viewport. This fixes coordinate
     offset issues in Tauri where clientX/clientY don't align with
     viewport position. */
  position: absolute;
  z-index: 9999;
  pointer-events: none;
  border: 2px solid rgba(99, 102, 241, 0.8);
  background-color: rgba(99, 102, 241, 0.15);
  border-radius: 4px;
}
</style>
