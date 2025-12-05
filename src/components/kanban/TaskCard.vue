<template>
  <article
    class="task-card"
    :class="[
      { 'collapsed': progressiveDisclosureEnabled && !isExpanded },
      { 'completed': task.progress === 100 },
      { 'focused': isFocused },
      { 'selected': isSelected },
      density ? `task-card--${density}` : ''
    ]"
    :tabindex="disabled ? -1 : 0"
    role="button"
    :aria-label="taskAriaLabel"
    :aria-describedby="`task-meta-${task.id}`"
    :aria-pressed="isPressed"
    :aria-expanded="progressiveDisclosureEnabled ? isExpanded : undefined"
    :aria-disabled="disabled"
    draggable="true"
    @dragstart="handleDragStart"
    @dragend="endDrag"
    @click="handleCardClick($event)"
    @keydown="handleKeydown"
    @contextmenu.prevent="handleRightClick"
    @focus="handleFocus"
    @blur="handleBlur"
    ref="taskCardRef"
  >
    <!-- Status icon and title row -->
    <div class="card-header">
      <!-- Status icon (Lucide, clickable, status-colored) -->
      <button
        class="status-icon-button"
        :class="statusColorClass"
        @click.stop="cycleStatus"
        :title="statusTooltip"
        :aria-label="statusTooltip"
        :aria-describedby="`task-title-${task.id}`"
        type="button"
        tabindex="-1"
      >
        <CalendarDays v-if="task.status === 'planned'" :size="14" :stroke-width="1.5" aria-hidden="true" />
        <Loader v-else-if="task.status === 'in_progress'" :size="14" :stroke-width="1.5" aria-hidden="true" />
        <CheckCircle v-else-if="task.status === 'done'" :size="14" :stroke-width="1.5" aria-hidden="true" />
        <Inbox v-else-if="task.status === 'backlog'" :size="14" :stroke-width="1.5" aria-hidden="true" />
        <PauseCircle v-else :size="14" :stroke-width="1.5" aria-hidden="true" />
      </button>

      <!-- Title and metadata in flex layout -->
      <div class="title-section">
        <h3
          :id="`task-title-${task.id}`"
          class="task-title"
          :class="[titleAlignmentClasses, { 'completed-title': task.progress === 100 }]"
        >
          {{ task.title }}
        </h3>

        <!-- Inline metadata badges (compact) -->
        <div
          :id="`task-meta-${task.id}`"
          class="metadata-badges"
          role="group"
          aria-label="Task metadata"
        >
          <!-- Due date badge -->
          <span v-if="task.dueDate"
                class="meta-badge due-date-badge"
                :class="{ 'meta-badge--icon-only': density === 'ultrathin' }"
                :title="`Due: ${task.dueDate}`"
                :aria-label="`Due date: ${task.dueDate}`"
                role="status">
            <Calendar :size="10" aria-hidden="true" />
            <span v-if="density !== 'ultrathin'">{{ task.dueDate }}</span>
          </span>

          <!-- Priority badge -->
          <span class="meta-badge priority-badge"
                :class="[`priority-${task.priority || 'medium'}`, { 'meta-badge--icon-only': density === 'ultrathin' }]"
                :title="`Priority: ${(task.priority || 'medium').charAt(0).toUpperCase()}`"
                :aria-label="`Priority: ${task.priority || 'medium'}`"
                role="status">
            <span class="priority-dot" aria-hidden="true"></span>
            <span v-if="density !== 'ultrathin'">{{ (task.priority || 'medium').charAt(0).toUpperCase() }}</span>
          </span>

          <!-- Project visual indicator (emoji, SVG, or CSS circle) -->
          <div class="meta-badge project-visual-container"
               :class="{ 'project-visual-container--emoji': projectVisual.type === 'emoji' }"
               :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
               role="status">
            <!-- SVG/Native Emoji for projects with emoji -->
            <ProjectEmojiIcon
              v-if="projectVisual.type === 'emoji'"
              :emoji="projectVisual.content"
              size="sm"
              :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
            />

            <!-- CSS Circle for projects with color -->
            <div
              v-else-if="projectVisual.type === 'css-circle'"
              class="project-css-circle"
              :style="{ '--project-color': projectVisual.color }"
              :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
              role="img"
              :aria-label="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
            ></div>

            <!-- Default fallback (folder icon) -->
            <ProjectEmojiIcon
              v-else-if="projectVisual.type === 'default'"
              emoji="📁"
              size="sm"
              :title="`Project: ${taskStore.getProjectDisplayName(task.projectId)}`"
            />
          </div>

          <!-- Subtasks badge -->
          <span v-if="task.subtasks && task.subtasks.length > 0"
                class="meta-badge subtasks-badge"
                :class="{ 'meta-badge--icon-only': density === 'ultrathin' }"
                :title="`Subtasks: ${completedSubtasks}/${task.subtasks.length}`"
                :aria-label="`Subtasks: ${completedSubtasks} of ${task.subtasks.length} completed`"
                role="status">
            <List :size="10" aria-hidden="true" />
            <span v-if="density !== 'ultrathin'">{{ completedSubtasks }}/{{ task.subtasks.length }}</span>
          </span>

          <!-- Dependency badge -->
          <span v-if="hasDependencies"
                class="meta-badge dependency-badge"
                :class="{ 'meta-badge--icon-only': density === 'ultrathin' }"
                :title="`Dependencies: ${task.dependsOn?.length || 0}`"
                :aria-label="`${task.dependsOn?.length || 0} dependencies`"
                role="status">
            <Link :size="10" aria-hidden="true" />
            <span v-if="density !== 'ultrathin'">{{ task.dependsOn?.length || 0 }}</span>
          </span>

          <!-- Pomodoro sessions badge -->
          <span v-if="task.completedPomodoros > 0"
                class="meta-badge pomodoro-badge"
                :class="{ 'meta-badge--icon-only': density === 'ultrathin' }"
                :title="`Pomodoro sessions: ${task.completedPomodoros}`"
                :aria-label="`${task.completedPomodoros} completed pomodoro session${task.completedPomodoros !== 1 ? 's' : ''}`"
                role="status">
            <span class="pomodoro-icon" aria-hidden="true">🍅</span>
            <span v-if="density !== 'ultrathin'">{{ task.completedPomodoros }}</span>
          </span>
        </div>
      </div>

      <!-- Compact action buttons -->
      <div class="compact-actions" role="group" aria-label="Task actions">
        <button
          @click.stop="$emit('startTimer', task.id)"
          class="action-btn timer-btn"
          title="Start Pomodoro Timer"
          aria-label="Start Pomodoro timer for this task"
          type="button"
          tabindex="-1"
        >
          <Play :size="12" aria-hidden="true" />
        </button>
        <button
          @click.stop="$emit('edit', task.id)"
          class="action-btn edit-btn"
          title="Edit Task"
          aria-label="Edit this task"
          type="button"
          tabindex="-1"
        >
          <Edit :size="12" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Progressive Disclosure Content (only when expanded) -->
    <Transition name="expand">
      <div v-show="!progressiveDisclosureEnabled || isExpanded" class="card-details">
        <!-- No additional details needed - everything is on one line -->
      </div>
    </Transition>
  </article>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Task } from '@/stores/tasks'
