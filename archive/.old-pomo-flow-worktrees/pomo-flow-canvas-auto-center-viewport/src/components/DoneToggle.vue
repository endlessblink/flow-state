<template>
  <div class="done-toggle">
    <!-- Premium Done Toggle with Advanced Glass Morphism -->
    <button
      :class="buttonClasses"
      @click="handleClick"
      @keydown.enter="handleKeyDown"
      @keydown.space.prevent="handleKeyDown"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @focus="handleFocus"
      @blur="handleBlur"
      :disabled="disabled"
      :title="enhancedTitle"
      :aria-label="enhancedAriaLabel"
      type="button"
      role="switch"
      :aria-checked="isCompleted ? 'true' : 'false'"
    >
      <div class="done-toggle__content" :class="contentClasses">
        <!-- Enhanced icon system with sophisticated animations -->
        <div class="done-toggle__icon-container">
          <!-- Premium check icon when completed -->
          <div v-if="isCompleted" class="done-toggle__check" :class="checkClasses">
            <Check :size="iconSize" />
            <div class="done-toggle__check-glow"></div>
            <div class="done-toggle__check-sparkle"></div>
          </div>

          <!-- Enhanced circle system when not completed -->
          <div v-else class="done-toggle__circle" :class="circleClasses">
            <div class="done-toggle__circle-inner"></div>
            <div class="done-toggle__circle-glow"></div>
            <div class="done-toggle__circle-pulse"></div>
          </div>
        </div>

        <!-- Advanced ripple effect system -->
        <div
          v-for="(ripple, index) in ripples"
          :key="ripple.id"
          class="done-toggle__ripple"
          :class="getRippleClasses(ripple)"
          :style="getRippleStyle(ripple)"
        ></div>

        <!-- Enhanced visual feedback layers -->
        <div class="done-toggle__glow-layer"></div>
        <div class="done-toggle__shine-layer"></div>
        <div class="done-toggle__particle-layer"></div>

        <!-- Completion celebration effects -->
        <transition name="celebration-fade" appear>
          <div v-if="showCelebration && isCompleted" class="done-toggle__celebration">
            <div
              v-for="n in celebrationParticles"
              :key="n"
              class="celebration-particle"
              :style="getCelebrationStyle(n)"
            ></div>
          </div>
        </transition>
      </div>

      <!-- Touch feedback overlay -->
      <div v-if="showTouchFeedback" class="done-toggle__touch-feedback"></div>
    </button>

    <!-- Floating completion hints -->
    <transition name="hints-fade" appear>
      <div
        v-if="showHints && (isHovered || isFocused)"
        class="done-toggle__hints"
        :class="hintsClasses"
      >
        <div class="hint-item">
          <span class="hint-icon">✓</span>
          <span class="hint-text">Task completed!</span>
        </div>
        <div class="hint-item">
          <span class="hint-icon">↻</span>
          <span class="hint-text">Undo</span>
        </div>
        <div v-if="showKeyboardShortcuts" class="hint-item">
          <kbd>Space</kbd>
          <span>Toggle</span>
        </div>
      </div>
    </transition>

    <!-- Progress indicator for multi-step completion -->
    <div v-if="showProgress" class="done-toggle__progress" :class="progressClasses">
      <div class="progress-bar" :style="{ width: `${progressPercentage}%` }"></div>
      <div class="progress-label">{{ progressPercentage }}%</div>
    </div>

    <!-- Status announcement for screen readers -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      {{ completionStatusText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Check } from 'lucide-vue-next'

interface Props {
  completed?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'subtle' | 'prominent' | 'minimal'
  title?: string
  ariaLabel?: string
  showHints?: boolean
  showProgress?: boolean
  progressPercentage?: number
  celebrationParticles?: number
}

const props = withDefaults(defineProps<Props>(), {
  completed: false,
  disabled: false,
  size: 'md',
  variant: 'default',
  title: 'Mark task as done',
  ariaLabel: 'Toggle task completion',
  showHints: true,
  showProgress: false,
  progressPercentage: 0,
  celebrationParticles: 8
})

const emit = defineEmits<{
  toggle: [completed: boolean]
  click: [event: MouseEvent | KeyboardEvent]
  celebrationStart: []
  celebrationEnd: []
}>()

// Advanced interaction states
const ripples = ref<Array<{ id: number; x: number; y: number; timestamp: number }>>([])
const isHovered = ref(false)
const isFocused = ref(false)
const showCelebration = ref(false)
const showTouchFeedback = ref(false)
const animationFrameId = ref<number>()

// Advanced ripple system
const nextRippleId = ref(0)
const triggerRipple = (event?: MouseEvent) => {
  const id = ++nextRippleId.value
  let x = 50, y = 50 // Default center

  if (event && event.target instanceof HTMLElement) {
    const rect = event.target.getBoundingClientRect()
    x = ((event.clientX - rect.left) / rect.width) * 100
    y = ((event.clientY - rect.top) / rect.height) * 100
  }

  ripples.value.push({
    id,
    x,
    y,
    timestamp: Date.now()
  })

  // Auto-remove ripple after animation
  setTimeout(() => {
    ripples.value = ripples.value.filter(r => r.id !== id)
  }, 600)
}

const getRippleClasses = (ripple: any) => [
  ripple.id === ripples.value[ripples.value.length - 1]?.id ? 'done-toggle__ripple--active' : ''
]

const getRippleStyle = (ripple: any) => ({
  left: `${ripple.x}%`,
  top: `${ripple.y}%`,
  transform: 'translate(-50%, -50%)'
})

// Advanced computed properties
const isCompleted = computed(() => props.completed)

const buttonClasses = computed(() => [
  'done-toggle__button',
  `done-toggle__button--${props.size}`,
  `done-toggle__button--${props.variant}`,
  {
    'done-toggle__button--completed': props.completed,
    'done-toggle__button--disabled': props.disabled,
    'done-toggle__button--hovered': isHovered.value,
    'done-toggle__button--focused': isFocused.value
  }
])

const contentClasses = computed(() => [
  'done-toggle__content',
  {
    'done-toggle__content--celebrating': showCelebration.value
  }
])

const checkClasses = computed(() => [
  'done-toggle__check',
  {
    'done-toggle__check--celebrating': showCelebration.value
  }
])

const circleClasses = computed(() => [
  'done-toggle__circle',
  {
    'done-toggle__circle--hover': isHovered.value,
    'done-toggle__circle--focus': isFocused.value
  }
])

const hintsClasses = computed(() => [
  'done-toggle__hints',
  `done-toggle__hints--${props.size}`,
  {
    'done-toggle__hints--visible': isHovered.value || isFocused.value
  }
])

const progressClasses = computed(() => [
  'done-toggle__progress',
  `done-toggle__progress--${props.size}`,
  {
    'done-toggle__progress--completed': props.completed
  }
])

const enhancedTitle = computed(() => {
  if (props.completed) return 'Task completed - Click to mark as incomplete'
  return props.title || 'Mark task as done'
})

const enhancedAriaLabel = computed(() => {
  if (props.completed) return 'Task completed, click to undo'
  return props.ariaLabel || 'Mark task as complete'
})

const completionStatusText = computed(() => {
  return props.completed ? 'Task completed' : 'Task not completed'
})

const showKeyboardShortcuts = computed(() => props.size !== 'sm')

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm': return 12
    case 'lg': return 20
    default: return 16
  }
})

