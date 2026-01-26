<template>
  <div
    class="task-row"
    :class="[
      `task-row--${density}`,
      { 'task-row--selected': selected, 'task-row--anchor': isAnchorRow, 'task-row--timer-active': isTimerActive, 'task-row--flashing': isFlashing },
      `priority-${task.priority || 'none'}`
    ]"
    @click="$emit('select', task.id)"
    @contextmenu.prevent="$emit('contextMenu', $event, task)"
  >
    <!-- Priority Indicator -->
    <div v-if="task.priority" class="priority-indicator" />
    <!-- Checkbox -->
    <div class="task-row__checkbox" @click.stop>
      <DoneToggle
        :completed="task.status === 'done'"
        size="sm"
        variant="simple"
        :title="`Mark ${task.title} as ${task.status === 'done' ? 'incomplete' : 'complete'}`"
        :aria-label="`Toggle completion for ${task.title}`"
        @toggle="$emit('toggleComplete', task.id)"
      />
    </div>

    <!-- Title (flexible, main focus) -->
    <div class="task-row__title">
      <span class="task-row__title-text" :class="getAlignmentClasses(task.title)">{{ task.title }}</span>
    </div>

    <!-- Project Visual -->
    <TaskRowProject
      :visual="projectVisual"
      :project-display-name="taskStore.getProjectDisplayName(task.projectId)"
      :current-project-id="task.projectId"
      @update:project-id="(projectId) => $emit('updateProject', task.id, projectId)"
    />

    <!-- Due Date -->
    <TaskRowDueDate
      :due-date="task.dueDate"
      @update:due-date="(dueDate) => $emit('updateDueDate', task.id, dueDate)"
    />

    <!-- Status Dropdown -->
    <div class="task-row__status" @click.stop>
      <CustomSelect
        :model-value="task.status || 'planned'"
        :options="statusOptions"
        placeholder="Select status..."
        @update:model-value="(val) => $emit('updateStatus', task.id, String(val))"
      />
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
        +{{ (task.tags?.length || 0) - maxVisibleTags }}
      </span>
    </div>

    <!-- Quick Actions (hover only) -->
    <div class="task-row__actions">
      <button
        class="task-row__action-btn"
        title="Start Timer"
        @click.stop="$emit('startTimer', task.id)"
      >
        <Play :size="14" />
      </button>
      <button
        class="task-row__action-btn"
        title="Edit Task"
        @click.stop="$emit('edit', task.id)"
      >
        <Edit :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { Play, Edit } from 'lucide-vue-next'
import DoneToggle from '@/components/tasks/DoneToggle.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import TaskRowProject from '@/components/tasks/row/TaskRowProject.vue'
import TaskRowDueDate from '@/components/tasks/row/TaskRowDueDate.vue'
import type { DensityType } from '@/components/layout/ViewControls.vue'
import { useHebrewAlignment } from '@/composables/useHebrewAlignment'

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
  updateStatus: [taskId: string, status: string]
  updateProject: [taskId: string, projectId: string | null]
  updateDueDate: [taskId: string, dueDate: string | null]
}>()