import { Play, Edit, Calendar, Check, List, Link, CalendarDays, Loader, CheckCircle, Inbox, PauseCircle } from 'lucide-vue-next'
import { useDragAndDrop, type DragData } from '@/composables/useDragAndDrop'
import { useProgressiveDisclosure } from '@/composables/useProgressiveDisclosure'
import { useTaskStore } from '@/stores/tasks'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

interface Props {
  task: Task
  density?: 'ultrathin' | 'compact' | 'comfortable' | 'spacious'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const { enabled: progressiveDisclosureEnabled } = useProgressiveDisclosure()
const isExpanded = ref(true) // Default expanded (current behavior)
const isFocused = ref(false)
const isPressed = ref(false)
const taskCardRef = ref<HTMLElement>()

const emit = defineEmits<{
  select: [taskId: string]
  startTimer: [taskId: string]
  edit: [taskId: string]
  delete: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

const { startDrag, endDrag } = useDragAndDrop()

// Task store for selection state
const taskStore = useTaskStore()

// Hebrew text alignment support
const { getAlignmentClasses } = useHebrewAlignment()
const titleAlignmentClasses = computed(() => getAlignmentClasses(props.task.title))

// Check if this task is selected
const isSelected = computed(() => {
  return taskStore.selectedTaskIds.includes(props.task.id)
})

// Enhanced accessibility computed properties
const taskAriaLabel = computed(() => {
  const status = props.task.progress === 100 ? 'completed' : 'pending'
  const priority = props.task.priority || 'medium'
  const selectedStatus = isSelected.value ? ', selected' : ''
  return `Task: ${props.task.title}, ${status}, priority ${priority}${selectedStatus}`
})

// Handle card click with enhanced accessibility
const handleCardClick = (event: MouseEvent) => {
  if (props.disabled) return

  // Always prevent default to ensure our click handling works properly
  event.preventDefault()

  if (progressiveDisclosureEnabled.value) {
    isExpanded.value = !isExpanded.value
  } else {
    // Check for ctrl+click for multiselect behavior
    if (event.ctrlKey || event.metaKey) {
      console.log('Ctrl+click detected on task:', props.task.title, 'Starting multi-select mode')

      // For ctrl+click, toggle selection instead of always adding
      if (isSelected.value) {
        console.log('Deselecting task:', props.task.id)
        taskStore.deselectTask(props.task.id)
      } else {
        console.log('Selecting task:', props.task.id)
        taskStore.selectTask(props.task.id)
      }
    } else {
      // Regular click - clear selection and select only this task
      console.log('Regular click detected, clearing selection and selecting task:', props.task.id)
      taskStore.clearSelection()
      emit('select', props.task.id)
    }
  }
}

// Enhanced keyboard navigation
const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return

  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      isPressed.value = true
      // Create a synthetic mouse event for keyboard activation
      const syntheticEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      })
      handleCardClick(syntheticEvent)
      setTimeout(() => {
        isPressed.value = false
      }, 150)
      break

    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault()
      // Try to focus completion circle
      const completionCircle = taskCardRef.value?.querySelector('.completion-circle') as HTMLElement
      completionCircle?.focus()
      break

    case 'e':
    case 'E':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        emit('edit', props.task.id)
      }
      break

    case 't':
    case 'T':
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        emit('startTimer', props.task.id)
      }
      break

    case 'Delete':
    case 'Backspace':
      event.preventDefault()
      emit('delete', props.task.id)
      break
  }
}

