export type ChatQualityMode = 'general' | 'day_plan' | 'week_plan' | 'weekly_review' | 'smart_lanes'

export type ChatQualityLevel = 'bad' | 'acceptable' | 'excellent'

export type ChatQualityAudit = {
  level: ChatQualityLevel
  score: number
  failures: string[]
  warnings: string[]
}

export type ChatQualityInput = {
  text: string
  language: 'he' | 'en'
  mode?: ChatQualityMode
  hasTaskList: boolean
  hasCards: boolean
  taskCount: number
  contextUnknown?: boolean
  hasClarificationEvidence?: boolean
}

const UNSUPPORTED_IMPORTANCE_RE = /(high stakes|strategic|meaningful|important|critical|substantial work|real consequences|חשוב|משמעותי|אסטרטגי|קריטי|השלכות אמיתיות)/i
const GENERIC_FILLER_RE = /(stay on track|make progress|productive week|focus on priorities|based on your tasks|תתקדם|שבוע פרודוקטיבי|להתמקד בסדרי עדיפויות)/i
const SHALLOW_REASON_RE = /(due soon|high priority|medium priority|low priority|overdue|באיחור|עדיפות גבוהה|עדיפות בינונית|עדיפות נמוכה)/i
const STAKE_RE = /(unblock|blocked|risk|waiting|decision|money|billing|client|health|family|dependency|sequence|note|subtask|context unknown|unclear|חוסם|סיכון|מחכה|החלטה|כסף|לקוח|בריאות|משפחה|תלות|רצף|הערה|תת.?משימה|הקשר חסר|לא ברור)/i
const CLARIFICATION_EVIDENCE_RE = /(clarification|your answer|you said|you chose|matches your clarification|explicit user wording|לפי תשובת|תשובת ההבהרה|ענית|בחרת|כתבת)/i

export function auditChatResponseQuality(input: ChatQualityInput): ChatQualityAudit {
  const text = normalizeText(input.text)
  const failures: string[] = []
  const warnings: string[] = []
  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean)
  const bulletLines = lines.filter(line => /^[-*•]|\d+[.)]/.test(line))
  const paragraphCount = lines.filter(line => line.length > 180).length
  const mode = input.mode ?? 'general'
  const isBroadTaskAnswer = input.hasTaskList && ['general', 'day_plan', 'smart_lanes'].includes(mode)

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

  const score = clamp01(1 - failures.length * 0.18 - warnings.length * 0.05)
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
