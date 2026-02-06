import { ref } from 'vue'
import { formatDateKey } from '@/utils/dateUtils'

// Module-level reactive date string (YYYY-MM-DD format)
// All overdue computations depend on this to re-evaluate at midnight
export const reactiveToday = ref(formatDateKey(new Date()))

let timerStarted = false

/**
 * BUG-1191: Start a timer that checks every 60 seconds if the date changed.
 * When the date changes (midnight), all computed properties depending on
 * reactiveToday will re-evaluate, making overdue badges appear/disappear correctly.
 */
export function ensureDateTimer() {
    if (timerStarted) return
    timerStarted = true
    setInterval(() => {
        const newDate = formatDateKey(new Date())
        if (reactiveToday.value !== newDate) {
            reactiveToday.value = newDate
        }
    }, 60_000) // Check every minute
}
