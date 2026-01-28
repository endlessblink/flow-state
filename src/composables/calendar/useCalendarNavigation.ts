import { computed, ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { useCalendarCore } from '@/composables/useCalendarCore'

/**
 * Calendar navigation composable
 * Manages currentDate, viewMode, and navigation actions
 *
 * TASK-1102: Calendar always starts on current day when entering the view.
 * Date is NOT persisted - each time user enters calendar view, it shows today.
 * View mode (day/week/month) IS persisted as a user preference.
 */
export function useCalendarNavigation() {
    const { getWeekStart } = useCalendarCore()

    // TASK-1102: Date is NOT persisted - always start on today when entering calendar view
    // This is a regular ref, so each CalendarView mount starts fresh at today
    const currentDate = ref<Date>(new Date())

    // View mode IS persisted as a user preference (day/week/month)
    const viewMode = useStorage<'day' | 'week' | 'month'>('calendar-view-mode', 'day')

    /**
     * Check if current date is today
     */
    const isViewingToday = computed(() => {
        const today = new Date()
        return currentDate.value.toDateString() === today.toDateString()
    })

    /**
     * Formatted current date for header display
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
     * Navigate to previous day
     */
    const previousDay = () => {
        const date = new Date(currentDate.value)
        date.setDate(date.getDate() - 1)
        currentDate.value = date
    }

    /**
     * Navigate to next day
     */
    const nextDay = () => {
        const date = new Date(currentDate.value)
        date.setDate(date.getDate() + 1)
        currentDate.value = date
    }

    /**
     * Reset navigation to today
     */
    const goToToday = () => {
        currentDate.value = new Date()
    }

    return {
        currentDate,
        viewMode,
        isViewingToday,
        formatCurrentDate,
        previousDay,
        nextDay,
        goToToday
    }
}
