<template>
  <!-- Canvas Context Menu -->
  <CanvasContextMenu
    :is-visible="showCanvasContextMenu"
    :x="canvasContextMenuX"
    :y="canvasContextMenuY"
    :has-selected-tasks="hasSelectedTasks"
    :selected-count="selectedCount"
    :context-section="contextSection"
    @close="$emit('close-canvas-context-menu')"
    @create-task-here="$emit('create-task-here')"
    @create-group="$emit('create-group')"
    @edit-group="(section) => $emit('edit-group', section)"
    @delete-group="(section) => $emit('delete-group', section)"
    @move-to-inbox="$emit('move-to-inbox')"
    @delete-tasks="$emit('delete-tasks')"
    @align-left="$emit('align-left')"
    @align-right="$emit('align-right')"
    @align-top="$emit('align-top')"
    @align-bottom="$emit('align-bottom')"
    @align-center-horizontal="$emit('align-center-horizontal')"
    @align-center-vertical="$emit('align-center-vertical')"
    @distribute-horizontal="$emit('distribute-horizontal')"
    @distribute-vertical="$emit('distribute-vertical')"
    @arrange-in-row="$emit('arrange-in-row')"
    @arrange-in-column="$emit('arrange-in-column')"
    @arrange-in-grid="$emit('arrange-in-grid')"
    @create-task-in-group="(section) => $emit('create-task-in-group', section)"
    @open-group-settings="(section) => $emit('open-group-settings', section)"
    @toggle-power-mode="(section) => $emit('toggle-power-mode', section)"
    @collect-tasks="(section) => $emit('collect-tasks', section)"
  />

  <!-- Edge Context Menu -->
  <EdgeContextMenu
    :is-visible="showEdgeContextMenu"
    :x="edgeContextMenuX"
    :y="edgeContextMenuY"
    @close="$emit('close-edge-context-menu')"
    @disconnect="$emit('disconnect-edge')"
  />

  <!-- Node Context Menu (for sections) -->
  <EdgeContextMenu
    :is-visible="showNodeContextMenu"
    :x="nodeContextMenuX"
    :y="nodeContextMenuY"
    menu-text="Delete Section"
    @close="$emit('close-node-context-menu')"
    @disconnect="$emit('delete-node')"
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
  (e: 'close-canvas-context-menu'): void
  (e: 'create-task-here'): void
  (e: 'create-group'): void
  (e: 'edit-group', section: CanvasSection): void
  (e: 'delete-group', section: CanvasSection): void
  (e: 'move-to-inbox'): void
  (e: 'delete-tasks'): void
  (e: 'align-left'): void
  (e: 'align-right'): void
  (e: 'align-top'): void
  (e: 'align-bottom'): void
  (e: 'align-center-horizontal'): void
  (e: 'align-center-vertical'): void
  (e: 'distribute-horizontal'): void
  (e: 'distribute-vertical'): void
  (e: 'arrange-in-row'): void
  (e: 'arrange-in-column'): void
  (e: 'arrange-in-grid'): void
  (e: 'close-edge-context-menu'): void
  (e: 'disconnect-edge'): void
  (e: 'close-node-context-menu'): void
  (e: 'delete-node'): void
  // TASK-068: New group actions moved from header
  (e: 'create-task-in-group', section: CanvasSection): void
  (e: 'open-group-settings', section: CanvasSection): void
  (e: 'toggle-power-mode', section: CanvasSection): void
  (e: 'collect-tasks', section: CanvasSection): void
}>()
</script>
