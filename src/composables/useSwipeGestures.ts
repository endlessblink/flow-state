/**
 * useSwipeGestures.ts
 *
 * A composable for handling swipe/drag gestures on both mobile and desktop.
 * Features:
 * - Velocity-based swipe detection
 * - Configurable thresholds
 * - Spring-like visual feedback
 * - Haptic feedback integration
 * - Mouse drag support for desktop
 */

import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'
import { useHaptics } from './useHaptics'

export interface SwipeGestureOptions {
  /** Minimum distance (px) for swipe to register */
  threshold?: number
  /** Minimum velocity (px/ms) for quick swipe */
  velocityThreshold?: number
  /** Enable haptic feedback */
  haptics?: boolean
  /** Lock vertical movement during horizontal swipe */
  lockVertical?: boolean
  /** Enable 4-direction mode (prevents page scroll during vertical swipes on the target) */
  fourDirectional?: boolean
  /** Enable mouse drag (for desktop) */
  mouse?: boolean
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
    fourDirectional = false,
    mouse = false,
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
    const absX = Math.abs(deltaX.value)
    const absY = Math.abs(deltaY.value)
    // Use the dominant axis for velocity
    const dominant = absX > absY ? absX : absY
    return dominant / dt
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
    const absY = Math.abs(deltaY.value)
    // Use the dominant axis for progress
    const dominant = absX > absY ? absX : absY
    return Math.min(dominant / threshold, 1)
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
  const { triggerHaptic: baseTriggerHaptic } = useHaptics()

  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!haptics) return
    baseTriggerHaptic(type)
  }

  // Shared start/move/end logic
  function beginSwipe(clientX: number, clientY: number) {
    isSwiping.value = true
    isLocked.value = false
    startX.value = clientX
    startY.value = clientY
    currentX.value = clientX
    currentY.value = clientY
    lastX.value = clientX
    lastY.value = clientY
    startTime.value = Date.now()
    lastMoveTime.value = Date.now()
    onSwipeStart?.()
    triggerHaptic('light')
  }

  function moveSwipe(clientX: number, clientY: number) {
    if (!isSwiping.value) return
    currentX.value = clientX
    currentY.value = clientY
    lastMoveTime.value = Date.now()

    // Mark as locked once direction is determined
    const absX = Math.abs(deltaX.value)
    const absY = Math.abs(deltaY.value)
    if (!isLocked.value && (absX > 10 || absY > 10)) {
      isLocked.value = true
    }

    // Milestone haptics
    if (progress.value >= 0.5 && Math.abs(deltaX.value - lastX.value) > 5) {
      if (progress.value >= 1) {
        triggerHaptic('heavy')
      } else if (progress.value >= 0.75) {
        triggerHaptic('medium')
      }
    }

    lastX.value = clientX
    lastY.value = clientY
    onSwipeMove?.(deltaX.value, deltaY.value, velocity.value)
  }

  function endSwipe() {
    if (!isSwiping.value) return

    const absX = Math.abs(deltaX.value)
    const absY = Math.abs(deltaY.value)
    const isHorizontal = absX > absY

    // Check if swipe was completed (threshold or velocity)
    // Minimum 40% of threshold distance required even for velocity-based swipes
    // so releasing near the center never triggers an action
    const minDistance = threshold * 0.4
    const dominant = isHorizontal ? absX : absY
    const thresholdMet = dominant >= threshold
    const velocityMet = velocity.value >= velocityThreshold && dominant >= minDistance

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
    // Reset position values to ensure deltaX/deltaY return to 0
    currentX.value = startX.value
    currentY.value = startY.value
  }

  function cancelSwipe() {
    isSwiping.value = false
    isLocked.value = false
    currentX.value = startX.value
    currentY.value = startY.value
    onSwipeCancel?.()
  }

  // Touch handlers
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    // BUG-1453: Never preventDefault in touchstart — direction is unknown at this point.
    // On real Android Chrome, this poisons the gesture and the compositor drops subsequent
    // touchmove events. Scroll blocking is deferred to touchmove where direction is known.
    beginSwipe(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping.value) return
    const touch = e.touches[0]

    // BUG-1453: Update position FIRST so deltaX/deltaY reflect current movement
    // before we check thresholds (matches old working behavior from 3a149cb6)
    moveSwipe(touch.clientX, touch.clientY)

    const absX = Math.abs(deltaX.value)
    const absY = Math.abs(deltaY.value)

    // Only block scroll AFTER 10px lock threshold — giving the browser's compositor
    // time to recognize the gesture. Calling preventDefault before this threshold
    // causes Android Chrome to drop touch events.
    if (!isLocked.value) return

    if (fourDirectional) {
      e.preventDefault()
    } else if (absX > absY && lockVertical) {
      e.preventDefault()
    }
  }

  const handleTouchEnd = () => endSwipe()
  const handleTouchCancel = () => cancelSwipe()

  // Mouse handlers (for desktop drag)
  const handleMouseDown = (e: MouseEvent) => {
    // Don't start drag from interactive elements
    const target = e.target as HTMLElement
    if (target?.closest('button, input, select, a, .n-date-picker, .n-popover')) return

    e.preventDefault()
    beginSwipe(e.clientX, e.clientY)

    // Attach move/up to document for reliable tracking
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleMouseMove = (e: MouseEvent) => {
    e.preventDefault()
    moveSwipe(e.clientX, e.clientY)
  }

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    endSwipe()
  }

  // Setup and cleanup
  onMounted(() => {
    const el = targetRef.value
    if (!el) return

    // BUG-1453: touchstart must always be passive — calling preventDefault before direction
    // is known causes Android Chrome to drop the touch sequence. Scroll blocking is in touchmove.
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    if (mouse) {
      el.addEventListener('mousedown', handleMouseDown)
    }
  })

  onUnmounted(() => {
    const el = targetRef.value
    if (!el) return

    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
    el.removeEventListener('touchcancel', handleTouchCancel)

    if (mouse) {
      el.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
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
