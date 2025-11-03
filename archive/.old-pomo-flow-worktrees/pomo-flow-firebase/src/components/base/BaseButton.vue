<template>
  <button
    :id="id"
    :class="[
      'base-button',
      `variant-${variant}`,
      `size-${size}`,
      {
        'icon-only': iconOnly,
        'loading': loading,
        'disabled': disabled
      }
    ]"
    :type="type"
    :disabled="disabled || loading"
    :aria-describedby="ariaDescribedBy"
    :aria-label="ariaLabel"
    :aria-pressed="pressed"
    :aria-busy="loading"
    :aria-disabled="disabled"
    @click="handleClick"
    @keydown="handleKeydown"
    ref="buttonRef"
  >
    <!-- Loading spinner -->
    <div v-if="loading" class="loading-spinner" aria-hidden="true">
      <div class="spinner"></div>
    </div>

    <!-- Button content -->
    <span class="button-content" :class="{ 'visually-hidden': loading }">
      <slot />
    </span>

    <!-- Keyboard focus indicator -->
    <div class="focus-indicator" aria-hidden="true"></div>
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  id?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'active'
  size?: 'sm' | 'md' | 'lg'
  iconOnly?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  pressed?: boolean
  ariaLabel?: string
  ariaDescribedBy?: string
  loadingText?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  iconOnly: false,
  type: 'button',
  disabled: false,
  loading: false,
  pressed: false,
  loadingText: 'Loading...'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
  keydown: [event: KeyboardEvent]
  focus: [event: FocusEvent]
  blur: [event: FocusEvent]
}>()

const buttonRef = ref<HTMLButtonElement>()

const handleClick = (event: MouseEvent) => {
  if (props.disabled || props.loading) {
    event.preventDefault()
    return
  }
  emit('click', event)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled || props.loading) {
    event.preventDefault()
    return
  }

  // Enhanced keyboard support
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    event.target?.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }))
  }

  emit('keydown', event)
}

// Public methods for programmatic focus
const focus = () => {
  buttonRef.value?.focus()
}

const blur = () => {
  buttonRef.value?.blur()
}

// Expose methods to parent
defineExpose({
  focus,
  blur,
  element: buttonRef
})
</script>

<style scoped>
/* Accessibility utilities */
.visually-hidden {
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

/* Base Button - Enhanced with accessibility and loading states */
.base-button {
  /* Layout */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  position: relative;

  /* Typography */
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: 1.4;
  text-decoration: none;
  white-space: nowrap;

  /* Visual - Outlined style */
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  border-radius: var(--radius-lg);
  outline: none;

  /* Animation - Enhanced transitions */
  transition: all var(--duration-normal) var(--spring-smooth);
  cursor: pointer;
  overflow: hidden;

  /* Remove default button styles */
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    border-width: 2px;
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    transition: opacity 0.2s ease;
  }
}

