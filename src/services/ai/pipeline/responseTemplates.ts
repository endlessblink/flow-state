/**
 * Localized Template Responses for Deterministic AI Chat Pipeline
 *
 * When the AI pipeline handles simple actions (start timer, create task, mark done)
 * without invoking the LLM, these templates produce localized responses directly.
 *
 * Design goals:
 * - No external dependencies (pure utility)
 * - Full TypeScript strict-mode compatibility
 * - Both 'en' and 'he' variants required for every key
 * - Template functions carry typed parameters for correctness at call sites
 */

/** Supported template languages */
export type TemplateLanguage = 'he' | 'en'

/**
 * All template definitions.
 *
 * Each entry is an object with 'en' and 'he' functions that accept typed
 * arguments and return a formatted localized string.
 */
export const TEMPLATES = {
  timer_started: {
    en: (taskName: string, duration: number) =>
      `Timer started for "${taskName}" (${duration} min).`,
    he: (taskName: string, duration: number) =>
      `טיימר הופעל עבור "${taskName}" (${duration} דק').`,
  },
  timer_stopped: {
    en: (taskName: string, remaining: string) =>
      `Timer stopped for "${taskName}" (${remaining} remaining).`,
    he: (taskName: string, remaining: string) =>
      `טיימר נעצר עבור "${taskName}" (נותרו ${remaining}).`,
  },
  timer_already_running: {
    en: () => `A timer is already running. Stop it first.`,
    he: () => `טיימר כבר פועל. עצור אותו קודם.`,
  },
  timer_not_running: {
    en: () => `No timer is currently running.`,
    he: () => `אין טיימר פועל כרגע.`,
  },
  task_created: {
    en: (title: string) => `Task "${title}" created.`,
    he: (title: string) => `משימה "${title}" נוצרה.`,
  },
  task_done: {
    en: (title: string) => `"${title}" marked as done!`,
    he: (title: string) => `"${title}" סומנה כהושלמה!`,
  },
  task_already_done: {
    en: (title: string) => `"${title}" is already done.`,
    he: (title: string) => `"${title}" כבר הושלמה.`,
  },
  task_not_found: {
    en: (query: string) =>
      `No task found matching "${query}". Try a more specific name.`,
    he: (query: string) =>
      `לא נמצאה משימה התואמת ל-"${query}". נסה שם מדויק יותר.`,
  },
  no_tasks: {
    en: () => `No tasks found matching your criteria.`,
    he: () => `לא נמצאו משימות התואמות לחיפוש.`,
  },
  no_overdue: {
    en: () => `No overdue tasks — you're on track!`,
    he: () => `אין משימות באיחור — אתה בכיוון הנכון!`,
  },
  greeting: {
    en: () => `Hey! How can I help you today?`,
    he: () => `היי! איך אפשר לעזור?`,
  },
  tool_error: {
    en: (message: string) => `Something went wrong: ${message}`,
    he: (message: string) => `משהו השתבש: ${message}`,
  },
  no_credits: {
    en: () =>
      `No API credits remaining. Please check your API key balance in Settings → AI.`,
    he: () =>
      `לא נותרו קרדיטים ל-API. בדוק את יתרת המפתח בהגדרות → AI.`,
  },
} as const

/** Union of all valid template keys, derived from TEMPLATES */
export type TemplateKey = keyof typeof TEMPLATES

/**
 * Check if a string is a valid template key.
 *
 * @param key - Arbitrary string to test
 * @returns Type predicate narrowing key to TemplateKey
 */
export function hasTemplate(key: string): key is TemplateKey {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, key)
}

/**
 * Get a localized template response.
 *
 * Calls the template function for the given key and language, forwarding
 * any additional arguments. Falls back to 'en' when the language variant
 * is not found (defensive — all templates must have both variants, but
 * this protects against future partial additions).
 *
 * @param key      - Template key (e.g. 'timer_started', 'task_done')
 * @param language - Target language ('en' or 'he')
 * @param args     - Arguments forwarded to the template function
 * @returns Formatted localized string
 *
 * @example
 * getTemplate('timer_started', 'he', 'Write report', 25)
 * // → 'טיימר הופעל עבור "Write report" (25 דק').'
 *
 * @example
 * getTemplate('greeting', 'en')
 * // → 'Hey! How can I help you today?'
 */
export function getTemplate(
  key: TemplateKey,
  language: TemplateLanguage,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...args: any[]
): string {
  const template = TEMPLATES[key]
  const fn = (template[language] ?? template['en']) as (...a: unknown[]) => string
  return fn(...args)
}
