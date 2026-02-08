<script setup lang="ts">
/**
 * CyberBossFight - Weekly Boss Fight Panel
 * FEATURE-1118 Cyberflow RPG Hub: Game-quality boss encounter
 *
 * Redesigned for immersive RPG boss fight experience:
 * - Fills viewport without scrolling
 * - Huge dramatic HP bar with phase markers
 * - Clear objective display (what to DO in the app)
 * - Visual-first (icons over text)
 * - All states: active, defeated, failed, no boss
 */
import { computed, ref, watch } from 'vue'
import { useChallengesStore } from '@/stores/challenges'
import { useCyberflowTheme } from '@/composables/useCyberflowTheme'
import { Skull, Trophy, Clock, Zap, Target, AlertTriangle } from 'lucide-vue-next'
import type { ChallengeObjective } from '@/types/challenges'

const challengesStore = useChallengesStore()
const { showAtIntensity } = useCyberflowTheme()

// Active boss (undefined if none active)
const boss = computed(() => challengesStore.activeBoss)

// HP calculations
const totalHp = computed(() => boss.value?.objectiveTarget || 0)
const currentHp = computed(() => {
  if (!boss.value) return 0
  return boss.value.objectiveTarget - boss.value.objectiveCurrent
})
const damageDealt = computed(() => boss.value?.objectiveCurrent || 0)
const hpPercent = computed(() => {
  if (totalHp.value === 0) return 0
  return Math.max(0, Math.min(100, (currentHp.value / totalHp.value) * 100))
})

// HP trailing animation (delayed bar)
const trailPercent = ref(100)
watch(hpPercent, (newVal) => {
  setTimeout(() => {
    trailPercent.value = newVal
  }, 100)
}, { immediate: true })

// Phase calculation (1/2/3)
const phase = computed(() => {
  const hp = hpPercent.value
  if (hp > 66) return 1
  if (hp > 33) return 2
  return 3
})

// HP bar color
const hpColor = computed(() => {
  const hp = hpPercent.value
  if (hp > 50) return 'var(--cf-lime, #39ff14)'
  if (hp > 25) return 'var(--cf-orange, #ff6b35)'
  return 'var(--cf-magenta, #ff006e)'
})

// Objective display text
const objectiveText = computed(() => {
  if (!boss.value) return ''

  const target = boss.value.objectiveTarget
  const type = boss.value.objectiveType

  const mapping: Record<ChallengeObjective, string> = {
    complete_tasks: `Complete ${target} tasks this week`,
    complete_pomodoros: `Complete ${target} pomodoro sessions`,
    focus_time_minutes: `Accumulate ${target} minutes of focus`,
    clear_overdue: `Clear ${target} overdue tasks`,
    complete_high_priority: `Complete ${target} high-priority tasks`,
    complete_project_tasks: `Complete ${target} tasks in ${boss.value.objectiveContext?.projectName || 'project'}`,
    complete_before_hour: `Complete ${target} tasks before ${boss.value.objectiveContext?.hour || 12}:00`,
    complete_variety: `Complete tasks across ${target} different projects`,
  }

  return mapping[type] || boss.value.description
})

// Single-line status message
const statusMessage = computed(() => {
  if (!boss.value) return ''

  if (boss.value.status === 'completed') {
    return 'THREAT NEUTRALIZED'
  }

  if (boss.value.status === 'failed' || boss.value.status === 'expired') {
    return 'MISSION FAILED'
  }

  const hp = hpPercent.value

  if (hp > 66) return 'Target integrity holding'
  if (hp > 33) return 'Target showing vulnerability'
  return 'CRITICAL DAMAGE — Exercise caution'
})

// Time remaining
const timeRemaining = computed(() => {
  if (!boss.value) return ''

  const now = new Date()
  const expires = boss.value.expiresAt
  const diff = expires.getTime() - now.getTime()

  if (diff <= 0) return 'EXPIRED'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
})

const isUrgent = computed(() => {
  if (!boss.value) return false
  const now = new Date()
  const diff = boss.value.expiresAt.getTime() - now.getTime()
  return diff < 24 * 60 * 60 * 1000 // Less than 24 hours
})

// Victory/failure states
const isDefeated = computed(() => boss.value?.status === 'completed')
const isFailed = computed(() => boss.value?.status === 'failed' || boss.value?.status === 'expired')

// Flash damage effect
const showDamageFlash = ref(false)
watch(damageDealt, (newVal, oldVal) => {
  if (newVal > oldVal) {
    showDamageFlash.value = true
    setTimeout(() => {
      showDamageFlash.value = false
    }, 200)
  }
})
</script>

