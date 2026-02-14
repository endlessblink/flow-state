<template>
  <button
    class="base-icon-button"
    :class="[
      `variant-${variant}`,
      `size-${size}`,
      { 'is-active': active }
    ]"
    :type="type"
    :disabled="disabled"
    :title="title"
    :aria-label="ariaLabel || title"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  active?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  title?: string
  ariaLabel?: string
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
  active: false,
  disabled: false,
  type: 'button',
  title: undefined,
  ariaLabel: undefined
})

defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<style scoped>
/* BaseIconButton - Stroke + Glass Morphism Design */
.base-icon-button {
  /* Layout - Square shape */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  /* Stroke-based design - transparent with border */
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  border-radius: var(--radius-md);

  /* Animation */
  transition: all var(--duration-fast) var(--spring-smooth);
  cursor: pointer;

  /* Remove default button styles */
  outline: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding: 0;
}

.base-icon-button:hover:not(:disabled) {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.base-icon-button:active:not(:disabled) {
  transform: scale(0.95);
}

.base-icon-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Focus state with visible indicator - Matching BaseButton */
.base-icon-button:focus-visible {
  outline: var(--space-0_5) solid var(--color-work);
  outline-offset: var(--space-0_5);
  box-shadow: 0 0 0 var(--space-1) rgba(var(--color-success), 0.1);
  z-index: var(--z-sticky); /* Ensure focus ring is visible above siblings */
}

/* Size Variants */
.base-icon-button.size-sm {
  width: var(--space-7);
  height: var(--space-7);
}

.base-icon-button.size-md {
  width: var(--space-8);
  height: var(--space-8);
}

.base-icon-button.size-lg {
  width: var(--space-10);
  height: var(--space-10);
}

/* Active State - Teal stroke */
.base-icon-button.is-active {
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.base-icon-button.is-active:hover:not(:disabled) {
  border-color: var(--brand-hover);
  background: var(--brand-primary-bg-medium);
}

/* Variant: Primary (teal) */
.base-icon-button.variant-primary {
  background: var(--brand-primary-bg-tint);
  border-color: var(--brand-primary-alpha-30);
  color: var(--brand-primary);
}

.base-icon-button.variant-primary:hover:not(:disabled) {
  border-color: var(--brand-primary);
  background: var(--brand-primary-bg-subtle);
}

/* Variant: Success (green) - stroke only */
.base-icon-button.variant-success {
  background: var(--color-success-bg-tint);
  border-color: var(--color-success-alpha-30);
  color: var(--color-success);
}

.base-icon-button.variant-success:hover:not(:disabled) {
  border-color: var(--color-success-alpha-50);
  background: var(--color-success-bg-subtle);
}

/* Variant: Warning (orange) - stroke only */
.base-icon-button.variant-warning {
  background: var(--color-warning-bg-tint);
  border-color: var(--color-warning-alpha-30);
  color: var(--color-warning);
}

.base-icon-button.variant-warning:hover:not(:disabled) {
  border-color: var(--color-warning-alpha-50);
  background: var(--color-warning-bg-subtle);
}

/* Variant: Danger (red) - stroke only */
.base-icon-button.variant-danger {
  background: var(--color-danger-bg-tint);
  border-color: var(--color-danger-alpha-30);
  color: var(--color-danger);
}

.base-icon-button.variant-danger:hover:not(:disabled) {
  border-color: var(--color-danger-alpha-50);
  background: var(--color-danger-bg-light);
}
</style>
