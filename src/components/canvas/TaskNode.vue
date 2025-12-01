<template>
  <div
    class="task-node"
    :class="{
      'priority-high': task?.priority === 'high',
      'priority-medium': task?.priority === 'medium',
      'priority-low': task?.priority === 'low',
      'status-done': task?.status === 'done',
      'status-in-progress': task?.status === 'in_progress',
      'timer-active': isTimerActive,
      'selected': isSelected,
      'multi-select-mode': multiSelectMode,
      'is-dragging': isNodeDragging,
      'is-connecting': isConnecting,
      ...filterHighlightClasses
    }"
    :draggable="!isConnecting"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
    @dblclick="$emit('edit', task)"
    @click="handleClick"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Priority Badge -->
    <div v-if="showPriority" class="priority-indicator"></div>

    <!-- Timer Active Badge -->
    <div v-if="isTimerActive" class="timer-indicator" title="Timer Active">
      <Timer :size="14" />
    </div>

    <!-- Title -->
    <div class="task-title" :class="titleAlignmentClasses">{{ task?.title || 'Untitled Task' }}</div>

    <!-- Description (if available) -->
    <div v-if="task?.description" class="task-description" :class="titleAlignmentClasses">
      <div
        class="description-content"
        :class="{ 'expanded': isDescriptionExpanded || !isDescriptionLong }"
      >
        {{ task.description }}
      </div>
      <button
        v-if="isDescriptionLong"
        @click.stop="toggleDescriptionExpanded"
        class="description-toggle"
        :aria-expanded="isDescriptionExpanded"
        aria-label="Show more description"
      >
        {{ isDescriptionExpanded ? 'Show less' : 'Show more' }}
      </button>
    </div>

    <!-- Metadata -->
    <div class="task-metadata">
      <span v-if="showStatus" class="status-badge">{{ statusLabel }}</span>
      <span v-if="task?.dueDate" class="due-date-badge" title="Due Date">
        <Calendar :size="12" />
        {{ task.dueDate }}
      </span>
      <span
        class="project-emoji-badge"
        :class="[`project-visual--${projectVisual.type}`, { 'project-visual--colored': projectVisual.type === 'css-circle' }]"
        :title="`Project: ${taskStore.getProjectDisplayName(task?.projectId)}`"
      >
        <!-- Emoji rendering using ProjectEmojiIcon for consistency -->
        <ProjectEmojiIcon
          v-if="projectVisual.type === 'emoji'"
          :emoji="projectVisual.content"
          size="md"
        />
        <!-- CSS Circle for colored projects -->
        <div
          v-else-if="projectVisual.type === 'css-circle'"
          class="project-css-circle"
          :style="{ '--project-color': projectVisual.color }"
        ></div>
        <!-- Default fallback (folder icon) -->
        <ProjectEmojiIcon
          v-else
          emoji="📁"
          size="md"
        />
      </span>
      <span v-if="showSchedule && hasSchedule" class="schedule-badge" title="Scheduled">
        📅
      </span>
      <span v-if="showDuration && task?.estimatedDuration" class="duration-badge">
        {{ task.estimatedDuration }}m
      </span>
    </div>

    <!-- Selection Indicator -->
    <div v-if="isSelected" class="selection-indicator">
      <div class="selection-corner top-left"></div>
      <div class="selection-corner top-right"></div>
      <div class="selection-corner bottom-left"></div>
      <div class="selection-corner bottom-right"></div>
    </div>

    <!-- Connection Handles - only render when in Vue Flow context -->
    <Handle v-if="isInVueFlowContext" type="target" :position="Position.Top" class="handle-target" />
    <Handle v-if="isInVueFlowContext" type="source" :position="Position.Bottom" class="handle-source" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { Calendar, Timer } from 'lucide-vue-next'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useDragAndDrop, type DragData } from '@/composables/useDragAndDrop'
import { useTimerStore } from '@/stores/timer'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

