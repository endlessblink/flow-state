<script setup lang="ts">
/**
 * Chat Message Component
 *
 * Displays a single message in the AI chat panel.
 * Supports:
 * - User and assistant message styling
 * - Markdown rendering via markdown-it
 * - Tool JSON stripping
 * - Copy to clipboard
 * - Streaming animation with thinking indicator
 * - Action buttons
 * - Tool result display
 * - Error states
 * - RTL support
 *
 * @see TASK-1120 in MASTER_PLAN.md
 */

import { computed, ref } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/stores/tasks'
import { User, Sparkles, Loader2, Check, Copy, CheckCheck, Zap, PenLine, Trash2, Play, CheckCircle2, ListOrdered } from 'lucide-vue-next'
import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import type Renderer from 'markdown-it/lib/renderer.mjs'
import type { Options as MarkdownItOptions } from 'markdown-it'
import type { ChatMessage, ChatAction } from '@/stores/aiChat'
import { formatRelativeDate } from '@/utils/dateUtils'
import TaskQuickEditPopover from './TaskQuickEditPopover.vue'
import { executeTool } from '@/services/ai/tools'
import { sanitizeMarkdownHtml } from '@/utils/security'
import { detectLanguage } from '@/services/ai/pipeline/languageDetector'
import { useWorkProfile } from '@/composables/useWorkProfile'
import { useCanvasStore } from '@/stores/canvas'
import { useLaneStore } from '@/stores/lanes'
import { buildDayPlanTaskUpdates } from '@/services/ai/pipeline/dayPlan'
import { getUndoSystem } from '@/composables/undoSingleton'

// ============================================================================
// Props
// ============================================================================

const props = defineProps<{
  message: ChatMessage
  direction?: 'auto' | 'ltr' | 'rtl'
}>()

const emit = defineEmits<{
  'selectTask': [taskId: string]
}>()

// ============================================================================
// Markdown Setup
// ============================================================================

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

// Make links open in new tab
const defaultRender = md.renderer.rules.link_open || function (tokens: Token[], idx: number, options: MarkdownItOptions, _env: unknown, self: Renderer) {
  return self.renderToken(tokens, idx, options)
}
md.renderer.rules.link_open = function (tokens: Token[], idx: number, options: MarkdownItOptions, env: unknown, self: Renderer) {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer')
  return defaultRender(tokens, idx, options, env, self)
}

// ============================================================================
// State
// ============================================================================

const loadingActions = ref<Set<string>>(new Set())
const copied = ref(false)

// Track which tasks have been actioned (for visual feedback)
const completedTaskIds = ref<Set<string>>(new Set())
const timerStartedTaskIds = ref<Set<string>>(new Set())
const actionLoading = ref<Record<string, string>>({}) // taskId -> 'done' | 'timer'
const dayPlanApplying = ref(false)
const dayPlanApplied = ref(false)
const dayPlanError = ref('')
const smartLaneApplying = ref(false)
const smartLaneApplied = ref(false)
const smartLaneError = ref('')

// Schedule onboarding
const selectedDays = ref<Set<string>>(new Set())
const scheduleSaving = ref(false)
const scheduleSaved = ref(false)

// Live task data from Pinia store (reactive — updates when user edits tasks)
const taskStore = useTaskStore()
const canvasStore = useCanvasStore()
const laneStore = useLaneStore()

const taskMap = computed(() => {
  const map = new Map<string, Task>()
  for (const task of taskStore.tasks) {
    map.set(task.id, task)
  }
  return map
})

/** Snapshot task item from AI tool results */
type TaskListItem = {
  id: string
  title?: string
  status?: string
  priority?: string
  dueDate?: string
  estimatedDuration?: number
  reason?: string
  daysOverdue?: number
  [key: string]: unknown
}

/**
 * Merge a frozen snapshot task with live data from the Pinia task store.
 * The snapshot determines WHICH task to show; the store provides CURRENT field values.
 * Falls back to snapshot data if the task was deleted from the store.
 */
function liveTask(snapshotTask: TaskListItem): TaskListItem {
  if (!snapshotTask?.id) return snapshotTask
  const storeTask = taskMap.value.get(snapshotTask.id)
  if (!storeTask) return snapshotTask
  return {
    ...snapshotTask,
    title: storeTask.title ?? snapshotTask.title,
    status: storeTask.status ?? snapshotTask.status,
    priority: storeTask.priority ?? snapshotTask.priority,
    dueDate: storeTask.dueDate ?? snapshotTask.dueDate,
    estimatedDuration: storeTask.estimatedDuration ?? snapshotTask.estimatedDuration,
  }
}

/** Apply liveTask() to an array of snapshot tasks */
function liveTasks(tasks: TaskListItem[]): TaskListItem[] {
  if (!Array.isArray(tasks)) return []
  return tasks.map(t => liveTask(t))
}

// ============================================================================
// Computed
// ============================================================================

const isUser = computed(() => props.message.role === 'user')
const isAssistant = computed(() => props.message.role === 'assistant')
const isStreaming = computed(() => props.message.isStreaming)
const hasError = computed(() => !!props.message.error)
/**
 * Per-message direction based on content language detection.
 * When direction is 'auto' (or unset), detect from message content:
 * - Hebrew content → 'rtl'
 * - English content → 'ltr'
 * - Unknown → 'auto' (let browser decide)
 * This prevents English messages from inheriting RTL from the app root.
 * @see TASK-1381 pipeline integration
 */
const effectiveDirection = computed<'auto' | 'ltr' | 'rtl'>(() => {
  // Explicit override from metadata or parent
  if (props.message.metadata?.forceDirection) return props.message.metadata.forceDirection
  if (props.direction && props.direction !== 'auto') return props.direction

  // Auto-detect from content
  const content = props.message.content || ''
  if (!content.trim()) return 'auto'

  const lang = detectLanguage(content)
  if (lang === 'he') return 'rtl'
  if (lang === 'en') return 'ltr'
  return 'auto'
})
const hasActions = computed(() =>
  props.message.actions && props.message.actions.length > 0
)
const scheduleQuestion = computed(() => {
  const meta = props.message.metadata
  return meta?.scheduleQuestion ?? null
})
const isThinking = computed(() =>
  isStreaming.value && (!props.message.content || props.message.content.trim() === '')
)
// TASK-1814: clear, language-aware "loading" label so the user knows the model is working.
const thinkingLabel = computed(() =>
  (effectiveDirection.value === 'rtl' || props.direction === 'rtl') ? 'חושב…' : 'Thinking…',
)

