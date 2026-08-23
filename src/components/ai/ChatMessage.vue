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

import { computed, onMounted, ref, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { User, Sparkles, Loader2, Check, Copy, CheckCheck, Zap, PenLine, Trash2, Play, CheckCircle2, ListOrdered, X, CalendarClock, Plus, Maximize2 } from 'lucide-vue-next'
import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import type Renderer from 'markdown-it/lib/renderer.mjs'
import type { Options as MarkdownItOptions } from 'markdown-it'
import { useAIChatStore, type ChatMessage, type ChatAction } from '@/stores/aiChat'
import { formatRelativeDate } from '@/utils/dateUtils'
import TaskQuickEditPopover from './TaskQuickEditPopover.vue'
import { executeTool } from '@/services/ai/tools'
import { sanitizeMarkdownHtml } from '@/utils/security'
import { detectLanguage } from '@/services/ai/pipeline/languageDetector'
import { useWorkProfile } from '@/composables/useWorkProfile'
import { useCanvasStore } from '@/stores/canvas'
import { useLaneStore } from '@/stores/lanes'
import { useAuthStore } from '@/stores/auth'
import { buildDayPlanTaskUpdates } from '@/services/ai/pipeline/dayPlan'
import type { WeeklyPlanOutput, WeeklyPlanRecommendation } from '@/services/ai/pipeline/weeklyPlan'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import type { AIClarificationArtifact, AIClarificationQuestion, AIContextEntityType, AIMemoryPatch, AIRecommendationFeedbackInput, AIUncertaintyDimension } from '@/types/aiMemory'
import { resumeLocalClarificationRuntime } from '@/services/ai/runtime/localClarificationRuntimeClient'
import { decideAITaskCreate } from '@/services/ai/actionGuardrails'
import * as aiActionCommands from '@/services/ai/actionCommands'
import type { AICommand, AICommandMemoryStore } from '@/services/ai/actionCommands'

// ============================================================================
// Props
// ============================================================================

const props = defineProps<{
  message: ChatMessage
  direction?: 'auto' | 'ltr' | 'rtl'
  wideMode?: boolean
}>()

const emit = defineEmits<{
  'selectTask': [taskId: string]
  'continueChat': [message: string]
  'requestWide': []
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
const weeklyQuestionAnswers = ref<Record<string, string>>({})
const weeklyQuestionFreeText = ref<Record<string, string>>({})
const weeklyQuestionApplying = ref<Record<string, boolean>>({})
const weeklyQuestionApplied = ref<Record<string, string>>({})
const weeklyFollowUpDuplicates = ref<Record<string, {
  existingTaskId: string
  existingTitle: string
  title: string
  question: WeeklyPlanOutput['openQuestions'][number]
  selectedOption?: NonNullable<WeeklyPlanOutput['openQuestions'][number]['options']>[number]
  note: string
}>>({})
const clarificationAnswers = ref<Record<string, string>>({})
const clarificationFreeText = ref<Record<string, string>>({})
const clarificationApplying = ref(false)
const clarificationStatus = ref('')
const clarificationSavedLocal = ref<Record<string, boolean>>({})
const clarificationResolvedLocal = ref<Record<string, boolean>>({})
const clarificationFollowUpAnswers = ref<Record<string, string>>({})
const clarificationFollowUpFreeText = ref<Record<string, string>>({})
const clarificationFollowUpSavedLocal = ref<Record<string, boolean>>({})
const clarificationFollowUpStepIndex = ref<Record<string, number>>({})
const clarificationInlineMode = ref<Record<string, 'uncertainty' | 'candidates'>>({})
const recommendationFeedbackLoading = ref<Record<string, string>>({})
const recommendationFeedbackStatus = ref<Record<string, string>>({})
const inlineFeedbackStatus = ref('')
const recommendationFeedbackChoiceOpen = ref<Record<string, AIRecommendationFeedbackInput['action'] | ''>>({})
const recommendationFeedbackReasons = ref<Record<string, AIRecommendationFeedbackInput['reasonCategory']>>({})
const recommendationFeedbackRevisit = ref<Record<string, 'tomorrow' | 'next_week' | 'later' | 'none'>>({})

// Track which tasks have been actioned (for visual feedback)
const completedTaskIds = ref<Set<string>>(new Set())
const timerStartedTaskIds = ref<Set<string>>(new Set())
const dismissedCardTaskIds = ref<Set<string>>(new Set())
const suppressedRecommendationIds = ref<Record<string, boolean>>({})
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
const projectStore = useProjectStore()
const aiChatStore = useAIChatStore()
const canvasStore = useCanvasStore()
const laneStore = useLaneStore()
const aiMemoryDb = useSupabaseDatabase()
const authStore = useAuthStore()

function pendingAIMemoryWriteCount(): number {
  return typeof aiMemoryDb.getPendingAIMemoryWriteCount === 'function'
    ? aiMemoryDb.getPendingAIMemoryWriteCount()
    : 0
}

async function applyAIMemoryPatchCommand(
  patch: AIMemoryPatch,
  sourcePrompt: string,
) {
  const commandId = `memory-patch:${patch.entityType}:${patch.entityId}:${patch.field}:${patch.operation}`
  const batch = aiActionCommands.buildAICommandBatchPreview({
    sourcePrompt,
    sourceRunId: props.message.id,
    sourceMessageId: props.message.id,
    dataUsed: {
      messageId: props.message.id,
      entityType: patch.entityType,
      entityId: patch.entityId,
      field: patch.field,
      operation: patch.operation,
    },
    commands: [{
      id: commandId,
      kind: 'memory.patch',
      patch,
      confidence: patch.confidence,
      impact: 'low',
    }],
    tasks: taskStore.tasks,
  })
  await aiActionCommands.applyAICommandBatch(batch, {
    selectedCommandIds: [commandId],
    taskStore,
    memoryStore: aiMemoryDb as AICommandMemoryStore,
  })
}

function clarificationPersistedStatus(locale: 'he' | 'en'): string {
  const pending = pendingAIMemoryWriteCount()
  if (pending > 0) {
    return locale === 'he'
      ? `נשמר מקומית. ${pending} עדכוני זיכרון ממתינים לסנכרון.`
      : `Saved locally. ${pending} memory update${pending === 1 ? '' : 's'} queued for sync.`
  }
  if (!authStore.user?.id) {
    return locale === 'he'
      ? 'נשמר מקומית במכשיר הזה. התחברות נדרשת לזיכרון בין מכשירים.'
      : 'Saved locally on this device. Sign in for cross-device memory.'
  }
  return locale === 'he' ? 'נשמר. ממשיך עם ההקשר הזה.' : 'Saved. Continuing with this context.'
}

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
  priority?: string | null
  dueDate?: string | null
  estimatedDuration?: number | null
  reason?: string
  daysOverdue?: number
  [key: string]: unknown
}

function currentDaysOverdue(dueDate?: string | null, status?: string): number | undefined {
  if (!dueDate || status === 'done' || status === 'completed') return undefined

  const due = dueDate.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  if (due >= today) return undefined

  const dueMs = new Date(`${due}T00:00:00`).getTime()
  const todayMs = new Date(`${today}T00:00:00`).getTime()
  const days = Math.floor((todayMs - dueMs) / 86_400_000)
  return days > 0 ? days : undefined
}

function dateKey(date?: string | null): string {
  return date ? date.slice(0, 10) : ''
}

function isLaterDate(currentDate?: string | null, snapshotDate?: string | null): boolean {
  const current = dateKey(currentDate)
  const snapshot = dateKey(snapshotDate)
  return !!current && !!snapshot && current > snapshot
}

function wasPostponedOutOfPlan(task: TaskListItem): boolean {
  const current = dateKey(task.dueDate as string | null | undefined)
  const snapshot = dateKey(task.__snapshotDueDate as string | null | undefined)
  const today = new Date().toISOString().slice(0, 10)

  return Boolean(task.__liveDueDateChanged && snapshot <= today && current > today)
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
  const status = storeTask.status ?? snapshotTask.status
  const dueDate = storeTask.dueDate ?? null
  const snapshotDueDate = snapshotTask.dueDate ?? null
  return {
    ...snapshotTask,
    title: storeTask.title ?? snapshotTask.title,
    status,
    priority: storeTask.priority ?? snapshotTask.priority,
    dueDate,
    estimatedDuration: storeTask.estimatedDuration ?? snapshotTask.estimatedDuration,
    daysOverdue: currentDaysOverdue(dueDate, status),
    __snapshotDueDate: snapshotDueDate,
    __liveDueDateChanged: isLaterDate(dueDate, snapshotDueDate),
  }
}

/** Apply liveTask() to an array of snapshot tasks */
function liveTasks(tasks: TaskListItem[]): TaskListItem[] {
  if (!Array.isArray(tasks)) return []
  return tasks.map(t => liveTask(t))
}

const weeklyPlan = computed(() => {
  const meta = props.message.metadata as Record<string, unknown> | undefined
  const plan = meta?.weeklyPlan as WeeklyPlanOutput | undefined
  return plan?.schemaVersion === 'weekly-plan.v2' ? plan : null
})

function isObsoleteWeeklyQuestion(question: WeeklyPlanOutput['openQuestions'][number]): boolean {
  const text = `${question.id || ''} ${question.reason || ''} ${question.question || ''}`.toLowerCase()
  return question.reason === 'follow_up_task_suggestion' ||
    text.includes('followup_') ||
    text.includes('add a follow-up task after') ||
    text.includes('להוסיף משימת המשך אחרי')
}

const visibleWeeklyQuestions = computed(() => {
  const questions = weeklyPlan.value?.openQuestions ?? []
  if (!questions.length) return []
  const visible = questions.filter(question =>
    !isObsoleteWeeklyQuestion(question) &&
    (!showWeeklyQuestionStatus(question) || Boolean(weeklyFollowUpDuplicates.value[weeklyQuestionKey(question)]))
  )
  const removed = questions.length - visible.length
  if (removed > 0) {
    console.info('[AIChat:WeeklyQuestionRender]', {
      stage: 'obsolete_questions_suppressed',
      messageId: props.message.id,
      rawOpenQuestionsCount: questions.length,
      visibleOpenQuestionsCount: visible.length,
      removedCount: removed,
      removedQuestionIds: questions
        .filter(question => isObsoleteWeeklyQuestion(question) || showWeeklyQuestionStatus(question))
        .map(question => question.id || question.question),
      reason: 'obsolete_or_answered_question',
    })
  }
  return visible
})

const hasVisibleWeeklyPlanContent = computed(() =>
  Boolean(
    weeklyPlan.value &&
    (
      visibleWeeklyQuestions.value.length > 0 ||
      weeklyPlan.value.recommendations.length > 0 ||
      weeklyPlan.value.deferrals.length > 0
    ),
  )
)

const isCompactWeeklyPlan = computed(() =>
  weeklyPlan.value?.presentation?.density === 'compact_after_clarification'
)

const showWeeklyLaneBoard = computed(() =>
  Boolean(weeklyPlan.value?.recommendations.length && (isCompactWeeklyPlan.value || props.wideMode))
)

function weeklyPlanSourceLabel(): string {
  const locale = weeklyPlan.value?.locale ?? 'en'
  if (isCompactWeeklyPlan.value) {
    return locale === 'he' ? 'תשובה קצרה מההקשר ששמרת' : 'Compact answer from saved context'
  }
  return hasVisibleWeeklyRecommendations()
    ? (locale === 'he' ? 'תוכנית מקורקעת מנתוני המשימות' : 'Grounded task-evidence plan')
    : (locale === 'he' ? 'ממתין להקשר אמין' : 'Waiting for reliable context')
}

const clarification = computed(() => {
  const meta = props.message.metadata as Record<string, unknown> | undefined
  const card = meta?.clarification as AIClarificationArtifact | undefined
  if (card?.schemaVersion !== 'ai-clarification.v1') return null
  return clarificationResolvedLocal.value[clarificationKey(card)] ? null : card
})

const weeklyPlanSnapshotDueByTaskId = computed(() => {
  const map = new Map<string, string>()
  for (const rec of weeklyPlan.value?.recommendations ?? []) {
    for (const item of rec.evidence ?? []) {
      if (item.field === 'dueIso' && item.taskId && item.value) {
        map.set(item.taskId, item.value)
      }
    }
  }
  return map
})

function weeklyPlanTaskIds(rec: WeeklyPlanRecommendation): string[] {
  return [...new Set([rec.primaryTaskId, ...(rec.relatedTaskIds ?? [])].filter(Boolean))]
    .filter(taskId => !dismissedCardTaskIds.value.has(taskId))
}


function weeklyLaneTitle(rec: WeeklyPlanRecommendation): string {
  const locale = weeklyPlan.value?.locale ?? 'en'
  const focus = rec.focusArea.trim()
  const primaryTitle = taskMap.value.get(rec.primaryTaskId)?.title?.trim()
  const genericWork = /^(work|work delivery|מסירת עבודה)$/i.test(focus)
  const limited = /^(limited-context work|limited task context|הקשר חסר|הקשר מוגבל)$/i.test(focus)
  if (locale === 'he') {
    if (genericWork) return primaryTitle || 'נתיב עבודה ממוקד'
    if (limited) return 'נתיב עם הקשר חסר'
    return focus
  }
  if (genericWork) return primaryTitle || 'Focused work lane'
  if (limited) return 'Limited-context lane'
  return focus
}

function looksLikeOpaqueId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
    /^[0-9a-f]{16,}$/i.test(value)
}

function isGenericWeeklyLaneLabel(value: string): boolean {
  return /^(work|work delivery|my projects|personal|uncategorized|general|inbox|עבודה|מסירת עבודה|פרויקטים|אישי|כללי|ללא פרויקט|עבודה לא מסווגת)$/i.test(value.trim())
}

function weeklyLaneSourceLabel(rec: WeeklyPlanRecommendation): string | null {
  const focus = rec.focusArea.trim()
  const projectId = taskMap.value.get(rec.primaryTaskId)?.projectId
  if (!projectId) return isGenericWeeklyLaneLabel(focus) || looksLikeOpaqueId(focus) ? null : focus
  const projectName = projectStore.getProjectDisplayName(projectId).trim()
  if (!projectName || isGenericWeeklyLaneLabel(projectName) || looksLikeOpaqueId(projectName)) {
    return isGenericWeeklyLaneLabel(focus) || looksLikeOpaqueId(focus) ? null : focus
  }
  return projectName
}

function weeklyLaneSubtitle(rec: WeeklyPlanRecommendation): string {
  const locale = weeklyPlan.value?.locale ?? 'en'
  const count = weeklyPlanTaskIds(rec).length
  const focus = rec.focusArea.trim()
  const isGeneric = /^(work|work delivery|מסירת עבודה)$/i.test(focus)
  const projectLabel = weeklyLaneSourceLabel(rec)
  if (locale === 'he') {
    const source = isGeneric
      ? projectLabel ? `מבוסס על ${projectLabel}` : 'נתיב משימות קשורות'
      : focus
    return `${source} · ${count} משימות מחוברות`
  }
  const source = isGeneric
    ? projectLabel ? `Based on ${projectLabel}` : 'Connected task lane'
    : focus
  return `${source} · ${count} connected tasks`
}

function weeklyPlanRecommendationForTask(taskId: string): WeeklyPlanRecommendation | undefined {
  return weeklyPlan.value?.recommendations.find(rec => rec.primaryTaskId === taskId || rec.relatedTaskIds?.includes(taskId))
}

function isWeeklyRecommendationVisible(rec: WeeklyPlanRecommendation): boolean {
  return !suppressedRecommendationIds.value[rec.sectionId]
}

function hasVisibleWeeklyRecommendations(): boolean {
  return Boolean(weeklyPlan.value?.recommendations.some(isWeeklyRecommendationVisible))
}

function taskSnapshotFromPlan(taskId: string): TaskListItem | null {
  const rec = weeklyPlanRecommendationForTask(taskId)
  if (!rec) return null
  const evidence = rec.evidence ?? []
  const dueDate = evidence.find(item => item.taskId === taskId && item.field === 'dueIso')?.value
  const priority = evidence.find(item => item.taskId === taskId && item.field === 'priority')?.value
  const status = evidence.find(item => item.taskId === taskId && item.field === 'status')?.value
  return liveTask({
    id: taskId,
    title: rec.primaryTaskId === taskId ? rec.title : taskId,
    status: status || 'todo',
    priority: priority || undefined,
    dueDate: dueDate || null,
    reason: weeklyPlan.value?.locale === 'he' ? 'תמונת מצב מהתוכנית' : 'snapshot from plan',
    __planSnapshotOnly: true,
  })
}

function taskCardFromId(taskId: string): TaskListItem | null {
  const task = taskMap.value.get(taskId)
  if (!task) return taskSnapshotFromPlan(taskId)
  return liveTask({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: weeklyPlanSnapshotDueByTaskId.value.get(task.id) ?? task.dueDate,
    estimatedDuration: task.estimatedDuration,
  })
}

function weeklyPlanTaskStaleLabel(task: TaskListItem | null): string {
  if (!task) return weeklyPlan.value?.locale === 'he' ? 'המשימה כבר לא קיימת' : 'task no longer exists'
  if (task.__planSnapshotOnly) return weeklyPlan.value?.locale === 'he' ? 'תמונת מצב מהתוכנית; המשימה לא נטענה לפעולות' : 'snapshot from plan; task is not loaded for actions'
  if (task.status === 'done') return weeklyPlan.value?.locale === 'he' ? 'הושלמה אחרי יצירת התוכנית' : 'completed after this plan was generated'
  if (task.__liveDueDateChanged) return weeklyPlan.value?.locale === 'he' ? 'נדחתה אחרי יצירת התוכנית' : 'rescheduled after this plan was generated'
  return ''
}

