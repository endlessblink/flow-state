<script setup lang="ts">
/**
 * XP Progress Bar Component
 * FEATURE-1118: Displays XP progress toward next level with neon glow effect
 * Live XP counter animations replace toast notifications
 */
import { computed, ref, watch } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import type { XpAnimationEvent } from '@/composables/useXpAnimations'

const props = withDefaults(defineProps<{
  showLabel?: boolean
  compact?: boolean
  animated?: boolean
  xpEvent?: XpAnimationEvent | undefined
}>(), {
  showLabel: true,
  compact: false,
  animated: true,
  xpEvent: undefined
})

const gamificationStore = useGamificationStore()

const levelInfo = computed(() => gamificationStore.levelInfo)
const progressPercent = computed(() => levelInfo.value.progressPercent)
const currentXp = computed(() => levelInfo.value.currentXp)
const xpForNext = computed(() => levelInfo.value.xpForNextLevel)

// Floater state
const floaters = ref<Array<{ id: string; amount: number; key: number }>>([])
const isGlowing = ref(false)

watch(() => props.xpEvent, (event) => {
  if (event && event.type === 'xp_gain' && event.amount) {
    // Add floater
    const floater = { id: event.id, amount: event.amount, key: Date.now() }
    floaters.value.push(floater)

    // Trigger glow
    isGlowing.value = true

    // Clean up
    setTimeout(() => {
      floaters.value = floaters.value.filter(f => f.id !== floater.id)
    }, 1500)
    setTimeout(() => {
      isGlowing.value = false
    }, 800)
  }
})
</script>

<template>
  <div
    class="xp-bar-container"
    :class="{ compact }"
  >
    <div
      v-if="showLabel && !compact"
      class="xp-label"
      :class="{ 'xp-label--glow': isGlowing }"
    >
      <span class="xp-current">{{ currentXp.toLocaleString() }}</span>
      <span class="xp-separator">/</span>
      <span class="xp-target">{{ xpForNext.toLocaleString() }} XP</span>

      <!-- XP Floaters -->
      <TransitionGroup name="xp-floater">
        <span
          v-for="floater in floaters"
          :key="floater.key"
          class="xp-floater"
        >
          +{{ floater.amount }}
        </span>
      </TransitionGroup>
    </div>

    <div class="xp-bar-track">
      <div
        class="xp-bar-fill"
        :class="{ animated, 'xp-bar-fill--pulse': isGlowing }"
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
  position: relative;
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  font-size: var(--text-sm);
}

.xp-current {
  color: rgba(var(--neon-cyan), 1);
  font-weight: var(--font-semibold);
  transition: transform 0.2s ease-out, text-shadow 0.2s ease-out;
}

/* XP Label glow on gain */
.xp-label--glow .xp-current {
  text-shadow: 0 0 8px rgba(var(--neon-cyan), 0.8);
  transform: scale(1.1);
}

.xp-separator {
  color: var(--gamification-text-secondary);
}

.xp-target {
  color: var(--gamification-text-secondary);
}

/* Floating +XP numbers */
.xp-floater {
  position: absolute;
  left: 0;
  top: 0;
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: rgba(var(--neon-cyan), 1);
  text-shadow: 0 0 6px rgba(var(--neon-cyan), 0.6);
  pointer-events: none;
  white-space: nowrap;
}

@media (prefers-reduced-motion: no-preference) {
  .xp-floater-enter-active {
    animation: floatUp 1.5s ease-out forwards;
  }

  .xp-floater-leave-active {
    display: none;
  }

  @keyframes floatUp {
    0% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    50% {
      opacity: 0.8;
      transform: translateY(-16px) scale(1.1);
    }
    100% {
      opacity: 0;
      transform: translateY(-28px) scale(0.9);
    }
  }
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

/* Bar pulse on XP gain */
@media (prefers-reduced-motion: no-preference) {
  .xp-bar-fill--pulse {
    animation: barPulse 0.6s ease-out;
  }

  @keyframes barPulse {
    0% { filter: brightness(1); }
    30% { filter: brightness(1.6); }
    100% { filter: brightness(1); }
  }
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
