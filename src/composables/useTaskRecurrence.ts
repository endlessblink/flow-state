/**
 * Task Recurrence Composable
 * Provides reactive management of recurring tasks with Vue 3 Composition API
 */

import { ref, computed, watch as _watch } from 'vue'
import type {
  RecurrenceRule as _RecurrenceRule,
  RecurrenceEndCondition as _RecurrenceEndCondition,
  RecurrenceException,
  TaskRecurrence,
  RecurringTaskInstance as _RecurringTaskInstance,
  RecurrenceValidationResult,
  NotificationPreferences as _NotificationPreferences,
  WeeklyRecurrenceRule,
  MonthlyRecurrenceRule,
  DailyRecurrenceRule,
  YearlyRecurrenceRule
} from '@/types/recurrence'
import { RecurrencePattern, EndCondition } from '@/types/recurrence'
import {
  generateRecurringInstances,
  validateRecurrenceRule,
  updateRecurringInstances as _updateRecurringInstances,
  generateRecurrencePreview
} from '@/utils/recurrenceUtils'
import { formatDateKey, parseDateKey } from '@/stores/tasks'

export function useTaskRecurrence(taskId: string) {
  // Reactive state
  const recurrence = ref<TaskRecurrence | null>(null)
  const isGenerating = ref(false)
  const lastError = ref<string | null>(null)
  const validationError = ref<RecurrenceValidationResult | null>(null)

  // Computed properties
  const isEnabled = computed(() => recurrence.value?.isEnabled ?? false)
  const hasGeneratedInstances = computed(() =>
    (recurrence.value?.generatedInstances?.length || 0) > 0
  )
  const nextInstance = computed(() => {
    if (!recurrence.value?.generatedInstances?.length) return null
    const today = formatDateKey(new Date())
    const futureInstances = recurrence.value.generatedInstances
      .filter(instance => instance.scheduledDate >= today)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    return futureInstances[0] || null
  })

  const upcomingInstances = computed(() => {
    if (!recurrence.value?.generatedInstances.length) return []
    const today = formatDateKey(new Date())
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const futureDate = formatDateKey(thirtyDaysFromNow)

    return recurrence.value.generatedInstances
      .filter(instance =>
        instance.scheduledDate >= today &&
        instance.scheduledDate <= futureDate &&
        !instance.isSkipped
      )
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
  })

  /**
   * Initialize recurrence with default values
   */
  const initializeRecurrence = (_dueDate?: string, _dueTime?: string): TaskRecurrence => {
    return {
      isEnabled: false,
      rule: {
        pattern: RecurrencePattern.NONE
      },
      endCondition: {
        type: EndCondition.NEVER
      },
      exceptions: [],
      generatedInstances: []
    }
  }

  /**
   * Set recurrence pattern
   */
  const setRecurrencePattern = (pattern: RecurrencePattern, interval: number = 1) => {
    if (!recurrence.value) {
      recurrence.value = initializeRecurrence()
    }

    // Update rule based on pattern
    switch (pattern) {
      case RecurrencePattern.DAILY:
        recurrence.value.rule = {
          pattern,
          interval
        }
        break

      case RecurrencePattern.WEEKLY:
        recurrence.value.rule = {
          pattern,
          interval,
          weekdays: [] // Will be set separately
        }
        break

      case RecurrencePattern.MONTHLY: {
        const today = new Date()
        recurrence.value.rule = {
          pattern,
          interval,
          dayOfMonth: today.getDate()
        }
        break
      }

      case RecurrencePattern.YEARLY: {
        const todayYear = new Date()
        recurrence.value.rule = {
          pattern,
          interval,
          month: todayYear.getMonth() + 1,
          dayOfMonth: todayYear.getDate()
        }
        break
      }

      case RecurrencePattern.NONE:
        recurrence.value.rule = { pattern }
        recurrence.value.isEnabled = false
        break

      default:
        recurrence.value.rule = { pattern, customRule: '' }
    }

    // Clear validation error
    validationError.value = null
  }

  /**
   * Set weekly recurrence days
   */
  const setWeeklyDays = (weekdays: number[]) => {
    if (!recurrence.value || recurrence.value.rule.pattern !== RecurrencePattern.WEEKLY) {
      return
    }

    (recurrence.value.rule as WeeklyRecurrenceRule).weekdays = weekdays
  }

  /**
   * Set monthly recurrence day
   */
  const setMonthlyDay = (dayOfMonth: number) => {
    if (!recurrence.value || recurrence.value.rule.pattern !== RecurrencePattern.MONTHLY) {
      return
    }

    (recurrence.value.rule as MonthlyRecurrenceRule).dayOfMonth = dayOfMonth
  }

  /**
   * Set end condition
   */
  const setEndCondition = (type: EndCondition, value?: string | number) => {
    if (!recurrence.value) {
      recurrence.value = initializeRecurrence()
    }

    recurrence.value.endCondition = {
      type,
      ...(type === 'on_date' && { date: value as string }),
      ...(type === 'after_count' && { count: value as number })
    }
  }

  /**
   * Enable/disable recurrence
   */
  const toggleRecurrence = (enabled: boolean) => {
    if (!recurrence.value) {
      recurrence.value = initializeRecurrence()
    }

    recurrence.value.isEnabled = enabled

    if (enabled) {
      generateInstances()
    } else {
      // Clear generated instances when disabled
      recurrence.value.generatedInstances = []
    }
  }

  /**
   * Generate recurring instances
   */
  const generateInstances = async (dueDate?: string, dueTime?: string, duration?: number) => {
    if (!recurrence.value?.isEnabled || recurrence.value.rule.pattern === RecurrencePattern.NONE) {
      return
    }

    isGenerating.value = true
    lastError.value = null

    try {
      // Validate rule first
      validationError.value = validateRecurrenceRule(recurrence.value.rule)
      if (!validationError.value.isValid) {
        throw new Error('Invalid recurrence rule: ' + validationError.value.errors.join(', '))
      }

      const startDate = dueDate ? parseDateKey(dueDate) || new Date() : new Date()

      const instances = generateRecurringInstances(
        taskId,
        recurrence.value.rule,
        recurrence.value.endCondition,
        recurrence.value.exceptions,
        startDate,
        dueTime,
        duration
      )

      recurrence.value.generatedInstances = instances
      recurrence.value.lastGenerated = formatDateKey(new Date())

    } catch (error) {
      console.error('Error generating recurring instances:', error)
      lastError.value = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      isGenerating.value = false
    }
  }

  /**
   * Add exception
   */
  const addException = (date: string, action: 'skip' | 'modify' | 'delete', modifications?: unknown) => {
    if (!recurrence.value) {
      recurrence.value = initializeRecurrence()
    }

    const exception: RecurrenceException = {
      id: `exception-${Date.now()}`,
      date,
      action,
      ...(action === 'modify' && modifications ? { modifiedInstance: modifications as Record<string, unknown> } : {})
    }

    recurrence.value.exceptions.push(exception)

    // Regenerate instances if recurrence is enabled
    if (recurrence.value.isEnabled) {
      generateInstances()
    }
  }

  /**
   * Remove exception
   */
  const removeException = (exceptionId: string) => {
    if (!recurrence.value) return

    recurrence.value.exceptions = recurrence.value.exceptions.filter(
      ex => ex.id !== exceptionId
    )

    // Regenerate instances if recurrence is enabled
    if (recurrence.value.isEnabled) {
      generateInstances()
    }
  }

  /**
   * Skip a specific instance
   */
  const skipInstance = (instanceId: string) => {
    if (!recurrence.value) return

    const instance = recurrence.value.generatedInstances.find(inst => inst.id === instanceId)
    if (!instance) return

    // Create exception for this instance
    addException(instance.scheduledDate, 'skip')
  }

  /**
   * Get preview of recurrence
   */
  const getPreview = (startDate: Date, maxInstances: number = 10) => {
    if (!recurrence.value) return []

    return generateRecurrencePreview(
      recurrence.value.rule,
      recurrence.value.endCondition,
      { startDate, maxInstances }
    )
  }

  /**
   * Reset recurrence to defaults
   */
  const resetRecurrence = () => {
    recurrence.value = initializeRecurrence()
    validationError.value = null
    lastError.value = null
  }

  /**
   * Get human readable description of recurrence
   */
  const getRecurrenceDescription = computed(() => {
    if (!recurrence.value?.isEnabled || recurrence.value.rule.pattern === RecurrencePattern.NONE) {
      return 'No recurrence'
    }

    const { rule, endCondition } = recurrence.value
    let description = ''

    switch (rule.pattern) {
      case RecurrencePattern.DAILY: {
        const dailyInterval = (rule as DailyRecurrenceRule).interval
        description = dailyInterval === 1 ? 'Daily' : `Every ${dailyInterval} days`
        break
      }

      case RecurrencePattern.WEEKLY: {
        const weeklyInterval = (rule as WeeklyRecurrenceRule).interval
        const weekdays = (rule as WeeklyRecurrenceRule).weekdays
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const dayList = weekdays.map((d: number) => dayNames[d]).join(', ')
        description = weeklyInterval === 1
          ? `Weekly on ${dayList}`
          : `Every ${weeklyInterval} weeks on ${dayList}`
        break
      }

      case RecurrencePattern.MONTHLY: {
        const monthlyInterval = (rule as MonthlyRecurrenceRule).interval
        const dayOfMonth = (rule as MonthlyRecurrenceRule).dayOfMonth
        const suffix = getDaySuffix(dayOfMonth)
        description = monthlyInterval === 1
          ? `Monthly on the ${dayOfMonth}${suffix}`
          : `Every ${monthlyInterval} months on the ${dayOfMonth}${suffix}`
        break
      }

      case RecurrencePattern.YEARLY: {
        const yearlyInterval = (rule as YearlyRecurrenceRule).interval
        const month = (rule as YearlyRecurrenceRule).month
        const yearDay = (rule as YearlyRecurrenceRule).dayOfMonth
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        description = yearlyInterval === 1
          ? `Yearly on ${monthNames[month - 1]} ${yearDay}`
          : `Every ${yearlyInterval} years on ${monthNames[month - 1]} ${yearDay}`
        break
      }

      default:
        description = 'Custom recurrence'
    }

    // Add end condition
    if (endCondition.type === 'after_count') {
      description += ` (${endCondition.count} times)`
    } else if (endCondition.type === 'on_date') {
      description += ` (until ${endCondition.date})`
    }

    return description
  })

  // Helper function to get day suffix
  const getDaySuffix = (day: number): string => {
    if (day >= 11 && day <= 13) return 'th'
    switch (day % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  }

  return {
    // State
    recurrence,
    isGenerating,
    lastError,
    validationError,

    // Computed
    isEnabled,
    hasGeneratedInstances,
    nextInstance,
    upcomingInstances,
    getRecurrenceDescription,

    // Methods
    initializeRecurrence,
    setRecurrencePattern,
    setWeeklyDays,
    setMonthlyDay,
    setEndCondition,
    toggleRecurrence,
    generateInstances,
    addException,
    removeException,
    skipInstance,
    getPreview,
    resetRecurrence
  }
}