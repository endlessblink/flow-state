<script setup lang="ts">
/**
 * AI Task Assist Popover
 *
 * Context-aware AI action buttons with inline result display.
 * Shows different actions based on invocation context (context-menu, edit-modal, quick-create).
 * Uses useAITaskAssist composable for all AI operations.
 *
 * @see TASK-1302 in MASTER_PLAN.md
 */

import { computed, ref, watch } from 'vue'
import {
  Sparkles,
  Target,
  Scissors,
  CalendarClock,
  PenLine,
  Link2,
  LayoutList,
  Loader2,
  AlertCircle,
  Check,
  Zap
} from 'lucide-vue-next'
import BasePopover from '@/components/base/BasePopover.vue'
import { useAITaskAssist } from '@/composables/useAITaskAssist'
import type { SmartSuggestion } from '@/composables/useAITaskAssist'
import type { Task } from '@/types/tasks'
import { useWorkProfile } from '@/composables/useWorkProfile'

// ============================================================================
// Props & Emits
// ============================================================================

interface Props {
  isVisible: boolean
  task: Task | null
  x: number
  y: number
  context: 'context-menu' | 'edit-modal' | 'quick-create'
  selectedTaskIds?: string[]
  autoTrigger?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  selectedTaskIds: () => [],
  autoTrigger: null
})

const emit = defineEmits<{
  close: []
  acceptSubtasks: [subtasks: string[]]
  acceptPriority: [priority: string, duration: number]
  acceptBreakdown: [tasks: Array<{ title: string; priority?: string }>]
  acceptDate: [date: string]
  acceptTitle: [title: string]
  acceptSmartSuggest: [updates: Array<{ field: string; value: string | number }>]
  acceptSmartSuggestGroup: [updates: Array<{ taskId: string; fields: Array<{ field: string; value: string | number }> }>]
}>()

// ============================================================================
// Composable
// ============================================================================

const {
  suggestSubtasks,
  suggestPriorityDuration,
  breakDownTask,
  suggestDate,
  improveTitle,
  findRelatedTasks,
  summarizeBatch,
  smartSuggest,
  smartSuggestGroup,
  isLoading,
  currentAction,
  result,
  error,
  abort,
  clearResult
} = useAITaskAssist()

const { addSuggestionFeedback } = useWorkProfile()

// ============================================================================
// Computed
// ============================================================================

const truncatedTitle = computed(() => {
  if (!props.task?.title) return ''
  return props.task.title.length > 30
    ? props.task.title.slice(0, 30) + '...'
    : props.task.title
})

const loadingText = computed(() => {
  const labels: Record<string, string> = {
    suggestSubtasks: 'Suggesting subtasks...',
    suggestPriorityDuration: 'Analyzing priority...',
    breakDownTask: 'Breaking down task...',
    suggestDate: 'Finding best date...',
    improveTitle: 'Improving title...',
    findRelatedTasks: 'Searching related tasks...',
    summarizeBatch: 'Summarizing tasks...',
    smartSuggest: 'Analyzing task...',
    smartSuggestGroup: 'Analyzing tasks...'
  }
  return labels[currentAction.value || ''] || 'Thinking...'
})

// ============================================================================
// Action Visibility
// ============================================================================

const contextActions: Record<string, string[]> = {
  'context-menu': ['smartSuggest', 'priority', 'breakdown', 'date', 'related', 'summary'],
  'edit-modal': ['smartSuggest', 'subtasks', 'priority', 'date', 'title'],
  'quick-create': ['smartSuggest', 'priority', 'date', 'title']
}

function showAction(action: string): boolean {
  const allowed = contextActions[props.context] || []
  if (action === 'summary') {
    return allowed.includes(action) && (props.selectedTaskIds?.length ?? 0) >= 2
  }
  return allowed.includes(action)
}

// ============================================================================
// Action Handlers
// ============================================================================

function doSuggestSubtasks() {
  if (!props.task) return
  suggestSubtasks(props.task)
}

