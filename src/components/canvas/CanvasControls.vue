<template>
  <div class="canvas-controls absolute flex flex-col gap-2" style="bottom: 24px; left: 24px; z-index: 10;">
    <!-- Zoom In -->
    <button
      class="control-btn"
      title="Zoom In"
      @click="zoomIn"
    >
      <Plus :size="20" />
    </button>
    <!-- Zoom Out -->
    <button
      class="control-btn"
      title="Zoom Out"
      @click="zoomOut"
    >
      <Minus :size="20" />
    </button>
    <!-- Fit View -->
    <button
      class="control-btn mt-2"
      title="Fit View"
      @click="fitView"
    >
      <Maximize :size="20" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Plus, Minus, Maximize } from 'lucide-vue-next'
import { useVueFlow } from '@vue-flow/core'

const { zoomIn: vueFlowZoomIn, zoomOut: vueFlowZoomOut, fitView: vueFlowFitView } = useVueFlow()

// Using direct Vue Flow controls as they are sufficient for UI buttons
// Complex logic in useCanvasZoom is mainly for performance throttling on scroll/pinch
const zoomIn = () => vueFlowZoomIn({ duration: 300 })
const zoomOut = () => vueFlowZoomOut({ duration: 300 })
const fitView = () => vueFlowFitView({ padding: 0.2, duration: 400 })
</script>

<style scoped>
.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px; /* Rounded square (Figma style) */
  background: rgba(30, 30, 40, 0.85); /* Dark glass */
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
  cursor: pointer;
}

.control-btn:hover {
  background: rgba(40, 40, 50, 0.95);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.control-btn:active {
  transform: translateY(1px);
  background: rgba(20, 20, 30, 0.95);
}
</style>
