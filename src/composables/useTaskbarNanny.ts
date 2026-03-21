import { ref, watch, onUnmounted, computed } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { deliverNotification } from '@/utils/notificationDelivery'

export interface TaskbarNannyOptions {
  thresholdMinutes?: number
  enabled?: boolean
}

export function useTaskbarNanny(options: TaskbarNannyOptions = {}) {
  // Allow E2E test override via window property
  const testOverride = typeof window !== 'undefined'
    ? (window as Record<string, unknown>).__NANNY_THRESHOLD_MINUTES as number | undefined
    : undefined
  const {
    thresholdMinutes = testOverride ?? 0.17, // ~10s for testing, revert to 5 for production
    enabled = true,
  } = options

  const thresholdMs = thresholdMinutes * 60 * 1000

  const timerStore = useTimerStore()

  // --- Reactive state ---
  const unchosenElapsedMs = ref(0)
  const unchosenMinutes = ref(0)
  const snoozeUntil = ref(0)
  const stoppedToday = ref(false)
  const stoppedDayOfYear = ref(-1)

  // --- Computed ---
  const isSnoozed = computed(() => Date.now() < snoozeUntil.value)

  // --- Methods ---
  function resetNanny() {
    unchosenElapsedMs.value = 0
    unchosenMinutes.value = 0
  }

  function snooze(minutes: number) {
    snoozeUntil.value = Date.now() + minutes * 60 * 1000
    resetNanny()
    console.log(`🧹 [NANNY] Snoozed for ${minutes} minutes`)
  }

  function stopToday() {
    const now = new Date()
    stoppedToday.value = true
    stoppedDayOfYear.value = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
    resetNanny()
    console.log('🧹 [NANNY] Stopped for today')
  }

  function shouldAccumulateTime(): boolean {
    if (!enabled) return false
    // Stopped for the day
    if (stoppedToday.value) {
      const now = new Date()
      const currentDay = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
      if (currentDay !== stoppedDayOfYear.value) {
        stoppedToday.value = false
        stoppedDayOfYear.value = -1
      } else {
        return false
      }
    }
    // Currently snoozed
    if (isSnoozed.value) return false
    // Timer is running — user is working
    if (timerStore.isTimerActive) return false
    return true
  }

  function triggerReminder() {
    const mins = unchosenMinutes.value
    console.log(`🧹 [NANNY] 🔔 Sending system notification — ${mins} min idle`)

    deliverNotification({
      title: '🍅 Time to pick a task!',
      body: mins > 0
        ? `${mins}+ min without a focused session — pick a task to stay on track.`
        : 'No active Pomodoro session — pick a task to stay on track.',
      tag: 'nanny-reminder',
    })

    // After firing, reset and wait for the threshold again
    resetNanny()
  }

  // --- Tick ---
  console.log(`🧹 [NANNY] Initialized — threshold: ${thresholdMinutes}min, enabled: ${enabled}, isTimerActive: ${timerStore.isTimerActive}`)

  const tickInterval = setInterval(() => {
    if (!enabled) return

    const canAccumulate = shouldAccumulateTime()

    // Log every 5s for debugging
    if (unchosenElapsedMs.value % 5000 === 0 && unchosenElapsedMs.value > 0) {
      console.log(`🧹 [NANNY] tick — elapsed: ${unchosenElapsedMs.value / 1000}s / ${thresholdMs / 1000}s, canAccumulate: ${canAccumulate}`)
    }

    if (canAccumulate) {
      unchosenElapsedMs.value += 1000
      unchosenMinutes.value = Math.floor(unchosenElapsedMs.value / 60000)
    } else {
      if (unchosenElapsedMs.value > 0 && !isSnoozed.value && !stoppedToday.value) {
        console.log('🧹 [NANNY] Reset — timer started')
        resetNanny()
      }
      return
    }

    if (unchosenElapsedMs.value >= thresholdMs) {
      triggerReminder()
    }
  }, 1000)

  // Reset when timer starts
  watch(
    () => timerStore.isTimerActive,
    (active) => {
      if (active) {
        resetNanny()
      }
    }
  )

  onUnmounted(() => {
    clearInterval(tickInterval)
  })

  return {
    unchosenMinutes,
    isSnoozed,
    stoppedToday,
    snooze,
    stopToday,
    resetNanny,
  }
}
