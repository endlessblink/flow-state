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

      <!-- FEATURE-1048: Day group rotation banner (shown after midnight auto-update) -->
      <DayRotationBanner
        :show-banner="dayRotation.showBanner.value"
        :rotated-groups-count="dayRotation.rotatedGroupsCount.value"
        @dismiss="dayRotation.dismissBanner()"
      />

      <!-- Inbox Sidebar -->
      <UnifiedInboxPanel key="canvas-inbox" context="canvas" />

      <!-- Canvas Toolbar - Actions & Filters (MUST be after InboxPanel for z-index stacking) -->
      <CanvasToolbar
        @add-task="handleAddTask"
        @create-group="handleToolbarCreateGroup"
        @rotate-day-groups="handleRotateDayGroups"
      />

      <!-- Canvas Container -->
      <!-- TASK-1722: tabindex="0" makes this div focusable so @keydown receives Delete key.
           Vue Flow's node wrappers steal focus on click (tabindex=0 on node div),
           so @keydown on VueFlow never fires. This wrapper catches it instead. -->
      <div
        ref="canvasContainerRef"
        class="canvas-container"
        tabindex="0"
        @keydown="handleKeyDown"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @click="handleCanvasContainerClick"
      >
        <!-- BUG-1216: virtualization disabled — mount/unmount during pan causes sluggishness.
             For typical canvas sizes (<100 nodes), keeping all nodes in DOM is faster. -->
        <VueFlow
          ref="vueFlowRef"
          :nodes="nodes"
          :edges="edges"
          :apply-default="false"
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
          connection-mode="loose"
          :connection-radius="30"
          :zoom-scroll-sensitivity="1.0"
          :zoom-activation-key-code="null"
          :delete-key-code="false"
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



          <!-- Image Node Template (TASK-1690) -->
          <template #node-imageNode="nodeProps">
            <ImageNode :data="nodeProps.data" :selected="nodeProps.selected" />
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

        <!-- TASK-1690: Simple image node context menu -->
        <Teleport to="body">
          <div
            v-if="imageContextMenu.show"
            class="image-context-menu"
            :style="{ left: imageContextMenu.x + 'px', top: imageContextMenu.y + 'px' }"
            @click.stop
          >
            <button class="image-context-menu-item danger" @click="deleteImageFromContextMenu">
              Delete Image
            </button>
          </div>
          <div
            v-if="imageContextMenu.show"
            class="image-context-menu-backdrop"
            @click="imageContextMenu.show = false"
            @contextmenu.prevent="imageContextMenu.show = false"
          />
        </Teleport>
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
      @collect-overdue-tasks="handleCollectOverdueFromMenu"
      @disconnect-edge="disconnectEdge"
      @delete-node="deleteNode"
      @create-group-from-selection="createGroupFromSelection"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, markRaw, onMounted, onUnmounted } from 'vue'
import { VueFlow, useVueFlow, type NodeMouseEvent } from '@vue-flow/core'
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
import { getViewportCoordinates } from '@/utils/contextMenuCoordinates'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'

import TaskNode from '../components/canvas/TaskNode.vue'
import GroupNodeSimple from '../components/canvas/GroupNodeSimple.vue'
import ImageNode from '../components/canvas/ImageNode.vue'
import UnifiedInboxPanel from '../components/inbox/UnifiedInboxPanel.vue'
import CanvasModals from '../components/canvas/CanvasModals.vue'
import CanvasEmptyState from '../components/canvas/CanvasEmptyState.vue'
import CanvasContextMenus from '../components/canvas/CanvasContextMenus.vue'

import { useCanvasModalsStore } from '@/stores/canvas/modals'
import CanvasToolbar from '../components/canvas/CanvasToolbar.vue'
import CanvasStatusBanner from '../components/canvas/CanvasStatusBanner.vue'
import CanvasLoadingOverlay from '../components/canvas/CanvasLoadingOverlay.vue'
import CanvasSelectionBox from '../components/canvas/CanvasSelectionBox.vue'
import DayRotationBanner from '../components/canvas/DayRotationBanner.vue'

import { useCanvasContextMenus } from '@/composables/canvas/useCanvasContextMenus'
import { useCanvasOrchestrator } from '../composables/canvas/useCanvasOrchestrator'
import { useDayGroupRotation } from '@/composables/canvas/useDayGroupRotation'
import { useCanvasImagesStore } from '@/stores/canvasImages'
import { useAuthStore } from '@/stores/auth'
import { getClipboardImage, compressImage, uploadCanvasImage } from '@/services/canvasImageUpload'

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const uiStore = useUIStore()
const modalsStore = useCanvasModalsStore()
const contextMenuStore = useCanvasContextMenuStore()