// Celebration system
const celebrationParticles = computed(() => props.celebrationParticles)

const triggerCelebration = async () => {
  if (!props.completed || props.disabled) return

  showCelebration.value = true
  emit('celebrationStart')

  // Auto-hide celebration after animation
  setTimeout(() => {
    showCelebration.value = false
    emit('celebrationEnd')
  }, 2000)
}

const getCelebrationStyle = (index: number) => {
  const angle = (index / celebrationParticles.value) * 360
  const distance = 40 + Math.random() * 20
  const delay = Math.random() * 0.3
  const scale = 0.8 + Math.random() * 0.4

  return {
    '--angle': `${angle}deg`,
    '--distance': `${distance}px`,
    '--delay': `${delay}s`,
    '--scale': scale
  }
}

// Touch feedback system
const handleTouchStart = (event: TouchEvent) => {
  if (props.disabled) return
  showTouchFeedback.value = true
  triggerRipple()
}

const handleTouchEnd = (event: TouchEvent) => {
  if (props.disabled) return
  setTimeout(() => {
    showTouchFeedback.value = false
  }, 150)
}

// Event handlers with enhanced functionality
const handleClick = (event: MouseEvent) => {
  if (props.disabled) return

  event.stopPropagation()
  triggerRipple(event)

  const newCompletedState = !props.completed
  emit('toggle', newCompletedState)
  emit('click', event)

  // Trigger celebration when completing
  if (newCompletedState) {
    nextTick(() => {
      triggerCelebration()
    })
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (props.disabled) return

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    triggerRipple()

    const newCompletedState = !props.completed
    emit('toggle', newCompletedState)
    emit('click', event)

    // Trigger celebration when completing
    if (newCompletedState) {
      nextTick(() => {
        triggerCelebration()
      })
    }
  }
}

