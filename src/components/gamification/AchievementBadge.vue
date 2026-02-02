<script setup lang="ts">
/**
 * Achievement Badge Component
 * FEATURE-1118: Displays an achievement with tier-based glow
 */
import { computed } from 'vue'
import type { AchievementWithProgress, AchievementTier } from '@/types/gamification'
import {
  Rocket, Target, Award, Crown, Flame, Clock, Hourglass, Layers,
  Calendar, Trophy, Star, RefreshCw, Shield, Timer, Brain,
  Zap, Infinity, Activity, Layout, Columns, Smartphone, Palette,
  Moon, Sunrise, CheckCircle, Database, Lock
} from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  achievement: AchievementWithProgress
  size?: 'sm' | 'md' | 'lg'
  showProgress?: boolean
  showDescription?: boolean
}>(), {
  size: 'md',
  showProgress: true,
  showDescription: false
})

// Map icon names to components
const iconMap: Record<string, any> = {
  rocket: Rocket, target: Target, award: Award, crown: Crown, flame: Flame,
  clock: Clock, hourglass: Hourglass, layers: Layers, fire: Flame,
  calendar: Calendar, trophy: Trophy, star: Star, 'refresh-cw': RefreshCw,
  shield: Shield, timer: Timer, brain: Brain, zap: Zap, infinity: Infinity,
  activity: Activity, layout: Layout, columns: Columns, smartphone: Smartphone,
  palette: Palette, moon: Moon, sunrise: Sunrise, 'check-circle': CheckCircle,
  database: Database
}

const IconComponent = computed(() => iconMap[props.achievement.icon] || Award)

const tierGlow = computed(() => {
  const tierMap: Record<AchievementTier, string> = {
    bronze: 'var(--tier-glow-bronze)',
    silver: 'var(--tier-glow-silver)',
    gold: 'var(--tier-glow-gold)',
    platinum: 'var(--tier-glow-platinum)'
  }
  return tierMap[props.achievement.tier]
})

const tierColor = computed(() => {
  const tierMap: Record<AchievementTier, string> = {
    bronze: 'rgb(var(--tier-bronze))',
    silver: 'rgb(var(--tier-silver))',
    gold: 'rgb(var(--tier-gold))',
    platinum: 'rgb(var(--tier-platinum))'
  }
  return tierMap[props.achievement.tier]
})

const progressPercent = computed(() => {
  if (props.achievement.isEarned) return 100
  return Math.min(100, Math.round(
    (props.achievement.progress / props.achievement.conditionValue) * 100
  ))
})

const sizeClass = computed(() => `badge--${props.size}`)
</script>

<template>
  <div
    class="achievement-badge"
    :class="[
      sizeClass,
      `badge--${achievement.tier}`,
      { 'badge--earned': achievement.isEarned, 'badge--secret': achievement.isSecret && !achievement.isEarned }
    ]"
    :title="achievement.isEarned ? achievement.name : (achievement.isSecret ? '???' : achievement.name)"
  >
    <div
      class="badge-icon-wrapper"
      :style="{ boxShadow: achievement.isEarned ? tierGlow : 'none' }"
    >
      <Lock
        v-if="achievement.isSecret && !achievement.isEarned"
        class="badge-icon badge-icon--locked"
        :size="size === 'sm' ? 16 : size === 'lg' ? 32 : 24"
      />
      <component
        :is="IconComponent"
        v-else
        class="badge-icon"
        :style="{ color: achievement.isEarned ? tierColor : undefined }"
        :size="size === 'sm' ? 16 : size === 'lg' ? 32 : 24"
      />
    </div>

    <div
      v-if="showDescription || showProgress"
      class="badge-content"
    >
      <span
        v-if="showDescription"
        class="badge-name"
      >
        {{ achievement.isSecret && !achievement.isEarned ? '???' : achievement.name }}
      </span>

      <div
        v-if="showProgress && !achievement.isEarned && !achievement.isSecret"
        class="badge-progress"
      >
        <div
          class="badge-progress-bar"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <span
        v-if="showProgress && !achievement.isEarned && !achievement.isSecret"
        class="badge-progress-text"
      >
        {{ achievement.progress }}/{{ achievement.conditionValue }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.achievement-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--gamification-card-bg);
  border-radius: var(--radius-md);
  border: 1px solid rgba(var(--color-slate-600), 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.achievement-badge:hover {
  transform: translateY(-2px);
}

.badge--earned:hover {
  box-shadow: var(--tier-glow-bronze);
}

.badge--earned.badge--silver:hover {
  box-shadow: var(--tier-glow-silver);
}

.badge--earned.badge--gold:hover {
  box-shadow: var(--tier-glow-gold);
}

.badge--earned.badge--platinum:hover {
  box-shadow: var(--tier-glow-platinum);
}

.badge--secret {
  opacity: 0.5;
}

.badge--sm {
  padding: var(--space-1);
  gap: var(--space-1);
}

.badge--lg {
  padding: var(--space-3);
  gap: var(--space-3);
}

.badge-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-1);
  background: rgba(var(--color-slate-700), 0.5);
  border-radius: var(--radius-sm);
  transition: box-shadow 0.3s ease;
}

.badge--sm .badge-icon-wrapper {
  padding: 4px;
}

.badge--lg .badge-icon-wrapper {
  padding: var(--space-2);
}

.badge-icon {
  color: var(--gamification-text-secondary);
  transition: color 0.3s ease;
}

.badge--earned .badge-icon {
  filter: drop-shadow(0 0 4px currentColor);
}

.badge-icon--locked {
  color: rgba(var(--color-slate-500), 0.5);
}

.badge-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.badge-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--gamification-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge-progress {
  height: 4px;
  background: rgba(var(--color-slate-600), 0.5);
  border-radius: 2px;
  overflow: hidden;
}

.badge-progress-bar {
  height: 100%;
  background: rgba(var(--neon-cyan), 0.6);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.badge-progress-text {
  font-size: var(--text-xs);
  color: var(--gamification-text-secondary);
}

/* Tier-specific icon wrapper backgrounds */
.badge--earned.badge--bronze .badge-icon-wrapper {
  background: rgba(var(--tier-bronze), 0.15);
}

.badge--earned.badge--silver .badge-icon-wrapper {
  background: rgba(var(--tier-silver), 0.15);
}

.badge--earned.badge--gold .badge-icon-wrapper {
  background: rgba(var(--tier-gold), 0.15);
}

.badge--earned.badge--platinum .badge-icon-wrapper {
  background: rgba(var(--tier-platinum), 0.15);
}
</style>
