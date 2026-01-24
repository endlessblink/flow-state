<template>
  <div
    ref="containerRef"
    class="swipeable-task-item"
    :class="{
      'swiping': isSwiping,
      'confirming-delete': isConfirmingDelete
    }"
  >
    <!-- Left Action (Edit) - revealed on right swipe -->
    <div
      class="action-area action-left"
      :style="{ opacity: leftActionOpacity, width: `${Math.max(0, translateX)}px` }"
    >
      <div class="action-content edit">
        <Pencil :size="20" />
        <span v-if="translateX > 80">Edit</span>
      </div>
    </div>

    <!-- Right Action (Delete) - revealed on left swipe -->
    <div
      class="action-area action-right"
      :style="{ opacity: rightActionOpacity, width: `${Math.max(0, -translateX)}px` }"
    >
      <div class="action-content delete" @click.stop="handleDeleteClick">
        <Trash2 :size="20" />
        <span v-if="-translateX > 80">{{ isConfirmingDelete ? 'Confirm?' : 'Delete' }}</span>
      </div>
    </div>

    <!-- Main Content (slides) -->
    <div
      ref="contentRef"
      class="swipeable-content"
      :style="contentStyle"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchCancel"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  taskId: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'swipe-start'): void
  (e: 'swipe-end'): void
}>()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

// Swipe state
const isSwiping = ref(false)
const translateX = ref(0)
const startX = ref(0)
const startY = ref(0)
const startTime = ref(0)
const isHorizontalSwipe = ref(false)
const wasHorizontalDecided = ref(false)
const isConfirmingDelete = ref(false)
let confirmTimeout: ReturnType<typeof setTimeout> | null = null

// Thresholds
const SWIPE_THRESHOLD = 80 // px to trigger action
const VELOCITY_THRESHOLD = 0.3 // px/ms for quick swipe
const DIRECTION_LOCK_THRESHOLD = 10 // px before locking direction
const MAX_SWIPE = 120 // max translateX

// Content transform style
const contentStyle = computed(() => {
  if (translateX.value === 0) {
    return {
      transform: 'translateX(0)',
      transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    }
  }

  if (isSwiping.value) {
    // Apply resistance at edges
    const resistance = 0.5
    let x = translateX.value
    if (Math.abs(x) > MAX_SWIPE) {
      const overflow = Math.abs(x) - MAX_SWIPE
      x = (x > 0 ? MAX_SWIPE : -MAX_SWIPE) + (x > 0 ? 1 : -1) * overflow * resistance
    }

    return {
      transform: `translateX(${x}px)`,
      transition: 'none'
    }
  }

  return {
    transform: `translateX(${translateX.value}px)`,
    transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  }
})

// Action button opacities
const leftActionOpacity = computed(() => {
  if (translateX.value <= 0) return 0
  return Math.min(translateX.value / SWIPE_THRESHOLD, 1)
})

const rightActionOpacity = computed(() => {
  if (translateX.value >= 0) return 0
  return Math.min(-translateX.value / SWIPE_THRESHOLD, 1)
})

// Haptic feedback
const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  const durations = { light: 10, medium: 20, heavy: 40 }
  try {
    navigator.vibrate(durations[type])
  } catch {
    // Vibration not supported
  }
}

// Track if we've crossed threshold for haptic
let hasTriggeredThresholdHaptic = false

// Touch handlers
const handleTouchStart = (e: TouchEvent) => {
  if (props.disabled) return

  const touch = e.touches[0]
  startX.value = touch.clientX
  startY.value = touch.clientY
  startTime.value = Date.now()
  isSwiping.value = true
  wasHorizontalDecided.value = false
  isHorizontalSwipe.value = false
  hasTriggeredThresholdHaptic = false

  // Clear any existing confirmation
  if (confirmTimeout) {
    clearTimeout(confirmTimeout)
    confirmTimeout = null
  }
  isConfirmingDelete.value = false

  emit('swipe-start')
}

