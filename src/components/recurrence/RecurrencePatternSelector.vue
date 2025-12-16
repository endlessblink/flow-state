<template>
  <div class="recurrence-pattern-selector">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
        Recurrence
      </h3>
      <label class="flex items-center cursor-pointer">
        <input
          v-model="isEnabled"
          type="checkbox"
          class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          @change="handleToggle"
        >
        <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
          Enable recurring
        </span>
      </label>
    </div>

    <div v-if="isEnabled" class="space-y-4">
      <!-- Pattern Selection -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Repeat
        </label>
        <select
          v-model="selectedPattern"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          @change="handlePatternChange"
        >
          <option value="none">
            None
          </option>
          <option value="daily">
            Daily
          </option>
          <option value="weekly">
            Weekly
          </option>
          <option value="monthly">
            Monthly
          </option>
          <option value="yearly">
            Yearly
          </option>
        </select>
      </div>

      <!-- Pattern-specific options -->
      <div v-if="selectedPattern !== 'none'" class="space-y-3">
        <!-- Interval -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Every
          </label>
          <div class="flex items-center space-x-2">
            <input
              v-model.number="interval"
              type="number"
              min="1"
              class="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {{ intervalUnit }}
            </span>
          </div>
        </div>

        <!-- Weekly Options -->
        <div v-if="selectedPattern === 'weekly'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            On these days
          </label>
          <div class="grid grid-cols-7 gap-1">
            <label
              v-for="(day, index) in weekDays"
              :key="day.value"
              class="flex flex-col items-center"
            >
              <input
                v-model="selectedWeekdays"
                type="checkbox"
                :value="day.value"
                class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              >
              <span class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {{ day.label }}
              </span>
            </label>
          </div>
        </div>

        <!-- Monthly Options -->
        <div v-if="selectedPattern === 'monthly'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            On day
          </label>
          <select
            v-model.number="dayOfMonth"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option v-for="day in 31" :key="day" :value="day">
              {{ day }}{{ getDaySuffix(day) }}
            </option>
          </select>
        </div>

        <!-- Yearly Options -->
        <div v-if="selectedPattern === 'yearly'" class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              On
            </label>
            <select
              v-model.number="selectedMonth"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              <option v-for="(month, index) in months" :key="index" :value="index + 1">
                {{ month }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Day
            </label>
            <select
              v-model.number="dayOfMonth"
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              <option v-for="day in getDaysInSelectedMonth()" :key="day" :value="day">
                {{ day }}{{ getDaySuffix(day) }}
              </option>
            </select>
          </div>
        </div>

        <!-- End Condition -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ends
          </label>
          <div class="space-y-2">
            <label class="flex items-center">
              <input
                v-model="endType"
                type="radio"
                value="never"
                class="border-gray-300 text-blue-600 focus:ring-blue-500"
              >
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Never</span>
            </label>
            <label class="flex items-center">
              <input
                v-model="endType"
                type="radio"
                value="after_count"
                class="border-gray-300 text-blue-600 focus:ring-blue-500"
              >
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">After</span>
              <input
                v-model.number="occurrenceCount"
                type="number"
                min="1"
                class="ml-2 w-16 px-2 py-1 border border-gray-300 rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
              <span class="ml-1 text-sm text-gray-700 dark:text-gray-300">occurrences</span>
            </label>
            <label class="flex items-center">
              <input
                v-model="endType"
                type="radio"
                value="on_date"
                class="border-gray-300 text-blue-600 focus:ring-blue-500"
              >
              <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">On</span>
              <input
                v-model="endDate"
                type="date"
                class="ml-2 px-2 py-1 border border-gray-300 rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
            </label>
          </div>
        </div>

        <!-- Preview -->
        <div v-if="recurrenceDescription" class="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            <strong>Preview:</strong> {{ recurrenceDescription }}
          </p>
          <div v-if="previewDates.length > 0" class="mt-2">
            <p class="text-xs text-gray-500 dark:text-gray-500 mb-1">
              Next occurrences:
            </p>
            <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li v-for="(date, index) in previewDates.slice(0, 5)" :key="index">
                {{ formatDate(date) }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Error Display -->
        <div v-if="validationError && !validationError.isValid" class="p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
          <ul class="text-sm text-red-600 dark:text-red-400 space-y-1">
            <li v-for="(error, index) in validationError.errors" :key="index">
              • {{ error }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTaskRecurrence } from '@/composables/useTaskRecurrence'
import { RecurrencePattern, EndCondition  } from '@/types/recurrence'
import { formatDateKey, parseDateKey } from '@/stores/tasks'

interface Props {
  taskId: string
  dueDate?: string
  dueTime?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  recurrenceChanged: [recurrence: any]
}>()

// Use the recurrence composable
const {
  recurrence,
  setRecurrencePattern,
  setWeeklyDays,
  setMonthlyDay,
  setEndCondition,
  toggleRecurrence,
  getPreview,
  getRecurrenceDescription,
  validationError
} = useTaskRecurrence(props.taskId)

// Local state
const isEnabled = ref(false)
const selectedPattern = ref<RecurrencePattern>(RecurrencePattern.NONE)
const interval = ref(1)
const selectedWeekdays = ref<number[]>([])
const dayOfMonth = ref(new Date().getDate())
const selectedMonth = ref(new Date().getMonth() + 1)
const endType = ref<EndCondition>(EndCondition.NEVER)
const occurrenceCount = ref(10)
const endDate = ref('')

// Constants
const weekDays = [
  { label: 'S', value: 0 },
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'T', value: 4 },
  { label: 'F', value: 5 },
  { label: 'S', value: 6 }
]

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Computed
const intervalUnit = computed(() => {
  switch (selectedPattern.value) {
    case RecurrencePattern.DAILY: return interval.value === 1 ? 'day' : 'days'
    case RecurrencePattern.WEEKLY: return interval.value === 1 ? 'week' : 'weeks'
    case RecurrencePattern.MONTHLY: return interval.value === 1 ? 'month' : 'months'
    case RecurrencePattern.YEARLY: return interval.value === 1 ? 'year' : 'years'
    default: return ''
  }
})

const recurrenceDescription = computed(() => {
  return getRecurrenceDescription.value
})

const previewDates = computed(() => {
  if (!props.dueDate || selectedPattern.value === RecurrencePattern.NONE) {
    return []
  }

  const startDate = parseDateKey(props.dueDate) || new Date()
  return getPreview(startDate, 10)
})

// Methods
const handleToggle = () => {
  toggleRecurrence(isEnabled.value)
  emitRecurrenceChange()
}

const handlePatternChange = () => {
  setRecurrencePattern(selectedPattern.value, interval.value)

  // Set default values for pattern-specific options
  if (selectedPattern.value === RecurrencePattern.WEEKLY && selectedWeekdays.value.length === 0) {
    // Default to current day of week
    const today = new Date().getDay()
    selectedWeekdays.value = [today]
    setWeeklyDays(selectedWeekdays.value)
  } else if (selectedPattern.value === RecurrencePattern.MONTHLY) {
    setMonthlyDay(dayOfMonth.value)
  }

  emitRecurrenceChange()
}

const getDaySuffix = (day: number): string => {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

const getDaysInSelectedMonth = (): number => {
  const year = new Date().getFullYear()
  return new Date(year, selectedMonth.value, 0).getDate()
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

const emitRecurrenceChange = () => {
  emit('recurrenceChanged', recurrence.value)
}

// Watchers
watch([interval, selectedWeekdays, dayOfMonth, selectedMonth, endType, occurrenceCount, endDate], () => {
  if (!isEnabled.value || selectedPattern.value === RecurrencePattern.NONE) return

  // Update recurrence rule
  switch (selectedPattern.value) {
    case RecurrencePattern.DAILY:
      setRecurrencePattern(selectedPattern.value, interval.value)
      break
    case RecurrencePattern.WEEKLY:
      setRecurrencePattern(selectedPattern.value, interval.value)
      setWeeklyDays(selectedWeekdays.value)
      break
    case RecurrencePattern.MONTHLY:
      setRecurrencePattern(selectedPattern.value, interval.value)
      setMonthlyDay(dayOfMonth.value)
      break
    case RecurrencePattern.YEARLY:
      // Update yearly rule with month and day
      break
  }

  // Update end condition
  if (endType.value === 'after_count') {
    setEndCondition(endType.value, occurrenceCount.value)
  } else if (endType.value === 'on_date') {
    setEndCondition(endType.value, endDate.value)
  } else {
    setEndCondition(endType.value)
  }

  emitRecurrenceChange()
}, { deep: true })
</script>

<style scoped>
.recurrence-pattern-selector {
  @apply space-y-4;
}
</style>