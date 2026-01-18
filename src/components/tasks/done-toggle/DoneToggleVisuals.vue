<template>
  <!-- Simple variant - minimal rounded square checkbox -->
  <button
    v-if="variant === 'simple'"
    class="done-toggle--simple"
    :class="{ 'done-toggle--simple-checked': isCompleted }"
    :disabled="disabled"
    :title="enhancedTitle"
    :aria-label="enhancedAriaLabel"
    type="button"
    role="switch"
    :aria-checked="isCompleted ? 'true' : 'false'"
    @click="$emit('click', $event)"
    @keydown.enter="$emit('keydown', $event)"
    @keydown.space.prevent="$emit('keydown', $event)"
  >
    <Check v-if="isCompleted" :size="12" class="done-toggle--simple-icon" />
  </button>

  <!-- Original fancy button (for default, subtle, prominent, minimal variants) -->
  <button
    v-else
    :class="buttonClasses"
    :disabled="disabled"
    :title="enhancedTitle"
    :aria-label="enhancedAriaLabel"
    type="button"
    role="switch"
    :aria-checked="isCompleted ? 'true' : 'false'"
    @click="$emit('click', $event)"
    @keydown.enter="$emit('keydown', $event)"
    @keydown.space.prevent="$emit('keydown', $event)"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @focus="isFocused = true"
    @blur="isFocused = false"
    @touchstart="$emit('touchstart', $event)"
    @touchend="$emit('touchend', $event)"
  >
    <div class="done-toggle__content" :class="contentClasses">
      <!-- Enhanced icon system with sophisticated animations -->
      <div class="done-toggle__icon-container">
        <!-- Premium check icon when completed -->
        <div v-if="isCompleted" class="done-toggle__check" :class="checkClasses">
          <Check :size="iconSize" />
          <div class="done-toggle__check-glow" />
          <div class="done-toggle__check-sparkle" />
        </div>

        <!-- Enhanced circle system when not completed -->
        <div v-else class="done-toggle__circle" :class="circleClasses">
          <div class="done-toggle__circle-inner" />
          <div class="done-toggle__circle-glow" />
          <div class="done-toggle__circle-pulse" />
        </div>
      </div>

      <!-- Advanced ripple effect system -->
      <div
        v-for="ripple in ripples"
        :key="ripple.id"
        class="done-toggle__ripple"
        :class="getRippleClasses(ripple)"
        :style="getRippleStyle(ripple)"
      />

      <!-- Enhanced visual feedback layers -->
      <div class="done-toggle__glow-layer" />
      <div class="done-toggle__shine-layer" />
      <div class="done-toggle__particle-layer" />

      <!-- Completion celebration effects -->
      <transition name="celebration-fade" appear>
        <div v-if="showCelebration && isCompleted" class="done-toggle__celebration">
          <div
            v-for="n in celebrationParticles"
            :key="n"
            class="celebration-particle"
            :style="getCelebrationStyle(n)"
          />
        </div>
      </transition>
    </div>

    <!-- Touch feedback overlay -->
    <div v-if="showTouchFeedback" class="done-toggle__touch-feedback" />
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

  <!-- Progress border around the checkbox -->
  <div
    v-if="showProgress && progressPercentage > 0 && progressPercentage < 100"
    class="done-toggle__progress-wrapper"
    :class="progressClasses"
    :style="{ '--progress': progressPercentage + '%' }"
  >
    <div class="done-toggle__progress-bg" />
    <div class="done-toggle__progress-fill" />
  </div>

  <!-- Status announcement for screen readers -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {{ completionStatusText }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check } from 'lucide-vue-next'
import type { Ripple } from '@/composables/ui/done-toggle/useDoneToggleInteraction'

const props = defineProps<{
  // State from Parent/Composable
  isCompleted: boolean
  disabled: boolean
  ripples: Ripple[]
  showCelebration: boolean
  showTouchFeedback: boolean
  
  // UI Props
  size: 'sm' | 'md' | 'lg'
  variant: 'default' | 'subtle' | 'prominent' | 'minimal' | 'simple'
  title: string
  ariaLabel: string
  showHints: boolean
  showProgress: boolean
  progressPercentage: number
  celebrationParticles: number
  
  // Local interaction state binding
  isHovered: boolean
  isFocused: boolean
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
  (e: 'keydown', event: KeyboardEvent): void
  (e: 'touchstart', event: TouchEvent): void
  (e: 'touchend', event: TouchEvent): void
  (e: 'update:isHovered', val: boolean): void
  (e: 'update:isFocused', val: boolean): void
}>()

// Local state tracking for v-model compat
const isHovered = computed({
  get: () => props.isHovered,
  set: (val) => emit('update:isHovered', val)
})

const isFocused = computed({
  get: () => props.isFocused,
  set: (val) => emit('update:isFocused', val)
})

// --- Computed Visual Classes & Styles ---

const buttonClasses = computed(() => [
  'done-toggle__button',
  `done-toggle__button--${props.size}`,
  `done-toggle__button--${props.variant}`,
  {
    'done-toggle__button--completed': props.isCompleted,
    'done-toggle__button--disabled': props.disabled,
    'done-toggle__button--hovered': isHovered.value,
    'done-toggle__button--focused': isFocused.value
  }
])

const contentClasses = computed(() => [
  'done-toggle__content',
  {
    'done-toggle__content--celebrating': props.showCelebration
  }
])

