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
    <!-- ================================================================= -->
    <!-- TEMPLATE ORGANIZATION - Phase 1 (Zero Risk)               -->
    <!-- ================================================================= -->

  
    <!-- MAIN CANVAS AREA -->
    <!-- Vue Flow Canvas -->
    <div
      class="canvas-drop-zone relative"
      @drop="handleDrop"
      @dragover.prevent
      @contextmenu.prevent="handleCanvasRightClick"
    >
      <!-- Canvas Filter Toggles - Absolute position handled in component or component moved out -->
      <!-- Keeping component inside drop zone to match previous Z-index context, 
           but component itself has absolute positioning. -->
      <CanvasFilterControls />
      <!-- Loading overlay while canvas initializes (only when there are tasks that should be on canvas) -->
      <div v-if="!isCanvasReady && !hasNoTasks && tasksWithCanvasPositions && tasksWithCanvasPositions.length > 0" class="canvas-loading-overlay">
        <div class="loading-content">
          <div class="loading-spinner" />
          <span class="loading-text">Loading canvas...</span>
        </div>
      </div>

      <!-- Empty state when no tasks exist -->
      <!-- Empty state when no tasks exist -->
      <CanvasEmptyState 
        v-if="hasNoTasks" 
        @add-task="handleAddTask"
      />

      <!-- ================================================================= -->
      <!-- VUE FLOW CORE SECTION (NEVER EXTRACT - CRITICAL DEPENDENCIES) -->
      <!-- Component: CanvasViewCore (would be the name if extracted)        -->
      <!-- Dependencies: All Vue Flow bindings, event handlers, node/edge state -->
      <!-- Extraction Risk: 100% - Will break all canvas functionality         -->

      <!--
          ⚠️ CRITICAL VUE FLOW COMPONENT - DO NOT EXTRACT OR MODIFY BINDINGS

          The following Vue Flow bindings and event handlers are the core of canvas functionality:
          - v-model:nodes="nodes"  <-- CRITICAL: Node state management
          - v-model:edges="edges" <-- CRITICAL: Edge state management
          - @node-drag-stop, @connect, @edge-created handlers <-- CRITICAL: Event handling

          Previous refactoring attempts that extracted these caused:
          ✗ Complete failure of drag-drop functionality
          ✗ Broken node connections
          ✗ State synchronization issues
          ✗ Canvas viewport controls failure

          ALL Vue Flow related code must stay in this component during refactoring.
        -->
      <!-- Filter Status Indicator -->
      <div
        v-if="taskStore.activeStatusFilter"
        class="absolute top-4 left-4 z-20 px-4 py-2 bg-[rgba(99,102,241,0.2)] backdrop-blur-sm border border-indigo-500/30 rounded-lg text-indigo-300 text-sm font-medium flex items-center gap-2 shadow-lg"
      >
        <Filter :size="16" />
        <span>{{ getStatusFilterLabel(taskStore.activeStatusFilter) }} filter active</span>
        <button
          class="ml-2 text-indigo-400 hover:text-white transition-colors"
          title="Clear filter"
          aria-label="Clear filter"
          @click="clearStatusFilter"
        >
          <X :size="14" />
        </button>
        <div class="text-xs text-indigo-400 ml-2">
          (Check Canvas Inbox for more tasks)
        </div>
      </div>

      <!-- Inbox Sidebar - Using UnifiedInboxPanel as per Storybook -->
      <UnifiedInboxPanel />

      <!-- Always show VueFlow canvas, even when empty -->
      <div class="canvas-container-wrapper">
        <!-- Canvas with tasks -->
        <div class="canvas-container" style="width: 100%; height: 100vh; position: relative;">
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
            pan-on-drag
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
                  <polygon
                    points="0 0, 10 3, 0 6"
                    fill="var(--border-secondary)"
                  />
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
                  <polygon
                    points="0 0, 10 3, 0 6"
                    fill="var(--color-navigation)"
                  />
                </marker>
              </defs>
            </svg>
          </VueFlow>

          <!-- Loading state when canvas is not ready -->
          <div v-if="!systemHealthy || !isCanvasReady" class="canvas-loading-state">
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
                <p class="text-gray-600 dark:text-gray-400">
                  {{ systemHealthy ? 'Initializing Canvas...' : 'System Initializing...' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sub-components: Extracted for maintainability (Phase 4) -->
    <CanvasModals
      :is-edit-modal-open="isEditModalOpen"
      :selected-task="selectedTask"
      :is-quick-task-create-open="isQuickTaskCreateOpen"
      :is-batch-edit-modal-open="isBatchEditModalOpen"
      :batch-edit-task-ids="batchEditTaskIds"
      :is-section-settings-open="isSectionSettingsOpen"
      :editing-section="editingSection"
      :is-group-modal-open="isGroupModalOpen"
      :selected-group="selectedGroup"
      :group-modal-position="groupModalPosition"
      :is-group-edit-modal-open="isGroupEditModalOpen"
      :selected-section-for-edit="selectedSectionForEdit"
      :is-delete-group-modal-open="isDeleteGroupModalOpen"
      :delete-group-message="deleteGroupMessage"
      :is-bulk-delete-modal-open="isBulkDeleteModalOpen"
      :bulk-delete-title="bulkDeleteTitle"
      :bulk-delete-message="bulkDeleteMessage"
      :bulk-delete-items="bulkDeleteItems"
      :bulk-delete-is-permanent="bulkDeleteIsPermanent"
      @close-edit-modal="closeEditModal"
      @close-quick-task-create="closeQuickTaskCreate"
      @handle-quick-task-create="handleQuickTaskCreate"
      @close-batch-edit-modal="closeBatchEditModal"
      @handle-batch-edit-applied="handleBatchEditApplied"
      @close-section-settings-modal="closeSectionSettingsModal"
      @handle-section-settings-save="handleSectionSettingsSave"
      @close-group-modal="closeGroupModal"
      @handle-group-created="handleGroupCreated"
      @handle-group-updated="handleGroupUpdated"
      @close-group-edit-modal="closeGroupEditModal"
      @handle-group-edit-save="handleGroupEditSave"
      @confirm-delete-group="confirmDeleteGroup"
      @cancel-delete-group="cancelDeleteGroup"
      @confirm-bulk-delete="confirmBulkDelete"
      @cancel-bulk-delete="cancelBulkDelete"
    />

    <CanvasContextMenus
      :show-canvas-context-menu="showCanvasContextMenu"
      :canvas-context-menu-x="canvasContextMenuX"
      :canvas-context-menu-y="canvasContextMenuY"
      :has-selected-tasks="canvasStore.selectedNodeIds.length > 0"
      :selected-count="canvasStore.selectedNodeIds.length"
      :context-section="canvasContextSection"
      :show-edge-context-menu="showEdgeContextMenu"
      :edge-context-menu-x="edgeContextMenuX"
      :edge-context-menu-y="edgeContextMenuY"
      :show-node-context-menu="showNodeContextMenu"
      :node-context-menu-x="nodeContextMenuX"
      :node-context-menu-y="nodeContextMenuY"
      @close-canvas-context-menu="closeCanvasContextMenu"
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
      @collect-tasks="handleCollectTasksFromMenu"
      @close-edge-context-menu="closeEdgeContextMenu"
      @disconnect-edge="disconnectEdge"
      @close-node-context-menu="closeNodeContextMenu"
      @delete-node="deleteNode"
    />
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
  markRaw,
  reactive
} from 'vue'
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
  useWindowSize,
  useMagicKeys,
  useDebounceFn
} from '@vueuse/core'
import { Filter, X } from 'lucide-vue-next'

import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/node-resizer/dist/style.css'
import { useVueFlowStability } from '../composables/useVueFlowStability'
import { useVueFlowStateManager } from '../composables/useVueFlowStateManager'
import { useVueFlowErrorHandling } from '../composables/useVueFlowErrorHandling'
import { useTaskStore, type Task } from '../stores/tasks'
import { useCanvasStore } from '../stores/canvas'
import { useUIStore } from '../stores/ui'
import { storeToRefs } from 'pinia'
import { useCanvasDragDrop, isDragSettlingRef } from '../composables/canvas/useCanvasDragDrop'
import { useCanvasSelection } from '../composables/canvas/useCanvasSelection'
import { useCanvasNavigation } from '../composables/canvas/useCanvasNavigation'
import { useCanvasEvents } from '../composables/canvas/useCanvasEvents'
import type { CanvasSection, AssignOnDropSettings } from '../stores/canvas'
import { getUndoSystem } from '../composables/undoSingleton'
import TaskNode from '../components/canvas/TaskNode.vue'
import GroupNodeSimple from '../components/canvas/GroupNodeSimple.vue'
import UnifiedInboxPanel from '../components/inbox/UnifiedInboxPanel.vue'

// Phase 4 Decomposed Components
import CanvasModals from '../components/canvas/CanvasModals.vue'
import CanvasStatusOverlays from '../components/canvas/CanvasStatusOverlays.vue'
import CanvasEmptyState from '../components/canvas/CanvasEmptyState.vue'
import CanvasContextMenus from '../components/canvas/CanvasContextMenus.vue'
import CanvasFilterControls from '../components/canvas/CanvasFilterControls.vue'

// Import Vue Flow styles
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

// CRITICAL: Import AFTER Vue Flow CSS to override rasterization-causing styles (BUG-041)
import '../assets/vue-flow-overrides.css'

// TASK-089: Canvas state lock to prevent sync from overwriting user changes
import { isAnyCanvasStateLocked, lockViewport } from '../utils/canvasStateLock'

// Phase 1 Composables
import { useCanvasResourceManager } from '../composables/canvas/useCanvasResourceManager'
import { useCanvasZoom } from '../composables/canvas/useCanvasZoom'
import { useDateTransition } from '../composables/useDateTransition'
import { useMidnightTaskMover } from '../composables/canvas/useMidnightTaskMover'
import { useCanvasAlignment } from '../composables/canvas/useCanvasAlignment'
// REMOVED: Library styles were forcing circular handles
// import '@vue-flow/node-resizer/dist/style.css'

import { useCanvasActions } from '../composables/canvas/useCanvasActions'
import { useCanvasConnections } from '../composables/canvas/useCanvasConnections'
import { useCanvasSync } from '../composables/canvas/useCanvasSync'
import { useCanvasResize } from '../composables/canvas/useCanvasResize'
import { NodeUpdateBatcher } from '../utils/canvas/NodeUpdateBatcher'

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const uiStore = useUIStore()

// Graceful degradation: Validate store initialization and provide fallbacks
const validateStores = () => {
  const storeStatus = {
    taskStore: !!taskStore,
    canvasStore: !!canvasStore,
    uiStore: !!uiStore
  }

  if (!storeStatus.taskStore) {
    console.error('❌ CRITICAL: TaskStore failed to initialize')
  }
  if (!storeStatus.canvasStore) {
    console.error('❌ CRITICAL: CanvasStore failed to initialize')
  }
  if (!storeStatus.uiStore) {
    console.error('❌ CRITICAL: UIStore failed to initialize')
  }

  return storeStatus
}

// Store validation status for use throughout component
const storeHealth = validateStores()

// BUG-052: Initial viewport from saved state - prevents jump when Vue Flow initializes
// By using canvasStore.viewport (which is loaded BEFORE Vue Flow renders),
// we avoid the default (0,0,1) → saved viewport jump
// Navigation (Extracted)
const { initialViewport, fitCanvas, zoomToSelection } = useCanvasNavigation(canvasStore)

// TASK-082: Date transition handler - move Today tasks to Overdue at midnight
// Logic extracted to composable for testability (Jan 4, 2026)
const { moveTodayTasksToOverdue } = useMidnightTaskMover(canvasStore, taskStore)

// Initialize date transition watcher
const { simulateTransition } = useDateTransition({
  onDayChange: moveTodayTasksToOverdue,
  autoStart: true,
  debug: true
})

// TASK-082: Expose simulate function for testing (call window.__simulateMidnightTransition() in console)
if (typeof window !== 'undefined') {
  (window as unknown as { __simulateMidnightTransition: typeof simulateTransition }).__simulateMidnightTransition = simulateTransition
}



// Graceful degradation wrapper for store operations
const safeStoreOperation = <T>(
  operation: () => T,
  fallback: T,
  operationName: string,
  storeName: string
): T => {
  try {
    if (!storeHealth[storeName as keyof typeof storeHealth]) {
      console.warn(`⚠️ ${storeName} unavailable, using fallback for ${operationName}`)
      return fallback
    }
    return operation()
  } catch (error) {
    console.error(`❌ ${operationName} failed:`, error)
    return fallback
  }
}

// Create a simple project filter helper function that matches the sidebar composable exactly
const _getVisibleProjectIds = () => {
  try {
    const visibleProjectIds = new Set()

    // Get projects directly from task store to avoid circular dependency
    const allProjects = Array.isArray(taskStore.projects) ? taskStore.projects : []

    // Apply EXACT same filtering logic as sidebar composable (filterOutSyntheticMyTasks)
    allProjects.forEach(project => {
      if (project && project.id && !project.id.startsWith('synthetic') && project.id !== '1') {
        visibleProjectIds.add(project.id)

        // Add child projects
        allProjects.forEach(child => {
          if (child && child.parentId === project.id) {
            visibleProjectIds.add(child.id)
          }
        })
      }
    })

    // If all projects were filtered out (only synthetic existed), return default project
    if (visibleProjectIds.size === 0 && allProjects.length > 0) {
      const defaultProject = allProjects.find(p => p && p.id === '1')
      if (defaultProject) {
        visibleProjectIds.add(defaultProject.id)
      }
    }

    return visibleProjectIds
  } catch (error) {
    console.error('Error getting visible project IDs:', error)
    return new Set()
  }
}

// 🎯 FIXED: Canvas should match sidebar behavior exactly with graceful degradation
// The sidebar shows tasks based on smart views (Today, All Tasks, etc.) regardless of project filtering
// CPU Optimization: Memoized filtered tasks with shallow comparison
// CPU Optimization: Memoized filtered tasks with shallow comparison
let lastFilteredTasks: Task[] = []
let lastFilteredTasksHash = ''

// Store reactive reference for use throughout the component
const { sections: _sections, viewport } = storeToRefs(canvasStore)
const { secondarySidebarVisible: _secondarySidebarVisible } = storeToRefs(uiStore)
// TASK-076 & TASK-082: Apply canvas-specific filters
const { hideCanvasDoneTasks, hideCanvasOverdueTasks } = storeToRefs(taskStore)