const handleMouseEnter = () => {
  isHovered.value = true
}

const handleMouseLeave = () => {
  isHovered.value = false
}

const handleFocus = () => {
  isFocused.value = true
}

const handleBlur = () => {
  isFocused.value = false
}

// Animation frame optimization for smooth interactions
const smoothStateTransition = (callback: () => void) => {
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
  }

  animationFrameId.value = requestAnimationFrame(() => {
    callback()
    animationFrameId.value = undefined
  })
}

// Lifecycle management
onMounted(() => {
  // Pre-compute animation frames for better performance
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Second RAF ensures browser paint completion
    })
  })
})

onUnmounted(() => {
  if (animationFrameId.value) {
    cancelAnimationFrame(animationFrameId.value)
  }
})
</script>

<style scoped>
/* Core container with responsive design */
.done-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

/* Premium glass morphism button with advanced interactions */
.done-toggle__button {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-md);
  /* Multi-layer glass morphism with depth */
  background:
    linear-gradient(135deg,
      rgba(255, 255, 255, 0.3) 0%,
      rgba(255, 255, 255, 0.4) 50%,
      rgba(255, 255, 255, 0.2) 100%
    ),
    radial-gradient(circle at 30% 30%,
      rgba(255, 255, 255, 0.2) 0%,
      transparent 70%
    );
  backdrop-filter: blur(16px) saturate(1.8);
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  position: relative;
  overflow: visible;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  user-select: none;
  /* Advanced GPU acceleration */
  transform: translateZ(0);
  will-change: transform, box-shadow, background, border-color;
}

/* Sophisticated hover state with enhanced glass effect */
.done-toggle__button:hover {
  transform: translateY(-2px) translateZ(0);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.18),
    0 4px 16px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(59, 130, 246, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  border-color: rgba(59, 130, 246, 0.9);
  /* Enhanced hover glass with color infusion */
  background:
    linear-gradient(135deg,
      rgba(255, 255, 255, 0.4) 0%,
      rgba(59, 130, 246, 0.2) 50%,
      rgba(255, 255, 255, 0.3) 100%
    ),
    radial-gradient(circle at 70% 70%,
      rgba(59, 130, 246, 0.15) 0%,
      transparent 70%
    );
}

/* Active state with sophisticated feedback */
.done-toggle__button:active {
  transform: translateY(0) scale(0.96) translateZ(0);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.16),
    0 2px 8px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

/* Premium completed state with enhanced visual hierarchy */
.done-toggle__button--completed {
  /* Rich gradient glass morphism for completed state */
  background:
    linear-gradient(135deg,
      rgba(34, 197, 94, 0.9) 0%,
      rgba(22, 163, 74, 0.95) 50%,
      rgba(16, 185, 129, 0.9) 100%
    ),
    radial-gradient(circle at 30% 30%,
      rgba(255, 255, 255, 0.3) 0%,
      transparent 70%
    );
  border-color: rgba(34, 197, 94, 1);
  color: white;
  backdrop-filter: blur(20px) saturate(2.0);
  box-shadow:
    0 12px 40px rgba(34, 197, 94, 0.5),
    0 4px 16px rgba(34, 197, 94, 0.3),
    0 0 0 1px rgba(34, 197, 94, 0.8),
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
}

