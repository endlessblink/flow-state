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
  old-flow-state-worktrees where Vue Flow extraction caused complete
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
      <!-- Loading overlay while canvas initializes -->
      <CanvasLoadingOverlay 
        v-if="!isCanvasReady && !hasNoTasks && tasksWithCanvasPositions && tasksWithCanvasPositions.length > 0"
        message="Loading canvas..."
      />

      <!-- Empty state when no tasks exist -->
      <CanvasEmptyState
        v-if="hasNoTasks"
        @add-task="handleAddTask"
        @create-group="createGroup()"
      />

      <!-- Filter Status Indicator -->
      <CanvasStatusBanner 
        :active-status-filter="taskStore.activeStatusFilter"
        @clear-filter="clearStatusFilter"
      />

      <!-- Inbox Sidebar -->
      <UnifiedInboxPanel key="canvas-inbox" context="canvas" />

      <!-- Canvas Toolbar - Actions & Filters (MUST be after InboxPanel for z-index stacking) -->
      <CanvasToolbar
        @add-task="handleAddTask"
        @create-group="handleToolbarCreateGroup"
      />

      <!-- Canvas Container -->
      <div
        class="canvas-container"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @click="handleCanvasContainerClick"
      >
        <VueFlow
          ref="vueFlowRef"
          :nodes="nodes"
          :edges="edges"
          :class="{ 'canvas-ready': isCanvasReady }"
          class="vue-flow-container"
          :node-types="nodeTypes"
          edges-focusable
          :elevate-nodes-on-select="false"
          elevate-edges-on-select
          zoom-on-scroll
          :pan-on-scroll="false"
          zoom-on-pinch
          :pan-on-drag="!shift && !control && !meta"
          :nodes-draggable="!control && !meta && !shift"
          :selection-on-drag="shift"
          :multi-selection-key-code="['Control', 'Meta', 'Shift']"
          snap-to-grid
          :snap-grid="[16, 16]"
          :node-extent="dynamicNodeExtent"
          :min-zoom="0.05"
          :max-zoom="4.0"
          :fit-view-on-init="false"
          connect-on-drag-nodes
          :zoom-scroll-sensitivity="1.0"
          :zoom-activation-key-code="null"
          prevent-scrolling
          :default-viewport="initialViewport"
          dir="ltr"
          @pane-ready="onPaneReady"
          @node-click="handleNodeClick"
          @node-double-click="handleNodeDoubleClick"
          @node-drag-start="handleNodeDragStart"
          @node-drag="handleNodeDrag"
          @node-drag-stop="handleNodeDragStop"
          @nodes-change="handleNodesChange"
          @edges-change="handleEdgesChange"
          @selection-change="handleSelectionChange"
          @pane-click="handlePaneClick"
          @pane-context-menu="handlePaneContextMenu"
          @node-context-menu="handleNodeContextMenu"
          @edge-context-menu="handleEdgeContextMenu"
          @edge-double-click="handleEdgeDoubleClick"
          @connect="handleConnect"
          @connect-start="handleConnectStart"
          @connect-end="handleConnectEnd"
          @keydown="handleKeyDown"
        >
          <Background
            pattern-color="#e5e7eb"
            pattern="dots"
            :gap="16"
            :size="1"
          />

          <!-- Section Node Template -->
          <template #node-sectionNode="nodeProps">
            <GroupNodeSimple
              :id="nodeProps.id"
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
          <!-- TASK-262: Using onSelect callback prop instead of @select emit -->
          <!-- Vue's emit system doesn't work reliably in Vue Flow custom nodes -->
          <!-- TASK-279: Using editCallback prop instead of @edit emit -->
          <!-- Vue's emit system doesn't work reliably in Vue Flow custom nodes -->
          <template #node-taskNode="nodeProps">
            <TaskNode
              :task="nodeProps.data.task"
              :is-selected="nodeProps.selected"
              :is-dragging="nodeProps.dragging"
              :multi-select-mode="canvasStore.multiSelectMode"
              :show-priority="canvasStore.showPriorityIndicator"
              :show-status="canvasStore.showStatusBadge"
              :show-duration="canvasStore.showDurationBadge"
              :show-schedule="canvasStore.showScheduleBadge"
              :select-callback="handleTaskSelect"
              :edit-callback="handleEditTask"
              @edit="handleEditTask"
              @select="handleTaskSelect"
              @context-menu="handleTaskContextMenu"
            />
          </template>

          <!-- SVG markers for connection arrows -->
          <svg style="position: absolute; width: 0; height: 0; pointer-events: none;">
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 10 3, 0 6" fill="var(--border-secondary)" />
              </marker>
              <marker
                id="arrowhead-hover"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 10 3, 0 6" fill="var(--color-navigation)" />
              </marker>
            </defs>
          </svg>
        </VueFlow>

        <!-- Selection box outside VueFlow to avoid transform issues -->
        <CanvasSelectionBox :selection-box="selectionBox" />

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
      @done-for-now="doneForNowSelectedTasks"
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
      @create-task-in-group="handleCreateTaskInGroupDebug"
      @open-group-settings="handleOpenSectionSettingsFromContext"
      @toggle-power-mode="handleToggleFocusMode"
      @collect-tasks="handleCollectTasksFromMenu"
      @disconnect-edge="disconnectEdge"
      @delete-node="deleteNode"
    />
  </div>
