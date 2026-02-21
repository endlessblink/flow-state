<template>
  <div class="weekly-plan-view">
    <!-- Idle: Choose Quick or Thorough -->
    <div v-if="state.status === 'idle'" class="wp-centered">
      <CalendarDays :size="48" class="wp-hero-icon" />
      <h2 class="wp-title">
        Plan Your Week
      </h2>
      <p class="wp-subtitle">
        {{ eligibleTaskCount }} tasks ready to schedule
      </p>
      <div class="wp-mode-selector">
        <button class="wp-btn wp-btn-primary" @click="onQuickPlan">
          <Zap :size="16" />
          Quick Plan
        </button>
        <button class="wp-btn wp-btn-ghost" @click="onThoroughPlan">
          <MessageCircle :size="16" />
          Thorough Plan
        </button>
      </div>
      <p class="wp-hint">
        Quick skips the interview. Thorough asks a few questions first.
      </p>

      <!-- TASK-1399: Model selector -->
      <div class="model-selector">
        <span class="model-selector-label">{{ t('weeklyPlan.modelSelector.aiModel') }}</span>
        <CustomSelect
          :model-value="selectedProvider"
          :options="providerSelectOptions"
          :compact="true"
          class="model-selector-select"
          @update:model-value="selectedProvider = $event as AIProviderKey"
        />
        <span class="model-selector-sep">/</span>
        <CustomSelect
          :model-value="selectedModel || modelSelectOptions[0]?.value || ''"
          :options="modelSelectOptions"
          :compact="true"
          class="model-selector-select model-selector-select--wide"
          @update:model-value="selectedModel = $event as string"
        />
      </div>
    </div>

    <!-- Interview State -->
    <div v-else-if="state.status === 'interview'" class="wp-centered wp-interview">
      <div class="interview-header">
        <MessageCircle :size="28" class="wp-title-icon" />
        <h2 class="wp-title">
          A few quick questions
        </h2>
      </div>

      <div class="interview-cards">
        <!-- Q1: Top priority -->
        <div class="interview-card">
          <label class="interview-label">What's your top priority this week?</label>
          <input
            v-model="interviewForm.topPriority"
            type="text"
            class="interview-input"
            placeholder="e.g. Ship the new dashboard, fix auth bugs..."
          >
        </div>

        <!-- Q2: Days off -->
        <div class="interview-card">
          <label class="interview-label">Any days off or light days?</label>
          <div class="day-toggle-row">
            <button
              v-for="d in dayOptions"
              :key="d.key"
              class="day-toggle"
              :class="{ active: interviewForm.daysOff.includes(d.key) }"
              @click="toggleDayOff(d.key)"
            >
              {{ d.short }}
            </button>
          </div>
        </div>

        <!-- Q3: Heavy meeting days -->
        <div class="interview-card">
          <label class="interview-label">Heavy meeting days?</label>
          <div class="day-toggle-row">
            <button
              v-for="d in dayOptions"
              :key="d.key"
              class="day-toggle meeting"
              :class="{ active: interviewForm.heavyMeetingDays.includes(d.key) }"
              @click="toggleMeetingDay(d.key)"
            >
              {{ d.short }}
            </button>
          </div>
        </div>

        <!-- Q4: Max tasks per day -->
        <div class="interview-card">
          <label class="interview-label">Max tasks per day?</label>
          <div class="max-tasks-row">
            <button
              v-for="n in maxTaskOptions"
              :key="n"
              class="max-task-chip"
              :class="{ active: interviewForm.maxTasksPerDay === n }"
              @click="interviewForm.maxTasksPerDay = n"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <!-- Q5: Work style preference -->
        <div class="interview-card">
          <label class="interview-label">How do you prefer to distribute work?</label>
          <div class="work-style-row">
            <button
              v-for="ws in workStyleOptions"
              :key="ws.key"
              class="work-style-chip"
              :class="{ active: interviewForm.preferredWorkStyle === ws.key }"
              @click="interviewForm.preferredWorkStyle = ws.key"
            >
              <span class="ws-label">{{ ws.label }}</span>
              <span class="ws-desc">{{ ws.desc }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- TASK-1399: Model selector in interview state -->
      <div class="model-selector">
        <span class="model-selector-label">{{ t('weeklyPlan.modelSelector.aiModel') }}</span>
        <CustomSelect
          :model-value="selectedProvider"
          :options="providerSelectOptions"
          :compact="true"
          class="model-selector-select"
          @update:model-value="selectedProvider = $event as AIProviderKey"
        />
        <span class="model-selector-sep">/</span>
        <CustomSelect
          :model-value="selectedModel || modelSelectOptions[0]?.value || ''"
          :options="modelSelectOptions"
          :compact="true"
          class="model-selector-select model-selector-select--wide"
          @update:model-value="selectedModel = $event as string"
        />
      </div>

      <div class="interview-actions">
        <button class="wp-btn wp-btn-primary" @click="onSubmitInterview">
          <Sparkles :size="16" />
          Generate Plan
        </button>
        <button class="wp-btn wp-btn-ghost" @click="onCancelInterview">
          Cancel
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else-if="state.status === 'loading'" class="wp-centered">
      <Loader2 :size="48" class="wp-spinner" />
      <p class="wp-loading-text">
        AI is analyzing your tasks...
      </p>
      <div class="wp-skeleton-columns">
        <div v-for="i in 7" :key="i" class="wp-skeleton-col" />
      </div>
    </div>

    <!-- Review State -->
    <div v-else-if="state.status === 'review' && state.plan" class="wp-review">
      <div class="wp-review-header">
        <div class="wp-title-row">
          <CalendarDays :size="18" class="wp-title-icon" />
          <h2 class="wp-title">
            Your Week
          </h2>
          <span class="wp-stats-inline">{{ scheduledCount }} tasks · {{ daysUsed }} days</span>
        </div>
        <div class="wp-action-bar">
          <!-- TASK-1399: Compact model selector in review header -->
          <div class="model-selector model-selector--compact">
            <span class="model-selector-label">{{ t('weeklyPlan.modelSelector.aiModel') }}</span>
            <CustomSelect
              :model-value="selectedProvider"
              :options="providerSelectOptions"
              :compact="true"
              class="model-selector-select"
              @update:model-value="selectedProvider = $event as AIProviderKey"
            />
            <span class="model-selector-sep">/</span>
            <CustomSelect
              :model-value="selectedModel || modelSelectOptions[0]?.value || ''"
              :options="modelSelectOptions"
              :compact="true"
              class="model-selector-select model-selector-select--wide"
              @update:model-value="selectedModel = $event as string"
            />
          </div>
          <button class="wp-btn wp-btn-sm wp-btn-primary" @click="onApply">
            <Check :size="14" />
            Apply
          </button>
          <button class="wp-btn wp-btn-sm wp-btn-ghost" @click="onRegenerate">
            <RefreshCw :size="14" />
            Regenerate
          </button>
          <button class="wp-btn wp-btn-sm wp-btn-ghost" @click="onCancel">
            <X :size="14" />
            Cancel
          </button>
        </div>
      </div>

      <div v-if="state.weekTheme" class="wp-week-theme">
        <Sparkles :size="14" class="wp-theme-icon" />
        <span class="wp-theme-text">{{ state.weekTheme }}</span>
      </div>

      <details v-if="state.reasoning" class="wp-reasoning-details">
        <summary class="wp-reasoning-summary">
          <CalendarDays :size="12" />
          AI reasoning
        </summary>
        <p class="wp-reasoning-text">
          {{ state.reasoning }}
        </p>
      </details>

      <!-- TASK-1326: Workload warning banner -->
      <div v-if="overloadedDayNames.length > 0" class="wp-overload-warning">
        <AlertTriangle :size="14" class="wp-warning-icon" />
        <span class="wp-warning-text">
          {{ overloadedDayNames.join(' and ') }} exceed{{ overloadedDayNames.length === 1 ? 's' : '' }} daily capacity. Consider moving tasks to lighter days.
        </span>
        <button class="wp-warning-dismiss" @click="warningDismissed = true">
          <X :size="12" />
        </button>
      </div>

      <WeeklyPlanGrid
        ref="weeklyPlanGridRef"
        :plan="state.plan"
        :task-map="taskMap"
        :week-start="state.weekStart"
        :task-reasons="state.taskReasons"
        @move-task="onMoveTask"
        @resuggest="onResuggest"
        @remove-task="onRemoveTask"
        @change-priority="onChangePriority"
        @snooze-task="onSnoozeTask"
      />
    </div>

    <!-- Applied State -->
    <div v-else-if="state.status === 'applied'" class="wp-centered">
      <div class="wp-success-icon">
        <Check :size="32" />
      </div>
      <h2 class="wp-title">
        Week planned!
      </h2>
      <p class="wp-applied-stats">
        {{ scheduledCount }} tasks scheduled across {{ daysUsed }} days
      </p>

      <!-- TASK-1326: Plan adherence stats -->
      <div v-if="lastWeekAccuracy !== null || avgAccuracy !== null" class="wp-adherence-stats">
        <TrendingUp :size="14" class="wp-adherence-icon" />
        <div class="wp-adherence-text">
          <span v-if="lastWeekAccuracy !== null">Last week: {{ Math.round(lastWeekAccuracy) }}% of planned tasks completed</span>
          <span v-if="lastWeekAccuracy !== null && avgAccuracy !== null"> · </span>
          <span v-if="avgAccuracy !== null">8-week avg: {{ Math.round(avgAccuracy) }}%</span>
        </div>
      </div>

      <!-- TASK-1326: Skip feedback toggle -->
      <label class="wp-feedback-toggle">
        <input
          type="checkbox"
          :checked="!state.skipFeedback"
          @change="setSkipFeedback(!($event.target as HTMLInputElement).checked)"
        >
        <span class="wp-feedback-label">Record this week for learning</span>
      </label>

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
      <p class="wp-error-text">
        {{ state.error }}
      </p>
      <div class="wp-error-actions">
        <button class="wp-btn wp-btn-primary" @click="generatePlan()">
          <RefreshCw :size="16" />
          Try Again
        </button>
        <button class="wp-btn wp-btn-ghost" @click="onCancel">
          Go Back
        </button>
      </div>
    </div>

    <!-- Applying (brief transitional) -->
    <div v-else class="wp-centered">
      <Loader2 :size="48" class="wp-spinner" />
      <p class="wp-loading-text">
        Applying plan...
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useWeeklyPlan } from '@/composables/useWeeklyPlan'
import { useWorkProfile } from '@/composables/useWorkProfile'
import { useSettingsStore } from '@/stores/settings'
import WeeklyPlanGrid from '@/components/weeklyplan/WeeklyPlanGrid.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'
import type { WeeklyPlan, InterviewAnswers } from '@/composables/useWeeklyPlanAI'
import {
  PROVIDER_OPTIONS,
  WEEKLY_PLAN_DEFAULTS,
  getModelsForProvider,
  type AIProviderKey,
} from '@/config/aiModels'
import {
  CalendarDays, RefreshCw, Check, ArrowRight, X, Loader2,
  Zap, MessageCircle, Sparkles, AlertTriangle, TrendingUp,
} from 'lucide-vue-next'

