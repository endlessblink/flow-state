/**
 * Deterministic Intent Router for AI Chat Pipeline
 *
 * Classifies user messages into typed intents and pre-builds the tool calls
 * that should execute for that intent — without any LLM involvement.
 *
 * The routing table mirrors the keyword mappings in `toolHints.ts` and
 * delegates to `getToolHints()` to avoid duplicating keyword lists. When a
 * tool hint matches, the first match's tool name drives the route type and
 * the pre-built ToolCall.
 *
 * Priority order: routes are checked from most-specific to least-specific.
 * E.g. "start timer" is classified before the generic "timer" catch-all.
 *
 * @see TASK-1392 (toolHints), TASK-1395 (entityResolver), TASK-1398 (entityMemory)
 */

import type { ToolCall } from '../tools'
import type { TaskLike } from '../entityResolver'
import { resolveTask } from '../entityResolver'
import { detectLanguage } from './languageDetector'
import { getToolHints } from './toolHints'
import type { EntityMemory } from './entityMemory'
import type { DetectedLanguage } from './types'
import { getSharedRouter } from '../routerFactory'
import { isOverwhelmedDayPlanRequest } from './dayPlan'
import { isSmartLaneRequest } from './smartLanes'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Broad category of the user's intent */
export type IntentType =
  | 'task_query'
  | 'task_action'
  | 'timer'
  | 'stats'
  | 'greeting'
  | 'freeform'

/**
 * The result of routing a user message through the deterministic intent
 * classifier. Consumed by the AI chat pipeline to decide which tools to
 * pre-execute and what instructions to pass to the LLM formatter.
 */
export interface RoutedIntent {
  /** Classified intent type */
  type: IntentType
  /** Pre-built tool calls to execute before (or instead of) the LLM */
  tools: ToolCall[]
  /** Detected language of the user's input — 'unknown' is mapped to 'en' */
  language: 'he' | 'en'
  /**
   * Directive injected into the system prompt to guide the LLM formatter.
   * For `skipLLM` intents this is unused but still populated for debugging.
   */
  formatDirective: string
  /**
   * When true, the pipeline should skip the LLM call and synthesise a short
   * confirmation message directly (e.g. "Timer started", "Task created").
   * Only set for deterministic write actions where no reasoning is needed.
   */
  skipLLM?: boolean
  responseMode?: 'day_plan' | 'smart_lanes' | 'weekly_review'
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map the raw DetectedLanguage to the two-value language field. */
function resolveLanguage(detected: DetectedLanguage): 'he' | 'en' {
  return detected === 'he' ? 'he' : 'en'
}

/**
 * Extract the title from a "create task X" style command.
 *
 * Strips the leading command prefix (English or Hebrew) and returns the rest
 * as the task title. Returns an empty string when nothing remains.
 */
function extractCreateTitle(message: string): string {
  const lower = message.toLowerCase().trim()

  // English prefixes — ordered longest-first so greedy match wins
  const englishPrefixes = [
    'create a new task',
    'add a new task',
    'create new task',
    'add new task',
    'create a task',
    'add a task',
    'create task',
    'new task',
    'add task',
  ]

  // Hebrew prefixes
  const hebrewPrefixes = [
    'צור משימה חדשה',
    'הוסף משימה חדשה',
    'צור משימה',
    'הוסף משימה',
    'משימה חדשה',
  ]

  for (const prefix of [...englishPrefixes, ...hebrewPrefixes]) {
    if (lower.startsWith(prefix)) {
      return message.slice(prefix.length).trim()
    }
  }

  // Fallback: return everything after the first word (e.g. "add <title>")
  const spaceIdx = message.indexOf(' ')
  if (spaceIdx !== -1) return message.slice(spaceIdx + 1).trim()

  return ''
}

/**
 * Extract a task reference (title fragment) from a "mark X as done" command.
 *
 * Strips common completion verb prefixes and trailing status words.
 */
function extractMarkDoneReference(message: string): string {
  const lower = message.toLowerCase().trim()

  const prefixes = [
    'mark as done',
    'mark as complete',
    'mark done',
    'mark complete',
    'complete',
    'finish',
    'סמן כסיום',
    'סמן כהושלם',
    'סיים',
    'הושלם',
  ]

  let cleaned = lower
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length).trim()
      break
    }
  }

  // Strip trailing status words ("as done", "as complete", etc.)
  cleaned = cleaned
    .replace(/\bas done\b/g, '')
    .replace(/\bas complete\b/g, '')
    .trim()

  // Return original-case slice that corresponds to the cleaned range
  // (we matched lowercase but want to preserve original capitalisation)
  const startIdx = message.toLowerCase().indexOf(cleaned)
  if (startIdx !== -1 && cleaned.length > 0) {
    return message.slice(startIdx, startIdx + cleaned.length).trim()
  }

  return cleaned
}

