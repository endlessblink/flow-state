<template>
  <div
    class="canvas-layout canvas-contour"
    :class="{ 'shift-selecting': shift }"
  >
    <!-- MAIN CANVAS AREA -->
    <div
      class="canvas-drop-zone relative"
      @drop="handleDrop"
      @dragover.prevent
      @contextmenu.prevent="handleCanvasRightClick"
    >
      <!-- Canvas Controls -->
      <CanvasControls />
      
      <!-- Canvas Toolbar -->
      <CanvasToolbar
        @addTask="handleAddTask"
        @createGroup="handleToolbarCreateGroup"
      />

      <!-- Loading overlay -->
      <CanvasLoadingOverlay 
        v-if="!isCanvasReady && !hasNoTasks && tasksWithCanvasPositions && tasksWithCanvasPositions.length > 0"
        message="Loading canvas..."
      />

      <!-- Empty state -->
      <CanvasEmptyState
        v-if="hasNoTasks"
        @addTask="handleAddTask"
      />

      <!-- Status Banner -->
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
            tabindex="0"
            @node-drag-start="handleNodeDragStart"
            @node-drag-stop="handleNodeDragStop"
            @node-drag="handleNodeDrag"
            @nodes-change="handleNodesChange"
            @selection-change="handleSelectionChange"
            @pane-click="handlePaneClick"
            @pane-context-menu="handlePaneContextMenu"
            @node-context-menu="handleNodeContextMenu"
            @edge-click="handleEdgeClick"
            @edge-context-menu="handleEdgeContextMenu"
            @connect="typedHandleConnect"
            @connect-start="handleConnectStart"
            @connect-end="handleConnectEnd"
            @keydown="handleKeyDown"
          >
            <!-- Selection Box -->
            <CanvasSelectionBox :selection-box="selectionBox" />
            
            <!-- Background Grid -->
            <Background
              pattern-color="#e5e7eb"
              pattern="dots"
              :gap="16"
              :size="1"
            />

            <!-- MiniMap -->
            <MiniMap
              :node-color="getNodeColor"
              mask-color="var(--text-secondary)"
              pannable
              zoomable
              position="bottom-right"
            />

            <!-- Section Node Template -->
            <template #node-sectionNode="nodeProps">
              <GroupNodeSimple
                v-memo="[nodeProps.id, nodeProps.data, nodeProps.selected, nodeProps.dragging]"
                :data="nodeProps.data"
                :selected="nodeProps.selected"
                :dragging="nodeProps.dragging"
                @update="handleSectionUpdate"
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
                v-memo="[nodeProps.id, nodeProps.data.task, nodeProps.selected, nodeProps.dragging, canvasStore.multiSelectMode, isConnecting]"
                :task="nodeProps.data.task"
                :is-selected="nodeProps.selected"
                :is-dragging="nodeProps.dragging"
                :multi-select-mode="canvasStore.multiSelectMode"
                :show-priority="canvasStore.showPriorityIndicator"
                :show-status="canvasStore.showStatusBadge"
                :show-duration="canvasStore.showDurationBadge"
                :show-schedule="canvasStore.showScheduleBadge"
                :is-connecting="isConnecting"
                @edit="handleEditTask"
                @select="handleTaskSelect"
                @context-menu="handleTaskContextMenu"
              />
            </template>

            <!-- Connection Markers -->
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

          <!-- System Loading Overlay -->
          <CanvasLoadingOverlay
            v-if="!systemHealthy || !isCanvasReady"
            :message="systemHealthy ? 'Initializing Canvas...' : 'System Initializing...'"
          />
      </div>
    </div>

    <!-- Modals & Context Menus (Orchestrated via Stores) -->
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
      @toggle-power-mode="handleTogglePowerMode"
      @collect-tasks="collectTasksForSection"
      @disconnect-edge="disconnectEdge"
      @delete-node="deleteNode"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, markRaw, onMounted } from 'vue'
import {
  VueFlow,
  useVueFlow,
  useNodesInitialized,
  type Connection,
  type Edge,
  type Node,
  type EdgeMouseEvent
} from '@vue-flow/core'
import {
  useMagicKeys
} from '@vueuse/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import { storeToRefs } from 'pinia'

