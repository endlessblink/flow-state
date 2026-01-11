<!-- /// <reference types="vite/client" /> -->
<!--
  ⚠️ CRITICAL: Vue Flow Integration Rules - DO NOT VIOLATE

  During refactoring, the following Vue Flow elements MUST NEVER be extracted
  from this component into separate components:

  ❌ DO NOT EXTRACT:
    - v-model:nodes and v-model:edges bindings (lines ~153-154)
    - @node-drag-stop, @connect, @edge-created event handlers (lines ~172-181)
    - VueFlow component itself and its direct children (lines ~151-236)
    - Node/edge calculation and synchronization logic
    - useVueFlow() composable usage and its return values
    - syncNodes() function calls that refresh VueFlow state

  ✅ SAFE TO EXTRACT (these don't depend on Vue Flow):
    - Canvas controls (zoom, pan, toolbar buttons)
    - Modals and overlays
    - Context menus (if they don't depend on VueFlow state)
    - Sidebar panels

  VIOLATION OF THESE RULES WILL BREAK:
    - Drag and drop functionality
    - Node connections and edges
    - State synchronization
    - Canvas viewport controls

  These rules are based on analysis of previous refactoring failures in
  old-pomo-flow-worktrees where Vue Flow extraction caused complete
  breakage of canvas functionality.
-->

<template>
  <div
    class="canvas-layout canvas-contour"
    :class="{ 'shift-selecting': shift }"
  >
    <!-- MAIN CANVAS AREA -->
    <!-- Vue Flow Canvas -->
    <div
      class="canvas-drop-zone relative"
      @drop="handleDrop"
      @dragover.prevent
      @contextmenu.prevent="handleCanvasRightClick"
    >
      
      <!-- Canvas Toolbar - Actions & Filters -->
      <CanvasToolbar
        @addTask="handleAddTask"
        @createGroup="handleToolbarCreateGroup"
      />

      <!-- Loading overlay while canvas initializes -->
      <CanvasLoadingOverlay 
        v-if="!isCanvasReady && !hasNoTasks && tasksWithCanvasPositions && tasksWithCanvasPositions.length > 0"
        message="Loading canvas..."
      />

      <!-- Empty state when no tasks exist -->
      <CanvasEmptyState
        v-if="hasNoTasks"
        @addTask="handleAddTask"
      />

      <!-- Filter Status Indicator -->
      <CanvasStatusBanner 
        :active-status-filter="taskStore.activeStatusFilter"
        @clear-filter="clearStatusFilter"
      />

      <!-- Inbox Sidebar -->
      <UnifiedInboxPanel key="canvas-inbox" context="canvas" />

      <!-- Canvas Container -->
      <div
        class="canvas-container"
        @mousedown.capture="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @click="handleCanvasContainerClick"
      >
          <VueFlow
            ref="vueFlowRef"
            v-model:nodes="nodes"
            v-model:edges="edges"
            :class="{ 'canvas-ready': isCanvasReady }"
            class="vue-flow-container"
            :node-types="nodeTypes"
            edges-focusable
            :elevate-nodes-on-select="false"
            elevate-edges-on-select
            zoom-on-scroll
            :pan-on-scroll="false"
            zoom-on-pinch
            :pan-on-drag="!shift"
            :nodes-draggable="!shift"
            multi-selection-key-code="Shift"
            snap-to-grid
            :snap-grid="[16, 16]"
            :node-extent="dynamicNodeExtent"
            :min-zoom="0.05"
            :max-zoom="4.0"
            :fit-view-on-init="false"
            :connect-on-drag-nodes="false"
            :zoom-scroll-sensitivity="1.0"
            :zoom-activation-key-code="null"
            prevent-scrolling
            :default-viewport="initialViewport"
            dir="ltr"
            @pane-ready="onPaneReady"
            @node-drag-start="handleNodeDragStart"
            @node-drag-stop="handleNodeDragStop"
            @nodes-change="handleNodesChange"
            @selection-change="handleSelectionChange"
            @pane-click="handlePaneClick"
            @pane-context-menu="handlePaneContextMenu"
            @node-context-menu="handleNodeContextMenu"
            @edge-context-menu="handleEdgeContextMenu"
            @connect="handleConnect"
            @keydown="handleKeyDown"
          >
            <CanvasSelectionBox :selection-box="selectionBox" />
            <Background
              pattern-color="#e5e7eb"
              pattern="dots"
              :gap="16"
              :size="1"
            />

            <!-- Section Node Template -->
            <template #node-sectionNode="nodeProps">
              <GroupNodeSimple
                v-memo="[nodeProps.id, nodeProps.data, nodeProps.selected, nodeProps.dragging]"
                :data="nodeProps.data"
                :selected="nodeProps.selected"
                :dragging="nodeProps.dragging"
                @update="(data) => handleSectionUpdate(nodeProps.id, data)"
                @collect="collectTasksForSection"
                @context-menu="handleSectionContextMenu"
                @open-settings="handleOpenSectionSettings"
                @resize-start="handleSectionResizeStart"
                @resize="handleSectionResize"
                @resize-end="handleSectionResizeEnd"
              />
            </template>

            <!-- Custom Task Node Template -->
            <template #node-taskNode="nodeProps">
              <TaskNode
                v-memo="[nodeProps.id, nodeProps.data.task, nodeProps.selected, nodeProps.dragging, canvasStore.multiSelectMode]"
                :task="nodeProps.data.task"
                :is-selected="nodeProps.selected"
                :is-dragging="nodeProps.dragging"
                :multi-select-mode="canvasStore.multiSelectMode"
                :show-priority="canvasStore.showPriorityIndicator"
                :show-status="canvasStore.showStatusBadge"
                :show-duration="canvasStore.showDurationBadge"
                :show-schedule="canvasStore.showScheduleBadge"
                @edit="handleEditTask"
                @select="handleTaskSelect"
                @context-menu="handleTaskContextMenu"
              />
            </template>

            <!-- SVG markers for connection arrows -->
            <svg style="position: absolute; width: 0; height: 0; pointer-events: none;">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                  <polygon points="0 0, 10 3, 0 6" fill="var(--border-secondary)" />
                </marker>
                <marker id="arrowhead-hover" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                  <polygon points="0 0, 10 3, 0 6" fill="var(--color-navigation)" />
                </marker>
              </defs>
            </svg>
          </VueFlow>

          <CanvasLoadingOverlay
            v-if="!isCanvasReady"
            message="Initializing Canvas..."
          />
      </div>
    </div>

    <!-- Modals -->
    <CanvasModals
      @handle-quick-task-create="handleQuickTaskCreate"
      @handle-batch-edit-applied="handleBatchEditApplied"
      @handle-section-settings-save="handleSectionSettingsSave"
      @handle-group-created="handleGroupCreated"
      @handle-group-updated="handleGroupUpdated"
      @handle-group-edit-save="handleGroupEditSave"
      @confirm-delete-group="confirmDeleteGroup"
      @confirm-bulk-delete="confirmBulkDelete"
    />

    <CanvasContextMenus
      @create-task-here="createTaskHere"
      @create-group="createGroup"
      @edit-group="editGroup"
      @delete-group="deleteGroup"
      @move-to-inbox="moveSelectedTasksToInbox"
      @delete-tasks="deleteSelectedTasks"
      @align-left="alignLeft"
      @align-right="alignRight"
      @align-top="alignTop"
      @align-bottom="alignBottom"
      @align-center-horizontal="alignCenterHorizontal"
      @align-center-vertical="alignCenterVertical"
      @distribute-horizontal="distributeHorizontal"
      @distribute-vertical="distributeVertical"
      @arrange-in-row="arrangeInRow"
      @arrange-in-column="arrangeInColumn"
      @arrange-in-grid="arrangeInGrid"
      @create-task-in-group="createTaskInGroup"
      @open-group-settings="handleOpenSectionSettingsFromContext"
      @toggle-power-mode="handleToggleFocusMode"
      @collect-tasks="handleCollectTasksFromMenu"
      @disconnect-edge="disconnectEdge"
      @delete-node="deleteNode"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw } from 'vue'
import { VueFlow, type EdgeMouseEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import '@vue-flow/node-resizer/dist/style.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '../assets/vue-flow-overrides.css'

import { useTaskStore } from '../stores/tasks'
import { useCanvasStore } from '../stores/canvas'
import { useUIStore } from '../stores/ui'

import TaskNode from '../components/canvas/TaskNode.vue'
import GroupNodeSimple from '../components/canvas/GroupNodeSimple.vue'
import UnifiedInboxPanel from '../components/inbox/UnifiedInboxPanel.vue'
import CanvasModals from '../components/canvas/CanvasModals.vue'
import CanvasEmptyState from '../components/canvas/CanvasEmptyState.vue'
import CanvasContextMenus from '../components/canvas/CanvasContextMenus.vue'
import CanvasToolbar from '../components/canvas/CanvasToolbar.vue'
import CanvasStatusBanner from '../components/canvas/CanvasStatusBanner.vue'
import CanvasLoadingOverlay from '../components/canvas/CanvasLoadingOverlay.vue'
import CanvasSelectionBox from '../components/canvas/CanvasSelectionBox.vue'

import { useCanvasOrchestrator } from '../composables/canvas/useCanvasOrchestrator'
import { useCanvasSelection } from '../composables/canvas/useCanvasSelection'
import { useCanvasAlignment } from '../composables/canvas/useCanvasAlignment'
import { useCanvasOverdueCollector } from '../composables/canvas/useCanvasOverdueCollector'
import { useCanvasConnections } from '../composables/canvas/useCanvasConnections'

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const uiStore = useUIStore()

// Register custom node types
// Register custom node types
const nodeTypes: Record<string, any> = {
  taskNode: markRaw(TaskNode),
  sectionNode: markRaw(GroupNodeSimple)
}

// Initialize Orchestrator
const orchestrator = useCanvasOrchestrator()
const {
  nodes, edges, isCanvasReady, initialViewport, shift, vueFlowRef,
  tasksWithCanvasPosition, dynamicNodeExtent, hasNoTasks,
  handleNodeDragStart, handleNodeDragStop, handleKeyDown,
  handleSectionResizeStart, handleSectionResize, handleSectionResizeEnd,
  onPaneReady, fitCanvas, zoomToSelection, retryFailedOperation,
  handlePaneClick, handleCanvasRightClick, handlePaneContextMenu, handleDrop,
  showCanvasContextMenu, canvasContextMenuX, canvasContextMenuY, canvasContextSection,
  showNodeContextMenu, nodeContextMenuX, nodeContextMenuY,
  showEdgeContextMenu, edgeContextMenuX, edgeContextMenuY,
  closeCanvasContextMenu, createTaskHere, createGroup, editGroup, deleteGroup,
  moveSelectedTasksToInbox, deleteSelectedTasks, createTaskInGroup,
  closeEdgeContextMenu, closeNodeContextMenu, deleteNode,
  isEditModalOpen, selectedTask, isQuickTaskCreateOpen, isBatchEditModalOpen,
  batchEditTaskIds, isSectionSettingsOpen, editingSection, isGroupModalOpen,
  selectedGroup, groupModalPosition, isGroupEditModalOpen, selectedSectionForEdit,
  isDeleteGroupModalOpen, deleteGroupMessage, isBulkDeleteModalOpen,
  bulkDeleteTitle, bulkDeleteMessage, bulkDeleteItems, bulkDeleteIsPermanent,
  closeEditModal, closeQuickTaskCreate, handleQuickTaskCreate, closeBatchEditModal,
  handleBatchEditApplied, closeSectionSettingsModal, handleSectionSettingsSave,
  closeGroupModal, handleGroupCreated, handleGroupUpdated, closeGroupEditModal,
  handleGroupEditSave, confirmDeleteGroup, cancelDeleteGroup, confirmBulkDelete,
  cancelBulkDelete, handleConnect, handleEdgesChange, handleNodesChange,
  handleNodeContextMenu, handleEdgeContextMenu,
  
  // From consolidated features
  selectionBox, handleMouseDown, handleMouseMove, handleMouseUp, handleCanvasContainerClick, handleTaskSelect,
  alignLeft, alignRight, alignTop, alignBottom, alignCenterHorizontal, alignCenterVertical, 
  distributeHorizontal, distributeVertical, arrangeInRow, arrangeInColumn, arrangeInGrid,
  collectTasksForSection, autoCollectOverdueTasks: handleCollectTasksFromMenu, disconnectEdge
} = orchestrator

// Aliases for template compatibility
const tasksWithCanvasPositions = tasksWithCanvasPosition
const handleToolbarCreateGroup = createGroup
const handleAddTask = () => createTaskHere()
const clearStatusFilter = () => { taskStore.activeStatusFilter = null }
const handleSelectionChange = (params: any) => {
  if (params) canvasStore.selectedNodeIds = params.nodes.map((n: any) => n.id)
}

// UI Wrappers
const handleOpenSectionSettings = (id: string) => {
    const section = canvasStore.groups.find(g => g.id === id)
    if (section) { editingSection.value = section; isSectionSettingsOpen.value = true }
}
const handleOpenSectionSettingsFromContext = () => {
    if (canvasContextSection.value) handleOpenSectionSettings(canvasContextSection.value.id)
}
const handleToggleFocusMode = () => uiStore.toggleFocusMode()
const handleSectionUpdate = (id: string, data: any) => canvasStore.updateSection(id, data)
const handleEditTask = (task: any) => { selectedTask.value = task; isEditModalOpen.value = true; closeCanvasContextMenu() }
const handleTaskContextMenu = (event: MouseEvent, task: any) => {
    if (event) event.preventDefault()
    // Dispatch global event for ModalManager to handle (shared TaskContextMenu)
    window.dispatchEvent(new CustomEvent('task-context-menu', {
        detail: { event, task }
    }))
}

const handleSectionContextMenu = (event: MouseEvent, section: any) => {
    if (event) event.preventDefault()
    // Open Canvas Context Menu with section context
    // We need to pass the raw section object, relying on orchestrator/store
    canvasStore.updateSection(section.id, { ...section }) // Ensure store is fresh?
    
    // Position menu
    canvasContextMenuX.value = event.clientX
    canvasContextMenuY.value = event.clientY
    canvasContextSection.value = section
    showCanvasContextMenu.value = true
}
</script>

<style scoped src="@/assets/canvas-view-layout.css"></style>
<style src="@/assets/canvas-view-overrides.css"></style>
