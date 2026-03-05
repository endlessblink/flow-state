<script setup lang="ts">
import { computed } from 'vue'
import { Play, Pause, RotateCcw, Check } from 'lucide-vue-next'
import { useTimerStore } from '@/stores/timer'

const props = defineProps<{
  taskId: string
  title: string
  state: 'active' | 'queued' | 'completed'
  index: number
}>()

const emit = defineEmits<{
  start: []
  pause: []
  resume: []
  complete: []
  promote: []
}>()

const timerStore = useTimerStore()

const isThisTaskActive = computed(() =>
  timerStore.isTimerActive && timerStore.currentTaskId === props.taskId
)

const isRunning = computed(() => isThisTaskActive.value && !timerStore.isPaused)
const isPaused = computed(() => isThisTaskActive.value && timerStore.isPaused)

// Timer ring math
const circumference = 2 * Math.PI * 45 // ~282.74

const dashOffset = computed(() => {
  if (!timerStore.currentSession || !isThisTaskActive.value) return circumference
  const total = timerStore.currentSession.remainingTime <= timerStore.currentSession.duration
    ? timerStore.currentSession.duration
    : (timerStore.settings.workDuration || 1500)
  const remaining = timerStore.currentSession.remainingTime
  const progress = remaining / total
  return circumference * (1 - progress)
})

const displayTime = computed(() =>
  isThisTaskActive.value ? timerStore.displayTime : timerStore.settings.workDuration
    ? formatDuration(timerStore.settings.workDuration)
    : '25:00'
)

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const indexLabel = computed(() => `${props.index + 1}.`)
</script>

<template>
  <!-- Active state -->
  <div
    v-if="state === 'active'"
    class="flow-card flow-card--active"
    :class="{ 'flow-card--running': isRunning }"
  >
    <div class="card-header">
      <span class="card-index">{{ indexLabel }}</span>
      <h2 class="card-title">{{ title }}</h2>
    </div>

    <div class="timer-area">
      <div class="timer-ring-wrapper">
        <svg viewBox="0 0 100 100" class="timer-ring">
          <circle cx="50" cy="50" r="45" class="timer-ring-bg" />
          <circle
            cx="50"
            cy="50"
            r="45"
            class="timer-ring-progress"
            :style="{ strokeDashoffset: dashOffset }"
          />
        </svg>
        <span class="timer-display">{{ displayTime }}</span>
      </div>
    </div>

    <div class="button-row">
      <button
        v-if="!isRunning && !isPaused"
        class="btn btn--start"
        @click="emit('start')"
      >
        <Play :size="14" />
        Start
      </button>
      <button
        v-if="isRunning"
        class="btn btn--pause"
        @click="emit('pause')"
      >
        <Pause :size="14" />
        Pause
      </button>
      <button
        v-if="isPaused"
        class="btn btn--resume"
        @click="emit('resume')"
      >
        <RotateCcw :size="14" />
        Resume
      </button>
      <button
        class="btn btn--done"
        @click="emit('complete')"
      >
        <Check :size="14" />
        Done
      </button>
    </div>
  </div>

  <!-- Queued state -->
  <div
    v-else-if="state === 'queued'"
    class="flow-card flow-card--queued"
    role="button"
    tabindex="0"
    :aria-label="`Promote task ${title} to active`"
    @click="emit('promote')"
    @keydown.enter="emit('promote')"
    @keydown.space.prevent="emit('promote')"
  >
    <span class="card-index">{{ indexLabel }}</span>
    <span class="card-title card-title--queued">{{ title }}</span>
  </div>

  <!-- Completed state -->
  <div
    v-else-if="state === 'completed'"
    class="flow-card flow-card--completed"
    aria-disabled="true"
  >
    <Check class="completed-check" :size="18" />
    <span class="card-title card-title--completed">{{ title }}</span>
  </div>
</template>

<style scoped>
/* ---- Base card ---- */
.flow-card {
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  backdrop-filter: blur(12px);
  transition:
    border-color var(--duration-normal) ease,
    box-shadow var(--duration-slow) ease,
    opacity var(--duration-slow) ease;
}

/* ---- Active ---- */
.flow-card--active {
  background: var(--glass-bg-medium);
  border: 2px solid var(--brand-primary);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.flow-card--running {
  box-shadow: 0 0 16px var(--timer-active-glow), 0 0 4px var(--timer-active-border);
  animation: timerPulse 2s ease-in-out infinite;
}

@keyframes timerPulse {
  0%, 100% { box-shadow: 0 0 16px var(--timer-active-glow), 0 0 4px var(--timer-active-border); }
  50% { box-shadow: 0 0 28px var(--timer-active-glow), 0 0 8px var(--timer-active-border); }
}

.card-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.card-index {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 500;
  flex-shrink: 0;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  word-break: break-word;
}

/* ---- Timer ring ---- */
.timer-area {
  display: flex;
  justify-content: center;
}

.timer-ring-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timer-ring {
  width: 120px;
  height: 120px;
  transform: rotate(-90deg);
  position: absolute;
  top: 0;
  left: 0;
}

.timer-ring-bg {
  fill: none;
  stroke: var(--glass-border);
  stroke-width: 3;
}

.timer-ring-progress {
  fill: none;
  stroke: var(--brand-primary);
  stroke-width: 3;
  stroke-dasharray: 282.74;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;
}

.timer-display {
  position: relative;
  z-index: 1;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

/* ---- Buttons ---- */
.button-row {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  background: var(--glass-bg-soft);
  backdrop-filter: blur(8px);
  transition:
    opacity var(--duration-normal) ease,
    box-shadow var(--duration-normal) ease;
}

.btn:hover {
  opacity: 0.85;
}

.btn--start {
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
}

.btn--pause {
  color: #f59e0b;
  border: 1px solid #f59e0b;
}

.btn--resume {
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
}

.btn--done {
  color: #4ade80;
  border: 1px solid #4ade80;
}

/* ---- Queued ---- */
.flow-card--queued {
  background: var(--glass-bg-light, var(--glass-bg-soft));
  border: 1px solid var(--glass-border);
  opacity: 0.4;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  transition:
    opacity var(--duration-normal) ease,
    border-color var(--duration-normal) ease;
}

.flow-card--queued:hover {
  opacity: 0.65;
  border-color: var(--brand-primary);
}

.card-title--queued {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary);
}

/* ---- Completed ---- */
.flow-card--completed {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  opacity: 0.2;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  pointer-events: none;
  transition: opacity 400ms ease;
}

.completed-check {
  color: #4ade80;
  flex-shrink: 0;
}

.card-title--completed {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: line-through;
  word-break: break-word;
}
</style>
