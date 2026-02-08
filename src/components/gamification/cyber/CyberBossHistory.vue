<template>
  <div class="cyber-boss-history" data-augmented-ui="tl-clip-x br-clip-x border">
    <div class="stat-box">
      <div class="stat-label">DEFEATED</div>
      <div class="stat-value">{{ bossesDefeated }}</div>
    </div>

    <div class="stat-box">
      <div class="stat-label">ATTEMPTED</div>
      <div class="stat-value">{{ bossesAttempted }}</div>
    </div>

    <div class="stat-box">
      <div class="stat-label">WIN RATE</div>
      <div class="stat-value">{{ winRate }}%</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChallengesStore } from '@/stores/challenges'

const challengesStore = useChallengesStore()

// Count boss challenges from active challenges
// In the future, this will query challenge_history table
const bossesDefeated = computed(() => {
  return challengesStore.activeChallenges.filter(
    c => c.type === 'boss' && c.status === 'completed'
  ).length
})

const bossesAttempted = computed(() => {
  return challengesStore.activeChallenges.filter(
    c => c.type === 'boss' && (c.status === 'completed' || c.status === 'failed')
  ).length
})

const winRate = computed(() => {
  if (bossesAttempted.value === 0) return 0
  return Math.round((bossesDefeated.value / bossesAttempted.value) * 100)
})
</script>

<style scoped>
.cyber-boss-history {
  display: flex;
  gap: var(--space-3);
  --aug-border-all: 1px;
  --aug-border-bg: var(--cf-magenta);
  background: var(--cf-dark-3);
  padding: var(--space-2);
  border-radius: var(--radius-xs);
}

.stat-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--cf-dark-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xs);
  padding: var(--space-3) var(--space-4);
  min-height: 60px;
}

.stat-label {
  font-family: var(--font-cyber-data);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: var(--space-1);
}

.stat-value {
  font-family: var(--font-cyber-title);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--cf-magenta);
  text-shadow: 0 0 8px var(--cf-magenta-glow);
}
</style>
