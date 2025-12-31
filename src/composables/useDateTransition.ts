/**
 * TASK-082: Date Transition Composable
 *
 * Watches for midnight (00:00) transitions and emits events when the day changes.
 * Used by canvas to auto-move tasks from "Today" to "Overdue" groups.
 *
 * Features:
 * - Calculates time until next midnight and sets precise timeout
 * - Continuous monitoring after each midnight
 * - Cleanup on component unmount
 * - Manual trigger for testing
 */

import { ref, onMounted, onUnmounted, watch } from 'vue'

export interface DateTransitionOptions {
  /** Callback when day changes */
  onDayChange?: (previousDate: Date, newDate: Date) => void
  /** Whether to start watching immediately (default: true) */
  autoStart?: boolean
  /** Enable debug logging (default: false) */
  debug?: boolean
}

export function useDateTransition(options: DateTransitionOptions = {}) {
  const { onDayChange, autoStart = true, debug = false } = options

  // Current tracked date (just the day, month, year)
  const currentDate = ref<Date>(new Date())
  const isWatching = ref(false)

  // Track the timeout/interval ID for cleanup
  let midnightTimeoutId: ReturnType<typeof setTimeout> | null = null

  const log = (...args: unknown[]) => {
    if (debug) {
      console.log('[useDateTransition]', ...args)
    }
  }

  /**
   * Get milliseconds until next midnight
   */
  const getMsUntilMidnight = (): number => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    return tomorrow.getTime() - now.getTime()
  }

  /**
   * Check if the date has changed since last check
   */
  const hasDateChanged = (): boolean => {
    const now = new Date()
    const lastDate = currentDate.value

    return (
      now.getDate() !== lastDate.getDate() ||
      now.getMonth() !== lastDate.getMonth() ||
      now.getFullYear() !== lastDate.getFullYear()
    )
  }

  /**
   * Handle the date transition
   */
  const handleDateTransition = () => {
    const previousDate = new Date(currentDate.value)
    const newDate = new Date()

    log('Date transition detected!', {
      from: previousDate.toDateString(),
      to: newDate.toDateString()
    })

    // Update tracked date
    currentDate.value = newDate

    // Call the callback if provided
    if (onDayChange) {
      try {
        onDayChange(previousDate, newDate)
      } catch (error) {
        console.error('[useDateTransition] Error in onDayChange callback:', error)
      }
    }

    // Schedule next midnight check
    scheduleMidnightCheck()
  }

  /**
   * Schedule a check for the next midnight
   */
  const scheduleMidnightCheck = () => {
    // Clear any existing timeout
    if (midnightTimeoutId) {
      clearTimeout(midnightTimeoutId)
      midnightTimeoutId = null
    }

    if (!isWatching.value) {
      return
    }

    const msUntilMidnight = getMsUntilMidnight()

    // Add a small buffer (100ms) to ensure we're past midnight
    const timeoutMs = msUntilMidnight + 100

    log(`Scheduling midnight check in ${Math.round(timeoutMs / 1000 / 60)} minutes`)

    midnightTimeoutId = setTimeout(() => {
      if (hasDateChanged()) {
        handleDateTransition()
      } else {
        // In case of timing edge cases, check again in 1 minute
        log('Date has not changed yet, rechecking in 1 minute')
        midnightTimeoutId = setTimeout(() => {
          if (hasDateChanged()) {
            handleDateTransition()
          } else {
            // Reschedule for next midnight
            scheduleMidnightCheck()
          }
        }, 60000) // 1 minute
      }
    }, timeoutMs)
  }

  /**
   * Start watching for date transitions
   */
  const startWatching = () => {
    if (isWatching.value) {
      log('Already watching')
      return
    }

    log('Starting date transition watcher')
    isWatching.value = true
    currentDate.value = new Date()
    scheduleMidnightCheck()
  }

  /**
   * Stop watching for date transitions
   */
  const stopWatching = () => {
    log('Stopping date transition watcher')
    isWatching.value = false

    if (midnightTimeoutId) {
      clearTimeout(midnightTimeoutId)
      midnightTimeoutId = null
    }
  }

  /**
   * Manually trigger a date transition check (useful for testing)
   */
  const triggerCheck = () => {
    log('Manual trigger check')
    if (hasDateChanged()) {
      handleDateTransition()
    } else {
      log('No date change detected')
    }
  }

  /**
   * Manually trigger a transition (for testing purposes)
   * This simulates the day changing without waiting for midnight
   */
  const simulateTransition = () => {
    log('Simulating date transition')
    handleDateTransition()
  }

  // Auto-start if enabled
  onMounted(() => {
    if (autoStart) {
      startWatching()
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    stopWatching()
  })

  // Also watch for page visibility changes - recheck when page becomes visible
  if (typeof document !== 'undefined') {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isWatching.value) {
        log('Page became visible, checking for date change')
        if (hasDateChanged()) {
          handleDateTransition()
        } else {
          // Reschedule in case timeout was imprecise while tab was hidden
          scheduleMidnightCheck()
        }
      }
    }

    onMounted(() => {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    })

    onUnmounted(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
  }

  return {
    /** Current tracked date */
    currentDate,
    /** Whether the watcher is active */
    isWatching,
    /** Start watching for date transitions */
    startWatching,
    /** Stop watching for date transitions */
    stopWatching,
    /** Manually trigger a check */
    triggerCheck,
    /** Simulate a date transition (for testing) */
    simulateTransition,
    /** Get milliseconds until next midnight */
    getMsUntilMidnight
  }
}