function isPlanSnapshotCard(task: TaskListItem | null): boolean {
  return Boolean(task?.__planSnapshotOnly)
}

function weeklyQuestionKey(question: WeeklyPlanOutput['openQuestions'][number]): string {
  return question.id || question.question
}

function weeklyQuestionTask(question: WeeklyPlanOutput['openQuestions'][number]): Task | null {
  const taskId = question.relatedTaskIds?.[0]
  return taskId ? taskMap.value.get(taskId) ?? null : null
}

function weeklyQuestionMemoryIdentity(question: WeeklyPlanOutput['openQuestions'][number], parentTask: Task | null): {
  entityKey: string
  entityType: AIContextEntityType
  displayName: string
} {
  if (question.entityType && question.entityId) {
    return {
      entityKey: `${question.entityType}:${question.entityId}`,
      entityType: question.entityType,
      displayName: question.entityType === 'task'
        ? (parentTask?.title || question.entityId)
        : question.entityId,
    }
  }

  const relatedTaskId = question.relatedTaskIds?.[0]
  if (relatedTaskId) {
    return {
      entityKey: `task:${relatedTaskId}`,
      entityType: 'task',
      displayName: parentTask?.title || relatedTaskId,
    }
  }

  const weekId = weeklyPlan.value?.requestId || props.message.id
  return {
    entityKey: `week:${weekId}`,
    entityType: 'week',
    displayName: weeklyPlan.value?.headline || weekId,
  }
}

function weeklyQuestionUncertaintyDimension(question: WeeklyPlanOutput['openQuestions'][number]): AIUncertaintyDimension[] | undefined {
  if (question.reason === 'missing_project_understanding') return ['project_meaning']
  if (question.reason === 'missing_task_context') return ['task_context']
  if (question.reason === 'stale_project_context') return ['stale_context']
  return undefined
}

async function recordWeeklyQuestionAnswer(
  question: WeeklyPlanOutput['openQuestions'][number],
  parentTask: Task | null,
  option: NonNullable<WeeklyPlanOutput['openQuestions'][number]['options']>[number] | undefined,
  note: string,
  followUpOutcome?: 'created' | 'existing_found' | 'duplicate_created',
): Promise<void> {
  const identity = weeklyQuestionMemoryIdentity(question, parentTask)
  traceWeeklyQuestion('clarification_event_record_started', {
    questionId: weeklyQuestionKey(question),
    entityKey: identity.entityKey,
    selectedOptionId: option?.id ?? null,
  })

  await aiMemoryDb.recordAIClarificationEvent({
    entityKey: identity.entityKey,
    entityType: identity.entityType,
    displayName: identity.displayName,
    questionId: weeklyQuestionKey(question),
    eventType: 'answered',
    question: question.question,
    selectedOptionId: option?.id,
    selectedLabel: option?.label,
    freeText: note,
    memoryPatch: option?.memoryPatch ? { ...option.memoryPatch, sourceMessageId: props.message.id } : undefined,
    sourceMessageId: props.message.id,
    uncertaintyDimensions: weeklyQuestionUncertaintyDimension(question),
    pathType: 'clarify_first',
    contextSnapshot: {
      weeklyPlanRequestId: weeklyPlan.value?.requestId,
      weeklyPlanSource: weeklyPlan.value?.source,
      relatedTaskIds: question.relatedTaskIds,
      reason: question.reason,
      ...(followUpOutcome ? { followUpOutcome } : {}),
    },
  })

  traceWeeklyQuestion('clarification_event_record_succeeded', {
    questionId: weeklyQuestionKey(question),
    entityKey: identity.entityKey,
  })
}

function isWeeklyFollowUpAction(question: WeeklyPlanOutput['openQuestions'][number]): boolean {
  return weeklyQuestionAnswers.value[weeklyQuestionKey(question)] === 'add_followup'
}

function weeklyQuestionApplyLabel(question: WeeklyPlanOutput['openQuestions'][number]): string {
  if (isWeeklyFollowUpAction(question)) {
    return weeklyPlan.value?.locale === 'he' ? 'הוסף משימת מעקב' : 'Add follow-up task'
  }
  return weeklyPlan.value?.locale === 'he' ? 'שמור תשובה' : 'Save answer'
}

function defaultWeeklyFollowUpTitle(parentTask: Task | null, locale: 'he' | 'en'): string {
  return locale === 'he'
    ? `מעקב: ${parentTask?.title || 'משימה'}`
    : `Follow up: ${parentTask?.title || 'task'}`
}

function findExistingWeeklyFollowUp(parentTask: Task | null, title: string): Task | null {
  if (!parentTask?.id) return null
  return decideAITaskCreate({
    tasks: taskStore.tasks,
    title,
    parentTaskId: parentTask.id,
    projectId: parentTask.projectId,
    scope: `weekly-followup:${parentTask.id}`,
    sourceMessageId: props.message.id,
  }).existing
}

function revealExistingWeeklyFollowUp(question: WeeklyPlanOutput['openQuestions'][number], event: MouseEvent): void {
  event.stopPropagation()
  const key = weeklyQuestionKey(question)
  const duplicate = weeklyFollowUpDuplicates.value[key]
  if (!duplicate) return

  window.dispatchEvent(new CustomEvent('open-task-edit', { detail: { taskId: duplicate.existingTaskId } }))
  window.dispatchEvent(new CustomEvent('task-action-flash', { detail: { taskId: duplicate.existingTaskId } }))
  const locale = weeklyPlan.value?.locale ?? 'en'
  weeklyQuestionApplied.value = {
    ...weeklyQuestionApplied.value,
    [key]: locale === 'he' ? 'משתמש במשימת המעקב הקיימת' : 'Using the existing follow-up task',
  }
  const { [key]: _done, ...rest } = weeklyFollowUpDuplicates.value
  weeklyFollowUpDuplicates.value = rest
  emit('continueChat', locale === 'he'
    ? `המשך לתכנן את השבוע. כבר קיימת משימת מעקב בשם "${duplicate.existingTitle}", אז אל תיצור כפילות.\n\n[FLOWSTATE_CLARIFICATION_CONTINUATION mode=week_plan]`
    : `Continue planning the week. A follow-up task named "${duplicate.existingTitle}" already exists, so do not create a duplicate.\n\n[FLOWSTATE_CLARIFICATION_CONTINUATION mode=week_plan]`)
}

async function createDuplicateWeeklyFollowUp(question: WeeklyPlanOutput['openQuestions'][number], event: MouseEvent): Promise<void> {
  event.stopPropagation()
  const key = weeklyQuestionKey(question)
  const duplicate = weeklyFollowUpDuplicates.value[key]
  if (!duplicate || weeklyQuestionApplying.value[key]) return

  weeklyQuestionApplying.value = { ...weeklyQuestionApplying.value, [key]: true }
  const locale = weeklyPlan.value?.locale ?? 'en'
  const parentTask = weeklyQuestionTask(question)
  try {
    await recordWeeklyQuestionAnswer(question, parentTask, duplicate.selectedOption, duplicate.note, 'duplicate_created')
    await createWeeklyFollowUpTask({
      key,
      question,
      parentTask,
      title: duplicate.title,
      locale,
      startedAt: Date.now(),
    })
    const { [key]: _done, ...rest } = weeklyFollowUpDuplicates.value
    weeklyFollowUpDuplicates.value = rest
  } finally {
    const { [key]: _doneApplying, ...restApplying } = weeklyQuestionApplying.value
    weeklyQuestionApplying.value = restApplying
  }
}

function showWeeklyQuestionStatus(question: WeeklyPlanOutput['openQuestions'][number]): boolean {
  return Boolean(weeklyQuestionApplied.value[weeklyQuestionKey(question)])
}

function weeklyQuestionAnsweredLabel(): string {
  return weeklyPlan.value?.locale === 'he' ? 'התשובה כבר נשמרה' : 'Answer already saved'
}

async function hydrateAnsweredWeeklyQuestions(): Promise<void> {
  const questions = visibleWeeklyQuestions.value
  if (!questions.length) return

  const identities = questions.map(question => ({
    key: weeklyQuestionKey(question),
    identity: weeklyQuestionMemoryIdentity(question, weeklyQuestionTask(question)),
  }))
  const entityKeys = [...new Set(identities.map(item => item.identity.entityKey))]
  if (!entityKeys.length) return

  traceWeeklyQuestion('answered_hydration_started', {
    questionCount: questions.length,
    entityKeys,
  })

  try {
    const events = await aiMemoryDb.fetchAIClarificationEvents(entityKeys, 50)
    const resolved = new Set(events
      .filter(event => ['answered', 'dismissed', 'generated_with_uncertainty', 'showed_candidates'].includes(event.eventType))
      .map(event => `${event.entityKey}::${event.questionId}`))
    const nextApplied = { ...weeklyQuestionApplied.value }
    const newlyResolvedQuestionIds: string[] = []
    for (const item of identities) {
      if (resolved.has(`${item.identity.entityKey}::${item.key}`)) {
        nextApplied[item.key] = weeklyQuestionAnsweredLabel()
        newlyResolvedQuestionIds.push(item.key)
      }
    }
    weeklyQuestionApplied.value = nextApplied
    if (newlyResolvedQuestionIds.length) {
      aiChatStore.resolveWeeklyPlanQuestions(
        props.message.id,
        newlyResolvedQuestionIds,
        'answered_memory_hydration',
      )
    }
    traceWeeklyQuestion('answered_hydration_finished', {
      matchedCount: newlyResolvedQuestionIds.length,
    })
  } catch (err) {
    console.error('[AIChat:WeeklyInlineQuestion]', {
      stage: 'answered_hydration_failed',
      messageId: props.message.id,
      error: err,
    })
  }
}

function isWeekImportanceClarification(questionId: string | undefined | null): boolean {
  return Boolean(questionId && /^week_importance_/.test(questionId))
}

function isWeekEntityKey(entityKey: string | undefined | null): boolean {
  return Boolean(entityKey && /^week:\d{4}-\d{2}-\d{2}/.test(entityKey))
}

function recentWeekKeysFromMemoryKey(memoryKey: string): string[] {
  const match = memoryKey.match(/^week:(\d{4}-\d{2}-\d{2})/)
  if (!match) return [memoryKey]
  const date = new Date(match[1])
  if (Number.isNaN(date.getTime())) return [memoryKey]
  return Array.from({ length: 8 }, (_, index) => {
    const week = new Date(date)
    week.setDate(date.getDate() - (index * 7))
    return `week:${week.toISOString().slice(0, 10)}`
  })
}

function clarificationEventResolvesCard(card: AIClarificationArtifact, event: {
  entityKey?: string | null
  questionId?: string | null
  eventType?: string | null
}): boolean {
  const resolvedTypes = ['answered', 'dismissed', 'generated_with_uncertainty', 'showed_candidates']
  if (!event.eventType || !resolvedTypes.includes(event.eventType)) return false
  if (event.entityKey === card.memoryKey && event.questionId === card.question.id) return true
  if (!isWeekImportanceClarification(card.question.id)) return false
  return isWeekEntityKey(event.entityKey) && isWeekImportanceClarification(event.questionId)
}

async function hydrateAnsweredClarification(): Promise<void> {
  const card = clarification.value
  if (!card) return
  const entityKeys = isWeekImportanceClarification(card.question.id)
    ? recentWeekKeysFromMemoryKey(card.memoryKey)
    : [card.memoryKey]
  try {
    const events = await aiMemoryDb.fetchAIClarificationEvents(entityKeys, 50)
    if (!events.some(event => clarificationEventResolvesCard(card, event))) return
    clarificationResolvedLocal.value = {
      ...clarificationResolvedLocal.value,
      [clarificationKey(card)]: true,
    }
    console.info('[AIChat:ClarificationRender]', {
      stage: 'answered_clarification_suppressed',
      messageId: props.message.id,
      questionId: card.question.id,
      entityKeys,
    })
  } catch (err) {
    console.error('[AIChat:ClarificationRender]', {
      stage: 'answered_clarification_hydration_failed',
      messageId: props.message.id,
      error: err,
    })
  }
}

onMounted(() => {
  void hydrateAnsweredWeeklyQuestions()
  void hydrateAnsweredClarification()
})

watch(
  () => weeklyPlan.value?.requestId,
  () => {
    void hydrateAnsweredWeeklyQuestions()
  },
)

watch(
  () => {
    const card = clarification.value
    return card ? `${card.memoryKey}::${card.question.id}` : ''
  },
  () => {
    void hydrateAnsweredClarification()
  },
)

function continueAfterWeeklyQuestion(
  question: WeeklyPlanOutput['openQuestions'][number],
  option: NonNullable<WeeklyPlanOutput['openQuestions'][number]['options']>[number] | undefined,
  note: string,
): void {
  const locale = weeklyPlan.value?.locale ?? 'en'
  const continuationMarker = '\n\n[FLOWSTATE_CLARIFICATION_CONTINUATION mode=week_plan]'
  const evidence = [
    option?.label ? (locale === 'he' ? `תשובה: "${option.label}"` : `Answer: "${option.label}"`) : '',
    note ? (locale === 'he' ? `הערה: "${note.slice(0, 240)}"` : `Note: "${note.slice(0, 240)}"`) : '',
    isWeeklyFollowUpAction(question)
      ? (locale === 'he' ? 'נוצרה משימת מעקב.' : 'Created a follow-up task.')
      : '',
  ].filter(Boolean).join('\n')
  const evidenceBlock = evidence
    ? locale === 'he'
      ? `\n\nהקשר שעניתי עכשיו:\n${evidence}`
      : `\n\nContext I just answered:\n${evidence}`
    : ''
  emit('continueChat', locale === 'he'
    ? `המשך לתכנן את השבוע עם ההקשר שעניתי עכשיו. תן תשובה קצרה ומעשית, בלי רשימה ארוכה.${evidenceBlock}${continuationMarker}`
    : `Continue planning the week using the context I just answered. Keep it short and actionable, not a long list.${evidenceBlock}${continuationMarker}`)
}

async function recordWeeklyQuestionEscape(
  question: WeeklyPlanOutput['openQuestions'][number],
  action: 'generate_current' | 'pause_save',
  event: MouseEvent,
): Promise<void> {
  event.stopPropagation()
  const key = weeklyQuestionKey(question)
  if (weeklyQuestionApplying.value[key]) return

  const locale = weeklyPlan.value?.locale ?? 'en'
  const parentTask = weeklyQuestionTask(question)
  const identity = weeklyQuestionMemoryIdentity(question, parentTask)
  weeklyQuestionApplying.value = { ...weeklyQuestionApplying.value, [key]: true }
  weeklyQuestionApplied.value = {
    ...weeklyQuestionApplied.value,
    [key]: action === 'generate_current'
      ? (locale === 'he' ? 'ממשיך עכשיו עם אי-ודאות גלויה...' : 'Generating now with visible uncertainty...')
      : (locale === 'he' ? 'נעצר ונשמר לתוכנית הזו' : 'Stopped and saved for this plan'),
  }
  traceWeeklyQuestion('escape_started', {
    key,
    questionId: question.id,
    action,
    entityKey: identity.entityKey,
  })

  try {
    await aiMemoryDb.recordAIClarificationEvent({
      entityKey: identity.entityKey,
      entityType: identity.entityType,
      displayName: identity.displayName,
      questionId: key,
      eventType: action === 'generate_current' ? 'generated_with_uncertainty' : 'dismissed',
      question: question.question,
      sourceMessageId: props.message.id,
      uncertaintyDimensions: weeklyQuestionUncertaintyDimension(question),
      pathType: action === 'generate_current' ? 'generated_with_uncertainty' : 'pause_save',
      contextSnapshot: {
        weeklyPlanRequestId: weeklyPlan.value?.requestId,
        weeklyPlanSource: weeklyPlan.value?.source,
        relatedTaskIds: question.relatedTaskIds,
        reason: question.reason,
      },
    })
    traceWeeklyQuestion('escape_record_succeeded', {
      key,
      action,
      entityKey: identity.entityKey,
    })
  } catch (err) {
    console.error('[AIChat:WeeklyInlineQuestion]', {
      stage: 'escape_record_failed',
      key,
      action,
      error: err,
    })
  } finally {
    const { [key]: _done, ...rest } = weeklyQuestionApplying.value
    weeklyQuestionApplying.value = rest
  }

  if (action === 'generate_current') {
    emit('continueChat', locale === 'he'
      ? `צור תוכנית שבועית עכשיו לפי נתוני המשימות הקיימים בלבד. סמן הקשר חסר כלא ידוע, אל תסיק חשיבות משמות בלבד, ותן עד 3 נתיבי עבודה קצרים.\n\n[FLOWSTATE_CLARIFICATION_CONTINUATION mode=week_plan]`
      : `Generate the weekly plan now from current task data only. Mark missing context as unknown, do not infer importance from names alone, and return up to 3 short work lanes.\n\n[FLOWSTATE_CLARIFICATION_CONTINUATION mode=week_plan]`)
  }
}

function traceWeeklyQuestion(stage: string, details: Record<string, unknown> = {}): void {
  console.info('[AIChat:WeeklyInlineQuestion]', {
    stage,
    messageId: props.message.id,
    ...details,
  })
}

