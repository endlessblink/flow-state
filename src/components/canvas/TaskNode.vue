<template>
  <div
    class="task-node"
    :data-task-id="task?.id"
    :class="{
      'priority-high': task?.priority === 'high',
      'priority-immediate': task?.priority === 'immediate',
      'priority-medium': task?.priority === 'medium',
      'priority-low': task?.priority === 'low',
      'priority-relaxed': task?.priority === 'relaxed',
      'status-done': task?.status === 'done',
      'timer-active': isTimerActive,
      'selected': isSelected,
      'multi-select-mode': multiSelectMode,
      'is-dragging': isNodeDragging,
      'is-connecting': isConnecting,
      'is-recently-created': isRecentlyCreated,
      'is-flashing': isFlashing,
      'ai-spotlight': isAISpotlight,
      'ai-spotlight-changed': aiSpotlightKind === 'changed',
      'ai-spotlight-pending': aiSpotlightKind === 'pending',
      'ai-spotlight-removed': aiSpotlightKind === 'removed',
      'lod-1': isLOD1,
      'lod-2': isLOD2,
      'lod-3': isLOD3
    }"
    @click="handleClick"
    @pointerdown="handlePointerDown"
    @mousedown="handleMouseDown"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Content wrapper -->
    <div class="task-node-content">
      <!-- Priority Badge -->
      <TaskNodePriority v-if="showPriority" />

      <!-- Header (Title + Timer) -->
      <TaskNodeHeader
        :title="task?.title"
        :is-timer-active="isTimerActive"
        :alignment-classes="titleAlignmentClasses"
      />

      <!-- Description -->
      <TaskNodeDescription
        v-if="task?.description"
        :description="task?.description"
        :is-expanded="isDescriptionExpanded"
        :is-long="!!isDescriptionLong(task?.description)"
        :alignment-classes="titleAlignmentClasses"
        @checkbox-click="handleCheckboxClick"
        @toggle-expand="toggleDescriptionExpanded"
      />

      <!-- Metadata -->
      <TaskNodeMeta
        :show-status="showStatus"
        :status-label="statusLabel"
        :due-date="task?.dueDate"
        :formatted-due-date="formattedDueDate"
        :show-schedule="showSchedule"
        :has-schedule="!!hasSchedule"
        :show-duration="showDuration"
        :duration="task?.estimatedDuration"
        :is-enough-for-today="isEnoughForToday"
        :worked-minutes-today="workedMinutesToday"
        :duration-badge-class="durationBadgeClass"
        :duration-icon="durationIcon"
        :formatted-duration="formattedDuration"
        :is-done="task?.status === 'done'"
        :is-overdue="isOverdue"
        :done-for-now-until="task?.doneForNowUntil"
        :subtask-count="task?.subtasks?.length || 0"
        :completed-subtask-count="task?.subtasks?.filter(st => st.isCompleted).length || 0"
        :recurrence-rule="task?.recurrenceRule"
        @reschedule="handleReschedule"
        @clear-done-for-now="handleClearDoneForNow"
        @set-work-block="handleSetWorkBlock"
      />
    </div>

    <!-- Selection Indicator -->
    <TaskNodeSelection v-if="isSelected" />

    <!-- Connection Handles (Vue Flow) -->
    <Handle
      v-if="isInVueFlowContext"
      id="target"
      type="target"
      :position="Position.Top"
      connectable
      class="handle-target"
    />
    <Handle
      v-if="isInVueFlowContext"
      id="source"
      type="source"
      :position="Position.Bottom"
      connectable
      class="handle-source"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Position, Handle } from '@vue-flow/core'
import type { Task } from '@/types/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useTaskNodeState } from '@/composables/canvas/node/useTaskNodeState'
import { useTaskNodeActions } from '@/composables/canvas/node/useTaskNodeActions'
import { useWorkBlockProgress } from '@/composables/tasks/useWorkBlockProgress'

