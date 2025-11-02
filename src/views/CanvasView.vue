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
    <!-- ================================================================= -->
    <!-- TEMPLATE ORGANIZATION - Phase 1 (Zero Risk)               -->
    <!-- ================================================================= -->

    <!-- SIDEBAR SECTION (Safe to Extract) -->
    <!-- Component: InboxPanel -->
    <!-- Dependencies: uiStore.secondarySidebarVisible -->
    <Transition name="sidebar-slide">
      <InboxPanel v-show="uiStore.secondarySidebarVisible" />
    </Transition>

    <!-- MAIN CANVAS AREA -->
    <div class="canvas-main">
      <!-- CANVAS CONTROLS SECTION (Safe to Extract) -->
      <!-- Component: CanvasControls -->
      <!-- Dependencies: zoom functions, section functions, display toggles -->
      <div class="canvas-controls">
        <!-- Test Controls (Temporary) -->
        <div class="control-group">
          <button @click="showKeyboardTest = true" class="control-btn" title="Test Keyboard Deletion">
            <PlayCircle :size="16" />
          </button>
        </div>

        <!-- Section Controls -->
        <div class="control-group">
          <button @click="toggleSections" class="control-btn" :class="{ active: showSections }" title="Toggle Sections">
            <Grid3X3 :size="16" />
          </button>
          <div class="dropdown-container">
            <button @click="addSection" class="control-btn" title="Add Section">
              <Plus :size="16" />
            </button>
            <div v-if="showSectionTypeDropdown" class="section-type-dropdown">
              <div class="dropdown-section">
                <div class="dropdown-label">Priority</div>
                <button @click="createSmartSection('priority-high')" class="dropdown-item priority-high">
                  <AlertTriangle :size="14" />
                  <span>High Priority</span>
                </button>
                <button @click="createSmartSection('priority-medium')" class="dropdown-item priority-medium">
                  <Flag :size="14" />
                  <span>Medium Priority</span>
                </button>
                <button @click="createSmartSection('priority-low')" class="dropdown-item priority-low">
                  <Circle :size="14" />
                  <span>Low Priority</span>
                </button>
              </div>
              <div class="dropdown-section">
                <div class="dropdown-label">Status</div>
                <button @click="createSmartSection('status-planned')" class="dropdown-item status-planned">
                  <Calendar :size="14" />
                  <span>Planned</span>
                </button>
                <button @click="createSmartSection('status-in_progress')" class="dropdown-item status-in_progress">
                  <PlayCircle :size="14" />
                  <span>In Progress</span>
                </button>
                <button @click="createSmartSection('status-done')" class="dropdown-item status-done">
                  <CheckCircle :size="14" />
                  <span>Done</span>
                </button>
              </div>
            </div>
          </div>
          <button @click="autoArrange" class="control-btn" title="Auto Arrange">
            <Layout :size="16" />
          </button>
        </div>
        
        <!-- Selection Controls -->
        <div class="control-group">
          <button @click="toggleMultiSelect" class="control-btn" :class="{ active: canvasStore.multiSelectMode }" title="Multi-Select Mode">
            <CheckSquare :size="16" />
          </button>
        </div>

        <!-- Display Controls -->
        <div class="control-group">
          <button @click="canvasStore.togglePriorityIndicatorWithUndo" class="control-btn" :class="{ active: canvasStore.showPriorityIndicator }" title="Toggle Priority">
            <Flag :size="16" />
          </button>
          <button @click="canvasStore.toggleStatusBadgeWithUndo" class="control-btn" :class="{ active: canvasStore.showStatusBadge }" title="Toggle Status">
            <PlayCircle :size="16" />
          </button>
          <button @click="canvasStore.toggleDurationBadgeWithUndo" class="control-btn" :class="{ active: canvasStore.showDurationBadge }" title="Toggle Duration">
            <Clock :size="16" />
          </button>
          <button @click="canvasStore.toggleScheduleBadgeWithUndo" class="control-btn" :class="{ active: canvasStore.showScheduleBadge }" title="Toggle Schedule">
            <Calendar :size="16" />
          </button>
          <button
            class="hide-done-toggle control-btn icon-only"
            :class="{ active: taskStore.hideDoneTasks }"
            @click="handleToggleDoneTasks"
            :title="taskStore.hideDoneTasks ? 'Show completed tasks' : 'Hide completed tasks'"
          >
            <EyeOff v-if="taskStore.hideDoneTasks" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>

        <!-- View Controls -->
        <div class="control-group">
          <button @click="fitView" class="control-btn" title="Fit View (F)">
            <Maximize :size="16" />
          </button>
          <button @click="zoomIn" class="control-btn" title="Zoom In (+)">
            <ZoomIn :size="16" />
          </button>
          <button @click="zoomOut" class="control-btn" title="Zoom Out (-)">
            <ZoomOut :size="16" />
          </button>
          <div class="zoom-level">{{ Math.round(viewport.zoom * 100) }}%</div>
          <div class="zoom-dropdown-container">
            <button @click="toggleZoomDropdown" class="control-btn zoom-dropdown-trigger" title="Zoom Presets">
              <ChevronDown :size="14" />
            </button>
            <div v-if="showZoomDropdown" class="zoom-dropdown">
              <button
                v-for="preset in zoomPresets"
                :key="preset.value"
                @click="applyZoomPreset(preset.value)"
                class="zoom-preset-btn"
                :class="{ active: Math.abs(viewport.zoom - preset.value) < 0.01 }"
              >
                {{ preset.label }}
              </button>
              <div class="zoom-divider"></div>
              <button @click="resetZoom" class="zoom-preset-btn">
                Reset (100%)
              </button>
              <button @click="fitToContent" class="zoom-preset-btn">
                Fit to Content
              </button>
            </div>
          </div>
        </div>
      </div>

       <!-- Vue Flow Canvas -->
      <div
        @drop="handleDrop"
        @dragover.prevent
        @contextmenu.prevent="handleCanvasRightClick"
        class="canvas-drop-zone"
      >
        <!-- Loading overlay while canvas initializes -->
        <div v-if="!isCanvasReady" class="canvas-loading-overlay">
          <div class="loading-content">
            <div class="loading-spinner"></div>
            <span class="loading-text">Loading canvas...</span>
          </div>
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
        <VueFlow
          :class="{ 'canvas-ready': isCanvasReady }"
          v-model:nodes="nodes"
          v-model:edges="edges"
          :node-types="nodeTypes"
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
          :zoom-scroll-sensitivity="1.0"
          :zoom-activation-key-code="null"
          :prevent-scrolling="true"
          :default-viewport="{ zoom: 1, x: 0, y: 0 }"
          @node-drag-start="handleNodeDragStart"
          @node-drag-stop="handleNodeDragStop"
          @node-drag="handleNodeDrag"
          @nodes-change="handleNodesChange"
          @pane-click="handlePaneClick"
          @pane-context-menu="handlePaneContextMenu"
          @node-context-menu="handleNodeContextMenu"
          @edge-context-menu="handleEdgeContextMenu"
          @connect="handleConnect"
          @connect-start="handleConnectStart"
          @connect-end="handleConnectEnd"
          @keydown="handleKeyDown"
          class="vue-flow-container"
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

        <!-- Controls -->
        <Controls />

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
            @edit="handleEditTask"
            @select="handleTaskSelect"
            @context-menu="handleTaskContextMenu"
          />
        </template>
      </VueFlow>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- MODALS & OVERLAYS SECTION (Safe to Extract)                      -->
    <!-- Components: Various modals and overlays                           -->
    <!-- Dependencies: Modal state variables, task data                    -->

    <!-- Keyboard Deletion Test Component (Temporary) -->
    <div v-if="showKeyboardTest" class="keyboard-test-overlay">
      <div class="keyboard-test-content">
        <div class="test-header">
          <h3>Keyboard Deletion Test Suite</h3>
          <button @click="showKeyboardTest = false" class="close-btn">✕</button>
        </div>
        <div class="test-controls">
          <button @click="runKeyboardDeletionTest" :disabled="isTestRunning" class="test-btn primary">
            {{ isTestRunning ? '⏳ Running...' : '🚀 Run Test' }}
          </button>
          <div class="test-status">{{ testStatus }}</div>
        </div>
        <div class="test-results">
          <div v-for="(result, index) in testResults" :key="index" :class="['result-item', result.status]">
            <span>{{ result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏳' }}</span>
            <span>{{ result.message }}</span>
          </div>
        </div>
      </div>
    </div>

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
import { VueFlow, useVueFlow, useNodesInitialized, PanOnScrollMode } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { NodeResizer, NodeResizeControl } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
import type { Node, Edge } from '@vue-flow/core'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { useUncategorizedTasks } from '@/composables/useUncategorizedTasks'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { getUndoSystem } from '@/composables/undoSingleton'
import InboxPanel from '@/components/canvas/InboxPanel.vue'
import TaskNode from '@/components/canvas/TaskNode.vue'
import SectionNodeSimple from '@/components/canvas/SectionNodeSimple.vue'
import TaskEditModal from '@/components/TaskEditModal.vue'
import QuickTaskCreateModal from '@/components/QuickTaskCreateModal.vue'
import BatchEditModal from '@/components/BatchEditModal.vue'
import MultiSelectionOverlay from '@/components/canvas/MultiSelectionOverlay.vue'
import CanvasContextMenu from '@/components/canvas/CanvasContextMenu.vue'
import EdgeContextMenu from '@/components/canvas/EdgeContextMenu.vue'
import GroupModal from '@/components/GroupModal.vue'
import GroupEditModal from '@/components/canvas/GroupEditModal.vue'
import SectionWizard from '@/components/canvas/SectionWizard.vue'
import { Maximize, ZoomIn, ZoomOut, Grid3X3, Plus, Layout, CheckSquare, Flag, PlayCircle, Clock, Calendar, AlertTriangle, CheckCircle, Circle, Eye, EyeOff, ChevronDown, TestTube } from 'lucide-vue-next'

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
const undoHistory = getUndoSystem()

// Uncategorized tasks composable
const { filterTasksForRegularViews } = useUncategorizedTasks()

if (import.meta.env.DEV) {
  ;(window as any).__canvasStore = canvasStore
}

// ============================================================================
// PHASE 1: INTERNAL ORGANIZATION (Zero Risk Refactoring)
// ============================================================================
// This section adds organizational comments to help identify code groups
// for potential extraction in later phases. No code is moved or changed.

// === CANVAS ZOOM CONTROLS GROUP ===
// Functions: fitView, zoomIn, zoomOut, setZoom
// State: showZoomDropdown, zoomPresets
// Location: Lines ~2545-2590 (zoom functions)

// === CANVAS SECTIONS MANAGEMENT GROUP ===
// Functions: toggleSections, addSection, createSmartSection, autoArrange
// State: showSections, activeSectionId, showSectionTypeDropdown
// Location: Lines ~2590-2680 (section functions)

// === CANVAS SELECTION CONTROLS GROUP ===
// Functions: toggleMultiSelect
// State: Uses canvasStore.multiSelectMode
// Location: Lines ~2680-2700 (selection functions)

// === MODAL STATE MANAGEMENT GROUP ===
// State: isEditModalOpen, selectedTask, showKeyboardTest, isTestRunning
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

// Keyboard Test state
const showKeyboardTest = ref(false)
const isTestRunning = ref(false)
const testStatus = ref('')
const testResults = ref<Array<{status: 'passed' | 'failed' | 'running', message: string}>>([])

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

// Edge Context Menu state
const showEdgeContextMenu = ref(false)
const edgeContextMenuX = ref(0)
const edgeContextMenuY = ref(0)
const selectedEdge = ref<any>(null)

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

// Sections state
const showSections = ref(true)
const activeSectionId = ref<string | null>(null)
const showSectionTypeDropdown = ref(false)

// Zoom state
const showZoomDropdown = ref(false)
const zoomPresets = [
  { label: '5%', value: 0.05 },
  { label: '10%', value: 0.10 },
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.50 },
  { label: '100%', value: 1.0 },
  { label: '200%', value: 2.0 },
  { label: '400%', value: 4.0 }
]

// Computed properties
const sections = computed(() => canvasStore.sections)

// Filtered tasks specifically for Canvas View
// Uses taskStore.filteredTasks directly when smart views are active to avoid double filtering
const canvasFilteredTasks = computed(() => {
  try {
    // Validate input from taskStore
    const storeTasks = taskStore.filteredTasks
    if (!Array.isArray(storeTasks)) {
      console.warn('CanvasView.canvasFilteredTasks: taskStore.filteredTasks is not an array:', storeTasks)
      return []
    }

    // When smart views are active, use filteredTasks directly to avoid double filtering
    if (taskStore.activeSmartView && taskStore.activeSmartView !== 'uncategorized') {
      console.log('CanvasView.canvasFilteredTasks: Using smart view filtered tasks directly:', storeTasks.length, 'tasks')
      return storeTasks
    }

    // For uncategorized smart view or regular views, use the existing filter logic
    return filterTasksForRegularViews(storeTasks, taskStore.activeSmartView)
  } catch (error) {
    console.error('CanvasView.canvasFilteredTasks: Error filtering tasks:', error)
    return []
  }
})

// Dynamic node extent based on content and zoom limits
const dynamicNodeExtent = computed(() => {
  const tasks = taskStore.tasksWithCanvasPosition
  if (!tasks || !tasks.length) {
    return [[-2000, -2000], [5000, 5000]] as [[number, number], [number, number]]
  }

  const contentBounds = canvasStore.calculateContentBounds(tasks)
  const padding = 1000
  const minZoom = canvasStore.zoomConfig.minZoom

  // Expand bounds significantly to allow for extreme zoom levels
  const expandedBounds = {
    minX: contentBounds.minX - padding * 10,
    minY: contentBounds.minY - padding * 10,
    maxX: contentBounds.maxX + padding * 10,
    maxY: contentBounds.maxY + padding * 10
  }

  return [
    [expandedBounds.minX, expandedBounds.minY],
    [expandedBounds.maxX, expandedBounds.maxY]
  ] as [[number, number], [number, number]]
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
const getSectionResizeStyle = (section: any) => {
  if (!resizeState.value.isResizing || resizeState.value.sectionId !== section.id) {
    return {}
  }

  return {
    position: 'fixed',
    left: `${section.position.x * viewport.value.zoom + viewport.value.x}px`,
    top: `${section.position.y * viewport.value.zoom + viewport.value.y}px`,
    width: `${resizeState.value.currentWidth * viewport.value.zoom}px`,
    height: `${resizeState.value.currentHeight * viewport.value.zoom}px`,
    pointerEvents: 'none',
    zIndex: 999
  }
}

// Register custom node types
const nodeTypes = markRaw({
  taskNode: TaskNode,
  sectionNode: SectionNodeSimple
})

// Get Vue Flow instance methods
const { fitView: vueFlowFitView, zoomIn: vueFlowZoomIn, zoomOut: vueFlowZoomOut, zoomTo: vueFlowZoomTo, viewport, getSelectedNodes, getNodes, findNode } = useVueFlow()

// Get nodesInitialized composable - tracks when all nodes have measured dimensions
const nodesInitialized = useNodesInitialized()

// Derive nodes from tasks with canvas positions (use ref, sync with watch)
const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

// Track if we've done initial viewport centering
const hasInitialFit = ref(false)

// Track if canvas is ready to display (prevents flash during initial fitView)
const isCanvasReady = ref(false)

// Sync nodes from store with parent-child relationships and collapsible sections
const syncNodes = () => {
  const allNodes: Node[] = []

  // Add section nodes FIRST (so they render in background)
  canvasStore.sections.forEach(section => {
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

  // Add task nodes AFTER (so they render on top) - only if section is NOT collapsed
  canvasFilteredTasks.value
    .filter(task => task && task.id) // CRITICAL: Ensure task object is valid before processing
    .forEach((task, index) => {
      // Skip tasks still in inbox or without canvas position (inbox-first architecture)
      if (task.isInInbox || !task.canvasPosition) return

    // Find which section this task belongs to (if any)
    const section = canvasStore.sections.find(s => {
      const { x, y, width, height } = s.position
      const taskX = task.canvasPosition!.x
      const taskY = task.canvasPosition!.y

      return taskX >= x && taskX <= x + width && taskY >= y && taskY <= y + height
    })

    // Skip tasks that are in collapsed sections
    if (section && section.isCollapsed) return

    // Calculate relative position if task is in a section
    let position = task.canvasPosition!
    let parentNode: string | undefined = undefined

    if (section) {
      // Enable parent-child relationship so tasks move with sections
      // Convert absolute position to relative position within section
      position = {
        x: task.canvasPosition!.x - section.position.x,
        y: task.canvasPosition!.y - section.position.y
      }
      parentNode = `section-${section.id}`
      // Note: NOT using extent: 'parent' so tasks can still be dragged out
    }

    allNodes.push({
      id: task.id,
      type: 'taskNode',
      position: position,
      parentNode: parentNode,
      style: { zIndex: 10 },
      data: { task },
      draggable: true,
      selectable: true
    })
  })

  nodes.value = allNodes
}

const getTaskCountForSection = (sectionId: string) => {
  const section = canvasStore.sections.find(s => s.id === sectionId)
  if (!section) return 0

  // Use the new canvas store utility for accurate task counting
  return canvasStore.getTaskCountInSection(section, canvasFilteredTasks.value)
}

// Sync edges from store
const syncEdges = () => {
  const allEdges: Edge[] = []
  const taskIds = new Set(canvasFilteredTasks.value.map(t => t.id))

  canvasFilteredTasks.value.forEach(task => {
    if (task.dependsOn && task.dependsOn.length > 0) {
      // Clean up orphaned dependencies (remove references to deleted tasks)
      const validDependencies = task.dependsOn.filter(depId => taskIds.has(depId))

      // Update task if orphaned dependencies were found
      if (validDependencies.length !== task.dependsOn.length) {
        taskStore.updateTaskWithUndo(task.id, { dependsOn: validDependencies })
      }

      // Create edges only for valid dependencies where source and target both exist
      validDependencies.forEach(depId => {
        const sourceTask = taskStore.tasks.find(t => t.id === depId)
        const targetTask = taskStore.tasks.find(t => t.id === task.id)

        // Only create edge if both source and target tasks exist and are on canvas
        if (sourceTask && targetTask &&
            sourceTask.canvasPosition && targetTask.canvasPosition) {
          allEdges.push({
            id: `${depId}-${task.id}`,
            source: depId,
            target: task.id,
            type: task.connectionTypes?.[depId] || 'default',
            animated: false
          })
        }
      })
    }
  })

  edges.value = allEdges
}

// Watch for task and section changes
watch(() => canvasFilteredTasks.value, () => {
  syncNodes()
  syncEdges()
}, { deep: true })

// Watch sections array length and IDs only (not deep) to prevent recursion
watch(() => canvasStore.sections.map(s => s.id).join(','), () => {
  syncNodes()
})

// Watch for section collapse state changes - CRITICAL for Vue Flow parent-child
watch(() => canvasStore.sections.map(s => ({ id: s.id, isCollapsed: s.isCollapsed })), () => {
  syncNodes()
}, { deep: true })

// Watch for task position changes to update section counts
watch(() => canvasFilteredTasks.value.map(t => ({ id: t.id, canvasPosition: t.canvasPosition })), () => {
  syncNodes()
}, { deep: true })

// Watch for canvas store selection changes and sync with Vue Flow nodes - FIXED to prevent disconnection
watch(() => canvasStore.selectedNodeIds, (newSelectedIds) => {
  // Update Vue Flow nodes to match canvas store selection
  nodes.value.forEach(node => {
    const shouldBeSelected = newSelectedIds.includes(node.id)
    if (node.selected !== shouldBeSelected) {
      node.selected = shouldBeSelected
    }
  })
}, { deep: true })

// Auto-center viewport on tasks when all nodes are initialized with dimensions
// Uses Vue Flow's recommended useNodesInitialized composable for reliable timing
watch(nodesInitialized, async (initialized) => {
  if (initialized && !hasInitialFit.value) {
    console.log('✅ All nodes initialized with dimensions, auto-centering viewport')
    // Position viewport instantly (duration: 0 prevents visible animation/flash)
    fitView({ padding: 0.2, duration: 0 })
    hasInitialFit.value = true
    // Wait for viewport transform to complete, then reveal canvas
    await nextTick()
    isCanvasReady.value = true
    console.log('✅ Canvas ready and centered on tasks')
  }
}, { immediate: true })

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
  const inboxTasks = canvasFilteredTasks.value.filter(t =>
    t.isInInbox === true && t.status !== 'done'
  )

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
    case 'custom':  // CRITICAL FIX: Allow custom sections with timeline names (e.g., "Today")
    case 'timeline':
      // When dropped into timeline sections (Today, This Weekend, etc.)
      // Check by name if propertyValue is not set
      if (section.propertyValue === 'today' || section.name.toLowerCase().includes('today')) {
        console.log('[applySectionPropertiesToTask] Detected Today section, creating instance')
        const today = new Date()
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        console.log('[applySectionPropertiesToTask] Today key:', todayKey)

        // Replace task instance date with today's date
        const task = taskStore.tasks.find(t => t.id === taskId)
        if (task) {
          const existingInstances = task.instances || []
          console.log('[applySectionPropertiesToTask] Existing instances:', existingInstances)

          // REPLACE first instance date with today, or create new if no instances
          if (existingInstances.length > 0) {
            console.log('[applySectionPropertiesToTask] Replacing first instance date with today')
            const updatedInstance = {
              ...existingInstances[0],
              scheduledDate: todayKey,
              scheduledTime: existingInstances[0].scheduledTime || '09:00'
            }
            updates.instances = [updatedInstance, ...existingInstances.slice(1)]

            // ALSO update dueDate for edit modal (ISO format: YYYY-MM-DD)
            updates.dueDate = todayKey

            console.log('[applySectionPropertiesToTask] Updated instance:', updatedInstance)
            console.log('[applySectionPropertiesToTask] Updated dueDate:', updates.dueDate)
          } else {
            console.log('[applySectionPropertiesToTask] No instances found, creating new one')
            const newInstance = {
              id: `${taskId}-${todayKey}`,
              scheduledDate: todayKey,
              scheduledTime: '09:00',
              duration: task.estimatedDuration || 25,
              completedPomodoros: 0,
              isLater: false
            }
            updates.instances = [newInstance]

            // ALSO update dueDate for edit modal (ISO format: YYYY-MM-DD)
            updates.dueDate = todayKey

            console.log('[applySectionPropertiesToTask] Created new instance:', newInstance)
            console.log('[applySectionPropertiesToTask] Set dueDate:', updates.dueDate)
          }
        }
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

// Handle node drag start - Vue Flow handles parent-child automatically now
const handleNodeDragStart = (event: any) => {
  const { node } = event

  if (node.id.startsWith('section-')) {
    const sectionId = node.id.replace('section-', '')
    const section = canvasStore.sections.find(s => s.id === sectionId)

    if (section) {
      // Just track the start position - Vue Flow will handle child dragging
      console.log(`Started dragging section: ${section.name}`)
    }
  }
}

// Handle node drag stop - save position and apply section properties with parent-child support - FIXED to preserve group selection
const handleNodeDragStop = (event: any) => {
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
      canvasFilteredTasks.value
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

      console.log(`Section dragged to: (${node.position.x}, ${node.position.y}) with ${canvasFilteredTasks.value.filter(t => {
        if (!t.canvasPosition) return false
        const taskSection = canvasStore.sections.find(s => {
          const { x, y, width, height } = s.position
          return t.canvasPosition!.x >= x && t.canvasPosition!.x <= x + width &&
                 t.canvasPosition!.y >= y && t.canvasPosition!.y <= y + height
        })
        return taskSection?.id === sectionId
      }).length} child tasks`)
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
        node.selected = selectedIdsBeforeDrag.includes(node.id)
      })
    }
  }
}

// Handle node drag - Vue Flow handles parent-child automatically now
const handleNodeDrag = (event: any) => {
  const { node } = event

  // Vue Flow handles all parent-child dragging automatically
  // No manual logic needed
}

// Handle nodes change (for selection tracking and resize) - FIXED to prevent position updates during resize
const handleNodesChange = (changes: any) => {
  changes.forEach((change: any) => {
    // Track selection changes - FIXED to maintain group connection
    if (change.type === 'select') {
      const currentSelected = nodes.value.filter(n => n.selected).map(n => n.id)

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
}

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
        const tasksInSection = canvasFilteredTasks.value.filter(task => {
          if (!task.canvasPosition || task.isInInbox || section.isCollapsed) return false

          const taskX = task.canvasPosition.x
          const taskY = task.canvasPosition.y

          // Check if task was inside the section's ORIGINAL bounds
          return taskX >= resizeState.value.startX &&
                 taskX <= resizeState.value.startX + resizeState.value.startWidth &&
                 taskY >= resizeState.value.startY &&
                 taskY <= resizeState.value.startY + resizeState.value.startHeight
        })

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
    nodes: selectedNodes,
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

const createTaskHere = () => {
  // Get the VueFlow element to calculate canvas coordinates
  const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
  if (!vueFlowElement) return

  // Calculate canvas coordinates accounting for viewport transformation
  const rect = vueFlowElement.getBoundingClientRect()
  const canvasX = (canvasContextMenuX.value - rect.left - viewport.value.x) / viewport.value.zoom
  const canvasY = (canvasContextMenuY.value - rect.top - viewport.value.y) / viewport.value.zoom

  // Debug logging
  console.log('🎯 Opening task creation at:', {
    screenCoords: { x: canvasContextMenuX.value, y: canvasContextMenuY.value },
    viewport: { x: viewport.value.x, y: viewport.value.y, zoom: viewport.value.zoom },
    canvasCoords: { x: canvasX, y: canvasY }
  })

  // Store the position for when the task is created
  quickTaskPosition.value = { x: canvasX, y: canvasY }

  // Close context menu first to prevent any interference
  closeCanvasContextMenu()

  // Open quick task create modal instead of creating task directly
  isQuickTaskCreateOpen.value = true
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
  const canvasX = (canvasContextMenuX.value - rect.left - viewport.value.x) / viewport.value.zoom
  const canvasY = (canvasContextMenuY.value - rect.top - viewport.value.y) / viewport.value.zoom

  // Debug logging
  console.log('🎯 Creating group at:', {
    screenCoords: { x: canvasContextMenuX.value, y: canvasContextMenuY.value },
    viewport: { x: viewport.value.x, y: viewport.value.y, zoom: viewport.value.zoom },
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
  const canvasX = (canvasContextMenuX.value - rect.left - viewport.value.x) / viewport.value.zoom
  const canvasY = (canvasContextMenuY.value - rect.top - viewport.value.y) / viewport.value.zoom

  console.log('✨ Creating section at:', {
    screenCoords: { x: canvasContextMenuX.value, y: canvasContextMenuY.value },
    viewport: { x: viewport.value.x, y: viewport.value.y, zoom: viewport.value.zoom },
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
const handleNodeContextMenu = (event: { event: MouseEvent; node: any }) => {
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
    const tasksInSection = canvasStore.getTasksInSection(section, canvasFilteredTasks.value)
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
const handleEdgeContextMenu = (event: { event: MouseEvent; edge: any }) => {
  event.event.preventDefault()
  edgeContextMenuX.value = event.event.clientX
  edgeContextMenuY.value = event.event.clientY
  selectedEdge.value = event.edge
  showEdgeContextMenu.value = true
  closeCanvasContextMenu()
  closeNodeContextMenu()
}

const closeEdgeContextMenu = () => {
  showEdgeContextMenu.value = false
  selectedEdge.value = null
}

const disconnectEdge = () => {
  if (!selectedEdge.value) return

  const { source, target } = selectedEdge.value
  const targetTask = taskStore.tasks.find(t => t.id === target)

  if (targetTask && targetTask.dependsOn) {
    const updatedDependsOn = targetTask.dependsOn.filter(id => id !== source)
    taskStore.updateTaskWithUndo(target, { dependsOn: updatedDependsOn })
    syncEdges()
  }

  closeEdgeContextMenu()
}

// Alignment handlers
const alignLeft = () => {
  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )
  if (selectedNodes.length < 2) return

  const minX = Math.min(...selectedNodes.map(n => n.position.x))

  selectedNodes.forEach(node => {
    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: minX, y: node.position.y }
    })
  })

  closeCanvasContextMenu()
}

const alignRight = () => {
  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )
  if (selectedNodes.length < 2) return

  const maxX = Math.max(...selectedNodes.map(n => n.position.x))

  selectedNodes.forEach(node => {
    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: maxX, y: node.position.y }
    })
  })

  closeCanvasContextMenu()
}

const alignTop = () => {
  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )
  if (selectedNodes.length < 2) return

  const minY = Math.min(...selectedNodes.map(n => n.position.y))

  selectedNodes.forEach(node => {
    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: node.position.x, y: minY }
    })
  })

  closeCanvasContextMenu()
}