interface Props {
  task: Task
  isSelected?: boolean
  multiSelectMode?: boolean
  showPriority?: boolean
  showStatus?: boolean
  showDuration?: boolean
  showSchedule?: boolean
  isConnecting?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  multiSelectMode: false,
  showPriority: true,
  showStatus: true,
  showDuration: true,
  showSchedule: true,
  isConnecting: false
})

// Defensive validation - gracefully handle undefined task prop
if (!props.task) {
  console.warn('TaskNode: task prop is undefined, component will not render')
}

const emit = defineEmits<{
  edit: [task: Task]
  select: [task: Task, multiSelect: boolean]
  contextMenu: [event: MouseEvent, task: Task]
}>()

const { startDrag, endDrag } = useDragAndDrop()
const timerStore = useTimerStore()
const taskStore = useTaskStore()

// Hebrew text alignment support
const { getAlignmentClasses } = useHebrewAlignment()
const titleAlignmentClasses = computed(() => getAlignmentClasses(props.task?.title || ''))

// Track local dragging state to prevent visual artifacts
const isNodeDragging = ref(false)

// Description expansion state
const isDescriptionExpanded = ref(false)
const DESCRIPTION_MAX_LENGTH = 100

// Check if description is long enough for truncation
const isDescriptionLong = computed(() => {
  return props.task?.description && props.task.description.length > DESCRIPTION_MAX_LENGTH
})

// Toggle description expansion
const toggleDescriptionExpanded = () => {
  isDescriptionExpanded.value = !isDescriptionExpanded.value
}

// Check if we're in a Vue Flow context (works in CanvasView, but not in Storybook)
const isInVueFlowContext = computed(() => {
  // For Storybook, we need to be more defensive about Vue Flow context
  if (typeof window === 'undefined') return false

  // Check if we're in a Vue Flow context by looking for the provider
  try {
    const vueFlow = useVueFlow()
    return !!(vueFlow && typeof vueFlow === 'object')
  } catch (error) {
    // In Storybook or outside VueFlow context - this is expected
    return false
  }
})

const statusLabel = computed(() => {
  const labels = {
    planned: 'Plan',
    in_progress: 'Active',
    done: 'Done',
    backlog: 'Back'
  }
  return (labels as any)[props.task.status] || 'Unknown'
})

const hasSchedule = computed(() =>
  props.task?.instances && props.task.instances.length > 0
)

// Project visual indicator (emoji or colored dot)
const projectVisual = computed(() =>
  taskStore.getProjectVisual(props.task?.projectId)
)

// Check if this task has an active timer
const isTimerActive = computed(() => {
  return timerStore.isTimerActive && timerStore.currentTaskId === props.task.id
})

// Filter highlighting classes
const filterHighlightClasses = computed(() => {
  const highlights = taskStore.getTaskFilterHighlights(props.task)
  return highlights.reduce((classes, highlight) => {
    classes[`filter-highlight-${highlight}`] = true
    return classes
  }, {} as Record<string, boolean>)
})

// Drag handler with proper state management
const handleDragStart = (event: DragEvent) => {
  // Prevent HTML5 drag during connection operations to avoid opaque preview
  if (props.isConnecting) {
    event.preventDefault()
    return
  }

  if (event.dataTransfer && props.task) {
    const dragData: DragData = {
      type: 'task',
      taskId: props.task.id || '',
      title: props.task.title || 'Untitled Task',
      source: 'canvas'
    }

    // Set local dragging state immediately to prevent visual artifacts
    isNodeDragging.value = true

    // Use new composable for global drag state
    startDrag(dragData)

    // Still set dataTransfer for HTML5 drag-and-drop compatibility
    event.dataTransfer.setData('application/json', JSON.stringify(dragData))
    event.dataTransfer.effectAllowed = 'move'
  }
}

// Event handlers
const handleClick = (event: MouseEvent) => {
  if (!props.task) return

  // Prevent edit modal when connecting to avoid conflicts
  if (props.isConnecting) {
    // Don't emit edit event when connecting, just handle selection
    emit('select', props.task, event.ctrlKey || event.metaKey)
    return
  }

  // If task is already selected and clicking again (without modifiers), open edit modal
  if (props.isSelected && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    emit('edit', props.task)
  } else if (props.multiSelectMode) {
    // Don't stopPropagation - it blocks double-click events!
    emit('select', props.task, event.ctrlKey || event.metaKey)
  }
}