function doSuggestPriority() {
  if (!props.task) return
  suggestPriorityDuration(props.task)
}

function doBreakDown() {
  if (!props.task) return
  breakDownTask(props.task)
}

function doSuggestDate() {
  if (!props.task) return
  suggestDate(props.task)
}

function doImproveTitle() {
  if (!props.task) return
  improveTitle(props.task.title)
}

function doFindRelated() {
  if (!props.task) return
  findRelatedTasks(props.task)
}

function doSummarizeBatch() {
  if (!props.selectedTaskIds?.length) return
  summarizeBatch(props.selectedTaskIds)
}

function doSmartSuggest() {
  if (!props.task) return
  smartSuggestChecked.value = {}
  smartSuggest(props.task)
}

function doSmartSuggestGroup() {
  if (!props.selectedTaskIds?.length) return
  smartSuggestGroupChecked.value = {}
  smartSuggestGroup(props.selectedTaskIds)
}

// ============================================================================
// Accept Handlers
// ============================================================================

function acceptSubtasks() {
  if (result.value?.subtasks) {
    emit('acceptSubtasks', result.value.subtasks)
    clearResult()
    emit('close')
  }
}

function acceptPriority() {
  if (result.value?.priority) {
    emit('acceptPriority', result.value.priority.priority, result.value.priority.duration)
    clearResult()
    emit('close')
  }
}

function acceptBreakdown() {
  if (result.value?.breakdown) {
    emit('acceptBreakdown', result.value.breakdown)
    clearResult()
    emit('close')
  }
}

function acceptDate() {
  if (result.value?.date) {
    emit('acceptDate', result.value.date.date)
    clearResult()
    emit('close')
  }
}

function acceptTitle() {
  if (result.value?.title) {
    emit('acceptTitle', result.value.title)
    clearResult()
    emit('close')
  }
}

// ============================================================================
// Smart Suggest Selection State
// ============================================================================

const smartSuggestChecked = ref<Record<string, boolean>>({})
const smartSuggestGroupChecked = ref<Record<string, Record<string, boolean>>>({})

// FEATURE-1342: Feedback state for suggestion corrections
const showFeedbackInputs = ref(false)
const feedbackText = ref<Record<string, string>>({})
const showDismissFeedback = ref(false)
const dismissFeedbackText = ref('')

function isSmartSuggestChecked(suggestion: SmartSuggestion): boolean {
  const key = suggestion.field
  if (key in smartSuggestChecked.value) return smartSuggestChecked.value[key]
  // Default: checked if confidence > 0.7
  return suggestion.confidence > 0.7
}

function toggleSmartSuggestCheck(suggestion: SmartSuggestion) {
  const key = suggestion.field
  smartSuggestChecked.value[key] = !isSmartSuggestChecked(suggestion)
}

function isGroupSuggestionChecked(taskId: string, suggestion: SmartSuggestion): boolean {
  const taskChecks = smartSuggestGroupChecked.value[taskId]
  if (taskChecks && suggestion.field in taskChecks) return taskChecks[suggestion.field]
  return suggestion.confidence > 0.7
}

function toggleGroupSuggestionCheck(taskId: string, suggestion: SmartSuggestion) {
  if (!smartSuggestGroupChecked.value[taskId]) {
    smartSuggestGroupChecked.value[taskId] = {}
  }
  smartSuggestGroupChecked.value[taskId][suggestion.field] = !isGroupSuggestionChecked(taskId, suggestion)
}

