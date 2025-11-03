<template>
  <div
    class="task-node"
    :class="{
      'priority-high': task.priority === 'high',
      'priority-medium': task.priority === 'medium',
      'priority-low': task.priority === 'low',
      'status-done': task.status === 'done',
      'status-in-progress': task.status === 'in_progress',
      'selected': isSelected,
      'multi-select-mode': multiSelectMode
    }"
    draggable="true"
    @dragstart="handleDragStart"
    @dragend="endDrag"
    @dblclick="$emit('edit', task)"
    @click="handleClick"
    @contextmenu.prevent="handleContextMenu"
  >
    <!-- Priority Badge -->
    <div v-if="showPriority" class="priority-indicator"></div>

    <!-- Title -->
    <div class="task-title">{{ task.title }}</div>

    <!-- Metadata -->
    <div class="task-metadata">
      <span v-if="showStatus" class="status-badge">{{ statusLabel }}</span>
      <span v-if="showSchedule && hasSchedule" class="schedule-badge" title="Scheduled">
        📅
      </span>
      <span v-if="showDuration && task.estimatedDuration" class="duration-badge">
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

    <!-- Connection Handles -->
    <Handle type="target" :position="Position.Top" class="handle-target" />
    <Handle type="source" :position="Position.Bottom" class="handle-source" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { Task } from '@/stores/tasks'
import { useDragAndDrop, type DragData } from '@/composables/useDragAndDrop'

interface Props {
  task: Task
  isSelected?: boolean
  multiSelectMode?: boolean
  showPriority?: boolean
  showStatus?: boolean
  showDuration?: boolean
  showSchedule?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  multiSelectMode: false,
  showPriority: true,
  showStatus: true,
  showDuration: true,
  showSchedule: true
})

const emit = defineEmits<{
  edit: [task: Task]
  select: [task: Task, multiSelect: boolean]
  contextMenu: [event: MouseEvent, task: Task]
}>()

const { startDrag, endDrag } = useDragAndDrop()

const statusLabel = computed(() => {
  const labels = {
    planned: 'Plan',
    in_progress: 'Active',
    done: 'Done',
    backlog: 'Back'
  }
  return labels[props.task.status]
})

const hasSchedule = computed(() =>
  props.task.instances && props.task.instances.length > 0
)

// Drag handler using new composable
const handleDragStart = (event: DragEvent) => {
  if (event.dataTransfer) {
    const dragData: DragData = {
      type: 'task',
      taskId: props.task.id,
      title: props.task.title,
      source: 'canvas'
    }

    // Use new composable for global drag state
    startDrag(dragData)

    // Still set dataTransfer for HTML5 drag-and-drop compatibility
    event.dataTransfer.setData('application/json', JSON.stringify(dragData))
    event.dataTransfer.effectAllowed = 'move'
  }
}

// Event handlers
const handleClick = (event: MouseEvent) => {
  if (props.multiSelectMode) {
    event.stopPropagation()
    emit('select', props.task, event.ctrlKey || event.metaKey)
  }
}

const handleContextMenu = (event: MouseEvent) => {
  emit('contextMenu', event, props.task)
}
</script>

<style scoped>
.task-node {
  border: 2px solid var(--glass-border-medium);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  min-width: 220px;
  max-width: 280px;
  position: relative;
  transition: all var(--duration-normal) var(--spring-smooth);
  cursor: grab;
  user-select: none;
  box-shadow:
    0 12px 24px var(--shadow-md),
    0 6px 12px var(--shadow-md),
    inset 0 1px 0 var(--glass-border);

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
  border-color: var(--glass-border-strong);
  transform: translate3d(0, -2px, 0);
  box-shadow:
    0 16px 32px var(--shadow-strong),
    0 8px 16px var(--shadow-md),
    inset 0 1px 0 var(--glass-border-soft);
  cursor: grab;
}

.task-node:active {
  cursor: grabbing;
}

/* Prevent text selection during drag */
.task-node * {
  pointer-events: none;
  user-select: none;
}

/* Allow clicks on task content but prevent drag conflicts */
.task-node .task-title,
.task-node .task-metadata,
.task-node .priority-indicator,
.task-node .status-badge,
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
}

.priority-high .priority-indicator {
  background: var(--color-priority-high);
  box-shadow: var(--priority-high-glow);
}

.priority-medium .priority-indicator {
  background: var(--color-work);
  box-shadow: var(--priority-medium-glow);
}

.priority-low .priority-indicator {
  background: var(--color-priority-low);
  box-shadow: var(--priority-low-glow);
}

.status-done {
  opacity: 0.5;
}

.status-done .task-title {
  text-decoration: line-through;
}

.status-in-progress {
  border-color: var(--state-active-border);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.selected {
  border-color: var(--state-active-border) !important;
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
  text-shadow: 0 1px 2px var(--shadow-subtle);
}

.task-metadata {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  flex-wrap: wrap;
}

.status-badge,
.duration-badge {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-3);
  background: var(--glass-bg-soft);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  box-shadow: 0 2px 4px var(--shadow-subtle);
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
}

.handle-target:hover,
.handle-source:hover {
  width: 18px !important;
  height: 18px !important;
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow) !important;
}
</style>