async function createWeeklyFollowUpTask(input: {
  key: string
  question: WeeklyPlanOutput['openQuestions'][number]
  parentTask: Task | null
  title: string
  locale: 'he' | 'en'
  startedAt: number
}): Promise<void> {
  traceWeeklyQuestion('followup_create_started', {
    key: input.key,
    questionId: input.question.id,
    parentTaskId: input.parentTask?.id ?? null,
    title: input.title,
  })
  try {
    const commandId = `weekly-followup:${input.key}:task-create`
    const description = [
        input.locale === 'he' ? 'נוצר מתשובת מעקב בתוכנית השבועית.' : 'Created from a weekly-plan follow-up answer.',
        input.parentTask ? `${input.locale === 'he' ? 'משימת מקור' : 'Source task'}: ${input.parentTask.title}` : '',
        input.question.question,
      ].filter(Boolean).join('\n')
    const batch = aiActionCommands.buildAICommandBatchPreview({
      sourcePrompt: 'weekly follow-up task',
      sourceRunId: props.message.id,
      sourceMessageId: props.message.id,
      dataUsed: {
        messageId: props.message.id,
        questionId: input.question.id,
        parentTaskId: input.parentTask?.id ?? null,
        duplicateOverride: true,
      },
      commands: [{
        id: commandId,
        kind: 'task.create',
        title: input.title,
        description,
        priority: input.parentTask?.priority ?? 'medium',
        projectId: input.parentTask?.projectId || 'uncategorized',
        parentTaskId: input.parentTask?.id ?? null,
        allowDuplicate: true,
        impact: 'low',
      }],
      tasks: taskStore.tasks,
    })
    await aiActionCommands.applyAICommandBatch(batch, {
      selectedCommandIds: [commandId],
      taskStore,
    })
    weeklyQuestionApplied.value = {
      ...weeklyQuestionApplied.value,
      [input.key]: input.locale === 'he' ? 'משימת מעקב נוספה' : 'Follow-up task added',
    }
    traceWeeklyQuestion('followup_create_succeeded', {
      key: input.key,
      elapsedMs: Date.now() - input.startedAt,
    })
  } catch (err) {
    console.error('[AIChat:WeeklyInlineQuestion]', {
      stage: 'followup_create_failed',
      key: input.key,
      elapsedMs: Date.now() - input.startedAt,
      error: err,
    })
    weeklyQuestionApplied.value = {
      ...weeklyQuestionApplied.value,
      [input.key]: input.locale === 'he' ? 'יצירת משימת המעקב נכשלה' : 'Follow-up task failed',
    }
  }
}

async function applyWeeklyQuestion(question: WeeklyPlanOutput['openQuestions'][number], event: MouseEvent) {
  event.stopPropagation()
  const key = weeklyQuestionKey(question)
  const selected = weeklyQuestionAnswers.value[key]
  const note = weeklyQuestionFreeText.value[key]?.trim()
  if (!selected && !note) return
  if (weeklyQuestionApplying.value[key]) return

  weeklyQuestionApplying.value = { ...weeklyQuestionApplying.value, [key]: true }
  const locale = weeklyPlan.value?.locale ?? 'en'
  const startedAt = Date.now()
  weeklyQuestionApplied.value = {
    ...weeklyQuestionApplied.value,
    [key]: selected === 'add_followup'
      ? (locale === 'he' ? 'ממשיך עכשיו; יוצר משימת מעקב ברקע...' : 'Continuing now; creating follow-up in background...')
      : (locale === 'he' ? 'שומר תשובה...' : 'Saving answer...'),
  }
  traceWeeklyQuestion('apply_started', {
    key,
    questionId: question.id,
    selected,
    hasNote: Boolean(note),
  })
  try {
    const parentTask = weeklyQuestionTask(question)
    const option = question.options?.find(item => item.id === selected)
    if (option?.memoryPatch) {
      traceWeeklyQuestion('memory_patch_started', { key, field: option.memoryPatch.field })
      await applyAIMemoryPatchCommand({
        ...option.memoryPatch,
        sourceMessageId: props.message.id,
      }, 'weekly question option memory patch')
      traceWeeklyQuestion('memory_patch_succeeded', { key })
    }
    if (note && question.entityType && question.entityId && question.freeTextPatch) {
      const patch: AIMemoryPatch = {
        entityType: question.entityType,
        entityId: question.entityId,
        operation: question.freeTextPatch.operation,
        field: question.freeTextPatch.field,
        value: note,
        confidence: 0.95,
        source: 'free_text',
        sourceMessageId: props.message.id,
      }
      traceWeeklyQuestion('free_text_patch_started', { key, field: patch.field })
      await applyAIMemoryPatchCommand(patch, 'weekly question free-text memory patch')
      traceWeeklyQuestion('free_text_patch_succeeded', { key })
    }
    if (selected === 'add_followup') {
      const title = note || defaultWeeklyFollowUpTitle(parentTask, locale)
      const existingFollowUp = findExistingWeeklyFollowUp(parentTask, title)
      if (existingFollowUp) {
        await recordWeeklyQuestionAnswer(question, parentTask, option, note || '', 'existing_found')
        weeklyFollowUpDuplicates.value = {
          ...weeklyFollowUpDuplicates.value,
          [key]: {
            existingTaskId: existingFollowUp.id,
            existingTitle: existingFollowUp.title,
            title,
            question,
            selectedOption: option,
            note: note || '',
          },
        }
        weeklyQuestionApplied.value = {
          ...weeklyQuestionApplied.value,
          [key]: locale === 'he'
            ? `כבר קיימת משימת מעקב: ${existingFollowUp.title}`
            : `A follow-up already exists: ${existingFollowUp.title}`,
        }
        traceWeeklyQuestion('followup_duplicate_found', {
          key,
          questionId: question.id,
          parentTaskId: parentTask?.id ?? null,
          existingTaskId: existingFollowUp.id,
        })
        return
      }
      await recordWeeklyQuestionAnswer(question, parentTask, option, note || '', 'created')
      void createWeeklyFollowUpTask({ key, question, parentTask, title, locale, startedAt })
    } else {
      await recordWeeklyQuestionAnswer(question, parentTask, option, note || '')
      weeklyQuestionApplied.value = {
        ...weeklyQuestionApplied.value,
        [key]: locale === 'he' ? 'התשובה נשמרה לתוכנית הזו' : 'Answer saved for this plan',
      }
    }
    continueAfterWeeklyQuestion(question, option, note)
    traceWeeklyQuestion('continuation_emitted', {
      key,
      elapsedMs: Date.now() - startedAt,
      followUpBackgrounded: selected === 'add_followup',
    })
  } catch (err) {
    console.error('[AIChat:WeeklyInlineQuestion]', {
      stage: 'apply_failed',
      key,
      selected,
      elapsedMs: Date.now() - startedAt,
      error: err,
    })
    weeklyQuestionApplied.value = {
      ...weeklyQuestionApplied.value,
      [key]: locale === 'he' ? 'הפעולה נכשלה' : 'Action failed',
    }
  } finally {
    const { [key]: _done, ...rest } = weeklyQuestionApplying.value
    weeklyQuestionApplying.value = rest
    traceWeeklyQuestion('apply_finished', {
      key,
      elapsedMs: Date.now() - startedAt,
    })
  }
}

function clarificationKey(card: AIClarificationArtifact): string {
  return card.question.id || card.question.question
}

function clarificationActionLabel(action: AIClarificationArtifact['actions'][number], locale: 'he' | 'en'): string {
  if (action === 'generate_current') return locale === 'he' ? 'צור תוכנית עכשיו' : 'Generate now'
  if (action === 'show_candidates') return locale === 'he' ? 'להראות מועמדים בלבד' : 'Show candidates only'
  return locale === 'he' ? 'עצור ושמור' : 'Stop and save'
}

function clarificationActionEvent(action: AIClarificationArtifact['actions'][number]) {
  if (action === 'generate_current') return 'generated_with_uncertainty' as const
  if (action === 'show_candidates') return 'showed_candidates' as const
  return 'dismissed' as const
}

function clarificationActionPath(action: AIClarificationArtifact['actions'][number]) {
  if (action === 'generate_current') return 'generated_with_uncertainty' as const
  if (action === 'show_candidates') return 'showed_candidates' as const
  return 'pause_save' as const
}

function clarificationDisplayName(card: AIClarificationArtifact): string {
  const question = card.question
  if (question.entityType === 'project' && question.entityId) {
    return taskStore.getProjectDisplayName?.(question.entityId) || question.entityId
  }
  if (question.entityType === 'task' && question.entityId) {
    return taskMap.value.get(question.entityId)?.title || question.entityId
  }
  return question.entityId || card.memoryKey
}

type ClarificationFollowUpStep = {
  id: string
  field: string
  operation: 'set' | 'append'
  prompt: string
  placeholder: string
  options: Array<{ id: string; label: string; value: string; confidence?: number }>
}

function clarificationFollowUpSteps(card: AIClarificationArtifact): ClarificationFollowUpStep[] {
  const locale = card.locale
  const steps: ClarificationFollowUpStep[] = []

  if (card.kind === 'response_quality') {
    steps.push({
      id: 'answer_success',
      field: 'taskSelectionHints',
      operation: 'append',
      prompt: locale === 'he' ? 'מה הכי חשוב שהתשובה תעזור לך לעשות?' : 'What should this answer help you do?',
      placeholder: locale === 'he'
        ? 'אופציונלי: כתוב מה יהפוך את התשובה לשימושית'
        : 'Optional: what would make the answer useful?',
      options: locale === 'he'
        ? [
            { id: 'choose_next', label: 'לבחור צעד הבא', value: 'choose the next action' },
            { id: 'reduce_overload', label: 'להוריד עומס', value: 'reduce overwhelm' },
            { id: 'rank_by_stakes', label: 'לדרג לפי השלכות', value: 'rank by stakes and consequences' },
            { id: 'find_quick_win', label: 'למצוא ניצחון מהיר', value: 'find a quick win' },
            { id: 'avoid_wrong_work', label: 'להימנע מעבודה לא נכונה', value: 'avoid the wrong work' },
            { id: 'not_sure', label: 'לא בטוח', value: 'unclear success criterion', confidence: 0.45 },
          ]
        : [
            { id: 'choose_next', label: 'Choose next action', value: 'choose the next action' },
            { id: 'reduce_overload', label: 'Reduce overwhelm', value: 'reduce overwhelm' },
            { id: 'rank_by_stakes', label: 'Rank by stakes', value: 'rank by stakes and consequences' },
            { id: 'find_quick_win', label: 'Find quick win', value: 'find a quick win' },
            { id: 'avoid_wrong_work', label: 'Avoid wrong work', value: 'avoid the wrong work' },
            { id: 'not_sure', label: 'Not sure', value: 'unclear success criterion', confidence: 0.45 },
          ],
    })
    return steps
  }

  if (card.kind !== 'weekly_planning') return []

  steps.push({
    id: 'why_now',
    field: 'whyItMatters',
    operation: 'set',
    prompt: locale === 'he' ? 'למה זה חשוב עכשיו?' : 'Why does this matter right now?',
    placeholder: locale === 'he'
      ? 'אופציונלי: מה ייחשב התקדמות טובה?'
      : 'Optional: what would count as good progress?',
    options: locale === 'he'
      ? [
          { id: 'deadline_commitment', label: 'דדליין/התחייבות', value: 'deadline or commitment' },
          { id: 'unblocks_work', label: 'פותח עבודה אחרת', value: 'unblocks other work' },
          { id: 'client_money', label: 'לקוח/כסף', value: 'client or money impact' },
          { id: 'stress_chaos', label: 'מוריד לחץ', value: 'reduces stress or chaos' },
          { id: 'momentum', label: 'מומנטום חשוב', value: 'important long-term or creative momentum' },
          { id: 'not_sure', label: 'לא בטוח', value: 'unclear why it matters right now', confidence: 0.45 },
        ]
      : [
          { id: 'deadline_commitment', label: 'Deadline/commitment', value: 'deadline or commitment' },
          { id: 'unblocks_work', label: 'Unblocks work', value: 'unblocks other work' },
          { id: 'client_money', label: 'Client/money impact', value: 'client or money impact' },
          { id: 'stress_chaos', label: 'Reduces stress', value: 'reduces stress or chaos' },
          { id: 'momentum', label: 'Important momentum', value: 'important long-term or creative momentum' },
          { id: 'not_sure', label: 'Not sure', value: 'unclear why it matters right now', confidence: 0.45 },
        ],
  })

  steps.push({
    id: 'success_this_week',
    field: 'successCriteria',
    operation: 'append',
    prompt: locale === 'he' ? 'מה ייחשב התקדמות טובה השבוע?' : 'What would count as good progress this week?',
    placeholder: locale === 'he'
      ? 'אופציונלי: כתוב ניסוח משלך להצלחה השבוע'
      : 'Optional: write your own success criterion',
    options: locale === 'he'
      ? [
          { id: 'ship_usable', label: 'לשלוח משהו שימושי', value: 'ship something usable' },
          { id: 'make_decision', label: 'לקבל החלטה', value: 'make a decision' },
          { id: 'clear_backlog', label: 'לנקות עומס', value: 'clear backlog' },
          { id: 'draft_prototype', label: 'טיוטה/אב-טיפוס', value: 'create draft or prototype' },
          { id: 'maintain_habit', label: 'לשמר הרגל', value: 'maintain habit' },
          { id: 'write_it', label: 'אכתוב בעצמי', value: 'user will write success criterion', confidence: 0.5 },
        ]
      : [
          { id: 'ship_usable', label: 'Ship usable', value: 'ship something usable' },
          { id: 'make_decision', label: 'Make decision', value: 'make a decision' },
          { id: 'clear_backlog', label: 'Clear backlog', value: 'clear backlog' },
          { id: 'draft_prototype', label: 'Draft/prototype', value: 'create draft or prototype' },
          { id: 'maintain_habit', label: 'Maintain habit', value: 'maintain habit' },
          { id: 'write_it', label: 'I’ll write it', value: 'user will write success criterion', confidence: 0.5 },
        ],
  })

  steps.push({
    id: 'slip_risk',
    field: 'failureRisks',
    operation: 'append',
    prompt: locale === 'he' ? 'מה קורה אם זה נדחה?' : 'What happens if this slips?',
    placeholder: locale === 'he'
      ? 'אופציונלי: מה הסיכון האמיתי אם זה לא קורה?'
      : 'Optional: what is the real risk if this does not happen?',
    options: locale === 'he'
      ? [
          { id: 'nothing_serious', label: 'לא נורא', value: 'nothing serious', confidence: 0.75 },
          { id: 'some_inconvenience', label: 'קצת אי-נוחות', value: 'some inconvenience' },
          { id: 'blocks_tasks', label: 'חוסם משימות', value: 'blocks other tasks' },
          { id: 'missed_opportunity', label: 'הזדמנות תתפספס', value: 'missed opportunity' },
          { id: 'work_problem', label: 'בעיה בעבודה/לקוח', value: 'client or work problem' },
          { id: 'stress_increases', label: 'יותר לחץ', value: 'personal stress increases' },
        ]
      : [
          { id: 'nothing_serious', label: 'Nothing serious', value: 'nothing serious', confidence: 0.75 },
          { id: 'some_inconvenience', label: 'Some inconvenience', value: 'some inconvenience' },
          { id: 'blocks_tasks', label: 'Blocks tasks', value: 'blocks other tasks' },
          { id: 'missed_opportunity', label: 'Missed opportunity', value: 'missed opportunity' },
          { id: 'work_problem', label: 'Work/client problem', value: 'client or work problem' },
          { id: 'stress_increases', label: 'Stress increases', value: 'personal stress increases' },
        ],
  })

  return steps
}

function clarificationFollowUpStep(card: AIClarificationArtifact): ClarificationFollowUpStep | null {
  const key = clarificationKey(card)
  const steps = clarificationFollowUpSteps(card)
  return steps[clarificationFollowUpStepIndex.value[key] ?? 0] ?? null
}

function clarificationFollowUpInputKey(card: AIClarificationArtifact): string {
  const step = clarificationFollowUpStep(card)
  return `${clarificationKey(card)}:${step?.id ?? 'none'}`
}

function clarificationFollowUpPrompt(card: AIClarificationArtifact): string {
  return clarificationFollowUpStep(card)?.prompt ?? (card.locale === 'he' ? 'מה עוד חשוב לדעת?' : 'What else matters here?')
}

function clarificationFollowUpPlaceholder(card: AIClarificationArtifact): string {
  return clarificationFollowUpStep(card)?.placeholder ?? (card.locale === 'he' ? 'אופציונלי: הוסף הקשר קצר' : 'Optional: add brief context')
}

function clarificationFollowUpOptions(card: AIClarificationArtifact) {
  return clarificationFollowUpStep(card)?.options ?? []
}

async function saveClarificationAnswer(card: AIClarificationArtifact, event: MouseEvent) {
  event.stopPropagation()
  if (clarificationApplying.value) return
  const key = clarificationKey(card)
  if (clarificationSavedLocal.value[key]) return
  const selectedId = clarificationAnswers.value[key]
  const note = clarificationFreeText.value[key]?.trim()
  const option = card.question.options.find(item => item.id === selectedId)
  if (!option && !note) return

  clarificationSavedLocal.value[key] = true
  clarificationFollowUpSavedLocal.value[key] = true
  const savingStatus = card.locale === 'he'
    ? 'שומר הקשר...'
    : 'Saving context...'
  clarificationStatus.value = savingStatus
  await persistClarificationAnswer(card, option, note)
  const durableAnswer = [option?.label, note].filter(Boolean).join('\n')
  if (card.runtime) {
    clarificationStatus.value = card.locale === 'he'
      ? 'מחדש את זרימת התכנון...'
      : 'Resuming planning flow...'
    const resumeResult = await resumeLocalClarificationRuntime(card, durableAnswer)
    card.runtime.status = resumeResult.ok && resumeResult.status === 'success' ? 'resumed' : 'failed'
    card.runtime.error = resumeResult.ok ? undefined : resumeResult.error
    console.info('[AIChat:ClarificationRuntime]', {
      stage: 'resume',
      ok: resumeResult.ok,
      runId: card.runtime.runId,
      questionKey: card.runtime.questionKey,
      status: resumeResult.ok ? resumeResult.status : 'failed',
      error: resumeResult.ok ? undefined : resumeResult.error,
    })
  }
  if (clarificationStatus.value === savingStatus || card.runtime) {
    clarificationStatus.value = card.locale === 'he'
      ? 'נשמר. ממשיך לשלב הבא...'
      : 'Saved. Continuing to the next step...'
  }
  emit('continueChat', clarificationContinueMessage(card, {
    selectedLabel: option?.label,
    freeText: note,
  }))
}