const router = useRouter()
const { t } = useI18n()
const {
  state, taskMap, generatePlan, moveTask, applyPlan,
  removeTaskFromPlan, snoozeTask, changePriority,
  regenerateDay, startInterview, submitInterview,
  eligibleTaskCount, reset,
  lastWeekAccuracy, avgAccuracy, setSkipFeedback,
} = useWeeklyPlan()

const { loadProfile, savePreferences } = useWorkProfile()
const settingsStore = useSettingsStore()

// TASK-1399: Model selector — provider + model dropdowns
const selectedProvider = computed({
  get: () => settingsStore.weeklyPlanProvider as AIProviderKey,
  set: (val: AIProviderKey) => { settingsStore.weeklyPlanProvider = val },
})

const selectedModel = computed({
  get: () => settingsStore.weeklyPlanModel,
  set: (val: string) => { settingsStore.weeklyPlanModel = val },
})

/** Provider options for CustomSelect */
const providerSelectOptions = computed(() =>
  PROVIDER_OPTIONS.map(p => ({ value: p.key, label: p.label }))
)

/** Model options for the current provider */
const modelSelectOptions = computed(() => {
  const models = getModelsForProvider(selectedProvider.value)
  return models.map(m => ({
    value: m.id,
    label: m.pricing
      ? `${m.shortLabel ?? m.label} — ${m.pricing.inputPer1M === 0 ? 'Free' : `$${m.pricing.inputPer1M}/MTok`}`
      : (m.shortLabel ?? m.label),
  }))
})

