<template>
  <div class="hierarchical-task-row" :class="{ 'hierarchical-task-row--mobile': isMobile }">
    <!-- Table-style Task Row -->
    <div
      v-memo="[task.id, task.status, selected, isExpanded, hasSubtasks, isDragging, isDropTarget, isHovered, isFocused]"
      class="task-row"
      :class="{
        'task-row--selected': selected,
        'task-row--has-children': hasSubtasks,
        'task-row--dragging': isDragging,
        'task-row--drop-target': isDropTarget,
        'task-row--mobile': isMobile,
        'task-row--hovered': isHovered,
        'task-row--focused': isFocused,
        'task-row--completed': task.status === 'done',
        'task-row--overdue': isOverdue,
        'task-row--high-priority': task.priority === 'high'
      }"
      :style="{
        paddingLeft: `${indentLevel * 20 + 40}px`,
        '--indent-level': indentLevel
      }"
      draggable="true"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @dragover.prevent="handleDragOver"
      @drop.prevent="handleDrop"
      @dragleave="handleDragLeave"
      @click="handleRowClick"
      @contextmenu.prevent="$emit('contextMenu', $event, task)"
      @focusin="handleFocusIn"
      @focusout="handleFocusOut"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @keydown="handleKeyDown"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
    >
      <!-- Multi-Select Checkbox (when in multi-select mode) -->
      <div v-if="multiSelectMode" class="task-row__select-toggle" @click.stop>
        <MultiSelectToggle
          :selected="selected"
          size="sm"
          :showToolbar="false"
          @change="$emit('toggleSelect', task.id)"
        />
      </div>

      <!-- Done Toggle (Checkbox column) -->
      <div class="task-row__done-toggle" @click.stop>
        <DoneToggle
          :completed="task.status === 'done'"
          size="sm"
          variant="minimal"
          :title="`Mark ${task.title} as ${task.status === 'done' ? 'incomplete' : 'complete'}`"
          :aria-label="`Toggle completion for ${task.title}`"
          @toggle="handleToggleComplete"
        />
      </div>

      <!-- Title (matches TaskTable title-cell) -->
      <div class="task-row__title">
        <span
          class="task-row__title-text"
          :class="{
            'task-row__title-text--completed': task.status === 'done',
            'task-row__title-text--hover': isHovered,
            'task-row__title-text--selected': selected
          }"
          :title="task.title"
        >
          {{ task.title }}
        </span>
        <span
          v-if="hasSubtasks"
          class="subtask-count"
          :class="{
            'subtask-count--completed': isAllSubtasksCompleted,
            'subtask-count--progress': !isAllSubtasksCompleted && completedSubtaskCount > 0
          }"
        >
          {{ completedSubtaskCount }}/{{ childTasks.length }}
        </span>
      </div>

      <!-- Status (matches TaskTable status-cell) -->
      <div class="task-row__status">
        <select
          :value="task.status"
          @change="updateTaskStatus(task.id, ($event.target as HTMLSelectElement).value)"
          class="task-row__status-select"
          title="Change status"
        >
          <option value="planned">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="backlog">Backlog</option>
          <option value="on_hold">On Hold</option>
        </select>
      </div>

      <!-- Priority (matches TaskTable priority-cell) -->
      <div class="task-row__priority">
        <span
          v-if="task.priority"
          class="task-row__priority-badge task-row__priority-badge--clickable"
          :class="{
            'task-row__priority-badge--high': task.priority === 'high',
            'task-row__priority-badge--medium': task.priority === 'medium',
            'task-row__priority-badge--low': task.priority === 'low',
            'task-row__priority-badge--urgent': task.priority === 'urgent'
          }"
          @click.stop="cyclePriority(task.id, task.priority)"
          title="Click to change priority"
        >
          {{ formatPriority(task.priority) }}
        </span>
      </div>

      <!-- Due Date (matches TaskTable due-date-cell) -->
      <div class="task-row__due-date">
        <span v-if="task.dueDate" class="task-row__due-date-content">
          <Calendar :size="14" />
          {{ formatDueDate(task.dueDate) }}
        </span>
        <span v-else class="task-row__no-date">-</span>
      </div>

      <!-- Progress (matches TaskTable progress-cell) -->
      <div class="task-row__progress">
        <div class="task-row__progress-bar">
          <div class="task-row__progress-fill" :style="{ width: `${task.progress || 0}%` }"></div>
          <span class="task-row__progress-text">{{ task.progress || 0 }}%</span>
        </div>
      </div>

      <!-- Actions (matches TaskTable actions-cell) -->
      <div class="task-row__actions">
        <button
          @click.stop="$emit('startTimer', task.id)"
          class="task-row__action-btn"
          title="Start Timer"
          :aria-label="`Start timer for ${task.title}`"
        >
          <Play :size="14" />
        </button>
        <button
          @click.stop="$emit('edit', task.id)"
          class="task-row__action-btn"
          title="Edit Task"
          :aria-label="`Edit ${task.title}`"
        >
          <Edit :size="14" />
        </button>
        <button
          @click.stop="$emit('duplicate', task.id)"
          class="task-row__action-btn"
          title="Duplicate Task"
          :aria-label="`Duplicate ${task.title}`"
        >
          <Copy :size="14" />
        </button>
      </div>
    </div>

    <!-- Subtasks (Recursive) with performance optimization -->
    <template v-if="isExpanded && hasSubtasks">
      <div class="subtasks-container">
        <HierarchicalTaskRow
          v-for="childTask in childTasks"
          :key="childTask.id"
          v-memo="[childTask.id, childTask.status, isExpanded, selected]"
          :task="childTask"
          :indent-level="indentLevel + 1"
          :selected="selected"
          :expanded-tasks="expandedTasks"
          :multi-select-mode="multiSelectMode"
          @select="$emit('select', $event)"
          @toggleSelect="$emit('toggleSelect', $event)"
          @toggleComplete="$emit('toggleComplete', $event)"
          @startTimer="$emit('startTimer', $event)"
          @edit="$emit('edit', $event)"
          @contextMenu="$emit('contextMenu', $event, childTask)"
          @toggleExpand="$emit('toggleExpand', $event)"
          @moveTask="$emit('moveTask', $event.taskId, $event.targetProjectId, $event.targetParentId)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import { Calendar, Play, Edit, Copy } from 'lucide-vue-next'
