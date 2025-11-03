<template>
  <button
    :class="[
      'base-button',
      `variant-${variant}`,
      `size-${size}`,
      { 'icon-only': iconOnly }
    ]"
    :type="type"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  iconOnly?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  iconOnly: false,
  type: 'button',
  disabled: false
})

defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<style scoped>
/* Base Button - Outlined style with dramatic hover (THE ONE button system) */
.base-button {
  /* Layout */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);

  /* Typography */
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);

  /* Visual - Outlined style */
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  border-radius: var(--radius-lg);

  /* Animation */
  transition: all var(--duration-normal) var(--spring-smooth);
  cursor: pointer;

  /* Remove default button styles */
  outline: none;
  -webkit-appearance: none;
  -moz-appearance: none;
}

.base-button:hover:not(:disabled) {
  /* OUTLINED + GLASS on hover (not filled!) */
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  backdrop-filter: var(--state-active-glass);
  -webkit-backdrop-filter: var(--state-active-glass);
  color: var(--text-primary);
  transform: translateY(-2px);
  box-shadow: var(--state-hover-shadow), var(--state-hover-glow);
}

.base-button:active:not(:disabled) {
  transform: translateY(-1px) scale(0.98);
}

.base-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

/* Variant: Primary - Brand color */
.base-button.variant-primary {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
  color: var(--surface-primary);
}

.base-button.variant-primary:hover:not(:disabled) {
  background: var(--brand-hover);
  border-color: var(--brand-hover);
  box-shadow: var(--shadow-md);
}

.base-button.variant-primary:active:not(:disabled) {
  background: var(--brand-active);
}

/* Variant: Secondary - Default transparent */
.base-button.variant-secondary {
  /* Uses default token values */
}

/* Variant: Ghost - Minimal styling */
.base-button.variant-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--text-muted);
}

.base-button.variant-ghost:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: transparent;
  color: var(--text-primary);
}

/* Variant: Danger - Destructive actions */
.base-button.variant-danger {
  background: transparent;
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.base-button.variant-danger:hover:not(:disabled) {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: var(--surface-primary);
  box-shadow: var(--shadow-md);
}
</style>
