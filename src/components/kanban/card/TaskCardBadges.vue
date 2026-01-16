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

// Highlight overdue or today's tasks
const dueDateClass = computed(() => {
  if (!props.task.dueDate) return ''
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
  font-size: 12px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

/* Dot separator between badges */
.badge-separator {
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  margin: 0 var(--space-1);
  user-select: none;
}

/* Due date highlighting */
.due-today {
  color: var(--color-work, #22c55e);
  font-weight: 500;
}

.due-overdue {
  color: var(--color-priority-high, #ef4444);
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
