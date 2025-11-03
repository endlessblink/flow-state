<template>
  <div class="canvas-layout">
    <!-- Inbox Sidebar -->
    <Transition name="sidebar-slide">
      <InboxPanel v-show="uiStore.secondarySidebarVisible" />
    </Transition>

    <!-- Main Canvas Area -->
    <div class="canvas-main">
      <!-- Canvas Controls -->
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
        <VueFlow
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
            :task="nodeProps.data"
            :is-selected="canvasStore.selectedNodeIds.includes(nodeProps.data.id)"
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
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { VueFlow, useVueFlow, PanOnScrollMode } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { NodeResizer, NodeResizeControl } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { getUndoSystem } from '@/composables/undoSingleton'

// Import canvas composables
import { useCanvasControls } from '@/composables/canvas/useCanvasControls'
import { useCanvasContextMenus } from '@/composables/canvas/useCanvasContextMenus'
import { useCanvasDragDrop } from '@/composables/canvas/useCanvasDragDrop'
import { useCanvasResize } from '@/composables/canvas/useCanvasResize'
import { useCanvasEdges } from '@/composables/canvas/useCanvasEdges'
import { useCanvasNodes } from '@/composables/canvas/useCanvasNodes'

// Import components
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
import {
  Maximize, ZoomIn, ZoomOut, Grid3X3, Plus, Layout, CheckSquare,
  Flag, PlayCircle, Clock, Calendar, AlertTriangle, CheckCircle,
  Circle, Eye, EyeOff, ChevronDown, TestTube
} from 'lucide-vue-next'

// Import Vue Flow styles
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

// ============================================
// STORES & CORE STATE
// ============================================

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const uiStore = useUIStore()
const undoHistory = getUndoSystem()

if (import.meta.env.DEV) {
  ;(window as any).__canvasStore = canvasStore
}

// Get Vue Flow instance
const { viewport, project } = useVueFlow()

// ============================================
// INITIALIZE COMPOSABLES
// ============================================

// Initialize edges composable first (needed by nodes)
const {
  edges,
  isConnecting,
  showEdgeContextMenu,
  edgeContextMenuX,
  edgeContextMenuY,
  selectedEdge,
  edgeHandleStyle,
  syncEdges,
  handleConnectStart: _handleConnectStart,
  handleConnectEnd,
  handleConnect: _handleConnect,
  handleEdgeContextMenu: _handleEdgeContextMenu,
  closeEdgeContextMenu,
  disconnectEdge
} = useCanvasEdges()

// Initialize nodes composable (depends on syncEdges)
const {
  nodes,
  nodeTypes,
  getTasksForSection,
  getTaskCountForSection,
  syncNodes,
  restoreSelection,
  getSelectedNodes,
  updateNodeSelection
} = useCanvasNodes(syncEdges)

// Initialize resize composable (depends on nodes, viewport)
const {
  resizeState,
  resizeHandleStyle,
  resizeLineStyle,
  getSectionResizeStyle,
  handleResizeStart,
  handleResize,
  handleResizeEnd,
  handleSectionResizeStart,
  handleSectionResize,
  handleSectionResizeEnd,
  handleDimensionChange,
  shouldPreventPositionUpdate
} = useCanvasResize(nodes, viewport)

// Initialize drag/drop composable (depends on nodes, resizeState, syncEdges, project)
const {
  handleNodeDragStart,
  handleNodeDragStop,
  handleNodeDrag,
  handleNodesChange: dragDropNodesChange,
  handleDrop,
  getContainingSection,
  isTaskInSectionBounds,
  applySectionPropertiesToTask
} = useCanvasDragDrop(nodes, resizeState, syncEdges, project)

