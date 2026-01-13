<template>
  <div
    class="drag-handle"
    :class="dragHandleClasses"
    role="button"
    tabindex="0"
    :aria-disabled="disabled"
    @mousedown="$emit('mouse-down', $event)"
    @touchstart="$emit('touch-start', $event)"
    @mouseenter="$emit('hover-start')"
    @mouseleave="$emit('hover-end')"
    @keydown.enter="$emit('keydown', $event)"
    @keydown.space.prevent="$emit('keydown', $event)"
    @keydown.esc="$emit('keydown', $event)"
    @keydown.up.prevent="$emit('arrow-key', 'up')"
    @keydown.down.prevent="$emit('arrow-key', 'down')"
    @keydown.left.prevent="$emit('arrow-key', 'left')"
    @keydown.right.prevent="$emit('arrow-key', 'right')"
    @focus="$emit('focus')"
    @blur="$emit('blur')"
  >
    <!-- Screen reader status announcement -->
    <slot name="sr-status" />

    <!-- Enhanced touch area with visual feedback layers -->
    <div class="drag-handle__touch-area" :class="touchAreaClasses" aria-hidden="true">
      <!-- Multi-layer grip system with advanced visual feedback -->
      <div class="drag-handle__grip" :class="gripClasses">
        <!-- Enhanced dot pattern with sophisticated animations -->
        <div class="drag-handle__dots" :class="dotsClasses">
          <div
            v-for="(dot, index) in dots"
            :key="index"
            class="drag-handle__dot"
            :class="getDotClasses(index)"
            :style="getDotStyle(index)"
          />
        </div>

        <!-- Enhanced visual feedback layers -->
        <div class="drag-handle__glow-layer" />
        <div class="drag-handle__pulse-layer" />
        <div class="drag-handle__trail-layer" />
      </div>

      <!-- Advanced drag indicators -->
      <div class="drag-handle__indicators" :class="indicatorClasses">
        <div class="drag-handle__indicator drag-handle__indicator--horizontal" />
        <div class="drag-handle__indicator drag-handle__indicator--vertical" />
        <div class="drag-handle__indicator drag-handle__indicator--diagonal" />
      </div>

      <!-- Touch feedback overlay -->
      <div v-if="showTouchFeedback" class="drag-handle__touch-feedback" />
    </div>

    <!-- Slots for Tooltips/Ghosts -->
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  size: 'sm' | 'md' | 'lg'
  disabled: boolean
  isDragging: boolean
  isHovered: boolean
  isFocused: boolean
  showTouchFeedback: boolean
  showKeyboardNavigation: boolean
}>()

defineEmits<{
  (e: 'mouse-down', event: MouseEvent): void
  (e: 'touch-start', event: TouchEvent): void
  (e: 'hover-start'): void
  (e: 'hover-end'): void
  (e: 'keydown', event: KeyboardEvent): void
  (e: 'arrow-key', direction: 'up' | 'down' | 'left' | 'right'): void
  (e: 'focus'): void
  (e: 'blur'): void
}>()

// --- Visual Logic (Moved from main component) ---

const dots = computed(() => {
  const dotCount = props.size === 'sm' ? 4 : props.size === 'lg' ? 8 : 6
  return Array.from({ length: dotCount }, (_, i) => ({
    index: i,
    delay: i * 50,
    intensity: 0.5 + (i / dotCount) * 0.5
  }))
})

const dragHandleClasses = computed(() => [
  'drag-handle',
  `drag-handle--${props.size}`,
  {
    'drag-handle--disabled': props.disabled,
    'drag-handle--dragging': props.isDragging,
    'drag-handle--hovered': props.isHovered,
    'drag-handle--focused': props.isFocused,
    'drag-handle--touch-feedback': props.showTouchFeedback,
    'drag-handle--keyboard-enabled': props.showKeyboardNavigation
  }
])

const touchAreaClasses = computed(() => [
  'drag-handle__touch-area',
  `drag-handle__touch-area--${props.size}`,
  {
    'drag-handle__touch-area--active': props.isDragging,
    'drag-handle__touch-area--hovered': props.isHovered
  }
])

const gripClasses = computed(() => [
  'drag-handle__grip',
  `drag-handle__grip--${props.size}`,
  {
    'drag-handle__grip--animating': props.isDragging,
    'drag-handle__grip--pulsing': props.isHovered && !props.isDragging
  }
])