async function acceptSmartSuggest() {
  const suggestions = result.value?.smartSuggest?.suggestions
  if (!suggestions) return

  const rejected = suggestions.filter(s => !isSmartSuggestChecked(s))

  // Step 1: If rejections exist and feedback not shown yet, show feedback inputs
  if (rejected.length > 0 && !showFeedbackInputs.value) {
    showFeedbackInputs.value = true
    return
  }

  // Step 2: Apply accepted suggestions
  const updates = suggestions
    .filter(s => isSmartSuggestChecked(s))
    .map(s => ({ field: s.field, value: s.suggestedValue }))
  if (updates.length > 0) {
    emit('acceptSmartSuggest', updates)
  }

  // FEATURE-1342: Record feedback for rejected suggestions
  for (const s of rejected) {
    await addSuggestionFeedback({
      field: s.field,
      suggestedValue: formatFieldValue(s.field, s.suggestedValue),
      actualValue: formatFieldValue(s.field, s.currentValue),
      reason: feedbackText.value[s.field] || undefined
    })
  }

  showFeedbackInputs.value = false
  feedbackText.value = {}
  clearResult()
  emit('close')
}

async function handleDismissSmart() {
  const suggestions = result.value?.smartSuggest?.suggestions
  if (!suggestions?.length) {
    clearResult()
    return
  }

  // Step 1: Show feedback input
  if (!showDismissFeedback.value) {
    showDismissFeedback.value = true
    return
  }

  // Step 2: Record all as rejected
  for (const s of suggestions) {
    await addSuggestionFeedback({
      field: s.field,
      suggestedValue: formatFieldValue(s.field, s.suggestedValue),
      actualValue: formatFieldValue(s.field, s.currentValue),
      reason: dismissFeedbackText.value || undefined
    })
  }

  showDismissFeedback.value = false
  dismissFeedbackText.value = ''
  clearResult()
}

function acceptSmartSuggestGroup() {
  const items = result.value?.smartSuggestGroup
  if (!items) return
  const updates = items
    .map(item => ({
      taskId: item.taskId,
      fields: item.suggestions
        .filter(s => isGroupSuggestionChecked(item.taskId, s))
        .map(s => ({ field: s.field, value: s.suggestedValue }))
    }))
    .filter(u => u.fields.length > 0)
  if (updates.length > 0) {
    emit('acceptSmartSuggestGroup', updates)
  }
  clearResult()
  emit('close')
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    priority: 'Priority',
    dueDate: 'Due Date',
    status: 'Status',
    estimatedDuration: 'Estimate'
  }
  return labels[field] || field
}

function formatFieldValue(field: string, value: string | number | null): string {
  if (value === null || value === undefined) return 'none'
  if (field === 'dueDate') return formatDate(String(value))
  if (field === 'estimatedDuration') return `${value}min`
  if (field === 'status') {
    const statusLabels: Record<string, string> = { planned: 'To Do', in_progress: 'In Progress', backlog: 'Backlog' }
    return statusLabels[String(value)] || String(value)
  }
  return String(value)
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 0.8) return 'confidence--high'
  if (confidence >= 0.6) return 'confidence--medium'
  return 'confidence--low'
}

// ============================================================================
// Lifecycle
// ============================================================================

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function handleClose() {
  clearResult()
  emit('close')
}

function handleAbort() {
  abort()
}

// Reset state when popover becomes hidden
watch(() => props.isVisible, (visible) => {
  if (!visible) {
    clearResult()
    smartSuggestChecked.value = {}
    smartSuggestGroupChecked.value = {}
    showFeedbackInputs.value = false
    feedbackText.value = {}
    showDismissFeedback.value = false
    dismissFeedbackText.value = ''
  }
})

// Auto-trigger an action when the popover opens (e.g., from task row sparkles button)
watch(() => [props.isVisible, props.autoTrigger] as const, ([visible, trigger]) => {
  if (visible && trigger === 'smartSuggest' && props.task && !isLoading.value && !result.value) {
    doSmartSuggest()
  } else if (visible && trigger === 'smartSuggestGroup' && props.selectedTaskIds?.length && !isLoading.value && !result.value) {
    doSmartSuggestGroup()
  }
})
</script>

