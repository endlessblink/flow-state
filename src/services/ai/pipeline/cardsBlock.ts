/**
 * TASK-1814 — the model's ```cards``` block: parse it into grouped tasks-with-reasons
 * and strip it (and leaked [N] markers / de-fenced JSON) from the displayed prose.
 *
 * Pure + unit-tested (tests/unit/ai-cards-block.test.ts) so the "raw JSON leaked into
 * the chat" and "wrong tasks shown" regressions can never come back silently.
 */

/** Minimal shape of a tool result that carries a task list (structural subset of ToolResult). */
export interface CardToolResult {
  success: boolean
  data?: unknown
  message?: string
}

export interface CardGroup {
  name: string
  tasks: Array<Record<string, unknown> & { reason: string }>
  newTasks?: Array<{ title: string; priority?: string; reason?: string }>
}

export interface ParsedCards {
  groups: CardGroup[]
  total: number
  rawBlock: string
  kind?: 'day_plan' | 'smart_lanes' | 'weekly_review' | 'week_plan'
}

export function collectCardTasks(toolResults: CardToolResult[]): Array<Record<string, unknown>> {
  const tasks: Array<Record<string, unknown>> = []
  for (const result of toolResults) {
    if (!result.success) continue
    const data = result.data
    if (Array.isArray(data)) {
      tasks.push(...data.filter(isCardTask))
      continue
    }
    if (!data || typeof data !== 'object') continue
    const record = data as Record<string, unknown>
    for (const key of ['tasks', 'dueTodayTasks', 'overdueTasks', 'unscheduled'] as const) {
      const value = record[key]
      if (Array.isArray(value)) tasks.push(...value.filter(isCardTask))
    }
  }
  return tasks
}

function isCardTask(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && typeof (value as Record<string, unknown>).title === 'string')
}

/**
 * Parse a ```cards JSON block into grouped tasks. Each item references a task by its
 * [N] index (1-based) into the tool result's task list (same order the model saw).
 * Returns null if there's no block, it's unparseable, or nothing maps to a real task.
 */
export function parseCardGroups(text: string, toolResults: CardToolResult[]): ParsedCards | null {
  const m = text.match(/```+\s*cards\s*\n?([\s\S]*?)```+/i)
  if (!m) return null
  let parsed: {
    kind?: string
    groups?: Array<{
      name?: string
      items?: Array<{ i?: number; reason?: string }>
      newTasks?: Array<{ title?: string; priority?: string; reason?: string }>
    }>
  }
  try { parsed = JSON.parse(m[1].trim()) } catch { return null }
  if (!Array.isArray(parsed?.groups) || !parsed.groups.length) return null

  const indexedTasks = collectCardTasks(toolResults)
  if (!indexedTasks.length) return null

  const seenTaskKeys = new Set<string>()
  const groups = parsed.groups
    .map(g => {
      const groupTasks = (Array.isArray(g.items) ? g.items : [])
        .map(it => {
          const t = indexedTasks[(Number(it.i) || 0) - 1]
          if (!t) return null
          const taskKey = String(t.id || t.title || '').trim()
          if (taskKey && seenTaskKeys.has(taskKey)) return null
          if (taskKey) seenTaskKeys.add(taskKey)
          const modelReason = String(it.reason || '').trim()
          return { ...t, reason: repairCardReason(t, modelReason) }
        })
        .filter((t): t is Record<string, unknown> & { reason: string } => t !== null)
      const newTasks = (Array.isArray(g.newTasks) ? g.newTasks : [])
        .map(item => ({
          title: String(item.title || '').trim(),
          priority: typeof item.priority === 'string' ? item.priority : undefined,
          reason: typeof item.reason === 'string' ? item.reason.trim() : undefined,
        }))
        .filter(item => item.title.length > 0)
      return {
        name: String(g.name || '').trim(),
        tasks: groupTasks,
        ...(newTasks.length ? { newTasks } : {}),
      }
    })
    .filter(g => g.tasks.length > 0 || (g.newTasks?.length ?? 0) > 0)

  const kind = parsed.kind === 'day_plan' || parsed.kind === 'smart_lanes' || parsed.kind === 'weekly_review' || parsed.kind === 'week_plan' ? parsed.kind : undefined
  return groups.length ? { groups, total: indexedTasks.length, rawBlock: m[0], kind } : null
}

/**
 * Remove the cards block (and leaked [N] markers) from displayed prose. The block is
 * always appended LAST, so strip from its start to end-of-string — this survives
 * cleanResponse() mangling the fence (which caused raw JSON to leak as a code block).
 * Handles fenced (```cards) and de-fenced (bare {"groups":…}) variants.
 */