const alignBottom = () => {
  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )
  if (selectedNodes.length < 2) return

  const maxY = Math.max(...selectedNodes.map(n => n.position.y))

  selectedNodes.forEach(node => {
    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: node.position.x, y: maxY }
    })
  })

  closeCanvasContextMenu()
}

const alignCenterHorizontal = () => {
  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )
  if (selectedNodes.length < 2) return

  const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length

  selectedNodes.forEach(node => {
    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: avgX, y: node.position.y }
    })
  })

  closeCanvasContextMenu()
}

const alignCenterVertical = () => {
  const selectedNodes = nodes.value.filter(n =>
    canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
  )
  if (selectedNodes.length < 2) return

  const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length

  selectedNodes.forEach(node => {
    taskStore.updateTaskWithUndo(node.id, {
      canvasPosition: { x: node.position.x, y: avgY }
    })
  })

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

// Keyboard handler for Delete key and zoom shortcuts
const handleKeyDown = async (event: KeyboardEvent) => {
  const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'

  // Handle zoom shortcuts with Ctrl/Cmd modifier
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case '0':
        event.preventDefault()
        resetZoom()
        return
      case '1':
        event.preventDefault()
        applyZoomPreset(1.0)
        return
      case '2':
        event.preventDefault()
        applyZoomPreset(2.0)
        return
      case '=':
      case '+':
        event.preventDefault()
        zoomIn()
        return
      case '-':
      case '_':
        event.preventDefault()
        zoomOut()
        return
      case 'f':
      case 'F':
        event.preventDefault()
        fitToContent()
        return
    }
  }

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
  const permanentDelete = event.shiftKey

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
      const confirmMessage = section && canvasStore.getTasksInSection(section, canvasFilteredTasks.value).length > 0
        ? `Delete "${section.name}" section? It contains ${canvasStore.getTasksInSection(section, canvasFilteredTasks.value).length} task(s) that will be moved to the canvas.`
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
        console.log('✅ After deleteTask - last action:', undoHistory.lastAction.value)
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
        console.log('✅ After updateTaskWithUndo - last action:', undoHistory.lastAction.value)
      } catch (error) {
        console.error('❌ updateTaskWithUndo failed:', error)
      }
    }
  }

  console.log(`🎯 All ${selectedNodes.length} operations completed. Final undo count: ${undoHistory.undoCount}`)

  canvasStore.setSelectedNodes([])
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
  // Add a small delay to ensure all connection logic completes
  setTimeout(() => {
    isConnecting.value = false
  }, 100)
}

