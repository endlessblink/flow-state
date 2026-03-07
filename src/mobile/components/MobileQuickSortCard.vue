<template>
  <div
    ref="cardRef"
    class="task-card"
    :class="{
      'swiping': swipeState.isSwiping,
      'swipe-left': swipeDirection === 'left',
      'swipe-right': swipeDirection === 'right',
      'swipe-up': swipeDirection === 'up',
      'swipe-down': swipeDirection === 'down'
    }"
    :style="cardStyle"
  >
    <!-- Swipe Indicators - Clear action feedback for all 4 directions -->
    <div
      class="swipe-indicator left"
      :style="{ opacity: leftOverlayOpacity }"
    >
      <div class="swipe-content">
        <Trash2 :size="32" />
        <span>Delete</span>
      </div>
    </div>
    <div
      class="swipe-indicator right"
      :style="{ opacity: rightOverlayOpacity }"
    >
      <div class="swipe-content">
        <Save :size="32" />
        <span>Save</span>
      </div>
    </div>
    <div
      class="swipe-indicator up"
      :style="{ opacity: upOverlayOpacity }"
    >
      <div class="swipe-content">
        <Pencil :size="32" />
        <span>Edit</span>
      </div>
    </div>
    <div
      class="swipe-indicator down"
      :style="{ opacity: downOverlayOpacity }"
    >
      <div class="swipe-content">
        <SkipForward :size="32" />
        <span>Skip</span>
      </div>
    </div>

    <!-- Card Content with blur when swiping -->
    <div v-if="task" class="card-content" :style="contentBlurStyle">
      <!-- Priority Indicator -->
      <div
        class="priority-strip"
        :class="`priority-${task.priority || 'none'}`"
      />

      <h2 class="task-title" dir="auto">
        {{ task.title }}
      </h2>

      <p v-if="task.description" class="task-description">
        {{ truncateDescription(task.description) }}
      </p>

      <!-- Metadata -->
      <div class="task-meta">
        <div v-if="task.dueDate" class="meta-item">
          <Calendar :size="14" />
          <span>{{ formatDueDate(task.dueDate) }}</span>
        </div>
        <div v-if="task.priority" class="meta-item" :class="`priority-${task.priority}`">
          <Flag :size="14" />
          <span class="capitalize">{{ task.priority }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatDueDate } from '@/utils/dateUtils'
import {
  Trash2, Save, Pencil, SkipForward, Calendar, Flag
} from 'lucide-vue-next'
import { useSwipeGestures } from '@/composables/useSwipeGestures'
import type { Task } from '@/types/tasks'

const props = defineProps<{
  task: Task | null
}>()

const emit = defineEmits<{
  (e: 'swipe-right'): void
  (e: 'swipe-left'): void
  (e: 'swipe-up'): void
  (e: 'swipe-down'): void
}>()

const cardRef = ref<HTMLElement | null>(null)

// Swipe gesture handling
const {
  swipeState,
  deltaX,
  deltaY,
  direction: swipeDirection
} = useSwipeGestures(cardRef, {
  threshold: 120,
  velocityThreshold: 0.4,
  haptics: true,
  fourDirectional: true,
  mouse: true, // BUG-1453: enable mouse drag for desktop browsers in mobile viewport
  onSwipeStart: () => onSwipeStartCapture(),
  onSwipeEnd: () => onSwipeEndCapture(),
  onSwipeCancel: () => onSwipeEndCapture(),
  onSwipeRight: () => emit('swipe-right'),
  onSwipeLeft: () => emit('swipe-left'),
  onSwipeUp: () => emit('swipe-up'),
  onSwipeDown: () => emit('swipe-down')
})

// BUG-1453: Capture card's viewport position when swipe starts so we can
// switch to position:fixed (escapes ALL ancestor overflow clipping).
const fixedOrigin = ref<{ top: number; left: number; width: number; height: number } | null>(null)

