/**
 * useLongPress.ts
 *
 * A composable for handling long-press gestures with visual feedback animations.
 * Designed for mobile PWA task editing interactions.
 *
 * Features:
 * - Configurable press duration (default 500ms)
 * - Three-state transition: idle -> pressing -> activated
 * - Progressive visual feedback during press
 * - Haptic feedback via Web Vibration API
 * - Performant animations using transform and opacity only
 */

import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'

export type LongPressState = 'idle' | 'pressing' | 'activated'

export interface LongPressOptions {
  /** Duration in ms before long press activates (default: 500ms) */
  duration?: number
  /** Enable haptic feedback via Web Vibration API */
  haptics?: boolean
  /** Haptic vibration duration in ms on activation */
  hapticDuration?: number
  /** Movement threshold to cancel press (in pixels) */
  movementThreshold?: number
  /** Callback when press starts */
  onPressStart?: () => void
  /** Callback during press with progress (0-1) */
  onPressProgress?: (progress: number) => void
  /** Callback when long press completes successfully */
  onLongPress?: () => void
  /** Callback when press is cancelled (released early or moved) */
  onPressCancel?: () => void
  /** Callback when press ends (regardless of completion) */
  onPressEnd?: () => void
}

export interface LongPressReturn {
  /** Current state: idle, pressing, or activated */
  state: Ref<LongPressState>
  /** Progress from 0 to 1 during press */
  progress: Ref<number>
  /** Whether currently in pressing state */
  isPressing: Ref<boolean>
  /** Whether long press was activated */
  isActivated: Ref<boolean>
  /** CSS classes to apply for visual feedback */
  pressClasses: Ref<Record<string, boolean>>
  /** Inline styles for dynamic progress-based effects */
  pressStyles: Ref<Record<string, string>>
  /** Manual reset function */
  reset: () => void
  /** Trigger haptic feedback manually */
  triggerHaptic: (duration?: number) => void
}

