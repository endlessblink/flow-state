<script setup lang="ts">
/**
 * ChallengePips - Compact daily challenge completion indicator
 * TASK-1287: 3 dots showing daily challenge completion status + optional boss pip
 */
import { computed } from 'vue'
import { useChallengesStore } from '@/stores/challenges'

const challengesStore = useChallengesStore()

const dailies = computed(() => challengesStore.activeDailies)
const boss = computed(() => challengesStore.activeBoss)
const completedToday = computed(() => challengesStore.completedTodayCount)

// Build pip states: completed, active, or empty (up to 3 dailies)
const pips = computed(() => {
  const result: Array<'completed' | 'active' | 'empty'> = []
  const total = dailies.value.length

  for (let i = 0; i < 3; i++) {
    if (i < completedToday.value) {
      result.push('completed')
    } else if (i < total) {
      result.push('active')
    } else {
      result.push('empty')
    }
  }
  return result
})

const hasContent = computed(() =>
  dailies.value.length > 0 || boss.value != null
)
</script>

<template>
  <div v-if="hasContent" class="challenge-pips">
    <span
      v-for="(state, i) in pips"
      :key="i"
      class="pip"
      :class="`pip--${state}`"
    />
    <span
      v-if="boss"
      class="pip pip--boss"
      :class="{ 'pip--boss-active': boss.status === 'active' }"
    />
  </div>
</template>

<style scoped>
.challenge-pips {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 var(--space-1);
}

.pip {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  transition: all var(--duration-fast) var(--ease-out);
}

.pip--completed {
  background: var(--cf-lime, #a3e635);
  box-shadow: 0 0 4px var(--cf-lime, rgba(163, 230, 53, 0.6));
}

.pip--active {
  background: transparent;
  border: 1px solid var(--cf-cyan, rgba(0, 255, 255, 0.6));
}

.pip--empty {
  display: none;
}

/* Boss pip: diamond shape */
.pip--boss {
  width: 7px;
  height: 7px;
  border-radius: 1px;
  transform: rotate(45deg);
  margin-left: 2px;
  background: transparent;
  border: 1px solid var(--cf-magenta, rgba(255, 0, 255, 0.4));
}

.pip--boss-active {
  background: var(--cf-magenta, rgba(255, 0, 255, 0.6));
  box-shadow: 0 0 4px var(--cf-magenta, rgba(255, 0, 255, 0.5));
}
</style>