/**
 * Strip tool JSON blocks and AI preamble, then render markdown.
 */
const renderedContent = computed(() => {
  const content = (props.message.content || '').trim()
  if (!content) return ''

  // TASK-1383: Pipeline's cleanResponse() handles all stripping (tool blocks, JSON, preambles,
  // tool names, UUIDs, HTML tags) BEFORE content reaches this component. This computed
  // now only does: markdown render + XSS sanitization.
  return sanitizeMarkdownHtml(md.render(content))
})

export interface ChatToolResultData {
  length?: number
  totalTasks?: number
  inProgress?: number
  completedToday?: number
  dueToday?: number
  overdueCount?: number
  timerSessionsCompleted?: number
  overdueTasks?: TaskListItem[]
  dueTodayTasks?: TaskListItem[]
  plan?: Record<string, TaskListItem[]>
  statusBreakdown?: Record<string, number>
  unscheduled?: TaskListItem[]
  tasks?: TaskListItem[]
  totalScheduled?: number
  daysUsed?: number
  reasoning?: string
  [index: number]: unknown
  [key: string]: unknown
}

/**
 * Tool results extracted from metadata for display.
 * Includes full data for rich rendering (task lists, summaries, etc.)
 */
const toolResults = computed(() => {
  if (isStreaming.value) return []
  const meta = props.message.metadata as Record<string, unknown>
  if (!meta?.toolResults || !Array.isArray(meta.toolResults)) return []
  return meta.toolResults as Array<{
    tool: string
    message: string
    success: boolean
    data: ChatToolResultData
    type?: 'read' | 'write' | 'destructive'
  }>
})

/**
 * TASK-1814: grouped prioritization cards (each task with the AI's one-line reason).
 * When present, this replaces the flat task-list dump.
 */
const cardGroups = computed(() => {
  const meta = props.message.metadata as Record<string, unknown>
  const cg = meta?.cardGroups as {
    groups?: Array<{
      name: string
      tasks: Array<TaskListItem & { reason?: string }>
      newTasks?: Array<{ title: string; priority?: string; reason?: string }>
    }>
    total?: number
    kind?: string
  } | undefined
  if (!cg?.groups?.length || isStreaming.value) return null
  return cg
})

const isDayPlan = computed(() => cardGroups.value?.kind === 'day_plan')
const isSmartLanes = computed(() => cardGroups.value?.kind === 'smart_lanes')
const dayPlanTaskCount = computed(() => {
  const groups = cardGroups.value?.groups ?? []
  return groups.reduce((sum, group) => sum + group.tasks.length, 0)
})
const smartLaneApplyCount = computed(() => {
  const groups = cardGroups.value?.groups ?? []
  return groups.reduce((sum, group) =>
    sum + 1 + group.tasks.length + (group.newTasks?.length ?? 0), 0)
})

/**
 * Check if a tool result contains a task list that should be rendered as clickable items.
 */
function isTaskListResult(result: { tool: string; data: ChatToolResultData }): boolean {
  if (!result.data) return false
  // Direct array of tasks
  if (Array.isArray(result.data) && result.data.length > 0 && (result.data[0] as Record<string, unknown>)?.title) return true
  // Daily summary with nested task arrays
  if (result.data.dueTodayTasks?.length && result.data.dueTodayTasks.length > 0) return true
  if (result.data.overdueTasks?.length && result.data.overdueTasks.length > 0) return true
  return false
}

function getTasksFromResult(result: { tool: string; data: ChatToolResultData }): TaskListItem[] {
  if (!result.data) return []
  // Direct array (get_overdue_tasks, list_tasks, search_tasks)
  if (Array.isArray(result.data)) return liveTasks(result.data as TaskListItem[])

  const dataObj = result.data
  // Daily summary — merge overdue + due today
  const tasks: TaskListItem[] = []
  if (Array.isArray(dataObj.overdueTasks)) tasks.push(...dataObj.overdueTasks)
  if (Array.isArray(dataObj.dueTodayTasks)) tasks.push(...dataObj.dueTodayTasks)
  return liveTasks(tasks)
}

/**
 * Check if a tool result is a daily summary with stats to render as a rich card.
 */
function isDailySummaryResult(result: { tool: string; data: ChatToolResultData }): boolean {
  return result.tool === 'get_daily_summary' && !!result.data && typeof result.data.totalTasks === 'number'
}

function priorityColor(priority?: string): string {
  switch (priority) {
    case 'urgent': return 'var(--color-priority-high)'
    case 'high': return 'var(--color-priority-medium)'
    case 'medium': return 'var(--color-priority-low)' // Typically yellow/orange
    case 'low': return 'var(--color-success)'
    default: return 'var(--glass-handle)'
  }
}

// ============================================================================
// Quick-Edit Popover
// ============================================================================

// Collapse long task lists — show max 3, expandable
const MAX_VISIBLE_TASKS = 3
const expandedSections = ref<Set<string>>(new Set())

function toggleSection(key: string) {
  if (expandedSections.value.has(key)) {
    expandedSections.value.delete(key)
  } else {
    expandedSections.value.add(key)
  }
}

function visibleTasks(tasks: TaskListItem[], sectionKey: string): TaskListItem[] {
  const live = liveTasks(tasks)
  if (expandedSections.value.has(sectionKey) || live.length <= MAX_VISIBLE_TASKS) return live
  return live.slice(0, MAX_VISIBLE_TASKS)
}

const quickEditTask = ref<{ id: string; title: string; priority?: string | null; status?: string; dueDate?: string | null; estimatedDuration?: number | null } | null>(null)
const quickEditPos = ref({ x: 0, y: 0 })
const quickEditPosition = ref<'left' | 'auto'>('left')

function openQuickEdit(task: TaskListItem, event: MouseEvent) {
  event.stopPropagation()
  quickEditTask.value = {
    id: task.id,
    title: task.title || '(untitled)',
    priority: (task.priority as string) || null,
    status: task.status || 'todo',
    dueDate: task.dueDate || null,
    estimatedDuration: task.estimatedDuration || null,
  }
  const panel = document.querySelector('.ai-chat-panel')
  const isFullscreen = panel?.classList.contains('panel-fullscreen')
  if (isFullscreen || !panel) {
    // Fullscreen or no panel: position at click point with auto layout
    quickEditPos.value = { x: event.clientX, y: event.clientY }
    quickEditPosition.value = 'auto'
  } else {
    // Compact/expanded: position to the left of the panel
    const panelRect = panel.getBoundingClientRect()
    quickEditPos.value = { x: panelRect.left, y: event.clientY }
    quickEditPosition.value = 'left'
  }
}

