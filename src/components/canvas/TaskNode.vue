<template>
  <div
    class="task-node"
    :data-task-id="task?.id"
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
      'is-recently-created': isRecentlyCreated,
      'is-flashing': isFlashing,
      'lod-1': isLOD1,
      'lod-2': isLOD2,
      'lod-3': isLOD3
    }"
    @click="handleClick"
    @mousedown="handleMouseDown"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Content wrapper -->
    <div class="task-node-content">
      <!-- Priority Badge -->
      <TaskNodePriority v-if="showPriority" />

      <!-- Header (Title + Timer) -->
      <TaskNodeHeader
        v-if="!isLOD3"
        :title="task?.title"
        :is-timer-active="isTimerActive"
        :alignment-classes="titleAlignmentClasses"
      />

      <!-- Description -->
      <TaskNodeDescription
        v-if="task?.description && !isLOD1"
        :description="task?.description"
        :is-expanded="isDescriptionExpanded"
        :is-long="!!isDescriptionLong(task?.description)"
        :alignment-classes="titleAlignmentClasses"
        @checkbox-click="handleCheckboxClick"
        @toggle-expand="toggleDescriptionExpanded"
      />

      <!-- Metadata -->
      <TaskNodeMeta
        v-if="!isLOD2"
        :show-status="showStatus"
        :status-label="statusLabel"
        :due-date="task?.dueDate"
        :formatted-due-date="formattedDueDate"
        :show-schedule="showSchedule"
        :has-schedule="!!hasSchedule"
        :show-duration="showDuration"
        :duration="task?.estimatedDuration"
        :duration-badge-class="durationBadgeClass"
        :duration-icon="durationIcon"
        :formatted-duration="formattedDuration"
        :is-done="task?.status === 'done'"
        :is-overdue="isOverdue"
        @reschedule="handleReschedule"
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
      :connectable="true"
      class="handle-target"
    />
    <Handle
      v-if="isInVueFlowContext"
      id="source"
      type="source"
      :position="Position.Bottom"
      :connectable="true"
      class="handle-source"
    />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, computed, ref, onMounted, onUnmounted } from 'vue'
import { Position } from '@vue-flow/core'
import type { Task } from '@/types/tasks'
import { useTaskNodeState } from '@/composables/canvas/node/useTaskNodeState'
import { useTaskNodeActions } from '@/composables/canvas/node/useTaskNodeActions'

// Sub-components
import TaskNodeHeader from './node/TaskNodeHeader.vue'
import TaskNodeDescription from './node/TaskNodeDescription.vue'
import TaskNodeMeta from './node/TaskNodeMeta.vue'
import TaskNodePriority from './node/TaskNodePriority.vue'
import TaskNodeSelection from './node/TaskNodeSelection.vue'

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

// Lazy load Handle component
const Handle = defineAsyncComponent(() =>
  import('@vue-flow/core').then(mod => mod.Handle)
)

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

// Actions Logic
const {
  isDescriptionExpanded,
  isDescriptionLong,
  toggleDescriptionExpanded,
  handleCheckboxClick,
  handleClick,
  handleMouseDown,
  handleContextMenu,
  handleReschedule
} = useTaskNodeActions(props, emit)

// TASK-262: Selection is handled via:
// 1. @click="handleClick" on the template (for clicks that reach the component)
// 2. @node-click on the VueFlow component in CanvasView (for Vue Flow's internal events)
// 3. selectCallback prop for direct callback when emits don't work
// TASK-279: Edit (double-click) is handled via:
// 1. Manual double-click detection in handleClick (native @dblclick doesn't work due to DOM changes)
// 2. editCallback prop for direct callback when emits don't work in Vue Flow