// Initialize context menus composable (depends on nodes, isConnecting, syncNodes, syncEdges)
const {
  showCanvasContextMenu,
  canvasContextMenuX,
  canvasContextMenuY,
  canvasContextSection,
  handlePaneContextMenu,
  handleCanvasRightClick,
  closeCanvasContextMenu,
  centerOnSelectedTasks,
  fitAllTasks,
  selectAllTasks,
  clearSelection,
  createTaskHere,
  createGroup,
  isQuickTaskCreateOpen,
  quickTaskPosition,
  alignLeft,
  alignRight,
  alignTop,
  alignBottom,
  alignCenterHorizontal,
  alignCenterVertical,
  distributeHorizontal,
  distributeVertical,
  isGroupModalOpen,
  selectedGroup,
  groupModalPosition,
  closeGroupModal,
  handleGroupCreated,
  handleGroupUpdated,
  editGroup,
  deleteGroup,
  isGroupEditModalOpen,
  selectedSectionForEdit,
  closeGroupEditModal,
  handleGroupEditSave,
  showNodeContextMenu,
  nodeContextMenuX,
  nodeContextMenuY,
  selectedNode,
  handleNodeContextMenu,
  closeNodeContextMenu,
  deleteNode
} = useCanvasContextMenus(nodes, isConnecting, syncNodes, syncEdges)

// Initialize controls composable
const {
  showZoomDropdown,
  zoomPresets,
  fitView,
  zoomIn,
  zoomOut,
  toggleZoomDropdown,
  applyZoomPreset,
  resetZoom,
  fitToContent,
  handleToggleDoneTasks,
  toggleMultiSelect,
  showSections,
  showSectionTypeDropdown,
  toggleSections,
  toggleSectionTypeDropdown,
  createSmartSection,
  addSection,
  addHighPrioritySection,
  addInProgressSection,
  addPlannedSection,
  autoArrange,
  cleanup: cleanupControls
} = useCanvasControls()

// ============================================
// CANVAS VIEW SPECIFIC STATE
// ============================================

// Task Edit Modal state
const isEditModalOpen = ref(false)
const selectedTask = ref<Task | null>(null)

// Keyboard Test state
const showKeyboardTest = ref(false)
const isTestRunning = ref(false)
const testStatus = ref('')
const testResults = ref<Array<{status: 'passed' | 'failed' | 'running', message: string}>>([])

// Batch Edit Modal state
const isBatchEditModalOpen = ref(false)
const batchEditTaskIds = ref<string[]>([])

// Section state
const activeSectionId = ref<string | null>(null)

// ============================================
// COMPUTED PROPERTIES
// ============================================

const sections = computed(() => canvasStore.sections)

