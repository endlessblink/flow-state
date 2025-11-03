<template>
  <div class="canvas-layout">
    <!-- Inbox Sidebar -->
    <InboxPanel />

    <!-- Main Canvas Area -->
    <div class="canvas-main">
      <!-- Canvas Controls -->
      <div class="canvas-controls">
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
          <button @click="canvasStore.togglePriorityIndicator" class="control-btn" :class="{ active: canvasStore.showPriorityIndicator }" title="Toggle Priority">
            <Flag :size="16" />
          </button>
          <button @click="canvasStore.toggleStatusBadge" class="control-btn" :class="{ active: canvasStore.showStatusBadge }" title="Toggle Status">
            <PlayCircle :size="16" />
          </button>
          <button @click="canvasStore.toggleDurationBadge" class="control-btn" :class="{ active: canvasStore.showDurationBadge }" title="Toggle Duration">
            <Clock :size="16" />
          </button>
          <button @click="canvasStore.toggleScheduleBadge" class="control-btn" :class="{ active: canvasStore.showScheduleBadge }" title="Toggle Schedule">
            <Calendar :size="16" />
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
        </div>
      </div>

       <!-- Vue Flow Canvas -->
      <div
        @drop="handleDrop"
        @dragover.prevent
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
          @node-drag-start="handleNodeDragStart"
          @node-drag-stop="handleNodeDragStop"
          @node-drag="handleNodeDrag"
          @nodes-change="handleNodesChange"
          @pane-click="handlePaneClick"
          @pane-context-menu="handlePaneContextMenu"
          @node-context-menu="handleNodeContextMenu"
          @edge-context-menu="handleEdgeContextMenu"
          @connect="handleConnect"
          @keydown="handleKeyDown"
          class="vue-flow-container"
          tabindex="0"
        >
        <!-- Background Grid -->
        <Background pattern-color="transparent" :gap="16" />

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
          <NodeResizer
            :min-width="200"
            :min-height="150"
            color="transparent"
          />
          <SectionNodeSimple
            :data="nodeProps.data"
            @update="handleSectionUpdate"
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

    <!-- Task Edit Modal -->
    <TaskEditModal
      :is-open="isEditModalOpen"
      :task="selectedTask"
      @close="closeEditModal"
    />

    <!-- Canvas Context Menu -->
    <CanvasContextMenu
      :is-visible="showCanvasContextMenu"
      :x="canvasContextMenuX"
      :y="canvasContextMenuY"
      :has-selected-tasks="canvasStore.selectedNodeIds.length > 0"
      :selected-count="canvasStore.selectedNodeIds.length"
      @close="closeCanvasContextMenu"
      @centerOnSelected="centerOnSelectedTasks"
      @fitAll="fitAllTasks"
      @resetZoom="resetZoom"
      @selectAll="selectAllTasks"
      @clearSelection="clearSelection"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, markRaw, onMounted, onBeforeUnmount } from 'vue'
import { VueFlow, useVueFlow, PanOnScrollMode } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { NodeResizer } from '@vue-flow/node-resizer'
import type { Node, Edge } from '@vue-flow/core'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import InboxPanel from '@/components/canvas/InboxPanel.vue'
import TaskNode from '@/components/canvas/TaskNode.vue'
import SectionNodeSimple from '@/components/canvas/SectionNodeSimple.vue'
import TaskEditModal from '@/components/TaskEditModal.vue'
import MultiSelectionOverlay from '@/components/canvas/MultiSelectionOverlay.vue'
import CanvasContextMenu from '@/components/canvas/CanvasContextMenu.vue'
import EdgeContextMenu from '@/components/canvas/EdgeContextMenu.vue'
import { Maximize, ZoomIn, ZoomOut, Grid3X3, Plus, Layout, CheckSquare, Flag, PlayCircle, Clock, Calendar, AlertTriangle, CheckCircle, Circle } from 'lucide-vue-next'

// Import Vue Flow styles
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'
import '@vue-flow/node-resizer/dist/style.css'

const taskStore = useTaskStore()
const canvasStore = useCanvasStore()

if (import.meta.env.DEV) {
  ;(window as any).__canvasStore = canvasStore
}

// Task Edit Modal state
const isEditModalOpen = ref(false)
const selectedTask = ref<Task | null>(null)

// Canvas Context Menu state
const showCanvasContextMenu = ref(false)
const canvasContextMenuX = ref(0)
const canvasContextMenuY = ref(0)

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

// Sections state
const showSections = ref(true)
const activeSectionId = ref<string | null>(null)
const showSectionTypeDropdown = ref(false)

