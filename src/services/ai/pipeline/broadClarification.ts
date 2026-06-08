import type { AIClarificationArtifact, AIClarificationEvent, AIClarificationEVPIScore, AIContextEntityType, AIParameterBelief, AIUncertaintyDimension } from '@/types/aiMemory'
import { collectCardTasks, type CardToolResult } from './cardsBlock'
import type { RoutedIntent } from './intentRouter'
import type { AIMemoryLifecycleSummary } from './memoryLifecycle'
import { computeBroadTaskClarificationCoverage } from './responseClarificationPolicy'

type ChatOutputLanguage = 'en' | 'he'
const BROAD_CLARIFICATION_EVPI_ASK_THRESHOLD = 0.28
const MS_PER_DAY = 24 * 60 * 60 * 1000

const BROAD_PARAMETER_IMPACT: Record<AIUncertaintyDimension, number> = {
  impact: 0.9,
  preferences: 0.78,
  energy_fit: 0.76,
  stakeholders: 0.74,
  dependencies: 0.7,
  history: 0.58,
  project_meaning: 0.66,
  task_context: 0.62,
  stale_context: 0.72,
}

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
  lifecycle?: AIMemoryLifecycleSummary,
): AIClarificationArtifact | null {
  const candidateTaskIds = collectCardTasks(toolResults)
    .map(task => String(task.id || ''))
    .filter(Boolean)
    .slice(0, 12)
  if (!candidateTaskIds.length || hasRecentAskedOnlyClarification(events)) return null
  const coverage = computeBroadTaskClarificationCoverage(routed.responseMode, candidateTaskIds.length, beliefs)

  const staleRefreshCard = buildBroadStaleRefreshClarification(routed, lang, candidateTaskIds, events, coverage, lifecycle)
  if (staleRefreshCard) return staleRefreshCard

  if (coverage.decision !== 'ask') return null

  const memoryKey = broadTaskClarificationMemoryKey(routed)
  const entityId = routed.responseMode || 'general'
  const selection = selectBroadClarificationPrompt(routed.responseMode, lang, events, coverage, memoryKey, entityId)
  if (!selection) return null
  const prompt = selection.prompt

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
      id: `response_quality_${entityId}_${prompt.id}`,
      entityType: 'workflow',
      entityId,
      reason: prompt.reason,
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
      reason: `heuristic EVPI selected a ${selection.evpi.targetedParameters.join(', ')} clarification before ranking ${candidateTaskIds.length} candidates`,
      candidateCount: candidateTaskIds.length,
      evpi: selection.evpi,
    },
  }
}