// Styles
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/node-resizer/dist/style.css'
import '../assets/vue-flow-overrides.css'

// Stores
import { useTaskStore, type Task } from '../stores/tasks'
import { useCanvasStore } from '../stores/canvas'
import { useCanvasUiStore } from '../stores/canvas/canvasUi'
import { useUIStore } from '../stores/ui'
import { useCanvasModalsStore } from '../stores/canvas/modals'
import { useCanvasContextMenuStore } from '../stores/canvas/contextMenus'

// Composables
import { useCanvasLifecycle } from '../composables/canvas/useCanvasLifecycle'
import { useCanvasInteractivity } from '../composables/canvas/useCanvasInteractivity'
import { useCanvasNavigation } from '../composables/canvas/useCanvasNavigation'
import { useCanvasSync } from '../composables/canvas/useCanvasSync'
import { useCanvasActions } from '../composables/canvas/useCanvasActions'
import { useCanvasEvents } from '../composables/canvas/useCanvasEvents'
import { useCanvasConnections } from '../composables/canvas/useCanvasConnections'
import { useCanvasDragDrop, isDragSettlingRef } from '../composables/canvas/useCanvasDragDrop'
import { useCanvasResize } from '../composables/canvas/useCanvasResize'
import { useCanvasHotkeys } from '../composables/canvas/useCanvasHotkeys'
import { useCanvasSelection } from '../composables/canvas/useCanvasSelection'
import { useCanvasResourceManager } from '../composables/canvas/useCanvasResourceManager'
import { useCanvasZoom } from '../composables/canvas/useCanvasZoom'
import { useCanvasFiltering } from '../composables/canvas/useCanvasFiltering'
import { useCanvasSmartGroups } from '../composables/canvas/useCanvasSmartGroups'
import { useMidnightTaskMover } from '../composables/canvas/useMidnightTaskMover'
import { useVueFlowStability } from '../composables/useVueFlowStability'
import { useVueFlowStateManager } from '../composables/useVueFlowStateManager'
import { useVueFlowErrorHandling } from '../composables/useVueFlowErrorHandling'
import { useDateTransition } from '../composables/useDateTransition'
import { useCanvasInteractionHandlers } from '../composables/canvas/useCanvasInteractionHandlers'
import { useCanvasAlignment } from '../composables/canvas/useCanvasAlignment'

// Components
import TaskNode from '../components/canvas/TaskNode.vue'
import GroupNodeSimple from '../components/canvas/GroupNodeSimple.vue'
import UnifiedInboxPanel from '../components/inbox/UnifiedInboxPanel.vue'
import CanvasModals from '../components/canvas/CanvasModals.vue'
import CanvasEmptyState from '../components/canvas/CanvasEmptyState.vue'
import CanvasContextMenus from '../components/canvas/CanvasContextMenus.vue'
import CanvasToolbar from '../components/canvas/CanvasToolbar.vue'
import CanvasControls from '../components/canvas/CanvasControls.vue'
import CanvasStatusBanner from '../components/canvas/CanvasStatusBanner.vue'
import CanvasLoadingOverlay from '../components/canvas/CanvasLoadingOverlay.vue'
import CanvasSelectionBox from '../components/canvas/CanvasSelectionBox.vue'

// Task-89: Canvas state lock
import { lockViewport } from '../utils/canvasStateLock'
import { getUndoSystem } from '../composables/undoSingleton'

// --- Stores Initializations ---
const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const canvasUiStore = useCanvasUiStore()
const uiStore = useUIStore()
const modals = useCanvasModalsStore()
const contextMenus = useCanvasContextMenuStore()

// --- Core Vue Flow Refs & Config ---
const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
const vueFlowRef = ref(null)
const recentlyRemovedEdges = ref(new Set<string>())
const recentlyDeletedGroups = ref(new Set<string>())
const isHandlingNodeChange = ref(false)
const isSyncing = ref(false)
const isNodeDragging = ref(false)
const isCanvasReady = ref(false)
const isVueFlowMounted = ref(false)
const isVueFlowReady = ref(false)

const nodeTypes = markRaw({
  taskNode: TaskNode as any,
  sectionNode: GroupNodeSimple as any
})