// Computed properties
const sections = computed(() => canvasStore.sections)

// Register custom node types
const nodeTypes = markRaw({
  taskNode: TaskNode,
  sectionNode: SectionNodeSimple
})

// Get Vue Flow instance methods
const { fitView: vueFlowFitView, zoomIn: vueFlowZoomIn, zoomOut: vueFlowZoomOut, zoomTo: vueFlowZoomTo, viewport, getSelectedNodes } = useVueFlow()

// Derive nodes from tasks with canvas positions (use ref, sync with watch)
const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

// Sync nodes from store
const syncNodes = () => {
  const allNodes: Node[] = []

  // Add section nodes FIRST (so they render in background)
  canvasStore.sections.forEach(section => {
    allNodes.push({
      id: `section-${section.id}`,
      type: 'sectionNode',
      position: { x: section.position.x, y: section.position.y },
      style: {
        width: `${section.position.width}px`,
        height: `${section.position.height}px`,
        zIndex: 1
      },
      data: {
        id: section.id,
        name: section.name,
        color: section.color,
        type: section.type,
        propertyValue: section.propertyValue,
        taskCount: getTaskCountForSection(section.id)
      },
      draggable: true,
      selectable: true
    })
  })

  // Get all task IDs in collapsed sections for efficiency
  const collapsedSectionTaskIds = new Set<string>()
  canvasStore.sections.forEach(section => {
    if (section.isCollapsed) {
      const tasksInSection = canvasStore.getTasksInSection(section, taskStore.filteredTasks)
      tasksInSection.forEach(task => collapsedSectionTaskIds.add(task.id))
    }
  })

  // Add task nodes AFTER (so they render on top)
  taskStore.filteredTasks.forEach((task, index) => {
    // Skip tasks in collapsed sections
    if (collapsedSectionTaskIds.has(task.id)) return

    const position = task.canvasPosition || {
      x: 100 + (index % 5) * 250,
      y: 100 + Math.floor(index / 5) * 150
    }

    allNodes.push({
      id: task.id,
      type: 'taskNode',
      position,
      style: { zIndex: 10 },
      data: { task }
    })
  })

  nodes.value = allNodes
}

const getTaskCountForSection = (sectionId: string) => {
  const section = canvasStore.sections.find(s => s.id === sectionId)
  if (!section) return 0
  return canvasStore.getTasksInSection(section, taskStore.filteredTasks).length
}

// Sync edges from store
const syncEdges = () => {
  const allEdges: Edge[] = []

  taskStore.filteredTasks.forEach(task => {
    if (task.dependsOn && task.dependsOn.length > 0) {
      task.dependsOn.forEach(depId => {
        allEdges.push({
          id: `${depId}-${task.id}`,
          source: depId,
          target: task.id,
          type: task.connectionTypes?.[depId] || 'default',
          animated: false
        })
      })
    }
  })

  edges.value = allEdges
}

// Watch for task and section changes
watch(() => taskStore.filteredTasks, () => {
  syncNodes()
  syncEdges()
}, { deep: true, immediate: true })

watch(() => canvasStore.sections, () => {
  syncNodes()
}, { deep: true })

// Helper: Check if task is inside a section
const getContainingSection = (taskX: number, taskY: number, taskWidth: number = 220, taskHeight: number = 100) => {
  return canvasStore.sections.find(section => {
    const { x, y, width, height } = section.position
    const taskCenterX = taskX + taskWidth / 2
    const taskCenterY = taskY + taskHeight / 2

    return (
      taskCenterX >= x &&
      taskCenterX <= x + width &&
      taskCenterY >= y &&
      taskCenterY <= y + height
    )
  })
}

// Helper: Apply section properties to task
const applySectionPropertiesToTask = (taskId: string, section: any) => {
  if (!section.propertyValue) return

  const updates: any = {}

  switch (section.type) {
    case 'priority':
      updates.priority = section.propertyValue
      break
    case 'status':
      updates.status = section.propertyValue
      break
    case 'project':
      updates.projectId = section.propertyValue
      break
  }

  if (Object.keys(updates).length > 0) {
    taskStore.updateTask(taskId, updates)
  }
}

// Track initial positions for section dragging
let sectionDragStart: { sectionId: string; startPosition: { x: number; y: number }; containedTasks: any[] } | null = null