/** When provider changes, auto-select the weekly-plan default for that provider */
watch(selectedProvider, (newProvider) => {
  const defaultId = newProvider === 'groq' ? WEEKLY_PLAN_DEFAULTS.groq
    : newProvider === 'openrouter' ? WEEKLY_PLAN_DEFAULTS.openrouter
    : null
  const models = getModelsForProvider(newProvider)
  if (defaultId && models.find(m => m.id === defaultId)) {
    settingsStore.weeklyPlanModel = defaultId
  } else if (models.length > 0) {
    settingsStore.weeklyPlanModel = models[0].id
  } else {
    settingsStore.weeklyPlanModel = ''
  }
})

// TASK-1326: Workload warning state
const weeklyPlanGridRef = ref<InstanceType<typeof WeeklyPlanGrid> | null>(null)
const warningDismissed = ref(false)

const overloadedDayNames = computed(() => {
  if (warningDismissed.value) return []
  const grid = weeklyPlanGridRef.value
  if (!grid) return []
  // Access the exposed computedOverloadedDays from the grid
  const days = (grid as any).overloadedDays
  if (!days || !Array.isArray(days)) return []
  return days.map((d: any) => d.dayName)
})

// Interview form state
const interviewForm = reactive({
  topPriority: '',
  daysOff: [] as string[],
  heavyMeetingDays: [] as string[],
  maxTasksPerDay: 5,
  preferredWorkStyle: 'balanced' as 'frontload' | 'balanced' | 'backload',
})

