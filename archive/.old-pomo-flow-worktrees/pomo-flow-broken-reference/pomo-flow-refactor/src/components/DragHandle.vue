<template>
  <div
    class="drag-handle"
    :class="dragHandleClasses"
    @mousedown="handleMouseDown"
    @touchstart="handleTouchStart"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    :title="enhancedTitle"
    role="button"
    tabindex="0"
    :aria-label="enhancedAriaLabel"
    :aria-disabled="disabled"
    :aria-describedby="isDragging ? 'drag-status' : undefined"
    @keydown.enter="handleKeyDown"
    @keydown.space.prevent="handleKeyDown"
    @keydown.esc="handleEscape"
    @keydown.arrowup.prevent="handleArrowKey('up')"
    @keydown.arrowdown.prevent="handleArrowKey('down')"
    @keydown.arrowleft.prevent="handleArrowKey('left')"
    @keydown.arrowright.prevent="handleArrowKey('right')"
    @focus="handleFocus"
    @blur="handleBlur"
  >
    <!-- Screen reader status announcement -->
    <span id="drag-status" class="sr-only">
      {{ dragStatusText }}
    </span>

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
          ></div>
        </div>

        <!-- Enhanced visual feedback layers -->
        <div class="drag-handle__glow-layer"></div>
        <div class="drag-handle__pulse-layer"></div>
        <div class="drag-handle__trail-layer"></div>
      </div>

      <!-- Advanced drag indicators -->
      <div class="drag-handle__indicators" :class="indicatorClasses">
        <div class="drag-handle__indicator drag-handle__indicator--horizontal"></div>
        <div class="drag-handle__indicator drag-handle__indicator--vertical"></div>
        <div class="drag-handle__indicator drag-handle__indicator--diagonal"></div>
      </div>

      <!-- Touch feedback overlay -->
      <div v-if="showTouchFeedback" class="drag-handle__touch-feedback"></div>
    </div>

    <!-- Floating drag hints -->
    <transition name="drag-hints-fade" appear>
      <div v-if="showDragHints && isHovered" class="drag-handle__hints" :class="hintsClasses">
        <div class="hint-item">
          <kbd>Click</kbd>
          <span>Start drag</span>
        </div>
        <div class="hint-item">
          <kbd>↑↓←→</kbd>
          <span>Move</span>
        </div>
        <div class="hint-item">
          <kbd>Esc</kbd>
          <span>Cancel</span>
        </div>
      </div>
    </transition>

    <!-- Drag preview ghost -->
    <teleport to="body">
      <div
        v-if="isDragging && dragGhost"
        class="drag-handle__ghost"
        :style="ghostStyle"
        aria-hidden="true"
      >
        <div class="drag-handle__ghost-content">
          <div class="drag-handle__ghost-dots">
            <div v-for="n in 6" :key="n" class="drag-handle__ghost-dot"></div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

interface Props {
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  title?: string
  ariaLabel?: string
  showDragHints?: boolean
  showKeyboardNavigation?: boolean
  dragThreshold?: number
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'md',
  title: 'Drag to move',
  ariaLabel: 'Drag handle',
  showDragHints: false,
  showKeyboardNavigation: true,
  dragThreshold: 5
})

const emit = defineEmits<{
  dragStart: [event: MouseEvent | TouchEvent]
  dragEnd: [event: MouseEvent | TouchEvent]
  dragMove: [event: MouseEvent | TouchEvent, deltaX: number, deltaY: number]
  keyboardMove: [direction: 'up' | 'down' | 'left' | 'right']
  hoverStart: []
  hoverEnd: []
}>()

// Enhanced state management
const isDragging = ref(false)
const isHovered = ref(false)
const isFocused = ref(false)
const showTouchFeedback = ref(false)
const dragGhost = ref(false)
const dragStartPosition = ref({ x: 0, y: 0 })
const currentPosition = ref({ x: 0, y: 0 })
const animationFrame = ref<number | null>(null)