function formatClarificationContinuationEvidence(input: {
  selectedLabel?: string
  freeText?: string
  followUpLabel?: string
  followUpFreeText?: string
}, locale: 'he' | 'en'): string {
  const lines: string[] = []
  const clipped = (value: string) => value.length > 240 ? `${value.slice(0, 237)}...` : value
  if (locale === 'he') {
    if (input.selectedLabel) lines.push(`תשובה: "${input.selectedLabel}"`)
    if (input.freeText) lines.push(`הערה: "${clipped(input.freeText)}"`)
    if (input.followUpLabel) lines.push(`למה עכשיו: "${input.followUpLabel}"`)
    if (input.followUpFreeText) lines.push(`הערת המשך: "${clipped(input.followUpFreeText)}"`)
    return lines.join('\n')
  }
  if (input.selectedLabel) lines.push(`Answer: "${input.selectedLabel}"`)
  if (input.freeText) lines.push(`Note: "${clipped(input.freeText)}"`)
  if (input.followUpLabel) lines.push(`Why now: "${input.followUpLabel}"`)
  if (input.followUpFreeText) lines.push(`Why-now note: "${clipped(input.followUpFreeText)}"`)
  return lines.join('\n')
}

function clarificationContinuationModeForCard(card: AIClarificationArtifact): string {
  if (card.kind === 'weekly_planning') return 'week_plan'
  return card.responseMode || 'general'
}

function clarificationContinueMessage(
  card: AIClarificationArtifact,
  evidence: {
    selectedLabel?: string
    freeText?: string
    followUpLabel?: string
    followUpFreeText?: string
  } = {},
): string {
  const continuationMode = clarificationContinuationModeForCard(card)
  const continuationMarker = `\n\n[FLOWSTATE_CLARIFICATION_CONTINUATION mode=${continuationMode}]`
  const evidenceText = formatClarificationContinuationEvidence(evidence, card.locale)
  const evidenceBlock = evidenceText
    ? card.locale === 'he'
      ? `\n\nהקשר שעניתי עכשיו:\n${evidenceText}`
      : `\n\nContext I just answered:\n${evidenceText}`
    : ''
  if (card.kind === 'response_quality') {
    return card.locale === 'he'
      ? `המשך עם התשובה לפי ההקשר שעניתי עכשיו. תן תשובה קצרה וממוקדת, בלי רשימה ארוכה.${evidenceBlock}${continuationMarker}`
      : `Continue with the answer using the clarification I just answered. Keep it short and focused, not a long list.${evidenceBlock}${continuationMarker}`
  }
  return card.locale === 'he'
    ? `המשך לתכנן את השבוע עם ההקשר שעניתי עכשיו. תן קודם תקציר קצר בלבד, בלי רשימה ארוכה.${evidenceBlock}${continuationMarker}`
    : `Continue planning the week using the clarification I just answered. Start with a short summary only, not a long list.${evidenceBlock}${continuationMarker}`
}

function clarificationUncertaintyContinueMessage(card: AIClarificationArtifact): string {
  const continuationMode = clarificationContinuationModeForCard(card)
  const continuationMarker = `\n\n[FLOWSTATE_CLARIFICATION_CONTINUATION mode=${continuationMode}]`
  if (card.locale === 'he') {
    return `המשך עם תשובה לפי נתוני המשימות הקיימים בלבד. סמן הקשר חסר כלא ידוע, אל תסיק חשיבות משמות בלבד, ותן תשובה קצרה ומעשית בלי רשימה ארוכה.${continuationMarker}`
  }
  return `Continue with the answer using current task data only. Clearly mark missing context as unknown, do not infer importance from names alone, and keep it short and actionable instead of a long list.${continuationMarker}`
}

function continueAfterClarification(card: AIClarificationArtifact, event: MouseEvent) {
  event.stopPropagation()
  emit('continueChat', clarificationContinueMessage(card))
}

async function persistClarificationAnswer(
  card: AIClarificationArtifact,
  option: AIClarificationQuestion['options'][number] | undefined,
  note: string,
) {
  try {
    if (option?.memoryPatch) {
      await applyAIMemoryPatchCommand({
        ...option.memoryPatch,
        sourceMessageId: props.message.id,
      }, 'clarification answer memory patch')
    }
    await aiMemoryDb.recordAIClarificationEvent({
      entityKey: card.memoryKey,
      entityType: card.question.entityType ?? 'workflow',
      displayName: clarificationDisplayName(card),
      questionId: card.question.id,
      eventType: 'answered',
      question: card.question.question,
      selectedOptionId: option?.id,
      selectedLabel: option?.label,
      freeText: note,
      memoryPatch: option?.memoryPatch ? { ...option.memoryPatch, sourceMessageId: props.message.id } : undefined,
      sourceMessageId: props.message.id,
      coverageScoreAtTime: card.coverage?.score,
      uncertaintyDimensions: card.coverage?.missing,
      pathType: 'clarify_first',
      contextSnapshot: {
        candidateTaskIds: card.candidateTaskIds,
        coverage: card.coverage,
        retrieval: card.debug?.retrieval,
      },
    })
    clarificationStatus.value = clarificationPersistedStatus(card.locale)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes('authenticated user')) {
      console.error('[ChatMessage] Clarification save failed:', err)
    }
    clarificationStatus.value = card.locale === 'he'
      ? 'נשמר מקומית; הסנכרון יושלם אחרי חיבור תקין.'
      : 'Saved locally; sync will complete when the connection is ready.'
  }
}

function saveClarificationFollowUp(card: AIClarificationArtifact, event: MouseEvent) {
  event.stopPropagation()
  const key = clarificationKey(card)
  if (clarificationFollowUpSavedLocal.value[key]) return
  const inputKey = clarificationFollowUpInputKey(card)
  const step = clarificationFollowUpStep(card)
  const selectedId = clarificationFollowUpAnswers.value[inputKey]
  const note = clarificationFollowUpFreeText.value[inputKey]?.trim()
  const option = clarificationFollowUpOptions(card).find(item => item.id === selectedId)
  if (!option && !note) return

  clarificationStatus.value = card.locale === 'he'
    ? 'נשמר מקומית. שאלה קצרה אחת בכל פעם.'
    : 'Saved locally. One short question at a time.'
  void persistClarificationFollowUp(card, step, option, note)
  const nextIndex = (clarificationFollowUpStepIndex.value[key] ?? 0) + 1
  const hasNextStep = nextIndex < clarificationFollowUpSteps(card).length
  if (hasNextStep) {
    clarificationFollowUpStepIndex.value[key] = nextIndex
    return
  }
  clarificationFollowUpSavedLocal.value[key] = true
  emit('continueChat', clarificationContinueMessage(card, collectClarificationEvidence(card)))
}

async function persistClarificationFollowUp(
  card: AIClarificationArtifact,
  step: ClarificationFollowUpStep | null,
  option: ReturnType<typeof clarificationFollowUpOptions>[number] | undefined,
  note: string,
) {
  const patchField = step?.field ?? 'whyItMatters'
  const patchOperation = step?.operation ?? 'set'
  const memoryPatch: AIMemoryPatch | undefined = option
    ? {
        entityType: card.question.entityType ?? 'workflow',
        entityId: card.question.entityId ?? card.memoryKey,
        operation: patchOperation,
        field: patchField,
        value: option.value,
        confidence: option.confidence ?? 0.9,
        source: 'button_answer',
        sourceMessageId: props.message.id,
      }
    : note
      ? {
          entityType: card.question.entityType ?? 'workflow',
          entityId: card.question.entityId ?? card.memoryKey,
          operation: patchOperation,
          field: patchField,
          value: note,
          confidence: 0.9,
          source: 'free_text',
          sourceMessageId: props.message.id,
        }
      : undefined
  try {
    await aiMemoryDb.recordAIClarificationEvent({
      entityKey: card.memoryKey,
      entityType: card.question.entityType ?? 'workflow',
      displayName: clarificationDisplayName(card),
      questionId: `${card.question.id}:${step?.id ?? 'follow_up'}`,
      eventType: 'answered',
      question: step?.prompt ?? clarificationFollowUpPrompt(card),
      selectedOptionId: option?.id,
      selectedLabel: option?.label,
      freeText: note,
      memoryPatch,
      sourceMessageId: props.message.id,
      coverageScoreAtTime: card.coverage?.score,
      uncertaintyDimensions: card.coverage?.missing,
      pathType: 'clarify_first',
      contextSnapshot: {
        candidateTaskIds: card.candidateTaskIds,
        coverage: card.coverage,
        retrieval: card.debug?.retrieval,
        followUp: step?.id ?? 'follow_up',
      },
    })
    clarificationStatus.value = clarificationPersistedStatus(card.locale)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes('authenticated user')) {
      console.error('[ChatMessage] Clarification follow-up save failed:', err)
    }
    clarificationStatus.value = card.locale === 'he'
      ? 'נשמר מקומית; הסנכרון יושלם אחרי חיבור תקין.'
      : 'Saved locally; sync will complete when the connection is ready.'
  }
}

function collectClarificationEvidence(card: AIClarificationArtifact): {
  selectedLabel?: string
  freeText?: string
  followUpLabel?: string
  followUpFreeText?: string
} {
  const key = clarificationKey(card)
  const steps = clarificationFollowUpSteps(card)
  const followUpLabels: string[] = []
  const followUpTextLines: string[] = []
  for (const step of steps) {
    const inputKey = `${key}:${step.id}`
    const selected = clarificationFollowUpAnswers.value[inputKey]
    const label = step.options.find(option => option.id === selected)?.label
    const text = clarificationFollowUpFreeText.value[inputKey]?.trim()
    if (label) followUpLabels.push(label)
    if (text) followUpTextLines.push(text)
  }
  return {
    selectedLabel: card.question.options.find(item => item.id === clarificationAnswers.value[key])?.label,
    freeText: clarificationFreeText.value[key]?.trim(),
    followUpLabel: followUpLabels.join(' | ') || undefined,
    followUpFreeText: followUpTextLines.join(' | ') || undefined,
  }
}

async function recordClarificationEscape(card: AIClarificationArtifact, action: AIClarificationArtifact['actions'][number], event: MouseEvent) {
  event.stopPropagation()
  if (clarificationApplying.value) return
  clarificationApplying.value = true
  clarificationStatus.value = ''
  const key = clarificationKey(card)
  if (action === 'generate_current') {
    clarificationInlineMode.value[key] = 'uncertainty'
    emit('continueChat', clarificationUncertaintyContinueMessage(card))
  } else if (action === 'show_candidates') {
    clarificationInlineMode.value[key] = 'candidates'
  }
  try {
    await aiMemoryDb.recordAIClarificationEvent({
      entityKey: card.memoryKey,
      entityType: card.question.entityType ?? 'workflow',
      displayName: clarificationDisplayName(card),
      questionId: card.question.id,
      eventType: clarificationActionEvent(action),
      question: card.question.question,
      sourceMessageId: props.message.id,
      coverageScoreAtTime: card.coverage?.score,
      uncertaintyDimensions: card.coverage?.missing,
      pathType: clarificationActionPath(action),
      contextSnapshot: {
        candidateTaskIds: card.candidateTaskIds,
        coverage: card.coverage,
        retrieval: card.debug?.retrieval,
      },
    })
    const persisted = clarificationPersistedStatus(card.locale)
    clarificationStatus.value = pendingAIMemoryWriteCount() > 0
      ? persisted
      : card.locale === 'he'
        ? action === 'pause_save' ? 'נשמר. השאלה לא תחזור מיד.' : 'נשמר. מציג תוצאה מוגבלת לפי הנתונים הקיימים.'
        : action === 'pause_save' ? 'Saved. I will not ask this again right away.' : 'Saved. Showing a limited result from current data.'
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes('authenticated user')) {
      console.error('[ChatMessage] Clarification escape failed:', err)
    }
    clarificationStatus.value = card.locale === 'he'
      ? action === 'pause_save' ? 'השמירה נכשלה' : 'מוצג מקומית; יישמר אחרי כניסה לחשבון.'
      : action === 'pause_save' ? 'Save failed' : 'Showing locally; will persist after sign-in.'
  } finally {
    clarificationApplying.value = false
  }
}

function clarificationInlineLabel(card: AIClarificationArtifact): string {
  const mode = clarificationInlineMode.value[clarificationKey(card)]
  if (card.locale === 'he') {
    return mode === 'uncertainty'
      ? 'מועמדים עם אי-ודאות'
      : 'מועמדים ללא דירוג'
  }
  return mode === 'uncertainty'
    ? 'Candidates with uncertainty'
    : 'Unranked candidates'
}

function clarificationInlineSummary(card: AIClarificationArtifact): string {
  const mode = clarificationInlineMode.value[clarificationKey(card)]
  if (card.locale === 'he') {
    return mode === 'uncertainty'
      ? 'אני מציג את המשימות האפשריות בלי לטעון שהן החשובות ביותר, כי ההקשר עדיין חסר.'
      : 'אלה משימות אפשריות מהנתונים שנקראו. אין כאן דירוג חשיבות.'
  }
  return mode === 'uncertainty'
    ? 'These are possible tasks from the current data. I am not claiming they are the most important because context is still missing.'
    : 'These are possible tasks from the data I read. This is not an importance ranking.'
}

function clarificationCandidateTasks(card: AIClarificationArtifact): TaskListItem[] {
  return card.candidateTaskIds
    .map(taskId => taskCardFromId(taskId))
    .filter((task): task is TaskListItem => Boolean(task))
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
const hasRenderedResponse = computed(() => renderedContent.value.trim().length > 0)

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
  if (clarification.value) return []
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
  if (!cg?.groups?.length || !hasRenderedResponse.value) return null
  return cg
})