// TASK-1321: Dynamic day options based on weekStartsOn setting
const dayOptions = computed(() => {
  const allDays = [
    { key: 'sunday', short: 'Sun' },
    { key: 'monday', short: 'Mon' },
    { key: 'tuesday', short: 'Tue' },
    { key: 'wednesday', short: 'Wed' },
    { key: 'thursday', short: 'Thu' },
    { key: 'friday', short: 'Fri' },
    { key: 'saturday', short: 'Sat' },
  ]
  const startDay = settingsStore.weekStartsOn ?? 0
  return [...allDays.slice(startDay), ...allDays.slice(0, startDay)]
})

const maxTaskOptions = [3, 5, 8, 10]

const workStyleOptions = [
  { key: 'frontload' as const, label: 'Front-load', desc: 'Heavy Mon-Tue' },
  { key: 'balanced' as const, label: 'Balanced', desc: 'Even spread' },
  { key: 'backload' as const, label: 'Back-load', desc: 'Ramp to Friday' },
]

function toggleDayOff(key: string) {
  const idx = interviewForm.daysOff.indexOf(key)
  if (idx === -1) {
    interviewForm.daysOff.push(key)
    // Remove from meeting days if present
    const mIdx = interviewForm.heavyMeetingDays.indexOf(key)
    if (mIdx !== -1) interviewForm.heavyMeetingDays.splice(mIdx, 1)
  } else {
    interviewForm.daysOff.splice(idx, 1)
  }
}

