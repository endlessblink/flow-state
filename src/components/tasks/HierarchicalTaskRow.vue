<template>
  <div class="hierarchical-task-row" :class="{ 'hierarchical-task-row--mobile': state.isMobile.value }">
    <HierarchicalTaskRowContent
      :task="task"
      :indent-level="indentLevel"
      :selected="selected"
      :is-mobile="state.isMobile.value"
      :is-focused="state.isFocused.value"
      :is-hovered="state.isHovered.value"
      :is-dragging="state.isDragging.value"
      :is-drop-target="state.isDropTarget.value"
      :is-overdue="state.isOverdue.value"
      :has-subtasks="state.hasSubtasks.value"
      :completed-subtask-count="state.completedSubtaskCount.value"
      :total-subtasks="state.childTasks.value.length"
      :is-all-subtasks-completed="state.isAllSubtasksCompleted.value"
      :title-alignment-classes="state.titleAlignmentClasses.value"
      :project-visual="state.projectVisual.value"
      :project-display-name="taskStore.getProjectDisplayName(task.projectId)"
      :formatted-due-date="state.formattedDueDate.value"
      :status-options="statusOptions"
      @dragstart="actions.handleDragStart"
      @dragend="actions.handleDragEnd"
      @dragover="actions.handleDragOver"
      @drop="actions.handleDrop"
      @dragleave="actions.handleDragLeave"
      @row-click="actions.handleRowClick"
      @context-menu="$emit('contextMenu', $event, task)"
      @focusin="actions.handleFocusIn"
      @focusout="actions.handleFocusOut"
      @mouseenter="actions.handleMouseEnter"
      @mouseleave="actions.handleMouseLeave"
      @keydown="actions.handleKeyDown"
      @touchstart="actions.handleTouchStart"
      @touchend="actions.handleTouchEnd"
      @toggle-complete="actions.handleToggleComplete"
      @update-status="(val) => actions.updateTaskStatus(task.id, val)"
      @update-project-id="(val) => $emit('updateTask', task.id, { projectId: val ?? undefined })"
      @update-priority="(val) => $emit('updateTask', task.id, { priority: val as 'low' | 'medium' | 'high' })"
      @start-timer="$emit('startTimer', task.id)"
      @edit="$emit('edit', task.id)"
      @duplicate="$emit('duplicate', task.id)"
    />

    <!-- Subtasks (Recursive) -->
    <template v-if="state.isExpanded.value && state.hasSubtasks.value">
      <div class="subtasks-container">
        <HierarchicalTaskRow
          v-for="childTask in state.childTasks.value"
          :key="childTask.id"
          v-memo="[childTask.id, childTask.status, state.isExpanded.value]"
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
          @duplicate="$emit('duplicate', $event)"
          @update-task="(taskId, updates) => $emit('updateTask', taskId, updates)"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import { useTaskRowState } from '@/composables/tasks/row/useTaskRowState'
import { useTaskRowActions } from '@/composables/tasks/row/useTaskRowActions'
import HierarchicalTaskRowContent from './HierarchicalTaskRowContent.vue'
import './HierarchicalTaskRow.css'

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

const taskStore = useTaskStore()

const statusOptions = [
  { label: 'To Do', value: 'planned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
  { label: 'Backlog', value: 'backlog' },
  { label: 'On Hold', value: 'on_hold' }
]

// Initialize Composables
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
</script>
