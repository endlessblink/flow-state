<script setup lang="ts">
import { computed } from 'vue'
import { Target } from 'lucide-vue-next'
import { useChallengesStore } from '@/stores/challenges'
import { storeToRefs } from 'pinia'
import DailyChallengesPanel from '@/components/gamification/DailyChallengesPanel.vue'

const challengesStore = useChallengesStore()
const { activeDailies, allDailiesComplete } = storeToRefs(challengesStore)

const hasChallenges = computed(
  () => activeDailies.value.length > 0 || allDailiesComplete.value
)
</script>

<template>
  <div class="morning-missions">
    <div class="card-header">
      <Target :size="16" class="header-icon" />
      <h2 class="card-title">Daily Missions</h2>
    </div>

    <div v-if="hasChallenges" class="missions-content">
      <DailyChallengesPanel :compact="true" />
    </div>

    <div v-else class="missions-empty">
      <p class="empty-text">No missions today</p>
    </div>
  </div>
</template>

<style scoped>
.morning-missions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(12px);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.header-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
}

.card-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.missions-content {
  /* Remove inner card's redundant border/bg when nested */
}

.missions-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.empty-text {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}
</style>
