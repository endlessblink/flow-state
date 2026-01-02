import { ref, computed } from 'vue'
import { useCalendarCore } from '@/composables/useCalendarCore'

/**
 * Calendar navigation composable
 * Manages currentDate, viewMode, and navigation actions
 */
export function useCalendarNavigation() {
    const { getWeekStart } = useCalendarCore()

    // State
    const currentDate = ref(new Date())
    const viewMode = ref<'day' | 'week' | 'month'>('day')

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
