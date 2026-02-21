/**
 * Keyword-Based Tool Hints for AI Chat Pipeline
 *
 * Provides deterministic keyword→tool mapping so the system prompt can include
 * a targeted hint like "Consider using `get_overdue_tasks` for this query."
 * This reduces ReAct loop steps from 2-3 to 1 for common user intents.
 *
 * No LLM calls — purely deterministic substring matching.
 *
 * Used by the pipeline pre-processing step to inject a TOOL HINTS block into
 * the system prompt when the user message contains known trigger words.
 *
 * @see TASK-1392 in MASTER_PLAN.md
 */

/** A single resolved tool hint — tool name + human-readable reason */
export interface ToolHint {
  tool: string
  reason: string
}

/** Internal mapping entry used in the keyword table */
interface KeywordMapping {
  /** Trigger words/phrases (English + Hebrew). Longer phrases take precedence within each entry. */
  keywords: string[]
  /** The tool name to recommend */
  tool: string
  /** Short explanation included in the hint */
  reason: string
}

/**
 * Keyword → tool mapping table.
 *
 * Each entry contains a list of trigger words/phrases and the tool to suggest
 * when any of them appear in the lowercased user message.
 *
 * Ordering rule: more-specific entries (e.g., "start timer") appear BEFORE
 * less-specific ones (e.g., "timer") so that within a single entry the
 * multi-word keywords appear first in their respective arrays — ensuring that
 * longer-phrase matches are found before single-word fallbacks.
 *
 * Coverage: English and Hebrew for every scenario.
 */
const KEYWORD_MAPPINGS: KeywordMapping[] = [
  // --- Timer actions (specific first, general timer below) ---
  {
    keywords: ['start timer', 'start pomodoro', 'התחל טיימר', 'התחל פומודורו'],
    tool: 'start_timer',
    reason: 'User wants to start a timer',
  },
  {
    keywords: ['stop timer', 'stop pomodoro', 'עצור טיימר', 'עצור פומודורו', 'הפסק טיימר'],
    tool: 'stop_timer',
    reason: 'User wants to stop the timer',
  },
  {
    keywords: ['timer', 'pomodoro', 'טיימר', 'פומודורו'],
    tool: 'get_timer_status',
    reason: 'User is asking about timer',
  },

  // --- Overdue tasks ---
  {
    keywords: ['overdue', 'late tasks', 'past due', 'missed deadline', 'פג תוקף', 'באיחור', 'פגי תוקף'],
    tool: 'get_overdue_tasks',
    reason: 'User is asking about overdue tasks',
  },

  // --- Weekly planning ---
  {
    keywords: ['plan my week', 'weekly plan', 'plan the week', 'תכנון שבועי', 'לתכנן שבוע', 'תכנן לי שבוע'],
    tool: 'generate_weekly_plan',
    reason: 'User wants a weekly plan',
  },

  // --- Task suggestion ---
  {
    keywords: [
      'what should i',
      'what should i do',
      'suggest next',
      'next task',
      'recommend a task',
      'what to work on',
      'מה לעשות',
      'מה כדאי',
      'מה הבא',
      'הצע משימה',
    ],
    tool: 'suggest_next_task',
    reason: 'User wants task suggestion',
  },

  // --- Productivity stats ---
  {
    keywords: [
      'how many',
      'statistics',
      'stats',
      'productivity',
      'my progress',
      'how am i doing',
      'performance',
      'כמה',
      'סטטיסטיקות',
      'ביצועים',
      'התקדמות',
    ],
    tool: 'get_productivity_stats',
    reason: 'User is asking about stats',
  },

  // --- Weekly summary ---
  {
    keywords: [
      'this week',
      'weekly summary',
      'week summary',
      'summarize the week',
      'weekly',
      'סיכום שבועי',
      'סכם שבוע',
      'השבוע',
    ],
    tool: 'get_weekly_summary',
    reason: 'User wants weekly summary',
  },

  // --- Daily summary ---
  {
    keywords: [
      'today',
      'daily summary',
      'day summary',
      'summarize today',
      'סיכום יומי',
      'סכם היום',
      'היום',
    ],
    tool: 'get_daily_summary',
    reason: 'User wants daily summary',
  },

  // --- Create task ---
  {
    keywords: [
      'create task',
      'add task',
      'new task',
      'add a task',
      'create a task',
      'צור משימה',
      'הוסף משימה',
      'משימה חדשה',
    ],
    tool: 'create_task',
    reason: 'User wants to create a task',
  },

  // --- Delete task ---
  {
    keywords: ['delete', 'remove task', 'remove the task', 'delete task', 'מחק', 'הסר', 'מחיקה'],
    tool: 'delete_task',
    reason: 'User wants to delete something',
  },

  // --- Update task status (done/complete) ---
  {
    keywords: [
      'mark as done',
      'mark done',
      'mark complete',
      'mark as complete',
      'set status',
      'done',
      'complete',
      'finish',
      'finished',
      'סיים',
      'הושלם',
      'סמן כסיום',
      'סמן כהושלם',
    ],
    tool: 'update_task_status',
    reason: 'User wants to change task status',
  },

  // --- Move task ---
  {
    keywords: ['move task', 'move to', 'transfer to', 'העבר', 'הזז', 'העבר משימה'],
    tool: 'move_task_to_group',
    reason: 'User wants to move a task',
  },

  // --- Due date ---
  {
    keywords: ['due date', 'deadline', 'set due', 'set deadline', 'תאריך יעד', 'דדליין', 'מועד אחרון'],
    tool: 'set_task_due_date',
    reason: 'User wants to set a due date',
  },

  // --- Subtasks ---
  {
    keywords: [
      'subtask',
      'sub task',
      'break down',
      'break it down',
      'split task',
      'תת-משימה',
      'תת משימה',
      'לפצל',
      'פרק ל',
    ],
    tool: 'create_subtasks',
    reason: 'User wants to create subtasks',
  },

  // --- Search ---
  {
    keywords: ['search', 'find task', 'look for', 'חפש', 'מצא', 'חיפוש'],
    tool: 'search_tasks',
    reason: 'User wants to search for tasks',
  },

  // --- Projects ---
  {
    keywords: ['project', 'projects', 'my projects', 'list projects', 'פרויקט', 'פרויקטים'],
    tool: 'list_projects',
    reason: 'User is asking about projects',
  },

  // --- Gamification ---
  {
    keywords: [
      'gamification',
      'xp',
      'experience points',
      'level up',
      'my level',
      'achievement',
      'achievements',
      'badge',
      'הישג',
      'הישגים',
      'רמה',
      'נקודות',
    ],
    tool: 'get_gamification_status',
    reason: 'User is asking about gamification',
  },

  // --- Achievements near completion ---
  {
    keywords: [
      'almost',
      'nearly done',
      'close to achievement',
      'near completion',
      'קרוב להישג',
      'כמעט',
    ],
    tool: 'get_achievements_near_completion',
    reason: 'User is asking about nearly-completed achievements',
  },

  // --- Challenges ---
  {
    keywords: ['challenge', 'challenges', 'active challenge', 'אתגר', 'אתגרים', 'אתגר פעיל'],
    tool: 'get_active_challenges',
    reason: 'User is asking about challenges',
  },

  // --- List/show tasks (least specific — keep last) ---
  {
    keywords: [
      'show tasks',
      'list tasks',
      'show all',
      'all tasks',
      'my tasks',
      'show me tasks',
      'list all',
      'הצג',
      'כל המשימות',
      'המשימות שלי',
      'רשימת משימות',
    ],
    tool: 'list_tasks',
    reason: 'User wants to see tasks',
  },
]