const checkClasses = computed(() => [
  'done-toggle__check',
  {
    'done-toggle__check--celebrating': props.showCelebration
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
  `done-toggle__progress-wrapper--${props.size}`,
  {
    'done-toggle__progress-wrapper--completed': props.isCompleted
  }
])

// --- Helper Functions ---

const enhancedTitle = computed(() => {
  if (props.isCompleted) return 'Task completed - Click to mark as incomplete'
  return props.title || 'Mark task as done'
})

const enhancedAriaLabel = computed(() => {
  if (props.isCompleted) return 'Task completed, click to undo'
  return props.ariaLabel || 'Mark task as complete'
})

const completionStatusText = computed(() => {
  return props.isCompleted ? 'Task completed' : 'Task not completed'
})

const showKeyboardShortcuts = computed(() => props.size !== 'sm')

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm': return 12
    case 'lg': return 20
    default: return 16
  }
})

const getRippleClasses = (ripple: Ripple) => [
  ripple.id === props.ripples[props.ripples.length - 1]?.id ? 'done-toggle__ripple--active' : ''
]

const getRippleStyle = (ripple: Ripple) => ({
  left: `${ripple.x}%`,
  top: `${ripple.y}%`,
  transform: 'translate(-50%, -50%)'
})

const getCelebrationStyle = (index: number) => {
  const angle = (index / props.celebrationParticles) * 360
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
</script>

<style scoped>
/* Core container with responsive design */
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
  transition: all var(--duration-slower) cubic-bezier(0.25, 0.46, 0.45, 0.94);
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
  transition: transform var(--duration-slow) cubic-bezier(0.4, 0, 0.2, 1);
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
  transition: all var(--duration-slow) cubic-bezier(0.25, 0.46, 0.45, 0.94);
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
  border: 1px solid var(--border-hover);
  border-radius: 50%;
  opacity: 0;
  transition: opacity var(--duration-slow) var(--ease-out);
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
  transition: opacity var(--duration-slow) var(--ease-out);
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
  transition: opacity var(--duration-slow) var(--ease-out);
  z-index: -1;
}

.done-toggle__check:hover .done-toggle__check-glow {
  opacity: 1;
}

.done-toggle__check-sparkle {
  position: absolute;
  top: -var(--space-1);
  inset-inline-end: -4px; /* RTL: check sparkle position */
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.8);
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
  transition: opacity var(--duration-slow) var(--ease-out);
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

/* Touch feedback overlay */
.done-toggle__touch-feedback {
  position: absolute;
  inset: -8px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: inherit;
  pointer-events: none;
  opacity: 0.6;
}

/* Floating hints */
.done-toggle__hints {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  background: rgba(0, 0, 0, 0.9);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  pointer-events: none;
  opacity: 0;
  transition: all var(--duration-normal) var(--ease-out);
  z-index: 100;
  min-width: 120px;
}

.done-toggle__hints--visible {
  opacity: 1;
  transform: translateX(-50%) translateY(14px);
}

.hint-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.9);
}

.hint-icon {
  width: 14px;
  text-align: center;
}

kbd {
  background: var(--border-hover);
  padding: 1px var(--space-1);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: var(--text-xs);
}

/* Progress Border Styles */
.done-toggle__progress-wrapper {
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
}

.done-toggle__progress-bg {
  position: absolute;
  inset: 0;
  border: 1px solid var(--glass-border);
  border-radius: inherit;
}

.done-toggle__progress-fill {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(34, 197, 94, 0.6);
  border-radius: inherit;
  clip-path: inset(0 calc(100% - var(--progress)) 0 0);
  transition: clip-path var(--duration-slow) var(--ease-out);
}

/* Animations */
@keyframes scaleIn {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes celebrateCheck {
  0% { transform: scale(1); }
  30% { transform: scale(1.4) rotate(10deg); }
  60% { transform: scale(0.9) rotate(-10deg); }
  100% { transform: scale(1); }
}

@keyframes circlePulse {
  0% { transform: scale(0.9); opacity: 0.5; }
  50% { transform: scale(1.1); opacity: 0.2; }
  100% { transform: scale(0.9); opacity: 0.5; }
}

@keyframes sparkle {
  0%, 100% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1); opacity: 1; }
}

@keyframes rippleExpand {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0.6; }
  100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
}

.celebration-fade-enter-active,
.celebration-fade-leave-active {
  transition: opacity var(--duration-slower) var(--ease-out);
}

.celebration-fade-enter-from,
.celebration-fade-leave-to {
  opacity: 0;
}

.hints-fade-enter-active,
.hints-fade-leave-active {
  transition: opacity var(--duration-normal) var(--var(--ease-out)-out), transform var(--duration-normal) ease;
}

.hints-fade-enter-from,
.hints-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

.celebration-particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 4px;
  background: var(--color-primary); /* Fallback */
  border-radius: 50%;
  pointer-events: none;
  animation: particleBurst 1s ease-out forwards;
  animation-delay: var(--delay);
  transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0) scale(0);
}

@keyframes particleBurst {
  0% {
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0) scale(0);
    opacity: 1;
    background: #34d399;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) rotate(var(--angle)) translateY(var(--distance)) scale(var(--scale));
    opacity: 0;
    background: var(--color-blue);
  }
}

/* Utilities */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* ==========================================
   SIMPLE VARIANT - Minimal rounded square
   ========================================== */
.done-toggle--simple {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--glass-border);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--ease-out);
  padding: 0;
}

.done-toggle--simple:hover {
  border-color: var(--brand-primary);
  background: var(--brand-bg-subtle);
}

.done-toggle--simple:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
}

.done-toggle--simple:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.done-toggle--simple-checked {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

.done-toggle--simple-checked:hover {
  background: var(--brand-primary-dark, #3ab8a8);
  border-color: var(--brand-primary-dark, #3ab8a8);
}

.done-toggle--simple-icon {
  color: white;
}
</style>
