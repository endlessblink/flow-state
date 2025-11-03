<template>
  <div
    v-if="section.isVisible"
    class="canvas-section"
    :class="{
      'section-collapsed': section.isCollapsed,
      'section-active': isActive,
      'section-dragging': isDragging
    }"
    :style="sectionStyle"
    @mousedown="handleMouseDown"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Section Header -->
    <div class="section-header" :style="headerStyle">
      <div class="section-title">
        <div class="section-color-indicator" :style="{ backgroundColor: section.color }"></div>
        <span class="section-name">{{ section.name }}</span>
        <div class="section-count">{{ taskCount }}</div>
      </div>
      
      <div class="section-controls">
        <button 
          @click.stop="toggleCollapse"
          class="control-btn"
          :title="section.isCollapsed ? 'Expand' : 'Collapse'"
        >
          <ChevronDown v-if="!section.isCollapsed" :size="14" />
          <ChevronRight v-else :size="14" />
        </button>
        <button 
          @click.stop="toggleVisibility"
          class="control-btn"
          title="Toggle Visibility"
        >
          <Eye :size="14" />
        </button>
        <button 
          @click.stop="startResize"
          class="control-btn"
          title="Resize Section"
        >
          <Maximize2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Section Content -->
    <div v-if="!section.isCollapsed" class="section-content">
      <!-- Drop Zone -->
      <div 
        v-if="tasks.length === 0"
        class="section-drop-zone"
        @drop="handleDrop"
        @dragover.prevent
      >
        <div class="drop-zone-hint">
          <Archive :size="24" />
          <span>Drop tasks here</span>
        </div>
      </div>

      <!-- Task Slots Grid -->
      <div v-else class="section-grid" :class="`layout-${section.layout}`">
        <div
          v-for="slot in taskSlots"
          :key="slot.id"
          class="task-slot"
          :class="{ 'slot-occupied': slot.task }"
          @drop="handleSlotDrop($event, slot)"
          @dragover.prevent
        >
          <div v-if="slot.task" class="slot-task-preview">
            <div class="slot-task-title">{{ slot.task.title }}</div>
            <div class="slot-task-meta">
              <span class="priority-badge" :class="slot.task.priority">{{ slot.task.priority }}</span>
              <span v-if="slot.task.estimatedDuration" class="duration">{{ slot.task.estimatedDuration }}m</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Resize Handle -->
    <div
      v-if="!section.isCollapsed && isResizing"
      class="resize-handle"
      @mousedown="startResize"
    ></div>

    <!-- Section Guides (when active) -->
    <div v-if="isActive && showSectionGuides" class="section-guides">
      <div class="guide-top"></div>
      <div class="guide-right"></div>
      <div class="guide-bottom"></div>
      <div class="guide-left"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ChevronDown, ChevronRight, Eye, Maximize2, Archive } from 'lucide-vue-next'
import type { CanvasSection, SectionFilter } from '@/stores/canvas'
import type { Task } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

interface Props {
  section: CanvasSection
  tasks: Task[]
  isActive?: boolean
  showSectionGuides?: boolean
}

interface TaskSlot {
  id: string
  task?: Task
  position: { x: number; y: number }
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  showSectionGuides: true
})

const emit = defineEmits<{
  taskDrop: [event: DragEvent, slot: TaskSlot, section: CanvasSection]
  sectionUpdate: [section: CanvasSection]
  sectionActivate: [sectionId: string]
  sectionContextMenu: [event: MouseEvent, section: CanvasSection]
}>()

const canvasStore = useCanvasStore()

const isDragging = ref(false)
const isResizing = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const originalPosition = ref({ x: 0, y: 0, width: 0, height: 0 })

// Computed properties
const sectionStyle = computed(() => ({
  left: `${props.section.position.x}px`,
  top: `${props.section.position.y}px`,
  width: `${props.section.position.width}px`,
  height: props.section.isCollapsed ? 'auto' : `${props.section.position.height}px`,
  borderColor: props.section.color + '40',
  backgroundColor: props.section.color + '08'
}))

const headerStyle = computed(() => ({
  backgroundColor: props.section.color + '20',
  borderColor: props.section.color + '40'
}))

const taskCount = computed(() => props.tasks.length)

const taskSlots = computed(() => {
  const slots: TaskSlot[] = []
  const { layout } = props.section
  
  if (layout === 'vertical') {
    const cols = Math.floor(props.section.position.width / 200)
    props.tasks.forEach((task, index) => {
      slots.push({
        id: `slot-${index}`,
        task,
        position: {
          x: (index % cols) * 200,
          y: Math.floor(index / cols) * 80
        }
      })
    })
  } else if (layout === 'horizontal') {
    const rows = Math.floor(props.section.position.height / 80)
    props.tasks.forEach((task, index) => {
      slots.push({
        id: `slot-${index}`,
        task,
        position: {
          x: Math.floor(index / rows) * 200,
          y: (index % rows) * 80
        }
      })
    })
  } else {
    // Grid layout
    const cols = Math.floor(props.section.position.width / 200)
    props.tasks.forEach((task, index) => {
      slots.push({
        id: `slot-${index}`,
        task,
        position: {
          x: (index % cols) * 200,
          y: Math.floor(index / cols) * 80
        }
      })
    })
  }
  
  return slots
})

