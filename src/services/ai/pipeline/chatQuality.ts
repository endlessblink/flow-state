export type ChatQualityMode = 'general' | 'day_plan' | 'week_plan' | 'weekly_review' | 'smart_lanes'

export type ChatQualityLevel = 'bad' | 'acceptable' | 'excellent'

export type ChatQualityPath =
  | 'direct_answer'
  | 'clarification_first'
  | 'structured_model'
  | 'deterministic_fallback'
  | 'proceed_with_uncertainty'
  | 'feedback_updated'

export type ChatQualityAudit = {
  level: ChatQualityLevel
  score: number
  failures: string[]
  warnings: string[]
  checks: {
    groundedness: number
    scannability: number
    uncertainty: number
    userControl: number
    learning: number
    safety: number
  }
}

export type ChatQualityInput = {
  text: string
  language: 'he' | 'en'
  mode?: ChatQualityMode
  hasTaskList: boolean
  hasCards: boolean
  taskCount: number
  recommendationCount?: number
  contextUnknown?: boolean
  hasClarificationEvidence?: boolean
  responsePath?: ChatQualityPath
  coverageScore?: number
  highMateriality?: boolean
  structuredOutputFailed?: boolean
  fallbackAfterClarification?: boolean
  repeatedQuestionRecently?: boolean
  hasVisibleUncertainty?: boolean
  hasFeedbackControls?: boolean
  hasEscapeHatch?: boolean
  hasDebugDisclosure?: boolean
  hasLearningSignal?: boolean
  coldStart?: boolean
}

const UNSUPPORTED_IMPORTANCE_RE = /(high stakes|strategic|meaningful|important|critical|substantial work|real consequences|חשוב|משמעותי|אסטרטגי|קריטי|השלכות אמיתיות)/i
const GENERIC_FILLER_RE = /(stay on track|make progress|productive week|focus on priorities|based on your tasks|תתקדם|שבוע פרודוקטיבי|להתמקד בסדרי עדיפויות)/i
const SHALLOW_REASON_RE = /(due soon|high priority|medium priority|low priority|overdue|באיחור|עדיפות גבוהה|עדיפות בינונית|עדיפות נמוכה)/i
const STAKE_RE = /(unblock|blocked|risk|waiting|decision|money|billing|client|health|family|dependency|sequence|note|subtask|context unknown|unclear|חוסם|סיכון|מחכה|החלטה|כסף|לקוח|בריאות|משפחה|תלות|רצף|הערה|תת.?משימה|הקשר חסר|לא ברור)/i
const CLARIFICATION_EVIDENCE_RE = /(clarification|your answer|you said|you chose|matches your clarification|explicit user wording|לפי תשובת|תשובת ההבהרה|ענית|בחרת|כתבת)/i
const UNCERTAINTY_RE = /(coverage|uncertain|uncertainty|context (is )?unknown|missing context|limited context|assum|not enough context|הקשר חסר|לא ברור|לא ידוע|אי.?ודאות|הקשר מוגבל)/i
const CLARIFICATION_QUESTION_RE = /(quick question|before ranking|before I rank|what kind of project|why does this matter|שאלה קצרה|לפני הדירוג|איזה סוג פרויקט|למה זה חשוב)/i