// Register custom node types
const nodeTypes = {
  taskNode: markRaw(TaskNode),
  sectionNode: markRaw(GroupNodeSimple),
  imageNode: markRaw(ImageNode),
}

// FEATURE-1048: Day group auto-rotation at midnight
const { updateNode, findNode } = useVueFlow()

function applyDayGroupMoves(moves: Array<{ nodeId: string; position: { x: number; y: number } }>) {
  console.log('[DAY-ROTATION:VF] Applying', moves.length, 'moves')
  for (const move of moves) {
    const before = findNode(move.nodeId)
    console.log(`[DAY-ROTATION:VF] ${move.nodeId}: found=${!!before}, before=${JSON.stringify(before?.position)}, target=${JSON.stringify(move.position)}`)
    updateNode(move.nodeId, { position: move.position })
    const after = findNode(move.nodeId)
    console.log(`[DAY-ROTATION:VF] ${move.nodeId}: after=${JSON.stringify(after?.position)}`)
  }
}

const dayRotation = useDayGroupRotation({
  onMoves: applyDayGroupMoves,
  getNodePosition: (nodeId: string) => {
    const node = findNode(nodeId)
    return node ? { x: node.position.x, y: node.position.y } : undefined
  }
})

function handleRotateDayGroups() {
  dayRotation.rotateDayGroups()
  const moves = dayRotation.rotateDayGroupPositions()
  applyDayGroupMoves(moves)
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
  deleteNode, createGroupFromSelection,
  isSectionSettingsOpen, editingSection,
  handleQuickTaskCreate,
  handleBatchEditApplied, handleSectionSettingsSave,
  handleGroupCreated, handleGroupUpdated,
  handleGroupEditSave, confirmDeleteGroup, confirmBulkDelete, handleConnect, handleConnectStart, handleConnectEnd,
  handleEdgesChange, handleNodesChange,
  handleNodeContextMenu, handleEdgeContextMenu, handleEdgeDoubleClick,
  handleNodeClick, handleSelectionChange,
  screenToFlowCoordinate,

  // From consolidated features
  selectionBox, handleMouseDown, handleMouseMove, handleMouseUp, handleCanvasContainerClick, handleTaskSelect,
  alignLeft, alignRight, alignTop, alignBottom, alignCenterHorizontal, alignCenterVertical,
  distributeHorizontal, distributeVertical, arrangeInRow, arrangeInColumn, arrangeInGrid,
  collectTasksForSection, autoCollectOverdueTasks: handleCollectTasksFromMenu, collectOverdueTasksNearGroup, disconnectEdge
} = orchestrator

// TASK-1722: Focusable canvas container ref for keyboard event handling
const canvasContainerRef = ref<HTMLElement | null>(null)