<template>
  <BasePopover
    :is-visible="isVisible && !!task"
    :x="x"
    :y="y"
    variant="menu"
    position="auto"
    @close="handleClose"
  >
    <div class="ai-assist-popover">
      <!-- Header -->
      <div class="ai-assist-header">
        <Sparkles :size="14" class="header-icon" />
        <span class="header-title">AI Assist</span>
        <span v-if="task" class="header-task" dir="auto">{{ truncatedTitle }}</span>
      </div>

      <!-- Action buttons (shown when no result and not loading) -->
      <div v-if="!result && !isLoading && !error" class="ai-assist-actions">
        <button
          v-if="showAction('smartSuggest')"
          class="assist-action-btn assist-action-btn--smart"
          :disabled="isLoading"
          @click="doSmartSuggest"
        >
          <Zap :size="14" />
          Smart Suggest
        </button>
        <button
          v-if="showAction('subtasks')"
          class="assist-action-btn"
          :disabled="isLoading"
          @click="doSuggestSubtasks"
        >
          <LayoutList :size="14" />
          Suggest subtasks
        </button>
        <button
          v-if="showAction('priority')"
          class="assist-action-btn"
          :disabled="isLoading"
          @click="doSuggestPriority"
        >
          <Target :size="14" />
          Suggest priority &amp; duration
        </button>
        <button
          v-if="showAction('breakdown')"
          class="assist-action-btn"
          :disabled="isLoading"
          @click="doBreakDown"
        >
          <Scissors :size="14" />
          Break into tasks
        </button>
        <button
          v-if="showAction('date')"
          class="assist-action-btn"
          :disabled="isLoading"
          @click="doSuggestDate"
        >
          <CalendarClock :size="14" />
          When should I do this?
        </button>
        <button
          v-if="showAction('title')"
          class="assist-action-btn"
          :disabled="isLoading"
          @click="doImproveTitle"
        >
          <PenLine :size="14" />
          Improve title
        </button>
        <button
          v-if="showAction('related')"
          class="assist-action-btn"
          :disabled="isLoading"
          @click="doFindRelated"
        >
          <Link2 :size="14" />
          Find related tasks
        </button>
        <button
          v-if="showAction('summary')"
          class="assist-action-btn"
          :disabled="isLoading"
          @click="doSummarizeBatch"
        >
          <LayoutList :size="14" />
          Summarize selected
        </button>
      </div>

      <!-- Loading state -->
      <div v-if="isLoading" class="ai-assist-loading">
        <Loader2 :size="16" class="spin" />
        <span>{{ loadingText }}</span>
        <button class="abort-btn" @click="handleAbort">
          Cancel
        </button>
      </div>

      <!-- Error state -->
      <div v-if="error && !isLoading" class="ai-assist-error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
        <button class="retry-btn" @click="clearResult">
          Try again
        </button>
      </div>

      <!-- Result area -->
      <div v-if="result && !isLoading" class="ai-assist-result">
        <!-- SUBTASKS result -->
        <div v-if="result.type === 'subtasks'" class="result-subtasks">
          <div class="result-label">
            Suggested subtasks
          </div>
          <div v-for="(sub, i) in result.subtasks" :key="i" class="subtask-item">
            <span class="subtask-text" dir="auto">{{ sub }}</span>
          </div>
          <div class="result-actions">
            <button class="accept-btn" @click="acceptSubtasks">
              Add all
            </button>
            <button class="dismiss-btn" @click="clearResult">
              Dismiss
            </button>
          </div>
        </div>

        <!-- PRIORITY result -->
        <div v-if="result.type === 'priority'" class="result-priority">
          <div class="result-label">
            Suggestion
          </div>
          <div class="priority-suggestion">
            <span class="priority-badge" :class="result.priority?.priority">
              {{ result.priority?.priority }}
            </span>
            <span class="duration-badge">{{ result.priority?.duration }}min</span>
          </div>
          <p class="reasoning-text" dir="auto">
            {{ result.priority?.reasoning }}
          </p>
          <div class="result-actions">
            <button class="accept-btn" @click="acceptPriority">
              Apply
            </button>
            <button class="dismiss-btn" @click="clearResult">
              Dismiss
            </button>
          </div>
        </div>

        <!-- BREAKDOWN result -->
        <div v-if="result.type === 'breakdown'" class="result-breakdown">
          <div class="result-label">
            Break into tasks
          </div>
          <div v-for="(t, i) in result.breakdown" :key="i" class="breakdown-item">
            <span class="breakdown-title" dir="auto">{{ t.title }}</span>
            <span v-if="t.priority" class="priority-badge small" :class="t.priority">
              {{ t.priority }}
            </span>
          </div>
          <div class="result-actions">
            <button class="accept-btn" @click="acceptBreakdown">
              Create all
            </button>
            <button class="dismiss-btn" @click="clearResult">
              Dismiss
            </button>
          </div>
        </div>

        <!-- DATE result -->
        <div v-if="result.type === 'date'" class="result-date">
          <div class="result-label">
            Suggested date
          </div>
          <div class="date-suggestion">
            {{ formatDate(result.date?.date) }}
          </div>
          <p class="reasoning-text" dir="auto">
            {{ result.date?.reasoning }}
          </p>
          <div class="result-actions">
            <button class="accept-btn" @click="acceptDate">
              Apply
            </button>
            <button class="dismiss-btn" @click="clearResult">
              Dismiss
            </button>
          </div>
        </div>

        <!-- TITLE result -->
        <div v-if="result.type === 'title'" class="result-title">
          <div class="result-label">
            Improved title
          </div>
          <div class="title-before" dir="auto">
            {{ task?.title }}
          </div>
          <div class="title-arrow">
            -&gt;
          </div>
          <div class="title-after" dir="auto">
            {{ result.title }}
          </div>
          <div class="result-actions">
            <button class="accept-btn" @click="acceptTitle">
              Accept
            </button>
            <button class="dismiss-btn" @click="clearResult">
              Dismiss
            </button>
          </div>
        </div>

        <!-- RELATED result -->
        <div v-if="result.type === 'related'" class="result-related">
          <div class="result-label">
            Related tasks
          </div>
          <div v-if="result.related?.length === 0" class="no-results">
            No related tasks found
          </div>
          <div v-for="rel in result.related" :key="rel.id" class="related-item">
            <span class="related-title" dir="auto">{{ rel.title }}</span>
            <span v-if="rel.priority" class="priority-badge small" :class="rel.priority">
              {{ rel.priority }}
            </span>
          </div>
          <div class="result-actions">
            <button class="dismiss-btn" @click="clearResult">
              Close
            </button>
          </div>
        </div>

        <!-- SUMMARY result -->
        <div v-if="result.type === 'summary'" class="result-summary">
          <div class="result-label">
            Summary
          </div>
          <p class="summary-text" dir="auto">
            {{ result.summary?.summary }}
          </p>
          <div v-if="result.summary?.suggestedGroup" class="suggested-group">
            Suggested group: <strong>{{ result.summary.suggestedGroup }}</strong>
          </div>
          <div class="result-actions">
            <button class="dismiss-btn" @click="clearResult">
              Close
            </button>
          </div>
        </div>

        <!-- SMART SUGGEST result -->
        <div v-if="result.type === 'smartSuggest'" class="result-smart-suggest">
          <div class="result-label">
            Suggestions
          </div>
          <div v-if="!result.smartSuggest?.suggestions?.length" class="no-results">
            Task looks good — no changes needed
          </div>
          <div
            v-for="suggestion in result.smartSuggest?.suggestions"
            :key="suggestion.field"
            class="smart-suggestion-card"
            :class="{ 'smart-suggestion-card--checked': isSmartSuggestChecked(suggestion) }"
            @click="toggleSmartSuggestCheck(suggestion)"
          >
            <div class="smart-suggestion-header">
              <div class="smart-suggestion-check">
                <Check v-if="isSmartSuggestChecked(suggestion)" :size="12" />
              </div>
              <span class="smart-suggestion-field">{{ getFieldLabel(suggestion.field) }}</span>
              <span class="confidence-bar" :class="getConfidenceClass(suggestion.confidence)">
                {{ Math.round(suggestion.confidence * 100) }}%
              </span>
            </div>
            <div class="smart-suggestion-values">
              <span class="smart-value-current">{{ formatFieldValue(suggestion.field, suggestion.currentValue) }}</span>
              <span class="smart-value-arrow">&rarr;</span>
              <span class="smart-value-suggested">{{ formatFieldValue(suggestion.field, suggestion.suggestedValue) }}</span>
            </div>
            <p v-if="suggestion.reasoning" class="smart-suggestion-reason" dir="auto">
              {{ suggestion.reasoning }}
            </p>
            <!-- FEATURE-1342: Feedback input for rejected suggestions -->
            <div
              v-if="showFeedbackInputs && !isSmartSuggestChecked(suggestion)"
              class="smart-suggestion-feedback"
              @click.stop
            >
              <input
                v-model="feedbackText[suggestion.field]"
                class="feedback-input"
                type="text"
                placeholder="Why not? (optional)"
                @keydown.enter.stop="acceptSmartSuggest"
                @click.stop
              >
            </div>
          </div>
          <!-- FEATURE-1342: Dismiss feedback input -->
          <div v-if="showDismissFeedback" class="dismiss-feedback-section" @click.stop>
            <input
              v-model="dismissFeedbackText"
              class="feedback-input feedback-input--full"
              type="text"
              placeholder="What was wrong? (optional)"
              @keydown.enter.stop="handleDismissSmart"
              @click.stop
            >
          </div>
          <div v-if="result.smartSuggest?.suggestions?.length" class="result-actions">
            <button class="accept-btn" @click="acceptSmartSuggest">
              {{ showFeedbackInputs ? 'Confirm & Apply' : 'Apply selected' }}
            </button>
            <button class="dismiss-btn" @click="handleDismissSmart">
              {{ showDismissFeedback ? 'Confirm dismiss' : 'Dismiss' }}
            </button>
          </div>
          <div v-else class="result-actions">
            <button class="dismiss-btn" @click="clearResult">
              Close
            </button>
          </div>
        </div>

        <!-- SMART SUGGEST GROUP result -->
        <div v-if="result.type === 'smartSuggestGroup'" class="result-smart-suggest-group">
          <div class="result-label">
            Group Suggestions
          </div>
          <div v-if="!result.smartSuggestGroup?.length" class="no-results">
            All tasks look good — no changes needed
          </div>
          <div
            v-for="item in result.smartSuggestGroup"
            :key="item.taskId"
            class="group-task-section"
          >
            <div class="group-task-title" dir="auto">
              {{ item.taskTitle }}
            </div>
            <div
              v-for="suggestion in item.suggestions"
              :key="`${item.taskId}-${suggestion.field}`"
              class="smart-suggestion-card smart-suggestion-card--compact"
              :class="{ 'smart-suggestion-card--checked': isGroupSuggestionChecked(item.taskId, suggestion) }"
              @click="toggleGroupSuggestionCheck(item.taskId, suggestion)"
            >
              <div class="smart-suggestion-header">
                <div class="smart-suggestion-check">
                  <Check v-if="isGroupSuggestionChecked(item.taskId, suggestion)" :size="12" />
                </div>
                <span class="smart-suggestion-field">{{ getFieldLabel(suggestion.field) }}</span>
                <span class="smart-value-current">{{ formatFieldValue(suggestion.field, suggestion.currentValue) }}</span>
                <span class="smart-value-arrow">&rarr;</span>
                <span class="smart-value-suggested">{{ formatFieldValue(suggestion.field, suggestion.suggestedValue) }}</span>
              </div>
            </div>
          </div>
          <div v-if="result.smartSuggestGroup?.length" class="result-actions">
            <button class="accept-btn" @click="acceptSmartSuggestGroup">
              Apply selected
            </button>
            <button class="dismiss-btn" @click="clearResult">
              Dismiss
            </button>
          </div>
          <div v-else class="result-actions">
            <button class="dismiss-btn" @click="clearResult">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </BasePopover>