/* Enhanced hover states with consistent transitions */
.base-button:hover:not(:disabled):not(.loading) {
  /* OUTLINED + GLASS on hover (not filled!) */
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

/* Active state with improved feedback */
.base-button:active:not(:disabled):not(.loading) {
  transform: translateY(-1px) scale(0.98);
  transition: transform 0.1s ease;
}

/* Focus state with visible indicator */
.base-button:focus-visible {
  outline: 2px solid var(--color-work);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
}

/* Focus indicator for better visibility */
.base-button .focus-indicator {
  position: absolute;
  inset: -2px;
  border: 2px solid transparent;
  border-radius: calc(var(--radius-lg) + 2px);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.base-button:focus-visible .focus-indicator {
  opacity: 1;
  border-color: var(--color-work);
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
}

/* Disabled state with better accessibility */
.base-button:disabled,
.base-button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

/* Loading state */
.base-button.loading {
  cursor: wait;
  pointer-events: none;
}

.base-button.loading:hover {
  transform: none;
  box-shadow: none;
}

/* Loading spinner */
.loading-spinner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: inherit;
  border-radius: inherit;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-inline-end-color: transparent; /* RTL: spinner arc rotation */
  border-radius: 50%;
  animation: spin 1s linear infinite;
  opacity: 0.7;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Button content transitions */
.button-content {
  transition: opacity 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.base-button.loading .button-content.visually-hidden {
  opacity: 0;
}

/* Size Variants - using spacing tokens */
.base-button.size-sm {
  height: var(--btn-sm);
  padding: 0 var(--space-3);
  font-size: var(--text-xs);
}

.base-button.size-md {
  height: var(--btn-md);
  padding: 0 var(--space-4);
}

.base-button.size-lg {
  height: var(--btn-lg);
  padding: 0 var(--space-6);
  font-size: var(--text-base);
}

/* Icon-only buttons - square shape */
.base-button.icon-only.size-sm {
  width: var(--btn-sm);
  padding: 0;
}

.base-button.icon-only.size-md {
  width: var(--btn-md);
  padding: 0;
}

.base-button.icon-only.size-lg {
  width: var(--btn-lg);
  padding: 0;
}

/* Enhanced Variant Styles with consistent interactions */

/* Variant: Primary - Brand color */
.base-button.variant-primary {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: var(--surface-primary);
  font-weight: var(--font-semibold);
}

.base-button.variant-primary:hover:not(:disabled):not(.loading) {
  background: var(--brand-hover);
  border-color: var(--brand-hover);
  box-shadow: var(--state-hover-shadow), 0 4px 12px rgba(34, 197, 94, 0.3);
  transform: translateY(-2px);
}

.base-button.variant-primary:active:not(:disabled):not(.loading) {
  background: var(--brand-active);
  transform: translateY(-1px) scale(0.98);
}

.base-button.variant-primary.loading .spinner {
  border-color: var(--surface-primary);
  border-inline-end-color: transparent; /* RTL: spinner arc rotation */
}

/* Variant: Secondary - Default transparent with glass effect */
.base-button.variant-secondary {
  background: var(--glass-bg-light);
  border-color: var(--glass-border);
  color: var(--text-secondary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.base-button.variant-secondary:hover:not(:disabled):not(.loading) {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
}

/* Variant: Ghost - Minimal styling with subtle effects */
.base-button.variant-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--text-muted);
}

.base-button.variant-ghost:hover:not(:disabled):not(.loading) {
  background: var(--surface-hover);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.base-button.variant-ghost:focus-visible {
  background: var(--surface-hover);
}

/* Variant: Danger - Destructive actions with clear feedback */
.base-button.variant-danger {
  background: transparent;
  border-color: var(--color-danger);
  color: var(--color-danger);
  font-weight: var(--font-medium);
}

.base-button.variant-danger:hover:not(:disabled):not(.loading) {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: var(--surface-primary);
  box-shadow: var(--shadow-md), 0 4px 12px rgba(239, 68, 68, 0.3);
  transform: translateY(-2px);
}

.base-button.variant-danger:active:not(:disabled):not(.loading) {
  background: rgba(239, 68, 68, 0.9);
  transform: translateY(-1px) scale(0.98);
}

.base-button.variant-danger.loading .spinner {
  border-color: var(--surface-primary);
  border-inline-end-color: transparent; /* RTL: spinner arc rotation */
}

/* Variant: Active - Selected/active state with outlined teal + glass */
.base-button.variant-active {
  background: var(--state-active-bg);       /* Glass with teal tint (15% opacity) */
  border-color: var(--brand-primary);       /* Teal outline */
  color: var(--text-primary);
  backdrop-filter: blur(12px) saturate(120%);
  -webkit-backdrop-filter: blur(12px) saturate(120%);
  font-weight: var(--font-medium);
  box-shadow: var(--state-hover-shadow);    /* Subtle glow */
}

.base-button.variant-active:hover:not(:disabled):not(.loading) {
  background: var(--state-hover-bg);        /* Slightly more teal on hover */
  border-color: var(--brand-hover);         /* Lighter teal border */
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
  transform: translateY(-1px);
}

.base-button.variant-active:active:not(:disabled):not(.loading) {
  background: var(--state-active-bg);
  transform: translateY(0) scale(0.98);
}

.base-button.variant-active.loading .spinner {
  border-color: var(--brand-primary);
  border-inline-end-color: transparent; /* RTL: spinner arc rotation */
}

/* High contrast mode adjustments */
@media (prefers-contrast: high) {
  .base-button.variant-ghost {
    border-color: var(--border-medium);
  }

  .base-button.variant-ghost:hover {
    border-color: var(--border-strong);
  }
}
</style>