// Focus and blur handlers
const handleFocus = (event: FocusEvent) => {
  isFocused.value = true
  emit('focus', event)
}

const handleBlur = (event: FocusEvent) => {
  isFocused.value = false
  emit('blur', event)
}

// Right-click handler
const handleRightClick = (event: MouseEvent) => {
  console.log('Right-click detected on task:', props.task.title)
  emit('contextMenu', event, props.task)
}

// Drag handler using new composable
const handleDragStart = (event: DragEvent) => {
  if (event.dataTransfer) {
    const dragData: DragData = {
      type: 'task',
      taskId: props.task.id,
      title: props.task.title,
      source: 'kanban'
    }

    // Use new composable for global drag state
    startDrag(dragData)

    // Still set dataTransfer for HTML5 drag-and-drop compatibility
    event.dataTransfer.setData('application/json', JSON.stringify(dragData))
    event.dataTransfer.effectAllowed = 'move'
  }
}

// Dependency check
const hasDependencies = computed(() =>
  props.task.dependsOn && props.task.dependsOn.length > 0
)

// Subtask calculations
const completedSubtasks = computed(() =>
  props.task.subtasks?.filter(st => st.isCompleted).length || 0
)

// Project visual indicator (emoji or colored dot)
const projectVisual = computed(() =>
  taskStore.getProjectVisual(props.task.projectId)
)

