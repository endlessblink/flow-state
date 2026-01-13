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
      :data-status="task.status"
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

      <!-- Title Cell -->
      <TaskRowTitle
        :title="task.title"
        :is-completed="task.status === 'done'"
        :is-hovered="isHovered"
        :is-selected="selected"
        :title-alignment-classes="titleAlignmentClasses"
        :has-subtasks="hasSubtasks"
        :completed-subtask-count="completedSubtaskCount"
        :total-subtasks="childTasks.length"
        :is-all-subtasks-completed="isAllSubtasksCompleted"
      />

      <!-- Project Indicator -->
      <TaskRowProject
        :visual="projectVisual"
        :project-display-name="taskStore.getProjectDisplayName(task.projectId)"
      />

      <!-- Status Cell -->
      <div class="task-row__status table-cell status-cell" @click.stop>
        <CustomSelect
          :model-value="task.status || 'planned'"
          :options="statusOptions"
          placeholder="Select status..."
          @update:model-value="(val) => updateTaskStatus(task.id, String(val))"
        />
      </div>

      <!-- Priority Badge -->
      <TaskRowPriority
        :priority="task.priority"
        @cycle="cyclePriority(task.id, task.priority)"
      />

      <!-- Due Date Cell -->
      <div class="task-row__due-date">
        <span v-if="task.dueDate" class="task-row__due-date-content">
          <Calendar :size="14" />
          {{ formattedDueDate }}
        </span>
        <span v-else class="task-row__no-date">-</span>
      </div>

      <!-- Progress Bar - ADHD-friendly: Only show when > 0% -->
      <div class="task-row__progress">
        <div v-if="task.progress && task.progress > 0" class="task-row__progress-bar" :style="{ '--progress': `${task.progress}%` }">
          <div class="task-row__progress-bg" />
          <div class="task-row__progress-fill" />
          <span class="task-row__progress-text">{{ task.progress }}%</span>
        </div>
        <span v-else class="task-row__no-progress">-</span>
      </div>

      <!-- Action Buttons -->
      <TaskRowActions
        @start-timer="$emit('startTimer', task.id)"
        @edit="$emit('edit', task.id)"
        @duplicate="$emit('duplicate', task.id)"
      />
    </div>

    <!-- Subtasks (Recursive) -->
    <template v-if="isExpanded && hasSubtasks">
      <div class="subtasks-container">
        <HierarchicalTaskRow
          v-for="childTask in childTasks"
          :key="childTask.id"
          v-memo="[childTask.id, childTask.status, isExpanded]"
          :task="childTask"
          :indent-level="indentLevel + 1"
          :visited-ids="new Set([...visitedIds, task.id])"
          :expanded-tasks="expandedTasks"
          @select="$emit('select', $event)"
          @toggle-complete="$emit('toggleComplete', $event)"
          @start-timer="$emit('startTimer', $event)"
          @edit="$emit('edit', $event)"
          @context-menu="$emit('contextMenu', $event, childTask)"
          @toggle-expand="$emit('toggleExpand', $event)"
          @move-task="(taskId, targetProjectId, targetParentId) => $emit('moveTask', taskId, targetProjectId, targetParentId)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, withDefaults } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import { Calendar } from 'lucide-vue-next'
import DoneToggle from '@/components/tasks/DoneToggle.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'

// Import Composables
import { useTaskRowState } from '@/composables/tasks/row/useTaskRowState'
import { useTaskRowActions } from '@/composables/tasks/row/useTaskRowActions'

// Import Sub-components
import TaskRowTitle from './row/TaskRowTitle.vue'
import TaskRowProject from './row/TaskRowProject.vue'
import TaskRowPriority from './row/TaskRowPriority.vue'
import TaskRowActions from './row/TaskRowActions.vue'

interface Props {
  task: Task
  indentLevel?: number
  selected?: boolean
  expandedTasks?: Set<string>
  visitedIds?: Set<string>
}