// Watch for swipe start/end to capture/release fixed positioning
const onSwipeStartCapture = () => {
  const el = cardRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  fixedOrigin.value = { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

const onSwipeEndCapture = () => {
  fixedOrigin.value = null
}

// Card transform style - supports both horizontal and vertical movement
// BUG-1453: When swiping, card uses position:fixed to escape overflow:hidden ancestors
const cardStyle = computed(() => {
  if (!swipeState.value.isSwiping || !fixedOrigin.value) {
    return {
      transform: 'translateX(0) translateY(0) rotate(0deg)',
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }
  }

  const absX = Math.abs(deltaX.value)
  const absY = Math.abs(deltaY.value)
  const isHorizontal = absX > absY

  // Fixed positioning to escape all overflow clipping
  const base = {
    position: 'fixed' as const,
    top: `${fixedOrigin.value.top}px`,
    left: `${fixedOrigin.value.left}px`,
    width: `${fixedOrigin.value.width}px`,
    height: `${fixedOrigin.value.height}px`,
    zIndex: 9999,
    transition: 'none'
  }

  if (isHorizontal) {
    const rotate = deltaX.value * 0.05
    const maxRotate = 15
    const clampedRotate = Math.max(-maxRotate, Math.min(maxRotate, rotate))
    return {
      ...base,
      transform: `translateX(${deltaX.value}px) rotate(${clampedRotate}deg)`
    }
  } else {
    return {
      ...base,
      transform: `translateY(${deltaY.value}px)`
    }
  }
})

// Overlay opacities - all 4 directions
// Dead zone: overlay only appears after 50px of movement so the card
// visibly moves first. Max opacity 0.7 so card content stays visible.
const OVERLAY_DEAD_ZONE = 50
const OVERLAY_MAX = 0.7

function overlayOpacity(distance: number): number {
  if (distance <= OVERLAY_DEAD_ZONE) return 0
  const range = 120 - OVERLAY_DEAD_ZONE
  return Math.min((distance - OVERLAY_DEAD_ZONE) / range, 1) * OVERLAY_MAX
}

const leftOverlayOpacity = computed(() => {
  if (deltaX.value >= 0 || Math.abs(deltaY.value) > Math.abs(deltaX.value)) return 0
  return overlayOpacity(Math.abs(deltaX.value))
})

const rightOverlayOpacity = computed(() => {
  if (deltaX.value <= 0 || Math.abs(deltaY.value) > Math.abs(deltaX.value)) return 0
  return overlayOpacity(deltaX.value)
})

const upOverlayOpacity = computed(() => {
  if (deltaY.value >= 0 || Math.abs(deltaX.value) > Math.abs(deltaY.value)) return 0
  return overlayOpacity(Math.abs(deltaY.value))
})

const downOverlayOpacity = computed(() => {
  if (deltaY.value <= 0 || Math.abs(deltaX.value) > Math.abs(deltaY.value)) return 0
  return overlayOpacity(deltaY.value)
})

// Content blur - delayed to match overlay dead zone so you see the card move first
const contentBlurStyle = computed(() => {
  const dominant = Math.max(Math.abs(deltaX.value), Math.abs(deltaY.value))
  if (dominant < OVERLAY_DEAD_ZONE) {
    return { filter: 'none', opacity: 1 }
  }
  const progress = Math.min((dominant - OVERLAY_DEAD_ZONE) / (120 - OVERLAY_DEAD_ZONE), 1)
  const blurAmount = progress * 4 // Max 4px blur (lighter)
  const dimAmount = 1 - (progress * 0.3) // Dim to 70% (lighter)
  return {
    filter: `blur(${blurAmount}px)`,
    opacity: dimAmount,
    transition: swipeState.value.isSwiping ? 'none' : 'filter 0.2s ease, opacity 0.2s ease'
  }
})

function truncateDescription(desc: string): string {
  if (desc.length <= 120) return desc
  return desc.slice(0, 120) + '...'
}

</script>

<style scoped>
/* Main Task Card */
.task-card {
  position: relative;
  width: 92%;
  max-width: 360px;
  height: 180px;
  background: linear-gradient(
    145deg,
    var(--canvas-task-bg),
    var(--surface-secondary)
  );
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  box-shadow:
    var(--shadow-2xl),
    var(--shadow-dark-lg),
    inset 0 1px 0 var(--glass-bg-weak);
  z-index: 1;
  touch-action: none;
  user-select: none;
  overflow: hidden;
}

.task-card.swiping {
  cursor: grabbing;
}

.task-card.swipe-up,
.task-card.swipe-down {
  cursor: grabbing;
}

.swipe-indicator {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-2xl);
  pointer-events: none;
  transition: opacity var(--duration-instant) ease;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-sticky);
}

