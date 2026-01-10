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
      'is-recently-created': isRecentlyCreated,
      'lod-1': isLOD1,
      'lod-2': isLOD2,
      'lod-3': isLOD3
    }"
    @dblclick="$emit('edit', task)"
    @click="handleClick"
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
        :is-long="isDescriptionLong(task?.description)"
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
        :has-schedule="hasSchedule"
        :show-duration="showDuration"
        :duration="task?.estimatedDuration"
        :duration-badge-class="durationBadgeClass"
        :duration-icon="durationIcon"
        :formatted-duration="formattedDuration"
        :is-done="task?.status === 'done'"
      />
    </div>

    <!-- Selection Indicator -->
    <TaskNodeSelection v-if="isSelected" />

    <!-- Connection Handles (Vue Flow) -->
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
import { defineAsyncComponent, computed } from 'vue'
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
  showSchedule?: boolean
  isConnecting?: boolean
  isDragging?: boolean
}

// State Logic
const {
  isLOD1,
  isLOD2,
  isLOD3,
  titleAlignmentClasses,
  isNodeDragging,
  isRecentlyCreated,
  statusLabel,
  hasSchedule,
  formattedDueDate,
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
  handleContextMenu
} = useTaskNodeActions(props, emit)
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
  /* FOUC FIX: Set min-height to prevent collapse before content rendering */
  min-height: 80px;
  position: relative;
  transition: all var(--duration-normal) var(--spring-smooth);
  cursor: grab;
  user-select: none;
  /* TASK-079: High-visibility shadow with strong white halo */
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(0, 0, 0, 0.3),
    /* ZOOM FIX: Very strong white halo for zoom-out visibility */
    0 0 80px 20px rgba(255, 255, 255, 0.25),
    /* White outline for separation */
    0 0 0 1px rgba(255, 255, 255, 0.20);

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

/* TASK-074 + TASK-079: High-visibility background layer */
.task-node::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* Glass morphism - translucent background with visible blur */
  background: rgba(42, 45, 55, 0.65);
  /* Increased blur to properly blur canvas dots */
  backdrop-filter: blur(32px) saturate(1.3);
  -webkit-backdrop-filter: blur(32px) saturate(1.3);
  border-radius: var(--radius-xl);
  /* TASK-079: Thick visible border for zoom-out */
  border: 2px solid rgba(255, 255, 255, 0.25);
  z-index: -1;
}

/* Disable expensive filters at high zoom levels */
.task-node.lod-2::before {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  background: rgba(42, 45, 55, 0.95); /* More opaque since blur is gone */
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
  /* TASK-079: High-visibility enhanced hover shadow */
  box-shadow:
    0 20px 56px rgba(0, 0, 0, 0.55),
    0 10px 28px rgba(0, 0, 0, 0.35),
    /* ZOOM FIX: Very strong halo on hover */
    0 0 100px 25px rgba(255, 255, 255, 0.35),
    0 0 0 2px rgba(255, 255, 255, 0.30);
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

.task-node:hover::before {
  background: linear-gradient(
    135deg,
    var(--glass-border-soft) 0%,
    var(--glass-bg-heavy) 100%
  );
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
</style>
