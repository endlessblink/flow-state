/**
 * AI Chat Composable
 *
 * Provides a unified interface for AI chat functionality including:
 * - Sending messages with streaming responses
 * - Context-aware prompts with timer & task statistics
 * - Tool result feedback with undo support
 * - Rate limiting (MAX_TOOLS_PER_RESPONSE)
 * - Confirmation flow for destructive tools
 * - Action button handlers wired to tools
 * - Settings persistence (provider/model)
 *
 * @see TASK-1120, TASK-1186 in MASTER_PLAN.md
 */

import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAIChatStore, type AIActivityEvent, type ChatContext } from '@/stores/aiChat'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useTimerStore } from '@/stores/timer'
import { useAIEventTracking } from '@/composables/useAIEventTracking'
import { type TaskType, type RouterProviderType } from '@/services/ai'
import type { Task } from '@/types/tasks'
import { getSharedRouter, resetSharedRouter } from '@/services/ai/routerFactory'
import { useSettingsStore } from '@/stores/settings'
import { tauriFetch } from '@/services/ai/utils/tauriHttp'
import type { ChatMessage as RouterChatMessage } from '@/services/ai/types'
import {
  executeTool,
  buildOpenAITools,
  buildNativeToolsBehaviorPrompt,
  buildTextToolsBehaviorPrompt,
  parseTextToolCalls,
  MAX_TOOLS_PER_RESPONSE,
  AI_TOOLS,
  type ToolCall,
  type ToolResult,
} from '@/services/ai/tools'
import type { NativeToolCall } from '@/services/ai/types'
import { useAgentChains } from './useAgentChains'
import { optimizeTaskContext, buildTaskStats } from '@/services/ai/pipeline/contextOptimizer'
import { detectLanguage, detectLanguageMismatch } from '@/services/ai/pipeline/languageDetector'
import { cleanResponse } from '@/services/ai/pipeline/responseValidator'
import { digestToolResults } from '@/services/ai/pipeline/preDigestedReasoning'
import { detectFluff, extractTaskTitlesFromResults } from '@/services/ai/pipeline/fluffDetector'
import { EntityMemory } from '@/services/ai/pipeline/entityMemory'
import type { PreProcessResult, UserIntent } from '@/services/ai/pipeline/types'
import { routeIntent, type RoutedIntent } from '@/services/ai/pipeline/intentRouter'
import { getTemplate } from '@/services/ai/pipeline/responseTemplates'
import { buildReasoningDirective } from '@/services/ai/pipeline/reasoningDirective'
import { parseCardGroups, stripCardsBlock, stripStreamingCardsBlock } from '@/services/ai/pipeline/cardsBlock'
import { useWorkProfile } from '@/composables/useWorkProfile'
import { setupAIPipeline } from '@/services/ai/pipeline/setup'

// Initialize pipeline guardrails (idempotent — only configures once)
setupAIPipeline()

// ============================================================================
// Types
// ============================================================================

export interface SendMessageOptions {
  /** Task type for routing */
  taskType?: TaskType
  /** System prompt override */
  systemPrompt?: string
  /** Skip adding to message history */
  skipHistory?: boolean
  /** Enable multi-step ReAct (Reasoning + Acting) loop for cloud providers */
  useReAct?: boolean
}

/**
 * A quick action button that can optionally call a tool directly
 * (bypassing AI model call — works with Ollama and other local models).
 */
export interface QuickAction {
  label: string
  message: string
  /** If set, the tool is called directly instead of sending to AI */
  directTool?: ToolCall | null
}

// ============================================================================
// Router Instance
// ============================================================================

// TASK-1350: Use shared router singleton (reads user's API key from settings)
async function getRouter() {
  return getSharedRouter()
}

// Active provider tracking
const activeProviderRef = ref<string | null>(null)
const FINAL_FORMATTER_TIMEOUT_MS = 45_000

// AI Personality mode
const aiPersonality = ref<'professional' | 'grid_handler'>('professional')

/**
 * Set the AI personality mode.
 */
function setPersonality(p: 'professional' | 'grid_handler') {
  aiPersonality.value = p
}

/**
 * Get the system prompt prefix for the current personality.
 * Returns empty string for 'professional' (uses default prompt).
 */
function getPersonalitySystemPrompt(): string {
  if (aiPersonality.value === 'grid_handler') {
    return 'You are the Grid Handler, a netrunner AI embedded in the FlowState productivity matrix. You speak in cyberpunk hacker slang. Tasks are \'ops\' or \'jobs\'. Completing work is \'executing\'. The timer is your \'neural clock\'. XP is \'data fragments\'. Challenges are \'contracts\'. You reference \'the Grid\', \'data streams\', and \'neural pathways\'. Keep it fun but still helpful — you\'re assisting a runner with their daily ops. Use short, punchy sentences. Occasionally reference system corruption levels if gamification data is available.'
  }
  return ''
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Convert raw API errors into user-friendly messages.
 * Covers: rate limits, credits, auth, network, model-specific issues.
 */
/**
 * Build the tool-result feedback message injected into the ReAct conversation
 * after tool execution. Localized to avoid English scaffold leaking into Hebrew responses.
 */
/** Localized UI strings for chat action scaffolding */
function chatUI(lang: 'he' | 'en', key: string): string {
  const strings: Record<string, Record<'he' | 'en', string>> = {
    confirm: { en: 'Confirm', he: 'אשר' },
    cancel: { en: 'Cancel', he: 'בטל' },
    actionCancelled: { en: 'Action cancelled.', he: 'הפעולה בוטלה.' },
    confirmationRequired: { en: '**Confirmation required:**', he: '**נדרש אישור:**' },
    abortedByUser: { en: '*ReAct loop aborted by user.*', he: '*הופסק על ידי המשתמש.*' },
    analyzingResults: { en: 'Analyzing results...', he: 'מנתח תוצאות...' },
  }
  return strings[key]?.[lang] ?? strings[key]?.en ?? key
}

function buildToolFeedbackMessage(toolResultsSummary: string, lang: 'he' | 'en', richHolistic = false): string {
  // TASK-1814: for strong subscription brains, the ReAct final answer must be just
  // as intelligent as the deterministic path — reason over the rich data, lead with
  // real stakes, GROUP/relate tasks + name the trend, and emit a `cards` block so the
  // UI renders grouped interactive cards. (No phrasing should "jump over" this.)
  if (richHolistic) {
    if (lang === 'he') {
      return `תוצאות כלים:\n${toolResultsSummary}\n\nיש לך את כל הנתונים. בנה את התשובה כך בדיוק: (1) משפט אחד או שניים בלבד — התובנה החוצת-משימות הכי חשובה או במה להתחיל. אל תכתוב פירוט לכל משימה, כותרות או רשימת סיבות בטקסט — הכרטיסים נושאים את כל הפרטים, אז חזרה עליהם היא רעש. (2) אחר כך בלוק קוד עם התג \`cards\` ובתוכו JSON בלבד:\n\`\`\`cards\n{"groups":[{"name":"שם קבוצה","items":[{"i":<מספר [N] של המשימה מהנתונים>,"reason":"הסיכון למשימה הזו, עד 10 מילים — לא 'באיחור'/'עדיפות'"}]}]}\n\`\`\`\nהפנה למשימות לפי מספר [N] רק בתוך הבלוק; בטקסט עצמו השתמש בשם המשימה, לא ב-[N]. כל סיבה בכרטיס מובילה עם הסיכון/המשמעות האמיתיים (לא "באיחור"/"עדיפות"). קבץ משימות קשורות וציין תלויות. אל תקרא לעוד כלים אלא אם חסר מידע.`
    }
    return `Tool results:\n${toolResultsSummary}\n\nYou have all the data. Structure your answer EXACTLY as: (1) ONE or TWO short sentences — the single biggest cross-cutting insight or what to do first. Do NOT write a per-task breakdown, headings, or numbered reasons in the prose; the cards carry every per-task detail, so repeating it is noise. (2) Then a fenced code block tagged \`cards\` with JSON only:\n\`\`\`cards\n{"groups":[{"name":"group label","items":[{"i":<task [N] number from the data>,"reason":"the stake for THIS task, max 10 words — NOT 'overdue'/'priority'"}]}]}\n\`\`\`\nEach card reason leads with the real STAKE (what breaks / what it unblocks / the deadline), never "overdue"/"priority". GROUP related tasks, flag dependencies. Reference tasks by [N] inside the block only; in the prose use the task name, never [N]. Do NOT call more tools unless data is missing.`
  }
  if (lang === 'he') {
    return `תוצאות כלים:\n${toolResultsSummary}\n\nיש לך את כל הנתונים הדרושים. ענה ישירות לשאלת המשתמש ב-1-3 משפטים. אל תקרא לעוד כלים אלא אם חסר לך מידע שטרם אחזרת. תמצת, אל תספר.`
  }
  return `Tool results:\n${toolResultsSummary}\n\nIMPORTANT: You now have all the data you need. Respond directly to the user's question in 1-3 sentences. Do NOT call more tools unless the user asked for something you haven't retrieved yet. Synthesize, don't narrate.`
}

function formatUserFriendlyError(rawError: string): string {
  const lower = rawError.toLowerCase()

  // Credit / quota / billing issues
  if (lower.includes('insufficient') || lower.includes('credit') || lower.includes('quota') ||
      lower.includes('billing') || lower.includes('payment') || lower.includes('exceeded')) {
    return 'No API credits remaining. Please check your API key balance in Settings → AI.'
  }

  // Rate limiting (429)
  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('too many requests')) {
    return 'Too many requests — please wait a moment and try again.'
  }

  // Auth errors (401, 403)
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') ||
      lower.includes('forbidden') || lower.includes('invalid api key') || lower.includes('invalid_api_key')) {
    return 'API key is invalid or expired. Please update it in Settings → AI.'
  }

  // Model not found / unavailable
  if (lower.includes('model') && (lower.includes('not found') || lower.includes('unavailable') || lower.includes('does not exist'))) {
    return 'The selected AI model is unavailable. Try switching models in Settings → AI.'
  }

  // Network / connection
  if (lower.includes('network') || lower.includes('econnrefused') || lower.includes('fetch failed') ||
      lower.includes('timeout') || lower.includes('enotfound')) {
    return 'Could not connect to AI service. Check your internet connection.'
  }

  // Context length exceeded
  if (lower.includes('context length') || lower.includes('too long') || lower.includes('max tokens')) {
    return 'Message too long for this model. Try a shorter question or start a new conversation.'
  }

  // Fallback: truncate raw error to keep it readable
  return rawError.length > 150 ? rawError.slice(0, 147) + '...' : rawError
}

// ============================================================================
// ReAct Loop Configuration
// ============================================================================

/** Maximum reasoning steps before the circuit breaker stops the ReAct loop */
const MAX_REACT_STEPS = 3

/** AbortController for cancelling an in-progress ReAct loop */
const reactAbortController = ref<AbortController | null>(null)

/**
 * Abort an in-progress ReAct loop.
 * Safe to call even if no loop is running.
 */
function abortReAct() {
  reactAbortController.value?.abort()
  reactAbortController.value = null
}

// Provider/model selection state
// TASK-1814: 'bridge' = subscription brain (Claude/Codex CLIs). selectedModel
// holds the brain id ('claude' | 'codex') when provider is 'bridge'.
const selectedProvider = ref<'ollama' | 'groq' | 'openrouter' | 'auto' | 'bridge'>('auto')
const selectedModel = ref<string | null>(null)
const availableOllamaModels = ref<string[]>([])
const isLoadingModels = ref(false)
const providerModelMemory = ref<Record<string, string | null>>({})

