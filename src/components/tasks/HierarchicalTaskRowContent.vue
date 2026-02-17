<template>
  <div
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
      'task-row--high-priority': task.priority === 'high',
      'task-row--timer-active': isTimerActive
    }"
    :data-status="task.status"
    :style="{
      paddingLeft: `${indentLevel * 20 + 40}px`,
      '--indent-level': indentLevel
    }"
    draggable="true"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
    @dragover.prevent="$emit('dragover', $event)"
    @drop.prevent="$emit('drop', $event)"
    @dragleave="$emit('dragleave', $event)"
    @click="$emit('rowClick', $event)"
    @dblclick.stop="$emit('edit')"
    @contextmenu.prevent="$emit('contextMenu', $event)"
    @focusin="$emit('focusin', $event)"
    @focusout="$emit('focusout', $event)"
    @mouseenter="$emit('mouseenter', $event)"
    @mouseleave="$emit('mouseleave', $event)"
    @keydown="$emit('keydown', $event)"
    @touchstart="$emit('touchstart', $event)"
    @touchend="$emit('touchend', $event)"
  >
    <!-- Selection Checkbox + Done Toggle column -->
    <div class="task-row__done-toggle" @click.stop>
      <label class="task-row__select-checkbox">
        <input
          type="checkbox"
          :checked="checked"
          @change="$emit('check')"
        >
      </label>
      <DoneToggle
        :completed="task.status === 'done'"
        size="sm"
        variant="simple"
        :title="`Mark ${task.title} as ${task.status === 'done' ? 'incomplete' : 'complete'}`"
        :aria-label="`Toggle completion for ${task.title}`"
        @toggle="$emit('toggleComplete')"
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
      :total-subtasks="totalSubtasks"
      :is-all-subtasks-completed="isAllSubtasksCompleted"
      :is-expanded="isExpanded"
      @toggle-expand="$emit('toggleExpand')"
    />

    <!-- Project Indicator -->
    <TaskRowProject
      :visual="projectVisual"
      :project-display-name="projectDisplayName"
      :current-project-id="task.projectId"
      @update:project-id="(val) => $emit('updateProjectId', val)"
    />

    <!-- Status Cell -->
    <div class="task-row__status table-cell status-cell" @click.stop>
      <CustomSelect
        :model-value="task.status || 'planned'"
        :options="statusOptions"
        placeholder="Select status..."
        @update:model-value="(val) => $emit('updateStatus', String(val))"
      />
    </div>

    <!-- Priority Badge -->
    <TaskRowPriority
      :priority="task.priority"
      @update:priority="(val) => $emit('updatePriority', val)"
    />

    <!-- Due Date Cell -->
    <TaskRowDueDate
      :due-date="task.dueDate"
      @update:due-date="(val) => $emit('updateDueDate', val)"
    />

    <!-- Progress Bar -->
    <div class="task-row__progress">
      <template v-if="task.progress && task.progress > 0">
        <div class="task-row__progress-bar" :style="{ '--progress': `${task.progress}%` }">
          <div class="task-row__progress-bg" />
          <div class="task-row__progress-fill" />
        </div>
        <span class="task-row__progress-text">{{ task.progress }}%</span>
      </template>
      <span v-else class="task-row__no-progress">-</span>
    </div>

    <!-- Time Estimate -->
    <TaskRowEstimate
      :estimated-duration="task.estimatedDuration"
      @update:estimated-duration="(val) => $emit('updateEstimate', val)"
    />

    <!-- Action Buttons -->
    <TaskRowActions
      @ai-suggest="(event: MouseEvent) => $emit('aiSuggest', event)"
      @start-timer="$emit('startTimer')"
      @edit="$emit('edit')"
      @duplicate="$emit('duplicate')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import DoneToggle from '@/components/tasks/DoneToggle.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import TaskRowTitle from './row/TaskRowTitle.vue'
import TaskRowProject from './row/TaskRowProject.vue'
import TaskRowPriority from './row/TaskRowPriority.vue'
import TaskRowDueDate from './row/TaskRowDueDate.vue'
import TaskRowEstimate from './row/TaskRowEstimate.vue'
import TaskRowActions from './row/TaskRowActions.vue'

interface Props {
  task: Task
  indentLevel: number
  selected: boolean
  selectionMode?: boolean
  checked?: boolean
  isMobile: boolean
  isFocused: boolean
  isHovered: boolean
  isDragging: boolean
  isDropTarget: boolean
  isOverdue: boolean
  hasSubtasks: boolean
  completedSubtaskCount: number
  totalSubtasks: number
  isAllSubtasksCompleted: boolean
  isExpanded?: boolean
  titleAlignmentClasses: any
  projectVisual: any
  projectDisplayName: string
  statusOptions: Array<{ label: string, value: string }>
}

const props = withDefaults(defineProps<Props>(), {
  selectionMode: false,
  checked: false,
  isExpanded: false
})

defineEmits<{
  dragstart: [event: DragEvent]
  dragend: [event: DragEvent]
  dragover: [event: DragEvent]
  drop: [event: DragEvent]
  dragleave: [event: DragEvent]
  rowClick: [event: MouseEvent]
  contextMenu: [event: MouseEvent]
  focusin: [event: FocusEvent]
  focusout: [event: FocusEvent]
  mouseenter: [event: MouseEvent]
  mouseleave: [event: MouseEvent]
  keydown: [event: KeyboardEvent]
  touchstart: [event: TouchEvent]
  touchend: [event: TouchEvent]
  toggleComplete: []
  check: []
  updateStatus: [val: string]
  updateProjectId: [val: string | null]
  updatePriority: [val: string]
  updateDueDate: [val: string | null]
  aiSuggest: [event: MouseEvent]
  startTimer: []
  edit: []
  duplicate: []
  toggleExpand: []
  updateEstimate: [val: number | null]
}>()

const timerStore = useTimerStore()

// Timer active state
const isTimerActive = computed(() => {
  return timerStore.isTimerActive && timerStore.currentTaskId === props.task.id
})


</script>
