import type { AIClarificationArtifact, AIClarificationEvent, AIParameterBelief } from '@/types/aiMemory'
import { collectCardTasks, type CardToolResult } from './cardsBlock'
import type { RoutedIntent } from './intentRouter'
import { computeBroadTaskClarificationCoverage } from './responseClarificationPolicy'

type ChatOutputLanguage = 'en' | 'he'

export const BROAD_TASK_RECOMMENDATION_RE = /(what should i do|what to do|prioriti[sz]e|priority|important|overwhelm|plan my day|plan today|focus on|next task|next action|מה לעשות|מה כדאי|לתעדף|סדר עדיפויות|חשוב|להתמקד|מוצף|לתכנן|המשימה הבאה)/i

export function shouldAskBroadTaskClarification(content: string, routed: RoutedIntent, hasTaskList: boolean): boolean {
  if (!hasTaskList) return false
  if (routed.responseMode === 'week_plan' || routed.responseMode === 'weekly_review') return false
  if (
    routed.responseMode === 'day_plan' ||
    routed.responseMode === 'smart_lanes' ||
    routed.responseMode === 'prioritization' ||
    routed.responseMode === 'next_task' ||
    routed.responseMode === 'overdue_triage' ||
    routed.responseMode === 'task_breakdown'
  ) return true
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
  beliefs: AIParameterBelief[] = [],
): AIClarificationArtifact | null {
  const candidateTaskIds = collectCardTasks(toolResults)
    .map(task => String(task.id || ''))
    .filter(Boolean)
    .slice(0, 12)
  if (!candidateTaskIds.length || hasRecentClarificationDecision(events)) return null
  const coverage = computeBroadTaskClarificationCoverage(routed.responseMode, candidateTaskIds.length, beliefs)
  if (coverage.decision !== 'ask') return null

  const memoryKey = broadTaskClarificationMemoryKey(routed)
  const entityId = routed.responseMode || 'general'
  const prompt = promptForBroadTaskMode(routed.responseMode, lang)

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
      question: prompt.question,
      options: prompt.options.map(option => ({
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
        ? prompt.freeTextPlaceholderHe
        : prompt.freeTextPlaceholderEn,
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

type BroadTaskPromptOption = {
  id: string
  label: string
  value: string
  effect: string
}

type BroadTaskPrompt = {
  question: string
  freeTextPlaceholderHe: string
  freeTextPlaceholderEn: string
  options: BroadTaskPromptOption[]
}

function promptForBroadTaskMode(responseMode: RoutedIntent['responseMode'], lang: ChatOutputLanguage): BroadTaskPrompt {
  const commonHe = {
    freeTextPlaceholderHe: 'אופציונלי: מה חשוב לך בתשובה הזו?',
    freeTextPlaceholderEn: 'Optional: what matters most in this answer?',
  }
  const commonEn = commonHe

  if (responseMode === 'prioritization') {
    return lang === 'he'
      ? {
          ...commonHe,
          question: 'מה צריך לקבוע את סדר העדיפויות?',
          options: [
            { id: 'impact', label: 'השלכה אמיתית', value: 'real impact or consequence', effect: 'לדרג לפי השלכות אמיתיות.' },
            { id: 'commitment', label: 'התחייבות לאדם', value: 'commitment to another person', effect: 'להעדיף התחייבויות לאחרים.' },
            { id: 'money_health', label: 'כסף/בריאות', value: 'money health or client risk', effect: 'להעדיף סיכון חיים/עבודה מוחשי.' },
            { id: 'momentum', label: 'מומנטום בפרויקט', value: 'project momentum', effect: 'להעדיף עבודה שמקדמת פרויקט חשוב.' },
            { id: 'not_sure', label: 'לא בטוח', value: 'unknown ranking focus', effect: 'לסמן אי ודאות ולא להמציא.' },
          ],
        }
      : {
          ...commonEn,
          question: 'What should decide the priority order?',
          options: [
            { id: 'impact', label: 'Real consequence', value: 'real impact or consequence', effect: 'Rank by real consequences.' },
            { id: 'commitment', label: 'Commitment', value: 'commitment to another person', effect: 'Prioritize commitments to others.' },
            { id: 'money_health', label: 'Money/health', value: 'money health or client risk', effect: 'Prefer concrete life/work risk.' },
            { id: 'momentum', label: 'Project momentum', value: 'project momentum', effect: 'Prefer work that moves an important project.' },
            { id: 'not_sure', label: 'Not sure', value: 'unknown ranking focus', effect: 'Mark uncertainty instead of guessing.' },
          ],
        }
  }

  if (responseMode === 'next_task') {
    return lang === 'he'
      ? {
          ...commonHe,
          question: 'מה יהפוך משימה אחת לנכונה עכשיו?',
          options: [
            { id: 'energy', label: 'מתאים לאנרגיה', value: 'energy fit right now', effect: 'לבחור פעולה שמתאימה למצב הנוכחי.' },
            { id: 'impact', label: 'הכי משמעותי', value: 'highest real impact', effect: 'להעדיף תוצאה משמעותית.' },
            { id: 'deadline', label: 'הכי דחוף', value: 'nearest hard deadline', effect: 'להעדיף דדליין קשיח.' },
            { id: 'quick_win', label: 'התחלה קלה', value: 'quick win or low friction', effect: 'להעדיף צעד קטן שמתחיל תנועה.' },
            { id: 'not_sure', label: 'לא בטוח', value: 'unknown ranking focus', effect: 'לסמן אי ודאות ולא להמציא.' },
          ],
        }
      : {
          ...commonEn,
          question: 'What would make one task right for now?',
          options: [
            { id: 'energy', label: 'Energy fit', value: 'energy fit right now', effect: 'Choose a task that fits your current state.' },
            { id: 'impact', label: 'Most meaningful', value: 'highest real impact', effect: 'Prefer meaningful outcome.' },
            { id: 'deadline', label: 'Most urgent', value: 'nearest hard deadline', effect: 'Prefer a hard deadline.' },
            { id: 'quick_win', label: 'Easy start', value: 'quick win or low friction', effect: 'Prefer a small momentum step.' },
            { id: 'not_sure', label: 'Not sure', value: 'unknown ranking focus', effect: 'Mark uncertainty instead of guessing.' },
          ],
        }
  }

  if (responseMode === 'overdue_triage') {
    return lang === 'he'
      ? {
          ...commonHe,
          question: 'איך להתייחס למשימות באיחור?',
          options: [
            { id: 'hard_commitments', label: 'התחייבויות קשיחות', value: 'hard commitments first', effect: 'לטפל קודם במה שמישהו מחכה לו.' },
            { id: 'real_risk', label: 'סיכון אמיתי', value: 'real risk first', effect: 'להעדיף איחורים עם השלכה ממשית.' },
            { id: 'quick_reset', label: 'איפוס מהיר', value: 'quick reset of overdue list', effect: 'להעדיף כמה סגירות קטנות.' },
            { id: 'stale_filter', label: 'לסנן ישן', value: 'filter stale overdue tasks', effect: 'לא להעלות ישן בלי סיבה.' },
            { id: 'not_sure', label: 'לא בטוח', value: 'unknown ranking focus', effect: 'לסמן אי ודאות ולא להמציא.' },
          ],
        }
      : {
          ...commonEn,
          question: 'How should I treat overdue tasks?',
          options: [
            { id: 'hard_commitments', label: 'Hard commitments', value: 'hard commitments first', effect: 'Handle what someone is waiting on first.' },
            { id: 'real_risk', label: 'Real risk', value: 'real risk first', effect: 'Prefer overdue items with real consequences.' },
            { id: 'quick_reset', label: 'Quick reset', value: 'quick reset of overdue list', effect: 'Prefer several small closures.' },
            { id: 'stale_filter', label: 'Filter stale', value: 'filter stale overdue tasks', effect: 'Do not surface old items without a reason.' },
            { id: 'not_sure', label: 'Not sure', value: 'unknown ranking focus', effect: 'Mark uncertainty instead of guessing.' },
          ],
        }
  }

  return lang === 'he'
    ? {
        ...commonHe,
        question: 'מה צריך להוביל את התשובה הזו?',
        options: [
          { id: 'impact', label: 'השפעה אמיתית', value: 'real impact or consequence', effect: 'לדרג לפי השלכה אמיתית.' },
          { id: 'deadline', label: 'דדליין/התחייבות', value: 'deadline or commitment', effect: 'לדרג לפי התחייבויות קרובות.' },
          { id: 'stress', label: 'להוריד לחץ', value: 'reduce stress or open loops', effect: 'להעדיף סגירת עומס פתוח.' },
          { id: 'quick_win', label: 'ניצחון מהיר', value: 'quick win or low friction', effect: 'להעדיף פעולה קטנה שמניעה.' },
          { id: 'not_sure', label: 'לא בטוח', value: 'unknown ranking focus', effect: 'לסמן אי ודאות ולא להמציא.' },
        ],
      }
    : {
        ...commonEn,
        question: 'What should guide this answer?',
        options: [
          { id: 'impact', label: 'Real impact', value: 'real impact or consequence', effect: 'Rank by real-world consequence.' },
          { id: 'deadline', label: 'Deadline/commitment', value: 'deadline or commitment', effect: 'Rank around near commitments.' },
          { id: 'stress', label: 'Reduce stress', value: 'reduce stress or open loops', effect: 'Prefer closing mental load.' },
          { id: 'quick_win', label: 'Quick win', value: 'quick win or low friction', effect: 'Prefer small momentum first.' },
          { id: 'not_sure', label: 'Not sure', value: 'unknown ranking focus', effect: 'Mark uncertainty instead of guessing.' },
        ],
      }
}
