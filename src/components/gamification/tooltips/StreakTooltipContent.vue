<script setup lang="ts">
/**
 * StreakTooltipContent - Rich tooltip for StreakCounter
 * TASK-1287: Shows streak details, record, freezes, today status
 */
import { computed } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import { getStreakNarrative } from '@/composables/useAriaTooltipNarrative'

const gamificationStore = useGamificationStore()

const streakInfo = computed(() => gamificationStore.streakInfo)
const currentStreak = computed(() => streakInfo.value.currentStreak)
const longestStreak = computed(() => streakInfo.value.longestStreak)
const isActiveToday = computed(() => streakInfo.value.isActiveToday)
const atRisk = computed(() => streakInfo.value.streakAtRisk)
const freezes = computed(() => streakInfo.value.streakFreezes)

const narrative = computed(() =>
  getStreakNarrative(currentStreak.value, isActiveToday.value, atRisk.value)
)

const todayStatus = computed(() => {
  if (isActiveToday.value) return { text: 'ACTIVE', cssClass: 'status--active' }
  if (atRisk.value) return { text: 'Complete a task to continue', cssClass: 'status--warning' }
  return { text: 'Start a task to begin', cssClass: 'status--neutral' }
})
</script>

<template>
  <div class="streak-tooltip">
    <div class="tooltip-header">
      <span class="tooltip-title">STREAK: {{ currentStreak }} day{{ currentStreak !== 1 ? 's' : '' }}</span>
    </div>

    <div class="streak-stats">
      <div class="stat-row">
        <span class="stat-label">Record:</span>
        <span class="stat-value">{{ longestStreak }} days</span>
      </div>
    </div>

    <div class="streak-today">
      <span class="today-label">Today:</span>
      <span class="today-status" :class="todayStatus.cssClass">
        {{ todayStatus.text }}
      </span>
    </div>

    <div v-if="freezes > 0" class="streak-freezes">
      <span class="freeze-label">Freezes:</span>
      <span class="freeze-value">{{ freezes }} remaining</span>
    </div>

    <div class="tooltip-narrative">
      "{{ narrative }}"
    </div>
  </div>
</template>

<style scoped>
.streak-tooltip {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 200px;
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.tooltip-title {
  font-weight: var(--font-bold);
  color: var(--streak-text-color, #ff6b35);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.streak-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
}

.stat-label {
  color: var(--text-muted);
}

.stat-value {
  color: var(--text-secondary);
}

.streak-today {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-xs);
  padding-top: var(--space-1);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.today-label {
  color: var(--text-muted);
}

.today-status {
  font-weight: var(--font-semibold);
}

.status--active {
  color: var(--cf-lime, #a3e635);
}

.status--warning {
  color: var(--cf-gold, #fbbf24);
}

.status--neutral {
  color: var(--text-muted);
}

.streak-freezes {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
}

.freeze-label {
  color: var(--text-muted);
}

.freeze-value {
  color: rgba(var(--neon-cyan), 0.8);
}

.tooltip-narrative {
  font-size: var(--text-xs);
  color: rgba(var(--neon-cyan), 0.6);
  font-style: italic;
  padding-top: var(--space-1);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
</style>
