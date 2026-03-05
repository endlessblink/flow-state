<script setup lang="ts">
import LevelBadge from '@/components/gamification/LevelBadge.vue'
import XpBar from '@/components/gamification/XpBar.vue'
import StreakCounter from '@/components/gamification/StreakCounter.vue'
</script>

<template>
  <div class="morning-score">
    <LevelBadge size="sm" />
    <div class="xp-bar-wrapper">
      <XpBar :compact="true" :show-label="false" :animated="true" />
    </div>
    <StreakCounter :compact="true" :show-freezes="false" />
  </div>
</template>

<style scoped>
.morning-score {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(12px);
}

.xp-bar-wrapper {
  flex: 1;
  min-width: 0;
}
</style>
