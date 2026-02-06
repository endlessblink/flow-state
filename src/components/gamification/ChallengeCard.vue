<script setup lang="ts">
/**
 * ChallengeCard Component
 * FEATURE-1132: Individual challenge display with progress bar
 */
import { computed } from 'vue'
import type { Challenge } from '@/types/challenges'
import { Target, Zap, Clock, CheckCircle, XCircle, Timer } from 'lucide-vue-next'

const props = defineProps<{
  challenge: Challenge
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', challenge: Challenge): void
}>()

// Progress percentage
const progressPercent = computed(() =>
  Math.min(100, Math.round((props.challenge.objectiveCurrent / props.challenge.objectiveTarget) * 100))
)

// Time remaining
const timeRemaining = computed(() => {
  const now = new Date()
  const expires = new Date(props.challenge.expiresAt)
  const diff = expires.getTime() - now.getTime()

  if (diff <= 0) return 'Expired'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
})

// Status colors
const statusColors = computed(() => {
  switch (props.challenge.status) {
    case 'completed':
      return 'bg-green-500/20 border-green-500/50 text-green-400'
    case 'failed':
    case 'expired':
      return 'bg-red-500/20 border-red-500/50 text-red-400'
    default:
      return 'bg-gray-800/50 border-cyan-500/30 text-gray-200'
  }
})

// Difficulty badge styles
const difficultyStyles = computed(() => {
  switch (props.challenge.difficulty) {
    case 'easy':
      return 'bg-green-500/20 text-green-400'
    case 'normal':
      return 'bg-blue-500/20 text-blue-400'
    case 'hard':
      return 'bg-orange-500/20 text-orange-400'
    case 'boss':
      return 'bg-purple-500/20 text-purple-400'
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
})

// Objective label
const objectiveLabel = computed(() => {
  switch (props.challenge.objectiveType) {
    case 'complete_tasks':
      return 'Complete tasks'
    case 'complete_pomodoros':
      return 'Pomodoro sessions'
    case 'clear_overdue':
      return 'Clear overdue'
    case 'focus_time_minutes':
      return 'Focus minutes'
    case 'complete_high_priority':
      return 'High priority tasks'
    case 'complete_project_tasks':
      return `Tasks in ${props.challenge.objectiveContext?.projectName || 'project'}`
    case 'complete_before_hour':
      return `Complete before ${props.challenge.objectiveContext?.hour || 12}:00`
    case 'complete_variety':
      return 'Projects touched'
    default:
      return 'Complete objective'
  }
})

function handleClick() {
  emit('click', props.challenge)
}
</script>

<template>
  <div
    class="challenge-card"
    :class="[
      statusColors,
      { 'challenge-card--compact': compact, 'challenge-card--completed': challenge.status === 'completed' }
    ]"
    @click="handleClick"
  >
    <!-- Header -->
    <div class="challenge-header">
      <div class="challenge-title-row">
        <Target
          v-if="challenge.status === 'active'"
          class="challenge-icon"
          :size="compact ? 14 : 16"
        />
        <CheckCircle
          v-else-if="challenge.status === 'completed'"
          class="challenge-icon text-green-400"
          :size="compact ? 14 : 16"
        />
        <XCircle
          v-else
          class="challenge-icon text-red-400"
          :size="compact ? 14 : 16"
        />
        <span class="challenge-title">{{ challenge.title }}</span>
      </div>

      <div class="challenge-badges">
        <span class="difficulty-badge" :class="difficultyStyles">
          {{ challenge.difficulty }}
        </span>
        <span
          v-if="challenge.status === 'active'"
          class="time-badge"
        >
          <Clock :size="12" />
          {{ timeRemaining }}
        </span>
      </div>
    </div>

    <!-- Description (not in compact mode) -->
    <p
      v-if="!compact"
      class="challenge-description"
    >
      {{ challenge.description }}
    </p>

    <!-- Progress -->
    <div class="challenge-progress">
      <div class="progress-bar-container">
        <div
          class="progress-bar"
          :style="{ width: `${progressPercent}%` }"
          :class="{
            'progress-bar--complete': progressPercent >= 100,
            'progress-bar--low': progressPercent < 33,
            'progress-bar--mid': progressPercent >= 33 && progressPercent < 66,
          }"
        />
      </div>
      <div class="progress-text">
        <span class="progress-values">
          {{ challenge.objectiveCurrent }}/{{ challenge.objectiveTarget }}
        </span>
        <span class="progress-label">
          {{ objectiveLabel }}
        </span>
      </div>
    </div>

    <!-- Rewards -->
    <div class="challenge-rewards">
      <div class="reward reward--xp">
        <Zap :size="14" />
        <span>{{ challenge.status === 'completed' ? '+' : '' }}{{ challenge.rewardXp }} XP</span>
      </div>
      <div
        v-if="challenge.penaltyXp > 0 && challenge.status === 'active'"
        class="reward reward--penalty"
      >
        <Timer :size="14" />
        <span>-{{ challenge.penaltyXp }} if failed</span>
      </div>
    </div>

    <!-- Narrative flavor (not in compact mode) -->
    <p
      v-if="!compact && challenge.narrativeFlavor"
      class="challenge-narrative"
    >
      "{{ challenge.narrativeFlavor }}"
    </p>
  </div>
</template>

<style scoped>
.challenge-card {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s ease;
}

.challenge-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.challenge-card--compact {
  padding: var(--space-2);
}

.challenge-card--completed {
  opacity: 0.8;
}

.challenge-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.challenge-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.challenge-icon {
  flex-shrink: 0;
  color: var(--color-primary-400);
}

.challenge-title {
  font-weight: 600;
  font-size: var(--text-sm);
  line-height: 1.3;
}

.challenge-badges {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.difficulty-badge,
.time-badge {
  font-size: var(--text-xs);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  text-transform: uppercase;
}

.time-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-gray-300);
}

.challenge-description {
  font-size: var(--text-xs);
  color: var(--color-gray-400);
  margin-bottom: var(--space-2);
  line-height: 1.4;
}

.challenge-progress {
  margin-bottom: var(--space-2);
}

.progress-bar-container {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: var(--space-1);
}

.progress-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
  background: linear-gradient(90deg, var(--color-primary-500), var(--color-accent-cyan));
}

.progress-bar--complete {
  background: linear-gradient(90deg, var(--color-success-500), var(--color-success-400));
}

.progress-bar--low {
  background: linear-gradient(90deg, var(--color-error-500), var(--color-warning-500));
}

.progress-bar--mid {
  background: linear-gradient(90deg, var(--color-warning-500), var(--color-primary-500));
}

.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-xs);
}

.progress-values {
  font-weight: 600;
  color: var(--color-gray-200);
}

.progress-label {
  color: var(--color-gray-500);
}

.challenge-rewards {
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-xs);
}

.reward {
  display: flex;
  align-items: center;
  gap: 4px;
}

.reward--xp {
  color: var(--color-warning-400);
}

.reward--penalty {
  color: var(--color-error-400);
}

.challenge-narrative {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  font-style: italic;
  color: var(--color-primary-300);
  opacity: 0.8;
}
</style>
