/**
 * Reasoning Directive Builder
 *
 * Builds MANDATORY, enumerated reasoning points per-result so the LLM is forced
 * to reference the pre-digested data rather than producing generic advice.
 *
 * Pattern: code extracts concrete facts per task → LLM must mention every numbered
 * point → output is specific, not generic.
 *
 * Complements preDigestedReasoning.ts (which summarises groups of tasks) by giving
 * per-item callouts with an imperative citation contract.
 *
 * Pure functions — no side effects, no LLM calls.
 *
 * @see TASK-1392 in MASTER_PLAN.md
 */

import type { DetectedLanguage } from './types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A single task's distilled facts ready for citation in the directive. */
export interface ReasoningPoint {
  /** Display title of the task or entity */
  taskTitle: string
  /** Concrete facts, e.g. ["3 days overdue", "high priority", "2/5 subtasks done"] */
  facts: string[]
}

/**
 * Structured directive payload — useful when callers need structured access.
 * The primary consumer is `buildReasoningDirective()` which serialises this to a string.
 */
export interface ReasoningDirective {
  /** Per-entity enumerated points the LLM must cite */
  points: ReasoningPoint[]
  /** Instruction telling the LLM which language to use */
  languageInstruction: string
  /** Guidance on response length, e.g. "2-4 sentences" */
  maxLength: string
  /** Formatting instruction injected verbatim into the prompt */
  formatInstruction: string
}

// ---------------------------------------------------------------------------
// Internal shape mirroring preDigestedReasoning.ts ToolResultData
// ---------------------------------------------------------------------------

interface TaskData {
  id?: string
  title?: string
  status?: string
  priority?: string | null
  dueDate?: string | null
  daysOverdue?: number
  estimatedMinutes?: number
  project?: string
  subtasks?: string       // "done/total" e.g. "2/5"
  pomodorosCompleted?: number
  hasDescription?: boolean
  tags?: string[]
  score?: number
  reason?: string
}

interface StatsData {
  todayCompleted?: number
  todayPomodoros?: number
  currentStreak?: number
  overdueCount?: number
  statusBreakdown?: Record<string, number>
}

interface WeeklyData {
  completedThisWeek?: number
  totalFocusMinutes?: number
}

