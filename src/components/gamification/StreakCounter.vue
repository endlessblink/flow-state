<script setup lang="ts">
/**
 * Streak Counter Component
 * FEATURE-1118: Displays current streak with flame animation
 */
import { computed } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import { Flame, ShieldCheck, AlertTriangle } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  showFreezes?: boolean
  compact?: boolean
}>(), {
  showFreezes: true,
  compact: false
})

const gamificationStore = useGamificationStore()
const streakInfo = computed(() => gamificationStore.streakInfo)

const streakClass = computed(() => {
  const streak = streakInfo.value.currentStreak
  if (streak >= 100) return 'streak--legendary'
  if (streak >= 30) return 'streak--epic'
  if (streak >= 7) return 'streak--hot'
  return 'streak--normal'
})
</script>

<template>
  <div
    class="streak-counter"
    :class="[streakClass, { compact }]"
  >
    <div class="streak-main">
      <Flame
        class="streak-icon"
        :class="{ 'streak-icon--animated': streakInfo.isActiveToday }"
        :size="compact ? 16 : 20"
      />
      <span class="streak-number">{{ streakInfo.currentStreak }}</span>
      <span
        v-if="!compact"
        class="streak-label"
      >day{{ streakInfo.currentStreak !== 1 ? 's' : '' }}</span>
    </div>

    <div
      v-if="showFreezes && !compact && streakInfo.streakFreezes > 0"
      class="streak-freezes"
      :title="`${streakInfo.streakFreezes} streak freeze${streakInfo.streakFreezes !== 1 ? 's' : ''} available`"
    >
      <ShieldCheck
        :size="14"
        class="freeze-icon"
      />
      <span>{{ streakInfo.streakFreezes }}</span>
    </div>

    <div
      v-if="streakInfo.streakAtRisk && !compact"
      class="streak-warning"
      title="Complete a task today to keep your streak!"
    >
      <AlertTriangle
        :size="14"
        class="warning-icon"
      />
    </div>
  </div>
</template>

<style scoped>
.streak-counter {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: rgba(var(--color-slate-800), 0.6);
  border-radius: var(--radius-md);
  border: 1px solid var(--orange-bg-medium);
}

.streak-counter.compact {
  padding: var(--space-1);
  gap: var(--space-1);
}

.streak-main {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.streak-icon {
  color: var(--streak-flame-color);
  filter: drop-shadow(0 0 var(--space-1) rgba(255, 107, 53, 0.5));
}

.streak-icon--animated {
  animation: streakFlame 1s ease-in-out infinite;
}

.streak-number {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--streak-text-color);
  text-shadow: 0 0 var(--space-2) rgba(255, 107, 53, 0.4);
}

.compact .streak-number {
  font-size: var(--text-sm);
}

.streak-label {
  font-size: var(--text-sm);
  color: var(--gamification-text-secondary);
}

.streak-freezes {
  display: flex;
  align-items: center;
  gap: var(--space-0_5);
  padding: var(--space-0_5) var(--space-1_5);
  background: rgba(var(--neon-cyan), 0.1);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: rgba(var(--neon-cyan), 0.9);
}

.freeze-icon {
  color: rgba(var(--neon-cyan), 0.8);
}

.streak-warning {
  display: flex;
  align-items: center;
  animation: pulse 1.5s ease-in-out infinite;
}

.warning-icon {
  color: rgb(251, 191, 36);
}

/* Streak tier styles */
.streak--hot .streak-icon {
  color: #ff6b35;
}

.streak--epic .streak-icon {
  color: #ff4500;
  filter: drop-shadow(0 0 var(--space-1_5) rgba(255, 69, 0, 0.6));
}

.streak--epic .streak-number {
  color: #ff4500;
}

.streak--legendary .streak-icon {
  color: #ff00ff;
  filter: drop-shadow(0 0 var(--space-2) rgba(255, 0, 255, 0.7));
}

.streak--legendary .streak-number {
  background: linear-gradient(90deg, #00ffff, #ff00ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.streak--legendary {
  border-color: rgba(255, 0, 255, 0.4);
  box-shadow: 0 0 var(--space-3) rgba(255, 0, 255, 0.2);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
