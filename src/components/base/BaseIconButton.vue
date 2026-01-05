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

/* Size Variants */
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

/* Active State - Teal stroke */
.base-icon-button.is-active {
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.base-icon-button.is-active:hover:not(:disabled) {
  border-color: var(--brand-hover);
  background: rgba(78, 205, 196, 0.15);
}

/* Variant: Primary (teal) */
.base-icon-button.variant-primary {
  background: rgba(78, 205, 196, 0.05);
  border-color: rgba(78, 205, 196, 0.3);
  color: var(--brand-primary);
}

.base-icon-button.variant-primary:hover:not(:disabled) {
  border-color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.1);
}

/* Variant: Success (green) - stroke only */
.base-icon-button.variant-success {
  background: rgba(16, 185, 129, 0.05);
  border-color: rgba(16, 185, 129, 0.3);
  color: #4ade80;
}

.base-icon-button.variant-success:hover:not(:disabled) {
  border-color: rgba(16, 185, 129, 0.5);
  background: rgba(16, 185, 129, 0.1);
}

/* Variant: Warning (orange) - stroke only */
.base-icon-button.variant-warning {
  background: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.3);
  color: #fbbf24;
}

.base-icon-button.variant-warning:hover:not(:disabled) {
  border-color: rgba(245, 158, 11, 0.5);
  background: rgba(245, 158, 11, 0.1);
}

/* Variant: Danger (red) - stroke only */
.base-icon-button.variant-danger {
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.3);
  color: #f87171;
}

.base-icon-button.variant-danger:hover:not(:disabled) {
  border-color: rgba(239, 68, 68, 0.5);
  background: rgba(239, 68, 68, 0.1);
}
</style>