const {
  findNode,
  onEdgeClick,
  onEdgeContextMenu,
  removeEdges,
  nodes: vfNodes,
  viewport: vfViewport,
  updateNodeData,
  updateNode,
  setViewport: vueFlowSetViewport,
  setNodes
} = useVueFlow()

const nodesInitialized = useNodesInitialized()

// --- Specialized Composables ---
const resourceManager = useCanvasResourceManager(nodes, edges)
const { cleanupZoom } = useCanvasZoom(resourceManager)
const { initialViewport, fitCanvas } = useCanvasNavigation(canvasStore)
const { getNodeColor } = useCanvasSelection()
const undoHistory = getUndoSystem()
const vueFlowErrorHandling = useVueFlowErrorHandling({ enableAutoRecovery: true })
const withVueFlowErrorBoundary = (name: string, f: any) => vueFlowErrorHandling.createErrorHandler(name, f)

// Operation Management
const operationLoading = ref({ saving: false, loading: false, syncing: false, creating: false, updating: false, deleting: false })
const operationError = ref<{ type: string; message: string; retryable: boolean } | null>(null)

const setOperationLoading = (op: string, l: boolean) => { if (op in operationLoading.value) operationLoading.value[op as keyof typeof operationLoading.value] = l }
const setOperationError = (t: string, m: string, r: boolean = false) => { operationError.value = { type: t, message: m, retryable: r } }

// Resize Logic
const { resizeState, isResizeSettling, handleSectionResizeStart, handleSectionResize, handleSectionResizeEnd } = useCanvasResize({ findNode, updateNode, nodes: vfNodes })

// New Interactivity & Lifecycle Composables
const { 
    selectionBox, isInteracting, handleMouseDown, handleMouseMove, handleMouseUp, handleCanvasContainerClick 
} = useCanvasInteractivity(canvasStore, isNodeDragging, resizeState, isResizeSettling)

const { storeHealth } = useCanvasLifecycle(taskStore, canvasStore, uiStore, fitCanvas, cleanupZoom)

const { filteredTasks } = useCanvasFiltering(taskStore, canvasStore, isInteracting)

const {
  syncNodes, syncEdges, batchedSyncNodes, batchedSyncEdges
} = useCanvasSync({
  nodes, edges, filteredTasks, recentlyRemovedEdges, recentlyDeletedGroups, vueFlowRef,
  isHandlingNodeChange, isSyncing, isNodeDragging, isDragSettlingRef, resizeState, isResizeSettling,
  resourceManager, validateStores: () => storeHealth, setOperationError, setOperationLoading,
  clearOperationError: () => { operationError.value = null }
})

// Drag Drop & Connections
const { handleNodeDragStart, handleNodeDragStop, handleNodeDrag } = useCanvasDragDrop({
  taskStore, canvasStore, nodes, filteredTasks, withVueFlowErrorBoundary, syncNodes, setNodes, updateNodeData
}, { isNodeDragging })

// Events
const {
  isConnecting,
  closeCanvasContextMenu,
  closeNodeContextMenu,
  closeEdgeContextMenu,
  handlePaneClick,
  handleCanvasRightClick,
  handlePaneContextMenu,
  handleDrop
} = useCanvasEvents(syncNodes)

const { handleConnectStart, handleConnectEnd, handleConnect, disconnectEdge } = useCanvasConnections({
  syncEdges, closeCanvasContextMenu: contextMenus.closeCanvasContextMenu, closeEdgeContextMenu: contextMenus.closeEdgeContextMenu,
  closeNodeContextMenu: contextMenus.closeNodeContextMenu, addTimer: (id) => resourceManager.addTimer(id), withVueFlowErrorBoundary
}, { isConnecting, recentlyRemovedEdges, showEdgeContextMenu: storeToRefs(contextMenus).showEdgeContextMenu, edgeContextMenuX: storeToRefs(contextMenus).edgeContextMenuX, edgeContextMenuY: storeToRefs(contextMenus).edgeContextMenuY, selectedEdge: computed(() => null) })

const typedHandleConnect = handleConnect as (connection: Connection) => void