// TASK-1074: Flash animation when date is set via context menu
const isFlashing = ref(false)
const handleTaskFlash = (event: Event) => {
  const customEvent = event as CustomEvent<{ taskId: string }>
  console.log('[FLASH] TaskNode received event:', customEvent.detail.taskId, 'my id:', props.task?.id)
  if (customEvent.detail.taskId === props.task?.id) {
    console.log('[FLASH] Match! Setting isFlashing=true')
    isFlashing.value = true
    setTimeout(() => { isFlashing.value = false }, 600)
  }
}
onMounted(() => {
  window.addEventListener('task-action-flash', handleTaskFlash)
})
onUnmounted(() => {
  window.removeEventListener('task-action-flash', handleTaskFlash)
})
</script>

<style scoped>
.task-node {
  border: none !important;
  outline: none !important;
  border-radius: var(--radius-xl);
  /* Glassmorphism: semi-transparent background with blur */
  background: rgba(28, 30, 38, 0.55) !important;
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  /* Subtle border for definition */
  border: 1px solid var(--glass-border) !important;
  /* TASK-071: Fixed width to force vertical text wrapping instead of horizontal expansion */
  width: 280px;
  min-width: 200px;
  max-width: 320px;
  /* FOUC FIX: Set min-height to prevent collapse before content rendering */
  min-height: 80px;
  position: relative;
  transition: all var(--duration-normal) var(--spring-smooth);
  cursor: grab;
  user-select: none;
  /* Clean shadow for depth */
  box-shadow:
    0 12px 24px var(--shadow-md),
    0 6px 12px var(--shadow-md);

  box-sizing: border-box;
  display: block;
}

/* Content wrapper - allow shadows/borders to extend beyond */
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
  top: -1px;
  left: -1px;
  right: -1px;
  bottom: -1px;
  border-radius: var(--radius-xl);
  pointer-events: none;
  z-index: 1;
}

/* Disable expensive filters at high zoom levels */
.task-node.lod-2 {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  background: rgba(28, 30, 38, 0.95) !important; /* Solid fallback when blur is disabled */
}

.task-node.lod-3 {
  width: 120px;
  min-width: 120px;
  height: 60px;
  box-shadow: none;
  border: 4px solid rgba(255, 255, 255, 0.4);
}

.task-node.lod-3 .task-node-content {
  padding: 0;
  height: 100%;
}

.task-node:hover {
  border: none;
  transform: translate3d(0, -2px, 0);
  /* Enhanced shadow on hover - v0.9.0 style */
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
  filter: none !important;
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
  border-color: rgba(239, 68, 68, 0.5) !important;
  box-shadow:
    0 12px 24px var(--shadow-md),
    0 6px 12px var(--shadow-md),
    0 0 20px rgba(239, 68, 68, 0.25),
    inset 0 0 0 1px rgba(239, 68, 68, 0.1);
}

.priority-medium {
  border-color: rgba(245, 158, 11, 0.5) !important;
  box-shadow:
    0 12px 24px var(--shadow-md),
    0 6px 12px var(--shadow-md),
    0 0 20px rgba(245, 158, 11, 0.25),
    inset 0 0 0 1px rgba(245, 158, 11, 0.1);
}

.priority-low {
  border-color: rgba(59, 130, 246, 0.5) !important;
  box-shadow:
    0 12px 24px var(--shadow-md),
    0 6px 12px var(--shadow-md),
    0 0 20px rgba(59, 130, 246, 0.25),
    inset 0 0 0 1px rgba(59, 130, 246, 0.1);
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

.status-done {
  /* Use grayscale filter instead of opacity to keep backdrop solid/opaque */
  filter: grayscale(0.6) brightness(0.85);
}

.status-done::before {
  /* Slightly darker/muted backdrop for completed tasks */
  background: rgba(35, 38, 48, 0.70);
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

/* TASK-1074: Brief flash animation when date is updated */
.is-flashing {
  animation: task-flash 0.5s ease-out !important;
}

@keyframes task-flash {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 #10b981;
  }
  30% {
    transform: scale(1.03);
    box-shadow: 0 0 30px 8px #10b981;
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 #10b981;
  }
}
</style>
