<template>
  <div class="cyber-mission-history" data-augmented-ui="tl-clip-x br-clip-x border">
    <div class="stat-box">
      <div class="stat-label">TODAY</div>
      <div class="stat-value">{{ todayCompletion }}</div>
    </div>

    <div class="stat-box">
      <div class="stat-label">STREAK</div>
      <div class="stat-value">{{ streakDays }}</div>
    </div>

    <div class="stat-box">
      <div class="stat-label">TOTAL XP</div>
      <div class="stat-value">{{ formattedTotalXP }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useChallengesStore } from '@/stores/challenges'
import { useGamificationStore } from '@/stores/gamification'

const challengesStore = useChallengesStore()
const gamificationStore = useGamificationStore()

const todayCompletion = computed(() => {
  const completed = challengesStore.completedTodayCount
  return `${completed}/3`
})

const streakDays = computed(() => {
  const days = gamificationStore.streakInfo.currentStreak
  return `${days} day${days !== 1 ? 's' : ''}`
})

const formattedTotalXP = computed(() => {
  // Sum XP from all completed challenges
  let totalXP = 0

  // Calculate from active challenges that are completed
  challengesStore.activeChallenges.forEach(challenge => {
    if (challenge.status === 'completed') {
      totalXP += challenge.rewardXp
    }
  })

  // Format with comma separator
  return totalXP.toLocaleString()
})
</script>

<style scoped>
.cyber-mission-history {
  display: flex;
  gap: var(--space-3);
  --aug-border-all: 1px;
  --aug-border-bg: var(--cf-cyan);
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
  color: var(--cf-cyan);
  text-shadow: 0 0 8px var(--cf-cyan-glow);
}
</style>
