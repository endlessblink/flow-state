<template>
  <div
    class="task-row"
    :class="[
      `task-row--${density}`,
      { 'task-row--selected': selected, 'task-row--anchor': isAnchorRow }
    ]"
    draggable="true"
    @click="$emit('select', task.id)"
    @contextmenu.prevent="$emit('contextMenu', $event, task)"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
  >
    <!-- Checkbox -->
    <div class="task-row__checkbox" @click.stop>
      <input
        type="checkbox"
        :checked="task.status === 'done'"
        @change="$emit('toggleComplete', task.id)"
        :aria-label="`Mark ${task.title} as ${task.status === 'done' ? 'incomplete' : 'complete'}`"
      />
    </div>

    <!-- Title (flexible, main focus) -->
    <div class="task-row__title">
      <span class="task-row__title-text">{{ task.title }}</span>
    </div>

    <!-- Due Date -->
    <div class="task-row__due-date">
      <Calendar v-if="task.dueDate" :size="14" class="task-row__icon" />
      <span v-if="task.dueDate" :class="getDueDateClass()">
        {{ formatDueDate(task.dueDate) }}
      </span>
      <span v-else class="task-row__empty">-</span>
    </div>

    <!-- Priority Badge -->
    <div class="task-row__priority">
      <span
        v-if="task.priority"
        class="task-row__badge"
        :class="`task-row__badge--${task.priority}`"
      >
        {{ task.priority }}
      </span>
      <span v-else class="task-row__empty">-</span>
    </div>

    <!-- Status Badge -->
    <div class="task-row__status">
      <span class="task-row__badge task-row__badge--status" :class="`task-row__badge--${task.status}`">
        {{ formatStatus(task.status) }}
      </span>
    </div>

    <!-- Tags (progressive disclosure - visible on hover) -->
    <div class="task-row__tags">
      <span
        v-for="tag in visibleTags"
        :key="tag"
        class="task-row__tag"
      >
        {{ tag }}
      </span>
      <span v-if="hasMoreTags" class="task-row__tag-more">
        +{{ task.tags.length - maxVisibleTags }}
      </span>
    </div>

    <!-- Quick Actions (hover only) -->
    <div class="task-row__actions">
      <button
        @click.stop="$emit('startTimer', task.id)"
        class="task-row__action-btn"
        title="Start Timer"
      >
        <Play :size="14" />
      </button>
      <button
        @click.stop="$emit('edit', task.id)"
        class="task-row__action-btn"
        title="Edit Task"
      >
        <Edit :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@/stores/tasks'
import { Calendar, Play, Edit } from 'lucide-vue-next'
import type { DensityType } from '@/components/ViewControls.vue'
import { useDragAndDrop, type DragData } from '@/composables/useDragAndDrop'

interface Props {
  task: Task
  density: DensityType
  selected?: boolean
  rowIndex: number // For ADHD anchor highlighting
}

const props = defineProps<Props>()

defineEmits<{
  select: [taskId: string]
  toggleComplete: [taskId: string]
  startTimer: [taskId: string]
  edit: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
}>()

// ADHD-friendly: Every 5th row gets visual anchor
const isAnchorRow = computed(() => (props.rowIndex + 1) % 5 === 0)

// Tag truncation for space efficiency
const maxVisibleTags = 2
const visibleTags = computed(() =>
  props.task.tags?.slice(0, maxVisibleTags) || []
)
const hasMoreTags = computed(() =>
  (props.task.tags?.length || 0) > maxVisibleTags
)