interface TimerData {
  isRunning?: boolean
  currentTask?: string
  remainingSeconds?: number
  completedToday?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ENUMERATED = 5
const MAX_LENGTH_DEFAULT = '2-4 sentences'

// ---------------------------------------------------------------------------
// Language helpers
// ---------------------------------------------------------------------------

/**
 * Return language-specific string variants for a fact key.
 * All UI strings live here so the logic below stays clean.
 */
function t(
  lang: 'he' | 'en',
  key:
    | 'overdue'
    | 'highPriority'
    | 'subtasksDone'
    | 'pomodorosInvested'
    | 'dueToday'
    | 'dueTomorrow'
    | 'minEstimated'
    | 'project'
    | 'languageInstruction'
    | 'formatInstruction'
    | 'noTasks'
    | 'andNMore',
  vars?: Record<string, string | number>
): string {
  const v = vars ?? {}

  const strings: Record<string, Record<'he' | 'en', string>> = {
    overdue:            { en: `${v.n} day${Number(v.n) === 1 ? '' : 's'} overdue`,      he: `${v.n} ימים באיחור` },
    highPriority:       { en: 'high priority',                                           he: 'עדיפות גבוהה' },
    subtasksDone:       { en: `${v.done}/${v.total} subtasks done (${v.pct}%)`,          he: `${v.done}/${v.total} תת-משימות הושלמו (${v.pct}%)` },
    pomodorosInvested:  { en: `${v.n} pomodoro${Number(v.n) === 1 ? '' : 's'} invested`, he: `${v.n} פומודורו הושקעו` },
    dueToday:           { en: 'due today',                                               he: 'נדרש היום' },
    dueTomorrow:        { en: 'due tomorrow',                                            he: 'נדרש מחר' },
    minEstimated:       { en: `~${v.n} min estimated`,                                  he: `~${v.n} דק' הערכה` },
    project:            { en: `project: ${v.name}`,                                     he: `פרויקט: ${v.name}` },
    languageInstruction:{ en: 'Write in English',                                        he: 'כתוב בעברית' },
    formatInstruction:  {
      en: '- Mention EVERY numbered point above\n- No generic advice — only specific observations about these tasks\n- MANDATORY FORMAT: Use a **numbered list** or **bullet points** (one per task/insight). NEVER write a single paragraph blob.\n- Each bullet: bold the task name, then the key fact. Example:\n  • **Fix login bug** — 3 days overdue, high priority\n  • **Video project** — 2/5 subtasks done, needs attention',
      he: '- אזכור כל נקודה ממוספרת לעיל\n- ללא עצות כלליות — רק תצפיות ספציפיות על משימות אלו\n- פורמט חובה: השתמש ב**רשימה ממוספרת** או **נקודות** (אחת לכל משימה/תובנה). לעולם אל תכתוב פסקה אחת ארוכה.\n- כל נקודה: הדגש את שם המשימה, ואז העובדה. דוגמה:\n  • **תיקון באג** — 3 ימים באיחור, עדיפות גבוהה\n  • **פרויקט וידאו** — 2/5 תת-משימות, דורש תשומת לב',
    },
    noTasks: {
      en: 'No tasks found. Say so briefly in English.',
      he: 'לא נמצאו משימות. ציין זאת בקצרה בעברית.',
    },
    andNMore: {
      en: `…and ${v.n} more task${Number(v.n) === 1 ? '' : 's'}`,
      he: `…ועוד ${v.n} משימות`,
    },
  }

  return strings[key][lang]
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Return today's date string in YYYY-MM-DD (local time). */
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Return tomorrow's date string in YYYY-MM-DD (local time). */
function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Fact extraction — per task
// ---------------------------------------------------------------------------

/**
 * Extract reasoning facts from a single task object.
 * Returns an empty array when no interesting facts are present.
 */
function extractTaskFacts(task: TaskData, lang: 'he' | 'en'): string[] {
  const facts: string[] = []
  const today = todayStr()
  const tomorrow = tomorrowStr()

  // 1. Overdue
  if (task.daysOverdue !== undefined && task.daysOverdue > 0) {
    facts.push(t(lang, 'overdue', { n: task.daysOverdue }))
  }

  // 2. Priority
  if (task.priority === 'high' || task.priority === 'critical') {
    facts.push(t(lang, 'highPriority'))
  }

  // 3. Subtask progress  ("done/total" format)
  if (task.subtasks) {
    const parts = task.subtasks.split('/')
    if (parts.length === 2) {
      const done = parseInt(parts[0], 10)
      const total = parseInt(parts[1], 10)
      if (!isNaN(done) && !isNaN(total) && total > 0) {
        const pct = Math.round((done / total) * 100)
        facts.push(t(lang, 'subtasksDone', { done, total, pct }))
      }
    }
  }

  // 4. Pomodoro investment
  if (task.pomodorosCompleted !== undefined && task.pomodorosCompleted > 0) {
    facts.push(t(lang, 'pomodorosInvested', { n: task.pomodorosCompleted }))
  }

  // 5. Due soon (today / tomorrow) — only when not already flagged as overdue
  if (task.dueDate && (!task.daysOverdue || task.daysOverdue <= 0)) {
    const dueDateShort = task.dueDate.slice(0, 10)
    if (dueDateShort === today) {
      facts.push(t(lang, 'dueToday'))
    } else if (dueDateShort === tomorrow) {
      facts.push(t(lang, 'dueTomorrow'))
    }
  }

  // 6. Estimated effort
  if (task.estimatedMinutes !== undefined && task.estimatedMinutes > 0) {
    facts.push(t(lang, 'minEstimated', { n: task.estimatedMinutes }))
  }

  // 7. Project context
  if (task.project) {
    facts.push(t(lang, 'project', { name: task.project }))
  }

  return facts
}

// ---------------------------------------------------------------------------
// Point extraction — for task arrays
// ---------------------------------------------------------------------------

/**
 * Derive an ordered list of ReasoningPoints from a task array.
 *
 * Ordering: overdue first (most days first), then high-priority, then rest.
 * Tasks with no interesting facts are silently skipped.
 * Capped at MAX_ENUMERATED items.
 */
function extractTaskPoints(tasks: TaskData[], lang: 'he' | 'en'): { points: ReasoningPoint[]; overflow: number } {
  // Sort: most overdue first, then by priority score
  const priorityScore = (t: TaskData): number => {
    if (t.priority === 'critical') return 3
    if (t.priority === 'high') return 2
    if (t.priority === 'medium') return 1
    return 0
  }

  const sorted = [...tasks].sort((a, b) => {
    const overdueA = a.daysOverdue ?? 0
    const overdueB = b.daysOverdue ?? 0
    if (overdueB !== overdueA) return overdueB - overdueA
    return priorityScore(b) - priorityScore(a)
  })

  const points: ReasoningPoint[] = []
  for (const task of sorted) {
    if (!task.title) continue
    const facts = extractTaskFacts(task, lang)
    if (facts.length === 0) continue   // skip tasks with no interesting facts
    points.push({ taskTitle: task.title, facts })
    if (points.length >= MAX_ENUMERATED) break
  }

  // Count how many tasks with facts were skipped
  const totalWithFacts = sorted.filter(t => t.title && extractTaskFacts(t, lang).length > 0).length
  const overflow = Math.max(0, totalWithFacts - points.length)

  return { points, overflow }
}

// ---------------------------------------------------------------------------
// Point extraction — for non-task object results
// ---------------------------------------------------------------------------

/**
 * Build reasoning points from productivity stats / weekly summary / timer objects.
 */
function extractObjectPoints(
  toolName: string,
  data: Record<string, unknown>,
  lang: 'he' | 'en'
): ReasoningPoint[] {
  const facts: string[] = []

  // Timer status
  if ('isRunning' in data || 'currentTask' in data) {
    const d = data as TimerData
    if (d.isRunning) {
      const task = d.currentTask ? `"${d.currentTask}"` : (lang === 'he' ? 'משימה' : 'task')
      const remainMins = d.remainingSeconds !== undefined ? Math.ceil(d.remainingSeconds / 60) : null
      facts.push(
        lang === 'he'
          ? `טיימר פעיל על ${task}${remainMins !== null ? `, ${remainMins} דק' נותרו` : ''}`
          : `timer running on ${task}${remainMins !== null ? `, ${remainMins} min remaining` : ''}`
      )
    } else {
      facts.push(lang === 'he' ? 'טיימר לא פעיל' : 'timer not running')
    }
    if (d.completedToday !== undefined) {
      facts.push(
        lang === 'he'
          ? `${d.completedToday} פומודורו הושלמו היום`
          : `${d.completedToday} pomodoros completed today`
      )
    }
    return facts.length > 0 ? [{ taskTitle: lang === 'he' ? 'סטטוס טיימר' : 'Timer Status', facts }] : []
  }

  // Productivity stats
  if ('todayCompleted' in data || 'statusBreakdown' in data) {
    const d = data as StatsData
    if (d.todayCompleted !== undefined) {
      facts.push(lang === 'he' ? `${d.todayCompleted} משימות הושלמו היום` : `completed ${d.todayCompleted} today`)
    }
    if (d.overdueCount !== undefined && d.overdueCount > 0) {
      facts.push(lang === 'he' ? `${d.overdueCount} משימות באיחור` : `${d.overdueCount} overdue`)
    }
    if (d.currentStreak !== undefined && d.currentStreak > 0) {
      facts.push(
        lang === 'he'
          ? `רצף של ${d.currentStreak} ימים`
          : `streak of ${d.currentStreak} day${d.currentStreak === 1 ? '' : 's'}`
      )
    }
    if (d.todayPomodoros !== undefined) {
      facts.push(
        lang === 'he'
          ? `${d.todayPomodoros} פומודורו היום`
          : `${d.todayPomodoros} pomodoros today`
      )
    }
    if (d.statusBreakdown) {
      const total = Object.values(d.statusBreakdown).reduce((a, b) => a + b, 0)
      const done = d.statusBreakdown.done ?? 0
      facts.push(lang === 'he' ? `${done}/${total} משימות הושלמו בסה"כ` : `${done}/${total} tasks done overall`)
    }
    return facts.length > 0 ? [{ taskTitle: lang === 'he' ? 'נתוני פרודוקטיביות' : 'Productivity Stats', facts }] : []
  }

  // Weekly summary
  if ('completedThisWeek' in data || 'totalFocusMinutes' in data) {
    const d = data as WeeklyData
    if (d.completedThisWeek !== undefined) {
      facts.push(lang === 'he' ? `${d.completedThisWeek} משימות הושלמו השבוע` : `${d.completedThisWeek} completed this week`)
    }
    if (d.totalFocusMinutes !== undefined) {
      const hours = Math.floor(d.totalFocusMinutes / 60)
      const mins = d.totalFocusMinutes % 60
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
      facts.push(lang === 'he' ? `${timeStr} זמן מיקוד השבוע` : `${timeStr} focus time this week`)
    }
    return facts.length > 0 ? [{ taskTitle: lang === 'he' ? 'סיכום שבועי' : 'Weekly Summary', facts }] : []
  }

  return []
}

// ---------------------------------------------------------------------------
// Directive serialiser
// ---------------------------------------------------------------------------

/**
 * Serialise a ReasoningDirective into the imperative prompt string.
 */
function serialiseDirective(directive: ReasoningDirective): string {
  if (directive.points.length === 0) {
    // Edge case: no points — return the no-tasks short directive
    return directive.formatInstruction
  }

  const lines: string[] = [
    'MANDATORY REASONING POINTS (you MUST mention ALL of these in your response):',
  ]

  directive.points.forEach((point, idx) => {
    lines.push(`${idx + 1}. "${point.taskTitle}" — ${point.facts.join(', ')}`)
  })

  lines.push('')
  lines.push('RESPONSE RULES:')
  lines.push(`- ${directive.languageInstruction}`)
  lines.push(`- ${directive.maxLength} max`)
  lines.push(directive.formatInstruction)

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Build a specific, per-result formatting directive that forces the LLM
 * to use the pre-digested data. Each task gets enumerated reasoning points.
 *
 * Designed to be injected verbatim into the LLM prompt (e.g., appended to the
 * system prompt or the tool-result message) after tool calls complete.
 *
 * @param toolName - The tool that produced the results (e.g., 'list_tasks')
 * @param toolResults - Raw tool result data (array of enriched tasks or object)
 * @param language - Target language for the directive ('he' | 'en')
 * @returns Formatted directive string to inject into the LLM prompt
 *
 * @example
 * ```ts
 * const directive = buildReasoningDirective('list_tasks', tasks, 'he')
 * systemPrompt += `\n\n${directive}`
 * ```
 */
export function buildReasoningDirective(
  toolName: string,
  toolResults: unknown,
  language: 'he' | 'en'
): string {
  const lang = language

  // --- Empty / null results ---
  if (toolResults === null || toolResults === undefined) {
    return t(lang, 'noTasks')
  }

  // --- Array results (task lists) ---
  if (Array.isArray(toolResults)) {
    if (toolResults.length === 0) {
      return t(lang, 'noTasks')
    }

    // Check if this looks like a task array (has a title field on first item)
    const firstItem = toolResults[0] as Record<string, unknown>
    if (typeof firstItem === 'object' && firstItem !== null && 'title' in firstItem) {
      const tasks = toolResults as TaskData[]
      const { points, overflow } = extractTaskPoints(tasks, lang)

      if (points.length === 0) {
        // All tasks had no interesting facts
        return t(lang, 'noTasks')
      }

      // Append overflow note to the last point's facts if needed
      if (overflow > 0) {
        points[points.length - 1].facts.push(t(lang, 'andNMore', { n: overflow }))
      }

      const directive: ReasoningDirective = {
        points,
        languageInstruction: t(lang, 'languageInstruction'),
        maxLength: MAX_LENGTH_DEFAULT,
        formatInstruction: t(lang, 'formatInstruction'),
      }

      return serialiseDirective(directive)
    }

    // Non-task array — fall through to generic handling
  }

  // --- Object results (stats, timer, weekly summary) ---
  if (typeof toolResults === 'object' && toolResults !== null && !Array.isArray(toolResults)) {
    const data = toolResults as Record<string, unknown>

    // Weekly plan has its own rendering — don't override it
    if ('plan' in data && 'reasoning' in data) {
      return ''
    }

    const points = extractObjectPoints(toolName, data, lang)

    if (points.length === 0) {
      return t(lang, 'noTasks')
    }

    const directive: ReasoningDirective = {
      points,
      languageInstruction: t(lang, 'languageInstruction'),
      maxLength: MAX_LENGTH_DEFAULT,
      formatInstruction: t(lang, 'formatInstruction'),
    }

    return serialiseDirective(directive)
  }

  // --- Unknown shape — skip directive ---
  return ''
}
