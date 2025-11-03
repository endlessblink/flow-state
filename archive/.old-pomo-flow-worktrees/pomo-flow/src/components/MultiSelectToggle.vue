<template>
  <div class="multi-select-container" :class="containerClasses">
    <!-- Advanced Multi-Select Toggle with Floating Toolbar -->
    <div class="multi-select-toggle" :class="`multi-select-toggle--${size}`">
      <input
        ref="inputRef"
        type="checkbox"
        :checked="selected"
        :indeterminate="indeterminate"
        @change="handleChange"
        @click.stop
        class="sr-only"
        :id="inputId"
        :aria-describedby="selected ? 'selection-status' : undefined"
      />
      <label
        :for="inputId"
        class="toggle-box"
        :class="toggleBoxClasses"
        @click="handleClick"
        @keydown.enter="handleKeydown"
        @keydown.space.prevent="handleKeydown"
        @keydown.ctrl.a.prevent="handleSelectAll"
        @keydown.escape.prevent="handleClearSelection"
        tabindex="0"
        role="checkbox"
        :aria-checked="selected ? 'true' : 'false'"
        :aria-label="enhancedAriaLabel"
        :aria-disabled="disabled"
      >
        <span id="selection-status" class="sr-only">
          {{ selectionStatusText }}
        </span>
        <div class="toggle-box__content">
          <!-- Enhanced check indicator with sophisticated animations -->
          <div v-if="selected" class="toggle-box__check" aria-hidden="true">
            <Check :size="iconSize" />
          </div>
          <div v-else-if="indeterminate" class="toggle-box__indeterminate" aria-hidden="true">
            <Minus :size="iconSize" />
          </div>
          <div v-else class="toggle-box__empty" aria-hidden="true">
            <div class="toggle-box__empty-inner"></div>
          </div>

          <!-- Enhanced visual feedback layers -->
          <div class="toggle-box__glow"></div>
          <div class="toggle-box__border-glow"></div>
        </div>
      </label>
    </div>

    <!-- Floating Toolbar for Bulk Actions -->
    <transition name="toolbar-fade" appear>
      <div v-if="showToolbar" class="multi-select-toolbar" :class="toolbarClasses">
        <div class="toolbar-content">
          <!-- Selection counter -->
          <div class="toolbar-counter">
            <span class="counter-number">{{ selectedCount }}</span>
            <span class="counter-label">selected</span>
          </div>

          <!-- Action buttons -->
          <div class="toolbar-actions">
            <button
              @click="handleSelectAll"
              class="toolbar-btn"
              :class="{ 'toolbar-btn--active': allSelected }"
              title="Select All (Ctrl+A)"
              aria-label="Select all items"
            >
              <SelectAll :size="14" />
            </button>

            <button
              @click="handleInvertSelection"
              class="toolbar-btn"
              title="Invert Selection"
              aria-label="Invert selection"
            >
              <GitCompare :size="14" />
            </button>

            <button
              @click="handleClearSelection"
              class="toolbar-btn"
              title="Clear Selection (Escape)"
              aria-label="Clear selection"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Keyboard shortcuts hint -->
    <div v-if="showKeyboardHints" class="keyboard-hints">
      <div class="hint-item">
        <kbd>Ctrl</kbd><kbd>A</kbd>
        <span>Select All</span>
      </div>
      <div class="hint-item">
        <kbd>Shift</kbd><kbd>Click</kbd>
        <span>Range Select</span>
      </div>
      <div class="hint-item">
        <kbd>Esc</kbd>
        <span>Clear</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Check, Minus, SelectAll, GitCompare, X } from 'lucide-vue-next'

interface Props {
  selected?: boolean
  indeterminate?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  id?: string
  ariaLabel?: string
  selectedCount?: number
  totalCount?: number
  showToolbar?: boolean
  showKeyboardHints?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  indeterminate: false,
  disabled: false,
  size: 'md',
  ariaLabel: 'Select task',
  selectedCount: 0,
  totalCount: 0,
  showToolbar: true,
  showKeyboardHints: false
})