const dotsClasses = computed(() => [
  'drag-handle__dots',
  `drag-handle__dots--${props.size}`,
  {
    'drag-handle__dots--dragging': props.isDragging,
    'drag-handle__dots--hovered': props.isHovered && !props.isDragging
  }
])

const indicatorClasses = computed(() => [
  'drag-handle__indicators',
  `drag-handle__indicators--${props.size}`,
  {
    'drag-handle__indicators--visible': props.isDragging,
    'drag-handle__indicators--animated': true
  }
])

const getDotClasses = (index: number) => [
  'drag-handle__dot',
  `drag-handle__dot--${index}`,
  {
    'drag-handle__dot--dragging': props.isDragging,
    'drag-handle__dot--delayed': true
  }
]

const getDotStyle = (index: number) => ({
  animationDelay: `${index * 50}ms`,
  '--dot-intensity': dots.value[index].intensity,
  '--dot-delay': `${index * 50}ms`
})
</script>

<style scoped>
/* ==========================================================================
   Advanced Drag Handle Component
   Professional Glass Morphism with Sophisticated Animations
   ========================================================================== */

/* Enhanced CSS Custom Properties with Comprehensive Design System */
.drag-handle {
  /* Animation Timing Functions */
  --spring-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --spring-bouncy: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --spring-gentle: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-in-out-expo: cubic-bezier(0.85, 0, 0.15, 1);

  /* Glass Morphism Layers */
  --glass-bg-soft: rgba(255, 255, 255, 0.06);
  --glass-bg-light: rgba(255, 255, 255, 0.10);
  --glass-bg-medium: rgba(255, 255, 255, 0.14);
  --glass-bg-strong: rgba(255, 255, 255, 0.20);
  --glass-border-subtle: rgba(255, 255, 255, 0.12);
  --glass-border-medium: rgba(255, 255, 255, 0.20);
  --glass-border-strong: rgba(255, 255, 255, 0.28);

  /* Color System */
  --primary-rgb: 59, 130, 246;
  --primary-light-rgb: 147, 197, 253;
  --accent-rgb: 99, 102, 241;
  --success-rgb: 34, 197, 94;

  /* State Colors */
  --state-dragging: rgba(var(--primary-rgb), 0.9);
  --state-hover: rgba(var(--primary-rgb), 0.15);
  --state-focus: rgba(var(--primary-rgb), 0.12);
  --state-active: rgba(var(--accent-rgb), 0.2);

  /* Blur Values */
  --blur-light: blur(6px);
  --blur-medium: blur(10px);
  --blur-strong: blur(14px);

  /* Shadows */
  --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-medium: 0 4px 16px rgba(0, 0, 0, 0.10);
  --shadow-strong: 0 8px 32px rgba(0, 0, 0, 0.14);
  --shadow-glow: 0 0 20px rgba(var(--primary-rgb), 0.25);
  --shadow-glow-strong: 0 0 32px rgba(var(--primary-rgb), 0.35);

  /* Transitions */
  --transition-fast: 0.12s;
  --transition-normal: 0.25s;
  --transition-slow: 0.4s;

  /* Border Radius */
  --radius-xs: 3px;
  --radius-sm: 5px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

/* Main Container */
.drag-handle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;

  /* Multi-layer glass morphism background */
  background:
    linear-gradient(135deg, var(--glass-bg-strong) 0%, var(--glass-bg-medium) 100%),
    linear-gradient(225deg, var(--glass-bg-light) 0%, var(--glass-bg-soft) 100%);

  /* Enhanced border system */
  border: 1px solid var(--glass-border-medium);
  border-radius: var(--radius-md);

  /* Advanced shadow system */
  box-shadow:
    var(--shadow-soft),
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 0 rgba(0, 0, 0, 0.08);

  /* Sophisticated backdrop effects */
  backdrop-filter: var(--blur-medium);
  -webkit-backdrop-filter: var(--blur-medium);

  /* Interaction properties */
  cursor: grab;
  user-select: none;
  touch-action: none;
  outline: none;
  transition: all var(--transition-normal) var(--spring-smooth);
  will-change: transform, box-shadow, border-color, background;
  z-index: 10;
}

/* Size Variants */
.drag-handle--sm {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
}

.drag-handle--lg {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-lg);
}

