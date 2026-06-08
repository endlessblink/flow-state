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
import { detectLanguage } from '@/services/ai/pipeline/languageDetector'
import { cleanResponse } from '@/services/ai/pipeline/responseValidator'
import { digestToolResults } from '@/services/ai/pipeline/preDigestedReasoning'
import { detectFluff, extractTaskTitlesFromResults } from '@/services/ai/pipeline/fluffDetector'
import { EntityMemory } from '@/services/ai/pipeline/entityMemory'
import type { PreProcessResult, UserIntent } from '@/services/ai/pipeline/types'
import { routeIntent, type RoutedIntent } from '@/services/ai/pipeline/intentRouter'
import { getTemplate } from '@/services/ai/pipeline/responseTemplates'
import { buildReasoningDirective } from '@/services/ai/pipeline/reasoningDirective'
import { collectCardTasks, ensureCardTaskMentions, parseCardGroups, stripCardsBlock, stripStreamingCardsBlock } from '@/services/ai/pipeline/cardsBlock'
import {
  buildWeeklyPlanningInterview,
  buildWeeklyPlanReliabilityFallback,
  buildWeekContextFromToolResults,
  buildWeeklyPlanPrompt,
  parseWeeklyPlanOutput,
  type WeekContextMemoryInput,
  type WeeklyPlanOutput,
} from '@/services/ai/pipeline/weeklyPlan'
import type { AIClarificationEvent, AIContextEntity, ProjectContext, TaskContext } from '@/types/aiMemory'
import { useWorkProfile } from '@/composables/useWorkProfile'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
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

export type ChatLanguage = 'auto' | 'en' | 'he'
type ChatOutputLanguage = 'en' | 'he'

export function resolveChatOutputLanguage(detectedLanguage: ChatOutputLanguage, chatLanguage: ChatLanguage): ChatOutputLanguage {
  return chatLanguage === 'auto' ? detectedLanguage : chatLanguage
}

export function detectExpectedLanguageMismatch(expectedLanguage: ChatOutputLanguage, outputText: string): boolean {
  const outputLanguage = detectLanguage(outputText)
  if (outputLanguage === 'unknown') return false
  return outputLanguage !== expectedLanguage
}

