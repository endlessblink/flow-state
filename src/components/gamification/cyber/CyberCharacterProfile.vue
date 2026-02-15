<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useGamificationStore } from '@/stores/gamification'
import { useChallengesStore } from '@/stores/challenges'
import { useAuthStore } from '@/stores/auth'
import { useCyberflowTheme } from '@/composables/useCyberflowTheme'
import { EXTERNAL_URLS } from '@/config/urls'
import StatsRadar from './StatsRadar.vue'
import CorruptionMeter from './CorruptionMeter.vue'

const gamificationStore = useGamificationStore()
const challengesStore = useChallengesStore()
const authStore = useAuthStore()
const { showAtIntensity } = useCyberflowTheme()

const { levelInfo, streakInfo, totalXp, currentLevel, stats } = storeToRefs(gamificationStore)
const { corruptionLevel, corruptionTier } = storeToRefs(challengesStore)

// Avatar seed from user ID or email
const avatarSeed = computed(() => {
  if (authStore.user?.email) return authStore.user.email
  if (authStore.user?.id) return authStore.user.id
  return 'default-user'
})

const avatarUrl = computed(() =>
  `${EXTERNAL_URLS.DICEBEAR_API}?seed=${encodeURIComponent(avatarSeed.value)}`
)

// Derive player stats from user_stats data
const playerStats = computed(() => {
  const s = stats.value
  if (!s) {
    return { focus: 0, speed: 0, consistency: 0, depth: 0, endurance: 0 }
  }

  const focus = s.pomodorosCompleted > 0
    ? Math.min(100, Math.round((s.totalFocusMinutes / s.pomodorosCompleted) / 25 * 100))
    : 0

  const speed = Math.min(100, Math.round(s.speedCompletions / Math.max(1, s.tasksCompleted) * 100))

  const consistency = Math.min(100, Math.round((streakInfo.value.currentStreak / 30) * 100))

  const totalSessions = s.pomodorosCompleted || 1
  const longSessions = Math.round(s.totalFocusMinutes / 45)
  const depth = Math.min(100, Math.round((longSessions / totalSessions) * 100))

  const totalHours = s.totalFocusMinutes / 60
  const endurance = Math.min(100, Math.round((totalHours / 100) * 100))

  return { focus, speed, consistency, depth, endurance }
})

// Streak tier for fire effects
const streakTier = computed(() => {
  const streak = streakInfo.value.currentStreak
  if (streak >= 100) return 'legendary'
  if (streak >= 30) return 'epic'
  if (streak >= 7) return 'hot'
  return 'normal'
})

const flameIntensity = computed(() => {
  if (!showAtIntensity('moderate')) return 'none'
  const streak = streakInfo.value.currentStreak
  if (streak >= 100) return 'legendary'
  if (streak >= 30) return 'intense'
  if (streak >= 7) return 'moderate'
  if (streak > 0) return 'low'
  return 'none'
})
</script>