// ---------------------------------------------------------------------------
// Tool-name → IntentType mapping
// ---------------------------------------------------------------------------

/**
 * Maps a tool name (from toolHints) to the IntentType category that owns it.
 * Tools not listed here fall through to 'freeform'.
 */
const TOOL_TO_INTENT: Record<string, IntentType> = {
  // Timer
  start_timer: 'timer',
  stop_timer: 'timer',
  get_timer_status: 'timer',

  // Task queries (read-only)
  list_tasks: 'task_query',
  get_overdue_tasks: 'task_query',
  suggest_next_task: 'task_query',
  search_tasks: 'task_query',
  get_task_details: 'task_query',

  // Task actions (writes)
  create_task: 'task_action',
  update_task_status: 'task_action',
  mark_task_done: 'task_action',
  update_task: 'task_action',
  delete_task: 'task_action',
  move_task_to_group: 'task_action',
  set_task_due_date: 'task_action',
  create_subtasks: 'task_action',

  // Stats
  get_productivity_stats: 'stats',
  get_daily_summary: 'stats',
  get_weekly_summary: 'stats',
  get_gamification_status: 'stats',
  get_active_challenges: 'stats',
  get_achievements_near_completion: 'stats',
}

// ---------------------------------------------------------------------------
// Format directives
// ---------------------------------------------------------------------------

const FORMAT_DIRECTIVES: Record<IntentType, string> = {
  task_query:
    'Format these task results with reasoning about priorities, deadlines, and progress. Use bullet points.',
  task_action: 'Confirm the action briefly in the user\'s language.',
  timer: 'Confirm the timer action briefly.',
  stats:
    'Summarize these productivity statistics with insights about trends.',
  greeting: 'Respond with a short, friendly greeting.',
  freeform: 'Respond naturally and helpfully.',
}

// ---------------------------------------------------------------------------
// Greeting detection
// ---------------------------------------------------------------------------

/** Short greeting patterns that need no tool calls */
const GREETING_PATTERNS = [
  /^hi\b/i,
  /^hello\b/i,
  /^hey\b/i,
  /^good morning\b/i,
  /^good afternoon\b/i,
  /^good evening\b/i,
  /^שלום\b/,
  /^היי\b/,
  /^הי\b/,
  /^בוקר טוב\b/,
  /^ערב טוב\b/,
  /^צהריים טובים\b/,
]

function isGreeting(message: string): boolean {
  const trimmed = message.trim()
  // Only treat as greeting when the message is short (<=30 chars) AND matches a pattern
  if (trimmed.length > 30) return false
  return GREETING_PATTERNS.some(re => re.test(trimmed))
}

// ---------------------------------------------------------------------------
// LLM-based intent classification (Layer 1 upgrade)
// ---------------------------------------------------------------------------