function buildBroadStaleRefreshClarification(
  routed: RoutedIntent,
  lang: ChatOutputLanguage,
  candidateTaskIds: string[],
  events: AIClarificationEvent[],
  coverage: NonNullable<AIClarificationArtifact['coverage']>,
  lifecycle?: AIMemoryLifecycleSummary,
): AIClarificationArtifact | null {
  const refreshKey = lifecycle?.refreshEntityKeys[0]
  if (!refreshKey) return null
  const entityId = refreshKey.includes(':') ? refreshKey.slice(refreshKey.indexOf(':') + 1) : refreshKey
  const entityType = broadEntityTypeFromKey(refreshKey)
  const questionId = `memory_refresh_${safeQuestionSuffix(refreshKey)}`
  if (recentBroadPromptResolved(events, refreshKey, questionId, questionId)) return null

  const isHebrew = lang === 'he'
  const displayName = broadEntityDisplayName(refreshKey)
  return {
    schemaVersion: 'ai-clarification.v1',
    kind: 'response_quality',
    locale: lang,
    direction: isHebrew ? 'rtl' : 'ltr',
    progressLabel: isHebrew ? 'מרענן הקשר · שלב 1/1' : 'Refreshing context • Step 1/1',
    summary: isHebrew
      ? 'מצאתי הקשר ישן שיכול לשנות את הדירוג, אז אשאל לפני תשובה רחבה.'
      : 'I found old context that could change the ranking, so I should refresh it before a broad answer.',
    memoryKey: refreshKey,
    pathType: 'clarify_first',
    candidateTaskIds,
    actions: ['generate_current', 'show_candidates', 'pause_save'],
    coverage: {
      ...coverage,
      missing: [...new Set([...coverage.missing, 'stale_context' as AIUncertaintyDimension])],
      decision: 'ask',
      materiality: coverage.materiality === 'low' ? 'medium' : coverage.materiality,
    },
    question: {
      id: questionId,
      entityType,
      entityId,
      reason: 'stale_context',
      question: isHebrew
        ? `ההקשר הישן של "${displayName}" עדיין נכון?`
        : `Is the old context for "${displayName}" still true?`,
      options: [
        {
          id: 'still_true',
          label: isHebrew ? 'עדיין נכון' : 'Still true',
          effect: isHebrew ? 'לאשר את ההקשר בלי להמציא חשיבות חדשה.' : 'Confirm the context without inventing new importance.',
          memoryPatch: {
            entityType,
            entityId,
            operation: 'confirm',
            field: 'stale_context',
            value: 'still true',
            confidence: 0.9,
            source: 'button_answer',
          },
        },
        {
          id: 'partly_changed',
          label: isHebrew ? 'השתנה חלקית' : 'Partly changed',
          effect: isHebrew ? 'לשמור שהתשובה צריכה להתייחס לשינוי.' : 'Remember that the answer should account for a change.',
          memoryPatch: {
            entityType,
            entityId,
            operation: 'set',
            field: 'stale_context',
            value: 'partly changed',
            confidence: 0.78,
            source: 'button_answer',
          },
        },
        {
          id: 'no_longer_true',
          label: isHebrew ? 'כבר לא נכון' : 'No longer true',
          effect: isHebrew ? 'לא להשתמש בהקשר הישן כעובדה טרייה.' : 'Do not reuse the old context as fresh truth.',
          memoryPatch: {
            entityType,
            entityId,
            operation: 'reject',
            field: 'stale_context',
            value: 'no longer true',
            confidence: 0.86,
            source: 'button_answer',
          },
        },
        {
          id: 'not_sure',
          label: isHebrew ? 'לא בטוח' : 'Not sure',
          effect: isHebrew ? 'לסמן אי ודאות במקום לנחש.' : 'Mark uncertainty instead of guessing.',
          memoryPatch: {
            entityType,
            entityId,
            operation: 'set',
            field: 'stale_context',
            value: 'not sure',
            confidence: 0.45,
            source: 'button_answer',
          },
        },
      ],
      allowFreeText: true,
      freeTextPatch: { field: 'stale_context', operation: 'set' },
      freeTextPlaceholder: isHebrew ? 'אופציונלי: מה השתנה?' : 'Optional: what changed?',
      relatedTaskIds: candidateTaskIds.slice(0, 5),
    },
    debug: {
      retrieval: {
        source: 'hybrid_sql',
        entityKeyCount: lifecycle?.refreshEntityKeys.length ?? 1,
        eventCount: events.length,
        projectContextCount: 0,
        taskContextCount: 0,
        lifecycle,
      },
      reason: `stale memory refresh selected for ${refreshKey} before ranking ${candidateTaskIds.length} candidates`,
      candidateCount: candidateTaskIds.length,
      evpi: {
        targetedParameters: ['stale_context'],
        heuristicEvpi: 0.734,
        userCost: 0.15,
        selectedScore: 0.584,
        askThreshold: BROAD_CLARIFICATION_EVPI_ASK_THRESHOLD,
        coverageScore: coverage.score,
        candidates: [{
          questionId,
          reason: 'stale_context',
          targetedParameters: ['stale_context'],
          heuristicEvpi: 0.734,
          userCost: 0.15,
          selectedScore: 0.584,
        }],
      },
    },
  }
}

