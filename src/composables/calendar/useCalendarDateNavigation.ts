import { ref, computed, type Ref, type ComputedRef } from 'vue'

type ViewMode = 'day' | 'week' | 'month'

/**
 * Calendar date navigation composable
 * Handles date state, navigation, and formatted display
 * Extracted from CalendarView.vue for better maintainability
 */
export function useCalendarDateNavigation() {
  // Current date state
  const currentDate = ref(new Date())

  // View mode state
  const viewMode = ref<ViewMode>('day')

  /**
   * Get the start of the week (Monday) for a given date
   */
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  /**
   * Formatted current date for header display
   * Adapts format based on current view mode
   */
  const formatCurrentDate = computed(() => {
    if (viewMode.value === 'week') {
      const weekStart = getWeekStart(currentDate.value)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' })
      const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' })
      const year = weekStart.getFullYear()

      if (startMonth === endMonth) {
        return `${startMonth} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${year}`
      } else {
        return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${weekEnd.getDate()}, ${year}`
      }
    }

    if (viewMode.value === 'month') {
      return currentDate.value.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
      })
    }

    return currentDate.value.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  })

  /**
   * Navigate to the previous day/week/month
   */
  const previousPeriod = () => {
    const date = new Date(currentDate.value)

    switch (viewMode.value) {
      case 'week':
        date.setDate(date.getDate() - 7)
        break
      case 'month':
        date.setMonth(date.getMonth() - 1)
        break
      default: // day
        date.setDate(date.getDate() - 1)
    }

    currentDate.value = date
  }

  /**
   * Navigate to the next day/week/month
   */
  const nextPeriod = () => {
    const date = new Date(currentDate.value)

    switch (viewMode.value) {
      case 'week':
        date.setDate(date.getDate() + 7)
        break
      case 'month':
        date.setMonth(date.getMonth() + 1)
        break
      default: // day
        date.setDate(date.getDate() + 1)
    }

    currentDate.value = date
  }

  /**
   * Navigate to today's date
   */
  const goToToday = () => {
    currentDate.value = new Date()
  }

  /**
   * Check if the currently displayed date is today
   */
  const isToday = computed(() => {
    const today = new Date()
    return currentDate.value.toDateString() === today.toDateString()
  })

  return {
    currentDate,
    viewMode,
    formatCurrentDate,
    getWeekStart,
    previousPeriod,
    nextPeriod,
    goToToday,
    isToday
  }
}
