<script setup lang="ts">
/**
 * LevelTooltipContent - Rich tooltip for LevelBadge
 * TASK-1287: Shows level, XP progress, recent XP logs, and ARIA narrative
 */
import { computed } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import { getLevelNarrative } from '@/composables/useAriaTooltipNarrative'

const gamificationStore = useGamificationStore()

const level = computed(() => gamificationStore.currentLevel)
const totalXp = computed(() => gamificationStore.totalXp)
const levelInfo = computed(() => gamificationStore.levelInfo)
const progressPercent = computed(() => levelInfo.value.progressPercent)
const currentXp = computed(() => levelInfo.value.currentXp)
const xpForNext = computed(() => levelInfo.value.xpForNextLevel)
const xpRemaining = computed(() => xpForNext.value - currentXp.value)

const recentLogs = computed(() =>
  gamificationStore.recentXpLogs.slice(0, 3)
)

const narrative = computed(() =>
  getLevelNarrative(level.value, progressPercent.value)
)
</script>

<template>
  <div class="level-tooltip">
    <div class="tooltip-header">
      <span class="tooltip-title">LVL {{ level }} NETRUNNER</span>
      <span class="tooltip-xp-total">{{ totalXp.toLocaleString() }} Total XP</span>
    </div>

    <div class="tooltip-progress">
      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
      <span class="progress-label">{{ progressPercent }}%</span>
    </div>

    <div class="tooltip-remaining">
      ~{{ xpRemaining.toLocaleString() }} XP to Level {{ level + 1 }}
    </div>

    <div v-if="recentLogs.length > 0" class="tooltip-recent">
      <div class="recent-header">
        Recent:
      </div>
      <div
        v-for="log in recentLogs"
        :key="log.id || log.createdAt?.toString()"
        class="recent-entry"
      >
        <span class="recent-amount">+{{ log.xpAmount }} XP</span>
        <span class="recent-reason">{{ log.reason }}</span>
      </div>
    </div>

    <div class="tooltip-narrative">
      "{{ narrative }}"
    </div>
  </div>
</template>

<style scoped>
.level-tooltip {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 220px;
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.tooltip-title {
  font-weight: var(--font-bold);
  color: rgba(var(--neon-cyan), 1);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tooltip-xp-total {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.tooltip-progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.progress-track {
  flex: 1;
  height: 4px;
  background: rgba(var(--color-slate-700), 0.6);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(var(--neon-cyan), 0.8), rgba(var(--neon-cyan), 1));
  border-radius: var(--radius-full);
}

.progress-label {
  font-size: var(--text-xs);
  color: rgba(var(--neon-cyan), 0.8);
  min-width: 28px;
  text-align: right;
}

.tooltip-remaining {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.tooltip-recent {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: var(--space-1);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.recent-header {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-bottom: 2px;
}

.recent-entry {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-xs);
}

.recent-amount {
  color: rgba(var(--neon-cyan), 0.9);
  font-weight: var(--font-semibold);
  min-width: 50px;
}

.recent-reason {
  color: var(--text-muted);
  text-transform: capitalize;
}

.tooltip-narrative {
  font-size: var(--text-xs);
  color: rgba(var(--neon-cyan), 0.6);
  font-style: italic;
  padding-top: var(--space-1);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
</style>