function toggleMeetingDay(key: string) {
  const idx = interviewForm.heavyMeetingDays.indexOf(key)
  if (idx === -1) {
    interviewForm.heavyMeetingDays.push(key)
    // Remove from days off if present
    const dIdx = interviewForm.daysOff.indexOf(key)
    if (dIdx !== -1) interviewForm.daysOff.splice(dIdx, 1)
  } else {
    interviewForm.heavyMeetingDays.splice(idx, 1)
  }
}

// Mode actions
function onQuickPlan() {
  generatePlan()
}

function onThoroughPlan() {
  startInterview()
}

function onSubmitInterview() {
  const answers: InterviewAnswers = {}
  if (interviewForm.topPriority.trim()) answers.topPriority = interviewForm.topPriority.trim()
  if (interviewForm.daysOff.length > 0) answers.daysOff = [...interviewForm.daysOff]
  if (interviewForm.heavyMeetingDays.length > 0) answers.heavyMeetingDays = [...interviewForm.heavyMeetingDays]
  if (interviewForm.maxTasksPerDay) answers.maxTasksPerDay = interviewForm.maxTasksPerDay
  answers.preferredWorkStyle = interviewForm.preferredWorkStyle

  // FEATURE-1317: Persist preferences to work profile
  savePreferences({
    topPriorityNote: interviewForm.topPriority.trim() || null,
    daysOff: [...interviewForm.daysOff],
    heavyMeetingDays: [...interviewForm.heavyMeetingDays],
    maxTasksPerDay: interviewForm.maxTasksPerDay,
    preferredWorkStyle: interviewForm.preferredWorkStyle,
  }).catch(err => console.warn('[WeeklyPlan] Failed to save preferences:', err))

  submitInterview(answers)
}

function onCancelInterview() {
  state.value.status = 'idle'
}

// Keyboard + FEATURE-1317: Load work profile
onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)

  // FEATURE-1317: Load work profile and pre-populate interview form
  const savedProfile = await loadProfile()
  if (savedProfile) {
    if (savedProfile.topPriorityNote) interviewForm.topPriority = savedProfile.topPriorityNote
    if (savedProfile.daysOff?.length) interviewForm.daysOff = [...savedProfile.daysOff]
    if (savedProfile.heavyMeetingDays?.length) interviewForm.heavyMeetingDays = [...savedProfile.heavyMeetingDays]
    if (savedProfile.maxTasksPerDay) interviewForm.maxTasksPerDay = savedProfile.maxTasksPerDay
    if (savedProfile.preferredWorkStyle) interviewForm.preferredWorkStyle = savedProfile.preferredWorkStyle
  }
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

function onRemoveTask(taskId: string) {
  removeTaskFromPlan(taskId)
}

function onChangePriority(taskId: string) {
  changePriority(taskId)
}

function onSnoozeTask(taskId: string) {
  snoozeTask(taskId)
}

function onResuggest(dayKey: string) {
  regenerateDay(dayKey as keyof WeeklyPlan)
}

function onApply() {
  applyPlan()
}

function onRegenerate() {
  generatePlan()
}

function onCancel() {
  reset()
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
    if (state.value.status === 'interview') {
      onCancelInterview()
    } else {
      onCancel()
    }
  }
}
</script>

<style scoped>
.weekly-plan-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: var(--space-3) var(--space-4);
  overflow-y: auto;
}

/* Centered layout for loading/applied/error/idle states */
.wp-centered {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  text-align: center;
}

.wp-hero-icon {
  color: var(--brand-primary);
  opacity: 0.8;
}

.wp-subtitle {
  font-size: var(--text-base);
  color: var(--text-muted);
  margin: 0;
}

.wp-hint {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
  opacity: 0.7;
}

.wp-mode-selector {
  display: flex;
  gap: var(--space-3);
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
  gap: var(--space-4);
  margin-top: var(--space-8);
}

.wp-skeleton-col {
  width: 180px;
  height: 300px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

@keyframes skeletonPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}

/* Interview State */
.wp-interview {
  max-width: 600px;
  margin: 0 auto;
  gap: var(--space-8);
}