.done-toggle__button--completed:hover {
  background:
    linear-gradient(135deg,
      rgba(22, 163, 74, 0.95) 0%,
      rgba(16, 185, 129, 1) 50%,
      rgba(5, 150, 105, 0.95) 100%
    ),
    radial-gradient(circle at 70% 70%,
      rgba(255, 255, 255, 0.4) 0%,
      transparent 70%
    );
  border-color: rgba(22, 163, 74, 1);
  box-shadow:
    0 20px 64px rgba(34, 197, 94, 0.6),
    0 8px 24px rgba(34, 197, 94, 0.4),
    0 0 0 2px rgba(34, 197, 94, 0.9),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  transform: translateY(-2px) translateZ(0);
}

/* Disabled state with reduced visual weight */
.done-toggle__button--disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
  transform: none !important;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.08),
    0 1px 4px rgba(0, 0, 0, 0.06);
}

/* Enhanced focus visibility with WCAG AA compliance */
.done-toggle__button:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
  /* Enhanced background for better focus visibility */
  background-color: rgba(59, 130, 246, 0.2);
  box-shadow:
    0 0 0 4px rgba(59, 130, 246, 0.2),
    0 8px 32px rgba(0, 0, 0, 0.16),
    0 2px 8px rgba(0, 0, 0, 0.12);
}

