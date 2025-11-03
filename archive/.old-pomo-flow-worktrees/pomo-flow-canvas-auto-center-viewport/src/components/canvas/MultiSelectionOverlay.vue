<template>
  <div class="multi-selection-overlay" v-if="multiSelectMode || selectionRect">
    <!-- Selection Rectangle -->
    <div
      v-if="selectionRect && isSelecting"
      class="selection-rectangle"
      :style="selectionRectStyle"
    ></div>

    <!-- Selection Controls -->
    <div v-if="multiSelectMode" class="selection-controls">
      <div class="control-group">
        <span class="control-label">Selection Mode:</span>
        <button
          v-for="mode in selectionModes"
          :key="mode.value"
          @click="setSelectionMode(mode.value)"
          class="mode-btn"
          :class="{ active: selectionMode === mode.value }"
          :title="mode.description"
        >
          <component :is="mode.icon" :size="14" />
          <span>{{ mode.label }}</span>
        </button>
      </div>

      <div class="control-group">
        <span class="control-label">Quick Actions:</span>
        <button @click="selectAll" class="action-btn" title="Select All">
          <CheckSquare :size="14" />
        </button>
        <button @click="clearSelection" class="action-btn" title="Clear Selection">
          <X :size="14" />
        </button>
        <button @click="invertSelection" class="action-btn" title="Invert Selection">
          <RotateCcw :size="14" />
        </button>
      </div>

      <div v-if="selectedCount > 0" class="selection-info">
        <span class="selected-count">{{ selectedCount }} selected</span>
        
        <div class="bulk-actions">
          <button @click="showBulkMenu = !showBulkMenu" class="bulk-menu-btn">
            <MoreHorizontal :size="14" />
            Bulk Actions
          </button>
          
          <div v-if="showBulkMenu" class="bulk-menu">
            <div class="bulk-menu-section">
              <span class="bulk-menu-title">Status</span>
              <button @click="bulkUpdateStatus('planned')" class="bulk-menu-item">Planned</button>
              <button @click="bulkUpdateStatus('in_progress')" class="bulk-menu-item">In Progress</button>
              <button @click="bulkUpdateStatus('done')" class="bulk-menu-item">Done</button>
              <button @click="bulkUpdateStatus('backlog')" class="bulk-menu-item">Backlog</button>
            </div>
            
            <div class="bulk-menu-section">
              <span class="bulk-menu-title">Priority</span>
              <button @click="bulkUpdatePriority('high')" class="bulk-menu-item priority-high">High</button>
              <button @click="bulkUpdatePriority('medium')" class="bulk-menu-item priority-medium">Medium</button>
              <button @click="bulkUpdatePriority('low')" class="bulk-menu-item priority-low">Low</button>
            </div>
            
            <div class="bulk-menu-section">
              <span class="bulk-menu-title">Actions</span>
              <button @click="bulkDelete" class="bulk-menu-item danger">Delete</button>
              <button @click="bulkDuplicate" class="bulk-menu-item">Duplicate</button>
              <button @click="bulkMoveToSection" class="bulk-menu-item">Move to Section</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Selection Handles (for selected nodes) -->
    <div v-if="selectedNodes.length > 0" class="selection-handles">
      <div
        v-for="node in selectedNodes"
        :key="node.id"
        class="node-selection-handle"
        :style="getNodeHandleStyle(node)"
      >
        <div class="handle-corner top-left"></div>
        <div class="handle-corner top-right"></div>
        <div class="handle-corner bottom-left"></div>
        <div class="handle-corner bottom-right"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  Square, 
  MousePointer, 
  Zap, 
  CheckSquare, 
  X, 
  RotateCcw, 
  MoreHorizontal 
} from 'lucide-vue-next'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import type { Node } from '@vue-flow/core'

interface Props {
  nodes: Node[]
  selectedNodeIds: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  selectionChange: [selectedIds: string[]]
  bulkAction: [action: string, params: any]
}>()

const canvasStore = useCanvasStore()
const taskStore = useTaskStore()

const showBulkMenu = ref(false)
const isSelecting = ref(false)
const selectionStart = ref({ x: 0, y: 0 })

const selectionModes = [
  { value: 'rectangle', label: 'Rectangle', icon: Square, description: 'Drag to select rectangular area' },
  { value: 'click', label: 'Click', icon: MousePointer, description: 'Click to select/deselect nodes' },
  { value: 'lasso', label: 'Lasso', icon: Zap, description: 'Draw freeform selection' }
]

// Computed properties
const multiSelectMode = computed(() => canvasStore.multiSelectMode)
const selectionMode = computed(() => canvasStore.selectionMode)
const selectionRect = computed(() => canvasStore.selectionRect)
const selectedCount = computed(() => props.selectedNodeIds.length)

const selectedNodes = computed(() => 
  props.nodes.filter(node => props.selectedNodeIds.includes(node.id))
)

const selectionRectStyle = computed(() => {
  if (!selectionRect.value) return {}
  
  return {
    left: `${selectionRect.value.x}px`,
    top: `${selectionRect.value.y}px`,
    width: `${selectionRect.value.width}px`,
    height: `${selectionRect.value.height}px`
  }
})

// Methods
const setSelectionMode = (mode: 'rectangle' | 'lasso' | 'click') => {
  canvasStore.setSelectionMode(mode)
}

const selectAll = () => {
  const allIds = props.nodes.map(node => node.id)
  canvasStore.setSelectedNodes(allIds)
  emit('selectionChange', allIds)
}