import { useDragAndDrop, type DragData } from '@/composables/useDragAndDrop'
import DoneToggle from '@/components/DoneToggle.vue'
import MultiSelectToggle from '@/components/MultiSelectToggle.vue'

interface Props {
  task: Task
  indentLevel?: number
  selected?: boolean
  expandedTasks?: Set<string>
  multiSelectMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  indentLevel: 0,
  selected: false,
  expandedTasks: () => new Set(),
  multiSelectMode: false
})

const emit = defineEmits<{
  select: [taskId: string]
  toggleComplete: [taskId: string]
  startTimer: [taskId: string]
  edit: [taskId: string]
  duplicate: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
  toggleExpand: [taskId: string]
  moveTask: [taskId: string, targetProjectId: string | null, targetParentId: string | null]
  updateTask: [taskId: string, updates: Partial<Task>]
}>()

const taskStore = useTaskStore()
const { startDrag, endDrag } = useDragAndDrop()
const isDragging = ref(false)
const isDropTarget = ref(false)
const isMobile = ref(false)
const isFocused = ref(false)
const isHovered = ref(false)
const showTouchFeedback = ref(false)
const touchFeedbackStyle = ref({})
const isTimerActive = ref(false)
const animationFrameId = ref<number>()

// Mobile detection with responsive breakpoint
const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

// Performance optimization: throttle expensive computations
let resizeTimeout: NodeJS.Timeout
const handleResize = () => {
  clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(checkMobile, 100)
}

const hasSubtasks = computed(() =>
  taskStore.hasNestedTasks(props.task.id)
)

const isExpanded = computed(() =>
  props.expandedTasks.has(props.task.id)
)

const childTasks = computed(() =>
  taskStore.getTaskChildren(props.task.id)
)

const completedSubtaskCount = computed(() =>
  childTasks.value.filter(task => task.status === 'done').length
)

// Enhanced computed properties for advanced interactions
const isAllSubtasksCompleted = computed(() =>
  hasSubtasks.value && completedSubtaskCount.value === childTasks.value.length
)

const subtaskProgressPercentage = computed(() => {
  if (!hasSubtasks.value) return 0
  return Math.round((completedSubtaskCount.value / childTasks.value.length) * 100)
})