// Handle node drag start - track section position
const handleNodeDragStart = (event: any) => {
  const { node } = event
  
  if (node.id.startsWith('section-')) {
    const sectionId = node.id.replace('section-', '')
    const section = canvasStore.sections.find(s => s.id === sectionId)
    
    if (section) {
      // Get tasks currently inside this section
      const containedTasks = taskStore.filteredTasks.filter(task => {
        if (!task.canvasPosition) return false
        const { x, y, width, height } = section.position
        return task.canvasPosition.x >= x && 
               task.canvasPosition.x <= x + width &&
               task.canvasPosition.y >= y && 
               task.canvasPosition.y <= y + height
      })
      
      sectionDragStart = {
        sectionId,
        startPosition: { x: section.position.x, y: section.position.y },
        containedTasks
      }
    }
  }
}

// Handle node drag stop - save position and apply section properties
const handleNodeDragStop = (event: any) => {
  const { node } = event

  // Check if it's a section node or task node
  if (node.id.startsWith('section-')) {
    const sectionId = node.id.replace('section-', '')
    const section = canvasStore.sections.find(s => s.id === sectionId)
    
    if (section && sectionDragStart && sectionDragStart.sectionId === sectionId) {
      // Calculate movement delta
      const deltaX = node.position.x - sectionDragStart.startPosition.x
      const deltaY = node.position.y - sectionDragStart.startPosition.y
      
      // Update section position
      canvasStore.updateSection(sectionId, {
        position: {
          x: node.position.x,
          y: node.position.y,
          width: node.style?.width ? parseInt(node.style.width) : 300,
          height: node.style?.height ? parseInt(node.style.height) : 200
        }
      })
      
      // Move all contained tasks by the same delta
      sectionDragStart.containedTasks.forEach(task => {
        if (task.canvasPosition) {
          taskStore.updateTask(task.id, {
            canvasPosition: {
              x: task.canvasPosition.x + deltaX,
              y: task.canvasPosition.y + deltaY
            }
          })
        }
      })
      
      sectionDragStart = null
    }
  } else {
    // Save task position
    taskStore.updateTask(node.id, {
      canvasPosition: {
        x: node.position.x,
        y: node.position.y
      }
    })

    // Check if task is inside a smart section
    const containingSection = getContainingSection(node.position.x, node.position.y)

    if (containingSection && containingSection.type !== 'custom') {
      applySectionPropertiesToTask(node.id, containingSection)
    }
  }
}

// Handle node drag - provide real-time feedback and prevent drift
const handleNodeDrag = (event: any) => {
  const { node } = event
  
  // Only handle task nodes, not sections
  if (!node.id.startsWith('section-')) {
    // Real-time position updates can be added here if needed
    // For now, we rely on VueFlow's built-in drag handling
    // The snap-to-grid configuration should prevent drift
  }
}

// Handle nodes change (for selection tracking and resize)
const handleNodesChange = (changes: any) => {
  changes.forEach((change: any) => {
    // Track selection changes
    if (change.type === 'select') {
      const currentSelected = nodes.value.filter(n => n.selected).map(n => n.id)
      canvasStore.setSelectedNodes(currentSelected)
    }

    // Handle section resize
    if (change.type === 'dimensions' && change.id.startsWith('section-')) {
      const sectionId = change.id.replace('section-', '')
      const node = nodes.value.find(n => n.id === change.id)
      if (node && change.dimensions) {
        canvasStore.updateSection(sectionId, {
          position: {
            x: node.position.x,
            y: node.position.y,
            width: change.dimensions.width,
            height: change.dimensions.height
          }
        })
      }
    }
  })
}

// Handle pane click - clear selection
const handlePaneClick = () => {
  canvasStore.setSelectedNodes([])
  closeCanvasContextMenu()
  closeEdgeContextMenu()
  closeNodeContextMenu()
}

// Handle pane context menu (right-click)
const handlePaneContextMenu = (event: { event: MouseEvent }) => {
  event.event.preventDefault()
  canvasContextMenuX.value = event.event.clientX
  canvasContextMenuY.value = event.event.clientY
  showCanvasContextMenu.value = true
}