</template>

<script setup lang="ts">
import { markRaw } from 'vue'
import { VueFlow, type NodeMouseEvent, type NodeTypes } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import '@vue-flow/node-resizer/dist/style.css'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '../assets/vue-flow-overrides.css'
import { useEventListener } from '@vueuse/core'

import { useTaskStore } from '../stores/tasks'
import { useCanvasStore } from '../stores/canvas'
import { useUIStore } from '../stores/ui'
import { useCanvasContextMenuStore } from '../stores/canvas/contextMenus'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'

import TaskNode from '../components/canvas/TaskNode.vue'
import GroupNodeSimple from '../components/canvas/GroupNodeSimple.vue'
import UnifiedInboxPanel from '../components/inbox/UnifiedInboxPanel.vue'
import CanvasModals from '../components/canvas/CanvasModals.vue'
import CanvasEmptyState from '../components/canvas/CanvasEmptyState.vue'
import CanvasContextMenus from '../components/canvas/CanvasContextMenus.vue'

import { useCanvasModalsStore } from '@/stores/canvas/modals'
import CanvasToolbar from '../components/canvas/CanvasToolbar.vue'
import CanvasStatusBanner from '../components/canvas/CanvasStatusBanner.vue'
import CanvasLoadingOverlay from '../components/canvas/CanvasLoadingOverlay.vue'
import CanvasSelectionBox from '../components/canvas/CanvasSelectionBox.vue'

import { useCanvasContextMenus } from '@/composables/canvas/useCanvasContextMenus'
import { useCanvasOrchestrator } from '../composables/canvas/useCanvasOrchestrator'

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const uiStore = useUIStore()
const modalsStore = useCanvasModalsStore()
const contextMenuStore = useCanvasContextMenuStore()

// Register custom node types
const nodeTypes: NodeTypes = {
  taskNode: markRaw(TaskNode),
  sectionNode: markRaw(GroupNodeSimple)
}

// Initialize Orchestrator
const orchestrator = useCanvasOrchestrator()
const {
  nodes, edges, isCanvasReady, initialViewport, shift, control, meta, vueFlowRef,
  tasksWithCanvasPosition, dynamicNodeExtent, hasNoTasks,
  handleNodeDragStart, handleNodeDrag, handleNodeDragStop, handleKeyDown,
  handleSectionResizeStart, handleSectionResize, handleSectionResizeEnd,
  onPaneReady,
  handlePaneClick, handleCanvasRightClick, handlePaneContextMenu, handleDrop,
  // BUG-208: Canvas context menu state now comes from contextMenuStore, not orchestrator
  createTaskHere, createGroup, editGroup, deleteGroup,
  moveSelectedTasksToInbox, doneForNowSelectedTasks, deleteSelectedTasks, createTaskInGroup,
  deleteNode,
  isSectionSettingsOpen, editingSection,
  handleQuickTaskCreate,
  handleBatchEditApplied, handleSectionSettingsSave,
  handleGroupCreated, handleGroupUpdated,
  handleGroupEditSave, confirmDeleteGroup, confirmBulkDelete, handleConnect, handleConnectStart, handleConnectEnd,
  handleEdgesChange, handleNodesChange,
  handleNodeContextMenu, handleEdgeContextMenu, handleEdgeDoubleClick,
  handleNodeClick, handleSelectionChange,
  
  // From consolidated features
  selectionBox, handleMouseDown, handleMouseMove, handleMouseUp, handleCanvasContainerClick, handleTaskSelect,
  alignLeft, alignRight, alignTop, alignBottom, alignCenterHorizontal, alignCenterVertical,
  distributeHorizontal, distributeVertical, arrangeInRow, arrangeInColumn, arrangeInGrid,
  collectTasksForSection, autoCollectOverdueTasks: handleCollectTasksFromMenu, disconnectEdge
} = orchestrator