</template>

<style scoped>
.ai-assist-popover {
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
}

/* ── Header ── */
.ai-assist-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--glass-border);
}

.header-icon {
  color: var(--brand-primary);
  flex-shrink: 0;
}

.header-title {
  font-weight: var(--font-semibold);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.header-task {
  font-size: var(--text-xs);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
  margin-left: auto;
}

/* ── Action Buttons ── */
.ai-assist-actions {
  padding: var(--space-1) 0;
}

.assist-action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: background var(--duration-fast);
  text-align: left;
}

.assist-action-btn:hover {
  background: var(--glass-bg-heavy);
}

.assist-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Loading ── */
.ai-assist-loading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.spin {
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.abort-btn {
  margin-left: auto;
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  font-size: var(--text-xs);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--duration-fast), border-color var(--duration-fast);
}

.abort-btn:hover {
  color: var(--text-primary);
  border-color: var(--glass-border-hover);
}

/* ── Error ── */
.ai-assist-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  color: var(--color-priority-high);
  font-size: var(--text-xs);
  line-height: var(--leading-normal);
}

.ai-assist-error > svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.retry-btn {
  margin-left: auto;
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--danger-border-subtle);
  color: var(--color-priority-high);
  font-size: var(--text-xs);
  border-radius: var(--radius-sm);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.retry-btn:hover {
  border-color: var(--danger-border-medium);
}

