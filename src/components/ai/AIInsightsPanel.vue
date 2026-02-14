<template>
  <div class="insights-panel">
    <div class="insights-scroll">
      <!-- Section A: Memory Observations -->
      <section class="insights-section">
        <div class="section-header">
          <div class="section-title-row">
            <Brain :size="18" class="section-icon" />
            <h3 class="section-title">Memory Observations</h3>
          </div>
          <span v-if="observations.length > 0" class="section-count">
            {{ observations.length }} observation{{ observations.length !== 1 ? 's' : '' }} from your work patterns
          </span>
        </div>

        <div v-if="observations.length > 0" class="obs-list">
          <div v-for="(obs, i) in observations" :key="i" class="obs-card">
            <div class="obs-main">
              <span class="obs-entity">{{ formatEntity(obs.entity) }}</span>
              <span class="obs-relation">{{ formatRelation(obs.relation) }}</span>
              <span class="obs-value">{{ obs.value }}</span>
            </div>
            <div class="obs-meta">
              <div class="confidence-bar">
                <div class="confidence-fill" :style="{ width: (obs.confidence * 100) + '%' }" />
              </div>
              <span class="obs-source">{{ obs.source.replace(/_/g, ' ') }}</span>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <Brain :size="32" class="empty-icon" />
          <p class="empty-text">No observations yet</p>
          <p class="empty-hint">Use the Weekly Plan and Pomodoro timer to let FlowState learn your patterns.</p>
        </div>

        <button
          v-if="observations.length > 0"
          class="action-btn danger-btn"
          @click="handleClearMemories"
        >
          <Trash2 :size="14" />
          Clear Memories
        </button>
      </section>

      <!-- Section B: Learned Metrics -->
      <section class="insights-section">
        <div class="section-header">
          <div class="section-title-row">
            <TrendingUp :size="18" class="section-icon" />
            <h3 class="section-title">Learned Metrics</h3>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">Avg Work/Day</span>
            <span class="metric-value">
              {{ profile?.avgWorkMinutesPerDay ? Math.round(profile.avgWorkMinutesPerDay) + ' min' : '--' }}
            </span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Avg Tasks/Day</span>
            <span class="metric-value">
              {{ profile?.avgTasksCompletedPerDay ? profile.avgTasksCompletedPerDay.toFixed(1) : '--' }}
            </span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Plan Accuracy</span>
            <span class="metric-value">
              {{ profile?.avgPlanAccuracy ? profile.avgPlanAccuracy.toFixed(0) + '%' : '--' }}
            </span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Peak Days</span>
            <span class="metric-value">
              {{ profile?.peakProductivityDays?.length ? profile.peakProductivityDays.map(capitalize).join(', ') : '--' }}
            </span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Streak</span>
            <span class="metric-value">
              {{ streakDays !== null ? streakDays + ' days' : '--' }}
            </span>
          </div>
          <div class="metric-card">
            <span class="metric-label">On-Time Rate</span>
            <span class="metric-value">
              {{ onTimeRate !== null ? onTimeRate + '%' : '--' }}
            </span>
          </div>
        </div>

        <div class="metrics-actions">
          <button class="action-btn primary-btn" :disabled="isRecalculating" @click="handleRecalculate">
            <Loader2 v-if="isRecalculating" :size="14" class="spin" />
            <RefreshCw v-else :size="14" />
            Recalculate
          </button>
          <button class="action-btn ghost-btn" :disabled="isResetting" @click="handleResetProfile">
            <Loader2 v-if="isResetting" :size="14" class="spin" />
            <RotateCcw v-else :size="14" />
            Reset Profile
          </button>
        </div>
        <p v-if="statusMessage" :class="['status-message', statusType]">{{ statusMessage }}</p>
      </section>

      <!-- Section C: Weekly History -->
      <section v-if="weeklyHistory.length > 0" class="insights-section">
        <div class="section-header">
          <div class="section-title-row">
            <BarChart3 :size="18" class="section-icon" />
            <h3 class="section-title">Weekly History</h3>
          </div>
          <span class="section-count">Last {{ weeklyHistory.length }} week{{ weeklyHistory.length !== 1 ? 's' : '' }}</span>
        </div>

        <div class="history-list">
          <div v-for="(week, i) in weeklyHistory" :key="i" class="history-row">
            <span class="history-week">{{ formatWeekStart(week.weekStart) }}</span>
            <div class="history-bars">
              <div class="bar-track">
                <div class="bar-planned" :style="{ width: barWidth(week.plannedCount) }" />
                <div class="bar-completed" :style="{ width: barWidth(week.completedCount) }" />
              </div>
            </div>
            <span class="history-stats">
              {{ week.completedCount }}/{{ week.plannedCount }}
              <span class="history-accuracy">{{ week.accuracy.toFixed(0) }}%</span>
            </span>
          </div>
        </div>

        <div class="history-legend">
          <span class="legend-item">
            <span class="legend-dot legend-planned" />
            Planned
          </span>
          <span class="legend-item">
            <span class="legend-dot legend-completed" />
            Completed
          </span>
        </div>
      </section>

      <!-- Learning disabled notice -->
      <div v-if="!aiLearningEnabled" class="learning-disabled-notice">
        <AlertTriangle :size="16" />
        <span>AI learning is disabled. Enable it in Settings to start building your work profile.</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * FEATURE-1317 Phase 2B: AI Insights Panel
 *
 * Read-only dashboard showing AI-learned work patterns:
 * - Memory observations (knowledge graph)
 * - Learned capacity metrics
 * - Weekly planning history
 */