/* Content container with z-index management */
.done-toggle__content {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.done-toggle__content--celebrating {
  transform: scale(1.1);
}

/* Enhanced check icon with celebration effects */
.done-toggle__check {
  color: white;
  position: relative;
  z-index: 2;
  animation: scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.done-toggle__check--celebrating {
  animation: celebrateCheck 2s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* Sophisticated circle system with multiple layers */
.done-toggle__circle {
  color: rgba(255, 255, 255, 0.9);
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  transform: translateZ(0);
}

.done-toggle__circle--hover,
.done-toggle__circle--focus {
  color: rgba(59, 130, 246, 0.95);
  transform: scale(1.1) translateZ(0);
}

/* Circle inner decoration */
.done-toggle__circle-inner {
  position: absolute;
  inset: -4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.done-toggle__button:hover .done-toggle__circle-inner {
  opacity: 1;
}

/* Circle glow effect */
.done-toggle__circle-glow {
  position: absolute;
  inset: -8px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.done-toggle__circle:hover .done-toggle__circle-glow {
  opacity: 1;
}

/* Circle pulse animation */
.done-toggle__circle-pulse {
  position: absolute;
  inset: -12px;
  border: 2px solid rgba(59, 130, 246, 0.4);
  border-radius: 50%;
  opacity: 0;
  animation: circlePulse 2s ease-in-out infinite;
}

/* Check enhancement effects */
.done-toggle__check-glow {
  position: absolute;
  inset: -6px;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.4) 0%, transparent 70%);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.done-toggle__check:hover .done-toggle__check-glow {
  opacity: 1;
}

.done-toggle__check-sparkle {
  position: absolute;
  top: -4px;
  inset-inline-end: -4px; /* RTL: check sparkle position */
  width: 4px;
  height: 4px;
  background: white;
  border-radius: 50%;
  opacity: 0;
  animation: sparkle 3s ease-in-out infinite;
}

/* Advanced ripple system with enhanced effects */
.done-toggle__ripple {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(34, 197, 94, 0.7) 0%,
    rgba(34, 197, 94, 0.4) 40%,
    transparent 70%
  );
  opacity: 0.6;
  transform: translate(-50%, -50%) scale(0) translateZ(0);
  animation: rippleExpand 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  z-index: 1;
  pointer-events: none;
  will-change: transform, opacity;
}

.done-toggle__ripple--active {
  animation: rippleExpand 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* Visual feedback layers */
.done-toggle__glow-layer {
  position: absolute;
  inset: -2px;
  background: radial-gradient(circle,
    rgba(59, 130, 246, 0.1) 0%,
    transparent 60%
  );
  border-radius: var(--radius-md);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 0;
}

.done-toggle__button:hover .done-toggle__glow-layer {
  opacity: 1;
}

.done-toggle__shine-layer {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.3) 0%,
    transparent 50%,
    rgba(255, 255, 255, 0.1) 100%
  );
  border-radius: var(--radius-md);
  opacity: 0.6;
  z-index: 1;
  pointer-events: none;
}

.done-toggle__particle-layer {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  z-index: 3;
  pointer-events: none;
}

/* Size variants with responsive scaling */
.done-toggle__button--sm {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border-width: 1.5px;
}

.done-toggle__button--lg {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  border-width: 2.5px;
}

.done-toggle__button--md {
  width: 32px;
  height: 32px;
}

/* Enhanced variant styles with sophisticated glass morphism */
.done-toggle__button--subtle {
  background:
    linear-gradient(135deg,
      rgba(255, 255, 255, 0.2) 0%,
      rgba(255, 255, 255, 0.25) 50%,
      rgba(255, 255, 255, 0.15) 100%
    );
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow:
    0 6px 24px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px) saturate(1.5);
}

.done-toggle__button--subtle:hover {
  background:
    linear-gradient(135deg,
      rgba(255, 255, 255, 0.3) 0%,
      rgba(255, 255, 255, 0.35) 50%,
      rgba(255, 255, 255, 0.25) 100%
    );
  box-shadow:
    0 10px 32px rgba(0, 0, 0, 0.12),
    0 4px 16px rgba(0, 0, 0, 0.08);
}

.done-toggle__button--prominent {
  background:
    linear-gradient(135deg,
      rgba(59, 130, 246, 0.95) 0%,
      rgba(37, 99, 235, 1) 50%,
      rgba(29, 78, 216, 0.95) 100%
    ),
    radial-gradient(circle at 30% 30%,
      rgba(255, 255, 255, 0.2) 0%,
      transparent 70%
    );
  border-color: rgba(59, 130, 246, 1);
  color: white;
  box-shadow:
    0 12px 40px rgba(59, 130, 246, 0.5),
    0 4px 16px rgba(59, 130, 246, 0.3),
    0 0 0 1px rgba(59, 130, 246, 0.8),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(18px) saturate(2.0);
}

.done-toggle__button--prominent:hover {
  background:
    linear-gradient(135deg,
      rgba(37, 99, 235, 1) 0%,
      rgba(29, 78, 216, 1) 50%,
      rgba(30, 64, 175, 1) 100%
    ),
    radial-gradient(circle at 70% 70%,
      rgba(255, 255, 255, 0.3) 0%,
      transparent 70%
    );
  box-shadow:
    0 20px 64px rgba(59, 130, 246, 0.6),
    0 8px 24px rgba(59, 130, 246, 0.4),
    0 0 0 2px rgba(59, 130, 246, 0.9);
}

.done-toggle__button--prominent .done-toggle__circle {
  color: rgba(255, 255, 255, 0.95);
}

/* Minimal variant - simple circular checkbox matching reference design */
.done-toggle__button--minimal {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--border-medium);
  background: var(--surface-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: none;
  backdrop-filter: none;
  transform: none;
}

.done-toggle__button--minimal:hover {
  border-color: var(--color-primary);
  background: var(--surface-primary);
  box-shadow: none;
  transform: none;
}

.done-toggle__button--minimal:active {
  transform: scale(0.95);
  box-shadow: none;
}

.done-toggle__button--minimal.done-toggle__button--completed {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
  box-shadow: none;
}

.done-toggle__button--minimal.done-toggle__button--completed:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.done-toggle__button--minimal .done-toggle__check {
  color: white;
  animation: none;
}

.done-toggle__button--minimal .done-toggle__circle {
  display: none;
}

.done-toggle__button--minimal .done-toggle__glow-layer,
.done-toggle__button--minimal .done-toggle__shine-layer,
.done-toggle__button--minimal .done-toggle__particle-layer,
.done-toggle__button--minimal .done-toggle__ripple,
.done-toggle__button--minimal .done-toggle__check-glow,
.done-toggle__button--minimal .done-toggle__check-sparkle {
  display: none;
}

.done-toggle__button--minimal .done-toggle__content {
  transform: none;
}

.done-toggle__button--minimal:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  box-shadow: none;
}

/* Touch feedback overlay */
.done-toggle__touch-feedback {
  position: absolute;
  inset: 0;
  background: rgba(59, 130, 246, 0.2);
  border-radius: inherit;
  opacity: 0;
  animation: touchFeedback 0.15s ease-out;
  z-index: 4;
  pointer-events: none;
}