// Handle connection creation - creates task dependency
const handleConnect = (connection: any) => {
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
}

// Handle drop from inbox or board - supports batch operations
const handleDrop = (event: DragEvent) => {
  event.preventDefault()

  const data = event.dataTransfer?.getData('application/json')
  if (!data) return

  const parsedData = JSON.parse(data)
  const { taskId, taskIds, fromInbox, source } = parsedData

  if (fromInbox || source === 'board' || source === 'sidebar') {
    // Use VueFlow's built-in coordinate transformation to account for zoom and pan
    const { project } = useVueFlow()
    const canvasPosition = project({
      x: event.clientX,
      y: event.clientY
    })

    // Handle batch drop (multiple tasks)
    if (taskIds && Array.isArray(taskIds)) {
      taskIds.forEach((id, index) => {
        // Offset each task slightly to create a staggered layout
        const offsetX = (index % 3) * 250 // 3 columns
        const offsetY = Math.floor(index / 3) * 150 // Row height

        taskStore.updateTaskWithUndo(id, {
          canvasPosition: { x: canvasPosition.x + offsetX, y: canvasPosition.y + offsetY },
          isInInbox: false
        })
      })
    }
    // Handle single task drop (legacy/single select)
    else if (taskId) {
      taskStore.updateTaskWithUndo(taskId, {
        canvasPosition: { x: canvasPosition.x, y: canvasPosition.y },
        isInInbox: false
      })
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
      x: -viewport.value.x / currentZoom,
      y: -viewport.value.y / currentZoom,
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
    const currentZoom = viewport.value.zoom
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

    // Double-check that zoom was actually applied and enforce if needed
    setTimeout(() => {
      const actualZoom = viewport.value.zoom
      if (actualZoom > newZoom && Math.abs(actualZoom - newZoom) > 0.01) {
        console.log(`[Zoom Debug] Vue Flow ignored zoom request, forcing again: ${actualZoom} -> ${newZoom}`)
        vueFlowZoomTo(newZoom, { duration: 0 })
      }
    }, 250)
  })
}

