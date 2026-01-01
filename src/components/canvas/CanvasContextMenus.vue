<template>
  <!-- Canvas Context Menu -->
  <CanvasContextMenu
    :is-visible="showCanvasContextMenu"
    :x="canvasContextMenuX"
    :y="canvasContextMenuY"
    :has-selected-tasks="hasSelectedTasks"
    :selected-count="selectedCount"
    :context-section="contextSection"
    @close="$emit('closeCanvasContextMenu')"
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
    :is-visible="showEdgeContextMenu"
    :x="edgeContextMenuX"
    :y="edgeContextMenuY"
    @close="$emit('closeEdgeContextMenu')"
    @disconnect="$emit('disconnectEdge')"
  />

  <!-- Node Context Menu (for sections) -->
  <EdgeContextMenu
    :is-visible="showNodeContextMenu"
    :x="nodeContextMenuX"
    :y="nodeContextMenuY"
    menu-text="Delete Section"
    @close="$emit('closeNodeContextMenu')"
    @disconnect="$emit('deleteNode')"
  />
</template>

<script setup lang="ts">
import type { CanvasSection } from '@/stores/canvas'
import CanvasContextMenu from '@/components/canvas/CanvasContextMenu.vue'
import EdgeContextMenu from '@/components/canvas/EdgeContextMenu.vue'

defineProps<{
  // Canvas Context Menu
  showCanvasContextMenu: boolean
  canvasContextMenuX: number
  canvasContextMenuY: number
  hasSelectedTasks: boolean
  selectedCount: number
  contextSection: CanvasSection | null

  // Edge Context Menu
  showEdgeContextMenu: boolean
  edgeContextMenuX: number
  edgeContextMenuY: number

  // Node Context Menu
  showNodeContextMenu: boolean
  nodeContextMenuX: number
  nodeContextMenuY: number
}>()

defineEmits<{
  (e: 'closeCanvasContextMenu'): void
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
  (e: 'closeEdgeContextMenu'): void
  (e: 'disconnectEdge'): void
  (e: 'closeNodeContextMenu'): void
  (e: 'deleteNode'): void
  // TASK-068: New group actions moved from header
  (e: 'createTaskInGroup', section: CanvasSection): void
  (e: 'openGroupSettings', section: CanvasSection): void
  (e: 'togglePowerMode', section: CanvasSection): void
  (e: 'collectTasks', section: CanvasSection): void
}>()
</script>