const isOverdue = computed(() => {
  if (!props.task.dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(props.task.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  return dueDate < today
})

const toggleExpanded = () => {
  if (hasSubtasks.value) {
    emit('toggleExpand', props.task.id)
  }
}

const handleRowClick = () => {
  emit('select', props.task.id)
}

const handleToggleComplete = (completed: boolean) => {
  emit('toggleComplete', props.task.id)
}

const handleSelectionChange = (selected: boolean) => {
  if (selected) {
    emit('select', props.task.id)
  } else {
    // We would need a deselect event in the parent
    emit('select', props.task.id)
  }
}

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

const formatPriority = (priority: string): string => {
  const priorityMap: Record<string, string> = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'urgent': 'Urgent'
  }
  return priorityMap[priority] || priority
}

// Interactive methods for inline editing
const updateTaskStatus = (taskId: string, status: string) => {
  emit('updateTask', taskId, { status })
}

const cyclePriority = (taskId: string, currentPriority?: string) => {
  const priorities = ['low', 'medium', 'high', 'urgent']
  const currentIndex = priorities.indexOf(currentPriority || 'medium')
  const nextIndex = (currentIndex + 1) % priorities.length
  emit('updateTask', taskId, { priority: priorities[nextIndex] })
}

// Enhanced event handlers with sophisticated interactions
const handleMouseEnter = () => {
  isHovered.value = true
}

const handleMouseLeave = () => {
  isHovered.value = false
}

// Enhanced touch feedback for mobile
const handleTouchStart = (event: TouchEvent) => {
  if (!isMobile.value) return

  const touch = event.touches[0]
  const rect = event.currentTarget?.getBoundingClientRect()
  if (rect) {
    touchFeedbackStyle.value = {
      left: `${touch.clientX - rect.left}px`,
      top: `${touch.clientY - rect.top}px`
    }
  }

  showTouchFeedback.value = true
}

const handleTouchEnd = () => {
  if (!isMobile.value) return
  setTimeout(() => {
    showTouchFeedback.value = false
  }, 200)
}

// Celebration handling for enhanced feedback
const handleCelebrationStart = () => {
  // Could trigger parent component celebration or confetti
  console.log(`Celebration started for task: ${props.task.title}`)
}

const handleCelebrationEnd = () => {
  // Could trigger analytics or achievement tracking
  console.log(`Celebration ended for task: ${props.task.title}`)
}

// Enhanced date utilities
const getDueDateIconClass = (): string => {
  if (!props.task.dueDate) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(props.task.dueDate)
  dueDate.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'task-row__icon--overdue'
  if (diffDays === 0) return 'task-row__icon--today'
  if (diffDays <= 3) return 'task-row__icon--soon'
  return ''
}

const getFullDueDateText = (): string => {
  if (!props.task.dueDate) return ''
  const date = new Date(props.task.dueDate)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Enhanced keyboard navigation
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      handleRowClick()
      break
    case 'ArrowRight':
      if (hasSubtasks.value && !isExpanded.value) {
        event.preventDefault()
        toggleExpanded()
      }
      break
    case 'ArrowLeft':
      if (hasSubtasks.value && isExpanded.value) {
        event.preventDefault()
        toggleExpanded()
      }
      break
    case 'd':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        emit('toggleComplete', props.task.id)
      }
      break
    case 'e':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        emit('edit', props.task.id)
      }
      break
  }
}

// Performance optimization for smooth animations
const smoothStateTransition = (callback: () => void) => {
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
  }

  animationFrameId.value = requestAnimationFrame(() => {
    callback()
    animationFrameId.value = undefined
  })
}

// Drag and drop handlers
const handleDragStart = (event: DragEvent) => {
  if (!event.dataTransfer) return

  isDragging.value = true

  const dragData: DragData = {
    type: 'task',
    taskId: props.task.id,
    title: props.task.title,
    source: 'kanban' // Using kanban as generic source
  }

  startDrag(dragData)
  event.dataTransfer.setData('application/json', JSON.stringify(dragData))
  event.dataTransfer.effectAllowed = 'move'
}

const handleDragEnd = () => {
  isDragging.value = false
  isDropTarget.value = false
  endDrag()
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDropTarget.value = true
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const handleDragLeave = () => {
  isDropTarget.value = false
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDropTarget.value = false

  const dataString = event.dataTransfer?.getData('application/json')
  if (!dataString) return

  try {
    const dragData = JSON.parse(dataString) as DragData
    if (dragData.type === 'task' && dragData.taskId && dragData.taskId !== props.task.id) {
      // Dropped task becomes a subtask of this task
      emit('moveTask', dragData.taskId, props.task.projectId || null, props.task.id)
    }
  } catch (error) {
    console.error('Failed to parse drag data:', error)
  }
}

// Focus handlers for accessibility
const handleFocusIn = () => {
  isFocused.value = true
}

const handleFocusOut = () => {
  isFocused.value = false
}

// Enhanced lifecycle hooks for performance optimization
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', handleResize, { passive: true })

  // Pre-compute animation frames for better performance
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Second RAF ensures browser paint completion
    })
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  clearTimeout(resizeTimeout)

  // Clean up animation frames
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
  }
})
</script>