// Status-based color class for status icon
const statusColorClass = computed(() => {
  const status = props.task.status || 'backlog'
  return `status-${status}-icon`
})

// Tooltip for status icon
const statusTooltip = computed(() => {
  const status = props.task.status || 'backlog'
  const statusLabels = {
    'planned': 'Mark as in-progress',
    'in_progress': 'Mark as done',
    'done': 'Mark as backlog',
    'backlog': 'Mark as planned',
    'on_hold': 'Mark as planned'
  }
  return statusLabels[status] || 'Change status'
})

// Cycle through status instead of toggle completion
const cycleStatus = () => {
  const statusCycle: Task['status'][] = ['planned', 'in_progress', 'done', 'backlog', 'on_hold']
  const currentStatus = props.task.status || 'backlog'
  const currentIndex = statusCycle.indexOf(currentStatus)
  const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length]

  emit('select', props.task.id)

  // Find the task in the store and update it
  const taskStore = useTaskStore()
  const task = taskStore.tasks.find(t => t.id === props.task.id)
  if (task) {
    taskStore.updateTask(props.task.id, { status: nextStatus })
  }
}
</script>

<style scoped>
.task-card {
  /* Todoist-inspired compact card */
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-2);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  box-shadow: var(--shadow-sm);
  position: relative;
  min-height: var(--task-card-min-height); /* Compact height like Todoist */
  min-width: var(--task-card-min-width); /* Wider cards for single-line layout */
  max-width: var(--task-card-max-width); /* Constrain maximum width for layout stability */
  width: 100%;
  box-sizing: border-box; /* Include padding and borders in width calculation */
}

.task-card:hover {
  /* OUTLINED + GLASS on hover (not filled!) */
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.task-card.completed {
  opacity: 0.8;
  background: var(--surface-secondary);
}

/* Multi-select selected state */
.task-card.selected {
  border-color: var(--brand-primary);
  background: var(--purple-bg-subtle);
  box-shadow: 0 0 0 var(--task-card-focus-width) var(--purple-border-light), var(--shadow-md);
  position: relative;
}

.task-card.selected::before {
  content: '';
  position: absolute;
  inset: var(--task-card-selection-offset); /* RTL: selection border overlay */
  border: var(--task-card-selection-border) solid var(--brand-primary);
  border-radius: var(--radius-sm);
  pointer-events: none;
  z-index: 1;
}

.task-card.selected:hover {
  border-color: var(--brand-primary);
  background: var(--purple-bg-light);
  box-shadow: 0 0 0 var(--task-card-focus-width) var(--purple-border), var(--state-hover-shadow), var(--state-hover-glow);
}

/* Status icon button */
.status-icon-button {
  width: var(--task-card-icon-size);
  height: var(--task-card-icon-size);
  border-radius: var(--radius-sm);
  border: var(--task-card-border-width) solid var(--border-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-inline-end: var(--space-2); /* RTL: status icon button spacing */
  transition: all var(--duration-fast) ease;
  cursor: pointer;
  position: relative;
  background: var(--surface-tertiary);
}

.status-icon-button:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* Status-based color classes for status icons */
.status-icon-button.status-planned-icon {
  border-color: var(--color-info);
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-info);
}

.status-icon-button.status-in_progress-icon {
  border-color: var(--color-break);
  background: rgba(245, 158, 11, 0.1);
  color: var(--color-break);
}

.status-icon-button.status-done-icon {
  border-color: var(--color-work);
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-work);
}

.status-icon-button.status-backlog-icon {
  border-color: var(--text-muted);
  background: rgba(156, 163, 175, 0.1);
  color: var(--text-muted);
}

