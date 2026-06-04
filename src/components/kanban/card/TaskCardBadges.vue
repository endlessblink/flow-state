<template>
  <div
    class="task-card-badges"
    role="group"
    aria-label="Task metadata"
  >
    <div class="badge-left">
      <!-- Due Date -->
      <span
        v-if="task.dueDate"
        class="badge-item"
        :class="dueDateClass"
        :title="`Due: ${formattedDueDate}`"
      >
        <Calendar :size="12" />
        <span class="badge-text">{{ formattedDueDate }}</span>
      </span>

      <!-- Subtasks -->
      <span
        v-if="task.subtasks?.length"
        class="badge-item"
        :title="`Subtasks: ${completedSubtasks}/${task.subtasks.length}`"
      >
        <CheckSquare :size="12" />
        <span class="badge-text">{{ completedSubtasks }}/{{ task.subtasks.length }}</span>
      </span>

      <!-- Pomodoros -->
      <span
        v-if="task.completedPomodoros > 0"
        class="badge-item badge-pomodoro"
        :title="`Pomodoro sessions: ${task.completedPomodoros}`"
      >
        <Timer :size="12" />
        <span class="badge-text">{{ task.completedPomodoros }}</span>
      </span>

      <!-- Attachments -->
      <span
        v-if="task.attachments?.length"
        class="badge-item"
        :title="`Attachments: ${task.attachments.length}`"
      >
        <Paperclip :size="12" />
        <span class="badge-text">{{ task.attachments.length }}</span>
      </span>

      <!-- Recurring -->
      <span
        v-if="task.recurrenceRule"
        class="badge-item badge-recurring"
        :title="recurrenceDescription"
      >
        <Repeat :size="12" />
      </span>

      <!-- Work block: makes time-boxed progress explicit, even before duration is set -->
      <div
        v-if="hasTaskTitle"
        ref="workBlockRef"
        class="work-block"
        @click.stop
        @mousedown.stop
        @pointerdown.stop
        @touchstart.stop
      >
        <button
          v-if="!task.estimatedDuration"
          type="button"
          class="work-block-trigger work-block-trigger--empty"
          title="Set how long to work on this task today"
          aria-label="Set work block length"
          :aria-expanded="isDurationPickerOpen"
          @click.stop.prevent="toggleDurationPicker"
          @mousedown.stop
          @pointerdown.stop
        >
          <Timer :size="12" />
          <span>Add time</span>
        </button>

        <button
          v-else
          type="button"
          class="work-block-trigger"
          :class="{ 'work-block-trigger--enough': isEnoughForToday }"
          :title="workBlockTitle"
          aria-label="Change work block length"
          :aria-expanded="isDurationPickerOpen"
          @click.stop.prevent="toggleDurationPicker"
          @mousedown.stop
          @pointerdown.stop
        >
          <CheckSquare v-if="isEnoughForToday" :size="12" />
          <Timer v-else :size="12" />
          <span>{{ workBlockLabel }}</span>
        </button>

        <div v-if="isDurationPickerOpen" class="work-block-picker">
          <button
            v-for="option in quickDurationOptions"
            :key="option.value"
            type="button"
            class="work-block-option"
            :class="{ 'is-active': task.estimatedDuration === option.value }"
            @click.stop.prevent="setWorkBlock(option.value)"
            @mousedown.stop
            @pointerdown.stop
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Assignee Avatar (right side) -->
    <div v-if="task.assignedTo && !isPersonalWorkspace" class="badge-right">
      <AssigneeAvatar :user-id="task.assignedTo" :size="18" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Task } from '@/stores/tasks'
import { Calendar, CheckSquare, Timer, Paperclip, Repeat } from 'lucide-vue-next'
import { reactiveToday, ensureDateTimer } from '@/composables/useReactiveDate'
import { describeRecurrenceRule } from '@/utils/recurrenceUtils'
import { useWorkspaceStore } from '@/stores/workspace'
import { useTaskStore } from '@/stores/tasks'
import { useWorkBlockProgress } from '@/composables/tasks/useWorkBlockProgress'
import AssigneeAvatar from '@/components/workspace/AssigneeAvatar.vue'

const props = defineProps<{
  task: Task
  density?: 'ultrathin' | 'compact' | 'comfortable' | 'spacious'
  formattedDueDate: string
  formattedDuration: string
  completedSubtasks: number
  hasDependencies?: boolean
  durationBadgeClass: string
  projectVisual: unknown
}>()