<style scoped>
/* Hierarchical task row wrapper */
.hierarchical-task-row {
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Table-style task row matching TaskTable exactly */
.task-row {
  display: grid;
  grid-template-columns: 40px 1fr 120px 100px 120px 100px 100px;
  grid-template-areas: "done title status priority due progress actions";
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-secondary);
  cursor: pointer;
  transition: background-color var(--duration-fast) ease;
  position: relative;
  --indent-level: 0;
}

/* Match TaskTable hover and selected states */
.task-row:hover {
  background-color: var(--surface-hover);
}

.task-row--selected {
  background-color: var(--color-primary-alpha-10);
}

.task-row--completed {
  opacity: 0.7;
}

/* Mobile optimizations */
.hierarchical-task-row--mobile .task-row {
  grid-template-columns: 40px 1fr;
  grid-template-areas: "done title";
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
}

.hierarchical-task-row--mobile .task-row__status,
.hierarchical-task-row--mobile .task-row__priority,
.hierarchical-task-row--mobile .task-row__due-date,
.hierarchical-task-row--mobile .task-row__progress,
.hierarchical-task-row--mobile .task-row__actions {
  display: none;
}

/* Table Cells - Match TaskTable exactly */
.task-row__done-toggle {
  grid-area: done;
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-row__title {
  grid-area: title;
  display: flex;
  align-items: center;
  font-weight: var(--font-medium);
  color: var(--text-primary);
  gap: var(--space-2);
  min-width: 0;
}

.task-row__title-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-row__title-text--completed {
  text-decoration: line-through;
  color: var(--text-tertiary);
}

/* Subtask count */
.subtask-count {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-tertiary);
  background-color: var(--surface-tertiary);
  padding: 2px var(--space-1_5);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.subtask-count--completed {
  background-color: var(--success-bg-light);
  color: var(--color-success);
}

.subtask-count--progress {
  background-color: var(--blue-bg-light);
  color: var(--color-info);
}

/* Status cell - Match TaskTable */
.task-row__status {
  grid-area: status;
  display: flex;
  align-items: center;
}

.task-row__status-select {
  padding: var(--space-1) var(--space-2);
  background-color: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}

.task-row__status-select:hover {
  background-color: var(--surface-hover);
  border-color: var(--border-medium);
}

/* Priority cell - Match TaskTable */
.task-row__priority {
  grid-area: priority;
  display: flex;
  align-items: center;
}

.task-row__priority-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: transform var(--duration-fast) ease;
}

.task-row__priority-badge:hover {
  transform: scale(1.05);
}

.task-row__priority-badge--high {
  background-color: var(--color-error-alpha-10);
  color: var(--color-error);
}

.task-row__priority-badge--medium {
  background-color: var(--color-warning-alpha-10);
  color: var(--color-warning);
}

.task-row__priority-badge--low {
  background-color: var(--blue-bg-light);
  color: var(--color-info);
}

.task-row__priority-badge--urgent {
  background-color: var(--color-error);
  color: white;
}

/* Due Date cell - Match TaskTable */
.task-row__due-date {
  grid-area: due;
  display: flex;
  align-items: center;
}

.task-row__due-date-content {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.task-row__no-date {
  color: var(--text-tertiary);
}

/* Progress cell - Match TaskTable */
.task-row__progress {
  grid-area: progress;
  display: flex;
  align-items: center;
}

.task-row__progress-bar {
  position: relative;
  width: 100%;
  height: 20px;
  background-color: var(--surface-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.task-row__progress-fill {
  position: absolute;
  top: 0;
  inset-inline-start: 0; /* RTL: progress fill starts from start edge */
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover));
  transition: width var(--duration-normal) ease;
}

.task-row__progress-text {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  z-index: 1;
}

/* Actions cell - Match TaskTable */
.task-row__actions {
  grid-area: actions;
  display: flex;
  align-items: center;
  gap: var(--space-2);
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
  padding: var(--space-1);
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
}

/* Subtasks container - Preserve nesting functionality */
.subtasks-container {
  display: flex;
  flex-direction: column;
  position: relative;
}

.subtasks-container .task-row {
  opacity: 0.9;
  border-inline-start: 2px solid var(--border-subtle); /* RTL: subtask indent border */
}

.subtasks-container .task-row:hover {
  opacity: 1;
  border-inline-start-color: var(--color-primary); /* RTL: hover border color */
}

/* Drag and drop states */
.task-row--dragging {
  opacity: 0.5;
}

.task-row--drop-target {
  background-color: var(--color-primary-alpha-10);
  border-top: 2px solid var(--color-primary);
  border-bottom: 2px solid var(--color-primary);
}

/* Accessibility support */
@media (prefers-reduced-motion: reduce) {
  .task-row {
    transition: none;
  }

  .task-row__action-btn {
    transition: none;
  }
}
</style>
