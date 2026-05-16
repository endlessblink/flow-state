<template>
  <div
    ref="cardRef"
    class="quick-sort-card"
    :class="{
      'swiping': swipeState.isSwiping,
      'swipeLeft': swipeDirection === 'left',
      'swipeRight': swipeDirection === 'right',
      'swipeUp': swipeDirection === 'up',
      'swipeDown': swipeDirection === 'down'
    }"
    :style="cardStyle"
  >
    <!-- Swipe Indicators - Clear action feedback for all 4 directions -->
    <div class="swipe-indicator left" :style="{ opacity: leftOverlayOpacity }">
      <div class="swipe-content">
        <Trash2 :size="32" />
        <span>Delete</span>
      </div>
    </div>
    <div class="swipe-indicator right" :style="{ opacity: rightOverlayOpacity }">
      <div class="swipe-content">
        <Save :size="32" />
        <span>Save</span>
      </div>
    </div>
    <div class="swipe-indicator up" :style="{ opacity: upOverlayOpacity }">
      <div class="swipe-content">
        <Pencil :size="32" />
        <span>Edit</span>
      </div>
    </div>
    <div class="swipe-indicator down" :style="{ opacity: downOverlayOpacity }">
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

      <MarkdownRenderer
        v-if="task.description"
        :content="truncateDescription(task.description)"
        class="task-description"
      />

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
import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue'
import type { Task } from '@/types/tasks'

defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  (e: 'swipeRight'): void
  (e: 'swipeLeft'): void
  (e: 'swipeUp'): void
  (e: 'swipeDown'): void
}>()

const cardRef = ref<HTMLElement | null>(null)

// Swipe gesture handling - with mouse support for desktop
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
  mouse: true,
  onSwipeRight: () => emit('swipeRight'),
  onSwipeLeft: () => emit('swipeLeft'),
  onSwipeUp: () => emit('swipeUp'),
  onSwipeDown: () => emit('swipeDown')
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
    const rotate = deltaX.value * 0.05
    const maxRotate = 15
    const clampedRotate = Math.max(-maxRotate, Math.min(maxRotate, rotate))
    return {
      transform: `translateX(${deltaX.value}px) rotate(${clampedRotate}deg)`,
      transition: 'none'
    }
  } else {
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
  const _progress = Math.min(dominant / 100, 1)
  if (_progress < 0.1) {
    return { filter: 'none', opacity: 1 }
  }
  const blurAmount = _progress * 6
  const dimAmount = 1 - (_progress * 0.4)
  return {
    filter: `blur(${blurAmount}px)`,
    opacity: dimAmount,
    transition: swipeState.value.isSwiping ? 'none' : 'filter 0.2s ease, opacity 0.2s ease'
  }
})

function truncateDescription(desc: string): string {
  if (desc.length <= 150) return desc
  return desc.slice(0, 150) + '...'
}
</script>

<style scoped>
/* Main Task Card */
.quick-sort-card {
  position: relative;
  width: 100%;
  max-width: 480px;
  min-height: 200px;
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
  cursor: grab;
}

.quick-sort-card.swiping {
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

.swipe-indicator.left .swipe-content { color: var(--color-danger); }
.swipe-indicator.right .swipe-content { color: var(--brand-primary); }
.swipe-indicator.up .swipe-content { color: var(--color-info); }
.swipe-indicator.down .swipe-content { color: var(--text-secondary); }

.swipe-content span {
  font-size: var(--text-sm);
  font-weight: var(--font-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-content {
  position: relative;
  padding: var(--space-6) var(--space-8);
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
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  margin: 0 0 var(--space-3);
  color: var(--text-primary);
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
  word-break: break-word;
  max-height: 5.2em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
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
  max-height: 80px;
  overflow-y: auto;
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
  font-size: var(--text-sm);
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

@media (prefers-reduced-motion: reduce) {
  .quick-sort-card {
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
