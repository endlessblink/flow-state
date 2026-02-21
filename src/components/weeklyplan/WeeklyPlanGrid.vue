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
      @remove-task="(id) => $emit('removeTask', id)"
      @change-priority="(id) => $emit('changePriority', id)"
      @snooze-task="(id) => $emit('snoozeTask', id)"
      @overloaded="onDayOverloaded"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
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
  'moveTask': [taskId: string, fromDay: keyof WeeklyPlan, toDay: keyof WeeklyPlan]
  'resuggest': [dayKey: string]
  'removeTask': [taskId: string]
  'changePriority': [taskId: string]
  'snoozeTask': [taskId: string]
}>()

const settings = useSettingsStore()

// TASK-1326: Track overloaded days for warning banner
const overloadedDays = ref<Array<{ dayName: string; dayKey: string; percent: number; totalMinutes: number }>>([])

function onDayOverloaded(data: { dayName: string; dayKey: string; percent: number; totalMinutes: number }) {
  // Replace or add
  const idx = overloadedDays.value.findIndex(d => d.dayKey === data.dayKey)
  if (idx >= 0) {
    overloadedDays.value[idx] = data
  } else {
    overloadedDays.value.push(data)
  }
}

// Also compute overloaded from current plan data (for initial load / plan restore)
const computedOverloadedDays = computed(() => {
  const result: Array<{ dayName: string; dayKey: string; percent: number; totalMinutes: number }> = []
  for (const col of columns.value) {
    if (col.key === 'unscheduled') continue
    const totalMins = col.tasks.reduce((sum, t) => sum + (t.estimatedDuration || 0), 0)
    const pct = totalMins > 0 ? (totalMins / 360) * 100 : 0  // 360 = default 6h capacity
    if (pct > 100) {
      result.push({ dayName: col.label, dayKey: col.key, percent: Math.round(pct), totalMinutes: totalMins })
    }
  }
  return result
})

defineExpose({ overloadedDays: computedOverloadedDays })

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
        emit('moveTask', id, fromDay, dayKey)
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