.swipe-indicator.left {
  border: var(--space-0_5) solid var(--color-danger);
  background: var(--danger-bg-subtle);
}

.swipe-indicator.right {
  border: var(--space-0_5) solid var(--brand-primary);
  background: var(--brand-bg-subtle);
}

.swipe-indicator.up {
  border: var(--space-0_5) solid var(--color-info);
  background: var(--blue-bg-subtle);
}

.swipe-indicator.down {
  border: var(--space-0_5) solid var(--glass-border-hover);
  background: var(--glass-bg-medium);
}

.swipe-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: inherit;
}

.swipe-indicator.left .swipe-content {
  color: var(--color-danger);
}

.swipe-indicator.right .swipe-content {
  color: var(--brand-primary);
}

.swipe-indicator.up .swipe-content {
  color: var(--color-info);
}

.swipe-indicator.down .swipe-content {
  color: var(--text-secondary);
}

.swipe-content span {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-content {
  position: relative;
  padding: var(--space-6);
  padding-bottom: var(--space-6);
  height: 100%;
  display: flex;
  flex-direction: column;
  z-index: 1;
  will-change: filter, opacity;
}

.priority-strip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--space-1);
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
}

.priority-strip.priority-high {
  background: linear-gradient(90deg, var(--color-priority-high), var(--priority-high-text));
}

.priority-strip.priority-medium {
  background: linear-gradient(90deg, var(--color-priority-medium), var(--priority-medium-text));
}

.priority-strip.priority-low {
  background: linear-gradient(90deg, var(--color-priority-low), var(--priority-low-text));
}

.priority-strip.priority-none {
  background: transparent;
}

.task-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  margin: 0 0 var(--space-3);
  color: var(--text-primary);
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
  word-break: break-word;
  max-height: 3.8em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  text-align: start;
  unicode-bidi: plaintext;
}

.task-description {
  flex: 1;
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--text-secondary);
  margin: 0;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.task-meta {
  display: flex;
  gap: var(--space-3);
  margin-top: auto;
  padding-top: var(--space-3);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-1_5) var(--space-2_5);
  background: var(--glass-bg-weak);
  border-radius: var(--radius-md);
  font-size: var(--text-meta);
  color: var(--text-muted);
}

.meta-item.priority-high {
  color: var(--color-priority-high);
  background: var(--glass-bg-soft);
  border: 1px solid var(--color-priority-high);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.meta-item.priority-medium {
  color: var(--color-priority-medium);
  background: var(--glass-bg-soft);
  border: 1px solid var(--color-priority-medium);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.meta-item.priority-low {
  color: var(--color-priority-low);
  background: var(--glass-bg-soft);
  border: 1px solid var(--color-priority-low);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.capitalize {
  text-transform: capitalize;
}

@media (max-height: 700px) {
  .task-card {
    height: 160px;
  }
  .card-content {
    padding: var(--space-4);
    padding-bottom: var(--space-5);
  }
  .task-title {
    font-size: var(--text-base);
    max-height: 3.8em;
    -webkit-line-clamp: 2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .task-card {
    animation: none !important;
    transition: none !important;
  }
}

[dir="rtl"] .card-content {
  text-align: right;
}
[dir="rtl"] .task-meta {
  flex-direction: row-reverse;
}
[dir="rtl"] .meta-item {
  flex-direction: row-reverse;
}
</style>