const handleContextMenu = (event: MouseEvent) => {
  if (!props.task) return

  // Don't show context menu if we're currently dragging or connecting
  if (isNodeDragging.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  emit('contextMenu', event, props.task)
}

// Handle drag end to clean up visual state
const handleDragEnd = () => {
  // Clean up local dragging state with a small delay to ensure smooth transition
  setTimeout(() => {
    isNodeDragging.value = false
  }, 50)

  // Call the global endDrag from composable
  endDrag()
}
</script>

<style scoped>
.task-node {
  border: none !important;
  outline: none !important;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  min-width: 280px;
  max-width: 420px;
  width: auto;
  position: relative;
  transition: all var(--duration-normal) var(--spring-smooth);
  cursor: grab;
  user-select: none;
  box-shadow:
    0 12px 24px var(--shadow-md),
    0 6px 12px var(--shadow-md);

  /* GPU acceleration and sharp text rendering */
  will-change: transform;
  transform: translate3d(0, 0, 0);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  backface-visibility: hidden;
  image-rendering: -webkit-optimize-contrast;

  /* Ensure precise hit area */
  box-sizing: border-box;
  display: block;
}

.task-title,
.task-metadata {
  transform: translateZ(0);
  will-change: contents;
}

/* Blurred background layer - keeps text sharp */
.task-node::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    var(--glass-border) 0%,
    var(--glass-bg-soft) 100%
  );
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-radius: var(--radius-xl);
  z-index: -1;
}

.task-node:hover {
  border: none;
  transform: translate3d(0, -2px, 0);
  box-shadow:
    0 16px 32px var(--shadow-strong),
    0 8px 16px var(--shadow-md);
  cursor: grab;
}

.task-node:active {
  cursor: grabbing;
}

/* Connection mode styles */
.task-node.is-connecting {
  border: 2px solid var(--color-navigation) !important;
  box-shadow:
    0 0 20px var(--color-navigation),
    0 8px 32px var(--shadow-strong) !important;
  animation: pulse-connection 2s infinite;
  cursor: crosshair;
}

.task-node.is-connecting::before {
  border: 2px solid var(--color-navigation);
}

@keyframes pulse-connection {
  0%, 100% {
    box-shadow:
      0 0 20px var(--color-navigation),
      0 8px 32px var(--shadow-strong);
  }
  50% {
    box-shadow:
      0 0 30px var(--color-navigation),
      0 12px 48px var(--shadow-strong);
  }
}

/* Drag state styles to prevent visual artifacts - only for movement dragging */
.task-node.is-dragging:not(.is-connecting) {
  /* Prevent any transition effects during drag to avoid ghosting */
  transition: none !important;
  animation: none !important;
  transform: scale(0.95) !important;
  opacity: 0.8 !important;
  /* Ensure clean visual state during drag */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
  z-index: 1000 !important;
  /* Prevent any blur or filter effects during drag */
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  /* Ensure no visual artifacts */
  will-change: transform !important;
  outline: none !important;
  border: none !important;
}

/* Connection mode styles - no opacity changes, keep handles visible */
.task-node.is-connecting {
  /* Keep task fully visible during connections */
  opacity: 1 !important;
  transform: none !important;
  /* Keep connection handles fully visible during connections */
  z-index: 5;
}

