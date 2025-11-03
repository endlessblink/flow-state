<template>
  <div
    class="section-node"
    :class="[`section-type-${section.type}`, { 'collapsed': isCollapsed }]"
    :style="{ borderColor: section.color + '60' }"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Section Header -->
    <div class="section-header" :style="{ background: section.color + '20' }">
      <div class="section-color-dot" :style="{ background: section.color }"></div>
      <button @click="toggleCollapse" class="collapse-btn" :title="isCollapsed ? 'Expand section' : 'Collapse section'">
        <ChevronDown v-if="!isCollapsed" :size="14" />
        <ChevronRight v-else :size="14" />
      </button>
      <input
        v-model="sectionName"
        @blur="updateName"
        class="section-name-input"
        placeholder="Section name..."
        :disabled="isCollapsed"
      />
      <button
        v-if="section.type !== 'custom' && !isCollapsed"
        @click="toggleAutoCollect"
        class="auto-collect-btn"
        :class="{ active: autoCollectEnabled }"
        :title="autoCollectEnabled ? 'Auto-collect: ON - Matching tasks auto-placed' : 'Auto-collect: OFF - Manual placement only'"
      >
        🧲
      </button>
      <div v-if="section.type !== 'custom' && !isCollapsed" class="section-type-badge" :title="sectionTypeLabel">
        {{ sectionTypeIcon }}
      </div>
      <div class="section-count" :class="{ 'has-tasks': taskCount > 0 }">
        {{ taskCount }}
        <span v-if="isCollapsed && taskCount > 0" class="hidden-indicator" :title="`${taskCount} hidden tasks`">📦</span>
      </div>
    </div>

    <!-- RESIZE HANDLES - Automatic handles for all corners and edges -->
    <NodeResizer
      :is-visible="selected"
      :min-width="200"
      :min-height="150"
      :max-width="1200"
      :max-height="800"
      @resizeStart="handleResizeStart"
      @resize="handleResize"
      @resizeEnd="handleResizeEnd"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'

interface SectionData {
  id: string
  name: string
  color: string
  taskCount: number
  type?: 'priority' | 'status' | 'project' | 'timeline' | 'custom'
  propertyValue?: string
}

interface Props {
  data: SectionData
  selected?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  update: [data: Partial<SectionData>]
  collect: [sectionId: string]
  contextMenu: [event: MouseEvent, section: SectionData]
  resizeStart: [data: { sectionId: string; event: any }]
  resize: [data: { sectionId: string; event: any }]
  resizeEnd: [data: { sectionId: string; event: any }]
}>()

const section = computed(() => props.data)
const sectionName = ref(props.data.name)
const taskCount = computed(() => props.data.taskCount || 0)
const canvasStore = useCanvasStore()
const taskStore = useTaskStore()

const isCollapsed = computed(() => {
  const sectionData = canvasStore.sections.find(s => s.id === props.data.id)
  return sectionData?.isCollapsed || false
})

const autoCollectEnabled = computed(() => {
  const sectionData = canvasStore.sections.find(s => s.id === props.data.id)
  return sectionData?.autoCollect || false
})

const sectionTypeIcon = computed(() => {
  switch (props.data.type) {
    case 'priority': return '🏳️'
    case 'status': return '▶️'
    case 'project': return '📁'
    case 'timeline': return '📅'
    default: return ''
  }
})

const sectionTypeLabel = computed(() => {
  const labels = {
    priority: 'Priority Section - Auto-assigns priority',
    status: 'Status Section - Auto-assigns status',
    project: 'Project Section - Auto-assigns project',
    timeline: 'Timeline Section - Auto-assigns schedule',
    custom: 'Custom Section'
  }
  return labels[props.data.type || 'custom']
})

// Watch for external name changes
watch(() => props.data.name, (newName) => {
  sectionName.value = newName
})

const updateName = () => {
  if (sectionName.value !== props.data.name) {
    emit('update', { name: sectionName.value })
  }
}