// Advanced dot system with dynamic configuration
const dots = computed(() => {
  const dotCount = props.size === 'sm' ? 4 : props.size === 'lg' ? 8 : 6
  return Array.from({ length: dotCount }, (_, i) => ({
    index: i,
    delay: i * 50,
    intensity: 0.5 + (i / dotCount) * 0.5
  }))
})

// Enhanced computed classes with comprehensive state management
const dragHandleClasses = computed(() => [
  'drag-handle',
  `drag-handle--${props.size}`,
  {
    'drag-handle--disabled': props.disabled,
    'drag-handle--dragging': isDragging.value,
    'drag-handle--hovered': isHovered.value,
    'drag-handle--focused': isFocused.value,
    'drag-handle--touch-feedback': showTouchFeedback.value,
    'drag-handle--keyboard-enabled': props.showKeyboardNavigation
  }
])

const touchAreaClasses = computed(() => [
  'drag-handle__touch-area',
  `drag-handle__touch-area--${props.size}`,
  {
    'drag-handle__touch-area--active': isDragging.value,
    'drag-handle__touch-area--hovered': isHovered.value
  }
])

const gripClasses = computed(() => [
  'drag-handle__grip',
  `drag-handle__grip--${props.size}`,
  {
    'drag-handle__grip--animating': isDragging.value,
    'drag-handle__grip--pulsing': isHovered.value && !isDragging.value
  }
])

const dotsClasses = computed(() => [
  'drag-handle__dots',
  `drag-handle__dots--${props.size}`,
  {
    'drag-handle__dots--dragging': isDragging.value,
    'drag-handle__dots--animated': isHovered.value || isDragging.value
  }
])

const indicatorClasses = computed(() => [
  'drag-handle__indicators',
  `drag-handle__indicators--${props.size}`,
  {
    'drag-handle__indicators--visible': isDragging.value,
    'drag-handle__indicators--animated': true
  }
])

const hintsClasses = computed(() => [
  'drag-handle__hints',
  `drag-handle__hints--${props.size}`,
  {
    'drag-handle__hints--visible': true
  }
])

// Enhanced ARIA label with comprehensive state information
const enhancedAriaLabel = computed(() => {
  const state = isDragging.value ? 'dragging in progress' : 'drag to move'
  const keyboardInfo = props.showKeyboardNavigation ? ', keyboard navigation available' : ''
  const hintsInfo = props.showDragHints ? ', hints available' : ''
  return `${props.ariaLabel}, ${state}${keyboardInfo}${hintsInfo}${props.disabled ? ', disabled' : ''}`
})

// Enhanced title with keyboard shortcuts
const enhancedTitle = computed(() => {
  let title = props.title
  if (props.showKeyboardNavigation) {
    title += ' (Use arrow keys to move, Escape to cancel)'
  }
  return title
})

// Enhanced drag status text for screen readers
const dragStatusText = computed(() => {
  if (isDragging.value) {
    return `Dragging in progress. Use arrow keys to move or Escape to cancel.`
  }
  return 'Drag to move item. Click and drag or press Enter to start.'
})

// Advanced ghost styling for drag preview
const ghostStyle = computed(() => ({
  position: 'fixed' as const,
  top: `${currentPosition.value.y}px`,
  left: `${currentPosition.value.x}px`,
  zIndex: 9999,
  pointerEvents: 'none' as const,
  transform: 'translate(-50%, -50%) scale(1.1)',
  opacity: 0.8
}))

// Enhanced dot animation classes
const getDotClasses = (index: number) => [
  'drag-handle__dot',
  `drag-handle__dot--${index}`,
  {
    'drag-handle__dot--dragging': isDragging.value,
    'drag-handle__dot--animated': isHovered.value || isDragging.value,
    'drag-handle__dot--delayed': true
  }
]

// Dynamic dot styling with animation delays
const getDotStyle = (index: number) => ({
  animationDelay: `${index * 50}ms`,
  '--dot-intensity': dots.value[index].intensity,
  '--dot-delay': `${index * 50}ms`
})

