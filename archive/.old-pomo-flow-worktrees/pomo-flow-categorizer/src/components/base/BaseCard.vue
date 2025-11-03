<template>
  <div
    :class="[
      'base-card',
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
/* Base Card - Token-based design */
.base-card {
  /* Visual - all from tokens */
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--card-shadow);

  /* Animation */
  transition: all var(--duration-normal) var(--spring-smooth);

  /* Layout */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Hover effect */
.base-card.has-hover {
  cursor: pointer;
}

.base-card.has-hover:hover {
  border-color: var(--card-border-hover);
  box-shadow: var(--card-shadow-hover);
  transform: translateY(-2px);
}

/* Glass variant - dramatic glassmorphism */
.base-card.is-glass {
  background: var(--glass-bg-light);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
  border: 1px solid var(--glass-border);
  box-shadow: var(--shadow-glass);
}

.base-card.is-glass:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-hover);
  box-shadow: var(--shadow-glow);
}

/* Elevated variant - extra shadow */
.base-card.is-elevated {
  background: var(--surface-elevated);
  box-shadow: var(--shadow-lg);
}

.base-card.is-elevated:hover {
  box-shadow: var(--shadow-xl);
}

/* Variant: Outlined */
.base-card.outlined {
  background: transparent;
  border: 1px solid var(--border-medium);
  box-shadow: none;
}

.base-card.outlined:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}

/* Variant: Filled */
.base-card.filled {
  background: var(--surface-tertiary);
  border: none;
}

/* Card sections */
.card-header {
  padding: var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
}

.card-content {
  padding: var(--space-6);
  flex: 1;
}

.card-footer {
  padding: var(--space-6);
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-hover);
}

/* Compact variant (no padding on sections) */
.base-card.compact .card-header,
.base-card.compact .card-content,
.base-card.compact .card-footer {
  padding: var(--space-4);
}
</style>
