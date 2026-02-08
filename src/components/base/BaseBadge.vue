<template>
  <span
    class="base-badge"
    :class="[
      `variant-${variant}`,
      `size-${size}`,
      { 'is-rounded': rounded }
    ]"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'count'
  size?: 'sm' | 'md' | 'lg'
  rounded?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
  rounded: false
})
</script>

<style scoped>
/* Base Badge - Stroke + Glass Morphism Design */
.base-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);

  /* Typography */
  font-family: var(--font-sans);
  font-weight: var(--font-semibold);
  line-height: 1;

  /* Visual - Stroke based (no fills) */
  background: transparent;
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--spring-smooth);
}

/* Size Variants */
.base-badge.size-sm {
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  min-width: var(--space-5);
  height: var(--space-4_5);
}

.base-badge.size-md {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  min-width: var(--space-6);
  height: var(--space-5);
}

.base-badge.size-lg {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  min-width: var(--space-7);
  height: var(--space-6);
}

/* Fully rounded (pill shape) */
.base-badge.is-rounded {
  border-radius: var(--radius-full);
}

/* Variant: Default (neutral stroke badge) */
.base-badge.variant-default {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

/* Variant: Count (subtle stroke for count badges) */
.base-badge.variant-count {
  background: var(--glass-bg-light);
  color: var(--text-muted);
  border: 1px solid var(--glass-border);
  font-weight: var(--font-medium);
}

/* Variant: Success (green stroke) */
.base-badge.variant-success {
  background: var(--color-success-bg-tint);
  color: var(--color-success);
  border: 1px solid var(--color-success-alpha-30);
}

/* Variant: Warning (orange stroke) */
.base-badge.variant-warning {
  background: var(--color-warning-bg-tint);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-alpha-30);
}

/* Variant: Danger (red stroke) */
.base-badge.variant-danger {
  background: var(--color-danger-bg-tint);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-alpha-30);
}

/* Variant: Info (blue stroke) */
.base-badge.variant-info {
  background: var(--color-blue-bg-tint);
  color: var(--color-blue);
  border: 1px solid var(--color-blue-alpha-30);
}
</style>