// Sub-components
import TaskNodeHeader from './node/TaskNodeHeader.vue'
import TaskNodeDescription from './node/TaskNodeDescription.vue'
import TaskNodeMeta from './node/TaskNodeMeta.vue'
import TaskNodePriority from './node/TaskNodePriority.vue'
import TaskNodeSelection from './node/TaskNodeSelection.vue'
import { FLASH_DURATION_MS } from '@/config/timing'

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  multiSelectMode: false,
  showPriority: true,
  showStatus: true,
  showDuration: true,
  showSchedule: true,
  isConnecting: false,
  selectCallback: undefined,
  editCallback: undefined
})

const emit = defineEmits<{
  edit: [task: Task]
  select: [task: Task, multiSelect: boolean]
  contextMenu: [event: MouseEvent, task: Task]
}>()

// Logic extracted directly from original component to preserve context check
const isInVueFlowContext = computed(() => {
  if (typeof window === 'undefined') return false
  if (typeof document === 'undefined') return false
  try {
    const vueFlowContainer = document.querySelector('.vue-flow')
    return !!vueFlowContainer
  } catch (_error) {
    return false
  }
})

// Handle component imported directly (not lazy-loaded)
// BUG-1125: Lazy loading caused Vue Flow to not register handles properly,
// breaking edge connections in dev/Tauri but not production builds

interface Props {
  task: Task
  isSelected?: boolean
  multiSelectMode?: boolean
  showPriority?: boolean
  showStatus?: boolean
  showDuration?: boolean
  // TASK-262: Callback prop for selection - bypasses Vue's broken emit in Vue Flow
  // Named 'selectCallback' instead of 'onSelect' to avoid Vue's special 'on*' prop handling
  selectCallback?: (task: Task, multiSelect: boolean) => void
  // TASK-279: Callback prop for edit - bypasses Vue's broken emit in Vue Flow
  editCallback?: (task: Task) => void
  showSchedule?: boolean
  isConnecting?: boolean
  isDragging?: boolean
}

// State Logic - BUG-291: 'task' is reactive from store for instant updates
const taskStore = useTaskStore()
const {
  task,
  isLOD1,
  isLOD2,
  isLOD3,
  titleAlignmentClasses,
  isNodeDragging,
  isRecentlyCreated,
  statusLabel,
  hasSchedule,
  formattedDueDate,
  isOverdue,
  isTimerActive,
  durationBadgeClass,
  durationIcon,
  formattedDuration
} = useTaskNodeState(props)
const { workedMinutesToday, isEnoughForToday } = useWorkBlockProgress(task)

// Actions Logic
const {
  isDescriptionExpanded,
  isDescriptionLong,
  toggleDescriptionExpanded,
  handleCheckboxClick,
  handleClick,
  handlePointerDown,
  handleMouseDown,
  handleContextMenu,
  handleReschedule,
  handleClearDoneForNow
} = useTaskNodeActions(props, emit)

const handleSetWorkBlock = async (duration: number) => {
  const currentTask = task.value
  if (!currentTask?.id) return
  await taskStore.updateTaskWithUndo(currentTask.id, { estimatedDuration: duration })
}

// TASK-262: Selection is handled via:
// 1. @click="handleClick" on the template (for clicks that reach the component)
// 2. @node-click on the VueFlow component in CanvasView (for Vue Flow's internal events)
// 3. selectCallback prop for direct callback when emits don't work
// TASK-279: Edit (double-click) is handled via:
// 1. Manual double-click detection in handleClick (native @dblclick doesn't work due to DOM changes)
// 2. editCallback prop for direct callback when emits don't work in Vue Flow