import { ref, computed, onMounted } from 'vue'
import { useWorkProfile } from '@/composables/useWorkProfile'
import { useGamificationStore } from '@/stores/gamification'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import type { MemoryObservation } from '@/utils/supabaseMappers'
import {
  Brain, TrendingUp, BarChart3, Trash2, RefreshCw,
  RotateCcw, Loader2, AlertTriangle,
} from 'lucide-vue-next'

const { profile, loadProfile, reloadProfile, computeCapacityMetrics, resetLearnedData } = useWorkProfile()
const gamStore = useGamificationStore()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()

const isRecalculating = ref(false)
const isResetting = ref(false)
const statusMessage = ref('')
const statusType = ref<'success' | 'warning' | 'error'>('success')
let statusTimer: ReturnType<typeof setTimeout> | null = null

function showStatus(message: string, type: 'success' | 'warning' | 'error' = 'success') {
  statusMessage.value = message
  statusType.value = type
  if (statusTimer) clearTimeout(statusTimer)
  statusTimer = setTimeout(() => { statusMessage.value = '' }, 5000)
}

const aiLearningEnabled = computed(() => settingsStore.aiLearningEnabled)

const observations = computed<MemoryObservation[]>(() =>
  (profile.value?.memoryGraph || [])
    .sort((a, b) => b.confidence - a.confidence)
)

const weeklyHistory = computed(() =>
  (profile.value?.weeklyHistory || []).slice().reverse()
)

const streakDays = computed(() => gamStore.streakInfo?.currentStreak ?? null)
const onTimeRate = computed(() => {
  const s = gamStore.stats
  return s && s.tasksCompleted > 0
    ? Math.round((s.tasksCompletedOnTime / s.tasksCompleted) * 100)
    : null
})

function formatEntity(entity: string): string {
  if (entity.startsWith('project:')) return entity.replace('project:', '')
  if (entity.startsWith('day:')) return capitalize(entity.replace('day:', ''))
  if (entity.startsWith('tasktype:')) return entity.replace('tasktype:', '')
  return entity
}

function formatRelation(relation: string): string {
  return relation.replace(/_/g, ' ')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function barWidth(count: number): string {
  const maxCount = Math.max(
    ...weeklyHistory.value.map(w => Math.max(w.plannedCount, w.completedCount)),
    1
  )
  return ((count / maxCount) * 100) + '%'
}

async function handleRecalculate() {
  if (!authStore.isAuthenticated) {
    showStatus('Sign in to use this feature', 'warning')
    return
  }
  isRecalculating.value = true
  try {
    await loadProfile()
    const result = await computeCapacityMetrics()
    await reloadProfile()

    if (result.totalTasksCompleted === 0 && result.avgMinutesPerDay === null) {
      showStatus('No activity found in the last 28 days.', 'warning')
    } else {
      const parts: string[] = []
      if (result.totalTasksCompleted > 0) parts.push(`${result.totalTasksCompleted} tasks completed`)
      if (result.avgMinutesPerDay) parts.push(`${Math.round(result.avgMinutesPerDay)} min/day focus`)
      if (result.avgTasksPerDay) parts.push(`${result.avgTasksPerDay.toFixed(1)} tasks/day`)
      showStatus(`Updated from ${parts.join(', ')}`, 'success')
    }
  } catch (e) {
    console.warn('[AIInsights] Recalculate failed:', e)
    showStatus('Recalculation failed — check console for details', 'error')
  } finally {
    isRecalculating.value = false
  }
}

async function handleResetProfile() {
  if (!authStore.isAuthenticated) {
    showStatus('Sign in to use this feature', 'warning')
    return
  }
  isResetting.value = true
  try {
    await resetLearnedData()
    await reloadProfile()
    showStatus('Profile data cleared', 'success')
  } catch (e) {
    console.warn('[AIInsights] Reset failed:', e)
    showStatus('Reset failed — check console for details', 'error')
  } finally {
    isResetting.value = false
  }
}

async function handleClearMemories() {
  if (!authStore.isAuthenticated) {
    showStatus('Sign in to use this feature', 'warning')
    return
  }
  try {
    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()
    await db.saveWorkProfile({ memoryGraph: [] })
    await reloadProfile()
    showStatus('Memories cleared', 'success')
  } catch (e) {
    console.warn('[AIInsights] Clear memories failed:', e)
    showStatus('Clear failed — check console for details', 'error')
  }
}

onMounted(async () => {
  await loadProfile()
})
</script>

<style scoped>
.insights-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.insights-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
}