const clearSelection = () => {
  canvasStore.clearSelection()
  emit('selectionChange', [])
}

const invertSelection = () => {
  const allIds = props.nodes.map(node => node.id)
  const currentSelected = props.selectedNodeIds
  const inverted = allIds.filter(id => !currentSelected.includes(id))
  canvasStore.setSelectedNodes(inverted)
  emit('selectionChange', inverted)
}

const bulkUpdateStatus = (status: any) => {
  emit('bulkAction', 'updateStatus', { 
    nodeIds: props.selectedNodeIds, 
    status 
  })
  showBulkMenu.value = false
}

const bulkUpdatePriority = (priority: any) => {
  emit('bulkAction', 'updatePriority', { 
    nodeIds: props.selectedNodeIds, 
    priority 
  })
  showBulkMenu.value = false
}

const bulkDelete = () => {
  if (confirm(`Delete ${selectedCount.value} selected tasks?`)) {
    emit('bulkAction', 'delete', { nodeIds: props.selectedNodeIds })
    showBulkMenu.value = false
  }
}

const bulkDuplicate = () => {
  emit('bulkAction', 'duplicate', { nodeIds: props.selectedNodeIds })
  showBulkMenu.value = false
}

const bulkMoveToSection = () => {
  emit('bulkAction', 'moveToSection', { nodeIds: props.selectedNodeIds })
  showBulkMenu.value = false
}

const getNodeHandleStyle = (node: Node) => ({
  left: `${node.position.x - 5}px`,
  top: `${node.position.y - 5}px`,
  width: '210px',
  height: '90px'
})

// Mouse event handlers for selection
const handleMouseDown = (event: MouseEvent) => {
  if (!multiSelectMode.value || selectionMode.value !== 'rectangle') return
  
  isSelecting.value = true
  selectionStart.value = { x: event.clientX, y: event.clientY }
  canvasStore.startSelection(event.clientX, event.clientY)
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isSelecting.value) return
  
  canvasStore.updateSelection(event.clientX, event.clientY)
}

const handleMouseUp = () => {
  if (!isSelecting.value) return
  
  isSelecting.value = false
  canvasStore.endSelection()
  
  // Select nodes within the selection rectangle
  if (selectionRect.value) {
    canvasStore.selectNodesInRect(selectionRect.value, props.nodes)
    emit('selectionChange', canvasStore.selectedNodeIds)
  }
  
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// Close bulk menu when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (showBulkMenu.value && !(event.target as HTMLElement).closest('.bulk-actions')) {
    showBulkMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleMouseDown)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<style scoped>
.multi-selection-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1000;
}

.selection-rectangle {
  position: absolute;
  border: 2px solid var(--purple-border-active);
  background: var(--purple-bg-subtle);
  pointer-events: none;
  animation: selectionPulse 1.5s ease-in-out infinite;
}

@keyframes selectionPulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 0.4; }
}

.selection-controls {
  position: absolute;
  top: var(--space-4);
  left: var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  box-shadow: 0 4px 12px var(--shadow-strong);
  pointer-events: auto;
  min-width: 300px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.control-group:last-child {
  margin-bottom: 0;
}

.control-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  min-width: 80px;
}

.mode-btn,
.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--surface-primary);
  border: 1px solid var(--border-secondary);
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.mode-btn:hover,
.action-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}

.mode-btn.active {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: white;
}

.selection-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-secondary);
}

.selected-count {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.bulk-actions {
  position: relative;
}

.bulk-menu-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--brand-primary);
  border: none;
  color: white;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.bulk-menu-btn:hover {
  background: var(--brand-primary-hover);
}

.bulk-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--space-1);
  background: var(--surface-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px var(--shadow-strong);
  min-width: 150px;
  z-index: 1001;
}

.bulk-menu-section {
  padding: var(--space-2);
}

.bulk-menu-section:not(:last-child) {
  border-bottom: 1px solid var(--border-secondary);
}

.bulk-menu-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-1);
  display: block;
}

.bulk-menu-item {
  display: block;
  width: 100%;
  background: none;
  border: none;
  color: var(--text-primary);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
}

.bulk-menu-item:hover {
  background: var(--bg-hover);
}

.bulk-menu-item.priority-high {
  color: var(--color-danger);
}

.bulk-menu-item.priority-medium {
  color: var(--color-work);
}

.bulk-menu-item.priority-low {
  color: var(--brand-primary);
}

.bulk-menu-item.danger {
  color: var(--color-danger);
}

.bulk-menu-item.danger:hover {
  background: var(--danger-bg-light);
}

.selection-handles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.node-selection-handle {
  position: absolute;
  border: 2px solid var(--brand-primary);
  border-radius: var(--radius-md);
  pointer-events: none;
  animation: handleGlow 2s ease-in-out infinite;
}

@keyframes handleGlow {
  0%, 100% { 
    border-color: var(--brand-primary);
    box-shadow: 0 0 0 1px var(--purple-border-medium);
  }
  50% { 
    border-color: var(--brand-primary-light);
    box-shadow: 0 0 0 3px var(--purple-border-subtle);
  }
}

.handle-corner {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--brand-primary);
  border: 2px solid white;
  border-radius: var(--radius-xs);
}

.handle-corner.top-left {
  top: -4px;
  left: -4px;
}

.handle-corner.top-right {
  top: -4px;
  right: -4px;
}

.handle-corner.bottom-left {
  bottom: -4px;
  left: -4px;
}

.handle-corner.bottom-right {
  bottom: -4px;
  right: -4px;
}
</style>