// TASK-1074: Flash animation when date is set via context menu
const isFlashing = ref(false)
const isAISpotlight = ref(false)
const aiSpotlightKind = ref<'spotlight' | 'changed' | 'pending' | 'removed'>('spotlight')
let aiSpotlightTimeout: number | undefined
const handleTaskFlash = (event: Event) => {
  const customEvent = event as CustomEvent<{ taskId: string }>
  if (customEvent.detail.taskId === props.task?.id) {
    isFlashing.value = true
    setTimeout(() => { isFlashing.value = false }, FLASH_DURATION_MS)
  }
}
const handleAITaskSpotlight = (event: Event) => {
  const customEvent = event as CustomEvent<{ taskIds?: string[]; visualKind?: 'spotlight' | 'changed' | 'pending' | 'removed' }>
  if (!props.task?.id || !customEvent.detail.taskIds?.includes(props.task.id)) return

  if (aiSpotlightTimeout) window.clearTimeout(aiSpotlightTimeout)
  aiSpotlightKind.value = customEvent.detail.visualKind || 'spotlight'
  isAISpotlight.value = true
  aiSpotlightTimeout = window.setTimeout(() => {
    isAISpotlight.value = false
    aiSpotlightTimeout = undefined
  }, 2400)
}
onMounted(() => {
  window.addEventListener('task-action-flash', handleTaskFlash)
  window.addEventListener('ai-task-spotlight', handleAITaskSpotlight)
})
onUnmounted(() => {
  window.removeEventListener('task-action-flash', handleTaskFlash)
  window.removeEventListener('ai-task-spotlight', handleAITaskSpotlight)
  if (aiSpotlightTimeout) window.clearTimeout(aiSpotlightTimeout)
})
</script>

<style scoped>
.task-node {
  border: none !important;
  outline: none !important;
  border-radius: var(--radius-xl);
  /* BUG-1216: backdrop-filter removed for performance - blur(20px) on every node kills pan/zoom */
  background: var(--overlay-component-bg) !important;
  /* Subtle border for definition */
  border: 1px solid var(--glass-border) !important;
  /* TASK-071: Fixed width to force vertical text wrapping instead of horizontal expansion */
  width: 280px;
  min-width: 200px;
  max-width: 320px;
  /* FOUC FIX: Set min-height to prevent collapse before content rendering */
  min-height: var(--space-20);
  position: relative;
  /* BUG-1216: explicit properties only - 'all' causes drag sluggishness via transform */
  transition: box-shadow var(--duration-normal) var(--spring-smooth), border-color var(--duration-normal) var(--spring-smooth), opacity var(--duration-normal) var(--spring-smooth);
  cursor: grab;
  user-select: none;
  /* Clean shadow for depth */
  box-shadow:
    0 var(--space-3) var(--space-6) var(--shadow-color-sm),
    0 var(--space-1_5) var(--space-3) var(--shadow-color-sm);

  box-sizing: border-box;
  display: block;
}

/* Content wrapper */
.task-node-content {
  position: relative;
  padding: var(--space-6);
  border-radius: var(--radius-xl);
  overflow: visible;
}

/* Priority glow overlay - no background, just for colored border effects */
.task-node::before {
  content: '';
  position: absolute;
  top: calc(-1 * var(--space-0_5) / 2);
  left: calc(-1 * var(--space-0_5) / 2);
  right: calc(-1 * var(--space-0_5) / 2);
  bottom: calc(-1 * var(--space-0_5) / 2);
  border-radius: var(--radius-xl);
  pointer-events: none;
  z-index: 1;
}

/* Disable expensive filters at high zoom levels */
.task-node.lod-2 {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  background: var(--overlay-component-bg) !important; /* Solid fallback when blur is disabled */
}

/* BUG-1360: LOD-3 fixed dimensions removed — cards must stay same size at all zoom levels */

.task-node:hover {
  border: none;
  /* BUG-1328: NO transform here — translate/scale on root node conflicts with Vue Flow's
   * transform: translate(x,y) positioning, causing cursor drift on drag in Tauri.
   * Hover lift effect achieved via enhanced box-shadow only. */
  box-shadow:
    0 var(--space-4) var(--space-8) var(--shadow-color-md),
    0 var(--space-2) var(--space-4) var(--shadow-color-sm);
  cursor: grab;
}

