<script setup lang="ts">
/**
 * CyberAchievements - Visual Novel Achievement Gallery
 * FEATURE-1118 Cyberflow RPG Hub: Bottom-left panel
 *
 * Icon-dominant grid with large 48px icons, tier glows, minimal text.
 * Visual novel aesthetic: show, don't tell.
 */
import { computed } from 'vue'
import { useGamificationStore } from '@/stores/gamification'
import { useCyberflowTheme } from '@/composables/useCyberflowTheme'
import type { AchievementWithProgress, AchievementTier, AchievementCategory } from '@/types/gamification'
import {
  Rocket, Target, Award, Crown, Flame, Clock, Hourglass, Layers,
  Calendar, Trophy, Star, RefreshCw, Shield, Timer, Brain,
  Zap, Infinity, Activity, Layout, Columns, Smartphone, Palette,
  Moon, Sunrise, CheckCircle, Database, Lock, ChevronRight
} from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  showAll?: boolean
}>(), {
  showAll: false
})

const emit = defineEmits<{
  openAchievements: []
}>()

const gamificationStore = useGamificationStore()
const { cyberflowClasses } = useCyberflowTheme()

// Icon mapping
const iconMap: Record<string, any> = {
  rocket: Rocket, target: Target, award: Award, crown: Crown, flame: Flame,
  clock: Clock, hourglass: Hourglass, layers: Layers, fire: Flame,
  calendar: Calendar, trophy: Trophy, star: Star, 'refresh-cw': RefreshCw,
  shield: Shield, timer: Timer, brain: Brain, zap: Zap, infinity: Infinity,
  activity: Activity, layout: Layout, columns: Columns, smartphone: Smartphone,
  palette: Palette, moon: Moon, sunrise: Sunrise, 'check-circle': CheckCircle,
  database: Database
}

// Category icon shapes (simple SVG fallback)
const categoryIcons: Record<AchievementCategory, any> = {
  productivity: Rocket,
  consistency: Flame,
  mastery: Crown,
  exploration: Layers,
  secret: Shield
}

function getIconComponent(achievement: AchievementWithProgress) {
  return iconMap[achievement.icon] || categoryIcons[achievement.category] || Award
}

// Get 6 achievements: earned first (most recent), then in-progress
const displayAchievements = computed((): AchievementWithProgress[] => {
  const all = gamificationStore.achievementsWithProgress

  const earned = all
    .filter(a => a.isEarned)
    .sort((a, b) => (b.earnedAt?.getTime() || 0) - (a.earnedAt?.getTime() || 0))

  const inProgress = all
    .filter(a => !a.isEarned && !a.isSecret && a.progress > 0)
    .sort((a, b) => {
      const aP = a.conditionValue > 0 ? a.progress / a.conditionValue : 0
      const bP = b.conditionValue > 0 ? b.progress / b.conditionValue : 0
      return bP - aP
    })

  const locked = all
    .filter(a => !a.isEarned && !a.isSecret && a.progress === 0)
    .slice(0, 6)

  const combined = [...earned, ...inProgress, ...locked]
  return props.showAll ? combined : combined.slice(0, 6)
})

const earnedCount = computed(() => gamificationStore.unlockedAchievementsCount)
const totalCount = computed(() => gamificationStore.achievements.length)
const hasAchievements = computed(() => gamificationStore.achievements.length > 0)

// Tier color mapping (for icon glow)
const tierColorMap: Record<AchievementTier, string> = {
  bronze: 'rgba(205, 127, 50, 1)',
  silver: 'rgba(192, 192, 192, 1)',
  gold: 'rgba(255, 215, 0, 1)',
  platinum: 'rgba(229, 228, 226, 1)'
}

function getTierColor(tier: AchievementTier): string {
  return tierColorMap[tier]
}

// Tier glow for icon (drop-shadow filter)
function getTierGlow(tier: AchievementTier): string {
  const color = tierColorMap[tier]
  return `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 16px ${color})`
}

function getProgressPercent(achievement: AchievementWithProgress): number {
  if (achievement.isEarned) return 100
  if (achievement.conditionValue <= 0) return 0
  return Math.min(100, Math.round((achievement.progress / achievement.conditionValue) * 100))
}
</script>

