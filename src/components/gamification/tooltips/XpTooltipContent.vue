<script setup lang="ts">
/**
 * XpTooltipContent - Rich tooltip for XpBar
 * TASK-1287: Shows XP progress, available XP, multiplier, shield status
 */
import { computed } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import { useChallengesStore } from '@/stores/challenges'
import { useTimerStore } from '@/stores/timer'
import { getXpNarrative } from '@/composables/useAriaTooltipNarrative'

const gamificationStore = useGamificationStore()
const challengesStore = useChallengesStore()
const timerStore = useTimerStore()

const levelInfo = computed(() => gamificationStore.levelInfo)
const currentXp = computed(() => levelInfo.value.currentXp)
const xpForNext = computed(() => levelInfo.value.xpForNextLevel)
const availableXp = computed(() => gamificationStore.availableXp)
const multiplier = computed(() => challengesStore.activeMultiplier)
const isMultiplierActive = computed(() => multiplier.value > 1)
const isTimerActive = computed(() => timerStore.isTimerActive)

const narrative = computed(() =>
  getXpNarrative(isMultiplierActive.value, isTimerActive.value)
)
</script>

<template>
  <div class="xp-tooltip">
    <div class="tooltip-title">XP PROGRESS</div>

    <div class="xp-stats">
      <div class="stat-row">
        <span class="stat-label">Current:</span>
        <span class="stat-value">{{ currentXp.toLocaleString() }} / {{ xpForNext.toLocaleString() }} XP</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Available:</span>
        <span class="stat-value">{{ availableXp.toLocaleString() }} XP <span class="stat-hint">(spendable)</span></span>
      </div>
    </div>

    <div v-if="isMultiplierActive || isTimerActive" class="xp-bonuses">
      <div v-if="isMultiplierActive" class="bonus-row bonus-multiplier">
        <span>Multiplier: {{ multiplier.toFixed(1) }}x</span>
        <span class="bonus-tag">ACTIVE</span>
      </div>
      <div v-if="isTimerActive" class="bonus-row bonus-shield">
        <span>Shield: +15% XP</span>
        <span class="bonus-tag bonus-tag--shield">TIMER ON</span>
      </div>
    </div>

    <div class="tooltip-narrative">
      "{{ narrative }}"
    </div>
  </div>
</template>

<style scoped>
.xp-tooltip {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 200px;
}

.tooltip-title {
  font-weight: var(--font-bold);
  color: rgba(var(--neon-cyan), 1);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.xp-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--text-xs);
}

.stat-label {
  color: var(--text-muted);
}

.stat-value {
  color: var(--text-secondary);
}

.stat-hint {
  color: var(--text-muted);
}

.xp-bonuses {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: var(--space-1);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.bonus-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.bonus-tag {
  font-size: 10px;
  font-weight: var(--font-bold);
  padding: 1px 4px;
  border-radius: var(--radius-sm);
  color: var(--cf-lime, #a3e635);
  background: rgba(163, 230, 53, 0.12);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bonus-tag--shield {
  color: rgba(var(--neon-cyan), 1);
  background: rgba(var(--neon-cyan), 0.12);
}

.tooltip-narrative {
  font-size: var(--text-xs);
  color: rgba(var(--neon-cyan), 0.6);
  font-style: italic;
  padding-top: var(--space-1);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
</style>