// Interaction Handlers (Wiring things together)
const {
  handleSectionUpdate,
  handleSectionContextMenu,
  handleOpenSectionSettings,
  handleOpenSectionSettingsFromContext,
  handleNodesChange: handleNodesChangeInteraction,
  handleTogglePowerMode,
  collectTasksForSection: collectTasksForSectionInteraction
} = useCanvasInteractionHandlers({
  nodes, edges, canvasStore, taskStore, isConnecting, resizeState, withVueFlowErrorBoundary,
  syncNodes, syncEdges, addTimer: (id) => resourceManager.addTimer(id),
  closeCanvasContextMenu: contextMenus.closeCanvasContextMenu, closeNodeContextMenu: contextMenus.closeNodeContextMenu,
  removeEdges, recentlyRemovedEdges,
  edgeContextMenuState: { show: storeToRefs(contextMenus).showEdgeContextMenu, x: storeToRefs(contextMenus).edgeContextMenuX, y: storeToRefs(contextMenus).edgeContextMenuY, selectedId: storeToRefs(contextMenus).selectedEdgeId },
  canvasContextMenuState: { show: storeToRefs(contextMenus).showCanvasContextMenu, x: storeToRefs(contextMenus).canvasContextMenuX, y: storeToRefs(contextMenus).canvasContextMenuY },
  canvasContextSection: storeToRefs(contextMenus).canvasContextSection,
  sectionSettingsState: { 
    isOpen: storeToRefs(modals).isSectionSettingsOpen, 
    editingId: computed({
        get: () => modals.editingSection?.id || null,
        set: (val) => { 
            const section = canvasStore.sections.find(s => s.id === val)
            if (section) modals.editingSection = section
            else modals.editingSection = null
        }
    })
  }
})

// Actions & Hotkeys
const {
  createTaskHere, handleQuickTaskCreate, createGroup, editGroup, deleteGroup, confirmDeleteGroup,
  moveSelectedTasksToInbox, deleteSelectedTasks, handleNodeContextMenu, deleteNode, confirmBulkDelete, cancelBulkDelete,
  createTaskInGroup, cancelDeleteGroup
} = useCanvasActions({
  viewport: storeToRefs(canvasUiStore).viewport, batchedSyncNodes, syncNodes, closeCanvasContextMenu: contextMenus.closeCanvasContextMenu,
  closeEdgeContextMenu: contextMenus.closeEdgeContextMenu, closeNodeContextMenu: contextMenus.closeNodeContextMenu, recentlyDeletedGroups
}, {
  isQuickTaskCreateOpen: storeToRefs(modals).isQuickTaskCreateOpen,
  quickTaskPosition: storeToRefs(modals).quickTaskPosition,
  showCanvasContextMenu: storeToRefs(contextMenus).showCanvasContextMenu,
  canvasContextMenuX: storeToRefs(contextMenus).canvasContextMenuX,
  canvasContextMenuY: storeToRefs(contextMenus).canvasContextMenuY,
  canvasContextSection: storeToRefs(contextMenus).canvasContextSection,
  isGroupModalOpen: storeToRefs(modals).isGroupModalOpen,
  selectedGroup: storeToRefs(modals).selectedGroup,
  groupModalPosition: storeToRefs(modals).groupModalPosition,
  isGroupEditModalOpen: storeToRefs(modals).isGroupEditModalOpen,
  selectedSectionForEdit: storeToRefs(modals).selectedSectionForEdit,
  isDeleteGroupModalOpen: storeToRefs(modals).isDeleteGroupModalOpen,
  groupPendingDelete: storeToRefs(modals).groupPendingDelete,
  selectedNode: computed({
    get: () => contextMenus.selectedNodeId ? findNode(contextMenus.selectedNodeId) || null : null,
    set: (val) => { contextMenus.selectedNodeId = val?.id || null }
  }) as any,
  showNodeContextMenu: storeToRefs(contextMenus).showNodeContextMenu,
  nodeContextMenuX: storeToRefs(contextMenus).nodeContextMenuX,
  nodeContextMenuY: storeToRefs(contextMenus).nodeContextMenuY,
  filteredTasks: filteredTasks as any,
  isBulkDeleteModalOpen: storeToRefs(modals).isBulkDeleteModalOpen,
  bulkDeleteItems: storeToRefs(modals).bulkDeleteItems,
  bulkDeleteIsPermanent: storeToRefs(modals).bulkDeleteIsPermanent
}, undoHistory)