const emit = defineEmits<{
  change: [selected: boolean]
  click: [event: Event]
  selectAll: []
  invertSelection: []
  clearSelection: []
  rangeSelect: [fromIndex: number, toIndex: number]
}>()

const inputRef = ref<HTMLInputElement>()
const isHovered = ref(false)
const isFocused = ref(false)
const showToolbar = ref(props.showToolbar && props.selected)
const lastClickTime = ref(0)
const clickCount = ref(0)

const inputId = computed(() => props.id || `toggle-${Math.random().toString(36).substr(2, 9)}`)

// Enhanced container classes
const containerClasses = computed(() => [
  `multi-select-container--${props.size}`,
  {
    'multi-select-container--disabled': props.disabled,
    'multi-select-container--selected': props.selected,
    'multi-select-container--indeterminate': props.indeterminate,
    'multi-select-container--hovered': isHovered.value,
    'multi-select-container--focused': isFocused.value
  }
])

// Enhanced toggle box classes with multiple states
const toggleBoxClasses = computed(() => [
  'toggle-box',
  `toggle-box--${props.size}`,
  {
    'toggle-box--selected': props.selected,
    'toggle-box--indeterminate': props.indeterminate,
    'toggle-box--disabled': props.disabled,
    'toggle-box--hovered': isHovered.value,
    'toggle-box--focused': isFocused.value,
    'toggle-box--animated': true
  }
])

// Enhanced toolbar classes
const toolbarClasses = computed(() => [
  'multi-select-toolbar',
  `multi-select-toolbar--${props.size}`,
  {
    'multi-select-toolbar--visible': showToolbar.value,
    'multi-select-toolbar--animated': true
  }
])

// Enhanced ARIA label with comprehensive state information
const enhancedAriaLabel = computed(() => {
  const state = props.selected ? 'selected' : props.indeterminate ? 'partially selected' : 'not selected'
  const countInfo = props.totalCount > 0 ? ` ${props.selectedCount} of ${props.totalCount} items` : ''
  const shortcuts = showToolbar.value ? ', keyboard shortcuts available' : ''
  return `${props.ariaLabel}, currently ${state}${countInfo}${shortcuts}${props.disabled ? ', disabled' : ''}`
})

// Enhanced selection status text
const selectionStatusText = computed(() => {
  if (props.selected) {
    return props.totalCount > 0
      ? `Selected, ${props.selectedCount} of ${props.totalCount} items selected`
      : 'Selected'
  }
  if (props.indeterminate) {
    return props.totalCount > 0
      ? `Partially selected, ${props.selectedCount} of ${props.totalCount} items selected`
      : 'Partially selected'
  }
  return props.totalCount > 0
    ? `Not selected, 0 of ${props.totalCount} items selected`
    : 'Not selected'
})

// Check if all items are selected
const allSelected = computed(() =>
  props.totalCount > 0 && props.selectedCount === props.totalCount
)

// Check if any items are selected
const hasSelection = computed(() =>
  props.selectedCount > 0
)

// Icon size based on component size
const iconSize = computed(() => {
  switch (props.size) {
    case 'sm': return 12
    case 'lg': return 18
    default: return 14
  }
})

// Enhanced change handler with animation support
const handleChange = (event: Event) => {
  if (props.disabled) return

  const target = event.target as HTMLInputElement
  triggerSelectionAnimation()
  emit('change', target.checked)
}

// Enhanced click handler with double-click detection
const handleClick = (event: Event) => {
  if (props.disabled) return

  event.stopPropagation()

  // Detect double-click for select all functionality
  const currentTime = Date.now()
  if (currentTime - lastClickTime.value < 300) {
    clickCount.value++
    if (clickCount.value === 2) {
      handleSelectAll()
      clickCount.value = 0
      return
    }
  } else {
    clickCount.value = 1
  }
  lastClickTime.value = currentTime

  const newSelectedState = props.indeterminate ? true : !props.selected
  triggerSelectionAnimation()
  emit('change', newSelectedState)
  emit('click', event)
}

