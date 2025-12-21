<template>
  <div
    class="section-node"
    :class="[`section-type-${section.type}`, { 'collapsed': isCollapsed }]"
    :style="{ borderColor: section.color + '60' }"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Section Header -->
    <div class="section-header" :style="{ background: section.color + '20' }">
      <div class="section-color-dot" :style="{ background: section.color }" />
      <button class="collapse-btn" :title="isCollapsed ? 'Expand group' : 'Collapse group'" @click="toggleCollapse">
        <ChevronDown v-if="!isCollapsed" :size="14" />
        <ChevronRight v-else :size="14" />
      </button>
      <input
        v-model="sectionName"
        class="section-name-input"
        placeholder="Group name..."
        :disabled="isCollapsed"
        @blur="updateName"
      >

      <!-- Actions Container - wraps all action buttons with overflow handling -->
      <div v-if="!isCollapsed" class="header-actions">
        <!-- Power Mode Indicator -->
        <div
          v-if="isPowerMode"
          class="power-indicator"
          :title="powerModeTooltip"
        >
          <Zap :size="12" class="power-icon" />
        </div>

        <!-- Collect Button (for power groups) -->
        <div v-if="isPowerMode" class="collect-wrapper">
          <button
            class="collect-btn"
            :class="{ 'has-matches': matchingInboxCount > 0 }"
            :title="`Collect matching tasks (${matchingInboxCount} available)`"
            @click.stop="toggleCollectMenu"
          >
            <Magnet :size="12" />
            <span v-if="matchingInboxCount > 0" class="collect-badge">{{ matchingInboxCount }}</span>
          </button>

          <!-- Collect Dropdown Menu -->
          <div v-if="showCollectMenu" class="collect-menu" @click.stop>
            <button class="collect-option" @click="handleCollect('move')">
              Move {{ matchingInboxCount }} tasks here
            </button>
            <button class="collect-option" @click="handleCollect('highlight')">
              Highlight matching tasks
            </button>
          </div>
        </div>

        <!-- Power Mode Toggle -->
        <button
          v-if="powerKeyword"
          class="power-toggle-btn"
          :class="{ 'power-active': isPowerMode }"
          :title="isPowerMode ? 'Disable power mode' : 'Enable power mode'"
          @click.stop="togglePowerMode"
        >
          <Zap :size="12" />
        </button>

        <!-- Settings Button -->
        <button
          class="settings-btn"
          title="Group settings - configure auto-assign properties"
          @click.stop="openSettings"
        >
          <Settings :size="12" />
        </button>

        <button
          v-if="section.type !== 'custom'"
          class="auto-collect-btn"
          :class="{ active: autoCollectEnabled }"
          :title="autoCollectEnabled ? 'Auto-collect: ON - Matching tasks auto-placed' : 'Auto-collect: OFF - Manual placement only'"
          @click="toggleAutoCollect"
        >
          🧲
        </button>
        <div v-if="section.type !== 'custom'" class="section-type-badge" :title="sectionTypeLabel">
          {{ sectionTypeIcon }}
        </div>
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
      :min-height="80"
      :max-width="2000"
      :max-height="2000"
      @resize-start="handleResizeStart"
      @resize="handleResize"
      @resize-end="handleResizeEnd"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ChevronDown, ChevronRight, Zap, Magnet, Settings } from 'lucide-vue-next'
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { detectPowerKeyword, type PowerKeywordResult } from '@/composables/useTaskSmartGroups'

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

const props = withDefaults(defineProps<Props>(), {
  selected: false
})
const emit = defineEmits<{
  update: [data: Partial<SectionData>]
  collect: [sectionId: string]
  contextMenu: [event: MouseEvent, section: SectionData]
  openSettings: [sectionId: string]
  resizeStart: [data: { sectionId: string; event: unknown }]
  resize: [data: { sectionId: string; event: unknown }]
  resizeEnd: [data: { sectionId: string; event: unknown }]
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
    priority: 'Priority Group - Auto-assigns priority',
    status: 'Status Group - Auto-assigns status',
    project: 'Project Group - Auto-assigns project',
    timeline: 'Timeline Group - Auto-assigns schedule',
    custom: 'Custom Group'
  }
  return labels[props.data.type || 'custom']
})

// Power group state and computed properties
const showCollectMenu = ref(false)

const powerKeyword = computed((): PowerKeywordResult | null => {
  // Get section from store to check for stored power keyword
  const sectionData = canvasStore.sections.find(s => s.id === props.data.id)
  if (sectionData?.powerKeyword !== undefined) {
    return sectionData.powerKeyword
  }
  // Auto-detect from name
  return detectPowerKeyword(props.data.name)
})

const isPowerMode = computed(() => {
  const sectionData = canvasStore.sections.find(s => s.id === props.data.id)
  // Use stored value if explicitly set
  if (sectionData?.isPowerMode !== undefined) {
    return sectionData.isPowerMode
  }
  // Otherwise, auto-detect from name
  return powerKeyword.value !== null
})

const powerModeTooltip = computed(() => {
  if (!powerKeyword.value) return ''
  const categoryLabels = {
    date: 'Sets due date',
    priority: 'Sets priority',
    status: 'Sets status'
  }
  return `Power Group: ${categoryLabels[powerKeyword.value.category]} to "${powerKeyword.value.displayName}"`
})