/* ── Results ── */
.ai-assist-result {
  padding: var(--space-2) var(--space-3);
}

.result-label {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: var(--space-2);
}

.result-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

/* ── Subtasks ── */
.subtask-item {
  padding: var(--space-1_5) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-light);
  margin-bottom: var(--space-1);
}

.subtask-text {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

/* ── Priority Result ── */
.priority-suggestion {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.priority-badge {
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  text-transform: capitalize;
}

.priority-badge.high {
  background: var(--priority-high-bg);
  color: var(--color-priority-high);
}

.priority-badge.medium {
  background: var(--priority-medium-bg);
  color: var(--color-priority-medium);
}

.priority-badge.low {
  background: var(--priority-low-bg);
  color: var(--color-priority-low);
}

.priority-badge.small {
  font-size: 0.625rem;
  padding: 1px var(--space-1_5);
}

.duration-badge {
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  background: var(--glass-bg-medium);
  color: var(--text-secondary);
}

.reasoning-text {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  line-height: var(--leading-normal);
  margin: 0;
}

/* ── Breakdown ── */
.breakdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-1_5) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-light);
  margin-bottom: var(--space-1);
}

.breakdown-title {
  font-size: var(--text-sm);
  color: var(--text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Date Result ── */
.date-suggestion {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
  margin-bottom: var(--space-2);
}

/* ── Title Result ── */
.title-before {
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-decoration: line-through;
  margin-bottom: var(--space-1);
}

.title-arrow {
  font-size: var(--text-xs);
  color: var(--text-subtle);
  margin-bottom: var(--space-1);
}

.title-after {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
}

/* ── Related Tasks ── */
.no-results {
  font-size: var(--text-sm);
  color: var(--text-muted);
  padding: var(--space-2) 0;
}

.related-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-1_5) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-light);
  margin-bottom: var(--space-1);
}

