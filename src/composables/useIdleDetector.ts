import { ref, onMounted, onUnmounted } from 'vue'

export interface IdleDetectorOptions {
  idleThreshold?: number
}

export function useIdleDetector(options: IdleDetectorOptions = {}) {
  const { idleThreshold = 3000 } = options

  const isIdle = ref(false)
  const lastActivityTime = ref(Date.now())

  // Throttle helper — returns a function that calls fn at most once per `wait` ms
  function throttle<T extends (...args: unknown[]) => void>(fn: T, wait: number): T {
    let lastCall = 0
    return ((...args: unknown[]) => {
      const now = Date.now()
      if (now - lastCall >= wait) {
        lastCall = now
        fn(...args)
      }
    }) as T
  }

  const recordActivity = throttle(() => {
    lastActivityTime.value = Date.now()
    isIdle.value = false
  }, 500)

  let checkInterval: ReturnType<typeof setInterval> | null = null

  const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const

  onMounted(() => {
    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, recordActivity, { passive: true })
    })

    checkInterval = setInterval(() => {
      const now = Date.now()
      if (now - lastActivityTime.value > idleThreshold) {
        isIdle.value = true
      }
    }, 1000)
  })

  onUnmounted(() => {
    ACTIVITY_EVENTS.forEach(event => {
      document.removeEventListener(event, recordActivity)
    })
    if (checkInterval !== null) {
      clearInterval(checkInterval)
      checkInterval = null
    }
  })

  return {
    isIdle,
    lastActivityTime,
  }
}