const filteredTasksWithProjectFiltering = computed(() => {
  return safeStoreOperation(
    () => {
      // FIX (Dec 5, 2025): Canvas now uses filteredTasks to respect sidebar smart view filters
      // Previous behavior: Used raw taskStore.tasks which ignored sidebar filters entirely
      // New behavior: Canvas respects Today, Week, etc. filters like Board and Calendar views
      if (!taskStore.filteredTasks || !Array.isArray(taskStore.filteredTasks)) {
        console.warn('⚠️ taskStore.filteredTasks not available or not an array')
        return []
      }

      const currentTasks = taskStore.filteredTasks

      // Performance optimization: Only update if actually changed
      // Skip expensive hash calculation during drag/resize to maintain 60FPS
      if (isInteracting.value && lastFilteredTasks.length > 0) {
        return lastFilteredTasks
      }

      // FIX (Dec 5, 2025): Include dueDate and canvasPosition in hash for proper cache invalidation
      const currentHash = currentTasks.map(t => `${t.id}:${t.title.slice(0, 10)}:${t.isInInbox}:${t.status}:${t.dueDate || ''}:${t.updatedAt?.getTime() ?? ''}`).join('|')
      if (currentHash === lastFilteredTasksHash && lastFilteredTasks.length > 0) {
        return lastFilteredTasks
      }

      lastFilteredTasksHash = currentHash
      // FIX (Dec 5, 2025): Create array COPY, not reference
      // Reference assignment caused stale data when multiple watchers fired simultaneously
      lastFilteredTasks = [...currentTasks]
      return currentTasks
    },
    [], // Fallback: empty array
    'filteredTasks access',
    'taskStore'
  )
})

const filteredTasks = computed(() => {
  let tasks = filteredTasksWithProjectFiltering.value

  // TASK-076: Filter out done tasks if hideCanvasDoneTasks is enabled
  // Use .value from storeToRefs for proper cross-browser reactivity
  if (hideCanvasDoneTasks.value) {
    tasks = tasks.filter(t => t.status !== 'done')
  }

  // TASK-082: Filter out overdue tasks (due date before today)
  if (hideCanvasOverdueTasks.value) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    tasks = tasks.filter(t => {
      if (!t.dueDate) return true // Keep tasks without due date
      const due = new Date(t.dueDate)
      return due >= today // Keep tasks due today or later
    })
  }

  return tasks
})


// 🚀 Vue Flow Initialization (Moved Up for Dependency Resolution)
// Using default Vue Flow edge types - smoothstep, bezier, etc.
// Custom edge types not needed for current implementation

// Get Vue Flow instance methods
const {
  fitView: vueFlowFitView,
  // zoomIn: vueFlowZoomIn, // Unused
  zoomOut: _vueFlowZoomOut,
  // zoomTo: vueFlowZoomTo, // Unused
  // getSelectedNodes, // Unused
  getNodes: _getNodes,
  findNode,
  onEdgeClick,
  onEdgeContextMenu,
  removeEdges,
  viewport: vfViewport, // BUG-019: Get the actual Vue Flow viewport for accurate coordinate transforms
  screenToFlowCoordinate, // BUG-044 FIX: Use official coordinate projection
  updateNodeData, // TASK-072: Official Vue Flow API for updating node data reactively
  updateNode, // BUG-055: Update node position for inverse delta compensation
  setViewport: vueFlowSetViewport // Required for force-resetting corrupted viewports
} = useVueFlow()

// TASK-072: Sync Vue Flow viewport changes to canvas store for persistence
// This triggers the auto-save watcher in canvas.ts (debounced 1s save to IndexedDB)
watch(vfViewport, (newViewport) => {
  // SAFETY: Sanitize viewport to prevent NaNs
  // If we receive NaNs, it corrupts the store and drag logic
  if (!Number.isFinite(newViewport.x) || 
      !Number.isFinite(newViewport.y) || 
      !Number.isFinite(newViewport.zoom) || 
      newViewport.zoom <= 0) {
      
      console.error('🚨 [CANVAS-VIEW] Corrupted viewport detected from Vue Flow:', newViewport)
      // Force reset internal Vue Flow state to break the loop
      vueFlowSetViewport({ x: 0, y: 0, zoom: 1 })
      return
  }

  canvasStore.setViewport(newViewport.x, newViewport.y, newViewport.zoom)

  // TASK-089: Lock viewport to prevent sync from overwriting user's pan/zoom
  lockViewport({
    x: newViewport.x,
    y: newViewport.y,
    zoom: newViewport.zoom
  }, 'pan')
}, { deep: true })

// Template Helper Properties
// Selection logic extracted to useCanvasSelection.ts

const handleEdgeClick = (event: EdgeMouseEvent) => {
  console.log('Edge clicked:', event.edge.id)
}

// NOTE: closeCanvasContextMenu is defined below at line ~1593
// NOTE: closeNodeContextMenu comes from useCanvasActions composable

// Get nodesInitialized composable - tracks when all nodes have measured dimensions
const nodesInitialized = useNodesInitialized()

// Declare reactive state before usage
const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
const recentlyRemovedEdges = ref(new Set<string>())

// Phase 1: Resource Manager & Zoom (Extracted)
const resourceManager = useCanvasResourceManager(nodes, edges)
const { cleanupZoom } = useCanvasZoom(resourceManager)

// 🚀 Operation Management System (Moved Up for Dependency Resolution)
const operationLoading = ref({
  saving: false,
  loading: false,
  syncing: false,
  creating: false,
  updating: false,
  deleting: false
})

const operationError = ref<{
  type: string
  message: string
  retryable: boolean
} | null>(null)

const setOperationLoading = (operation: string, loading: boolean) => {
  if (operation in operationLoading.value) {
    operationLoading.value[operation as keyof typeof operationLoading.value] = loading
    if (loading) {
      operationError.value = null // Clear previous errors when starting new operation
    }
  }
}

const setOperationError = (type: string, message: string, retryable: boolean = false) => {
  operationError.value = { type, message, retryable }
  // Clear loading states when error occurs
  Object.keys(operationLoading.value).forEach(key => {
    operationLoading.value[key as keyof typeof operationLoading.value] = false
  })
}

const clearOperationError = () => {
  operationError.value = null
}

// 🚀 Vue Flow Reference (Moved Up)
const vueFlowRef = ref(null)

// 🚀 Sync State Variables (Consolidated)
const isHandlingNodeChange = ref(false)
const isSyncing = ref(false)
const isNodeDragging = ref(false) // Guard against syncNodes during drag operations


// Track resize state for preview
const resizeState = ref({
  isResizing: false,
  sectionId: null as string | null,
  startX: 0,
  startY: 0,
  startWidth: 0,
  startHeight: 0,
  currentX: 0,
  currentY: 0,
  currentWidth: 0,
  currentHeight: 0,
  handlePosition: null as string | null,
  isDragging: false,
  resizeStartTime: 0
})
const isResizeSettling = ref(false)

// Interaction state helper to pause expensive reactivity during dragging/resizing
const isInteracting = computed(() => 
  isNodeDragging.value || 
  isDragSettlingRef.value || 
  resizeState.value.isResizing || 
  isResizeSettling.value
)

// 🔄 Sync Logic Extracted to useCanvasSync
const {
  syncNodes,
  syncEdges,
  batchedSyncNodes,
  batchedSyncEdges,
  performSystemRestart,
  cleanupStaleNodes
} = useCanvasSync({
  nodes,
  edges,
  filteredTasks,
  recentlyRemovedEdges,
  vueFlowRef,
  isHandlingNodeChange,
  isSyncing,
  isNodeDragging,
  isDragSettlingRef,
  resizeState,
  isResizeSettling,
  resourceManager,
  validateStores,
  setOperationError,
  clearOperationError
})

// TASK-082 & REACTIVITY FIX: Watch filteredTasks to trigger sync
// extensive debugging revealed this was missing/lost in merge, causing stale canvas
watch(filteredTasks, () => {
  if (!isAnyCanvasStateLocked()) {
    batchedSyncNodes('high')
    batchedSyncEdges('high')
  }
}, { deep: true, immediate: true })

// WATCHER: Also watch edges for external changes (optional safety)
watch(edges, (newEdges) => {
  if (newEdges.length === 0 && filteredTasks.value.length > 0 && !isSyncing.value) {
    // Edge case recovery
    batchedSyncEdges('normal')
  }
})



const vueFlowStore = ref(null)
useVueFlowStability(
  nodes,
  edges,
  vueFlowStore,
  {
    maxNodes: 1000,
    maxEdges: 2000,
    enablePerformanceMonitoring: true,
    enableAutoRecovery: true,
    recoveryAttempts: 3,
    debounceDelay: 100
  },
  isNodeDragging
)

// 🗃️ Vue Flow State Management System - Robust state synchronization and conflict resolution
useVueFlowStateManager(
  nodes,
  edges,
  {
    enableOptimisticUpdates: true,
    enableBatchUpdates: true,
    batchDelay: 50,
    enableStateValidation: true,
    enableConflictResolution: true
  },
  isNodeDragging
)

// 🚨 Vue Flow Error Handling System - Comprehensive error handling and recovery
// NOTE: enablePerformanceMonitoring disabled to fix 0-2 FPS issue (was creating RAF loop)
const vueFlowErrorHandling = useVueFlowErrorHandling({
  enableAutoRecovery: true,
  maxRetryAttempts: 3,
  enableUserNotifications: true,
  enableErrorLogging: false,
  enablePerformanceMonitoring: false
})

const withVueFlowErrorBoundary = (handlerName: string, handler: (...args: any[]) => any, options?: {
  errorType?: 'validation' | 'rendering' | 'interaction' | 'state' | 'performance' | 'network'
  severity?: 'low' | 'medium' | 'high' | 'critical'
  recoverable?: boolean
}) => {
  return vueFlowErrorHandling.createErrorHandler(
    handlerName,
    async (...args: any[]) => {
      return await handler(...args)
    },
    {
      errorType: options?.errorType || 'interaction',
      severity: options?.severity || 'medium',
      recoverable: options?.recoverable ?? true
    }
  )
}



// System health check for graceful degradation UI
const systemHealthy = computed(() => {
  return storeHealth.taskStore && storeHealth.canvasStore && storeHealth.uiStore
})

// Graceful degradation message for when stores are unavailable
const systemHealthMessage = computed(() => {
  const unavailableStores = []
  if (!storeHealth.taskStore) unavailableStores.push('Task Store')
  if (!storeHealth.canvasStore) unavailableStores.push('Canvas Store')
  if (!storeHealth.uiStore) unavailableStores.push('UI Store')

  if (unavailableStores.length === 0) return ''
  return `⚠️ System running in degraded mode. Unavailable: ${unavailableStores.join(', ')}`
})

// CPU Optimization: Memoized filtered tasks with canvas positions
let lastCanvasTasks: Task[] = []
let lastCanvasTasksHash = ''

const filteredTasksWithCanvasPosition = computed(() => {
  const tasks = filteredTasks.value
  if (!Array.isArray(tasks)) {
    return []
  }

  // Performance optimization: Cache filtered results
  const currentHash = tasks.map(t => `${t.id}:${t.title}:${t.description || ''}:${t.canvasPosition?.x || ''}:${t.canvasPosition?.y || ''}:${t.updatedAt?.getTime() ?? ''}`).join('|')
  if (currentHash === lastCanvasTasksHash && lastCanvasTasks.length > 0) {
    return lastCanvasTasks
  }

  // Optimized filtering with early return and minimal operations
  const result = []
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const pos = task.canvasPosition
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      result.push(task)
    }
  }

  lastCanvasTasksHash = currentHash
  lastCanvasTasks = result
  return result
})


const undoHistory = getUndoSystem()

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__canvasStore = canvasStore
}

// ============================================================================
// PHASE 1: INTERNAL ORGANIZATION (Zero Risk Refactoring)
// ============================================================================
// This section adds organizational comments to help identify code groups
// for potential extraction in later phases. No code is moved or changed.

// === MODAL STATE MANAGEMENT GROUP ===
// State: isEditModalOpen, selectedTask
//       isQuickTaskCreateOpen, isBatchEditModalOpen, batchEditTaskIds
// Location: Lines ~565-590 (modal states)

// === CONTEXT MENU STATE GROUP ===
// State: showCanvasContextMenu, showEdgeContextMenu, showNodeContextMenu
//       Various X/Y position variables
// Location: Lines ~590-620 (context menu states)

// === VUE FLOW CORE FUNCTIONS GROUP ===
// ⚠️ CRITICAL: These must NEVER be extracted - Vue Flow integration
// Functions: handleNodeDragStop, handleConnect, handleEdgeCreated, syncNodes, syncEdges
// State: All Vue Flow related state and bindings
// Location: Lines ~1030-1200 (Vue Flow event handlers)

// End of Phase 1 Organization Comments

// Task Edit Modal state
// Selection Logic (Extracted to useCanvasSelection)
const {
  selectedTask,
  isEditModalOpen,
  handleEditTask,
  closeEditModal,
  handleSelectionChange,
  clearSelection,
  getNodeColor
} = useCanvasSelection()


// Quick Task Create Modal state
const isQuickTaskCreateOpen = ref(false)
const quickTaskPosition = ref({ x: 0, y: 0 })

// Batch Edit Modal state
const isBatchEditModalOpen = ref(false)
const batchEditTaskIds = ref<string[]>([])

// Batch Edit Modal handlers
const closeBatchEditModal = () => {
  isBatchEditModalOpen.value = false
  batchEditTaskIds.value = []
}

const handleBatchEditApplied = () => {
  // Clear selection after batch edit is applied
  canvasStore.clearSelection()
  // TASK-089: Guard against sync during position lock
  if (!isAnyCanvasStateLocked()) {
    syncNodes()
  } else {
    console.log('🛡️ [TASK-089] syncNodes blocked in handleBatchEditApplied - canvas state locked')
  }
  closeBatchEditModal()
}

// Status filter helpers
const getStatusFilterLabel = (status: string | null): string => {
  if (!status) return ''
  const labels: Record<string, string> = {
    'done': 'Completed',
    'in_progress': 'In Progress',
    'planned': 'Planned',
    'backlog': 'Backlog',
    'on_hold': 'On Hold'
  }
  return labels[status] || status
}

const clearStatusFilter = () => {
  taskStore.setActiveStatusFilter(null)
}

// Section handlers
const handleSectionUpdate = (sectionData: Partial<CanvasSection>) => {
  if (sectionData.id) {
    canvasStore.updateSection(sectionData.id, sectionData)
  }
}

const handleSectionContextMenu = (event: MouseEvent, sectionData: { id: string; name: string; color: string }) => {
  event.preventDefault()
  event.stopPropagation()
  canvasContextMenuX.value = event.clientX
  canvasContextMenuY.value = event.clientY
  
  // Find the full section data from the store using the section ID
  const fullSection = canvasStore.sections.find(s => s.id === sectionData.id)

  if (fullSection) {
    canvasContextSection.value = fullSection
  } else {
    // BUG-091 FIX: Handle "ghost" sections that exist on canvas but not in store
    // Provide a partial section object so the menu can still open and allow deletion
    console.warn('👻 [CanvasView] Ghost section detected:', sectionData.id)
    canvasContextSection.value = {
      id: sectionData.id,
      name: sectionData.name || 'Unknown Group (Ghost)',
      color: sectionData.color || '#6366f1',
      position: { x: 0, y: 0, width: 300, height: 200 }, // Dummy values
      isCollapsed: false,
      items: [],
      type: 'custom'
    } as CanvasSection
  }

  showCanvasContextMenu.value = true
}

