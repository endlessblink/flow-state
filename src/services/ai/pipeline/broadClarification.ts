import type { AIClarificationArtifact, AIClarificationEvent } from '@/types/aiMemory'
import { collectCardTasks, type CardToolResult } from './cardsBlock'
import type { RoutedIntent } from './intentRouter'
import { computeBroadTaskClarificationCoverage } from './responseClarificationPolicy'

type ChatOutputLanguage = 'en' | 'he'

export const BROAD_TASK_RECOMMENDATION_RE = /(what should i do|what to do|prioriti[sz]e|priority|important|overwhelm|plan my day|plan today|focus on|next task|next action|מה לעשות|מה כדאי|לתעדף|סדר עדיפויות|חשוב|להתמקד|מוצף|לתכנן|המשימה הבאה)/i

export function shouldAskBroadTaskClarification(content: string, routed: RoutedIntent, hasTaskList: boolean): boolean {
  if (!hasTaskList) return false
  if (routed.responseMode === 'week_plan' || routed.responseMode === 'weekly_review') return false
  if (routed.responseMode === 'day_plan' || routed.responseMode === 'smart_lanes') return true
  return BROAD_TASK_RECOMMENDATION_RE.test(content)
}

export function broadTaskClarificationMemoryKey(routed: RoutedIntent): string {
  return `workflow:task_answer:${routed.responseMode || 'general'}`
}

export function hasRecentClarificationDecision(events: AIClarificationEvent[], now = Date.now()): boolean {
  return events.some(event => {
    const createdAt = event.createdAt ? Date.parse(event.createdAt) : now
    if (!Number.isFinite(createdAt)) return false
    const ageDays = (now - createdAt) / (24 * 60 * 60 * 1000)
    if (event.eventType === 'asked') return ageDays < 1
    return ageDays < 7
  })
}

export function buildBroadTaskClarification(
  routed: RoutedIntent,
  toolResults: CardToolResult[],
  lang: ChatOutputLanguage,
  events: AIClarificationEvent[],
): AIClarificationArtifact | null {
  const candidateTaskIds = collectCardTasks(toolResults)
    .map(task => String(task.id || ''))
    .filter(Boolean)
    .slice(0, 12)
  if (!candidateTaskIds.length || hasRecentClarificationDecision(events)) return null
  const coverage = computeBroadTaskClarificationCoverage(routed.responseMode, candidateTaskIds.length)
  if (coverage.decision !== 'ask') return null

  const memoryKey = broadTaskClarificationMemoryKey(routed)
  const entityId = routed.responseMode || 'general'
  const options = lang === 'he'
    ? [
        { id: 'impact', label: 'השפעה אמיתית', value: 'real impact or consequence', effect: 'לדרג לפי השלכה אמיתית.' },
        { id: 'deadline', label: 'דדליין/התחייבות', value: 'deadline or commitment', effect: 'לדרג לפי התחייבויות קרובות.' },
        { id: 'stress', label: 'להוריד לחץ', value: 'reduce stress or open loops', effect: 'להעדיף סגירת עומס פתוח.' },
        { id: 'quick_win', label: 'ניצחון מהיר', value: 'quick win or low friction', effect: 'להעדיף פעולה קטנה שמניעה.' },
        { id: 'not_sure', label: 'לא בטוח', value: 'unknown ranking focus', effect: 'לסמן אי ודאות ולא להמציא.' },
      ]
    : [
        { id: 'impact', label: 'Real impact', value: 'real impact or consequence', effect: 'Rank by real-world consequence.' },
        { id: 'deadline', label: 'Deadline/commitment', value: 'deadline or commitment', effect: 'Rank around near commitments.' },
        { id: 'stress', label: 'Reduce stress', value: 'reduce stress or open loops', effect: 'Prefer closing mental load.' },
        { id: 'quick_win', label: 'Quick win', value: 'quick win or low friction', effect: 'Prefer small momentum first.' },
        { id: 'not_sure', label: 'Not sure', value: 'unknown ranking focus', effect: 'Mark uncertainty instead of guessing.' },
      ]
  const question = lang === 'he'
    ? 'מה צריך להוביל את התשובה הזו?'
    : 'What should guide this answer?'

  return {
    schemaVersion: 'ai-clarification.v1',
    kind: 'response_quality',
    locale: lang,
    direction: lang === 'he' ? 'rtl' : 'ltr',
    progressLabel: lang === 'he' ? 'מבהיר כיוון · שלב 1/1' : 'Clarifying direction • Step 1/1',
    summary: lang === 'he'
      ? 'חסר לי פרט אחד שישנה את ההמלצה, אז אשאל לפני תשובה רחבה.'
      : 'One missing preference would change the recommendation, so I should ask before a broad answer.',
    memoryKey,
    pathType: 'clarify_first',
    candidateTaskIds,
    actions: ['generate_current', 'show_candidates', 'pause_save'],
    coverage,
    question: {
      id: `response_quality_${entityId}`,
      entityType: 'workflow',
      entityId,
      reason: 'missing_response_direction',
      question,
      options: options.map(option => ({
        id: `ranking_${option.id}`,
        label: option.label,
        effect: option.effect,
        memoryPatch: {
          entityType: 'workflow',
          entityId,
          operation: 'set',
          field: 'rankingFocus',
          value: option.value,
          confidence: option.id === 'not_sure' ? 0.45 : 0.9,
          source: 'button_answer',
        },
      })),
      allowFreeText: true,
      freeTextPatch: { field: 'taskSelectionHints', operation: 'append' },
      freeTextPlaceholder: lang === 'he'
        ? 'אופציונלי: מה חשוב לך בתשובה הזו?'
        : 'Optional: what matters most in this answer?',
      relatedTaskIds: candidateTaskIds,
    },
    debug: {
      retrieval: {
        source: 'exact_entity_lookup',
        entityKeyCount: 1,
        eventCount: events.length,
        projectContextCount: 0,
        taskContextCount: 0,
      },
      reason: `shared uncertainty policy says a broad task answer would otherwise rank ${candidateTaskIds.length} candidates without a saved response direction`,
      candidateCount: candidateTaskIds.length,
    },
  }
}