.related-title {
  font-size: var(--text-sm);
  color: var(--text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Summary Result ── */
.summary-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-normal);
  margin: 0 0 var(--space-2);
}

.suggested-group {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  padding: var(--space-1_5) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-light);
}

.suggested-group strong {
  color: var(--brand-primary);
}

/* ── Smart Suggest Button ── */
.assist-action-btn--smart {
  color: var(--brand-primary);
  font-weight: var(--font-semibold);
}

/* ── Smart Suggest Result ── */
.smart-suggestion-card {
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--glass-bg-light);
  border: 1px solid transparent;
  margin-bottom: var(--space-1_5);
  cursor: pointer;
  transition: border-color var(--duration-fast), background var(--duration-fast);
}

.smart-suggestion-card:hover {
  background: var(--glass-bg-medium);
}

.smart-suggestion-card--checked {
  border-color: var(--brand-primary);
}

.smart-suggestion-card--compact {
  padding: var(--space-1_5) var(--space-2);
  margin-bottom: var(--space-1);
}

.smart-suggestion-header {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  margin-bottom: var(--space-1);
}

.smart-suggestion-card--compact .smart-suggestion-header {
  margin-bottom: 0;
}

.smart-suggestion-check {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--brand-primary);
  transition: border-color var(--duration-fast), background var(--duration-fast);
}