// Drag and drop handler
// ✅ VueFlow component reference - Defined early for NodeUpdateBatcher usage


// Register batcher with resource manager for cleanup
// resourceManager.setNodeBatcher(nodeUpdateBatcher) - FIX: Handled later

// Clean up any stale Vue Flow DOM nodes
// DISABLED: This function was causing all nodes to be removed due to direct DOM manipulation








// Drop handler handled in useCanvasEvents

// Section Settings Modal state
const isSectionSettingsOpen = ref(false)
const editingSectionId = ref<string | null>(null)
const editingSection = computed(() => {
  if (!editingSectionId.value) return null
  return canvasStore.sections.find(s => s.id === editingSectionId.value) || null
})

// Canvas Context Menu state
// Events & Interaction State extended
const {
  isConnecting,
  showCanvasContextMenu,
  canvasContextMenuX,
  canvasContextMenuY,
  canvasContextSection,
  showNodeContextMenu,
  nodeContextMenuX,
  nodeContextMenuY,
  selectedNode,
  showEdgeContextMenu,
  edgeContextMenuX,
  edgeContextMenuY,
  selectedEdgeId, // Note: CanvasView used 'selectedEdge' object ref, now ID based
  closeCanvasContextMenu,
  closeNodeContextMenu,
  closeEdgeContextMenu,
  handlePaneClick,
  handleCanvasRightClick,
  handlePaneContextMenu,
  handleDrop
} = useCanvasEvents(syncNodes)

// Mapped for template compatibility (if needed)
const selectedEdge = computed(() => 
  selectedEdgeId.value ? edges.value.find(e => e.id === selectedEdgeId.value) || null : null
)

// ✅ VueFlow component reference - Moved up


// Connection state tracking
// Connection state handled in useCanvasEvents



// System restart mechanism for critical failures


// Retry failed operation
const retryFailedOperation = async () => {
  if (!operationError.value?.retryable) {
    return
  }

  const { type } = operationError.value
  clearOperationError()

  switch (type) {
    case 'System Restart':
      await performSystemRestart()
      break
    case 'Sync Operation':
      setOperationLoading('syncing', true)
      try {
        await nextTick()
        // TASK-089: Guard against sync during position lock
        if (!isAnyCanvasStateLocked()) {
          syncNodes()
          syncEdges()
        } else {
          console.log('🛡️ [TASK-089] syncNodes blocked in Sync Operation retry - canvas state locked')
        }
        setOperationLoading('syncing', false)
      } catch (_error) {
        setOperationError('Sync Operation', 'Retry failed: Unable to synchronize data', true)
        setOperationLoading('syncing', false)
      }
      break
    default:
      console.warn(`[SYSTEM] No retry implementation for operation type: ${type}`)
  }
}

// Edge Context Menu state
// Edge Context Menu state handled in useCanvasEvents

// Edge disconnection tracking - prevent recently removed edges from being recreated


// Node Context Menu state (for sections)
// Node Context Menu state handled in useCanvasEvents

// Group Modal state (unified modal for create + edit with smart settings)
const isGroupModalOpen = ref(false)
const selectedGroup = ref<CanvasSection | null>(null)
const groupModalPosition = ref({ x: 100, y: 100 })

// Group Edit Modal state
const isGroupEditModalOpen = ref(false)
const selectedSectionForEdit = ref<CanvasSection | null>(null)

// Group Delete Confirmation Modal state
const isDeleteGroupModalOpen = ref(false)
const groupPendingDelete = ref<CanvasSection | null>(null)

// Delete group confirmation message
const deleteGroupMessage = computed(() => {
  if (!groupPendingDelete.value) return 'Delete this group?'
  return `Delete "${groupPendingDelete.value.name}" group? Tasks inside will remain on the canvas.`
})

// Bulk Delete Confirmation Modal state (for Shift+Delete on multiple items)
const isBulkDeleteModalOpen = ref(false)
const bulkDeleteItems = ref<{ id: string; name: string; type: 'task' | 'section' }[]>([])
const bulkDeleteIsPermanent = ref(false)

// Bulk delete confirmation message
const bulkDeleteMessage = computed(() => {
  const count = bulkDeleteItems.value.length
  if (count === 0) return ''

  const taskCount = bulkDeleteItems.value.filter(i => i.type === 'task').length
  const sectionCount = bulkDeleteItems.value.filter(i => i.type === 'section').length

  const parts: string[] = []
  if (taskCount > 0) parts.push(`${taskCount} task${taskCount > 1 ? 's' : ''}`)
  if (sectionCount > 0) parts.push(`${sectionCount} group${sectionCount > 1 ? 's' : ''}`)

  const itemsText = parts.join(' and ')

  if (bulkDeleteIsPermanent.value) {
    return `Permanently delete ${itemsText}? This cannot be undone.`
  } else {
    return `Remove ${itemsText} from canvas? Tasks will be moved to inbox.`
  }
})

// Bulk delete title
const bulkDeleteTitle = computed(() => {
  if (bulkDeleteIsPermanent.value) {
    return 'Delete Items Permanently'
  }
  return 'Remove from Canvas'
})

// Computed properties

// CPU Optimization: Cached computed properties for better performance
let lastHasNoTasks = false
let lastHasNoTasksLength = -1

const hasNoTasks = computed(() => {
  const currentLength = filteredTasks.value?.length || 0
  if (currentLength === lastHasNoTasksLength) {
    return lastHasNoTasks
  }
  lastHasNoTasksLength = currentLength
  lastHasNoTasks = currentLength === 0
  return lastHasNoTasks
})

// CPU Optimization: Cached tasks with canvas positions
let lastTasksWithCanvasPositions: Task[] = []
let lastTasksWithCanvasPositionsHash = ''

const tasksWithCanvasPositions = computed(() => {
  const tasks = filteredTasks.value
  if (!Array.isArray(tasks)) {
    return []
  }

  // Create hash from task IDs and canvas positions
  const currentHash = tasks.map(t => `${t.id}:${!!t.canvasPosition}`).join('|')
  if (currentHash === lastTasksWithCanvasPositionsHash) {
    return lastTasksWithCanvasPositions
  }

  // Optimized filtering
  const result = []
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].canvasPosition) {
      result.push(tasks[i])
    }
  }

  lastTasksWithCanvasPositionsHash = currentHash
  lastTasksWithCanvasPositions = result
  return result
})

// CPU Optimization: Cached inbox tasks check
let lastHasInboxTasks = false
let lastHasInboxTasksHash = ''

const _hasInboxTasks = computed(() => {
  const tasks = filteredTasks.value
  if (!Array.isArray(tasks)) {
    return false
  }

  // Create hash from relevant task properties
  const currentHash = tasks.map(t => `${t.id}:${!!t.canvasPosition}:${t.isInInbox}:${t.status}`).join('|')
  if (currentHash === lastHasInboxTasksHash) {
    return lastHasInboxTasks
  }

  // Optimized checking with early exit
  // Dec 16, 2025 FIX: ONLY check canvasPosition, IGNORE isInInbox
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (!task.canvasPosition && task.status !== 'done') {
      lastHasInboxTasksHash = currentHash
      lastHasInboxTasks = true
      return true
    }
  }

  lastHasInboxTasksHash = currentHash
  lastHasInboxTasks = false
  return false
})

// CPU Optimization: Cached dynamic node extent calculation
let lastDynamicNodeExtent: [[number, number], [number, number]] | null = null
let lastDynamicNodeExtentHash = ''

const dynamicNodeExtent = computed(() => {
  const tasks = filteredTasksWithCanvasPosition.value
  if (!tasks || !tasks.length) {
    const defaultExtent = [[-2000, -2000], [5000, 5000]] as [[number, number], [number, number]]
    if (!lastDynamicNodeExtent || lastDynamicNodeExtentHash !== 'empty') {
      lastDynamicNodeExtent = defaultExtent
      lastDynamicNodeExtentHash = 'empty'
    }
    return defaultExtent
  }

  // Create hash from task positions and count
  const currentHash = tasks.map(t => `${t.id}:${t.canvasPosition?.x || 0}:${t.canvasPosition?.y || 0}`).join('|')
  if (currentHash === lastDynamicNodeExtentHash && lastDynamicNodeExtent) {
    return lastDynamicNodeExtent
  }

  try {
    const contentBounds = canvasStore.calculateContentBounds(tasks)
    const padding = 1000

    // FIX: create compatible bounds object from store return value {x,y,width,height}
    // The store does NOT return minX/minY/maxX/maxY directly
    const bounds = {
      minX: contentBounds.x,
      minY: contentBounds.y,
      maxX: contentBounds.x + contentBounds.width,
      maxY: contentBounds.y + contentBounds.height
    }

    // Safety fallback if calculation failed
    if (isNaN(bounds.minX) || isNaN(bounds.maxX)) {
        bounds.minX = -2000
        bounds.minY = -2000
        bounds.maxX = 5000
        bounds.maxY = 5000
    }

    // Expand bounds significantly to allow for extreme zoom levels
    const expandedBounds = {
      minX: bounds.minX - padding * 10,
      minY: bounds.minY - padding * 10,
      maxX: bounds.maxX + padding * 10,
      maxY: bounds.maxY + padding * 10
    }

    const result = [
      [expandedBounds.minX, expandedBounds.minY],
      [expandedBounds.maxX, expandedBounds.maxY]
    ] as [[number, number], [number, number]]

    lastDynamicNodeExtent = result
    lastDynamicNodeExtentHash = currentHash
    return result
  } catch (error) {
    console.warn('⚠️ [COMPUTED] Error calculating dynamic node extent:', error)
    const fallbackExtent = [[-2000, -2000], [5000, 5000]] as [[number, number], [number, number]]
    lastDynamicNodeExtent = fallbackExtent
    lastDynamicNodeExtentHash = 'error'
    return fallbackExtent
  }
})

// Glass morphism corner handles - Modern minimal style
const _resizeHandleStyle = computed(() => ({
  width: '10px',
  height: '10px',
  borderRadius: '3px',  // Rounded square (Figma/Linear style)
  background: 'rgba(255, 255, 255, 0.3)',  // Translucent white glass
  border: '1.5px solid rgba(99, 102, 241, 0.6)',  // Accent border
  backdropFilter: 'blur(8px)',  // Glass effect
  WebkitBackdropFilter: 'blur(8px)',  // Safari support
  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
}))






// Register custom node types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes = markRaw({
  taskNode: TaskNode,
  sectionNode: GroupNodeSimple
}) as any // Type cast needed for Vue Flow compatibility

// Vue Flow initialization logic MOVED UP
// Reference: useVueFlow, nodes/edges refs, resourceManager, stability/error systems moved before syncNodes

// 🚀 Phase 2: Vue Flow Integration & Canvas Positioning - Add VueUse composables
const { width, height } = useWindowSize()
const { ctrl: _ctrl, shift } = useMagicKeys()

// 🚀 CPU Optimization: Efficient Node Update Batching System
// Extracted to src/utils/canvas/NodeUpdateBatcher.ts
// MOVED: nodeUpdateBatcher initialization moved to after vueFlowRef declaration
// const nodeUpdateBatcher = new NodeUpdateBatcher(vueFlowRef) - FIX: Initialized later

// Register batcher with resource manager for cleanup
// resourceManager.setNodeBatcher(nodeUpdateBatcher) - FIX: Handled later

// 🚀 CPU Optimization: Efficient Node Update Batching System
// Extracted to src/utils/canvas/NodeUpdateBatcher.ts
// MOVED: nodeUpdateBatcher initialization moved to after vueFlowRef declaration
// const nodeUpdateBatcher = new NodeUpdateBatcher(vueFlowRef) - FIX: Initialized later

// 🚀 Optimized Sync Logic MOVED UP to fix TDZ issues
// Reference: syncNodes, syncEdges, batching logic moved before useCanvasEvents

// 🚀 Phase 2: Actions & Connections (Extracted)

// Canvas context menu handlers
// Canvas context menu handlers logic handled via useCanvasEvents
// closeCanvasContextMenu removed (duplicate)

const {
  createTaskHere,
  handleQuickTaskCreate,
  closeQuickTaskCreate,
  createGroup,
  closeGroupModal,
  handleGroupCreated,
  handleGroupUpdated,
  editGroup,
  closeGroupEditModal,
  handleGroupEditSave,
  deleteGroup,
  confirmDeleteGroup,
  cancelDeleteGroup,
  moveSelectedTasksToInbox,
  deleteSelectedTasks,
  handleNodeContextMenu,
  // closeNodeContextMenu, // Provided by useCanvasEvents
  deleteNode,
  handleKeyDown,
  confirmBulkDelete,
  cancelBulkDelete
} = useCanvasActions(
  {
    viewport,
    batchedSyncNodes,
    syncNodes,
    closeCanvasContextMenu,

    closeEdgeContextMenu,
    closeNodeContextMenu, // Provided by useCanvasEvents
  },
  {
    isQuickTaskCreateOpen,
    quickTaskPosition,
    showCanvasContextMenu,
    canvasContextMenuX,
    canvasContextMenuY,
    canvasContextSection,
    isGroupModalOpen,
    selectedGroup,
    groupModalPosition,
    isGroupEditModalOpen,
    selectedSectionForEdit,
    isDeleteGroupModalOpen,
    groupPendingDelete,
    selectedNode,
    showNodeContextMenu,
    nodeContextMenuX,
    nodeContextMenuY,
    filteredTasks: filteredTasks as any,
    // Fix: Add missing bulk delete state refs
    isBulkDeleteModalOpen,
    bulkDeleteItems,
    bulkDeleteIsPermanent
  },
  undoHistory
)

const {
  handleNodeDragStart,
  handleNodeDragStop,
  handleNodeDrag
} = useCanvasDragDrop({
  taskStore,
  canvasStore,
  nodes,
  filteredTasks,
  withVueFlowErrorBoundary,
  syncNodes,
  updateNodeData // TASK-072: Vue Flow's official API for reactive node data updates
}, {
  isNodeDragging
})

const {
  handleConnectStart,
  handleConnectEnd,
  handleConnect,
  disconnectEdge,
  handleEdgeContextMenu,
  // closeEdgeContextMenu - Provided by useCanvasEvents
} = useCanvasConnections(
  {
    syncEdges,
    closeCanvasContextMenu,
    closeEdgeContextMenu: () => showEdgeContextMenu.value = false,
    closeNodeContextMenu,
    addTimer: (id) => resourceManager.addTimer(id),
    withVueFlowErrorBoundary
  },
  {
    isConnecting,
    recentlyRemovedEdges,
    showEdgeContextMenu,
    edgeContextMenuX,
    edgeContextMenuY,
    selectedEdge
  }
)

