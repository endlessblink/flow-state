<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getCorruptionTier, CORRUPTION_TIERS } from '@/types/challenges'
import { useCyberflowTheme } from '@/composables/useCyberflowTheme'

const props = defineProps<{
  level: number
  tier: string
}>()

const { showAtIntensity } = useCyberflowTheme()

const currentTier = computed(() => getCorruptionTier(props.level))

const showGlitch = ref(false)
watch(() => props.level, () => {
  if (showAtIntensity('intense')) {
    showGlitch.value = true
    setTimeout(() => { showGlitch.value = false }, 300)
  }
})

const tierColors = ['#00f0ff', '#39ff14', '#ffff00', '#ff8800', '#ff3333']
const tierNames = ['Clean', 'Mild', 'Moderate', 'Heavy', 'Critical']

const indicatorPercent = computed(() => Math.min(100, Math.max(0, props.level)))

const activeTierIndex = computed(() => {
  const idx = CORRUPTION_TIERS.findIndex(t => props.level >= t.minLevel && props.level <= t.maxLevel)
  return idx >= 0 ? idx : 0
})
</script>

<template>
  <div
    class="corruption-meter"
    :class="{ 'corruption-meter--glitch': showGlitch }"
    role="meter"
    :aria-valuenow="level"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-label="`Corruption: ${level}% (${currentTier.tier})`"
  >
    <!-- Active tier name and level -->
    <div class="corruption-meter__header">
      <span
        class="corruption-meter__tier-name"
        :style="{ color: tierColors[activeTierIndex] }"
      >
        {{ tierNames[activeTierIndex] }}
      </span>
      <span class="corruption-meter__level-value">{{ level }}%</span>
    </div>

    <!-- Bar -->
    <div class="corruption-meter__bar">
      <!-- Gradient fill -->
      <div class="corruption-meter__gradient" />

      <!-- Tier boundary lines -->
      <div class="corruption-meter__boundaries">
        <div class="corruption-meter__boundary" style="left: 20%" />
        <div class="corruption-meter__boundary" style="left: 40%" />
        <div class="corruption-meter__boundary" style="left: 60%" />
        <div class="corruption-meter__boundary" style="left: 80%" />
      </div>

      <!-- Diamond position indicator -->
      <div
        class="corruption-meter__indicator"
        :style="{ left: `${indicatorPercent}%` }"
      />
    </div>

    <!-- Tier labels below -->
    <div class="corruption-meter__labels">
      <span
        v-for="(name, i) in tierNames"
        :key="name"
        class="corruption-meter__label"
        :class="{ 'corruption-meter__label--active': i === activeTierIndex }"
        :style="{ color: i === activeTierIndex ? tierColors[i] : undefined }"
      >
        {{ name }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.corruption-meter {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.corruption-meter__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.corruption-meter__tier-name {
  font-family: var(--font-cyber-title);
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.corruption-meter__level-value {
  font-family: var(--font-cyber-data);
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
}

.corruption-meter__bar {
  position: relative;
  height: 12px;
  border-radius: 6px;
  overflow: visible;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.corruption-meter__gradient {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: linear-gradient(90deg,
    #00f0ff 0%,
    #39ff14 20%,
    #ffff00 40%,
    #ff8800 60%,
    #ff3333 80%,
    #cc0000 100%
  );
  opacity: 0.8;
}

.corruption-meter__boundaries {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.corruption-meter__boundary {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.corruption-meter__indicator {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: white;
  border: 2px solid rgba(0, 0, 0, 0.6);
  transform: translate(-50%, -50%) rotate(45deg);
  z-index: 3;
  transition: left 0.5s ease-out;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
}

.corruption-meter__labels {
  display: flex;
  justify-content: space-between;
}

.corruption-meter__label {
  font-family: var(--font-cyber-data);
  font-size: 9px;
  color: rgba(255, 255, 255, 0.35);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: 20%;
  text-align: center;
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

.corruption-meter__label--active {
  opacity: 1;
  font-weight: 600;
}

/* Glitch effect on change (intense only) */
.corruption-meter--glitch .corruption-meter__bar {
  animation: corruption-glitch 0.3s ease-out;
}

@keyframes corruption-glitch {
  0% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  50% { transform: translateX(3px); }
  75% { transform: translateX(-1px); }
  100% { transform: translateX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .corruption-meter__indicator {
    transition: left 0s;
  }
  .corruption-meter--glitch .corruption-meter__bar {
    animation: none;
  }
}
</style>
