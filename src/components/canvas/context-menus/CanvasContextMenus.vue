<template>
  <!-- Canvas Context Menu -->
  <CanvasContextMenu
    :is-visible="showCanvasContextMenu"
    :x="canvasContextMenuX"
    :y="canvasContextMenuY"
    :task="selectedTask"
    :section="selectedSection"
    @close="closeCanvasContextMenu"
  />

  <!-- Edge Context Menu -->
  <EdgeContextMenu
    :is-visible="showEdgeContextMenu"
    :x="edgeContextMenuX"
    :y="edgeContextMenuY"
    :edge="selectedEdge"
    @close="closeEdgeContextMenu"
  />

  <!-- Node Context Menu -->
  <NodeContextMenu
    :is-visible="showNodeContextMenu"
    :x="nodeContextMenuX"
    :y="nodeContextMenuY"
    :node="selectedNode"
    @close="closeNodeContextMenu"
  />
</template>

<script setup lang="ts">
import { useCanvasContextMenus } from '@/composables/canvas/useCanvasContextMenus'

// Use the canvas context menus composable
const {
  // State
  showCanvasContextMenu,
  canvasContextMenuX,
  canvasContextMenuY,
  showEdgeContextMenu,
  edgeContextMenuX,
  edgeContextMenuY,
  showNodeContextMenu,
  nodeContextMenuX,
  nodeContextMenuY,
  selectedNode,
  selectedEdge,
  selectedTask,
  selectedSection,

  // Computed
  hasOpenContextMenu,
  openContextMenuCount,

  // Canvas Context Menu methods
  openCanvasContextMenu,
  closeCanvasContextMenu,

  // Edge Context Menu methods
  openEdgeContextMenu,
  closeEdgeContextMenu,

  // Node Context Menu methods
  openNodeContextMenu,
  closeNodeContextMenu,

  // Utility methods
  closeAllContextMenus,
  getCanvasCoordinates
} = useCanvasContextMenus()

// Expose methods to parent component if needed
defineExpose({
  openCanvasContextMenu,
  closeCanvasContextMenu,
  openEdgeContextMenu,
  closeEdgeContextMenu,
  openNodeContextMenu,
  closeNodeContextMenu,
  closeAllContextMenus,
  getCanvasCoordinates,
  hasOpenContextMenu,
  selectedNode,
  selectedEdge,
  selectedTask,
  selectedSection
})
</script>

<style scoped>
/* Context menus are absolutely positioned by their parent components */
</style>