// BUG-1191: Ensure date timer is running for reactive overdue detection
ensureDateTimer()

const workspaceStore = useWorkspaceStore()
const taskStore = useTaskStore()
const isPersonalWorkspace = computed(() => workspaceStore.isPersonalWorkspace)
const isDurationPickerOpen = ref(false)
const workBlockRef = ref<HTMLElement>()
const hasTaskTitle = computed(() => (props.task.title ?? '').trim().length > 0)
const { workedMinutesToday, isEnoughForToday } = useWorkBlockProgress(() => props.task)

const quickDurationOptions = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 }
] as const

const toggleDurationPicker = () => {
  isDurationPickerOpen.value = !isDurationPickerOpen.value
}

const setWorkBlock = async (duration: number) => {
  isDurationPickerOpen.value = false
  await taskStore.updateTaskWithUndo(props.task.id, { estimatedDuration: duration })
}

const workBlockLabel = computed(() => {
  if (isEnoughForToday.value) return 'Enough today'
  return props.formattedDuration
})

const workBlockTitle = computed(() => {
  if (isEnoughForToday.value) return `Enough for today: worked ${workedMinutesToday.value}m of ${props.task.estimatedDuration}m`
  return `Change work block length. Worked ${workedMinutesToday.value}m of ${props.task.estimatedDuration}m today.`
})

const closeDurationPickerOnOutsideClick = (event: MouseEvent) => {
  if (!isDurationPickerOpen.value) return
  if (workBlockRef.value?.contains(event.target as Node)) return
  isDurationPickerOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', closeDurationPickerOnOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDurationPickerOnOutsideClick)
})

const recurrenceDescription = computed(() => {
  if (!props.task.recurrenceRule) return ''
  return describeRecurrenceRule(props.task.recurrenceRule)
})

// BUG-1191: Highlight overdue or today's tasks (reactive to date changes)
const dueDateClass = computed(() => {
  if (!props.task.dueDate) return ''
  const _todayTrigger = reactiveToday.value
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(props.task.dueDate)
  due.setHours(0, 0, 0, 0)

  if (due < today) return 'due-overdue'
  if (due.getTime() === today.getTime()) return 'due-today'
  return ''
})
</script>

<style scoped>
.task-card-badges {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 18px;
  margin-top: var(--space-2);
}

.badge-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1_5) var(--space-2_5);
}

.badge-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--text-meta);
  color: var(--text-muted);
  white-space: nowrap;
}

.work-block {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.work-block-trigger {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 20px;
  padding: 1px var(--space-1_5);
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-size: var(--text-meta);
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  opacity: 0.82;
  transition: opacity var(--duration-fast), background var(--duration-fast), border-color var(--duration-fast), color var(--duration-fast);
}

.work-block-trigger:hover,
.work-block-trigger[aria-expanded="true"] {
  opacity: 1;
  color: var(--color-work);
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.35);
}

.work-block-trigger--empty {
  color: var(--text-muted);
  border-color: transparent;
  background: rgba(255, 255, 255, 0.03);
}

.work-block-trigger--empty:hover,
.work-block-trigger--empty[aria-expanded="true"] {
  color: var(--text-secondary);
  background: var(--glass-bg-soft);
  border-color: var(--glass-border);
}

.work-block-trigger--enough {
  color: var(--color-success);
  background: var(--green-bg-soft);
  border-color: var(--green-border);
}

.work-block-picker {
  position: absolute;
  z-index: var(--z-dropdown);
  top: calc(100% + var(--space-1));
  left: 0;
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-md);
  box-shadow: var(--overlay-component-shadow);
}

.work-block-option {
  min-width: 34px;
  padding: var(--space-1) var(--space-1_5);
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  font-size: var(--text-meta);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--duration-fast), border-color var(--duration-fast), color var(--duration-fast);
}

.work-block-option:hover,
.work-block-option.is-active {
  color: var(--text-primary);
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary);
}

.badge-text {
  font-size: var(--text-meta);
  font-weight: 400;
}

/* Due date highlighting */
.due-today {
  color: var(--color-work);
}

.due-today .badge-text {
  font-weight: 500;
}

.due-overdue {
  color: var(--color-priority-high);
}

.due-overdue .badge-text {
  font-weight: 500;
}

/* Pomodoro badge */
.badge-pomodoro {
  color: rgba(239, 68, 68, 0.6);
}

/* Recurring badge */
.badge-recurring {
  color: var(--brand-primary);
}

.badge-right {
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
}
</style>
