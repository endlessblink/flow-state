<script setup lang="ts">
/**
 * Level Badge Component
 * FEATURE-1118: Displays current level with glowing neon effect
 * Live level-up ring animation replaces toast notifications
 */
import { computed, ref, watch } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import type { XpAnimationEvent } from '@/composables/useXpAnimations'

const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  showPulse?: boolean
  levelEvent?: XpAnimationEvent | undefined
}>(), {
  size: 'md',
  showPulse: false,
  levelEvent: undefined
})

const gamificationStore = useGamificationStore()
const level = computed(() => gamificationStore.currentLevel)

const sizeClasses = computed(() => ({
  sm: 'level-badge--sm',
  md: 'level-badge--md',
  lg: 'level-badge--lg'
}[props.size]))

const isLevelingUp = ref(false)

watch(() => props.levelEvent, (event) => {
  if (event && event.type === 'level_up') {
    isLevelingUp.value = true
    setTimeout(() => { isLevelingUp.value = false }, 2000)
  }
})
</script>

<template>
  <div
    class="level-badge"
    :class="[sizeClasses, { 'level-badge--pulse': showPulse }]"
  >
    <span class="level-number">{{ level }}</span>
    <div class="level-glow" />
    <div v-if="isLevelingUp" class="level-up-ring" />
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

/* Level-up ring animation */
.level-up-ring {
  position: absolute;
  inset: -4px;
  border-radius: var(--radius-full);
  border: 2px solid rgba(var(--neon-magenta), 0.8);
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .level-up-ring {
    animation: levelUpRing 1.5s ease-out forwards;
  }

  @keyframes levelUpRing {
    0% {
      transform: scale(1);
      opacity: 1;
      border-width: 2px;
    }
    50% {
      transform: scale(1.6);
      opacity: 0.6;
      border-width: 1px;
    }
    100% {
      transform: scale(2.2);
      opacity: 0;
      border-width: 0.5px;
    }
  }
}

/* Override the badge glow during level-up */
.level-badge:has(.level-up-ring) {
  box-shadow: 0 0 12px rgba(var(--neon-magenta), 0.6),
              0 0 24px rgba(var(--neon-magenta), 0.3);
}

.level-badge:has(.level-up-ring) .level-number {
  color: rgba(var(--neon-magenta), 1);
  text-shadow: 0 0 8px rgba(var(--neon-magenta), 0.8);
}

@media (prefers-reduced-motion: no-preference) {
  .level-badge:has(.level-up-ring) .level-number {
    animation: levelNumberPop 0.4s ease-out;
  }

  @keyframes levelNumberPop {
    0% { transform: scale(1); }
    40% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }
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