// Typed wrapper for handleConnect to satisfy Vue Flow's type requirements
const typedHandleConnect = handleConnect as (connection: Connection) => void

// Legacy throttled function for backward compatibility
const _throttledSyncNodes = () => batchedSyncNodes('normal')

// Legacy debounced functions for backward compatibility
const _debouncedSyncNodes = () => batchedSyncNodes('normal')
const _debouncedSyncEdges = () => batchedSyncEdges('normal')

// Setup Vue Flow edge event handlers for proper disconnection functionality
onEdgeClick((param: EdgeMouseEvent) => {
  const { event, edge } = param
  console.log('🔍 COMPOSABLE HANDLER - Raw parameters:', {
    event,
    edge,
    eventIsEvent: event instanceof Event,
    edgeType: typeof edge,
    eventKeys: event ? Object.keys(event) : 'event is null/undefined',
    eventType: event?.type
  })

  // Vue Flow sometimes doesn't pass the edge parameter, extract it from event
  // Extended event type for Vue Flow edge events
  const extendedEvent = event as unknown as EdgeMouseEvent & { edge?: Edge; selected?: { edge?: Edge } }
  const actualEdge = edge || extendedEvent.edge || extendedEvent.selected?.edge

  console.log('🖱️ Edge click detected:', {
    shiftKey: (event as MouseEvent).shiftKey,
    edgeId: actualEdge?.id,
    source: actualEdge?.source,
    target: actualEdge?.target,
    edgeExists: !!actualEdge,
    eventType: event.type
  })

  // Guard against undefined edge parameter
  if (!actualEdge) {
    console.warn('⚠️ Edge click event received but edge parameter is undefined, available event data:', {
      event,
      hasEdge: !!extendedEvent.edge,
      hasSelected: !!extendedEvent.selected,
      selectedEdge: extendedEvent.selected?.edge
    })
    return
  }

  console.log('✅ Successfully extracted edge data from click event:', {
    id: actualEdge?.id,
    source: actualEdge?.source,
    target: actualEdge?.target
  })

  // Check for Shift+click on edge (immediate disconnection)
  if (event.shiftKey) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    console.log('🔗 Shift+click confirmed on edge - disconnecting immediately:', actualEdge?.id)

    // Add edge to recently removed set to prevent recreation during sync
    recentlyRemovedEdges.value.add(actualEdge?.id)

    // Clear the blocklist after a short delay to prevent memory leaks - using resourceManager
    const timerId = setTimeout(() => {
      recentlyRemovedEdges.value.delete(actualEdge?.id)
    }, 2000) // 2 seconds should be enough for the sync to complete
    resourceManager.addTimer(timerId as unknown as number)

    // Use Vue Flow's removeEdges action for clean removal
    removeEdges(actualEdge?.id)

    // Update task dependencies
    const targetTask = taskStore.tasks.find(t => t.id === actualEdge?.target)
    if (targetTask && targetTask.dependsOn) {
      const updatedDependsOn = targetTask.dependsOn.filter(id => id !== actualEdge?.source)
      taskStore.updateTaskWithUndo(targetTask.id, { dependsOn: updatedDependsOn })

      // Call syncEdges but it will now respect the recentlyRemovedEdges blocklist
      syncEdges()

      console.log('✅ Shift+click task dependencies updated:', {
        taskId: targetTask.id,
        oldDependsOn: targetTask.dependsOn,
        newDependsOn: updatedDependsOn,
        blockedEdgeId: actualEdge?.id
      })
    }
  }
})

onEdgeContextMenu((param: EdgeMouseEvent) => {
  const { event, edge } = param
  console.log('🖱️ Edge context menu detected (composable handler):', {
    event,
    edge,
    hasEdge: !!edge,
    eventType: event?.type,
    eventTarget: event?.target
  })

  // Vue Flow sometimes doesn't pass the edge parameter, extract it from event
  // Extended event type for Vue Flow edge events
  const extendedEvent = event as unknown as EdgeMouseEvent & { edge?: Edge; selected?: { edge?: Edge } }
  const actualEdge = edge || extendedEvent.edge || extendedEvent.selected?.edge

  // Guard against undefined edge parameter
  if (!actualEdge) {
    console.warn('⚠️ Edge context menu event received but edge parameter is undefined, available event data:', {
      event,
      hasEdge: !!extendedEvent.edge,
      hasSelected: !!extendedEvent.selected,
      selectedEdge: extendedEvent.selected?.edge
    })
    return
  }

  console.log('✅ Successfully extracted edge data from context menu event:', {
    id: actualEdge?.id,
    source: actualEdge?.source,
    target: actualEdge?.target
  })

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  edgeContextMenuX.value = (event as MouseEvent).clientX
  edgeContextMenuY.value = (event as MouseEvent).clientY
  selectedEdgeId.value = actualEdge ? actualEdge.id : null // FIX: Use ID ref from useCanvasEvents
  showEdgeContextMenu.value = true
  closeCanvasContextMenu()
  closeNodeContextMenu()

  console.log('✅ Edge context menu should be visible at:', {
    x: edgeContextMenuX.value,
    y: edgeContextMenuY.value,
    edgeId: actualEdge.id
  })
})

// Safe nodes/edges computed removed for performance - using nodes/edges refs directly
// Data integrity is managed in useCanvasSync.ts and handleNodesChange/handleEdgesChange


// Track if we've done initial viewport centering
const hasInitialFit = ref(false)

// Track if canvas is ready to display (prevents flash during initial fitView)
const isCanvasReady = ref(false)

// Track if Vue Flow is ready for operations (fixes alignment tools timing issues)
const isVueFlowReady = ref(false)

// Track if Vue Flow component is mounted (separate from viewport centering)
const isVueFlowMounted = ref(false)





// CPU Optimization: Watch for filtered task changes with intelligent batching
// NOTE: Console logs removed to fix 0-2 FPS issue (was causing 12,000+ logs/sec)
// FIX: Using string-based hash instead of deep:true to prevent infinite loops
// deep:true on task arrays causes cascading updates because it triggers on ANY nested property change
resourceManager.addWatcher(
  watch(
    () => filteredTasks.value.map(t => `${t.id}:${t.title}:${t.description || ''}:${t.isInInbox}:${t.canvasPosition?.x}:${t.canvasPosition?.y}:${t.updatedAt?.getTime() ?? ''}`).join('|'),
    () => {
      batchedSyncNodes('high')
      batchedSyncEdges('high')
    }
  )
)

// CPU Optimization: Watch sections with smart batching
resourceManager.addWatcher(
  watch(() => canvasStore.sections.map(s => s.id).join(','), () => {
    batchedSyncNodes('normal')
  })
)

// CPU Optimization: Watch section collapse state changes with high priority (affects layout)
// FIX: Using string-based comparison instead of deep:true on object arrays to prevent infinite loops
resourceManager.addWatcher(
  watch(
    () => canvasStore.sections.map(s => `${s.id}:${s.isCollapsed}`).join('|'),
    () => {
      batchedSyncNodes('high')
    }
  )
)

// CPU Optimization: Watch task position changes with smart batching (low priority - only visual)
// FIX: Using string-based comparison instead of deep:true on object arrays
// deep:true on map() results causes infinite loops because map() creates new object references
resourceManager.addWatcher(
  watch(
    () => taskStore.tasks.map(t => `${t.id}:${t.canvasPosition?.x ?? ''}:${t.canvasPosition?.y ?? ''}`).join('|'),
    () => {
      batchedSyncNodes('low')
    }
  )
)

// FIX: Watch for isInInbox changes - triggers sync when tasks move between inbox and canvas
// This was missing and caused tasks dragged from inbox to not appear until refresh
// Using flush: 'post' to ensure sync runs after Vue has processed all reactive updates
// FIX: Using string-based comparison instead of deep:true on object arrays to prevent infinite loops
resourceManager.addWatcher(
  watch(
    () => taskStore.tasks.map(t => `${t.id}:${t.isInInbox}`).join('|'),
    () => {
      batchedSyncNodes('high')
    },
    { flush: 'post' }
  )
)

// FIX: Watch for sync requests from external systems (undo/redo)
// This allows the undo system to trigger a canvas refresh after restoring tasks
resourceManager.addWatcher(
  watch(
    () => canvasStore.syncTrigger,
    (newTrigger) => {
      if (newTrigger > 0) {
        // TASK-089: Guard against sync during position lock
        if (!isAnyCanvasStateLocked()) {
          // console.log('🔄 [CANVAS] Sync triggered by external request (undo/redo)')
          syncNodes()
        } else {
          console.log('🛡️ [TASK-089] syncNodes blocked in syncTrigger watcher - canvas state locked')
        }
      }
    }
  )
)

// FIX: Watch for task visual property changes (title, status, priority)
// Using hash-based approach (validated by Perplexity as more efficient than deep:true on objects)
// NO deep:true needed - single string comparison, zero garbage collection
resourceManager.addWatcher(
  watch(
    () => (isInteracting.value ? null : taskStore.tasks.map(t => `${t.id}:${t.title}:${t.status}:${t.priority}`).join('|')),
    (val) => {
      if (val) batchedSyncNodes('normal')
    },
    { flush: 'post' }
  )
)

// Watch for canvas store selection changes and sync with Vue Flow nodes - FIXED to prevent disconnection
// NOTE: Console logs reduced to fix 0-2 FPS issue
resourceManager.addWatcher(
  watch(() => (isInteracting.value ? null : canvasStore.selectedNodeIds), (newSelectedIds) => {
    if (!newSelectedIds) return
    // Update Vue Flow nodes to match canvas store selection
    nodes.value.forEach(node => {
      const shouldBeSelected = newSelectedIds.includes(node.id)
      const nodeWithSelection = node as Node & { selected?: boolean }
      if (nodeWithSelection.selected !== shouldBeSelected) {
        nodeWithSelection.selected = shouldBeSelected
      }
    })
  }, { deep: true, flush: 'post' }) // Changed from 'sync' to 'post' to batch updates
)

// Redundant watcher removed - selection is handled by @selection-change="handleSelectionChange"


// Auto-center viewport on tasks when all nodes are initialized with dimensions - using resourceManager
// Uses Vue Flow's recommended useNodesInitialized composable for reliable timing
// FIX: Also handle case where nodes array is empty (nodesInitialized won't fire with 0 nodes)
resourceManager.addWatcher(
  watch([nodesInitialized, () => nodes.value.length], async ([initialized, nodeCount]) => {
    // Skip if already initialized
    if (hasInitialFit.value) return

    // Case 1: Nodes exist and are all initialized - center viewport
    if (initialized && nodeCount > 0) {
      console.log('✅ [CANVAS] All nodes initialized, auto-centering viewport (ONCE)')
      // Position viewport instantly (duration: 0 prevents visible animation/flash)
      vueFlowFitView({ padding: 0.2, duration: 0 })
      hasInitialFit.value = true
      // Wait for viewport transform to complete, then reveal canvas
      await nextTick()
      isCanvasReady.value = true
      isVueFlowReady.value = true
      console.log('✅ Canvas ready and centered on tasks')
      console.log('🎯 Vue Flow ready for alignment operations')
    }
    // Case 2: No nodes exist - still mark canvas as ready (empty canvas is valid)
    else if (nodeCount === 0 && !isCanvasReady.value) {
      console.log('📭 Canvas has no nodes - marking as ready (empty canvas)')
      hasInitialFit.value = true
      isCanvasReady.value = true
      isVueFlowReady.value = true
      console.log('✅ Empty canvas ready for interaction')
    }
  }, { immediate: true })
)

// 🚀 REMOVED: Auto-positioning watcher that was forcing all tasks onto canvas
// OLD: watch(filteredTasks, () => { throttledSyncNodes() }, { deep: true })
// REASON: This was causing all tasks to get canvasPosition assigned, preventing inbox tasks
// NEW: Canvas sync only happens when explicitly needed (drag-drop, right-click, etc.)

// TASK-076: Watch hideCanvasDoneTasks toggle to refresh canvas nodes
// This ensures clicking the Done toggle immediately shows/hides completed tasks on canvas
resourceManager.addWatcher(
  watch(hideCanvasDoneTasks, (newVal, oldVal) => {
    if (newVal !== oldVal) {
      console.log('🔄 [TASK-076] hideCanvasDoneTasks changed:', { from: oldVal, to: newVal })
      // TASK-089: Guard against sync during position lock
      if (!isAnyCanvasStateLocked()) {
        // Force immediate sync to update canvas nodes with new filter
        syncNodes()
      } else {
        console.log('🛡️ [TASK-089] syncNodes blocked in hideCanvasDoneTasks - canvas state locked')
      }
    }
  })
)

// TASK-082: Watch hideCanvasOverdueTasks toggle to refresh canvas nodes
// This ensures clicking the Overdue toggle immediately shows/hides overdue tasks on canvas
resourceManager.addWatcher(
  watch(hideCanvasOverdueTasks, (newVal, oldVal) => {
    if (newVal !== oldVal) {
      console.log('🔄 [TASK-082] hideCanvasOverdueTasks changed:', { from: oldVal, to: newVal })
      // TASK-089: Guard against sync during position lock
      if (!isAnyCanvasStateLocked()) {
        // Force immediate sync to update canvas nodes with new filter
        syncNodes()
      } else {
        console.log('🛡️ [TASK-089] syncNodes blocked in hideCanvasOverdueTasks - canvas state locked')
      }
    }
  })
)

// CPU Optimization: Watch sections with batching
// NOTE: Console log removed to fix 0-2 FPS issue
// FIX: Removed duplicate section watcher that used deep:true causing infinite loops
// Section changes are already handled by:
// - Line 2008: watch(() => canvasStore.sections.map(s => s.id).join(','), ...) - section ID changes
// - Line 2011: watch(() => canvasStore.sections.map(s => `${s.id}:${s.isCollapsed}`).join('|'), ...) - collapse changes

// CPU Optimization: Debounced viewport watch to prevent excessive updates
const debouncedViewportUpdate = useDebounceFn(() => {
  nextTick(() => {
    const vueFlowInstance = vueFlowRef.value as { updateNodeInternals?: () => void } | null
    vueFlowInstance?.updateNodeInternals?.()
  })
}, 50) // 50ms debounce for viewport changes

// CPU Optimization: Debounced window resize handler with smart batching
const debouncedResizeSync = useDebounceFn(() => {
  batchedSyncNodes('low') // Low priority for resize events
}, 150) // 150ms debounce for resize events

// Register debounced functions with resource manager for cleanup
resourceManager.addCleanupCallback(() => {
  // VueUse debounced functions cleanup - useDebounceFn returns function with cancel method
  const viewportFn = debouncedViewportUpdate as { cancel?: () => void }
  if (typeof viewportFn.cancel === 'function') {
    viewportFn.cancel()
  }
  const resizeFn = debouncedResizeSync as { cancel?: () => void }
  if (typeof resizeFn.cancel === 'function') {
    resizeFn.cancel()
  }
})

