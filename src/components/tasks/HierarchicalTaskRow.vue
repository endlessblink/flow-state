<template>
  <div class="hierarchical-task-row" :class="{ 'hierarchical-task-row--mobile': state.isMobile.value }">
    <HierarchicalTaskRowContent
      :task="task"
      :indent-level="indentLevel"
      :selected="selected"
      :selection-mode="selectionMode"
      :checked="checked"
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
      :is-expanded="state.isExpanded.value"
      :title-alignment-classes="state.titleAlignmentClasses.value"
      :project-visual="state.projectVisual.value"
      :project-display-name="taskStore.getProjectDisplayName(task.projectId)"
      :status-options="statusOptions"
      :disable-native-drag="disableNativeDrag"
      :is-inline-editing="isInlineEditing"
      @start-inline-edit="handleStartInlineEdit"
      @save-inline-edit="handleSaveInlineEdit"
      @cancel-inline-edit="handleCancelInlineEdit"
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
      @toggle-expand="$emit('toggleExpand', task.id)"
      @check="$emit('check', task.id)"
      @update-status="(val) => actions.updateTaskStatus(task.id, val)"
      @update-project-id="(val) => $emit('updateTask', task.id, { projectId: val ?? undefined, isUncategorized: !val })"
@update-priority="(val) => $emit('updateTask', task.id, { priority: val as 'immediate' | 'low' | 'medium' | 'high' | 'relaxed' })"
      @update-due-date="(val) => $emit('updateTask', task.id, { dueDate: val ?? undefined })"
      @update-estimate="(val) => $emit('updateTask', task.id, { estimatedDuration: val ?? undefined })"
      @ai-suggest="(event: MouseEvent) => $emit('aiSuggest', event, task)"
      @focus-mode="enterFocusMode"
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
          :data-task-id="childTask.id"
          :indent-level="indentLevel + 1"
          :visited-ids="new Set([...visitedIds, task.id])"
          :expanded-tasks="expandedTasks"
          @select="$emit('select', $event)"
          @toggle-complete="$emit('toggleComplete', $event)"
          @ai-suggest="(event: MouseEvent, task: Task) => $emit('aiSuggest', event, task)"
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
import { ref } from 'vue'
import type { Task } from '@/stores/tasks'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { useTaskRowState } from '@/composables/tasks/row/useTaskRowState'
import { useTaskRowActions } from '@/composables/tasks/row/useTaskRowActions'
import HierarchicalTaskRowContent from './HierarchicalTaskRowContent.vue'
import './HierarchicalTaskRow.css'

interface Props {
  task: Task
  indentLevel?: number
  selected?: boolean
  selectionMode?: boolean
  checked?: boolean
  expandedTasks?: Set<string>
  visitedIds?: Set<string>
  disableNativeDrag?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  indentLevel: 0,
  selected: false,
  selectionMode: false,
  checked: false,
  expandedTasks: () => new Set(),
  visitedIds: () => new Set(),
  disableNativeDrag: false
})

const emit = defineEmits<{
  select: [taskId: string]
  check: [taskId: string]
  toggleComplete: [taskId: string]
  aiSuggest: [event: MouseEvent, task: Task]
  startTimer: [taskId: string]
  edit: [taskId: string]
  duplicate: [taskId: string]
  contextMenu: [event: MouseEvent, task: Task]
  toggleExpand: [taskId: string]
  moveTask: [taskId: string, targetProjectId: string | null, targetParentId: string | null]
  updateTask: [taskId: string, updates: Partial<Task>]
}>()

const taskStore = useTaskStore()
const router = useRouter()

const statusOptions = [
  { label: 'To Do', value: 'todo' },
  { label: 'Done', value: 'done' }
]

// Initialize Composables
const state = useTaskRowState(props)

const actions = useTaskRowActions(
  { 
    task: props.task, 
    indentLevel: props.indentLevel, 
    hasSubtasks: state.hasSubtasks.value, 
    isExpanded: state.isExpanded.value 
  }, 
  emit as (event: string, ...args: any[]) => void,
  state
)

const isInlineEditing = ref(false)

const handleStartInlineEdit = () => {
  isInlineEditing.value = true
}

const handleSaveInlineEdit = (value: string) => {
  isInlineEditing.value = false
  const trimmed = value.trim()
  if (!trimmed || trimmed === props.task.title) return
  emit('updateTask', props.task.id, { title: trimmed })
}

const handleCancelInlineEdit = () => {
  isInlineEditing.value = false
}

const enterFocusMode = () => {
  router.push(`/focus/${props.task.id}`)
}
</script>