/** Compact classification prompt — ~500 tokens input, ~50 tokens output */
const CLASSIFICATION_PROMPT = `You are a task router. Classify the user's message into ONE tool.

TOOLS:
- list_tasks: Show/list/display tasks
- get_overdue_tasks: Overdue/late/past due tasks
- suggest_next_task: What to work on next, what's most urgent/important
- search_tasks: Search/find tasks by name (extract query in params.query)
- get_task_details: Details about a specific task
- create_task: Create a new task (extract title in params.title)
- mark_task_done: Complete/finish/done a task (extract name in params.task)
- update_task: Change task fields (priority, description, duration, title)
- update_task_status: Change task status to non-done values (in_progress, planned, backlog)
- set_task_due_date: Set/change deadline or due date
- delete_task: Delete/remove a task
- create_subtasks: Break down a task into subtasks/steps
- start_timer: Start timer/pomodoro/focus session
- stop_timer: Stop timer
- get_timer_status: Timer status/how much time left
- get_productivity_stats: Statistics/progress/how am I doing
- get_daily_summary: Today's summary
- get_weekly_summary: Week summary
- list_projects: Show projects
- assign_task_to_project: Assign task to project
- get_gamification_status: XP/level/streak/gamification
- get_active_challenges: Active challenges/daily challenges/boss
- get_achievements_near_completion: Almost-done achievements
- NONE: General conversation, unclear, or no tool needed

JSON only: {"tool":"<name>","params":{},"confidence":"high"|"medium"|"low"}`

/** Result of the LLM classification call */
interface LLMClassification {
  tool: string
  params: Record<string, string>
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Parse the LLM's classification response into a structured object.
 *
 * Three parsing strategies:
 * 1. Direct JSON.parse on trimmed response
 * 2. Strip markdown code fences, retry parse
 * 3. Regex extract `{..."tool"...}` from chatty response
 * 4. Give up → return NONE with low confidence
 */
export function parseClassification(raw: string): LLMClassification {
  const fallback: LLMClassification = { tool: 'NONE', params: {}, confidence: 'low' }

  if (!raw || typeof raw !== 'string') return fallback

  const trimmed = raw.trim()

  // Strategy 1: Direct parse
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed.tool === 'string') {
      return {
        tool: parsed.tool,
        params: parsed.params ?? {},
        confidence: parsed.confidence ?? 'medium',
      }
    }
  } catch { /* try next strategy */ }

  // Strategy 2: Strip markdown code fences
  const fenceStripped = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    const parsed = JSON.parse(fenceStripped)
    if (parsed && typeof parsed.tool === 'string') {
      return {
        tool: parsed.tool,
        params: parsed.params ?? {},
        confidence: parsed.confidence ?? 'medium',
      }
    }
  } catch { /* try next strategy */ }

  // Strategy 3: Regex extract JSON object containing "tool" (allows one level of nested {})
  const jsonMatch = trimmed.match(/\{(?:[^{}]|\{[^{}]*\})*"tool"\s*:\s*"[^"]*"(?:[^{}]|\{[^{}]*\})*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed && typeof parsed.tool === 'string') {
        return {
          tool: parsed.tool,
          params: parsed.params ?? {},
          confidence: parsed.confidence ?? 'medium',
        }
      }
    } catch { /* give up */ }
  }

  return fallback
}

/**
 * Classify user intent via a lightweight LLM call.
 *
 * Uses ~500 tokens input (compact system prompt + user message) and expects
 * ~50 tokens output (single JSON object). With Groq this takes ~200-400ms.
 *
 * @returns Classification result, or null if the LLM call fails
 */
async function classifyWithLLM(userMessage: string): Promise<LLMClassification | null> {
  try {
    const router = await getSharedRouter()
    const response = await router.chat(
      [
        { role: 'system', content: CLASSIFICATION_PROMPT },
        { role: 'user', content: userMessage },
      ],
      {
        temperature: 0,
        maxTokens: 100,
        skipUserContext: true,
      }
    )

    return parseClassification(response.content)
  } catch (error) {
    // LLM call failed — caller will fall back to keyword matching
    console.warn('[intentRouter] LLM classification failed, falling back to keywords:', error)
    return null
  }
}

// ---------------------------------------------------------------------------
// Keyword-only routing (exported for tests and as fallback)
// ---------------------------------------------------------------------------