function closeQuickEdit() {
  quickEditTask.value = null
}

function openFullEditor() {
  if (quickEditTask.value) {
    emit('selectTask', quickEditTask.value.id)
  }
  closeQuickEdit()
}

// ============================================================================
// Actions
// ============================================================================

async function handleAction(action: ChatAction) {
  if (loadingActions.value.has(action.id)) return
  if (action.completed) return

  loadingActions.value.add(action.id)

  try {
    await action.handler()
    action.completed = true
  } catch (err) {
    console.error('[ChatMessage] Action failed:', err)
  } finally {
    loadingActions.value.delete(action.id)
  }
}

function isActionLoading(action: ChatAction): boolean {
  return loadingActions.value.has(action.id)
}

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(props.message.content || '')
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (err) {
    console.error('[ChatMessage] Copy failed:', err)
  }
}

function toolIcon(type?: string) {
  switch (type) {
    case 'write': return PenLine
    case 'destructive': return Trash2
    default: return Zap
  }
}

async function markTaskDone(taskId: string, event: MouseEvent) {
  event.stopPropagation() // Don't open popover
  if (actionLoading.value[taskId]) return

  actionLoading.value[taskId] = 'done'
  try {
    await executeTool({ tool: 'update_task', parameters: { taskId, updates: { status: 'done' } } })
    completedTaskIds.value.add(taskId)
  } catch (err) {
    console.error('[ChatMessage] Mark done failed:', err)
  } finally {
    delete actionLoading.value[taskId]
  }
}

async function startTaskTimer(taskId: string, event: MouseEvent) {
  event.stopPropagation() // Don't open popover
  if (actionLoading.value[taskId]) return

  actionLoading.value[taskId] = 'timer'
  try {
    await executeTool({ tool: 'start_timer', parameters: { taskId } })
    timerStartedTaskIds.value.add(taskId)
  } catch (err) {
    console.error('[ChatMessage] Start timer failed:', err)
  } finally {
    delete actionLoading.value[taskId]
  }
}

async function applyDayPlan(event: MouseEvent) {
  event.stopPropagation()
  const plan = cardGroups.value
  if (!plan?.groups?.length || dayPlanApplying.value || dayPlanApplied.value) return

  dayPlanApplying.value = true
  dayPlanError.value = ''
  try {
    const result = buildDayPlanTaskUpdates(
      plan.groups,
      taskStore.tasks,
      canvasStore.groups,
    )
    if (result.taskUpdates.length === 0) {
      dayPlanError.value = 'No active tasks to apply.'
      return
    }

    await getUndoSystem().bulkUpdateTasksWithUndo(
      result.taskUpdates,
      result.targetGroupName
        ? `Apply AI day plan to ${result.targetGroupName}`
        : 'Apply AI day plan',
    )
    dayPlanApplied.value = true
  } catch (err) {
    console.error('[ChatMessage] Apply day plan failed:', err)
    dayPlanError.value = 'Could not apply this plan.'
  } finally {
    dayPlanApplying.value = false
  }
}

function normalizeTaskPriority(priority?: string): Task['priority'] {
  if (priority === 'low' || priority === 'medium' || priority === 'high') return priority
  return 'medium'
}

async function applySmartLanes(event: MouseEvent) {
  event.stopPropagation()
  const plan = cardGroups.value
  if (!plan?.groups?.length || smartLaneApplying.value || smartLaneApplied.value) return

  smartLaneApplying.value = true
  smartLaneError.value = ''
  try {
    const undo = getUndoSystem()
    const updates: Array<{ id: string; updates: Partial<Task> }> = []
    const laneColors = ['#4ECDC4', '#7C3AED', '#F59E0B', '#10B981', '#EF4444']

    for (const [index, group] of plan.groups.entries()) {
      const laneName = group.name?.trim() || `AI Lane ${index + 1}`
      const lane = await laneStore.createLane({
        name: laneName,
        color: laneColors[index % laneColors.length],
      })
      const parentTaskId = group.tasks.length === 1 ? group.tasks[0].id : null

      for (const task of group.tasks) {
        if (task.id) updates.push({ id: task.id, updates: { laneId: lane.id } })
      }

      for (const newTask of group.newTasks ?? []) {
        await undo.createTaskWithUndo({
          title: newTask.title,
          status: 'todo',
          priority: normalizeTaskPriority(newTask.priority),
          laneId: lane.id,
          parentTaskId,
        })
      }
    }

    if (updates.length > 0) {
      await undo.bulkUpdateTasksWithUndo(updates, 'Apply AI smart lanes')
    }
    smartLaneApplied.value = true
  } catch (err) {
    console.error('[ChatMessage] Apply smart lanes failed:', err)
    smartLaneError.value = 'Could not apply these lanes.'
  } finally {
    smartLaneApplying.value = false
  }
}

// ============================================================================
// Schedule Onboarding
// ============================================================================

const DAY_OPTIONS = [
  { value: 'sunday', label: 'Sun', labelHe: '\u05D0\u05F3' },
  { value: 'monday', label: 'Mon', labelHe: '\u05D1\u05F3' },
  { value: 'tuesday', label: 'Tue', labelHe: '\u05D2\u05F3' },
  { value: 'wednesday', label: 'Wed', labelHe: '\u05D3\u05F3' },
  { value: 'thursday', label: 'Thu', labelHe: '\u05D4\u05F3' },
  { value: 'friday', label: 'Fri', labelHe: '\u05D5\u05F3' },
  { value: 'saturday', label: 'Sat', labelHe: '\u05E9\u05F3' },
]

function toggleDay(day: string) {
  if (scheduleSaved.value) return
  const days = new Set(selectedDays.value)
  if (days.has(day)) {
    days.delete(day)
  } else {
    days.add(day)
  }
  selectedDays.value = days
}