// Methods
const handleMouseDown = (event: MouseEvent) => {
  if (event.target instanceof HTMLElement && event.target.closest('.section-controls')) {
    return
  }
  
  isDragging.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  originalPosition.value = { ...props.section.position }
  
  emit('sectionActivate', props.section.id)
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  event.preventDefault()
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value && !isResizing.value) return
  
  const deltaX = event.clientX - dragStart.value.x
  const deltaY = event.clientY - dragStart.value.y
  
  if (isDragging.value) {
    const newPosition = {
      x: originalPosition.value.x + deltaX,
      y: originalPosition.value.y + deltaY,
      width: props.section.position.width,
      height: props.section.position.height
    }
    
    emit('sectionUpdate', { ...props.section, ...newPosition })
  } else if (isResizing.value) {
    const newSize = {
      x: props.section.position.x,
      y: props.section.position.y,
      width: Math.max(200, originalPosition.value.width + deltaX),
      height: Math.max(150, originalPosition.value.height + deltaY)
    }
    
    emit('sectionUpdate', { ...props.section, ...newSize })
  }
}

const handleMouseUp = () => {
  isDragging.value = false
  isResizing.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

const startResize = (event: MouseEvent) => {
  event.stopPropagation()
  isResizing.value = true
  dragStart.value = { x: event.clientX, y: event.clientY }
  originalPosition.value = { ...props.section.position }
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const toggleCollapse = () => {
  emit('sectionUpdate', { ...props.section, isCollapsed: !props.section.isCollapsed })
}

const toggleVisibility = () => {
  emit('sectionUpdate', { ...props.section, isVisible: !props.section.isVisible })
}

const handleDrop = (event: DragEvent) => {
  const emptySlot: TaskSlot = {
    id: 'new-slot',
    position: { x: 0, y: 0 }
  }
  emit('taskDrop', event, emptySlot, props.section)
}

const handleSlotDrop = (event: DragEvent, slot: TaskSlot) => {
  emit('taskDrop', event, slot, props.section)
}

const handleContextMenu = (event: MouseEvent) => {
  emit('sectionContextMenu', event, props.section)
}

// Cleanup
onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<style scoped>
.canvas-section {
  position: absolute;
  border: 2px dashed;
  border-radius: var(--radius-lg);
  background: var(--surface-hover);
  backdrop-filter: blur(8px);
  transition: all var(--duration-normal) var(--spring-smooth);
  user-select: none;
  z-index: 1;
}

.canvas-section:hover {
  border-color: var(--glass-border-hover);
  background: var(--glass-bg-tint);
}

.section-active {
  border-color: var(--glass-border-active);
  background: var(--glass-bg-soft);
  box-shadow: 0 0 0 1px var(--glass-border-strong);
}

.section-dragging {
  opacity: 0.8;
  cursor: move;
  z-index: 100;
}

.section-collapsed {
  height: auto !important;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  cursor: move;
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
}

.section-color-indicator {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  box-shadow: 0 0 8px currentColor;
}

.section-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.section-count {
  background: var(--glass-border);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-sm);
  min-width: 20px;
  text-align: center;
}

.section-controls {
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.canvas-section:hover .section-controls {
  opacity: 1;
}

.control-btn {
  background: var(--glass-border);
  border: none;
  color: var(--text-secondary);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-btn:hover {
  background: var(--glass-border-strong);
  color: var(--text-primary);
}

.section-content {
  padding: var(--space-4);
  min-height: 100px;
}

.section-drop-zone {
  height: 100px;
  border: 2px dashed var(--glass-border-strong);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast);
}

.section-drop-zone:hover {
  border-color: var(--glass-border-active);
  background: var(--glass-bg-medium);
}

.drop-zone-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.section-grid {
  display: grid;
  gap: var(--space-3);
  min-height: 50px;
}

.layout-vertical {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.layout-horizontal {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.layout-grid {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.task-slot {
  min-height: 60px;
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-2);
  transition: all var(--duration-fast);
}

.task-slot:hover {
  border-color: var(--glass-border-hover);
  background: var(--glass-bg-medium);
}

.slot-occupied {
  border-style: solid;
  border-color: var(--glass-border-strong);
  background: var(--glass-bg-heavy);
}

.slot-task-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.slot-task-title {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  line-height: var(--leading-tight);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-task-meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.priority-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  padding: var(--space-px) var(--space-1);
  border-radius: var(--radius-xs);
  text-transform: uppercase;
}

.priority-badge.high {
  background: var(--danger-bg-medium);
  color: var(--color-priority-high);
}

.priority-badge.medium {
  background: var(--success-bg-subtle);
  color: var(--color-work);
}

.priority-badge.low {
  background: var(--blue-bg-medium);
  color: var(--brand-primary);
}

.duration {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, var(--glass-border-strong) 50%);
  border-radius: 0 0 var(--radius-lg) 0;
}

.section-guides {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  pointer-events: none;
  z-index: 10;
}

.guide-top,
.guide-right,
.guide-bottom,
.guide-left {
  position: absolute;
  background: var(--purple-border-active);
}

.guide-top {
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
}

.guide-right {
  top: 0;
  right: 0;
  bottom: 0;
  width: 2px;
}

.guide-bottom {
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
}

.guide-left {
  top: 0;
  left: 0;
  bottom: 0;
  width: 2px;
}
</style>