/* Hide all text shadows and complex effects during drag */
.task-node.is-dragging * {
  text-shadow: none !important;
  transition: none !important;
  animation: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* Global drag cleanup - hide all connection handles during drag */
body.dragging-active .task-node .vue-flow__handle {
  opacity: 0.3 !important;
  transition: opacity 0.2s ease !important;
}

/* Hide connection handles during node-specific movement drag (not during connections) */
.task-node.is-dragging:not(.is-connecting) .vue-flow__handle {
  opacity: 0.1 !important;
  transition: opacity 0.1s ease !important;
}

/* Keep connection handles fully visible during connection operations */
.task-node.is-connecting .vue-flow__handle {
  opacity: 1 !important;
  transition: opacity 0.2s ease !important;
}

/* Prevent text selection during drag, but allow events on root and children */
.task-node * {
  user-select: none;
  pointer-events: auto; /* Changed from none - allows double-click to work! */
}

/* Text elements should not interfere with drag */
.task-node .task-title,
.task-node .task-metadata {
  pointer-events: none; /* Only block these specific text elements */
}

/* But these interactive badges need events */
.task-node .priority-indicator,
.task-node .status-badge,
.task-node .due-date-badge,
.task-node .schedule-badge,
.task-node .duration-badge {
  pointer-events: auto;
}

.task-node:hover::before {
  background: linear-gradient(
    135deg,
    var(--glass-border-soft) 0%,
    var(--glass-bg-heavy) 100%
  );
}

.priority-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: 0 4px 8px var(--shadow-md);
  /* Fix priority label clipping - account for task node padding */
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.priority-high .priority-indicator {
  background: var(--color-priority-high);
  box-shadow: var(--priority-high-glow);
}

.priority-medium .priority-indicator {
  background: var(--color-priority-medium);
  box-shadow: var(--priority-medium-glow);
}

.priority-low .priority-indicator {
  background: var(--color-priority-low);
  box-shadow: var(--priority-low-glow);
}

/* Timer Active Styles */
.timer-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: var(--brand-primary);
  color: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  box-shadow: 0 2px 8px var(--brand-primary);
  animation: timerPulse 2s ease-in-out infinite;
  border: 2px solid white;
  /* Fix timer icon centering */
  padding: 0;
  margin: 0;
  line-height: 1;
}

.timer-indicator svg {
  width: 14px !important;
  height: 14px !important;
  display: block;
  margin: 0;
  padding: 0;
  flex-shrink: 0;
}

.timer-active {
  border: none !important;
  box-shadow:
    0 16px 32px var(--shadow-strong),
    0 8px 16px var(--shadow-md),
    0 0 24px rgba(59, 130, 246, 0.3) !important;
}

.timer-active::before {
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.15) 0%,
    var(--glass-bg-soft) 100%
  );
}

.timer-active .priority-indicator {
  background: var(--brand-primary) !important;
  box-shadow: 0 0 12px var(--brand-primary) !important;
  animation: priorityPulse 2s ease-in-out infinite;
}

@keyframes timerPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 2px 8px var(--brand-primary);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 2px 12px var(--brand-primary), 0 0 16px rgba(59, 130, 246, 0.4);
  }
}

@keyframes priorityPulse {
  0%, 100% {
    box-shadow: var(--brand-primary-glow);
  }
  50% {
    box-shadow: 0 0 20px var(--brand-primary), 0 0 30px rgba(59, 130, 246, 0.5);
  }
}

.status-done {
  opacity: 0.8; /* Reduced transparency - still visible but muted */
}

.status-done .task-title {
  text-decoration: line-through;
}

/* Override opacity for tasks inside sections to maintain visibility */
.vue-flow__node[data-id^="section-"] .task-node.status-done {
  opacity: 0.9; /* Even less transparent inside sections */
}

.status-in-progress {
  border: none;
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.selected {
  border: none !important;
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow) !important;
}

.multi-select-mode {
  cursor: pointer;
}

.multi-select-mode:hover {
  transform: translateY(-2px) scale(1.02);
}

.selection-indicator {
  position: absolute;
  top: -8px;
  left: -8px;
  right: -8px;
  bottom: -8px;
  pointer-events: none;
  z-index: 10;
}

.selection-corner {
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--brand-primary);
  border: 3px solid white;
  border-radius: var(--radius-xs);
  box-shadow: 0 2px 4px var(--shadow-md);
}

.selection-corner.top-left {
  top: 0;
  left: 0;
}

.selection-corner.top-right {
  top: 0;
  right: 0;
}

