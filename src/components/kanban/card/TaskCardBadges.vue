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
    </div>

    <!-- Assignee Avatar (right side) -->
    <div v-if="task.assignedTo && !isPersonalWorkspace" class="badge-right">
      <AssigneeAvatar :user-id="task.assignedTo" :size="18" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@/stores/tasks'
import { Calendar, CheckSquare, Timer, Paperclip, Repeat } from 'lucide-vue-next'
import { reactiveToday, ensureDateTimer } from '@/composables/useReactiveDate'
import { describeRecurrenceRule } from '@/utils/recurrenceUtils'
import { useWorkspaceStore } from '@/stores/workspace'
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
const isPersonalWorkspace = computed(() => workspaceStore.isPersonalWorkspace)

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
  margin-top: var(--space-1_5);
}

.badge-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.badge-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--text-meta);
  color: var(--text-muted);
  white-space: nowrap;
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
