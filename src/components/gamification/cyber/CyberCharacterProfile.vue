<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useGamificationStore } from '@/stores/gamification'
import { useChallengesStore } from '@/stores/challenges'
import { useAuthStore } from '@/stores/auth'
import { useCyberflowTheme } from '@/composables/useCyberflowTheme'
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
  `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(avatarSeed.value)}`
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
          :alt="`Player avatar`"
          class="cyber-profile__avatar"
          loading="lazy"
        />
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
  gap: 20px;
  --aug-border-all: 2px;
  --aug-border-bg: linear-gradient(135deg, var(--cf-cyan), var(--cf-magenta));
  --aug-inlay-all: 4px;
  --aug-inlay-bg: rgba(0, 240, 255, 0.03);
  --aug-tl1: 24px;
  --aug-br1: 24px;
  background: var(--cf-dark-1);
  padding: 24px;
}

/* Identity: Avatar + Class Badge */
.cyber-profile__identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.cyber-profile__avatar-frame {
  width: 96px;
  height: 96px;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
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
  --aug-tl1: 8px;
  --aug-br1: 8px;
  background: var(--cf-dark-3);
  padding: 4px 16px;
}

.cyber-profile__class-name {
  font-family: var(--font-cyber-title);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--cf-magenta);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

/* Level + XP Bar */
.cyber-profile__level-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cyber-profile__level-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.cyber-profile__level-label {
  font-family: var(--font-cyber-data);
  font-size: 0.65rem;
  color: var(--cf-cyan);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.7;
}

.cyber-profile__level-number {
  font-family: var(--font-cyber-title);
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--cf-cyan);
  text-shadow: 0 0 10px var(--cf-cyan-50);
  line-height: 1;
}

.cyber-profile__xp-bar-wrapper {
  --aug-border-all: 1px;
  --aug-border-bg: var(--cf-cyan-50);
  --aug-tl1: 4px;
  --aug-br1: 4px;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px;
}

.cyber-profile__xp-track {
  position: relative;
  height: 10px;
  background: rgba(0, 0, 0, 0.4);
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
  background: linear-gradient(90deg, transparent 60%, rgba(255, 255, 255, 0.2));
  pointer-events: none;
}

.cyber-profile__xp-text {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-cyber-data);
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.5);
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
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--cf-orange-20);
  border-radius: 4px;
}

.cyber-profile__streak-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.cyber-profile__streak-number {
  font-family: var(--font-cyber-title);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--cf-orange);
  text-shadow: 0 0 8px var(--cf-orange-50);
}

.cyber-profile__streak--epic .cyber-profile__streak-number {
  color: #ff4500;
  text-shadow: 0 0 10px rgba(255, 69, 0, 0.6);
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
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
}

/* Flame effect */
.cyber-profile__flame {
  position: absolute;
  bottom: 50%;
  left: 24px;
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
  width: 16px;
  height: 22px;
  background: radial-gradient(ellipse at bottom, rgba(255, 107, 53, 0.6), transparent);
  filter: blur(3px);
  animation: streak-flicker 1.5s ease-in-out infinite alternate;
}

.flame--moderate::before {
  width: 20px;
  height: 28px;
  background: radial-gradient(ellipse at bottom, rgba(255, 107, 53, 0.7), rgba(255, 0, 100, 0.3), transparent);
  filter: blur(3px);
  animation: streak-flicker 1s ease-in-out infinite alternate;
}

.flame--intense::before {
  width: 24px;
  height: 34px;
  background: radial-gradient(ellipse at bottom, #ff6b35, #ff0064, transparent);
  filter: blur(4px);
  animation: streak-flicker 0.6s ease-in-out infinite alternate;
}

.flame--legendary::before {
  width: 30px;
  height: 42px;
  background: radial-gradient(ellipse at bottom, #ff00ff, #ff0064, transparent);
  filter: blur(5px);
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
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgb(251, 191, 36);
  color: black;
  font-family: var(--font-cyber-data);
  font-size: 0.7rem;
  font-weight: 700;
  animation: pulse-warning 1.5s ease-in-out infinite;
}

@keyframes streak-at-risk-pulse {
  0%, 100% { border-color: rgba(251, 191, 36, 0.3); }
  50% { border-color: rgba(251, 191, 36, 0.7); box-shadow: 0 0 8px rgba(251, 191, 36, 0.2); }
}

@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Corruption section */
.cyber-profile__corruption {
  padding-top: 4px;
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
