<template>
  <div class="weekly-plan-view">
    <!-- Loading State -->
    <div v-if="state.status === 'loading'" class="wp-centered">
      <Loader2 :size="48" class="wp-spinner" />
      <p class="wp-loading-text">AI is analyzing your tasks...</p>
      <div class="wp-skeleton-columns">
        <div v-for="i in 7" :key="i" class="wp-skeleton-col" />
      </div>
    </div>

    <!-- Review State -->
    <div v-else-if="state.status === 'review' && state.plan" class="wp-review">
      <div class="wp-review-header">
        <h2 class="wp-title">Your Week at a Glance</h2>
        <div v-if="state.reasoning" class="wp-reasoning">
          <CalendarDays :size="16" />
          <span>{{ state.reasoning }}</span>
        </div>
      </div>

      <WeeklyPlanGrid
        :plan="state.plan"
        :task-map="taskMap"
        :week-start="state.weekStart"
        @move-task="onMoveTask"
      />

      <div class="wp-stats-bar">
        {{ scheduledCount }} tasks scheduled across {{ daysUsed }} days
      </div>

      <div class="wp-action-bar">
        <button class="wp-btn wp-btn-primary" @click="onApply">
          <Check :size="18" />
          Apply Plan
        </button>
        <button class="wp-btn wp-btn-ghost" @click="onRegenerate">
          <RefreshCw :size="16" />
          Regenerate
        </button>
        <button class="wp-btn wp-btn-ghost" @click="onCancel">
          <X :size="16" />
          Cancel
        </button>
      </div>
    </div>

    <!-- Applied State -->
    <div v-else-if="state.status === 'applied'" class="wp-centered">
      <div class="wp-success-icon">
        <Check :size="32" />
      </div>
      <h2 class="wp-title">Week planned!</h2>
      <p class="wp-applied-stats">
        {{ scheduledCount }} tasks scheduled across {{ daysUsed }} days
      </p>
      <button class="wp-btn wp-btn-primary" @click="router.push('/')">
        <ArrowRight :size="18" />
        Go to Canvas
      </button>
    </div>

    <!-- Error State -->
    <div v-else-if="state.status === 'error'" class="wp-centered">
      <div class="wp-error-icon">
        <X :size="32" />
      </div>
      <p class="wp-error-text">{{ state.error }}</p>
      <div class="wp-error-actions">
        <button class="wp-btn wp-btn-primary" @click="generatePlan">
          <RefreshCw :size="16" />
          Try Again
        </button>
        <button class="wp-btn wp-btn-ghost" @click="onCancel">
          Go Back
        </button>
      </div>
    </div>

    <!-- Idle / Applying (brief transitional) -->
    <div v-else class="wp-centered">
      <Loader2 :size="48" class="wp-spinner" />
      <p class="wp-loading-text">Preparing...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWeeklyPlan } from '@/composables/useWeeklyPlan'
import WeeklyPlanGrid from '@/components/weeklyplan/WeeklyPlanGrid.vue'
import type { WeeklyPlan } from '@/composables/useWeeklyPlanAI'
import { CalendarDays, RefreshCw, Check, ArrowRight, X, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const { state, taskMap, generatePlan, moveTask, applyPlan } = useWeeklyPlan()

// Auto-generate on mount if idle
onMounted(() => {
  if (state.value.status === 'idle') {
    generatePlan()
  }
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// Stats for review state
const scheduledCount = computed(() => {
  if (!state.value.plan) return 0
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
  return days.reduce((sum, d) => sum + state.value.plan![d].length, 0)
})

const daysUsed = computed(() => {
  if (!state.value.plan) return 0
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
  return days.filter(d => state.value.plan![d].length > 0).length
})

function onMoveTask(taskId: string, fromDay: keyof WeeklyPlan, toDay: keyof WeeklyPlan) {
  moveTask(taskId, fromDay, toDay)
}

function onApply() {
  applyPlan()
}

function onRegenerate() {
  generatePlan()
}

function onCancel() {
  router.back()
}

function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return

  if (event.key === 'Enter' && state.value.status === 'review') {
    event.preventDefault()
    onApply()
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    onCancel()
  }
}
</script>

<style scoped>
.weekly-plan-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: var(--space-4) var(--space-6);
  overflow-y: auto;
}

/* Centered layout for loading/applied/error states */
.wp-centered {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  text-align: center;
}

.wp-spinner {
  color: var(--brand-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.wp-loading-text {
  font-size: var(--text-lg);
  color: var(--text-secondary);
  margin: 0;
}

/* Skeleton columns */
.wp-skeleton-columns {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-6);
}

.wp-skeleton-col {
  width: 100px;
  height: 200px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

@keyframes skeletonPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}

/* Review State */
.wp-review {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 0;
}

.wp-review-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex-shrink: 0;
}

.wp-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.wp-reasoning {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-relaxed);
}

.wp-reasoning svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--text-muted);
}

.wp-stats-bar {
  flex-shrink: 0;
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-muted);
  padding: var(--space-2) 0;
}

/* Action bar */
.wp-action-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-4) 0;
  position: sticky;
  bottom: 0;
  background: var(--glass-bg-soft);
  border-top: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
}

/* Buttons */
.wp-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-5);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
  white-space: nowrap;
}

.wp-btn-primary {
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.wp-btn-primary:hover {
  background: rgba(78, 205, 196, 0.08);
  border-color: var(--brand-hover);
  color: var(--brand-hover);
  transform: translateY(-1px);
  box-shadow: var(--state-hover-shadow);
}

.wp-btn-ghost {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border-hover);
  color: var(--text-secondary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.wp-btn-ghost:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-strong);
  color: var(--text-primary);
  transform: translateY(-1px);
}

/* Success icon */
.wp-success-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-full);
  background: var(--glass-bg-soft);
  border: 2px solid var(--brand-primary);
  color: var(--brand-primary);
}

.wp-applied-stats {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0;
}

/* Error state */
.wp-error-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-full);
  background: var(--danger-bg-subtle);
  border: 2px solid var(--color-danger);
  color: var(--color-danger);
}

.wp-error-text {
  font-size: var(--text-base);
  color: var(--color-danger);
  margin: 0;
}

.wp-error-actions {
  display: flex;
  gap: var(--space-3);
}

/* Responsive */
@media (max-width: 768px) {
  .weekly-plan-view {
    padding: var(--space-3) var(--space-4);
  }

  .wp-skeleton-columns {
    flex-wrap: wrap;
    justify-content: center;
  }

  .wp-skeleton-col {
    width: 80px;
    height: 120px;
  }

  .wp-action-bar {
    flex-wrap: wrap;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .wp-spinner {
    animation: none;
  }

  .wp-skeleton-col {
    animation: none;
  }
}
</style>