.status-icon-button.status-on_hold-icon {
  border-color: var(--color-danger);
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-danger);
}

/* Active state for status icons */
.status-icon-button:active {
  transform: scale(0.95);
}

/* Add pulsing animation for better visual feedback */
@keyframes priorityPulse {
  0% {
    box-shadow: 0 0 0 0 currentColor;
  }
  70% {
    box-shadow: 0 0 0 4px currentColor;
  }
  100% {
    box-shadow: 0 0 0 0 currentColor;
  }
}

.completion-circle:focus {
  outline: none;
  animation: priorityPulse 1.5s ease-in-out;
}

/* Compact header layout */
.card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  width: 100%;
  justify-content: space-between;
}

.title-section {
  flex: 1;
  min-width: 0;
}

.compact-actions {
  display: flex;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--duration-normal) ease;
}

.task-card:hover .compact-actions {
  opacity: 1;
}

/* Todoist-style title */
.task-title {
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin: 0 0 var(--space-1) 0;
  line-height: var(--leading-tight);
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  flex: 1;
  min-width: 140px; /* Ensure minimum width for title */
  /* Allow multi-line titles with graceful truncation */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-height: 2.4em; /* 2 lines at 1.2 line-height */
}

.task-title.completed-title {
  text-decoration: line-through;
  color: var(--text-muted);
}

/* Metadata badges (compact inline style) */
.metadata-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  justify-content: flex-start;
  /* Allow horizontal scrolling if badges overflow */
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border-subtle) transparent;
  min-height: 20px;
}

.metadata-badges::-webkit-scrollbar {
  height: 2px;
}

.metadata-badges::-webkit-scrollbar-track {
  background: transparent;
}

.metadata-badges::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: var(--radius-full);
}

/* Icon-only badge styles for ultrathin mode */
.meta-badge--icon-only {
  padding: var(--task-card-padding-xs);
  min-width: var(--task-card-checkbox-size);
  min-height: var(--task-card-checkbox-size);
  justify-content: center;
  border-radius: var(--radius-full);
}

.meta-badge--icon-only .pomodoro-icon {
  font-size: var(--task-card-font-size-xs);
  line-height: 1;
}

.meta-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--task-card-padding-xs);
  font-size: var(--task-card-font-size-xs);
  font-weight: var(--font-medium);
  padding: var(--task-card-padding-xs) var(--space-1_5);
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.due-date-badge {
  color: var(--text-muted);
  background: var(--surface-hover);
  border: 1px solid var(--border-subtle);
}

.priority-badge {
  display: flex;
  align-items: center;
  gap: 4px;
}