// Enhanced mouse event handlers with sophisticated feedback
const handleMouseDown = (event: MouseEvent) => {
  if (props.disabled) return

  event.preventDefault()
  startDragOperation(event)

  // Add enhanced global mouse event listeners
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleTouchStart = (event: TouchEvent) => {
  if (props.disabled) return

  event.preventDefault()
  showTouchFeedback.value = true
  startDragOperation(event)

  // Add enhanced global touch event listeners
  document.addEventListener('touchmove', handleTouchMove)
  document.addEventListener('touchend', handleTouchEnd)
}

const startDragOperation = (event: MouseEvent | TouchEvent) => {
  isDragging.value = true
  dragGhost.value = true

  // Calculate initial position
  const clientX = 'touches' in event ? event.touches[0]?.clientX || 0 : event.clientX
  const clientY = 'touches' in event ? event.touches[0]?.clientY || 0 : event.clientY

  dragStartPosition.value = { x: clientX, y: clientY }
  currentPosition.value = { x: clientX, y: clientY }

  emit('dragStart', event)

  // Start position tracking animation
  startPositionTracking()
}

const startPositionTracking = () => {
  const trackPosition = () => {
    if (!isDragging.value) return

    // Update ghost position with smooth animation
    // This will be updated in mouse/touch move handlers
    animationFrame.value = requestAnimationFrame(trackPosition)
  }

  animationFrame.value = requestAnimationFrame(trackPosition)
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return

  const deltaX = event.clientX - dragStartPosition.value.x
  const deltaY = event.clientY - dragStartPosition.value.y

  // Update position for ghost
  currentPosition.value = { x: event.clientX, y: event.clientY }

  // Emit drag move with delta information
  emit('dragMove', event, deltaX, deltaY)
}

const handleTouchMove = (event: TouchEvent) => {
  if (!isDragging.value) return

  const touch = event.touches[0]
  if (!touch) return

  const deltaX = touch.clientX - dragStartPosition.value.x
  const deltaY = touch.clientY - dragStartPosition.value.y

  // Update position for ghost
  currentPosition.value = { x: touch.clientX, y: touch.clientY }

  // Prevent default to avoid page scrolling during drag
  event.preventDefault()
  emit('dragMove', event, deltaX, deltaY)
}

const handleMouseUp = (event: MouseEvent) => {
  endDragOperation(event)

  // Remove global mouse event listeners
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

const handleTouchEnd = (event: TouchEvent) => {
  showTouchFeedback.value = false
  endDragOperation(event)

  // Remove global touch event listeners
  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)
}

const endDragOperation = (event: MouseEvent | TouchEvent) => {
  if (isDragging.value) {
    isDragging.value = false
    dragGhost.value = false

    // Cancel animation frame
    if (animationFrame.value) {
      cancelAnimationFrame(animationFrame.value)
      animationFrame.value = null
    }

    emit('dragEnd', event)
  }
}

// Enhanced keyboard navigation
const handleKeyDown = (event: KeyboardEvent) => {
  if (props.disabled) return

  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (!isDragging.value) {
        // Simulate mouse down for keyboard drag start
        const syntheticEvent = new MouseEvent('mousedown', {
          clientX: 0,
          clientY: 0,
          bubbles: true,
          cancelable: true
        })
        startDragOperation(syntheticEvent)
      }
      break
    case 'Escape':
      if (isDragging.value) {
        event.preventDefault()
        endDragOperation(event as any)
      }
      break
  }
}

const handleArrowKey = (direction: 'up' | 'down' | 'left' | 'right') => {
  if (props.disabled || !props.showKeyboardNavigation) return

  emit('keyboardMove', direction)
}

// Enhanced hover management
const handleMouseEnter = () => {
  isHovered.value = true
  emit('hoverStart')
}

const handleMouseLeave = () => {
  isHovered.value = false
  emit('hoverEnd')
}

// Enhanced focus management
const handleFocus = () => {
  isFocused.value = true
}

const handleBlur = () => {
  isFocused.value = false
}

// Cleanup function with comprehensive event listener removal
const cleanup = () => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)

  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value)
    animationFrame.value = null
  }
}

