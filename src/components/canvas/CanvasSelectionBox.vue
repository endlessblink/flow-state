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
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  border: 1px solid var(--accent-primary);
  background-color: rgba(99, 102, 241, 0.1);
}
</style>