.priority-badge.priority-high {
  color: var(--color-danger);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.priority-badge.priority-medium {
  color: var(--color-priority-medium);
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.priority-badge.priority-low {
  color: var(--color-info);
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.priority-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.subtasks-badge {
  color: var(--text-secondary);
  background: var(--surface-hover);
  border: 1px solid var(--border-subtle);
}

.dependency-badge {
  color: var(--text-secondary);
  background: var(--purple-bg-subtle);
  border: 1px solid var(--purple-border-light);
}

.pomodoro-badge {
  color: var(--text-muted);
  background: var(--surface-hover);
  border: 1px solid var(--border-subtle);
}

/* Enhanced project visual indicators */
/* ===== PROJECT VISUAL INDICATOR SYSTEM ===== */
.project-visual-container {
  /* Perfect centering with CSS Grid - eliminates baseline issues */
  display: grid;
  place-items: center;
  position: relative;
  width: var(--project-indicator-size-sm); /* 20px standard container */
  height: var(--project-indicator-size-sm);
  /* Base styling - minimal to let ProjectEmojiIcon control appearance */
  color: var(--text-secondary);
  /* Smooth transitions */
  transition: all var(--duration-fast) var(--spring-smooth);
  /* Performance optimization */
  transform: translateZ(0);
  will-change: transform;
  /* Prevent text selection */
  user-select: none;
}

/* For CSS circles (not emojis), add background and border styling */
.project-visual-container:has(.project-css-circle) {
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
}

/* Hover effects - only for containers with CSS circles */
.project-visual-container:has(.project-css-circle):hover {
  background: var(--surface-hover);
  border-color: var(--border-medium);
  transform: scale(1.05);
}

/* Emoji-specific styling is now handled by ProjectEmojiIcon variant="plain" */
/* No override needed since ProjectEmojiIcon defaults to plain (no background/border) */

/* CSS Circle for colored projects with perfect centering */
.project-css-circle {
  /* Size using design tokens - proper 7px circle in 20px container */
  width: var(--project-circle-size-sm);
  height: var(--project-circle-size-sm);
  /* Perfect circle shape */
  border-radius: 50%;
  /* Dynamic color from CSS custom property */
  background: var(--project-color);
  /* Enhanced glass morphism effects */
  box-shadow:
    var(--project-indicator-glow-subtle),
    var(--project-indicator-shadow-inset);
  border: 1px solid var(--project-indicator-border);
  backdrop-filter: var(--project-indicator-backdrop);
  /* Positioning for perfect centering within container */
  margin: auto;
  /* Smooth animations */
  transition: all var(--duration-fast) var(--spring-smooth);
  transform: translateZ(0); /* Hardware acceleration */
  /* Prevent pointer events on parent during hover */
  pointer-events: auto;
}

/* Glow effect on hover for colored dots */
.project-visual-container:hover .project-css-circle {
  transform: translateZ(0) scale(1.1);
  box-shadow:
    var(--project-indicator-glow-medium),
    var(--project-indicator-shadow-inset);
}

/* Larger glow animation for colored dots */
.project-visual-container:hover .project-css-circle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: calc(100% + 8px);
  height: calc(100% + 8px);
  border-radius: 50%;
  background: radial-gradient(circle, var(--project-color) 0%, transparent 70%);
  opacity: 0.4;
  pointer-events: none;
  animation: projectGlow 2s ease-in-out infinite;
}

@keyframes projectGlow {
  0%, 100% {
    opacity: 0.2;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(1.1);
  }
}

/* Legacy support - remove old unused styles */
.project-visual-badge,
.project-visual-badge.project-visual--colored,
.project-visual,
.project-visual.project-emoji,
.project-visual.project-css-circle,
.project-visual.project-css-circle::after,
.project-visual-badge:hover .project-visual.project-css-circle,
.project-visual-badge:hover .project-visual.project-css-circle::after,
.project-emoji-badge,
.project-emoji {
  /* All styles moved to project-visual-container or ProjectEmojiIcon component */
}

/* Compact action buttons */
.action-btn {
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.action-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-secondary);
  transform: scale(1.1);
}

.timer-btn:hover {
  background: var(--success-bg-subtle);
  border-color: var(--success-border);
  color: var(--color-work);
}

.edit-btn:hover {
  background: var(--purple-bg-subtle);
  border-color: var(--purple-border-subtle);
  color: var(--brand-primary);
}

/* Expanded card details */
.card-details {
  margin-top: var(--space-2);
  border-top: 1px solid var(--border-subtle);
  padding-top: var(--space-2);
}

/* Progressive disclosure states */
.task-card.collapsed {
  min-height: 48px;
}

.task-card.collapsed .card-details {
  display: none;
}

.task-card.collapsed:hover {
  border-color: var(--border-strong);
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all var(--duration-fast) ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
  padding-top: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 200px;
  margin-top: var(--space-2);
  padding-top: var(--space-2);
}

/* Todoist-inspired compact density variants */
.task-card--ultrathin {
  padding: var(--space-1) var(--space-2);
  margin-bottom: var(--space-1);
  min-height: 32px;
}

.task-card--ultrathin .completion-circle {
  width: 12px;
  height: 12px;
  margin-inline-end: var(--space-1); /* RTL: ultrathin completion circle spacing */
}

.task-card--ultrathin .task-title {
  font-size: 11px;
  margin-bottom: 0;
  line-height: 1.2;
}

.task-card--ultrathin .metadata-badges {
  display: flex; /* Show badges in ultrathin mode - icon-only */
  gap: var(--task-card-padding-xs); /* Smaller gap for compact mode */
}

.task-card--ultrathin .card-details {
  display: none; /* Always hide details in ultrathin mode */
}

.task-card--ultrathin .compact-actions {
  opacity: 1; /* Always show actions in ultrathin mode */
}

.task-card--ultrathin .action-btn {
  width: 20px;
  height: 20px;
}

.task-card--compact {
  padding: var(--space-1_5) var(--space-2);
  margin-bottom: var(--space-1_5);
  min-height: 36px;
}

.task-card--compact .completion-circle {
  width: 14px;
  height: 14px;
}

.task-card--compact .task-title {
  font-size: 12px;
  margin-bottom: 0;
  line-height: 1.3;
}

.task-card--compact .meta-badge {
  font-size: 9px;
  padding: 1px 4px;
}

.task-card--compact .action-btn {
  width: 22px;
  height: 22px;
}

.task-card--comfortable {
  padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-2);
  min-height: 40px;
}

