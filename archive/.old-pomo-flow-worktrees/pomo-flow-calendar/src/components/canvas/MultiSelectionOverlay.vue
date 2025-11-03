<template>
  <div class="multi-selection-overlay" v-if="selectionRect">
    <!-- Selection Rectangle -->
    <div
      v-if="selectionRect && isSelecting"
      class="selection-rectangle"
      :style="selectionRectStyle"
    ></div>

    <!-- Selection Handles (for selected nodes) -->
    <div v-if="selectedNodes.length > 0" class="selection-handles">
      <div
        v-for="node in selectedNodes"
        :key="node.id"
        class="node-selection-handle"
        :style="getNodeHandleStyle(node)"
      >
        <div class="handle-corner top-left"></div>
        <div class="handle-corner top-right"></div>
        <div class="handle-corner bottom-left"></div>
        <div class="handle-corner bottom-right"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCanvasStore } from '@/stores/canvas'
import type { Node } from '@vue-flow/core'

interface Props {
  nodes: Node[]
  selectedNodeIds: string[]
}

const props = defineProps<Props>()

const canvasStore = useCanvasStore()

const isSelecting = ref(false)

// Computed properties
const selectionRect = computed(() => canvasStore.selectionRect)

const selectedNodes = computed(() =>
  props.nodes.filter(node => props.selectedNodeIds.includes(node.id))
)

const selectionRectStyle = computed(() => {
  if (!selectionRect.value) return {}

  return {
    left: `${selectionRect.value.x}px`,
    top: `${selectionRect.value.y}px`,
    width: `${selectionRect.value.width}px`,
    height: `${selectionRect.value.height}px`
  }
})

const getNodeHandleStyle = (node: Node) => ({
  left: `${node.position.x - 5}px`,
  top: `${node.position.y - 5}px`,
  width: '210px',
  height: '90px'
})
</script>

<style scoped>
.multi-selection-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1000;
}

.selection-rectangle {
  position: absolute;
  border: 2px solid var(--purple-border-active);
  background: var(--purple-bg-subtle);
  pointer-events: none;
  animation: selectionPulse 1.5s ease-in-out infinite;
}

@keyframes selectionPulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 0.4; }
}

.selection-handles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.node-selection-handle {
  position: absolute;
  border: 2px solid var(--brand-primary);
  border-radius: var(--radius-md);
  pointer-events: none;
  animation: handleGlow 2s ease-in-out infinite;
}

@keyframes handleGlow {
  0%, 100% {
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 1px var(--purple-border-medium);
  }
  50% {
    border-color: var(--brand-primary-light);
    box-shadow: 0 0 0 3px var(--purple-border-subtle);
  }
}

.handle-corner {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--brand-primary);
  border: 2px solid white;
  border-radius: var(--radius-xs);
}

.handle-corner.top-left {
  top: -4px;
  left: -4px;
}

.handle-corner.top-right {
  top: -4px;
  right: -4px;
}

.handle-corner.bottom-left {
  bottom: -4px;
  left: -4px;
}

.handle-corner.bottom-right {
  bottom: -4px;
  right: -4px;
}
</style>
