<script setup lang="ts">
/**
 * CyberMissionCard Component
 * FEATURE-1132: Interactive, game-quality mission card
 *
 * Visual novel-styled with clear icons showing what to do in the app.
 * Clickable to activate (make it your focus mission).
 */
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Challenge } from '@/types/challenges'
import {
  CheckSquare,
  Timer,
  AlertTriangle,
  Clock,
  Flame,
  Folder,
  Sunrise,
  Layers,
  Zap,
} from 'lucide-vue-next'

const props = defineProps<{
  challenge: Challenge
  isActive?: boolean
}>()

const emit = defineEmits<{
  activate: []
}>()

// Reactive time remaining (updates every 60s)
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 60_000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// Progress
const progressPercent = computed(() =>
  Math.min(100, Math.round((props.challenge.objectiveCurrent / props.challenge.objectiveTarget) * 100))
)

// Time remaining
const timeRemaining = computed(() => {
  const ms = props.challenge.expiresAt.getTime() - now.value.getTime()
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}d left`
  }
  return `${hours}h left`
})

// Difficulty color mapping
const difficultyColor = computed(() => {
  switch (props.challenge.difficulty) {
    case 'easy': return 'var(--cf-lime)'
    case 'normal': return 'var(--cf-cyan)'
    case 'hard': return 'var(--cf-orange)'
    case 'boss': return 'var(--cf-magenta)'
    default: return 'var(--cf-cyan)'
  }
})

const difficultyColorDim = computed(() => {
  switch (props.challenge.difficulty) {
    case 'easy': return 'var(--cf-lime-20)'
    case 'normal': return 'var(--cf-cyan-20)'
    case 'hard': return 'var(--cf-orange-20)'
    case 'boss': return 'var(--cf-magenta-20)'
    default: return 'var(--cf-cyan-20)'
  }
})

// Objective icon mapping (CLEAR VISUAL LANGUAGE)
const objectiveIcon = computed(() => {
  switch (props.challenge.objectiveType) {
    case 'complete_tasks': return CheckSquare
    case 'complete_pomodoros': return Timer
    case 'clear_overdue': return AlertTriangle
    case 'focus_time_minutes': return Clock
    case 'complete_high_priority': return Flame
    case 'complete_project_tasks': return Folder
    case 'complete_before_hour': return Sunrise
    case 'complete_variety': return Layers
    default: return CheckSquare
  }
})

// Objective text (CLEAR ACTION VERBS)
const objectiveText = computed(() => {
  const current = props.challenge.objectiveCurrent
  const target = props.challenge.objectiveTarget
  const ctx = props.challenge.objectiveContext

  switch (props.challenge.objectiveType) {
    case 'complete_tasks':
      return `Complete ${target} task${target > 1 ? 's' : ''}`
    case 'complete_pomodoros':
      return `Do ${target} pomodoro${target > 1 ? 's' : ''}`
    case 'clear_overdue':
      return `Clear ${target} overdue task${target > 1 ? 's' : ''}`
    case 'focus_time_minutes':
      return `Focus ${target} minutes`
    case 'complete_high_priority':
      return `Clear ${target} urgent task${target > 1 ? 's' : ''}`
    case 'complete_project_tasks':
      return `${target} task${target > 1 ? 's' : ''} in ${ctx?.projectName || 'project'}`
    case 'complete_before_hour':
      return `${target} task${target > 1 ? 's' : ''} before ${ctx?.hour}:00`
    case 'complete_variety':
      return `Tasks across ${target} projects`
    default:
      return props.challenge.description
  }
})

// Status
const isCompleted = computed(() => props.challenge.status === 'completed')
const isFailed = computed(() => props.challenge.status === 'failed' || props.challenge.status === 'expired')

function handleClick() {
  if (!isCompleted.value && !isFailed.value) {
    emit('activate')
  }
}
</script>

<template>
  <div
    class="mission-card"
    :class="{
      'mission-card--active': isActive,
      'mission-card--completed': isCompleted,
      'mission-card--failed': isFailed,
    }"
    :style="{
      '--mission-accent': difficultyColor,
      '--mission-accent-dim': difficultyColorDim,
    }"
    @click="handleClick"
  >
    <!-- Left: Objective Icon (BIG, CLEAR) -->
    <div class="mission-card__icon-box">
      <component
        :is="objectiveIcon"
        class="mission-card__icon"
        :size="40"
      />
    </div>

    <!-- Center: Objective + Progress -->
    <div class="mission-card__content">
      <h3 class="mission-card__objective">{{ objectiveText }}</h3>

      <!-- Progress bar -->
      <div class="mission-card__progress-row">
        <div class="mission-card__progress-track">
          <div
            class="mission-card__progress-fill"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <span class="mission-card__progress-text">{{ challenge.objectiveCurrent }}/{{ challenge.objectiveTarget }}</span>
      </div>

      <!-- Difficulty + Time -->
      <div class="mission-card__meta">
        <span class="mission-card__difficulty">{{ challenge.difficulty.toUpperCase() }}</span>
        <span class="mission-card__time">{{ timeRemaining }}</span>
      </div>
    </div>

    <!-- Right: XP Badge + Activate Button -->
    <div class="mission-card__right">
      <!-- XP Badge -->
      <div class="mission-card__xp-badge">
        <Zap :size="14" />
        <span>+{{ challenge.rewardXp }}</span>
      </div>

      <!-- Activate Button (only visible when not active) -->
      <button
        v-if="!isActive && !isCompleted && !isFailed"
        class="mission-card__activate-btn"
        @click.stop="handleClick"
      >
        ACTIVATE
      </button>

      <!-- Active indicator -->
      <div v-if="isActive && !isCompleted && !isFailed" class="mission-card__active-indicator">
        ACTIVE
      </div>

      <!-- Completed/Failed badge -->
      <div v-if="isCompleted" class="mission-card__status-badge mission-card__status-badge--completed">
        ✓ DONE
      </div>
      <div v-if="isFailed" class="mission-card__status-badge mission-card__status-badge--failed">
        FAILED
      </div>
    </div>
  </div>
</template>

<style scoped>
.mission-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--cf-dark-3);
  border: 2px solid var(--mission-accent-dim);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  min-height: 90px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

/* Glow overlay on hover */
.mission-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, var(--mission-accent-dim), transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.mission-card:hover::before {
  opacity: 0.2;
}

/* Active state */
.mission-card--active {
  border-color: var(--mission-accent);
  transform: scale(1.02);
  box-shadow: 0 0 24px var(--mission-accent-dim), 0 4px 12px rgba(0, 0, 0, 0.3);
}

.mission-card--active::before {
  opacity: 0.25;
}

/* Inactive siblings when one is active */
.mission-card:not(.mission-card--active) {
  opacity: 0.6;
}

.mission-card--active:hover {
  transform: scale(1.03);
  box-shadow: 0 0 32px var(--mission-accent-dim), 0 6px 16px rgba(0, 0, 0, 0.4);
}

/* Completed state */
.mission-card--completed {
  border-color: var(--cf-lime);
  opacity: 0.7;
  cursor: default;
}

.mission-card--completed:hover::before {
  opacity: 0;
}

/* Failed state */
.mission-card--failed {
  border-color: var(--cf-magenta);
  opacity: 0.5;
  cursor: default;
}

.mission-card--failed:hover::before {
  opacity: 0;
}

/* Icon Box */
.mission-card__icon-box {
  flex-shrink: 0;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mission-accent-dim);
  border: 2px solid var(--mission-accent);
  border-radius: var(--radius-md);
  box-shadow: 0 0 16px var(--mission-accent-dim);
  transition: all 0.3s ease;
}

.mission-card--active .mission-card__icon-box {
  box-shadow: 0 0 24px var(--mission-accent);
}

.mission-card__icon {
  color: var(--mission-accent);
  filter: drop-shadow(0 0 6px var(--mission-accent));
}

/* Content */
.mission-card__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.mission-card__objective {
  margin: 0;
  font-family: var(--font-cyber-title);
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.01em;
  line-height: 1.3;
}

/* Progress Row */
.mission-card__progress-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.mission-card__progress-track {
  flex: 1;
  height: 6px;
  background: var(--cf-dark-2);
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
}

.mission-card__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--mission-accent), var(--cf-cyan));
  border-radius: 3px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 8px var(--mission-accent);
}

.mission-card--active .mission-card__progress-fill {
  box-shadow: 0 0 12px var(--mission-accent);
}

.mission-card__progress-text {
  font-family: var(--font-cyber-data);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: right;
}

/* Meta row */
.mission-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  letter-spacing: 0.06em;
}

.mission-card__difficulty {
  font-weight: 700;
  color: var(--mission-accent);
  opacity: 0.9;
}

.mission-card__time {
  font-weight: 600;
  color: var(--text-muted);
}

/* Right section */
.mission-card__right {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
}

/* XP Badge */
.mission-card__xp-badge {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--cf-dark-2);
  border: 1px solid var(--cf-gold);
  border-radius: var(--radius-sm);
  font-family: var(--font-cyber-data);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--cf-gold);
  box-shadow: 0 0 10px rgba(255, 193, 7, 0.2);
}

.mission-card__xp-badge svg {
  color: var(--cf-gold);
}

/* Activate Button */
.mission-card__activate-btn {
  padding: var(--space-1) var(--space-3);
  background: var(--cf-dark-2);
  border: 1px solid var(--mission-accent);
  border-radius: var(--radius-sm);
  color: var(--mission-accent);
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.3s ease;
}

.mission-card__activate-btn:hover {
  background: var(--mission-accent-dim);
  border-color: var(--mission-accent);
  box-shadow: 0 0 12px var(--mission-accent-dim);
  transform: translateY(-1px);
}

/* Active indicator */
.mission-card__active-indicator {
  padding: var(--space-1) var(--space-3);
  background: var(--mission-accent);
  border: 1px solid var(--mission-accent);
  border-radius: var(--radius-sm);
  color: var(--cf-dark-1);
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
  box-shadow: 0 0 16px var(--mission-accent);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 16px var(--mission-accent);
  }
  50% {
    box-shadow: 0 0 24px var(--mission-accent);
  }
}

/* Status badges */
.mission-card__status-badge {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-family: var(--font-cyber-data);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.mission-card__status-badge--completed {
  background: var(--cf-lime);
  color: var(--cf-dark-1);
  border: 1px solid var(--cf-lime);
  box-shadow: 0 0 12px var(--cf-lime-20);
}

.mission-card__status-badge--failed {
  background: var(--cf-magenta);
  color: var(--cf-dark-1);
  border: 1px solid var(--cf-magenta);
  box-shadow: 0 0 12px var(--cf-magenta-20);
}

@media (prefers-reduced-motion: reduce) {
  .mission-card,
  .mission-card::before,
  .mission-card__progress-fill,
  .mission-card__activate-btn,
  .mission-card__icon-box {
    transition: none;
  }

  .mission-card__active-indicator {
    animation: none;
  }
}
</style>