const statusOptions = [
  { label: 'To Do', value: 'planned' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
  { label: 'Backlog', value: 'backlog' },
  { label: 'On Hold', value: 'on_hold' }
]

const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Hebrew text alignment support
const { getAlignmentClasses } = useHebrewAlignment()

// Timer active state
const isTimerActive = computed(() => {
  return timerStore.isTimerActive && timerStore.currentTaskId === props.task.id
})

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

// Project visual indicator (emoji or colored dot)
const projectVisual = computed(() =>
  taskStore.getProjectVisual(props.task.projectId)
)

// TASK-1074: Flash animation when date is set via context menu
const isFlashing = ref(false)
const handleTaskFlash = (event: Event) => {
  const customEvent = event as CustomEvent<{ taskId: string }>
  console.log('[FLASH] TaskRow received event:', customEvent.detail.taskId, 'my id:', props.task?.id)
  if (customEvent.detail.taskId === props.task?.id) {
    console.log('[FLASH] TaskRow match! Setting isFlashing=true')
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
/* Base Row - 32px height optimized for scanning */
/* Base Row - 32px height optimized for scanning */
.task-row {
  display: grid;
  grid-template-columns: 40px 1fr 40px 100px 100px 140px 80px;
  grid-template-areas: "checkbox title project due status tags actions";
  height: 32px;
  position: relative;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);
  
  /* Glass Morphism Base - More visible */
  background: transparent; /* Remove gray background to let gradient show */
  border: 1px solid var(--border-subtle); /* All-around border like cards */
  border-bottom-color: var(--glass-border); /* Slightly stronger bottom */
  border-radius: var(--radius-sm); /* Rounded corners like cards */
  margin-bottom: var(--space-1); /* Separation */
  backdrop-filter: blur(8px);
  
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  contain: layout style size;
}

.task-row:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: var(--border-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.task-row--selected {
  background: rgba(78, 205, 196, 0.08) !important; /* Brand tint */
  border-left: 3px solid var(--brand-primary);
  border-bottom-color: var(--brand-primary-bg-heavy);
}

/* ADHD Visual Anchor - Every 5th row */
.task-row--anchor {
  background: rgba(255, 255, 255, 0.035);
}

.task-row--anchor:hover {
  background: var(--glass-bg-heavy);
}

/* Density Variants */
.task-row--compact {
  height: 28px;
  font-size: var(--text-sm);
}

.task-row--comfortable {
  height: 36px;
  font-size: var(--text-sm);
}

.task-row--spacious {
  height: 44px;
  font-size: var(--text-sm);
  padding: 0 var(--space-4);
}

/* Checkbox Cell */
.task-row__checkbox {
  grid-area: checkbox;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity var(--duration-normal);
}

.task-row:hover .task-row__checkbox {
  opacity: 1;
}

/* Title Cell */
.task-row__title {
  grid-area: title;
  min-width: 0;
  overflow: hidden;
}

.task-row__title-text {
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  transition: color var(--duration-normal);
  letter-spacing: 0.01em;
}

.task-row:hover .task-row__title-text {
  color: #fff;
}

.task-row--selected .task-row__title-text {
  color: var(--brand-primary-light, #7fffd4);
  text-shadow: 0 0 10px rgba(78, 205, 196, 0.3);
}

/* Project Emoji Cell - handled by TaskRowProject component */

/* Due Date Cell - handled by TaskRowDueDate component */

/* Status Cell */
.task-row__status {
  grid-area: status;
  display: flex;
  align-items: center;
}

/* Tags Cell - Glass Chips */
.task-row__tags {
  grid-area: tags;
  display: flex;
  gap: var(--space-1);
  overflow: hidden;
  opacity: 0.6;
  transition: opacity var(--duration-normal);
}

.task-row:hover .task-row__tags {
  opacity: 1;
}

.task-row__tag {
  padding: 1px var(--space-1_5);
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}

.task-row__tag-more {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.4);
}

/* Actions Cell */
.task-row__actions {
  grid-area: actions;
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
  opacity: 0;
  transform: translateX(10px);
  transition: all var(--duration-normal) cubic-bezier(0.2, 0.8, 0.2, 1);
}

.task-row:hover .task-row__actions {
  opacity: 1;
  transform: translateX(0);
}

.task-row__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.task-row__action-btn:hover {
  background: var(--glass-border-hover);
  border-color: rgba(255, 255, 255, 0.4);
  color: #fff;
  transform: scale(1.1);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
}

/* Priority Indicator */
.priority-indicator {
  position: absolute;
  top: var(--space-1);
  bottom: var(--space-1);
  left: 3px;
  width: 3px;
  border-radius: var(--radius-sm);
  opacity: 0.8;
}

/* Focus */
.task-row:focus-visible {
  outline: none;
  background: var(--glass-bg-soft);
  border-color: var(--brand-primary-alpha-50);
  box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.2);
}

/* Timer active state - amber glow */
.task-row--timer-active {
  border-color: var(--timer-active-border);
  box-shadow: var(--timer-active-glow), var(--timer-active-shadow);
  animation: pulse-timer-row 2s ease-in-out infinite;
}

.task-row--timer-active:hover {
  box-shadow: var(--timer-active-glow-strong), var(--timer-active-shadow-hover);
}

@keyframes pulse-timer-row {
  0%, 100% {
    box-shadow: var(--timer-active-glow), var(--timer-active-shadow);
  }
  50% {
    box-shadow: var(--timer-active-glow-strong), var(--timer-active-shadow-hover);
  }
}

/* TASK-1074: Brief flash animation when date is updated */
.task-row--flashing {
  animation: row-flash-green 0.6s ease-out !important;
}

.priority-high.task-row--flashing {
  animation: row-flash-red 0.6s ease-out !important;
}

.priority-medium.task-row--flashing {
  animation: row-flash-amber 0.6s ease-out !important;
}

.priority-low.task-row--flashing {
  animation: row-flash-blue 0.6s ease-out !important;
}

@keyframes row-flash-green {
  0% { filter: brightness(1); box-shadow: 0 0 0 0 #10b981; background: transparent; }
  25% { filter: brightness(1.3); box-shadow: 0 0 20px 4px #10b981; background: rgba(16, 185, 129, 0.2); }
  50% { filter: brightness(1.15); box-shadow: 0 0 12px 2px #10b981; background: rgba(16, 185, 129, 0.1); }
  100% { filter: brightness(1); box-shadow: 0 0 0 0 #10b981; background: transparent; }
}

@keyframes row-flash-red {
  0% { filter: brightness(1); box-shadow: 0 0 0 0 #ef4444; background: transparent; }
  25% { filter: brightness(1.3); box-shadow: 0 0 20px 4px #ef4444; background: rgba(239, 68, 68, 0.2); }
  50% { filter: brightness(1.15); box-shadow: 0 0 12px 2px #ef4444; background: rgba(239, 68, 68, 0.1); }
  100% { filter: brightness(1); box-shadow: 0 0 0 0 #ef4444; background: transparent; }
}

@keyframes row-flash-amber {
  0% { filter: brightness(1); box-shadow: 0 0 0 0 #f59e0b; background: transparent; }
  25% { filter: brightness(1.3); box-shadow: 0 0 20px 4px #f59e0b; background: rgba(245, 158, 11, 0.2); }
  50% { filter: brightness(1.15); box-shadow: 0 0 12px 2px #f59e0b; background: rgba(245, 158, 11, 0.1); }
  100% { filter: brightness(1); box-shadow: 0 0 0 0 #f59e0b; background: transparent; }
}

@keyframes row-flash-blue {
  0% { filter: brightness(1); box-shadow: 0 0 0 0 #3b82f6; background: transparent; }
  25% { filter: brightness(1.3); box-shadow: 0 0 20px 4px #3b82f6; background: rgba(59, 130, 246, 0.2); }
  50% { filter: brightness(1.15); box-shadow: 0 0 12px 2px #3b82f6; background: rgba(59, 130, 246, 0.1); }
  100% { filter: brightness(1); box-shadow: 0 0 0 0 #3b82f6; background: transparent; }
}
</style>
