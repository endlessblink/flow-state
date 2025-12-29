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
      'is-recently-created': isRecentlyCreated
    }"
    @dblclick="$emit('edit', task)"
    @click="handleClick"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Content wrapper - clips priority bar to rounded corners -->
    <div class="task-node-content">
      <!-- Priority Badge -->
      <div v-if="showPriority" class="priority-indicator" />

      <!-- Timer Active Badge -->
      <div v-if="isTimerActive" class="timer-indicator" title="Timer Active">
        <Timer :size="14" />
      </div>

      <!-- Title -->
      <div class="task-title" :class="titleAlignmentClasses">
        {{ task?.title || 'Untitled Task' }}
      </div>

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
          class="description-toggle"
          :aria-expanded="isDescriptionExpanded"
          aria-label="Show more description"
          @click.stop="toggleDescriptionExpanded"
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
          :class="`project-visual--${projectVisual.type}`"
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
          />
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
        <span
          v-if="showDuration && task?.estimatedDuration"
          class="duration-badge"
          :class="durationBadgeClass"
          :title="`Duration: ${formattedDuration}`"
        >
          <component :is="durationIcon" :size="12" />
          {{ formattedDuration }}
        </span>
      </div>
    </div>

    <!-- Selection Indicator - outside content wrapper so it's not clipped -->
    <div v-if="isSelected" class="selection-indicator">
      <div class="selection-corner top-left" />
      <div class="selection-corner top-right" />
      <div class="selection-corner bottom-left" />
      <div class="selection-corner bottom-right" />
    </div>

    <!-- Connection Handles - outside content wrapper so they're not clipped -->
    <Handle
      v-if="isInVueFlowContext"
      type="target"
      :position="Position.Top"
      class="handle-target"
    />
    <Handle
      v-if="isInVueFlowContext"
      type="source"
      :position="Position.Bottom"
      class="handle-source"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent, onMounted } from 'vue'
import { Position } from '@vue-flow/core'
import { Calendar, Timer, Zap, Clock, HelpCircle } from 'lucide-vue-next'
import type { Task, TaskStatus } from '@/types/tasks'
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

const emit = defineEmits<{
  edit: [task: Task]
  select: [task: Task, multiSelect: boolean]
  contextMenu: [event: MouseEvent, task: Task]
}>()

// Lazy load Handle component to prevent Vue Flow context errors in Storybook
const Handle = defineAsyncComponent(() =>
  import('@vue-flow/core').then(mod => mod.Handle)
)

// Defensive validation - gracefully handle undefined task prop
if (!props.task) {
  console.warn('TaskNode: task prop is undefined, component will not render')
}

const { startDrag, endDrag } = useDragAndDrop()
const timerStore = useTimerStore()
const taskStore = useTaskStore()

// Hebrew text alignment support
const { getAlignmentClasses } = useHebrewAlignment()
const titleAlignmentClasses = computed(() => getAlignmentClasses(props.task?.title || ''))

// Track local dragging state to prevent visual artifacts
const isNodeDragging = ref(false)

// Track if task was recently created for animation feedback
const isRecentlyCreated = ref(false)

onMounted(() => {
  if (props.task?.createdAt) {
    const createdDate = new Date(props.task.createdAt)
    const now = new Date()
    const ageInSeconds = (now.getTime() - createdDate.getTime()) / 1000

    // If task was created in the last 5 seconds, trigger the animation
    if (ageInSeconds < 5) {
      isRecentlyCreated.value = true
      // Remove the class after the animation completes
      setTimeout(() => {
        isRecentlyCreated.value = false
      }, 2500)
    }
  }
})

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
// We detect this by checking for the Vue Flow DOM structure instead of calling the hook
const isInVueFlowContext = computed(() => {
  // For Storybook or SSR, always return false
  if (typeof window === 'undefined') return false
  if (typeof document === 'undefined') return false

  // Check if we're inside a Vue Flow container by looking for the DOM structure
  // This is a safer approach than calling useVueFlow() which throws outside context
  try {
    const vueFlowContainer = document.querySelector('.vue-flow')
    return !!vueFlowContainer
  } catch (_error) {
    return false
  }
})