resourceManager.addWatcher(
  watch(viewport, () => {
    debouncedViewportUpdate()
  }, { deep: true })
)

resourceManager.addWatcher(
  watch([width, height], ([newWidth, newHeight]) => {
    // Only regenerate if we have a significant size change
    if (newWidth > 0 && newHeight > 0) {
      debouncedResizeSync()
    }
  })
)

// Helper: Collect matching inbox tasks into a section
const collectTasksForSection = (sectionId: string) => {
  console.log(`[Auto-Collect] 🧲 Magnet clicked for section: ${sectionId}`)

  const section = canvasStore.sections.find(s => s.id === sectionId)
  if (!section) {
    console.error(`[Auto-Collect] ❌ Section ${sectionId} not found`)
    return
  }

  console.log(`[Auto-Collect] Section:`, {
    name: section.name,
    type: section.type,
    propertyValue: section.propertyValue,
    autoCollect: section.autoCollect
  })

  // Get tasks currently in inbox ONLY (not canvas tasks, excluding done tasks)
  // Dec 16, 2025 FIX: ONLY check canvasPosition, IGNORE isInInbox
  const inboxTasks = Array.isArray(filteredTasks.value) ? filteredTasks.value.filter(t =>
    !t.canvasPosition && t.status !== 'done'
  ) : []

  console.log(`[Auto-Collect] Inbox has ${inboxTasks.length} tasks:`, inboxTasks.map(t => ({
    title: t.title,
    priority: t.priority,
    status: t.status
  })))

  // Find tasks that match this section's criteria
  const matchingTasks = inboxTasks.filter(task => {
    const matches = canvasStore.taskMatchesSection(task, section)
    console.log(`[Auto-Collect]   "${task.title}": priority=${task.priority}, wants=${section.propertyValue}, match=${matches}`)
    return matches
  })

  if (matchingTasks.length === 0) {
    console.log(`[Auto-Collect] ⚠️ No matching tasks`)
    return
  }

  console.log(`[Auto-Collect] ✓ Placing ${matchingTasks.length} tasks`)

  // Auto-place matching tasks in section
  matchingTasks.forEach((task, index) => {
    const {x, y} = section.position
    const col = index % 3
    const row = Math.floor(index / 3)
    const newX = x + 20 + (col * 220)
    const newY = y + 60 + (row * 120)

    console.log(`[Auto-Collect]   Placing "${task.title}" at (${newX}, ${newY})`)

    taskStore.updateTaskWithUndo(task.id, {
      canvasPosition: { x: newX, y: newY },
      isInInbox: false
    })
  })
}

// Note: Auto-collect is triggered manually via magnet button (@collect event in SectionNodeSimple)
// No automatic watcher needed - prevents infinite recursion

// Enhanced error boundary wrapper for Vue Flow operations using comprehensive error handling

// Enhanced error boundary wrapper for Vue Flow operations using comprehensive error handling


// handleNodeDragStart, handleNodeDragStop, handleNodeDrag extracted to useCanvasDragDrop.ts

// Handle nodes change (for selection tracking and resize) - FIXED to prevent position updates during resize
const handleNodesChange = withVueFlowErrorBoundary('handleNodesChange', (changes: Array<{ type: string; id?: string; dimensions?: { width: number; height: number } }>) => {
  changes.forEach((change) => {
    // Track selection changes - FIXED to maintain group connection
    if (change.type === 'select') {
      const currentSelected = nodes.value.filter(n => 'selected' in n && n.selected).map(n => n.id)

      // Only update canvas store if selection actually changed to prevent disconnection
      const selectedChanged = JSON.stringify(currentSelected) !== JSON.stringify(canvasStore.selectedNodeIds)
      if (selectedChanged) {
        canvasStore.setSelectedNodes(currentSelected)
      }
    }

    // Handle section resize - ONLY update dimensions, not position, and prevent during active resize
    if (change.type === 'dimensions' && change.id && change.id.startsWith('section-')) {
      // FIX: Guard against sync-triggered dimension updates causing infinite loops
      if (isSyncing.value || isHandlingNodeChange.value) {
        return
      }

      const sectionId = change.id.replace('section-', '')

      // Skip dimension updates during active resize to prevent coordinate conflicts
      if (resizeState.value.isResizing && resizeState.value.sectionId === sectionId) {
        return // Don't update during resize - let resize handlers manage it
      }

      const node = nodes.value.find(n => n.id === change.id)
      if (node && change.dimensions) {
        // Update ONLY width and height, preserve position
        const currentSection = canvasStore.sections.find(s => s.id === sectionId)
        if (currentSection) {
          // FIX: Add tolerance check to prevent rounding errors triggering updates
          const widthDiff = Math.abs(currentSection.position.width - change.dimensions.width)
          const heightDiff = Math.abs(currentSection.position.height - change.dimensions.height)

          if (widthDiff < 1 && heightDiff < 1) {
            return
          }

          canvasStore.updateSectionWithUndo(sectionId, {
            position: {
              x: currentSection.position.x, // Preserve current position
              y: currentSection.position.y, // Preserve current position
              width: change.dimensions.width,
              height: change.dimensions.height
            }
          })
        }
      }
    }

    // Prevent position updates for sections during resize
    if (change.type === 'position' && change.id && change.id.startsWith('section-')) {
      const sectionId = change.id.replace('section-', '')
      if (resizeState.value.isResizing && resizeState.value.sectionId === sectionId) {
        return // Skip position updates during resize
      }
    }
  })
})

// Handle resize start with enhanced state tracking - FIXED to prevent coordinate conflicts
const _handleResizeStart = (event: Node | { node?: Node; direction?: string }) => {
  console.log('🔧 Resize start:', event)
  const node = ('node' in event && event.node) ? event.node : event as Node

  if (node && 'id' in node && node.id && node.id.startsWith('section-')) {
    const sectionId = node.id.replace('section-', '')
    const section = canvasStore.sections.find(s => s.id === sectionId)

    if (section) {
      // Initialize resize state with proper bounds checking and enhanced tracking
      // BUG-019 FIX: Initialize currentX/currentY for live position tracking
      resizeState.value = {
        isResizing: true,
        sectionId,
        startX: section.position.x || 0,
        startY: section.position.y || 0,
        startWidth: Math.max(200, Math.min(1200, section.position.width)),
        startHeight: Math.max(150, Math.min(800, section.position.height)),
        currentX: section.position.x || 0, // BUG-019: Track live X position
        currentY: section.position.y || 0, // BUG-019: Track live Y position
        currentWidth: Math.max(200, Math.min(1200, section.position.width)),
        currentHeight: Math.max(150, Math.min(800, section.position.height)),
        handlePosition: ('direction' in event ? event.direction : undefined) || 'se',
        isDragging: false,
        resizeStartTime: Date.now()
      }

      // Add visual feedback classes and ensure handles stay visible
      // Find the node element - Vue Flow nodes don't have data-id attribute
      const allSectionNodes = document.querySelectorAll('.vue-flow__node-sectionNode')
      let nodeElement: HTMLElement | null = null

      // If there's only one section node, use it; otherwise try to match by selection state
      if (allSectionNodes.length === 1) {
        nodeElement = allSectionNodes[0] as HTMLElement
      } else {
        // Find the selected section node
        nodeElement = document.querySelector('.vue-flow__node-sectionNode.selected') as HTMLElement
        // Fallback: find by checking all nodes
        if (!nodeElement && allSectionNodes.length > 0) {
          nodeElement = allSectionNodes[0] as HTMLElement
        }
      }

      if (nodeElement) {
        nodeElement.classList.add('resizing')
        // Let CSS handle visibility - don't force inline styles
      }
    }
  }
}

// Handle resize with real-time preview - FIXED to prevent coordinate conflicts
// BUG-019 FIX: Also track live position for correct preview positioning
interface ResizeEventData {
  node?: Node & { style?: { width?: string; height?: string }; position?: { x: number; y: number } }
  params?: { x?: number; y?: number }
}
const _handleResize = (event: ResizeEventData) => {
  if (!resizeState.value.isResizing || !resizeState.value.sectionId) return

  const node = event.node
  if (node && node.style) {
    // Calculate dimensions more reliably to prevent coordinate conflicts
    let newWidth = parseInt(String(node.style.width)) || resizeState.value.startWidth
    let newHeight = parseInt(String(node.style.height)) || resizeState.value.startHeight

    // Apply bounds constraints immediately to prevent invalid states
    newWidth = Math.max(200, Math.min(1200, newWidth))
    newHeight = Math.max(150, Math.min(800, newHeight))

    // Update current dimensions for preview
    resizeState.value.currentWidth = newWidth
    resizeState.value.currentHeight = newHeight

    // BUG-019 FIX: Track live position from NodeResizer params or node.position
    // When resizing from left/top edges, the position changes
    if (event.params) {
      // NodeResizer provides x, y in params when position changes
      if (typeof event.params.x === 'number') {
        resizeState.value.currentX = event.params.x
      }
      if (typeof event.params.y === 'number') {
        resizeState.value.currentY = event.params.y
      }
    } else if (node.position) {
      // Fallback: get position from node directly
      resizeState.value.currentX = node.position.x ?? resizeState.value.currentX
      resizeState.value.currentY = node.position.y ?? resizeState.value.currentY
    }
  }
}

// Handle resize end with cleanup and validation - FIXED to prevent coordinate conflicts
const _handleResizeEnd = (event: Node | { node?: Node }) => {
  console.log('🔧 Resize end:', event)
  const node = ('node' in event && event.node) ? event.node : event as Node

  if (node && 'id' in node && node.id && node.id.startsWith('section-')) {
    const sectionId = node.id.replace('section-', '')

    // Find the node element - Vue Flow nodes don't have data-id attribute
    // Instead, find by class and match the selected node
    const allSectionNodes = document.querySelectorAll('.vue-flow__node-sectionNode')
    let nodeElement: HTMLElement | null = null

    // If there's only one section node, use it; otherwise try to match by selection state
    if (allSectionNodes.length === 1) {
      nodeElement = allSectionNodes[0] as HTMLElement
    } else {
      // Find the selected section node
      nodeElement = document.querySelector('.vue-flow__node-sectionNode.selected') as HTMLElement
      // Fallback: find by checking all nodes
      if (!nodeElement && allSectionNodes.length > 0) {
        nodeElement = allSectionNodes[0] as HTMLElement
      }
    }

    // Remove visual feedback - let CSS handle handle visibility
    if (nodeElement) {
      nodeElement.classList.remove('resizing')
    }

    // Update section dimensions in store - preserve position
    if (resizeState.value.sectionId === sectionId) {
      const currentSection = canvasStore.sections.find(s => s.id === sectionId)
      if (currentSection) {
        // Use current dimensions from resize state, not from node.style to avoid coordinate conflicts
        const validatedWidth = Math.max(200, Math.min(1200, resizeState.value.currentWidth))
        const validatedHeight = Math.max(150, Math.min(800, resizeState.value.currentHeight))

        // Preserve original position, only update dimensions
        canvasStore.updateSectionWithUndo(sectionId, {
          position: {
            x: currentSection.position.x, // Preserve original position
            y: currentSection.position.y, // Preserve original position
            width: validatedWidth,
            height: validatedHeight
          }
        })
      }
    }

    // Reset resize state with enhanced cleanup
    resizeState.value = {
      isResizing: false,
      sectionId: null,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
      currentX: 0, // BUG-019
      currentY: 0, // BUG-019
      currentWidth: 0,
      currentHeight: 0,
      handlePosition: null,
      isDragging: false,
      resizeStartTime: 0
    }
  }
}

// New NodeResizer event handlers with comprehensive logging
const handleSectionResizeStart = ({ sectionId, event: _event }: { sectionId: string; event: unknown }) => {
  // Capture original section position to track position changes during resize
  const section = canvasStore.sections.find(s => s.id === sectionId)
  if (section) {
    resizeState.value = {
      isResizing: true,
      sectionId: sectionId,
      startX: section.position.x,
      startY: section.position.y,
      startWidth: section.position.width,
      startHeight: section.position.height,
      currentX: section.position.x, // BUG-019: Track live position
      currentY: section.position.y, // BUG-019: Track live position
      currentWidth: section.position.width,
      currentHeight: section.position.height,
      handlePosition: null,
      isDragging: false,
      resizeStartTime: Date.now()
    }
    console.log('🎬 [Resize] Started:', {
      sectionId,
      startX: section.position.x,
      startY: section.position.y,
      startWidth: section.position.width,
      startHeight: section.position.height
    })
  }
}

const handleSectionResize = ({ sectionId, event }: { sectionId: string; event: unknown }) => {
  // NodeResizer provides dimensions in event.params as { width, height, x, y }
  const typedEvent = event as { params?: { width?: number; height?: number; x?: number; y?: number }; width?: number; height?: number }
  const width = typedEvent?.params?.width || typedEvent?.width
  const height = typedEvent?.params?.height || typedEvent?.height

  if (width && height) {
    // Update resize state for real-time preview overlay
    resizeState.value.currentWidth = width
    resizeState.value.currentHeight = height

    // BUG-050 FIX: Always read position from Vue Flow node (source of truth)
    // This fixes ghost preview positioning when event.params.x/y are not provided
    // (e.g., when resizing from right/bottom edges where position doesn't change)
    const vueFlowNode = findNode(`section-${sectionId}`)
    if (vueFlowNode) {
      resizeState.value.currentX = vueFlowNode.position.x
      resizeState.value.currentY = vueFlowNode.position.y
    } else {
      // Fallback to event params if node not found
      if (typeof typedEvent?.params?.x === 'number') {
        resizeState.value.currentX = typedEvent.params.x
      }
      if (typeof typedEvent?.params?.y === 'number') {
        resizeState.value.currentY = typedEvent.params.y
      }
    }
  }
}

