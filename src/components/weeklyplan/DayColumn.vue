<template>
  <div class="day-column" :class="{ 'is-today': isToday }">
    <div class="column-header">
      <span class="day-name">{{ dayName }}</span>
      <span class="day-date">{{ shortDate }}</span>
    </div>
    <div class="column-stats">
      <span class="stat-item">{{ tasks.length }} tasks</span>
      <span v-if="totalMinutes > 0" class="stat-item">{{ totalMinutes }}m</span>
    </div>
    <div class="column-tasks">
      <draggable
        v-model="localTaskIds"
        :group="{ name: 'weekly-tasks', pull: true, put: true }"
        item-key="id"
        class="drag-area"
        :animation="200"
        ghost-class="ghost-card"
        @change="onDragChange"
      >
        <template #item="{ element: taskId }">
          <WeeklyTaskCard
            :key="taskId"
            :task="resolveTask(taskId)"
            :is-overdue="isTaskOverdue(taskId)"
          />
        </template>
        <template #footer>
          <div v-if="localTaskIds.length === 0" class="empty-state">
            No tasks
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import draggable from 'vuedraggable'
import WeeklyTaskCard from './WeeklyTaskCard.vue'
import type { TaskSummary } from '@/composables/useWeeklyPlanAI'

interface Props {
  dayName: string
  date: Date
  tasks: TaskSummary[]
  isToday?: boolean
  modelValue: string[]
}

const props = withDefaults(defineProps<Props>(), {
  isToday: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const localTaskIds = ref<string[]>([...props.modelValue])

watch(() => props.modelValue, (newVal) => {
  localTaskIds.value = [...newVal]
})

function onDragChange() {
  emit('update:modelValue', [...localTaskIds.value])
}

const shortDate = computed(() => {
  const month = props.date.toLocaleDateString('en-US', { month: 'short' })
  const day = props.date.getDate()
  return `${month} ${day}`
})

const totalMinutes = computed(() => {
  return props.tasks.reduce((sum, t) => sum + (t.estimatedDuration || 0), 0)
})

const taskMap = computed(() => {
  const map = new Map<string, TaskSummary>()
  for (const t of props.tasks) {
    map.set(t.id, t)
  }
  return map
})

const today = new Date().toISOString().split('T')[0]

function resolveTask(taskId: string): TaskSummary {
  return taskMap.value.get(taskId) || {
    id: taskId,
    title: 'Unknown task',
    priority: null,
    dueDate: '',
    status: '',
    projectId: '',
  }
}

function isTaskOverdue(taskId: string): boolean {
  const task = taskMap.value.get(taskId)
  if (!task || !task.dueDate) return false
  return task.dueDate < today
}
</script>

<style scoped>
.day-column {
  display: flex;
  flex-direction: column;
  min-width: 180px;
  max-width: 250px;
  flex: 1;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.day-column.is-today {
  border-left: 3px solid var(--brand-primary);
}

.column-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-soft);
  border-bottom: 1px solid var(--glass-border);
}

.day-name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.day-date {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.column-stats {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1_5) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}

.stat-item {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.column-tasks {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
}

.drag-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 60px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.ghost-card {
  opacity: 0.5;
}
</style>
