<script setup lang="ts">
/**
 * Gamification Panel Component
 * FEATURE-1118: Main stats overview panel showing XP, level, streak, and recent achievements
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGamificationStore } from '@/stores/gamification'
import XpBar from './XpBar.vue'
import LevelBadge from './LevelBadge.vue'
import StreakCounter from './StreakCounter.vue'
import AchievementBadge from './AchievementBadge.vue'
import DailyChallengesPanel from './DailyChallengesPanel.vue'
import { Trophy, ShoppingBag, ChevronRight, Sparkles, HelpCircle, ChevronDown } from 'lucide-vue-next'

const showHelp = ref(false)
const router = useRouter()

const emit = defineEmits<{
  openAchievements: []
  openShop: []
}>()

function goToCyberflow() {
  router.push('/cyberflow')
}

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
    <!-- Cyberflow Command Center Link -->
    <button class="cyberflow-link" @click="goToCyberflow">
      <span class="cyberflow-link-label">CYBERFLOW COMMAND CENTER</span>
      <ChevronRight :size="16" class="cyberflow-link-arrow" />
    </button>

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

    <!-- Daily Challenges (FEATURE-1132) -->
    <div class="panel-section">
      <DailyChallengesPanel :compact="true" />
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

    <!-- How It Works Section -->
    <div class="panel-section help-section">
      <button
        class="help-toggle"
        @click="showHelp = !showHelp"
      >
        <HelpCircle :size="16" />
        <span>How to Earn XP</span>
        <ChevronDown
          :size="14"
          class="help-chevron"
          :class="{ 'rotated': showHelp }"
        />
      </button>

      <div v-if="showHelp" class="help-content">
        <div class="help-category">
          <span class="help-category-title">🎯 Tasks</span>
          <ul class="help-list">
            <li><span class="xp-badge">+10 XP</span> Complete any task</li>
            <li><span class="xp-badge bonus">+50%</span> High priority tasks</li>
            <li><span class="xp-badge bonus">+25%</span> Medium priority tasks</li>
            <li><span class="xp-badge penalty">-10%</span> Overdue tasks</li>
          </ul>
        </div>

        <div class="help-category">
          <span class="help-category-title">🍅 Pomodoros</span>
          <ul class="help-list">
            <li><span class="xp-badge">+25 XP</span> Complete a Pomodoro</li>
            <li><span class="xp-badge bonus">+10%</span> Each consecutive session (max +50%)</li>
          </ul>
        </div>

        <div class="help-category">
          <span class="help-category-title">🔥 Streaks</span>
          <ul class="help-list">
            <li><span class="xp-badge">+50 XP</span> 7-day streak</li>
            <li><span class="xp-badge">+150 XP</span> 30-day streak</li>
            <li><span class="xp-badge">+300 XP</span> 100-day streak</li>
            <li><span class="xp-badge">+500 XP</span> 365-day streak</li>
          </ul>
        </div>

        <div class="help-category">
          <span class="help-category-title">🏆 Achievements</span>
          <ul class="help-list">
            <li><span class="xp-badge bronze">+50 XP</span> Bronze tier</li>
            <li><span class="xp-badge silver">+150 XP</span> Silver tier</li>
            <li><span class="xp-badge gold">+300 XP</span> Gold tier</li>
            <li><span class="xp-badge platinum">+500 XP</span> Platinum tier</li>
          </ul>
        </div>

        <p class="help-tip">
          💡 Spend XP in the <strong>Shop</strong> to unlock themes and cosmetics!
        </p>
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
}

/* Cyberflow Command Center Link */
.cyberflow-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: rgba(var(--neon-cyan), 0.08);
  border: 1px solid rgba(var(--neon-cyan), 0.25);
  border-radius: var(--radius-md);
  color: rgba(var(--neon-cyan), 0.9);
  font-family: var(--font-cyber-data, 'JetBrains Mono', monospace);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.cyberflow-link:hover {
  background: rgba(var(--neon-cyan), 0.15);
  border-color: rgba(var(--neon-cyan), 0.5);
  box-shadow: 0 0 12px rgba(var(--neon-cyan), 0.2);
  color: rgba(var(--neon-cyan), 1);
}

.cyberflow-link-arrow {
  opacity: 0.6;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.cyberflow-link:hover .cyberflow-link-arrow {
  opacity: 1;
  transform: translateX(2px);
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
  gap: var(--space-0_5);
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
  transition: all var(--duration-normal) var(--spring-smooth);
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
  padding: var(--space-0_5) var(--space-1_5);
  background: rgba(var(--color-slate-700), 0.5);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.see-all-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: rgba(var(--neon-cyan), 0.8);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
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

/* Help Section */
.help-section {
  border-top: 1px solid rgba(var(--color-slate-600), 0.3);
  padding-top: var(--space-3);
  margin-top: var(--space-2);
}

.help-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--gamification-text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.help-toggle:hover {
  background: rgba(var(--color-slate-700), 0.3);
  color: var(--gamification-text-primary);
}

.help-chevron {
  margin-left: auto;
  transition: transform var(--duration-normal) var(--spring-smooth);
}

.help-chevron.rotated {
  transform: rotate(180deg);
}

.help-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  background: rgba(var(--color-slate-800), 0.4);
  border-radius: var(--radius-md);
  animation: slideDown var(--duration-normal) var(--ease-out);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.help-category {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.help-category-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--gamification-text-primary);
}

.help-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.help-list li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--gamification-text-secondary);
}

.xp-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-0_5) var(--space-1_5);
  background: rgba(var(--neon-cyan), 0.15);
  border: 1px solid rgba(var(--neon-cyan), 0.3);
  border-radius: var(--radius-sm);
  color: rgba(var(--neon-cyan), 0.9);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  min-width: var(--space-12);
  justify-content: center;
}

.xp-badge.bonus {
  background: rgba(var(--neon-lime), 0.15);
  border-color: rgba(var(--neon-lime), 0.3);
  color: rgba(var(--neon-lime), 0.9);
}

.xp-badge.penalty {
  background: rgba(255, 100, 100, 0.15);
  border-color: rgba(255, 100, 100, 0.3);
  color: rgba(255, 100, 100, 0.9);
}

.xp-badge.bronze {
  background: rgba(var(--tier-bronze), 0.15);
  border-color: rgba(var(--tier-bronze), 0.3);
  color: rgb(var(--tier-bronze));
}

.xp-badge.silver {
  background: rgba(var(--tier-silver), 0.15);
  border-color: rgba(var(--tier-silver), 0.3);
  color: rgb(var(--tier-silver));
}

.xp-badge.gold {
  background: rgba(var(--tier-gold), 0.15);
  border-color: rgba(var(--tier-gold), 0.3);
  color: rgb(var(--tier-gold));
}

.xp-badge.platinum {
  background: rgba(var(--tier-platinum), 0.15);
  border-color: rgba(var(--tier-platinum), 0.3);
  color: rgb(var(--tier-platinum));
}

.help-tip {
  margin: 0;
  padding: var(--space-2);
  background: rgba(var(--neon-magenta), 0.1);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--gamification-text-secondary);
}

.help-tip strong {
  color: rgba(var(--neon-magenta), 0.9);
}
</style>
