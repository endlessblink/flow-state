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
  background: rgba(16, 185, 129, 0.05);
  color: #4ade80;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

/* Variant: Warning (orange stroke) */
.base-badge.variant-warning {
  background: rgba(245, 158, 11, 0.05);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

/* Variant: Danger (red stroke) */
.base-badge.variant-danger {
  background: rgba(239, 68, 68, 0.05);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* Variant: Info (blue stroke) */
.base-badge.variant-info {
  background: rgba(59, 130, 246, 0.05);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}
</style>
