<template>
  <span
    :class="[
      'base-badge',
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
/* Base Badge - Matches screenshot count badges */
.base-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);

  /* Typography */
  font-family: var(--font-sans);
  font-weight: var(--font-semibold);
  line-height: 1;

  /* Visual */
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--spring-smooth);
}

/* Size Variants */
.base-badge.size-sm {
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  min-width: 20px;
  height: 18px;
}

.base-badge.size-md {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  min-width: 24px;
  height: 20px;
}

.base-badge.size-lg {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
  min-width: 28px;
  height: 24px;
}

/* Fully rounded (pill shape) */
.base-badge.is-rounded {
  border-radius: var(--radius-full);
}

/* Variant: Default (neutral count badge from screenshots) */
.base-badge.variant-default {
  background: var(--glass-bg-heavy);
  color: var(--text-muted);
  border: 1px solid var(--glass-bg-soft);
}

/* Variant: Count (like the sidebar count badges) */
.base-badge.variant-count {
  background: var(--glass-bg-soft);
  color: var(--text-muted);
  border: none;
  font-weight: var(--font-medium);
}

/* Variant: Success (green) */
.base-badge.variant-success {
  background: var(--success-bg-light);
  color: var(--color-work);
  border: 1px solid var(--success-bg-subtle);
}

/* Variant: Warning (orange) */
.base-badge.variant-warning {
  background: var(--orange-bg-light);
  color: var(--color-break);
  border: 1px solid var(--orange-bg-medium);
}

/* Variant: Danger (red) */
.base-badge.variant-danger {
  background: var(--danger-bg-subtle);
  color: var(--color-priority-high);
  border: 1px solid var(--danger-bg-medium);
}

/* Variant: Info (blue) */
.base-badge.variant-info {
  background: var(--blue-bg-light);
  color: var(--color-navigation);
  border: 1px solid var(--blue-bg-medium);
}
</style>
