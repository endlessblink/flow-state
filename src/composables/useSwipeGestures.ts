/**
 * useSwipeGestures.ts
 *
 * A composable for handling swipe gestures on mobile devices.
 * Features:
 * - Velocity-based swipe detection
 * - Configurable thresholds
 * - Spring-like visual feedback
 * - Haptic feedback integration
 */

import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'

export interface SwipeGestureOptions {
  /** Minimum distance (px) for swipe to register */
  threshold?: number
  /** Minimum velocity (px/ms) for quick swipe */
  velocityThreshold?: number
  /** Enable haptic feedback */
  haptics?: boolean
  /** Lock vertical movement during horizontal swipe */
  lockVertical?: boolean
  /** Callbacks */
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onSwipeStart?: () => void
  onSwipeMove?: (deltaX: number, deltaY: number, velocity: number) => void
  onSwipeEnd?: () => void
  onSwipeCancel?: () => void
}

export interface SwipeState {
  isSwiping: boolean
  direction: 'left' | 'right' | 'up' | 'down' | null
  deltaX: number
  deltaY: number
  velocity: number
  progress: number // 0-1 based on threshold
}

export function useSwipeGestures(
  targetRef: Ref<HTMLElement | null>,
  options: SwipeGestureOptions = {}
) {
  const {
    threshold = 100,
    velocityThreshold = 0.5,
    haptics = true,
    lockVertical = true,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipeStart,
    onSwipeMove,
    onSwipeEnd,
    onSwipeCancel
  } = options

  // State
  const isSwiping = ref(false)
  const isLocked = ref(false)
  const startX = ref(0)
  const startY = ref(0)
  const currentX = ref(0)
  const currentY = ref(0)
  const startTime = ref(0)
  const lastMoveTime = ref(0)
  const lastX = ref(0)
  const lastY = ref(0)

  // Computed values
  const deltaX = computed(() => currentX.value - startX.value)
  const deltaY = computed(() => currentY.value - startY.value)

  const velocity = computed(() => {
    const dt = lastMoveTime.value - startTime.value
    if (dt === 0) return 0
    const dx = Math.abs(deltaX.value)
    return dx / dt
  })

  const direction = computed<'left' | 'right' | 'up' | 'down' | null>(() => {
    if (!isSwiping.value) return null

    const absX = Math.abs(deltaX.value)
    const absY = Math.abs(deltaY.value)

    // Determine primary direction
    if (absX > absY) {
      return deltaX.value > 0 ? 'right' : 'left'
    } else if (absY > absX) {
      return deltaY.value > 0 ? 'down' : 'up'
    }
    return null
  })

  const progress = computed(() => {
    const absX = Math.abs(deltaX.value)
    return Math.min(absX / threshold, 1)
  })

  const swipeState = computed<SwipeState>(() => ({
    isSwiping: isSwiping.value,
    direction: direction.value,
    deltaX: deltaX.value,
    deltaY: deltaY.value,
    velocity: velocity.value,
    progress: progress.value
  }))

  // Haptic feedback
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!haptics || typeof navigator === 'undefined') return

    if ('vibrate' in navigator) {
      const durations = { light: 10, medium: 20, heavy: 40 }
      navigator.vibrate(durations[type])
    }
  }

  // Touch handlers
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]

    isSwiping.value = true
    isLocked.value = false
    startX.value = touch.clientX
    startY.value = touch.clientY
    currentX.value = touch.clientX
    currentY.value = touch.clientY
    lastX.value = touch.clientX
    lastY.value = touch.clientY
    startTime.value = Date.now()
    lastMoveTime.value = Date.now()

    onSwipeStart?.()
    triggerHaptic('light')
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping.value) return

    const touch = e.touches[0]
    currentX.value = touch.clientX
    currentY.value = touch.clientY
    lastMoveTime.value = Date.now()

    const absX = Math.abs(deltaX.value)
    const absY = Math.abs(deltaY.value)

    // Lock direction once determined (for horizontal swipes)
    if (!isLocked.value && (absX > 10 || absY > 10)) {
      isLocked.value = true

      // If primarily horizontal, prevent vertical scroll
      if (lockVertical && absX > absY) {
        e.preventDefault()
      }
    }

    // If locked to horizontal, prevent default
    if (isLocked.value && absX > absY && lockVertical) {
      e.preventDefault()
    }

    // Milestone haptics
    if (progress.value >= 0.5 && Math.abs(deltaX.value - lastX.value) > 5) {
      if (progress.value >= 1) {
        triggerHaptic('heavy')
      } else if (progress.value >= 0.75) {
        triggerHaptic('medium')
      }
    }

    lastX.value = touch.clientX
    lastY.value = touch.clientY

    onSwipeMove?.(deltaX.value, deltaY.value, velocity.value)
  }

  const handleTouchEnd = () => {
    if (!isSwiping.value) return

    const absX = Math.abs(deltaX.value)
    const absY = Math.abs(deltaY.value)
    const isHorizontal = absX > absY

    // Check if swipe was completed (threshold or velocity)
    const thresholdMet = absX >= threshold || absY >= threshold
    const velocityMet = velocity.value >= velocityThreshold

    if (isHorizontal && (thresholdMet || velocityMet)) {
      if (deltaX.value > 0) {
        triggerHaptic('heavy')
        onSwipeRight?.()
      } else {
        triggerHaptic('heavy')
        onSwipeLeft?.()
      }
      onSwipeEnd?.()
    } else if (!isHorizontal && (thresholdMet || velocityMet)) {
      if (deltaY.value > 0) {
        onSwipeDown?.()
      } else {
        onSwipeUp?.()
      }
      onSwipeEnd?.()
    } else {
      // Swipe cancelled
      onSwipeCancel?.()
    }

    // Reset state
    isSwiping.value = false
    isLocked.value = false
  }

  const handleTouchCancel = () => {
    isSwiping.value = false
    isLocked.value = false
    onSwipeCancel?.()
  }

  // Setup and cleanup
  onMounted(() => {
    const el = targetRef.value
    if (!el) return

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true })
  })

  onUnmounted(() => {
    const el = targetRef.value
    if (!el) return

    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
    el.removeEventListener('touchcancel', handleTouchCancel)
  })

  // Manual reset
  const reset = () => {
    isSwiping.value = false
    isLocked.value = false
    startX.value = 0
    startY.value = 0
    currentX.value = 0
    currentY.value = 0
  }

  return {
    swipeState,
    isSwiping,
    direction,
    deltaX,
    deltaY,
    velocity,
    progress,
    reset,
    triggerHaptic
  }
}