async function saveSchedule() {
  if (scheduleSaving.value || scheduleSaved.value) return
  if (selectedDays.value.size === 0) return

  scheduleSaving.value = true
  try {
    const dayNames = [...selectedDays.value]
      .map(d => d.charAt(0).toUpperCase() + d.slice(1))
      .join(', ')
    const contextStr = `Not available on: ${dayNames}`

    const wp = useWorkProfile()
    await wp.savePreferences({
      personalContext: contextStr,
      daysOff: [...selectedDays.value],
    })

    scheduleSaved.value = true
    // Update message metadata to persist the answered state
    if (props.message.metadata?.scheduleQuestion) {
      // eslint-disable-next-line vue/no-mutating-props -- Persisting answered state to message metadata
      props.message.metadata.scheduleQuestion.answered = true
      // eslint-disable-next-line vue/no-mutating-props
      props.message.metadata.scheduleQuestion.selectedDays = [...selectedDays.value]
    }
  } catch (err) {
    console.error('[ChatMessage] Save schedule failed:', err)
  } finally {
    scheduleSaving.value = false
  }
}
</script>

<template>
  <div
    class="chat-message"
    :class="{
      'message-user': isUser,
      'message-assistant': isAssistant,
      'message-streaming': isStreaming,
      'message-error': hasError
    }"
  >
    <!-- Avatar -->
    <div class="message-avatar">
      <User v-if="isUser" :size="16" />
      <Sparkles v-else :size="16" />
    </div>

    <!-- Content -->
    <div class="message-content">
      <!-- Thinking Indicator — clear "model is loading" feedback (TASK-1814) -->
      <div v-if="isThinking" class="thinking-indicator">
        <span class="thinking-dots">
          <span class="thinking-dot" />
          <span class="thinking-dot" />
          <span class="thinking-dot" />
        </span>
        <span class="thinking-label">{{ thinkingLabel }}</span>
      </div>

      <!-- Rendered Message Text -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        v-else-if="renderedContent"
        class="message-text markdown-body"
        :dir="effectiveDirection"
        v-html="renderedContent"
      />

      <!-- Streaming cursor (when there IS content) -->
      <span v-if="isStreaming && !isThinking && renderedContent" class="cursor-blink">|</span>

      <!-- Schedule Onboarding Question Card -->
      <div v-if="scheduleQuestion && !scheduleQuestion.answered && !scheduleSaved" class="schedule-onboarding-card">
        <div class="schedule-question-text" dir="auto">
          Which days are you <strong>NOT</strong> available for tasks?
        </div>
        <div class="day-select-grid">
          <button
            v-for="day in DAY_OPTIONS"
            :key="day.value"
            class="day-select-btn"
            :class="{ 'day-selected': selectedDays.has(day.value) }"
            @click="toggleDay(day.value)"
          >
            {{ day.label }}
          </button>
        </div>
        <button
          class="schedule-save-btn"
          :disabled="selectedDays.size === 0 || scheduleSaving"
          @click="saveSchedule"
        >
          <Loader2 v-if="scheduleSaving" :size="14" class="spin" />
          <Check v-else :size="14" />
          <span>{{ scheduleSaving ? 'Saving...' : 'Save' }}</span>
        </button>
      </div>
      <!-- Schedule answered confirmation -->
      <div v-else-if="scheduleQuestion && (scheduleQuestion.answered || scheduleSaved)" class="schedule-answered-card">
        <Check :size="14" class="schedule-check-icon" />
        <span dir="auto">
          Not available on: <strong>{{ (scheduleQuestion.selectedDays || [...selectedDays]).map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') }}</strong>
        </span>
      </div>

      <!-- TASK-1814: Grouped prioritization cards — replaces the flat dump. Each
           task is the same interactive card + the AI's one-line reason underneath. -->
      <div v-if="cardGroups" class="card-groups">
        <div v-if="isDayPlan" class="day-plan-toolbar">
          <button
            class="day-plan-apply-btn"
            :class="{ applied: dayPlanApplied }"
            :disabled="dayPlanApplying || dayPlanApplied"
            @click="applyDayPlan"
          >
            <Loader2 v-if="dayPlanApplying" :size="14" class="spin" />
            <Check v-else-if="dayPlanApplied" :size="14" />
            <ListOrdered v-else :size="14" />
            <span>{{ dayPlanApplied ? 'Plan applied' : `Apply this order (${dayPlanTaskCount})` }}</span>
          </button>
          <span v-if="dayPlanError" class="day-plan-error">{{ dayPlanError }}</span>
        </div>
        <div v-else-if="isSmartLanes" class="day-plan-toolbar">
          <button
            class="day-plan-apply-btn"
            :class="{ applied: smartLaneApplied }"
            :disabled="smartLaneApplying || smartLaneApplied"
            @click="applySmartLanes"
          >
            <Loader2 v-if="smartLaneApplying" :size="14" class="spin" />
            <Check v-else-if="smartLaneApplied" :size="14" />
            <ListOrdered v-else :size="14" />
            <span>{{ smartLaneApplied ? 'Lanes applied' : `Apply lanes (${smartLaneApplyCount})` }}</span>
          </button>
          <span v-if="smartLaneError" class="day-plan-error">{{ smartLaneError }}</span>
        </div>
        <div v-for="(group, gi) in cardGroups.groups" :key="'g' + gi" class="card-group">
          <div v-if="group.name" class="card-group-name" dir="auto">
            {{ group.name }}
          </div>
          <button
            v-for="task in group.tasks"
            :key="task.id"
            class="task-list-item grouped-card"
            :class="{ 'task-completed': completedTaskIds.has(task.id) }"
            @click="openQuickEdit(task, $event)"
          >
            <span class="task-priority-dot" :style="{ background: priorityColor(task.priority) }" />
            <div class="grouped-card-body">
              <span class="task-title" :dir="direction || 'auto'">{{ task.title || '(untitled)' }}</span>
              <span v-if="task.reason" class="grouped-card-reason" dir="auto">{{ task.reason }}</span>
              <div class="task-meta-row">
                <span v-if="task.daysOverdue" class="task-overdue-badge">{{ task.daysOverdue }}d overdue</span>
                <span v-else-if="task.dueDate" class="task-due-date">{{ formatRelativeDate(task.dueDate) }}</span>
                <span v-if="task.status" class="task-status-badge" :class="'status-' + task.status">{{ task.status }}</span>
              </div>
            </div>
            <div class="task-inline-actions" @click.stop>
              <button
                v-if="!completedTaskIds.has(task.id)"
                class="inline-action-btn inline-done-btn"
                :class="{ loading: actionLoading[task.id] === 'done' }"
                title="Mark done"
                @click="markTaskDone(task.id, $event)"
              >
                <Loader2 v-if="actionLoading[task.id] === 'done'" :size="12" class="spin" />
                <CheckCircle2 v-else :size="12" />
              </button>
              <button
                v-if="!timerStartedTaskIds.has(task.id)"
                class="inline-action-btn inline-timer-btn"
                :class="{ loading: actionLoading[task.id] === 'timer' }"
                title="Start timer"
                @click="startTaskTimer(task.id, $event)"
              >
                <Loader2 v-if="actionLoading[task.id] === 'timer'" :size="12" class="spin" />
                <Play v-else :size="12" />
              </button>
              <span v-if="completedTaskIds.has(task.id)" class="inline-action-done-badge"><CheckCircle2 :size="12" /> Done</span>
              <span v-if="timerStartedTaskIds.has(task.id)" class="inline-action-timer-badge"><Play :size="12" /> Timer</span>
            </div>
          </button>
          <div
            v-for="(newTask, ni) in group.newTasks ?? []"
            :key="'new-' + gi + '-' + ni"
            class="task-list-item grouped-card grouped-card-new"
          >
            <span class="task-priority-dot" :style="{ background: priorityColor(newTask.priority) }" />
            <div class="grouped-card-body">
              <span class="task-title" dir="auto">{{ newTask.title }}</span>
              <span v-if="newTask.reason" class="grouped-card-reason" dir="auto">{{ newTask.reason }}</span>
              <div class="task-meta-row">
                <span class="task-status-badge status-todo">new task</span>
                <span v-if="newTask.priority" class="task-status-badge">{{ newTask.priority }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tool Results — render as soon as a tool executes (TASK-1814), even while
           the model's text answer is still streaming. With slow subscription CLI
           brains (~8-19s) this shows the interactive cards in ~1s instead of making
           the user wait for the full response. -->
      <div v-if="toolResults.length > 0 && !cardGroups" class="tool-results">
        <template v-for="(result, idx) in toolResults" :key="idx">
          <!-- Daily summary stats card -->
          <div v-if="isDailySummaryResult(result)" class="tool-result-card">
            <div class="tool-result-header tool-read">
              <component :is="toolIcon(result.type)" :size="14" class="tool-result-icon" />
              <span class="tool-result-title" dir="auto">{{ result.message }}</span>
            </div>
            <div class="summary-stats-grid">
              <div class="summary-stat">
                <span class="summary-stat-value">{{ result.data.totalTasks }}</span>
                <span class="summary-stat-label">Total</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value">{{ result.data.inProgress }}</span>
                <span class="summary-stat-label">In Progress</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value summary-stat-success">{{ result.data.completedToday }}</span>
                <span class="summary-stat-label">Done Today</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value">{{ result.data.dueToday }}</span>
                <span class="summary-stat-label">Due Today</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value" :class="{ 'summary-stat-danger': (result.data?.overdueCount ?? 0) > 0 }">{{ result.data?.overdueCount }}</span>
                <span class="summary-stat-label">Overdue</span>
              </div>
              <div class="summary-stat">
                <span class="summary-stat-value">{{ result.data.timerSessionsCompleted }}</span>
                <span class="summary-stat-label">Pomodoros</span>
              </div>
            </div>
            <!-- Overdue task list if any -->
            <div v-if="(result.data?.overdueTasks?.length ?? 0) > 0" class="task-list">
              <div class="summary-section-label">
                Overdue Tasks
                <span class="section-count">({{ result.data?.overdueTasks?.length }})</span>
              </div>
              <button
                v-for="task in visibleTasks(result.data?.overdueTasks ?? [], 'overdue-' + result.tool)"
                :key="task.id"
                class="task-list-item"
                :class="{ 'task-completed': completedTaskIds.has(task.id) }"
                @click="openQuickEdit(task, $event)"
              >
                <span
                  class="task-priority-dot"
                  :style="{ background: 'var(--color-priority-high)' }"
                />
                <span class="task-title" :dir="direction || 'auto'">{{ task.title || '(untitled)' }}</span>
                <div class="task-meta-row">
                  <span v-if="task.dueDate" class="task-due-date">{{ formatRelativeDate(task.dueDate) }}</span>
                </div>
                <div class="task-inline-actions" @click.stop>
                  <button
                    v-if="!completedTaskIds.has(task.id)"
                    class="inline-action-btn inline-done-btn"
                    :class="{ loading: actionLoading[task.id] === 'done' }"
                    title="Mark done"
                    @click="markTaskDone(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'done'" :size="12" class="spin" />
                    <CheckCircle2 v-else :size="12" />
                  </button>
                  <button
                    v-if="!timerStartedTaskIds.has(task.id)"
                    class="inline-action-btn inline-timer-btn"
                    :class="{ loading: actionLoading[task.id] === 'timer' }"
                    title="Start timer"
                    @click="startTaskTimer(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'timer'" :size="12" class="spin" />
                    <Play v-else :size="12" />
                  </button>
                  <span v-if="completedTaskIds.has(task.id)" class="inline-action-done-badge">
                    <CheckCircle2 :size="12" /> Done
                  </span>
                  <span v-if="timerStartedTaskIds.has(task.id)" class="inline-action-timer-badge">
                    <Play :size="12" /> Timer started
                  </span>
                </div>
              </button>
              <button
                v-if="(result.data?.overdueTasks?.length ?? 0) > MAX_VISIBLE_TASKS"
                class="show-more-btn"
                @click="toggleSection('overdue-' + result.tool)"
              >
                {{ expandedSections.has('overdue-' + result.tool)
                  ? 'Show less'
                  : `Show all ${result.data?.overdueTasks?.length} overdue tasks` }}
              </button>
            </div>
            <!-- Due today task list if any -->
            <div v-if="(result.data?.dueTodayTasks?.length ?? 0) > 0" class="task-list">
              <div class="summary-section-label">
                Due Today
                <span class="section-count">({{ result.data?.dueTodayTasks?.length }})</span>
              </div>
              <button
                v-for="task in visibleTasks(result.data?.dueTodayTasks ?? [], 'duetoday-' + result.tool)"
                :key="task.id"
                class="task-list-item"
                :class="{ 'task-completed': completedTaskIds.has(task.id) }"
                @click="openQuickEdit(task, $event)"
              >
                <span
                  class="task-priority-dot"
                  :style="{ background: priorityColor(task.priority) }"
                />
                <span class="task-title" :dir="direction || 'auto'">{{ task.title || '(untitled)' }}</span>
                <div class="task-meta-row">
                  <span
                    v-if="task.status"
                    class="task-status-badge"
                    :class="'status-' + task.status"
                  >{{ task.status }}</span>
                </div>
                <div class="task-inline-actions" @click.stop>
                  <button
                    v-if="!completedTaskIds.has(task.id)"
                    class="inline-action-btn inline-done-btn"
                    :class="{ loading: actionLoading[task.id] === 'done' }"
                    title="Mark done"
                    @click="markTaskDone(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'done'" :size="12" class="spin" />
                    <CheckCircle2 v-else :size="12" />
                  </button>
                  <button
                    v-if="!timerStartedTaskIds.has(task.id)"
                    class="inline-action-btn inline-timer-btn"
                    :class="{ loading: actionLoading[task.id] === 'timer' }"
                    title="Start timer"
                    @click="startTaskTimer(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'timer'" :size="12" class="spin" />
                    <Play v-else :size="12" />
                  </button>
                  <span v-if="completedTaskIds.has(task.id)" class="inline-action-done-badge">
                    <CheckCircle2 :size="12" /> Done
                  </span>
                  <span v-if="timerStartedTaskIds.has(task.id)" class="inline-action-timer-badge">
                    <Play :size="12" /> Timer started
                  </span>
                </div>
              </button>
              <button
                v-if="(result.data?.dueTodayTasks?.length ?? 0) > MAX_VISIBLE_TASKS"
                class="show-more-btn"
                @click="toggleSection('duetoday-' + result.tool)"
              >
                {{ expandedSections.has('duetoday-' + result.tool)
                  ? 'Show less'
                  : `Show all ${result.data?.dueTodayTasks?.length ?? 0} tasks` }}
              </button>
            </div>
          </div>
          <!-- Rich task list for read tools that return tasks -->
          <div v-else-if="isTaskListResult(result)" class="tool-result-card">
            <div class="tool-result-header" :class="'tool-' + (result.type || 'read')">
              <component :is="toolIcon(result.type)" :size="14" class="tool-result-icon" />
              <span class="tool-result-title" dir="auto">{{ result.message }}</span>
              <span v-if="getTasksFromResult(result).length > MAX_VISIBLE_TASKS" class="section-count">({{ getTasksFromResult(result).length }})</span>
            </div>
            <div class="task-list">
              <button
                v-for="task in visibleTasks(getTasksFromResult(result), 'tasklist-' + result.tool)"
                :key="task.id"
                class="task-list-item"
                :class="{ 'task-completed': completedTaskIds.has(task.id) }"
                @click="openQuickEdit(task, $event)"
              >
                <span
                  class="task-priority-dot"
                  :style="{ background: priorityColor(task.priority) }"
                />
                <span class="task-title" :dir="direction || 'auto'">{{ task.title || '(untitled)' }}</span>
                <div class="task-meta-row">
                  <span v-if="task.daysOverdue" class="task-overdue-badge">{{ task.daysOverdue }}d overdue</span>
                  <span
                    v-else-if="task.dueDate"
                    class="task-due-date"
                  >{{ formatRelativeDate(task.dueDate) }}</span>
                  <span
                    v-if="task.status"
                    class="task-status-badge"
                    :class="'status-' + task.status"
                  >{{ task.status }}</span>
                </div>
                <div class="task-inline-actions" @click.stop>
                  <button
                    v-if="!completedTaskIds.has(task.id)"
                    class="inline-action-btn inline-done-btn"
                    :class="{ loading: actionLoading[task.id] === 'done' }"
                    title="Mark done"
                    @click="markTaskDone(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'done'" :size="12" class="spin" />
                    <CheckCircle2 v-else :size="12" />
                  </button>
                  <button
                    v-if="!timerStartedTaskIds.has(task.id)"
                    class="inline-action-btn inline-timer-btn"
                    :class="{ loading: actionLoading[task.id] === 'timer' }"
                    title="Start timer"
                    @click="startTaskTimer(task.id, $event)"
                  >
                    <Loader2 v-if="actionLoading[task.id] === 'timer'" :size="12" class="spin" />
                    <Play v-else :size="12" />
                  </button>
                  <span v-if="completedTaskIds.has(task.id)" class="inline-action-done-badge">
                    <CheckCircle2 :size="12" /> Done
                  </span>
                  <span v-if="timerStartedTaskIds.has(task.id)" class="inline-action-timer-badge">
                    <Play :size="12" /> Timer started
                  </span>
                </div>
              </button>
              <button
                v-if="getTasksFromResult(result).length > MAX_VISIBLE_TASKS"
                class="show-more-btn"
                @click="toggleSection('tasklist-' + result.tool)"
              >
                {{ expandedSections.has('tasklist-' + result.tool)
                  ? 'Show less'
                  : `Show all ${getTasksFromResult(result).length} tasks` }}
              </button>
            </div>
          </div>
          <!-- Simple chip for write/destructive results or results without task data -->
          <div v-else class="tool-result-chip" :class="'tool-' + (result.type || 'read')">
            <component :is="toolIcon(result.type)" :size="12" class="tool-result-icon" />
            <span dir="auto">{{ result.message }}</span>
          </div>
        </template>
      </div>

      <!-- Error -->
      <div v-if="hasError" class="message-error-text">
        {{ message.error }}
      </div>

      <!-- Actions -->
      <div v-if="hasActions && !isStreaming" class="message-actions">
        <button
          v-for="action in message.actions"
          :key="action.id"
          class="action-btn"
          :class="{
            'action-primary': action.variant === 'primary',
            'action-secondary': action.variant === 'secondary',
            'action-danger': action.variant === 'danger',
            'action-completed': action.completed
          }"
          :disabled="isActionLoading(action) || action.completed"
          @click="handleAction(action)"
        >
          <Loader2
            v-if="isActionLoading(action)"
            class="action-icon spin"
            :size="14"
          />
          <Check
            v-else-if="action.completed"
            class="action-icon"
            :size="14"
          />
          <span>{{ action.label }}</span>
        </button>
      </div>

      <!-- Metadata -->
      <div v-if="message.metadata && !isStreaming" class="message-meta">
        <span v-if="message.metadata.model">{{ message.metadata.model }}</span>
        <span v-if="message.metadata.latencyMs">{{ message.metadata.latencyMs }}ms</span>
      </div>
    </div>

    <!-- Copy Button (hover overlay) -->
    <button
      v-if="!isStreaming && message.content"
      class="copy-btn"
      :class="{ 'copy-success': copied }"
      :title="copied ? 'Copied!' : 'Copy message'"
      @click="copyMessage"
    >
      <CheckCheck v-if="copied" :size="14" />
      <Copy v-else :size="14" />
    </button>

    <!-- Task Quick-Edit Popover -->
    <TaskQuickEditPopover
      :is-visible="!!quickEditTask"
      :task="quickEditTask"
      :x="quickEditPos.x"
      :y="quickEditPos.y"
      :position="quickEditPosition"
      @close="closeQuickEdit"
      @open-full-editor="openFullEditor"
    />
  </div>
</template>

<style scoped>
/* ============================================================================
   Message Container
   ============================================================================ */

.chat-message {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  padding-inline-end: calc(var(--space-3) + 36px); /* Reserve space for copy button */
  border-radius: var(--radius-lg);
  animation: fadeIn 0.2s ease;
  position: relative;
}

.chat-message:hover .copy-btn {
  opacity: 1;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(var(--space-1));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ============================================================================
   User Message
   ============================================================================ */

.message-user {
  background: var(--purple-bg-subtle);
  margin-inline-start: var(--space-4);
}

.message-user .message-avatar {
  background: var(--color-focus);
  color: white;
}

/* ============================================================================
   Assistant Message
   ============================================================================ */

.message-assistant {
  background: var(--glass-bg-weak);
  margin-inline-end: var(--space-4);
}

.message-assistant .message-avatar {
  background: linear-gradient(135deg, var(--color-focus), var(--color-info));
  color: white;
}

/* ============================================================================
   Avatar
   ============================================================================ */

.message-avatar {
  width: var(--space-7);
  height: var(--space-7);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ============================================================================
   Content
   ============================================================================ */

.message-content {
  flex: 1;
  min-width: 0;
}

.message-text {
  color: var(--text-primary);
  font-size: var(--text-sm);
  line-height: 1.6;
  word-break: break-word;
  unicode-bidi: plaintext;
}

/* ============================================================================
   Copy Button
   ============================================================================ */

.copy-btn {
  position: absolute;
  top: var(--space-2);
  inset-inline-end: var(--space-2);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-7);
  height: var(--space-7);
  border: none;
  background: var(--border-subtle);
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.copy-btn:hover {
  background: var(--border-medium);
  color: var(--text-primary);
}

.copy-btn.copy-success {
  opacity: 1;
  color: var(--color-success);
}

/* ============================================================================
   Thinking Indicator
   ============================================================================ */

.thinking-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
}

.thinking-dots {
  display: flex;
  gap: var(--space-1);
}

.thinking-label {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  font-weight: var(--font-medium);
  letter-spacing: 0.01em;
}

.thinking-dot {
  width: var(--space-1_5);
  height: var(--space-1_5);
  border-radius: 50%;
  background: var(--color-focus);
  animation: thinking 1.4s ease-in-out infinite;
}

.thinking-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes thinking {
  0%, 80%, 100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

/* ============================================================================
   Streaming Cursor
   ============================================================================ */

.cursor-blink {
  animation: blink 1s step-end infinite;
  color: var(--color-focus);
  font-weight: bold;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.message-streaming {
  border: 1px solid var(--color-focus);
  border-style: dashed;
}

/* ============================================================================
   Markdown Styles
   ============================================================================ */

.markdown-body :deep(p) {
  margin: 0 0 var(--space-2);
  unicode-bidi: plaintext;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
  margin: var(--space-3) 0 var(--space-2);
}

.markdown-body :deep(h1) { font-size: 1.25em; }
.markdown-body :deep(h2) { font-size: 1.15em; }
.markdown-body :deep(h3) { font-size: 1.05em; }
.markdown-body :deep(h4) { font-size: 1em; }

.markdown-body :deep(h1:first-child),
.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child),
.markdown-body :deep(h4:first-child) {
  margin-top: 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-inline-start: var(--space-4);
  margin: 0 0 var(--space-2);
}

.markdown-body :deep(li) {
  margin-bottom: var(--space-1);
  unicode-bidi: plaintext;
}

.markdown-body :deep(li:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(code) {
  background: var(--overlay-bg);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.9em;
  color: var(--color-focus);
}

.markdown-body :deep(pre) {
  background: var(--overlay-dark);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin: var(--space-2) 0;
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  color: var(--text-primary);
  font-size: var(--text-meta);
  line-height: 1.5;
}

.markdown-body :deep(blockquote) {
  border-inline-start: 3px solid var(--color-focus);
  padding-inline-start: var(--space-3);
  margin: var(--space-2) 0;
  color: var(--text-secondary);
  font-style: italic;
  unicode-bidi: plaintext;
}

.markdown-body :deep(a) {
  color: var(--color-focus);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(strong) {
  color: var(--text-primary);
  font-weight: var(--font-semibold);
}

.markdown-body :deep(em) {
  color: var(--text-secondary);
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-subtle);
  margin: var(--space-3) 0;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: var(--space-2) 0;
  font-size: var(--text-meta);
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--border-subtle);
  padding: var(--space-1) var(--space-2);
  text-align: inherit;
}

.markdown-body :deep(th) {
  background: var(--overlay-dark);
  font-weight: var(--font-semibold);
}

/* ============================================================================
   Tool Result Chips
   ============================================================================ */

.tool-results {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.tool-result-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.tool-read {
  background: var(--blue-bg-light);
  color: var(--status-planned-text);
}

.tool-write {
  background: var(--success-bg-light);
  color: var(--color-success-500);
}

.tool-destructive {
  background: var(--danger-bg-light);
  color: var(--color-priority-high);
}

.tool-result-icon {
  flex-shrink: 0;
}

/* ============================================================================
   Rich Tool Result Cards (task lists)
   ============================================================================ */

.tool-result-card {
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  overflow: visible;
  margin-top: var(--space-2);
}

.tool-result-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.tool-result-header.tool-read {
  background: var(--blue-bg-subtle);
  color: var(--status-planned-text);
}

.tool-result-header.tool-write {
  background: var(--success-bg-light);
  color: var(--color-success-500);
}

.tool-result-header.tool-destructive {
  background: var(--danger-bg-light);
  color: var(--color-priority-high);
}

.tool-result-title {
  flex: 1;
  min-width: 0;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
}

/* TASK-1814: grouped prioritization cards */
.card-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-2);
}
.day-plan-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.day-plan-apply-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1_5);
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  background: var(--brand-primary);
  color: white;
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
}
.day-plan-apply-btn:hover:not(:disabled) {
  filter: brightness(1.05);
}
.day-plan-apply-btn:disabled {
  cursor: default;
  opacity: 0.8;
}
.day-plan-apply-btn.applied {
  background: var(--color-success);
  border-color: var(--color-success);
}
.day-plan-error {
  font-size: var(--text-xs);
  color: var(--color-danger);
}
.card-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
}
.card-group-name {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
  padding: 0 var(--space-1);
}
.grouped-card {
  display: flex !important;
  align-items: flex-start;
  gap: var(--space-2);
}
.grouped-card-new {
  border-style: dashed;
  background: var(--glass-bg-soft);
  cursor: default;
}
.grouped-card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}
.grouped-card-reason {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: 1.45;
}