// Enhanced lifecycle management
onMounted(() => {
  // Add global keyboard shortcuts
  if (props.showKeyboardNavigation) {
    document.addEventListener('keydown', handleGlobalKeydown)
  }
})

onUnmounted(() => {
  cleanup()
})

// Global keyboard shortcut handler
const handleGlobalKeydown = (event: KeyboardEvent) => {
  if (!isFocused.value) return

  // Handle global shortcuts when drag handle is focused
  if (event.key === 'Escape' && isDragging.value) {
    event.preventDefault()
    endDragOperation(event as any)
  }
}

// Watch for drag state changes to manage animations
watch(isDragging, (newValue) => {
  if (newValue) {
    // Start drag animations
    nextTick(() => {
      // Trigger any DOM-dependent animations
    })
  }
})

// Expose enhanced methods for parent components
defineExpose({
  startDrag: () => {
    if (!props.disabled && !isDragging.value) {
      const syntheticEvent = new MouseEvent('mousedown')
      startDragOperation(syntheticEvent)
    }
  },
  endDrag: () => {
    if (isDragging.value) {
      endDragOperation(new MouseEvent('mouseup'))
    }
  },
  focus: () => {
    // Find the focusable element and focus it
    const element = document.querySelector('.drag-handle') as HTMLElement
    element?.focus()
  },
  blur: () => {
    const element = document.querySelector('.drag-handle') as HTMLElement
    element?.blur()
  },
  isDragging: () => isDragging.value,
  position: () => currentPosition.value
})
</script>

<style scoped>
/* ==========================================================================
   Advanced Drag Handle Component
   Professional Glass Morphism with Sophisticated Animations
   ========================================================================== */

/* Enhanced CSS Custom Properties with Comprehensive Design System */
:root {
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

/* ==========================================================================
   Main Drag Handle Container with Advanced Glass Morphism
   ========================================================================== */
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

  /* Performance optimizations */
  transform: translateZ(0);
  will-change: transform, box-shadow, background, border-color;

  /* Transitions */
  transition: all var(--transition-normal) var(--spring-smooth);

  /* Interactive states */
  cursor: grab;
  user-select: none;
  opacity: 0.85;
  overflow: hidden;
}

/* ==========================================================================
   Enhanced Interactive States with Sophisticated Feedback
   ========================================================================== */
.drag-handle:hover:not(.drag-handle--disabled) {
  transform: translateY(-3px) scale(1.08) translateZ(0);
  opacity: 1;

  background:
    linear-gradient(135deg, var(--state-hover) 0%, var(--glass-bg-medium) 40%, var(--glass-bg-light) 100%),
    linear-gradient(225deg, var(--glass-bg-strong) 0%, var(--glass-bg-medium) 100%);

  border-color: rgba(var(--primary-rgb), 0.3);

  box-shadow:
    var(--shadow-medium),
    var(--shadow-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    inset 0 -1px 0 rgba(0, 0, 0, 0.08);

  cursor: grab;
}

.drag-handle:active:not(.drag-handle--disabled),
.drag-handle--dragging {
  transform: translateY(-1px) scale(1.12) translateZ(0);
  opacity: 1;
  cursor: grabbing;

  background:
    linear-gradient(135deg, var(--state-dragging) 0%, rgba(var(--primary-light-rgb), 0.8) 100%),
    linear-gradient(225deg, var(--state-active) 0%, var(--state-dragging) 100%);

  border-color: rgba(var(--primary-rgb), 0.6);

  box-shadow:
    var(--shadow-strong),
    var(--shadow-glow-strong),
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);

  backdrop-filter: var(--blur-strong);
}

/* ==========================================================================
   Focus State with Enhanced Visibility and Professional Styling
   ========================================================================== */