.task-card--spacious {
  padding: var(--space-4);
  margin-bottom: var(--space-3);
  min-height: 48px;
}

.task-card--spacious .task-title {
  font-size: var(--text-base);
  margin-bottom: var(--space-2);
}

/* Enhanced Accessibility & Focus Management */

/* Focus states for task card */
.task-card.focused {
  outline: 2px solid var(--color-work);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
}

.task-card:focus-visible {
  outline: 2px solid var(--color-work);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
  z-index: 10; /* Ensure focus ring is visible */
}

/* Completion circle focus states */
.completion-circle:focus {
  outline: 2px solid var(--color-work);
  outline-offset: 1px;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
  z-index: 15;
}

.completion-circle:focus-visible {
  outline: 2px solid var(--color-work);
  outline-offset: 1px;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
}

/* Action button focus states */
.action-btn:focus {
  outline: 2px solid var(--color-work);
  outline-offset: 1px;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
  z-index: 15;
}

.action-btn:focus-visible {
  outline: 2px solid var(--color-work);
  outline-offset: 1px;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
}

/* Pressed state animation */
.task-card:active {
  transform: translateY(-1px) scale(0.98);
  transition: transform 0.1s ease;
}

/* Disabled state */
.task-card[aria-disabled="true"] {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.task-card[aria-disabled="true"] .completion-circle,
.task-card[aria-disabled="true"] .action-btn {
  pointer-events: none;
  opacity: 0.5;
}

/* Screen reader only text */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .task-card {
    border-width: 2px;
  }

  .task-card:focus-visible,
  .task-card.focused {
    outline-width: 3px;
  }

  .meta-badge {
    border-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .task-card {
    transition: opacity 0.2s ease, background-color 0.2s ease;
  }

  .task-card:hover {
    transform: none;
  }

  .task-card:active {
    transform: none;
  }

  .completion-circle:hover {
    transform: none;
  }

  .spinner {
    animation: none;
  }
}

/* Light theme overrides */
:root:not(.dark-theme) .task-card {
  background: var(--surface-secondary);
  border-color: var(--border-subtle);
  box-shadow: 0 1px 2px 0 var(--shadow-subtle);
}

:root:not(.dark-theme) .task-card:hover {
  border-color: var(--border-medium);
  box-shadow: 0 4px 6px -1px var(--shadow-subtle);
}

:root:not(.dark-theme) .task-title {
  color: var(--text-primary);
}

:root:not(.dark-theme) .task-description {
  color: var(--text-muted);
}

:root:not(.dark-theme) .meta-badge {
  border-color: rgba(0, 0, 0, 0.1);
}

:root:not(.dark-theme) .action-btn {
  background: var(--surface-tertiary);
  border-color: var(--border-medium);
  color: var(--text-muted);
}
</style>