const handleSectionResizeEnd = ({ sectionId, event }: { sectionId: string; event: unknown }) => {
  console.log('🎯 [CanvasView] Section resize END:', {
    sectionId,
    eventKeys: event ? Object.keys(event) : [],
    rawEvent: event
  })

  // Get the actual Vue Flow node to get its final position after resize
  const vueFlowNode = findNode(`section-${sectionId}`)

  if (!vueFlowNode) {
    console.error('❌ [CanvasView] Vue Flow node not found:', sectionId)
    return
  }

  // NodeResizer provides dimensions in event.params
  const typedEvent = event as { params?: { width?: number; height?: number }; width?: number; height?: number }
  const width = typedEvent?.params?.width || typedEvent?.width
  const height = typedEvent?.params?.height || typedEvent?.height

  // Use the node's actual position from Vue Flow (this is what NodeResizer updates)
  // BUG-055 FIX: For nested groups, Vue Flow position is RELATIVE to parent.
  // We need to convert back to ABSOLUTE for store.
  let newX = vueFlowNode.position.x
  let newY = vueFlowNode.position.y

  // Check if this is a nested group by looking up the section in store
  const sectionForParentCheck = canvasStore.sections.find(s => s.id === sectionId)
  if (sectionForParentCheck?.parentGroupId) {
    // This is a nested group - convert relative to absolute
    const parentGroup = canvasStore.sections.find(s => s.id === sectionForParentCheck.parentGroupId)
    if (parentGroup) {
      newX = vueFlowNode.position.x + parentGroup.position.x
      newY = vueFlowNode.position.y + parentGroup.position.y
      console.log('🔄 [BUG-055] Converted nested group position from relative to absolute:', {
        relativeX: vueFlowNode.position.x,
        relativeY: vueFlowNode.position.y,
        parentX: parentGroup.position.x,
        parentY: parentGroup.position.y,
        absoluteX: newX,
        absoluteY: newY
      })
    }
  }

  console.log('📏 [CanvasView] Extracted from Vue Flow node:', {
    newX,
    newY,
    width,
    height,
    nodeWidth: vueFlowNode.width,
    nodeHeight: vueFlowNode.height,
    isNested: !!sectionForParentCheck?.parentGroupId
  })

  if (width && height) {
    const section = canvasStore.sections.find(s => s.id === sectionId)
    if (section) {
      // Calculate position delta (happens when resizing from left/top edges)
      const deltaX = newX - resizeState.value.startX
      const deltaY = newY - resizeState.value.startY

      console.log('📐 [CanvasView] Position delta:', {
        deltaX,
        deltaY,
        oldX: resizeState.value.startX,
        oldY: resizeState.value.startY,
        newX,
        newY
      })

      const validatedWidth = Math.max(200, Math.min(2000, Math.abs(width)))
      const validatedHeight = Math.max(80, Math.min(2000, Math.abs(height)))

      // Update section position and dimensions in store
      canvasStore.updateSection(sectionId, {
        position: {
          x: newX,
          y: newY,
          width: validatedWidth,
          height: validatedHeight
        }
      })

      console.log('✅ [CanvasView] Section position and dimensions persisted:', {
        x: newX,
        y: newY,
        width: validatedWidth,
        height: validatedHeight
      })

      // BUG-055 FIX: When group position changes (resize from left/top edges),
      // Vue Flow children move visually WITH the parent (relative positioning).
      // To keep tasks at their ABSOLUTE canvas position, we must offset Vue Flow
      // node positions by the INVERSE delta. However, since we store ABSOLUTE
      // positions in the database and syncNodes converts to relative, we need
      // to directly update Vue Flow nodes with inverse delta compensation.
      if (deltaX !== 0 || deltaY !== 0) {
        console.log('🔄 [BUG-055] Group position changed, applying INVERSE delta to keep tasks at absolute positions:', { deltaX, deltaY })

        // Find Vue Flow task nodes that have this section as parent
        // NOTE: Vue Flow uses `section-${id}` format for parentNode (see line 1659)
        const vueFlowParentId = `section-${sectionId}`
        const childTaskNodes = nodes.value.filter(node =>
          node.type === 'task' && node.parentNode === vueFlowParentId
        )

        console.log('📋 [BUG-055] Child task nodes to offset:', childTaskNodes.length, childTaskNodes.map(n => n.id))

        // Apply INVERSE delta to Vue Flow node positions to counteract parent movement
        // This keeps tasks visually at their absolute canvas position
        childTaskNodes.forEach(node => {
          const currentPos = node.position || { x: 0, y: 0 }
          const childRelativeX = currentPos.x - deltaX
          const childRelativeY = currentPos.y - deltaY
          
          // 1. Update visual Vue Flow state (Relative to parent)
          updateNode(node.id, {
            position: {
              x: childRelativeX,  // INVERSE: subtract delta
              y: childRelativeY   // INVERSE: subtract delta
            }
          })

          // 2. BUG-055 FIX: Persist to Store/Database (Absolute Canvas Position)
          // We must calculate the new ABSOLUTE position for storage
          // Absolute = ParentNewAbsolute (newX/newY) + ChildNewRelative (childRelativeX/childRelativeY)
          const task = taskStore.getTask(node.id)
          if (task) {
             console.log(`💾 [BUG-055] Persisting new absolute position for task ${node.id}:`, {
               x: newX + childRelativeX,
               y: newY + childRelativeY
             })
             
             taskStore.updateTask(node.id, {
               canvasPosition: {
                 x: newX + childRelativeX, 
                 y: newY + childRelativeY
               }
             })
          }
        })
      } else {
        console.log('ℹ️ [BUG-055] No position delta - no compensation needed')
      }
    }
  } else {
    console.error('❌ [CanvasView] Missing width or height:', { width, height })
  }

  // BUG-055 FIX: Use settling period to prevent race conditions with watchers
  // 1. Set settling flag to block batchedSyncNodes during transition
  // 2. Reset resize state first (isResizing = false)
  // 3. After nextTick, call syncNodes directly (not batched)
  // 4. Clear settling flag after short delay
  isResizeSettling.value = true
  console.log('🔄 [BUG-055] Resize settling started')

  // Reset resize state
  resizeState.value = {
    isResizing: false,
    sectionId: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    currentX: 0, // BUG-019
    currentY: 0, // BUG-019
    currentWidth: 0,
    currentHeight: 0,
    handlePosition: null,
    isDragging: false,
    resizeStartTime: 0
  }

  // BUG-055 FIX: Do NOT call syncNodes after resize - the inverse delta compensation
  // applied above keeps Vue Flow nodes at their correct positions. Calling syncNodes
  // would recalculate from database and potentially cause position jitter.
  nextTick(() => {
    // Just clear the settling flag - don't sync
    console.log('🔄 [BUG-055] Resize complete, NOT calling syncNodes (inverse delta applied)')

    // Clear settling flag after a short delay to prevent race conditions
    setTimeout(() => {
      isResizeSettling.value = false
      console.log('✅ [BUG-055] Resize settling complete')
    }, 100)
  })
}

// Handle pane click - clear selection
// Pane click handled in useCanvasEvents

// Handle add task from empty state
const handleAddTask = () => {
  // Open the quick task create modal
  isQuickTaskCreateOpen.value = true
}

// Handle pane context menu (right-click)
// Right click handlers moved to useCanvasEvents






// Phase 1: Alignment (Extracted)
const { 
  alignLeft, alignRight, alignTop, alignBottom, 
  alignCenterHorizontal, alignCenterVertical, 
  distributeHorizontal, distributeVertical,
  arrangeInRow, arrangeInColumn, arrangeInGrid 
} = useCanvasAlignment(
  nodes, 
  { isVueFlowMounted, isVueFlowReady, isCanvasReady }, 
  { closeCanvasContextMenu }
)

const _centerOnSelectedTasks = () => {
  zoomToSelection()
  closeCanvasContextMenu()
}

const _fitAllTasks = () => {
  fitCanvas()
  closeCanvasContextMenu()
}


const _selectAllTasks = () => {
  const taskNodeIds = nodes.value
    .filter(n => n.type === 'taskNode')
    .map(n => n.id)
  canvasStore.setSelectedNodes(taskNodeIds)
  closeCanvasContextMenu()
}

const _clearSelection = () => {
  canvasStore.setSelectedNodes([])
  closeCanvasContextMenu()
}

// NOTE: createTaskHere is provided by useCanvasActions composable (line ~1311)

const _createGroup = () => {
  console.log('🔧 CanvasView: createGroup function called!')

  // Get the VueFlow element to calculate canvas coordinates
  const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
  if (!vueFlowElement) {
    console.error('🔧 CanvasView: VueFlow element not found!')
    return
  }

  // Calculate canvas coordinates accounting for viewport transformation
  // ✅ DRIFT FIX: Use Vue Flow native projection for 100% accuracy
  const flowCoords = screenToFlowCoordinate({
    x: canvasContextMenuX.value,
    y: canvasContextMenuY.value
  })

  // Debug logging
  console.log('🎯 Creating group at:', {
    screenCoords: { x: canvasContextMenuX.value, y: canvasContextMenuY.value },
    canvasCoords: flowCoords
  })

  // Set modal position for group creation using calculated coordinates
  groupModalPosition.value = { x: flowCoords.x, y: flowCoords.y }

  // Open the group modal
  isGroupModalOpen.value = true

  // Close the context menu
  closeCanvasContextMenu()
}

// Section Settings Modal handlers
const handleOpenSectionSettings = (sectionId: string) => {
  editingSectionId.value = sectionId
  isSectionSettingsOpen.value = true
}

const closeSectionSettingsModal = () => {
  isSectionSettingsOpen.value = false
  editingSectionId.value = null
}

const handleSectionSettingsSave = (settings: { assignOnDrop: AssignOnDropSettings }) => {
  if (!editingSectionId.value) return

  // Update the section with new settings
  canvasStore.updateSection(editingSectionId.value, {
    assignOnDrop: settings.assignOnDrop
  })

  console.log('[handleSectionSettingsSave] Updated section settings:', {
    sectionId: editingSectionId.value,
    assignOnDrop: settings.assignOnDrop
  })

  closeSectionSettingsModal()
}

// TASK-068: Context menu handlers for group actions (moved from header)
const handleOpenSectionSettingsFromContext = (section: CanvasSection) => {
  handleOpenSectionSettings(section.id)
}

const handleTogglePowerMode = (section: CanvasSection) => {
  console.log('⚡ [CanvasView] Toggle power mode for:', section.name)
  canvasStore.togglePowerMode(section.id)
}

const handleCollectTasksFromMenu = (section: CanvasSection) => {
  console.log('🧲 [CanvasView] Collect tasks for:', section.name)
  collectTasksForSection(section.id)
}

const createTaskInGroup = async (section: CanvasSection) => {
  console.log('➕ [CanvasView] Create task in group:', section.name)

  // Position the task in the section
  const sectionNode = canvasStore.sections.find(s => s.id === section.id)
  if (!sectionNode) {
    console.warn('❌ [CanvasView] Section not found:', section.id)
    return
  }

  // Calculate task position from the right-click location (not fixed offset)
  const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
  let taskPosition = {
    x: (sectionNode.position?.x || 0) + 20,
    y: (sectionNode.position?.y || 0) + 60 // Fallback: top-left of section
  }

  if (vueFlowElement && canvasContextMenuX.value && canvasContextMenuY.value) {
  if (vueFlowElement && canvasContextMenuX.value && canvasContextMenuY.value) {
    // ✅ DRIFT FIX: Use Vue Flow native projection for 100% accuracy
    const flowCoords = screenToFlowCoordinate({
      x: canvasContextMenuX.value,
      y: canvasContextMenuY.value
    })

    console.log('📍 [CanvasView] createTaskInGroup position calc:', {
      screenCoords: { x: canvasContextMenuX.value, y: canvasContextMenuY.value },
      canvasCoords: flowCoords
    })

    // Use calculated position if valid
    if (Number.isFinite(flowCoords.x) && Number.isFinite(flowCoords.y)) {
      taskPosition = { x: flowCoords.x, y: flowCoords.y }
    }
  }
  }

  // BUG-042 FIX: Create task with canvasPosition directly (not in inbox)
  const newTask = await taskStore.createTaskWithUndo({
    title: '',
    status: 'planned',
    isInInbox: false,
    canvasPosition: taskPosition
  })

  if (newTask) {
    console.log('✅ [CanvasView] Task created in group:', {
      taskId: newTask.id,
      sectionId: section.id,
      position: taskPosition
    })
  }
}

// Section management methods

  
const _getTasksForSection = (section: CanvasSection) => {
  const tasks = canvasStore.getTasksInSection(section, Array.isArray(filteredTasks.value) ? filteredTasks.value : [])
  // If section is collapsed, return empty array to hide tasks
  return section.isCollapsed ? [] : tasks
}

// Task selection handlers - FIXED to maintain group connection
const handleTaskSelect = (task: Task, multiSelect: boolean) => {
  if (multiSelect) {
    // In multi-select mode, preserve existing selection and toggle this task
    canvasStore.toggleNodeSelection(task.id)
  } else {
    // In single-select mode, clear all other selections and select only this task
    canvasStore.setSelectedNodes([task.id])
  }

  // Ensure selection state is immediately reflected in the nodes
  const nodeIndex = nodes.value.findIndex(n => n.id === task.id)
  if (nodeIndex > -1) {
    // Update the Vue Flow node selection state to match canvas store
    const isSelected = canvasStore.selectedNodeIds.includes(task.id)
    const nodeWithSelection = nodes.value[nodeIndex] as Node & { selected?: boolean }
    if (nodeWithSelection.selected !== isSelected) {
      nodeWithSelection.selected = isSelected
    }
  }
}

const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
  console.log('Task context menu:', task)
  // Emit custom event for App.vue to handle
  window.dispatchEvent(new CustomEvent('task-context-menu', {
    detail: { event, task }
  }))
}


// Initialize on mount

// Clean up stale Vue Flow DOM nodes that don't correspond to actual tasks
// DISABLED: This function was causing all nodes to be removed due to:
// 1. Direct DOM manipulation bypasses Vue Flow's reactivity system
// 2. node.getAttribute('data-nodeid') returns null before Vue Flow renders
// 3. Vue Flow manages its own DOM - manual cleanup breaks rendering
// See: https://vueflow.dev/guide/node.html - "Vue Flow does not know that the node was removed"
// Fix date: 2025-11-29


