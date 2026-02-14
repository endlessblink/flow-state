<template>
  <div class="weekly-plan-grid">
    <DayColumn
      v-for="col in columns"
      :key="col.key"
      :day-name="col.label"
      :day-key="col.key"
      :date="col.date"
      :tasks="col.tasks"
      :is-today="col.isToday"
      :model-value="col.taskIds"
      :task-reasons="props.taskReasons"
      @update:model-value="(ids) => onColumnUpdate(col.key, ids)"
      @resuggest="(dayKey) => $emit('resuggest', dayKey)"
      @remove-task="(id) => $emit('remove-task', id)"
      @change-priority="(id) => $emit('change-priority', id)"
      @snooze-task="(id) => $emit('snooze-task', id)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DayColumn from './DayColumn.vue'
import { useSettingsStore } from '@/stores/settings'
import type { WeeklyPlan, TaskSummary } from '@/composables/useWeeklyPlanAI'

interface Props {
  plan: WeeklyPlan
  taskMap: Map<string, TaskSummary>
  weekStart: Date
  taskReasons?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  taskReasons: () => ({}),
})

const emit = defineEmits<{
  'move-task': [taskId: string, fromDay: keyof WeeklyPlan, toDay: keyof WeeklyPlan]
  'resuggest': [dayKey: string]
  'remove-task': [taskId: string]
  'change-priority': [taskId: string]
  'snooze-task': [taskId: string]
}>()

const settings = useSettingsStore()

// TASK-1321: Dynamic day config based on weekStartsOn setting
const DAY_CONFIG = computed(() => {
  const allDays = [
    { key: 'sunday' as const, label: 'Sunday', jsDay: 0 },
    { key: 'monday' as const, label: 'Monday', jsDay: 1 },
    { key: 'tuesday' as const, label: 'Tuesday', jsDay: 2 },
    { key: 'wednesday' as const, label: 'Wednesday', jsDay: 3 },
    { key: 'thursday' as const, label: 'Thursday', jsDay: 4 },
    { key: 'friday' as const, label: 'Friday', jsDay: 5 },
    { key: 'saturday' as const, label: 'Saturday', jsDay: 6 },
  ]

  const startDay = settings.weekStartsOn ?? 0
  const ordered = [...allDays.slice(startDay), ...allDays.slice(0, startDay)]

  return [
    ...ordered.map((d, i) => ({ key: d.key, label: d.label, offset: i })),
    { key: 'unscheduled' as const, label: 'Unscheduled', offset: -1 },
  ]
})

const today = new Date()
today.setHours(0, 0, 0, 0)

const columns = computed(() => {
  return DAY_CONFIG.value.map((cfg) => {
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
  align-items: flex-start;
  gap: var(--space-2);
  overflow-x: auto;
  padding: var(--space-2) 0;
  scroll-behavior: smooth;
}
</style>
