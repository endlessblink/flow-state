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
  <div class="canvas-layout">
    <!-- System Health Alert for Graceful Degradation -->
    <div
      v-if="!systemHealthy"
      class="system-health-alert"
      :class="{ 'degraded-mode': !systemHealthy }"
    >
      <div class="health-alert-content">
        <span class="health-icon">⚠️</span>
        <span class="health-message">{{ systemHealthMessage }}</span>
        <button
          @click="validateStores"
          class="health-retry-btn"
          title="Retry store initialization"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Operation Loading and Error Feedback -->
    <div
      v-if="operationError"
      class="operation-error-alert"
      :class="{ 'retryable': operationError.retryable }"
    >
      <div class="operation-error-content">
        <span class="error-icon">❌</span>
        <span class="error-message">
          <strong>{{ operationError.type }}:</strong> {{ operationError.message }}
        </span>
        <div class="error-actions">
          <button
            v-if="operationError.retryable"
            @click="retryFailedOperation"
            class="retry-btn"
            title="Retry failed operation"
          >
            🔄 Retry
          </button>
          <button
            @click="clearOperationError"
            class="dismiss-btn"
            title="Dismiss error"
          >
            ✕
          </button>
          <button
            v-if="operationError.type === 'System Restart'"
            @click="reloadPage"
            class="refresh-btn"
            title="Refresh page"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>

    <!-- Global Loading Overlay -->
    <div
      v-if="operationLoading.loading || operationLoading.syncing"
      class="global-loading-overlay"
    >
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <span class="loading-text">
          {{ operationLoading.loading ? 'Loading Canvas...' : 'Synchronizing Data...' }}
        </span>
      </div>
    </div>

    <!-- Eye Toggle for Hide/Show Done Tasks (positioned above mini map) -->
    <button
      class="controls-eye-toggle"
      @click="taskStore.toggleHideDoneTasks"
      :title="hideDoneTasks ? 'Show completed tasks' : 'Hide completed tasks'"
    >
      <EyeOff v-if="hideDoneTasks" :size="16" />
      <Eye v-else :size="16" />
    </button>

    
  
    <!-- ================================================================= -->
    <!-- TEMPLATE ORGANIZATION - Phase 1 (Zero Risk)               -->
    <!-- ================================================================= -->

  
    <!-- MAIN CANVAS AREA -->
    <div class="canvas-main">
  
       <!-- Vue Flow Canvas -->
      <div
        @drop="handleDrop"
        @dragover.prevent
        @contextmenu.prevent="handleCanvasRightClick"
        class="canvas-drop-zone"
      >
        <!-- Loading overlay while canvas initializes (only when there are tasks that should be on canvas) -->
        <div v-if="!isCanvasReady && !hasNoTasks && tasksWithCanvasPositions && tasksWithCanvasPositions.length > 0" class="canvas-loading-overlay">
          <div class="loading-content">
            <div class="loading-spinner"></div>
            <span class="loading-text">Loading canvas...</span>
          </div>
        </div>

        <!-- Empty state when no tasks exist -->
        <div v-if="hasNoTasks" class="canvas-empty-state">
          <Inbox :size="64" class="empty-icon" />
          <h2 class="empty-title">Your canvas is empty</h2>
          <p class="empty-description">Add your first task to get started with visual organization</p>
          <button class="add-task-button" @click="handleAddTask">
            <Plus :size="16" />
            Add Task
          </button>
        </div>

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
            @click="clearStatusFilter"
            class="ml-2 text-indigo-400 hover:text-white transition-colors"
            title="Clear filter"
          >
            <X :size="14" />
          </button>
          <div class="text-xs text-indigo-400 ml-2">
            (Check Canvas Inbox for more tasks)
          </div>
        </div>

        <!-- Inbox Sidebar - Always visible for debugging -->
        <UnifiedInboxPanel
        context="canvas"
        :show-brain-dump="true"
        :start-collapsed="true"
      />

        <!-- Always show VueFlow canvas, even when empty -->
        <div>
          <div class="canvas-container-wrapper">
            <!-- Canvas with tasks -->
            <div class="canvas-container" style="width: 100%; height: 100vh; position: relative;">
            <VueFlow
              v-if="systemHealthy && isCanvasReady"
              ref="vueFlowRef"
              :class="{ 'canvas-ready': isCanvasReady }"
              class="vue-flow-container"
              v-model:nodes="safeNodes"
              v-model:edges="safeEdges"
            :node-types="nodeTypes as any"
          :edges-focusable="true"
          :elevate-nodes-on-select="false"
          :elevate-edges-on-select="true"
          :zoom-on-scroll="true"
          :pan-on-scroll="false"
          :zoom-on-pinch="true"
          :pan-on-drag="true"
          :multi-selection-key-code="'Shift'"
          :snap-to-grid="true"
          :snap-grid="[16, 16]"
          :node-extent="dynamicNodeExtent"
          :min-zoom="0.05"
          :max-zoom="4.0"
          :fit-view-on-init="false"
          :connect-on-drag-nodes="false"
          :zoom-scroll-sensitivity="1.0"
          :zoom-activation-key-code="null"
          :prevent-scrolling="true"
          :default-viewport="{ zoom: 1, x: 0, y: 0 }"
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
            @connect="handleConnect"
          @connect-start="handleConnectStart"
          @connect-end="handleConnectEnd"
          @keydown="handleKeyDown"
          dir="ltr"
          tabindex="0"
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
          :mask-color="'var(--text-secondary)'"
          :pannable="true"
          :zoomable="true"
          :position="'bottom-right'"
        />

        <!-- Section Node Template -->
        <template #node-sectionNode="nodeProps">
          <SectionNodeSimple
            :data="nodeProps.data"
            :selected="nodeProps.selected"
            @update="handleSectionUpdate"
            @collect="collectTasksForSection"
            @context-menu="handleSectionContextMenu"
            @resizeStart="handleSectionResizeStart"
            @resize="handleSectionResize"
            @resizeEnd="handleSectionResizeEnd"
          />
        </template>

        <!-- Custom Task Node Template -->
        <template #node-taskNode="nodeProps">
          <TaskNode
            :task="nodeProps.data.task"
            :is-selected="canvasStore.selectedNodeIds.includes(nodeProps.data.task.id)"
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
          <div v-else class="canvas-loading-state">
            <div class="flex items-center justify-center h-full">
              <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                <p class="text-gray-600 dark:text-gray-400">
                  {{ systemHealthy ? 'Initializing Canvas...' : 'System Initializing...' }}
                </p>
              </div>
            </div>
          </div>

      <!-- Vue Flow Stability & Performance Monitor (Development) -->
      <div
        v-if="vueFlowStability.hasErrors || vueFlowStability.isOverloaded"
        class="vue-flow-stability-monitor"
        :class="vueFlowStability.performanceStatus"
      >
        <div class="stability-header">
          <span class="stability-title">Vue Flow Status</span>
          <button
            @click="vueFlowStability.attemptRecovery"
            v-if="vueFlowStability.hasErrors"
            class="recovery-btn"
            title="Attempt Recovery"
          >
            🔄
          </button>
        </div>
        <div class="stability-metrics">
          <div class="metric">
            <span class="metric-label">Nodes:</span>
            <span class="metric-value">{{ vueFlowStability.performanceMetrics.value.nodeCount }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Edges:</span>
            <span class="metric-value">{{ vueFlowStability.performanceMetrics.value.edgeCount }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Render:</span>
            <span class="metric-value">{{ Math.round(vueFlowStability.performanceMetrics.value.renderTime) }}ms</span>
          </div>
          <div class="metric">
            <span class="metric-label">Status:</span>
            <span class="metric-value status" :class="vueFlowStability.performanceStatus.value">
              {{ vueFlowStability.performanceStatus.value.toUpperCase() }}
            </span>
          </div>
          <div v-if="vueFlowStability.performanceMetrics.value.memoryUsage" class="metric">
            <span class="metric-label">Memory:</span>
            <span class="metric-value">{{ Math.round(vueFlowStability.performanceMetrics.value.memoryUsage / 1024 / 1024) }}MB</span>
          </div>
          <div v-if="vueFlowStability.performanceMetrics.value.errorCount > 0" class="metric">
            <span class="metric-label">Errors:</span>
            <span class="metric-value error">{{ vueFlowStability.performanceMetrics.value.errorCount }}</span>
          </div>
          <div v-if="vueFlowStability.performanceMetrics.value.recoveryCount > 0" class="metric">
            <span class="metric-label">Recoveries:</span>
            <span class="metric-value recovery">{{ vueFlowStability.performanceMetrics.value.recoveryCount }}</span>
          </div>
        </div>
      </div>
          </div>
        </div>
      </div>
    </div>
    </div>  <!-- This closes the canvas-drop-zone div from line 55 -->

    <!-- ================================================================= -->
    <!-- MODALS & OVERLAYS SECTION (Safe to Extract)                      -->
    <!-- Components: Various modals and overlays                           -->
    <!-- Dependencies: Modal state variables, task data                    -->

  
    <!-- Task Edit Modal -->
    <TaskEditModal
      :is-open="isEditModalOpen"
      :task="selectedTask"
      @close="closeEditModal"
    />

    <!-- Quick Task Create Modal -->
    <QuickTaskCreateModal
      :is-open="isQuickTaskCreateOpen"
      :loading="false"
      @cancel="closeQuickTaskCreate"
      @create="handleQuickTaskCreate"
    />

    <!-- Batch Edit Modal -->
    <BatchEditModal
      :is-open="isBatchEditModalOpen"
      :task-ids="batchEditTaskIds"
      @close="closeBatchEditModal"
      @applied="handleBatchEditApplied"
    />

    <!-- Group Modal -->
    <GroupModal
      :is-open="isGroupModalOpen"
      :group="selectedGroup"
      :position="groupModalPosition"
      @close="closeGroupModal"
      @created="handleGroupCreated"
      @updated="handleGroupUpdated"
    />

    <!-- Section Wizard -->
    <SectionWizard
      :is-open="isSectionWizardOpen"
      :position="sectionWizardPosition"
      @close="closeSectionWizard"
      @created="handleSectionCreated"
    />

    <!-- Group Edit Modal -->
    <GroupEditModal
      :section="selectedSectionForEdit"
      :is-visible="isGroupEditModalOpen"
      @close="closeGroupEditModal"
      @save="handleGroupEditSave"
    />

    <!-- Canvas Context Menu -->
    <CanvasContextMenu
      :is-visible="showCanvasContextMenu"
      :x="canvasContextMenuX"
      :y="canvasContextMenuY"
      :has-selected-tasks="canvasStore.selectedNodeIds.length > 0"
      :selected-count="canvasStore.selectedNodeIds.length"
      :context-section="canvasContextSection"
      @close="closeCanvasContextMenu"
      @createTaskHere="createTaskHere"
      @createGroup="createGroup"
      @createSection="createSection"
      @editGroup="editGroup"
      @deleteGroup="deleteGroup"
      @moveToInbox="moveSelectedTasksToInbox"
      @deleteTasks="deleteSelectedTasks"
      @alignLeft="alignLeft"
      @alignRight="alignRight"
      @alignTop="alignTop"
      @alignBottom="alignBottom"
      @alignCenterHorizontal="alignCenterHorizontal"
      @alignCenterVertical="alignCenterVertical"
      @distributeHorizontal="distributeHorizontal"
      @distributeVertical="distributeVertical"
      @arrangeInRow="arrangeInRow"
      @arrangeInColumn="arrangeInColumn"
      @arrangeInGrid="arrangeInGrid"
    />

    <!-- Edge Context Menu -->
    <EdgeContextMenu
      :is-visible="showEdgeContextMenu"
      :x="edgeContextMenuX"
      :y="edgeContextMenuY"
      @close="closeEdgeContextMenu"
      @disconnect="disconnectEdge"
    />

    <!-- Node Context Menu (for sections) -->
    <EdgeContextMenu
      :is-visible="showNodeContextMenu"
      :x="nodeContextMenuX"
      :y="nodeContextMenuY"
      menu-text="Delete Section"
      @close="closeNodeContextMenu"
      @disconnect="deleteNode"
    />

    <!-- Resize Preview Overlay - FIXED positioning -->
    <div
      v-if="resizeState.isResizing"
      class="resize-preview-overlay-fixed"
    >
      <div
        v-for="section in canvasStore.sections"
        :key="section.id"
        v-show="section.id === resizeState.sectionId"
        class="resize-preview-section-overlay"
        :style="getSectionResizeStyle(section)"
      >
        <div class="resize-size-indicator">
          {{ resizeState.currentWidth }} × {{ resizeState.currentHeight }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, markRaw, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useThrottleFn, useDebounceFn, useMagicKeys, useWindowSize } from '@vueuse/core'
import { Eye, EyeOff, Filter, X, Plus, Inbox } from 'lucide-vue-next'
import { VueFlow, useVueFlow, useNodesInitialized, PanOnScrollMode } from '@vue-flow/core'
import { useMessage } from 'naive-ui'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { NodeResizer, NodeResizeControl } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
import type { Node, Edge, EdgeMouseEvent } from '@vue-flow/core'
import { useVueFlowStability } from '@/composables/useVueFlowStability'
import { useVueFlowStateManager } from '@/composables/useVueFlowStateManager'
import { useVueFlowErrorHandling } from '@/composables/useVueFlowErrorHandling'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { storeToRefs } from 'pinia'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { shouldUseSmartGroupLogic, getSmartGroupType } from '@/composables/useTaskSmartGroups'
import { getUndoSystem } from '@/composables/undoSingleton'
import TaskNode from '@/components/canvas/TaskNode.vue'
import SectionNodeSimple from '@/components/canvas/SectionNodeSimple.vue'
import UnifiedInboxPanel from '@/components/base/UnifiedInboxPanel.vue'
import TaskEditModal from '@/components/TaskEditModal.vue'
import QuickTaskCreateModal from '@/components/QuickTaskCreateModal.vue'
import BatchEditModal from '@/components/BatchEditModal.vue'
import MultiSelectionOverlay from '@/components/canvas/MultiSelectionOverlay.vue'
import CanvasContextMenu from '@/components/canvas/CanvasContextMenu.vue'
import EdgeContextMenu from '@/components/canvas/EdgeContextMenu.vue'
import GroupModal from '@/components/GroupModal.vue'
import GroupEditModal from '@/components/canvas/GroupEditModal.vue'
import SectionWizard from '@/components/canvas/SectionWizard.vue'

// Import Vue Flow styles
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
// REMOVED: Library styles were forcing circular handles
// import '@vue-flow/node-resizer/dist/style.css'

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
const getVisibleProjectIds = () => {
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
let lastFilteredTasks: any[] = []
let lastFilteredTasksHash = ''

const filteredTasksWithProjectFiltering = computed(() => {
  return safeStoreOperation(
    () => {
      if (!taskStore.filteredTasks || !Array.isArray(taskStore.filteredTasks)) {
        console.warn('⚠️ taskStore.filteredTasks not available or not an array')
        return []
      }

      const currentTasks = taskStore.filteredTasks

      // Performance optimization: Only update if actually changed
      const currentHash = currentTasks.map(t => t.id).join('|')
      if (currentHash === lastFilteredTasksHash && lastFilteredTasks.length > 0) {
        return lastFilteredTasks
      }

      lastFilteredTasksHash = currentHash
      lastFilteredTasks = currentTasks
      return currentTasks
    },
    [], // Fallback: empty array
    'filteredTasks access',
    'taskStore'
  )
})

// Store reactive reference for use throughout the component
const filteredTasks = computed(() => filteredTasksWithProjectFiltering.value)

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
let lastCanvasTasks: any[] = []
let lastCanvasTasksHash = ''

const filteredTasksWithCanvasPosition = computed(() => {
  const tasks = filteredTasks.value
  if (!Array.isArray(tasks)) {
    return []
  }

  // Performance optimization: Cache filtered results
  const currentHash = tasks.map(t => `${t.id}:${t.canvasPosition?.x || ''}:${t.canvasPosition?.y || ''}`).join('|')
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

// 🚀 Phase 1: Vue 3 + Pinia Reactivity Core - Use storeToRefs for proper reactivity
const { hideDoneTasks } = storeToRefs(taskStore)
const { sections, viewport } = storeToRefs(canvasStore)
const { secondarySidebarVisible } = storeToRefs(uiStore)
const message = useMessage()
const undoHistory = getUndoSystem()

if (import.meta.env.DEV) {
  ;(window as any).__canvasStore = canvasStore
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
const isEditModalOpen = ref(false)
const selectedTask = ref<Task | null>(null)


// Quick Task Create Modal state
const isQuickTaskCreateOpen = ref(false)
const quickTaskPosition = ref({ x: 0, y: 0 })

// Batch Edit Modal state
const isBatchEditModalOpen = ref(false)
const batchEditTaskIds = ref<string[]>([])

// Canvas Context Menu state
const showCanvasContextMenu = ref(false)
const canvasContextMenuX = ref(0)
const canvasContextMenuY = ref(0)
const canvasContextSection = ref<any>(null)

// Connection state tracking
const isConnecting = ref(false)

// Node change handling state
const isHandlingNodeChange = ref(false)
const isSyncing = ref(false)
const isNodeDragging = ref(false) // FIXED: Guard against syncNodes during drag operations

// Loading states for operations
const operationLoading = ref({
  saving: false,
  loading: false,
  syncing: false,
  creating: false,
  updating: false,
  deleting: false
})

// Operation error state
const operationError = ref<{
  type: string
  message: string
  retryable: boolean
} | null>(null)

// Operation management helpers
const setOperationLoading = (operation: keyof typeof operationLoading.value, loading: boolean) => {
  operationLoading.value[operation] = loading
  if (loading) {
    operationError.value = null // Clear previous errors when starting new operation
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

const reloadPage = () => {
  window.location.reload()
}

// Resource management for memory leak prevention
const resourceManager = {
  // Store all active watchers for cleanup
  watchers: [] as Array<() => void>,
  // Store all event listeners for cleanup
  eventListeners: [] as Array<any>,
  // Store all timers for cleanup
  timers: [] as Array<number>,
  // Store all intervals for cleanup
  intervals: [] as Array<number>,
  // Store all cleanup callbacks for cleanup
  cleanupCallbacks: [] as Array<() => void>,
  // Store Vue Flow instance for cleanup
  vueFlowInstance: null as any,
  // Store Vue Flow ref for cleanup
  vueFlowRef: null as any,
  // Store node update batcher for cleanup
  nodeBatcher: null as any,
  addWatcher(unwatch: () => void) {
    this.watchers.push(unwatch)
  },

  // Add cleanup callback to be called during cleanup
  addCleanupCallback(callback: () => void) {
    this.cleanupCallbacks.push(callback)
  },

  // Add event listener to cleanup list
  addEventListener(element: any, event: string, handler: any, options?: any) {
    // Add null check to prevent errors when element is not available
    if (!element) {
      console.warn(`⚠️ [RESOURCE_MANAGER] Cannot add event listener for "${event}" - element is null or undefined`)
      return
    }

    // Check if element has addEventListener method
    if (typeof element.addEventListener !== 'function') {
      console.warn(`⚠️ [RESOURCE_MANAGER] Element does not have addEventListener method for "${event}"`)
      return
    }

    element.addEventListener(event, handler, options)
    this.eventListeners.push({ element, event, handler, options })
  },

  // Add timer to cleanup list
  addTimer(timerId: number) {
    this.timers.push(timerId)
    return timerId
  },

  // Add interval to cleanup list
  addInterval(intervalId: number) {
    this.intervals.push(intervalId)
    return intervalId
  },

  // Clean up all resources
  cleanup() {
    console.log('🧹 [MEMORY] Cleaning up CanvasView resources...')

    // Clean up watchers
    this.watchers.forEach(unwatch => {
      try {
        unwatch()
      } catch (error) {
        console.warn('⚠️ [MEMORY] Error cleaning up watcher:', error)
      }
    })
    this.watchers = []

    // Clean up event listeners
    this.eventListeners.forEach(({ element, event, handler, options }) => {
      try {
        if (element && typeof element.removeEventListener === 'function') {
          element.removeEventListener(event, handler, options)
        }
      } catch (error) {
        console.warn('⚠️ [MEMORY] Error removing event listener:', error)
      }
    })
    this.eventListeners = []

    // Clean up timers
    this.timers.forEach(timerId => {
      try {
        clearTimeout(timerId)
      } catch (error) {
        console.warn('⚠️ [MEMORY] Error clearing timer:', error)
      }
    })
    this.timers = []

    // Clean up intervals
    this.intervals.forEach(intervalId => {
      try {
        clearInterval(intervalId)
      } catch (error) {
        console.warn('⚠️ [MEMORY] Error clearing interval:', error)
      }
    })
    this.intervals = []

    // Clean up cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.warn('⚠️ [MEMORY] Error executing cleanup callback:', error)
      }
    })
    this.cleanupCallbacks = []

      // Enhanced Vue Flow cleanup
    this.cleanupVueFlow()

    // Clean up node update batcher
    if (this.nodeBatcher) {
      try {
        this.nodeBatcher.clear()
        console.log('🧹 [BATCH] Cleared node update batcher')
      } catch (error) {
        console.warn('⚠️ [BATCH] Error clearing node update batcher:', error)
      }
      this.nodeBatcher = null
    }

    console.log('✅ [MEMORY] CanvasView resource cleanup completed')
  },

  // Enhanced Vue Flow specific cleanup
  cleanupVueFlow() {
    console.log('🧹 [VUE_FLOW] Starting Vue Flow cleanup...')

    try {
      // Clear reactive arrays first
      if (typeof nodes !== 'undefined' && nodes.value && Array.isArray(nodes.value)) {
        nodes.value.length = 0
        console.log('🧹 [VUE_FLOW] Cleared nodes array')
      }

      if (typeof edges !== 'undefined' && edges.value && Array.isArray(edges.value)) {
        edges.value.length = 0
        console.log('🧹 [VUE_FLOW] Cleared edges array')
      }

      // Clear Vue Flow instance
      if (this.vueFlowInstance) {
        if (typeof this.vueFlowInstance.destroy === 'function') {
          this.vueFlowInstance.destroy()
        }
        if (this.vueFlowInstance.clearNodes && typeof this.vueFlowInstance.clearNodes === 'function') {
          this.vueFlowInstance.clearNodes()
        }
        if (this.vueFlowInstance.clearEdges && typeof this.vueFlowInstance.clearEdges === 'function') {
          this.vueFlowInstance.clearEdges()
        }
        this.vueFlowInstance = null
        console.log('🧹 [VUE_FLOW] Cleared Vue Flow instance')
      }

      // Clean up any remaining DOM elements
      const remainingNodes = document.querySelectorAll('.vue-flow__node, .vue-flow__edge, .vue-flow__controls, .vue-flow__panel')
      if (remainingNodes.length > 0) {
        console.log(`🧹 [VUE_FLOW] Removing ${remainingNodes.length} orphaned Vue Flow DOM elements`)
        remainingNodes.forEach((node: any) => {
          if (node.parentNode) {
            node.parentNode.removeChild(node)
          }
        })
      }

      // Clear any global Vue Flow references
      if (typeof window !== 'undefined') {
        delete (window as any).__vueFlow
        delete (window as any).__vueFlowInstances
      }

    } catch (error) {
      console.warn('⚠️ [VUE_FLOW] Error during Vue Flow cleanup:', error)
    }

    console.log('✅ [VUE_FLOW] Vue Flow cleanup completed')
  },

  // Set Vue Flow ref for cleanup
  setVueFlowRef(ref: any) {
    this.vueFlowRef = ref
  },

  // Set node update batcher for cleanup
  setNodeBatcher(batcher: any) {
    this.nodeBatcher = batcher
  }
}

// Execute operation with loading state and error handling
const executeWithFeedback = async <T>(
  operation: keyof typeof operationLoading.value,
  operationName: string,
  fn: () => Promise<T>,
  retryable: boolean = false
): Promise<T> => {
  setOperationLoading(operation, true)

  try {
    const result = await fn()
    setOperationLoading(operation, false)
    return result
  } catch (error) {
    setOperationError(operationName, error instanceof Error ? error.message : String(error), retryable)
    setOperationLoading(operation, false)
    throw error
  }
}

// System restart mechanism for critical failures
const performSystemRestart = async () => {
  console.log('🔄 [SYSTEM] Performing critical system restart...')
  setOperationLoading('loading', true)
  setOperationError('System Restart', 'Restarting application...', false)

  try {
    // Clear all reactive state
    clearOperationError()
    nodes.value = []
    edges.value = []
    recentlyRemovedEdges.value.clear()

    // Reset store states safely
    if (storeHealth.canvasStore) {
      canvasStore.setSelectedNodes([])
      canvasStore.selectedNodeIds = []
    }

    // Reset reactive states
    isHandlingNodeChange.value = false
    isSyncing.value = false
    Object.keys(operationLoading.value).forEach(key => {
      operationLoading.value[key as keyof typeof operationLoading.value] = false
    })

    // Reinitialize database connection
    console.log('🔄 [SYSTEM] Reinitializing database connection...')
    if (typeof window !== 'undefined' && (window as any).pomoFlowDb) {
      try {
        const dbInfo = await (window as any).pomoFlowDb.info()
        console.log('✅ [SYSTEM] Database connection verified:', {
          name: dbInfo.db_name,
          doc_count: dbInfo.doc_count
        })
      } catch (dbError) {
        console.error('❌ [SYSTEM] Database verification failed:', dbError)
        throw new Error('Database connection could not be verified')
      }
    }

    // Resync data
    console.log('🔄 [SYSTEM] Resynchronizing data...')
    await nextTick()
    syncNodes()
    syncEdges()

    setOperationLoading('loading', false)
    console.log('✅ [SYSTEM] System restart completed successfully')

    // Show success notification
    if (window.__notificationApi) {
      window.__notificationApi({
        type: 'success',
        title: 'System Restarted',
        content: 'Application has been successfully restarted and all systems are operational.'
      })
    }

    return true
  } catch (error) {
    setOperationError('System Restart', `Critical restart failed: ${error instanceof Error ? error.message : String(error)}`, true)
    setOperationLoading('loading', false)
    console.error('❌ [SYSTEM] Critical restart failed:', error)

    // Show error notification
    if (window.__notificationApi) {
      window.__notificationApi({
        type: 'error',
        title: 'System Restart Failed',
        content: 'Unable to restart the application. Please refresh the page manually.'
      })
    }

    return false
  }
}

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
        syncNodes()
        syncEdges()
        setOperationLoading('syncing', false)
      } catch (error) {
        setOperationError('Sync Operation', 'Retry failed: Unable to synchronize data', true)
        setOperationLoading('syncing', false)
      }
      break
    default:
      console.warn(`[SYSTEM] No retry implementation for operation type: ${type}`)
  }
}

// Edge Context Menu state
const showEdgeContextMenu = ref(false)
const edgeContextMenuX = ref(0)
const edgeContextMenuY = ref(0)
const selectedEdge = ref<any>(null)

// Edge disconnection tracking - prevent recently removed edges from being recreated
const recentlyRemovedEdges = ref(new Set<string>())

// Node Context Menu state (for sections)
const showNodeContextMenu = ref(false)
const nodeContextMenuX = ref(0)
const nodeContextMenuY = ref(0)
const selectedNode = ref<any>(null)

// Group Modal state
const isGroupModalOpen = ref(false)
const selectedGroup = ref<any>(null)
const groupModalPosition = ref({ x: 100, y: 100 })

// Section Wizard state
const isSectionWizardOpen = ref(false)
const sectionWizardPosition = ref({ x: 100, y: 100 })

// Group Edit Modal state
const isGroupEditModalOpen = ref(false)
const selectedSectionForEdit = ref<any>(null)


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
let lastTasksWithCanvasPositions: any[] = []
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

const hasInboxTasks = computed(() => {
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
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (!task.canvasPosition && task.isInInbox !== false && task.status !== 'done') {
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

    // Expand bounds significantly to allow for extreme zoom levels
    const expandedBounds = {
      minX: contentBounds.minX - padding * 10,
      minY: contentBounds.minY - padding * 10,
      maxX: contentBounds.maxX + padding * 10,
      maxY: contentBounds.maxY + padding * 10
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
const resizeHandleStyle = computed(() => ({
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

const resizeLineStyle = computed(() => ({
  backgroundColor: 'var(--brand-primary)',
  opacity: 0.2, // Subtle, not prominent
  transition: 'background-color 0.2s ease'
}))

// Glass morphism edge handles - Vertical pills for wide sections
const edgeHandleStyle = computed(() => ({
  width: '6px',   // Thin vertical bar
  height: '24px',  // Tall for wide sections
  borderRadius: '3px',  // Pill shape
  background: 'rgba(255, 255, 255, 0.25)',  // Subtle white glass
  border: '1px solid rgba(99, 102, 241, 0.5)',  // Accent border
  backdropFilter: 'blur(8px)',  // Glass effect
  WebkitBackdropFilter: 'blur(8px)',  // Safari support
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
}))

// Track resize state for preview - ENHANCED with better state isolation
const resizeState = ref({
  isResizing: false,
  sectionId: null as string | null,
  startX: 0, // Track original section x position
  startY: 0, // Track original section y position
  startWidth: 0,
  startHeight: 0,
  currentWidth: 0,
  currentHeight: 0,
  handlePosition: null as string | null,
  isDragging: false, // Track if we're in a drag operation
  resizeStartTime: 0 // Track when resize started for debugging
})

// Get section resize style for individual sections
const getSectionResizeStyle = (section: any): Record<string, string | number> => {
  if (!resizeState.value.isResizing || resizeState.value.sectionId !== section.id) {
    return {}
  }

  return {
    position: 'fixed',
    left: `${section.position.x * viewport.value?.zoom + viewport.value?.x}px`,
    top: `${section.position.y * viewport.value?.zoom + viewport.value?.y}px`,
    width: `${resizeState.value.currentWidth * viewport.value?.zoom}px`,
    height: `${resizeState.value.currentHeight * viewport.value?.zoom}px`,
    pointerEvents: 'none',
    zIndex: 999
  }
}

// Register custom node types
const nodeTypes = markRaw({
  taskNode: TaskNode,
  sectionNode: SectionNodeSimple
})

// Using default Vue Flow edge types - smoothstep, bezier, etc.
// Custom edge types not needed for current implementation

// Get Vue Flow instance methods
const {
  fitView: vueFlowFitView,
  zoomIn: vueFlowZoomIn,
  zoomOut: vueFlowZoomOut,
  zoomTo: vueFlowZoomTo,
  getSelectedNodes,
  getNodes,
  findNode,
  onEdgeClick,
  onEdgeContextMenu,
  removeEdges
} = useVueFlow()


// Get nodesInitialized composable - tracks when all nodes have measured dimensions
const nodesInitialized = useNodesInitialized()

// Declare reactive state before usage
const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

// 🔧 Vue Flow Stability System - Enhanced lifecycle, error handling, and performance monitoring
const vueFlowStore = ref(null)
const vueFlowStability = useVueFlowStability(
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
  }
)

// 🗃️ Vue Flow State Management System - Robust state synchronization and conflict resolution
const vueFlowStateManager = useVueFlowStateManager(
  nodes,
  edges,
  {
    enableOptimisticUpdates: true,
    enableBatchUpdates: true,
    batchDelay: 50,
    enableStateValidation: true,
    enableConflictResolution: true
  }
)

// 🚨 Vue Flow Error Handling System - Comprehensive error handling and recovery
// NOTE: enablePerformanceMonitoring disabled to fix 0-2 FPS issue (was creating RAF loop)
const vueFlowErrorHandling = useVueFlowErrorHandling({
  enableAutoRecovery: true,
  maxRetryAttempts: 3,
  enableUserNotifications: true,
  enableErrorLogging: false, // Disabled to reduce console spam
  enablePerformanceMonitoring: false // Disabled - was causing FPS drop via RAF loop
})

// 🚀 Phase 2: Vue Flow Integration & Canvas Positioning - Add VueUse composables
const { width, height } = useWindowSize()
const { ctrl, shift } = useMagicKeys()

// 🎯 Automatic canvas position generation for tasks without positions
const generateCanvasPosition = (taskIndex: number): { x: number; y: number } => {
  const gridSize = 200
  const padding = 100
  const cols = Math.floor((width.value - padding * 2) / gridSize)

  const row = Math.floor(taskIndex / cols)
  const col = taskIndex % cols

  return {
    x: padding + col * gridSize + Math.random() * 50, // Add small random variation
    y: padding + row * gridSize + Math.random() * 50
  }
}

// 🚀 CPU Optimization: Efficient Node Update Batching System
class NodeUpdateBatcher {
  private batchQueue: Array<() => void> = []
  private isProcessing = false
  private batchTimeout: number | null = null
  private readonly BATCH_DELAY = 16 // ~60fps
  private readonly MAX_BATCH_SIZE = 50

  schedule(update: () => void, priority: 'high' | 'normal' | 'low' = 'normal') {
    if (priority === 'high') {
      // High priority updates run immediately
      update()
      return
    }

    this.batchQueue.push(update)

    // Start batch processing if not already running
    if (!this.isProcessing) {
      this.startBatchProcessing()
    }
  }

  private startBatchProcessing() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
    }

    this.batchTimeout = window.setTimeout(() => {
      this.processBatch()
    }, this.BATCH_DELAY)
  }

  private processBatch() {
    if (this.isProcessing || this.batchQueue.length === 0) return

    this.isProcessing = true

    try {
      // Process updates in chunks to avoid blocking the main thread
      const chunk = this.batchQueue.splice(0, Math.min(this.MAX_BATCH_SIZE, this.batchQueue.length))

      // Batch all DOM updates together
      chunk.forEach(update => {
        try {
          update()
        } catch (error) {
          console.warn('⚠️ [BATCH] Error in batched update:', error)
        }
      })

      // Update Vue Flow internals once after all updates
      nextTick(() => {
        (vueFlowRef.value as any)?.updateNodeInternals()
      })

    } catch (error) {
      console.warn('⚠️ [BATCH] Error processing batch:', error)
    } finally {
      this.isProcessing = false

      // Continue processing if more items in queue
      if (this.batchQueue.length > 0) {
        this.startBatchProcessing()
      } else {
        this.batchTimeout = null
      }
    }
  }

  flush() {
    // Immediately process all pending updates
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }
    this.processBatch()
  }

  clear() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }
    this.batchQueue.length = 0
    this.isProcessing = false
  }

  getQueueSize(): number {
    return this.batchQueue.length
  }
}

// Global batcher instance
const nodeUpdateBatcher = new NodeUpdateBatcher()

// Register batcher with resource manager for cleanup
resourceManager.setNodeBatcher(nodeUpdateBatcher)

// Optimized sync functions using the batching system
const batchedSyncNodes = (priority: 'high' | 'normal' | 'low' = 'normal') => {
  nodeUpdateBatcher.schedule(() => {
    // FIXED: Also check isNodeDragging to prevent sync during drag operations
    if (!isHandlingNodeChange.value && !isSyncing.value && !isNodeDragging.value) {
      syncNodes()
    }
  }, priority)
}

const batchedSyncEdges = (priority: 'high' | 'normal' | 'low' = 'normal') => {
  nodeUpdateBatcher.schedule(() => {
    if (!isHandlingNodeChange.value && !isSyncing.value) {
      syncEdges()
    }
  }, priority)
}

// Legacy throttled function for backward compatibility
const throttledSyncNodes = () => batchedSyncNodes('normal')

// Legacy debounced functions for backward compatibility
const debouncedSyncNodes = () => batchedSyncNodes('normal')
const debouncedSyncEdges = () => batchedSyncEdges('normal')

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
  const actualEdge = edge || (event as any).edge || (event as any).selected?.edge

  console.log('🖱️ Edge click detected:', {
    shiftKey: event.shiftKey,
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
      hasEdge: !!(event as any).edge,
      hasSelected: !!(event as any).selected,
      selectedEdge: (event as any).selected?.edge
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
  const actualEdge = edge || (event as any).edge || (event as any).selected?.edge

  // Guard against undefined edge parameter
  if (!actualEdge) {
    console.warn('⚠️ Edge context menu event received but edge parameter is undefined, available event data:', {
      event,
      hasEdge: !!(event as any).edge,
      hasSelected: !!(event as any).selected,
      selectedEdge: (event as any).selected?.edge
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
  selectedEdge.value = actualEdge
  showEdgeContextMenu.value = true
  closeCanvasContextMenu()
  closeNodeContextMenu()

  console.log('✅ Edge context menu should be visible at:', {
    x: edgeContextMenuX.value,
    y: edgeContextMenuY.value,
    edgeId: actualEdge.id
  })
})

// Safe computed properties that prevent undefined values from reaching VueFlow
// Using writable computed to allow Vue Flow's v-model to update nodes/edges
const safeNodes = computed({
  get() {
    if (!systemHealthy.value || !Array.isArray(nodes.value)) {
      return []
    }
    return nodes.value.filter(node => node && node.id && node.type)
  },
  set(newNodes: Node[]) {
    nodes.value = newNodes
  }
})

const safeEdges = computed({
  get() {
    if (!systemHealthy.value || !Array.isArray(edges.value)) {
      return []
    }
    return edges.value.filter(edge => edge && edge.id && edge.source && edge.target)
  },
  set(newEdges: Edge[]) {
    edges.value = newEdges
  }
})

// Track if we've done initial viewport centering
const hasInitialFit = ref(false)

// Track if canvas is ready to display (prevents flash during initial fitView)
const isCanvasReady = ref(false)

// Track if Vue Flow is ready for operations (fixes alignment tools timing issues)
const isVueFlowReady = ref(false)

// Track if Vue Flow component is mounted (separate from viewport centering)
const isVueFlowMounted = ref(false)

// ✅ VueFlow component reference
const vueFlowRef = ref(null)

// 🔧 ROUND 3 FIX: Sync guards to prevent race conditions
const isCanvasSyncing = ref(false)
const lastSyncTime = ref(0)

const safeSyncNodes = () => {
  const now = Date.now()
  // Throttle sync to prevent race conditions
  if (now - lastSyncTime.value < 500) {
    console.log('🚫 [syncNodes] Throttled - skipping rapid sync call')
    return
  }

  if (isCanvasSyncing.value) {
    console.log('🚫 [syncNodes] Already syncing - skipping duplicate call')
    return
  }

  isCanvasSyncing.value = true
  lastSyncTime.value = now

  try {
    syncNodes()
  } finally {
    isCanvasSyncing.value = false
  }
}

// Sync nodes from store with parent-child relationships and collapsible sections
const syncNodes = () => {
  try {
    const allNodes: Node[] = []

  // Add section nodes FIRST (so they render in background) with graceful degradation
  const sections = safeStoreOperation(
    () => canvasStore.sections || [],
    [], // Fallback: empty sections array
    'canvas sections access',
    'canvasStore'
  )

  sections.forEach(section => {
    allNodes.push({
      id: `section-${section.id}`,
      type: 'sectionNode',
      position: { x: section.position.x, y: section.position.y },

      // Use width/height as NODE PROPERTIES (not inline styles)
      // This allows NodeResizer to work without inline style conflicts
      width: section.position.width,
      height: section.isCollapsed ? 80 : section.position.height,

      style: {
        zIndex: 1
      },
      data: {
        id: section.id,
        name: section.name,
        color: section.color,
        type: section.type,
        propertyValue: section.propertyValue,
        taskCount: section.isCollapsed ? canvasStore.getCollapsedTaskCount(section.id) : getTaskCountForSection(section.id),
        isCollapsed: section.isCollapsed
      },
      draggable: true,
      selectable: true
    })
  })

  // 🚀 REMOVED: Auto-positioning logic that was forcing all tasks onto canvas
  // OLD: Batch process tasks without positions and assign them canvas positions
  // REASON: This was preventing inbox tasks from staying in inbox by auto-assigning canvasPosition
  // NEW: Tasks only get positioned when explicitly placed on canvas (drag-drop, right-click)

  // Safety check: ensure filteredTasks is an array
  const safeFilteredTasks = Array.isArray(filteredTasks.value) ? filteredTasks.value : []

  // 🔧 ROUND 3 FIX: Validate and normalize task canvas state before filtering
  // This prevents inconsistent states that cause tasks to disappear
  const validatedTasks = safeFilteredTasks.map(task => {
    const normalizedTask = { ...task }

    // Ensure isInInbox is properly set based on canvasPosition
    if (normalizedTask.isInInbox === undefined) {
      normalizedTask.isInInbox = !normalizedTask.canvasPosition
    }

    // Validate canvasPosition coordinates
    if (normalizedTask.canvasPosition) {
      if (typeof normalizedTask.canvasPosition.x !== 'number' ||
          typeof normalizedTask.canvasPosition.y !== 'number') {
        console.warn(`⚠️ [syncNodes] Invalid canvasPosition for task ${task.id}:`, normalizedTask.canvasPosition)
        normalizedTask.canvasPosition = undefined
        normalizedTask.isInInbox = true
      }
    }

    return normalizedTask
  })

  // 🔧 ROUND 3 FIX: Enhanced debug logging for canvas task filtering
  console.log('🔍 [syncNodes] Canvas task filtering analysis:', {
    totalTasks: safeFilteredTasks.length,
    tasksWithInboxFalse: safeFilteredTasks.filter(t => t.isInInbox === false).length,
    tasksWithCanvasPosition: safeFilteredTasks.filter(t => t.canvasPosition).length,
    tasksWithBoth: safeFilteredTasks.filter(t => t.isInInbox === false && t.canvasPosition).length,
    filteredOutTasks: safeFilteredTasks.filter(t =>
      t && t.id && !(
        (t.isInInbox === false && t.canvasPosition) ||
        (t.canvasPosition && t.canvasPosition.x !== undefined && t.canvasPosition.y !== undefined)
      )
    ).map(t => ({ id: t.id, title: t.title.substring(0, 30), isInInbox: t.isInInbox, hasCanvasPos: !!t.canvasPosition }))
  })

  // 🔧 ROUND 3 FIX: Show tasks that have valid canvas positions OR are explicitly on canvas
  // This prevents tasks from disappearing due to inconsistent state during transitions
  // Logic: Tasks appear if they EITHER (are explicitly moved to canvas) OR (have valid canvas position)
  validatedTasks
    .filter(task => task && task.id && (
      // Tasks explicitly moved to canvas (both conditions met)
      (task.isInInbox === false && task.canvasPosition) ||
      // Tasks with valid canvas position (handles legacy/inconsistent states)
      (task.canvasPosition && task.canvasPosition.x !== undefined && task.canvasPosition.y !== undefined)
    ))
    .forEach((task, index) => {
      // 🎯 FIXED: Handle positioning for tasks with and without canvasPosition
      let position
      if (task.canvasPosition) {
        // Task already has a position from previous canvas placement
        position = task.canvasPosition
      } else {
        // Task doesn't have canvasPosition - assign a default position in the inbox area
        position = {
          x: 50 + (index % 5) * 200, // Arrange in a grid, 5 tasks per row
          y: 100 + Math.floor(index / 5) * 120 // Next row every 5 tasks
        }
      }

    // Find which section this task belongs to (if any)
    const section = canvasStore.sections.find(s => {
      const { x, y, width, height } = s.position
      const taskX = position.x
      const taskY = position.y

      return taskX >= x && taskX <= x + width && taskY >= y && taskY <= y + height
    })

    // 🔍 DEBUG: Log section filtering decision
    console.log('🔍 [syncNodes] Task filtering:', {
      taskId: task.id,
      taskTitle: task.title,
      sectionId: section?.id,
      sectionName: section?.name,
      sectionType: section?.type,
      isCollapsed: section?.isCollapsed,
      willBeFiltered: section?.isCollapsed
    })

    // 🔧 FIXED: Show tasks in collapsed sections with different styling instead of hiding them completely
    // OLD: Skip tasks that are in collapsed sections - if (section && section.isCollapsed) return
    // NEW: Keep tasks visible even in collapsed sections

    // Calculate relative position if task is in a section
    let finalPosition = position  // Use the position we generated above
    let parentNode: string | undefined = undefined

    if (section) {
      // Enable parent-child relationship so tasks move with sections
      // Convert absolute position to relative position within section
      finalPosition = {
        x: position.x - section.position.x,
        y: position.y - section.position.y
      }
      parentNode = `section-${section.id}`
      // Note: NOT using extent: 'parent' so tasks can still be dragged out
    }

    allNodes.push({
      id: task.id,
      type: 'taskNode',
      position: finalPosition,
      parentNode: parentNode,
      style: { zIndex: 10 },
      data: { task },
      draggable: true,
      selectable: true
    })
  })

  // Validate nodes before assignment
  const validNodes = allNodes.filter(node => {
    if (!node || !node.id || !node.type) {
      console.warn('⚠️ Invalid node detected during sync:', node)
      return false
    }
    return true
  })

  nodes.value = validNodes
  console.log(`🔄 [SYNC] Updated nodes: ${validNodes.length} valid nodes`)

  // Clean up any stale Vue Flow DOM nodes after sync
  nextTick(() => {
    try {
      cleanupStaleNodes()
    } catch (cleanupError) {
      console.error('❌ Failed to cleanup stale nodes:', cleanupError)
    }
  })
  } catch (error) {
    console.error('❌ Critical error in syncNodes():', error)
    // Attempt to recover by keeping existing nodes
    console.log('🔧 Recovery: Keeping existing nodes array unchanged')
  }
}

const getTaskCountForSection = (sectionId: string) => {
  const section = canvasStore.sections.find(s => s.id === sectionId)
  if (!section) return 0

  // Use the new canvas store utility for accurate task counting
  return canvasStore.getTaskCountInSection(section, filteredTasks.value)
}

// Sync edges from store
const syncEdges = () => {
  try {
    const allEdges: Edge[] = []

    // Get tasks with graceful degradation
    const tasks = safeStoreOperation(
      () => taskStore.tasks || [],
      [], // Fallback: empty tasks array
      'tasks access for syncEdges',
      'taskStore'
    )

    const taskIds = new Set(tasks.map(t => t.id))

    console.log('🔄 syncEdges() called - recentlyRemovedEdges:', Array.from(recentlyRemovedEdges.value))

    tasks.forEach(task => {
      if (task.dependsOn && task.dependsOn.length > 0) {
        // Clean up orphaned dependencies (remove references to deleted tasks)
        const validDependencies = task.dependsOn.filter(depId => taskIds.has(depId))

        // Update task if orphaned dependencies were found
        if (validDependencies.length !== task.dependsOn.length) {
          try {
            taskStore.updateTaskWithUndo(task.id, { dependsOn: validDependencies })
          } catch (taskUpdateError) {
            console.error(`❌ Failed to update task ${task.id} dependencies:`, taskUpdateError)
            // Continue with processing even if one task fails
          }
        }

        // Create edges only for valid dependencies where source and target both exist
        validDependencies.forEach(depId => {
          const edgeId = `${depId}-${task.id}`

          // Skip creating edge if it was recently removed by user action
          if (recentlyRemovedEdges.value.has(edgeId)) {
            console.log(`🚫 Skipping edge recreation (recently removed): ${edgeId}`)
            return
          }

          const sourceTask = taskStore.tasks.find(t => t.id === depId)
          const targetTask = taskStore.tasks.find(t => t.id === task.id)

          // Only create edge if both source and target tasks exist and are on canvas
          if (sourceTask && targetTask &&
              sourceTask.canvasPosition && targetTask.canvasPosition) {
            console.log(`✅ Creating edge: ${edgeId}`)
            allEdges.push({
              id: edgeId,
              source: depId,
              target: task.id,
              type: 'smoothstep',
              animated: false,
              zIndex: 1000,
              markerEnd: 'url(#arrowhead)',
              style: {
                strokeWidth: '2px',
                stroke: 'var(--border-secondary)'
              },
              data: {
                hoverMarkerEnd: 'url(#arrowhead-hover)'
              }
            })
          }
        })
      }
    })

    // Validate edges before assignment
    const validEdges = allEdges.filter(edge => {
      if (!edge || !edge.id || !edge.source || !edge.target) {
        console.warn('⚠️ Invalid edge detected during sync:', edge)
        return false
      }
      return true
    })

    console.log(`📊 syncEdges() complete - created ${validEdges.length} edges, blocked ${recentlyRemovedEdges.value.size} edges`)
    edges.value = validEdges
  } catch (error) {
    console.error('❌ Critical error in syncEdges():', error)
    // Attempt to recover by keeping existing edges
    console.log('🔧 Recovery: Keeping existing edges array unchanged')
  }
}

// CPU Optimization: Watch for filtered task changes with intelligent batching
// NOTE: Console logs removed to fix 0-2 FPS issue (was causing 12,000+ logs/sec)
resourceManager.addWatcher(
  watch(filteredTasks, () => {
    batchedSyncNodes('high')
    batchedSyncEdges('high')
  }, { deep: true })
)

// CPU Optimization: Watch sections with smart batching
resourceManager.addWatcher(
  watch(() => canvasStore.sections.map(s => s.id).join(','), () => {
    batchedSyncNodes('normal')
  })
)

// CPU Optimization: Watch section collapse state changes with high priority (affects layout)
resourceManager.addWatcher(
  watch(() => canvasStore.sections.map(s => ({ id: s.id, isCollapsed: s.isCollapsed })), () => {
    batchedSyncNodes('high')
  }, { deep: true })
)

// CPU Optimization: Watch task position changes with smart batching (low priority - only visual)
resourceManager.addWatcher(
  watch(() => taskStore.tasks.map(t => ({ id: t.id, canvasPosition: t.canvasPosition })), () => {
    batchedSyncNodes('low')
  }, { deep: true })
)

// FIX: Watch for isInInbox changes - triggers sync when tasks move between inbox and canvas
// This was missing and caused tasks dragged from inbox to not appear until refresh
// Using flush: 'post' to ensure sync runs after Vue has processed all reactive updates
resourceManager.addWatcher(
  watch(() => taskStore.tasks.map(t => ({ id: t.id, isInInbox: t.isInInbox })), () => {
    console.log('🔄 [WATCHER] isInInbox changed - triggering high priority sync')
    batchedSyncNodes('high')
  }, { deep: true, flush: 'post' })
)

// Watch for canvas store selection changes and sync with Vue Flow nodes - FIXED to prevent disconnection
// NOTE: Console logs reduced to fix 0-2 FPS issue
resourceManager.addWatcher(
  watch(() => canvasStore.selectedNodeIds, (newSelectedIds) => {
    // Update Vue Flow nodes to match canvas store selection
    let updateCount = 0
    nodes.value.forEach(node => {
      const shouldBeSelected = newSelectedIds.includes(node.id)
      const nodeAny = node as any
      if (nodeAny.selected !== shouldBeSelected) {
        nodeAny.selected = shouldBeSelected
        updateCount++
      }
    })
  }, { deep: true, flush: 'post' }) // Changed from 'sync' to 'post' to batch updates
)

// Watch for Vue Flow node selection changes and sync back to canvas store (bidirectional sync)
// NOTE: Console logs removed to fix 0-2 FPS issue
resourceManager.addWatcher(
  watch(() => nodes.value.filter(n => (n as any).selected).map(n => n.id), (vueFlowSelectedIds) => {
    // Only update canvas store if there's an actual difference (prevents infinite loops)
    const currentStoreIds = canvasStore.selectedNodeIds
    const hasChanged = vueFlowSelectedIds.length !== currentStoreIds.length ||
                     vueFlowSelectedIds.some(id => !currentStoreIds.includes(id)) ||
                     currentStoreIds.some(id => !vueFlowSelectedIds.includes(id))

    if (hasChanged) {
      canvasStore.setSelectedNodes(vueFlowSelectedIds)
    }
  }, { deep: true, flush: 'post' }) // Changed from 'sync' to 'post' to batch updates
)

// Pre-alignment state validation function
const validateAlignmentState = (minNodes: number = 2): { canProceed: boolean; reason?: string } => {
  console.log('🔍 Validating alignment state...')
  console.log(`  Vue Flow mounted: ${isVueFlowMounted.value}`)
  console.log(`  Vue Flow ready: ${isVueFlowReady.value}`)
  console.log(`  Canvas ready: ${isCanvasReady.value}`)
  console.log(`  Total nodes: ${nodes.value.length}`)
  console.log(`  Selected in store: ${canvasStore.selectedNodeIds.length}`)

  // Check if Vue Flow component is mounted (this is now less restrictive than waiting for viewport centering)
  if (!isVueFlowMounted.value) {
    return {
      canProceed: false,
      reason: 'Vue Flow component not yet mounted - please wait'
    }
  }

  // Check if Vue Flow instance is available (not just viewport centered)
  const vueFlowInstance = document.querySelector('.vue-flow')
  if (!vueFlowInstance) {
    return {
      canProceed: false,
      reason: 'Vue Flow component not yet mounted'
    }
  }

  if (nodes.value.length === 0) {
    return {
      canProceed: false,
      reason: 'No nodes available in canvas'
    }
  }

  // Check selection synchronization
  const vueFlowSelected = nodes.value.filter(n => (n as any).selected && n.type === 'taskNode')
  console.log(`  Selected in Vue Flow: ${vueFlowSelected.length}`)

  if (vueFlowSelected.length < minNodes) {
    return {
      canProceed: false,
      reason: `Need at least ${minNodes} selected tasks, have ${vueFlowSelected.length}`
    }
  }

  // Verify selection state synchronization
  const syncInfo = {
    storeSelection: canvasStore.selectedNodeIds.length,
    vueFlowSelection: vueFlowSelected.length,
    matched: vueFlowSelected.filter(n => canvasStore.selectedNodeIds.includes(n.id)).length
  }

  console.log('  Selection sync info:', syncInfo)

  if (syncInfo.matched !== syncInfo.storeSelection) {
    return {
      canProceed: false,
      reason: 'Selection state not synchronized between store and Vue Flow'
    }
  }

  console.log('✅ Alignment state validation passed')
  return { canProceed: true }
}

// Auto-center viewport on tasks when all nodes are initialized with dimensions - using resourceManager
// Uses Vue Flow's recommended useNodesInitialized composable for reliable timing
// FIX: Also handle case where nodes array is empty (nodesInitialized won't fire with 0 nodes)
resourceManager.addWatcher(
  watch([nodesInitialized, () => nodes.value.length], async ([initialized, nodeCount]) => {
    // Skip if already initialized
    if (hasInitialFit.value) return

    // Case 1: Nodes exist and are all initialized - center viewport
    if (initialized && nodeCount > 0) {
      console.log('✅ All nodes initialized with dimensions, auto-centering viewport')
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

// CPU Optimization: Watch sections with batching
// NOTE: Console log removed to fix 0-2 FPS issue
resourceManager.addWatcher(
  watch(sections, () => {
    batchedSyncNodes('normal')
  }, { deep: true })
)

// CPU Optimization: Debounced viewport watch to prevent excessive updates
const debouncedViewportUpdate = useDebounceFn(() => {
  nextTick(() => {
    (vueFlowRef.value as any)?.updateNodeInternals()
  })
}, 50) // 50ms debounce for viewport changes

// CPU Optimization: Debounced window resize handler with smart batching
const debouncedResizeSync = useDebounceFn(() => {
  batchedSyncNodes('low') // Low priority for resize events
}, 150) // 150ms debounce for resize events

// Register debounced functions with resource manager for cleanup
resourceManager.addCleanupCallback(() => {
  // VueUse debounced functions cleanup
  if (typeof (debouncedViewportUpdate as any).cancel === 'function') {
    (debouncedViewportUpdate as any).cancel()
  }
  if (typeof (debouncedResizeSync as any).cancel === 'function') {
    (debouncedResizeSync as any).cancel()
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
  const inboxTasks = Array.isArray(filteredTasks.value) ? filteredTasks.value.filter(t =>
    t.isInInbox === true && t.status !== 'done'
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

// Helper: Check if task is inside a section
const getContainingSection = (taskX: number, taskY: number, taskWidth: number = 220, taskHeight: number = 100) => {
  return canvasStore.sections.find(section => {
    const { x, y, width, height } = section.position
    const taskCenterX = taskX + taskWidth / 2
    const taskCenterY = taskY + taskHeight / 2

    // For collapsed sections, use the full/original height for containment detection
    // This allows tasks positioned in the logical area to trigger property updates
    const detectionHeight = section.isCollapsed ? height : height

    console.log('[getContainingSection] Checking section:', {
      name: section.name,
      isCollapsed: section.isCollapsed,
      visualHeight: section.isCollapsed ? 80 : height,
      detectionHeight,
      bounds: { x, y, width, height: detectionHeight },
      taskCenter: { x: taskCenterX, y: taskCenterY }
    })

    const isInside = (
      taskCenterX >= x &&
      taskCenterX <= x + width &&
      taskCenterY >= y &&
      taskCenterY <= y + detectionHeight
    )

    if (isInside) {
      console.log('[getContainingSection] ✓ Task is inside section:', section.name)
    }

    return isInside
  })
}

// Helper: Check if coordinates are within section bounds
const isTaskInSectionBounds = (x: number, y: number, section: any, taskWidth: number = 220, taskHeight: number = 100) => {
  const { x: sx, y: sy, width, height } = section.position
  const taskCenterX = x + taskWidth / 2
  const taskCenterY = y + taskHeight / 2

  return (
    taskCenterX >= sx &&
    taskCenterX <= sx + width &&
    taskCenterY >= sy &&
    taskCenterY <= sy + height
  )
}

// Helper: Apply section properties to task
const applySectionPropertiesToTask = (taskId: string, section: any) => {
  console.log('[applySectionPropertiesToTask] Called with:', {
    taskId,
    sectionName: section.name,
    sectionType: section.type,
    propertyValue: section.propertyValue
  })

  const updates: any = {}

  switch (section.type) {
    case 'priority':
      if (!section.propertyValue) return
      updates.priority = section.propertyValue
      break
    case 'status':
      if (!section.propertyValue) return
      updates.status = section.propertyValue
      break
    case 'project':
      if (!section.propertyValue) return
      updates.projectId = section.propertyValue
      break
    case 'custom':  // Allow custom sections with timeline names (e.g., "Today")
    case 'timeline':
      // Check if this is a smart group (today, tomorrow, weekend, etc.)
      if (shouldUseSmartGroupLogic(section.name)) {
        const smartGroupType = getSmartGroupType(section.name)
        if (smartGroupType) {
          console.log(`[applySectionPropertiesToTask] Detected smart group: ${smartGroupType}`)

          // Use smart group logic - set dueDate but keep in inbox
          taskStore.moveTaskToSmartGroup(taskId, smartGroupType)
          console.log(`[applySectionPropertiesToTask] Called moveTaskToSmartGroup for ${smartGroupType}`)
        } else {
          console.log('[applySectionPropertiesToTask] Smart group type not found, using fallback')
          // Fallback to old behavior if smart group detection fails
          taskStore.moveTaskToDate(taskId, section.propertyValue || section.name)
        }
      } else {
        // Regular timeline section - use original behavior
        taskStore.moveTaskToDate(taskId, section.propertyValue || section.name)
      }
      break
  }

  if (Object.keys(updates).length > 0) {
    console.log('[applySectionPropertiesToTask] Applying updates:', updates)
    taskStore.updateTaskWithUndo(taskId, updates)
  } else {
    console.log('[applySectionPropertiesToTask] No updates to apply')
  }
}

// Enhanced error boundary wrapper for Vue Flow operations using comprehensive error handling
const withVueFlowErrorBoundary = (handlerName: string, handler: Function, options?: {
  errorType?: 'validation' | 'rendering' | 'interaction' | 'state' | 'performance' | 'network'
  severity?: 'low' | 'medium' | 'high' | 'critical'
  recoverable?: boolean
}) => {
  // Use the comprehensive error handling system
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

// Handle node drag start - Vue Flow handles parent-child automatically now
const handleNodeDragStart = withVueFlowErrorBoundary('handleNodeDragStart', (event: any) => {
  const { node } = event

  // FIXED: Set drag guard to prevent syncNodes during drag
  isNodeDragging.value = true

  if (node.id.startsWith('section-')) {
    const sectionId = node.id.replace('section-', '')
    const section = canvasStore.sections.find(s => s.id === sectionId)

    if (section) {
      // Just track the start position - Vue Flow will handle child dragging
      console.log(`Started dragging section: ${section.name}`)
    }
  }
})

// Handle node drag stop - save position and apply section properties with parent-child support - FIXED to preserve group selection
const handleNodeDragStop = withVueFlowErrorBoundary('handleNodeDragStop', (event: any) => {
  const { node } = event

  // Preserve selection state during drag operations
  const selectedIdsBeforeDrag = [...canvasStore.selectedNodeIds]

  // Check if it's a section node or task node
  if (node.id.startsWith('section-')) {
    const sectionId = node.id.replace('section-', '')
    const section = canvasStore.sections.find(s => s.id === sectionId)

    if (section) {
      // Calculate position delta and update all child tasks
      const deltaX = node.position.x - section.position.x
      const deltaY = node.position.y - section.position.y

      // Update section position in store
      canvasStore.updateSectionWithUndo(sectionId, {
        position: {
          x: node.position.x,
          y: node.position.y,
          width: node.style?.width ? parseInt(node.style.width) : 300,
          height: node.style?.height ? parseInt(node.style.height) : 200
        }
      })

      // Update all child task positions to maintain relative positioning
      if (Array.isArray(filteredTasks.value)) {
        filteredTasks.value
          .filter(task => {
          if (!task.canvasPosition) return false
          const taskSection = canvasStore.sections.find(s => {
            const { x, y, width, height } = s.position
            return task.canvasPosition!.x >= x &&
                   task.canvasPosition!.x <= x + width &&
                   task.canvasPosition!.y >= y &&
                   task.canvasPosition!.y <= y + height
          })
          return taskSection?.id === sectionId
        })
        .forEach(task => {
          taskStore.updateTaskWithUndo(task.id, {
            canvasPosition: {
              x: task.canvasPosition!.x + deltaX,
              y: task.canvasPosition!.y + deltaY
            }
          })
        })
      }

      console.log(`Section dragged to: (${node.position.x}, ${node.position.y}) with ${Array.isArray(filteredTasks.value) ? filteredTasks.value.filter(t => {
        if (!t.canvasPosition) return false
        const taskSection = canvasStore.sections.find(s => {
          const { x, y, width, height } = s.position
          return t.canvasPosition!.x >= x && t.canvasPosition!.x <= x + width &&
                 t.canvasPosition!.y >= y && t.canvasPosition!.y <= y + height
        })
        return taskSection?.id === sectionId
      }).length : 0} child tasks`)
    }
  } else {
    // For task nodes, update position with improved section handling
    if (node.parentNode) {
      // Task was in a section - convert relative to absolute position
      const sectionId = node.parentNode.replace('section-', '')
      const section = canvasStore.sections.find(s => s.id === sectionId)

      if (section) {
        const absoluteX = section.position.x + node.position.x
        const absoluteY = section.position.y + node.position.y

        taskStore.updateTaskWithUndo(node.id, {
          canvasPosition: { x: absoluteX, y: absoluteY }
        })

        // Check if task moved outside the original section
        const movedOutside = !isTaskInSectionBounds(absoluteX, absoluteY, section)
        if (movedOutside) {
          console.log(`Task ${node.id} moved outside section ${sectionId}`)
        }
      }
    } else {
      // Task was not in a section - update absolute position directly
      taskStore.updateTaskWithUndo(node.id, {
        canvasPosition: { x: node.position.x, y: node.position.y }
      })
    }

    // Check if task is inside a smart section and apply properties (works for all tasks)
    // CRITICAL: Use absolute coordinates, not relative node.position
    let checkX, checkY

    if (node.parentNode) {
      // Task was in a section - need to use absolute coordinates
      const sectionId = node.parentNode.replace('section-', '')
      const section = canvasStore.sections.find(s => s.id === sectionId)
      if (section) {
        checkX = section.position.x + node.position.x
        checkY = section.position.y + node.position.y
      } else {
        checkX = node.position.x
        checkY = node.position.y
      }
    } else {
      // Task has no parent - position is already absolute
      checkX = node.position.x
      checkY = node.position.y
    }

    console.log('[handleNodeDragStop] Checking containment with coordinates:', { checkX, checkY, hasParent: !!node.parentNode })
    const containingSection = getContainingSection(checkX, checkY)
    console.log('[handleNodeDragStop] Found section:', containingSection ? { name: containingSection.name, type: containingSection.type, propertyValue: containingSection.propertyValue } : 'null')

    if (containingSection) {
      // Check if this is a timeline section (by name) even if it's a custom type
      const isTimelineSection = containingSection.name.toLowerCase().includes('today') ||
                                containingSection.name.toLowerCase().includes('weekend')

      // Apply properties for non-custom sections OR custom sections with timeline names
      if (containingSection.type !== 'custom' || isTimelineSection) {
        console.log('[handleNodeDragStop] Applying properties for section:', containingSection.name)
        applySectionPropertiesToTask(node.id, containingSection)
      } else {
        console.log('[handleNodeDragStop] ⚠️ Skipping property application for custom section:', containingSection.name)
      }
    }

    // Restore selection state after drag operation to maintain group connection
    if (selectedIdsBeforeDrag.length > 0) {
      canvasStore.setSelectedNodes(selectedIdsBeforeDrag)

      // Ensure Vue Flow nodes reflect the restored selection
      nodes.value.forEach(node => {
        (node as any).selected = selectedIdsBeforeDrag.includes(node.id)
      })
    }
  }

  // FIXED: Clear drag guard after position is saved
  // Use setTimeout instead of nextTick to prevent race condition where syncNodes
  // runs before position is fully persisted, causing position to reset
  setTimeout(() => {
    isNodeDragging.value = false
  }, 50)
})

// Handle node drag - Vue Flow handles parent-child automatically now
const handleNodeDrag = (event: any) => {
  const { node } = event

  // Optional: Add real-time drag feedback if needed
  // For now, Vue Flow handles the visual dragging
  if (node.id.startsWith('section-')) {
    const sectionId = node.id.replace('section-', '')
    const section = canvasStore.sections.find(s => s.id === sectionId)
    if (section) {
      console.log(`Dragging section: ${section.name}`)
    }
  }
}

// Handle nodes change (for selection tracking and resize) - FIXED to prevent position updates during resize
const handleNodesChange = withVueFlowErrorBoundary('handleNodesChange', (changes: any) => {
  changes.forEach((change: any) => {
    // Track selection changes - FIXED to maintain group connection
    if (change.type === 'select') {
      const currentSelected = nodes.value.filter(n => (n as any).selected).map(n => n.id)

      // Only update canvas store if selection actually changed to prevent disconnection
      const selectedChanged = JSON.stringify(currentSelected) !== JSON.stringify(canvasStore.selectedNodeIds)
      if (selectedChanged) {
        canvasStore.setSelectedNodes(currentSelected)
      }
    }

    // Handle section resize - ONLY update dimensions, not position, and prevent during active resize
    if (change.type === 'dimensions' && change.id.startsWith('section-')) {
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
    if (change.type === 'position' && change.id.startsWith('section-')) {
      const sectionId = change.id.replace('section-', '')
      if (resizeState.value.isResizing && resizeState.value.sectionId === sectionId) {
        return // Skip position updates during resize
      }
    }
  })
})

// Handle resize start with enhanced state tracking - FIXED to prevent coordinate conflicts
const handleResizeStart = (event: any) => {
  console.log('🔧 Resize start:', event)
  const node = event.node || event

  if (node && node.id && node.id.startsWith('section-')) {
    const sectionId = node.id.replace('section-', '')
    const section = canvasStore.sections.find(s => s.id === sectionId)

    if (section) {
      // Initialize resize state with proper bounds checking and enhanced tracking
      resizeState.value = {
        isResizing: true,
        sectionId,
        startX: section.position.x || 0,
        startY: section.position.y || 0,
        startWidth: Math.max(200, Math.min(1200, section.position.width)),
        startHeight: Math.max(150, Math.min(800, section.position.height)),
        currentWidth: Math.max(200, Math.min(1200, section.position.width)),
        currentHeight: Math.max(150, Math.min(800, section.position.height)),
        handlePosition: event.direction || 'se',
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

      // Clear any existing resize preview overlays to prevent conflicts
      const existingOverlays = document.querySelectorAll('.resize-preview-overlay-fixed')
      existingOverlays.forEach(overlay => overlay.remove())
    }
  }
}

// Handle resize with real-time preview - FIXED to prevent coordinate conflicts
const handleResize = (event: any) => {
  if (!resizeState.value.isResizing || !resizeState.value.sectionId) return

  const node = event.node || event
  if (node && node.style) {
    // Calculate dimensions more reliably to prevent coordinate conflicts
    let newWidth = parseInt(node.style.width) || resizeState.value.startWidth
    let newHeight = parseInt(node.style.height) || resizeState.value.startHeight

    // Apply bounds constraints immediately to prevent invalid states
    newWidth = Math.max(200, Math.min(1200, newWidth))
    newHeight = Math.max(150, Math.min(800, newHeight))

    // Update current dimensions for preview
    resizeState.value.currentWidth = newWidth
    resizeState.value.currentHeight = newHeight
  }
}

// Handle resize end with cleanup and validation - FIXED to prevent coordinate conflicts
const handleResizeEnd = (event: any) => {
  console.log('🔧 Resize end:', event)
  const node = event.node || event

  if (node && node.id && node.id.startsWith('section-')) {
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
      currentWidth: 0,
      currentHeight: 0,
      handlePosition: null,
      isDragging: false,
      resizeStartTime: 0
    }
  }
}

// New NodeResizer event handlers with comprehensive logging
const handleSectionResizeStart = ({ sectionId, event }: any) => {
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

const handleSectionResize = ({ sectionId, event }: any) => {
  // NodeResizer provides dimensions in event.params as { width, height }
  const width = event?.params?.width || event?.width
  const height = event?.params?.height || event?.height

  if (width && height) {
    // Update resize state for real-time preview overlay
    resizeState.value.currentWidth = width
    resizeState.value.currentHeight = height
  }
}

const handleSectionResizeEnd = ({ sectionId, event }: any) => {
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
  const width = event?.params?.width || event?.width
  const height = event?.params?.height || event?.height

  // Use the node's actual position from Vue Flow (this is what NodeResizer updates)
  const newX = vueFlowNode.position.x
  const newY = vueFlowNode.position.y

  console.log('📏 [CanvasView] Extracted from Vue Flow node:', {
    newX,
    newY,
    width,
    height,
    nodeWidth: vueFlowNode.width,
    nodeHeight: vueFlowNode.height
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

      // If position changed significantly (more than 1px to avoid jitter), update child task positions
      if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
        console.log('🔄 [CanvasView] Adjusting task positions by delta:', { deltaX, deltaY })

        // Find all tasks inside this section (geometric bounds check using ORIGINAL section bounds)
        const tasksInSection = Array.isArray(filteredTasks.value) ? filteredTasks.value.filter(task => {
          if (!task.canvasPosition || task.isInInbox || section.isCollapsed) return false

          const taskX = task.canvasPosition.x
          const taskY = task.canvasPosition.y

          // Check if task was inside the section's ORIGINAL bounds
          return taskX >= resizeState.value.startX &&
                 taskX <= resizeState.value.startX + resizeState.value.startWidth &&
                 taskY >= resizeState.value.startY &&
                 taskY <= resizeState.value.startY + resizeState.value.startHeight
        }) : []

        console.log(`📦 [CanvasView] Found ${tasksInSection.length} tasks to adjust`)

        // Update each task's absolute position by the delta
        tasksInSection.forEach(task => {
          const newTaskX = task.canvasPosition!.x + deltaX
          const newTaskY = task.canvasPosition!.y + deltaY

          console.log(`  📍 Adjusting task "${task.title}": (${task.canvasPosition!.x}, ${task.canvasPosition!.y}) → (${newTaskX}, ${newTaskY})`)

          taskStore.updateTask(task.id, {
            canvasPosition: { x: newTaskX, y: newTaskY }
          })
        })

        console.log('✅ [CanvasView] Task absolute positions adjusted')
      } else {
        console.log('⏭️  [CanvasView] Position delta too small, skipping task adjustment')
      }
    } else {
      console.error('❌ [CanvasView] Section not found in store:', sectionId)
    }
  } else {
    console.error('❌ [CanvasView] Missing width or height:', { width, height })
  }

  // Reset resize state
  resizeState.value = {
    isResizing: false,
    sectionId: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    currentWidth: 0,
    currentHeight: 0,
    handlePosition: null,
    isDragging: false,
    resizeStartTime: 0
  }
}

// Handle pane click - clear selection
const handlePaneClick = () => {
  canvasStore.setSelectedNodes([])
  closeCanvasContextMenu()
  closeEdgeContextMenu()
  closeNodeContextMenu()
}

// Handle add task from empty state
const handleAddTask = () => {
  // Open the quick task create modal
  isQuickTaskCreateOpen.value = true
}

// Handle pane context menu (right-click)
const handlePaneContextMenu = (event: MouseEvent) => {
  // Don't show context menu during connection operations
  if (isConnecting.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  console.log('🎯 Right-click detected!', event.clientX, event.clientY)
  event.preventDefault()
  canvasContextMenuX.value = event.clientX
  canvasContextMenuY.value = event.clientY
  showCanvasContextMenu.value = true
  console.log('📋 Context menu should be visible:', showCanvasContextMenu.value)
}

// Handle right-click anywhere on canvas (fallback for areas between sections)
const handleCanvasRightClick = (event: MouseEvent) => {
  // Don't show context menu during connection operations
  if (isConnecting.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  const target = event.target as HTMLElement

  // Don't show menu if clicking on a task or section node
  if (target.closest('.task-node') || target.closest('[data-id^="section-"]')) {
    return
  }

  // Show menu for all other clicks (empty space)
  canvasContextMenuX.value = event.clientX
  canvasContextMenuY.value = event.clientY
  showCanvasContextMenu.value = true
  console.log('🎯 Canvas right-click at:', event.clientX, event.clientY)
}

// Canvas context menu handlers
const closeCanvasContextMenu = () => {
  console.log('🔧 CanvasView: Closing context menu, resetting canvasContextSection')
  showCanvasContextMenu.value = false
  canvasContextSection.value = null // Reset context section so "Create Custom Group" appears
}

const centerOnSelectedTasks = () => {
  const selectedNodes = nodes.value.filter(n => canvasStore.selectedNodeIds.includes(n.id))
  if (selectedNodes.length === 0) return

  // Calculate bounding box of selected nodes
  const xs = selectedNodes.map(n => n.position.x)
  const ys = selectedNodes.map(n => n.position.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs) + 220 // approximate node width
  const maxY = Math.max(...ys) + 100 // approximate node height

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  vueFlowFitView({
    nodes: selectedNodes.map(n => n.id),
    padding: 0.3,
    duration: 300
  })

  closeCanvasContextMenu()
}

const fitAllTasks = () => {
  vueFlowFitView({ padding: 0.2, duration: 300 })
  closeCanvasContextMenu()
}


const selectAllTasks = () => {
  const taskNodeIds = nodes.value
    .filter(n => n.type === 'taskNode')
    .map(n => n.id)
  canvasStore.setSelectedNodes(taskNodeIds)
  closeCanvasContextMenu()
}

const clearSelection = () => {
  canvasStore.setSelectedNodes([])
  closeCanvasContextMenu()
}

/**
 * Create a new task at the clicked canvas position
 * Called from CanvasContextMenu component
 */
const createTaskHere = async () => {
  const functionName = 'createTaskHere'
  console.log(`📍 ${functionName}: Starting...`)

  try {
    // ✅ VALIDATION 1: Check viewport ref
    if (!viewport.value) {
      const msg = 'vueFlowViewport ref not initialized'
      console.warn(`❌ ${functionName}: ${msg}`)
      throw new Error(msg)
    }

    console.log(`✅ ${functionName}: vueFlowViewport ready`)

    // ✅ VALIDATION 2: Check context menu coordinates
    if (typeof canvasContextMenuX.value !== 'number' ||
        typeof canvasContextMenuY.value !== 'number') {
      const msg = `Invalid context menu coordinates: x=${canvasContextMenuX.value}, y=${canvasContextMenuY.value}`
      console.warn(`❌ ${functionName}: ${msg}`)
      throw new Error(msg)
    }

    console.log(`✅ ${functionName}: Context menu coords valid: x=${canvasContextMenuX.value}, y=${canvasContextMenuY.value}`)

    // ✅ VALIDATION 3: Check DOM element exists
    const vueFlowElement = document.querySelector('.vue-flow')
    if (!vueFlowElement) {
      const msg = 'Vue Flow DOM element (.vue-flow) not found'
      console.warn(`❌ ${functionName}: ${msg}`)
      throw new Error(msg)
    }

    console.log(`✅ ${functionName}: Vue Flow element found`)

    // ✅ VALIDATION 4: Check task store
    if (!taskStore) {
      const msg = 'Task store not initialized'
      console.warn(`❌ ${functionName}: ${msg}`)
      throw new Error(msg)
    }

    if (typeof taskStore.createTaskWithUndo !== 'function') {
      const msg = 'createTaskWithUndo method not available on task store'
      console.warn(`❌ ${functionName}: ${msg}`)
      throw new Error(msg)
    }

    console.log(`✅ ${functionName}: Task store ready`)

    // ✅ CALCULATE CANVAS COORDINATES
    const rect = vueFlowElement.getBoundingClientRect()
    const canvasX = (canvasContextMenuX.value - rect.left - viewport.value?.x) / viewport.value?.zoom
    const canvasY = (canvasContextMenuY.value - rect.top - viewport.value?.y) / viewport.value?.zoom

    console.log(`📐 ${functionName}: Calculated canvas position: x=${canvasX}, y=${canvasY}`)

    // ✅ VALIDATION 5: Coordinates are reasonable numbers
    if (!Number.isFinite(canvasX) || !Number.isFinite(canvasY)) {
      const msg = `Invalid calculated coordinates: x=${canvasX}, y=${canvasY}`
      console.warn(`❌ ${functionName}: ${msg}`)
      throw new Error(msg)
    }

    // ✅ STORE POSITION FOR QUICK TASK CREATION (keeping existing workflow)
    quickTaskPosition.value = { x: canvasX, y: canvasY }
    console.log(`💾 ${functionName}: Position stored for quick task creation`)

    // ✅ CLOSE CONTEXT MENU
    closeCanvasContextMenu()
    console.log(`✅ ${functionName}: Context menu closed`)

    // ✅ OPEN QUICK TASK CREATE MODAL (keeping existing workflow)
    isQuickTaskCreateOpen.value = true
    console.log(`✅ ${functionName}: Quick task create modal opened`)

    console.log(`✅ ${functionName}: Task creation setup completed successfully`)

  } catch (error) {
    // ✅ COMPREHENSIVE ERROR LOGGING
    const err = error as Error
    console.error(`❌ ${functionName}: FAILED`, {
      error: err.message || String(error),
      stack: err.stack,
      state: {
        vueFlowViewport: viewport.value ? 'Ready' : 'Undefined',
        contextMenuX: canvasContextMenuX.value,
        contextMenuY: canvasContextMenuY.value,
        vueFlowElement: document.querySelector('.vue-flow') ? 'Found' : 'Not found',
        taskStore: taskStore ? 'Available' : 'Undefined'
      }
    })

    // ✅ USER FEEDBACK
    showCanvasContextMenu.value = false

    // Show error notification if available
    if (window.__notificationApi) {
      window.__notificationApi({
        type: 'error',
        title: 'Failed to Create Task',
        content: 'There was an error creating the task on the canvas. Please try again.'
      })
    }

    // Re-throw for error boundary
    throw error
  }
}

const createGroup = () => {
  console.log('🔧 CanvasView: createGroup function called!')

  // Get the VueFlow element to calculate canvas coordinates
  const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
  if (!vueFlowElement) {
    console.error('🔧 CanvasView: VueFlow element not found!')
    return
  }

  // Calculate canvas coordinates accounting for viewport transformation
  const rect = vueFlowElement.getBoundingClientRect()
  const canvasX = (canvasContextMenuX.value - rect.left - viewport.value?.x) / viewport.value?.zoom
  const canvasY = (canvasContextMenuY.value - rect.top - viewport.value?.y) / viewport.value?.zoom

  // Debug logging
  console.log('🎯 Creating group at:', {
    screenCoords: { x: canvasContextMenuX.value, y: canvasContextMenuY.value },
    viewport: { x: viewport.value?.x, y: viewport.value?.y, zoom: viewport.value?.zoom },
    canvasCoords: { x: canvasX, y: canvasY }
  })

  // Set modal position for group creation using calculated coordinates
  groupModalPosition.value = { x: canvasX, y: canvasY }
  selectedGroup.value = null // Ensure we're in create mode
  console.log('🔧 CanvasView: Set groupModalPosition:', groupModalPosition.value)
  console.log('🔧 CanvasView: Set selectedGroup to null')

  // Close context menu first to prevent any interference
  closeCanvasContextMenu()
  console.log('🔧 CanvasView: Closed context menu')

  // Open group creation modal
  console.log('🔧 CanvasView: Setting isGroupModalOpen to true')
  isGroupModalOpen.value = true
  console.log('🔧 CanvasView: isGroupModalOpen is now:', isGroupModalOpen.value)
}

const closeGroupModal = () => {
  isGroupModalOpen.value = false
  selectedGroup.value = null
  groupModalPosition.value = { x: 100, y: 100 }
}

const handleGroupCreated = (group: any) => {
  console.log('Group created:', group)
  syncNodes() // Refresh VueFlow to show the new group
}

const handleGroupUpdated = (group: any) => {
  console.log('Group updated:', group)
  syncNodes() // Refresh VueFlow to show the updated group
}

// Section Wizard handlers
const createSection = () => {
  console.log('✨ CanvasView: createSection function called!')

  // Get the VueFlow element to calculate canvas coordinates
  const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
  if (!vueFlowElement) {
    console.error('✨ CanvasView: VueFlow element not found!')
    return
  }

  // Calculate canvas coordinates accounting for viewport transformation
  const rect = vueFlowElement.getBoundingClientRect()
  const canvasX = (canvasContextMenuX.value - rect.left - viewport.value?.x) / viewport.value?.zoom
  const canvasY = (canvasContextMenuY.value - rect.top - viewport.value?.y) / viewport.value?.zoom

  console.log('✨ Creating section at:', {
    screenCoords: { x: canvasContextMenuX.value, y: canvasContextMenuY.value },
    viewport: { x: viewport.value?.x, y: viewport.value?.y, zoom: viewport.value?.zoom },
    canvasCoords: { x: canvasX, y: canvasY }
  })

  // Set wizard position using calculated coordinates
  sectionWizardPosition.value = { x: canvasX, y: canvasY }
  console.log('✨ CanvasView: Set sectionWizardPosition:', sectionWizardPosition.value)

  // Close context menu first
  closeCanvasContextMenu()
  console.log('✨ CanvasView: Closed context menu')

  // Open section wizard
  console.log('✨ CanvasView: Setting isSectionWizardOpen to true')
  isSectionWizardOpen.value = true
  console.log('✨ CanvasView: isSectionWizardOpen is now:', isSectionWizardOpen.value)
}

const closeSectionWizard = () => {
  isSectionWizardOpen.value = false
  sectionWizardPosition.value = { x: 100, y: 100 }
}

const handleSectionCreated = (section: any) => {
  console.log('✨ Section created:', section)
  syncNodes() // Refresh VueFlow to show the new section
}

// Group edit handlers
const editGroup = (section: any) => {
  console.log('Editing group:', section)
  selectedSectionForEdit.value = section
  isGroupEditModalOpen.value = true
  closeCanvasContextMenu()
}

const deleteGroup = (section: any) => {
  console.log('Deleting group:', section)
  if (!section) return

  const confirmMessage = `Delete "${section.name}" group? This will remove the group and all its settings.`
  if (confirm(confirmMessage)) {
    canvasStore.deleteSectionWithUndo(section.id)
    syncNodes() // Refresh VueFlow to show changes
  }
  closeCanvasContextMenu()
}

// Task context menu handlers - Move selected tasks to inbox
const moveSelectedTasksToInbox = async () => {
  const selectedNodeIds = canvasStore.selectedNodeIds.filter(id => !id.startsWith('section-'))
  console.log('📥 Moving tasks to inbox:', selectedNodeIds)

  if (selectedNodeIds.length === 0) return

  for (const nodeId of selectedNodeIds) {
    try {
      await undoHistory.updateTaskWithUndo(nodeId, {
        isInInbox: true,
        canvasPosition: undefined
      })
      console.log(`📥 Task ${nodeId} moved to inbox`)
    } catch (error) {
      console.error(`❌ Failed to move task ${nodeId} to inbox:`, error)
    }
  }

  canvasStore.setSelectedNodes([])
  batchedSyncNodes('high')
  closeCanvasContextMenu()
}

// Task context menu handlers - Delete selected tasks permanently
const deleteSelectedTasks = async () => {
  const selectedNodeIds = canvasStore.selectedNodeIds.filter(id => !id.startsWith('section-'))
  console.log('🗑️ Deleting tasks:', selectedNodeIds)

  if (selectedNodeIds.length === 0) return

  const confirmMessage = selectedNodeIds.length > 1
    ? `Delete ${selectedNodeIds.length} tasks permanently? This cannot be undone.`
    : 'Delete this task permanently? This cannot be undone.'

  if (!confirm(confirmMessage)) {
    closeCanvasContextMenu()
    return
  }

  for (const nodeId of selectedNodeIds) {
    try {
      await undoHistory.deleteTaskWithUndo(nodeId)
      console.log(`🗑️ Task ${nodeId} deleted`)
    } catch (error) {
      console.error(`❌ Failed to delete task ${nodeId}:`, error)
    }
  }

  canvasStore.setSelectedNodes([])
  batchedSyncNodes('high')
  closeCanvasContextMenu()
}

const closeGroupEditModal = () => {
  isGroupEditModalOpen.value = false
  selectedSectionForEdit.value = null
}

const handleGroupEditSave = (updatedSection: any) => {
  console.log('Saving group edit:', updatedSection)
  if (!updatedSection) return

  canvasStore.updateSectionWithUndo(updatedSection.id, updatedSection)
  syncNodes() // Refresh VueFlow to show the updated section
  closeGroupEditModal()
}

// Node context menu handlers (for sections)
const handleNodeContextMenu = (event: any) => {
  console.log('Node context menu triggered for:', event.node.id, event.node)

  // Prevent default behavior and event bubbling for all nodes
  event.event.preventDefault()
  event.event.stopPropagation()

  // Only show context menu for section nodes
  if (!event.node.id.startsWith('section-')) {
    return
  }

  nodeContextMenuX.value = event.event.clientX
  nodeContextMenuY.value = event.event.clientY
  selectedNode.value = event.node
  showNodeContextMenu.value = true
  closeCanvasContextMenu()
  closeEdgeContextMenu()
}

const closeNodeContextMenu = () => {
  showNodeContextMenu.value = false
  selectedNode.value = null
}

const deleteNode = () => {
  if (!selectedNode.value) {
    return
  }

  if (selectedNode.value.id.startsWith('section-')) {
    const sectionId = selectedNode.value.id.replace('section-', '')
    console.log('Attempting to delete section:', sectionId)
    
    // Find the section
    const section = canvasStore.sections.find(s => s.id === sectionId)
    if (!section) {
      closeNodeContextMenu()
      return
    }
    
    // Confirm deletion for sections with tasks
    const tasksInSection = canvasStore.getTasksInSection(section, Array.isArray(filteredTasks.value) ? filteredTasks.value : [])
    const confirmMessage = tasksInSection.length > 0 
      ? `Delete "${section.name}" section? It contains ${tasksInSection.length} task(s) that will be moved to the canvas.`
      : `Delete "${section.name}" section?`
    
    if (confirm(confirmMessage)) {
      canvasStore.deleteSectionWithUndo(sectionId)
      syncNodes() // Refresh VueFlow to show changes
    }
  }

  closeNodeContextMenu()
}

// Edge context menu handlers
const closeEdgeContextMenu = () => {
  showEdgeContextMenu.value = false
  selectedEdge.value = null
}

const disconnectEdge = () => {
  if (!selectedEdge.value) return

  const { source, target, id: edgeId } = selectedEdge.value
  const targetTask = taskStore.tasks.find(t => t.id === target)

  console.log('🔗 Disconnecting edge:', {
    edgeId,
    source,
    target,
    targetTask: targetTask?.id,
    currentDependsOn: targetTask?.dependsOn
  })

  // Add edge to recently removed set to prevent recreation during sync
  recentlyRemovedEdges.value.add(edgeId)

  // Clear the blocklist after a short delay to prevent memory leaks - using resourceManager
  const timerId = setTimeout(() => {
    recentlyRemovedEdges.value.delete(edgeId)
  }, 2000) // 2 seconds should be enough for the sync to complete
  resourceManager.addTimer(timerId as unknown as number)

  // Use Vue Flow's removeEdges action for clean visual removal
  removeEdges(edgeId)

  // Update task dependencies
  if (targetTask && targetTask.dependsOn) {
    const updatedDependsOn = targetTask.dependsOn.filter(id => id !== source)
    taskStore.updateTaskWithUndo(targetTask.id, { dependsOn: updatedDependsOn })

    // Call syncEdges but it will now respect the recentlyRemovedEdges blocklist
    syncEdges()

    console.log('✅ Task dependencies updated:', {
      taskId: targetTask.id,
      oldDependsOn: targetTask.dependsOn,
      newDependsOn: updatedDependsOn,
      blockedEdgeId: edgeId
    })
  }

  closeEdgeContextMenu()
}

// Edge event handler bridges
const handleEdgeClick = (event: any) => {
  console.log('🖱️ Edge click triggered (component handler):', {
    edgeId: event.edge?.id,
    source: event.edge?.source,
    target: event.edge?.target
  })

  // Pass through to the composable handler
  if (event.edge) {
    // The composable handler should already be registered via onEdgeClick
    // This event just ensures the component-level binding works
  }
}

const handleEdgeContextMenu = (event: any) => {
  console.log('🖱️ Edge context menu triggered (component handler):', {
    edgeId: event.edge?.id,
    source: event.edge?.source,
    target: event.edge?.target,
    clientX: event.event?.clientX,
    clientY: event.event?.clientY
  })

  // Pass through to the composable handler
  if (event.edge) {
    // The composable handler should already be registered via onEdgeContextMenu
    // This event just ensures the component-level binding works
  }
}

// Enhanced alignment operation helper with comprehensive error handling
const executeAlignmentOperation = (
  operationName: string,
  operation: (selectedNodes: any[]) => void,
  minNodes: number = 2
) => {
  console.log(`🔧 ${operationName}: Starting alignment operation`)

  // Pre-alignment state validation
  const validation = validateAlignmentState(minNodes)
  if (!validation.canProceed) {
    console.warn(`⚠️ ${operationName}: Validation failed:`, validation.reason)
    message.warning(validation.reason || 'Validation failed')
    return false
  }

  console.log(`🔧 ${operationName}: Total nodes in canvas:`, nodes.value.length)
  console.log(`🔧 ${operationName}: Selected node IDs from canvas store:`, canvasStore.selectedNodeIds)

  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )

  console.log(`🔧 ${operationName}: Nodes matching selection criteria:`, selectedNodes.length)
  console.log(`🔧 ${operationName}: Selected node details:`, selectedNodes.map(n => ({ id: n.id, type: n.type, position: n.position })))

  if (selectedNodes.length < minNodes) {
    const errorMsg = `Need at least ${minNodes} selected tasks for ${operationName.toLowerCase()}, have ${selectedNodes.length}`
    console.warn(`⚠️ ${operationName}: Insufficient nodes:`, errorMsg)
    message.error(errorMsg)
    return false
  }

  try {
    // Show temporary loading state
    message.loading(`Performing ${operationName.toLowerCase()}...`, { duration: 300 })

    // Execute the alignment operation
    operation(selectedNodes)

    // Show success feedback
    message.success(`Successfully aligned ${selectedNodes.length} tasks ${operationName.toLowerCase().replace('align ', '')}`)
    console.log(`✅ ${operationName}: Operation completed successfully`)
    return true
  } catch (error) {
    console.error(`❌ ${operationName}: Operation failed:`, error)
    message.error(`Alignment operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return false
  }
}

// Alignment handlers
const alignLeft = () => {
  executeAlignmentOperation('Align Left', (selectedNodes) => {
    const minX = Math.min(...selectedNodes.map(n => n.position.x))
    console.log(`🔧 Align Left: Calculated min X position:`, minX)

    console.log(`🔧 Align Left: Updating ${selectedNodes.length} task positions`)
    selectedNodes.forEach((node, index) => {
      console.log(`🔧 Align Left: Task ${index + 1}/${selectedNodes.length}:`, {
        id: node.id,
        from: { x: node.position.x, y: node.position.y },
        to: { x: minX, y: node.position.y }
      })

      taskStore.updateTaskWithUndo(node.id, {
        canvasPosition: { x: minX, y: node.position.y }
      })
    })

    closeCanvasContextMenu()
  })
}

const alignRight = () => {
  console.log('🔧 ALIGN RIGHT: Starting alignment operation')
  console.log('🔧 ALIGN RIGHT: Total nodes in canvas:', nodes.value.length)
  console.log('🔧 ALIGN RIGHT: Selected node IDs from canvas store:', canvasStore.selectedNodeIds)

  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )

  console.log('🔧 ALIGN RIGHT: Nodes matching selection criteria:', selectedNodes.length)
  console.log('🔧 ALIGN RIGHT: Selected node details:', selectedNodes.map(n => ({ id: n.id, type: n.type, position: n.position })))

  if (selectedNodes.length < 2) {
    console.warn('⚠️ ALIGN RIGHT: Insufficient nodes for alignment. Need at least 2, got', selectedNodes.length)
    console.warn('⚠️ ALIGN RIGHT: Possible issues:')
    console.warn('  - Not enough tasks selected')
    console.warn('  - Selected nodes are not taskNode type')
    console.warn('  - Vue Flow selection state not synchronized with canvas store')

    // User feedback for insufficient selection
    message.warning('Please select at least 2 tasks to use alignment tools')
    return
  }

  const maxX = Math.max(...selectedNodes.map(n => n.position.x))
  console.log('🔧 ALIGN RIGHT: Calculated max X position:', maxX)

  console.log('🔧 ALIGN RIGHT: Updating', selectedNodes.length, 'task positions')
  selectedNodes.forEach((node, index) => {
    console.log(`🔧 ALIGN RIGHT: Task ${index + 1}/${selectedNodes.length}:`, {
      id: node.id,
      from: { x: node.position.x, y: node.position.y },
      to: { x: maxX, y: node.position.y }
    })

    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: maxX, y: node.position.y }
    })
  })

  console.log('✅ ALIGN RIGHT: Alignment completed successfully')

  // User feedback for successful alignment
  message.success(`Aligned ${selectedNodes.length} tasks to the right`)
  closeCanvasContextMenu()
}

const alignTop = () => {
  console.log('🔧 ALIGN TOP: Starting alignment operation')
  console.log('🔧 ALIGN TOP: Total nodes in canvas:', nodes.value.length)
  console.log('🔧 ALIGN TOP: Selected node IDs from canvas store:', canvasStore.selectedNodeIds)

  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )

  console.log('🔧 ALIGN TOP: Nodes matching selection criteria:', selectedNodes.length)
  console.log('🔧 ALIGN TOP: Selected node details:', selectedNodes.map(n => ({ id: n.id, type: n.type, position: n.position })))

  if (selectedNodes.length < 2) {
    console.warn('⚠️ ALIGN TOP: Insufficient nodes for alignment. Need at least 2, got', selectedNodes.length)
    console.warn('⚠️ ALIGN TOP: Possible issues:')
    console.warn('  - Not enough tasks selected')
    console.warn('  - Selected nodes are not taskNode type')
    console.warn('  - Vue Flow selection state not synchronized with canvas store')

    // User feedback for insufficient selection
    message.warning('Please select at least 2 tasks to use alignment tools')
    return
  }

  const minY = Math.min(...selectedNodes.map(n => n.position.y))
  console.log('🔧 ALIGN TOP: Calculated min Y position:', minY)

  console.log('🔧 ALIGN TOP: Updating', selectedNodes.length, 'task positions')
  selectedNodes.forEach((node, index) => {
    console.log(`🔧 ALIGN TOP: Task ${index + 1}/${selectedNodes.length}:`, {
      id: node.id,
      from: { x: node.position.x, y: node.position.y },
      to: { x: node.position.x, y: minY }
    })

    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: node.position.x, y: minY }
    })
  })

  console.log('✅ ALIGN TOP: Alignment completed successfully')

  // User feedback for successful alignment
  message.success(`Aligned ${selectedNodes.length} tasks to the top`)
  closeCanvasContextMenu()
}

const alignBottom = () => {
  console.log('🔧 ALIGN BOTTOM: Starting alignment operation')
  console.log('🔧 ALIGN BOTTOM: Total nodes in canvas:', nodes.value.length)
  console.log('🔧 ALIGN BOTTOM: Selected node IDs from canvas store:', canvasStore.selectedNodeIds)

  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )

  console.log('🔧 ALIGN BOTTOM: Nodes matching selection criteria:', selectedNodes.length)
  console.log('🔧 ALIGN BOTTOM: Selected node details:', selectedNodes.map(n => ({ id: n.id, type: n.type, position: n.position })))

  if (selectedNodes.length < 2) {
    console.warn('⚠️ ALIGN BOTTOM: Insufficient nodes for alignment. Need at least 2, got', selectedNodes.length)
    console.warn('⚠️ ALIGN BOTTOM: Possible issues:')
    console.warn('  - Not enough tasks selected')
    console.warn('  - Selected nodes are not taskNode type')
    console.warn('  - Vue Flow selection state not synchronized with canvas store')

    // User feedback for insufficient selection
    message.warning('Please select at least 2 tasks to use alignment tools')
    return
  }

  const maxY = Math.max(...selectedNodes.map(n => n.position.y))
  console.log('🔧 ALIGN BOTTOM: Calculated max Y position:', maxY)

  console.log('🔧 ALIGN BOTTOM: Updating', selectedNodes.length, 'task positions')
  selectedNodes.forEach((node, index) => {
    console.log(`🔧 ALIGN BOTTOM: Task ${index + 1}/${selectedNodes.length}:`, {
      id: node.id,
      from: { x: node.position.x, y: node.position.y },
      to: { x: node.position.x, y: maxY }
    })

    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: node.position.x, y: maxY }
    })
  })

  console.log('✅ ALIGN BOTTOM: Alignment completed successfully')

  // User feedback for successful alignment
  message.success(`Aligned ${selectedNodes.length} tasks to the bottom`)
  closeCanvasContextMenu()
}

const alignCenterHorizontal = () => {
  console.log('🔧 ALIGN CENTER HORIZONTAL: Starting alignment operation')
  console.log('🔧 ALIGN CENTER HORIZONTAL: Total nodes in canvas:', nodes.value.length)
  console.log('🔧 ALIGN CENTER HORIZONTAL: Selected node IDs from canvas store:', canvasStore.selectedNodeIds)

  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )

  console.log('🔧 ALIGN CENTER HORIZONTAL: Nodes matching selection criteria:', selectedNodes.length)
  console.log('🔧 ALIGN CENTER HORIZONTAL: Selected node details:', selectedNodes.map(n => ({ id: n.id, type: n.type, position: n.position })))

  if (selectedNodes.length < 2) {
    console.warn('⚠️ ALIGN CENTER HORIZONTAL: Insufficient nodes for alignment. Need at least 2, got', selectedNodes.length)
    console.warn('⚠️ ALIGN CENTER HORIZONTAL: Possible issues:')
    console.warn('  - Not enough tasks selected')
    console.warn('  - Selected nodes are not taskNode type')
    console.warn('  - Vue Flow selection state not synchronized with canvas store')

    // User feedback for insufficient selection
    message.warning('Please select at least 2 tasks to use alignment tools')
    return
  }

  const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length
  console.log('🔧 ALIGN CENTER HORIZONTAL: Calculated average X position:', avgX)

  console.log('🔧 ALIGN CENTER HORIZONTAL: Updating', selectedNodes.length, 'task positions')
  selectedNodes.forEach((node, index) => {
    console.log(`🔧 ALIGN CENTER HORIZONTAL: Task ${index + 1}/${selectedNodes.length}:`, {
      id: node.id,
      from: { x: node.position.x, y: node.position.y },
      to: { x: avgX, y: node.position.y }
    })

    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: avgX, y: node.position.y }
    })
  })

  console.log('✅ ALIGN CENTER HORIZONTAL: Alignment completed successfully')

  // User feedback for successful alignment
  message.success(`Centered ${selectedNodes.length} tasks horizontally`)
  closeCanvasContextMenu()
}

const alignCenterVertical = () => {
  console.log('🔧 ALIGN CENTER VERTICAL: Starting alignment operation')
  console.log('🔧 ALIGN CENTER VERTICAL: Total nodes in canvas:', nodes.value.length)
  console.log('🔧 ALIGN CENTER VERTICAL: Selected node IDs from canvas store:', canvasStore.selectedNodeIds)

  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )

  console.log('🔧 ALIGN CENTER VERTICAL: Nodes matching selection criteria:', selectedNodes.length)
  console.log('🔧 ALIGN CENTER VERTICAL: Selected node details:', selectedNodes.map(n => ({ id: n.id, type: n.type, position: n.position })))

  if (selectedNodes.length < 2) {
    console.warn('⚠️ ALIGN CENTER VERTICAL: Insufficient nodes for alignment. Need at least 2, got', selectedNodes.length)
    console.warn('⚠️ ALIGN CENTER VERTICAL: Possible issues:')
    console.warn('  - Not enough tasks selected')
    console.warn('  - Selected nodes are not taskNode type')
    console.warn('  - Vue Flow selection state not synchronized with canvas store')

    // User feedback for insufficient selection
    message.warning('Please select at least 2 tasks to use alignment tools')
    return
  }

  const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length
  console.log('🔧 ALIGN CENTER VERTICAL: Calculated average Y position:', avgY)

  console.log('🔧 ALIGN CENTER VERTICAL: Updating', selectedNodes.length, 'task positions')
  selectedNodes.forEach((node, index) => {
    console.log(`🔧 ALIGN CENTER VERTICAL: Task ${index + 1}/${selectedNodes.length}:`, {
      id: node.id,
      from: { x: node.position.x, y: node.position.y },
      to: { x: node.position.x, y: avgY }
    })

    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: node.position.x, y: avgY }
    })
  })

  console.log('✅ ALIGN CENTER VERTICAL: Alignment completed successfully')

  // User feedback for successful alignment
  message.success(`Centered ${selectedNodes.length} tasks vertically`)
  closeCanvasContextMenu()
}

const distributeHorizontal = () => {
  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )
  if (selectedNodes.length < 3) return

  // Sort by x position
  const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x)
  const minX = sorted[0].position.x
  const maxX = sorted[sorted.length - 1].position.x
  const spacing = (maxX - minX) / (sorted.length - 1)

  sorted.forEach((node, index) => {
    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: minX + (spacing * index), y: node.position.y }
    })
  })

  closeCanvasContextMenu()
}

const distributeVertical = () => {
  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )
  if (selectedNodes.length < 3) return

  // Sort by y position
  const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y)
  const minY = sorted[0].position.y
  const maxY = sorted[sorted.length - 1].position.y
  const spacing = (maxY - minY) / (sorted.length - 1)

  sorted.forEach((node, index) => {
    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: node.position.x, y: minY + (spacing * index) }
    })
  })

  closeCanvasContextMenu()
}

// Arrange functions
const arrangeInRow = () => {
  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )
  if (selectedNodes.length < 2) return

  // Sort by current x position
  const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x)

  // Calculate average Y position
  const avgY = sorted.reduce((sum, n) => sum + n.position.y, 0) / sorted.length

  // Find the leftmost X position
  const startX = sorted[0].position.x

  // Standard task node width is 200px, add 40px gap = 240px spacing
  const SPACING = 240

  sorted.forEach((node, index) => {
    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: startX + (SPACING * index), y: avgY }
    })
  })

  closeCanvasContextMenu()
}

const arrangeInColumn = () => {
  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )
  if (selectedNodes.length < 2) return

  // Sort by current y position
  const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y)

  // Calculate average X position
  const avgX = sorted.reduce((sum, n) => sum + n.position.x, 0) / sorted.length

  // Find the topmost Y position
  const startY = sorted[0].position.y

  // Standard task node height is 80px, add 40px gap = 120px spacing
  const SPACING = 120

  sorted.forEach((node, index) => {
    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: avgX, y: startY + (SPACING * index) }
    })
  })

  closeCanvasContextMenu()
}

const arrangeInGrid = () => {
  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )
  if (selectedNodes.length < 2) return

  // Calculate grid dimensions - prefer wider grids
  const count = selectedNodes.length
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)

  // Calculate average position as grid center
  const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length
  const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length

  // Spacing constants
  const SPACING_X = 240 // Task width (200) + gap (40)
  const SPACING_Y = 120 // Task height (80) + gap (40)

  // Calculate grid starting position (centered around average position)
  const gridWidth = (cols - 1) * SPACING_X
  const gridHeight = (rows - 1) * SPACING_Y
  const startX = avgX - (gridWidth / 2)
  const startY = avgY - (gridHeight / 2)

  // Arrange nodes in grid
  selectedNodes.forEach((node, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols

    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: {
        x: startX + (col * SPACING_X),
        y: startY + (row * SPACING_Y)
      }
    })
  })

  closeCanvasContextMenu()
}

// ===== FILTER HELPER FUNCTIONS =====

// Get human-readable label for status filter
const getStatusFilterLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'planned': 'Planned',
    'in_progress': 'In Progress',
    'done': 'Done',
    'backlog': 'Backlog',
    'on_hold': 'On Hold'
  }
  return labels[status] || status
}

// Clear the active status filter
const clearStatusFilter = () => {
  taskStore.setActiveStatusFilter('')
}

// Keyboard handler for Delete key and zoom shortcuts
const handleKeyDown = async (event: KeyboardEvent) => {
  const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'


  // Handle fit view shortcut (F without Ctrl)
  if (event.key === 'f' || event.key === 'F') {
    event.preventDefault()
    fitView()
    return
  }

  // Handle Delete/Backspace
  if (!isDeleteKey) return

  // Use VueFlow's getSelectedNodes method to ensure we only intercept when something is selected
  const selectedNodes = getSelectedNodes.value
  if (!selectedNodes || selectedNodes.length === 0) {
    return
  }

  const target = event.target as HTMLElement | null
  if (target) {
    const tagName = target.tagName
    const isEditableTarget = tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable
    if (isEditableTarget && !event.shiftKey) {
      return
    }
  }

  if (import.meta.env.DEV) {
    ;(window as any).__canvasDeleteDebug = {
      selectedIds: selectedNodes.map(node => node.id),
      targetTag: target ? target.tagName : null,
      shiftKey: event.shiftKey
    }
  }

  event.preventDefault()

  // Check if Shift key is pressed - full deletion
  const permanentDelete = event.shiftKey // Only Shift+Delete should permanently delete

  console.log('🗑️ Processing deletion for', selectedNodes.length, 'nodes:', selectedNodes.map(n => n.id))

  // Process deletions sequentially to ensure proper undo/redo registration
  for (const node of selectedNodes) {
    console.log(`🎯 Processing node: ${node.id}`)
    console.log(`📊 Current undo count before operation: ${undoHistory.undoCount.value}`)

    if (node.id.startsWith('section-')) {
      // Sections are always permanently deleted
      const sectionId = node.id.replace('section-', '')

      // Find section for confirmation
      const section = canvasStore.sections.find(s => s.id === sectionId)
      const taskArray = Array.isArray(filteredTasks.value) ? filteredTasks.value : []
      const confirmMessage = section && canvasStore.getTasksInSection(section, taskArray).length > 0
        ? `Delete "${section.name}" section? It contains ${canvasStore.getTasksInSection(section, taskArray).length} task(s) that will be moved to the canvas.`
        : `Delete section?`

      if (confirm(confirmMessage)) {
        await canvasStore.deleteSectionWithUndo(sectionId)
        console.log(`✅ Section deletion completed. Undo count: ${undoHistory.undoCount.value}`)
      }
    } else if (permanentDelete) {
      // Shift+Delete: Remove task from system entirely
      console.log('🗑️ CanvasView: Shift+Delete detected for task:', node.id)
      console.log('🗑️ Before deleteTask - undo count:', undoHistory.undoCount.value)
      console.log('🗑️ Before deleteTask - can undo:', undoHistory.canUndo.value)

      try {
        undoHistory.deleteTaskWithUndo(node.id)
        console.log('✅ deleteTask completed successfully')
        console.log('✅ After deleteTask - undo count:', undoHistory.undoCount.value)
        console.log('✅ After deleteTask - can undo:', undoHistory.canUndo.value)
        console.log('✅ After deleteTask - last action:', (undoHistory as any).lastAction?.value)
      } catch (error) {
        console.error('❌ deleteTask failed:', error)
      }
    } else {
      // Delete: Remove from canvas only, move back to inbox, clear calendar scheduling
      console.log('📤 CanvasView: Delete detected for task:', node.id, '- moving to inbox with undo support')
      console.log('📤 Before updateTaskWithUndo - undo count:', undoHistory.undoCount.value)
      console.log('📤 Before updateTaskWithUndo - can undo:', undoHistory.canUndo.value)

      try {
        undoHistory.updateTaskWithUndo(node.id, {
          canvasPosition: undefined,
          isInInbox: true,
          instances: [], // Clear all calendar instances
          scheduledDate: undefined, // Clear legacy scheduled fields
          scheduledTime: undefined
        })

        console.log('✅ updateTaskWithUndo completed successfully')
        console.log('✅ After updateTaskWithUndo - undo count:', undoHistory.undoCount.value)
        console.log('✅ After updateTaskWithUndo - can undo:', undoHistory.canUndo.value)
        console.log('✅ After updateTaskWithUndo - last action:', (undoHistory as any).lastAction?.value)
      } catch (error) {
        console.error('❌ updateTaskWithUndo failed:', error)
      }
    }
  }

  console.log(`🎯 All ${selectedNodes.length} operations completed. Final undo count: ${undoHistory.undoCount}`)

  canvasStore.setSelectedNodes([])

  // 🔧 FIXED: Wait for Vue reactivity to propagate task store changes before syncing
  // Without this, syncNodes() runs before the task updates are reflected in the computed properties
  await nextTick()
  syncNodes() // Refresh VueFlow to show changes
}

// Handle connection start - set connection state to prevent context menus
const handleConnectStart = (event: any) => {
  console.log('🔗 Connection started:', event)
  isConnecting.value = true

  // Clear any existing context menus
  closeCanvasContextMenu()
  closeEdgeContextMenu()
  closeNodeContextMenu()
}

// Handle connection end - clear connection state
const handleConnectEnd = (event: any) => {
  console.log('🔗 Connection ended:', event)
  // Add a small delay to ensure all connection logic completes - using resourceManager
  const timerId = setTimeout(() => {
    isConnecting.value = false
  }, 100)
  resourceManager.addTimer(timerId as unknown as number)
}

// Handle connection creation - creates task dependency
const handleConnect = withVueFlowErrorBoundary('handleConnect', (connection: any) => {
  console.log('🔗 Connection attempt:', connection)
  const { source, target } = connection

  // Clear any existing context menus first
  closeCanvasContextMenu()
  closeEdgeContextMenu()
  closeNodeContextMenu()

  // Don't allow connections to/from sections
  if (source.startsWith('section-') || target.startsWith('section-')) {
    console.log('❌ Connection rejected: section involvement')
    return
  }

  // Don't allow self-connections
  if (source === target) {
    console.log('❌ Connection rejected: self-connection')
    return
  }

  // Only create connections if both source and target tasks exist and are on canvas
  const sourceTask = taskStore.tasks.find(t => t.id === source)
  const targetTask = taskStore.tasks.find(t => t.id === target)

  if (sourceTask && targetTask &&
      sourceTask.canvasPosition && targetTask.canvasPosition) {
    // Add dependency: target depends on source
    const dependsOn = targetTask.dependsOn || []
    if (!dependsOn.includes(source)) {
      console.log('✅ Creating dependency:', source, '→', target)
      taskStore.updateTaskWithUndo(target, {
        dependsOn: [...dependsOn, source]
      })
      syncEdges() // Re-sync edges to show new connection
    } else {
      console.log('⚠️ Dependency already exists:', source, '→', target)
    }
  } else {
    console.log('❌ Connection rejected: missing tasks or canvas positions')
  }
})

// Handle drop from inbox or board - supports batch operations
const handleDrop = async (event: DragEvent) => {
  console.log('🎯 [CANVAS] handleDrop called - starting drag-drop operation')

  try {
    event.preventDefault()

    const data = event.dataTransfer?.getData('application/json')
    if (!data) {
      console.warn('⚠️ [CANVAS] No data in drag event')
      return
    }

    let parsedData
    try {
      parsedData = JSON.parse(data)
    } catch (error) {
      console.error('❌ [CANVAS] Failed to parse drag data:', error)
      return
    }

    const { taskId, taskIds, fromInbox, source } = parsedData

    if (!fromInbox && source !== 'board' && source !== 'sidebar') {
      console.log('ℹ️ [CANVAS] Ignoring drag from unsupported source:', source)
      return
    }

    // Use VueFlow's built-in coordinate transformation to account for zoom and pan
    let project
    try {
      const vueFlowHook = useVueFlow()
      project = vueFlowHook.project
    } catch (error) {
      console.error('❌ [CANVAS] Failed to get VueFlow project function:', error)
      return
    }

    let canvasPosition
    try {
      canvasPosition = project({
        x: event.clientX,
        y: event.clientY
      })
    } catch (error) {
      console.error('❌ [CANVAS] Failed to transform coordinates:', error)
      return
    }

    console.log('📊 [CANVAS] Dropping at position:', canvasPosition)

    // Handle batch drop (multiple tasks)
    if (taskIds && Array.isArray(taskIds)) {
      console.log('📋 [CANVAS] Processing batch drop of', taskIds.length, 'tasks')

      for (let index = 0; index < taskIds.length; index++) {
        const id = taskIds[index]
        try {
          // Offset each task slightly to create a staggered layout
          const offsetX = (index % 3) * 250 // 3 columns
          const offsetY = Math.floor(index / 3) * 150 // Row height

          await taskStore.updateTaskWithUndo(id, {
            canvasPosition: { x: canvasPosition.x + offsetX, y: canvasPosition.y + offsetY },
            isInInbox: false
          })

          console.log('✅ [CANVAS] Successfully positioned task:', id)
        } catch (error) {
          console.error('❌ [CANVAS] Failed to position task:', id, error)
          // Continue with other tasks even if one fails
        }
      }
    }
    // Handle single task drop (legacy/single select)
    else if (taskId) {
      console.log('📝 [CANVAS] Processing single task drop:', taskId)
      try {
        await taskStore.updateTaskWithUndo(taskId, {
          canvasPosition: { x: canvasPosition.x, y: canvasPosition.y },
          isInInbox: false
        })
        console.log('✅ [CANVAS] Successfully positioned single task:', taskId)
      } catch (error) {
        console.error('❌ [CANVAS] Failed to position single task:', taskId, error)
      }
    }

    console.log('✅ [CANVAS] handleDrop completed successfully')

    // 🔧 FIXED: Force immediate sync after drop to show task on canvas
    // Without this, the task doesn't appear until a refresh
    await nextTick()
    syncNodes()
    console.log('🔄 [CANVAS] Forced syncNodes after drop')

  } catch (error) {
    console.error('💥 [CANVAS] Critical error in handleDrop:', error)

    // Try to recover by notifying the user
    try {
      // You could show a user notification here
      console.log('🔧 [CANVAS] Attempting error recovery...')
    } catch (recoveryError) {
      console.error('💀 [CANVAS] Even error recovery failed:', recoveryError)
    }
  }
}

// Performance optimization: Zoom throttling and batching
const zoomPerformanceManager = {
  animationFrameId: null as number | null,
  pendingOperations: [] as Array<() => void>,
  lastZoomTime: 0,
  zoomThrottleMs: 16, // ~60fps

  shouldThrottleZoom(): boolean {
    const now = performance.now()
    if (now - this.lastZoomTime < this.zoomThrottleMs) {
      return true
    }
    this.lastZoomTime = now
    return false
  },

  scheduleOperation(operation: () => void) {
    this.pendingOperations.push(operation)

    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(() => {
        this.flushOperations()
      })
    }
  },

  flushOperations() {
    // Process all pending operations in batch
    this.pendingOperations.forEach(operation => operation())
    this.pendingOperations.length = 0
    this.animationFrameId = null
  },

  cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    this.pendingOperations.length = 0
  }
}

// Performance optimized viewport culling for extreme zoom levels
const shouldCullNode = (node: Node, currentZoom: number): boolean => {
  // Cull nodes when zoom is extremely low to improve performance
  if (currentZoom < 0.1) { // Below 10% zoom
    // Only show visible nodes in viewport or important nodes
    const viewportBounds = {
      x: -viewport.value?.x / currentZoom,
      y: -viewport.value?.y / currentZoom,
      width: window.innerWidth / currentZoom,
      height: window.innerHeight / currentZoom
    }

    const nodeBounds = {
      x: node.position.x,
      y: node.position.y,
      width: 220,
      height: 100
    }

    // Check if node is in viewport
    const inViewport = !(
      nodeBounds.x > viewportBounds.x + viewportBounds.width ||
      nodeBounds.x + nodeBounds.width < viewportBounds.x ||
      nodeBounds.y > viewportBounds.y + viewportBounds.height ||
      nodeBounds.y + nodeBounds.height < viewportBounds.y
    )

    return !inViewport
  }
  return false
}

// Canvas controls
const fitView = () => {
  vueFlowFitView({ padding: 0.2, duration: 300 })
}

const zoomIn = () => {
  if (zoomPerformanceManager.shouldThrottleZoom()) return

  zoomPerformanceManager.scheduleOperation(() => {
    vueFlowZoomIn({ duration: 200 })
  })
}

const zoomOut = () => {
  if (zoomPerformanceManager.shouldThrottleZoom()) return

  zoomPerformanceManager.scheduleOperation(() => {
    const currentZoom = viewport.value?.zoom
    let newZoom = Math.max(canvasStore.zoomConfig.minZoom, currentZoom - 0.1)

    console.log(`[Zoom Debug] Zoom out: ${currentZoom} -> ${newZoom}`)
    console.log(`[Zoom Debug] Min zoom allowed: ${canvasStore.zoomConfig.minZoom}`)

    // Force Vue Flow to respect our zoom limits by explicitly setting min zoom first
    const { setMinZoom } = useVueFlow()
    if (setMinZoom) {
      setMinZoom(canvasStore.zoomConfig.minZoom)
      console.log(`[Zoom Debug] Forcefully set minZoom to ${canvasStore.zoomConfig.minZoom}`)
    }

    // Use vueFlowZoomTo instead of vueFlowZoomOut to ensure we respect minZoom
    vueFlowZoomTo(newZoom, { duration: 200 })

    // Double-check that zoom was actually applied and enforce if needed - using resourceManager
    const timerId = setTimeout(() => {
      const actualZoom = viewport.value?.zoom
      if (actualZoom > newZoom && Math.abs(actualZoom - newZoom) > 0.01) {
        console.log(`[Zoom Debug] Vue Flow ignored zoom request, forcing again: ${actualZoom} -> ${newZoom}`)
        vueFlowZoomTo(newZoom, { duration: 0 })
      }
    }, 250)
    resourceManager.addTimer(timerId as unknown as number)
  })
}

// Zoom control functions


// Get node color for minimap
const getNodeColor = (node: Node) => {
  const task = node.data?.task as Task
  if (!task) return 'var(--text-muted)' // Gray fallback
  
  switch (task.priority) {
    case 'high': return 'var(--danger-border-active)'
    case 'medium': return 'var(--success-border-active)'
    case 'low': return 'var(--blue-border-active)'
    default: return 'var(--text-muted)'
  }
}

// Task edit
const handleEditTask = (task: Task) => {
  // Detect multi-selection - open batch edit modal instead
  if (canvasStore.selectedNodeIds.length > 1 && canvasStore.selectedNodeIds.includes(task.id)) {
    batchEditTaskIds.value = [...canvasStore.selectedNodeIds]
    isBatchEditModalOpen.value = true
  } else {
    // Single task edit (existing behavior)
    selectedTask.value = task
    isEditModalOpen.value = true
  }
}

const closeEditModal = () => {
  isEditModalOpen.value = false
  selectedTask.value = null
}

// Quick Task Create Modal handlers
const closeQuickTaskCreate = () => {
  isQuickTaskCreateOpen.value = false
  quickTaskPosition.value = { x: 0, y: 0 }
}

/**
 * Handle quick task creation from canvas context menu
 * Creates task at stored canvas position with comprehensive error handling
 */
const handleQuickTaskCreate = async (title: string, description: string) => {
  const functionName = 'handleQuickTaskCreate'
  console.log(`📍 ${functionName}: Creating task with title: "${title}" at position:`, quickTaskPosition.value)

  try {
    // ✅ VALIDATION 1: Check task title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      const msg = 'Task title is required and cannot be empty'
      console.warn(`❌ ${functionName}: ${msg}`)
      throw new Error(msg)
    }

    console.log(`✅ ${functionName}: Task title validation passed`)

    // ✅ VALIDATION 2: Check position data
    if (!quickTaskPosition.value ||
        typeof quickTaskPosition.value.x !== 'number' ||
        typeof quickTaskPosition.value.y !== 'number') {
      const msg = `Invalid quick task position: ${JSON.stringify(quickTaskPosition.value)}`
      console.warn(`❌ ${functionName}: ${msg}`)
      throw new Error(msg)
    }

    console.log(`✅ ${functionName}: Position validation passed: x=${quickTaskPosition.value.x}, y=${quickTaskPosition.value.y}`)

    // ✅ VALIDATION 3: Check task store and method
    if (!taskStore) {
      const msg = 'Task store not initialized'
      console.warn(`❌ ${functionName}: ${msg}`)
      throw new Error(msg)
    }

    if (typeof taskStore.createTaskWithUndo !== 'function') {
      const msg = 'createTaskWithUndo method not available on task store'
      console.warn(`❌ ${functionName}: ${msg}`)
      throw new Error(msg)
    }

    console.log(`✅ ${functionName}: Task store validation passed`)

    // ✅ CREATE TASK DATA
    const newTaskData = {
      title: title.trim(),
      description: description || '',
      canvasPosition: {
        x: quickTaskPosition.value.x,
        y: quickTaskPosition.value.y
      },
      isInInbox: false,
      priority: 'medium',
      status: 'planned'
    }

    console.log(`📝 ${functionName}: Creating task with data:`, newTaskData)

    // ✅ VALIDATION 4: Task data integrity
    if (!newTaskData.title || !newTaskData.canvasPosition) {
      const msg = 'Task data validation failed'
      console.warn(`❌ ${functionName}: ${msg}`)
      throw new Error(msg)
    }

    console.log(`✅ ${functionName}: Task data validation passed`)

    // ✅ CREATE TASK IN STORE (with error handling)
    console.log(`⏳ ${functionName}: Calling taskStore.createTaskWithUndo()...`)

    try {
      const newTask = await taskStore.createTaskWithUndo(newTaskData as Partial<Task>)

      if (!newTask || !newTask.id) {
        throw new Error('Task creation returned invalid task object')
      }

      console.log(`✅ ${functionName}: Task created successfully:`, newTask.id)

      // ✅ CLOSE QUICK CREATE MODAL
      closeQuickTaskCreate()
      console.log(`✅ ${functionName}: Quick create modal closed`)

      // ✅ OPEN EDIT MODAL (optional)
      try {
        selectedTask.value = newTask
        // Use nextTick to ensure DOM has updated before opening modal
        nextTick(() => {
          isEditModalOpen.value = true
          console.log(`✅ ${functionName}: Edit modal opened for task:`, newTask.id)
        })
      } catch (modalError) {
        console.warn(`⚠️ ${functionName}: Could not open edit modal:`, modalError)
        // Don't throw - edit modal is optional
      }

      // ✅ SUCCESS NOTIFICATION
      if (window.__notificationApi) {
        window.__notificationApi({
          type: 'success',
          title: 'Task Created',
          content: `Task "${title}" has been created successfully.`
        })
      }

      console.log(`✅ ${functionName}: Task creation workflow completed successfully`)
      return newTask

    } catch (storeError) {
      const err = storeError as Error
      const msg = `Task creation failed in store: ${err.message || String(storeError)}`
      console.error(`❌ ${functionName}: ${msg}`)
      throw new Error(msg)
    }

  } catch (error) {
    // ✅ COMPREHENSIVE ERROR LOGGING
    const err = error as Error
    console.error(`❌ ${functionName}: FAILED`, {
      error: err.message || String(error),
      stack: err.stack,
      input: {
        title,
        description,
        position: quickTaskPosition.value
      },
      state: {
        taskStore: taskStore ? 'Available' : 'Undefined',
        selectedTask: selectedTask.value ? 'Set' : 'Not set',
        isEditModalOpen: isEditModalOpen.value ? 'Open' : 'Closed'
      }
    })

    // ✅ USER FEEDBACK
    closeQuickTaskCreate()

    // Show error notification if available
    if (window.__notificationApi) {
      window.__notificationApi({
        type: 'error',
        title: 'Failed to Create Task',
        content: `There was an error creating task "${title}": ${err.message || String(error)}. Please try again.`
      })
    }

    // Re-throw for error boundary
    throw error
  }
}

const closeBatchEditModal = () => {
  isBatchEditModalOpen.value = false
  batchEditTaskIds.value = []
}

const handleBatchEditApplied = () => {
  // Clear selection after batch edit
  canvasStore.clearSelection()
  syncNodes()
}

// Section management methods

  
const getTasksForSection = (section: any) => {
  const tasks = canvasStore.getTasksInSection(section, Array.isArray(filteredTasks.value) ? filteredTasks.value : [])
  // If section is collapsed, return empty array to hide tasks
  return section.isCollapsed ? [] : tasks
}

const handleSectionTaskDrop = (event: DragEvent, slot: any, section: any) => {
  const data = event.dataTransfer?.getData('application/json')
  if (!data) return

  const { taskId, fromInbox } = JSON.parse(data)

  console.log(`[handleSectionTaskDrop] Task "${taskId}" dropped on section "${section.name}" (type: ${section.type})`)

  // CRITICAL: Apply section properties for smart groups
  // This ensures "Today", "Tomorrow", etc. sections work correctly
  applySectionPropertiesToTask(taskId, section)

  // Calculate position within section
  const sectionRect = (event.target as HTMLElement).getBoundingClientRect()
  const x = sectionRect.left + (slot.position?.x || 20)
  const y = sectionRect.top + (slot?.y || 60)

  // Update task position (but keep inbox status for smart groups)
  const updates: any = {
    canvasPosition: { x, y }
  }

  // For smart groups, keep isInInbox: true
  // For regular sections, set isInInbox: false
  const isSmartGroup = shouldUseSmartGroupLogic(section.name)
  if (!isSmartGroup) {
    updates.isInInbox = false
  }

  console.log(`[handleSectionTaskDrop] Applying updates for task "${taskId}":`, updates)
  taskStore.updateTaskWithUndo(taskId, updates)
}

const handleSectionUpdate = (data: any) => {
  // Update section name when edited in SectionNodeSimple
  if (data.name) {
    const sectionId = data.id || canvasStore.activeSectionId
    if (sectionId) {
      canvasStore.updateSectionWithUndo(sectionId, { name: data.name })
      syncNodes() // Re-sync to update the node
    }
  }
}

const handleSectionActivate = (sectionId: string) => {
  canvasStore.activeSectionId = sectionId
  canvasStore.setActiveSection(sectionId)
}

const handleSectionContextMenu = (event: MouseEvent, section: any) => {
  console.log('🎯 Section context menu triggered for:', section)

  // Prevent event from bubbling to Vue Flow's node context menu
  event.stopPropagation()
  event.preventDefault()

  // Set the section for context menu
  canvasContextSection.value = section

  // Set menu position
  canvasContextMenuX.value = event.clientX
  canvasContextMenuY.value = event.clientY
  showCanvasContextMenu.value = true

  // Close other context menus
  closeNodeContextMenu()
  closeEdgeContextMenu()

  console.log('📋 Section context menu should be visible:', showCanvasContextMenu.value)
}

// Multi-selection handlers - FIXED to preserve group connection

const handleSelectionChange = withVueFlowErrorBoundary('handleSelectionChange', (selectedIds: string[]) => {
  console.log('🔄 VUE FLOW SELECTION CHANGE:')
  console.log('🔄 Selected IDs from Vue Flow:', selectedIds)
  console.log('🔄 Previous canvas store selection:', canvasStore.selectedNodeIds)

  canvasStore.setSelectedNodes(selectedIds)

  console.log('🔄 Updated canvas store selection:', canvasStore.selectedNodeIds)
  console.log('🔄 Selection synchronization complete')
})

const handleBulkAction = (action: string, params: any) => {
  const { nodeIds } = params
  
  switch (action) {
    case 'updateStatus':
      nodeIds.forEach((nodeId: string) => {
        const task = taskStore.tasks.find(t => t.id === nodeId)
        if (task) {
          taskStore.updateTaskWithUndo(nodeId, { status: params.status })
        }
      })
      break

    case 'updatePriority':
      nodeIds.forEach((nodeId: string) => {
        const task = taskStore.tasks.find(t => t.id === nodeId)
        if (task) {
          taskStore.updateTaskWithUndo(nodeId, { priority: params.priority })
        }
      })
      break

    case 'delete':
      if (confirm(`Delete ${nodeIds.length} selected tasks?`)) {
        nodeIds.forEach((nodeId: string) => {
          undoHistory.deleteTaskWithUndo(nodeId)
        })
        canvasStore.clearSelection()
      }
      break

    case 'duplicate':
      nodeIds.forEach((nodeId: string) => {
        const task = taskStore.tasks.find(t => t.id === nodeId)
        if (task) {
          taskStore.createTaskWithUndo({
            title: `${task.title} (Copy)`,
            description: task.description,
            priority: task.priority,
            status: task.status,
            estimatedDuration: task.estimatedDuration,
            projectId: task.projectId,
            canvasPosition: task.canvasPosition ? {
              x: task.canvasPosition.x + 50,
              y: task.canvasPosition.y + 50
            } : undefined,
            isInInbox: false
          })
        }
      })
      break
      
    case 'moveToSection':
      // TODO: Implement section selection dialog
      break
      
    default:
      // Unknown bulk action
  }
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
    const nodeAny = nodes.value[nodeIndex] as any
    if (nodeAny.selected !== isSelected) {
      nodeAny.selected = isSelected
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
const cleanupStaleNodes = () => {
  console.log('🧹 [DISABLED] Stale node cleanup skipped - Vue Flow manages its own DOM')
  // Vue Flow handles DOM cleanup internally. Manual node.remove() calls
  // bypass the reactivity system and cause rendering failures.
  // If cleanup is truly needed, use: const { removeNodes } = useVueFlow()
}

onMounted(async () => {
  console.log('CanvasView mounted, tasks:', taskStore.tasks.length)
  console.log('✅ showSectionTypeDropdown fix applied - handleClickOutside function removed')

  // Set Vue Flow as mounted immediately (component is ready for operations)
  isVueFlowMounted.value = true
  console.log('🎯 Vue Flow component mounted and ready for operations')

  // Clean up any stale DOM nodes from previous sessions
  cleanupStaleNodes()

  await canvasStore.loadFromDatabase()
  syncNodes()
  canvasStore.initializeDefaultSections()

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
    resourceManager.addEventListener(window, 'keydown', handleKeyDown, { capture: true })
  } else {
    console.warn('⚠️ [CANVAS] Window object not available for keyboard event listener')
  }

  // Set Vue Flow ref for cleanup
  resourceManager.setVueFlowRef(vueFlowRef.value)

  // Explicitly enforce zoom limits after Vue Flow initializes
  nextTick(async () => {
    console.log('[Zoom Debug] Enforcing zoom limits after mount')

    // Get Vue Flow instance and enforce zoom configuration with error handling
    try {
      const { setMinZoom, setMaxZoom } = useVueFlow()
      if (setMinZoom && setMaxZoom) {
        setMinZoom(0.05)  // 5% minimum
        setMaxZoom(4.0)  // 400% maximum
        console.log('[Zoom Debug] Vue Flow zoom limits explicitly set to 5%-400%')
      }
    } catch (error) {
      console.warn('⚠️ [VUE_FLOW] Failed to set zoom limits:', error)
    }

    // Verify current zoom is within bounds
    const currentZoom = viewport.value?.zoom
    if (currentZoom < 0.05 || currentZoom > 4.0) {
      console.log(`[Zoom Debug] Current zoom ${currentZoom} out of bounds, resetting to 100%`)
      vueFlowZoomTo(1.0, { duration: 0 })
    }

    // Double-enforce zoom limits after a delay to ensure Vue Flow respects them - using resourceManager
    const zoomTimerId = setTimeout(() => {
      const { setMinZoom: setMinZoomAgain, setMaxZoom: setMaxZoomAgain } = useVueFlow()
      if (setMinZoomAgain && setMaxZoomAgain) {
        setMinZoomAgain(0.05)
        setMaxZoomAgain(4.0)
        console.log('[Zoom Debug] Zoom limits re-enforced after delay')
      }

      // 🔧 DISABLED: Auto-centering was zooming in on tasks unexpectedly
      // Users reported this was confusing as it would zoom to a single task
      // The canvas now starts at the default viewport { zoom: 1, x: 0, y: 0 }
      // Users can press 'F' to fitView manually if needed
      console.log('[Canvas Init] Using default viewport (auto-center disabled)')
    }, 1000)
    resourceManager.addTimer(zoomTimerId as unknown as number)

    // Initialize Vue Flow stability systems for testing access
    if (typeof window !== 'undefined') {
      console.log('🔧 [VUE_FLOW] Initializing stability systems for testing...')

      // Make systems available globally for testing
      window.vueFlowStability = vueFlowStability
      window.vueFlowStateManager = vueFlowStateManager
      window.vueFlowErrorHandling = vueFlowErrorHandling
      window.vueFlowStore = vueFlowStore.value

      // Initialize the systems
      try {
        await vueFlowStability.initialize()
        console.log('✅ [VUE_FLOW] Stability system initialized')
      } catch (error) {
        console.warn('⚠️ [VUE_FLOW] Stability system initialization failed:', error)
      }

      try {
        await vueFlowStateManager.initialize()
        console.log('✅ [VUE_FLOW] State manager initialized')
      } catch (error) {
        console.warn('⚠️ [VUE_FLOW] State manager initialization failed:', error)
      }

      try {
        vueFlowErrorHandling.initialize()
        console.log('✅ [VUE_FLOW] Error handling initialized')
      } catch (error) {
        console.warn('⚠️ [VUE_FLOW] Error handling initialization failed:', error)
      }
    }
  })
})

onBeforeUnmount(() => {
  // Clean up all managed resources (watchers, event listeners, timers, intervals, Vue Flow instance)
  resourceManager.cleanup()

  // Clean up zoom performance manager
  zoomPerformanceManager.cleanup()

  console.log('🧹 CanvasView resources cleaned up successfully')
})


// Keyboard Deletion Test Function
</script>

<style scoped>
.canvas-layout {
  display: flex;
  flex: 1;
  background: var(--surface-primary);
  overflow: hidden; /* Prevent overflow from affecting viewport */
  height: 100%;
  position: relative; /* For positioning filter controls */
  max-height: 100vh; /* Ensure layout doesn't exceed viewport height */
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

.loading-text {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.canvas-container {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  position: relative;
  background: var(--canvas-bg, #1a1a1a);
}

.vue-flow-container {
  width: 100%;
  height: 100%;
}

.canvas-container-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
}

.canvas-drop-zone {
  flex: 1;
  position: relative;
  width: 100%;
  height: 100%;
}

/* InboxPanel positioning - overlays on left side of canvas */
:deep(.inbox-panel) {
  position: absolute;
  left: 1rem;
  top: 1rem;
  z-index: 50;
  /* InboxPanel has its own sizing: 320px expanded, 3rem collapsed */
}

/* Vue Flow container dimensions fix */
.canvas-layout > div {
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
  flex: 1;
  position: relative;
  overflow: hidden; /* Prevent scrollbars on main canvas */
  height: 100%;
}



.canvas-drop-zone {
  width: 100%;
  height: 100%;
  position: relative;
}

.canvas-container {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  position: relative;
  background: var(--canvas-bg, #1a1a1a);
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
  background: var(--surface-primary);
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
.vue-flow__node[id^="section-"],
.vue-flow__node-sectionNode {
  z-index: 1 !important;
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
.controls-eye-toggle {
  position: absolute;
  bottom: 188px;
  right: 198px;
  width: 32px;
  height: 32px;
  background: var(--glass-border);
  border: 1px solid var(--glass-border-strong);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.controls-eye-toggle:hover {
  background: var(--glass-bg-soft);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: scale(1.05);
}

.controls-eye-toggle:active {
  transform: scale(0.95);
}


/* Eye toggle for hiding/showing done tasks - positioned relative to canvas container */
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

.vue-flow__resize-control.line {
  background-color: var(--brand-primary) !important;
  opacity: 1 !important; /* Always visible */
  transition: background-color 0.2s ease !important;
  /* Lines should not block drag events */
  pointer-events: none !important;
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

/* Resize line styles with better visibility */
.vue-flow__resize-control.line.top,
.vue-flow__resize-control.line.bottom {
  height: 2px !important;
  width: 100% !important;
}

.vue-flow__resize-control.line.left,
.vue-flow__resize-control.line.right {
  width: 2px !important;
  height: 100% !important;
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

/* Resize Preview Overlay - FIXED positioning */
.resize-preview-overlay-fixed {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 998;
}

.resize-preview-section-overlay {
  border: 2px dashed var(--accent-primary);
  border-radius: var(--radius-lg);
  background: rgba(99, 102, 241, 0.08);
  pointer-events: none;
  z-index: 999;
  animation: resize-preview-pulse 1.5s ease-in-out infinite;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  /* Prevent interference with drag operations */
  transform-origin: top left;
}

.resize-size-indicator {
  position: absolute;
  top: -32px;
  right: 0;
  background: var(--surface-primary);
  border: 1px solid var(--accent-primary);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--accent-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  z-index: 1000;
  /* Ensure indicator stays visible during resize */
  transform: translateZ(0);
}

@keyframes resize-preview-pulse {
  0%, 100% {
    opacity: 0.6;
    background: rgba(99, 102, 241, 0.08);
  }
  50% {
    opacity: 0.8;
    background: rgba(99, 102, 241, 0.12);
  }
}

/* Keyboard Deletion Test Overlay Styles */

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

/* Vue Flow Stability Monitor */
.vue-flow-stability-monitor {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  z-index: 1000;
  font-size: 12px;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.stability-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 13px;
}

.stability-title {
  color: #fff;
}

.recovery-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
}

.recovery-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.stability-metrics {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
}

.metric-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
}

.metric-value {
  font-weight: 500;
  font-size: 11px;
  color: #fff;
}

.metric-value.status {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}

.metric-value.status.healthy {
  background: rgba(34, 197, 94, 0.8);
}

.metric-value.status.slow {
  background: rgba(251, 146, 60, 0.8);
}

.metric-value.status.overloaded {
  background: rgba(239, 68, 68, 0.8);
}

.metric-value.status.error {
  background: rgba(220, 38, 38, 0.8);
  animation: pulse 2s infinite;
}

.metric-value.status.recovering {
  background: rgba(59, 130, 246, 0.8);
}

.metric-value.error {
  color: #f87171;
  font-weight: 600;
}

.metric-value.recovery {
  color: #60a5fa;
  font-weight: 600;
}

/* Status-specific backgrounds */
.vue-flow-stability-monitor.error {
  border-color: rgba(239, 68, 68, 0.5);
  background: rgba(127, 29, 29, 0.9);
}

.vue-flow-stability-monitor.overloaded {
  border-color: rgba(251, 146, 60, 0.5);
  background: rgba(124, 45, 18, 0.9);
}

.vue-flow-stability-monitor.slow {
  border-color: rgba(251, 191, 36, 0.5);
  background: rgba(120, 80, 15, 0.9);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

</style>