// Get count of matching tasks in inbox for collect button
const matchingInboxCount = computed(() => {
  if (!isPowerMode.value) return 0
  const allTasks = taskStore.filteredTasks
  return canvasStore.getMatchingTaskCount(props.data.id, allTasks)
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

// Power mode functions
const togglePowerMode = () => {
  canvasStore.togglePowerMode(props.data.id)
}

// Settings function
const openSettings = () => {
  emit('openSettings', props.data.id)
}

const toggleCollectMenu = () => {
  showCollectMenu.value = !showCollectMenu.value
}

const handleCollect = async (mode: 'move' | 'highlight') => {
  showCollectMenu.value = false
  const allTasks = taskStore.filteredTasks
  await canvasStore.collectMatchingTasks(
    props.data.id,
    mode,
    allTasks,
    taskStore.updateTask.bind(taskStore)
  )
}

// Resize event handlers
const handleResizeStart = (event: unknown) => {
  emit('resizeStart', { sectionId: props.data.id, event })
}

const handleResize = (event: unknown) => {
  // Try to cast for logging
  const resizeEvent = event as { height?: number; params?: { height?: number } }
  // Extract height being requested by NodeResizer
  const nodeResizerHeight = resizeEvent?.height || resizeEvent?.params?.height

  // Only log when near constraints to reduce noise
  const nearMin = nodeResizerHeight && nodeResizerHeight <= 120
  const nearMax = nodeResizerHeight && nodeResizerHeight >= 1950

  if (nearMin || nearMax) {
    console.log('🔍 Resize Debug:', {
      sectionId: props.data.id,
      nodeResizerHeight,
      minHeight: 80,
      maxHeight: 2000,
      hitMinConstraint: nodeResizerHeight && nodeResizerHeight <= 80,
      hitMaxConstraint: nodeResizerHeight && nodeResizerHeight >= 2000,
      distanceFromMin: nodeResizerHeight ? nodeResizerHeight - 80 : 0,
      distanceFromMax: nodeResizerHeight ? 2000 - nodeResizerHeight : 0
    })
  }

  emit('resize', { sectionId: props.data.id, event })
}

const handleResizeEnd = (event: unknown) => {
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
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  padding-right: 50px; /* Make space for count badge */
  border-bottom: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  min-height: 40px; /* Ensure consistent header height */
  overflow: hidden; /* Prevent header overflow */
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

/* Header Actions Container - handles overflow gracefully */
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 1;
  min-width: 0; /* Allow shrinking below content size */
  overflow: hidden;
  position: relative;
}

/* Fade mask to indicate overflow */
.header-actions::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 16px;
  background: linear-gradient(to right, transparent, var(--glass-bg-light));
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast);
}

/* Show fade mask when container might be overflowing */
.section-header:hover .header-actions::after {
  opacity: 0.8;
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
  flex: 1 1 60px; /* Grow, shrink, min basis of 60px */
  min-width: 60px; /* Minimum readable width */
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  outline: none;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  transition: background var(--duration-fast);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
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
  /* Position badge absolutely to prevent overflow */
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);

  /* Badge styling */
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

  /* Prevent interference with resize handles */
  pointer-events: none;
  z-index: 10;
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

/* Power Mode Styles */
.power-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: var(--radius-sm);
  background: var(--amber-bg-medium, rgba(245, 158, 11, 0.2));
  color: var(--amber-text, #f59e0b);
  flex-shrink: 0;
}

.power-icon {
  animation: power-pulse 2s ease-in-out infinite;
}

@keyframes power-pulse {
  0%, 100% {
    opacity: 0.7;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.collect-wrapper {
  position: relative;
  flex-shrink: 0;
}

.collect-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  font-size: var(--text-xs);
}

.collect-btn:hover {
  background: var(--glass-bg-heavy);
  color: var(--text-primary);
}

.collect-btn.has-matches {
  background: var(--blue-bg-medium, rgba(59, 130, 246, 0.2));
  border-color: var(--blue-border-active, rgba(59, 130, 246, 0.4));
  color: var(--blue-text, #3b82f6);
}

.collect-badge {
  background: var(--blue-bg-medium, rgba(59, 130, 246, 0.3));
  color: var(--blue-text, #3b82f6);
  font-size: 9px;
  font-weight: var(--font-bold);
  padding: 0 4px;
  border-radius: var(--radius-full);
  min-width: 14px;
  text-align: center;
}

.collect-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--glass-bg-heavy);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  min-width: 180px;
  overflow: hidden;
}

.collect-option {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.collect-option:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

.power-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  padding: 2px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  flex-shrink: 0;
}

.power-toggle-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
}

.power-toggle-btn.power-active {
  background: var(--amber-bg-medium, rgba(245, 158, 11, 0.2));
  border-color: var(--amber-border-active, rgba(245, 158, 11, 0.4));
  color: var(--amber-text, #f59e0b);
}

/* Settings Button */
.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  padding: 2px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
  flex-shrink: 0;
}

.settings-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
  border-color: var(--glass-border-hover);
}

.settings-btn:active {
  background: var(--glass-bg-heavy);
  transform: scale(0.95);
}
</style>