.task-node:active {
  cursor: grabbing;
}

/* Connection mode styles */
.task-node.is-connecting {
  border: var(--space-0_5) solid var(--color-navigation) !important;
  box-shadow:
    0 0 var(--space-5) var(--color-navigation),
    0 var(--space-2) var(--space-8) var(--shadow-color-md) !important;
  animation: pulse-connection 2s infinite;
  cursor: crosshair;
}

.task-node.is-connecting::before {
  border: var(--space-0_5) solid var(--color-navigation);
}

@keyframes pulse-connection {
  0%, 100% {
    box-shadow:
      0 0 var(--space-5) var(--color-navigation),
      0 var(--space-2) var(--space-8) var(--shadow-color-md);
  }
  50% {
    box-shadow:
      0 0 var(--space-7_5) var(--color-navigation),
      0 var(--space-3) var(--space-12) var(--shadow-color-md);
  }
}

/* Drag state styles to prevent visual artifacts - only for movement dragging */
.task-node.is-dragging:not(.is-connecting) {
  /* Prevent any transition effects during drag to avoid ghosting */
  transition: none !important;
  animation: none !important;
  /* BUG-1216: scale() conflicts with Vue Flow translate() positioning - removed */
  opacity: 1 !important;
  /* Ensure clean visual state during drag */
  box-shadow: var(--shadow-dark-lg) !important;
  z-index: 1000 !important;
  /* Prevent any blur or filter effects during drag */
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  filter: none !important;
  /* BUG-041: Changed from will-change: transform to auto to prevent text rasterization */
  will-change: auto !important;
  outline: none !important;
  border: none !important;
}

.task-node.is-dragging:hover {
  transform: none !important; /* BUG-1216: prevent hover transform during drag */
}

/* Creation Pulse Animation - Gentle feedback when task is first added to canvas */
.task-node.is-recently-created {
  /* BUG-1807: minimal, compositor-safe entrance (see @keyframes note) */
  animation: animate-creation 0.45s ease-out;
  z-index: 50; /* Ensure it stays above others while animating */
}

/* BUG-1807: The original entrance bounced the card with transform: scale() (plus
 * filter: brightness() and a large animated box-shadow). The Vue Flow transform
 * pane uses `transform-style: preserve-3d` (text-crispness fix, BUG-041/1408), so
 * every node shares one 3D rendering context. Animating a child's `transform`
 * (the scale) forces the browser to re-rasterize that ENTIRE 3D context each frame
 * (CDP showed a full-viewport repaint); on Electron's GPU compositor that full
 * re-raster lands sub-pixel-shifted, so dropping a just-created task made the whole
 * canvas appear to shift/shimmer ("the nudge"). The scale also violated the BUG-1328
 * invariant ("NO transform on the node root").
 *
 * The entrance is now opacity-only: no transform (so the 3D context is never
 * re-rasterized) and no filter — nothing that can shift neighbouring nodes.
 * Verified with CDP LayerTree paint profiling: drop paints 341 -> ~36. */
