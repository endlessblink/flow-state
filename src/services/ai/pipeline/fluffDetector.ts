/**
 * Fluff Detector Guardrail
 *
 * Heuristic scoring to detect generic/fluffy LLM responses.
 * Based on 2025 "Detecting Prompt Knowledge Gaps" paper specificity dimensions:
 * - Does response reference actual task names from context?
 * - Does it contain specific data points (dates, numbers, percentages)?
 * - Does it avoid generic advisory phrases?
 *
 * Zero-cost, runs client-side. No API call needed.
 *
 * @see TASK-1390 in MASTER_PLAN.md
 */

/** Known generic advisory phrases that add no value */
const GENERIC_PHRASES = [
  // English
  'it\'s essential to',
  'it is essential to',
  'it\'s important to',
  'it is important to',
  'consider starting with',
  'consider focusing on',
  'you might want to',
  'you may want to',
  'you should consider',
  'you could try',
  'one approach is',
  'generally speaking',
  'in general',
  'to be more productive',
  'manage your time',
  'focus on what matters',
  'prioritize your tasks',
  'focus on priorities',
  'start with urgent',
  'start with the most important',
  'tackle the most pressing',
  'stay organized',
  'break tasks into smaller',
  'consider breaking tasks',
  'take it one step at a time',
  'set clear goals',
  'make a plan',
  'stay on track',
  'keep up the good work',
  'you\'re doing great',
  'that require the most attention',
  'require the most effort',
  // Hebrew
  'חשוב לתעדף',
  'כדאי להתחיל עם',
  'שקול להתמקד',
  'נסה להתמקד',
  'תתחיל עם המשימות',
]

/** Result of fluff detection */
export interface FluffScore {
  /** 0 = very generic, 1 = very specific */
  score: number
  /** Reasons it looks generic */
  flags: string[]
  /** Whether this should trigger a retry */
  shouldRetry: boolean
}

/**
 * Score a response for fluffiness.
 *
 * @param response - LLM response text
 * @param taskTitles - Task titles that were in the tool results / context
 * @param hadToolCalls - Whether the response followed tool calls
 * @returns FluffScore with score 0-1 and flags
 */
export function detectFluff(
  response: string,
  taskTitles: string[],
  hadToolCalls: boolean
): FluffScore {
  const flags: string[] = []
  let deductions = 0
  const lower = response.toLowerCase()

  // Check 1: Generic advisory phrases (0.05 each, max 0.3)
  const foundGeneric = GENERIC_PHRASES.filter(p => lower.includes(p))
  if (foundGeneric.length > 0) {
    const penalty = Math.min(foundGeneric.length * 0.05, 0.3)
    deductions += penalty
    flags.push(`generic phrases (${foundGeneric.length}): "${foundGeneric.slice(0, 3).join('", "')}"`)
  }

  // Check 2: References actual task titles from context (0.3 weight)
  if (taskTitles.length > 0) {
    // Check if response mentions any task by at least first 6 chars of title
    const mentionedTasks = taskTitles.filter(title => {
      if (!title || title.length < 3) return false
      const searchable = title.toLowerCase().substring(0, Math.min(title.length, 15))
      return lower.includes(searchable)
    })

    if (mentionedTasks.length === 0) {
      deductions += 0.3
      flags.push('references no specific tasks from results')
    }
  }

  // Check 3: Contains specific data points (dates, numbers, percentages) (0.15 weight)
  const hasSpecificData = /\b(\d+ days?|overdue|\d+\/\d+|\d+%|\d+ tasks?|\d+ pomodoro|\d+ minutes?|\d+ hours?)\b/i.test(response)
  if (!hasSpecificData && hadToolCalls) {
    deductions += 0.15
    flags.push('no specific data points (days, subtask counts, percentages)')
  }

  // Check 4: Too short after tool calls (probably didn't engage with data)
  if (hadToolCalls && response.length < 80) {
    deductions += 0.1
    flags.push('suspiciously short response after tool calls')
  }

  // Check 5: Repeats same structure as generic template
  const bulletCount = (response.match(/^[-*•]\s/gm) || []).length
  if (bulletCount >= 3) {
    // Bullets are fine IF they reference specific tasks
    const bulletsWithTasks = taskTitles.some(t => lower.includes(t.toLowerCase().substring(0, 8)))
    if (!bulletsWithTasks && taskTitles.length > 0) {
      deductions += 0.1
      flags.push('bullet list without task references')
    }
  }

  const score = Math.max(0, Math.min(1, 1 - deductions))
  return {
    score,
    flags,
    shouldRetry: score < 0.5 && hadToolCalls, // Only retry after tool calls (user expects specific data)
  }
}

/**
 * Extract task titles from tool results data for fluff checking.
 */
export function extractTaskTitlesFromResults(toolResults: Array<{ data?: unknown }>): string[] {
  const titles: string[] = []

  for (const result of toolResults) {
    if (!result.data) continue

    if (Array.isArray(result.data)) {
      for (const item of result.data) {
        if (item && typeof item === 'object' && 'title' in item) {
          titles.push((item as { title: string }).title)
        }
      }
    }
  }

  return titles
}
