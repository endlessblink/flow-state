<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    accentColor?: string
    clickable?: boolean
  }>(),
  {
    accentColor: 'var(--cf-cyan)',
    clickable: false,
  }
)

const emit = defineEmits<{
  click: []
}>()

const handleClick = () => {
  if (props.clickable) {
    emit('click')
  }
}
</script>

<template>
  <div
    class="cyber-summary-card"
    :class="{ 'cyber-summary-card--clickable': clickable }"
    :style="{ '--accent-color': accentColor }"
    data-augmented-ui="tl-clip br-clip border"
    @click="handleClick"
  >
    <h3 class="cyber-summary-card__title">{{ title }}</h3>
    <div class="cyber-summary-card__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.cyber-summary-card {
  background: var(--cf-dark-2);
  padding: var(--space-4);
  min-height: 160px;
  position: relative;
  transition: all 0.2s ease;
  --aug-tl1: var(--space-4);
  --aug-br1: var(--space-4);
  --aug-border-all: 1px;
  --aug-border-bg: var(--accent-color);
}

@media (prefers-reduced-motion: reduce) {
  .cyber-summary-card {
    transition: none;
  }
}

.cyber-summary-card--clickable {
  cursor: pointer;
}

.cyber-summary-card--clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px var(--cf-cyan-20);
}

@media (prefers-reduced-motion: reduce) {
  .cyber-summary-card--clickable:hover {
    transform: none;
    box-shadow: none;
  }
}

.cyber-summary-card__title {
  font-family: var(--font-cyber-title);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-color);
  margin: 0 0 var(--space-3) 0;
}

.cyber-summary-card__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
