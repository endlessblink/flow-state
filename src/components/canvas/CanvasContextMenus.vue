<template>
  <!-- Canvas Context Menu -->
  <CanvasContextMenu
    :is-visible="contextMenus.showCanvasContextMenu"
    :x="contextMenus.canvasContextMenuX"
    :y="contextMenus.canvasContextMenuY"
    :has-selected-tasks="canvasStore.selectedNodeIds.length > 0"
    :selected-count="canvasStore.selectedNodeIds.length"
    :context-section="contextMenus.canvasContextSection || undefined"
    @close="contextMenus.closeCanvasContextMenu"
    @create-task-here="$emit('createTaskHere')"
    @create-group="$emit('createGroup')"
    @edit-group="(section) => $emit('editGroup', section)"
    @delete-group="(section) => $emit('deleteGroup', section)"
    @move-to-inbox="$emit('moveToInbox')"
    @delete-tasks="$emit('deleteTasks')"
    @align-left="$emit('alignLeft')"
    @align-right="$emit('alignRight')"
    @align-top="$emit('alignTop')"
    @align-bottom="$emit('alignBottom')"
    @align-center-horizontal="$emit('alignCenterHorizontal')"
    @align-center-vertical="$emit('alignCenterVertical')"
    @distribute-horizontal="$emit('distributeHorizontal')"
    @distribute-vertical="$emit('distributeVertical')"
    @arrange-in-row="$emit('arrangeInRow')"
    @arrange-in-column="$emit('arrangeInColumn')"
    @arrange-in-grid="$emit('arrangeInGrid')"
    @create-task-in-group="(section) => $emit('createTaskInGroup', section)"
    @open-group-settings="(section) => $emit('openGroupSettings', section)"
    @toggle-power-mode="(section) => $emit('togglePowerMode', section)"
    @collect-tasks="(section) => $emit('collectTasks', section)"
  />

  <!-- Edge Context Menu -->
  <EdgeContextMenu
    :is-visible="contextMenus.showEdgeContextMenu"
    :x="contextMenus.edgeContextMenuX"
    :y="contextMenus.edgeContextMenuY"
    @close="contextMenus.closeEdgeContextMenu"
    @disconnect="$emit('disconnectEdge')"
  />

  <!-- Node Context Menu (for sections) -->
  <EdgeContextMenu
    :is-visible="contextMenus.showNodeContextMenu"
    :x="contextMenus.nodeContextMenuX"
    :y="contextMenus.nodeContextMenuY"
    menu-text="Delete Section"
    @close="contextMenus.closeNodeContextMenu"
    @disconnect="$emit('deleteNode')"
  />
</template>

<script setup lang="ts">
import type { CanvasSection } from '@/stores/canvas/types'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasContextMenuStore } from '@/stores/canvas/contextMenus'
import CanvasContextMenu from '@/components/canvas/CanvasContextMenu.vue'
import EdgeContextMenu from '@/components/canvas/EdgeContextMenu.vue'

const canvasStore = useCanvasStore()
const contextMenus = useCanvasContextMenuStore()

defineEmits<{
  (e: 'createTaskHere'): void
  (e: 'createGroup'): void
  (e: 'editGroup', section: CanvasSection): void
  (e: 'deleteGroup', section: CanvasSection): void
  (e: 'moveToInbox'): void
  (e: 'deleteTasks'): void
  (e: 'alignLeft'): void
  (e: 'alignRight'): void
  (e: 'alignTop'): void
  (e: 'alignBottom'): void
  (e: 'alignCenterHorizontal'): void
  (e: 'alignCenterVertical'): void
  (e: 'distributeHorizontal'): void
  (e: 'distributeVertical'): void
  (e: 'arrangeInRow'): void
  (e: 'arrangeInColumn'): void
  (e: 'arrangeInGrid'): void
  (e: 'disconnectEdge'): void
  (e: 'deleteNode'): void
  (e: 'createTaskInGroup', section: CanvasSection): void
  (e: 'openGroupSettings', section: CanvasSection): void
  (e: 'togglePowerMode', section: CanvasSection): void
  (e: 'collectTasks', section: CanvasSection): void
}>()
</script>