const isDayPlan = computed(() => cardGroups.value?.kind === 'day_plan')
const isSmartLanes = computed(() => cardGroups.value?.kind === 'smart_lanes')
const isWeekPlan = computed(() => cardGroups.value?.kind === 'week_plan')
// TASK-1820: weekly review cards show ALREADY-COMPLETED tasks → read-only
// (no done-toggle / start-timer actions), but still clickable to open the task.
const isWeeklyReview = computed(() => cardGroups.value?.kind === 'weekly_review')
const liveCardGroups = computed(() => {
  const groups = cardGroups.value?.groups ?? []
  return groups
    .map(group => ({
      ...group,
      tasks: liveTasks(group.tasks).filter(task =>
        !dismissedCardTaskIds.value.has(task.id) &&
        !(isWeekPlan.value && wasPostponedOutOfPlan(task)),
      ),
    }))
    .filter(group => group.tasks.length > 0 || (group.newTasks?.length ?? 0) > 0)
})
const allCardTasks = computed(() =>
  liveCardGroups.value.flatMap(group => group.tasks.map(task => ({ ...task, groupName: group.name }))),
)
function normalizeInlineMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[*_`~()[\]{}"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitInlineContent(content: string, splitSentences: boolean): string[] {
  const lines = content
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
  if (!splitSentences) return lines

  return lines.flatMap(line => {
    if (line.length < 120) return [line]
    const sentenceParts = line
      .split(/(?<=[.!?。！？؟])\s+/u)
      .map(part => part.trim())
      .filter(Boolean)
    return sentenceParts.length > 1 ? sentenceParts : [line]
  })
}

const inlineContentBlocks = computed(() => {
  const content = (props.message.content || '').trim()
  if (!cardGroups.value) return []
  const used = new Set<string>()
  const blocks = splitInlineContent(content, isWeekPlan.value)
    .map((line, index) => {
      const normalizedLine = normalizeInlineMatchText(line)
      const tasks = allCardTasks.value.filter(task => {
        if (!task.id || used.has(task.id) || !task.title) return false
        return normalizedLine.includes(normalizeInlineMatchText(task.title))
      })
      for (const task of tasks) used.add(task.id)
      return { key: `line-${index}`, html: sanitizeMarkdownHtml(md.render(line)), tasks }
    })
  if (isWeekPlan.value) {
    const groundedBlocks = allCardTasks.value
      .filter(task => task.id && !used.has(task.id))
      .map((task, index) => {
        const title = String(task.title || '').trim() || '(untitled)'
        const reason = String(task.reason || '').trim()
        const line = reason ? `**${title}** - ${reason}` : `**${title}**`
        used.add(task.id)
        return {
          key: `grounded-week-plan-${index}-${task.id}`,
          html: sanitizeMarkdownHtml(md.render(line)),
          tasks: [task],
        }
      })
    blocks.push(...groundedBlocks)
  }
  return blocks
})
const inlineTaskIds = computed(() => new Set(inlineContentBlocks.value.flatMap(block => block.tasks.map(task => task.id))))
const hasInlineCardLayout = computed(() => inlineTaskIds.value.size > 0)
const remainingCardGroups = computed(() => {
  if (!hasInlineCardLayout.value) return liveCardGroups.value
  return liveCardGroups.value
    .map(group => ({ ...group, tasks: group.tasks.filter(task => !inlineTaskIds.value.has(task.id)) }))
    .filter(group => group.tasks.length > 0 || (group.newTasks?.length ?? 0) > 0)
})
const hasBottomCardGroups = computed(() =>
  !!cardGroups.value && !isWeekPlan.value && (isDayPlan.value || isSmartLanes.value || remainingCardGroups.value.length > 0),
)
const hasRenderableMessage = computed(() => {
  if (isUser.value) return true
  return Boolean(
    isThinking.value ||
    hasRenderedResponse.value ||
    hasError.value ||
    hasActions.value ||
    clarification.value ||
    (weeklyPlan.value && hasVisibleWeeklyPlanContent.value) ||
    scheduleQuestion.value ||
    toolResults.value.length > 0 ||
    cardGroups.value ||
    hasInlineCardLayout.value ||
    hasBottomCardGroups.value,
  )
})
const dayPlanTaskCount = computed(() => {
  const groups = liveCardGroups.value
  return groups.reduce((sum, group) => sum + group.tasks.length, 0)
})
const smartLaneApplyCount = computed(() => {
  const groups = liveCardGroups.value
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
    await recordRecommendationFeedbackForTask(taskId, 'accept', undefined, true)
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
    await recordRecommendationFeedbackForTask(taskId, 'timeblock', undefined, true)
  } catch (err) {
    console.error('[ChatMessage] Start timer failed:', err)
  } finally {
    delete actionLoading.value[taskId]
  }
}

async function dismissCardTask(taskId: string, event: MouseEvent) {
  event.stopPropagation()
  dismissedCardTaskIds.value = new Set([...dismissedCardTaskIds.value, taskId])
  await recordRecommendationFeedbackForTask(taskId, 'dismiss', 'not_important')
}

async function postponeCardTask(taskId: string, event: MouseEvent) {
  event.stopPropagation()
  dismissedCardTaskIds.value = new Set([...dismissedCardTaskIds.value, taskId])
  await recordRecommendationFeedbackForTask(taskId, 'postpone', 'low_energy', false, {
    revisitAt: feedbackRevisitIso('next_week'),
  })
}

function recommendationEntityKey(rec: WeeklyPlanRecommendation): string | undefined {
  return rec.primaryTaskId ? `task:${rec.primaryTaskId}` : undefined
}

function recommendationProjectEntityKey(rec: WeeklyPlanRecommendation): string | undefined {
  const task = taskMap.value.get(rec.primaryTaskId)
  if (task?.projectId) return `project:${task.projectId}`
  return undefined
}

function feedbackStatusLabel(action: AIRecommendationFeedbackInput['action'], locale: 'he' | 'en'): string {
  if (locale === 'he') {
    if (action === 'postpone') return 'נדחה ונשמר כמשוב'
    if (action === 'dismiss') return 'הוסר ונשמר כמשוב'
    if (action === 'simplify') return 'נשמר: פחות עומס'
    if (action === 'explain') return 'נשמר: צריך הסבר'
    if (action === 'timeblock') return 'נשמר כאיתות חיובי'
    return 'נשמר כמשוב'
  }
  if (action === 'postpone') return 'Postponed and saved as feedback'
  if (action === 'dismiss') return 'Dismissed and saved as feedback'
  if (action === 'simplify') return 'Saved: too much'
  if (action === 'explain') return 'Saved: needs more info'
  if (action === 'timeblock') return 'Saved as positive signal'
  return 'Saved as feedback'
}

function openRecommendationFeedbackChoice(rec: WeeklyPlanRecommendation, action: AIRecommendationFeedbackInput['action']) {
  recommendationFeedbackChoiceOpen.value[rec.sectionId] = action
  if (!recommendationFeedbackReasons.value[rec.sectionId]) {
    recommendationFeedbackReasons.value[rec.sectionId] = defaultFeedbackReason(action)
  }
  if (!recommendationFeedbackRevisit.value[rec.sectionId]) {
    recommendationFeedbackRevisit.value[rec.sectionId] = action === 'postpone' ? 'next_week' : 'none'
  }
}

function cancelRecommendationFeedbackChoice(rec: WeeklyPlanRecommendation) {
  recommendationFeedbackChoiceOpen.value[rec.sectionId] = ''
}

function recommendationFeedbackAction(rec: WeeklyPlanRecommendation): AIRecommendationFeedbackInput['action'] {
  return recommendationFeedbackChoiceOpen.value[rec.sectionId] || 'dismiss'
}

function defaultFeedbackReason(action: AIRecommendationFeedbackInput['action']): AIRecommendationFeedbackInput['reasonCategory'] {
  if (action === 'postpone') return 'low_energy'
  if (action === 'dismiss') return 'not_important'
  if (action === 'simplify') return 'too_much'
  return 'other'
}

function feedbackReasonOptions(action: AIRecommendationFeedbackInput['action'], locale: 'he' | 'en'): Array<{ value: AIRecommendationFeedbackInput['reasonCategory']; label: string }> {
  const labels: Record<NonNullable<AIRecommendationFeedbackInput['reasonCategory']>, { en: string; he: string }> = {
    too_hard: { en: 'Too hard now', he: 'קשה מדי עכשיו' },
    low_energy: { en: 'Low energy', he: 'אנרגיה נמוכה' },
    not_important: { en: 'Not important', he: 'לא חשוב' },
    wrong_context: { en: 'Wrong context', he: 'הקשר שגוי' },
    already_done: { en: 'Already done', he: 'כבר נעשה' },
    needs_more_info: { en: 'Needs info', he: 'חסר מידע' },
    too_much: { en: 'Too much', he: 'יותר מדי' },
    other: { en: 'Other', he: 'אחר' },
  }
  const values: Array<NonNullable<AIRecommendationFeedbackInput['reasonCategory']>> = action === 'postpone'
    ? ['low_energy', 'too_hard', 'needs_more_info', 'other']
    : action === 'dismiss'
      ? ['not_important', 'wrong_context', 'already_done', 'other']
      : ['too_much', 'too_hard', 'low_energy', 'other']
  return values.map(value => ({ value, label: labels[value][locale] }))
}

function feedbackRevisitOptions(locale: 'he' | 'en'): Array<{ value: 'tomorrow' | 'next_week' | 'later' | 'none'; label: string }> {
  return locale === 'he'
    ? [
        { value: 'tomorrow', label: 'מחר' },
        { value: 'next_week', label: 'שבוע הבא' },
        { value: 'later', label: 'מאוחר יותר' },
        { value: 'none', label: 'בלי תזכורת' },
      ]
    : [
        { value: 'tomorrow', label: 'Tomorrow' },
        { value: 'next_week', label: 'Next week' },
        { value: 'later', label: 'Later' },
        { value: 'none', label: 'No revisit' },
      ]
}

function feedbackRevisitIso(choice: 'tomorrow' | 'next_week' | 'later' | 'none' | undefined): string | null {
  if (!choice || choice === 'none') return null
  const date = new Date()
  const days = choice === 'tomorrow' ? 1 : choice === 'next_week' ? 7 : 14
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

async function applyRecommendationFeedbackCommand(
  feedback: AIRecommendationFeedbackInput,
  sourcePrompt: string,
) {
  const commandId = `memory-feedback:${feedback.recommendationId}:${feedback.action}`
  const batch = aiActionCommands.buildAICommandBatchPreview({
    sourcePrompt,
    sourceRunId: props.message.id,
    sourceMessageId: props.message.id,
    dataUsed: {
      messageId: props.message.id,
      recommendationId: feedback.recommendationId,
      taskId: feedback.taskId,
      entityKey: feedback.entityKey,
    },
    commands: [{
      id: commandId,
      kind: 'memory.feedback.record',
      feedback,
      confidence: 0.95,
      impact: 'low',
    }],
    tasks: taskStore.tasks,
  })
  await aiActionCommands.applyAICommandBatch(batch, {
    selectedCommandIds: [commandId],
    taskStore,
    memoryStore: aiMemoryDb as AICommandMemoryStore,
  })
}

async function recordRecommendationFeedback(
  rec: WeeklyPlanRecommendation,
  action: AIRecommendationFeedbackInput['action'],
  reasonCategory?: AIRecommendationFeedbackInput['reasonCategory'],
  implicitPositive = false,
  options: Pick<AIRecommendationFeedbackInput, 'freeText' | 'revisitAt' | 'outcomeSignals'> = {},
) {
  const key = `${rec.sectionId}:${action}`
  if (recommendationFeedbackLoading.value[key]) return
  recommendationFeedbackLoading.value[key] = action
  const shouldSuppress = ['dismiss', 'postpone', 'simplify'].includes(action)
  if (shouldSuppress) {
    dismissedCardTaskIds.value = new Set([...dismissedCardTaskIds.value, ...weeklyPlanTaskIds(rec)])
    suppressedRecommendationIds.value[rec.sectionId] = true
  }
  try {
    await applyRecommendationFeedbackCommand({
      generatedPlanId: weeklyPlan.value?.requestId,
      recommendationId: rec.sectionId,
      taskId: rec.primaryTaskId,
      entityKey: recommendationEntityKey(rec),
      action,
      reasonCategory,
      freeText: options.freeText,
      revisitAt: options.revisitAt,
      outcomeSignals: {
        ...(options.outcomeSignals ?? {}),
        primaryTaskId: rec.primaryTaskId,
        relatedTaskIds: rec.relatedTaskIds,
        projectEntityKey: recommendationProjectEntityKey(rec),
      },
      implicitPositive,
      sourceMessageId: props.message.id,
    }, 'weekly recommendation feedback card')
    recommendationFeedbackChoiceOpen.value[rec.sectionId] = ''
    recommendationFeedbackStatus.value[rec.sectionId] = feedbackStatusLabel(action, weeklyPlan.value?.locale ?? 'en')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes('authenticated user')) {
      console.error('[ChatMessage] Recommendation feedback failed:', err)
    }
    recommendationFeedbackStatus.value[rec.sectionId] = weeklyPlan.value?.locale === 'he'
      ? 'המשוב מקומי עד כניסה לחשבון'
      : 'Feedback is local until signed in'
  } finally {
    delete recommendationFeedbackLoading.value[key]
  }
}

async function saveRecommendationFeedbackChoice(rec: WeeklyPlanRecommendation) {
  const action = recommendationFeedbackChoiceOpen.value[rec.sectionId]
  if (!action) return
  const reason = recommendationFeedbackReasons.value[rec.sectionId] ?? defaultFeedbackReason(action)
  const revisitAt = action === 'postpone'
    ? feedbackRevisitIso(recommendationFeedbackRevisit.value[rec.sectionId])
    : null
  await recordRecommendationFeedback(rec, action, reason, false, { revisitAt })
}

function clarificationDebugLines(card: AIClarificationArtifact): string[] {
  const lines: string[] = []
  const pendingWrites = pendingAIMemoryWriteCount()
  if (pendingWrites > 0) {
    lines.push(`memory sync: ${pendingWrites} queued write${pendingWrites === 1 ? '' : 's'}`)
  }
  if (card.coverage) {
    lines.push(`coverage ${Math.round(card.coverage.score * 100)}% / ${card.coverage.materiality}`)
    if (card.coverage.missing.length) lines.push(`missing: ${card.coverage.missing.join(', ')}`)
  }
  if (card.debug?.retrieval) {
    const retrieval = card.debug.retrieval
    const feedback = retrieval.feedbackCount ? `, ${retrieval.feedbackCount} feedback` : ''
    lines.push(`memory: ${retrieval.entityKeyCount} keys, ${retrieval.eventCount} events${feedback}, ${retrieval.elapsedMs ?? '?'}ms${retrieval.timedOut ? ', timed out' : ''}`)
    const slowStages = slowestMemoryStages(retrieval.stageTimings)
    if (slowStages.length) lines.push(`slow memory stage: ${slowStages.join(', ')}`)
    const lifecycle = retrieval.lifecycle
    if (lifecycle) {
      const parts: string[] = []
      if (lifecycle.refreshEntityKeys.length) parts.push(`${lifecycle.refreshEntityKeys.length} need refresh`)
      if (lifecycle.summarizeEntityKeys.length) parts.push(`${lifecycle.summarizeEntityKeys.length} need summary`)
      if (lifecycle.archiveEventCount) parts.push(`${lifecycle.archiveEventCount} old events`)
      if (lifecycle.lowConfidenceEntityCount) parts.push(`${lifecycle.lowConfidenceEntityCount} low confidence`)
      if (parts.length) lines.push(`memory lifecycle: ${parts.join(', ')}`)
    }
  }
  if (card.debug?.evpi) {
    const evpi = card.debug.evpi
    lines.push(`question value: ${evpi.selectedScore} (${evpi.targetedParameters.join(', ')})`)
  }
  if (card.debug?.reason) lines.push(card.debug.reason)
  return lines
}

function slowestMemoryStages(stageTimings?: Record<string, number | undefined>): string[] {
  if (!stageTimings) return []
  return Object.entries(stageTimings)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([stage, ms]) => `${stage} ${ms}ms`)
}

async function recordRecommendationFeedbackForTask(
  taskId: string,
  action: AIRecommendationFeedbackInput['action'],
  reasonCategory?: AIRecommendationFeedbackInput['reasonCategory'],
  implicitPositive = false,
  options: Pick<AIRecommendationFeedbackInput, 'freeText' | 'revisitAt'> = {},
) {
  const rec = weeklyPlanRecommendationForTask(taskId)
  if (rec) {
    await recordRecommendationFeedback(rec, action, reasonCategory, implicitPositive, options)
    return
  }
  await recordInlineTaskFeedback(taskId, action, reasonCategory, implicitPositive, options)
}

async function recordInlineTaskFeedback(
  taskId: string,
  action: AIRecommendationFeedbackInput['action'],
  reasonCategory?: AIRecommendationFeedbackInput['reasonCategory'],
  implicitPositive = false,
  options: Pick<AIRecommendationFeedbackInput, 'freeText' | 'revisitAt'> = {},
) {
  const task = taskMap.value.get(taskId)
  const cardKind = cardGroups.value?.kind || 'task_answer'
  const entityKey = task?.projectId ? `project:${task.projectId}` : `task:${taskId}`
  const locale = effectiveDirection.value === 'rtl' ? 'he' : 'en'
  try {
    await applyRecommendationFeedbackCommand({
      recommendationId: `inline_${cardKind}_${taskId}`,
      taskId,
      entityKey,
      action,
      reasonCategory,
      freeText: options.freeText,
      revisitAt: options.revisitAt,
      implicitPositive,
      sourceMessageId: props.message.id,
      outcomeSignals: {
        cardKind,
        inlineCard: true,
      },
    }, 'inline recommendation feedback card')
    inlineFeedbackStatus.value = feedbackStatusLabel(action, locale)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes('authenticated user')) {
      console.error('[ChatMessage] Inline recommendation feedback failed:', err)
    }
    inlineFeedbackStatus.value = locale === 'he'
      ? 'המשוב מקומי עד כניסה לחשבון'
      : 'Feedback is local until signed in'
  }
}

async function applyDayPlan(event: MouseEvent) {
  event.stopPropagation()
  const plan = cardGroups.value
  if (!plan?.groups?.length || dayPlanApplying.value || dayPlanApplied.value) return
  const visibleGroups = liveCardGroups.value

  dayPlanApplying.value = true
  dayPlanError.value = ''
  try {
    const result = buildDayPlanTaskUpdates(
      visibleGroups,
      taskStore.tasks,
      canvasStore.groups,
    )
    if (result.taskUpdates.length === 0) {
      dayPlanError.value = 'No active tasks to apply.'
      return
    }

    const commands: AICommand[] = result.taskUpdates.map((taskUpdate, index) => ({
      id: `day-plan:${props.message.id}:task-update:${index}:${taskUpdate.id}`,
      kind: 'task.update',
      taskId: taskUpdate.id,
      updates: taskUpdate.updates,
      impact: 'low',
    }))
    const batch = aiActionCommands.buildAICommandBatchPreview({
      sourcePrompt: result.targetGroupName
        ? `Apply AI day plan to ${result.targetGroupName}`
        : 'Apply AI day plan',
      sourceRunId: props.message.id,
      sourceMessageId: props.message.id,
      dataUsed: {
        messageId: props.message.id,
        targetGroupName: result.targetGroupName,
        plannedCount: result.plannedCount,
      },
      commands,
      tasks: taskStore.tasks,
      canvasGroups: canvasStore.groups,
    })
    await aiActionCommands.applyAICommandBatch(batch, {
      selectedCommandIds: commands.map(command => command.id),
      taskStore,
      canvasStore,
    })
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
  const visibleGroups = liveCardGroups.value

  smartLaneApplying.value = true
  smartLaneError.value = ''
  try {
    const laneColors = ['#4ECDC4', '#7C3AED', '#F59E0B', '#10B981', '#EF4444']
    const laneCommands: AICommand[] = visibleGroups.map((group, index) => ({
      id: `smart-lane:${index}:lane`,
      kind: 'lane.create',
      name: group.name?.trim() || `AI Lane ${index + 1}`,
      color: laneColors[index % laneColors.length],
      impact: 'low',
    }))
    const laneBatch = aiActionCommands.buildAICommandBatchPreview({
      sourcePrompt: 'smart lanes lane creation',
      sourceRunId: props.message.id,
      sourceMessageId: props.message.id,
      dataUsed: {
        messageId: props.message.id,
        groupCount: visibleGroups.length,
        groups: visibleGroups.map(group => ({
          name: group.name,
          taskIds: group.tasks.map(task => task.id).filter(Boolean),
          newTaskCount: group.newTasks?.length ?? 0,
        })),
      },
      commands: laneCommands,
      tasks: taskStore.tasks,
      lanes: laneStore.lanes,
    })
    const laneResult = await aiActionCommands.applyAICommandBatch(laneBatch, {
      selectedCommandIds: laneCommands.map(command => command.id),
      taskStore,
      laneStore,
    })
    const laneIdsByCommandId = new Map(laneResult.appliedCommands.map(command => [command.id, command.entityId]))
    const taskCommands: AICommand[] = []

    for (const [index, group] of visibleGroups.entries()) {
      const laneId = laneIdsByCommandId.get(`smart-lane:${index}:lane`)
      if (!laneId) throw new Error(`Smart lane ${index + 1} was not applied`)
      const parentTaskId = group.tasks.length === 1 ? group.tasks[0].id : null

      for (const task of group.tasks) {
        if (!task.id) continue
        taskCommands.push({
          id: `smart-lane:${index}:task-update:${task.id}`,
          kind: 'task.update',
          taskId: task.id,
          updates: { laneId },
          impact: 'low',
        })
      }

      for (const [newTaskIndex, newTask] of (group.newTasks ?? []).entries()) {
        taskCommands.push({
          id: `smart-lane:${index}:task-create:${newTaskIndex}`,
          kind: 'task.create',
          title: newTask.title,
          priority: normalizeTaskPriority(newTask.priority),
          laneId,
          parentTaskId,
          impact: 'low',
        })
      }
    }

    if (taskCommands.length > 0) {
      const taskBatch = aiActionCommands.buildAICommandBatchPreview({
        sourcePrompt: 'smart lanes task assignment',
        sourceRunId: props.message.id,
        sourceMessageId: props.message.id,
        dataUsed: {
          messageId: props.message.id,
          laneIds: Array.from(laneIdsByCommandId.values()),
          taskCommandCount: taskCommands.length,
        },
        commands: taskCommands,
        tasks: taskStore.tasks,
        lanes: laneStore.lanes,
      })
      await aiActionCommands.applyAICommandBatch(taskBatch, {
        selectedCommandIds: taskCommands.map(command => command.id),
        taskStore,
        laneStore,
      })
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
    v-if="hasRenderableMessage"
    class="chat-message"
    :class="{
      'message-user': isUser,
      'message-assistant': isAssistant,
      'message-streaming': isStreaming,
      'message-error': hasError,
      'message-weekly-plan': Boolean(weeklyPlan && hasVisibleWeeklyPlanContent),
      'message-weekly-plan-wide': props.wideMode && Boolean(weeklyPlan && hasVisibleWeeklyPlanContent)
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

      <!-- Clarification Card — one low-overwhelm question before broad planning. -->
      <article
        v-if="clarification"
        class="ai-clarification-message"
        :lang="clarification.locale"
        :dir="clarification.direction"
        data-testid="ai-clarification"
      >
        <header class="ai-clarification-header">
          <div class="weekly-plan-source">
            {{ clarification.progressLabel }}
          </div>
          <h2>{{ clarification.locale === 'he' ? 'שאלה קצרה לפני התכנון' : 'Quick question before planning' }}</h2>
          <p>{{ clarification.summary }}</p>
          <details v-if="clarificationDebugLines(clarification).length" class="ai-debug-details">
            <summary>{{ clarification.locale === 'he' ? 'למה אני שואל?' : 'Why ask?' }}</summary>
            <ul>
              <li v-for="line in clarificationDebugLines(clarification)" :key="line">
                {{ line }}
              </li>
            </ul>
          </details>
        </header>

        <section class="weekly-plan-questions">
          <div v-if="!clarificationInlineMode[clarificationKey(clarification)]" class="weekly-plan-question">
            <div v-if="!clarificationSavedLocal[clarificationKey(clarification)]">
              <p>{{ clarification.question.question }}</p>
              <div v-if="clarification.question.options?.length" class="weekly-question-options">
                <button
                  v-for="option in clarification.question.options"
                  :key="option.id"
                  type="button"
                  class="weekly-question-option"
                  :class="{ selected: clarificationAnswers[clarificationKey(clarification)] === option.id }"
                  :title="option.effect"
                  @click="clarificationAnswers[clarificationKey(clarification)] = option.id"
                >
                  {{ option.label }}
                </button>
              </div>
              <textarea
                v-if="clarification.question.allowFreeText"
                v-model="clarificationFreeText[clarificationKey(clarification)]"
                class="weekly-question-free-text"
                :placeholder="clarification.question.freeTextPlaceholder || (clarification.locale === 'he' ? 'או כתוב הקשר קצר...' : 'Or add brief context...')"
                rows="2"
              />
              <div class="weekly-question-action-row">
                <button
                  type="button"
                  class="weekly-question-apply"
                  :disabled="clarificationApplying || (!clarificationAnswers[clarificationKey(clarification)] && !clarificationFreeText[clarificationKey(clarification)]?.trim())"
                  @click="saveClarificationAnswer(clarification, $event)"
                >
                  <Loader2 v-if="clarificationApplying" :size="13" class="spin" />
                  <CheckCircle2 v-else :size="13" />
                  {{ clarification.locale === 'he' ? 'שמור תשובה' : 'Save answer' }}
                </button>
                <button
                  v-for="action in clarification.actions"
                  :key="action"
                  type="button"
                  class="weekly-question-escape"
                  :title="clarificationActionLabel(action, clarification.locale)"
                  :aria-label="clarificationActionLabel(action, clarification.locale)"
                  :disabled="clarificationApplying"
                  @click="recordClarificationEscape(clarification, action, $event)"
                >
                  <X :size="13" aria-hidden="true" />
                  <span>{{ clarificationActionLabel(action, clarification.locale) }}</span>
                </button>
                <span v-if="clarificationStatus" class="weekly-question-status">
                  {{ clarificationStatus }}
                </span>
              </div>
            </div>
            <div
              v-else-if="clarificationFollowUpSavedLocal[clarificationKey(clarification)]"
              class="clarification-follow-up clarification-saved-state"
              data-testid="ai-clarification-saved"
            >
              <strong>{{ clarification.locale === 'he' ? 'ההקשר נשמר' : 'Context saved' }}</strong>
              <p>
                {{
                  clarification.locale === 'he'
                    ? 'עכשיו אפשר להמשיך לתוכנית קצרה שמבוססת על מה שענית.'
                    : 'Now the chat can continue with a short plan based on what you answered.'
                }}
              </p>
              <div class="weekly-question-action-row">
                <button
                  type="button"
                  class="weekly-question-apply"
                  @click="continueAfterClarification(clarification, $event)"
                >
                  <CheckCircle2 :size="13" />
                  {{ clarification.locale === 'he' ? 'המשך לתוכנית קצרה' : 'Continue with short plan' }}
                </button>
                <span v-if="clarificationStatus" class="weekly-question-status">
                  {{ clarificationStatus }}
                </span>
              </div>
            </div>
            <div v-else class="clarification-follow-up" data-testid="ai-clarification-follow-up">
              <p>{{ clarificationFollowUpPrompt(clarification) }}</p>
              <div class="weekly-question-options">
                <button
                  v-for="option in clarificationFollowUpOptions(clarification)"
                  :key="option.id"
                  type="button"
                  class="weekly-question-option"
                  :class="{ selected: clarificationFollowUpAnswers[clarificationFollowUpInputKey(clarification)] === option.id }"
                  :disabled="clarificationFollowUpSavedLocal[clarificationKey(clarification)]"
                  @click="clarificationFollowUpAnswers[clarificationFollowUpInputKey(clarification)] = option.id"
                >
                  {{ option.label }}
                </button>
              </div>
              <textarea
                v-model="clarificationFollowUpFreeText[clarificationFollowUpInputKey(clarification)]"
                class="weekly-question-free-text"
                :placeholder="clarificationFollowUpPlaceholder(clarification)"
                :disabled="clarificationFollowUpSavedLocal[clarificationKey(clarification)]"
                rows="2"
              />
              <div class="weekly-question-action-row">
                <button
                  type="button"
                  class="weekly-question-apply"
                  :disabled="clarificationFollowUpSavedLocal[clarificationKey(clarification)] || (!clarificationFollowUpAnswers[clarificationFollowUpInputKey(clarification)] && !clarificationFollowUpFreeText[clarificationFollowUpInputKey(clarification)]?.trim())"
                  @click="saveClarificationFollowUp(clarification, $event)"
                >
                  <CheckCircle2 :size="13" />
                  {{ clarificationFollowUpSavedLocal[clarificationKey(clarification)] ? (clarification.locale === 'he' ? 'נשמר' : 'Saved') : (clarification.locale === 'he' ? 'שמור המשך' : 'Save follow-up') }}
                </button>
                <span v-if="clarificationStatus" class="weekly-question-status">
                  {{ clarificationStatus }}
                </span>
              </div>
            </div>
          </div>
          <div v-else class="clarification-inline-result" data-testid="ai-clarification-inline-result">
            <strong>{{ clarificationInlineLabel(clarification) }}</strong>
            <p>{{ clarificationInlineSummary(clarification) }}</p>
            <div class="weekly-plan-cards">
              <template v-for="task in clarificationCandidateTasks(clarification)" :key="`clarify:${task.id}`">
                <button
                  class="task-list-item grouped-card inline-grouped-card"
                  data-testid="ai-clarification-candidate-card"
                  :class="{ 'task-completed': completedTaskIds.has(task.id) || task.status === 'done' }"
                  @click="!isPlanSnapshotCard(task) && openQuickEdit(task, $event)"
                >
                  <span class="task-priority-dot" :style="{ background: priorityColor(task.priority ?? undefined) }" />
                  <div class="grouped-card-body">
                    <span class="task-title" dir="auto">{{ task.title || '(untitled)' }}</span>
                    <div class="task-meta-row">
                      <span v-if="task.daysOverdue" class="task-overdue-badge">{{ task.daysOverdue }}d overdue</span>
                      <span v-else-if="task.dueDate" class="task-due-date">{{ formatRelativeDate(task.dueDate) }}</span>
                      <span v-if="task.status" class="task-status-badge" :class="'status-' + task.status">{{ task.status }}</span>
                    </div>
                  </div>
                  <div class="task-inline-actions" @click.stop>
                    <button
                      v-if="!isPlanSnapshotCard(task) && task.status !== 'done' && !completedTaskIds.has(task.id)"
                      class="inline-action-btn inline-done-btn"
                      :class="{ loading: actionLoading[task.id] === 'done' }"
                      title="Mark done"
                      @click="markTaskDone(task.id, $event)"
                    >
                      <Loader2 v-if="actionLoading[task.id] === 'done'" :size="12" class="spin" />
                      <CheckCircle2 v-else :size="12" />
                    </button>
                    <button
                      v-if="!isPlanSnapshotCard(task) && !timerStartedTaskIds.has(task.id)"
                      class="inline-action-btn inline-timer-btn"
                      :class="{ loading: actionLoading[task.id] === 'timer' }"
                      title="Start timer"
                      @click="startTaskTimer(task.id, $event)"
                    >
                      <Loader2 v-if="actionLoading[task.id] === 'timer'" :size="12" class="spin" />
                      <Play v-else :size="12" />
                    </button>
                  </div>
                </button>
              </template>
            </div>
            <span v-if="clarificationStatus" class="weekly-question-status">
              {{ clarificationStatus }}
            </span>
          </div>
        </section>
      </article>

      <!-- Structured Weekly Plan — rendered from task IDs, not markdown cards. -->
      <article
        v-else-if="weeklyPlan && hasVisibleWeeklyPlanContent"
        class="weekly-plan-message"
        :lang="weeklyPlan.locale"
        :dir="weeklyPlan.direction"
        data-testid="weekly-plan"
      >
        <header class="weekly-plan-header">
          <div v-if="weeklyPlan.source === 'quick_draft'" class="weekly-plan-source">
            {{ weeklyPlanSourceLabel() }}
          </div>
          <h2>{{ weeklyPlan.headline }}</h2>
          <p>{{ weeklyPlan.weekRead.summary }}</p>
          <p v-if="weeklyPlan.weekRead.mainTradeoff && !isCompactWeeklyPlan" class="weekly-plan-muted">
            {{ weeklyPlan.weekRead.mainTradeoff }}
          </p>
        </header>

        <section
          v-if="visibleWeeklyQuestions.length"
          class="weekly-plan-questions"
          data-testid="weekly-plan-questions"
        >
          <strong>{{ weeklyPlan.locale === 'he' ? 'שאלה קצרה לפני הדירוג' : 'Quick question before ranking' }}</strong>
          <div
            v-for="question in visibleWeeklyQuestions"
            :key="question.id || question.question"
            class="weekly-plan-question"
          >
            <p>{{ question.question }}</p>
            <template v-if="!showWeeklyQuestionStatus(question)">
              <div v-if="question.options?.length" class="weekly-question-options">
                <button
                  v-for="option in question.options"
                  :key="option.id"
                  type="button"
                  class="weekly-question-option"
                  :class="{ selected: weeklyQuestionAnswers[question.id || question.question] === option.id }"
                  :title="option.effect"
                  @click="weeklyQuestionAnswers[question.id || question.question] = option.id"
                >
                  {{ option.label }}
                </button>
              </div>
              <textarea
                v-if="question.allowFreeText"
                v-model="weeklyQuestionFreeText[question.id || question.question]"
                class="weekly-question-free-text"
                :placeholder="question.freeTextPlaceholder || (weeklyPlan.locale === 'he' ? 'או כתוב הקשר קצר...' : 'Or add brief context...')"
                rows="2"
              />
              <div class="weekly-question-action-row">
                <button
                  type="button"
                  class="weekly-question-apply"
                  :class="{ 'weekly-question-apply-icon': isWeeklyFollowUpAction(question) }"
                  :title="weeklyQuestionApplyLabel(question)"
                  :aria-label="weeklyQuestionApplyLabel(question)"
                  :disabled="weeklyQuestionApplying[weeklyQuestionKey(question)] || (!weeklyQuestionAnswers[weeklyQuestionKey(question)] && !weeklyQuestionFreeText[weeklyQuestionKey(question)]?.trim())"
                  @click="applyWeeklyQuestion(question, $event)"
                >
                  <Loader2 v-if="weeklyQuestionApplying[weeklyQuestionKey(question)]" :size="13" class="spin" />
                  <Plus v-else-if="isWeeklyFollowUpAction(question)" :size="14" aria-hidden="true" />
                  <CheckCircle2 v-else :size="13" aria-hidden="true" />
                  <span :class="{ 'sr-only': isWeeklyFollowUpAction(question) }">
                    {{ weeklyQuestionApplyLabel(question) }}
                  </span>
                </button>
                <button
                  type="button"
                  class="weekly-question-escape"
                  :disabled="weeklyQuestionApplying[weeklyQuestionKey(question)]"
                  @click="recordWeeklyQuestionEscape(question, 'generate_current', $event)"
                >
                  <X :size="13" aria-hidden="true" />
                  <span>{{ weeklyPlan.locale === 'he' ? 'צור תוכנית עכשיו' : 'Generate now' }}</span>
                </button>
                <button
                  type="button"
                  class="weekly-question-escape"
                  :disabled="weeklyQuestionApplying[weeklyQuestionKey(question)]"
                  @click="recordWeeklyQuestionEscape(question, 'pause_save', $event)"
                >
                  <X :size="13" aria-hidden="true" />
                  <span>{{ weeklyPlan.locale === 'he' ? 'עצור ושמור' : 'Stop and save' }}</span>
                </button>
              </div>
            </template>
            <div v-else class="weekly-question-action-row">
              <span v-if="showWeeklyQuestionStatus(question)" class="weekly-question-status">
                {{ weeklyQuestionApplied[weeklyQuestionKey(question)] }}
              </span>
              <template v-if="weeklyFollowUpDuplicates[weeklyQuestionKey(question)]">
                <button
                  type="button"
                  class="weekly-question-escape"
                  data-testid="weekly-followup-use-existing"
                  :disabled="weeklyQuestionApplying[weeklyQuestionKey(question)]"
                  @click="revealExistingWeeklyFollowUp(question, $event)"
                >
                  <CheckCircle2 :size="13" aria-hidden="true" />
                  <span>{{ weeklyPlan.locale === 'he' ? 'השתמש בקיימת' : 'Use existing' }}</span>
                </button>
                <button
                  type="button"
                  class="weekly-question-escape"
                  data-testid="weekly-followup-create-another"
                  :disabled="weeklyQuestionApplying[weeklyQuestionKey(question)]"
                  @click="createDuplicateWeeklyFollowUp(question, $event)"
                >
                  <Plus :size="13" aria-hidden="true" />
                  <span>{{ weeklyPlan.locale === 'he' ? 'צור עוד אחת' : 'Create another' }}</span>
                </button>
              </template>
            </div>
          </div>
        </section>

        <div
          v-if="showWeeklyLaneBoard"
          class="weekly-lane-board"
          data-testid="weekly-lane-board"
        >
          <section
            v-for="rec in weeklyPlan.recommendations"
            v-show="!suppressedRecommendationIds[rec.sectionId]"
            :key="rec.sectionId"
            class="weekly-plan-section weekly-plan-section-compact weekly-visual-lane"
            data-testid="weekly-visual-lane"
            :data-section-id="rec.sectionId"
            :data-primary-task-id="rec.primaryTaskId"
          >
            <header class="weekly-lane-header">
              <span class="weekly-lane-rank">{{ rec.rank }}</span>
              <div class="weekly-lane-heading">
                <div class="weekly-plan-focus" dir="auto">
                  {{ weeklyPlan.locale === 'he' ? 'נתיב' : 'Lane' }}
                </div>
                <h3 dir="auto">
                  {{ weeklyLaneTitle(rec) }}
                </h3>
                <p dir="auto">
                  {{ weeklyLaneSubtitle(rec) }}
                </p>
              </div>
              <button
                v-if="!props.wideMode"
                type="button"
                class="weekly-open-lane-view"
                data-testid="weekly-open-lane-view"
                @click.stop="emit('requestWide')"
              >
                <Maximize2 :size="13" />
                <span>{{ weeklyPlan.locale === 'he' ? 'פתח רחב' : 'Wide' }}</span>
              </button>
            </header>
            <div class="weekly-lane-content">
              <div class="weekly-lane-summary">
                <p>{{ rec.whyThisWeek }}</p>
                <p class="weekly-next-action">
                  <strong>{{ weeklyPlan.locale === 'he' ? 'הצעד הבא' : 'Next' }}:</strong>
                  {{ rec.nextAction }}
                </p>
              </div>
              <div class="weekly-lane-rail">
                <div
                  class="weekly-lane-track"
                  data-testid="weekly-lane-track"
                >
                  <template v-for="taskId in weeklyPlanTaskIds(rec)" :key="`${rec.sectionId}:lane:${taskId}`">
                    <button
                      v-if="taskCardFromId(taskId)"
                      class="weekly-lane-task"
                      :class="{
                        'weekly-lane-task-primary': taskId === rec.primaryTaskId,
                        'task-completed': completedTaskIds.has(taskId) || taskCardFromId(taskId)?.status === 'done',
                      }"
                      :data-testid="taskId === rec.primaryTaskId ? 'inline-plan-card' : undefined"
                      @click="!isPlanSnapshotCard(taskCardFromId(taskId)) && openQuickEdit(taskCardFromId(taskId)!, $event)"
                    >
                      <span class="task-priority-dot" :style="{ background: priorityColor(taskCardFromId(taskId)?.priority ?? undefined) }" />
                      <span class="weekly-lane-task-body">
                        <span
                          class="weekly-lane-task-title"
                          :data-testid="taskId === rec.primaryTaskId ? undefined : 'weekly-related-chip'"
                          dir="auto"
                        >
                          {{ taskCardFromId(taskId)?.title || '(untitled)' }}
                        </span>
                        <span class="sr-only" data-testid="weekly-lane-task" />
                        <span v-if="weeklyPlanTaskStaleLabel(taskCardFromId(taskId))" class="grouped-card-reason" dir="auto">
                          {{ weeklyPlanTaskStaleLabel(taskCardFromId(taskId)) }}
                        </span>
                        <span class="task-meta-row">
                          <span v-if="taskCardFromId(taskId)?.daysOverdue" class="task-overdue-badge">{{ taskCardFromId(taskId)?.daysOverdue }}d overdue</span>
                          <span v-else-if="taskCardFromId(taskId)?.dueDate" class="task-due-date">{{ formatRelativeDate(taskCardFromId(taskId)?.dueDate ?? '') }}</span>
                          <span v-if="taskCardFromId(taskId)?.status" class="task-status-badge" :class="'status-' + taskCardFromId(taskId)?.status">{{ taskCardFromId(taskId)?.status }}</span>
                        </span>
                      </span>
                    </button>
                    <div v-else class="weekly-missing-task" data-testid="inline-plan-card-missing">
                      {{ weeklyPlan.locale === 'he' ? 'המשימה כבר לא קיימת' : 'Task no longer exists' }}
                    </div>
                  </template>
                </div>
              </div>
            </div>
            <div class="weekly-feedback-row" @click.stop>
              <button
                type="button"
                class="weekly-feedback-btn"
                :disabled="Boolean(recommendationFeedbackLoading[`${rec.sectionId}:accept`])"
                @click="recordRecommendationFeedback(rec, 'accept', undefined, true)"
              >
                {{ weeklyPlan.locale === 'he' ? 'קבל' : 'Accept' }}
              </button>
              <button
                type="button"
                class="weekly-feedback-btn"
                :disabled="Boolean(recommendationFeedbackLoading[`${rec.sectionId}:postpone`])"
                @click="openRecommendationFeedbackChoice(rec, 'postpone')"
              >
                {{ weeklyPlan.locale === 'he' ? 'דחה' : 'Postpone' }}
              </button>
              <button
                type="button"
                class="weekly-feedback-btn"
                :disabled="Boolean(recommendationFeedbackLoading[`${rec.sectionId}:dismiss`])"
                @click="openRecommendationFeedbackChoice(rec, 'dismiss')"
              >
                {{ weeklyPlan.locale === 'he' ? 'לא חשוב' : 'Not important' }}
              </button>
              <button
                type="button"
                class="weekly-feedback-btn"
                :disabled="Boolean(recommendationFeedbackLoading[`${rec.sectionId}:simplify`])"
                @click="openRecommendationFeedbackChoice(rec, 'simplify')"
              >
                {{ weeklyPlan.locale === 'he' ? 'יותר מדי' : 'Too much' }}
              </button>
              <span v-if="recommendationFeedbackStatus[rec.sectionId]" class="weekly-question-status">
                {{ recommendationFeedbackStatus[rec.sectionId] }}
              </span>
            </div>
            <div
              v-if="recommendationFeedbackChoiceOpen[rec.sectionId]"
              class="weekly-feedback-detail"
              data-testid="weekly-feedback-detail"
              @click.stop
            >
              <span class="weekly-feedback-detail-label">
                {{ weeklyPlan.locale === 'he' ? 'למה?' : 'Why?' }}
              </span>
              <div class="weekly-feedback-choice-row">
                <button
                  v-for="reason in feedbackReasonOptions(recommendationFeedbackAction(rec), weeklyPlan.locale)"
                  :key="`${rec.sectionId}:compact:reason:${reason.value}`"
                  type="button"
                  class="weekly-feedback-btn"
                  :class="{ selected: recommendationFeedbackReasons[rec.sectionId] === reason.value }"
                  @click="recommendationFeedbackReasons[rec.sectionId] = reason.value"
                >
                  {{ reason.label }}
                </button>
              </div>
              <template v-if="recommendationFeedbackChoiceOpen[rec.sectionId] === 'postpone'">
                <span class="weekly-feedback-detail-label">
                  {{ weeklyPlan.locale === 'he' ? 'להחזיר מתי?' : 'Revisit when?' }}
                </span>
                <div class="weekly-feedback-choice-row">
                  <button
                    v-for="option in feedbackRevisitOptions(weeklyPlan.locale)"
                    :key="`${rec.sectionId}:compact:revisit:${option.value}`"
                    type="button"
                    class="weekly-feedback-btn"
                    :class="{ selected: recommendationFeedbackRevisit[rec.sectionId] === option.value }"
                    @click="recommendationFeedbackRevisit[rec.sectionId] = option.value"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </template>
              <div class="weekly-feedback-detail-actions">
                <button
                  type="button"
                  class="weekly-question-apply"
                  :disabled="Boolean(recommendationFeedbackLoading[`${rec.sectionId}:${recommendationFeedbackChoiceOpen[rec.sectionId]}`])"
                  @click="saveRecommendationFeedbackChoice(rec)"
                >
                  <Loader2 v-if="recommendationFeedbackLoading[`${rec.sectionId}:${recommendationFeedbackChoiceOpen[rec.sectionId]}`]" :size="13" class="spin" />
                  <CheckCircle2 v-else :size="13" />
                  {{ weeklyPlan.locale === 'he' ? 'שמור משוב' : 'Save feedback' }}
                </button>
                <button
                  type="button"
                  class="weekly-feedback-btn"
                  @click="cancelRecommendationFeedbackChoice(rec)"
                >
                  {{ weeklyPlan.locale === 'he' ? 'בטל' : 'Cancel' }}
                </button>
              </div>
            </div>
          </section>
        </div>

        <section
          v-for="rec in showWeeklyLaneBoard ? [] : weeklyPlan.recommendations"
          v-show="!suppressedRecommendationIds[rec.sectionId]"
          :key="rec.sectionId"
          class="weekly-plan-section"
          :data-section-id="rec.sectionId"
          :data-primary-task-id="rec.primaryTaskId"
        >
          <div class="weekly-plan-focus" dir="auto">
            {{ isCompactWeeklyPlan && weeklyPlan.locale === 'he' ? 'נתיב' : isCompactWeeklyPlan ? 'Lane' : rec.focusArea }}
            <template v-if="isCompactWeeklyPlan">
              : {{ rec.focusArea }}
            </template>
          </div>
          <h3>{{ rec.rank }}. {{ rec.title }}</h3>
          <p v-if="!isCompactWeeklyPlan">
            {{ rec.whyThisMatters }}
          </p>
          <p>{{ rec.whyThisWeek }}</p>
          <p v-if="rec.riskIfIgnored && !isCompactWeeklyPlan" class="weekly-plan-muted">
            {{ rec.riskIfIgnored }}
          </p>
          <p class="weekly-next-action">
            <strong>{{ weeklyPlan.locale === 'he' ? 'הצעד הבא' : 'Next action' }}:</strong>
            {{ rec.nextAction }}
          </p>
          <div class="weekly-feedback-row" @click.stop>
            <button
              type="button"
              class="weekly-feedback-btn"
              :disabled="Boolean(recommendationFeedbackLoading[`${rec.sectionId}:accept`])"
              @click="recordRecommendationFeedback(rec, 'accept', undefined, true)"
            >
              {{ weeklyPlan.locale === 'he' ? 'קבל' : 'Accept' }}
            </button>
            <button
              type="button"
              class="weekly-feedback-btn"
              :disabled="Boolean(recommendationFeedbackLoading[`${rec.sectionId}:postpone`])"
              @click="openRecommendationFeedbackChoice(rec, 'postpone')"
            >
              {{ weeklyPlan.locale === 'he' ? 'דחה' : 'Postpone' }}
            </button>
            <button
              type="button"
              class="weekly-feedback-btn"
              :disabled="Boolean(recommendationFeedbackLoading[`${rec.sectionId}:dismiss`])"
              @click="openRecommendationFeedbackChoice(rec, 'dismiss')"
            >
              {{ weeklyPlan.locale === 'he' ? 'לא חשוב' : 'Not important' }}
            </button>
            <button
              type="button"
              class="weekly-feedback-btn"
              :disabled="Boolean(recommendationFeedbackLoading[`${rec.sectionId}:simplify`])"
              @click="openRecommendationFeedbackChoice(rec, 'simplify')"
            >
              {{ weeklyPlan.locale === 'he' ? 'יותר מדי' : 'Too much' }}
            </button>
            <span v-if="recommendationFeedbackStatus[rec.sectionId]" class="weekly-question-status">
              {{ recommendationFeedbackStatus[rec.sectionId] }}
            </span>
          </div>
          <div
            v-if="recommendationFeedbackChoiceOpen[rec.sectionId]"
            class="weekly-feedback-detail"
            data-testid="weekly-feedback-detail"
            @click.stop
          >
            <span class="weekly-feedback-detail-label">
              {{ weeklyPlan.locale === 'he' ? 'למה?' : 'Why?' }}
            </span>
            <div class="weekly-feedback-choice-row">
              <button
                v-for="reason in feedbackReasonOptions(recommendationFeedbackAction(rec), weeklyPlan.locale)"
                :key="`${rec.sectionId}:reason:${reason.value}`"
                type="button"
                class="weekly-feedback-btn"
                :class="{ selected: recommendationFeedbackReasons[rec.sectionId] === reason.value }"
                @click="recommendationFeedbackReasons[rec.sectionId] = reason.value"
              >
                {{ reason.label }}
              </button>
            </div>
            <template v-if="recommendationFeedbackChoiceOpen[rec.sectionId] === 'postpone'">
              <span class="weekly-feedback-detail-label">
                {{ weeklyPlan.locale === 'he' ? 'להחזיר מתי?' : 'Revisit when?' }}
              </span>
              <div class="weekly-feedback-choice-row">
                <button
                  v-for="option in feedbackRevisitOptions(weeklyPlan.locale)"
                  :key="`${rec.sectionId}:revisit:${option.value}`"
                  type="button"
                  class="weekly-feedback-btn"
                  :class="{ selected: recommendationFeedbackRevisit[rec.sectionId] === option.value }"
                  @click="recommendationFeedbackRevisit[rec.sectionId] = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </template>
            <div class="weekly-feedback-detail-actions">
              <button
                type="button"
                class="weekly-question-apply"
                :disabled="Boolean(recommendationFeedbackLoading[`${rec.sectionId}:${recommendationFeedbackChoiceOpen[rec.sectionId]}`])"
                @click="saveRecommendationFeedbackChoice(rec)"
              >
                <Loader2 v-if="recommendationFeedbackLoading[`${rec.sectionId}:${recommendationFeedbackChoiceOpen[rec.sectionId]}`]" :size="13" class="spin" />
                <CheckCircle2 v-else :size="13" />
                {{ weeklyPlan.locale === 'he' ? 'שמור משוב' : 'Save feedback' }}
              </button>
              <button
                type="button"
                class="weekly-feedback-btn"
                @click="cancelRecommendationFeedbackChoice(rec)"
              >
                {{ weeklyPlan.locale === 'he' ? 'בטל' : 'Cancel' }}
              </button>
            </div>
          </div>

          <div class="weekly-plan-cards">
            <template v-for="taskId in weeklyPlanTaskIds(rec)" :key="`${rec.sectionId}:${taskId}`">
              <button
                v-if="taskCardFromId(taskId)"
                class="task-list-item grouped-card inline-grouped-card"
                data-testid="inline-plan-card"
                :class="{ 'task-completed': completedTaskIds.has(taskId) || taskCardFromId(taskId)?.status === 'done' }"
                @click="!isPlanSnapshotCard(taskCardFromId(taskId)) && openQuickEdit(taskCardFromId(taskId)!, $event)"
              >
                <span class="task-priority-dot" :style="{ background: priorityColor(taskCardFromId(taskId)?.priority ?? undefined) }" />
                <div class="grouped-card-body">
                  <span class="task-title" dir="auto">{{ taskCardFromId(taskId)?.title || '(untitled)' }}</span>
                  <span v-if="weeklyPlanTaskStaleLabel(taskCardFromId(taskId))" class="grouped-card-reason" dir="auto">
                    {{ weeklyPlanTaskStaleLabel(taskCardFromId(taskId)) }}
                  </span>
                  <div class="task-meta-row">
                    <span v-if="taskCardFromId(taskId)?.daysOverdue" class="task-overdue-badge">{{ taskCardFromId(taskId)?.daysOverdue }}d overdue</span>
                    <span v-else-if="taskCardFromId(taskId)?.dueDate" class="task-due-date">{{ formatRelativeDate(taskCardFromId(taskId)?.dueDate ?? '') }}</span>
                    <span v-if="taskCardFromId(taskId)?.status" class="task-status-badge" :class="'status-' + taskCardFromId(taskId)?.status">{{ taskCardFromId(taskId)?.status }}</span>
                  </div>
                </div>
                <div class="task-inline-actions" @click.stop>
                  <button
                    v-if="!isPlanSnapshotCard(taskCardFromId(taskId)) && taskCardFromId(taskId)?.status !== 'done' && !completedTaskIds.has(taskId)"
                    class="inline-action-btn inline-done-btn"
                    :class="{ loading: actionLoading[taskId] === 'done' }"
                    title="Mark done"
                    @click="markTaskDone(taskId, $event)"
                  >
                    <Loader2 v-if="actionLoading[taskId] === 'done'" :size="12" class="spin" />
                    <CheckCircle2 v-else :size="12" />
                  </button>
                  <button
                    v-if="!isPlanSnapshotCard(taskCardFromId(taskId)) && !timerStartedTaskIds.has(taskId)"
                    class="inline-action-btn inline-timer-btn"
                    :class="{ loading: actionLoading[taskId] === 'timer' }"
                    title="Start timer"
                    @click="startTaskTimer(taskId, $event)"
                  >
                    <Loader2 v-if="actionLoading[taskId] === 'timer'" :size="12" class="spin" />
                    <Play v-else :size="12" />
                  </button>
                  <button
                    class="inline-action-btn inline-postpone-btn"
                    title="Postpone suggestion"
                    aria-label="Postpone suggestion"
                    @click="postponeCardTask(taskId, $event)"
                  >
                    <CalendarClock :size="12" />
                  </button>
                  <button
                    class="inline-action-btn inline-dismiss-btn"
                    title="Hide from these options"
                    aria-label="Hide from these options"
                    @click="dismissCardTask(taskId, $event)"
                  >
                    <X :size="12" />
                  </button>
                  <span v-if="!isPlanSnapshotCard(taskCardFromId(taskId)) && (taskCardFromId(taskId)?.status === 'done' || completedTaskIds.has(taskId))" class="inline-action-done-badge"><CheckCircle2 :size="12" /> Done</span>
                  <span v-if="!isPlanSnapshotCard(taskCardFromId(taskId)) && timerStartedTaskIds.has(taskId)" class="inline-action-timer-badge"><Play :size="12" /> Timer</span>
                </div>
              </button>
              <div v-else class="weekly-missing-task" data-testid="inline-plan-card-missing">
                {{ weeklyPlan.locale === 'he' ? 'המשימה כבר לא קיימת' : 'Task no longer exists' }}
              </div>
            </template>
          </div>
        </section>

        <footer v-if="weeklyPlan.deferrals.length && !isCompactWeeklyPlan" class="weekly-plan-footer">
          <div v-if="weeklyPlan.deferrals.length">
            <strong>{{ weeklyPlan.locale === 'he' ? 'לדחות בכוונה' : 'Intentional deferrals' }}</strong>
            <p v-for="defer in weeklyPlan.deferrals" :key="defer.taskId">
              {{ defer.reason }}
            </p>
          </div>
        </footer>
      </article>

      <!-- Rendered Message Text -->
      <div v-else-if="hasInlineCardLayout" class="inline-response" :dir="effectiveDirection">
        <div v-for="block in inlineContentBlocks" :key="block.key" class="inline-response-block">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="message-text markdown-body inline-message-text" :dir="effectiveDirection" v-html="block.html" />
          <div v-if="block.tasks.length" class="card-group inline-card-group">
            <button
              v-for="task in block.tasks"
              :key="task.id"
              class="task-list-item grouped-card inline-grouped-card"
              data-testid="inline-ai-task-card"
              :class="{ 'task-completed': completedTaskIds.has(task.id) }"
              @click="openQuickEdit(task, $event)"
            >
              <span class="task-priority-dot" :style="{ background: priorityColor(task.priority ?? undefined) }" />
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
                <span v-if="isWeeklyReview" class="inline-action-done-badge"><CheckCircle2 :size="12" /> Done</span>
                <button
                  v-if="!isWeeklyReview && !completedTaskIds.has(task.id)"
                  class="inline-action-btn inline-done-btn"
                  :class="{ loading: actionLoading[task.id] === 'done' }"
                  title="Mark done"
                  @click="markTaskDone(task.id, $event)"
                >
                  <Loader2 v-if="actionLoading[task.id] === 'done'" :size="12" class="spin" />
                  <CheckCircle2 v-else :size="12" />
                </button>
                <button
                  v-if="!isWeeklyReview && !timerStartedTaskIds.has(task.id)"
                  class="inline-action-btn inline-timer-btn"
                  :class="{ loading: actionLoading[task.id] === 'timer' }"
                  title="Start timer"
                  @click="startTaskTimer(task.id, $event)"
                >
                  <Loader2 v-if="actionLoading[task.id] === 'timer'" :size="12" class="spin" />
                  <Play v-else :size="12" />
                </button>
                <button
                  v-if="!isWeeklyReview"
                  class="inline-action-btn inline-postpone-btn"
                  title="Postpone suggestion"
                  aria-label="Postpone suggestion"
                  @click="postponeCardTask(task.id, $event)"
                >
                  <CalendarClock :size="12" />
                </button>
                <button
                  class="inline-action-btn inline-dismiss-btn"
                  title="Hide from these options"
                  aria-label="Hide from these options"
                  @click="dismissCardTask(task.id, $event)"
                >
                  <X :size="12" />
                </button>
                <span v-if="completedTaskIds.has(task.id)" class="inline-action-done-badge"><CheckCircle2 :size="12" /> Done</span>
                <span v-if="timerStartedTaskIds.has(task.id)" class="inline-action-timer-badge"><Play :size="12" /> Timer</span>
              </div>
            </button>
          </div>
        </div>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div
        v-else-if="renderedContent"
        class="message-text markdown-body"
        :dir="effectiveDirection"
        v-html="renderedContent"
      />
      <span v-if="inlineFeedbackStatus" class="weekly-question-status inline-feedback-status">
        {{ inlineFeedbackStatus }}
      </span>

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
      <div v-if="hasBottomCardGroups" class="card-groups">
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
        <div v-for="(group, gi) in remainingCardGroups" :key="'g' + gi" class="card-group">
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
            <span class="task-priority-dot" :style="{ background: priorityColor(task.priority ?? undefined) }" />
            <div class="grouped-card-body">
              <span class="task-title" :dir="direction || 'auto'">{{ task.title || '(untitled)' }}</span>
              <span v-if="task.reason" class="grouped-card-reason" dir="auto">{{ task.reason }}</span>
              <div class="task-meta-row">
                <span v-if="task.daysOverdue" class="task-overdue-badge">{{ task.daysOverdue }}d overdue</span>
                <span v-else-if="task.dueDate" class="task-due-date">{{ formatRelativeDate(task.dueDate) }}</span>
                <span v-if="task.status" class="task-status-badge" :class="'status-' + task.status">{{ task.status }}</span>
              </div>
            </div>
            <div v-if="isWeeklyReview" class="task-inline-actions" @click.stop>
              <span class="inline-action-done-badge"><CheckCircle2 :size="12" /> Done</span>
              <button
                class="inline-action-btn inline-dismiss-btn"
                title="Hide from these options"
                aria-label="Hide from these options"
                @click="dismissCardTask(task.id, $event)"
              >
                <X :size="12" />
              </button>
            </div>
            <div v-else class="task-inline-actions" @click.stop>
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
              <button
                class="inline-action-btn inline-postpone-btn"
                title="Postpone suggestion"
                aria-label="Postpone suggestion"
                @click="postponeCardTask(task.id, $event)"
              >
                <CalendarClock :size="12" />
              </button>
              <button
                class="inline-action-btn inline-dismiss-btn"
                title="Hide from these options"
                aria-label="Hide from these options"
                @click="dismissCardTask(task.id, $event)"
              >
                <X :size="12" />
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
                  :style="{ background: priorityColor(task.priority ?? undefined) }"
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
                  :style="{ background: priorityColor(task.priority ?? undefined) }"
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

:global(.panel-fullscreen .message-weekly-plan),
.message-weekly-plan-wide {
  align-self: center;
  width: min(100%, 1240px);
  margin-inline: 0;
}

:global(.panel-fullscreen .message-weekly-plan) .message-content,
.message-weekly-plan-wide .message-content {
  width: 100%;
}

:global(.panel-fullscreen .message-weekly-plan) .weekly-plan-message,
.message-weekly-plan-wide .weekly-plan-message {
  width: min(calc(100vw - 8rem), 1180px);
  max-width: 100%;
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
.inline-response {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.inline-response-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-block: var(--space-1);
}

.inline-message-text :deep(p),
.inline-message-text :deep(ol),
.inline-message-text :deep(ul) {
  margin-bottom: 0;
}

.inline-card-group {
  margin-top: var(--space-1);
}

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
  gap: var(--space-2_5);
}
.card-group-name {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--brand-primary);
  padding: var(--space-1) var(--space-1) 0;
}
.grouped-card {
  display: flex !important;
  align-items: flex-start;
  gap: var(--space-3);
  padding-block: var(--space-3);
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
  line-height: 1.55;
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

.inline-postpone-btn {
  background: var(--warning-bg-light);
  color: var(--color-warning);
}

.inline-postpone-btn:hover {
  background: var(--color-warning);
  color: white;
  border-color: var(--color-warning);
}

.inline-dismiss-btn {
  background: var(--glass-bg-soft);
  color: var(--text-tertiary);
}

.inline-dismiss-btn:hover {
  background: var(--danger-bg-light);
  color: var(--color-danger);
  border-color: var(--color-danger);
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
   Structured Weekly Plan
   ============================================================================ */

.weekly-plan-message,
.ai-clarification-message {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-block: var(--space-2);
  padding-inline: var(--space-1);
  line-height: 1.48;
  overflow-anchor: none;
}

.ai-clarification-message {
  gap: var(--space-5);
  padding-block: var(--space-3);
}

.weekly-plan-header,
.ai-clarification-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
}

.ai-clarification-header {
  gap: var(--space-2);
}

.weekly-plan-header h2,
.ai-clarification-header h2 {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.weekly-plan-header p,
.ai-clarification-header p,
.weekly-plan-questions p,
.weekly-plan-section p,
.weekly-plan-footer p {
  margin-block: 0;
  color: var(--text-secondary);
}

.ai-debug-details {
  margin-block-start: var(--space-1);
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.ai-debug-details summary {
  width: max-content;
  cursor: pointer;
  color: var(--text-tertiary);
}

.ai-debug-details ul {
  margin: var(--space-1) 0 0;
  padding-inline-start: var(--space-4);
}

.weekly-plan-source {
  align-self: flex-start;
  padding-block: 2px;
  padding-inline: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--warning-bg-light);
  color: var(--color-warning);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.weekly-plan-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2_5);
  padding-block-start: var(--space-4);
  border-block-start: 1px solid var(--glass-border-faint);
}

.weekly-plan-section-compact {
  gap: var(--space-1_5);
  padding-block-start: var(--space-3);
}

.weekly-plan-section-compact h3 {
  font-size: var(--text-sm);
}

.weekly-plan-section-compact .weekly-plan-cards {
  margin-block-start: var(--space-1);
}

.weekly-lane-board {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.weekly-visual-lane {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-2_5);
  min-width: 0;
  padding: var(--space-3);
  border: 1px solid var(--glass-border-faint);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--glass-bg-subtle) 62%, transparent);
}

[dir="rtl"] .weekly-visual-lane {
  grid-template-columns: minmax(0, 1fr);
}

.weekly-lane-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  min-width: 0;
  gap: var(--space-2);
}

[dir="rtl"] .weekly-lane-header {
  grid-column: auto;
}

[dir="rtl"] .weekly-lane-content {
  grid-column: auto;
  grid-row: auto;
}

.weekly-lane-heading {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--space-1);
}

.weekly-lane-heading h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  line-height: 1.25;
}

.weekly-lane-heading p,
.weekly-lane-summary p {
  margin: 0;
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  line-height: 1.45;
}

.weekly-lane-rank {
  display: inline-grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  flex: 0 0 auto;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.weekly-lane-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2_5);
  min-width: 0;
}

.weekly-lane-summary {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-2);
  align-items: baseline;
  min-width: 0;
}

[dir="rtl"] .weekly-lane-summary {
  grid-template-columns: minmax(0, 1fr);
}

.weekly-lane-rail {
  position: relative;
  min-width: 0;
  overflow: visible;
  border: 1px solid var(--glass-border-faint);
  border-radius: var(--radius-sm);
  background:
    linear-gradient(90deg, transparent, color-mix(in srgb, var(--glass-border) 48%, transparent), transparent) 0 50% / 100% 1px no-repeat,
    color-mix(in srgb, var(--glass-bg-subtle) 72%, transparent);
}

.weekly-open-lane-view {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 1.75rem;
  padding-block: 2px;
  padding-inline: var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
}

.weekly-open-lane-view:hover {
  border-color: var(--glass-border-strong);
  color: var(--text-primary);
}

.weekly-lane-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(11rem, 100%), 1fr));
  gap: var(--space-1_5);
  min-width: 0;
  width: 100%;
  padding: var(--space-2);
  overflow: visible;
}

.weekly-lane-task {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: var(--space-1_5);
  width: 100%;
  min-width: 0;
  min-height: 4rem;
  padding: var(--space-2) var(--space-1_5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  color: var(--text-primary);
  text-align: start;
  cursor: pointer;
}

.weekly-lane-task-primary {
  border-color: var(--accent-primary);
  background: var(--accent-bg);
}

.weekly-lane-task:hover {
  border-color: var(--glass-border-strong);
}

.weekly-lane-task-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: var(--space-1);
}

.weekly-lane-task-title {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

:global(.panel-fullscreen .weekly-lane-board),
.message-weekly-plan-wide .weekly-lane-board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
  align-items: stretch;
  gap: var(--space-3);
  width: min(100%, 1240px);
  margin-inline: auto;
}

:global(.panel-fullscreen .weekly-visual-lane),
.message-weekly-plan-wide .weekly-visual-lane {
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    "header"
    "summary"
    "rail"
    "feedback";
  align-content: start;
  gap: var(--space-2_5);
  min-height: 100%;
  padding: var(--space-4);
  border-color: var(--glass-border);
  background: color-mix(in srgb, var(--glass-bg-subtle) 78%, transparent);
}

:global(.panel-fullscreen .weekly-lane-header),
.message-weekly-plan-wide .weekly-lane-header {
  grid-area: header;
}

:global(.panel-fullscreen .weekly-open-lane-view),
.message-weekly-plan-wide .weekly-open-lane-view {
  display: none;
}

:global(.panel-fullscreen .weekly-lane-content),
.message-weekly-plan-wide .weekly-lane-content {
  display: contents;
}

:global(.panel-fullscreen .weekly-lane-summary),
.message-weekly-plan-wide .weekly-lane-summary {
  grid-area: summary;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  padding-block-start: 0;
}

:global(.panel-fullscreen .weekly-lane-rail),
.message-weekly-plan-wide .weekly-lane-rail {
  grid-area: rail;
  min-height: 100%;
}

:global(.panel-fullscreen .weekly-feedback-row),
.message-weekly-plan-wide .weekly-feedback-row {
  grid-area: feedback;
  align-self: end;
}

:global(.panel-fullscreen .weekly-lane-track),
.message-weekly-plan-wide .weekly-lane-track {
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-2);
  padding: var(--space-2_5);
}

:global(.panel-fullscreen .weekly-lane-task),
.message-weekly-plan-wide .weekly-lane-task {
  min-width: 0;
  min-height: 5.25rem;
  padding: var(--space-2_5) var(--space-3);
}

:global(.panel-fullscreen .weekly-lane-task-title),
.message-weekly-plan-wide .weekly-lane-task-title {
  font-size: var(--text-sm);
}

:global(.panel-fullscreen[dir="rtl"] .weekly-visual-lane),
[dir="rtl"] :global(.panel-fullscreen .weekly-visual-lane),
[dir="rtl"] .message-weekly-plan-wide .weekly-visual-lane {
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    "header"
    "summary"
    "rail"
    "feedback";
}

@media (max-width: 860px) {
  :global(.panel-fullscreen .weekly-visual-lane),
  .message-weekly-plan-wide .weekly-visual-lane,
  :global(.panel-fullscreen[dir="rtl"] .weekly-visual-lane),
  [dir="rtl"] :global(.panel-fullscreen .weekly-visual-lane),
  [dir="rtl"] .message-weekly-plan-wide .weekly-visual-lane {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "header"
      "summary"
      "rail"
      "feedback";
  }
}

@media (max-width: 720px) {
  .weekly-visual-lane,
  [dir="rtl"] .weekly-visual-lane {
    grid-template-columns: 1fr;
  }

  [dir="rtl"] .weekly-lane-header,
  [dir="rtl"] .weekly-lane-content {
    grid-column: auto;
    grid-row: auto;
  }

  .weekly-lane-summary,
  [dir="rtl"] .weekly-lane-summary {
    grid-template-columns: 1fr;
  }
}

.weekly-plan-questions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2_5);
  padding: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-subtle);
}

.ai-clarification-message .weekly-plan-questions {
  gap: var(--space-3);
  padding: var(--space-4);
}

.weekly-plan-focus {
  align-self: flex-start;
  max-width: 100%;
  padding-block: 2px;
  padding-inline: var(--space-2);
  border: 1px solid var(--glass-border-faint);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-subtle);
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  line-height: 1.35;
}

.weekly-plan-section h3 {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.weekly-plan-muted {
  color: var(--text-tertiary) !important;
}

.weekly-next-action {
  color: var(--text-primary) !important;
}

.weekly-feedback-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1_5);
}

.weekly-feedback-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-1_5);
  margin-block-start: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-subtle);
}

.weekly-feedback-detail-label {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
  line-height: 1.25;
}

.weekly-feedback-choice-row,
.weekly-feedback-detail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1_5);
}

.weekly-feedback-btn {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding-block: var(--space-0_5);
  padding-inline: var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-subtle);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  line-height: 1.25;
  cursor: pointer;
}

.weekly-feedback-btn.selected {
  border-color: var(--accent-primary);
  color: var(--text-primary);
  background: var(--accent-bg);
}

.weekly-feedback-btn:hover {
  border-color: var(--glass-border-strong);
  color: var(--text-primary);
  background: var(--glass-bg-soft);
}

.weekly-feedback-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.weekly-plan-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-block-start: var(--space-1);
}

.weekly-missing-task {
  padding-block: var(--space-2);
  padding-inline: var(--space-3);
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}

.weekly-plan-footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-block-start: var(--space-3);
  border-block-start: 1px solid var(--glass-border-faint);
  color: var(--text-secondary);
}

.weekly-plan-question {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ai-clarification-message .weekly-plan-question,
.clarification-follow-up,
.clarification-saved-state {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.ai-clarification-message .weekly-plan-question > div {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.weekly-question-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: var(--space-1_5);
}

.weekly-question-option {
  min-height: 32px;
  padding-block: var(--space-1_5);
  padding-inline: var(--space-2_5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-subtle);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  line-height: 1.3;
  text-align: start;
  cursor: pointer;
}

.weekly-question-option:hover,
.weekly-question-option.selected {
  border-color: var(--brand-primary);
  color: var(--text-primary);
  background: var(--glass-bg-soft);
}

.weekly-question-free-text {
  width: 100%;
  min-height: 64px;
  padding-block: var(--space-2_5);
  padding-inline: var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: var(--text-primary);
  font: inherit;
  resize: vertical;
}

.weekly-question-action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1_5);
  margin-block-start: var(--space-1);
}

.weekly-question-apply {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  min-height: 32px;
  padding-block: var(--space-1_5);
  padding-inline: var(--space-3);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  backdrop-filter: blur(8px);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  line-height: 1.3;
  cursor: pointer;
}

.weekly-question-apply:hover:not(:disabled) {
  background: var(--brand-primary-alpha-10);
}

.weekly-question-apply:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.weekly-question-apply-icon {
  width: 32px;
  height: 32px;
  padding: 0;
}

.weekly-question-escape {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-subtle);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  line-height: 1.3;
  cursor: pointer;
}

.weekly-question-escape:hover {
  border-color: var(--glass-border-strong);
  color: var(--text-primary);
  background: var(--glass-bg-soft);
}

.weekly-question-escape:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ai-clarification-message .weekly-question-action-row {
  align-items: stretch;
  gap: var(--space-2);
}

.ai-clarification-message .weekly-question-apply {
  flex: 0 0 auto;
  min-width: 8.5rem;
}

.ai-clarification-message .weekly-question-escape {
  width: auto;
  max-width: 100%;
  height: auto;
  min-height: 32px;
  flex: 0 1 auto;
  padding-block: var(--space-1_5);
  padding-inline: var(--space-2_5);
  white-space: normal;
  text-align: center;
}

.ai-clarification-message .weekly-question-escape svg {
  display: none;
}

.ai-clarification-message .weekly-question-escape span {
  overflow-wrap: anywhere;
}

@media (max-width: 520px) {
  .ai-clarification-message .weekly-question-action-row {
    display: grid;
    grid-template-columns: 1fr;
  }

  .ai-clarification-message .weekly-question-apply,
  .ai-clarification-message .weekly-question-escape {
    width: 100%;
  }
}

.weekly-question-status {
  flex-basis: 100%;
  color: var(--text-secondary);
  font-size: var(--text-xs);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

:dir(rtl).weekly-plan-message {
  text-align: start;
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