.drag-handle:focus-visible {
  outline: none;
  border-color: rgba(var(--primary-rgb), 0.5);
  box-shadow:
    var(--shadow-medium),
    0 0 0 3px var(--state-focus),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* ==========================================================================
   Disabled State with Accessibility Focus
   ========================================================================== */
.drag-handle--disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
  filter: grayscale(0.4);

  /* Maintain visual structure */
  background:
    linear-gradient(135deg, rgba(128, 128, 128, 0.15) 0%, rgba(128, 128, 128, 0.10) 100%),
    linear-gradient(225deg, rgba(160, 160, 160, 0.08) 0%, rgba(128, 128, 128, 0.05) 100%);

  border-color: rgba(128, 128, 128, 0.25) !important;
  box-shadow: var(--shadow-soft) !important;
}

/* ==========================================================================
   Advanced Touch Area with Multi-Layer Feedback System
   ========================================================================== */
.drag-handle__touch-area {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;

  /* Multi-layer glass morphism for touch area */
  background:
    linear-gradient(135deg, var(--glass-bg-medium) 0%, var(--glass-bg-light) 100%),
    linear-gradient(225deg, var(--glass-bg-strong) 0%, var(--glass-bg-medium) 100%);

  border: 1px solid var(--glass-border-subtle);
  border-radius: var(--radius-sm);

  /* Performance optimizations */
  transform: translateZ(0);
  will-change: transform, background, border-color;

  /* Transitions */
  transition: all var(--transition-fast) var(--spring-gentle);

  overflow: hidden;
}

.drag-handle__touch-area--active {
  transform: scale(1.1) translateZ(0);
  background:
    linear-gradient(135deg, var(--state-active) 0%, var(--glass-bg-medium) 100%),
    linear-gradient(225deg, var(--glass-bg-strong) 0%, var(--state-active) 100%);

  border-color: rgba(var(--accent-rgb), 0.4);
}

/* ==========================================================================
   Advanced Grip System with Sophisticated Animations
   ========================================================================== */
.drag-handle__grip {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  z-index: 2;
}

.drag-handle__grip--pulsing {
  animation: gripPulse 2s ease-in-out infinite;
}

.drag-handle__grip--animating {
  animation: gripAnimate 0.6s var(--ease-out-back);
}

/* ==========================================================================
   Enhanced Dot Pattern with Professional Animations
   ========================================================================== */
.drag-handle__dots {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  z-index: 3;
}

.drag-handle__dots--animated {
  animation: dotsContainerAnimate 0.8s var(--spring-bouncy);
}

.drag-handle__dots--dragging {
  animation: dotsDragging 1.5s ease-in-out infinite;
}

.drag-handle__dot {
  position: relative;
  width: 4px;
  height: 4px;

  /* Multi-layer gradient backgrounds */
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.6) 100%),
    linear-gradient(225deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%);

  border-radius: 2px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);

  /* Performance optimizations */
  transform: translateZ(0);
  will-change: transform, background, box-shadow;

  /* Transitions */
  transition: all var(--transition-fast) var(--spring-gentle);

  /* Animation delay for staggered effects */
  animation-delay: var(--dot-delay, 0ms);
}

.drag-handle__dot--animated {
  animation: dotAppear 0.4s var(--ease-out-back) both;
  animation-delay: var(--dot-delay, 0ms);
}

.drag-handle__dot--delayed {
  animation-delay: calc(var(--dot-delay, 0ms) * var(--dot-intensity, 1));
}

/* Enhanced dot hover states */
.drag-handle:hover .drag-handle__dot:not(.drag-handle__dot--dragging),
.drag-handle:focus-visible .drag-handle__dot {
  background:
    linear-gradient(135deg, rgba(var(--primary-rgb), 0.95) 0%, rgba(var(--primary-light-rgb), 0.85) 100%),
    linear-gradient(225deg, rgba(var(--primary-rgb), 1) 0%, rgba(var(--primary-light-rgb), 0.95) 100%);

  transform: scaleY(1.4) scaleX(1.2) translateZ(0);
  box-shadow:
    0 2px 12px rgba(var(--primary-rgb), 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);

  border-radius: 3px;
}

