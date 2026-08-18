<template>
  <div class="completion-phase">
    <div class="celebration-container">
      <div ref="confettiRef" class="confetti-burst" />

      <div class="celebration-icon">
        <PartyPopper :size="80" />
      </div>

      <h2 class="celebration-title">
        All Sorted!
      </h2>
      <p class="celebration-subtitle">
        You've processed all your tasks
      </p>

      <div v-if="sessionSummary" class="session-summary">
        <div class="summary-stat">
          <span class="stat-number">{{ sessionSummary.tasksProcessed }}</span>
          <span class="stat-label">Tasks</span>
        </div>
        <div class="summary-stat">
          <span class="stat-number">{{ formatDuration(sessionSummary.timeSpent) }}</span>
          <span class="stat-label">Time</span>
        </div>
        <div v-if="sessionSummary.efficiency > 0" class="summary-stat">
          <span class="stat-number">{{ sessionSummary.efficiency.toFixed(1) }}</span>
          <span class="stat-label">Tasks/min</span>
        </div>
      </div>

      <div class="completion-actions">
        <BaseButton variant="primary" size="lg" @click="$emit('sortAnother')">
          <Zap :size="20" />
          {{ $t('quick_sort.sort_another_set') }}
        </BaseButton>
        <BaseButton variant="secondary" size="lg" @click="$emit('goToInbox')">
          <ArrowLeft :size="20" />
          Go to Inbox
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PartyPopper, ArrowLeft, Zap } from 'lucide-vue-next'
import BaseButton from '@/components/base/BaseButton.vue'

interface SessionSummary {
  tasksProcessed: number
  timeSpent: number
  efficiency: number
}

defineProps<{
  sessionSummary: SessionSummary | null
}>()

defineEmits<{
  (e: 'goToInbox'): void
  (e: 'sortAnother'): void
}>()

const confettiRef = defineModel<HTMLElement | null>('confettiRef', { default: null })

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes === 0) return `${remainingSeconds}s`
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
</script>

<style scoped>
/* ================================
   COMPLETION PHASE
   ================================ */

.completion-phase {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.celebration-container {
  text-align: center;
  max-width: 320px; /* Component-specific container width */
}

.confetti-burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.celebration-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--space-32);
  height: var(--space-32);
  background: linear-gradient(135deg, var(--state-active-bg), var(--state-hover-bg));
  border: var(--task-card-selection-border) solid var(--state-hover-border);
  border-radius: var(--radius-full);
  color: var(--brand-primary);
  margin-bottom: var(--space-6);
  animation: celebratePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes celebratePop {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

.celebration-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  margin: 0 0 var(--space-2);
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-hover));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.celebration-subtitle {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0 0 var(--space-8);
}

.session-summary {
  display: flex;
  justify-content: center;
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-number {
  font-size: var(--text-2xl); /* 24px */
  font-weight: var(--font-bold);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.completion-actions { display: flex; flex-direction: column; gap: var(--space-3); }

@media (prefers-reduced-motion: reduce) {
  .celebration-icon {
    animation: none !important;
    transition: none !important;
  }
}
</style>