// Due date formatting and coloring
const formatDueDate = (dateString: string): string => {
  const date = new Date(dateString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const getDueDateClass = (): string => {
  if (!props.task.dueDate) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(props.task.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'task-row__date--overdue'
  if (diffDays === 0) return 'task-row__date--today'
  if (diffDays <= 3) return 'task-row__date--soon'
  return ''
}

const formatStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'planned': 'To Do',
    'in_progress': 'In Progress',
    'done': 'Done',
    'backlog': 'Backlog',
    'on_hold': 'On Hold'
  }
  return statusMap[status] || status
}

// Drag and drop functionality
const { startDrag, endDrag } = useDragAndDrop()

const handleDragStart = (event: DragEvent) => {
  if (!event.dataTransfer) return

  const dragData: DragData = {
    type: 'task',
    taskId: props.task.id,
    title: props.task.title,
    source: 'table'
  }

  // Use composable for global drag state
  startDrag(dragData)

  // Set HTML5 drag data for compatibility
  event.dataTransfer.setData('application/json', JSON.stringify(dragData))
  event.dataTransfer.effectAllowed = 'move'

  // Add local dragging class for visual feedback
  if (event.target instanceof HTMLElement) {
    event.target.classList.add('dragging')
  }
}

const handleDragEnd = () => {
  endDrag()
  // Reset visual feedback
  const draggingRows = document.querySelectorAll('.task-row.dragging')
  draggingRows.forEach(row => {
    row.classList.remove('dragging')
  })
}
</script>

<style scoped>
/* Base Row - 32px height optimized for scanning */
.task-row {
  display: grid;
  grid-template-columns: 40px 1fr 100px 80px 100px 140px 80px;
  grid-template-areas: "checkbox title due priority status tags actions";
  height: 32px;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
  background-color: var(--surface-secondary);
  cursor: pointer;
  transition: background-color var(--duration-fast) ease;
  contain: layout style size; /* Performance optimization */
}

.task-row:hover {
  background-color: var(--surface-hover);
}

.task-row--selected {
  background-color: var(--color-primary-alpha-10);
  border-left: 3px solid var(--color-primary);
}

/* ADHD Visual Anchor - Every 5th row */
.task-row--anchor {
  background-color: var(--surface-tertiary);
}

.task-row--anchor:hover {
  background-color: var(--surface-hover);
}

/* Density Variants */
.task-row--compact {
  height: 28px;
  font-size: var(--text-sm);
}

.task-row--comfortable {
  height: 32px;
  font-size: var(--text-base);
}

.task-row--spacious {
  height: 36px;
  font-size: var(--text-base);
  padding: 0 var(--space-4);
}

/* Checkbox Cell */
.task-row__checkbox {
  grid-area: checkbox;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-row__checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* Title Cell - Flexible, main focus */
.task-row__title {
  grid-area: title;
  min-width: 0; /* Critical for text truncation */
  overflow: hidden;
}

.task-row__title-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

/* Due Date Cell */
.task-row__due-date {
  grid-area: due;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 12px;
  color: var(--text-secondary);
}

.task-row__icon {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.task-row__date--overdue {
  color: var(--color-error);
  font-weight: 600;
}

.task-row__date--today {
  color: var(--color-warning);
  font-weight: 500;
}

.task-row__date--soon {
  color: var(--color-info);
}

/* Priority Badge */
.task-row__priority {
  grid-area: priority;
}

.task-row__badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
  white-space: nowrap;
}

.task-row__badge--high {
  background-color: var(--color-error-alpha-10);
  color: var(--color-error);
}

.task-row__badge--medium {
  background-color: var(--color-warning-alpha-10);
  color: var(--color-warning);
}

.task-row__badge--low {
  background-color: var(--blue-bg-light);
  color: var(--color-info);
}

/* Status Badge */
.task-row__status {
  grid-area: status;
}

.task-row__badge--planned {
  background-color: var(--surface-tertiary);
  color: var(--text-secondary);
}

.task-row__badge--in_progress {
  background-color: var(--blue-bg-light);
  color: var(--color-info);
}

.task-row__badge--done {
  background-color: var(--success-bg-light);
  color: var(--color-success);
}

.task-row__badge--backlog {
  background-color: var(--purple-bg-subtle);
  color: var(--color-primary);
}

.task-row__badge--on_hold {
  background-color: var(--orange-bg-light);
  color: var(--color-warning);
}

/* Tags Cell - Progressive disclosure */
.task-row__tags {
  grid-area: tags;
  display: flex;
  gap: var(--space-1);
  overflow: hidden;
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
}

.task-row:hover .task-row__tags {
  opacity: 1;
}

.task-row__tag {
  padding: 2px var(--space-1_5);
  background-color: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.task-row__tag-more {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 500;
}

/* Actions Cell - Hover only */
.task-row__actions {
  grid-area: actions;
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
}

.task-row:hover .task-row__actions {
  opacity: 1;
}

.task-row__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background-color: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
}

.task-row__action-btn:hover {
  background-color: var(--surface-hover);
  border-color: var(--border-medium);
  color: var(--text-primary);
  transform: scale(1.05);
}

/* Empty state indicator */
.task-row__empty {
  color: var(--text-tertiary);
  font-size: 12px;
}

/* Focus state for accessibility */
.task-row:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  z-index: 1;
}

/* Drag and drop styles */
.task-row[draggable="true"] {
  cursor: grab;
}

.task-row[draggable="true"]:active {
  cursor: grabbing;
}

/* Local dragging state */
.task-row.dragging {
  opacity: 0.6 !important;
  transform: rotate(2deg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

/* Global dragging state - fade non-target rows */
:global(body.dragging-active) .task-row {
  opacity: 0.8;
  transition: opacity var(--duration-fast);
}

/* Keep dragged row fully visible */
:global(body.dragging-active) .task-row.dragging {
  opacity: 1 !important;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .task-row,
  .task-row__tags,
  .task-row__actions,
  .task-row__action-btn {
    transition: none;
  }

  .task-row.dragging {
    transform: none;
  }
}
</style>