const props = withDefaults(defineProps<Props>(), {
  indentLevel: 0,
  selected: false,
  expandedTasks: () => new Set(),
  visitedIds: () => new Set()
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

const statusOptions = [
  { label: 'To Do', value: 'planned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
  { label: 'Backlog', value: 'backlog' },
  { label: 'On Hold', value: 'on_hold' }
]

const taskStore = useTaskStore()

// --- Initialize Composables ---
const state = useTaskRowState({
  task: props.task,
  indentLevel: props.indentLevel,
  selected: props.selected,
  expandedTasks: props.expandedTasks,
  visitedIds: props.visitedIds
})

const actions = useTaskRowActions(
  { 
    task: props.task, 
    indentLevel: props.indentLevel, 
    hasSubtasks: state.hasSubtasks.value, 
    isExpanded: state.isExpanded.value 
  }, 
  emit, 
  state
)

// --- Destructure State ---
const {
  isMobile, isFocused, isHovered, isDragging, isDropTarget,
  hasSubtasks, isExpanded, childTasks, completedSubtaskCount,
  isAllSubtasksCompleted, titleAlignmentClasses, projectVisual,
  formattedDueDate, isOverdue
} = state

// --- Destructure Actions ---
const {
  handleDragStart, handleDragEnd, handleDragOver, handleDragLeave,
  handleDrop, handleRowClick, handleToggleComplete, handleFocusIn,
  handleFocusOut, handleMouseEnter, handleMouseLeave, handleKeyDown,
  handleTouchStart, handleTouchEnd, updateTaskStatus, cyclePriority
} = actions
</script>

<style scoped>
/* Hierarchical task row wrapper */
.hierarchical-task-row {
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  transition: all var(--spring-smooth);
}

.hierarchical-task-row:hover {
  background: var(--glass-bg-heavy);
  border-color: var(--glass-border-hover);
  box-shadow: var(--shadow-md);
}

/* Table-style task row matching TaskTable exactly */
.task-row {
  display: grid;
  grid-template-columns: 40px 1fr 40px 120px 100px 120px 100px 100px;
  grid-template-areas: "done title project status priority due progress actions";
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--glass-border);
  background: transparent; /* Remove default gray fill */
  cursor: pointer;
  transition: background-color var(--duration-fast) ease;
  position: relative;
  --indent-level: 0;
}

/* Match TaskTable hover and selected states */
.task-row:hover {
  background-color: var(--glass-bg-medium);
}

.task-row--selected {
  background-color: rgba(78, 205, 196, 0.05);
  border-left: 3px solid var(--brand-primary);
}

.task-row--completed {
  opacity: 0.7;
}

/* Mobile optimizations */
.hierarchical-task-row--mobile .task-row {
  grid-template-columns: 40px 1fr 40px;
  grid-template-areas: "done title project";
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

.task-row__status {
  grid-area: status;
  display: flex;
  align-items: center;
}

.task-row__status-select {
  padding: var(--space-1) var(--space-2);
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}

.task-row__status-select:hover {
  background-color: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
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
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.task-row__no-date {
  color: var(--text-disabled);
  font-size: var(--text-xs);
}

/* Progress cell - Stroke-only design */
.task-row__progress {
  grid-area: progress;
  display: flex;
  align-items: center;
}

/* Progress bar styles */
.task-row__progress-bar {
  position: relative;
  width: 100%;
  height: 6px; /* Slightly thicker */
  background: transparent;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
}

.task-row__progress-bg {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  right: 0;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-subtle);
  background: var(--glass-bg-subtle);
}

.task-row__progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  /* Clip based on progress percentage */
  width: var(--progress);
  background: var(--brand-gradient-primary);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.task-row__progress-text {
  margin-left: calc(100% + 8px); /* Push text outside bar */
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 500;
  min-width: 32px;
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

/* ADHD-friendly: Status-colored left border for instant visual recognition */
.task-row {
  border-left: 4px solid transparent;
}

.task-row[data-status="planned"] {
  border-left-color: var(--status-planned-border);
}

.task-row[data-status="in_progress"] {
  border-left-color: var(--status-in-progress-border);
}

.task-row[data-status="done"] {
  border-left-color: var(--status-done-border);
}

.task-row[data-status="backlog"] {
  border-left-color: var(--status-backlog-border);
}

.task-row[data-status="on_hold"] {
  border-left-color: var(--status-on-hold-border);
}

/* ADHD-friendly: Compact row height (40px) */
.task-row {
  min-height: 40px;
  padding: var(--space-1_5) var(--space-3);
}

/* No progress indicator styling */
.task-row__no-progress {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}

/* ADHD-friendly: Subtle row striping for scanability */
.hierarchical-task-row:nth-child(even) .task-row {
  background: rgba(255, 255, 255, 0.02);
}

.hierarchical-task-row:nth-child(even) .task-row:hover {
  background-color: var(--glass-bg-medium);
}
</style>