.interview-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.interview-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  width: 100%;
}

.interview-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  text-align: left;
}

.interview-label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.interview-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
  transition: border-color var(--duration-fast);
}

.interview-input:focus {
  border-color: var(--brand-primary);
}

.interview-input::placeholder {
  color: var(--text-muted);
}

.day-toggle-row {
  display: flex;
  gap: var(--space-1_5);
  flex-wrap: wrap;
}

.day-toggle {
  padding: var(--space-1_5) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.day-toggle:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.day-toggle.active {
  background: var(--brand-bg-light);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.day-toggle.meeting.active {
  background: var(--orange-bg-light);
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.max-tasks-row {
  display: flex;
  gap: var(--space-2);
}

.max-task-chip {
  width: 40px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.max-task-chip:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.max-task-chip.active {
  background: var(--brand-bg-light);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.interview-actions {
  display: flex;
  gap: var(--space-3);
}

.work-style-row {
  display: flex;
  gap: var(--space-2);
}

.work-style-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-0_5);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.work-style-chip:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

.work-style-chip.active {
  background: var(--brand-bg-light);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.ws-label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.ws-desc {
  font-size: var(--text-xs);
  opacity: 0.7;
}

/* Review State */
.wp-review {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-height: 0;
}

.wp-review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-shrink: 0;
}

.wp-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.wp-title-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
}

.wp-title {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0;
}

.wp-stats-inline {
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
}

/* Week theme badge */
.wp-week-theme {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-weak);
  border: 1px solid var(--state-active-bg);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.wp-theme-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
  opacity: 0.8;
}

.wp-theme-text {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  letter-spacing: 0.01em;
}

/* Collapsible reasoning */
.wp-reasoning-details {
  flex-shrink: 0;
}

.wp-reasoning-summary {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  font-size: var(--text-xs);
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
  list-style: none;
  padding: var(--space-1) 0;
}

.wp-reasoning-summary::-webkit-details-marker {
  display: none;
}

.wp-reasoning-summary::before {
  content: '▸';
  font-size: var(--text-2xs);
  transition: transform var(--duration-fast);
}

.wp-reasoning-details[open] .wp-reasoning-summary::before {
  transform: rotate(90deg);
}

.wp-reasoning-text {
  margin: var(--space-1) 0 0 0;
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-left: 2px solid var(--brand-primary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  line-height: var(--leading-relaxed);
}

/* Action bar — inline in header */
.wp-action-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.wp-btn-sm {
  padding: var(--space-1_5) var(--space-3);
  font-size: var(--text-xs);
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
  background: var(--brand-bg-dim);
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

  .wp-interview {
    max-width: 100%;
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

/* TASK-1326: Workload warning banner */
.wp-overload-warning {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  flex-shrink: 0;
}

.wp-warning-icon {
  color: var(--color-warning);
  flex-shrink: 0;
}

.wp-warning-text {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  flex: 1;
}

.wp-warning-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--duration-fast);
}

.wp-warning-dismiss:hover {
  background: var(--glass-bg-medium);
  color: var(--text-primary);
}

/* TASK-1326: Plan adherence stats */
.wp-adherence-stats {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.wp-adherence-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.wp-adherence-text {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* TASK-1326: Skip feedback toggle */
.wp-feedback-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.wp-feedback-toggle input[type="checkbox"] {
  accent-color: var(--brand-primary);
}

.wp-feedback-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* TASK-1399: Model selector */
.model-selector {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border-subtle);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-size: var(--text-sm);
}

.model-selector-label {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  white-space: nowrap;
  flex-shrink: 0;
}

.model-selector-sep {
  color: var(--text-muted);
  font-size: var(--text-xs);
  flex-shrink: 0;
  opacity: 0.5;
}

.model-selector-select {
  min-width: 80px;
}

.model-selector-select--wide {
  min-width: 160px;
}

/* Compact variant for review header — no padding, no bg (lives inside action bar) */
.model-selector--compact {
  padding: 0;
  background: transparent;
  border: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
</style>