const handleTouchMove = (e: TouchEvent) => {
  if (!isSwiping.value || props.disabled) return

  const touch = e.touches[0]
  const deltaX = touch.clientX - startX.value
  const deltaY = touch.clientY - startY.value

  // Decide direction lock
  if (!wasHorizontalDecided.value) {
    if (Math.abs(deltaX) > DIRECTION_LOCK_THRESHOLD || Math.abs(deltaY) > DIRECTION_LOCK_THRESHOLD) {
      wasHorizontalDecided.value = true
      isHorizontalSwipe.value = Math.abs(deltaX) > Math.abs(deltaY)

      if (isHorizontalSwipe.value) {
        triggerHaptic('light')
      }
    }
  }

  // If horizontal swipe, update translateX and prevent scroll
  if (isHorizontalSwipe.value) {
    e.preventDefault()
    translateX.value = deltaX

    // Threshold haptic
    if (!hasTriggeredThresholdHaptic && Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      hasTriggeredThresholdHaptic = true
      triggerHaptic('medium')
    }
  }
}

const handleTouchEnd = () => {
  if (!isSwiping.value) return

  const deltaX = translateX.value
  const elapsed = Date.now() - startTime.value
  const velocity = Math.abs(deltaX) / elapsed

  // Check if action should trigger
  const thresholdMet = Math.abs(deltaX) >= SWIPE_THRESHOLD
  const velocityMet = velocity >= VELOCITY_THRESHOLD && Math.abs(deltaX) > 30

  if (isHorizontalSwipe.value && (thresholdMet || velocityMet)) {
    if (deltaX > 0) {
      // Right swipe → Edit
      triggerHaptic('heavy')
      emit('edit')
      resetSwipe()
    } else {
      // Left swipe → Delete (needs confirmation)
      triggerHaptic('heavy')
      if (isConfirmingDelete.value) {
        // Second swipe = confirm delete
        emit('delete')
        resetSwipe()
      } else {
        // First swipe = show confirmation
        isConfirmingDelete.value = true
        translateX.value = -MAX_SWIPE
        // Auto-close after 3 seconds
        confirmTimeout = setTimeout(() => {
          isConfirmingDelete.value = false
          resetSwipe()
        }, 3000)
      }
    }
  } else {
    resetSwipe()
  }

  isSwiping.value = false
  emit('swipe-end')
}

const handleTouchCancel = () => {
  isSwiping.value = false
  resetSwipe()
  emit('swipe-end')
}

const handleDeleteClick = () => {
  if (isConfirmingDelete.value) {
    triggerHaptic('heavy')
    emit('delete')
    resetSwipe()
  }
}

const resetSwipe = () => {
  translateX.value = 0
  isConfirmingDelete.value = false
  if (confirmTimeout) {
    clearTimeout(confirmTimeout)
    confirmTimeout = null
  }
}

// Public method to reset from parent
defineExpose({ reset: resetSwipe })

onUnmounted(() => {
  if (confirmTimeout) {
    clearTimeout(confirmTimeout)
  }
})
</script>

<style scoped>
.swipeable-task-item {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg, 12px);
}

.swipeable-content {
  position: relative;
  z-index: 2;
  background: var(--surface-primary, #1a1a1a);
  will-change: transform;
  touch-action: pan-y;
}

/* Action areas behind content */
.action-area {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  z-index: 1;
}

.action-left {
  left: 0;
  background: linear-gradient(90deg, var(--primary-brand, #4ECDC4) 0%, var(--primary-brand, #4ECDC4) 100%);
  border-radius: var(--radius-lg, 12px) 0 0 var(--radius-lg, 12px);
}

.action-right {
  right: 0;
  background: linear-gradient(90deg, var(--danger-text, #ef4444) 0%, var(--danger-text, #ef4444) 100%);
  border-radius: 0 var(--radius-lg, 12px) var(--radius-lg, 12px) 0;
}

.action-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
}

.action-content.edit {
  color: white;
}

.action-content.delete {
  color: white;
  cursor: pointer;
}

/* Confirming delete state */
.swipeable-task-item.confirming-delete .action-right {
  animation: pulse-delete 1s ease-in-out infinite;
}

@keyframes pulse-delete {
  0%, 100% {
    background: var(--danger-text, #ef4444);
  }
  50% {
    background: hsl(0, 90%, 55%);
  }
}

/* During swiping, disable pointer events on slot content */
.swipeable-task-item.swiping .swipeable-content {
  pointer-events: none;
}

/* Prevent text selection during swipe */
.swipeable-task-item {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
</style>