function broadEntityTypeFromKey(entityKey: string): AIContextEntityType {
  if (entityKey.startsWith('task:')) return 'task'
  if (entityKey.startsWith('project:')) return 'project'
  if (entityKey.startsWith('workflow:')) return 'workflow'
  if (entityKey.startsWith('preference:')) return 'preference'
  return 'synthetic_group'
}

function safeQuestionSuffix(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'context'
}

function broadEntityDisplayName(entityKey: string): string {
  const raw = entityKey.includes(':') ? entityKey.slice(entityKey.indexOf(':') + 1) : entityKey
  return raw.replace(/[_-]+/g, ' ')
}

type BroadTaskPromptOption = {
  id: string
  label: string
  value: string
  effect: string
}

type BroadTaskPrompt = {
  id: string
  reason: string
  targetedParameters: AIUncertaintyDimension[]
  question: string
  freeTextPlaceholderHe: string
  freeTextPlaceholderEn: string
  options: BroadTaskPromptOption[]
}

function selectBroadClarificationPrompt(
  responseMode: RoutedIntent['responseMode'],
  lang: ChatOutputLanguage,
  events: AIClarificationEvent[],
  coverage: NonNullable<AIClarificationArtifact['coverage']>,
  memoryKey: string,
  entityId: string,
): { prompt: BroadTaskPrompt; evpi: AIClarificationEVPIScore } | null {
  const prompts = promptsForBroadTaskMode(responseMode, lang)
  const scored = prompts
    .map(prompt => scoreBroadPrompt(prompt, events, coverage, memoryKey, entityId))
    .sort((a, b) => b.selectedScore - a.selectedScore)
  const selected = scored.find(candidate => !candidate.skippedReason && candidate.selectedScore > BROAD_CLARIFICATION_EVPI_ASK_THRESHOLD)
    ?? scored.find(candidate => !candidate.skippedReason)
  if (!selected) return null
  return {
    prompt: selected.prompt,
    evpi: {
      targetedParameters: selected.targetedParameters,
      heuristicEvpi: selected.heuristicEvpi,
      userCost: selected.userCost,
      selectedScore: selected.selectedScore,
      askThreshold: BROAD_CLARIFICATION_EVPI_ASK_THRESHOLD,
      coverageScore: coverage.score,
      candidates: scored.map(candidate => ({
        questionId: `response_quality_${entityId}_${candidate.prompt.id}`,
        reason: candidate.reason,
        targetedParameters: candidate.targetedParameters,
        heuristicEvpi: candidate.heuristicEvpi,
        userCost: candidate.userCost,
        selectedScore: candidate.selectedScore,
        skippedReason: candidate.skippedReason,
      })),
    },
  }
}

function scoreBroadPrompt(
  prompt: BroadTaskPrompt,
  events: AIClarificationEvent[],
  coverage: NonNullable<AIClarificationArtifact['coverage']>,
  memoryKey: string,
  entityId: string,
): {
  prompt: BroadTaskPrompt
  reason: string
  targetedParameters: AIUncertaintyDimension[]
  heuristicEvpi: number
  userCost: number
  selectedScore: number
  skippedReason?: 'recently_resolved' | 'no_targets'
} {
  const targetedParameters = prompt.targetedParameters.filter(parameter => coverage.missing.includes(parameter) || parameter === 'impact' || parameter === 'preferences')
  const skippedReason = recentBroadPromptResolved(events, memoryKey, `response_quality_${entityId}_${prompt.id}`, `response_quality_${entityId}`)
    ? 'recently_resolved'
    : targetedParameters.length === 0
      ? 'no_targets'
      : undefined
  const heuristicEvpi = targetedParameters.reduce((sum, parameter) => {
    const confidence = Number(coverage.dimensions[parameter] ?? 0)
    const uncertainty = parameterUncertainty(confidence)
    const expectedReduction = 0.65 + (0.2 * (1 - confidence))
    return sum + uncertainty * BROAD_PARAMETER_IMPACT[parameter] * expectedReduction * 1.2
  }, 0)
  const userCost = 0.08 + (0.07 * Math.max(1, targetedParameters.length)) + (targetedParameters.length > 1 ? 0.05 : 0)
  const selectedScore = skippedReason ? -1 : heuristicEvpi - userCost
  return {
    prompt,
    reason: prompt.reason,
    targetedParameters,
    heuristicEvpi: Number(heuristicEvpi.toFixed(3)),
    userCost: Number(userCost.toFixed(3)),
    selectedScore: Number(selectedScore.toFixed(3)),
    skippedReason,
  }
}