const { shift } = useMagicKeys()
const { handleKeyDown } = useCanvasHotkeys({
  isBulkDeleteModalOpen: storeToRefs(modals).isBulkDeleteModalOpen,
  bulkDeleteItems: storeToRefs(modals).bulkDeleteItems,
  bulkDeleteIsPermanent: storeToRefs(modals).bulkDeleteIsPermanent
})

const { 
  alignLeft, alignRight, alignTop, alignBottom, 
  alignCenterHorizontal, alignCenterVertical, 
  distributeHorizontal, distributeVertical,
  arrangeInRow, arrangeInColumn, arrangeInGrid 
} = useCanvasAlignment(nodes, { isVueFlowMounted, isVueFlowReady, isCanvasReady }, { closeCanvasContextMenu: contextMenus.closeCanvasContextMenu })

// --- Integration & Watchers ---
watch(vfViewport, (v) => {
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || v.zoom <= 0) return
  canvasStore.setViewport(v.x, v.y, v.zoom)
  lockViewport(v, 'pan')
}, { deep: true })

watch(nodesInitialized, (init) => { if (init && !isCanvasReady.value) { isCanvasReady.value = true; fitCanvas() } })

const systemHealthy = computed(() => storeHealth.taskStore && storeHealth.canvasStore)
const hasNoTasks = computed(() => (filteredTasks.value?.length || 0) === 0)
const tasksWithCanvasPositions = computed(() => filteredTasks.value?.filter(t => !!t.canvasPosition) || [])
const dynamicNodeExtent = computed(() => [[-10000, -10000], [20000, 20000]] as [[number, number], [number, number]])

// Date Transitions
const { moveTodayTasksToOverdue } = useMidnightTaskMover(canvasStore, taskStore)
useDateTransition({ onDayChange: moveTodayTasksToOverdue, autoStart: true })

// Template Helpers
const clearStatusFilter = () => taskStore.setActiveStatusFilter(null)
const handleEditTask = (task: Task) => modals.openEditModal(task)
const handleTaskSelect = (task: Task) => canvasStore.setSelectedNodes([task.id])
const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
    contextMenus.openNodeContextMenu(event.clientX, event.clientY, task.id)
}
const handleToolbarCreateGroup = () => modals.openGroupModal(null, { x: 100, y: 100 })
const handleAddTask = () => modals.openQuickTaskCreate({ x: 100, y: 100 })

// Vue Flow Handlers
const handleNodesChange = (changes: any) => handleNodesChangeInteraction(changes)
const handleSelectionChange = (params: any) => { /* Already handled by stores */ }
const handleEdgeContextMenu = (params: EdgeMouseEvent) => {
    contextMenus.openEdgeContextMenu((params.event as MouseEvent).clientX, (params.event as MouseEvent).clientY, params.edge.id)
}
const handleEdgeClick = (params: EdgeMouseEvent) => { /* Edge click logic */ }
const collectTasksForSection = (sectionId: string) => collectTasksForSectionInteraction(sectionId)
const handleBatchEditApplied = () => {}
const handleSectionSettingsSave = (settings: any) => {}
const handleGroupCreated = () => {}
const handleGroupUpdated = () => {}
const handleGroupEditSave = () => {}

// Logic Implementation
useVueFlowStability(nodes, edges, ref(null), {}, isNodeDragging)
useVueFlowStateManager(nodes, edges, {}, isNodeDragging)

// Final initialization
onMounted(() => {
    if (initialViewport.value) vueFlowSetViewport(initialViewport.value)
    isVueFlowMounted.value = true
    isVueFlowReady.value = true
})
</script>

<style scoped>
.canvas-layout { height: 100vh; width: 100vw; overflow: hidden; position: relative; }
.canvas-drop-zone { height: 100%; width: 100%; position: relative; }
.canvas-container { height: 100%; width: 100%; }
.vue-flow-container { background: var(--bg-canvas); }
</style>