<template>
  <div
    class="cyber-profile cf-panel-inlay"
    data-augmented-ui="tl-clip br-clip border"
  >
    <!-- Avatar + Class Badge -->
    <div class="cyber-profile__identity">
      <div class="cyber-profile__avatar-frame">
        <img
          :src="avatarUrl"
          alt="Player avatar"
          class="cyber-profile__avatar"
          loading="lazy"
        >
      </div>

      <div class="cyber-profile__class-badge cf-badge" data-augmented-ui="tl-clip br-clip border">
        <span class="cyber-profile__class-name">NETRUNNER</span>
      </div>
    </div>

    <!-- Level + XP Bar -->
    <div class="cyber-profile__level-section">
      <div class="cyber-profile__level-header">
        <span class="cyber-profile__level-label">LEVEL</span>
        <span class="cyber-profile__level-number">{{ currentLevel }}</span>
      </div>

      <div
        class="cyber-profile__xp-bar-wrapper"
        data-augmented-ui="tl-clip-x br-clip-x border"
        role="progressbar"
        :aria-valuenow="levelInfo.currentXp"
        :aria-valuemin="0"
        :aria-valuemax="levelInfo.xpForNextLevel"
        :aria-label="`Level ${currentLevel}: ${levelInfo.currentXp} of ${levelInfo.xpForNextLevel} XP`"
      >
        <div class="cyber-profile__xp-track">
          <div
            class="cyber-profile__xp-fill"
            :style="{ width: `${levelInfo.progressPercent}%` }"
          />
          <div
            class="cyber-profile__xp-glow"
            :style="{ width: `${levelInfo.progressPercent}%` }"
          />
        </div>
      </div>

      <div class="cyber-profile__xp-text">
        <span>{{ levelInfo.currentXp.toLocaleString() }} / {{ levelInfo.xpForNextLevel.toLocaleString() }} XP</span>
        <span class="cyber-profile__total-xp">{{ totalXp.toLocaleString() }} total</span>
      </div>
    </div>

    <!-- Streak Counter -->
    <div
      class="cyber-profile__streak"
      :class="[
        `cyber-profile__streak--${streakTier}`,
        {
          'cyber-profile__streak--at-risk': streakInfo.streakAtRisk,
          'cyber-profile__streak--active': streakInfo.isActiveToday,
        }
      ]"
    >
      <!-- Flame effect -->
      <div
        v-if="flameIntensity !== 'none' && streakInfo.isActiveToday"
        class="cyber-profile__flame"
        :class="`flame--${flameIntensity}`"
        aria-hidden="true"
      />

      <div class="cyber-profile__streak-content">
        <span class="cyber-profile__streak-number">{{ streakInfo.currentStreak }}</span>
        <span class="cyber-profile__streak-label">
          day{{ streakInfo.currentStreak !== 1 ? 's' : '' }} streak
        </span>
      </div>

      <div v-if="streakInfo.streakAtRisk" class="cyber-profile__streak-warning" title="Complete a task today!">
        !
      </div>
    </div>

    <!-- Corruption Meter -->
    <div class="cyber-profile__corruption">
      <CorruptionMeter
        :level="corruptionLevel"
        :tier="corruptionTier.tier"
      />
    </div>

    <!-- Stats Radar -->
    <div class="cyber-profile__radar">
      <StatsRadar
        :stats="playerStats"
        :size="200"
      />
    </div>
  </div>
</template>

<style scoped>
.cyber-profile {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  --aug-border-all: 2px;
  --aug-border-bg: linear-gradient(135deg, var(--cf-cyan), var(--cf-magenta));
  --aug-inlay-all: var(--space-1);
  --aug-inlay-bg: rgba(0, 240, 255, 0.03);
  --aug-tl1: var(--space-6);
  --aug-br1: var(--space-6);
  background: var(--cf-dark-1);
  padding: var(--space-6);
}

/* Identity: Avatar + Class Badge */
.cyber-profile__identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.cyber-profile__avatar-frame {
  width: calc(var(--space-6) * 4);
  height: calc(var(--space-6) * 4);
  clip-path: polygon(var(--space-2) 0, 100% 0, 100% calc(100% - var(--space-2)), calc(100% - var(--space-2)) 100%, 0 100%, 0 var(--space-2));
  border: 2px solid var(--cf-cyan-50);
  box-shadow: var(--cf-glow-cyan-subtle);
  overflow: hidden;
  background: var(--cf-dark-3);
}

.cyber-profile__avatar {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.cyber-profile__class-badge {
  --aug-border-all: 2px;
  --aug-border-bg: var(--cf-magenta);
  --aug-tl1: var(--space-2);
  --aug-br1: var(--space-2);
  background: var(--cf-dark-3);
  padding: var(--space-1) var(--space-4);
}

.cyber-profile__class-name {
  font-family: var(--font-cyber-title);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--cf-magenta);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

/* Level + XP Bar */
.cyber-profile__level-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
}

.cyber-profile__level-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.cyber-profile__level-label {
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  color: var(--cf-cyan);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.7;
}

.cyber-profile__level-number {
  font-family: var(--font-cyber-title);
  font-size: var(--text-xl);
  font-weight: 800;
  color: var(--cf-cyan);
  text-shadow: 0 0 var(--space-2_5) var(--cf-cyan-50);
  line-height: 1;
}

.cyber-profile__xp-bar-wrapper {
  --aug-border-all: 1px;
  --aug-border-bg: var(--cf-cyan-50);
  --aug-tl1: var(--space-1);
  --aug-br1: var(--space-1);
  background: rgba(var(--color-slate-900), 0.5);
  padding: var(--space-0_5);
}

.cyber-profile__xp-track {
  position: relative;
  height: var(--space-2_5);
  background: rgba(var(--color-slate-900), 0.4);
  overflow: hidden;
}

.cyber-profile__xp-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--cf-cyan), var(--cf-purple));
  transition: width 0.5s ease-out;
}

.cyber-profile__xp-glow {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, transparent 60%, rgba(var(--color-slate-50), 0.2));
  pointer-events: none;
}

.cyber-profile__xp-text {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-cyber-data);
  font-size: var(--text-2xs);
  color: rgba(var(--color-slate-50), 0.5);
}