export function auditChatResponseQuality(input: ChatQualityInput): ChatQualityAudit {
  const text = normalizeText(input.text)
  const failures: string[] = []
  const warnings: string[] = []
  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean)
  const bulletLines = lines.filter(line => /^[-*•]|\d+[.)]/.test(line))
  const paragraphCount = lines.filter(line => line.length > 180).length
  const mode = input.mode ?? 'general'
  const isBroadTaskAnswer = input.hasTaskList && ['general', 'day_plan', 'smart_lanes'].includes(mode)
  const path = input.responsePath ?? 'direct_answer'
  const recommendationCount = input.recommendationCount ?? input.taskCount
  const visibleUncertainty = input.hasVisibleUncertainty ?? UNCERTAINTY_RE.test(text)
  const lowCoverage = typeof input.coverageScore === 'number' && input.coverageScore < 0.5
  const mediumCoverage = typeof input.coverageScore === 'number' && input.coverageScore >= 0.5 && input.coverageScore < 0.72

  if (!text) failures.push('empty_response')
  if (input.hasTaskList && !input.hasCards && input.taskCount > 0) failures.push('missing_task_cards')
  if (text.length > (input.hasCards ? 1200 : 850)) failures.push('too_verbose')
  else if (text.length > (input.hasCards ? 850 : 600)) warnings.push('verbose')
  if (paragraphCount > 1) failures.push('wall_of_text')
  if (bulletLines.length > 6) failures.push('too_many_visible_items')
  else if (bulletLines.length > 4) warnings.push('many_visible_items')
  if (GENERIC_FILLER_RE.test(text)) failures.push('generic_filler')
  if (input.contextUnknown && UNSUPPORTED_IMPORTANCE_RE.test(text) && !/context unknown|unclear|missing context|הקשר חסר|לא ברור/i.test(text)) {
    failures.push('unsupported_importance_language')
  }
  if (input.hasClarificationEvidence && isBroadTaskAnswer && !CLARIFICATION_EVIDENCE_RE.test(text)) {
    failures.push('missing_clarification_evidence')
  }
  if (isBroadTaskAnswer && SHALLOW_REASON_RE.test(text) && !STAKE_RE.test(text)) {
    failures.push('metadata_only_reasoning')
  }
  if (hasRepeatedLineShape(lines)) failures.push('repeated_template_structure')
  if (input.structuredOutputFailed && path !== 'deterministic_fallback') {
    failures.push('missing_deterministic_fallback_after_structured_failure')
  }
  if (input.fallbackAfterClarification && CLARIFICATION_QUESTION_RE.test(text)) {
    failures.push('repeated_question_after_clarification')
  }
  if (path === 'clarification_first' && input.repeatedQuestionRecently) {
    failures.push('repeated_clarification_question')
  }
  if (lowCoverage && input.highMateriality && path !== 'clarification_first' && path !== 'proceed_with_uncertainty') {
    failures.push('missing_high_evpi_clarification')
  }
  if ((input.contextUnknown || lowCoverage || mediumCoverage || path === 'deterministic_fallback') && !visibleUncertainty) {
    failures.push('missing_visible_uncertainty')
  }
  if (isBroadTaskAnswer && input.hasCards && input.taskCount > 0 && input.hasFeedbackControls === false) {
    failures.push('missing_feedback_controls')
  }
  if ((path === 'clarification_first' || path === 'proceed_with_uncertainty' || input.coldStart) && input.hasEscapeHatch === false) {
    failures.push('missing_escape_hatch')
  }
  if ((path === 'deterministic_fallback' || path === 'clarification_first' || input.structuredOutputFailed) && input.hasDebugDisclosure === false) {
    warnings.push('missing_debug_disclosure')
  }
  if ((path === 'feedback_updated' || input.hasFeedbackControls) && input.hasLearningSignal === false) {
    warnings.push('feedback_not_recorded_as_learning_signal')
  }
  if ((path === 'deterministic_fallback' || input.contextUnknown || mediumCoverage) && recommendationCount > 3) {
    failures.push('too_many_low_context_recommendations')
  }

  const checks: ChatQualityAudit['checks'] = {
    groundedness: input.contextUnknown && UNSUPPORTED_IMPORTANCE_RE.test(text) && !visibleUncertainty
      ? 0.2
      : input.hasCards || STAKE_RE.test(text) || visibleUncertainty
        ? 1
        : 0.65,
    scannability: text.length <= (input.hasCards ? 850 : 600) && bulletLines.length <= 4 && paragraphCount <= 1
      ? 1
      : text.length <= (input.hasCards ? 1200 : 850) && bulletLines.length <= 6
        ? 0.65
        : 0.25,
    uncertainty: (input.contextUnknown || lowCoverage || mediumCoverage || path === 'deterministic_fallback') && !visibleUncertainty
      ? 0.25
      : 1,
    userControl: input.hasTaskList
      ? (input.hasFeedbackControls || input.hasEscapeHatch || path === 'clarification_first' ? 1 : 0.45)
      : 0.8,
    learning: input.hasLearningSignal || input.hasClarificationEvidence || path === 'clarification_first' ? 1 : 0.65,
    safety: failures.some(failure => [
      'unsupported_importance_language',
      'repeated_clarification_question',
      'missing_high_evpi_clarification',
    ].includes(failure)) ? 0.2 : 1,
  }
  const averageCheckScore = Object.values(checks).reduce((sum, value) => sum + value, 0) / Object.values(checks).length
  const score = clamp01(averageCheckScore - failures.length * 0.16 - warnings.length * 0.04)
  const level: ChatQualityLevel = failures.length > 0 || score < 0.6
    ? 'bad'
    : score >= 0.82
      ? 'excellent'
      : 'acceptable'

  return {
    level,
    score: Number(score.toFixed(2)),
    failures: [...new Set(failures)],
    warnings: [...new Set(warnings)],
    checks,
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function hasRepeatedLineShape(lines: string[]): boolean {
  const candidateLines = lines.filter(line => line.length > 30)
  if (candidateLines.length < 3) return false
  const openings = candidateLines.map(line => line.split(/\s+/).slice(0, 4).join(' ').toLowerCase())
  return new Set(openings).size < Math.ceil(openings.length * 0.75)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