/* Floating hints system */
.done-toggle__hints {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  white-space: nowrap;
  z-index: 10;
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.done-toggle__hints--visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.done-toggle__hints--sm {
  font-size: 11px;
  padding: 4px 8px;
}

.done-toggle__hints--lg {
  font-size: 14px;
  padding: 8px 16px;
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.hint-item:last-child {
  margin-bottom: 0;
}

.hint-icon {
  opacity: 0.8;
}

.hint-text {
  opacity: 0.9;
}

.hint-item kbd {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 10px;
  margin-inline-end: 4px; /* RTL: kbd hint spacing */
}

/* Progress indicator */
.done-toggle__progress {
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  height: 3px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
  overflow: hidden;
  z-index: 5;
}

.done-toggle__progress--sm {
  width: 70%;
  height: 2px;
}

.done-toggle__progress--lg {
  width: 90%;
  height: 4px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-success) 100%);
  border-radius: 2px;
  transition: width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.progress-label {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
}

/* Celebration effects */
.done-toggle__celebration {
  position: absolute;
  inset: -20px;
  pointer-events: none;
  z-index: 6;
}

.celebration-particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 4px;
  background: var(--color-success);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: celebrateParticle var(--duration-long) ease-out forwards;
  animation-delay: var(--delay);
}

/* Sophisticated animations with GPU acceleration */
@keyframes scaleIn {
  0% {
    transform: scale(0) translateZ(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.3) translateZ(0);
  }
  100% {
    transform: scale(1) translateZ(0);
    opacity: 1;
  }
}

@keyframes celebrateCheck {
  0%, 100% {
    transform: scale(1) translateZ(0);
  }
  25% {
    transform: scale(1.2) translateZ(0);
  }
  50% {
    transform: scale(0.9) translateZ(0);
  }
  75% {
    transform: scale(1.1) translateZ(0);
  }
}

@keyframes rippleExpand {
  0% {
    transform: translate(-50%, -50%) scale(0) translateZ(0);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(3) translateZ(0);
    opacity: 0;
  }
}

@keyframes circlePulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.4;
  }
}

@keyframes sparkle {
  0%, 100% {
    opacity: 0;
    transform: scale(0);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes celebrateParticle {
  0% {
    transform:
      translate(-50%, -50%)
      scale(0)
      rotate(0deg)
      translateX(0);
    opacity: 1;
  }
  100% {
    transform:
      translate(-50%, -50%)
      scale(var(--scale))
      rotate(360deg)
      translateX(var(--distance));
    opacity: 0;
  }
}

@keyframes touchFeedback {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Transition animations */
.celebration-fade-enter-active,
.celebration-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.celebration-fade-enter-from,
.celebration-fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.hints-fade-enter-active,
.hints-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.hints-fade-enter-from,
.hints-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

/* Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Accessibility and reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .done-toggle__button {
    transition-duration: 0.001ms;
    transform: none;
    will-change: auto;
  }

  .done-toggle__check,
  .done-toggle__ripple,
  .done-toggle__circle-pulse,
  .done-toggle__check-sparkle {
    animation: none;
  }

  .celebration-particle {
    animation: none;
  }

  .done-toggle__content {
    transform: none;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .done-toggle__button {
    background: rgba(255, 255, 255, 0.95) !important;
    border: 2px solid #000 !important;
    color: #000 !important;
  }

  .done-toggle__button:focus-visible {
    outline: 3px solid #000;
    outline-offset: 3px;
  }

  .done-toggle__button--completed {
    background: #000 !important;
    color: #fff !important;
    border-color: #000 !important;
  }

  .done-toggle__hints {
    background: #000 !important;
    color: #fff !important;
    border: 1px solid #fff;
  }
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .done-toggle__button {
    min-height: 44px; /* iOS touch target */
    min-width: 44px;
  }

  .done-toggle__hints {
    font-size: 13px; /* Larger text on mobile */
  }

  .done-toggle__touch-feedback {
    display: block; /* Ensure touch feedback is visible */
  }
}

/* Advanced custom properties for sophisticated theming */
:root {
  --done-spring-smooth: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --done-spring-bouncy: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --done-transition-duration: 0.3s;
  --done-ripple-duration: 0.8s;
  --done-celebration-duration: 2s;
  --done-focus-outline: 3px;
  --done-focus-offset: 3px;
  --done-glass-blur-light: blur(10px);
  --done-glass-blur-medium: blur(16px);
  --done-glass-blur-heavy: blur(20px);
  --done-saturation-light: saturate(1.5);
  --done-saturation-medium: saturate(1.8);
  --done-saturation-heavy: saturate(2.0);
}
</style>