// TASK-1722: Register ALL hotkeys globally — canvas-container @keydown doesn't reliably
// receive events because VueFlow node wrappers steal focus on drag/click.
useEventListener(window, 'keydown', (e) => {
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

// TASK-1222: Collect overdue tasks near a group
const handleCollectOverdueFromMenu = (section: CanvasGroup) => {
  collectOverdueTasksNearGroup(section.id)
}

// TASK-1222: Listen for AI tool collect-overdue-tasks events
useEventListener(window, 'collect-overdue-tasks', (e: Event) => {
  const detail = (e as CustomEvent).detail
  if (detail?.groupId) {
    collectOverdueTasksNearGroup(detail.groupId)
  }
})

// Sidebar quick-add on canvas view: create task at viewport center
useEventListener(window, 'sidebar-quick-task-create', async (e: Event) => {
  const data = (e as CustomEvent).detail
  if (!data?.title) return

  // Calculate viewport center in flow coordinates
  const vueFlowElement = document.querySelector('.vue-flow')
  if (vueFlowElement) {
    const rect = vueFlowElement.getBoundingClientRect()
    const screenCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
    const flowCoords = screenToFlowCoordinate(screenCenter)
    modalsStore.quickTaskPosition = flowCoords
  } else {
    modalsStore.quickTaskPosition = { x: 200, y: 200 }
  }

  await handleQuickTaskCreate(data)
})

// TASK-288 DEBUG: Wrapper to trace createTaskInGroup call
const handleCreateTaskInGroupDebug = (section: CanvasGroup) => {
  // Get context menu position from store directly
  // Get context menu position from store directly
  // const menuX = contextMenuStore.canvasContextMenuX
  // const menuY = contextMenuStore.canvasContextMenuY

  createTaskInGroup(section)
}

const handleSectionUpdate = (id: string, data: Record<string, unknown>) => canvasStore.updateSection(id, data)
const { closeAllContextMenus: closeCanvasContextMenu } = useCanvasContextMenus()
const handleEditTask = (task: Task) => { modalsStore.openEditModal(task); closeCanvasContextMenu() }
// Handle double-click on nodes to open edit modal for tasks
const handleNodeDoubleClick = ({ node }: NodeMouseEvent) => {
    if (node.type === 'taskNode' && node.data?.task) {
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
    if (event) {
        event.preventDefault()
        event.stopPropagation() // STOP PROPAGATION to prevent pane menu
    }
    // BUG-208 FIX: Use Pinia store instead of local refs
    // CanvasContextMenus.vue reads from the store, so we must write to it
    // BUG-1096: Use normalized coordinates for Tauri compatibility
    const { x, y } = getViewportCoordinates(event)
    contextMenuStore.openCanvasContextMenu(x, y, section as unknown as CanvasGroup)
}

// ============================================================================
// TASK-1690: Canvas Image Features (paste, context menu, delete)
// ============================================================================
const canvasImagesStore = useCanvasImagesStore()
const authStore = useAuthStore()

// Image context menu state
const imageContextMenu = ref<{ show: boolean; x: number; y: number; nodeId: string }>({
  show: false, x: 0, y: 0, nodeId: ''
})

const handleImageContextMenu = (e: Event) => {
  const { x, y, nodeId } = (e as CustomEvent).detail
  imageContextMenu.value = { show: true, x, y, nodeId }
}

const deleteImageFromContextMenu = async () => {
  if (imageContextMenu.value.nodeId) {
    const imgData = canvasImagesStore.images.find(i => i.id === imageContextMenu.value.nodeId)
    const removed = await canvasImagesStore.removeCanvasImage(imageContextMenu.value.nodeId)
    const snapshot = imgData ? { ...imgData, position: { ...imgData.position } } : removed
    if (snapshot) {
      const { pushImageDeleteUndo } = await import('@/composables/undoSingleton')
      pushImageDeleteUndo(snapshot)
    }
  }
  imageContextMenu.value.show = false
}

const handleCanvasPaste = async (e: ClipboardEvent) => {
  // Only intercept when not typing in an input / contenteditable
  const target = e.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
    if (target.closest('[role="dialog"], .modal, .n-modal, .n-dialog')) return
  }

  const imageFile = getClipboardImage(e)
  if (!imageFile) return

  e.preventDefault()

  const userId = authStore.user?.id ?? 'guest'

  try {
    const compressed = await compressImage(imageFile)
    const imageUrl = await uploadCanvasImage(compressed, userId)

    // Place at center of current viewport using orchestrator's screenToFlowCoordinate
    const vueFlowEl = document.querySelector('.vue-flow') as HTMLElement | null
    let centerFlow = { x: 400, y: 400 }
    if (vueFlowEl) {
      const rect = vueFlowEl.getBoundingClientRect()
      centerFlow = screenToFlowCoordinate({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    }

    canvasImagesStore.addCanvasImage({
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      imageUrl,
      position: { x: centerFlow.x, y: centerFlow.y },
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[CANVAS:PASTE] Failed to paste image:', err)
  }
}

onMounted(() => {
  document.addEventListener('paste', handleCanvasPaste)
  window.addEventListener('image-node-context-menu', handleImageContextMenu)
})
onUnmounted(() => {
  document.removeEventListener('paste', handleCanvasPaste)
  window.removeEventListener('image-node-context-menu', handleImageContextMenu)
})

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

<style>
/* TASK-1690: Image node context menu (teleported to body, must be unscoped) */
.image-context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--overlay-component-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  min-width: 140px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.image-context-menu-item {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--text-sm);
  text-align: start;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.image-context-menu-item:hover {
  background: var(--glass-bg-soft);
}

.image-context-menu-item.danger {
  color: var(--color-danger);
}

.image-context-menu-item.danger:hover {
  background: var(--danger-bg-subtle);
}

.image-context-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}
</style>
