<template>
  <div class="inbox-time-filters">
    <div class="filter-buttons">
      <button
        v-for="filter in timeFilters"
        :key="filter.key"
        class="filter-btn"
        :class="{ active: activeFilter === filter.key }"
        @click="$emit('filter-changed', filter.key)"
        :title="`${filter.description} (${filter.count} tasks)`"
      >
        <component :is="filter.icon" :size="14" />
        <span class="filter-count" v-if="filter.count > 0">{{ filter.count }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Inbox,
  Clock,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CalendarX
} from 'lucide-vue-next'
import type { Task } from '@/stores/tasks'

interface TimeFilter {
  key: 'all' | 'now' | 'today' | 'tomorrow' | 'thisWeek' | 'noDate'
  label: string
  description: string
  icon: any
  count: number
}

interface Props {
  tasks: Task[]
  activeFilter: string
}

const props = defineProps<Props>()

defineEmits<{
  'filter-changed': [filterKey: string]
}>()

// Helper functions for date calculations
const getToday = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

const getTomorrow = () => {
  const tomorrow = new Date(getToday())
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow
}

const getWeekEnd = () => {
  const weekEnd = new Date(getToday())
  weekEnd.setDate(weekEnd.getDate() + 7)
  return weekEnd
}

const isToday = (dateStr?: string) => {
  if (!dateStr) return false
  const today = getToday()
  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)
  return date.getTime() === today.getTime()
}

const isTomorrow = (dateStr?: string) => {
  if (!dateStr) return false
  const tomorrow = getTomorrow()
  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)
  return date.getTime() === tomorrow.getTime()
}

const isThisWeek = (dateStr?: string) => {
  if (!dateStr) return false
  const today = getToday()
  const weekEnd = getWeekEnd()
  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)
  return date >= today && date < weekEnd
}

const hasDate = (task: Task) => {
  // Check instances first (new format)
  if (task.instances && task.instances.length > 0) {
    return task.instances.some(inst => inst.scheduledDate)
  }
  // Fallback to legacy scheduledDate
  return !!task.scheduledDate
}

const filterTasks = (filterKey: string) => {
  return props.tasks.filter(task => {
    switch (filterKey) {
      case 'all':
        return true

      case 'now':
        // Tasks due today, created today, currently in progress, or currently running (timer active)
        const today = getToday().toISOString().split('T')[0]
        const taskCreatedDate = new Date(task.createdAt)
        taskCreatedDate.setHours(0, 0, 0, 0)

        // Check instances for today scheduling
        if (task.instances && task.instances.length > 0) {
          if (task.instances.some(inst => inst.scheduledDate === today)) return true
        }
        // Fallback to legacy scheduledDate
        if (task.scheduledDate === today) return true

        // Tasks created today
        if (taskCreatedDate.getTime() === getToday().getTime()) return true

        // Tasks due today
        if (task.dueDate === today) return true

        // Tasks currently in progress
        if (task.status === 'in_progress') return true

        return false

      case 'today':
        // Tasks scheduled for today
        const todayStr = getToday().toISOString().split('T')[0]

        // Check instances first
        if (task.instances && task.instances.length > 0) {
          return task.instances.some(inst => inst.scheduledDate === todayStr)
        }
        // Fallback to legacy scheduledDate
        return task.scheduledDate === todayStr

      case 'tomorrow':
        // Tasks scheduled for tomorrow
        const tomorrowStr = getTomorrow().toISOString().split('T')[0]

        // Check instances first
        if (task.instances && task.instances.length > 0) {
          return task.instances.some(inst => inst.scheduledDate === tomorrowStr)
        }
        // Fallback to legacy scheduledDate
        return task.scheduledDate === tomorrowStr

      case 'thisWeek':
        // Tasks scheduled within next 7 days
        const todayWeek = getToday().toISOString().split('T')[0]
        const weekEndStr = getWeekEnd().toISOString().split('T')[0]

        // Check instances first
        if (task.instances && task.instances.length > 0) {
          return task.instances.some(inst =>
            inst.scheduledDate >= todayWeek && inst.scheduledDate < weekEndStr
          )
        }
        // Fallback to legacy scheduledDate
        if (!task.scheduledDate) return false
        return task.scheduledDate >= todayWeek && task.scheduledDate < weekEndStr

      case 'noDate':
        // Tasks without any scheduled date
        return !hasDate(task)

      default:
        return true
    }
  })
}

// Computed filter definitions with counts
const timeFilters = computed((): TimeFilter[] => [
  {
    key: 'all',
    label: 'All',
    description: 'Show all inbox tasks',
    icon: Inbox,
    count: props.tasks.length
  },
  {
    key: 'now',
    label: 'Now',
    description: 'Tasks for right now (today, in progress, or created today)',
    icon: Clock,
    count: filterTasks('now').length
  },
  {
    key: 'today',
    label: 'Today',
    description: 'Tasks scheduled for today',
    icon: Calendar,
    count: filterTasks('today').length
  },
  {
    key: 'tomorrow',
    label: 'Tomorrow',
    description: 'Tasks scheduled for tomorrow',
    icon: CalendarDays,
    count: filterTasks('tomorrow').length
  },
  {
    key: 'thisWeek',
    label: 'This Week',
    description: 'Tasks scheduled within the next 7 days',
    icon: CalendarPlus,
    count: filterTasks('thisWeek').length
  },
  {
    key: 'noDate',
    label: 'No Date',
    description: 'Tasks without a scheduled date',
    icon: CalendarX,
    count: filterTasks('noDate').length
  }
])
</script>

<style scoped>
.inbox-time-filters {
  padding: var(--space-3) var(--space-4) 0;
}

.filter-buttons {
  display: flex;
  gap: 2px;
}

.filter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 32px;
  height: 32px;
  background: linear-gradient(
    135deg,
    var(--glass-bg-soft) 0%,
    var(--glass-bg-light) 100%
  );
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  overflow: hidden;
}

.filter-btn:hover {
  background: linear-gradient(
    135deg,
    var(--state-hover-bg) 0%,
    var(--glass-bg-soft) 100%
  );
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  transform: translateY(-1px) scale(1.05);
  box-shadow: var(--state-hover-shadow);
}

.filter-btn.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  backdrop-filter: var(--state-active-glass);
  color: var(--state-active-text);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
  transform: scale(1.05);
}

.filter-count {
  position: absolute;
  top: -1px;
  right: -1px;
  background: var(--accent-primary);
  border: 1px solid var(--surface-primary);
  border-radius: var(--radius-full);
  font-size: 9px;
  font-weight: var(--font-semibold);
  padding: 0 2px;
  min-width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  line-height: 1;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.filter-btn.active .filter-count {
  background: var(--surface-primary);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
}

/* Icon scaling for different screen sizes */
@media (max-width: 320px) {
  .filter-btn {
    width: 28px;
    height: 28px;
  }

  .filter-btn:hover,
  .filter-btn.active {
    transform: scale(1.02);
  }
}

/* Smooth transitions for count badges */
.filter-count {
  transition: all var(--duration-fast) var(--spring-smooth);
}

/* Ensure icons are properly centered */
.filter-btn > :first-child {
  flex-shrink: 0;
}
</style>