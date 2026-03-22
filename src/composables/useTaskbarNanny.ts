import { ref, computed, watch, onUnmounted } from 'vue'
import { useTimerStore } from '@/stores/timer'

export interface TaskbarNannyOptions {
  thresholdMinutes?: number
  enabled?: boolean
}

/**
 * Web app nanny — tracks idle time without a Pomodoro session.
 * The actual nudge notifications are handled by the KDE widget (system-level).
 * This composable only exposes reactive state for in-app use if needed.
 */
export function useTaskbarNanny(options: TaskbarNannyOptions = {}) {
  const testOverride = typeof window !== 'undefined'
    ? (window as Record<string, unknown>).__NANNY_THRESHOLD_MINUTES as number | undefined
    : undefined
  const {
    thresholdMinutes = testOverride ?? 5,
    enabled = true,
  } = options

  const timerStore = useTimerStore()

  const unchosenElapsedMs = ref(0)
  const unchosenMinutes = ref(0)
  const shouldNudge = computed(() => unchosenMinutes.value >= thresholdMinutes)

  function resetNanny() {
    unchosenElapsedMs.value = 0
    unchosenMinutes.value = 0
  }

  // DEBUG: immediate log to confirm composable is running
  console.log('🔔 [NANNY] composable initialized, enabled=', enabled, 'threshold=', thresholdMinutes, 'timerActive=', timerStore.isTimerActive)

  const tickInterval = setInterval(() => {
    if (!enabled) return

    // DEBUG: log every 10s regardless of state
    if (unchosenElapsedMs.value % 10000 === 0) {
      console.log(`🔔 [NANNY] tick: elapsed=${unchosenElapsedMs.value / 1000}s, min=${unchosenMinutes.value}, timerActive=${timerStore.isTimerActive}, shouldNudge=${unchosenMinutes.value >= thresholdMinutes}`)
    }

    if (!timerStore.isTimerActive) {
      unchosenElapsedMs.value += 1000
      unchosenMinutes.value = Math.floor(unchosenElapsedMs.value / 60000)
    } else if (unchosenElapsedMs.value > 0) {
      resetNanny()
    }
  }, 1000)

  watch(
    () => timerStore.isTimerActive,
    (active) => {
      if (active) resetNanny()
    }
  )

  onUnmounted(() => {
    clearInterval(tickInterval)
  })

  return {
    unchosenMinutes,
    shouldNudge,
    thresholdMinutes,
    resetNanny,
  }
}
