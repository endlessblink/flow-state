<template>
  <div
    class="base-card"
    :class="[
      variant,
      {
        'has-hover': hoverable,
        'is-glass': glass,
        'is-elevated': elevated
      }
    ]"
    @click="hoverable && $emit('click', $event)"
  >
    <div v-if="$slots.header" class="card-header">
      <slot name="header" />
    </div>

    <div class="card-content">
      <slot />
    </div>

    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'default' | 'outlined' | 'filled'
  hoverable?: boolean
  glass?: boolean
  elevated?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  hoverable: false,
  glass: false,
  elevated: false
})

defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<style scoped>
/* Base Card - Stroke + Glass Morphism Design (matches BaseModal) */
.base-card {
  /* Glass morphism base */
  background: var(--glass-bg-solid);
  backdrop-filter: blur(20px) saturate(100%);
  -webkit-backdrop-filter: blur(20px) saturate(100%);

  /* Stroke border - no fills */
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);

  /* Layered shadow for depth */
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.8),
    0 4px 16px rgba(0, 0, 0, 0.4);

  /* Animation */
  transition: all var(--duration-normal) var(--spring-smooth);

  /* Layout */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Hover effect - teal glow for interactive cards */
.base-card.has-hover {
  cursor: pointer;
}

.base-card.has-hover:hover {
  border-color: var(--glass-border-hover);
  background: var(--glass-bg-medium);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.9),
    0 6px 20px rgba(0, 0, 0, 0.5);
  transform: translateY(-2px);
}

/* Glass variant - same base look, just adds inset highlight for colorful backgrounds */
.base-card.is-glass {
  background: var(--glass-bg-solid);
  backdrop-filter: blur(20px) saturate(100%);
  -webkit-backdrop-filter: blur(20px) saturate(100%);
  border: 1px solid var(--glass-border);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 4px 16px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.base-card.is-glass:hover {
  border-color: var(--glass-border-hover);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.5),
    0 6px 20px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

/* Elevated variant - same base look, just deeper shadows for hierarchy */
.base-card.is-elevated {
  background: var(--glass-bg-solid);
  backdrop-filter: blur(20px) saturate(100%);
  -webkit-backdrop-filter: blur(20px) saturate(100%);
  border: 1px solid var(--glass-border);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    0 8px 24px rgba(0, 0, 0, 0.3);
}

.base-card.is-elevated:hover {
  border-color: var(--glass-border-hover);
  box-shadow:
    0 20px 56px rgba(0, 0, 0, 0.6),
    0 10px 30px rgba(0, 0, 0, 0.4);
}

/* Variant: Outlined - pure stroke, transparent */
.base-card.outlined {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 1px solid var(--glass-border-hover);
  box-shadow: none;
}

.base-card.outlined:hover {
  background: var(--glass-bg-tint);
  border-color: var(--border-interactive);
}

/* Variant: Filled - subtle glass fill (not solid) */
.base-card.filled {
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
}

/* Card sections */
.card-header {
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
}

.card-content {
  padding: var(--space-6);
  flex: 1;
}

.card-footer {
  padding: var(--space-6);
  border-top: 1px solid var(--border-subtle);
  /* Subtle gradient instead of solid fill */
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(255, 255, 255, 0.02) 100%
  );
}

/* Compact variant (no padding on sections) */
.base-card.compact .card-header,
.base-card.compact .card-content,
.base-card.compact .card-footer {
  padding: var(--space-4);
}
</style>