/* Enhanced dot dragging states */
.drag-handle:active .drag-handle__dot,
.drag-handle--dragging .drag-handle__dot {
  background:
    linear-gradient(135deg, rgba(var(--accent-rgb), 0.95) 0%, rgba(var(--primary-rgb), 0.9) 100%),
    linear-gradient(225deg, rgba(var(--accent-rgb), 1) 0%, rgba(var(--primary-rgb), 0.95) 100%);

  transform: scaleY(1.6) scaleX(1.3) rotate(15deg) translateZ(0);
  box-shadow:
    0 4px 20px rgba(var(--primary-rgb), 0.6),
    0 0 16px rgba(var(--accent-rgb), 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);

  border-radius: 4px;
  animation: dotDraggingPulse 0.8s ease-in-out infinite;
}

/* ==========================================================================
   Advanced Visual Feedback Layers
   ========================================================================== */
.drag-handle__glow-layer {
  position: absolute;
  inset: -4px; /* RTL: full coverage glow layer */
  background: radial-gradient(circle,
    rgba(var(--primary-rgb), 0.15) 0%,
    rgba(var(--primary-rgb), 0.08) 40%,
    transparent 70%);
  border-radius: var(--radius-md);
  opacity: 0;
  transition: opacity var(--transition-normal) var(--spring-smooth);
  z-index: 1;
}

.drag-handle:hover .drag-handle__glow-layer,
.drag-handle:focus-visible .drag-handle__glow-layer {
  opacity: 1;
}

.drag-handle--dragging .drag-handle__glow-layer {
  opacity: 1;
  background: radial-gradient(circle,
    rgba(var(--primary-rgb), 0.25) 0%,
    rgba(var(--primary-rgb), 0.15) 40%,
    transparent 70%);
  animation: glowPulse 1.5s ease-in-out infinite;
}

.drag-handle__pulse-layer {
  position: absolute;
  inset: 0; /* RTL: full coverage pulse layer */
  background: linear-gradient(45deg,
    transparent 30%,
    rgba(var(--primary-rgb), 0.1) 50%,
    transparent 70%);
  border-radius: var(--radius-md);
  opacity: 0;
  transition: all var(--transition-normal) var(--spring-smooth);
  z-index: 0;
}

.drag-handle--dragging .drag-handle__pulse-layer {
  opacity: 1;
  animation: pulseRotate 3s linear infinite;
}

.drag-handle__trail-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(var(--primary-rgb), 0.6) 50%,
    transparent 100%);
  opacity: 0;
  transform: translate(-50%, -50%);
  transition: all var(--transition-slow) var(--ease-out-back);
  z-index: 4;
}

.drag-handle--dragging .drag-handle__trail-layer {
  width: 200%;
  height: 2px;
  opacity: 0.6;
  animation: trailFlow 2s ease-in-out infinite;
}

/* ==========================================================================
   Advanced Drag Indicators
   ========================================================================== */
.drag-handle__indicators {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 32px;
  height: 32px;
  opacity: 0;
  transition: all var(--transition-normal) var(--spring-smooth);
  z-index: 5;
  pointer-events: none;
}

.drag-handle__indicators--visible {
  opacity: 1;
  animation: indicatorsAppear 0.5s var(--ease-out-back);
}

.drag-handle__indicator {
  position: absolute;
  background: rgba(var(--primary-rgb), 0.8);
  border-radius: 1px;
  opacity: 0;
  transform-origin: center;
}

.drag-handle__indicator--horizontal {
  top: 50%;
  inset-inline: 0; /* RTL: full width horizontal indicator */
  height: 2px;
  transform: translateY(-50%) scaleX(0);
}

.drag-handle__indicator--vertical {
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  transform: translateX(-50%) scaleY(0);
}

.drag-handle__indicator--diagonal {
  top: 25%;
  left: 25%;
  width: 50%;
  height: 50%;
  border: 1px solid rgba(var(--primary-rgb), 0.6);
  transform: scale(0) rotate(45deg);
  border-radius: var(--radius-sm);
}

.drag-handle--dragging .drag-handle__indicator {
  opacity: 1;
  animation: indicatorPulse 1s ease-in-out infinite;
}

