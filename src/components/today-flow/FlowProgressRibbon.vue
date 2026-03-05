<script setup lang="ts">
import { computed } from 'vue'
import { useTimerStore } from '@/stores/timer'
import LevelBadge from '@/components/gamification/LevelBadge.vue'
import XpBar from '@/components/gamification/XpBar.vue'
import StreakCounter from '@/components/gamification/StreakCounter.vue'

const POMODORO_SET_SIZE = 4

const timerStore = useTimerStore()

// Count completed pomodoros in current session set (non-break sessions)
const completedDots = computed(() => {
  const count = timerStore.completedSessions.filter(s => !s.isBreak).length
  return count % POMODORO_SET_SIZE
})

const dots = computed(() =>
  Array.from({ length: POMODORO_SET_SIZE }, (_, i) => i < completedDots.value)
)
</script>

<template>
  <div class="flow-ribbon">
    <XpBar :compact="true" />
    <LevelBadge size="sm" />
    <StreakCounter :compact="true" />

    <div class="pomodoro-dots" aria-label="Pomodoro session progress">
      <span
        v-for="(filled, i) in dots"
        :key="i"
        class="dot"
        :class="{ 'dot--filled': filled }"
        :aria-label="filled ? 'Completed pomodoro' : 'Remaining pomodoro'"
      >{{ filled ? '●' : '○' }}</span>
    </div>
  </div>
</template>

<style scoped>
.flow-ribbon {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 36px;
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-light, var(--glass-bg-soft));
  border-bottom: 1px solid var(--glass-border);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

/* Let XpBar fill remaining space */
.flow-ribbon :deep(.xp-bar-container) {
  flex: 1;
  min-width: 60px;
  max-width: 200px;
}

.pomodoro-dots {
  display: flex;
  gap: 2px;
  align-items: center;
  letter-spacing: 2px;
  font-size: 0.6rem;
  flex-shrink: 0;
}

.dot {
  color: var(--text-muted);
  line-height: 1;
  transition: color var(--duration-normal) ease;
}

.dot--filled {
  color: var(--brand-primary);
}
</style>
