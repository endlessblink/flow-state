<script setup lang="ts">
/**
 * Level Badge Component
 * FEATURE-1118: Displays current level with glowing neon effect
 */
import { computed } from 'vue'
import { useGamificationStore } from '@/stores/gamification'

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  showPulse?: boolean
}>(), {
  size: 'md',
  showPulse: false
})

const gamificationStore = useGamificationStore()
const level = computed(() => gamificationStore.currentLevel)

const sizeClasses = computed(() => ({
  sm: 'level-badge--sm',
  md: 'level-badge--md',
  lg: 'level-badge--lg'
}[props.size]))
</script>

<template>
  <div
    class="level-badge"
    :class="[sizeClasses, { 'level-badge--pulse': showPulse }]"
    :title="`Level ${level}`"
  >
    <span class="level-number">{{ level }}</span>
    <div class="level-glow" />
  </div>
</template>

<style scoped>
.level-badge {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--level-badge-bg);
  border: var(--level-badge-border);
  box-shadow: var(--level-badge-glow);
  font-weight: var(--font-bold);
  color: rgba(var(--neon-cyan), 1);
  user-select: none;
  cursor: default;
}

.level-badge--sm {
  width: var(--space-8);
  height: var(--space-8);
  font-size: var(--text-sm);
}

.level-badge--md {
  width: var(--level-badge-size);
  height: var(--level-badge-size);
  font-size: var(--level-badge-font-size);
}

.level-badge--lg {
  width: var(--space-16);
  height: var(--space-16);
  font-size: var(--text-2xl);
}

.level-badge--pulse {
  animation: levelUpPulse 1.5s ease-in-out infinite;
}

.level-number {
  position: relative;
  z-index: 1;
  text-shadow: 0 0 var(--space-2) rgba(var(--neon-cyan), 0.8);
}

.level-glow {
  position: absolute;
  inset: calc(-1 * var(--space-1));
  border-radius: var(--radius-full);
  background: radial-gradient(
    circle,
    rgba(var(--neon-cyan), 0.15) 0%,
    transparent 70%
  );
  pointer-events: none;
}

/* Hover effect */
.level-badge:hover {
  transform: scale(1.05);
  transition: transform var(--duration-normal) var(--ease-out);
}

.level-badge:hover .level-glow {
  background: radial-gradient(
    circle,
    rgba(var(--neon-cyan), 0.25) 0%,
    transparent 70%
  );
}
</style>