// Zoom control functions
const toggleZoomDropdown = () => {
  showZoomDropdown.value = !showZoomDropdown.value
}

const applyZoomPreset = (zoomLevel: number) => {
  // Validate zoom level is within bounds
  const validatedZoom = Math.max(
    canvasStore.zoomConfig.minZoom,
    Math.min(canvasStore.zoomConfig.maxZoom, zoomLevel)
  )

  console.log(`[Zoom Debug] Applying preset: ${zoomLevel} (validated: ${validatedZoom})`)
  console.log(`[Zoom Debug] Min zoom allowed: ${canvasStore.zoomConfig.minZoom}`)

  zoomPerformanceManager.scheduleOperation(() => {
    // Force Vue Flow to respect our zoom limits for presets too
    const { setMinZoom, setMaxZoom } = useVueFlow()
    if (setMinZoom && setMaxZoom) {
      setMinZoom(canvasStore.zoomConfig.minZoom)
      setMaxZoom(canvasStore.zoomConfig.maxZoom)
      console.log(`[Zoom Debug] Forcefully set zoom limits: ${canvasStore.zoomConfig.minZoom} - ${canvasStore.zoomConfig.maxZoom}`)
    }

    vueFlowZoomTo(validatedZoom, { duration: 300 })
    canvasStore.setViewportWithHistory(viewport.value.x, viewport.value.y, validatedZoom)

    // Double-check that zoom was actually applied for critical presets
    if (validatedZoom <= 0.1) { // For 5% and 10% presets
      setTimeout(() => {
        const actualZoom = viewport.value.zoom
        if (actualZoom > validatedZoom && Math.abs(actualZoom - validatedZoom) > 0.01) {
          console.log(`[Zoom Debug] Vue Flow ignored preset zoom, forcing again: ${actualZoom} -> ${validatedZoom}`)
          vueFlowZoomTo(validatedZoom, { duration: 0 })
        }
      }, 350)
    }
  })
  showZoomDropdown.value = false
}

