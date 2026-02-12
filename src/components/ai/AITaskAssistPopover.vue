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

import { computed, watch } from 'vue'
import {
  Sparkles,
  Target,
  Scissors,
  CalendarClock,
  PenLine,
  Link2,
  LayoutList,
  Loader2,
  AlertCircle
} from 'lucide-vue-next'
import BasePopover from '@/components/base/BasePopover.vue'
import { useAITaskAssist } from '@/composables/useAITaskAssist'
import type { Task } from '@/types/tasks'

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
}

const props = withDefaults(defineProps<Props>(), {
  selectedTaskIds: () => []
})

const emit = defineEmits<{
  close: []
  acceptSubtasks: [subtasks: string[]]
  acceptPriority: [priority: string, duration: number]
  acceptBreakdown: [tasks: Array<{ title: string; priority?: string }>]
  acceptDate: [date: string]
  acceptTitle: [title: string]
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
  isLoading,
  currentAction,
  result,
  error,
  abort,
  clearResult
} = useAITaskAssist()

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
    summarizeBatch: 'Summarizing tasks...'
  }
  return labels[currentAction.value || ''] || 'Thinking...'
})

// ============================================================================
// Action Visibility
// ============================================================================

const contextActions: Record<string, string[]> = {
  'context-menu': ['priority', 'breakdown', 'date', 'related', 'summary'],
  'edit-modal': ['subtasks', 'priority', 'date', 'title'],
  'quick-create': ['priority', 'date', 'title']
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
        <button class="abort-btn" @click="handleAbort">Cancel</button>
      </div>

      <!-- Error state -->
      <div v-if="error && !isLoading" class="ai-assist-error">
        <AlertCircle :size="14" />
        <span>{{ error }}</span>
        <button class="retry-btn" @click="clearResult">Try again</button>
      </div>

      <!-- Result area -->
      <div v-if="result && !isLoading" class="ai-assist-result">
        <!-- SUBTASKS result -->
        <div v-if="result.type === 'subtasks'" class="result-subtasks">
          <div class="result-label">Suggested subtasks</div>
          <div v-for="(sub, i) in result.subtasks" :key="i" class="subtask-item">
            <span class="subtask-text" dir="auto">{{ sub }}</span>
          </div>
          <div class="result-actions">
            <button class="accept-btn" @click="acceptSubtasks">Add all</button>
            <button class="dismiss-btn" @click="clearResult">Dismiss</button>
          </div>
        </div>

        <!-- PRIORITY result -->
        <div v-if="result.type === 'priority'" class="result-priority">
          <div class="result-label">Suggestion</div>
          <div class="priority-suggestion">
            <span class="priority-badge" :class="result.priority?.priority">
              {{ result.priority?.priority }}
            </span>
            <span class="duration-badge">{{ result.priority?.duration }}min</span>
          </div>
          <p class="reasoning-text" dir="auto">{{ result.priority?.reasoning }}</p>
          <div class="result-actions">
            <button class="accept-btn" @click="acceptPriority">Apply</button>
            <button class="dismiss-btn" @click="clearResult">Dismiss</button>
          </div>
        </div>

        <!-- BREAKDOWN result -->
        <div v-if="result.type === 'breakdown'" class="result-breakdown">
          <div class="result-label">Break into tasks</div>
          <div v-for="(t, i) in result.breakdown" :key="i" class="breakdown-item">
            <span class="breakdown-title" dir="auto">{{ t.title }}</span>
            <span v-if="t.priority" class="priority-badge small" :class="t.priority">
              {{ t.priority }}
            </span>
          </div>
          <div class="result-actions">
            <button class="accept-btn" @click="acceptBreakdown">Create all</button>
            <button class="dismiss-btn" @click="clearResult">Dismiss</button>
          </div>
        </div>

        <!-- DATE result -->
        <div v-if="result.type === 'date'" class="result-date">
          <div class="result-label">Suggested date</div>
          <div class="date-suggestion">{{ formatDate(result.date?.date) }}</div>
          <p class="reasoning-text" dir="auto">{{ result.date?.reasoning }}</p>
          <div class="result-actions">
            <button class="accept-btn" @click="acceptDate">Apply</button>
            <button class="dismiss-btn" @click="clearResult">Dismiss</button>
          </div>
        </div>

        <!-- TITLE result -->
        <div v-if="result.type === 'title'" class="result-title">
          <div class="result-label">Improved title</div>
          <div class="title-before" dir="auto">{{ task?.title }}</div>
          <div class="title-arrow">-&gt;</div>
          <div class="title-after" dir="auto">{{ result.title }}</div>
          <div class="result-actions">
            <button class="accept-btn" @click="acceptTitle">Accept</button>
            <button class="dismiss-btn" @click="clearResult">Dismiss</button>
          </div>
        </div>

        <!-- RELATED result -->
        <div v-if="result.type === 'related'" class="result-related">
          <div class="result-label">Related tasks</div>
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
            <button class="dismiss-btn" @click="clearResult">Close</button>
          </div>
        </div>

        <!-- SUMMARY result -->
        <div v-if="result.type === 'summary'" class="result-summary">
          <div class="result-label">Summary</div>
          <p class="summary-text" dir="auto">{{ result.summary?.summary }}</p>
          <div v-if="result.summary?.suggestedGroup" class="suggested-group">
            Suggested group: <strong>{{ result.summary.suggestedGroup }}</strong>
          </div>
          <div class="result-actions">
            <button class="dismiss-btn" @click="clearResult">Close</button>
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

/* ── Buttons ── */
.accept-btn {
  padding: var(--space-1_5) var(--space-3);
  background: var(--brand-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: opacity var(--duration-fast);
}

.accept-btn:hover {
  opacity: 0.9;
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