.drag-handle--dragging .drag-handle__indicator--horizontal {
  transform: translateY(-50%) scaleX(1);
}

.drag-handle--dragging .drag-handle__indicator--vertical {
  transform: translateX(-50%) scaleY(1);
}

.drag-handle--dragging .drag-handle__indicator--diagonal {
  transform: scale(1) rotate(45deg);
}

/* ==========================================================================
   Touch Feedback Overlay
   ========================================================================== */
.drag-handle__touch-feedback {
  position: absolute;
  inset: 0; /* RTL: full coverage touch feedback */
  background: radial-gradient(circle,
    rgba(var(--primary-rgb), 0.3) 0%,
    rgba(var(--primary-rgb), 0.15) 50%,
    transparent 70%);
  border-radius: var(--radius-md);
  opacity: 0;
  animation: touchFeedback 0.6s ease-out;
  z-index: 6;
  pointer-events: none;
}

/* ==========================================================================
   Floating Drag Hints with Professional Styling
   ========================================================================== */
.drag-handle__hints {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 12px;
  background:
    linear-gradient(135deg, var(--glass-bg-strong) 0%, var(--glass-bg-medium) 100%),
    linear-gradient(225deg, var(--glass-bg-light) 0%, var(--glass-bg-soft) 100%);

  border: 1px solid var(--glass-border-medium);
  border-radius: var(--radius-lg);

  box-shadow:
    var(--shadow-medium),
    var(--shadow-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.08);

  backdrop-filter: var(--blur-medium);
  z-index: 1000;
  min-width: 180px;
}

.drag-handle__hints::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background: inherit;
  border: inherit;
  border-bottom: none;
  border-right: none;
  transform: translateX(-50%) rotate(45deg);
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  transition: all var(--transition-fast) var(--spring-gentle);
}

.hint-item:hover {
  color: var(--text-primary);
  background: var(--glass-bg-light);
}

.hint-item kbd {
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border-subtle);
  border-radius: var(--radius-xs);
  padding: 2px 6px;
  font-family: monospace;
  font-size: 10px;
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* ==========================================================================
   Drag Ghost with Professional Preview
   ========================================================================== */
.drag-handle__ghost {
  position: fixed;
  width: 48px;
  height: 48px;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.8;
}

.drag-handle__ghost-content {
  width: 100%;
  height: 100%;
  background:
    linear-gradient(135deg, var(--glass-bg-strong) 0%, var(--glass-bg-medium) 100%),
    linear-gradient(225deg, var(--glass-bg-light) 0%, var(--glass-bg-soft) 100%);

  border: 1px solid var(--glass-border-medium);
  border-radius: var(--radius-md);

  box-shadow:
    var(--shadow-strong),
    var(--shadow-glow-strong),
    0 0 40px rgba(var(--primary-rgb), 0.3);

  backdrop-filter: var(--blur-strong);
  transform: scale(1.1);
}

.drag-handle__ghost-dots {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 100%;
  padding: 12px 0;
}