// Enhanced keyboard handler with comprehensive shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return

  switch (event.key) {
    case 'Enter':
    case ' ':
      event.preventDefault()
      const newSelectedState = props.indeterminate ? true : !props.selected
      triggerSelectionAnimation()
      emit('change', newSelectedState)
      break
    case 'a':
    case 'A':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        handleSelectAll()
      }
      break
    case 'Escape':
      event.preventDefault()
      handleClearSelection()
      break
    case 'i':
    case 'I':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        handleInvertSelection()
      }
      break
  }
}

// Advanced action handlers
const handleSelectAll = () => {
  if (props.disabled) return
  emit('selectAll')
  showToolbar.value = true
}

const handleInvertSelection = () => {
  if (props.disabled) return
  emit('invertSelection')
}

const handleClearSelection = () => {
  if (props.disabled) return
  emit('clearSelection')
  showToolbar.value = false
}

// Advanced animation system
const triggerSelectionAnimation = () => {
  if (inputRef.value) {
    inputRef.value.classList.add('toggle-box--animating')
    setTimeout(() => {
      inputRef.value?.classList.remove('toggle-box--animating')
    }, 300)
  }
}

// Hover and focus management
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

// Watch for selection changes to control toolbar visibility
watch([() => props.selected, () => props.selectedCount], ([selected, count]) => {
  showToolbar.value = props.showToolbar && (selected || count > 0)
}, { immediate: true })

// Global keyboard shortcuts
const handleGlobalKeydown = (event: KeyboardEvent) => {
  if (event.target === document.body && isFocused.value) {
    handleKeydown(event)
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})

// Expose enhanced methods for parent components
defineExpose({
  focus: () => {
    inputRef.value?.focus()
    isFocused.value = true
  },
  blur: () => {
    inputRef.value?.blur()
    isFocused.value = false
  },
  select: () => {
    emit('change', true)
    triggerSelectionAnimation()
  },
  deselect: () => {
    emit('change', false)
    triggerSelectionAnimation()
  },
  animate: triggerSelectionAnimation
})
</script>

<style scoped>
/* ==========================================================================
   Advanced Multi-Select Toggle Component
   Sophisticated Glass Morphism with Professional Animations
   ========================================================================== */