onMounted(async () => {
  console.log('🎨 [CANVAS] CanvasView mounted (Full Remount Detected), tasks:', taskStore.tasks.length)

  // Set Vue Flow as mounted immediately (component is ready for operations)
  isVueFlowMounted.value = true
  console.log('🎯 Vue Flow component mounted and ready for operations')

  // Clean up any stale DOM nodes from previous sessions
  cleanupStaleNodes()

  await canvasStore.loadFromDatabase()

  // TASK-089 FIX 10: Wait for task store to finish loading before syncing
  // CanvasView's onMounted runs BEFORE App.vue's onMounted completes (Vue lifecycle order)
  // This caused syncNodes() to run with empty tasks array
  //
  // Problem: isLoadingFromDatabase is FALSE initially (loading hasn't started yet!)
  // CanvasView.onMounted runs before App.vue.onMounted even STARTS the loading.
  //
  // Solution: Wait until EITHER:
  // - Tasks exist (loading completed successfully), OR
  // - isLoadingFromDatabase becomes true then false (loading cycle completed), OR
  // - Timeout (5 seconds max - user might genuinely have no tasks)
  console.log(`⏳ [CANVAS] Checking task store state - tasks: ${taskStore.tasks.length}, loading: ${taskStore.isLoadingFromDatabase}`)

  let waitAttempts = 0
  const maxWaitAttempts = 50 // 5 seconds max
  let loadingStarted = taskStore.isLoadingFromDatabase

  // Wait until tasks exist OR loading cycle completes OR timeout
  while (waitAttempts < maxWaitAttempts) {
    // If loading started and now finished, we're done
    if (loadingStarted && !taskStore.isLoadingFromDatabase) {
      console.log(`✅ [CANVAS] Task loading cycle completed after ${waitAttempts * 100}ms, tasks: ${taskStore.tasks.length}`)
      break
    }

    // Track if loading starts
    if (taskStore.isLoadingFromDatabase) {
      loadingStarted = true
    }

    // If tasks already exist and loading is not in progress, we're good
    if (taskStore.tasks.length > 0 && !taskStore.isLoadingFromDatabase) {
      console.log(`✅ [CANVAS] Tasks available (${taskStore.tasks.length}), proceeding with sync`)
      break
    }

    await new Promise(r => setTimeout(r, 100))
    waitAttempts++
  }

  if (waitAttempts >= maxWaitAttempts) {
    console.warn(`⚠️ [CANVAS] Timed out waiting for tasks (${maxWaitAttempts * 100}ms), proceeding anyway with ${taskStore.tasks.length} tasks`)
  }

  syncNodes()


  // TASK-072: Restore saved viewport position
  // BUG-048 FIX: Set hasInitialFit BEFORE applying viewport to prevent auto-centering
  // from overriding the restored viewport position when nodesInitialized fires
  // BUG-052 FIX: loadSavedViewport sets canvasStore.viewport, which is used by the
  // initialViewport computed prop - Vue Flow will initialize with the correct viewport
  // immediately, eliminating the previous (0,0,1) → saved viewport jump
  const viewportRestored = await canvasStore.loadSavedViewport()
  if (viewportRestored) {
    // Prevent the auto-centering watcher from running
    hasInitialFit.value = true
    // Mark canvas as ready - Vue Flow will render with initialViewport computed prop
    isCanvasReady.value = true
    isVueFlowReady.value = true
    // console.log('🔭 Viewport restored from DB:', canvasStore.viewport)
  }

  // Safety fallback: if canvas doesn't initialize in 3s, force ready state
  // This prevents infinite "Initializing Canvas..." state
  setTimeout(() => {
    if (!isCanvasReady.value) {
      console.warn('⚠️ Canvas init timeout (3s) - forcing ready state')
      isCanvasReady.value = true
      isVueFlowReady.value = true
      hasInitialFit.value = true
    }
  }, 3000)

  // Add keyboard event listener using resourceManager with safety check
  if (typeof window !== 'undefined') {
    resourceManager.addEventListener(window, 'keydown', handleKeyDown as unknown as EventListener, { capture: true })
  } else {
    console.warn('⚠️ [CANVAS] Window object not available for keyboard event listener')
  }

  // Set Vue Flow ref for cleanup
  resourceManager.setVueFlowRef(vueFlowRef.value)

  // Explicitly enforce zoom limits after Vue Flow initializes
})

onBeforeUnmount(() => {
  // Clean up all managed resources (watchers, event listeners, timers, intervals, Vue Flow instance)
  resourceManager.cleanup()

  // Clean up zoom performance manager
  cleanupZoom()

  console.log('🧹 CanvasView resources cleaned up successfully')
})
</script>

<style scoped>
.canvas-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: 100%;
  position: relative;
  max-height: 100vh;
}

.canvas-contour {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-xl);
  margin: var(--space-4);
  background: rgba(255, 255, 255, 0.01);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

/* System Health Alert for Graceful Degradation */
.system-health-alert {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  background: linear-gradient(135deg, #ff6b6b, #ffa726);
  color: white;
  padding: 12px 16px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  animation: slideDown 0.3s ease-out;
}

.health-alert-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
}

.health-icon {
  font-size: 16px;
  margin-right: 8px;
}

.health-message {
  flex: 1;
  font-weight: 500;
  font-size: 14px;
}

.health-retry-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.health-retry-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Operation Error Alert */
.operation-error-alert {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10001;
  background: linear-gradient(135deg, #ff4757, #ff6b7a);
  color: white;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
  max-width: 600px;
  width: 90%;
  animation: slideDown 0.3s ease-out;
}

.operation-error-alert.retryable {
  background: linear-gradient(135deg, #ff9ff3, #feca57);
}

.operation-error-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.error-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.error-message {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
}

.error-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.retry-btn,
.dismiss-btn,
.refresh-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.retry-btn:hover,
.dismiss-btn:hover,
.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.refresh-btn {
  background: rgba(255, 71, 87, 0.3);
  border-color: rgba(255, 255, 255, 0.4);
}

.refresh-btn:hover {
  background: rgba(255, 71, 87, 0.4);
}

/* Global Loading Overlay */
.global-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

.loading-content {
  background: var(--surface-secondary);
  padding: 24px 32px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-width: 200px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-secondary);
  border-top: 3px solid var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* InboxPanel positioning - overlays on left side of canvas */
:deep(.inbox-panel),
:deep(.unified-inbox-panel) {
  position: absolute;
  left: 1rem;
  top: 1rem;
  bottom: 2rem; /* BUG-049: Added to constrain height and enable scrolling */
  z-index: 50;
  max-height: calc(100vh - 3rem); /* Fallback constraint with extra padding */
  /* InboxPanel has its own sizing: 320px expanded, 3rem collapsed */
}

/* Vue Flow container dimensions fix */
/* Exclude context menus and modals from layout rules */
.canvas-layout > div:not(.context-menu) {
  width: 100%;
  height: 100%;
  flex: 1;
  display: flex;
}

.vue-flow-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex: 1;
}


.canvas-main {
  height: 100%;
}

.canvas-container-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
}



.canvas-drop-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.vue-flow-container {
  width: 100%;
  height: 100%;
  overflow: clip; /* Modern clipping with margin support */
  overflow-clip-margin: 20px; /* Allow 20px overflow before clipping */

  /* No visible border - clean canvas workspace */
}

.vue-flow-container :deep(.vue-flow__controls) {
  display: none !important;
}
</style>

<style>
/* Global Vue Flow theme overrides */
.vue-flow {
  background: var(--app-background-gradient);
  outline: none; /* Remove default outline, use custom focus-visible */
  width: 100%;
  height: 100%;
  display: flex;
  flex: 1;
}

/* Focus-visible for keyboard accessibility - subtle purple glow only */
.vue-flow:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
}

/* Hide scrollbars completely */
.vue-flow__viewport,
.vue-flow__transformationpane,
.vue-flow__pane,
.vue-flow {
  scrollbar-width: none !important; /* Firefox */
  -ms-overflow-style: none !important; /* IE/Edge */
}

.vue-flow__viewport::-webkit-scrollbar,
.vue-flow__transformationpane::-webkit-scrollbar,
.vue-flow__pane::-webkit-scrollbar,
.vue-flow::-webkit-scrollbar {
  display: none !important; /* Chrome/Safari */
}

/* ====================================================================
   FIX #2: POINTER-EVENTS HIERARCHY FOR CLICKABLE RESIZE HANDLES

   Problem: Section content had pointer-events:auto which blocked resize handles
   Solution: Set section content to pointer-events:none, only enable on header
   ==================================================================== */

/* Z-index layering: sections < edges < tasks, with hover states */
/* TASK-072 FIX: Don't force z-index - let Vue Flow node.style.zIndex control it for nested groups */
.vue-flow__node[id^="section-"],
.vue-flow__node-sectionNode {
  /* z-index is now controlled by node.style.zIndex for proper nested group layering */
  /* Allow section wrapper to be interactive */
  pointer-events: auto !important;
}

/* Section node content should NOT block resize handles at edges */
.vue-flow__node[id^="section-"] .section-node,
.vue-flow__node-sectionNode .section-node {
  pointer-events: none !important; /* ✅ KEY FIX: Don't block handles */
  cursor: default;
}

/* Section header DOES allow drag events for moving the section */
.vue-flow__node[id^="section-"] .section-header,
.vue-flow__node-sectionNode .section-header {
  pointer-events: auto !important; /* ✅ Enable dragging from header */
  cursor: move !important;
}

/* Allow all interactive elements within header to work */
.vue-flow__node[id^="section-"] .section-header *,
.vue-flow__node-sectionNode .section-header * {
  pointer-events: auto !important; /* Buttons, inputs, etc. in header */
}

/* Resize handles MUST be on top and fully interactive when visible */
.vue-flow__node[id^="section-"].selected .vue-flow__resize-control.handle,
.vue-flow__node[id^="section-"].selected .custom-resize-handle,
.vue-flow__node[id^="section-"].vue-flow__node--selected .vue-flow__resize-control.handle,
.vue-flow__node[id^="section-"].vue-flow__node--selected .custom-resize-handle,
.vue-flow__node-sectionNode.selected .vue-flow__resize-control.handle,
.vue-flow__node-sectionNode.selected .custom-resize-handle,
.vue-flow__node-sectionNode.vue-flow__node--selected .vue-flow__resize-control.handle,
.vue-flow__node-sectionNode.vue-flow__node--selected .custom-resize-handle {
  pointer-events: auto !important; /* ✅ Handles are clickable when selected */
  z-index: 100 !important; /* ✅ Above all content */
  cursor: nwse-resize !important;
}

/* Resize lines should be visible but NOT block handle interaction */
.vue-flow__node[id^="section-"] .vue-flow__resize-control.line,
.vue-flow__node[id^="section-"] .custom-resize-line,
.vue-flow__node-sectionNode .vue-flow__resize-control.line,
.vue-flow__node-sectionNode .custom-resize-line {
  pointer-events: none !important; /* ✅ Lines don't interfere */
  z-index: 99 !important;
}

/* Create safe zones around edges for resize handles */
.vue-flow__node[id^="section-"]::before,
.vue-flow__node-sectionNode::before {
  content: '';
  position: absolute;
  top: -12px;
  left: -12px;
  right: -12px;
  bottom: -12px;
  pointer-events: none !important;
  z-index: 99 !important;
}


.vue-flow__node:not([data-id^="section-"]) {
  z-index: 10 !important;
}

/* Ensure task nodes stay on top during hover */
.vue-flow__node:not([data-id^="section-"]):hover {
  z-index: 20 !important;
  transform: scale(1.02);
  transition: transform 0.2s ease;
}

.vue-flow__edge-path {
  stroke: var(--border-secondary);
  stroke-width: 2px;
  transition: all 0.2s ease;
}

.vue-flow__edge {
  cursor: pointer;
}

.vue-flow__edge:hover .vue-flow__edge-path {
  stroke: var(--brand-primary);
  stroke-width: 3px;
  filter: drop-shadow(0 3px 8px rgba(99, 102, 241, 0.5));
}

.vue-flow__edge.selected .vue-flow__edge-path {
  stroke: var(--accent-primary);
  stroke-width: 3px;
  filter: drop-shadow(0 2px 6px rgba(99, 102, 241, 0.4));
}

.vue-flow__controls {
  display: none; /* Using custom controls */
}

/* Minimap styling fixes */
.vue-flow__minimap {
  background: var(--glass-border) !important;
  border: 1px solid var(--glass-border-strong) !important;
  border-radius: var(--radius-md) !important;
  backdrop-filter: blur(8px) !important;
  z-index: 1000 !important;
  bottom: 16px !important;
  right: 16px !important;
}

.vue-flow__minimap-mask {
  fill: var(--blue-bg-medium) !important;
}

.vue-flow__minimap-node {
  fill: var(--purple-border-active) !important;
  stroke: var(--text-primary) !important;
  stroke-width: 1px !important;
}

/* Eye toggle for hiding/showing done tasks - positioned above left side of mini map */
/* Canvas filters container */
.canvas-filters-container {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1000;
  pointer-events: auto;
}


/* Fix mini map blocking clicks */
.vue-flow__minimap-mask {
  pointer-events: none !important;
}

.vue-flow__minimap {
  pointer-events: none !important;
}


/* Fix cursor behavior - default cursor, only grab when panning */
.vue-flow__pane {
  cursor: default !important;
}

.vue-flow__pane.dragging {
  cursor: grabbing !important;
}

/* Nodes should have pointer cursor on hover */
.vue-flow__node {
  cursor: pointer !important;
  border: none !important;
  outline: none !important;
  pointer-events: auto !important; /* DEBUG: Ensure nodes are interactive */
}

.vue-flow__node.dragging {
  cursor: grabbing !important;
}

/* Remove borders from all node states */
.vue-flow__node.selected,
.vue-flow__node:focus,
.vue-flow__node:active,
.vue-flow__node:hover {
  border: none !important;
  outline: none !important;
}

/* Comprehensive border removal - target all possible Vue Flow elements */
.vue-flow__node,
.vue-flow__node *,
.vue-flow__node::before,
.vue-flow__node::after {
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  text-shadow: none !important;
}

/* Target all node types specifically */
.vue-flow__node-default,
.vue-flow__node-input,
.vue-flow__node-output,
.vue-flow__node-group {
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  background-color: transparent !important;
}

/* Remove handle borders completely */
.vue-flow__handle,
.vue-flow__handle-top,
.vue-flow__handle-bottom,
.vue-flow__handle-left,
.vue-flow__handle-right,
.vue-flow__handle-source,
.vue-flow__handle-target {
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
}

/* Remove background/container borders */
.vue-flow__background,
.vue-flow__container,
.vue-flow__pane,
.vue-flow__viewport,
.vue-flow__transformationpane {
  border: none !important;
  outline: none !important;
}

/* Nuclear option - remove all borders from Vue Flow elements */
.vue-flow * {
  border: none !important;
  outline: none !important;
  text-decoration: none !important;
}

/* Subtle grid visibility - ensure it stays in background */
.vue-flow__background {
  opacity: 0.4 !important;
  z-index: 0 !important;
}

.vue-flow__background-pattern-dots {
  fill: #e5e7eb !important;
  opacity: 0.3 !important;
}

.vue-flow__background-pattern-lines {
  stroke: #e5e7eb !important;
  stroke-width: 0.5px !important;
  opacity: 0.2 !important;
}

/* Ensure grid stays behind all elements */
.vue-flow__background,
.vue-flow__background * {
  z-index: 0 !important;
  pointer-events: none !important;
}

/* Enhanced Resize Handle Styles */
.vue-flow__resize-control {
  position: absolute;
  z-index: 100 !important;
  /* FIX: Don't block pointer events by default - let child selectors control it */
}

.vue-flow__resize-control.handle {
  width: 20px !important; /* Match canvas design - smaller, not oversized */
  height: 20px !important;
  border-radius: 4px !important; /* Subtle square for canvas design consistency */
  background-color: var(--brand-primary) !important;
  border: 2px solid white !important; /* Thinner border matches canvas aesthetic */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
  opacity: 1 !important;
  transition: all 0.2s ease !important;
  pointer-events: auto !important; /* CRITICAL: Always allow interaction on handles */
  cursor: nwse-resize !important;
}

