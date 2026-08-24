<script setup lang="ts">
import { computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import OverflowTooltip from '@/components/base/OverflowTooltip.vue'
import type { TaskPriority } from '@/types/tasks'

const props = defineProps<{
  task: {
    id: string
    title: string
    priority: TaskPriority
    dueDate: string
    projectId: string
  }
}>()

const emit = defineEmits<{
  contextmenu: [taskId: string, event: MouseEvent]
}>()

const taskStore = useTaskStore()

const projectName = computed(() => {
  if (!props.task.projectId) return ''
  const project = taskStore.projects?.find((p) => p.id === props.task.projectId)
  return project?.name ?? ''
})

const priorityColor = computed(() => {
  switch (props.task.priority) {
    case 'immediate':
    case 'high':
      return 'var(--color-danger)'
    case 'medium':
      return 'var(--color-warning)'
    case 'low':
      return 'var(--brand-primary)'
    case 'relaxed':
      return 'var(--text-muted)'
    default:
      return 'var(--text-muted)'
  }
})

const formattedDueDate = computed(() => {
  if (!props.task.dueDate) return ''
  const due = new Date(props.task.dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)

  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'

  return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})

const isOverdue = computed(() => {
  if (!props.task.dueDate) return false
  const due = new Date(props.task.dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  return due.getTime() < today.getTime()
})
</script>

<template>
  <div class="pool-card" :data-task-id="task.id" :data-task-title="task.title" @contextmenu.prevent="emit('contextmenu', task.id, $event)">
    <span
      class="priority-dot"
      :style="{ backgroundColor: priorityColor }"
    />

    <OverflowTooltip :text="task.title" class="pool-card-title" style="flex: 1; min-width: 0">{{ task.title }}</OverflowTooltip>

    <span
      v-if="task.dueDate"
      class="due-badge"
      :class="{ 'due-badge--overdue': isOverdue }"
    >
      {{ formattedDueDate }}
    </span>

    <OverflowTooltip v-if="projectName" :text="projectName" class="project-tag">{{ projectName }}</OverflowTooltip>
  </div>
</template>

<style scoped>
.pool-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--surface-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: grab;
  min-height: 40px;
  max-height: 48px;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  user-select: none;
}

.pool-card:hover {
  border-color: var(--border-hover);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.pool-card:active {
  cursor: grabbing;
}

.priority-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.pool-card-title {
  font-size: 0.8rem;
  color: var(--text-primary);
  line-height: 1.3;
}

.due-badge {
  font-size: 0.65rem;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  padding: 1px var(--space-1);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-sm);
}

.due-badge--overdue {
  color: var(--color-danger);
  background: rgba(255, 107, 107, 0.08);
}

.project-tag {
  font-size: 0.65rem;
  color: var(--text-muted);
  max-width: 80px;
  flex-shrink: 0;
}
</style>