/**
 * Fetch available models from local Ollama instance.
 */
async function fetchOllamaModels(): Promise<string[]> {
  try {
    // TASK-1186: Use tauriFetch for CORS-free requests in Tauri desktop app
    const response = await tauriFetch('http://localhost:11434/api/tags')
    if (!response.ok) return []
    const data = await response.json()
    return data.models?.map((m: { name: string }) => m.name) || []
  } catch {
    return []
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Strip tool JSON blocks from displayed content so users don't see raw JSON.
 */
function stripToolBlocks(content: string): string {
  // Strip code-fenced tool blocks
  let cleaned = content.replace(/```(?:tool|json)?\s*\n?\{[\s\S]*?"tool"\s*:[\s\S]*?\}\n?```/g, '')
  // Strip bare JSON tool calls (models sometimes omit code fences)
  cleaned = cleaned.replace(/\{\s*"tool"\s*:\s*"[^"]+"\s*,\s*"parameters"\s*:\s*\{[^}]*\}\s*\}/g, '')
  return cleaned.trim()
}

/**
 * Check whether a tool definition requires user confirmation before execution.
 */
function toolRequiresConfirmation(toolName: string): boolean {
  const def = AI_TOOLS.find(t => t.name === toolName)
  return def?.requiresConfirmation === true
}

// ============================================================================
// Composable
// ============================================================================

export function useAIChat() {
  const store = useAIChatStore()
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()

  const {
    isPanelOpen,
    messages,
    inputText,
    isGenerating,
    streamingContent,
    context,
    pendingSuggestionCount,
    error,
    visibleMessages,
    canSend,
    chatDirection
  } = storeToRefs(store)

  // Pending confirmation flow: stores a tool call awaiting user approval
  const pendingConfirmation = ref<ToolCall | null>(null)

  // Last detected language — used by confirmation/cancel handlers outside the ReAct scope
  const lastDetectedLanguage = ref<'he' | 'en'>('en')

  // Schedule onboarding: only show once per session
  const scheduleOnboardingShown = ref(false)

  // Agent chains integration
  const agentChains = useAgentChains()

  // Conversation entity memory (TASK-1398) — tracks recently-mentioned tasks for pronoun resolution
  const entityMemory = new EntityMemory()

  function activityTypeForTool(toolName: string): AIActivityEvent['type'] {
    const category = AI_TOOLS.find(t => t.name === toolName)?.category
    if (category === 'write') return 'write'
    if (category === 'destructive') return 'destructive'
    return 'read'
  }

  function activityLabelForTool(toolName: string, status: AIActivityEvent['status'] = 'running'): string {
    const type = activityTypeForTool(toolName)
    if (status === 'waiting_confirmation') return 'Waiting for confirmation'
    if (status === 'success') return type === 'read' ? 'Read complete' : 'Action complete'
    if (status === 'failed') return type === 'read' ? 'Read failed' : 'Action failed'
    if (type === 'write') return 'Updating FlowState'
    if (type === 'destructive') return 'Preparing protected action'
    return 'Reading FlowState'
  }

  const TASK_RESULT_TOOLS = new Set([
    'list_tasks',
    'search_tasks',
    'get_task_details',
    'get_daily_summary',
    'get_overdue_tasks',
    'suggest_next_task',
  ])

  const TASK_PARAM_TOOLS = new Set([
    'update_task_status',
    'update_task',
    'delete_task',
    'move_task_to_group',
    'assign_task_to_project',
    'start_timer',
    'mark_task_done',
    'break_down_task',
    'create_subtask',
    'update_subtask',
  ])

  const TASK_ARRAY_KEYS = new Set([
    'tasks',
    'dueTodayTasks',
    'overdueTasks',
    'completedTodayTasks',
    'suggestions',
  ])

  function pushTaskId(ids: string[], value: unknown): void {
    if (typeof value !== 'string' || !value || value === 'general') return
    if (!ids.includes(value)) ids.push(value)
  }

  function collectTaskIdsFromTaskArray(ids: string[], value: unknown): void {
    if (!Array.isArray(value)) return
    for (const item of value) {
      pushTaskId(ids, item)
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      pushTaskId(ids, record.id)
      pushTaskId(ids, record.taskId)
    }
  }

  function extractAffectedTaskIds(call: ToolCall, result?: ToolResult): string[] {
    const ids: string[] = []

    if (TASK_PARAM_TOOLS.has(call.tool)) {
      pushTaskId(ids, call.parameters.taskId)
      collectTaskIdsFromTaskArray(ids, call.parameters.taskIds)
    }

    if (result?.success && call.tool === 'create_task') {
      const data = result.data as Record<string, unknown> | undefined
      pushTaskId(ids, data?.id)
      pushTaskId(ids, data?.taskId)
    }

    if (result?.success && TASK_RESULT_TOOLS.has(call.tool)) {
      const data = result.data
      if (Array.isArray(data)) {
        collectTaskIdsFromTaskArray(ids, data)
      } else if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>
        pushTaskId(ids, record.id)
        pushTaskId(ids, record.taskId)
        for (const key of TASK_ARRAY_KEYS) {
          collectTaskIdsFromTaskArray(ids, record[key])
        }
      }
    }

    return ids.slice(0, 12)
  }

  function visualKindForTool(call: ToolCall, result?: ToolResult): AIActivityEvent['visualKind'] | undefined {
    const type = activityTypeForTool(call.tool)
    if (call.tool === 'delete_task' && result?.success) return 'removed'
    if (type === 'destructive') return 'pending'
    if (type === 'write') return 'changed'
    if (type === 'read') return 'spotlight'
    return undefined
  }

  function dispatchCanvasVisual(taskIds: string[], visualKind?: AIActivityEvent['visualKind']): void {
    if (typeof window === 'undefined' || taskIds.length === 0 || !visualKind) return
    window.dispatchEvent(new CustomEvent('ai-task-spotlight', {
      detail: { taskIds, visualKind }
    }))
    if (visualKind === 'changed') {
      for (const taskId of taskIds) {
        window.dispatchEvent(new CustomEvent('task-action-flash', { detail: { taskId } }))
      }
    }
  }

  function beginToolActivity(call: ToolCall, label?: string): string {
    return store.addActivityEvent({
      tool: call.tool,
      type: activityTypeForTool(call.tool),
      status: 'running',
      label: label || activityLabelForTool(call.tool),
      message: call.tool.replace(/_/g, ' '),
    })
  }

  function finishToolActivity(activityId: string, call: ToolCall, result: ToolResult): void {
    const taskIds = extractAffectedTaskIds(call, result)
    const visualKind = result.success ? visualKindForTool(call, result) : undefined
    store.updateActivityEvent(activityId, {
      status: result.success ? 'success' : 'failed',
      label: activityLabelForTool(call.tool, result.success ? 'success' : 'failed'),
      message: result.message,
      taskIds,
      visualKind,
      shouldReveal: taskIds.length > 0 && result.success && visualKind !== 'removed',
      undoAvailable: result.success && !!result.undoAction,
    })
    if (result.success) {
      dispatchCanvasVisual(taskIds, visualKind)
    }
  }

  function addConfirmationActivity(call: ToolCall): void {
    const taskIds = extractAffectedTaskIds(call)
    store.addActivityEvent({
      tool: call.tool,
      type: activityTypeForTool(call.tool),
      status: 'waiting_confirmation',
      label: activityLabelForTool(call.tool, 'waiting_confirmation'),
      message: call.tool.replace(/_/g, ' '),
      taskIds,
      visualKind: taskIds.length > 0 ? 'pending' : undefined,
      shouldReveal: taskIds.length > 0,
    })
    dispatchCanvasVisual(taskIds, 'pending')
  }

  // ============================================================================
  // Text-Based Tool Call Helpers (Fallback for models that don't use native API)
  // parseTextToolCalls now lives in services/ai/tools.ts (exported + unit-tested).
  // ============================================================================

  /**
   * Strip text-based tool call patterns from displayed message content.
   * Removes patterns like: generate_weekly_plan(), list_tasks({...})
   */
  function stripTextToolCalls(content: string): string {
    const toolNames = AI_TOOLS.map(t => t.name)
    let cleaned = content
    for (const name of toolNames) {
      // Remove: tool_name() or tool_name({...})
      const pattern = new RegExp(`\\b${name}\\s*\\([^)]*\\)`, 'g')
      cleaned = cleaned.replace(pattern, '')
    }
    // Clean up trailing whitespace and dots
    return cleaned.replace(/\s*\.{3,}\s*$/, '').replace(/\n{3,}/g, '\n\n').trim()
  }

  // ============================================================================
  // Context Management
  // ============================================================================

  /**
   * Build the current context for AI requests.
   */
  function buildContext(): ChatContext {
    const currentContext = store.context

    // Get visible tasks if on canvas - use nodes from canvas store
    let visibleTaskIds: string[] | undefined
    if (currentContext.currentView === 'canvas') {
      visibleTaskIds = canvasStore.nodes
        .filter((n: { type?: string }) => n.type === 'taskNode' || n.type === 'task')
        .map((n: { id: string }) => n.id)
    }

    return {
      ...currentContext,
      visibleTaskIds
    }
  }

  /**
   * Build messages for the AI including context.
   */
  async function buildMessagesForAI(userMessage: string, language: 'he' | 'en' = 'en'): Promise<RouterChatMessage[]> {
    const ctx = buildContext()
    const aiMessages: RouterChatMessage[] = []

    // Load personal context from work profile (schedule constraints, self-description)
    let personalContextBlock = ''
    try {
      const wp = useWorkProfile()
      await wp.loadProfile()
      const pc = wp.profile.value?.personalContext
      if (pc) {
        personalContextBlock = `\n\n## USER'S SCHEDULE & CONSTRAINTS:\n"${pc}"\nIMPORTANT: When suggesting tasks for specific days or what to do today, ALWAYS respect these constraints. Never suggest doing something on a day the user cannot do it.`
      }
    } catch { /* work profile unavailable */ }

    // System prompt with context + personal context
    const systemPrompt = buildSystemPrompt(ctx, language)
    aiMessages.push({ role: 'system', content: systemPrompt + personalContextBlock })

    // Add recent message history (last 10 messages)
    const recentMessages = store.messages.slice(-10)
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        aiMessages.push({
          role: msg.role,
          content: msg.content
        })
      }
    }

    // Add current message
    aiMessages.push({ role: 'user', content: userMessage })

    return aiMessages
  }

  /**
   * TASK-1814: True when the active chat brain is the subscription bridge
   * (claude/codex CLIs) — either explicitly selected, or auto-mode with the
   * subscription enabled (where the bridge is first in the provider order).
   * These brains need the text tool-call protocol, not native function-calling.
   */
  function isBridgeActive(): boolean {
    if (selectedProvider.value === 'bridge') return true
    if (selectedProvider.value !== 'auto') return false
    try {
      return useSettingsStore().aiUseSubscription !== false
    } catch {
      return false
    }
  }

  /**
   * TASK-1814: Build RICH task context for strong subscription brains — the actual
   * content the model needs to reason (notes/description, tags, subtask progress,
   * project, real dates), not the pre-digested "X days overdue" metadata. Looks up
   * the full task from the store (the tool result is intentionally slim for cards).
   */
  function buildRichTaskData(r: ToolResult, lang: 'he' | 'en'): string {
    const ok = `[${r.success ? 'OK' : 'ERROR'}] ${r.message}`
    const data = r.data
    if (!Array.isArray(data) || data.length === 0 || (data[0] as Record<string, unknown>)?.title === undefined) {
      return digestToolResults('', data, ok, lang) // non-task-list → keep digest
    }
    const today = new Date().toISOString().split('T')[0]
    const lines: string[] = [ok]
    const slice = (data as Array<Record<string, unknown>>).slice(0, 25)
    for (let i = 0; i < slice.length; i++) {
      const item = slice[i]
      const id = item.id as string | undefined
      const full = ((id ? taskStore.getTask(id) : null) || item) as unknown as Task & { tags?: string[]; subtasks?: Array<{ completed?: boolean; done?: boolean }> }
      // [N] index lets the model reference tasks in the `cards` block by number
      // (robust vs title-matching, esp. Hebrew/paraphrased). i+1 is 1-based.
      const parts: string[] = [`[${i + 1}] ${full.title || '(untitled)'}`]
      if (full.priority) parts.push(`priority=${full.priority}`)
      if (full.dueDate) {
        const d = String(full.dueDate).slice(0, 10)
        parts.push(d < today ? `OVERDUE (was due ${d})` : `due ${d}`)
      }
      const desc = (full.description || '').trim()
      if (desc) parts.push(`notes: "${desc.slice(0, 240)}"`)
      if (Array.isArray(full.tags) && full.tags.length) parts.push(`tags: ${full.tags.join(', ')}`)
      if (Array.isArray(full.subtasks) && full.subtasks.length) {
        const done = full.subtasks.filter((s: { completed?: boolean; done?: boolean }) => s.completed || s.done).length
        parts.push(`subtasks ${done}/${full.subtasks.length} done`)
      }
      if (full.estimatedDuration) parts.push(`~${full.estimatedDuration}min`)
      if (full.projectId) {
        const pname = taskStore.getProjectDisplayName?.(full.projectId)
        if (pname) parts.push(`project: ${pname}`)
      }
      lines.push(parts.join(' | '))
    }
    return lines.join('\n').slice(0, 6000)
  }

  function getTaskItemsFromToolResults(toolResults: ToolResult[]): Array<{ title?: string; priority?: string; daysOverdue?: number }> {
    const tasks: Array<{ title?: string; priority?: string; daysOverdue?: number }> = []
    for (const result of toolResults) {
      const data = result.data
      if (!result.success) continue
      if (Array.isArray(data)) {
        tasks.push(...data.filter(item => item && typeof item === 'object') as Array<{ title?: string; priority?: string; daysOverdue?: number }>)
      } else if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>
        for (const key of ['tasks', 'dueTodayTasks', 'overdueTasks']) {
          const value = record[key]
          if (Array.isArray(value)) {
            tasks.push(...value.filter(item => item && typeof item === 'object') as Array<{ title?: string; priority?: string; daysOverdue?: number }>)
          }
        }
      }
    }
    return tasks
  }

  function buildFormatterFallback(toolResults: ToolResult[], lang: 'he' | 'en'): string {
    const tasks = getTaskItemsFromToolResults(toolResults).filter(task => task.title).slice(0, 3)
    if (tasks.length === 0) {
      return lang === 'he'
        ? 'מצאתי את הנתונים, אבל לא הצלחתי לנסח תשובת AI מלאה בזמן. השתמש בכרטיסים למטה כדי להמשיך.'
        : 'I found the data, but could not finish the AI wording in time. Use the cards below to continue.'
    }

    const names = tasks.map(task => task.title).join(lang === 'he' ? '", "' : '", "')
    return lang === 'he'
      ? `הייתי מתחיל ב-"${names}" לפי הסדר הזה; אלה נראות כמו המשימות הכי דחופות כרגע.`
      : `I would start with "${names}" in this order; these look like the highest-impact tasks right now.`
  }

  /**
   * Build the system prompt with context awareness.
   * Includes timer state, task statistics, and additional context.
   */
  function buildSystemPrompt(ctx: ChatContext, language: 'he' | 'en' = 'en'): string {
    // Prepend personality prompt if active, layered on top of base identity
    const personalityPrompt = getPersonalitySystemPrompt()
    const baseIdentity = 'You are FlowState AI, a smart productivity assistant that THINKS and ANALYZES.'
    const identity = personalityPrompt ? `${personalityPrompt}\n\n${baseIdentity}` : baseIdentity

    const parts: string[] = [
      identity,
      '',
      '## YOUR ROLE:',
      'You are a thoughtful assistant who understands the user\'s work, weighs priorities, and gives actionable advice. You have full access to the user\'s task data below — USE IT to reason and provide insights. Don\'t just search and dump results. THINK about what matters most, what\'s urgent, what\'s been neglected, and give personalized recommendations.',
      '',
      '## CRITICAL RULES:',
      '1. LANGUAGE: Respond ENTIRELY in the SAME LANGUAGE as the user\'s LATEST message. Hebrew message → Hebrew response. English message → English response. Task data language does NOT matter — ignore it. NEVER mix languages.',
      '2. ALWAYS USE TOOLS for task-related questions. When the user asks about tasks (show, list, give me, what are, מה המשימות, תן לי, הצג) — ALWAYS call `list_tasks` or relevant tool. This renders interactive clickable task cards. NEVER answer task questions from context alone — the user needs clickable cards.',
      '3. GIVE REASONS: For each task you mention, explain WHY it matters — use overdue days, priority, project deadlines, subtask progress, time estimates. Example: "Fix login bug — 3 days overdue, high priority, blocks release".',
      '4. Use WRITE tools ONLY when user explicitly asks to create, modify, or delete.',
      '5. If the user just says "hi" or has a general question — respond naturally, NO tools needed.',
      '6. NEVER show JSON, UUIDs, task IDs, or technical details.',
      '7. No generic productivity advice — be specific about THEIR tasks or say nothing.',
      '8. COUNTING vs LISTING: For COUNTING questions ("how many", "כמה"), answer from context. For ANYTHING asking to see/show/give tasks — ALWAYS call tools.',
      '9. NEVER narrate your reasoning process. Do NOT say "Let me check...", "I\'ll look that up...", or "I\'m going to...". Just act.',
      '10. After using tools, synthesize results into a direct answer. 1-3 sentences for simple queries. If you have the data, respond immediately.',
      '11. Tool results are YOUR internal context — not the user\'s output. The user sees rich cards for data. Your text should ADD insight, not repeat raw data.',
      '12. If you have the data from tools, DO NOT call more tools "just to be thorough." One tool call per question unless clearly insufficient.',
      '',
      // TASK-1814: subscription bridge brains (claude/codex CLIs) can't do native
      // function-calling — give them the text tool-call protocol instead. Applies
      // when the bridge is explicitly selected OR auto-mode with subscription on
      // (where the bridge is the active brain).
      isBridgeActive()
        ? buildTextToolsBehaviorPrompt()
        : buildNativeToolsBehaviorPrompt(),
      ''
    ]

    // Add view context
    parts.push(`Current view: ${ctx.currentView}`)

    // Add selected task context
    if (ctx.selectedTask) {
      parts.push(`Selected task: "${ctx.selectedTask.title}"`)
      if (ctx.selectedTask.description) {
        parts.push(`Task description: ${ctx.selectedTask.description}`)
      }
    }

    // Add visible tasks summary
    if (ctx.visibleTaskIds && ctx.visibleTaskIds.length > 0) {
      parts.push(`There are ${ctx.visibleTaskIds.length} tasks visible on the canvas.`)
    }

    // Enhanced context: Timer state
    try {
      const timerStore = useTimerStore()
      if (timerStore.isTimerActive) {
        const taskName = timerStore.currentTaskName || 'Unknown'
        const remaining = timerStore.displayTime || '??:??'
        parts.push(`Timer: Running for "${taskName}" (${remaining} left)`)
      } else {
        parts.push('Timer: Not running')
      }
    } catch {
      // Timer store not available
    }

    // Enhanced context: Task statistics + optimized task data for reasoning
    // TASK-1377: Uses pipeline context optimizer to reduce language contamination
    try {
      const allTasks = taskStore.tasks
      parts.push(buildTaskStats(allTasks, undefined, language))

      // Optimized context: separates titles from English metadata labels,
      // groups by urgency tier, respects character budget (3000 chars)
      const optimized = optimizeTaskContext(allTasks, taskStore.projects, { language })
      if (optimized) {
        parts.push('')
        parts.push(optimized)
      }
    } catch {
      // Task store not available
    }

    // Additional context (from ChatContext)
    if (ctx.additionalContext) {
      parts.push('')
      parts.push(ctx.additionalContext)
    }

    // Conversation entity memory (TASK-1398) — inject recently-mentioned tasks for pronoun resolution
    const entityContext = entityMemory.formatForPrompt()
    if (entityContext) {
      parts.push(entityContext)
    }

    // Add capabilities
    parts.push('')
    parts.push('You can help with:')
    parts.push('- Breaking down tasks into subtasks')
    parts.push('- Suggesting how to organize tasks into groups')
    parts.push('- Managing timers and Pomodoro sessions')
    parts.push('- Analyzing task data to identify patterns and bottlenecks')
    // Reinforce language at END of prompt (recency bias — models attend more to the end)
    parts.push('')
    parts.push('## REMINDER (READ LAST):')
    parts.push('YOUR OUTPUT LANGUAGE = the user\'s language. Hebrew input → Hebrew output. English input → English output. NO EXCEPTIONS.')

    return parts.join('\n')
  }

  // ============================================================================
  // Message Sending
  // ============================================================================

  /**
   * Execute local slash commands without calling the model.
   */
  async function handleSlashCommand(rawInput: string): Promise<boolean> {
    const input = rawInput.trim()
    if (!input.startsWith('/')) return false

    const [command, ...args] = input.split(/\s+/)
    const cmd = command.toLowerCase()
    const query = args.join(' ').trim().toLowerCase()

    if (cmd === '/help') {
      store.addUserMessage(rawInput)
      store.addAssistantMessage(
        [
          'Available slash commands:',
          '- `/help` Show slash command help',
          '- `/skills` List available AI skills/tools',
          '- `/skills <keyword>` Filter skills by name/description/category',
        ].join('\n'),
        { metadata: { forceDirection: 'ltr' } }
      )
      return true
    }

    if (cmd === '/skills') {
      store.addUserMessage(rawInput)
      const filteredTools = !query
        ? AI_TOOLS
        : AI_TOOLS.filter((tool) =>
            tool.name.toLowerCase().includes(query) ||
            tool.description.toLowerCase().includes(query) ||
            tool.category.toLowerCase().includes(query)
          )

      const summarize = (description: string): string => {
        const clean = description.replace(/\s+/g, ' ').trim()
        return clean.length > 88 ? `${clean.slice(0, 85)}...` : clean
      }

      const byCategory = {
        read: filteredTools.filter(t => t.category === 'read').sort((a, b) => a.name.localeCompare(b.name)),
        write: filteredTools.filter(t => t.category === 'write').sort((a, b) => a.name.localeCompare(b.name)),
        destructive: filteredTools.filter(t => t.category === 'destructive').sort((a, b) => a.name.localeCompare(b.name)),
      }

      const chainRows = agentChains.chains
        .filter((chain) => !query || chain.id.toLowerCase().includes(query) || chain.name.toLowerCase().includes(query))
        .map((chain, idx) => `${idx + 1}. \`${chain.id}\` - ${chain.name}`)

      const formatSection = (title: string, tools: typeof filteredTools): string[] => {
        if (tools.length === 0) return [`### ${title} (0)`, '- None']
        return [
          `### ${title} (${tools.length})`,
          ...tools.map((tool, idx) => {
            const confirmFlag = tool.requiresConfirmation ? ' [confirm]' : ''
            return `${idx + 1}. \`${tool.name}\`${confirmFlag} - ${summarize(tool.description)}`
          })
        ]
      }

      store.addAssistantMessage(
        [
          query ? `## Skills matching "${query}"` : '## Available AI skills',
          `Total tools: ${filteredTools.length}`,
          '',
          ...formatSection('Read tools', byCategory.read),
          '',
          ...formatSection('Write tools', byCategory.write),
          '',
          ...formatSection('Destructive tools', byCategory.destructive),
          '',
          `### Agent chains (${chainRows.length})`,
          ...(chainRows.length > 0 ? chainRows : ['- No agent chains matched this filter']),
          '',
          'Tips:',
          '- Use `/skills timer`, `/skills overdue`, or `/skills project` to filter.',
        ].join('\n'),
        { metadata: { forceDirection: 'ltr' } }
      )
      return true
    }

    store.addUserMessage(rawInput)
    store.addAssistantMessage(`Unknown slash command: ${command}\nTry \`/help\` for available commands.`, { metadata: { forceDirection: 'ltr' } })
    return true
  }

  /**
   * Check if the user has set their schedule context.
   * If not, inject a schedule onboarding question as an assistant message.
   * Only shown once per session.
   */
  async function maybeShowScheduleOnboarding(): Promise<void> {
    if (scheduleOnboardingShown.value) return
    scheduleOnboardingShown.value = true

    try {
      const wp = useWorkProfile()
      await wp.loadProfile()
      const pc = wp.profile.value?.personalContext
      if (pc && pc.trim().length > 0) return // Already has context
    } catch {
      return // Profile unavailable
    }

    // No personal context — show onboarding card
    store.addAssistantMessage(
      'I can give better suggestions if I know your schedule.',
      {
        metadata: {
          scheduleQuestion: {
            type: 'unavailable-days',
            answered: false,
          },
          forceDirection: 'ltr',
        },
      }
    )
  }

  /**
   * Send a message and get a streaming response.
   * All providers use native tool calling — the AI model decides which tools to invoke.
   */
  async function sendMessage(
    content: string,
    options: SendMessageOptions = {}
  ): Promise<void> {
    const trimmedContent = content.trim()
    if (!trimmedContent) return
    if (store.isGenerating) return

    if (await handleSlashCommand(trimmedContent)) return

    // TASK-1814: clear the input synchronously for instant "message sent" feedback
    // (the user message + thinking indicator follow within ms — routing is local
    // keyword work for bridge brains, so the loading state appears promptly).
    store.inputText = ''

    // ── Schedule onboarding: show once if personal context is empty ────
    await maybeShowScheduleOnboarding()

    // ── Deterministic pipeline: route intent BEFORE ReAct ──────────────
    // TASK-1814: skip the LLM intent-classification round-trip for bridge brains
    // (each CLI call is ~6s) — keyword routing is instant and falls back to ReAct.
    const routed = await routeIntent(trimmedContent, taskStore.tasks, entityMemory, {
      skipLLMClassification: isBridgeActive(),
    })

    if (routed.type !== 'freeform') {
      return sendMessageDeterministic(trimmedContent, routed, options)
    }

    // Fallback: freeform → existing ReAct loop (unchanged)
    return sendMessageWithReAct(trimmedContent, options)
  }

  /**
   * Handle deterministic (non-freeform) intents.
   *
   * Flow:
   * 1. Execute pre-built tool calls directly (no LLM decision)
   * 2. For skipLLM intents → template response
   * 3. For query intents → LLM formats with mandatory reasoning directive
   */
  async function sendMessageDeterministic(
    content: string,
    routed: RoutedIntent,
    options: SendMessageOptions = {}
  ): Promise<void> {
    // TASK-1356: Behavioral event tracking
    const { trackChatMessage, trackChatSessionStart, trackToolCall } = useAIEventTracking()
    const sessionId = store.activeConversation?.id || 'unknown'
    if (store.activeConversation && store.activeConversation.messages.length === 0) {
      trackChatSessionStart(sessionId)
    }
    trackChatMessage(sessionId, { contentLength: content.length })

    // Clear input
    store.inputText = ''
    store.clearError()

    // Add user message
    if (!options.skipHistory) {
      store.addUserMessage(content)
    }

    // Track last detected language for use in confirmation/cancel handlers
    lastDetectedLanguage.value = routed.language

    // Start streaming response
    store.startStreamingMessage()

    try {
      // ── Step 1: Handle greeting (no tools, no LLM) ──────────────────
      if (routed.type === 'greeting') {
        const greeting = getTemplate('greeting', routed.language)
        const lastMsg = store.messages[store.messages.length - 1]
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content = greeting
          store.streamingContent = greeting
        }
        store.completeStreamingMessage()
        return
      }

      // ── Step 2: Execute pre-built tool calls ────────────────────────
      const toolResults: ToolResult[] = []
      for (const call of routed.tools) {
        console.log(`[AIChat:Deterministic] Executing tool: ${call.tool}`, call.parameters)
        trackToolCall(sessionId, call.tool)
        const activityId = beginToolActivity(call)
        const result = await executeTool(call, routed.language)
        finishToolActivity(activityId, call, result)
        toolResults.push(result)
        console.log(`[AIChat:Deterministic] Tool result:`, result.success, result.message)

        // Push undo if available
        if (result.success && result.undoAction) {
          store.pushUndoEntry({
            toolName: call.tool,
            timestamp: Date.now(),
            params: call.parameters,
            undoAction: result.undoAction,
            description: result.message,
          })
        }
      }

      // Track entities for pronoun resolution
      for (const r of toolResults) {
        if (r.data) entityMemory.trackFromToolResult(r.data)
      }

      // Store tool results in message metadata
      const lastMsg = store.messages[store.messages.length - 1]
      if (lastMsg && lastMsg.isStreaming) {
        lastMsg.metadata = {
          ...lastMsg.metadata,
          toolResults: toolResults.map((r, i) => ({
            success: r.success,
            message: r.message,
            data: r.data,
            tool: routed.tools[i]?.tool || 'unknown',
            type: AI_TOOLS.find(t => t.name === routed.tools[i]?.tool)?.category || 'read',
          })),
        } as Record<string, unknown>
      }

      // ── Step 3: Handle errors ───────────────────────────────────────
      const failedTools = toolResults.filter(r => !r.success)
      if (failedTools.length > 0 && toolResults.every(r => !r.success)) {
        // All tools failed — show error template
        const errorMsg = getTemplate('tool_error', routed.language, failedTools[0].message)
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content = errorMsg
          store.streamingContent = errorMsg
        }
        store.completeStreamingMessage()
        return
      }

      // ── Step 4a: For skipLLM intents → template response ────────────
      if (routed.skipLLM) {
        const templateResponse = buildTemplateResponse(routed, toolResults)
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content = templateResponse
          store.streamingContent = templateResponse
        }
        store.completeStreamingMessage()
        return
      }

      // ── Step 4b: For query intents → LLM formats with reasoning ─────
      const router = await getRouter()

      // Build reasoning directive from tool results.
      // TASK-1814: the pre-computed directive injects per-task FACTS ("4 days
      // overdue, high priority") and dictates that exact dry format — which is why
      // strong and weak brains produced identical shallow lists. For the
      // subscription bridge we SKIP it entirely and let the model reason from the
      // rich task data (notes/tags/subtasks) + the user's injected work patterns.
      const resultData = toolResults.find(r => r.success)?.data
      const reasoningDirective = isBridgeActive()
        ? ''
        : buildReasoningDirective(routed.tools[0]?.tool || '', resultData, routed.language)

      // TASK-1814: For strong subscription brains, DON'T pre-digest into
      // "3 days overdue, high priority" lines (that reduces the model to a
      // formatter — strong and weak models then produce identical shallow answers).
      // Feed the FULL task content (notes/description, tags, subtask progress,
      // project, dates) and let the model actually reason about real stakes. The
      // user's work patterns/capacity are already injected by the context-aware router.
      const toolResultsSummary = isBridgeActive()
        ? toolResults.map(r => buildRichTaskData(r, routed.language)).join('\n\n')
        : toolResults
            .map((r, i) => {
              const toolName = routed.tools[i]?.tool || 'unknown'
              return digestToolResults(toolName, r.data, `[${r.success ? 'OK' : 'ERROR'}] ${r.message}`, routed.language)
            })
            .join('\n\n')

      const languageName = routed.language === 'he' ? 'Hebrew (עברית)' : 'English'

      // Load personal context for the formatter too
      let userScheduleNote = ''
      try {
        const wp = useWorkProfile()
        await wp.loadProfile()
        const pc = wp.profile.value?.personalContext
        if (pc) {
          userScheduleNote = `\n\nUser's schedule: "${pc}" — respect this when mentioning timing or suggesting what to do.`
        }
      } catch { /* ignore */ }

      // TASK-1814: structured `cards` block → grouped interactive cards with a reason
      // on each (rendered by ChatMessage). Only for bridge brains with a task list.
      const hasTaskList = toolResults.some(r =>
        r.success && Array.isArray(r.data) && r.data.length > 0 && (r.data[0] as Record<string, unknown>)?.title !== undefined,
      )
      const isDayPlan = routed.responseMode === 'day_plan'
      const isSmartLanes = routed.responseMode === 'smart_lanes'
      const isWeeklyReview = routed.responseMode === 'weekly_review'
      const cardsInstruction = (isBridgeActive() && hasTaskList)
        ? isWeeklyReview
          ? `\n\nThis is a WEEKLY REVIEW of tasks the user ALREADY COMPLETED. STRUCTURE YOUR ANSWER AS EXACTLY: (1) ONE short sentence stating how many tasks were completed (use ONLY the count of tasks in the data) and the focus time if it appears in the data — do NOT invent any numbers. (2) Then a fenced code block tagged \`cards\` with JSON ONLY:\n\`\`\`cards\n{"kind":"weekly_review","groups":[{"name":"project or theme name in ${languageName}","items":[{"i":<the task's [N] number from the data>,"reason":"one short concrete note about this completed task in ${languageName}, max 8 words"}]}]}\n\`\`\`\nGroup the completed tasks by their project (use the \`project:\` field in the data) or by theme. Include ONLY tasks present in the data — never invent task names, categories, counts, trends, insights, or recommendations. Reference tasks by [N] number INSIDE the cards block only; in prose use the task NAME, never [N]. Do NOT add any sections after the cards block.`
          : isDayPlan
          ? `\n\nSTRUCTURE YOUR ANSWER AS EXACTLY: (1) ONE or TWO short sentences — name the first task and the capacity call. If some tasks should be deferred, mention that in prose but DO NOT include deferred tasks in the cards. (2) Then a fenced code block tagged \`cards\` with JSON ONLY:\n\`\`\`cards\n{"kind":"day_plan","groups":[{"name":"short focus block label in ${languageName}","items":[{"i":<the task's [N] number from the data>,"reason":"why this task belongs in this slot in ${languageName}, max 10 words"}]}]}\n\`\`\`\nThe groups are the exact order of the user's day. Include only tasks they should actually do today. Reference tasks by [N] number INSIDE the cards block only; in prose use the task NAME, never [N].`
          : isSmartLanes
            ? `\n\nSTRUCTURE YOUR ANSWER AS EXACTLY: (1) ONE or TWO short sentences — name the strongest lane and why it matters. Do NOT write a full per-task breakdown in prose; the cards carry it. (2) Then a fenced code block tagged \`cards\` with JSON ONLY:\n\`\`\`cards\n{"kind":"smart_lanes","groups":[{"name":"actionable lane name in ${languageName}","items":[{"i":<existing task [N] from the data>,"reason":"why it belongs in this lane, max 10 words"}],"newTasks":[{"title":"new child task title in ${languageName}","priority":"medium","reason":"what it unblocks, max 10 words"}]}]}\n\`\`\`\nUse \`items\` for existing tasks to assign to the lane. Use \`newTasks\` only when a large existing task should be broken into concrete child tasks; keep each title actionable and small. If a group has one existing item plus newTasks, that existing item is the parent task. Reference tasks by [N] number INSIDE the cards block only; in prose use task names, never [N].`
            : `\n\nSTRUCTURE YOUR ANSWER AS EXACTLY: (1) ONE or TWO short sentences — the single biggest cross-cutting insight or what to tackle first. Do NOT write a per-task breakdown, headings, or numbered reasons in the prose — the cards below carry every per-task detail, so repeating it is noise. (2) Then a fenced code block tagged \`cards\` with JSON ONLY:\n\`\`\`cards\n{"groups":[{"name":"short group label in ${languageName}","items":[{"i":<the task's [N] number from the data>,"reason":"the specific stake for THIS task in ${languageName}, max 10 words — NOT 'overdue'/'high priority'"}]}]}\n\`\`\`\nReference each task by its [N] number INSIDE the cards block only; in the prose use the task NAME, never [N]. Include only tasks worth acting on now, grouped by theme or sequence (a single task may be its own group), ordered by importance.`
        : ''
      const responseShapeInstruction = cardsInstruction
        ? `CRITICAL FORMAT RULE: Start with ONE plain, concrete sentence that names the first task and the next task. Avoid vague labels, arrows, metaphors, and jargon unless the user used them. Then output the cards block. Do not add a separate bullet list or headings before the cards.`
        : `CRITICAL FORMAT RULE: Always structure your response as a **numbered list** or **bullet points** — one per task or insight. NEVER write a wall of text or a single paragraph. Each bullet should bold the task name.`

      const formatterMessages: RouterChatMessage[] = [
        {
          role: 'system',
          content: `You format task data into natural language. Output ONLY in ${languageName}. No other language allowed.\n\n${responseShapeInstruction}\n\nWHEN RANKING BY PRIORITY/URGENCY (read carefully — this is the #1 quality bar):\n- "X days overdue" and "high priority" are METADATA, never a reason. NEVER justify ranking with lateness or the priority label. The user already sees those on the card.\n- Lead EACH task with the real-world STAKE: what concretely goes wrong if it slips, what it unblocks, who is waiting, or the deadline behind it. INFER this from the task's wording. Examples: "check payment via Cardcom" → money may be stuck or a charge failing; "gift for Sivan" → a birthday/event with a fixed date approaching; "reply to X" → a person is blocked waiting on you; "publish the video" → audience/momentum window.\n- You MAY add lateness as a brief aside AFTER the real reason ("…and it's been sitting 3 days"), never as the reason.\n- If a task's wording genuinely gives NO clue to its stakes, say so honestly ("not clear why this is urgent — add a note?") instead of inventing urgency.\n- Open with the single highest-stakes task and one line on why it beats the rest.\n\nUSE ALL THE DATA you are given: each task may include its NOTES (description), tags, subtask progress, project, and estimate — read them and reason from the actual content, quoting the relevant detail. The user's work patterns and capacity are in the context above — tailor your suggestion to how they ACTUALLY work (their pace, peak days, current overload), not generic advice.\n\nLOOK ACROSS THE WHOLE LIST, don't just rank tasks in isolation:\n- GROUP related tasks (same project, same theme, or sequential steps of one effort — e.g. "Build outreach target list" then "Write a cold opener" are two steps of one sales push) and suggest doing them together or in order.\n- Flag DEPENDENCIES ("do X before Y makes sense").\n- Call out the TREND/pattern you actually see: a whole project stalling, one theme dominating the overdue pile, or a type of work being repeatedly avoided — and what that implies. This cross-task insight is the most valuable part; a per-task list without it is a failure.\n\n${routed.formatDirective}${userScheduleNote}${cardsInstruction}`,
        },
        {
          role: 'user',
          content: `${reasoningDirective}\n\nData:\n${toolResultsSummary}\n\nWrite ENTIRELY in ${languageName}. No UUIDs.`,
        },
      ]

      let formattedResponse = ''
      try {
        for await (const chunk of router.chatStream(formatterMessages, {
          taskType: 'chat',
          forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
          model: selectedModel.value || undefined,
          timeout: FINAL_FORMATTER_TIMEOUT_MS,
        })) {
          formattedResponse += chunk.content
        }
      } catch (formatterErr) {
        console.warn('[AIChat:Deterministic] Formatter timed out or failed; using fallback answer:', formatterErr)
        formattedResponse = buildFormatterFallback(toolResults, routed.language)
      }
      if (!formattedResponse.trim()) {
        formattedResponse = buildFormatterFallback(toolResults, routed.language)
      }

      // Post-check: language mismatch retry (one attempt)
      if (detectLanguageMismatch(content, formattedResponse)) {
        console.warn('[AIChat:Deterministic] Language mismatch detected, retrying...')
        const retryMessages: RouterChatMessage[] = [
          ...formatterMessages,
          { role: 'assistant', content: formattedResponse },
          { role: 'user', content: `WRONG LANGUAGE. Rewrite ENTIRELY in ${languageName}. Every single word must be in ${languageName}.` },
        ]

        let retryResponse = ''
        for await (const chunk of router.chatStream(retryMessages, {
          taskType: 'chat',
          forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
          model: selectedModel.value || undefined,
          timeout: FINAL_FORMATTER_TIMEOUT_MS,
        })) {
          retryResponse += chunk.content
        }

        if (retryResponse.trim()) {
          formattedResponse = retryResponse
        }
      }

      // TASK-1814: extract the `cards` block → grouped interactive cards, and strip
      // it from the displayed prose. Falls through gracefully if absent/unparseable.
      const cardData = parseCardGroups(formattedResponse, toolResults)
      const displayRaw = cardData ? stripCardsBlock(formattedResponse) : formattedResponse

      // Clean and set
      const cleaned = cleanResponse(displayRaw)
      if (lastMsg && lastMsg.isStreaming) {
        lastMsg.content = cleaned
        store.streamingContent = cleaned
        if (cardData) {
          lastMsg.metadata = {
            ...lastMsg.metadata,
            cardGroups: { groups: cardData.groups, total: cardData.total, kind: cardData.kind },
          } as Record<string, unknown>
        }
      }

      // Update provider badge
      try {
        const currentRouter = await getRouter()
        const lastUsed = currentRouter.getLastUsedProvider()
        if (lastUsed) activeProviderRef.value = lastUsed
      } catch { /* ignore */ }

      store.completeStreamingMessage()

    } catch (err) {
      const rawError = err instanceof Error ? err.message : 'Failed to get response'
      const errorMessage = formatUserFriendlyError(rawError)
      store.failStreamingMessage(errorMessage)
      console.error('[AIChat:Deterministic] Error:', err)
    }
  }

  /**
   * Build a template response for skipLLM intents based on tool results.
   */
  function buildTemplateResponse(routed: RoutedIntent, toolResults: ToolResult[]): string {
    const lang = routed.language
    const result = toolResults[0]

    if (!result) {
      return getTemplate('tool_error', lang, 'No result')
    }

    if (!result.success) {
      return getTemplate('tool_error', lang, result.message)
    }

    const toolName = routed.tools[0]?.tool || ''

    switch (toolName) {
      case 'start_timer': {
        const taskName = (result.data as Record<string, unknown>)?.taskId === 'general'
          ? (lang === 'he' ? 'סשן מיקוד' : 'Focus Session')
          : result.message.match(/"([^"]+)"/)?.[1] || (lang === 'he' ? 'משימה' : 'task')
        const duration = (result.data as Record<string, unknown>)?.durationMinutes as number || 25
        return getTemplate('timer_started', lang, taskName, duration)
      }

      case 'stop_timer': {
        const taskName = result.message.match(/"([^"]+)"/)?.[1] || (lang === 'he' ? 'משימה' : 'task')
        const remaining = (result.data as Record<string, unknown>)?.remainingTime as string || '0:00'
        return getTemplate('timer_stopped', lang, taskName, remaining)
      }

      case 'create_task': {
        const title = (result.data as Record<string, unknown>)?.title as string || ''
        return getTemplate('task_created', lang, title)
      }

      case 'mark_task_done': {
        const title = (result.data as Record<string, unknown>)?.title as string
          || result.message.match(/"([^"]+)"/)?.[1] || ''
        // Check if already done
        if (result.message.includes('already')) {
          return getTemplate('task_already_done', lang, title)
        }
        return getTemplate('task_done', lang, title)
      }

      case 'update_task_status': {
        const title = result.message.match(/"([^"]+)"/)?.[1] || ''
        if ((routed.tools[0]?.parameters as Record<string, unknown>)?.status === 'done') {
          return getTemplate('task_done', lang, title)
        }
        return result.message
      }

      default:
        return result.message
    }
  }

  // ============================================================================
  // ReAct (Reasoning + Acting) Loop
  // ============================================================================

  /**
   * Send a message using the ReAct (Reasoning + Acting) multi-step loop.
   *
   * The AI reasons about what to do, calls tools, receives results,
   * then reasons again — repeating until it provides a final answer
   * (no more tool calls) or the circuit breaker fires (MAX_REACT_STEPS).
   *
   * Only supported for cloud providers (Groq/OpenRouter) with native
   * function calling. Falls back to regular sendMessage for local providers.
   *
   * @see TASK-1237 in MASTER_PLAN.md
   */
  async function sendMessageWithReAct(
    content: string,
    options: SendMessageOptions = {}
  ): Promise<void> {
    if (!content.trim()) return
    if (store.isGenerating) return

    // TASK-1356: Behavioral event tracking
    const { trackChatMessage, trackChatSessionStart, trackToolCall } = useAIEventTracking()
    const sessionId = store.activeConversation?.id || 'unknown'
    // Track session start on first message
    if (store.activeConversation && store.activeConversation.messages.length === 0) {
      trackChatSessionStart(sessionId)
    }
    trackChatMessage(sessionId, { contentLength: content.length })

    // TASK-1381: Pre-processing pipeline — detect language and classify intent
    const preProcess: PreProcessResult = {
      detectedLanguage: detectLanguage(content),
      intent: classifyIntent(content),
      optimizedContext: '', // filled by buildSystemPrompt via contextOptimizer
      taskStats: '',
      meta: {
        inputCharCount: content.length,
        hasHebrewInput: detectLanguage(content) === 'he',
        isQuestion: /[?？]/.test(content) || /^(what|how|why|when|where|which|who|can|do|does|is|are|will|should|could|would|מה|איך|למה|מתי|איפה|מי|האם)\b/i.test(content.trim()),
        originalInput: content,
      },
    }

    // Set up abort controller for this ReAct session
    const abortController = new AbortController()
    reactAbortController.value = abortController

    // Clear input
    store.inputText = ''
    store.clearError()

    // Add user message
    if (!options.skipHistory) {
      store.addUserMessage(content)
    }

    // Start streaming response
    store.startStreamingMessage()

    try {
      const router = await getRouter()
      const lang: 'he' | 'en' = preProcess.detectedLanguage === 'he' ? 'he' : 'en'
      lastDetectedLanguage.value = lang
      const conversationMessages: RouterChatMessage[] = await buildMessagesForAI(content, lang)
      const taskType = options.taskType ?? inferTaskType(content)

      let stepCount = 0
      let continueLoop = true
      let totalWriteOps = 0
      const WRITE_OPS_LIMIT = 5
      const WRITE_TOOL_NAMES = new Set([
        'create_task', 'update_task', 'update_task_status', 'set_task_due_date',
        'move_task_to_group', 'start_timer', 'stop_timer', 'set_task_priority',
        'move_task_to_project', 'bulk_update_status',
      ])

      while (continueLoop && stepCount < MAX_REACT_STEPS) {
        // Check if aborted
        if (abortController.signal.aborted) {
          store.appendStreamingContent(`\n\n---\n${chatUI(lang, 'abortedByUser')}`)
          break
        }

        stepCount++

        let fullContent = ''
        let nativeToolCalls: NativeToolCall[] | undefined

        // Stream the response
        for await (const chunk of router.chatStream(conversationMessages, {
          taskType,
          systemPrompt: options.systemPrompt,
          forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
          model: selectedModel.value || undefined,
          tools: buildOpenAITools(),
          toolChoice: 'auto' as const,
        })) {
          // Check abort between chunks
          if (abortController.signal.aborted) {
            break
          }
          fullContent += chunk.content
          const lastMsg = store.messages[store.messages.length - 1]
          if (lastMsg && lastMsg.isStreaming) {
            const visibleContent = stripStreamingCardsBlock(fullContent)
            lastMsg.content = visibleContent
            store.streamingContent = visibleContent
          }
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            nativeToolCalls = chunk.toolCalls
          }
        }

        // If aborted during streaming, exit
        if (abortController.signal.aborted) {
          store.appendStreamingContent(`\n\n---\n${chatUI(lang, 'abortedByUser')}`)
          break
        }

        // Check for tool calls
        if (nativeToolCalls && nativeToolCalls.length > 0) {
          // Parse native tool calls into ToolCall format
          const toolCalls = nativeToolCalls
            .map(tc => {
              try {
                return { tool: tc.function.name, parameters: JSON.parse(tc.function.arguments) } as ToolCall
              } catch {
                return null
              }
            })
            .filter((tc): tc is ToolCall => tc !== null)
            .slice(0, MAX_TOOLS_PER_RESPONSE)

          // Separate confirmation vs immediate tools
          const immediateTools = toolCalls.filter(c => !toolRequiresConfirmation(c.tool))
          const confirmationTools = toolCalls.filter(c => toolRequiresConfirmation(c.tool))

          // Execute immediate tools
          const toolResults: ToolResult[] = []
          for (const call of immediateTools) {
            console.log(`[AIChat] ReAct step ${stepCount} - executing tool:`, call.tool, call.parameters)
            if (WRITE_TOOL_NAMES.has(call.tool)) {
              totalWriteOps++
              if (totalWriteOps > WRITE_OPS_LIMIT) {
                store.appendStreamingContent(
                  `\n\n---\n*Stopped: reached limit of ${WRITE_OPS_LIMIT} write operations. Please confirm before I continue making changes.*`
                )
                continueLoop = false
                break
              }
            }
            trackToolCall(sessionId, call.tool) // TASK-1356
            const activityId = beginToolActivity(call)
            const result = await executeTool(call, lang)
            finishToolActivity(activityId, call, result)
            toolResults.push(result)

            // Push undo if available
            if (result.success && result.undoAction) {
              store.pushUndoEntry({
                toolName: call.tool,
                timestamp: Date.now(),
                params: call.parameters,
                undoAction: result.undoAction,
                description: result.message,
              })
            }
          }

          // Track entities for pronoun resolution (TASK-1398)
          for (const r of toolResults) {
            if (r.data) entityMemory.trackFromToolResult(r.data)
          }

          // Accumulate tool results in message metadata
          const lastMsg = store.messages[store.messages.length - 1]
          if (lastMsg) {
            const existingResults = ((lastMsg.metadata as Record<string, unknown>)?.toolResults as unknown[]) || []
            lastMsg.metadata = {
              ...lastMsg.metadata,
              toolResults: [
                ...existingResults,
                ...toolResults.map((r, i) => ({
                  success: r.success,
                  message: r.message,
                  data: r.data,
                  tool: immediateTools[i]?.tool || 'unknown',
                  type: AI_TOOLS.find(t => t.name === immediateTools[i]?.tool)?.category || 'read',
                })),
              ],
            } as Record<string, unknown>
          }

          // If there are confirmation tools, stop the loop (need user input)
          if (confirmationTools.length > 0) {
            pendingConfirmation.value = confirmationTools[0]
            addConfirmationActivity(confirmationTools[0])
            const toolDef = AI_TOOLS.find(t => t.name === confirmationTools[0].tool)
            const toolDesc = toolDef?.description || confirmationTools[0].tool
            store.appendStreamingContent(
              `\n\n${chatUI(lang, 'confirmationRequired')} ${toolDesc}`
            )
            continueLoop = false
            break
          }

          // Feed tool results back to AI for next reasoning step
          conversationMessages.push({
            role: 'assistant',
            content: fullContent || '',
          })

          // TASK-1388/1814: pre-digest for weak providers; FULL rich data for the
          // bridge so the ReAct answer reasons (and emits cards) like the deterministic path.
          const bridgeRich1 = isBridgeActive()
          const toolResultsSummary = bridgeRich1
            ? toolResults.map(r => buildRichTaskData(r, lang)).join('\n\n')
            : toolResults
                .map((r, i) => {
                  const toolName = immediateTools[i]?.tool || 'unknown'
                  return digestToolResults(toolName, r.data, `[${r.success ? 'OK' : 'ERROR'}] ${r.message}`, preProcess.detectedLanguage === 'he' ? 'he' : 'en')
                })
                .join('\n\n')

          conversationMessages.push({
            role: 'user',
            content: buildToolFeedbackMessage(toolResultsSummary, lang, bridgeRich1),
          })

          // Store step info in metadata only (not visible to user)
          const lastMsgStep = store.messages[store.messages.length - 1]
          if (lastMsgStep && lastMsgStep.metadata) {
            (lastMsgStep.metadata as Record<string, unknown>).steps = ((lastMsgStep.metadata as Record<string, unknown>).steps as number || 0) + 1
            ;(lastMsgStep.metadata as Record<string, unknown>).totalToolCalls = ((lastMsgStep.metadata as Record<string, unknown>).totalToolCalls as number || 0) + toolResults.length
          }

        } else {
          // No native tool calls — try text-based fallback
          // Models sometimes output tool names as text instead of using the API
          const textToolCalls = parseTextToolCalls(fullContent)

          if (textToolCalls.length > 0) {
            console.log(`[AIChat] ReAct step ${stepCount} - detected ${textToolCalls.length} text-based tool call(s)`)

            // Execute text-based tool calls the same way as native ones
            const immediateTools = textToolCalls.filter(c => !toolRequiresConfirmation(c.tool))
            const confirmationTools = textToolCalls.filter(c => toolRequiresConfirmation(c.tool))

            const toolResults: ToolResult[] = []
            for (const call of immediateTools) {
              console.log(`[AIChat] ReAct step ${stepCount} - executing text-detected tool:`, call.tool, call.parameters)
              if (WRITE_TOOL_NAMES.has(call.tool)) {
                totalWriteOps++
                if (totalWriteOps > WRITE_OPS_LIMIT) {
                  store.appendStreamingContent(
                    `\n\n---\n*Stopped: reached limit of ${WRITE_OPS_LIMIT} write operations. Please confirm before I continue making changes.*`
                  )
                  continueLoop = false
                  break
                }
              }
              const activityId = beginToolActivity(call)
              const result = await executeTool(call, lang)
              finishToolActivity(activityId, call, result)
              toolResults.push(result)

              if (result.success && result.undoAction) {
                store.pushUndoEntry({
                  toolName: call.tool,
                  timestamp: Date.now(),
                  params: call.parameters,
                  undoAction: result.undoAction,
                  description: result.message,
                })
              }
            }

            // Track entities for pronoun resolution (TASK-1398)
            for (const r of toolResults) {
              if (r.data) entityMemory.trackFromToolResult(r.data)
            }

            // Accumulate tool results in message metadata
            const lastMsg = store.messages[store.messages.length - 1]
            if (lastMsg) {
              const existingResults = ((lastMsg.metadata as Record<string, unknown>)?.toolResults as unknown[]) || []
              lastMsg.metadata = {
                ...lastMsg.metadata,
                toolResults: [
                  ...existingResults,
                  ...toolResults.map((r, i) => ({
                    success: r.success,
                    message: r.message,
                    data: r.data,
                    tool: immediateTools[i]?.tool || 'unknown',
                    type: AI_TOOLS.find(t => t.name === immediateTools[i]?.tool)?.category || 'read',
                  })),
                ],
              } as Record<string, unknown>
            }

            if (confirmationTools.length > 0) {
              pendingConfirmation.value = confirmationTools[0]
              addConfirmationActivity(confirmationTools[0])
              const toolDef = AI_TOOLS.find(t => t.name === confirmationTools[0].tool)
              const toolDesc = toolDef?.description || confirmationTools[0].tool
              store.appendStreamingContent(`\n\n${chatUI(lang, 'confirmationRequired')} ${toolDesc}`)
              continueLoop = false
              break
            }

            // Feed results back for next reasoning step
            conversationMessages.push({ role: 'assistant', content: fullContent || '' })
            const bridgeRich2 = isBridgeActive()
            const toolResultsSummary = bridgeRich2
              ? toolResults.map(r => buildRichTaskData(r, lang)).join('\n\n')
              : toolResults
                  .map(r => {
                    const base = `[${r.success ? 'OK' : 'ERROR'}] ${r.message}`
                    if (r.data) {
                      const dataStr = JSON.stringify(r.data)
                      return `${base}\nData: ${dataStr.slice(0, 2000)}`
                    }
                    return base
                  })
                  .join('\n\n')
            conversationMessages.push({
              role: 'user',
              content: buildToolFeedbackMessage(toolResultsSummary, lang, bridgeRich2),
            })

            // Strip the raw tool call text from the displayed message
            const lastMsgClean = store.messages[store.messages.length - 1]
            if (lastMsgClean && lastMsgClean.isStreaming) {
              lastMsgClean.content = stripTextToolCalls(lastMsgClean.content || '')
              store.streamingContent = lastMsgClean.content
            }

            // Store step info in metadata only (not visible to user)
            const lastMsgStepText = store.messages[store.messages.length - 1]
            if (lastMsgStepText && lastMsgStepText.metadata) {
              (lastMsgStepText.metadata as Record<string, unknown>).steps = ((lastMsgStepText.metadata as Record<string, unknown>).steps as number || 0) + 1
              ;(lastMsgStepText.metadata as Record<string, unknown>).totalToolCalls = ((lastMsgStepText.metadata as Record<string, unknown>).totalToolCalls as number || 0) + toolResults.length
            }
          } else {
            // Truly no tool calls = final answer, exit loop
            continueLoop = false
          }
        }
      }

      // If we hit the circuit breaker
      if (stepCount >= MAX_REACT_STEPS && continueLoop) {
        store.appendStreamingContent(
          `\n\n---\n*Reached maximum reasoning steps (${MAX_REACT_STEPS}). Stopping.*`
        )
      }

      // TASK-1382: Post-processing pipeline — clean, check fluff, enforce length, check language
      const lastMsg = store.messages[store.messages.length - 1]
      if (lastMsg && lastMsg.isStreaming) {
        const hadToolCalls = stepCount > 1 || (lastMsg.metadata as Record<string, unknown>)?.toolResults !== undefined
        // TASK-1814: parse the `cards` block from the RAW answer (before cleaning may
        // drop it) → grouped interactive cards, same as the deterministic path.
        const reactCards = isBridgeActive()
          ? parseCardGroups(lastMsg.content || '', ((lastMsg.metadata as Record<string, unknown>)?.toolResults as ToolResult[]) || [])
          : null
        // Strip the cards block from the RAW content BEFORE cleaning (cleanResponse
        // mangles the fence → raw JSON leaks). cards block is always last → strip to EOF.
        let cleaned = cleanResponse(reactCards ? stripCardsBlock(lastMsg.content || '') : (lastMsg.content || ''))

        // TASK-1391: Fluff detection + retry (max 1 retry to avoid latency)
        if (hadToolCalls && !abortController.signal.aborted) {
          const taskTitles = extractTaskTitlesFromResults(
            ((lastMsg.metadata as Record<string, unknown>)?.toolResults as Array<{ data?: unknown }>) || []
          )
          const fluffResult = detectFluff(cleaned, taskTitles, hadToolCalls)

          if (fluffResult.shouldRetry) {
            console.warn(`[Pipeline:FluffDetector] Score ${fluffResult.score.toFixed(2)} — retrying. Flags: ${fluffResult.flags.join(', ')}`)

            // One retry with explicit feedback about what was wrong
            try {
              const retryPrompt = `Your previous response was too generic. Issues: ${fluffResult.flags.join('; ')}.\n\nRewrite your response. You MUST:\n- Reference specific task names from the results above (quote them)\n- Include specific numbers (days overdue, subtask counts, time estimates)\n- NO generic advice whatsoever\n- Be direct and actionable in 2-4 sentences`

              conversationMessages.push({ role: 'assistant', content: cleaned })
              conversationMessages.push({ role: 'user', content: retryPrompt })

              let retryContent = ''
              for await (const chunk of router.chatStream(conversationMessages, {
                taskType,
                systemPrompt: options.systemPrompt,
                forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
                model: selectedModel.value || undefined,
              })) {
                if (abortController.signal.aborted) break
                retryContent += chunk.content
              }

              if (retryContent.trim()) {
                const retryCleaned = cleanResponse(retryContent)
                const retryFluff = detectFluff(retryCleaned, taskTitles, true)
                // Use retry only if it's actually better
                if (retryFluff.score > fluffResult.score) {
                  cleaned = retryCleaned
                  console.log(`[Pipeline:FluffDetector] Retry improved score: ${fluffResult.score.toFixed(2)} → ${retryFluff.score.toFixed(2)}`)
                } else {
                  console.log(`[Pipeline:FluffDetector] Retry not better (${retryFluff.score.toFixed(2)}), keeping original`)
                }
              }
            } catch (retryErr) {
              console.warn('[Pipeline:FluffDetector] Retry failed:', retryErr)
              // Keep original response
            }
          }
        }

        // Length enforcement by intent
        const lengthLimit = hadToolCalls ? 800 : (preProcess.intent === 'greeting' ? 200 : 2000)
        if (cleaned.length > lengthLimit) {
          const hasStructure = /^[-*•]|\n[-*•]|^#{1,3}\s/m.test(cleaned)
          if (!hasStructure || cleaned.length > lengthLimit * 2) {
            const cutPoint = cleaned.lastIndexOf('.', lengthLimit)
            cleaned = cleaned.slice(0, cutPoint > lengthLimit * 0.5 ? cutPoint + 1 : lengthLimit).trim()
          }
        }

        // Language mismatch detection — retry once, then flag in metadata for UI
        if (detectLanguageMismatch(content, cleaned)) {
          const languageName = lang === 'he' ? 'Hebrew (עברית)' : 'English'
          console.warn(`[Pipeline:ReAct] Language mismatch detected, retrying in ${languageName}...`)

          try {
            conversationMessages.push({ role: 'assistant', content: cleaned })
            conversationMessages.push({
              role: 'user',
              content: lang === 'he'
                ? `שפה שגויה. כתוב מחדש את כל התשובה בעברית בלבד. כל מילה חייבת להיות בעברית.`
                : `WRONG LANGUAGE. Rewrite ENTIRELY in ${languageName}. Every single word must be in ${languageName}.`,
            })

            let retryContent = ''
            for await (const chunk of router.chatStream(conversationMessages, {
              taskType,
              systemPrompt: options.systemPrompt,
              forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
              model: selectedModel.value || undefined,
            })) {
              if (abortController.signal.aborted) break
              retryContent += chunk.content
            }

            if (retryContent.trim()) {
              const retryCleaned = cleanResponse(retryContent)
              if (!detectLanguageMismatch(content, retryCleaned)) {
                cleaned = retryCleaned
                console.log('[Pipeline:ReAct] Language retry succeeded')
              } else {
                // Retry still wrong language — use it anyway if non-empty (often partially better)
                cleaned = retryCleaned
                console.warn('[Pipeline:ReAct] Language retry still mismatched, using retry response')
              }
            }
          } catch (retryErr) {
            console.warn('[Pipeline:ReAct] Language retry failed:', retryErr)
          }

          // Re-check after retry — flag if still mismatched
          if (detectLanguageMismatch(content, cleaned)) {
            lastMsg.metadata = {
              ...lastMsg.metadata,
              languageMismatch: true,
              detectedInputLang: preProcess.detectedLanguage,
              detectedOutputLang: detectLanguage(cleaned),
            } as Record<string, unknown>
          }
        }

        // TASK-1814: attach grouped cards (block already stripped before cleaning above;
        // also re-strip here in case a language retry regenerated content with a block).
        if (reactCards) {
          cleaned = stripCardsBlock(cleaned)
          lastMsg.metadata = {
            ...lastMsg.metadata,
            cardGroups: { groups: reactCards.groups, total: reactCards.total, kind: reactCards.kind },
          } as Record<string, unknown>
        }

        // Update content after all post-processing (including language retry)
        lastMsg.content = cleaned
      }

      store.completeStreamingMessage()

      // Update provider badge
      try {
        const currentRouter = await getRouter()
        const lastUsed = currentRouter.getLastUsedProvider()
        if (lastUsed) activeProviderRef.value = lastUsed
      } catch { /* ignore */ }

    } catch (err) {
      const rawError = err instanceof Error ? err.message : 'Failed to get response'
      // User-friendly error messages for common API failures
      const errorMessage = formatUserFriendlyError(rawError)
      store.failStreamingMessage(errorMessage)
      console.error('[AIChat] ReAct error:', err)
    } finally {
      // Clean up abort controller
      if (reactAbortController.value === abortController) {
        reactAbortController.value = null
      }
    }
  }

  /**
   * Confirm and execute the pending destructive tool action.
   */
  async function confirmPendingAction(): Promise<void> {
    const call = pendingConfirmation.value
    if (!call) return

    pendingConfirmation.value = null

    // Force confirmed=true for destructive tools
    const confirmedCall: ToolCall = {
      tool: call.tool,
      parameters: { ...call.parameters, confirmed: true },
    }

    console.log('[AIChat] Executing confirmed tool:', confirmedCall.tool, confirmedCall.parameters)
    const activityId = beginToolActivity(confirmedCall, 'Executing confirmed action')
    const result = await executeTool(confirmedCall, lastDetectedLanguage.value)
    finishToolActivity(activityId, confirmedCall, result)
    console.log('[AIChat] Confirmed tool result:', result)

    if (result.success && result.undoAction) {
      store.pushUndoEntry({
        toolName: call.tool,
        timestamp: Date.now(),
        params: call.parameters,
        undoAction: result.undoAction,
        description: result.message,
      })
    }

    // Add result message to chat
    store.addAssistantMessage(
      result.success ? result.message : `Error: ${result.message}`
    )
  }

  /**
   * Cancel the pending destructive tool action.
   */
  function cancelPendingAction(): void {
    const call = pendingConfirmation.value
    pendingConfirmation.value = null
    if (call) {
      store.addActivityEvent({
        tool: call.tool,
        type: activityTypeForTool(call.tool),
        status: 'cancelled',
        label: 'Action cancelled',
        message: call.tool.replace(/_/g, ' '),
      })
    }
    store.addAssistantMessage(chatUI(lastDetectedLanguage.value, 'actionCancelled'))
  }

  /**
   * Infer task type is no longer used for routing — the model decides via native tool calling.
   * Kept only for provider selection hints (local vs cloud preference).
   */
  function inferTaskType(_content: string): TaskType {
    return 'chat'
  }

  /**
   * Classify user intent for pipeline pre-processing.
   * Used by length enforcer and response quality guardrails.
   * @see TASK-1381
   */
  function classifyIntent(text: string): UserIntent {
    const trimmed = text.trim().toLowerCase()
    // Greetings: short, no question marks, common greeting words
    if (trimmed.length < 20 && /^(hi|hello|hey|yo|sup|שלום|היי|מה קורה|בוקר טוב|ערב טוב)\b/i.test(trimmed)) {
      return 'greeting'
    }
    // Actions: explicit create/delete/update/start/stop verbs
    if (/^(create|add|make|delete|remove|update|change|set|start|stop|mark|move|assign|rename)\b/i.test(trimmed) ||
        /^(תצור|תוסיף|תמחק|תעדכן|תתחיל|תעצור|תסמן)\b/.test(trimmed)) {
      return 'action'
    }
    // Queries: questions
    if (/[?？]/.test(text) || /^(what|how|why|when|where|which|who|can|do|does|is|are|will|should|could|would|show|list|get|find|tell|give|מה|איך|למה|מתי|איפה|מי|האם|תראה|תגיד)\b/i.test(trimmed)) {
      return 'query'
    }
    return 'chat'
  }

  // ============================================================================
  // Quick Actions
  // ============================================================================

  /**
   * Quick action: Organize my canvas.
   */
  async function organizeCanvas(): Promise<void> {
    await sendMessage(
      'Analyze my canvas and suggest how to organize my tasks into groups.',
      { taskType: 'canvas_analysis' }
    )
  }

  /**
   * Quick action: Break down selected task.
   */
  async function breakdownSelectedTask(): Promise<void> {
    const task = store.context.selectedTask
    if (!task) {
      store.addAssistantMessage(
        'Please select a task first, then ask me to break it down.'
      )
      return
    }

    await sendMessage(
      `Break down the task "${task.title}" into actionable subtasks.`,
      { taskType: 'task_breakdown' }
    )
  }

  /**
   * Quick action: Plan my week.
   */
  async function planWeek(): Promise<void> {
    await executeAgentChain('plan_my_week')
  }

  /**
   * Execute a tool directly (bypassing AI).
   * Used for quick actions that map 1:1 to a tool.
   */
  async function executeDirectTool(label: string, toolCall: ToolCall): Promise<void> {
    if (!toolCall) return

    // Add user message to show action
    store.addUserMessage(label)

    // Start assistant response
    store.startStreamingMessage()
    store.appendStreamingContent(`Executing ${label}...`)

    try {
      console.log('[AIChat] Executing direct tool:', toolCall.tool, toolCall.parameters)
      const activityId = beginToolActivity(toolCall)
      const result = await executeTool(toolCall, lastDetectedLanguage.value)
      finishToolActivity(activityId, toolCall, result)
      console.log('[AIChat] Direct tool result:', result)

      if (result.success && result.undoAction) {
        store.pushUndoEntry({
          toolName: toolCall.tool,
          timestamp: Date.now(),
          params: toolCall.parameters,
          undoAction: result.undoAction,
          description: result.message,
        })
      }

      // Update message with result
      const resultMsg = result.success ? result.message : `Error: ${result.message}`
      store.appendStreamingContent(`\n\n${resultMsg}`)

      // Add tool result metadata
      const lastMsg = store.messages[store.messages.length - 1]
      if (lastMsg && lastMsg.isStreaming) {
        lastMsg.metadata = {
          ...lastMsg.metadata,
          toolResults: [{
            success: result.success,
            message: result.message,
            data: result.data,
            tool: toolCall.tool,
            type: AI_TOOLS.find(t => t.name === toolCall.tool)?.category || 'read',
          }],
        }
      }

      store.completeStreamingMessage()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Action failed'
      store.addActivityEvent({
        tool: toolCall.tool,
        type: activityTypeForTool(toolCall.tool),
        status: 'failed',
        label: activityLabelForTool(toolCall.tool, 'failed'),
        message: errorMessage,
      })
      store.failStreamingMessage(errorMessage)
    }
  }

  // ============================================================================
  // Agent Chains
  // ============================================================================

  /**
   * Execute a predefined agent chain.
   * Runs tool steps sequentially, shows progress, and sends final prompt to AI.
   */
  async function executeAgentChain(chainId: string): Promise<void> {
    if (store.isGenerating) return

    const chain = agentChains.chains.find((c) => c.id === chainId)
    if (!chain) {
      store.addAssistantMessage(`Chain not found: ${chainId}`)
      return
    }

    // Detect language from recent user messages so chains respond in the user's language
    const recentUserMessages = store.messages
      .filter((m) => m.role === 'user')
      .slice(-5)
      .map((m) => m.content || '')
      .join(' ')
    const chainLang: 'he' | 'en' = detectLanguage(recentUserMessages) === 'he' ? 'he' : 'en'

    // Clear input and add user message
    store.inputText = ''
    store.clearError()
    store.addUserMessage(chain.name)

    // Start streaming message to show progress
    store.startStreamingMessage()

    try {
      // Execute the chain, passing detected language so promptFn can append directives
      console.log(`[AIChat] Starting agent chain: ${chain.name} (lang: ${chainLang})`)
      const { results, finalPrompt } = await agentChains.executeChain(chainId, chainLang)
      results.forEach((result, i) => {
        const step = chain.steps[i]
        const toolName = step?.type === 'tool' ? step.tool : 'prompt'
        store.addActivityEvent({
          tool: toolName || 'unknown',
          type: toolName ? activityTypeForTool(toolName) : 'thinking',
          status: result.success ? 'success' : 'failed',
          label: result.success ? 'Chain step complete' : 'Chain step failed',
          message: result.message,
          undoAvailable: result.success && !!result.undoAction,
        })
      })

      // Show tool results as they come in (add to message metadata)
      const lastMsg = store.messages[store.messages.length - 1]
      if (lastMsg && lastMsg.isStreaming) {
        lastMsg.metadata = {
          ...lastMsg.metadata,
          toolResults: results.map((r, i) => {
            const step = chain.steps[i]
            const toolName = step.type === 'tool' ? step.tool : 'prompt'
            return {
              success: r.success,
              message: r.message,
              data: r.data,
              tool: toolName || 'unknown',
              type: 'read' as const,
            }
          }),
        }
      }

      // If there's a final prompt, send it to the AI
      if (finalPrompt) {
        // Update streaming content with a loading message
        store.appendStreamingContent(chatUI(chainLang, 'analyzingResults'))

        // Send the prompt through the AI
        const router = await getRouter()
        const langDirective = chainLang === 'he'
          ? ' ענה תמיד בעברית.'
          : ''
        const aiMessages: RouterChatMessage[] = [
          { role: 'system', content: `You are FlowState AI, a friendly productivity assistant. Respond concisely.${langDirective}` },
          { role: 'user', content: finalPrompt },
        ]

        let fullResponse = ''
        for await (const chunk of router.chatStream(aiMessages, {
          taskType: 'chat',
          contextFeature: 'chat',
          forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
          model: selectedModel.value || undefined,
        })) {
          fullResponse += chunk.content
        }

        // Replace loading message with AI response
        const cleanResponse = stripToolBlocks(fullResponse)
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content = cleanResponse
          store.streamingContent = cleanResponse
        }
      } else {
        // No final prompt — just show tool results
        const summary = `Completed chain "${chain.name}" with ${results.length} steps.`
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content = summary
          store.streamingContent = summary
        }
      }

      store.completeStreamingMessage()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Chain execution failed'
      store.failStreamingMessage(errorMessage)
      console.error('[AIChat] Agent chain error:', err)
    }
  }

  // ============================================================================
  // Panel Management
  // ============================================================================

  /**
   * Open panel with a specific context.
   */
  function openWithContext(ctx: Partial<ChatContext>) {
    store.updateContext(ctx)
    store.openPanel()
  }

  /**
   * Open panel for a specific task.
   */
  function openForTask(task: { id: string; title: string }) {
    const fullTask = taskStore.getTask(task.id)
    store.setSelectedTask(fullTask)
    store.openPanel()
  }

  // ============================================================================
  // Keyboard Shortcut
  // ============================================================================

  /**
   * Handle keyboard shortcut (Ctrl+/).
   */
  function handleKeyboardShortcut(event: KeyboardEvent) {
    if (event.ctrlKey && event.key === '/') {
      event.preventDefault()
      store.togglePanel()
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Refresh available Ollama models.
   */
  async function refreshOllamaModels() {
    isLoadingModels.value = true
    try {
      availableOllamaModels.value = await fetchOllamaModels()
    } finally {
      isLoadingModels.value = false
    }
  }

  /**
   * Set the active provider (auto, groq, or ollama).
   * Persists the selection to localStorage via the store.
   */
  async function setProvider(provider: 'ollama' | 'groq' | 'openrouter' | 'auto' | 'bridge') {
    // TASK-1814: bridge is brain-keyed — delegate to selectBrain
    if (provider === 'bridge') {
      const remembered = providerModelMemory.value['bridge']
      const brain = remembered === 'codex' ? 'codex' : remembered === 'claude' ? 'claude' : undefined
      selectBrain(brain ?? (useSettingsStore().aiBrain === 'codex' ? 'codex' : 'claude'))
      return
    }

    // Save current model for the outgoing provider
    providerModelMemory.value[selectedProvider.value] = selectedModel.value

    // Switch provider
    selectedProvider.value = provider

    // Restore saved model for the incoming provider (or null if none saved)
    selectedModel.value = providerModelMemory.value[provider] ?? null

    store.updatePersistedSettings({
      provider,
      model: selectedModel.value || '',
    })

    // Update active provider badge
    if (provider === 'auto') {
      try {
        const router = await getRouter()
        const detectedProvider = await router.getActiveProvider()
        activeProviderRef.value = detectedProvider
      } catch {
        activeProviderRef.value = null
      }
    } else {
      activeProviderRef.value = provider
    }

    if (provider === 'ollama' && availableOllamaModels.value.length === 0) {
      refreshOllamaModels()
    }
  }

  /**
   * Set the model to use (null = default for provider).
   * Persists the selection to localStorage via the store.
   */
  function setModel(model: string | null) {
    selectedModel.value = model
    store.updatePersistedSettings({
      provider: selectedProvider.value,
      model: model || '',
    })
  }

  /**
   * TASK-1814: Select the subscription brain (Claude or Codex) for this chat.
   * Routes all chat through the bridge provider with the chosen brain. Enables
   * the subscription if it was off and rebuilds the router so 'bridge' is active.
   */
  function selectBrain(brain: 'claude' | 'codex') {
    providerModelMemory.value[selectedProvider.value] = selectedModel.value
    selectedProvider.value = 'bridge'
    selectedModel.value = brain
    providerModelMemory.value['bridge'] = brain
    activeProviderRef.value = 'bridge'

    const settings = useSettingsStore()
    settings.updateSetting('aiUseSubscription', true)
    settings.updateSetting('aiBrain', brain)
    resetSharedRouter() // rebuild router so the bridge provider is included + uses the new brain

    store.updatePersistedSettings({ provider: 'bridge', model: brain })
  }

  /**
   * Initialize the AI chat system.
   * Loads persisted provider/model settings from store.
   */
  async function initialize() {
    store.initialize()

    // Load persisted settings
    const savedSettings = store.getPersistedSettings()
    if (savedSettings) {
      if (['ollama', 'groq', 'openrouter', 'auto', 'bridge'].includes(savedSettings.provider)) {
        selectedProvider.value = savedSettings.provider as typeof selectedProvider.value
      }
      if (savedSettings.model) {
        // Validate persisted model matches persisted provider
        // Groq models contain '-' and numbers (e.g. llama-3.3-70b-versatile)
        // Ollama models contain ':' (e.g. llama3.2:latest)
        const model = savedSettings.model
        const provider = selectedProvider.value
        const looksLikeOllama = model.includes(':')
        const looksLikeGroq = /\d/.test(model) && model.includes('-') && !model.includes(':')

        if (provider === 'groq' && looksLikeOllama) {
          // Ollama model persisted but provider is Groq — reset
          selectedModel.value = null
        } else if (provider === 'ollama' && looksLikeGroq) {
          // Groq model persisted but provider is Ollama — reset
          selectedModel.value = null
        } else {
          selectedModel.value = model
        }
      }
    }

    // Pre-initialize the router
    try {
      const routerInstance = await getRouter()
      // Only auto-detect active provider when in auto mode.
      // If user explicitly selected a provider, respect their choice.
      if (selectedProvider.value === 'auto') {
        const provider = await routerInstance!.getActiveProvider()
        activeProviderRef.value = provider
      } else {
        activeProviderRef.value = selectedProvider.value
      }
      // Avoid localhost/CSP probes unless the user is actively using Ollama.
      if (selectedProvider.value === 'ollama') {
        availableOllamaModels.value = await fetchOllamaModels()
      }
    } catch (err) {
      console.warn('[AIChat] Router initialization failed, will retry on first use:', err)
    }
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State (from store)
    isPanelOpen,
    messages,
    inputText,
    isGenerating,
    streamingContent,
    context,
    pendingSuggestionCount,
    error,
    activeProvider: activeProviderRef,
    selectBrain,

    // Provider/model selection
    selectedProvider,
    selectedModel,
    availableOllamaModels,
    isLoadingModels,
    setProvider,
    setModel,
    refreshOllamaModels,

    // Confirmation flow
    pendingConfirmation,
    confirmPendingAction,
    cancelPendingAction,

    // Computed
    visibleMessages,
    canSend,

    // Panel actions
    togglePanel: store.togglePanel,
    openPanel: store.openPanel,
    closePanel: store.closePanel,
    openWithContext,
    openForTask,

    // Message actions
    sendMessage,
    sendMessageWithReAct,
    abortReAct,
    clearMessages: store.clearMessages,
    clearError: store.clearError,

    // Quick actions
    organizeCanvas,
    breakdownSelectedTask,
    planWeek,

    // Context
    setCurrentView: store.setCurrentView,
    setSelectedTask: store.setSelectedTask,
    updateContext: store.updateContext,

    // Personality
    aiPersonality,
    setPersonality,

    // Agent chains
    executeAgentChain,
    agentChains: agentChains.chains,
    chainExecution: agentChains.currentExecution,
    abortChain: agentChains.abortChain,

    // Chat Direction
    chatDirection,
    setChatDirection: store.setChatDirection,

    // Lifecycle
    initialize,
    handleKeyboardShortcut,
    executeDirectTool
  }
}