function recentBroadPromptResolved(events: AIClarificationEvent[], entityKey: string, questionId: string, legacyQuestionId: string): boolean {
  const cutoff = Date.now() - (7 * MS_PER_DAY)
  return events.some(event =>
    event.entityKey === entityKey &&
    (event.questionId === questionId || event.questionId === legacyQuestionId) &&
    ['answered', 'dismissed', 'generated_with_uncertainty', 'showed_candidates'].includes(event.eventType) &&
    event.createdAt &&
    new Date(event.createdAt).getTime() >= cutoff
  )
}

function hasRecentAskedOnlyClarification(events: AIClarificationEvent[], now = Date.now()): boolean {
  return events.some(event => {
    if (event.eventType !== 'asked') return false
    const createdAt = event.createdAt ? Date.parse(event.createdAt) : now
    if (!Number.isFinite(createdAt)) return false
    return (now - createdAt) / MS_PER_DAY < 1
  })
}

function parameterUncertainty(confidence: number): number {
  const bounded = Math.min(1, Math.max(0, confidence))
  let uncertainty = 1 - bounded
  if (bounded < 0.3) uncertainty *= 1.8
  else if (bounded < 0.5) uncertainty *= 1.4
  return Math.min(1, Math.max(0, uncertainty))
}

function promptsForBroadTaskMode(responseMode: RoutedIntent['responseMode'], lang: ChatOutputLanguage): BroadTaskPrompt[] {
  const commonHe = {
    freeTextPlaceholderHe: 'אופציונלי: מה חשוב לך בתשובה הזו?',
    freeTextPlaceholderEn: 'Optional: what matters most in this answer?',
  }
  const commonEn = commonHe

  if (responseMode === 'prioritization') {
    const priorityPrompt = lang === 'he'
      ? {
          ...commonHe,
          id: 'impact',
          reason: 'missing_response_impact',
          targetedParameters: ['impact', 'stakeholders', 'preferences'] as AIUncertaintyDimension[],
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
          id: 'impact',
          reason: 'missing_response_impact',
          targetedParameters: ['impact', 'stakeholders', 'preferences'] as AIUncertaintyDimension[],
          question: 'What should decide the priority order?',
          options: [
            { id: 'impact', label: 'Real consequence', value: 'real impact or consequence', effect: 'Rank by real consequences.' },
            { id: 'commitment', label: 'Commitment', value: 'commitment to another person', effect: 'Prioritize commitments to others.' },
            { id: 'money_health', label: 'Money/health', value: 'money health or client risk', effect: 'Prefer concrete life/work risk.' },
            { id: 'momentum', label: 'Project momentum', value: 'project momentum', effect: 'Prefer work that moves an important project.' },
            { id: 'not_sure', label: 'Not sure', value: 'unknown ranking focus', effect: 'Mark uncertainty instead of guessing.' },
          ],
        }
    const dependencyPrompt = lang === 'he'
      ? {
          ...commonHe,
          id: 'dependencies',
          reason: 'missing_response_dependencies',
          targetedParameters: ['dependencies', 'history'] as AIUncertaintyDimension[],
          question: 'מה קודם חוסם או גורר דברים אחרים?',
          options: [
            { id: 'blocks_others', label: 'חוסם אחרים', value: 'tasks that block other work', effect: 'להעדיף חסימות ותלויות.' },
            { id: 'repeatedly_delayed', label: 'נדחה שוב ושוב', value: 'repeatedly postponed work', effect: 'להעלות עבודה תקועה.' },
            { id: 'needs_sequence', label: 'צריך רצף', value: 'tasks that create sequence momentum', effect: 'לבחור התחלה שמאפשרת המשך.' },
            { id: 'not_sure', label: 'לא בטוח', value: 'unknown dependency focus', effect: 'לסמן אי ודאות ולא להמציא.' },
          ],
        }
      : {
          ...commonEn,
          id: 'dependencies',
          reason: 'missing_response_dependencies',
          targetedParameters: ['dependencies', 'history'] as AIUncertaintyDimension[],
          question: 'What is blocking or dragging other work?',
          options: [
            { id: 'blocks_others', label: 'Blocks others', value: 'tasks that block other work', effect: 'Prioritize blockers and dependencies.' },
            { id: 'repeatedly_delayed', label: 'Repeatedly delayed', value: 'repeatedly postponed work', effect: 'Surface stuck work.' },
            { id: 'needs_sequence', label: 'Needs sequence', value: 'tasks that create sequence momentum', effect: 'Pick a start that unlocks follow-up.' },
            { id: 'not_sure', label: 'Not sure', value: 'unknown dependency focus', effect: 'Mark uncertainty instead of guessing.' },
          ],
        }
    return [priorityPrompt, dependencyPrompt]
  }

  if (responseMode === 'next_task') {
    const energyPrompt = lang === 'he'
      ? {
          ...commonHe,
          id: 'energy',
          reason: 'missing_response_energy',
          targetedParameters: ['energy_fit', 'preferences'] as AIUncertaintyDimension[],
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
          id: 'energy',
          reason: 'missing_response_energy',
          targetedParameters: ['energy_fit', 'preferences'] as AIUncertaintyDimension[],
          question: 'What would make one task right for now?',
          options: [
            { id: 'energy', label: 'Energy fit', value: 'energy fit right now', effect: 'Choose a task that fits your current state.' },
            { id: 'impact', label: 'Most meaningful', value: 'highest real impact', effect: 'Prefer meaningful outcome.' },
            { id: 'deadline', label: 'Most urgent', value: 'nearest hard deadline', effect: 'Prefer a hard deadline.' },
            { id: 'quick_win', label: 'Easy start', value: 'quick win or low friction', effect: 'Prefer a small momentum step.' },
            { id: 'not_sure', label: 'Not sure', value: 'unknown ranking focus', effect: 'Mark uncertainty instead of guessing.' },
          ],
        }
    const impactPrompt = lang === 'he'
      ? {
          ...commonHe,
          id: 'impact',
          reason: 'missing_response_impact',
          targetedParameters: ['impact', 'stakeholders'] as AIUncertaintyDimension[],
          question: 'איזו השלכה אמיתית הכי חשוב לסגור עכשיו?',
          options: [
            { id: 'commitment', label: 'מישהו מחכה', value: 'someone is waiting', effect: 'להעדיף התחייבות לאחר.' },
            { id: 'money_health', label: 'כסף/בריאות', value: 'money health or client risk', effect: 'להעדיף סיכון מוחשי.' },
            { id: 'project_momentum', label: 'מומנטום', value: 'project momentum', effect: 'להעדיף תנועה בפרויקט.' },
            { id: 'not_sure', label: 'לא בטוח', value: 'unknown impact focus', effect: 'לסמן אי ודאות ולא להמציא.' },
          ],
        }
      : {
          ...commonEn,
          id: 'impact',
          reason: 'missing_response_impact',
          targetedParameters: ['impact', 'stakeholders'] as AIUncertaintyDimension[],
          question: 'What real consequence matters most right now?',
          options: [
            { id: 'commitment', label: 'Someone waits', value: 'someone is waiting', effect: 'Prefer a commitment to another person.' },
            { id: 'money_health', label: 'Money/health', value: 'money health or client risk', effect: 'Prefer concrete risk.' },
            { id: 'project_momentum', label: 'Momentum', value: 'project momentum', effect: 'Prefer project movement.' },
            { id: 'not_sure', label: 'Not sure', value: 'unknown impact focus', effect: 'Mark uncertainty instead of guessing.' },
          ],
        }
    return [energyPrompt, impactPrompt]
  }

  if (responseMode === 'overdue_triage') {
    return [lang === 'he'
      ? {
          ...commonHe,
          id: 'overdue_commitments',
          reason: 'missing_response_impact',
          targetedParameters: ['impact', 'stakeholders', 'history'] as AIUncertaintyDimension[],
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
          id: 'overdue_commitments',
          reason: 'missing_response_impact',
          targetedParameters: ['impact', 'stakeholders', 'history'] as AIUncertaintyDimension[],
          question: 'How should I treat overdue tasks?',
          options: [
            { id: 'hard_commitments', label: 'Hard commitments', value: 'hard commitments first', effect: 'Handle what someone is waiting on first.' },
            { id: 'real_risk', label: 'Real risk', value: 'real risk first', effect: 'Prefer overdue items with real consequences.' },
            { id: 'quick_reset', label: 'Quick reset', value: 'quick reset of overdue list', effect: 'Prefer several small closures.' },
            { id: 'stale_filter', label: 'Filter stale', value: 'filter stale overdue tasks', effect: 'Do not surface old items without a reason.' },
            { id: 'not_sure', label: 'Not sure', value: 'unknown ranking focus', effect: 'Mark uncertainty instead of guessing.' },
          ],
        }]
  }

  const defaultPrompt = lang === 'he'
    ? {
        ...commonHe,
        id: 'general_focus',
        reason: 'missing_response_direction',
        targetedParameters: ['preferences', 'impact'] as AIUncertaintyDimension[],
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
        id: 'general_focus',
        reason: 'missing_response_direction',
        targetedParameters: ['preferences', 'impact'] as AIUncertaintyDimension[],
        question: 'What should guide this answer?',
        options: [
          { id: 'impact', label: 'Real impact', value: 'real impact or consequence', effect: 'Rank by real-world consequence.' },
          { id: 'deadline', label: 'Deadline/commitment', value: 'deadline or commitment', effect: 'Rank around near commitments.' },
          { id: 'stress', label: 'Reduce stress', value: 'reduce stress or open loops', effect: 'Prefer closing mental load.' },
          { id: 'quick_win', label: 'Quick win', value: 'quick win or low friction', effect: 'Prefer small momentum first.' },
          { id: 'not_sure', label: 'Not sure', value: 'unknown ranking focus', effect: 'Mark uncertainty instead of guessing.' },
        ],
      }
  const energyPrompt = lang === 'he'
    ? {
        ...commonHe,
        id: 'energy',
        reason: 'missing_response_energy',
        targetedParameters: ['energy_fit'] as AIUncertaintyDimension[],
        question: 'איזה סוג אנרגיה יש לך עכשיו?',
        options: [
          { id: 'deep', label: 'עבודה עמוקה', value: 'deep work energy', effect: 'להעדיף עבודה קוגניטיבית.' },
          { id: 'admin', label: 'אדמין קל', value: 'admin or low energy', effect: 'להעדיף משימות קלות.' },
          { id: 'quick', label: 'רק התחלה', value: 'quick start only', effect: 'להעדיף צעד פתיחה קטן.' },
          { id: 'not_sure', label: 'לא בטוח', value: 'unknown energy', effect: 'לסמן אי ודאות.' },
        ],
      }
    : {
        ...commonEn,
        id: 'energy',
        reason: 'missing_response_energy',
        targetedParameters: ['energy_fit'] as AIUncertaintyDimension[],
        question: 'What kind of energy do you have right now?',
        options: [
          { id: 'deep', label: 'Deep work', value: 'deep work energy', effect: 'Prefer cognitive work.' },
          { id: 'admin', label: 'Light admin', value: 'admin or low energy', effect: 'Prefer light tasks.' },
          { id: 'quick', label: 'Just start', value: 'quick start only', effect: 'Prefer a small opening step.' },
          { id: 'not_sure', label: 'Not sure', value: 'unknown energy', effect: 'Mark uncertainty.' },
        ],
      }
  return [defaultPrompt, energyPrompt]
}