const statusLabel = computed(() => {
  const labels: Record<TaskStatus, string> = {
    planned: 'Plan',
    in_progress: 'Active',
    done: 'Done',
    backlog: 'Back',
    on_hold: 'Hold'
  }
  return labels[props.task.status] || 'Unknown'
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

// Drag handler with proper state management
const _handleDragStart = (event: DragEvent) => {
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
const _handleDragEnd = () => {
  // Clean up local dragging state with a small delay to ensure smooth transition
  setTimeout(() => {
    isNodeDragging.value = false
  }, 50)

  // Call the global endDrag from composable
  endDrag()
}

// Duration Badge Logic
const durationBadgeClass = computed(() => {
  const d = props.task?.estimatedDuration || 0
  if (d <= 15) return 'duration-quick'
  if (d <= 30) return 'duration-short'
  if (d <= 60) return 'duration-medium'
  return 'duration-long'
})

const durationIcon = computed(() => {
  const d = props.task?.estimatedDuration || 0
  if (d <= 15) return Zap
  if (d <= 60) return Timer
  return Clock
})

const formattedDuration = computed(() => {
  const d = props.task?.estimatedDuration || 0
  if (d < 60) return `${d}m`
  const h = Math.floor(d / 60)
  const m = d % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
})
</script>

<style scoped>
.task-node {
  border: none !important;
  outline: none !important;
  border-radius: var(--radius-xl);
  /* TASK-071: Fixed width to force vertical text wrapping instead of horizontal expansion */
  width: 280px;
  min-width: 200px;
  max-width: 320px;
  position: relative;
  transition: all var(--duration-normal) var(--spring-smooth);
  cursor: grab;
  user-select: none;
  box-shadow:
    0 12px 24px var(--shadow-md),
    0 6px 12px var(--shadow-md);

  box-sizing: border-box;
  display: block;
}

/* Content wrapper - clips priority bar to card's rounded corners */
.task-node-content {
  position: relative;
  padding: var(--space-6);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.task-title,
.task-metadata {
  /* Removed 3D transforms to fix blurriness */
}

/* TASK-074: Blurred background layer - blurs canvas dots behind task cards */
.task-node::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* TASK-074: Frosted glass effect - dots visible but blurred */
  background: rgba(15, 20, 30, 0.3);
  /* Increased blur to properly blur canvas dots */
  backdrop-filter: blur(32px) saturate(1.3);
  -webkit-backdrop-filter: blur(32px) saturate(1.3);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
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
  box-shadow: var(--shadow-dark-lg) !important;
  z-index: 1000 !important;
  /* Prevent any blur or filter effects during drag */
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  /* BUG-041: Changed from will-change: transform to auto to prevent text rasterization */
  will-change: auto !important;
  outline: none !important;
  border: none !important;
}

/* Creation Pulse Animation - Gentle feedback when task is first added to canvas */
.task-node.is-recently-created {
  animation: animate-creation 2s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 50; /* Ensure it stays above others while animating */
}

@keyframes animate-creation {
  0% {
    transform: scale(0.6) translateZ(0);
    box-shadow: 0 0 0 0 var(--brand-primary);
    filter: brightness(1.5);
  }
  20% {
    transform: scale(1.1) translateZ(0);
    box-shadow: 0 0 40px 10px var(--brand-primary);
    filter: brightness(1.2);
  }
  40% {
    transform: scale(0.95) translateZ(0);
    box-shadow: 0 0 20px 5px var(--brand-primary);
  }
  60% {
    transform: scale(1.02) translateZ(0);
    box-shadow: 0 0 15px 2px var(--brand-primary);
  }
  100% {
    transform: scale(1) translateZ(0);
    box-shadow: var(--shadow-md);
    filter: brightness(1);
  }
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
  height: 6px;
  /* No border-radius needed - parent's overflow:hidden clips to rounded corners */
  border-radius: 0;
  z-index: 1;
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
  /* Optimize for legibility to encourage re-rasterization at scale */
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: subpixel-antialiased;
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
    0 0 24px var(--blue-shadow) !important;
}

.timer-active::before {
  background: linear-gradient(
    135deg,
    var(--blue-bg-subtle) 0%,
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
    box-shadow: 0 2px 12px var(--brand-primary), 0 0 16px var(--blue-border-medium);
  }
}

@keyframes priorityPulse {
  0%, 100% {
    box-shadow: var(--brand-primary-glow);
  }
  50% {
    box-shadow: 0 0 20px var(--brand-primary), 0 0 30px var(--blue-border-medium);
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
  box-shadow: 0 0 0 2px var(--brand-primary), var(--state-hover-shadow), var(--state-hover-glow) !important;
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
  /* TASK-071: Force text to break and wrap vertically */
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  white-space: normal;
  hyphens: auto;
  text-shadow: 0 1px 2px var(--shadow-subtle);
  /* Allow multi-line titles with graceful truncation */
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-height: 5.6em; /* 4 lines at 1.4 line-height */
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
  background: var(--glass-bg-light);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
}

.duration-badge.duration-quick {
  color: var(--green-text);
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.duration-badge.duration-short {
  color: var(--color-work);
  background: var(--blue-bg-subtle);
  border: 1px solid var(--blue-border-light);
}

.duration-badge.duration-medium {
  color: var(--orange-text);
  background: var(--orange-bg-subtle);
  border: 1px solid rgba(249, 115, 22, 0.2);
}

.duration-badge.duration-long {
  color: var(--danger-text);
  background: var(--danger-bg-subtle);
  border: 1px solid var(--danger-border-light);
}
.duration-badge {
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
  /* CSS circle with softened glow */
  width: var(--project-indicator-size-sm); /* Shrink to 20px */
  height: var(--project-indicator-size-sm);
  border-radius: 50%;
  background: var(--project-color);
  opacity: var(--project-indicator-opacity); /* Apply subtle opacity */
  box-shadow:
    var(--project-indicator-glow-subtle),
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
  transform: translateZ(0) scale(1.1); 
  opacity: 1; /* Full brightness on hover */
  box-shadow:
    var(--project-indicator-glow-medium),
    var(--project-indicator-shadow-inset);
}

.project-emoji-badge:hover .project-emoji.project-css-circle::after {
  opacity: 0.4; /* Stronger glow for canvas interactions */
}

.project-emoji-badge.project-visual--css-circle {
  /* Enhanced background for colored dots */
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
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
