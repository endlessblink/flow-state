<template>
  <div
    class="task-card-badges"
    role="group"
    aria-label="Task metadata"
  >
    <!-- Due Date -->
    <span
      v-if="task.dueDate"
      class="meta-badge due-date-badge"
      :class="{ 'meta-badge--icon-only': density === 'ultrathin' }"
      :title="`Due: ${formattedDueDate}`"
    >
      <Calendar :size="10" aria-hidden="true" />
      <span v-if="density !== 'ultrathin'">{{ formattedDueDate }}</span>
    </span>

    <!-- Priority -->
    <span
      class="meta-badge priority-badge"
      :class="[`priority-${task.priority || 'medium'}`, { 'meta-badge--icon-only': density === 'ultrathin' }]"
      :title="`Priority: ${(task.priority || 'medium').toUpperCase()}`"
    >
      <span class="priority-dot" aria-hidden="true" />
      <span v-if="density !== 'ultrathin'">{{ (task.priority || 'medium').charAt(0).toUpperCase() }}</span>
    </span>

    <!-- Project Visual -->
    <div
      class="meta-badge project-visual-container"
      :class="{ 'project-visual-container--emoji': projectVisual.type === 'emoji' }"
      :title="projectTitle"
    >
      <ProjectEmojiIcon
        v-if="projectVisual.type === 'emoji'"
        :emoji="projectVisual.content"
        size="sm"
        :title="projectTitle"
      />
      <div
        v-else-if="projectVisual.type === 'css-circle'"
        class="project-css-circle"
        :style="{ '--project-color': projectVisual.color }"
        :title="projectTitle"
      />
      <ProjectEmojiIcon
        v-else
        emoji="📁"
        size="sm"
        :title="projectTitle"
      />
    </div>

    <!-- Subtasks -->
    <span
      v-if="task.subtasks?.length"
      class="meta-badge subtasks-badge"
      :class="{ 'meta-badge--icon-only': density === 'ultrathin' }"
      :title="`Subtasks: ${completedSubtasks}/${task.subtasks.length}`"
    >
      <List :size="10" aria-hidden="true" />
      <span v-if="density !== 'ultrathin'">{{ completedSubtasks }}/{{ task.subtasks.length }}</span>
    </span>

    <!-- Dependencies -->
    <span
      v-if="hasDependencies"
      class="meta-badge dependency-badge"
      :class="{ 'meta-badge--icon-only': density === 'ultrathin' }"
      :title="`Dependencies: ${task.dependsOn?.length || 0}`"
    >
      <Link :size="10" aria-hidden="true" />
      <span v-if="density !== 'ultrathin'">{{ task.dependsOn?.length || 0 }}</span>
    </span>

    <!-- Pomodoros -->
    <span
      v-if="task.completedPomodoros > 0"
      class="meta-badge pomodoro-badge"
      :class="{ 'meta-badge--icon-only': density === 'ultrathin' }"
      :title="`Pomodoro sessions: ${task.completedPomodoros}`"
    >
      <span class="pomodoro-icon" aria-hidden="true">🍅</span>
      <span v-if="density !== 'ultrathin'">{{ task.completedPomodoros }}</span>
    </span>

    <!-- Duration -->
    <span
      v-if="task.estimatedDuration"
      class="meta-badge duration-badge"
      :class="[
        durationBadgeClass,
        { 'meta-badge--icon-only': density === 'ultrathin' }
      ]"
      :title="`Duration: ${formattedDuration}`"
    >
      <component :is="durationIcon" :size="10" aria-hidden="true" />
      <span v-if="density !== 'ultrathin'">{{ formattedDuration }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, List, Link, Zap, Timer, Clock } from 'lucide-vue-next'
import type { Task } from '@/stores/tasks'
import { useTaskStore } from '@/stores/tasks'
import ProjectEmojiIcon from '@/components/base/ProjectEmojiIcon.vue'

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

const taskStore = useTaskStore()

const projectTitle = computed(() => 
  `Project: ${taskStore.getProjectDisplayName(props.task.projectId)}`
)

const durationIcon = computed(() => {
  const d = props.task.estimatedDuration || 0
  if (d <= 15) return Zap
  if (d <= 60) return Timer
  return Clock
})
</script>

<style scoped>
.task-card-badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-start;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border-subtle) transparent;
  min-height: 20px;
  margin-top: var(--space-2);
}

.task-card-badges::-webkit-scrollbar {
  height: 2px;
}

.task-card-badges::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: var(--radius-full);
}

/* Base Badge */
.meta-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--task-card-padding-xs, 4px);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 2px 6px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.meta-badge--icon-only {
  padding: 2px;
  min-width: 16px;
  min-height: 16px;
  justify-content: center;
}

/* Badge Variations */
.due-date-badge {
  color: var(--due-date-text);
  background: var(--due-date-bg);
  border: 1px solid var(--due-date-border);
}

.subtasks-badge {
  color: var(--text-secondary);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
}

.dependency-badge {
  color: var(--text-secondary);
  background: var(--purple-bg-subtle);
  border: 1px solid var(--purple-border-light);
}

.pomodoro-badge {
  color: var(--text-muted);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
}

/* Priority Badges */
.priority-badge { gap: 4px; }
.priority-badge.priority-high { color: var(--priority-high-text); background: var(--priority-high-bg); border: 1px solid var(--priority-high-border); }
.priority-badge.priority-medium { color: var(--priority-medium-text); background: var(--priority-medium-bg); border: 1px solid var(--priority-medium-border); }
.priority-badge.priority-low { color: var(--priority-low-text); background: var(--priority-low-bg); border: 1px solid var(--priority-low-border); }

.priority-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* Duration Badges */
.duration-badge.duration-quick { color: var(--green-text); background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); }
.duration-badge.duration-short { color: var(--color-work); background: var(--blue-bg-subtle); border: 1px solid var(--blue-border-light); }
.duration-badge.duration-medium { color: var(--orange-text); background: var(--orange-bg-subtle); border: 1px solid rgba(249, 115, 22, 0.2); }
.duration-badge.duration-long { color: var(--danger-text); background: var(--danger-bg-subtle); border: 1px solid var(--danger-border-light); }

/* Project Visuals */
.project-visual-container {
  padding: 2px;
  background: transparent;
  border: none;
}
.project-css-circle {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--project-color);
}
</style>
