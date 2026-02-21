<template>
  <div
    class="task-card-badges"
    role="group"
    aria-label="Task metadata"
  >
    <!-- Due Date -->
    <span
      v-if="task.dueDate"
      class="meta-badge"
      :class="dueDateClass"
      :title="`Due: ${formattedDueDate}`"
    >
      {{ formattedDueDate }}
    </span>

    <!-- Dot separator -->
    <span v-if="task.dueDate && task.subtasks?.length" class="badge-separator">·</span>

    <!-- Subtasks -->
    <span
      v-if="task.subtasks?.length"
      class="meta-badge"
      :title="`Subtasks: ${completedSubtasks}/${task.subtasks.length}`"
    >
      {{ completedSubtasks }}/{{ task.subtasks.length }}
    </span>

    <!-- Dot separator for pomodoros -->
    <span v-if="(task.dueDate || task.subtasks?.length) && task.completedPomodoros > 0" class="badge-separator">·</span>

    <!-- Pomodoros (if any) -->
    <span
      v-if="task.completedPomodoros > 0"
      class="meta-badge pomodoro-badge"
      :title="`Pomodoro sessions: ${task.completedPomodoros}`"
    >
      {{ task.completedPomodoros }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@/stores/tasks'
import { reactiveToday, ensureDateTimer } from '@/composables/useReactiveDate'

const props = defineProps<{
  task: Task
  density?: 'ultrathin' | 'compact' | 'comfortable' | 'spacious'
  formattedDueDate: string
  formattedDuration: string
  completedSubtasks: number
  hasDependencies?: boolean
  durationBadgeClass: string
  projectVisual: any
}>()

// BUG-1191: Ensure date timer is running for reactive overdue detection
ensureDateTimer()

// BUG-1191: Highlight overdue or today's tasks (reactive to date changes)
const dueDateClass = computed(() => {
  if (!props.task.dueDate) return ''
  // BUG-1191: Reactive dependency - ensures re-evaluation at midnight
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
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  justify-content: flex-start;
  min-height: 18px;
  margin-top: var(--space-1);
}

/* Base Badge - Clean, minimal text style */
.meta-badge {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-meta);
  font-weight: 400;
  color: var(--text-tertiary);
  white-space: nowrap;
}

/* Dot separator between badges */
.badge-separator {
  color: var(--text-subtle);
  font-size: var(--text-meta);
  margin: 0 var(--space-1);
  user-select: none;
}

/* Due date highlighting */
.due-today {
  color: var(--color-work);
  font-weight: 500;
}

.due-overdue {
  color: var(--color-priority-high);
  font-weight: 500;
}

/* Pomodoro badge - subtle tomato indicator */
.pomodoro-badge {
  color: rgba(239, 68, 68, 0.6);
}

.pomodoro-badge::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  margin-inline-end: 4px;
}
</style>