.task-list-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto auto;
  gap: var(--space-0_5) var(--space-2);
  align-items: center;
  padding: var(--space-2_5) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
  font-size: var(--text-sm);
  text-align: start;
  cursor: pointer;
  transition: all 0.12s ease;
  width: 100%;
  position: relative;
}

.task-list-item:hover {
  background: var(--glass-bg-light);
  border-color: var(--glass-border);
}

.task-priority-dot {
  grid-row: 1;
  grid-column: 1;
  width: var(--space-2_5);
  height: var(--space-2_5);
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: var(--space-1);
  cursor: pointer;
  /* Bigger click target via padding + negative margin */
  padding: var(--space-1);
  background-clip: content-box;
}

.task-meta-row {
  grid-row: 2;
  grid-column: 2 / -1;
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  align-items: center;
}

.task-title {
  grid-row: 1;
  grid-column: 2;
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
  text-align: start;
  unicode-bidi: plaintext;
  font-weight: var(--font-medium);
  line-height: 1.4;
}

.task-overdue-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--color-priority-high);
  background: var(--danger-bg-light);
  padding: 1px var(--space-1_5);
  border-radius: var(--radius-full);
  flex-shrink: 0;
  cursor: pointer;
}

.task-due-date {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.task-status-badge {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-planned { background: var(--purple-bg-subtle); color: var(--status-planned-text); }
.status-in_progress { background: var(--blue-bg-light); color: var(--status-in-progress-text); }
.status-done { background: var(--success-bg-light); color: var(--status-done-text); }
.status-backlog { background: var(--glass-bg-light); color: var(--text-muted); }

/* ============================================================================
   Daily Summary Stats Grid
   ============================================================================ */

.summary-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--glass-border-faint);
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-0_5);
  padding: var(--space-2) var(--space-1);
  background: var(--overlay-component-bg);
}

