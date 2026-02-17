<script setup lang="ts">
/**
 * ChallengeTooltipContent - Rich tooltip for ChallengePips
 * TASK-1287: Shows daily challenge list, boss status, and narrative
 */
import { computed } from 'vue'
import { useChallengesStore } from '@/stores/challenges'
import { getChallengeNarrative } from '@/composables/useAriaTooltipNarrative'

const challengesStore = useChallengesStore()

const boss = computed(() => challengesStore.activeBoss)
const completedToday = computed(() => challengesStore.completedTodayCount)

// All challenges for display (active + completed today)
const displayChallenges = computed(() => {
  return challengesStore.activeChallenges.filter(
    c => c.challengeType === 'daily'
  )
})

const totalDailies = computed(() => displayChallenges.value.length)

const narrative = computed(() =>
  getChallengeNarrative(
    completedToday.value,
    totalDailies.value,
    boss.value != null
  )
)

function progressText(current: number, target: number): string {
  return `${current}/${target}`
}

function bossHpPercent(b: typeof boss.value): number {
  if (!b) return 0
  return Math.round((b.objectiveCurrent / b.objectiveTarget) * 100)
}
</script>

<template>
  <div class="challenge-tooltip">
    <div class="tooltip-title">
      DAILY MISSIONS: {{ completedToday }}/{{ totalDailies }} Complete
    </div>

    <div v-if="displayChallenges.length > 0" class="challenge-list">
      <div
        v-for="challenge in displayChallenges"
        :key="challenge.id"
        class="challenge-entry"
        :class="{ 'challenge-entry--done': challenge.status === 'completed' }"
      >
        <span class="challenge-marker">
          {{ challenge.status === 'completed' ? '&#10003;' : '&#9679;' }}
        </span>
        <span class="challenge-name">{{ challenge.title }}</span>
        <span v-if="challenge.status !== 'completed'" class="challenge-progress">
          ({{ progressText(challenge.objectiveCurrent, challenge.objectiveTarget) }})
        </span>
      </div>
    </div>

    <div v-if="boss" class="boss-section">
      <div class="boss-header">
        <span class="boss-label">BOSS: {{ boss.title.toUpperCase() }}</span>
        <span class="boss-hp">[HP: {{ 100 - bossHpPercent(boss) }}%]</span>
      </div>
    </div>

    <div class="tooltip-narrative">
      "{{ narrative }}"
    </div>
  </div>
</template>

<style scoped>
.challenge-tooltip {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 220px;
}

.tooltip-title {
  font-weight: var(--font-bold);
  color: rgba(var(--neon-cyan), 1);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.challenge-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.challenge-entry {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.challenge-entry--done {
  color: var(--cf-lime, #a3e635);
}

.challenge-marker {
  font-size: 10px;
  min-width: 12px;
}

.challenge-entry--done .challenge-marker {
  color: var(--cf-lime, #a3e635);
}

.challenge-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.challenge-progress {
  color: var(--text-muted);
  white-space: nowrap;
}

.boss-section {
  padding-top: var(--space-1);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.boss-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-xs);
}

.boss-label {
  color: var(--cf-magenta, #ff00ff);
  font-weight: var(--font-bold);
  letter-spacing: 0.03em;
}

.boss-hp {
  color: var(--cf-magenta, #ff00ff);
  font-weight: var(--font-semibold);
}

.tooltip-narrative {
  font-size: var(--text-xs);
  color: rgba(var(--neon-cyan), 0.6);
  font-style: italic;
  padding-top: var(--space-1);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
</style>