const resetZoom = () => {
  vueFlowZoomTo(1.0, { duration: 300 })
  canvasStore.setViewportWithHistory(viewport.value.x, viewport.value.y, 1.0)
  showZoomDropdown.value = false
}

const fitToContent = () => {
  const tasks = taskStore.tasksWithCanvasPosition
  if (!tasks || !tasks.length) {
    resetZoom()
    return
  }

  const contentBounds = canvasStore.calculateContentBounds(tasks)
  const centerX = (contentBounds.minX + contentBounds.maxX) / 2
  const centerY = (contentBounds.minY + contentBounds.maxY) / 2

  // Calculate zoom to fit content with padding
  const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
  if (vueFlowElement) {
    const rect = vueFlowElement.getBoundingClientRect()
    const contentWidth = contentBounds.maxX - contentBounds.minX
    const contentHeight = contentBounds.maxY - contentBounds.minY

    const zoomX = (rect.width * 0.8) / contentWidth
    const zoomY = (rect.height * 0.8) / contentHeight
    const targetZoom = Math.min(zoomX, zoomY, canvasStore.zoomConfig.maxZoom)

    vueFlowZoomTo(targetZoom, { duration: 400 })
    // Center the content
    setTimeout(() => {
      const panX = rect.width / 2 - centerX * targetZoom
      const panY = rect.height / 2 - centerY * targetZoom
      canvasStore.setViewportWithHistory(panX, panY, targetZoom)
    }, 200)
  }

  showZoomDropdown.value = false
}