.smart-suggestion-card--checked .smart-suggestion-check {
  border-color: var(--brand-primary);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
}

.smart-suggestion-field {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
}

.confidence-bar {
  margin-left: auto;
  font-size: 0.625rem;
  font-weight: var(--font-semibold);
  padding: 1px var(--space-1_5);
  border-radius: var(--radius-full);
}

.confidence--high {
  background: var(--brand-primary-bg, var(--glass-bg-medium));
  color: var(--brand-primary);
}

.confidence--medium {
  background: var(--warning-bg-light);
  color: var(--color-priority-medium);
}

.confidence--low {
  background: var(--glass-bg-medium);
  color: var(--text-muted);
}

.smart-suggestion-values {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  padding-left: calc(16px + var(--space-1_5));
}

.smart-value-current {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-decoration: line-through;
}

.smart-value-arrow {
  font-size: var(--text-xs);
  color: var(--text-subtle);
}

.smart-value-suggested {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
  text-transform: capitalize;
}

.smart-suggestion-reason {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  line-height: var(--leading-normal);
  margin: var(--space-1) 0 0;
  padding-left: calc(16px + var(--space-1_5));
}

/* ── FEATURE-1342: Suggestion Feedback ── */
.smart-suggestion-feedback {
  padding: var(--space-1_5) 0 0 calc(16px + var(--space-1_5));
}

.feedback-input {
  width: 100%;
  padding: var(--space-1) var(--space-2);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-xs);
  outline: none;
  transition: border-color var(--duration-fast);
}

.feedback-input::placeholder {
  color: var(--text-muted);
}

.feedback-input:focus {
  border-color: var(--brand-primary);
}

.feedback-input--full {
  padding-left: var(--space-2);
}

.dismiss-feedback-section {
  padding: var(--space-2) 0 0;
}

/* ── Smart Suggest Group ── */
.group-task-section {
  margin-bottom: var(--space-2);
}

.group-task-section:last-child {
  margin-bottom: 0;
}

.group-task-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-1);
  padding: var(--space-0_5) 0;
  border-bottom: 1px solid var(--glass-border);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-smart-suggest-group {
  max-height: 300px;
  overflow-y: auto;
}

/* ── Buttons ── */
.accept-btn {
  padding: var(--space-1_5) var(--space-3);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  backdrop-filter: blur(var(--blur-sm));
  -webkit-backdrop-filter: blur(var(--blur-sm));
  transition: background var(--duration-fast), border-color var(--duration-fast);
}

.accept-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--brand-primary-hover);
}

.dismiss-btn {
  padding: var(--space-1_5) var(--space-3);
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: border-color var(--duration-fast), color var(--duration-fast);
}

.dismiss-btn:hover {
  border-color: var(--glass-border-hover);
  color: var(--text-primary);
}

/* ── Scrollbar ── */
.ai-assist-popover::-webkit-scrollbar {
  width: 6px;
}

.ai-assist-popover::-webkit-scrollbar-track {
  background: transparent;
}

.ai-assist-popover::-webkit-scrollbar-thumb {
  background: var(--glass-border-hover);
  border-radius: var(--radius-full);
}

.ai-assist-popover::-webkit-scrollbar-thumb:hover {
  background: var(--border-interactive);
}
</style>