/**
 * Return all tool hints whose keywords appear in the user message.
 *
 * - Lowercases the message before matching.
 * - Each mapping is checked independently; a mapping matches if ANY of its
 *   keywords is a substring of the lowercased message.
 * - Within a mapping's keyword array, longer phrases are checked first so
 *   that the most-specific match triggers the recommendation.
 * - Duplicate tool names are deduplicated (first match wins).
 *
 * @param userMessage - The raw user input string
 * @returns Array of matching ToolHints (may be empty)
 */
export function getToolHints(userMessage: string): ToolHint[] {
  if (!userMessage || userMessage.trim().length === 0) return []

  const lowered = userMessage.toLowerCase()
  const seen = new Set<string>()
  const hints: ToolHint[] = []

  for (const mapping of KEYWORD_MAPPINGS) {
    // Sort keywords within this mapping by length descending (longer = more specific)
    const sortedKeywords = [...mapping.keywords].sort((a, b) => b.length - a.length)

    const matched = sortedKeywords.some(keyword => lowered.includes(keyword.toLowerCase()))
    if (matched && !seen.has(mapping.tool)) {
      seen.add(mapping.tool)
      hints.push({ tool: mapping.tool, reason: mapping.reason })
    }
  }

  return hints
}

/**
 * Format tool hints into a string block for injection into the system prompt.
 *
 * Returns an empty string when there are no hints.
 * Caps output at 3 hints to avoid overwhelming the LLM with suggestions.
 *
 * @param hints - Array returned by `getToolHints()`
 * @returns Formatted hint block, or empty string
 */
export function formatToolHints(hints: ToolHint[]): string {
  if (hints.length === 0) return ''

  const capped = hints.slice(0, 3)
  const lines = capped.map(h => `- Consider using \`${h.tool}\`: ${h.reason}`)

  return `\n\nTOOL HINTS for this query:\n${lines.join('\n')}`
}