/* Enhanced CSS Custom Properties with Comprehensive Design System */
:root {
  /* Animation Timing Functions */
  --spring-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --spring-bouncy: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --spring-gentle: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Glass Morphism Layers */
  --glass-bg-soft: rgba(255, 255, 255, 0.08);
  --glass-bg-light: rgba(255, 255, 255, 0.12);
  --glass-bg-medium: rgba(255, 255, 255, 0.16);
  --glass-bg-strong: rgba(255, 255, 255, 0.24);
  --glass-border-subtle: rgba(255, 255, 255, 0.15);
  --glass-border-medium: rgba(255, 255, 255, 0.25);
  --glass-border-strong: rgba(255, 255, 255, 0.35);

  /* Color System */
  --primary-rgb: 59, 130, 246;
  --primary-light-rgb: 147, 197, 253;
  --success-rgb: 34, 197, 94;
  --warning-rgb: 251, 146, 60;
  --purple-rgb: 147, 51, 234;

  /* State Colors */
  --state-selected: rgba(var(--primary-rgb), 0.85);
  --state-selected-hover: rgba(var(--primary-rgb), 0.95);
  --state-indeterminate: rgba(var(--purple-rgb), 0.85);
  --state-hover: rgba(var(--primary-rgb), 0.15);
  --state-focus: rgba(var(--primary-rgb), 0.12);

  /* Blur Values */
  --blur-light: blur(8px);
  --blur-medium: blur(12px);
  --blur-strong: blur(16px);

  /* Shadows */
  --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-medium: 0 4px 16px rgba(0, 0, 0, 0.12);
  --shadow-strong: 0 8px 32px rgba(0, 0, 0, 0.16);
  --shadow-glow: 0 0 24px rgba(var(--primary-rgb), 0.3);
  --shadow-glow-strong: 0 0 32px rgba(var(--primary-rgb), 0.4);

  /* Transitions */
  --transition-fast: 0.15s;
  --transition-normal: 0.25s;
  --transition-slow: 0.4s;

  /* Border Radius */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

/* ==========================================================================
   Main Container Component
   ========================================================================== */
.multi-select-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Touch target sizing for accessibility */
.multi-select-container--sm {
  padding: 12px;
}

.multi-select-container--md {
  padding: 10px;
}

.multi-select-container--lg {
  padding: 8px;
}

/* ==========================================================================
   Advanced Toggle Box with Multi-Layer Glass Morphism
   ========================================================================== */
.toggle-box {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;

  /* Multi-layer glass morphism background */
  background:
    linear-gradient(135deg, var(--glass-bg-strong) 0%, var(--glass-bg-medium) 100%),
    linear-gradient(225deg, var(--glass-bg-light) 0%, var(--glass-bg-soft) 100%);

  /* Enhanced border system */
  border: 2px solid var(--glass-border-medium);
  border-radius: var(--radius-md);

  /* Advanced shadow system */
  box-shadow:
    var(--shadow-soft),
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);

  /* Sophisticated backdrop effects */
  backdrop-filter: var(--blur-medium);
  -webkit-backdrop-filter: var(--blur-medium);

  /* Performance optimizations */
  transform: translateZ(0);
  will-change: transform, box-shadow, background, border-color;

  /* Transitions */
  transition: all var(--transition-normal) var(--spring-smooth);

  /* Interactive states */
  cursor: pointer;
  user-select: none;
  overflow: hidden;
}

