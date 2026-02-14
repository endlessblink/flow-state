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
        class="task-row__action-btn task-row__action-btn--focus"
        title="Focus Mode (F)"
        @click.stop="enterFocusMode"
      >
        <Eye :size="14" />
      </button>
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
import { useRouter } from 'vue-router'
import { useTaskStore, type Task } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { Eye, Play, Edit } from 'lucide-vue-next'
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

const router = useRouter()
const taskStore = useTaskStore()
const timerStore = useTimerStore()

// Hebrew text alignment support
const { getAlignmentClasses } = useHebrewAlignment()

// Timer active state
const isTimerActive = computed(() => {
  return timerStore.isTimerActive && timerStore.currentTaskId === props.task.id
})

// Focus mode navigation
const enterFocusMode = () => {
  router.push(`/focus/${props.task.id}`)
}

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
  grid-template-columns: var(--space-10) 1fr var(--space-10) var(--space-25) var(--space-25) 140px var(--space-20);
  grid-template-areas: "checkbox title project due status tags actions";
  height: var(--space-8);
  position: relative;
  padding: 0 var(--space-3);
  align-items: center;
  gap: var(--space-2);

  /* Glass Morphism Base - More visible */
  background: transparent; /* Remove gray background to let gradient show */
  border: var(--space-0_5) solid var(--border-subtle); /* All-around border like cards */
  border-bottom-color: var(--glass-border); /* Slightly stronger bottom */
  border-radius: var(--radius-sm); /* Rounded corners like cards */
  margin-bottom: var(--space-1); /* Separation */
  backdrop-filter: blur(var(--space-2));

  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  contain: layout style size;
}

.task-row:hover {
  background: rgba(var(--color-slate-50), 0.07);
  border-color: var(--border-hover);
  transform: translateY(calc(-1 * var(--space-0_5)));
  box-shadow: 0 var(--space-1) var(--space-3) rgba(var(--color-slate-900), 0.2);
}

.task-row--selected {
  background: rgba(78, 205, 196, 0.08) !important; /* Brand tint */
  border-left: var(--space-0_5) solid var(--brand-primary);
  border-bottom-color: var(--brand-primary-bg-heavy);
}

/* ADHD Visual Anchor - Every 5th row */
.task-row--anchor {
  background: rgba(var(--color-slate-50), 0.035);
}

.task-row--anchor:hover {
  background: var(--glass-bg-heavy);
}

/* Density Variants */
.task-row--compact {
  height: var(--space-7);
  font-size: var(--text-sm);
}

.task-row--comfortable {
  height: var(--space-9);
  font-size: var(--text-sm);
}

.task-row--spacious {
  height: var(--space-11);
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
  color: rgba(var(--color-slate-50), 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  transition: color var(--duration-normal);
  letter-spacing: 0.01em;
}

.task-row:hover .task-row__title-text {
  color: var(--text-primary);
}

.task-row--selected .task-row__title-text {
  color: var(--brand-primary-light, hsl(var(--brand-200)));
  text-shadow: 0 0 var(--space-2_5) rgba(78, 205, 196, 0.3);
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
  padding: var(--space-0_5) var(--space-1_5);
  background: rgba(var(--color-slate-900), 0.2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: rgba(var(--color-slate-50), 0.6);
  white-space: nowrap;
}

.task-row__tag-more {
  font-size: var(--text-xs);
  color: rgba(var(--color-slate-50), 0.4);
}

/* Actions Cell */
.task-row__actions {
  grid-area: actions;
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
  opacity: 0;
  transform: translateX(var(--space-2_5));
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
  width: var(--space-7);
  height: var(--space-7);
  background: var(--glass-bg-soft);
  border: var(--space-0_5) solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: rgba(var(--color-slate-50), 0.7);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.task-row__action-btn:hover {
  background: var(--glass-border-hover);
  border-color: rgba(var(--color-slate-50), 0.4);
  color: var(--text-primary);
  transform: scale(1.1);
  box-shadow: 0 0 var(--space-2_5) rgba(var(--color-slate-50), 0.1);
}

.task-row__action-btn--focus:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

/* Priority Indicator */
.priority-indicator {
  position: absolute;
  top: var(--space-1);
  bottom: var(--space-1);
  left: var(--space-0_5);
  width: var(--space-0_5);
  border-radius: var(--radius-sm);
  opacity: 0.8;
}

/* Focus */
.task-row:focus-visible {
  outline: none;
  background: var(--glass-bg-soft);
  border-color: var(--brand-primary-alpha-50);
  box-shadow: 0 0 0 var(--space-0_5) rgba(78, 205, 196, 0.2);
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
  0% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-success); background: transparent; }
  25% { filter: brightness(1.3); box-shadow: 0 0 var(--space-5) var(--space-1) var(--color-success); background: rgba(16, 185, 129, 0.2); }
  50% { filter: brightness(1.15); box-shadow: 0 0 var(--space-3) var(--space-0_5) var(--color-success); background: rgba(16, 185, 129, 0.1); }
  100% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-success); background: transparent; }
}

@keyframes row-flash-red {
  0% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-danger); background: transparent; }
  25% { filter: brightness(1.3); box-shadow: 0 0 var(--space-5) var(--space-1) var(--color-danger); background: rgba(var(--color-danger), 0.2); }
  50% { filter: brightness(1.15); box-shadow: 0 0 var(--space-3) var(--space-0_5) var(--color-danger); background: rgba(var(--color-danger), 0.1); }
  100% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-danger); background: transparent; }
}

@keyframes row-flash-amber {
  0% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-orange); background: transparent; }
  25% { filter: brightness(1.3); box-shadow: 0 0 var(--space-5) var(--space-1) var(--color-orange); background: rgba(var(--color-orange), 0.2); }
  50% { filter: brightness(1.15); box-shadow: 0 0 var(--space-3) var(--space-0_5) var(--color-orange); background: rgba(var(--color-orange), 0.1); }
  100% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-orange); background: transparent; }
}

@keyframes row-flash-blue {
  0% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-blue); background: transparent; }
  25% { filter: brightness(1.3); box-shadow: 0 0 var(--space-5) var(--space-1) var(--color-blue); background: rgba(var(--color-blue), 0.2); }
  50% { filter: brightness(1.15); box-shadow: 0 0 var(--space-3) var(--space-0_5) var(--color-blue); background: rgba(var(--color-blue), 0.1); }
  100% { filter: brightness(1); box-shadow: 0 0 0 0 var(--color-blue); background: transparent; }
}
</style>
