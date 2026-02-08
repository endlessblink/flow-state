<script setup lang="ts">
/**
 * XP Progress Bar Component
 * FEATURE-1118: Displays XP progress toward next level with neon glow effect
 */
import { computed } from 'vue'
import { useGamificationStore } from '@/stores/gamification'

const props = withDefaults(defineProps<{
  showLabel?: boolean
  compact?: boolean
  animated?: boolean
}>(), {
  showLabel: true,
  compact: false,
  animated: true
})

const gamificationStore = useGamificationStore()

const levelInfo = computed(() => gamificationStore.levelInfo)
const progressPercent = computed(() => levelInfo.value.progressPercent)
const currentXp = computed(() => levelInfo.value.currentXp)
const xpForNext = computed(() => levelInfo.value.xpForNextLevel)
</script>

<template>
  <div
    class="xp-bar-container"
    :class="{ compact }"
  >
    <div
      v-if="showLabel && !compact"
      class="xp-label"
    >
      <span class="xp-current">{{ currentXp.toLocaleString() }}</span>
      <span class="xp-separator">/</span>
      <span class="xp-target">{{ xpForNext.toLocaleString() }} XP</span>
    </div>

    <div class="xp-bar-track">
      <div
        class="xp-bar-fill"
        :class="{ animated }"
        :style="{ width: `${progressPercent}%` }"
      />
      <div
        class="xp-bar-glow"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>

    <div
      v-if="compact"
      class="xp-percent"
    >
      {{ progressPercent }}%
    </div>
  </div>
</template>

<style scoped>
.xp-bar-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
}

.xp-bar-container.compact {
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
}

.xp-label {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  font-size: var(--text-sm);
}

.xp-current {
  color: rgba(var(--neon-cyan), 1);
  font-weight: var(--font-semibold);
}

.xp-separator {
  color: var(--gamification-text-secondary);
}

.xp-target {
  color: var(--gamification-text-secondary);
}

.xp-bar-track {
  position: relative;
  height: var(--xp-bar-height);
  background: var(--xp-bar-bg);
  border-radius: var(--xp-bar-border-radius);
  overflow: hidden;
  flex: 1;
}

.xp-bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--xp-bar-gradient);
  border-radius: var(--xp-bar-border-radius);
  transition: width var(--duration-slower) var(--ease-out);
}

.xp-bar-fill.animated {
  animation: xpGlow 2s ease-in-out infinite;
}

.xp-bar-glow {
  position: absolute;
  top: calc(-1 * var(--space-px) * 2);
  left: 0;
  height: calc(100% + var(--space-1));
  background: transparent;
  box-shadow: var(--xp-bar-glow);
  border-radius: var(--xp-bar-border-radius);
  pointer-events: none;
  opacity: 0.6;
}

.xp-percent {
  font-size: var(--text-xs);
  color: rgba(var(--neon-cyan), 0.9);
  font-weight: var(--font-medium);
  min-width: var(--space-8);
  text-align: right;
}

.compact .xp-bar-track {
  height: var(--radius-sm);
}
</style>