/**
 * Deterministically route a user message to an intent + pre-built tool calls.
 *
 * The function is a pure function with no side effects (it only reads
 * `entityMemory`). No LLM calls are made.
 *
 * Resolution order:
 * 1. Greeting detection (short greeting keywords → `greeting`, skipLLM=true)
 * 2. toolHints keyword matching (most-specific tools matched first per KEYWORD_MAPPINGS order)
 * 3. Tool name → IntentType mapping
 * 4. Special handling for action intents that need entity resolution
 *    (create_task → title extraction, mark_task_done/update_task_status → task resolution,
 *     start_timer → entity memory lookup)
 * 5. Freeform fallback when no keywords match
 *
 * @param userMessage  - Raw user input string
 * @param tasks        - Current task list for entity resolution
 * @param entityMemory - Per-conversation entity memory for pronoun/context resolution
 * @returns            RoutedIntent with pre-built tool calls ready for execution
 */
export function routeIntentByKeywords(
  userMessage: string,
  tasks: TaskLike[],
  entityMemory: EntityMemory,
): RoutedIntent {
  const detected = detectLanguage(userMessage)
  const language = resolveLanguage(detected)

  // ── 1. Greeting check ────────────────────────────────────────────────────
  if (isGreeting(userMessage)) {
    return {
      type: 'greeting',
      tools: [],
      language,
      formatDirective: FORMAT_DIRECTIVES.greeting,
      skipLLM: true,
    }
  }

  if (isOverwhelmedDayPlanRequest(userMessage)) {
    return {
      type: 'task_query',
      tools: [{ tool: 'list_tasks', parameters: { status: 'todo', sortBy: 'priority', limit: 25 } }],
      language,
      formatDirective: 'Build a concrete ordered day plan. Sequence the tasks into focus blocks, and include only what should actually be done today.',
      responseMode: 'day_plan',
    }
  }

  if (isSmartLaneRequest(userMessage)) {
    return {
      type: 'task_query',
      tools: [{ tool: 'list_tasks', parameters: { status: 'todo', sortBy: 'priority', limit: 30 } }],
      language,
      formatDirective: 'Build smart task lanes from the real task list. Suggest lane names/themes, include existing tasks that belong in each lane, and add concrete new child tasks only when a large task should be broken down.',
      responseMode: 'smart_lanes',
    }
  }

  // ── 2. Keyword-based tool hint matching ──────────────────────────────────
  //
  // getToolHints() uses the same KEYWORD_MAPPINGS table (more-specific entries
  // first), so the first hint returned is the best match.
  const hints = getToolHints(userMessage)

  if (hints.length === 0) {
    // No keywords matched → freeform
    return {
      type: 'freeform',
      tools: [],
      language,
      formatDirective: FORMAT_DIRECTIVES.freeform,
      skipLLM: false,
    }
  }

  // Primary tool is the first (most specific) hint
  const primaryTool = hints[0].tool
  const intentType: IntentType = TOOL_TO_INTENT[primaryTool] ?? 'freeform'

  // ── 3. Build tool call with intent-specific parameter enrichment ─────────

  let toolCall: ToolCall
  let skipLLM = false
  let responseMode: RoutedIntent['responseMode']

  switch (primaryTool) {
    // ── Timer ────────────────────────────────────────────────────────────

    case 'start_timer': {
      // Resolve task from entity memory (most recently mentioned task)
      const lastEntity = entityMemory.getLastMentioned()
      const taskId = lastEntity?.id ?? 'general'
      toolCall = { tool: 'start_timer', parameters: { taskId } }
      skipLLM = true
      break
    }

    case 'stop_timer': {
      toolCall = { tool: 'stop_timer', parameters: {} }
      skipLLM = true
      break
    }

    case 'get_timer_status': {
      toolCall = { tool: 'get_timer_status', parameters: {} }
      skipLLM = false
      break
    }

    // ── Create task ──────────────────────────────────────────────────────

    case 'create_task': {
      const title = extractCreateTitle(userMessage)
      toolCall = {
        tool: 'create_task',
        parameters: title ? { title } : { title: '' },
      }
      // Only skip LLM when we successfully extracted a title
      skipLLM = title.length > 0
      break
    }

    // ── Mark task done ───────────────────────────────────────────────────

    case 'update_task_status': {
      // Attempt to extract the task reference and resolve it
      const ref = extractMarkDoneReference(userMessage)
      const resolved = ref ? resolveTask(ref, tasks) : null

      if (resolved && resolved.confidence !== 'low') {
        toolCall = {
          tool: 'mark_task_done',
          parameters: { task: resolved.task.id },
        }
        skipLLM = true
      } else if (ref) {
        // Pass the raw fragment for the LLM/tool to resolve at runtime
        toolCall = { tool: 'mark_task_done', parameters: { task: ref } }
        skipLLM = false
      } else {
        // No reference found — use list_tasks so the user can pick
        toolCall = { tool: 'list_tasks', parameters: {} }
        skipLLM = false
      }
      break
    }

    // ── No-parameter read tools ──────────────────────────────────────────

    case 'list_tasks':
      toolCall = { tool: 'list_tasks', parameters: {} }
      break

    case 'get_overdue_tasks':
      toolCall = { tool: 'get_overdue_tasks', parameters: {} }
      break

    case 'suggest_next_task':
      toolCall = { tool: 'suggest_next_task', parameters: {} }
      break

    case 'get_productivity_stats':
      toolCall = { tool: 'get_productivity_stats', parameters: {} }
      break

    case 'get_daily_summary':
      toolCall = { tool: 'get_daily_summary', parameters: {} }
      break

    case 'get_weekly_summary':
      toolCall = { tool: 'get_weekly_summary', parameters: {} }
      // TASK-1820: render the completed-this-week tasks as real cards.
      responseMode = 'weekly_review'
      break

    // ── Default: pass through with empty parameters ──────────────────────

    default:
      toolCall = { tool: primaryTool, parameters: {} }
      break
  }

  return {
    type: intentType,
    tools: [toolCall],
    language,
    formatDirective: FORMAT_DIRECTIVES[intentType],
    skipLLM,
    responseMode,
  }
}