/* Section */
.insights-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(var(--blur-md));
  -webkit-backdrop-filter: blur(var(--blur-md));
}

.section-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
}

.section-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin: 0;
}

.section-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Observations */
.obs-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.obs-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.obs-main {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
  font-size: var(--text-sm);
}

.obs-entity {
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
}

.obs-relation {
  color: var(--text-muted);
  font-style: italic;
}

.obs-value {
  color: var(--text-secondary);
}

.obs-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.confidence-bar {
  width: 60px;
  height: 4px;
  background: var(--glass-bg-medium);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.confidence-fill {
  height: 100%;
  background: var(--brand-primary);
  border-radius: var(--radius-full);
  transition: width var(--duration-normal) ease;
}

.obs-source {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: capitalize;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-8);
  text-align: center;
}

.empty-icon {
  color: var(--text-muted);
  opacity: 0.4;
}

.empty-text {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin: 0;
}

.empty-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
  max-width: 300px;
}

/* Metrics grid */
.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
}

.metric-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
}

.metrics-actions {
  display: flex;
  gap: var(--space-2);
}

/* Weekly history */
.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.history-week {
  font-size: var(--text-xs);
  color: var(--text-muted);
  min-width: 56px;
  flex-shrink: 0;
}

.history-bars {
  flex: 1;
  min-width: 0;
}

.bar-track {
  position: relative;
  height: 20px;
  background: var(--glass-bg-medium);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.bar-planned {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(78, 205, 196, 0.15);
  border: 1px solid rgba(78, 205, 196, 0.3);
  border-radius: var(--radius-sm);
}

.bar-completed {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(78, 205, 196, 0.4);
  border-radius: var(--radius-sm);
}

.history-stats {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  min-width: 64px;
  text-align: end;
  flex-shrink: 0;
}

.history-accuracy {
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
  margin-inline-start: var(--space-1);
}

.history-legend {
  display: flex;
  gap: var(--space-4);
  justify-content: flex-end;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
}

.legend-planned {
  background: rgba(78, 205, 196, 0.15);
  border: 1px solid rgba(78, 205, 196, 0.3);
}

.legend-completed {
  background: rgba(78, 205, 196, 0.4);
}

/* Buttons */
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  white-space: nowrap;
}

.primary-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  color: var(--brand-primary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.primary-btn:hover:not(:disabled) {
  background: rgba(78, 205, 196, 0.08);
  border-color: var(--brand-primary-hover);
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ghost-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border-hover);
  color: var(--text-secondary);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.ghost-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-strong);
  color: var(--text-primary);
}

.danger-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.danger-btn:hover {
  background: var(--danger-bg-subtle);
}

/* Learning disabled notice */
.learning-disabled-notice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-warning-alpha-10);
  border: 1px solid var(--color-priority-medium-border-medium);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--color-warning);
}

/* Status message */
.status-message {
  font-size: var(--text-xs);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  margin: 0;
}

.status-message.success {
  color: var(--brand-primary);
  background: rgba(78, 205, 196, 0.08);
  border: 1px solid rgba(78, 205, 196, 0.2);
}

.status-message.warning {
  color: var(--color-warning);
  background: var(--color-warning-alpha-10);
  border: 1px solid var(--color-priority-medium-border-medium);
}

.status-message.error {
  color: var(--color-danger);
  background: rgba(255, 85, 85, 0.08);
  border: 1px solid rgba(255, 85, 85, 0.2);
}

/* Spinner */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 640px) {
  .insights-scroll {
    padding: var(--space-4);
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