<template>
  <div
    class="cyber-boss-fight"
    data-augmented-ui="tr-clip bl-clip border"
  >
    <!-- Active Boss -->
    <template v-if="boss">
      <!-- Boss Name (glitch text, large) -->
      <h3
        class="cbf-boss-name"
        :class="[
          showAtIntensity('intense') ? 'cf-glitch' : '',
          {
            'cbf-boss-name--defeated': isDefeated,
            'cbf-boss-name--failed': isFailed
          }
        ]"
      >
        <Skull v-if="!isDefeated && !isFailed" :size="28" class="cbf-name-icon" />
        <Trophy v-else-if="isDefeated" :size="28" class="cbf-name-icon cbf-name-icon--victory" />
        <AlertTriangle v-else-if="isFailed" :size="28" class="cbf-name-icon cbf-name-icon--failed" />
        {{ boss.title }}
      </h3>

      <!-- Difficulty Badge -->
      <div class="cbf-difficulty">
        <span class="cbf-difficulty-label">DIFFICULTY:</span>
        <span class="cbf-difficulty-value">BOSS</span>
      </div>

      <!-- HP Bar (THE hero element - huge and dramatic) -->
      <div
        class="cbf-hp-bar"
        role="progressbar"
        :aria-valuenow="currentHp"
        :aria-valuemin="0"
        :aria-valuemax="totalHp"
        :aria-label="`Boss HP: ${currentHp} / ${totalHp}`"
      >
        <!-- Background layer -->
        <div class="cbf-hp-bg" />

        <!-- Damage trail (delayed yellow) -->
        <div
          v-if="showAtIntensity('moderate')"
          class="cbf-hp-trail"
          :style="{ width: `${trailPercent}%` }"
        />

        <!-- Current HP (green/orange/red) -->
        <div
          class="cbf-hp-fill"
          :class="[
            { 'cbf-hp-fill--pulse': hpPercent < 25 },
            { 'cbf-hp-fill--flash': showDamageFlash }
          ]"
          :style="{
            width: `${hpPercent}%`,
            background: hpColor
          }"
        />

        <!-- Phase markers (vertical lines at 33% and 66%) -->
        <div class="cbf-phase-marker cbf-phase-marker--66" />
        <div class="cbf-phase-marker cbf-phase-marker--33" />

        <!-- HP text overlay -->
        <div class="cbf-hp-text">
          {{ Math.round(hpPercent) }}% HP
        </div>
      </div>

      <!-- Phase + Damage Row -->
      <div class="cbf-meta-row">
        <!-- Phase Dots (3 circles) -->
        <div class="cbf-phase-dots">
          <span class="cbf-phase-label">PHASE</span>
          <div
            class="cbf-phase-dot"
            :class="{ 'cbf-phase-dot--active': phase >= 1 }"
          />
          <div
            class="cbf-phase-dot"
            :class="{ 'cbf-phase-dot--active': phase >= 2 }"
          />
          <div
            class="cbf-phase-dot"
            :class="{ 'cbf-phase-dot--active': phase >= 3 }"
          />
        </div>

        <!-- Damage Counter (big bold number) -->
        <div class="cbf-damage">
          <span class="cbf-damage-label">DMG:</span>
          <span class="cbf-damage-value">{{ damageDealt }}/{{ totalHp }}</span>
        </div>
      </div>

      <!-- Status Message (single line) -->
      <div class="cbf-status">
        {{ statusMessage }}
      </div>

      <!-- Info Row: Time + Reward -->
      <div class="cbf-info-row">
        <!-- Time Remaining -->
        <div
          class="cbf-info-badge cbf-time-badge"
          :class="{ 'cbf-time-badge--urgent': isUrgent }"
        >
          <Clock :size="16" />
          <span>{{ timeRemaining }} LEFT</span>
        </div>

        <!-- Reward Badge -->
        <div class="cbf-info-badge cbf-reward-badge">
          <Zap :size="16" />
          <span>+{{ boss.rewardXp }} XP REWARD</span>
        </div>
      </div>

      <!-- Objective (what to DO) -->
      <div class="cbf-objective">
        <div class="cbf-objective-header">
          <Target :size="16" />
          <span>OBJECTIVE:</span>
        </div>
        <div class="cbf-objective-text">{{ objectiveText }}</div>
        <!-- Progress bar -->
        <div class="cbf-objective-progress">
          <div
            class="cbf-objective-fill"
            :style="{ width: `${(damageDealt / totalHp) * 100}%` }"
          />
        </div>
        <div class="cbf-objective-count">{{ damageDealt }}/{{ totalHp }} tasks</div>
      </div>

      <!-- Victory State Overlay -->
      <div
        v-if="isDefeated"
        class="cbf-victory-overlay"
      >
        <div class="cbf-victory-text">TERMINATED</div>
      </div>

      <!-- Failed State Overlay -->
      <div
        v-if="isFailed"
        class="cbf-failure-overlay"
      >
        <div class="cbf-failure-text">MISSION FAILED</div>
      </div>
    </template>

    <!-- No Boss State -->
    <template v-else>
      <div class="cbf-no-boss">
        <Skull
          :size="64"
          class="cbf-icon cbf-icon--dimmed"
        />
        <div class="cbf-no-boss-text">NO ACTIVE THREAT</div>
        <div class="cbf-no-boss-sub">&gt; SYSTEMS NOMINAL_</div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cyber-boss-fight {
  --aug-border-all: 2px;
  --aug-border-bg: linear-gradient(135deg, var(--cf-magenta), var(--cf-orange));
  --aug-tr1: 20px;
  --aug-bl1: 20px;
  background: var(--cf-dark-2);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  position: relative;
  overflow: hidden;
  height: 100%;
  box-sizing: border-box;
}