.summary-stat-value {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  line-height: 1;
}

.summary-stat-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.summary-stat-success {
  color: var(--color-success-500);
}

.summary-stat-danger {
  color: var(--color-priority-high);
}

.summary-section-label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3) var(--space-1);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-top: 1px solid var(--glass-border-faint);
}

.section-count {
  font-weight: var(--font-medium);
  color: var(--text-muted);
  text-transform: none;
  letter-spacing: normal;
}

.show-more-btn {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: transparent;
  color: var(--accent-primary, #8b5cf6);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  text-align: center;
  border-top: 1px solid var(--glass-border-faint);
  transition: background var(--duration-fast) ease;
}

.show-more-btn:hover {
  background: var(--purple-bg-subtle);
}

/* ============================================================================
   Error
   ============================================================================ */

.message-error {
  border: 1px solid var(--color-danger);
}

.message-error-text {
  color: var(--color-danger);
  font-size: var(--text-xs);
  margin-top: var(--space-2);
}

/* ============================================================================
   Actions
   ============================================================================ */

.message-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-meta);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.action-primary {
  background: var(--color-focus);
  color: white;
}

.action-primary:hover:not(:disabled) {
  background: var(--brand-hover);
}

.action-secondary {
  background: transparent;
  border-color: var(--border-medium);
  color: var(--text-primary);
}