<template>
  <div
    class="cyber-achievements"
    :class="cyberflowClasses"
    data-augmented-ui="tl-clip br-clip border"
  >
    <!-- Panel Header -->
    <div class="ca-header">
      <Trophy :size="16" class="ca-header-icon" />
      <span class="ca-header-text">ACHIEVEMENTS</span>
      <span class="ca-header-count">{{ earnedCount }}/{{ totalCount }}</span>
    </div>

    <!-- Achievement Grid: 4 cols full, 3 cols compact -->
    <div
      v-if="hasAchievements && displayAchievements.length > 0"
      class="ca-grid"
      :class="{ 'ca-grid--full': showAll }"
    >
      <div
        v-for="achievement in displayAchievements"
        :key="achievement.id"
        class="ca-item"
        :class="{
          'ca-item--earned': achievement.isEarned,
          'ca-item--locked': !achievement.isEarned && (achievement.isSecret || achievement.progress === 0)
        }"
        :title="achievement.isSecret && !achievement.isEarned ? '???' : achievement.name"
      >
        <!-- Large Icon with Tier Glow -->
        <div class="ca-icon-wrap">
          <component
            :is="achievement.isSecret && !achievement.isEarned ? Lock : getIconComponent(achievement)"
            :size="48"
            class="ca-icon"
            :class="{ 'ca-icon--locked': !achievement.isEarned && (achievement.isSecret || achievement.progress === 0) }"
            :style="{
              color: achievement.isEarned ? getTierColor(achievement.tier) : undefined,
              filter: achievement.isEarned ? getTierGlow(achievement.tier) : undefined
            }"
          />

          <!-- Earned Badge Overlay -->
          <div v-if="achievement.isEarned" class="ca-earned-badge">
            <CheckCircle :size="14" />
          </div>
        </div>

        <!-- Name (1 line max) -->
        <span class="ca-name">
          {{ achievement.isSecret && !achievement.isEarned ? '???' : achievement.name }}
        </span>

        <!-- Progress Bar (in-progress only) -->
        <div
          v-if="!achievement.isEarned && !achievement.isSecret && achievement.progress > 0"
          class="ca-progress"
        >
          <div
            class="ca-progress-fill"
            :style="{ width: `${getProgressPercent(achievement)}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="ca-empty">
      <Trophy :size="32" class="ca-empty-icon" />
      <span class="ca-empty-text">NO ACHIEVEMENTS</span>
    </div>

    <!-- View All Button -->
    <button
      v-if="!showAll && hasAchievements"
      class="ca-view-all"
      @click="emit('openAchievements')"
    >
      <span>VIEW ALL</span>
      <ChevronRight :size="14" />
    </button>
  </div>
</template>

<style scoped>
.cyber-achievements {
  --aug-border-all: 1px;
  --aug-border-bg: var(--cf-cyan-50, rgba(0, 240, 255, 0.5));
  --aug-tl1: 16px;
  --aug-br1: 16px;
  background: var(--cf-dark-2);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  height: 100%;
}

/* Header */
.ca-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.ca-header-icon {
  color: var(--cf-gold);
  filter: drop-shadow(0 0 6px var(--cf-gold));
}

.ca-header-text {
  font-family: var(--font-cyber-title);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--cf-cyan);
  letter-spacing: 0.1em;
  flex: 1;
}

.ca-header-count {
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-sm);
}

/* Achievement Grid: 3 columns compact, 4 columns full */
.ca-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  flex: 1;
  align-content: start;
}

.ca-grid--full {
  grid-template-columns: repeat(4, 1fr);
}

/* Individual Achievement Item */
.ca-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--cf-dark-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  transition: transform 0.2s ease, border-color 0.2s ease;
  cursor: pointer;
  min-height: 120px;
}

.ca-item:hover {
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

/* Locked state: reduced opacity */
.ca-item--locked {
  opacity: 0.4;
  cursor: default;
}

.ca-item--locked:hover {
  opacity: 0.5;
  transform: translateY(-1px);
}

/* Icon Wrapper */
.ca-icon-wrap {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Icon (48px) */
.ca-icon {
  color: var(--text-secondary);
  transition: color 0.3s ease, filter 0.3s ease;
}

.ca-icon--locked {
  color: rgba(255, 255, 255, 0.2);
}

/* Earned Badge Overlay */
.ca-earned-badge {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cf-cyan);
  border-radius: 50%;
  color: var(--cf-dark-1);
  box-shadow: 0 0 8px var(--cf-cyan);
}

/* Achievement Name */
.ca-name {
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  color: var(--text-primary);
  text-align: center;
  line-height: 1.3;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.ca-item--locked .ca-name {
  color: var(--text-muted);
}

/* Progress Bar */
.ca-progress {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-top: auto;
}

.ca-progress-fill {
  height: 100%;
  background: var(--cf-cyan);
  border-radius: 2px;
  transition: width 0.4s ease;
  box-shadow: 0 0 4px var(--cf-cyan);
}

/* Empty State */
.ca-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.ca-empty-icon {
  color: var(--text-muted);
  opacity: 0.3;
}

.ca-empty-text {
  font-family: var(--font-cyber-data);
  font-size: var(--text-sm);
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

/* View All Button */
.ca-view-all {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(0, 240, 255, 0.05);
  border: 1px solid rgba(0, 240, 255, 0.3);
  border-radius: var(--radius-sm);
  color: var(--cf-cyan);
  font-family: var(--font-cyber-title);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ca-view-all:hover {
  background: rgba(0, 240, 255, 0.1);
  border-color: var(--cf-cyan);
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .ca-grid,
  .ca-grid--full {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .ca-item {
    transition: none;
  }

  .ca-icon {
    transition: none;
  }

  .ca-progress-fill {
    transition: none;
  }

  .ca-view-all {
    transition: none;
  }
}
</style>