// Canvas context menu handlers
const closeCanvasContextMenu = () => {
  showCanvasContextMenu.value = false
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

const resetZoom = () => {
  vueFlowZoomTo(1, { duration: 200 })
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

// Node context menu handlers (for sections)
const handleNodeContextMenu = (event: { event: MouseEvent; node: any }) => {
  console.log('Node context menu triggered for:', event.node.id, event.node)
  
  // Only show context menu for section nodes
  if (!event.node.id.startsWith('section-')) {
    return
  }
  event.event.preventDefault()
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
    const tasksInSection = canvasStore.getTasksInSection(section, taskStore.filteredTasks)
    const confirmMessage = tasksInSection.length > 0 
      ? `Delete "${section.name}" section? It contains ${tasksInSection.length} task(s) that will be moved to the canvas.`
      : `Delete "${section.name}" section?`
    
    if (confirm(confirmMessage)) {
      canvasStore.deleteSection(sectionId)
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
    taskStore.updateTask(target, { dependsOn: updatedDependsOn })
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
    taskStore.updateTask(node.id, {
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
    taskStore.updateTask(node.id, {
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
    taskStore.updateTask(node.id, {
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
    taskStore.updateTask(node.id, {
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
    taskStore.updateTask(node.id, {
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
    taskStore.updateTask(node.id, {
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
    taskStore.updateTask(node.id, {
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
    taskStore.updateTask(node.id, {
      canvasPosition: { x: node.position.x, y: minY + (spacing * index) }
    })
  })

  closeCanvasContextMenu()
}

// Keyboard handler for Delete key
const handleKeyDown = (event: KeyboardEvent) => {
  const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace'
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

  console.log('Processing deletion for', selectedNodes.length, 'nodes:', selectedNodes.map(n => n.id))
  
  selectedNodes.forEach(node => {
    if (node.id.startsWith('section-')) {
      // Sections are always permanently deleted
      const sectionId = node.id.replace('section-', '')
      
      // Find section for confirmation
      const section = canvasStore.sections.find(s => s.id === sectionId)
      const confirmMessage = section && canvasStore.getTasksInSection(section, taskStore.filteredTasks).length > 0 
        ? `Delete "${section.name}" section? It contains ${canvasStore.getTasksInSection(section, taskStore.filteredTasks).length} task(s) that will be moved to the canvas.`
        : `Delete section?`
      
      if (confirm(confirmMessage)) {
        canvasStore.deleteSection(sectionId)
      }
    } else if (permanentDelete) {
      // Shift+Delete: Remove task from system entirely
      taskStore.deleteTask(node.id)
    } else {
      // Delete: Remove from canvas only, move back to inbox
      taskStore.updateTask(node.id, {
        canvasPosition: undefined,
        isInInbox: true
      })
    }
  })

  canvasStore.setSelectedNodes([])
  syncNodes() // Refresh VueFlow to show changes
}

// Handle connection creation - creates task dependency
const handleConnect = (connection: any) => {
  const { source, target } = connection

  // Don't allow connections to/from sections
  if (source.startsWith('section-') || target.startsWith('section-')) {
    return
  }

  // Don't allow self-connections
  if (source === target) {
    return
  }

  // Add dependency: target depends on source
  const targetTask = taskStore.tasks.find(t => t.id === target)
  if (targetTask) {
    const dependsOn = targetTask.dependsOn || []
    if (!dependsOn.includes(source)) {
      taskStore.updateTask(target, {
        dependsOn: [...dependsOn, source]
      })
      syncEdges() // Re-sync edges to show new connection
    }
  }
}

// Handle drop from inbox or board
const handleDrop = (event: DragEvent) => {
  event.preventDefault()

  const data = event.dataTransfer?.getData('application/json')
  if (!data) return

  const parsedData = JSON.parse(data)
  const { taskId, fromInbox, source } = parsedData

  if (fromInbox || source === 'board' || source === 'sidebar') {
    // Calculate drop position relative to canvas
    const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
    if (!vueFlowElement) return

    const rect = vueFlowElement.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Update task to position on canvas
    taskStore.updateTask(taskId, {
      canvasPosition: { x, y },
      isInInbox: false
    })
  }
}

// Canvas controls
const fitView = () => {
  vueFlowFitView({ padding: 0.2, duration: 300 })
}

const zoomIn = () => {
  vueFlowZoomIn({ duration: 200 })
}

const zoomOut = () => {
  vueFlowZoomOut({ duration: 200 })
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
  selectedTask.value = task
  isEditModalOpen.value = true
}

const closeEditModal = () => {
  isEditModalOpen.value = false
  selectedTask.value = null
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
    x: 100 + (existingCount * 50),
    y: 100 + (existingCount * 50)
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
  canvasStore.createPrioritySection('high', { x: 100, y: 100 })
}

const addInProgressSection = () => {
  canvasStore.createStatusSection('in_progress', { x: 450, y: 100 })
}

const addPlannedSection = () => {
  canvasStore.createStatusSection('planned', { x: 800, y: 100 })
}

const autoArrange = () => {
  // Add visual feedback
  const button = document.querySelector('[title="Auto Arrange"]') as HTMLButtonElement
  if (button) {
    button.style.background = 'var(--state-active-bg)'
    button.style.borderColor = 'var(--state-active-border)'
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="3" x2="21" y1="9" y2="9"></line><line x1="9" x2="9" y1="21" y2="9"></line></svg> Arranging...'
  }

  // Auto-arrange ALL tasks (not just in sections)
  const allTasks = taskStore.filteredTasks.filter(task => task.canvasPosition)
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
      
      taskStore.updateTask(task.id, {
        canvasPosition: { x, y },
        isInInbox: false
      })
    })
  })

  // Arrange unsectioned tasks in a grid
  unsectionedTasks.forEach((task, index) => {
    const cols = 4
    const x = 100 + (index % cols) * 250
    const y = 100 + Math.floor(index / cols) * 150
    
    taskStore.updateTask(task.id, {
      canvasPosition: { x, y },
      isInInbox: false
    })
  })

  // Reset button after delay
  setTimeout(() => {
    if (button) {
      button.style.background = ''
      button.style.borderColor = ''
      button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="3" x2="21" y1="9" y2="9"></line><line x1="9" x2="9" y1="21" y2="9"></line></svg>'
    }
  }, 1000)
}

const getTasksForSection = (section: any) => {
  const tasks = canvasStore.getTasksInSection(section, taskStore.filteredTasks)
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
  taskStore.updateTask(taskId, {
    canvasPosition: { x, y },
    isInInbox: false
  })
}

const handleSectionUpdate = (data: any) => {
  // Update section name when edited in SectionNodeSimple
  if (data.name) {
    const sectionId = data.id || activeSectionId.value
    if (sectionId) {
      canvasStore.updateSection(sectionId, { name: data.name })
      syncNodes() // Re-sync to update the node
    }
  }
}

const handleSectionActivate = (sectionId: string) => {
  activeSectionId.value = sectionId
  canvasStore.setActiveSection(sectionId)
}

const handleSectionContextMenu = (event: MouseEvent, section: any) => {
  // TODO: Implement section context menu
}

// Multi-selection handlers
const toggleMultiSelect = () => {
  canvasStore.toggleMultiSelectMode()
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
          taskStore.updateTask(nodeId, { status: params.status })
        }
      })
      break
      
    case 'updatePriority':
      nodeIds.forEach(nodeId => {
        const task = taskStore.tasks.find(t => t.id === nodeId)
        if (task) {
          taskStore.updateTask(nodeId, { priority: params.priority })
        }
      })
      break
      
    case 'delete':
      if (confirm(`Delete ${nodeIds.length} selected tasks?`)) {
        nodeIds.forEach(nodeId => {
          taskStore.deleteTask(nodeId)
        })
        canvasStore.clearSelection()
      }
      break
      
    case 'duplicate':
      nodeIds.forEach(nodeId => {
        const task = taskStore.tasks.find(t => t.id === nodeId)
        if (task) {
          taskStore.createTask({
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

// Task selection handlers
const handleTaskSelect = (task: Task, multiSelect: boolean) => {
  if (multiSelect) {
    canvasStore.toggleNodeSelection(task.id)
  } else {
    canvasStore.setSelectedNodes([task.id])
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
// Click outside handler for dropdown
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.dropdown-container')) {
    showSectionTypeDropdown.value = false
  }
}

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
})
</script>

<style scoped>
.canvas-layout {
  display: flex;
  height: 100vh;
  background: var(--surface-primary);
  overflow: hidden; /* NO window scrolling */
}

.canvas-main {
  flex: 1;
  position: relative;
  overflow: hidden; /* NO scrolling - only internal VueFlow pan */
}

.canvas-controls {
  position: absolute;
  top: 8px;
  right: var(--space-4);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: var(--bg-secondary);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  box-shadow: 0 4px 12px var(--shadow-strong);
}

.control-group {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.control-group:not(:last-child) {
  padding-bottom: var(--space-2);
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
}

.canvas-drop-zone {
  width: 100%;
  height: 100%;
  position: relative;
}

.vue-flow-container {
  width: 100%;
  height: 100%;
  overflow: hidden; /* Prevent scrollbars */
}
</style>

<style>
/* Global Vue Flow theme overrides */
.vue-flow {
  background: var(--surface-primary);
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

/* Z-index layering: sections < edges < tasks, with hover states */
.vue-flow__node[data-id^="section-"] {
  z-index: 1 !important;
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
  bottom: 20px !important;
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
}

.vue-flow__node.dragging {
  cursor: grabbing !important;
}
</style>
