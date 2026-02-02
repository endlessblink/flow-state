<script setup lang="ts">
/**
 * Gamification Panel Component
 * FEATURE-1118: Main stats overview panel showing XP, level, streak, and recent achievements
 */
import { computed, ref } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import XpBar from './XpBar.vue'
import LevelBadge from './LevelBadge.vue'
import StreakCounter from './StreakCounter.vue'
import AchievementBadge from './AchievementBadge.vue'
import { Trophy, ShoppingBag, ChevronRight, Sparkles } from 'lucide-vue-next'

const emit = defineEmits<{
  openAchievements: []
  openShop: []
}>()

const gamificationStore = useGamificationStore()

const levelInfo = computed(() => gamificationStore.levelInfo)
const totalXp = computed(() => gamificationStore.totalXp)
const availableXp = computed(() => gamificationStore.availableXp)

// Get 4 most recent earned achievements
const recentAchievements = computed(() => {
  return gamificationStore.earnedAchievements
    .sort((a, b) => {
      const aDate = a.earnedAt?.getTime() || 0
      const bDate = b.earnedAt?.getTime() || 0
      return bDate - aDate
    })
    .slice(0, 4)
})

const earnedCount = computed(() => gamificationStore.unlockedAchievementsCount)
const totalCount = computed(() => gamificationStore.achievements.length)
</script>

<template>
  <div class="gamification-panel">
    <!-- Header with Level -->
    <div class="panel-header">
      <div class="header-main">
        <LevelBadge size="lg" />
        <div class="header-info">
          <span class="header-title">Level {{ levelInfo.level }}</span>
          <span class="header-xp">{{ totalXp.toLocaleString() }} Total XP</span>
        </div>
      </div>

      <div class="header-actions">
        <button
          class="action-btn action-btn--shop"
          title="Open Shop"
          @click="$emit('openShop')"
        >
          <ShoppingBag :size="18" />
          <span class="action-xp">{{ availableXp.toLocaleString() }} XP</span>
        </button>
      </div>
    </div>

    <!-- XP Progress -->
    <div class="panel-section">
      <XpBar :animated="true" />
    </div>

    <!-- Streak -->
    <div class="panel-section">
      <StreakCounter :show-freezes="true" />
    </div>

    <!-- Recent Achievements -->
    <div class="panel-section">
      <div class="section-header">
        <div class="section-title">
          <Trophy
            :size="16"
            class="section-icon"
          />
          <span>Achievements</span>
          <span class="achievement-count">{{ earnedCount }}/{{ totalCount }}</span>
        </div>
        <button
          class="see-all-btn"
          @click="$emit('openAchievements')"
        >
          <span>See All</span>
          <ChevronRight :size="14" />
        </button>
      </div>

      <div
        v-if="recentAchievements.length > 0"
        class="achievements-grid"
      >
        <AchievementBadge
          v-for="achievement in recentAchievements"
          :key="achievement.id"
          :achievement="achievement"
          size="sm"
        />
      </div>

      <div
        v-else
        class="achievements-empty"
      >
        <Sparkles
          :size="24"
          class="empty-icon"
        />
        <span>Complete tasks to earn achievements!</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gamification-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--gamification-panel-bg);
  border: 1px solid var(--gamification-panel-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(12px);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
}

.header-main {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-title {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--gamification-text-primary);
  text-shadow: 0 0 12px rgba(var(--neon-cyan), 0.3);
}

.header-xp {
  font-size: var(--text-sm);
  color: var(--gamification-text-secondary);
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(var(--color-slate-700), 0.5);
  border: 1px solid rgba(var(--color-slate-600), 0.5);
  border-radius: var(--radius-md);
  color: var(--gamification-text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(var(--color-slate-600), 0.5);
  border-color: rgba(var(--neon-cyan), 0.3);
}

.action-btn--shop:hover {
  box-shadow: 0 0 12px rgba(var(--neon-cyan), 0.2);
}

.action-xp {
  color: rgba(var(--neon-cyan), 0.9);
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--gamification-text-secondary);
}

.section-icon {
  color: rgba(var(--tier-gold), 0.8);
}

.achievement-count {
  padding: 2px 6px;
  background: rgba(var(--color-slate-700), 0.5);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.see-all-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: rgba(var(--neon-cyan), 0.8);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.see-all-btn:hover {
  background: rgba(var(--neon-cyan), 0.1);
  color: rgba(var(--neon-cyan), 1);
}

.achievements-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}

.achievements-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  color: var(--gamification-text-secondary);
  font-size: var(--text-sm);
  text-align: center;
}

.empty-icon {
  color: rgba(var(--neon-cyan), 0.4);
}
</style>