const toggleCollapse = () => {
  canvasStore.toggleSectionCollapse(props.data.id, taskStore.filteredTasks)
}

const toggleAutoCollect = () => {
  canvasStore.toggleAutoCollect(props.data.id)
  // Trigger immediate collection when enabled
  emit('collect', props.data.id)
}

const handleContextMenu = (event: MouseEvent) => {
  emit('contextMenu', event, props.data)
}

// Resize event handlers with comprehensive logging
const handleResizeStart = (event: any) => {
  console.log('📐 [SectionNode] Resize START:', {
    sectionId: props.data.id,
    sectionName: props.data.name,
    event,
    eventKeys: Object.keys(event || {}),
    params: event?.params,
    dimensions: event?.dimensions
  })
  emit('resizeStart', { sectionId: props.data.id, event })
}

const handleResize = (event: any) => {
  console.log('📐 [SectionNode] Resizing:', {
    sectionId: props.data.id,
    eventStructure: {
      hasParams: !!event?.params,
      hasDimensions: !!event?.dimensions,
      hasWidth: !!event?.width,
      hasHeight: !!event?.height,
      hasX: !!event?.x,
      hasY: !!event?.y
    },
    params: event?.params,
    dimensions: event?.dimensions,
    width: event?.width,
    height: event?.height,
    x: event?.x,
    y: event?.y
  })
  emit('resize', { sectionId: props.data.id, event })
}

const handleResizeEnd = (event: any) => {
  console.log('📐 [SectionNode] Resize END:', {
    sectionId: props.data.id,
    sectionName: props.data.name,
    event,
    eventKeys: Object.keys(event || {}),
    params: event?.params,
    dimensions: event?.dimensions,
    finalWidth: event?.width || event?.params?.x || event?.dimensions?.width,
    finalHeight: event?.height || event?.params?.y || event?.dimensions?.height
  })
  emit('resizeEnd', { sectionId: props.data.id, event })
}
</script>

<style scoped>
.section-node {
  width: 100%;
  height: 100%;
  border: 2px dashed;
  border-radius: var(--radius-lg);
  background: var(--glass-bg-light);
  position: relative;
  z-index: 1;
  will-change: transform;
  transform: translateZ(0);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.section-color-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.collapse-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
}

.collapse-btn:focus {
  outline: 2px solid var(--accent-primary);
  outline-offset: 1px;
}

.auto-collect-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1;
}

.auto-collect-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: scale(1.1);
}

.auto-collect-btn.active {
  background: var(--blue-bg-medium);
  border-color: var(--blue-border-active);
  color: var(--blue-text);
  box-shadow: 0 0 0 2px var(--blue-bg-subtle);
}

.section-name-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  outline: none;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast);
}

.section-name-input:hover,
.section-name-input:focus {
  background: var(--glass-bg-heavy);
}

.section-type-badge {
  background: var(--glass-bg-heavy);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  margin-right: var(--space-2);
}

.section-count {
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  min-width: 20px;
  text-align: center;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.section-count.has-tasks {
  background: var(--blue-bg-medium);
  color: var(--blue-text);
  border: 1px solid var(--blue-border-active);
}

.hidden-indicator {
  font-size: 10px;
  opacity: 0.7;
  animation: hidden-pulse 2s ease-in-out infinite;
}

@keyframes hidden-pulse {
  0%, 100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.section-node.collapsed {
  min-height: auto;
  height: auto !important;
  cursor: pointer;
}

.section-node.collapsed .section-header {
  border-bottom: none;
  border-radius: var(--radius-lg);
}

/* Hide Vue Flow handles when collapsed */
.section-node.collapsed .vue-flow__handle {
  display: none;
}

/* Ensure collapsed sections still accept drops */
.section-node.collapsed.vue-flow__node--selected {
  box-shadow: 0 0 0 2px var(--accent-primary);
}

/* Visual hint for collapsed sections */
.section-node.collapsed::after {
  content: '';
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid var(--text-secondary);
  opacity: 0.3;
}
</style>