export function stripCardsBlock(text: string): string {
  return text
    .replace(/```+\s*cards[\s\S]*$/i, '')
    .replace(/\{\s*(?:"kind"\s*:\s*"[^"]+"\s*,\s*)?"groups"\s*:[\s\S]*$/, '')
    .replace(/\s*\[\d+(?:\s*(?:→|->|,)\s*\d+)*\]/g, '')
    .trim()
}

/**
 * The UI pins cards under the answer line that names the same task. If the model
 * emits a valid cards block but forgets to name one selected task in prose, add a
 * short grounding line before the cards block so the card has a real inline home.
 */
export function ensureCardTaskMentions(text: string, parsed: ParsedCards, intro: string): string {
  const cardStart = parsed.rawBlock ? text.indexOf(parsed.rawBlock) : -1
  const prose = cardStart >= 0 ? text.slice(0, cardStart).trimEnd() : stripCardsBlock(text).trimEnd()
  const cards = cardStart >= 0 ? text.slice(cardStart).trimStart() : parsed.rawBlock
  const normalizedProse = normalizeReasonText(prose)
  const missing = parsed.groups
    .flatMap(group => group.tasks)
    .filter(task => {
      const title = String(task.title || '').trim()
      return title.length > 0 && !normalizedProse.includes(normalizeReasonText(title))
    })

  if (!missing.length) return text

  const lines = missing.map(task => {
    const title = String(task.title || '').trim()
    const reason = String(task.reason || '').trim()
    return reason ? `- **${title}** - ${reason}` : `- **${title}**`
  })
  return [prose, intro, lines.join('\n'), cards].filter(Boolean).join('\n\n').trim()
}

/**
 * Streaming-safe variant for visible partial output. `stripCardsBlock` removes a
 * complete cards block; this also hides the dangling prefix while streamed
 * chunks are still building the marker (for example "```ca" before "rds").
 */
export function stripStreamingCardsBlock(text: string): string {
  return stripCardsBlock(text)
    .replace(/`{1,}\s*(?:c(?:a(?:r(?:d(?:s)?)?)?)?)?$/i, '')
    .trim()
}

function repairCardReason(task: Record<string, unknown>, reason: string): string {
  if (reason && !isShallowCardReason(reason)) return reason
  return inferStakeReason(task)
}

function isShallowCardReason(reason: string): boolean {
  const normalized = normalizeReasonText(reason)
  if (!normalized) return true
  if (normalized.length <= 4) return true
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return true
  if (/(why now|impact|slot|tradeoff|helps you stay on track|make progress|move forward|focused block|do this week)/i.test(normalized)) return true
  if (/(למה עכשיו|השפעה|מיקום|טריידאוף|להתקדם|התקדמות|בלוק מיקוד|השבוע)/i.test(normalized)) return true
  return [
    'due',
    'due today',
    'deadline',
    'deadline approaching',
    'due soon',
    'overdue',
    'high priority',
    'medium priority',
    'low priority',
    'priority high',
    'priority medium',
    'priority low',
    'quick win',
    'next up',
    'today',
    'מועד',
    'דדליין',
    'באיחור',
    'עדיפות',
    'עדיפות גבוהה',
    'עדיפות בינונית',
    'עדיפות נמוכה',
    'היום',
  ].some(term => normalized === term || normalized.includes(term))
}

function inferStakeReason(task: Record<string, unknown>): string {
  const title = String(task.title || '')
  const description = String(task.description || task.notes || '').trim()
  const haystack = `${title} ${description}`.toLowerCase()
  const hebrew = containsHebrew(`${title} ${description}`)

  if (description) {
    const clipped = description.length > 90 ? `${description.slice(0, 87)}...` : description
    return hebrew ? `ההערה נותנת הקשר מעשי: ${clipped}` : `the note gives practical context: ${clipped}`
  }
  if (/(payment|invoice|cardcom|charge|billing|refund|תשלום|חשבונית|חיוב|קאדרקום|קארדקום)/i.test(haystack)) {
    return hebrew ? 'כסף או גבייה עלולים להיתקע אם זה יחליק' : 'money or billing can get stuck if this slips'
  }
  if (/(treatment|medicine|dose|twice a day|doctor|health|טיפול|תרופה|מנה|מנות|רופא|בריאות|פעמיים ביום)/i.test(haystack)) {
    return hebrew ? 'רצף טיפול שנשבר קשה להשלים בדיעבד' : 'a broken treatment sequence is hard to recover later'
  }
  if (/(reply|send|call|email|message|stakeholder|follow.?up|להגיב|לשלוח|להתקשר|מייל|הודעה|לחזור)/i.test(haystack)) {
    return hebrew ? 'מישהו כנראה מחכה לתגובה כדי להתקדם' : 'someone is probably waiting on this to move forward'
  }
  if (/(outreach|cold opener|target list|sales|lead|prospect|פייפרפורט|לסקין|רשימת|אאוטריץ|מכירות|ליד)/i.test(haystack)) {
    return hebrew ? 'זה חלק מרצף מכירות שכדאי לבצע כמקבץ' : 'this belongs to one sales sequence worth batching'
  }
  if (/(lecture|choose|slot|date|schedule|meeting|הרצאה|לבחור|מועד|תאריך|פגישה)/i.test(haystack)) {
    return hebrew ? 'בחירה עכשיו סוגרת התחייבות זמן ומונעת דחייה' : 'choosing now closes a time commitment and prevents drift'
  }
  if (task.dueDate || task.daysOverdue) {
    return hebrew
      ? 'תזמון קרוב הופך את זה להתחייבות שכדאי לסגור'
      : 'near-term timing makes this a commitment worth closing'
  }
  return hebrew
    ? 'אין מספיק הקשר, אבל היא צריכה החלטה במקום להישאר פתוחה'
    : 'there is limited context, but it needs a decision instead of staying open'
}

function normalizeReasonText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[*_`~()[\]{}"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function containsHebrew(value: string): boolean {
  return /[\u0590-\u05FF]/.test(value)
}