/* State: Hover */
.drag-handle:hover,
.drag-handle--hovered {
  transform: translateY(-2px) scale(1.02);
  background:
    linear-gradient(135deg, var(--glass-bg-strong) 0%, var(--glass-bg-medium) 100%),
    linear-gradient(225deg, var(--state-hover) 0%, var(--glass-bg-soft) 100%);
  border-color: var(--glass-border-strong);
  box-shadow:
    var(--shadow-medium),
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    inset 0 -1px 0 rgba(0, 0, 0, 0.05);
  cursor: grab;
}

/* State: Active / Dragging */
.drag-handle:active,
.drag-handle--dragging {
  transform: scale(0.95);
  background:
    linear-gradient(135deg, var(--glass-bg-medium) 0%, var(--state-active) 100%);
  border-color: rgba(var(--primary-rgb), 0.5);
  box-shadow:
    var(--shadow-soft),
    var(--shadow-glow),
    inset 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: grabbing;
  z-index: 100;
}

/* State: Focused (Keyboard) */
.drag-handle:focus-visible,
.drag-handle--focused {
  outline: none;
  border-color: rgba(var(--primary-rgb), 0.8);
  box-shadow:
    var(--shadow-medium),
    0 0 0 3px rgba(var(--primary-rgb), 0.3);
  transform: translateY(-1px);
}

/* State: Disabled */
.drag-handle--disabled {
  opacity: 0.5;
  pointer-events: none;
  filter: grayscale(100%);
  box-shadow: none;
  background: var(--glass-bg-soft);
}

/* Touch Area Overlay */
.drag-handle__touch-area {
  position: absolute;
  top: -10px;
  left: -10px;
  right: -10px;
  bottom: -10px;
  z-index: -1;
  border-radius: inherit;
  transition: background-color var(--transition-fast) ease;
}

.drag-handle__touch-area--active {
  background-color: rgba(var(--primary-rgb), 0.05);
}

/* Grip Container */
.drag-handle__grip {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 4px;
  gap: 4px;
  transition: transform var(--transition-normal) var(--spring-bouncy);
}

.drag-handle__grip--animating {
  transform: scale(0.9);
}

/* Dots Pattern */
.drag-handle__dots {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  width: 100%;
  height: 100%;
  transition: transform var(--transition-normal) var(--spring-smooth);
}

.drag-handle__dots--sm {
  gap: 3px;
}

.drag-handle__dots--lg {
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
}

.drag-handle__dots--hovered {
  transform: scale(1.1);
}

/* Individual Dot */
.drag-handle__dot {
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition:
    background-color var(--transition-normal) ease,
    transform var(--transition-normal) var(--spring-bouncy),
    box-shadow var(--transition-normal) ease;
}

.drag-handle__dot--dragging {
  background: rgb(var(--primary-light-rgb));
  box-shadow: 0 0 4px rgba(var(--primary-rgb), 0.6);
  transform: scale(1.2);
  animation: dot-pulse 1.5s infinite var(--spring-gentle);
}

.drag-handle:hover .drag-handle__dot {
  background: rgb(255, 255, 255);
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
}

/* Glow Layer */
.drag-handle__glow-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    circle,
    rgba(var(--primary-rgb), 0.4) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity var(--transition-fast) ease;
  pointer-events: none;
  filter: blur(8px);
}

.drag-handle--dragging .drag-handle__glow-layer {
  opacity: 1;
  animation: glow-pulse 2s infinite ease-in-out;
}

/* Pulse Layer */
.drag-handle__pulse-layer {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 2px solid rgba(var(--primary-rgb), 0.5);
  opacity: 0;
  pointer-events: none;
}

.drag-handle__grip--pulsing .drag-handle__pulse-layer {
  animation: ripple 1.5s infinite cubic-bezier(0, 0.2, 0.8, 1);
}

/* Indicators */
.drag-handle__indicators {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--transition-fast) ease;
}

.drag-handle__indicators--visible {
  opacity: 1;
}

.drag-handle__indicator {
  position: absolute;
  background: rgba(var(--primary-rgb), 0.3);
  border-radius: 99px;
  display: none; /* Hidden by default, simpler visual preferred for now */
}

/* Animations */
@keyframes dot-pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.4); opacity: 1; box-shadow: 0 0 8px rgba(var(--primary-rgb), 0.8); }
}

@keyframes glow-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
  50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.5; }
}

@keyframes ripple {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}
</style>
