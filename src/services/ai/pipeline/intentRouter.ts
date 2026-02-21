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

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Broad category of the user's intent */
export type IntentType =
  | 'task_query'
  | 'task_action'
  | 'timer'
  | 'planning'
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

  // Planning
  generate_weekly_plan: 'planning',

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
  planning:
    'Summarize the weekly plan briefly — highlight top priorities and overloaded days.',
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
// Main exported function
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
export function routeIntent(
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

    case 'generate_weekly_plan':
      toolCall = { tool: 'generate_weekly_plan', parameters: {} }
      break

    case 'get_productivity_stats':
      toolCall = { tool: 'get_productivity_stats', parameters: {} }
      break

    case 'get_daily_summary':
      toolCall = { tool: 'get_daily_summary', parameters: {} }
      break

    case 'get_weekly_summary':
      toolCall = { tool: 'get_weekly_summary', parameters: {} }
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
  }
}