/* Larger clickable area */
.vue-flow__resize-control.handle::before {
  content: '';
  position: absolute;
  top: -12px;
  left: -12px;
  right: -12px;
  bottom: -12px;
  cursor: nwse-resize !important;
}

/* Hover state - subtle growth matching canvas design */
.vue-flow__resize-control.handle:hover {
  width: 24px !important; /* Slight growth from 20px */
  height: 24px !important;
  background-color: var(--accent-primary) !important;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.5) !important; /* Softer glow */
  transform: scale(1.05) !important; /* Subtle scale for feedback */
}

/* BUG-043: Edge lines are now clickable resize handles */
.vue-flow__resize-control.line {
  background-color: transparent !important; /* Invisible by default */
  opacity: 1 !important;
  transition: background-color 0.2s ease !important;
  pointer-events: auto !important; /* Make lines clickable for resize */
}

.vue-flow__resize-control.line:hover {
  background-color: var(--brand-primary) !important;
}

/* Ensure resize handles are always visible on sections */
.vue-flow__node[data-id^="section-"] .vue-flow__resize-control.handle,
.vue-flow__node[data-id^="section-"] .vue-flow__resize-control.line {
  opacity: 1 !important;
}

/* Enhanced resize handle interactions */
.vue-flow__resize-control.handle:hover {
  transform: scale(1.2) !important;
  background-color: var(--accent-primary) !important;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.4) !important;
  border-color: var(--surface-primary) !important;
}

/* Corner handles take priority over edge handles */
.vue-flow__resize-control.handle.top-left,
.vue-flow__resize-control.handle.top-right,
.vue-flow__resize-control.handle.bottom-left,
.vue-flow__resize-control.handle.bottom-right {
  z-index: 102 !important;
}

/* Edge handles have lower z-index to avoid blocking drag */
.vue-flow__resize-control.handle.top,
.vue-flow__resize-control.handle.bottom,
.vue-flow__resize-control.handle.left,
.vue-flow__resize-control.handle.right {
  z-index: 101 !important;
}

/* Specific cursor styles for each handle position */
.vue-flow__resize-control.handle.top-left,
.vue-flow__resize-control.handle.bottom-right {
  cursor: nwse-resize !important;
}

.vue-flow__resize-control.handle.top-right,
.vue-flow__resize-control.handle.bottom-left {
  cursor: nesw-resize !important;
}

.vue-flow__resize-control.handle.top,
.vue-flow__resize-control.handle.bottom {
  cursor: ns-resize !important;
}

.vue-flow__resize-control.handle.left,
.vue-flow__resize-control.handle.right {
  cursor: ew-resize !important;
}

/* BUG-043: Resize line styles with LARGER hit area for easier grabbing */
.vue-flow__resize-control.line.top,
.vue-flow__resize-control.line.bottom {
  height: 12px !important; /* Larger hit area (was 2px) */
  width: 100% !important;
  cursor: ns-resize !important;
}

.vue-flow__resize-control.line.left,
.vue-flow__resize-control.line.right {
  width: 12px !important; /* Larger hit area (was 2px) */
  height: 100% !important;
  cursor: ew-resize !important;
}

/* Position lines at edges but keep hit area extending inward */
.vue-flow__resize-control.line.top {
  top: -6px !important;
}
.vue-flow__resize-control.line.bottom {
  bottom: -6px !important;
}
.vue-flow__resize-control.line.left {
  left: -6px !important;
}
.vue-flow__resize-control.line.right {
  right: -6px !important;
}

/* Active resize state with enhanced feedback */
.vue-flow__node[data-id^="section-"].resizing .vue-flow__resize-control.handle,
.vue-flow__node[data-id^="section-"].resizing .vue-flow__resize-control.line {
  opacity: 1 !important;
  background-color: var(--accent-primary) !important;
}

.vue-flow__node[data-id^="section-"].resizing {
  z-index: 50 !important;
}

.vue-flow__node[data-id^="section-"].resizing .section-node {
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3) !important;
  border-color: var(--accent-primary) !important;
  border-width: 2px !important;
}

/* Handle fade-in animation */
@keyframes handle-fade-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Custom resize handle class overrides - Fix #4: LARGE SQUARES */
.custom-resize-handle {
  width: 32px !important; /* LARGE for easy clicking */
  height: 32px !important;
  border-radius: 6px !important; /* SQUARE with slight rounding */
  background-color: var(--brand-primary) !important;
  border: 4px solid white !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  cursor: nwse-resize !important;
}

/* Add larger clickable area with pseudo-element */
.custom-resize-handle::before {
  content: '';
  position: absolute;
  top: -12px;
  left: -12px;
  right: -12px;
  bottom: -12px;
  cursor: nwse-resize !important;
}

/* Hover state - make handle more prominent */
.custom-resize-handle:hover {
  width: 40px !important;
  height: 40px !important;
  transform: scale(1) !important;
  background-color: var(--accent-primary) !important;
  border-color: white !important;
  border-width: 4px !important;
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.7) !important;
}

/* Active/dragging state - maximum visual feedback */
.custom-resize-handle:active,
.vue-flow__node[id^="section-"].resizing .custom-resize-handle,
.vue-flow__node-sectionNode.resizing .custom-resize-handle {
  width: 40px !important;
  height: 40px !important;
  background-color: var(--accent-secondary) !important;
  border-color: white !important;
  border-width: 5px !important;
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.9) !important;
}

.custom-resize-line {
  background-color: var(--brand-primary) !important;
  opacity: 0 !important; /* Hidden by default - only show when selected */
  transition: opacity 0.2s ease, visibility 0.2s ease !important;
}

/* ====================================================================
   FIX #1: SELECTION-BASED RESIZE HANDLE VISIBILITY

   Problem: Resize handles were always visible on all sections, cluttering UI
   Solution: Show handles only when section is selected or being hovered
   ==================================================================== */

/* DEFAULT: Hide resize handles when section NOT selected */
.vue-flow__node[id^="section-"] .vue-flow__resize-control.handle,
.vue-flow__node[id^="section-"] .vue-flow__resize-control.line,
.vue-flow__node[id^="section-"] .custom-resize-handle,
.vue-flow__node[id^="section-"] .custom-resize-line,
.vue-flow__node-sectionNode .vue-flow__resize-control.handle,
.vue-flow__node-sectionNode .vue-flow__resize-control.line,
.vue-flow__node-sectionNode .custom-resize-handle,
.vue-flow__node-sectionNode .custom-resize-line {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important; /* Can't interact when hidden */
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

/* SELECTED: Show resize handles ONLY when section is selected */
.vue-flow__node[id^="section-"].selected .vue-flow__resize-control.handle,
.vue-flow__node[id^="section-"].selected .vue-flow__resize-control.line,
.vue-flow__node[id^="section-"].selected .custom-resize-handle,
.vue-flow__node[id^="section-"].selected .custom-resize-line,
.vue-flow__node[id^="section-"].vue-flow__node--selected .vue-flow__resize-control.handle,
.vue-flow__node[id^="section-"].vue-flow__node--selected .vue-flow__resize-control.line,
.vue-flow__node[id^="section-"].vue-flow__node--selected .custom-resize-handle,
.vue-flow__node[id^="section-"].vue-flow__node--selected .custom-resize-line,
.vue-flow__node-sectionNode.selected .vue-flow__resize-control.handle,
.vue-flow__node-sectionNode.selected .vue-flow__resize-control.line,
.vue-flow__node-sectionNode.selected .custom-resize-handle,
.vue-flow__node-sectionNode.selected .custom-resize-line,
.vue-flow__node-sectionNode.vue-flow__node--selected .vue-flow__resize-control.handle,
.vue-flow__node-sectionNode.vue-flow__node--selected .vue-flow__resize-control.line,
.vue-flow__node-sectionNode.vue-flow__node--selected .custom-resize-handle,
.vue-flow__node-sectionNode.vue-flow__node--selected .custom-resize-line {
  opacity: 1 !important; /* Fully visible when selected */
  visibility: visible !important;
  pointer-events: auto !important; /* Interactive when visible */
  z-index: 100 !important; /* Above all other content */
  display: block !important;
}

/* HOVER: Show handles faintly on hover for discoverability */
.vue-flow__node[id^="section-"]:not(.selected):not(.vue-flow__node--selected):hover .vue-flow__resize-control.handle,
.vue-flow__node[id^="section-"]:not(.selected):not(.vue-flow__node--selected):hover .custom-resize-handle,
.vue-flow__node-sectionNode:not(.selected):not(.vue-flow__node--selected):hover .vue-flow__resize-control.handle,
.vue-flow__node-sectionNode:not(.selected):not(.vue-flow__node--selected):hover .custom-resize-handle {
  opacity: 0.6 !important; /* Increased from 0.4 for better visibility */
  visibility: visible !important;
  pointer-events: auto !important; /* Allow interaction on hover */
  transition: opacity 0.2s ease, transform 0.2s ease !important;
}

.vue-flow__node[id^="section-"]:not(.selected):not(.vue-flow__node--selected):hover .vue-flow__resize-control.line,
.vue-flow__node[id^="section-"]:not(.selected):not(.vue-flow__node--selected):hover .custom-resize-line,
.vue-flow__node-sectionNode:not(.selected):not(.vue-flow__node--selected):hover .vue-flow__resize-control.line,
.vue-flow__node-sectionNode:not(.selected):not(.vue-flow__node--selected):hover .custom-resize-line {
  opacity: 0.3 !important; /* Increased from 0.2 for better visibility */
  visibility: visible !important;
}

/* GLASS MORPHISM: Direct hover on handle - Enhanced feedback with glass effect */
.vue-flow__node[id^="section-"] .vue-flow__resize-control.handle:hover,
.vue-flow__node[id^="section-"] .custom-resize-handle:hover,
.vue-flow__node-sectionNode .vue-flow__resize-control.handle:hover,
.vue-flow__node-sectionNode .custom-resize-handle:hover {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  transform: scale(1.3) !important;  /* Increased from 1.15 for clear feedback */
  background: rgba(99, 102, 241, 0.5) !important;  /* Translucent purple */
  border: 2px solid rgba(255, 255, 255, 0.8) !important;  /* Bright white border */
  box-shadow: 0 2px 12px rgba(99, 102, 241, 0.4) !important;  /* Purple glow */
  backdrop-filter: blur(12px) !important;  /* Enhanced glass blur */
  -webkit-backdrop-filter: blur(12px) !important;  /* Safari support */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  z-index: 103 !important; /* Above everything during hover */
}

/* RESIZING: Ensure full visibility during active resize operation */
.vue-flow__node[id^="section-"].resizing .vue-flow__resize-control.handle,
.vue-flow__node[id^="section-"].resizing .vue-flow__resize-control.line,
.vue-flow__node[id^="section-"].resizing .custom-resize-handle,
.vue-flow__node[id^="section-"].resizing .custom-resize-line,
.vue-flow__node-sectionNode.resizing .vue-flow__resize-control.handle,
.vue-flow__node-sectionNode.resizing .vue-flow__resize-control.line,
.vue-flow__node-sectionNode.resizing .custom-resize-handle,
.vue-flow__node-sectionNode.resizing .custom-resize-line {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  z-index: 100 !important;
}

/* Drag cleanup CSS to prevent ghost lines and artifacts */
.vue-flow__node.is-dragging {
  /* Prevent any visual artifacts during drag */
  transition: none !important;
  animation: none !important;
  /* Ensure clean visual state */
  opacity: 0.8 !important;
  transform: scale(0.98) !important;
  z-index: 1000 !important;
}

/* Hide edges connected to dragging nodes to prevent ghost lines */
.vue-flow__node.is-dragging ~ .vue-flow__edge,
.vue-flow__node.is-dragging .vue-flow__edge {
  opacity: 0.3 !important;
  transition: opacity 0.2s ease !important;
}

/* Clean up drag state on all edges during any drag operation */
body.dragging-active .vue-flow__edge {
  opacity: 0.5 !important;
  transition: opacity 0.2s ease !important;
}

/* Ensure clean connection handles during drag */
body.dragging-active .vue-flow__handle {
  transition: none !important;
  opacity: 0.7 !important;
}

/* Prevent any background effects during drag */
body.dragging-active .vue-flow__background {
  transition: none !important;
}

/* ====================================================================
   MINIMAL RESIZE HANDLE FIXES (work with library CSS, don't fight it)
   ==================================================================== */

/* Make handles slightly larger and easier to click (20px compromise) */
.vue-flow__node-sectionNode .vue-flow__resize-control.handle {
  width: 20px !important;
  height: 20px !important;
  opacity: 1 !important;
}

/* Fix hover - keep handles visible, just highlight them */
.vue-flow__node-sectionNode .vue-flow__resize-control.handle:hover {
  width: 24px !important;
  height: 24px !important;
  transform: scale(1.1);
  opacity: 1 !important;
}

/* Hide handles when section NOT selected AND NOT hovering */
.vue-flow__node-sectionNode:not(.selected):not(.vue-flow__node--selected):not(:hover) .vue-flow__resize-control.handle:not(:hover) {
  opacity: 0 !important;
  pointer-events: none !important;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

/* Show handles when section IS selected */
.vue-flow__node-sectionNode.selected .vue-flow__resize-control.handle,
.vue-flow__node-sectionNode.vue-flow__node--selected .vue-flow__resize-control.handle {
  opacity: 1 !important;
  pointer-events: auto !important;
}

/* Keep lines subtle */
.vue-flow__node-sectionNode .vue-flow__resize-control.line {
  opacity: 0.2 !important;
}

/* Canvas loading overlay */
.canvas-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background);
  z-index: 9999;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

/* Canvas empty state */
.canvas-empty-state {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 2rem;
  background: var(--color-background);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 1000;
  pointer-events: none; /* Allow clicks to pass through to Done toggle */
}

/* Re-enable pointer events for interactive children */
.canvas-empty-state button,
.canvas-empty-state a {
  pointer-events: auto;
}

.empty-icon {
  color: var(--color-text-secondary);
  opacity: 0.6;
}

.empty-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  text-align: center;
}

.empty-description {
  font-size: 1rem;
  color: var(--color-text-secondary);
  margin: 0;
  text-align: center;
  max-width: 400px;
  line-height: 1.5;
}

.add-task-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: var(--color-primary);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.add-task-button:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.3);
  color: var(--color-primary);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.add-task-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
}

/* Vue Flow fade-in transition - fixes initialization deadlock */
.vue-flow {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.vue-flow.canvas-ready {
  opacity: 1;
}

/*
   SHIFT-DRAG SELECTION SUPPORT
   When Shift is held, disable pointer events on Section/Group nodes
   so the drag event falls through to the Pane to start the selection box.
   This enables rubber-band selection starting from inside a group.
*/
.shift-selecting :deep(.vue-flow__node-sectionNode) {
  pointer-events: none !important;
}

</style>