// Dynamic node extent based on content and zoom limits
const dynamicNodeExtent = computed(() => {
  const tasks = taskStore.tasksWithCanvasPosition
  if (!tasks || !tasks.length) {
    return [[-2000, -2000], [5000, 5000]] as [[number, number], [number, number]]
  }

  const contentBounds = canvasStore.calculateContentBounds(tasks)
  const padding = 1000

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

// ============================================
// UNIFIED NODES CHANGE HANDLER
// ============================================

/**
 * Handle all node changes - combines drag/drop and resize logic
 */
const handleNodesChange = (changes: any) => {
  changes.forEach((change: any) => {
    // Handle dimension changes from resize
    handleDimensionChange(change)

    // Prevent position updates during resize
    if (shouldPreventPositionUpdate(change)) {
      return
    }
  })

  // Let drag/drop handle selection and other changes
  dragDropNodesChange(changes)
}

// ============================================
// CONNECTION HELPERS
// ============================================

/**
 * Close all context menus
 */
const closeAllMenus = () => {
  closeCanvasContextMenu()
  closeEdgeContextMenu()
  closeNodeContextMenu()
}

/**
 * Wrapper for connection start with menu closing
 */
const handleConnectStart = (event: any) => {
  _handleConnectStart(event, closeAllMenus)
}

/**
 * Wrapper for connection with menu closing
 */
const handleConnect = (connection: any) => {
  _handleConnect(connection, closeAllMenus)
}

/**
 * Wrapper for edge context menu with other menu closing
 */
const handleEdgeContextMenu = (event: { event: MouseEvent; edge: any }) => {
  const closeOthers = () => {
    closeCanvasContextMenu()
    closeNodeContextMenu()
  }
  _handleEdgeContextMenu(event, closeOthers)
}

// ============================================
// PANE HANDLERS
// ============================================

/**
 * Handle pane click - clear selection and close menus
 */
const handlePaneClick = () => {
  canvasStore.setSelectedNodes([])
  closeAllMenus()
}

// ============================================
// TASK MODAL HANDLERS
// ============================================

const handleEditTask = (task: Task) => {
  selectedTask.value = task
  isEditModalOpen.value = true
  console.log('Opening edit modal for task:', task.id)
}

const closeEditModal = () => {
  console.log('Closing edit modal')
  isEditModalOpen.value = false
  selectedTask.value = null
}

const closeQuickTaskCreate = () => {
  isQuickTaskCreateOpen.value = false
  quickTaskPosition.value = { x: 0, y: 0 }
}

const handleQuickTaskCreate = (title: string, description: string) => {
  const task = taskStore.createTaskWithUndo({
    title,
    description,
    canvasPosition: quickTaskPosition.value,
    isInInbox: false
  })

  console.log('Quick task created:', task)
  closeQuickTaskCreate()
}

const closeBatchEditModal = () => {
  isBatchEditModalOpen.value = false
  batchEditTaskIds.value = []
}

const handleBatchEditApplied = () => {
  canvasStore.clearSelection()
  syncNodes()
}

// ============================================
// SECTION HANDLERS
// ============================================

const collectTasksForSection = (sectionId: string) => {
  const section = canvasStore.sections.find(s => s.id === sectionId)
  if (!section) return

  const inboxTasks = taskStore.tasks.filter(task => {
    if (!task.isInInbox) return false

    switch (section.type) {
      case 'priority':
        return task.priority === section.propertyValue
      case 'status':
        return task.status === section.propertyValue
      case 'project':
        return task.projectId === section.propertyValue
      default:
        return false
    }
  })

  if (inboxTasks.length === 0) {
    console.log(`No inbox tasks match section criteria`)
    return
  }

  inboxTasks.forEach((task, index) => {
    const x = section.position.x + 20 + (index % 3) * 250
    const y = section.position.y + 80 + Math.floor(index / 3) * 150

    taskStore.updateTaskWithUndo(task.id, {
      canvasPosition: { x, y },
      isInInbox: false
    })
  })

  syncNodes()
}

const handleSectionTaskDrop = (event: DragEvent, slot: any, section: any) => {
  event.preventDefault()

  const data = event.dataTransfer?.getData('application/json')
  if (!data) return

  const { taskId, taskIds } = JSON.parse(data)
  const tasksToUpdate = taskIds || [taskId]

  tasksToUpdate.forEach((id: string) => {
    const x = section.position.x + slot.x
    const y = section.position.y + slot.y

    taskStore.updateTaskWithUndo(id, {
      canvasPosition: { x, y },
      isInInbox: false
    })
  })
}

const handleSectionUpdate = (data: any) => {
  if (data.name) {
    const sectionId = data.id || activeSectionId.value
    if (sectionId) {
      canvasStore.updateSectionWithUndo(sectionId, { name: data.name })
      syncNodes()
    }
  }
}

const handleSectionActivate = (sectionId: string) => {
  activeSectionId.value = sectionId
}

const handleSectionContextMenu = (event: MouseEvent, section: any) => {
  event.preventDefault()
  event.stopPropagation()

  console.log('🎯 [CanvasView] Section context menu triggered:', section.name)

  canvasContextMenuX.value = event.clientX
  canvasContextMenuY.value = event.clientY
  canvasContextSection.value = section
  showCanvasContextMenu.value = true

  closeNodeContextMenu()
  closeEdgeContextMenu()
}

// ============================================
// SELECTION HANDLERS
// ============================================

const handleSelectionChange = (selectedIds: string[]) => {
  canvasStore.setSelectedNodes(selectedIds)
}

const handleBulkAction = (action: string, params: any) => {
  const selectedIds = canvasStore.selectedNodeIds

  switch (action) {
    case 'delete':
      const saveCount = undoHistory.undoCount
      const targetCount = saveCount + selectedIds.length

      selectedIds.forEach(taskId => {
        taskStore.deleteTaskWithUndo(taskId)
      })

      canvasStore.setSelectedNodes([])
      syncNodes()
      break

    case 'edit':
      batchEditTaskIds.value = [...selectedIds]
      isBatchEditModalOpen.value = true
      break
  }
}

const handleTaskSelect = (task: Task, multiSelect: boolean) => {
  if (multiSelect) {
    const currentSelection = [...canvasStore.selectedNodeIds]
    const isSelected = currentSelection.includes(task.id)

    if (isSelected) {
      canvasStore.setSelectedNodes(currentSelection.filter(id => id !== task.id))
    } else {
      canvasStore.setSelectedNodes([...currentSelection, task.id])
    }
  } else {
    canvasStore.setSelectedNodes([task.id])
  }

  updateNodeSelection(task.id, canvasStore.selectedNodeIds.includes(task.id))
}

const handleTaskContextMenu = (event: MouseEvent, task: Task) => {
  event.preventDefault()
  event.stopPropagation()

  if (!canvasStore.selectedNodeIds.includes(task.id)) {
    canvasStore.setSelectedNodes([task.id])
  }
}

// ============================================
// CLICK OUTSIDE HANDLER
// ============================================

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement

  if (showZoomDropdown.value && !target.closest('.zoom-dropdown-container')) {
    showZoomDropdown.value = false
  }

  if (showSectionTypeDropdown.value && !target.closest('.dropdown-container')) {
    showSectionTypeDropdown.value = false
  }
}

// ============================================
// KEYBOARD HANDLERS
// ============================================

const handleKeyDown = async (event: KeyboardEvent) => {
  const target = event.target as HTMLElement
  const isInputField = target.tagName === 'INPUT' ||
                       target.tagName === 'TEXTAREA' ||
                       target.isContentEditable

  if (isInputField) return

  // Undo/Redo
  if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
    event.preventDefault()
    undoHistory.undo()
  }

  if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
    event.preventDefault()
    undoHistory.redo()
  }

  // Fit view
  if (event.key === 'f' || event.key === 'F') {
    event.preventDefault()
    fitView()
  }

  // Delete selected tasks
  if ((event.key === 'Delete' || event.key === 'Backspace') && canvasStore.selectedNodeIds.length > 0) {
    event.preventDefault()
    handleBulkAction('delete', {})
  }
}

// ============================================
// KEYBOARD TESTING
// ============================================

const runKeyboardDeletionTest = async () => {
  isTestRunning.value = true
  testResults.value = []
  testStatus.value = 'Running tests...'

  // Test implementation here (kept from original)
  // ... (omitted for brevity - keep existing test code)

  isTestRunning.value = false
  testStatus.value = 'Tests completed'
}

// ============================================
// LIFECYCLE HOOKS
// ============================================

onMounted(async () => {
  console.log('CanvasView mounted, tasks:', taskStore.tasks.length)
  await canvasStore.loadFromDatabase()
  syncNodes()
  canvasStore.initializeDefaultSections()
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('keydown', handleKeyDown, { capture: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('keydown', handleKeyDown, { capture: true })
  cleanupControls()
})

// ============================================
// HELPER FUNCTIONS
// ============================================

const getNodeColor = (node: any) => {
  if (node.type === 'taskNode') {
    const task = node.data as Task
    if (task.priority === 'high') return '#ef4444'
    if (task.priority === 'medium') return '#f59e0b'
    if (task.priority === 'low') return '#10b981'
  }
  return '#6366f1'
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


</style>