/* Boss Name (with inline icon) */
.cbf-boss-name {
  font-family: var(--font-cyber-title);
  font-size: var(--text-xl);
  font-weight: 900;
  color: var(--cf-magenta);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  line-height: 1.2;
  text-shadow: 0 0 16px var(--cf-magenta);
  margin: 0;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.cbf-boss-name--defeated {
  color: var(--cf-lime);
  text-shadow: 0 0 16px var(--cf-lime);
}

.cbf-boss-name--failed {
  color: var(--cf-orange);
  text-shadow: 0 0 16px var(--cf-orange);
}

.cbf-name-icon {
  filter: drop-shadow(0 0 12px var(--cf-magenta));
}

.cbf-name-icon--victory {
  filter: drop-shadow(0 0 12px var(--cf-lime));
  animation: icon-victory 1.5s ease-in-out infinite;
}

.cbf-name-icon--failed {
  filter: drop-shadow(0 0 12px var(--cf-orange));
}

@keyframes icon-victory {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.1) rotate(5deg); }
}

/* Difficulty Badge */
.cbf-difficulty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  flex-shrink: 0;
}

.cbf-difficulty-label {
  opacity: 0.7;
}

.cbf-difficulty-value {
  color: var(--cf-magenta);
  font-weight: 700;
  text-shadow: 0 0 8px var(--cf-magenta);
}

/* HP Bar (THE hero element - huge and dramatic) */
.cbf-hp-bar {
  position: relative;
  height: 50px;
  border: 2px solid var(--border-subtle);
  overflow: hidden;
  background: var(--cf-dark-3);
  border-radius: var(--radius-md);
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

/* HP Background Layer */
.cbf-hp-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.02) 0px,
    rgba(255, 255, 255, 0.02) 2px,
    transparent 2px,
    transparent 4px
  );
}

/* HP Damage Trail (yellow, delayed) */
.cbf-hp-trail {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--cf-orange);
  opacity: 0.4;
  transition: width 0.8s ease-out;
}

/* HP Current Fill */
.cbf-hp-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transition: width 0.3s ease-out, background 0.3s ease;
  box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.2);
}

.cbf-hp-fill--pulse {
  animation: hp-pulse 1s ease-in-out infinite;
}

.cbf-hp-fill--flash {
  box-shadow: inset 0 0 30px rgba(255, 255, 255, 0.8);
}

@keyframes hp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Phase markers (vertical lines) */
.cbf-phase-marker {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
  background: rgba(255, 255, 255, 0.4);
  z-index: 2;
}

.cbf-phase-marker--66 {
  left: 66%;
}

.cbf-phase-marker--33 {
  left: 33%;
}

/* HP Text Overlay */
.cbf-hp-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-cyber-data);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.8), 0 0 8px rgba(0, 0, 0, 0.8);
  z-index: 3;
  pointer-events: none;
}

/* Phase + Damage Row */
.cbf-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-shrink: 0;
}

/* Phase Dots (3 circles with label) */
.cbf-phase-dots {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.cbf-phase-label {
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
}

.cbf-phase-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--cf-dark-3);
  border: 2px solid var(--border-subtle);
  transition: all 0.3s ease;
}