// ---------------------------------------------------------------------------
// Main exported function (LLM-first with keyword fallback)
// ---------------------------------------------------------------------------

/**
 * Route a user message to an intent + pre-built tool calls.
 *
 * Resolution order:
 * 1. Greeting detection (regex fast path — no LLM call)
 * 2. LLM classification (~300ms via Groq)
 *    - high/medium confidence → route to tool
 *    - low confidence → freeform (ReAct)
 *    - parse failure → fall through to keyword matching
 * 3. Keyword matching fallback (instant, existing behavior)
 *
 * @param userMessage  - Raw user input string
 * @param tasks        - Current task list for entity resolution
 * @param entityMemory - Per-conversation entity memory for pronoun/context resolution
 * @returns            RoutedIntent with pre-built tool calls ready for execution
 */
export async function routeIntent(
  userMessage: string,
  tasks: TaskLike[],
  entityMemory: EntityMemory,
  opts: { skipLLMClassification?: boolean } = {},
): Promise<RoutedIntent> {
  const detected = detectLanguage(userMessage)
  const language = resolveLanguage(detected)

  // ── 1. Greeting check (fast path — no LLM call) ──────────────────────
  if (isGreeting(userMessage)) {
    return {
      type: 'greeting',
      tools: [],
      language,
      formatDirective: FORMAT_DIRECTIVES.greeting,
      skipLLM: true,
    }
  }

  if (isOverwhelmedDayPlanRequest(userMessage)) {
    return {
      type: 'task_query',
      tools: [{ tool: 'list_tasks', parameters: { status: 'todo', sortBy: 'priority', limit: 25 } }],
      language,
      formatDirective: 'Build a concrete ordered day plan. Sequence the tasks into focus blocks, and include only what should actually be done today.',
      responseMode: 'day_plan',
    }
  }

  if (isSmartLaneRequest(userMessage)) {
    return {
      type: 'task_query',
      tools: [{ tool: 'list_tasks', parameters: { status: 'todo', sortBy: 'priority', limit: 30 } }],
      language,
      formatDirective: 'Build smart task lanes from the real task list. Suggest lane names/themes, include existing tasks that belong in each lane, and add concrete new child tasks only when a large task should be broken down.',
      responseMode: 'smart_lanes',
    }
  }

  // ── 1b. TASK-1814: subscription bridge brains are a per-call CLI process
  // (~6s each), so the extra LLM intent-classification round-trip is too costly.
  // Use instant local keyword routing instead — it falls back to ReAct for
  // anything it can't classify, exactly like the LLM path does.
  if (opts.skipLLMClassification) {
    return routeIntentByKeywords(userMessage, tasks, entityMemory)
  }

  // ── 2. LLM classification ─────────────────────────────────────────────
  const classification = await classifyWithLLM(userMessage)

  if (classification && classification.tool !== 'NONE' && classification.confidence !== 'low') {
    // Map the classified tool to an intent type
    const intentType: IntentType = TOOL_TO_INTENT[classification.tool] ?? 'freeform'

    // If the tool is unknown (not in TOOL_TO_INTENT), fall through to keywords
    if (intentType === 'freeform' && classification.tool !== 'NONE') {
      return routeIntentByKeywords(userMessage, tasks, entityMemory)
    }

    // ── Build tool call with parameter enrichment ───────────────────────
    let toolCall: ToolCall
    let skipLLM = false

    switch (classification.tool) {
      case 'start_timer': {
        const lastEntity = entityMemory.getLastMentioned()
        const taskId = lastEntity?.id ?? 'general'
        toolCall = { tool: 'start_timer', parameters: { taskId } }
        skipLLM = true
        break
      }

      case 'stop_timer': {
        toolCall = { tool: 'stop_timer', parameters: {} }
        skipLLM = true
        break
      }

      case 'get_timer_status': {
        toolCall = { tool: 'get_timer_status', parameters: {} }
        break
      }

      case 'create_task': {
        // Use LLM-extracted title, fall back to keyword extraction
        const llmTitle = classification.params?.title
        const title = llmTitle || extractCreateTitle(userMessage)
        toolCall = {
          tool: 'create_task',
          parameters: title ? { title } : { title: '' },
        }
        skipLLM = title.length > 0
        break
      }

      case 'mark_task_done': {
        // Use LLM-extracted task reference, fall back to keyword extraction
        const llmRef = classification.params?.task
        const ref = llmRef || extractMarkDoneReference(userMessage)
        const resolved = ref ? resolveTask(ref, tasks) : null

        if (resolved && resolved.confidence !== 'low') {
          toolCall = {
            tool: 'mark_task_done',
            parameters: { task: resolved.task.id },
          }
          skipLLM = true
        } else if (ref) {
          toolCall = { tool: 'mark_task_done', parameters: { task: ref } }
        } else {
          toolCall = { tool: 'list_tasks', parameters: {} }
        }
        break
      }

      case 'search_tasks': {
        const query = classification.params?.query || userMessage
        toolCall = { tool: 'search_tasks', parameters: { query } }
        break
      }

      default: {
        // No-parameter read tools: list_tasks, get_overdue_tasks, suggest_next_task, etc.
        toolCall = { tool: classification.tool, parameters: {} }
        break
      }
    }

    return {
      type: intentType,
      tools: [toolCall],
      language,
      formatDirective: FORMAT_DIRECTIVES[intentType],
      skipLLM,
      responseMode: classification.tool === 'get_weekly_summary' ? 'weekly_review' : undefined,
    }
  }

  // ── 3. Keyword matching fallback ──────────────────────────────────────
  return routeIntentByKeywords(userMessage, tasks, entityMemory)
}
