<template>
  <div class="weekly-plan-grid">
    <DayColumn
      v-for="col in columns"
      :key="col.key"
      :day-name="col.label"
      :date="col.date"
      :tasks="col.tasks"
      :is-today="col.isToday"
      :model-value="col.taskIds"
      @update:model-value="(ids) => onColumnUpdate(col.key, ids)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DayColumn from './DayColumn.vue'
import type { WeeklyPlan, TaskSummary } from '@/composables/useWeeklyPlanAI'

interface Props {
  plan: WeeklyPlan
  taskMap: Map<string, TaskSummary>
  weekStart: Date
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'move-task': [taskId: string, fromDay: keyof WeeklyPlan, toDay: keyof WeeklyPlan]
}>()

const DAY_CONFIG = [
  { key: 'monday' as const, label: 'Monday', offset: 0 },
  { key: 'tuesday' as const, label: 'Tuesday', offset: 1 },
  { key: 'wednesday' as const, label: 'Wednesday', offset: 2 },
  { key: 'thursday' as const, label: 'Thursday', offset: 3 },
  { key: 'friday' as const, label: 'Friday', offset: 4 },
  { key: 'saturday' as const, label: 'Saturday', offset: 5 },
  { key: 'sunday' as const, label: 'Sunday', offset: 6 },
  { key: 'unscheduled' as const, label: 'Unscheduled', offset: -1 },
]

const today = new Date()
today.setHours(0, 0, 0, 0)

const columns = computed(() => {
  return DAY_CONFIG.map((cfg) => {
    const date = new Date(props.weekStart)
    if (cfg.offset >= 0) {
      date.setDate(props.weekStart.getDate() + cfg.offset)
    }

    const isToday = cfg.offset >= 0 &&
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()

    const taskIds = props.plan[cfg.key] || []
    const tasks = taskIds
      .map((id) => props.taskMap.get(id))
      .filter((t): t is TaskSummary => !!t)

    return {
      key: cfg.key,
      label: cfg.label,
      date,
      isToday,
      taskIds,
      tasks,
    }
  })
})

function onColumnUpdate(dayKey: keyof WeeklyPlan, newIds: string[]) {
  const oldIds = new Set(props.plan[dayKey])
  const newIdSet = new Set(newIds)

  // Find task that was added to this column
  for (const id of newIds) {
    if (!oldIds.has(id)) {
      // Determine which column it came from
      const fromDay = findTaskSource(id, dayKey)
      if (fromDay) {
        emit('move-task', id, fromDay, dayKey)
      }
    }
  }

  // Find task that was removed (reorder within same column)
  // If no new task was added, this is just a reorder - still emit for the parent to handle
  if (newIds.length === oldIds.size) {
    const changed = newIds.some((id, i) => {
      const oldArr = props.plan[dayKey]
      return oldArr[i] !== id
    })
    if (changed) {
      // Internal reorder - no cross-column move needed
    }
  }
}

function findTaskSource(taskId: string, excludeDay: keyof WeeklyPlan): keyof WeeklyPlan | null {
  const allKeys: (keyof WeeklyPlan)[] = [
    'monday', 'tuesday', 'wednesday', 'thursday',
    'friday', 'saturday', 'sunday', 'unscheduled',
  ]
  for (const key of allKeys) {
    if (key === excludeDay) continue
    if (props.plan[key].includes(taskId)) {
      return key
    }
  }
  return null
}
</script>

<style scoped>
.weekly-plan-grid {
  display: flex;
  gap: var(--space-3);
  overflow-x: auto;
  padding: var(--space-4);
  min-height: 400px;
  scroll-behavior: smooth;
}
</style>