.cyber-profile__total-xp {
  color: var(--cf-purple-50);
}

/* Streak Counter */
.cyber-profile__streak {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  background: rgba(var(--color-slate-900), 0.3);
  border: 1px solid var(--cf-orange-20);
  border-radius: var(--radius-sm);
}

.cyber-profile__streak-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.cyber-profile__streak-number {
  font-family: var(--font-cyber-title);
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--cf-orange);
  text-shadow: 0 0 var(--space-2) var(--cf-orange-50);
}

.cyber-profile__streak--epic .cyber-profile__streak-number {
  color: hsl(var(--orange-600));
  text-shadow: 0 0 var(--space-2_5) rgba(255, 69, 0, 0.6);
}

.cyber-profile__streak--legendary .cyber-profile__streak-number {
  background: linear-gradient(90deg, var(--cf-cyan), var(--cf-magenta));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.cyber-profile__streak--legendary {
  border-color: var(--cf-magenta-50);
  box-shadow: var(--cf-glow-magenta-subtle);
}

.cyber-profile__streak-label {
  font-family: var(--font-cyber-data);
  font-size: var(--text-2xs);
  color: rgba(var(--color-slate-50), 0.4);
}

/* Flame effect */
.cyber-profile__flame {
  position: absolute;
  bottom: 50%;
  left: var(--space-6);
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 0;
}

.cyber-profile__flame::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  transform: translateX(-50%);
}

.flame--low::before {
  width: var(--space-4);
  height: calc(var(--space-5) + var(--space-0_5));
  background: radial-gradient(ellipse at bottom, rgba(255, 107, 53, 0.6), transparent);
  filter: blur(calc(var(--space-0_5) * 1.5));
  animation: streak-flicker 1.5s ease-in-out infinite alternate;
}

.flame--moderate::before {
  width: var(--space-5);
  height: calc(var(--space-6) + var(--space-1));
  background: radial-gradient(ellipse at bottom, rgba(255, 107, 53, 0.7), rgba(255, 0, 100, 0.3), transparent);
  filter: blur(calc(var(--space-0_5) * 1.5));
  animation: streak-flicker 1s ease-in-out infinite alternate;
}

.flame--intense::before {
  width: var(--space-6);
  height: calc(var(--space-8) + var(--space-0_5));
  background: radial-gradient(ellipse at bottom, hsl(var(--orange-500)), hsl(var(--pink-600)), transparent);
  filter: blur(var(--space-1));
  animation: streak-flicker 0.6s ease-in-out infinite alternate;
}

.flame--legendary::before {
  width: calc(var(--space-6) + var(--space-1_5));
  height: calc(var(--space-8) + var(--space-2_5));
  background: radial-gradient(ellipse at bottom, hsl(var(--purple-500)), hsl(var(--pink-600)), transparent);
  filter: blur(calc(var(--space-1) + var(--space-0_5)));
  animation: streak-flicker 0.4s ease-in-out infinite alternate;
}

@keyframes streak-flicker {
  from { transform: translateX(-50%) scale(1); opacity: 0.8; }
  to { transform: translateX(-50%) scale(1.15) rotate(2deg); opacity: 1; }
}

/* At-risk pulse */
.cyber-profile__streak--at-risk {
  border-color: rgba(251, 191, 36, 0.5);
  animation: streak-at-risk-pulse 1.5s ease-in-out infinite;
}

.cyber-profile__streak-warning {
  width: calc(var(--space-4) + var(--space-0_5));
  height: calc(var(--space-4) + var(--space-0_5));
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: hsl(var(--orange-400));
  color: hsl(var(--slate-900));
  font-family: var(--font-cyber-data);
  font-size: var(--text-2xs);
  font-weight: 700;
  animation: pulse-warning 1.5s ease-in-out infinite;
}

@keyframes streak-at-risk-pulse {
  0%, 100% { border-color: rgba(251, 191, 36, 0.3); }
  50% { border-color: rgba(251, 191, 36, 0.7); box-shadow: 0 0 var(--space-2) rgba(251, 191, 36, 0.2); }
}

@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Corruption section */
.cyber-profile__corruption {
  padding-top: var(--space-1);
}

/* Radar section */
.cyber-profile__radar {
  display: flex;
  justify-content: center;
}

@media (prefers-reduced-motion: reduce) {
  .cyber-profile__xp-fill {
    transition: none;
  }
  .cyber-profile__flame::before {
    animation: none;
  }
  .cyber-profile__streak--at-risk {
    animation: none;
  }
  .cyber-profile__streak-warning {
    animation: none;
  }
}
</style>
