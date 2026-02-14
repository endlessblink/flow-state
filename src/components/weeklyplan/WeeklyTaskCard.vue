<template>
  <div class="weekly-task-card" :class="{ 'is-overdue': isOverdue }">
    <div
      class="priority-dot"
      :style="{ backgroundColor: priorityColor }"
    />
    <div class="card-content">
      <span class="task-title">{{ task.title }}</span>
      <div class="card-meta">
        <span v-if="task.projectId" class="project-badge">
          Project
        </span>
        <span v-if="task.estimatedDuration" class="duration-badge">
          {{ formattedDuration }}
        </span>
        <span v-if="isOverdue" class="overdue-badge">
          Overdue
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskSummary } from '@/composables/useWeeklyPlanAI'

interface Props {
  task: TaskSummary
  isOverdue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isOverdue: false,
})

const priorityColor = computed(() => {
  switch (props.task.priority) {
    case 'high': return 'var(--color-danger)'
    case 'medium': return 'var(--color-warning)'
    case 'low': return 'var(--color-info)'
    default: return 'var(--text-muted)'
  }
})

const formattedDuration = computed(() => {
  const mins = props.task.estimatedDuration
  if (!mins) return ''
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${mins}m`
})
</script>

<style scoped>
.weekly-task-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: grab;
  transition: border-color var(--duration-fast) var(--spring-smooth);
  user-select: none;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.weekly-task-card:hover {
  border-color: var(--glass-border-hover);
}

.weekly-task-card:active {
  cursor: grabbing;
}

.weekly-task-card.is-overdue {
  border-color: var(--danger-border-subtle);
}

.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  margin-top: 6px;
}

.card-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.task-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  line-height: var(--leading-tight);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  flex-wrap: wrap;
}

.project-badge,
.duration-badge {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  line-height: var(--leading-none);
}

.duration-badge {
  color: var(--text-muted);
}

.overdue-badge {
  font-size: var(--text-xs);
  color: var(--color-danger);
  font-weight: var(--font-semibold);
  line-height: var(--leading-none);
}
</style>