.cbf-phase-dot--active {
  background: var(--cf-magenta);
  border-color: var(--cf-magenta);
  box-shadow: 0 0 10px var(--cf-magenta);
}

/* Status Line (single message, centered) */
.cbf-status {
  font-family: var(--font-cyber-data);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
  flex-shrink: 0;
  padding: var(--space-2) 0;
}

/* Info Row: Time + Reward */
.cbf-info-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.cbf-info-badge {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--cf-dark-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
}

.cbf-time-badge--urgent {
  background: rgba(251, 191, 36, 0.1);
  border-color: rgba(251, 191, 36, 0.4);
  color: rgb(251, 191, 36);
  animation: time-urgent-pulse 1.5s ease-in-out infinite;
}

.cbf-reward-badge {
  border-color: var(--cf-lime);
  color: var(--cf-lime);
}

@keyframes time-urgent-pulse {
  0%, 100% { border-color: rgba(251, 191, 36, 0.3); }
  50% { border-color: rgba(251, 191, 36, 0.7); box-shadow: 0 0 8px rgba(251, 191, 36, 0.2); }
}

/* Damage Counter (in meta row, compact) */
.cbf-damage {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(255, 107, 53, 0.1);
  border: 2px solid var(--cf-orange);
  border-radius: var(--radius-md);
  box-shadow: 0 0 12px rgba(255, 107, 53, 0.3);
}

.cbf-damage-label {
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  letter-spacing: 0.1em;
  font-weight: 700;
}

.cbf-damage-value {
  font-family: var(--font-cyber-title);
  font-size: var(--text-lg);
  font-weight: 900;
  color: var(--cf-orange);
  text-shadow: 0 0 12px var(--cf-orange);
  line-height: 1;
}

/* Objective Section */
.cbf-objective {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: rgba(57, 255, 20, 0.05);
  border: 1px solid var(--cf-lime);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.cbf-objective-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  color: var(--cf-lime);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 700;
}

.cbf-objective-text {
  font-family: var(--font-cyber-ui);
  font-size: var(--text-sm);
  color: var(--text-primary);
  line-height: 1.4;
}

.cbf-objective-progress {
  position: relative;
  height: 8px;
  background: var(--cf-dark-3);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.cbf-objective-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--cf-lime), var(--cf-cyan));
  transition: width 0.3s ease;
  box-shadow: 0 0 8px var(--cf-lime);
}

.cbf-objective-count {
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: right;
}

/* Victory Overlay */
.cbf-victory-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, rgba(57, 255, 20, 0.2) 0%, rgba(0, 0, 0, 0.9) 100%);
  backdrop-filter: blur(6px);
  z-index: 10;
  pointer-events: none;
}

.cbf-victory-text {
  font-family: var(--font-cyber-title);
  font-size: var(--text-3xl);
  font-weight: 900;
  color: var(--cf-lime);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  text-shadow:
    0 0 10px var(--cf-lime),
    0 0 20px var(--cf-lime),
    0 0 30px var(--cf-lime);
  animation: victory-pulse 1.5s ease-in-out infinite;
}

@keyframes victory-pulse {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.05); opacity: 1; }
}

/* Failed Overlay */
.cbf-failure-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, rgba(255, 107, 53, 0.2) 0%, rgba(0, 0, 0, 0.9) 100%);
  backdrop-filter: blur(6px);
  z-index: 10;
  pointer-events: none;
}

.cbf-failure-text {
  font-family: var(--font-cyber-title);
  font-size: var(--text-3xl);
  font-weight: 900;
  color: var(--cf-orange);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  text-shadow:
    0 0 10px var(--cf-orange),
    0 0 20px var(--cf-orange),
    0 0 30px var(--cf-orange);
}

/* No Boss State */
.cbf-no-boss {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  flex: 1;
}

.cbf-icon--dimmed {
  color: var(--text-muted);
  opacity: 0.3;
  filter: none;
}

.cbf-no-boss-text {
  font-family: var(--font-cyber-title);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--cf-cyan);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.5;
  margin-top: var(--space-2);
}

.cbf-no-boss-sub {
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .cbf-hp-trail {
    transition: none;
  }

  .cbf-hp-fill {
    transition: none;
    animation: none;
  }

  .cbf-hp-fill--pulse {
    animation: none;
  }

  .cbf-time-badge--urgent {
    animation: none;
  }

  .cbf-victory-text {
    animation: none;
  }

  .cbf-phase-dot {
    transition: none;
  }

  .cbf-name-icon--victory {
    animation: none;
  }

  .cbf-objective-fill {
    transition: none;
  }
}
</style>