.selection-corner.bottom-left {
  bottom: 0;
  left: 0;
}

.selection-corner.bottom-right {
  bottom: 0;
  right: 0;
}

.task-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-3);
  margin-top: var(--space-1);
  line-height: 1.4;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  text-shadow: 0 1px 2px var(--shadow-subtle);
  /* Allow multi-line titles with graceful truncation */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-height: 3.6em; /* 3 lines at 1.4 line-height */
}

.task-metadata {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-start;
  /* Allow horizontal scrolling if badges overflow */
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border-subtle) transparent;
}

.task-metadata::-webkit-scrollbar {
  height: 3px;
}

.task-metadata::-webkit-scrollbar-track {
  background: transparent;
}

.task-metadata::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: var(--radius-full);
}

.task-description {
  margin-bottom: var(--space-3);
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: 1.4;
}

.description-content {
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

.description-content:not(.expanded) {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-height: 2.8em; /* 2 lines at 1.4 line-height */
}

.description-toggle {
  background: none;
  border: none;
  color: var(--brand-primary);
  font-size: var(--text-xs);
  cursor: pointer;
  padding: var(--space-1) 0;
  margin-top: var(--space-1);
  font-weight: var(--font-medium);
  transition: all var(--duration-fast) ease;
}

.description-toggle:hover {
  color: var(--brand-hover);
  text-decoration: underline;
}

.status-badge,
.due-date-badge,
.duration-badge,
.project-emoji-badge {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-2);
  background: var(--surface-elevated);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  font-weight: var(--font-medium);
  box-shadow: 0 2px 4px var(--shadow-subtle);
  white-space: nowrap;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-emoji-badge {
  background: var(--brand-bg-subtle);
  border-color: var(--brand-border-subtle);
  color: var(--text-secondary);
}

.project-emoji {
  font-size: 12px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-emoji.project-css-circle {
  /* CSS circle with enhanced glow for canvas visibility */
  width: var(--project-indicator-size-md); /* 8px for TaskNode canvas visibility */
  height: var(--project-indicator-size-md);
  border-radius: 50%;
  background: var(--project-color);
  box-shadow:
    var(--project-indicator-glow-strong), /* Strong glow for canvas visibility */
    var(--project-indicator-shadow-inset);
  border: 1px solid var(--project-indicator-border);
  backdrop-filter: var(--project-indicator-backdrop);
  transition: all var(--duration-normal) var(--spring-smooth);
  position: relative;
  transform: translateZ(0); /* Hardware acceleration */
}

.project-emoji.project-css-circle::after {
  content: '';
  position: absolute;
  inset: -3px; /* Larger glow area for canvas */
  border-radius: 50%;
  background: radial-gradient(circle, var(--project-color) 0%, transparent 70%);
  opacity: 0;
  transition: opacity var(--duration-normal) var(--spring-smooth);
  pointer-events: none;
}

.project-emoji-badge:hover .project-emoji.project-css-circle {
  transform: translateZ(0) scale(1.15); /* Slightly larger scale for canvas */
  box-shadow:
    0 0 16px var(--project-color),
    0 0 32px var(--project-color),
    var(--project-indicator-shadow-inset);
}

.project-emoji-badge:hover .project-emoji.project-css-circle::after {
  opacity: 0.4; /* Stronger glow for canvas interactions */
}

.project-emoji-badge.project-visual--colored {
  /* Enhanced background for colored dots */
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
}

.schedule-badge {
  font-size: var(--text-sm);
  filter: drop-shadow(0 1px 2px var(--shadow-subtle));
}

/* Connection Handles */
.handle-target,
.handle-source {
  width: 14px !important;
  height: 14px !important;
  background: var(--color-work) !important;
  border: 3px solid var(--border-medium) !important;
  box-shadow: var(--state-hover-glow) !important;
  transition: all var(--duration-fast) var(--spring-bounce) !important;
  z-index: 10 !important;
  overflow: visible !important;
}

.handle-target:hover,
.handle-source:hover {
  width: 18px !important;
  height: 18px !important;
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow) !important;
}
</style>
