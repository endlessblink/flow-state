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
  onSwipeRight: () => emit('swipe-right'),
  onSwipeLeft: () => emit('swipe-left'),
  onSwipeUp: () => emit('swipe-up'),
  onSwipeDown: () => emit('swipe-down')
})

// Card transform style - supports both horizontal and vertical movement
const cardStyle = computed(() => {
  if (!swipeState.value.isSwiping) {
    return {
      transform: 'translateX(0) translateY(0) rotate(0deg)',
      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
    }
  }

  const absX = Math.abs(deltaX.value)
  const absY = Math.abs(deltaY.value)
  const isHorizontal = absX > absY

  if (isHorizontal) {
    // Horizontal swipe: translate X + rotate
    const rotate = deltaX.value * 0.05
    const maxRotate = 15
    const clampedRotate = Math.max(-maxRotate, Math.min(maxRotate, rotate))
    return {
      transform: `translateX(${deltaX.value}px) rotate(${clampedRotate}deg)`,
      transition: 'none'
    }
  } else {
    // Vertical swipe: translate Y only (no rotate)
    return {
      transform: `translateY(${deltaY.value}px)`,
      transition: 'none'
    }
  }
})

// Overlay opacities - all 4 directions
const leftOverlayOpacity = computed(() => {
  if (deltaX.value >= 0 || Math.abs(deltaY.value) > Math.abs(deltaX.value)) return 0
  return Math.min(Math.abs(deltaX.value) / 120, 1) * 0.9
})

const rightOverlayOpacity = computed(() => {
  if (deltaX.value <= 0 || Math.abs(deltaY.value) > Math.abs(deltaX.value)) return 0
  return Math.min(deltaX.value / 120, 1) * 0.9
})

const upOverlayOpacity = computed(() => {
  if (deltaY.value >= 0 || Math.abs(deltaX.value) > Math.abs(deltaY.value)) return 0
  return Math.min(Math.abs(deltaY.value) / 120, 1) * 0.9
})

const downOverlayOpacity = computed(() => {
  if (deltaY.value <= 0 || Math.abs(deltaX.value) > Math.abs(deltaY.value)) return 0
  return Math.min(deltaY.value / 120, 1) * 0.9
})

// Content blur effect when swiping (any direction)
const contentBlurStyle = computed(() => {
  const dominant = Math.max(Math.abs(deltaX.value), Math.abs(deltaY.value))
  const progress = Math.min(dominant / 100, 1)
  if (progress < 0.1) {
    return { filter: 'none', opacity: 1 }
  }
  const blurAmount = progress * 6 // Max 6px blur
  const dimAmount = 1 - (progress * 0.4) // Dim to 60%
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

function formatDueDate(date: string): string {
  const d = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  d.setHours(0, 0, 0, 0)

  if (d.getTime() === today.getTime()) return 'Today'
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow'

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>