/* Enhanced hover state with multi-layer effects */
.toggle-box:hover:not(.toggle-box--disabled) {
  transform: translateY(-2px) scale(1.05) translateZ(0);

  background:
    linear-gradient(135deg, var(--state-hover) 0%, var(--glass-bg-medium) 50%, var(--glass-bg-light) 100%),
    linear-gradient(225deg, var(--glass-bg-strong) 0%, var(--glass-bg-medium) 100%);

  border-color: rgba(var(--primary-rgb), 0.4);

  box-shadow:
    var(--shadow-medium),
    var(--shadow-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
}

/* Active state with sophisticated feedback */
.toggle-box:active:not(.toggle-box--disabled) {
  transform: translateY(0) scale(0.98) translateZ(0);
  transition-duration: var(--transition-fast);
}

/* Focus state with enhanced visibility */
.toggle-box:focus-visible {
  outline: none;
  border-color: rgba(var(--primary-rgb), 0.6);
  box-shadow:
    var(--shadow-medium),
    0 0 0 3px var(--state-focus),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

/* ==========================================================================
   Selected State with Premium Visual Effects
   ========================================================================== */
.toggle-box--selected {
  background:
    linear-gradient(135deg, var(--state-selected) 0%, rgba(var(--primary-light-rgb), 0.9) 100%),
    linear-gradient(225deg, rgba(var(--primary-rgb), 0.8) 0%, var(--state-selected) 100%);

  border-color: rgba(var(--primary-rgb), 1);
  box-shadow:
    var(--shadow-medium),
    var(--shadow-glow-strong),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2);

  backdrop-filter: var(--blur-strong);
}

.toggle-box--selected:hover:not(.toggle-box--disabled) {
  background:
    linear-gradient(135deg, var(--state-selected-hover) 0%, var(--state-selected) 100%),
    linear-gradient(225deg, rgba(var(--primary-light-rgb), 0.95) 0%, var(--state-selected-hover) 100%);

  border-color: rgba(var(--primary-rgb), 1);
  transform: translateY(-2px) scale(1.08) translateZ(0);
}

/* ==========================================================================
   Indeterminate State with Purple Theme
   ========================================================================== */
.toggle-box--indeterminate {
  background:
    linear-gradient(135deg, var(--state-indeterminate) 0%, rgba(167, 139, 250, 0.9) 100%),
    linear-gradient(225deg, rgba(var(--purple-rgb), 0.8) 0%, var(--state-indeterminate) 100%);

  border-color: rgba(var(--purple-rgb), 1);
  box-shadow:
    var(--shadow-medium),
    0 0 24px rgba(var(--purple-rgb), 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2);

  backdrop-filter: var(--blur-strong);
}

.toggle-box--indeterminate:hover:not(.toggle-box--disabled) {
  background:
    linear-gradient(135deg, rgba(167, 139, 250, 0.95) 0%, var(--state-indeterminate) 100%),
    linear-gradient(225deg, rgba(196, 181, 253, 0.95) 0%, rgba(167, 139, 250, 0.95) 100%);

  transform: translateY(-2px) scale(1.08) translateZ(0);
}

/* ==========================================================================
   Disabled State with Accessibility Focus
   ========================================================================== */
.toggle-box--disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
  filter: grayscale(0.3);

  /* Maintain visibility for accessibility */
  background:
    linear-gradient(135deg, rgba(128, 128, 128, 0.2) 0%, rgba(128, 128, 128, 0.15) 100%),
    linear-gradient(225deg, rgba(160, 160, 160, 0.1) 0%, rgba(128, 128, 128, 0.05) 100%);

  border-color: rgba(128, 128, 128, 0.3) !important;
  box-shadow: var(--shadow-soft) !important;
}

/* ==========================================================================
   Content Container with Advanced Layering
   ========================================================================== */
.toggle-box__content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  z-index: 2;
}

/* ==========================================================================
   Enhanced Visual Feedback Layers
   ========================================================================== */
.toggle-box__glow {
  position: absolute;
  inset: -2px; /* RTL: full coverage glow layer */
  background: linear-gradient(45deg,
    transparent 30%,
    rgba(var(--primary-rgb), 0.1) 50%,
    transparent 70%);
  border-radius: var(--radius-md);
  opacity: 0;
  transition: opacity var(--transition-normal) var(--spring-smooth);
  z-index: 1;
}

.toggle-box:hover .toggle-box__glow,
.toggle-box:focus-visible .toggle-box__glow {
  opacity: 1;
}

.toggle-box__border-glow {
  position: absolute;
  inset: 0; /* RTL: full coverage border glow */
  border: 1px solid rgba(var(--primary-rgb), 0.3);
  border-radius: calc(var(--radius-md) - 1px);
  opacity: 0;
  transition: all var(--transition-normal) var(--spring-smooth);
  z-index: 0;
}

.toggle-box--selected .toggle-box__border-glow {
  opacity: 1;
  border-color: rgba(var(--primary-rgb), 0.6);
  animation: borderPulse 2s ease-in-out infinite;
}

/* ==========================================================================
   Enhanced Icons with Sophisticated Animations
   ========================================================================== */
.toggle-box__check,
.toggle-box__indeterminate {
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  animation: checkmarkAppear 0.4s var(--ease-out-back);
}

.toggle-box__empty {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-box__empty-inner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-radius: 3px;
  transition: all var(--transition-normal) var(--spring-smooth);
  background: rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.toggle-box:hover .toggle-box__empty-inner {
  border-color: rgba(var(--primary-rgb), 0.8);
  background: rgba(var(--primary-rgb), 0.1);
  transform: scale(1.1);
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.1),
    0 0 8px rgba(var(--primary-rgb), 0.2);
}

