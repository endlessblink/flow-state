import { computed, ref } from 'vue'
import { usePersistentRef } from '@/composables/usePersistentRef'
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
    // TASK-1215: Upgraded to Tauri-aware persistence
    const viewMode = usePersistentRef<'day' | 'week' | 'month'>('flowstate:calendar-view-mode', 'day', 'calendar-view-mode')

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
     * Navigate to previous period (view-mode-aware)
     * Day: -1 day, Week: -7 days, Month: -1 month
     */
    const previousDay = () => {
        const date = new Date(currentDate.value)
        if (viewMode.value === 'month') {
            date.setMonth(date.getMonth() - 1)
        } else if (viewMode.value === 'week') {
            date.setDate(date.getDate() - 7)
        } else {
            date.setDate(date.getDate() - 1)
        }
        currentDate.value = date
    }

    /**
     * Navigate to next period (view-mode-aware)
     * Day: +1 day, Week: +7 days, Month: +1 month
     */
    const nextDay = () => {
        const date = new Date(currentDate.value)
        if (viewMode.value === 'month') {
            date.setMonth(date.getMonth() + 1)
        } else if (viewMode.value === 'week') {
            date.setDate(date.getDate() + 7)
        } else {
            date.setDate(date.getDate() + 1)
        }
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