export function useLongPress(
  targetRef: Ref<HTMLElement | null>,
  options: LongPressOptions = {}
): LongPressReturn {
  const {
    duration = 500,
    haptics = true,
    hapticDuration = 50,
    movementThreshold = 10,
    onPressStart,
    onPressProgress,
    onLongPress,
    onPressCancel,
    onPressEnd
  } = options

  // State
  const state = ref<LongPressState>('idle')
  const progress = ref(0)
  const startX = ref(0)
  const startY = ref(0)
  const pressTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const progressInterval = ref<ReturnType<typeof setInterval> | null>(null)
  const startTime = ref(0)

  // Computed values
  const isPressing = computed(() => state.value === 'pressing')
  const isActivated = computed(() => state.value === 'activated')

  // CSS classes for visual feedback states
  const pressClasses = computed(() => ({
    'long-press-idle': state.value === 'idle',
    'long-press-pressing': state.value === 'pressing',
    'long-press-activated': state.value === 'activated'
  }))

  // Dynamic inline styles for progress-based effects
  // Scale: 1.0 -> 1.02 to 1.05 based on progress
  // Shadow elevation increases with progress
  const pressStyles = computed(() => {
    if (state.value === 'idle') {
      return {
        transform: 'scale(1)',
        boxShadow: '',
        transition: 'transform var(--duration-normal) var(--spring-smooth), box-shadow var(--duration-normal) var(--spring-smooth)'
      }
    }

    if (state.value === 'pressing') {
      // Progressive scale from 1.0 to 1.03 during press
      const scale = 1 + (progress.value * 0.03)
      // Progressive shadow elevation
      const shadowOpacity = 0.1 + (progress.value * 0.15)
      const shadowBlur = 4 + (progress.value * 12)
      const shadowSpread = progress.value * 2

      return {
        transform: `scale(${scale.toFixed(4)})`,
        boxShadow: `0 ${4 + progress.value * 8}px ${shadowBlur}px ${shadowSpread}px rgba(0, 0, 0, ${shadowOpacity.toFixed(2)})`,
        transition: 'none' // Smooth animation handled by interval
      }
    }

    // Activated state - final elevated position
    return {
      transform: 'scale(1.03)',
      boxShadow: '0 12px 24px 4px rgba(0, 0, 0, 0.25), 0 0 0 2px var(--brand-primary)',
      transition: 'transform var(--duration-fast) var(--spring-bounce), box-shadow var(--duration-fast) var(--spring-smooth)'
    }
  })

  // Haptic feedback using Web Vibration API
  const triggerHaptic = (vibrationDuration: number = hapticDuration) => {
    if (!haptics || typeof navigator === 'undefined') return

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(vibrationDuration)
      } catch {
        // Vibration API not supported or blocked
      }
    }
  }

  // Progress milestone haptics for tactile feedback during press
  let lastMilestone = 0
  const checkMilestoneHaptic = (currentProgress: number) => {
    const milestones = [0.25, 0.5, 0.75]
    for (const milestone of milestones) {
      if (currentProgress >= milestone && lastMilestone < milestone) {
        triggerHaptic(10) // Light haptic at milestones
        lastMilestone = milestone
      }
    }
  }

  // Clear all timers
  const clearTimers = () => {
    if (pressTimer.value) {
      clearTimeout(pressTimer.value)
      pressTimer.value = null
    }
    if (progressInterval.value) {
      clearInterval(progressInterval.value)
      progressInterval.value = null
    }
  }

  // Reset state
  const reset = () => {
    clearTimers()
    state.value = 'idle'
    progress.value = 0
    lastMilestone = 0
    startX.value = 0
    startY.value = 0
    startTime.value = 0
  }

  // Handle press activation (long press completed)
  const activatePress = () => {
    clearTimers()
    state.value = 'activated'
    progress.value = 1

    // Strong haptic feedback on activation
    triggerHaptic(hapticDuration)

    onLongPress?.()
  }

  // Start progress tracking
  const startProgressTracking = () => {
    startTime.value = Date.now()

    // Update progress at ~60fps for smooth animation
    const updateInterval = 16 // ~60fps
    progressInterval.value = setInterval(() => {
      const elapsed = Date.now() - startTime.value
      const newProgress = Math.min(elapsed / duration, 1)
      progress.value = newProgress

      onPressProgress?.(newProgress)
      checkMilestoneHaptic(newProgress)

      // Stop interval when complete (timer will handle activation)
      if (newProgress >= 1 && progressInterval.value) {
        clearInterval(progressInterval.value)
        progressInterval.value = null
      }
    }, updateInterval)
  }

  // Touch/Pointer handlers
  const handlePressStart = (clientX: number, clientY: number) => {
    // Don't start a new press if already activated
    if (state.value === 'activated') return

    clearTimers()
    state.value = 'pressing'
    progress.value = 0
    lastMilestone = 0
    startX.value = clientX
    startY.value = clientY

    // Light haptic on press start
    triggerHaptic(10)

    onPressStart?.()

    // Start progress tracking for visual feedback
    startProgressTracking()

    // Set timer for activation
    pressTimer.value = setTimeout(activatePress, duration)
  }

  const handlePressMove = (clientX: number, clientY: number) => {
    if (state.value !== 'pressing') return

    // Check if moved beyond threshold (cancel press)
    const deltaX = Math.abs(clientX - startX.value)
    const deltaY = Math.abs(clientY - startY.value)

    if (deltaX > movementThreshold || deltaY > movementThreshold) {
      clearTimers()
      state.value = 'idle'
      progress.value = 0
      onPressCancel?.()
    }
  }

  const handlePressEnd = () => {
    const wasActivated = state.value === 'activated'
    const wasPressing = state.value === 'pressing'

    clearTimers()

    if (wasPressing) {
      // Press ended before activation - cancelled
      onPressCancel?.()
    }

    // Reset to idle (unless activated, in which case consumer should reset when done)
    if (!wasActivated) {
      state.value = 'idle'
      progress.value = 0
    }

    onPressEnd?.()
  }

  // Touch event handlers
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    handlePressStart(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0]
    handlePressMove(touch.clientX, touch.clientY)
  }

  const handleTouchEnd = () => {
    handlePressEnd()
  }

  const handleTouchCancel = () => {
    clearTimers()
    state.value = 'idle'
    progress.value = 0
    onPressCancel?.()
  }

  // Mouse event handlers (for desktop testing)
  const handleMouseDown = (e: MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return
    handlePressStart(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: MouseEvent) => {
    handlePressMove(e.clientX, e.clientY)
  }

  const handleMouseUp = () => {
    handlePressEnd()
  }

  const handleMouseLeave = () => {
    if (state.value === 'pressing') {
      clearTimers()
      state.value = 'idle'
      progress.value = 0
      onPressCancel?.()
    }
  }

  // Context menu prevention during long press
  const handleContextMenu = (e: Event) => {
    if (state.value === 'pressing' || state.value === 'activated') {
      e.preventDefault()
    }
  }

  // Setup and cleanup
  onMounted(() => {
    const el = targetRef.value
    if (!el) return

    // Touch events (mobile)
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    // Mouse events (desktop fallback/testing)
    el.addEventListener('mousedown', handleMouseDown)
    el.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseup', handleMouseUp)
    el.addEventListener('mouseleave', handleMouseLeave)

    // Prevent context menu during long press
    el.addEventListener('contextmenu', handleContextMenu)
  })

  onUnmounted(() => {
    const el = targetRef.value
    if (!el) return

    clearTimers()

    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
    el.removeEventListener('touchcancel', handleTouchCancel)
    el.removeEventListener('mousedown', handleMouseDown)
    el.removeEventListener('mousemove', handleMouseMove)
    el.removeEventListener('mouseup', handleMouseUp)
    el.removeEventListener('mouseleave', handleMouseLeave)
    el.removeEventListener('contextmenu', handleContextMenu)
  })

  return {
    state,
    progress,
    isPressing,
    isActivated,
    pressClasses,
    pressStyles,
    reset,
    triggerHaptic
  }
}