// Hide done tasks toggle
const handleToggleDoneTasks = (event: MouseEvent) => {
  // Prevent event bubbling that might interfere with other click handlers
  event.stopPropagation()
  console.log('🔧 CanvasView: Toggle button clicked!')
  console.log('🔧 CanvasView: Current hideDoneTasks value:', taskStore.hideDoneTasks)

  try {
    taskStore.toggleHideDoneTasks()
    console.log('🔧 CanvasView: After toggle - hideDoneTasks value:', taskStore.hideDoneTasks)
    console.log('🔧 CanvasView: Method call successful')
  } catch (error) {
    console.error('🔧 CanvasView: Error calling toggleHideDoneTasks:', error)
  }
}

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
  try {
    // Validate task input
    if (!task || !task.id) {
      console.warn('handleEditTask: Invalid task data', task)
      return
    }

    // Detect multi-selection - open batch edit modal instead
    if (canvasStore.selectedNodeIds &&
        canvasStore.selectedNodeIds.length > 1 &&
        canvasStore.selectedNodeIds.includes(task.id)) {
      batchEditTaskIds.value = [...canvasStore.selectedNodeIds]
      isBatchEditModalOpen.value = true
    } else {
      // Single task edit (existing behavior)
      selectedTask.value = task
      isEditModalOpen.value = true
    }
  } catch (error) {
    console.error('Error in handleEditTask:', error)
    // Continue execution - don't let edit errors crash the canvas
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

const handleQuickTaskCreate = (title: string, description: string) => {
  console.log('🎯 Creating task with title:', title, 'at position:', quickTaskPosition.value)

  // Create new task at the stored canvas position with user-provided title
  const newTask = taskStore.createTaskWithUndo({
    title: title,
    description: description,
    canvasPosition: { x: quickTaskPosition.value.x, y: quickTaskPosition.value.y },
    isInInbox: false,
    priority: 'medium',
    status: 'planned'
  })

  // Close the quick create modal
  closeQuickTaskCreate()

  // Optionally open the full edit modal for additional details
  if (newTask) {
    selectedTask.value = newTask
    // Use nextTick to ensure DOM has updated before opening modal
    nextTick(() => {
      isEditModalOpen.value = true
    })
  } else {
    console.error('Failed to create new task')
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
const toggleSections = () => {
  showSections.value = !showSections.value
}

const toggleSectionTypeDropdown = () => {
  showSectionTypeDropdown.value = !showSectionTypeDropdown.value
}

const createSmartSection = (type: 'priority-high' | 'priority-medium' | 'priority-low' | 'status-planned' | 'status-in_progress' | 'status-done') => {
  const existingCount = canvasStore.sections.length
  const position = {
    x: 50 + (existingCount * 50),
    y: 50 + (existingCount * 50)
  }

  if (type === 'priority-high') {
    canvasStore.createPrioritySection('high', position)
  } else if (type === 'priority-medium') {
    canvasStore.createPrioritySection('medium', position)
  } else if (type === 'priority-low') {
    canvasStore.createPrioritySection('low', position)
  } else if (type === 'status-planned') {
    canvasStore.createStatusSection('planned', position)
  } else if (type === 'status-in_progress') {
    canvasStore.createStatusSection('in_progress', position)
  } else if (type === 'status-done') {
    canvasStore.createStatusSection('done', position)
  }

  // Keep dropdown open to allow multiple section creation
  // showSectionTypeDropdown.value = false
}

const addSection = () => {
  toggleSectionTypeDropdown()
}

// Quick preset section creators
const addHighPrioritySection = () => {
  canvasStore.createPrioritySection('high', { x: 50, y: 50 })
}

const addInProgressSection = () => {
  canvasStore.createStatusSection('in_progress', { x: 400, y: 50 })
}

const addPlannedSection = () => {
  canvasStore.createStatusSection('planned', { x: 750, y: 50 })
}

const autoArrange = () => {
  // Add visual feedback
  const button = document.querySelector('[title="Auto Arrange"]') as HTMLButtonElement
  if (button) {
    button.style.background = 'var(--state-active-bg)'
    button.style.borderColor = 'var(--state-active-border)'
    // Create safe DOM structure instead of innerHTML
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '16')
    svg.setAttribute('height', '16')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('width', '18')
    rect.setAttribute('height', '18')
    rect.setAttribute('x', '3')
    rect.setAttribute('y', '3')
    rect.setAttribute('rx', '2')
    rect.setAttribute('ry', '2')

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line1.setAttribute('x1', '3')
    line1.setAttribute('y1', '9')
    line1.setAttribute('x2', '21')
    line1.setAttribute('y2', '9')

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line2.setAttribute('x1', '9')
    line2.setAttribute('y1', '21')
    line2.setAttribute('x2', '9')
    line2.setAttribute('y2', '9')

    svg.appendChild(rect)
    svg.appendChild(line1)
    svg.appendChild(line2)

    button.innerHTML = ''
    button.appendChild(svg)
    button.appendChild(document.createTextNode(' Arranging...'))
  }

  // Auto-arrange ALL tasks (not just in sections)
  const allTasks = canvasFilteredTasks.value.filter(task => task.canvasPosition)
  const unsectionedTasks = allTasks.filter(task => {
    return !canvasStore.sections.some(section => {
      const { x, y, width, height } = section.position
      return task.canvasPosition && 
        task.canvasPosition.x >= x && 
        task.canvasPosition.x <= x + width &&
        task.canvasPosition.y >= y && 
        task.canvasPosition.y <= y + height
    })
  })

  // Arrange tasks within sections
  canvasStore.sections.forEach(section => {
    const sectionTasks = getTasksForSection(section)
    if (sectionTasks.length === 0) return
    
    const { layout, position } = section
    const spacing = { x: 200, y: 80 }
    
    sectionTasks.forEach((task, index) => {
      let x = position.x + 20
      let y = position.y + 60 + index * spacing.y

      if (layout === 'horizontal') {
        x = position.x + 20 + index * spacing.x
        y = position.y + 60
      } else if (layout === 'grid') {
        const cols = Math.floor(position.width / spacing.x)
        x = position.x + 20 + (index % cols) * spacing.x
        y = position.y + 60 + Math.floor(index / cols) * spacing.y
      }

      taskStore.updateTaskWithUndo(task.id, {
        canvasPosition: { x, y },
        isInInbox: false
      })
    })
  })

  // Arrange unsectioned tasks in a grid (respecting nodeExtent bounds)
  unsectionedTasks.forEach((task, index) => {
    const cols = 4
    const x = 50 + (index % cols) * 250
    const y = 50 + Math.floor(index / cols) * 150

    taskStore.updateTaskWithUndo(task.id, {
      canvasPosition: { x, y },
      isInInbox: false
    })
  })

  // Reset button after delay
  setTimeout(() => {
    if (button) {
      button.style.background = ''
      button.style.borderColor = ''
      // Create safe DOM structure instead of innerHTML
      const svgReset = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svgReset.setAttribute('width', '16')
      svgReset.setAttribute('height', '16')
      svgReset.setAttribute('viewBox', '0 0 24 24')
      svgReset.setAttribute('fill', 'none')
      svgReset.setAttribute('stroke', 'currentColor')
      svgReset.setAttribute('stroke-width', '2')
      svgReset.setAttribute('stroke-linecap', 'round')
      svgReset.setAttribute('stroke-linejoin', 'round')

      const rectReset = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rectReset.setAttribute('width', '18')
      rectReset.setAttribute('height', '18')
      rectReset.setAttribute('x', '3')
      rectReset.setAttribute('y', '3')
      rectReset.setAttribute('rx', '2')
      rectReset.setAttribute('ry', '2')

      const lineReset1 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      lineReset1.setAttribute('x1', '3')
      lineReset1.setAttribute('y1', '9')
      lineReset1.setAttribute('x2', '21')
      lineReset1.setAttribute('y2', '9')

      const lineReset2 = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      lineReset2.setAttribute('x1', '9')
      lineReset2.setAttribute('y1', '21')
      lineReset2.setAttribute('x2', '9')
      lineReset2.setAttribute('y2', '9')

      svgReset.appendChild(rectReset)
      svgReset.appendChild(lineReset1)
      svgReset.appendChild(lineReset2)

      button.innerHTML = ''
      button.appendChild(svgReset)
    }
  }, 1000)
}

const getTasksForSection = (section: any) => {
  const tasks = canvasStore.getTasksInSection(section, canvasFilteredTasks.value)
  // If section is collapsed, return empty array to hide tasks
  return section.isCollapsed ? [] : tasks
}

const handleSectionTaskDrop = (event: DragEvent, slot: any, section: any) => {
  const data = event.dataTransfer?.getData('application/json')
  if (!data) return

  const { taskId, fromInbox } = JSON.parse(data)
  
  // Calculate position within section
  const sectionRect = (event.target as HTMLElement).getBoundingClientRect()
  const x = sectionRect.left + (slot.position?.x || 20)
  const y = sectionRect.top + (slot.position?.y || 60)

  // Update task position and move to section
  taskStore.updateTaskWithUndo(taskId, {
    canvasPosition: { x, y },
    isInInbox: false
  })
}

const handleSectionUpdate = (data: any) => {
  // Update section name when edited in SectionNodeSimple
  if (data.name) {
    const sectionId = data.id || activeSectionId.value
    if (sectionId) {
      canvasStore.updateSectionWithUndo(sectionId, { name: data.name })
      syncNodes() // Re-sync to update the node
    }
  }
}

const handleSectionActivate = (sectionId: string) => {
  activeSectionId.value = sectionId
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
const toggleMultiSelect = () => {
  const wasMultiSelectMode = canvasStore.multiSelectMode

  // Toggle the mode
  canvasStore.toggleMultiSelectMode()

  // When exiting multi-select mode, preserve the first selected task as single selection
  if (wasMultiSelectMode && canvasStore.selectedNodeIds.length > 0) {
    const firstSelectedId = canvasStore.selectedNodeIds[0]
    canvasStore.setSelectedNodes([firstSelectedId])

    // Ensure Vue Flow nodes are updated
    nodes.value.forEach(node => {
      node.selected = node.id === firstSelectedId
    })
  }
}

const handleSelectionChange = (selectedIds: string[]) => {
  canvasStore.setSelectedNodes(selectedIds)
}

const handleBulkAction = (action: string, params: any) => {
  const { nodeIds } = params
  
  switch (action) {
    case 'updateStatus':
      nodeIds.forEach(nodeId => {
        const task = taskStore.tasks.find(t => t.id === nodeId)
        if (task) {
          taskStore.updateTaskWithUndo(nodeId, { status: params.status })
        }
      })
      break

    case 'updatePriority':
      nodeIds.forEach(nodeId => {
        const task = taskStore.tasks.find(t => t.id === nodeId)
        if (task) {
          taskStore.updateTaskWithUndo(nodeId, { priority: params.priority })
        }
      })
      break
      
    case 'delete':
      if (confirm(`Delete ${nodeIds.length} selected tasks?`)) {
        nodeIds.forEach(nodeId => {
          undoHistory.deleteTaskWithUndo(nodeId)
        })
        canvasStore.clearSelection()
      }
      break

    case 'duplicate':
      nodeIds.forEach(nodeId => {
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
  try {
    // Validate inputs
    if (!task || !task.id) {
      console.warn('handleTaskSelect: Invalid task data', task)
      return
    }

    if (multiSelect) {
      // In multi-select mode, preserve existing selection and toggle this task
      canvasStore.toggleNodeSelection(task.id)
    } else {
      // In single-select mode, clear all other selections and select only this task
      canvasStore.setSelectedNodes([task.id])
    }

    // Ensure selection state is immediately reflected in the nodes
    // Add safety checks for nodes array
    if (!nodes.value || !Array.isArray(nodes.value)) {
      console.warn('handleTaskSelect: nodes array is not available')
      return
    }

    const nodeIndex = nodes.value.findIndex(n => n && n.id === task.id)
    if (nodeIndex > -1 && nodes.value[nodeIndex]) {
      // Update the Vue Flow node selection state to match canvas store
      const isSelected = canvasStore.selectedNodeIds && canvasStore.selectedNodeIds.includes(task.id)
      if (nodes.value[nodeIndex].selected !== isSelected) {
        nodes.value[nodeIndex].selected = isSelected
      }
    }
  } catch (error) {
    console.error('Error in handleTaskSelect:', error)
    // Continue execution - don't let selection errors crash the canvas
  }
}

const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
  try {
    // Validate inputs
    if (!event || !task || !task.id) {
      console.warn('handleTaskContextMenu: Invalid inputs', { event, task })
      return
    }

    console.log('Task context menu:', task)
    // Emit custom event for App.vue to handle
    window.dispatchEvent(new CustomEvent('task-context-menu', {
      detail: { event, task }
    }))
  } catch (error) {
    console.error('Error in handleTaskContextMenu:', error)
    // Continue execution - don't let context menu errors crash the canvas
  }
}

// Initialize on mount
// Click outside handler for dropdowns
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.dropdown-container')) {
    showSectionTypeDropdown.value = false
  }
  if (!target.closest('.zoom-dropdown-container')) {
    showZoomDropdown.value = false
  }
}

onMounted(async () => {
  console.log('CanvasView mounted, tasks:', taskStore.tasks.length)
  await canvasStore.loadFromDatabase()
  syncNodes()
  canvasStore.initializeDefaultSections()
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('keydown', handleKeyDown, { capture: true })

  // Explicitly enforce zoom limits after Vue Flow initializes
  nextTick(() => {
    console.log('[Zoom Debug] Enforcing zoom limits after mount')

    // Get Vue Flow instance and enforce zoom configuration
    const { setMinZoom, setMaxZoom } = useVueFlow()
    if (setMinZoom && setMaxZoom) {
      setMinZoom(0.05)  // 5% minimum
      setMaxZoom(4.0)  // 400% maximum
      console.log('[Zoom Debug] Vue Flow zoom limits explicitly set to 5%-400%')
    }

    // Verify current zoom is within bounds
    const currentZoom = viewport.value.zoom
    if (currentZoom < 0.05 || currentZoom > 4.0) {
      console.log(`[Zoom Debug] Current zoom ${currentZoom} out of bounds, resetting to 100%`)
      vueFlowZoomTo(1.0, { duration: 0 })
    }

    // Double-enforce zoom limits after a delay to ensure Vue Flow respects them
    setTimeout(() => {
      const { setMinZoom: setMinZoomAgain, setMaxZoom: setMaxZoomAgain } = useVueFlow()
      if (setMinZoomAgain && setMaxZoomAgain) {
        setMinZoomAgain(0.05)
        setMaxZoomAgain(4.0)
        console.log('[Zoom Debug] Zoom limits re-enforced after delay')
      }

      // Auto-center viewport on tasks after Vue Flow is fully initialized
      // This prevents the canvas from starting in a blank area
      setTimeout(() => {
        if (nodes.value.length > 0) {
          console.log('[Canvas Init] Auto-centering viewport on tasks')
          fitView()
        } else {
          console.log('[Canvas Init] No nodes to center on, keeping default viewport')
        }
      }, 200)
    }, 1000)
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('keydown', handleKeyDown, { capture: true })
  zoomPerformanceManager.cleanup()
})

// Keyboard Deletion Test Function
const runKeyboardDeletionTest = async () => {
  if (isTestRunning.value) return

  isTestRunning.value = true
  testStatus.value = 'Starting comprehensive keyboard deletion test...'
  testResults.value = []

  try {
    // Test 1: Create a test task on canvas
    testStatus.value = 'Creating test task...'
    testResults.value.push({ status: 'running', message: 'Creating test task for deletion testing' })

    const testTaskData = {
      title: `Test Task ${Date.now()}`,
      description: 'Created for keyboard deletion testing',
      status: 'active' as const,
      canvasPosition: { x: 200, y: 200 }
    }

    const newTask = undoHistory.createTaskWithUndo(testTaskData)
    if (!newTask) {
      throw new Error('Failed to create test task')
    }

    await nextTick()
    testResults.value[0] = { status: 'passed', message: `Test task created: ${newTask.title}` }

    // Test 2: Test Delete operation (move to inbox)
    testStatus.value = 'Testing Delete operation (move to inbox)...'
    testResults.value.push({ status: 'running', message: 'Testing Delete key functionality' })

    const undoCountBefore = undoHistory.undoCount.value
    const canUndoBefore = undoHistory.canUndo.value

    undoHistory.updateTaskWithUndo(newTask.id, {
      canvasPosition: undefined,
      isInInbox: true,
      instances: [],
      scheduledDate: undefined,
      scheduledTime: undefined
    })

    await nextTick()

    const modifiedTask = taskStore.tasks.find(t => t.id === newTask.id)
    if (!modifiedTask || modifiedTask.canvasPosition !== undefined || !modifiedTask.isInInbox) {
      throw new Error('Task was not moved to inbox properly')
    }

    const undoCountAfter = undoHistory.undoCount.value
    const canUndoAfter = undoHistory.canUndo.value

    testResults.value[1] = {
      status: 'passed',
      message: `Delete operation successful - Undo count: ${undoCountBefore}→${undoCountAfter}`
    }

    // Test 3: Test Undo (restore to canvas)
    testStatus.value = 'Testing Undo operation...'
    testResults.value.push({ status: 'running', message: 'Testing Ctrl+Z functionality' })

    if (!undoHistory.canUndo.value) {
      throw new Error('Cannot undo - no undo history available')
    }

    const undoResult = await undoHistory.undo()
    await nextTick()

    if (!undoResult) {
      throw new Error('Undo operation returned false')
    }

    const restoredTask = taskStore.tasks.find(t => t.id === newTask.id)
    if (!restoredTask || !restoredTask.canvasPosition) {
      throw new Error('Task was not restored to canvas properly')
    }

    testResults.value[2] = {
      status: 'passed',
      message: `Undo operation successful - task restored to canvas`
    }

    // Test 4: Test Shift+Delete (permanent deletion)
    testStatus.value = 'Testing Shift+Delete operation...'
    testResults.value.push({ status: 'running', message: 'Testing Shift+Delete functionality' })

    const shiftUndoCountBefore = undoHistory.undoCount.value
    undoHistory.deleteTaskWithUndo(newTask.id)
    await nextTick()

    const deletedTask = taskStore.tasks.find(t => t.id === newTask.id)
    if (deletedTask) {
      throw new Error('Task was not permanently deleted')
    }

    const shiftUndoCountAfter = undoHistory.undoCount.value
    testResults.value[3] = {
      status: 'passed',
      message: `Shift+Delete successful - Undo count: ${shiftUndoCountBefore}→${shiftUndoCountAfter}`
    }

    // Test 5: Test Undo after permanent deletion
    testStatus.value = 'Testing Undo after Shift+Delete...'
    testResults.value.push({ status: 'running', message: 'Testing undo after permanent deletion' })

    if (!undoHistory.canUndo.value) {
      throw new Error('Cannot undo after permanent deletion')
    }

    const finalUndoResult = await undoHistory.undo()
    await nextTick()

    if (!finalUndoResult) {
      throw new Error('Final undo operation failed')
    }

    const finalTask = taskStore.tasks.find(t => t.id === newTask.id)
    if (!finalTask) {
      throw new Error('Task was not restored after permanent deletion undo')
    }

    testResults.value[4] = {
      status: 'passed',
      message: `Final undo successful - task restored after permanent deletion`
    }

    const passedTests = testResults.value.filter(r => r.status === 'passed').length
    testStatus.value = `✅ Test completed: ${passedTests}/${testResults.value.length} tests passed`

    console.log(`🎉 Keyboard deletion test completed: ${passedTests}/${testResults.value.length} tests passed`)

  } catch (error) {
    console.error('❌ Keyboard deletion test failed:', error)
    testResults.value.push({
      status: 'failed',
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    })
    testStatus.value = `❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  } finally {
    isTestRunning.value = false
  }
}
</script>

<style scoped>
.canvas-layout {
  display: flex;
  flex: 1;
  background: var(--surface-primary);
  overflow: visible; /* Allow controls to overflow at top */
}

.canvas-main {
  flex: 1;
  position: relative;
  overflow: visible; /* Allow controls to overflow at top */
}

.canvas-controls {
  position: absolute;
  top: var(--space-4);
  inset-inline-start: var(--space-4); /* LEFT side positioning */
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* Don't stretch control-groups */
  width: fit-content; /* Only as wide as content - no extra space */
  gap: 4px;
  background: var(--surface-primary);
  padding: var(--space-1); /* Minimal 4px padding */
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-medium);
  box-shadow: 0 4px 12px var(--shadow-strong);
}

.control-btn,
.dropdown-container {
  pointer-events: auto;
}

.control-group {
  display: flex;
  gap: 4px; /* RTL: reduced gap for compact layout */
  align-items: center;
  justify-content: flex-start; /* Force left alignment of buttons */
}

.control-group:not(:last-child) {
  padding-bottom: 4px; /* RTL: reduced padding for less dead space */
  border-bottom: 1px solid var(--border-secondary);
}

.control-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
}

.control-btn:hover {
  /* Outlined + Glass hover (not filled!) */
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow);
}

.control-btn.active {
  /* Outlined + Glass active (not filled!) */
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  box-shadow: var(--state-hover-glow);
}

.hide-done-toggle {
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2);
  border-radius: var(--radius-lg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-md);
  position: relative;
  z-index: 1000;
  pointer-events: auto;
  user-select: none;
  min-width: 40px;
  min-height: 40px;
}

.hide-done-toggle.icon-only {
  padding: var(--space-2);
  justify-content: center;
}

.hide-done-toggle:hover {
  background: linear-gradient(
    135deg,
    var(--state-hover-bg) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.hide-done-toggle.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.dropdown-container {
  position: relative;
}

.section-type-dropdown {
  position: absolute;
  top: calc(100% + var(--space-2));
  left: 0;
  background: var(--surface-primary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-2);
  min-width: 200px;
  z-index: 100;
}

.dropdown-section {
  padding: var(--space-2) 0;
}

.dropdown-section:not(:last-child) {
  border-bottom: 1px solid var(--border-secondary);
}

.dropdown-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: var(--space-2) var(--space-3);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  text-align: left;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.dropdown-item:hover {
  background: var(--bg-hover);
  transform: translateX(2px);
}

.dropdown-item.priority-high {
  color: var(--color-priority-high);
}

.dropdown-item.priority-medium {
  color: var(--color-priority-medium);
}

.dropdown-item.priority-low {
  color: var(--brand-primary);
}

.dropdown-item.status-planned {
  color: var(--brand-primary);
}

.dropdown-item.status-in_progress {
  color: var(--color-priority-medium);
}

.dropdown-item.status-done {
  color: var(--color-work);
}

.zoom-level {
  display: flex;
  align-items: center;
  padding: 0 var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: var(--font-medium);
  min-width: 45px;
  justify-content: center;
}

.zoom-dropdown-container {
  position: relative;
}

.zoom-dropdown {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  background: var(--surface-primary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-2);
  min-width: 120px;
  z-index: 100;
}

.zoom-preset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  text-align: center;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.zoom-preset-btn:hover {
  background: var(--bg-hover);
  transform: translateY(-1px);
}

.zoom-preset-btn.active {
  background: var(--brand-primary);
  color: white;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.zoom-divider {
  height: 1px;
  background: var(--border-secondary);
  margin: var(--space-2) 0;
}

.canvas-drop-zone {
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
</style>

<style>
/* Global Vue Flow theme overrides */
.vue-flow {
  background: var(--surface-primary);
  outline: none; /* Remove default outline, use custom focus-visible */
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

.vue-flow__edge {
  z-index: 5 !important;
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
}

.vue-flow__edge:hover .vue-flow__edge-path {
  stroke: var(--color-navigation);
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
.keyboard-test-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.keyboard-test-content {
  background: var(--surface-primary);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-lg);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
}

.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-subtle);
}

.test-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.close-btn {
  background: none;
  border: none;
  font-size: var(--text-lg);
  cursor: pointer;
  color: var(--text-secondary);
  padding: var(--spacing-xs);
  border-radius: var(--border-radius-sm);
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.test-controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.test-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-weight: var(--font-medium);
  transition: all 0.2s ease;
}

.test-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.test-btn.primary {
  background: var(--brand-primary);
  color: white;
}

.test-btn.primary:hover:not(:disabled) {
  background: var(--brand-primary-hover);
}

.test-status {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-align: center;
}

.test-results {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-xs);
  font-size: var(--text-sm);
}

.result-item.passed {
  background: rgba(34, 197, 94, 0.1);
  color: var(--text-success);
}

.result-item.failed {
  background: rgba(239, 68, 68, 0.1);
  color: var(--text-error);
}

.result-item.running {
  background: rgba(245, 158, 11, 0.1);
  color: var(--text-warning);
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

/* Vue Flow fade-in transition - fixes initialization deadlock */
.vue-flow {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.vue-flow.canvas-ready {
  opacity: 1;
}

</style>