// Register global hotkeys
useEventListener(window, 'keydown', (e) => {
  // Only handle if canvas is active/visible
  handleKeyDown(e)
})

// Aliases for template compatibility
const tasksWithCanvasPositions = tasksWithCanvasPosition
const handleToolbarCreateGroup = createGroup
const handleAddTask = () => createTaskHere()
const clearStatusFilter = () => { taskStore.activeStatusFilter = null }
// UI Wrappers
const handleOpenSectionSettings = (id: string) => {
    const section = canvasStore.groups.find(g => g.id === id)
    if (section) { editingSection.value = section; isSectionSettingsOpen.value = true }
}
const handleOpenSectionSettingsFromContext = () => {
    // BUG-208: Use store for context menu state
    if (contextMenuStore.canvasContextSection) handleOpenSectionSettings(contextMenuStore.canvasContextSection.id)
}
const handleToggleFocusMode = () => uiStore.toggleFocusMode()

// TASK-288 DEBUG: Wrapper to trace createTaskInGroup call
const handleCreateTaskInGroupDebug = (section: CanvasGroup) => {
  // Get context menu position from store directly
  const menuX = contextMenuStore.canvasContextMenuX
  const menuY = contextMenuStore.canvasContextMenuY

  console.log('🔴 [CANVASVIEW] handleCreateTaskInGroupDebug called!', {
    sectionId: section?.id,
    sectionName: section?.name,
    contextMenuX: menuX,
    contextMenuY: menuY,
    createTaskInGroupType: typeof createTaskInGroup,
    createTaskInGroupFn: createTaskInGroup?.toString?.().slice(0, 100)
  })
  createTaskInGroup(section)
}

const handleSectionUpdate = (id: string, data: Record<string, unknown>) => canvasStore.updateSection(id, data)
const { closeAllContextMenus: closeCanvasContextMenu } = useCanvasContextMenus()
const handleEditTask = (task: Task) => { modalsStore.openEditModal(task); closeCanvasContextMenu() }
// Handle double-click on nodes to open edit modal for tasks
const handleNodeDoubleClick = ({ node }: NodeMouseEvent) => {
    console.log('[TASK-279] handleNodeDoubleClick called', { nodeType: node.type, hasTask: !!node.data?.task })
    // Only handle task nodes, not group nodes
    if (node.type === 'taskNode' && node.data?.task) {
        console.log('[TASK-279] Opening edit modal for task', node.data.task.id)
        handleEditTask(node.data.task)
    }
}
const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
    if (event) event.preventDefault()
    // Dispatch global event for ModalManager to handle (shared TaskContextMenu)
    window.dispatchEvent(new CustomEvent('task-context-menu', {
        detail: { event, task }
    }))
}

const handleSectionContextMenu = (event: MouseEvent, section: CanvasGroup) => {
    console.debug('[BUG-251] handleSectionContextMenu called', {
        sectionId: section?.id,
        sectionName: section?.name,
        eventType: event?.type
    })
    if (event) {
        event.preventDefault()
        event.stopPropagation() // STOP PROPAGATION to prevent pane menu
    }
    // BUG-208 FIX: Use Pinia store instead of local refs
    // CanvasContextMenus.vue reads from the store, so we must write to it
    contextMenuStore.openCanvasContextMenu(event.clientX, event.clientY, section as unknown as CanvasGroup)
}

// Expose for testing purposes (Fundamental Stability)
if (process.env.NODE_ENV === 'development' || (window as unknown as Record<string, unknown>).PLAYWRIGHT_TEST) {
  (window as unknown as Record<string, unknown>).__POMO_FLOW_DEBUG__ = {
    orchestrator,
    canvasStore,
    taskStore,
    uiStore,
    // Debug Access to Singletons
    get positionManager() { return import('../services/canvas/PositionManager').then(m => m.positionManager) },
    get lockManager() { return import('../services/canvas/LockManager').then(m => m.lockManager) }
  }
}
</script>

<style scoped src="@/assets/canvas-view-layout.css"></style>

<style src="@/assets/canvas-view-overrides.css"></style>