.action-secondary:hover:not(:disabled) {
  background: var(--border-subtle);
}

.action-danger {
  background: transparent;
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.action-danger:hover:not(:disabled) {
  background: var(--danger-bg-light);
}

.action-completed {
  background: var(--success-bg-light);
  border-color: var(--color-success);
  color: var(--color-success);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-icon {
  flex-shrink: 0;
}

/* ============================================================================
   Metadata
   ============================================================================ */

.message-meta {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

/* ============================================================================
   Animations
   ============================================================================ */

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ============================================================================
   Inline Task Actions (hover)
   ============================================================================ */

.task-inline-actions {
  grid-row: 1;
  grid-column: 3;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.task-list-item:hover .task-inline-actions {
  opacity: 1;
}

.inline-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--glass-border-faint);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.inline-done-btn {
  background: var(--success-bg-light);
  color: var(--color-success);
}

.inline-done-btn:hover {
  background: var(--color-success);
  color: white;
}

.inline-timer-btn {
  background: var(--blue-bg-light);
  color: var(--status-in-progress-text);
}

.inline-timer-btn:hover {
  background: var(--status-in-progress-text);
  color: white;
}

.inline-action-btn.loading {
  opacity: 0.6;
  pointer-events: none;
}

.inline-action-done-badge,
.inline-action-timer-badge {
  display: flex;
  align-items: center;
  gap: var(--space-0_5);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 2px var(--space-1_5);
  border-radius: var(--radius-sm);
}

.inline-action-done-badge {
  background: var(--success-bg-light);
  color: var(--color-success);
}

.inline-action-timer-badge {
  background: var(--blue-bg-light);
  color: var(--status-in-progress-text);
}

.task-list-item.task-completed .task-title {
  text-decoration: line-through;
  opacity: 0.6;
}

/* ============================================================================
   Schedule Onboarding Card
   ============================================================================ */

.schedule-onboarding-card {
  margin-top: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  backdrop-filter: blur(8px);
}

.schedule-question-text {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.day-select-grid {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
  margin-bottom: var(--space-2);
}

.day-select-btn {
  padding: var(--space-1_5) var(--space-2_5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-light);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.15s ease;
  min-width: 48px;
  text-align: center;
}

.day-select-btn:hover {
  border-color: var(--brand-primary);
  color: var(--text-primary);
}

.day-select-btn.day-selected {
  background: rgba(45, 212, 191, 0.15);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  box-shadow: 0 0 12px rgba(45, 212, 191, 0.25);
}

.schedule-save-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1_5) var(--space-3);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all 0.15s ease;
}

.schedule-save-btn:hover:not(:disabled) {
  background: rgba(45, 212, 191, 0.12);
  color: var(--brand-primary);
}

.schedule-save-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.schedule-answered-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--success-bg-light);
  color: var(--color-success-500);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.schedule-check-icon {
  flex-shrink: 0;
}
</style>
