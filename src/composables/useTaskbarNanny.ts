import { ref, watch, onUnmounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useToast } from './useToast'

export interface TaskbarNannyOptions {
  thresholdMinutes?: number
  cooldownMinutes?: number
  enabled?: boolean
}

// These task IDs are not real tasks — they are generic/break sessions
const NON_TASK_IDS = new Set(['general', 'break', null, undefined])

function isRealTaskId(taskId: string | null | undefined): boolean {
  return taskId != null && !NON_TASK_IDS.has(taskId)
}

export function useTaskbarNanny(options: TaskbarNannyOptions = {}) {
  // Allow E2E test override via window property
  const testOverride = typeof window !== 'undefined'
    ? (window as Record<string, unknown>).__NANNY_THRESHOLD_MINUTES as number | undefined
    : undefined
  const {
    thresholdMinutes = testOverride ?? 5,
    cooldownMinutes = 15,
    enabled = true,
  } = options

  const thresholdMs = thresholdMinutes * 60 * 1000
  const cooldownMs = cooldownMinutes * 60 * 1000

  const timerStore = useTimerStore()
  const { showToast } = useToast()

  // How many milliseconds the user has been actively working without a real task
  const unchosenElapsedMs = ref(0)
  // Expose elapsed time as whole minutes for consumers
  const unchosenMinutes = ref(0)

  let lastNannyToast = 0
  let tickInterval: ReturnType<typeof setInterval> | null = null
  function shouldAccumulateTime(): boolean {
    if (!enabled) return false
    // There must be no real task chosen
    const taskId = timerStore.currentTaskId
    if (isRealTaskId(taskId)) return false
    return true
  }

  function isCooldownPassed(): boolean {
    return Date.now() - lastNannyToast >= cooldownMs
  }

  function resetNanny() {
    unchosenElapsedMs.value = 0
    unchosenMinutes.value = 0
  }

  function triggerToast() {
    const mins = Math.round(unchosenElapsedMs.value / 60000)
    showToast(
      `${mins}+ min without a task — pick one to stay on track!`,
      'warning',
      { duration: 8000 }
    )
    lastNannyToast = Date.now()
    resetNanny()
  }

  // Tick every second — accumulate time without a real task, show toast at threshold
  tickInterval = setInterval(() => {
    if (!enabled) return

    if (shouldAccumulateTime()) {
      unchosenElapsedMs.value += 1000
      unchosenMinutes.value = Math.floor(unchosenElapsedMs.value / 60000)
    } else {
      // User picked a real task — reset automatically
      if (unchosenElapsedMs.value > 0) resetNanny()
      return
    }

    // Threshold crossed and cooldown passed — show the reminder immediately
    if (unchosenElapsedMs.value >= thresholdMs && isCooldownPassed()) {
      triggerToast()
    }
  }, 1000)

  // Reset when the user picks a real task
  watch(
    () => timerStore.currentTaskId,
    (taskId) => {
      if (isRealTaskId(taskId)) {
        resetNanny()
      }
    }
  )

  onUnmounted(() => {
    if (tickInterval !== null) {
      clearInterval(tickInterval)
      tickInterval = null
    }
  })

  return {
    unchosenMinutes,
    resetNanny,
  }
}
