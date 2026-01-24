import { computed } from 'vue'
import { useStorage } from '@vueuse/core'
import { useCalendarCore } from '@/composables/useCalendarCore'

/**
 * Calendar navigation composable
 * Manages currentDate, viewMode, and navigation actions
 */
export function useCalendarNavigation() {
    const { getWeekStart } = useCalendarCore()

    // BUG-1051: Persist UI state across refreshes
    // Store date as ISO string in localStorage
    const storedDate = useStorage<string>('calendar-current-date', new Date().toISOString())
    const viewMode = useStorage<'day' | 'week' | 'month'>('calendar-view-mode', 'day')

    // Computed ref that converts between Date and string for persistence
    const currentDate = computed<Date>({
        get: () => new Date(storedDate.value),
        set: (value: Date) => {
            storedDate.value = value.toISOString()
        }
    })

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
