<template>
  <div
    class="task-card-badges"
    role="group"
    aria-label="Task metadata"
  >
    <!-- Due Date - text only -->
    <span
      v-if="task.dueDate"
      class="meta-badge due-date-badge"
      :title="`Due: ${formattedDueDate}`"
    >
      {{ formattedDueDate }}
    </span>

    <!-- Priority - dot only for high priority -->
    <span
      v-if="task.priority === 'high'"
      class="meta-badge priority-badge priority-high"
      title="High Priority"
    >
      <span class="priority-dot" aria-hidden="true" />
    </span>

    <!-- Subtasks - text only -->
    <span
      v-if="task.subtasks?.length"
      class="meta-badge subtasks-badge"
      :title="`Subtasks: ${completedSubtasks}/${task.subtasks.length}`"
    >
      {{ completedSubtasks }}/{{ task.subtasks.length }}
    </span>

    <!-- Pomodoros - just count -->
    <span
      v-if="task.completedPomodoros > 0"
      class="meta-badge pomodoro-badge"
      :title="`Pomodoro sessions: ${task.completedPomodoros}`"
    >
      🍅{{ task.completedPomodoros }}
    </span>
  </div>
</template>

<script setup lang="ts">
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
</script>

<style scoped>
.task-card-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-start;
  min-height: 20px;
  margin-top: 0;
}

/* Base Badge - Clean, minimal text style */
.meta-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.45);
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: none;
  white-space: nowrap;
}

.meta-badge--icon-only {
  padding: 0;
  min-width: auto;
  min-height: auto;
}

/* All badges - just text, no backgrounds */
.due-date-badge,
.subtasks-badge,
.dependency-badge,
.pomodoro-badge,
.duration-badge {
  color: rgba(255, 255, 255, 0.45);
  background: transparent;
  border: none;
}

/* Priority - dot only, minimal */
.priority-badge {
  gap: 5px;
  background: transparent;
  padding: 0;
}
.priority-badge.priority-high { color: rgba(239, 68, 68, 0.7); }
.priority-badge.priority-medium { color: rgba(255, 255, 255, 0.35); }
.priority-badge.priority-low { color: rgba(96, 165, 250, 0.6); }

.priority-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

/* Duration - text only */
.duration-badge.duration-quick,
.duration-badge.duration-short,
.duration-badge.duration-medium,
.duration-badge.duration-long {
  color: rgba(255, 255, 255, 0.45);
  background: transparent;
  border: none;
}

/* Project Visual - minimal */
.project-visual-container {
  padding: 0;
  background: transparent;
  border: none;
}
.project-css-circle {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--project-color);
  opacity: 0.6;
}
</style>