.drag-handle__ghost-dot {
  width: 4px;
  height: 4px;
  background:
    linear-gradient(135deg, rgba(var(--primary-rgb), 0.9) 0%, rgba(var(--primary-light-rgb), 0.8) 100%),
    linear-gradient(225deg, rgba(var(--primary-rgb), 1) 0%, rgba(var(--primary-light-rgb), 0.9) 100%);

  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* ==========================================================================
   Advanced Animation System with Professional Timing
   ========================================================================== */
@keyframes dotAppear {
  0% {
    transform: scale(0) rotate(-180deg) translateZ(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.3) rotate(90deg) translateZ(0);
    opacity: 0.8;
  }
  100% {
    transform: scale(1) rotate(0) translateZ(0);
    opacity: 1;
  }
}

@keyframes dotDraggingPulse {
  0%, 100% {
    transform: scaleY(1.6) scaleX(1.3) rotate(15deg) translateZ(0);
    opacity: 1;
  }
  50% {
    transform: scaleY(1.8) scaleX(1.4) rotate(20deg) translateZ(0);
    opacity: 0.8;
  }
}

@keyframes gripPulse {
  0%, 100% {
    transform: scale(1) translateZ(0);
  }
  50% {
    transform: scale(1.05) translateZ(0);
  }
}

@keyframes gripAnimate {
  0% {
    transform: scale(0.8) translateZ(0);
  }
  50% {
    transform: scale(1.15) translateZ(0);
  }
  100% {
    transform: scale(1) translateZ(0);
  }
}

@keyframes dotsContainerAnimate {
  0% {
    transform: scaleY(0) translateZ(0);
    opacity: 0;
  }
  50% {
    transform: scaleY(1.1) translateZ(0);
    opacity: 0.8;
  }
  100% {
    transform: scaleY(1) translateZ(0);
    opacity: 1;
  }
}

@keyframes dotsDragging {
  0%, 100% {
    transform: translateY(0) translateZ(0);
  }
  25% {
    transform: translateY(-1px) translateZ(0);
  }
  75% {
    transform: translateY(1px) translateZ(0);
  }
}

@keyframes glowPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

@keyframes pulseRotate {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes trailFlow {
  0% {
    transform: translate(-50%, -50%) translateX(-100%);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) translateX(100%);
    opacity: 0;
  }
}

@keyframes indicatorsAppear {
  0% {
    transform: translate(-50%, -50%) scale(0) rotate(-180deg);
    opacity: 0;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2) rotate(90deg);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
    opacity: 1;
  }
}

@keyframes indicatorPulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes touchFeedback {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.2);
    opacity: 0;
  }
}

@keyframes dragHintsFadeIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

.drag-hints-fade-enter-active {
  animation: dragHintsFadeIn 0.3s var(--ease-out-back);
}

.drag-hints-fade-leave-active {
  animation: dragHintsFadeIn 0.2s var(--spring-smooth) reverse;
}

/* ==========================================================================
   Size Variants with Comprehensive Scaling
   ========================================================================== */
.drag-handle--sm {
  width: 40px;
  height: 40px;
}

.drag-handle--sm .drag-handle__touch-area {
  width: 26px;
  height: 26px;
}

.drag-handle--sm .drag-handle__dot {
  width: 3px;
  height: 3px;
}

.drag-handle--lg {
  width: 56px;
  height: 56px;
}

.drag-handle--lg .drag-handle__touch-area {
  width: 38px;
  height: 38px;
}

.drag-handle--lg .drag-handle__dot {
  width: 5px;
  height: 5px;
}

/* ==========================================================================
   Accessibility and Reduced Motion Support
   ========================================================================== */
@media (prefers-reduced-motion: reduce) {
  .drag-handle,
  .drag-handle__touch-area,
  .drag-handle__dot,
  .drag-handle__grip,
  .drag-handle__dots,
  .drag-handle__indicators,
  .drag-handle__glow-layer,
  .drag-handle__pulse-layer,
  .drag-handle__trail-layer {
    transition-duration: 0.001ms;
    transform: none;
    will-change: auto;
    animation: none;
  }

  .drag-handle__dot--animated,
  .drag-handle__dots--animated,
  .drag-handle__dots--dragging,
  .drag-handle__grip--animating,
  .drag-handle__grip--pulsing,
  .drag-handle__indicators--animated,
  .drag-handle__touch-feedback {
    animation: none;
  }

  .drag-hints-fade-enter-active,
  .drag-hints-fade-leave-active {
    animation: none;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .drag-handle {
    background: rgba(255, 255, 255, 0.95) !important;
    border: 2px solid #000 !important;
  }

  .drag-handle--dragging {
    background: #000 !important;
    border-color: #fff !important;
  }

  .drag-handle:focus-visible {
    outline: 3px solid #000;
    outline-offset: 2px;
  }

  .drag-handle__touch-area {
    background: rgba(255, 255, 255, 0.9) !important;
    border: 1px solid #000 !important;
  }

  .drag-handle__dot {
    background: #000 !important;
  }
}

/* ==========================================================================
   Screen Reader Only Class
   ========================================================================== */
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
</style>