<template>
  <button
    :class="[
      'base-icon-button',
      `variant-${variant}`,
      `size-${size}`,
      { 'is-active': active }
    ]"
    :type="type"
    :disabled="disabled"
    :title="title"
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
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
  active: false,
  disabled: false,
  type: 'button'
})

defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<style scoped>
/* Base Icon Button - Matches screenshot icon buttons */
.base-icon-button {
  /* Layout - Square shape */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  /* Visual - Subtle, refined */
  background: var(--surface-tertiary);
  border: 1px solid var(--border-subtle);
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
  background: var(--surface-elevated);
  border-color: var(--border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.base-icon-button:active:not(:disabled) {
  transform: scale(0.95);
}

.base-icon-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Size Variants - matching screenshot icon sizes */
.base-icon-button.size-sm {
  width: 28px;
  height: 28px;
}

.base-icon-button.size-md {
  width: 32px;
  height: 32px;
}

.base-icon-button.size-lg {
  width: 40px;
  height: 40px;
}

/* Active State */
.base-icon-button.is-active {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: var(--surface-primary);
  box-shadow: 0 0 12px var(--purple-border-medium);
}

.base-icon-button.is-active:hover:not(:disabled) {
  background: var(--brand-hover);
  border-color: var(--brand-hover);
}

/* Variant: Primary (brand color) */
.base-icon-button.variant-primary {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: var(--surface-primary);
}

.base-icon-button.variant-primary:hover:not(:disabled) {
  background: var(--brand-hover);
  box-shadow: var(--shadow-md);
}

/* Variant: Success (green) */
.base-icon-button.variant-success {
  color: var(--color-work);
}

.base-icon-button.variant-success:hover:not(:disabled) {
  background: var(--success-bg-light);
  border-color: var(--success-bg-subtle);
}

/* Variant: Warning (orange) */
.base-icon-button.variant-warning {
  color: var(--color-break);
}

.base-icon-button.variant-warning:hover:not(:disabled) {
  background: var(--orange-bg-light);
  border-color: var(--orange-bg-medium);
}

/* Variant: Danger (red) */
.base-icon-button.variant-danger {
  color: var(--color-danger);
}

.base-icon-button.variant-danger:hover:not(:disabled) {
  background: var(--danger-bg-subtle);
  border-color: var(--danger-bg-medium);
}
</style>