@keyframes animate-creation {
  0% {
    opacity: 0.4;
  }
  100% {
    opacity: 1;
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

/* TASK-296: Connection handle CSS removed - tasks don't use handles */

/* Prevent text selection during drag, but allow events on root and children */
.task-node * {
  user-select: none;
  pointer-events: auto; /* Changed from none - allows double-click to work! */
}

.task-node:hover::before {
  /* Subtle border enhancement on hover */
  border-color: var(--glass-border-hover);
}

/* Priority-based glow effects on card outline */
.priority-high {
  border-color: var(--priority-high-border) !important;
  box-shadow:
    0 var(--space-3) var(--space-6) var(--shadow-color-sm),
    0 var(--space-1_5) var(--space-3) var(--shadow-color-sm),
    0 0 var(--space-5) rgba(239, 68, 68, 0.15),
    inset 0 0 0 var(--space-0_5) rgba(239, 68, 68, 0.06);
}

.priority-immediate {
  border-color: var(--color-danger) !important;
  box-shadow:
    0 var(--space-3) var(--space-6) var(--shadow-color-sm),
    0 var(--space-1_5) var(--space-3) var(--shadow-color-sm),
    0 0 var(--space-5) rgba(239, 68, 68, 0.2),
    inset 0 0 0 var(--space-0_5) rgba(239, 68, 68, 0.08);
}

.priority-medium {
  border-color: var(--priority-medium-border) !important;
  box-shadow:
    0 var(--space-3) var(--space-6) var(--shadow-color-sm),
    0 var(--space-1_5) var(--space-3) var(--shadow-color-sm),
    0 0 var(--space-5) rgba(245, 158, 11, 0.15),
    inset 0 0 0 var(--space-0_5) rgba(245, 158, 11, 0.06);
}

.priority-low {
  border-color: var(--priority-low-border) !important;
  box-shadow:
    0 var(--space-3) var(--space-6) var(--shadow-color-sm),
    0 var(--space-1_5) var(--space-3) var(--shadow-color-sm),
    0 0 var(--space-5) rgba(59, 130, 246, 0.15),
    inset 0 0 0 var(--space-0_5) rgba(59, 130, 246, 0.06);
}

.priority-relaxed {
  border-color: var(--priority-low-border) !important;
  box-shadow:
    0 var(--space-3) var(--space-6) var(--shadow-color-sm),
    0 var(--space-1_5) var(--space-3) var(--shadow-color-sm),
    0 0 var(--space-5) rgba(59, 130, 246, 0.1),
    inset 0 0 0 var(--space-0_5) rgba(59, 130, 246, 0.04);
}

.timer-active {
  border: none !important;
  box-shadow:
    0 var(--space-4) var(--space-8) var(--shadow-color-md),
    0 var(--space-2) var(--space-4) var(--shadow-color-sm),
    0 0 var(--space-6) var(--blue-shadow) !important;
}

.timer-active::before {
  background: linear-gradient(
    135deg,
    var(--blue-bg-subtle) 0%,
    var(--glass-bg-soft) 100%
  );
}

.status-done {
  /* Use grayscale filter instead of opacity to keep backdrop solid/opaque */
  filter: grayscale(0.6) brightness(0.85);
}

.status-done::before {
  /* Slightly darker/muted purple backdrop for completed tasks */
  background: var(--canvas-task-bg);
}

.selected {
  border: none !important;
  box-shadow: 0 0 0 var(--space-0_5) var(--brand-primary), var(--state-hover-shadow), var(--state-hover-glow) !important;
}

.multi-select-mode {
  cursor: pointer;
}

.multi-select-mode:hover {
  /* BUG-1328: NO transform — scale/translate on root node causes cursor drift.
   * Visual feedback via box-shadow + border-color instead. */
  box-shadow:
    0 0 0 var(--space-0_5) var(--brand-primary),
    0 var(--space-3) var(--space-6) var(--shadow-color-sm),
    0 var(--space-1_5) var(--space-3) var(--shadow-color-sm);
}

/* TASK-1074: Brief flash animation when date is updated */
.is-flashing {
  animation: task-flash-green 0.6s ease-out !important;
}

.priority-high.is-flashing {
  animation: task-flash-red 0.6s ease-out !important;
}

.priority-medium.is-flashing {
  animation: task-flash-amber 0.6s ease-out !important;
}

.priority-low.is-flashing {
  animation: task-flash-blue 0.6s ease-out !important;
}

.ai-spotlight {
  box-shadow:
    0 0 0 var(--space-0_5) color-mix(in srgb, var(--color-focus) 72%, transparent),
    0 0 var(--space-5) color-mix(in srgb, var(--color-focus) 28%, transparent),
    0 var(--space-3) var(--space-6) var(--shadow-color-sm) !important;
  border-color: color-mix(in srgb, var(--color-focus) 65%, var(--glass-border)) !important;
}

.ai-spotlight-changed {
  box-shadow:
    0 0 0 var(--space-0_5) color-mix(in srgb, var(--color-success) 72%, transparent),
    0 0 var(--space-5) color-mix(in srgb, var(--color-success) 30%, transparent),
    0 var(--space-3) var(--space-6) var(--shadow-color-sm) !important;
  border-color: color-mix(in srgb, var(--color-success) 65%, var(--glass-border)) !important;
}

.ai-spotlight-pending {
  box-shadow:
    0 0 0 var(--space-0_5) color-mix(in srgb, var(--color-orange) 72%, transparent),
    0 0 var(--space-5) color-mix(in srgb, var(--color-orange) 30%, transparent),
    0 var(--space-3) var(--space-6) var(--shadow-color-sm) !important;
  border-color: color-mix(in srgb, var(--color-orange) 65%, var(--glass-border)) !important;
}

.ai-spotlight-removed {
  box-shadow:
    0 0 0 var(--space-0_5) color-mix(in srgb, var(--color-danger) 72%, transparent),
    0 0 var(--space-5) color-mix(in srgb, var(--color-danger) 30%, transparent),
    0 var(--space-3) var(--space-6) var(--shadow-color-sm) !important;
  border-color: color-mix(in srgb, var(--color-danger) 65%, var(--glass-border)) !important;
}

@media (prefers-reduced-motion: reduce) {
  .is-flashing {
    animation: none !important;
  }

  .ai-spotlight,
  .ai-spotlight-changed,
  .ai-spotlight-pending,
  .ai-spotlight-removed {
    transition: none !important;
  }
}

/*
 * BUG-1808: These flash keyframes previously bounced the card with transform: scale(1.02).
 * Per the BUG-1807 analysis (see @keyframes animate-creation above), a transform on this
 * backdrop-composited glass card forces Electron to re-rasterize the surrounding 3D context,
 * making every other node appear to shift ("the nudge"). The flash fires on date edits
 * (e.g. rescheduling overdue → today via the context menu), so the nudge surfaced exactly
 * where MASTER_PLAN BUG-1807 predicted. The flash is now transform-free: the brightness +
 * box-shadow glow pulse carries the feedback, no scale → no compositor shift.
 */
@keyframes task-flash-green {
  0% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-success); }
  25% { filter: brightness(1.3); box-shadow: 0 0 var(--space-6_25) var(--space-1_5) var(--color-success); }
  50% { filter: brightness(1.15); box-shadow: 0 0 var(--space-3_75) var(--space-1) var(--color-success); }
  100% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-success); }
}

@keyframes task-flash-red {
  0% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-danger); }
  25% { filter: brightness(1.3); box-shadow: 0 0 var(--space-6_25) var(--space-1_5) var(--color-danger); }
  50% { filter: brightness(1.15); box-shadow: 0 0 var(--space-3_75) var(--space-1) var(--color-danger); }
  100% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-danger); }
}

@keyframes task-flash-amber {
  0% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-orange); }
  25% { filter: brightness(1.3); box-shadow: 0 0 var(--space-6_25) var(--space-1_5) var(--color-orange); }
  50% { filter: brightness(1.15); box-shadow: 0 0 var(--space-3_75) var(--space-1) var(--color-orange); }
  100% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-orange); }
}

@keyframes task-flash-blue {
  0% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-blue); }
  25% { filter: brightness(1.3); box-shadow: 0 0 var(--space-6_25) var(--space-1_5) var(--color-blue); }
  50% { filter: brightness(1.15); box-shadow: 0 0 var(--space-3_75) var(--space-1) var(--color-blue); }
  100% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-blue); }
}
</style>
