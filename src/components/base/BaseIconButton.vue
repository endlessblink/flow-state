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
  type: 'button',
  title: undefined
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
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: 0 0 12px rgba(78, 205, 196, 0.1);
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
  background: transparent;
  border-color: rgba(78, 205, 196, 0.5);
  color: rgba(78, 205, 196, 1);
  box-shadow: 0 0 8px rgba(78, 205, 196, 0.2);
}

.base-icon-button.is-active:hover:not(:disabled) {
  border-color: rgba(78, 205, 196, 0.7);
  box-shadow: 0 0 12px rgba(78, 205, 196, 0.3);
}

/* Variant: Primary (teal) */
.base-icon-button.variant-primary {
  background: transparent;
  border-color: rgba(78, 205, 196, 0.4);
  color: rgba(78, 205, 196, 1);
}

.base-icon-button.variant-primary:hover:not(:disabled) {
  border-color: rgba(78, 205, 196, 0.6);
  box-shadow: 0 0 12px rgba(78, 205, 196, 0.2);
}

/* Variant: Success (green) - stroke only */
.base-icon-button.variant-success {
  background: transparent;
  border-color: rgba(16, 185, 129, 0.4);
  color: rgba(16, 185, 129, 1);
}

.base-icon-button.variant-success:hover:not(:disabled) {
  border-color: rgba(16, 185, 129, 0.6);
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);
}

/* Variant: Warning (orange) - stroke only */
.base-icon-button.variant-warning {
  background: transparent;
  border-color: rgba(245, 158, 11, 0.4);
  color: rgba(245, 158, 11, 1);
}

.base-icon-button.variant-warning:hover:not(:disabled) {
  border-color: rgba(245, 158, 11, 0.6);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.2);
}

/* Variant: Danger (red) - stroke only */
.base-icon-button.variant-danger {
  background: transparent;
  border-color: rgba(239, 68, 68, 0.4);
  color: rgba(239, 68, 68, 1);
}

.base-icon-button.variant-danger:hover:not(:disabled) {
  border-color: rgba(239, 68, 68, 0.6);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.2);
}
</style>