function languageNameFor(language: ChatOutputLanguage): string {
  return language === 'he' ? 'Hebrew (עברית)' : 'English'
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
const WEEK_PLAN_BRIDGE_FORMATTER_TIMEOUT_MS = 12_000
const WEEK_PLAN_STRUCTURED_TIMEOUT_MS = 8_000
const WEEK_PLAN_MEMORY_TIMEOUT_MS = 1_500

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
    waitingConfirmation: { en: 'Waiting for confirmation', he: 'ממתין לאישור' },
    readComplete: { en: 'Read complete', he: 'הקריאה הושלמה' },
    actionComplete: { en: 'Action complete', he: 'הפעולה הושלמה' },
    readFailed: { en: 'Read failed', he: 'הקריאה נכשלה' },
    actionFailed: { en: 'Action failed', he: 'הפעולה נכשלה' },
    updatingFlowState: { en: 'Updating FlowState', he: 'מעדכן את FlowState' },
    preparingAction: { en: 'Preparing protected action', he: 'מכין פעולה מוגנת' },
    readingFlowState: { en: 'Reading FlowState', he: 'קורא מ-FlowState' },
    actionCancelledLabel: { en: 'Action cancelled', he: 'הפעולה בוטלה' },
    chainStepComplete: { en: 'Chain step complete', he: 'שלב בשרשרת הושלם' },
    chainStepFailed: { en: 'Chain step failed', he: 'שלב בשרשרת נכשל' },
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
    chatLanguage,
    chatDirection
  } = storeToRefs(store)

  // Pending confirmation flow: stores a tool call awaiting user approval
  const pendingConfirmation = ref<ToolCall | null>(null)

  // Last detected language — used by confirmation/cancel handlers outside the ReAct scope
  const lastDetectedLanguage = ref<'he' | 'en'>('en')

  const currentOutputLanguage = () => resolveChatOutputLanguage(lastDetectedLanguage.value, chatLanguage.value)

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
    const lang = currentOutputLanguage()
    if (status === 'waiting_confirmation') return chatUI(lang, 'waitingConfirmation')
    if (status === 'success') return type === 'read' ? chatUI(lang, 'readComplete') : chatUI(lang, 'actionComplete')
    if (status === 'failed') return type === 'read' ? chatUI(lang, 'readFailed') : chatUI(lang, 'actionFailed')
    if (type === 'write') return chatUI(lang, 'updatingFlowState')
    if (type === 'destructive') return chatUI(lang, 'preparingAction')
    return chatUI(lang, 'readingFlowState')
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

  function beginChatPhase(label: string, message?: string): string {
    return store.addActivityEvent({
      type: 'thinking',
      status: 'running',
      label,
      message,
      id: 'ai-chat-phase-live',
    })
  }

  function updateChatPhase(activityId: string, label: string, message?: string): void {
    store.updateActivityEvent(activityId, {
      status: 'running',
      label,
      message,
    })
  }

  function finishChatPhase(activityId: string, label = 'Response ready', message?: string): void {
    store.updateActivityEvent(activityId, {
      status: 'success',
      label,
      message,
    })
  }

  function failChatPhase(activityId: string, label = 'Response failed', message?: string): void {
    store.updateActivityEvent(activityId, {
      status: 'failed',
      label,
      message,
    })
  }

  async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        }),
      ])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
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
  function buildRichTaskData(r: ToolResult, lang: 'he' | 'en', startIndex = 1): string {
    const ok = `[${r.success ? 'OK' : 'ERROR'}] ${r.message}`
    const data = r.data
    const taskItems = collectCardTasks([r])
    if (taskItems.length === 0) {
      return digestToolResults('', data, ok, lang) // non-task-list → keep digest
    }
    const today = new Date().toISOString().split('T')[0]
    const lines: string[] = [ok]
    const slice = taskItems.slice(0, 25)
    let timerSessions: Array<{ taskId: string; duration: number; isBreak?: boolean }> = []
    try {
      timerSessions = useTimerStore().completedSessions.map(session => ({
        taskId: session.taskId,
        duration: session.duration,
        isBreak: session.isBreak,
      }))
    } catch { /* timer store may be unavailable in narrow tests */ }
    for (let i = 0; i < slice.length; i++) {
      const item = slice[i]
      const id = item.id as string | undefined
      const full = ((id ? taskStore.getTask(id) : null) || item) as unknown as Task & { tags?: string[]; subtasks?: Array<{ completed?: boolean; done?: boolean; isCompleted?: boolean }> }
      // [N] index lets the model reference tasks in the `cards` block by number
      // (robust vs title-matching, esp. Hebrew/paraphrased). The index must be
      // global across tool results because parseCardGroups maps against the same
      // combined task list.
      const parts: string[] = [`[${startIndex + i}] ${full.title || '(untitled)'}`]
      if (full.priority) parts.push(`priority=${full.priority}`)
      if (full.dueDate) {
        const d = String(full.dueDate).slice(0, 10)
        parts.push(d < today ? `OVERDUE (was due ${d})` : `due ${d}`)
      }
      const desc = (full.description || '').trim()
      if (desc) parts.push(`notes: "${desc.slice(0, 240)}"`)
      if (Array.isArray(full.tags) && full.tags.length) parts.push(`tags: ${full.tags.join(', ')}`)
      if (Array.isArray(full.subtasks) && full.subtasks.length) {
        const done = full.subtasks.filter((s: { completed?: boolean; done?: boolean; isCompleted?: boolean }) => s.completed || s.done || s.isCompleted).length
        parts.push(`subtasks ${done}/${full.subtasks.length} done`)
      }
      if (full.estimatedDuration) parts.push(`~${full.estimatedDuration}min`)
      if (Array.isArray(full.dependsOn) && full.dependsOn.length) {
        const dependencyTitles = full.dependsOn
          .map(depId => taskStore.getTask(depId)?.title || depId)
          .filter(Boolean)
          .slice(0, 3)
        if (dependencyTitles.length) parts.push(`depends on: ${dependencyTitles.join(', ')}`)
      }
      if (full.connectionTypes && typeof full.connectionTypes === 'object') {
        const connections = Object.entries(full.connectionTypes)
          .map(([targetId, relation]) => {
            const target = taskStore.getTask(targetId)?.title || targetId
            return `${relation} -> ${target}`
          })
          .slice(0, 3)
        if (connections.length) parts.push(`connections: ${connections.join('; ')}`)
      }
      if (Array.isArray(full.planningNotes) && full.planningNotes.length) {
        const notes = full.planningNotes
          .map(note => [note.title, note.description].filter(Boolean).join(': ').trim())
          .filter(Boolean)
          .slice(0, 2)
          .join(' | ')
        if (notes) parts.push(`planning notes: "${notes.slice(0, 180)}"`)
      }
      if (Array.isArray(full.instances) && full.instances.length) {
        const scheduled = full.instances
          .slice(0, 2)
          .map(instance => [instance.scheduledDate, instance.scheduledTime, instance.duration ? `${instance.duration}min` : ''].filter(Boolean).join(' '))
          .filter(Boolean)
        if (scheduled.length) parts.push(`scheduled: ${scheduled.join(', ')}`)
      }
      const focusedSessions = id ? timerSessions.filter(session => session.taskId === id && !session.isBreak) : []
      if (focusedSessions.length) {
        const focusedMinutes = focusedSessions.reduce((sum, session) => sum + Math.round((session.duration || 0) / 60), 0)
        parts.push(`focus history today: ${focusedSessions.length} sessions, ${focusedMinutes}min`)
      } else if (full.completedPomodoros > 0) {
        parts.push(`pomodoros completed: ${full.completedPomodoros}`)
      }
      if (full.projectId) {
        const pname = taskStore.getProjectDisplayName?.(full.projectId)
        if (pname) parts.push(`project: ${pname}`)
      }
      lines.push(parts.join(' | '))
    }
    return lines.join('\n').slice(0, 6000)
  }

  function buildRichToolResultsData(toolResults: ToolResult[], lang: 'he' | 'en'): string {
    let nextTaskIndex = 1
    return toolResults.map(r => {
      const summary = buildRichTaskData(r, lang, nextTaskIndex)
      nextTaskIndex += collectCardTasks([r]).length
      return summary
    }).join('\n\n')
  }

  function isSupabaseUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  }

  function uniqueSupabaseIds(values: string[]): string[] {
    return [...new Set(values.map(value => value.trim()).filter(isSupabaseUuid))]
  }

  function uniqueStrings(values: string[]): string[] {
    return [...new Set(values.map(value => value.trim()).filter(Boolean))]
  }

  function projectEntityKey(projectId: string): string {
    return `project:${projectId || 'uncategorized'}`
  }

  function taskEntityKey(taskId: string): string {
    return `task:${taskId}`
  }

  function factString(facts: Record<string, unknown>, field: string): string | null {
    const value = facts[field]
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  function factArray(facts: Record<string, unknown>, field: string): string[] {
    const value = facts[field]
    if (Array.isArray(value)) return value.map(String).filter(Boolean)
    if (typeof value === 'string' && value.trim()) return [value.trim()]
    return []
  }

  function entityToProjectContext(entity: AIContextEntity): ProjectContext | null {
    if (entity.entityType !== 'project' && entity.entityType !== 'synthetic_group') return null
    const projectId = entity.canonicalProjectId || entity.entityKey.replace(/^project:/, '').replace(/^synthetic_group:/, '')
    if (!projectId) return null
    const facts = entity.facts ?? {}
    const domain = factString(facts, 'domain')
    const currentStakes = factString(facts, 'currentStakes')
    const urgencyWindow = factString(facts, 'urgencyWindow')
    return {
      projectId,
      summary: entity.summary ?? factString(facts, 'summary'),
      domain: domain === 'work' || domain === 'personal' || domain === 'creative' || domain === 'admin' || domain === 'learning' || domain === 'health' ? domain : 'unknown',
      lifeArea: factString(facts, 'lifeArea'),
      whyItMatters: factString(facts, 'whyItMatters') ?? factString(facts, 'thisWeekImportance'),
      successCriteria: factArray(facts, 'successCriteria'),
      failureRisks: factArray(facts, 'failureRisks'),
      currentStakes: currentStakes === 'low' || currentStakes === 'medium' || currentStakes === 'high' || currentStakes === 'critical' ? currentStakes : 'unknown',
      urgencyWindow: urgencyWindow === 'none' || urgencyWindow === 'this_week' || urgencyWindow === 'this_month' || urgencyWindow === 'date_bound' ? urgencyWindow : 'unknown',
      preferredCadence: null,
      taskSelectionHints: factArray(facts, 'taskSelectionHints'),
      nonGoals: factArray(facts, 'nonGoals'),
      userCorrections: [...entity.corrections, ...factArray(facts, 'userCorrections')],
      confidence: entity.confidence,
      completenessScore: entity.completenessScore,
      lastConfirmedAt: entity.lastAnsweredAt ?? null,
      lastUpdatedAt: entity.lastAnsweredAt ?? entity.lastAskedAt ?? null,
      staleAfter: entity.staleAfter ?? null,
    }
  }

  function entityToTaskContext(entity: AIContextEntity): TaskContext | null {
    if (entity.entityType !== 'task') return null
    const taskId = entity.canonicalTaskId || entity.entityKey.replace(/^task:/, '')
    if (!taskId) return null
    const facts = entity.facts ?? {}
    const currentStakes = factString(facts, 'currentStakes')
    const urgencyWindow = factString(facts, 'urgencyWindow')
    return {
      taskId,
      projectId: factString(facts, 'projectId'),
      summary: entity.summary ?? factString(facts, 'summary'),
      whyItMatters: factString(facts, 'whyItMatters'),
      successCriteria: factArray(facts, 'successCriteria'),
      currentStakes: currentStakes === 'low' || currentStakes === 'medium' || currentStakes === 'high' || currentStakes === 'critical' ? currentStakes : 'unknown',
      urgencyWindow: urgencyWindow === 'none' || urgencyWindow === 'this_week' || urgencyWindow === 'this_month' || urgencyWindow === 'date_bound' ? urgencyWindow : 'unknown',
      selectionHints: factArray(facts, 'selectionHints'),
      nonGoals: factArray(facts, 'nonGoals'),
      userCorrections: [...entity.corrections, ...factArray(facts, 'userCorrections')],
      confidence: entity.confidence,
      completenessScore: entity.completenessScore,
      lastConfirmedAt: entity.lastAnsweredAt ?? null,
      lastUpdatedAt: entity.lastAnsweredAt ?? entity.lastAskedAt ?? null,
      staleAfter: entity.staleAfter ?? null,
    }
  }

  async function buildAIMemorySummaryForToolResults(toolResults: ToolResult[], lang: 'he' | 'en'): Promise<string> {
    const cardTasks = collectCardTasks(toolResults)
    if (!cardTasks.length) return ''
    try {
      const db = useSupabaseDatabase()
      const taskIds = uniqueSupabaseIds(cardTasks.map(task => String(task.id || '')))
      const projectIds = uniqueSupabaseIds(cardTasks
        .map(task => {
          const id = String(task.id || '')
          return id ? taskStore.getTask(id)?.projectId || String(task.projectId || '') : String(task.projectId || '')
        })
      )
      const [projectContexts, taskContexts] = await Promise.all([
        db.fetchProjectContexts(projectIds),
        db.fetchTaskContexts(taskIds),
      ])
      const lines: string[] = [
        lang === 'he'
          ? 'זיכרון הבנת פרויקטים/משימות: אין להסיק חשיבות, קטגוריה, סיכון או קריטריוני הצלחה משמות פרויקטים בלבד.'
          : 'Project/task understanding memory: do not infer importance, category, stakes, or success criteria from project names alone.',
      ]
      for (const ctx of projectContexts.slice(0, 8)) {
        const projectName = taskStore.getProjectDisplayName?.(ctx.projectId) || ctx.projectId
        const bits = [
          `domain=${ctx.domain}`,
          ctx.currentStakes !== 'unknown' ? `stakes=${ctx.currentStakes}` : '',
          ctx.whyItMatters ? `why="${ctx.whyItMatters.slice(0, 160)}"` : '',
          ctx.successCriteria.length ? `success="${ctx.successCriteria.slice(0, 2).join('; ').slice(0, 160)}"` : '',
        ].filter(Boolean)
        if (bits.length) lines.push(`- project ${projectName}: ${bits.join(' | ')}`)
      }
      for (const ctx of taskContexts.slice(0, 8)) {
        const taskName = taskStore.getTask(ctx.taskId)?.title || ctx.taskId
        const bits = [
          ctx.currentStakes !== 'unknown' ? `stakes=${ctx.currentStakes}` : '',
          ctx.whyItMatters ? `why="${ctx.whyItMatters.slice(0, 160)}"` : '',
          ctx.successCriteria.length ? `success="${ctx.successCriteria.slice(0, 2).join('; ').slice(0, 160)}"` : '',
        ].filter(Boolean)
        if (bits.length) lines.push(`- task ${taskName}: ${bits.join(' | ')}`)
      }
      const projectsWithoutContext = projectIds
        .filter(id => !projectContexts.some(ctx => ctx.projectId === id))
        .map(id => taskStore.getProjectDisplayName?.(id) || id)
        .slice(0, 5)
      if (projectsWithoutContext.length) {
        lines.push(`- context unknown for projects: ${projectsWithoutContext.join(', ')}`)
      }
      return lines.join('\n')
    } catch {
      return ''
    }
  }

  function getTaskItemsFromToolResults(toolResults: ToolResult[]): Array<Record<string, unknown> & { title?: string; __cardIndex?: number }> {
    const tasks: Array<Record<string, unknown> & { title?: string; __cardIndex?: number }> = []
    const addTask = (item: unknown) => {
      if (!item || typeof item !== 'object' || typeof (item as Record<string, unknown>).title !== 'string') return
      const raw = item as Record<string, unknown>
      const id = typeof raw.id === 'string' ? raw.id : ''
      const full = id ? taskStore.getTask(id) : null
      tasks.push({
        ...raw,
        ...(full ? {
          title: full.title,
          description: full.description,
          status: full.status,
          priority: full.priority,
          dueDate: full.dueDate,
          estimatedDuration: full.estimatedDuration,
          projectId: full.projectId,
          tags: full.tags,
          subtasks: full.subtasks,
          dependsOn: full.dependsOn,
          connectionTypes: full.connectionTypes,
          planningNotes: full.planningNotes,
          completedPomodoros: full.completedPomodoros,
        } : {}),
        __cardIndex: tasks.length + 1,
      })
    }
    for (const result of toolResults) {
      const data = result.data
      if (!result.success) continue
      if (Array.isArray(data)) {
        data.forEach(addTask)
      } else if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>
        for (const key of ['tasks', 'dueTodayTasks', 'overdueTasks', 'unscheduled']) {
          const value = record[key]
          if (Array.isArray(value)) {
            value.forEach(addTask)
          }
        }
      }
    }
    return tasks
  }

  function fallbackTaskScore(task: Record<string, unknown>): number {
    const title = String(task.title || '').toLowerCase()
    const description = String(task.description || '').toLowerCase()
    const text = `${title} ${description}`
    let score = 0

    if (task.status === 'in_progress') score += 4
    if (task.priority === 'urgent') score += 7
    if (task.priority === 'high') score += 5
    if (task.priority === 'medium') score += 2
    if (description.trim()) score += 3
    if (/(payment|invoice|cardcom|charge|billing|תשלום|חשבונית|חיוב|קאדרקום)/i.test(text)) score += 8
    if (/(treatment|medicine|dose|twice a day|טיפול|תרופה|מנה|מנות|אוראו|פעמיים ביום)/i.test(text)) score += 7
    if (/(reply|send|call|email|message|stakeholder|להגיב|לשלוח|להתקשר|מייל|הודעה)/i.test(text)) score += 6
    if (/(outreach|cold opener|target list|sales|lead|פייפרפורט|לסקין|רשימת|אאוטריץ|מכירות)/i.test(text)) score += 5
    if (/(lecture|choose|slot|date|הרצאה|לבחור|מועד|תאריך)/i.test(text)) score += 4

    const due = typeof task.dueDate === 'string' ? task.dueDate.slice(0, 10) : ''
    if (due) {
      const today = new Date().toISOString().slice(0, 10)
      if (due < today) score += 6
      else if (due === today) score += 5
      else score += 2
    }
    if (typeof task.daysOverdue === 'number') score += Math.min(6, Math.max(1, task.daysOverdue))
    if (typeof task.estimatedDuration === 'number' && task.estimatedDuration > 0 && task.estimatedDuration <= 30) score += 1

    return score
  }

  function rankFallbackTasks(tasks: Array<Record<string, unknown> & { title?: string }>): Array<Record<string, unknown> & { title?: string }> {
    return [...tasks].sort((a, b) => fallbackTaskScore(b) - fallbackTaskScore(a))
  }

  type FallbackAspect = {
    key: string
    name: string
    outcome: string
    why: string
    defer: string
    tasks: Array<Record<string, unknown> & { title?: string }>
  }

  const WEEKLY_FALLBACK_TASK_LIMIT = 4
  const WEEKLY_FALLBACK_ASPECT_LIMIT = 3
  const WEEKLY_FALLBACK_TASKS_PER_ASPECT = 3

  function fallbackTaskText(task: Record<string, unknown>): string {
    return `${String(task.title || '')} ${String(task.description || '')}`.toLowerCase()
  }

  function inferFallbackAspect(task: Record<string, unknown>, lang: 'he' | 'en'): Omit<FallbackAspect, 'tasks'> {
    const text = fallbackTaskText(task)
    if (/(outreach|cold opener|target list|sales|lead|פייפרפורט|לסקין|רשימת|אאוטריץ|מכירות|לידים|לקוחות)/i.test(text)) {
      return lang === 'he'
        ? {
            key: 'outreach',
            name: 'רצף מכירות / אאוטריץ׳',
            outcome: 'להפוך רשימה ומסר ראשוני לתנועה אמיתית מול אנשים.',
            why: 'המשימות כאן הן לא פריטים נפרדים; הן שלבים באותו צינור. אם עושים רק שלב אחד, נוצרת תחושת התקדמות בלי המשך.',
            defer: 'לא לפתוח עוד ניסוחים לפני שיש רשימת יעד או צעד שליחה ברור.',
          }
        : {
            key: 'outreach',
            name: 'Outreach pipeline',
            outcome: 'turn a target list and opener into real movement with people',
            why: 'these are not isolated tasks; they are steps in one pipeline. Doing only one step creates fake progress.',
            defer: 'do not polish more copy before the target list and first send path are clear',
          }
    }
    if (/(treatment|medicine|dose|twice a day|water|food|litter|vet|pet|טיפול|תרופה|מנה|מנות|מים|אוכל|חול|וטרינר|אוראו|פעמיים ביום)/i.test(text)) {
      return lang === 'he'
        ? {
            key: 'care',
            name: 'רצף טיפול / תחזוקה שוטפת',
            outcome: 'לשמור על רצף טיפול ואספקה כדי שלא תיווצר בעיה מצטברת.',
            why: 'אלה משימות שמדרדרות כשדוחים אותן: טיפול, מים, אוכל או ציוד חסר לא נפתרים טוב בדיעבד.',
            defer: 'לא לערבב את זה עם עבודה כבדה; לסגור כבלוק קצר ומוגדר.',
          }
        : {
            key: 'care',
            name: 'Care routine',
            outcome: 'protect the care sequence before it becomes a bigger problem',
            why: 'these tasks degrade when delayed; treatment, water, food, or supplies are hard to recover retroactively.',
            defer: 'do not mix this with deep work; close it as a short defined block',
          }
    }
    if (/(payment|invoice|cardcom|charge|billing|תשלום|חשבונית|חיוב|קאדרקום|קארדקום)/i.test(text)) {
      return lang === 'he'
        ? {
            key: 'money',
            name: 'כספים / גבייה',
            outcome: 'לסגור סיכון כסף לפני שהוא יוצר בדיקות חוזרות או עיכוב מול אנשים.',
            why: 'כסף פתוח הוא לא עוד משימה; הוא יוצר חוסר ודאות, מעקב חוזר, ולעיתים חסימה לאחרים.',
            defer: 'לא לדחות לטובת אדמין קל אם יש סימן לתשלום תקוע.',
          }
        : {
            key: 'money',
            name: 'Money and billing risk',
            outcome: 'close money uncertainty before it creates follow-up loops',
            why: 'open money is not just admin; it creates uncertainty, repeated checking, and sometimes blocks other people.',
            defer: 'do not trade this for easier admin if a payment may be stuck',
          }
    }
    if (/(reply|send|call|email|message|stakeholder|להגיב|לשלוח|להתקשר|מייל|הודעה|שיחה)/i.test(text)) {
      return lang === 'he'
        ? {
            key: 'followup',
            name: 'תקשורת / אנשים שמחכים',
            outcome: 'להוריד חוב תקשורתי ולפתוח תנועה אצל אחרים.',
            why: 'כאן הערך הוא לא עצם השליחה אלא הסרת המתנה: מישהו אחר יכול להתקדם רק אחרי תגובה.',
            defer: 'לא לפתוח את זה לאורך כל היום; לאגד לבלוק תקשורת קצר.',
          }
        : {
            key: 'followup',
            name: 'Follow-up and waiting people',
            outcome: 'reduce communication debt and unblock someone else',
            why: 'the value is not the send action itself; someone else may only move after the reply.',
            defer: 'do not let it fragment the whole day; batch it into one short communication block',
          }
    }
    if (/(lecture|choose|slot|date|meeting|הרצאה|לבחור|מועד|תאריך|פגישה)/i.test(text)) {
      return lang === 'he'
        ? {
            key: 'calendar',
            name: 'החלטות זמן / התחייבויות',
            outcome: 'לסגור החלטות זמן כדי שלא ימשיכו לתפוס מקום מנטלי.',
            why: 'משימות בחירת מועד נראות קטנות, אבל כל עוד הן פתוחות הן משאירות התחייבות לא סגורה.',
            defer: 'לא להשאיר את זה כמשימה פתוחה אם אפשר להפוך להחלטה אחת.',
          }
        : {
            key: 'calendar',
            name: 'Time commitments',
            outcome: 'close time decisions so they stop occupying mental space',
            why: 'date-choice tasks look small, but they keep a commitment unresolved until a decision is made.',
            defer: 'do not leave it as an open task if one decision can close it',
          }
    }
    return lang === 'he'
      ? {
          key: 'open-loop',
          name: 'לולאות פתוחות שדורשות החלטה',
          outcome: 'להחליט אם המשימות האלה באמת שייכות לשבוע או צריכות הקשר נוסף.',
          why: 'אין מספיק מידע כדי להעמיד פנים שיש כאן סיפור עמוק; הערך הוא להכריע או להוסיף הערה.',
          defer: 'לדחות משימות בלי הקשר במקום לתת להן לתפוס מקום מרכזי בתוכנית.',
        }
      : {
          key: 'open-loop',
          name: 'Open loops needing a decision',
          outcome: 'decide whether these tasks really belong this week or need more context',
          why: 'there is not enough context to pretend there is a deep story; the value is deciding or adding a note.',
          defer: 'defer tasks without context instead of letting them dominate the plan',
        }
  }

  function fallbackTaskReason(task: Record<string, unknown>, lang: 'he' | 'en'): string {
    const text = fallbackTaskText(task)
    const description = String(task.description || '').trim()
    if (description) {
      const clipped = description.length > 90 ? `${description.slice(0, 87)}...` : description
      return lang === 'he' ? `ההקשר מההערה משנה את הבחירה: ${clipped}` : `the note changes the decision: ${clipped}`
    }
    if (/(water|מים)/i.test(text)) {
      return lang === 'he' ? 'מים הם חלק מהרצף הבסיסי; דחייה כאן יוצרת בעיה לפני שמרגישים אותה' : 'water is part of the basic care sequence; delay creates a problem before it is obvious'
    }
    if (/(food|litter|אוכל|חול)/i.test(text)) {
      return lang === 'he' ? 'אוכל או חול הם תשתית לטיפול; אם חסר ציוד, גם שאר הטיפול נתקע' : 'food or litter is care infrastructure; missing supplies block the rest of the routine'
    }
    if (/(target list|targets|רשימת|לידים)/i.test(text)) {
      return lang === 'he' ? 'בלי רשימת יעד, ניסוח או שליחה הופכים לעבודה באוויר' : 'without a target list, copywriting or sending becomes work in the air'
    }
    if (/(cold opener|opener|פתיח)/i.test(text)) {
      return lang === 'he' ? 'הפתיח שווה רק אם הוא מחובר לרשימת יעד ולשליחה ראשונה' : 'the opener matters only if it connects to a target list and first send'
    }
    if (/(payment|invoice|cardcom|charge|billing|תשלום|חשבונית|חיוב|קאדרקום|קארדקום)/i.test(text)) {
      return lang === 'he' ? 'כסף או גבייה עלולים להיתקע אם זה יחליק' : 'money or billing can get stuck if this slips'
    }
    if (/(reply|send|call|email|message|להגיב|לשלוח|להתקשר|מייל|הודעה)/i.test(text)) {
      return lang === 'he' ? 'מישהו כנראה מחכה לתגובה כדי להתקדם' : 'someone is probably waiting on this to move forward'
    }
    if (/(outreach|sales|lead|פייפרפורט|לסקין|אאוטריץ|מכירות)/i.test(text)) {
      return lang === 'he' ? 'זה חלק מרצף מכירות שכדאי לבצע כמקבץ' : 'this belongs to one sales sequence worth batching'
    }
    if (/(treatment|medicine|dose|twice a day|טיפול|תרופה|מנה|מנות|אוראו|פעמיים ביום)/i.test(text)) {
      return lang === 'he' ? 'רצף טיפול שנשבר קשה להשלים בדיעבד' : 'a broken treatment sequence is hard to recover later'
    }
    if (/(lecture|choose|slot|date|הרצאה|לבחור|מועד|תאריך)/i.test(text)) {
      return lang === 'he' ? 'בחירה עכשיו סוגרת התחייבות זמן ומונעת דחייה' : 'choosing now closes a time commitment and prevents drift'
    }
    if (task.dueDate || task.daysOverdue) {
      return lang === 'he'
        ? 'תזמון קרוב הופך את זה להתחייבות שכדאי לסגור'
        : 'near-term timing makes this a commitment worth closing'
    }
    return lang === 'he'
      ? 'אין מספיק הקשר, אבל היא צריכה החלטה במקום להישאר פתוחה'
      : 'there is limited context, but it needs a decision instead of staying open'
  }

  function fallbackTaskImpact(task: Record<string, unknown>, lang: 'he' | 'en'): string {
    const text = `${String(task.title || '')} ${String(task.description || '')}`.toLowerCase()
    if (/(payment|invoice|cardcom|charge|billing|תשלום|חשבונית|חיוב|קאדרקום)/i.test(text)) {
      return lang === 'he' ? 'מנקה סיכון כסף ומונע בדיקה חוזרת בהמשך' : 'clears money risk and avoids another audit loop'
    }
    if (/(reply|send|call|email|message|stakeholder|להגיב|לשלוח|להתקשר|מייל|הודעה)/i.test(text)) {
      return lang === 'he' ? 'פותח תנועה אצל אדם אחר ומקטין חוב תקשורתי' : 'unblocks another person and reduces communication debt'
    }
    if (/(outreach|cold opener|target list|sales|lead|פייפרפורט|לסקין|רשימת|אאוטריץ|מכירות)/i.test(text)) {
      return lang === 'he' ? 'מקדם רצף מכירות במקום להשאיר חלקים מפוזרים' : 'moves a sales sequence instead of leaving fragments open'
    }
    if (/(treatment|medicine|dose|twice a day|טיפול|תרופה|מנה|מנות|אוראו|פעמיים ביום)/i.test(text)) {
      return lang === 'he' ? 'שומר על רצף שאי אפשר להשלים טוב בדיעבד' : 'protects a sequence that is hard to recover retroactively'
    }
    if (/(lecture|choose|slot|date|הרצאה|לבחור|מועד|תאריך)/i.test(text)) {
      return lang === 'he' ? 'סוגר התחייבות זמן ומפחית החלטה פתוחה' : 'closes a time commitment and removes an open decision'
    }
    return lang === 'he'
      ? 'מקטין עומס פתוח ומבהיר אם המשימה באמת שייכת לשבוע'
      : 'reduces open load and clarifies whether it belongs this week'
  }

  function fallbackTaskSlot(task: Record<string, unknown>, lang: 'he' | 'en'): string {
    const minutes = typeof task.estimatedDuration === 'number' ? task.estimatedDuration : 0
    const text = `${String(task.title || '')} ${String(task.description || '')}`.toLowerCase()
    if (/(write|draft|opener|content|creative|לכתוב|טיוטה|פתיח|תוכן)/i.test(text)) {
      return lang === 'he' ? 'לשים בבוקר/בלוק חשיבה, לא בין סידורים' : 'put it in a morning/deep-work block, not between admin'
    }
    if (/(reply|send|call|email|message|להגיב|לשלוח|להתקשר|מייל|הודעה)/i.test(text)) {
      return lang === 'he' ? 'לבצע כבלוק תקשורת קצר ולא לפתוח לאורך כל היום' : 'batch it into a short communication block'
    }
    if (minutes > 0 && minutes <= 30) {
      return lang === 'he' ? 'לסגור כמשימת מומנטום לפני מעבר לעבודה כבדה' : 'close it as momentum before heavier work'
    }
    return lang === 'he'
      ? 'לתת לה מקום מוגדר, אחרת היא תמשיך להתחרות ברעש'
      : 'give it a defined slot or it will keep competing with noise'
  }

  function fallbackTaskRecommendation(task: Record<string, unknown> & { title?: string }, lang: 'he' | 'en'): string {
    const title = task.title || ''
    const why = fallbackTaskReason(task, lang)
    const slot = fallbackTaskSlot(task, lang)
    return lang === 'he'
      ? `- **${title}** — ${why}. הצעד הנכון: ${slot}.`
      : `- **${title}** — ${why}. Best move: ${slot}.`
  }

  function fallbackTaskRecommendationBrief(task: Record<string, unknown> & { title?: string }, lang: 'he' | 'en'): string {
    const title = task.title || ''
    const why = fallbackTaskReason(task, lang)
    return `- **${title}** — ${why}.`
  }

  function buildFallbackAspects(tasks: Array<Record<string, unknown> & { title?: string }>, lang: 'he' | 'en'): FallbackAspect[] {
    const byKey = new Map<string, FallbackAspect>()
    for (const task of tasks) {
      const inferred = inferFallbackAspect(task, lang)
      const existing = byKey.get(inferred.key)
      if (existing) {
        existing.tasks = rankFallbackTasks([...existing.tasks, task]).slice(0, WEEKLY_FALLBACK_TASKS_PER_ASPECT)
      } else {
        byKey.set(inferred.key, { ...inferred, tasks: [task] })
      }
    }
    return [...byKey.values()]
      .sort((a, b) => Math.max(...b.tasks.map(fallbackTaskScore)) - Math.max(...a.tasks.map(fallbackTaskScore)))
      .slice(0, WEEKLY_FALLBACK_ASPECT_LIMIT)
  }

  function buildFallbackCards(tasks: Array<Record<string, unknown> & { title?: string }>, lang: 'he' | 'en', responseMode?: RoutedIntent['responseMode']): string {
    const aspects = responseMode === 'week_plan' ? buildFallbackAspects(tasks, lang) : []
    const groups = aspects.length > 0
      ? aspects.map(aspect => ({
          name: aspect.name,
          items: aspect.tasks.map((task, index) => ({
            i: Number(task.__cardIndex) || index + 1,
            reason: fallbackTaskReason(task, lang),
          })),
        }))
      : [{
          name: lang === 'he' ? 'מוקדי השבוע' : 'Weekly focus',
          items: tasks.map((task, index) => ({ i: Number(task.__cardIndex) || index + 1, reason: fallbackTaskReason(task, lang) })),
        }]
    const kind = responseMode ? `"kind":"${responseMode}",` : ''
    return `\n\n\`\`\`cards\n{${kind}"groups":${JSON.stringify(groups)}}\n\`\`\``
  }

  function buildFormatterFallback(toolResults: ToolResult[], lang: 'he' | 'en', responseMode?: RoutedIntent['responseMode']): string {
    const tasks = rankFallbackTasks(getTaskItemsFromToolResults(toolResults).filter(task => task.title)).slice(0, responseMode === 'week_plan' ? WEEKLY_FALLBACK_TASK_LIMIT : 3)
    if (tasks.length === 0) {
      return lang === 'he'
        ? 'מצאתי את הנתונים, אבל לא הצלחתי לנסח תשובת AI מלאה בזמן. השתמש בכרטיסים למטה כדי להמשיך.'
        : 'I found the data, but could not finish the AI wording in time. Use the cards below to continue.'
    }

    if (responseMode !== 'week_plan') {
      const lines = tasks.map(task => fallbackTaskRecommendation(task, lang))
      const intro = lang === 'he'
        ? 'טיוטת בחירה מהירה לפי השפעה, תלות וסיכון אמיתי:'
        : 'Fast draft based on impact, dependency, and real risk:'
      return [intro, ...lines].filter(Boolean).join('\n') + buildFallbackCards(tasks, lang, responseMode)
    }

    const aspects = buildFallbackAspects(tasks, lang)
    const intro = lang === 'he'
      ? 'טיוטת תכנון מהירה: חילקתי את השבוע לפי תחומי עבודה פעילים, לא לפי רשימת משימות אקראית. הניסוח העמוק יותר עדיין נטען.'
      : 'Fast planning draft: I grouped the week by active work areas, not a random task list. Deeper coaching is still loading.'
    const lines = aspects.flatMap(aspect => {
      const taskLines = aspect.tasks.map(task => fallbackTaskRecommendationBrief(task, lang))
      return [
        lang === 'he'
          ? `\n**${aspect.name}** — ${aspect.outcome}`
          : `\n**${aspect.name}** — ${aspect.outcome}.`,
        ...taskLines,
      ]
    })
    const omissions = lang === 'he'
      ? '\nמה נשאר בחוץ כרגע: משימות בלי קשר ברור לתחומי העבודה האלה, כדי שהתכנון לא יהפוך לרעש.'
      : '\nHeld back for now: tasks that do not clearly support these work areas, so the plan stays focused.'
    return [intro, ...lines, omissions].filter(Boolean).join('\n') + buildFallbackCards(tasks, lang, responseMode)
  }

  function weeklyPlanNeedsQualityRepair(response: string, cardData: ReturnType<typeof parseCardGroups>, lang: 'he' | 'en'): boolean {
    if (!cardData || cardData.kind !== 'week_plan') return false
    const selectedTasks = cardData.groups.flatMap(group => group.tasks)
    if (selectedTasks.length === 0) return false

    const prose = stripCardsBlock(response).trim()
    if (prose.length < 80) return true

    const proseLines = prose
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean)
    const normalizedLines = proseLines.map(line => line.toLowerCase())
    const taskAnchoredLines = selectedTasks.map(task => {
      const title = String(task.title || '').trim().toLowerCase()
      const lines = title ? normalizedLines.filter(line => line.includes(title)) : []
      return { task, lines }
    })
    const taskAnchoredLineCount = taskAnchoredLines.filter(entry => entry.lines.length > 0).length
    if (taskAnchoredLines.some(entry => {
      if (entry.lines.length === 0) return false
      return !entry.lines.some(line => weeklyLineHasTaskReasoning(line, lang))
    })) {
      return true
    }
    const requiredAnchors = selectedTasks.length
    if (taskAnchoredLineCount < requiredAnchors) return true
    if (proseLines.length < requiredAnchors) return true

    const hasPlanningReasoning = lang === 'he'
      ? /(למה עכשיו|השפעה|טריידאוף|מיקום|סיכון|פותח|מונע|משחרר|חוסך|רצף|תלות)/i.test(prose)
      : /(why now|expected impact|tradeoff|slot|risk|unblock|prevent|dependency|sequence|capacity|energy)/i.test(prose)
    if (!hasPlanningReasoning) return true

    const shallowMetadataOnly = /(due today|deadline \d{4}-\d{2}-\d{2}|priority (?:low|medium|high)|(?:low|medium|high) priority|באיחור|עדיפות (?:נמוכה|בינונית|גבוהה)|דדליין \d{4}-\d{2}-\d{2})/i.test(prose)
    const hasStakeLanguage = lang === 'he'
      ? /(נתקע|מונע|פותח|משחרר|סיכון|רצף|מחכה|החלטה|כסף|גבייה)/i.test(prose)
      : /(stuck|unblock|prevent|risk|waiting|decision|money|billing|sequence|follow-through)/i.test(prose)

    return shallowMetadataOnly && !hasStakeLanguage
  }

  function weeklyLineHasTaskReasoning(line: string, lang: 'he' | 'en'): boolean {
    const shallowMetadata = /(due today|deadline \d{4}-\d{2}-\d{2}|priority (?:low|medium|high)|(?:low|medium|high) priority|באיחור|עדיפות (?:נמוכה|בינונית|גבוהה)|דדליין \d{4}-\d{2}-\d{2})/i.test(line)
    const hasStakeLanguage = lang === 'he'
      ? /(למה עכשיו|השפעה|טריידאוף|מיקום|נתקע|מונע|פותח|משחרר|סיכון|רצף|מחכה|החלטה|כסף|גבייה|תלות)/i.test(line)
      : /(why now|expected impact|tradeoff|slot|stuck|unblock|prevent|risk|waiting|decision|money|billing|sequence|follow-through|dependency|capacity|energy)/i.test(line)
    if (shallowMetadata && !hasStakeLanguage) return false
    return hasStakeLanguage
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
    const languageName = languageNameFor(language)

    const parts: string[] = [
      identity,
      '',
      '## YOUR ROLE:',
      'You are a thoughtful assistant who understands the user\'s work, weighs priorities, and gives actionable advice. You have full access to the user\'s task data below — USE IT to reason and provide insights. Don\'t just search and dump results. THINK about what matters most, what\'s urgent, what\'s been neglected, and give personalized recommendations.',
      '',
      '## CRITICAL RULES:',
      `1. LANGUAGE: Respond ENTIRELY in ${languageName}. Task data language and user input language do NOT matter when this instruction is explicit. NEVER mix languages.`,
      '2. ALWAYS USE TOOLS for task-related questions. When the user asks about tasks (show, list, give me, what are, מה המשימות, תן לי, הצג) — ALWAYS call `list_tasks` or relevant tool. This renders interactive clickable task cards. NEVER answer task questions from context alone — the user needs clickable cards.',
      '3. GIVE REASONS: For each task you mention, explain WHY it matters in real life — what it unblocks, who is waiting, what risk it prevents, or why the timing matters. Due dates, overdue days, and priority labels are metadata, not the reason. Example: "Fix login bug — blocks release and keeps support waiting; it is also 3 days overdue."',
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
    parts.push(`YOUR OUTPUT LANGUAGE = ${languageName}. NO EXCEPTIONS.`)

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
    const lang = chatLanguage.value === 'he' ? 'he' : 'en'
    store.addAssistantMessage(
      lang === 'he'
        ? 'אני יכול לתת הצעות טובות יותר אם אדע מה הלו"ז שלך.'
        : 'I can give better suggestions if I know your schedule.',
      {
        metadata: {
          scheduleQuestion: {
            type: 'unavailable-days',
            answered: false,
          },
          forceDirection: lang === 'he' ? 'rtl' : 'ltr',
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
    const outputLanguage = resolveChatOutputLanguage(routed.language, chatLanguage.value)
    lastDetectedLanguage.value = outputLanguage

    // Start streaming response
    store.startStreamingMessage()
    const phaseActivityId = beginChatPhase('Preparing response', activeProviderRef.value ? `Using ${activeProviderRef.value}` : undefined)

    try {
      // ── Step 1: Handle greeting (no tools, no LLM) ──────────────────
      if (routed.type === 'greeting') {
        updateChatPhase(phaseActivityId, 'Answering directly', 'No tools needed')
        const greeting = getTemplate('greeting', outputLanguage)
        const lastMsg = store.messages[store.messages.length - 1]
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content = greeting
          store.streamingContent = greeting
        }
        finishChatPhase(phaseActivityId)
        store.completeStreamingMessage()
        return
      }

      // ── Step 2: Execute pre-built tool calls ────────────────────────
      const toolResults: ToolResult[] = []
      for (const call of routed.tools) {
        updateChatPhase(phaseActivityId, 'Reading task data', call.tool.replace(/_/g, ' '))
        console.log(`[AIChat:Deterministic] Executing tool: ${call.tool}`, call.parameters)
        trackToolCall(sessionId, call.tool)
        const activityId = beginToolActivity(call)
        const result = await executeTool(call, outputLanguage)
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
        updateChatPhase(phaseActivityId, 'Tool failed', failedTools[0].message)
        // All tools failed — show error template
        const errorMsg = getTemplate('tool_error', outputLanguage, failedTools[0].message)
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content = errorMsg
          store.streamingContent = errorMsg
        }
        failChatPhase(phaseActivityId, 'Tool failed', failedTools[0].message)
        store.completeStreamingMessage()
        return
      }

      // ── Step 4a: For skipLLM intents → template response ────────────
      if (routed.skipLLM) {
        updateChatPhase(phaseActivityId, 'Formatting answer', 'Template response')
        const templateResponse = buildTemplateResponse({ ...routed, language: outputLanguage }, toolResults)
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content = templateResponse
          store.streamingContent = templateResponse
        }
        finishChatPhase(phaseActivityId)
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
        : buildReasoningDirective(routed.tools[0]?.tool || '', resultData, outputLanguage)

      // TASK-1814: For strong subscription brains, DON'T pre-digest into
      // "3 days overdue, high priority" lines (that reduces the model to a
      // formatter — strong and weak models then produce identical shallow answers).
      // Feed the FULL task content (notes/description, tags, subtask progress,
      // project, dates) and let the model actually reason about real stakes. The
      // user's work patterns/capacity are already injected by the context-aware router.
      let toolResultsSummary = isBridgeActive()
        ? buildRichToolResultsData(toolResults, outputLanguage)
        : toolResults
            .map((r, i) => {
              const toolName = routed.tools[i]?.tool || 'unknown'
              return digestToolResults(toolName, r.data, `[${r.success ? 'OK' : 'ERROR'}] ${r.message}`, outputLanguage)
            })
            .join('\n\n')

      const languageName = languageNameFor(outputLanguage)
      const hasTaskList = collectCardTasks(toolResults).length > 0
      const isDayPlan = routed.responseMode === 'day_plan'
      const isSmartLanes = routed.responseMode === 'smart_lanes'
      const isWeeklyReview = routed.responseMode === 'weekly_review'
      const isWeekPlan = routed.responseMode === 'week_plan'
      if (hasTaskList && !isWeekPlan) {
        updateChatPhase(phaseActivityId, 'Loading context memory', `${collectCardTasks(toolResults).length} task candidates`)
        const memorySummary = await withTimeout(
          buildAIMemorySummaryForToolResults(toolResults, outputLanguage),
          WEEK_PLAN_MEMORY_TIMEOUT_MS,
          'chat_memory_summary_timeout',
        ).catch(memoryErr => {
          console.warn('[AIChat:Deterministic] Memory summary skipped or timed out:', memoryErr)
          return ''
        })
        if (memorySummary) toolResultsSummary += `\n\n${memorySummary}`
      }

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
      if (isWeekPlan && hasTaskList) {
        updateChatPhase(phaseActivityId, 'Preparing weekly plan', 'Loading saved project context')
        const cardTasks = collectCardTasks(toolResults)
        let weekMemory: WeekContextMemoryInput = {}
        let clarificationEvents: AIClarificationEvent[] = []
        const now = new Date()
        const memoryStartedAt = performance.now()
        let memoryTimedOut = false
        let memoryEntityKeyCount = 0
        let memoryProjectContextCount = 0
        let memoryTaskContextCount = 0
        let memoryFeedbackCount = 0
        try {
          const db = useSupabaseDatabase()
          const taskIds = uniqueSupabaseIds(cardTasks.map(task => String(task.id || '')))
          const taskEntityKeys = uniqueStrings(cardTasks.map(task => String(task.id || '')).filter(Boolean).map(taskEntityKey))
          const rawProjectIds = uniqueStrings(cardTasks
            .map(task => {
              const id = String(task.id || '')
              return id ? taskStore.getTask(id)?.projectId || String(task.projectId || '') : String(task.projectId || '')
            })
            .map(projectId => projectId || 'uncategorized')
          )
          const projectIds = uniqueSupabaseIds(rawProjectIds)
          const projectEntityKeys = rawProjectIds.map(projectEntityKey)
          const weekEntityKey = `week:${buildWeekContextFromToolResults(toolResults, taskStore.tasks, outputLanguage, now).weekStartIso}`
          const entityKeys = uniqueStrings([...projectEntityKeys, ...taskEntityKeys, weekEntityKey])
          memoryEntityKeyCount = entityKeys.length
          const [projectContexts, taskContexts, contextEntities, events, recommendationFeedback] = await withTimeout(Promise.all([
            db.fetchProjectContexts(projectIds),
            db.fetchTaskContexts(taskIds),
            db.fetchAIContextEntities(entityKeys),
            db.fetchAIClarificationEvents(entityKeys, 40),
            db.fetchAIRecommendationFeedback({ taskIds, entityKeys, limit: 80 }),
          ]), WEEK_PLAN_MEMORY_TIMEOUT_MS, 'weekly_plan_memory_timeout')
          clarificationEvents = events
          const entityProjectContexts = contextEntities.map(entityToProjectContext).filter((ctx): ctx is ProjectContext => Boolean(ctx))
          const entityTaskContexts = contextEntities.map(entityToTaskContext).filter((ctx): ctx is TaskContext => Boolean(ctx))
          weekMemory = {
            projectContexts: [...projectContexts, ...entityProjectContexts]
              .filter((ctx, index, all) => all.findIndex(item => item.projectId === ctx.projectId) === index),
            taskContexts: [...taskContexts, ...entityTaskContexts]
              .filter((ctx, index, all) => all.findIndex(item => item.taskId === ctx.taskId) === index),
            recommendationFeedback,
          }
          memoryProjectContextCount = weekMemory.projectContexts?.length ?? 0
          memoryTaskContextCount = weekMemory.taskContexts?.length ?? 0
          memoryFeedbackCount = recommendationFeedback.length
          await db.upsertAIContextEdges([
            ...cardTasks.flatMap(task => {
              const taskId = String(task.id || '')
              if (!taskId) return []
              const projectId = taskStore.getTask(taskId)?.projectId || String(task.projectId || '') || 'uncategorized'
              return [
                {
                  sourceEntityKey: taskEntityKey(taskId),
                  targetEntityKey: projectEntityKey(projectId),
                  relationType: 'belongs_to' as const,
                  confidence: 0.95,
                  evidence: { source: 'weekly_plan_candidates' },
                },
                {
                  sourceEntityKey: taskEntityKey(taskId),
                  targetEntityKey: weekEntityKey,
                  relationType: 'part_of_week' as const,
                  confidence: 0.7,
                  evidence: { source: 'weekly_plan_candidates' },
                },
              ]
            }),
          ])
        } catch (memoryErr) {
          console.warn('[AIChat:WeeklyPlan] Memory fetch skipped or timed out:', memoryErr)
          updateChatPhase(phaseActivityId, 'Memory skipped', 'Using task data now')
          memoryTimedOut = true
          weekMemory = {}
        }
        updateChatPhase(phaseActivityId, 'Checking needed context', `${cardTasks.length} task candidates`)
        const weekContext = buildWeekContextFromToolResults(toolResults, taskStore.tasks, outputLanguage, now, weekMemory)
        const clarification = buildWeeklyPlanningInterview(weekContext, clarificationEvents, {
          retrieval: {
            source: memoryTimedOut ? 'fallback' : 'exact_entity_lookup',
            entityKeyCount: memoryEntityKeyCount,
            eventCount: clarificationEvents.length,
            projectContextCount: memoryProjectContextCount,
            taskContextCount: memoryTaskContextCount,
            elapsedMs: Math.round(performance.now() - memoryStartedAt),
            timedOut: memoryTimedOut,
            feedbackCount: memoryFeedbackCount,
          },
          reason: memoryTimedOut
            ? 'memory retrieval timed out; ask-before-plan prevents fake certainty'
            : 'coverage score says a missing context dimension would materially change ranking',
          candidateCount: cardTasks.length,
        })
        if (clarification) {
          if (lastMsg && lastMsg.isStreaming) {
            lastMsg.content = ''
            store.streamingContent = ''
            lastMsg.metadata = {
              ...lastMsg.metadata,
              clarification,
            } as Record<string, unknown>
          }
          void (async () => {
            try {
              const db = useSupabaseDatabase()
              await db.recordAIClarificationEvent({
                entityKey: clarification.memoryKey,
                entityType: clarification.question.entityType ?? 'workflow',
                displayName: clarification.question.entityId ?? clarification.memoryKey,
                questionId: clarification.question.id,
                eventType: 'asked',
                question: clarification.question.question,
                sourceMessageId: lastMsg?.id,
                coverageScoreAtTime: clarification.coverage?.score,
                uncertaintyDimensions: clarification.coverage?.missing,
                pathType: clarification.pathType,
                contextSnapshot: {
                  candidateTaskIds: clarification.candidateTaskIds,
                  coverage: clarification.coverage,
                  retrieval: clarification.debug?.retrieval,
                  feedbackCount: memoryFeedbackCount,
                },
              })
            } catch (eventErr) {
              console.warn('[AIChat:WeeklyPlan] Could not record clarification ask:', eventErr)
            }
          })()
          finishChatPhase(phaseActivityId, 'Clarification ready', 'Waiting for one answer')
          store.completeStreamingMessage()
          return
        }

        let weeklyPlan: WeeklyPlanOutput | null = null
        let validationErrors: string[] = []
        try {
          updateChatPhase(phaseActivityId, 'Refining plan', `Bridge timeout ${WEEK_PLAN_STRUCTURED_TIMEOUT_MS / 1000}s`)
          const structuredMessages: RouterChatMessage[] = [
            {
              role: 'system',
              content: `You are a weekly planning coach inside a personal productivity app. Your job is not to sort tasks; it is to decide what deserves attention this week and why. Return ONLY valid JSON matching schemaVersion weekly-plan.v2. Do not output markdown. Do not describe task cards. The UI will render task cards from primaryTaskId and relatedTaskIds. Every recommendation needs at least two evidence items and at least one evidence item that is not dueIso or priority. You may rank tasks using due dates, priority, status, timers, and supplied project/task context, but you must not infer importance, stakes, work/personal category, or success criteria from project names alone. If project context is missing, mark it as unknown and ask a button clarification instead of pretending. Explain real consequences: promise kept, decision unblocked, money protected, health/family/admin load lowered, rework prevented, risk reduced, or momentum restored. If locale is he, write natural Hebrew and set direction rtl.`,
            },
            {
              role: 'user',
              content: buildWeeklyPlanPrompt(weekContext),
            },
          ]
          let rawPlan = ''
          for await (const chunk of router.chatStream(structuredMessages, {
            taskType: 'chat',
            forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
            model: selectedModel.value || undefined,
            timeout: WEEK_PLAN_STRUCTURED_TIMEOUT_MS,
          })) {
            rawPlan += chunk.content
          }
          const parsed = parseWeeklyPlanOutput(rawPlan, weekContext)
          if (parsed.ok) {
            weeklyPlan = parsed.value
          } else if (isBridgeActive()) {
            validationErrors = parsed.errors
          } else {
            validationErrors = parsed.errors
            const repairMessages: RouterChatMessage[] = [
              ...structuredMessages,
              { role: 'assistant', content: rawPlan },
              {
                role: 'user',
                content: `The JSON failed validation with these errors: ${parsed.errors.join(', ')}. Return the complete corrected JSON object only. Keep the same requestId and only use task IDs from candidateTasks.`,
              },
            ]
            let repairedRawPlan = ''
            for await (const chunk of router.chatStream(repairMessages, {
              taskType: 'chat',
              forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
              model: selectedModel.value || undefined,
              timeout: WEEK_PLAN_STRUCTURED_TIMEOUT_MS,
            })) {
              repairedRawPlan += chunk.content
            }
            const repaired = parseWeeklyPlanOutput(repairedRawPlan, weekContext)
            if (repaired.ok) {
              weeklyPlan = repaired.value
            } else {
              validationErrors = [...validationErrors, ...repaired.errors]
            }
          }
        } catch (planErr) {
          console.warn('[AIChat:WeeklyPlan] Structured planning failed; using grounded quick draft:', planErr)
          validationErrors = [planErr instanceof Error ? planErr.message : 'provider_failed']
        }

        const finalPlan = weeklyPlan ?? buildWeeklyPlanReliabilityFallback(weekContext, validationErrors)
        if (validationErrors.length && finalPlan.source === 'quick_draft') {
          finalPlan.quality.caveats = [...finalPlan.quality.caveats, ...validationErrors.slice(0, 3)]
        }
        if (lastMsg && lastMsg.isStreaming) {
          lastMsg.content = ''
          store.streamingContent = ''
          lastMsg.metadata = {
            ...lastMsg.metadata,
            weeklyPlan: finalPlan,
          } as Record<string, unknown>
        }

        finishChatPhase(phaseActivityId, 'Weekly plan ready', finalPlan.source === 'quick_draft' ? 'Used quick plan' : 'Used structured plan')
        try {
          const currentRouter = await getRouter()
          const lastUsed = currentRouter.getLastUsedProvider()
          if (lastUsed) activeProviderRef.value = lastUsed
        } catch { /* ignore */ }

        store.completeStreamingMessage()
        return
      }
      const formatterTimeout = isBridgeActive() && isWeekPlan
        ? WEEK_PLAN_BRIDGE_FORMATTER_TIMEOUT_MS
        : FINAL_FORMATTER_TIMEOUT_MS
      const cardsInstruction = (isBridgeActive() && hasTaskList)
        ? isWeeklyReview
          ? `\n\nThis is a WEEKLY REVIEW of tasks the user ALREADY COMPLETED. STRUCTURE YOUR ANSWER AS EXACTLY: (1) ONE short sentence stating how many tasks were completed (use ONLY the count of tasks in the data). Mention focus time ONLY if it is present in the data; if it is not present, do NOT mention focus time at all and never say it is missing or unavailable. Do NOT invent any numbers. (2) Then a fenced code block tagged \`cards\` with JSON ONLY:\n\`\`\`cards\n{"kind":"weekly_review","groups":[{"name":"project or theme name in ${languageName}","items":[{"i":<the task's [N] number from the data>,"reason":"one short concrete note about this completed task in ${languageName}, max 8 words"}]}]}\n\`\`\`\nGroup the completed tasks by their project (use the \`project:\` field in the data) or by theme. Include ONLY tasks present in the data — never invent task names, categories, counts, trends, insights, or recommendations. Reference tasks by [N] number INSIDE the cards block only; in prose use the task NAME, never [N]. Do NOT add any sections after the cards block.`
          : isWeekPlan
          ? `\n\nThis is a FORWARD WEEK PLAN of UPCOMING tasks the user still needs to do. Act like a thoughtful planning coach, not a sorter.\n\nSTRUCTURE YOUR ANSWER AS EXACTLY:\n(1) A 2-3 sentence weekly shape: the main theme, the realistic load/capacity call, and what should NOT dominate the week.\n(2) 3-6 short recommendation lines. Each line must name ONE selected task from the data and include: why now, expected impact, and the tradeoff/slot. Do not mention every task; be selective.\n(3) One short omissions/defer line naming what you are intentionally leaving out or batching and why.\n(4) Then a fenced code block tagged \`cards\` with JSON ONLY:\n\`\`\`cards\n{"kind":"week_plan","groups":[{"name":"a day name, focus block, or theme in ${languageName}","items":[{"i":<the task's [N] number from the data>,"reason":"why this belongs here: impact/risk/energy/tradeoff, max 16 words in ${languageName}"}]}]}\n\`\`\`\nRanking rubric, in order: impact/importance, dependencies or stakeholder risk, deadline consequences, energy/context fit, follow-through signals, then effort as a tiebreaker. Due dates and priority labels are metadata, not reasons. A reason like "deadline 2026-06-07" or "priority medium" is a failure.\nGroup the selected UPCOMING tasks by day, focus block, or theme. Use due dates where present, but prefer a plan that makes sense for the user's week. Include ONLY tasks present in the data — never invent tasks. Reference tasks by [N] number INSIDE the cards block only; in prose use the task NAME, never [N].`
          : isDayPlan
          ? `\n\nSTRUCTURE YOUR ANSWER AS EXACTLY: (1) ONE or TWO short sentences — name the first task and the capacity call. If some tasks should be deferred, mention that in prose but DO NOT include deferred tasks in the cards. (2) Then a fenced code block tagged \`cards\` with JSON ONLY:\n\`\`\`cards\n{"kind":"day_plan","groups":[{"name":"short focus block label in ${languageName}","items":[{"i":<the task's [N] number from the data>,"reason":"why this task belongs in this slot in ${languageName}, max 10 words"}]}]}\n\`\`\`\nThe groups are the exact order of the user's day. Include only tasks they should actually do today. Reference tasks by [N] number INSIDE the cards block only; in prose use the task NAME, never [N].`
          : isSmartLanes
            ? `\n\nSTRUCTURE YOUR ANSWER AS EXACTLY: (1) ONE or TWO short sentences — name the strongest lane and why it matters. Do NOT write a full per-task breakdown in prose; the cards carry it. (2) Then a fenced code block tagged \`cards\` with JSON ONLY:\n\`\`\`cards\n{"kind":"smart_lanes","groups":[{"name":"actionable lane name in ${languageName}","items":[{"i":<existing task [N] from the data>,"reason":"why it belongs in this lane, max 10 words"}],"newTasks":[{"title":"new child task title in ${languageName}","priority":"medium","reason":"what it unblocks, max 10 words"}]}]}\n\`\`\`\nUse \`items\` for existing tasks to assign to the lane. Use \`newTasks\` only when a large existing task should be broken into concrete child tasks; keep each title actionable and small. If a group has one existing item plus newTasks, that existing item is the parent task. Reference tasks by [N] number INSIDE the cards block only; in prose use task names, never [N].`
            : `\n\nSTRUCTURE YOUR ANSWER AS EXACTLY: (1) ONE or TWO short sentences — the single biggest cross-cutting insight or what to tackle first. Do NOT write a per-task breakdown, headings, or numbered reasons in the prose — the cards below carry every per-task detail, so repeating it is noise. (2) Then a fenced code block tagged \`cards\` with JSON ONLY:\n\`\`\`cards\n{"groups":[{"name":"short group label in ${languageName}","items":[{"i":<the task's [N] number from the data>,"reason":"the specific stake for THIS task in ${languageName}, max 10 words — NOT 'overdue'/'high priority'"}]}]}\n\`\`\`\nReference each task by its [N] number INSIDE the cards block only; in the prose use the task NAME, never [N]. Include only tasks worth acting on now, grouped by theme or sequence (a single task may be its own group), ordered by importance.`
        : ''
      const responseShapeInstruction = cardsInstruction
        ? isWeekPlan
          ? `CRITICAL FORMAT RULE: This is a weekly planning answer. Keep it compact: one weekly-shape sentence, then only the selected task/card data. Do not write a broad essay, intro, outro, or per-task prose paragraph.`
          : `CRITICAL FORMAT RULE: Start with ONE plain, concrete sentence that names the first task and the next task. Avoid vague labels, arrows, metaphors, and jargon unless the user used them. Then output the cards block. Do not add a separate bullet list or headings before the cards.`
        : `CRITICAL FORMAT RULE: Always structure your response as a **numbered list** or **bullet points** — one per task or insight. NEVER write a wall of text or a single paragraph. Each bullet should bold the task name.`
      const lowOverwhelmQualityContract = `LOW-OVERWHELM QUALITY CONTRACT:
- Start with the answer or the single needed clarification. No greeting, throat-clearing, recap, motivational line, or generic productivity advice.
- Keep prose short: at most one setup sentence before cards, and at most one sentence per recommendation.
- Use only stakes supported by notes, subtasks, dependencies, saved project/task context, due dates, or explicit user wording.
- Do not infer importance, work/personal category, client impact, health/family stakes, or success criteria from a project/task name alone.
- If the missing context would change the recommendation, ask for that context instead of producing broad prose. For weekly planning, the structured question card handles this.
- Prefer concrete labels and task names over abstractions like "real consequences", "meaningful work", or "substantial focus" unless the data proves them.
- Never repeat the same reasoning template across multiple tasks.`

      const formatterMessages: RouterChatMessage[] = [
        {
          role: 'system',
          content: `You format task data into natural language. Output ONLY in ${languageName}. No other language allowed.\n\n${responseShapeInstruction}\n\n${lowOverwhelmQualityContract}\n\nWHEN RANKING BY PRIORITY/URGENCY:\n- "X days overdue" and "high priority" are metadata, never the reason. The user already sees those on the card.\n- Lead with a supported stake from the data: note text, subtasks, dependencies, saved context, a concrete due commitment, or explicit user wording.\n- If the data gives no clue to the stake, say it is unclear in one short phrase or ask for the missing context. Do not invent urgency.\n- Open with the single strongest supported choice and one line on why it beats the rest.\n\nUSE THE AVAILABLE DATA, BUT STAY SELECTIVE:\n- Read notes, tags, subtask progress, project context, estimates, schedule, and capacity.\n- Mention only evidence that changes the recommendation.\n- Group related tasks only when the relationship is visible in the data.\n- Flag dependencies only when dependency data or explicit wording supports them.\n\n${routed.formatDirective}${userScheduleNote}${cardsInstruction}`,
        },
        {
          role: 'user',
          content: `${reasoningDirective}\n\nData:\n${toolResultsSummary}\n\nWrite ENTIRELY in ${languageName}. No UUIDs.`,
        },
      ]

      let formattedResponse = ''
      try {
        updateChatPhase(phaseActivityId, 'Writing concise answer', activeProviderRef.value ? `Using ${activeProviderRef.value}` : undefined)
        for await (const chunk of router.chatStream(formatterMessages, {
          taskType: 'chat',
          forceProvider: selectedProvider.value !== 'auto' ? selectedProvider.value as RouterProviderType : undefined,
          model: selectedModel.value || undefined,
          timeout: formatterTimeout,
        })) {
          formattedResponse += chunk.content
        }
      } catch (formatterErr) {
        console.warn('[AIChat:Deterministic] Formatter timed out or failed; using fallback answer:', formatterErr)
        formattedResponse = buildFormatterFallback(toolResults, routed.language, routed.responseMode)
      }
      if (!formattedResponse.trim()) {
        formattedResponse = buildFormatterFallback(toolResults, routed.language, routed.responseMode)
      }

      // Post-check: language mismatch retry (one attempt)
      if (detectExpectedLanguageMismatch(outputLanguage, formattedResponse)) {
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
          timeout: formatterTimeout,
        })) {
          retryResponse += chunk.content
        }

        if (retryResponse.trim()) {
          formattedResponse = retryResponse
        }
      }

      // TASK-1814: extract the `cards` block → grouped interactive cards, and strip
      // it from the displayed prose. Falls through gracefully if absent/unparseable.
      let cardData = parseCardGroups(formattedResponse, toolResults)
      if (!cardData && cardsInstruction && hasTaskList) {
        const fallbackResponse = buildFormatterFallback(toolResults, routed.language, routed.responseMode)
        const fallbackCardData = parseCardGroups(fallbackResponse, toolResults)
        if (fallbackCardData) {
          const formatterProse = stripCardsBlock(formattedResponse).trim()
          const fallbackProse = stripCardsBlock(fallbackResponse).trim()
          formattedResponse = [formatterProse, fallbackProse, fallbackCardData.rawBlock]
            .filter(Boolean)
            .join('\n\n')
          cardData = parseCardGroups(formattedResponse, toolResults)
        }
      }
      if (isWeekPlan && cardData && weeklyPlanNeedsQualityRepair(formattedResponse, cardData, routed.language)) {
        const fallbackResponse = buildFormatterFallback(toolResults, routed.language, routed.responseMode)
        const fallbackCardData = parseCardGroups(fallbackResponse, toolResults)
        if (fallbackCardData) {
          formattedResponse = fallbackResponse
          cardData = fallbackCardData
        }
      }
      if (cardData) {
        formattedResponse = ensureCardTaskMentions(
          formattedResponse,
          cardData,
          routed.language === 'he'
            ? 'כדי שכל כרטיס יהיה מחובר להמלצה עצמה:'
            : 'To keep each card tied to the recommendation:',
        )
        cardData = parseCardGroups(formattedResponse, toolResults)
      }
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

      finishChatPhase(phaseActivityId)
      store.completeStreamingMessage()

    } catch (err) {
      const rawError = err instanceof Error ? err.message : 'Failed to get response'
      const errorMessage = formatUserFriendlyError(rawError)
      failChatPhase(phaseActivityId, 'Response failed', errorMessage)
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
      const inputLanguage: 'he' | 'en' = preProcess.detectedLanguage === 'he' ? 'he' : 'en'
      const lang = resolveChatOutputLanguage(inputLanguage, chatLanguage.value)
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
            ? buildRichToolResultsData(toolResults, lang)
            : toolResults
                .map((r, i) => {
                  const toolName = immediateTools[i]?.tool || 'unknown'
                  return digestToolResults(toolName, r.data, `[${r.success ? 'OK' : 'ERROR'}] ${r.message}`, lang)
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
              ? buildRichToolResultsData(toolResults, lang)
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
        if (detectExpectedLanguageMismatch(lang, cleaned)) {
          const languageName = languageNameFor(lang)
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
              if (!detectExpectedLanguageMismatch(lang, retryCleaned)) {
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
          if (detectExpectedLanguageMismatch(lang, cleaned)) {
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
          const anchoredResponse = ensureCardTaskMentions(
            `${cleaned}\n\n${reactCards.rawBlock}`,
            reactCards,
            lang === 'he'
              ? 'כדי שכל כרטיס יהיה מחובר להמלצה עצמה:'
              : 'To keep each card tied to the recommendation:',
          )
          cleaned = stripCardsBlock(anchoredResponse)
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
    const result = await executeTool(confirmedCall, currentOutputLanguage())
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
        label: chatUI(currentOutputLanguage(), 'actionCancelledLabel'),
        message: call.tool.replace(/_/g, ' '),
      })
    }
    store.addAssistantMessage(chatUI(currentOutputLanguage(), 'actionCancelled'))
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
        currentOutputLanguage() === 'he'
          ? 'בחר משימה קודם, ואז בקש ממני לפרק אותה.'
          : 'Please select a task first, then ask me to break it down.'
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
    const lang = currentOutputLanguage()
    await sendMessage(
      lang === 'he' ? 'תעזור לי לתכנן את השבוע' : 'Help me plan my week',
      { taskType: 'chat' },
    )
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
      const result = await executeTool(toolCall, currentOutputLanguage())
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

    // Detect language from recent user messages unless the chat has an explicit language mode.
    const recentUserMessages = store.messages
      .filter((m) => m.role === 'user')
      .slice(-5)
      .map((m) => m.content || '')
      .join(' ')
    const detectedChainLang: 'he' | 'en' = detectLanguage(recentUserMessages) === 'he' ? 'he' : 'en'
    const chainLang: 'he' | 'en' = resolveChatOutputLanguage(detectedChainLang, chatLanguage.value)

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
          label: result.success ? chatUI(chainLang, 'chainStepComplete') : chatUI(chainLang, 'chainStepFailed'),
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
    await store.initialize()

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

    // Chat Language
    chatLanguage,
    setChatLanguage: store.setChatLanguage,

    // Lifecycle
    initialize,
    handleKeyboardShortcut,
    executeDirectTool
  }
}
