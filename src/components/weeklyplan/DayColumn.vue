<template>
  <div
    class="day-column"
    :class="{
      'is-today': isToday,
      'is-overloaded': capacityPercent > 100,
    }"
  >
    <div class="column-header">
      <div class="header-top">
        <span class="day-name">{{ dayName }}</span>
        <span class="day-date">{{ shortDate }}</span>
        <span class="header-stats">{{ tasks.length }}t</span>
        <button
          v-if="dayKey !== 'unscheduled'"
          class="resuggest-btn"
          title="Re-suggest tasks for this day"
          @click="$emit('resuggest', dayKey)"
        >
          <RefreshCw :size="11" />
        </button>
      </div>
      <div v-if="dayKey !== 'unscheduled'" class="capacity-row">
        <div class="capacity-bar-track">
          <div
            class="capacity-bar-fill"
            :class="capacityClass"
            :style="{ width: `${Math.min(capacityPercent, 100)}%` }"
          />
        </div>
        <span class="capacity-label">{{ formattedUsed }}/{{ formattedCapacity }}</span>
      </div>
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
            :ai-reason="props.taskReasons[taskId] || ''"
            @remove="(id) => $emit('removeTask', id)"
            @change-priority="(id) => $emit('changePriority', id)"
            @snooze="(id) => $emit('snoozeTask', id)"
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
import { RefreshCw } from 'lucide-vue-next'
import WeeklyTaskCard from './WeeklyTaskCard.vue'
import type { TaskSummary } from '@/composables/useWeeklyPlanAI'

interface Props {
  dayName: string
  dayKey: string
  date: Date
  tasks: TaskSummary[]
  isToday?: boolean
  modelValue: string[]
  dailyCapacityMinutes?: number
  taskReasons?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  isToday: false,
  dailyCapacityMinutes: 360, // 6 hours
  taskReasons: () => ({}),
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'resuggest': [dayKey: string]
  'removeTask': [taskId: string]
  'changePriority': [taskId: string]
  'snoozeTask': [taskId: string]
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

// Capacity bar computations
const capacityPercent = computed(() => {
  if (props.dailyCapacityMinutes <= 0) return 0
  return (totalMinutes.value / props.dailyCapacityMinutes) * 100
})

const capacityClass = computed(() => {
  const pct = capacityPercent.value
  if (pct > 100) return 'fill-danger'
  if (pct >= 80) return 'fill-warning'
  return 'fill-normal'
})

function formatMinutesShort(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${mins}m`
}

const formattedUsed = computed(() => formatMinutesShort(totalMinutes.value))
const formattedCapacity = computed(() => formatMinutesShort(props.dailyCapacityMinutes))

const taskMap = computed(() => {
  const map = new Map<string, TaskSummary>()
  for (const t of props.tasks) {
    map.set(t.id, t)
  }
  return map
})

// BUG-1321: Use local date (not UTC) to avoid timezone-related overdue false positives
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

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
  min-width: 320px;
  flex: 1 0 320px;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.day-column.is-today {
  border-left: 3px solid var(--brand-primary);
  background: rgba(78, 205, 196, 0.03);
}

.day-column.is-overloaded {
  border-color: rgba(239, 68, 68, 0.3);
}

.column-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border-bottom: 1px solid var(--glass-border);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.header-top {
  display: flex;
  align-items: baseline;
  gap: var(--space-1_5);
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

.header-stats {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-left: auto;
}

.resuggest-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast);
  opacity: 0;
  flex-shrink: 0;
}

.day-column:hover .resuggest-btn {
  opacity: 1;
}

.resuggest-btn:hover {
  background: var(--glass-bg-medium);
  color: var(--brand-primary);
}

/* Capacity bar — inline in header */
.capacity-row {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
}

.capacity-bar-track {
  flex: 1;
  height: 3px;
  background: var(--glass-bg-medium);
  border-radius: 2px;
  overflow: hidden;
}

.capacity-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width var(--duration-normal) var(--spring-smooth);
}

.capacity-bar-fill.fill-normal {
  background: var(--brand-primary);
}

.capacity-bar-fill.fill-warning {
  background: var(--color-warning);
}

.capacity-bar-fill.fill-danger {
  background: var(--color-danger);
  animation: dangerPulse 2s ease-in-out infinite;
}

@keyframes dangerPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.capacity-label {
  font-size: 9px;
  color: var(--text-muted);
  white-space: nowrap;
}

.column-tasks {
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

@media (prefers-reduced-motion: reduce) {
  .capacity-bar-fill.fill-danger {
    animation: none;
  }
}
</style>