/* ==========================================================================
   Floating Toolbar with Advanced Animations
   ========================================================================== */
.multi-select-toolbar {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  min-width: 200px;
  background:
    linear-gradient(135deg, var(--glass-bg-strong) 0%, var(--glass-bg-medium) 100%),
    linear-gradient(225deg, var(--glass-bg-light) 0%, var(--glass-bg-soft) 100%);

  border: 1px solid var(--glass-border-medium);
  border-radius: var(--radius-lg);

  box-shadow:
    var(--shadow-strong),
    var(--shadow-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);

  backdrop-filter: var(--blur-strong);
  z-index: 1000;
}

.toolbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  gap: 12px;
}

.toolbar-counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}

.counter-number {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1;
}

.counter-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.toolbar-actions {
  display: flex;
  gap: 4px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast) var(--spring-smooth);

  /* Performance optimizations */
  transform: translateZ(0);
  will-change: transform, background-color, color;
}

.toolbar-btn:hover {
  background: var(--glass-bg-medium);
  border-color: rgba(var(--primary-rgb), 0.3);
  color: rgba(var(--primary-rgb), 0.9);
  transform: translateY(-1px) translateZ(0);
}

.toolbar-btn--active {
  background: var(--state-selected);
  border-color: rgba(var(--primary-rgb), 0.6);
  color: white;
}

/* ==========================================================================
   Keyboard Shortcuts Hint
   ========================================================================== */
.keyboard-hints {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border-medium);
  border-radius: var(--radius-md);
  padding: 8px;
  backdrop-filter: var(--blur-medium);
  z-index: 1001;
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.hint-item kbd {
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border-subtle);
  border-radius: var(--radius-xs);
  padding: 2px 6px;
  font-family: monospace;
  font-size: 10px;
  color: var(--text-primary);
}

/* ==========================================================================
   Advanced Animation System
   ========================================================================== */
@keyframes checkmarkAppear {
  0% {
    transform: scale(0) rotate(-45deg) translateZ(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2) rotate(10deg) translateZ(0);
    opacity: 0.8;
  }
  100% {
    transform: scale(1) rotate(0) translateZ(0);
    opacity: 1;
  }
}

@keyframes borderPulse {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.02);
  }
}

@keyframes toolbarFadeIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

.toolbar-fade-enter-active {
  animation: toolbarFadeIn 0.3s var(--ease-out-back);
}

.toolbar-fade-leave-active {
  animation: toolbarFadeIn 0.2s var(--spring-smooth) reverse;
}

/* ==========================================================================
   Size Variants with Proper Scaling
   ========================================================================== */
.toggle-box--sm {
  width: 20px;
  height: 20px;
}

.toggle-box--sm .toggle-box__empty-inner {
  width: 10px;
  height: 10px;
}

.toggle-box--lg {
  width: 28px;
  height: 28px;
}

.toggle-box--lg .toggle-box__empty-inner {
  width: 14px;
  height: 14px;
}

/* ==========================================================================
   Accessibility and Reduced Motion Support
   ========================================================================== */
@media (prefers-reduced-motion: reduce) {
  .toggle-box,
  .toggle-box__content,
  .toggle-box__empty-inner,
  .toolbar-btn {
    transition-duration: 0.001ms;
    transform: none;
    will-change: auto;
  }

  .toggle-box__check,
  .toggle-box__indeterminate {
    animation: none;
  }

  .toggle-box__border-glow {
    animation: none;
  }

  .toolbar-fade-enter-active,
  .toolbar-fade-leave-active {
    animation: none;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .toggle-box {
    background: rgba(255, 255, 255, 0.95) !important;
    border: 2px solid #000 !important;
  }

  .toggle-box--selected {
    background: #000 !important;
    color: #fff !important;
  }

  .toggle-box:focus-visible {
    outline: 3px solid #000;
    outline-offset: 2px;
  }
}

/* Screen reader only class */
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