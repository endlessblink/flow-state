import type { Task } from '@/types/tasks'

export type PlannerLocale = 'en' | 'he'
export type PlannerDirection = 'ltr' | 'rtl'

export type PlannerTaskSnapshot = {
  id: string
  version: number
  title: string
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'dismissed'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueIso?: string | null
  project?: {
    id: string
    name: string
    status?: string
  }
  notes?: string
  tags?: string[]
  estimateMinutes?: number | null
  dependencies?: {
    blocksTaskIds: string[]
    blockedByTaskIds: string[]
  }
  history: {
    createdIso: string
    updatedIso: string
    completedCount?: number
    postponedCount: number
    lastPostponedIso?: string | null
    timerMinutesLast7Days: number
    timerMinutesLast30Days: number
    statusChangesLast14Days: Array<{
      from: string
      to: string
      atIso: string
    }>
  }
  derived: {
    daysUntilDue?: number | null
    isOverdue: boolean
    isStale: boolean
    hasHumanOrExternalStakeholder: boolean
    hasMoneyClientHealthFamilyLegalSignal: boolean
    evidenceSnippets: Array<{
      field: 'title' | 'notes' | 'project' | 'history' | 'dependency'
      text: string
    }>
  }
}

export type WeekContext = {
  requestId: string
  nowIso: string
  locale: PlannerLocale
  direction: PlannerDirection
  weekStartIso: string
  weekEndIso: string
  workload: {
    openTaskCount: number
    estimatedMinutesKnown: number
    estimatedMinutesUnknownCount: number
    completedLast7Days: number
    postponedLast14Days: number
    activeTimersLast7Days: number
  }
  tasks: PlannerTaskSnapshot[]
}

export type WeeklyPlanRecommendation = {
  sectionId: string
  rank: number
  primaryTaskId: string
  relatedTaskIds: string[]
  recommendationType: 'protect' | 'unblock' | 'finish' | 'reduce-risk' | 'quick-win' | 'defer' | 'clarify'
  title: string
  whyThisMatters: string
  whyThisWeek: string
  riskIfIgnored: string
  nextAction: string
  suggestedPlan?: {
    dayLabel?: string
    timeBlockLabel?: string
    durationMinutes?: number
    energy: 'low' | 'medium' | 'high'
  }
  evidence: Array<{
    taskId: string
    field:
      | 'title'
      | 'notes'
      | 'project'
      | 'dueIso'
      | 'priority'
      | 'status'
      | 'history.postponedCount'
      | 'history.timerMinutesLast7Days'
      | 'dependencies.blocksTaskIds'
      | 'dependencies.blockedByTaskIds'
    value: string
    interpretation: string
  }>
  cardPlacement: 'immediately_after_explanation'
}

export type WeeklyPlanOutput = {
  schemaVersion: 'weekly-plan.v2'
  requestId: string
  locale: PlannerLocale
  direction: PlannerDirection
  headline: string
  weekRead: {
    summary: string
    workloadReality: string
    mainTradeoff: string
  }
  recommendations: WeeklyPlanRecommendation[]
  deferrals: Array<{
    taskId: string
    reason: string
    revisitIso?: string | null
  }>
  openQuestions: Array<{
    question: string
    relatedTaskIds: string[]
  }>
  quality: {
    selectedTaskCount: number
    confidence: 'low' | 'medium' | 'high'
    caveats: string[]
  }
  source?: 'model' | 'quick_draft'
}

type TaskSignals = {
  urgency: number
  impact: number
  dependency: number
  avoidanceRisk: number
  workloadFit: number
  contextRichness: number
}

type ToolResultLike = {
  success: boolean
  data?: unknown
}

const MS_PER_DAY = 86_400_000
const MONEY_CLIENT_HEALTH_FAMILY_LEGAL_RE = /(payment|invoice|charge|billing|refund|client|customer|health|doctor|medicine|family|dad|mom|legal|tax|תשלום|חשבונית|חיוב|לקוח|בריאות|רופא|תרופה|משפחה|אבא|אמא|מס|משפט)/i
const STAKEHOLDER_RE = /(send|reply|call|email|message|meeting|proposal|review|approve|client|customer|stakeholder|amit|לשלוח|להגיב|להתקשר|מייל|הודעה|פגישה|לקוח|לאשר|בדיקה)/i

export function buildWeekContextFromToolResults(
  toolResults: ToolResultLike[],
  allTasks: Task[],
  locale: PlannerLocale,
  now = new Date(),
): WeekContext {
  const snapshots = selectCandidatePool(extractPlannerTasks(toolResults, allTasks, now))
  const weekStart = startOfWeek(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const openTasks = allTasks.filter(task => task.status !== 'done' && !task._soft_deleted)
  const completedLast7Days = allTasks.filter(task => {
    const completedAt = task.completedAt ? new Date(task.completedAt).getTime() : 0
    return completedAt > 0 && now.getTime() - completedAt <= 7 * MS_PER_DAY
  }).length

  return {
    requestId: `week_${now.getTime()}`,
    nowIso: now.toISOString(),
    locale,
    direction: locale === 'he' ? 'rtl' : 'ltr',
    weekStartIso: toDateKey(weekStart),
    weekEndIso: toDateKey(weekEnd),
    workload: {
      openTaskCount: openTasks.length,
      estimatedMinutesKnown: openTasks.reduce((sum, task) => sum + (Number(task.estimatedDuration) || 0), 0),
      estimatedMinutesUnknownCount: openTasks.filter(task => !task.estimatedDuration).length,
      completedLast7Days,
      postponedLast14Days: 0,
      activeTimersLast7Days: 0,
    },
    tasks: snapshots,
  }
}

export function buildWeeklyPlanPrompt(context: WeekContext): string {
  return JSON.stringify({
    instruction: 'Return only valid JSON matching schema weekly-plan.v2. Do not output markdown. Do not describe task cards. The UI renders cards from task IDs.',
    schemaRules: {
      recommendations: '3-7 items',
      taskIds: 'Every primaryTaskId and relatedTaskIds item must be from candidateTasks.',
      evidence: 'At least two evidence items per recommendation. At least one must not be dueIso or priority.',
      reasoning: 'Explain real consequence beyond due date/priority. Avoid repeated templates.',
      locale: context.locale,
      direction: context.direction,
    },
    avoid: [
      'This task is due soon, so do it.',
      'High priority means high impact.',
      'Schedule a focused block.',
      'why now / impact / slot template',
      'invented personal facts',
    ],
    weekContext: {
      requestId: context.requestId,
      nowIso: context.nowIso,
      weekStartIso: context.weekStartIso,
      weekEndIso: context.weekEndIso,
      locale: context.locale,
      direction: context.direction,
      workload: context.workload,
    },
    candidateTasks: context.tasks,
  }, null, 2)
}

export function parseWeeklyPlanOutput(raw: string, context: WeekContext): { ok: true; value: WeeklyPlanOutput } | { ok: false; errors: string[] } {
  const jsonText = extractJsonObject(raw)
  if (!jsonText) return { ok: false, errors: ['missing_json_object'] }
  let value: unknown
  try {
    value = JSON.parse(jsonText)
  } catch {
    return { ok: false, errors: ['invalid_json'] }
  }
  const errors = validateWeeklyPlanOutput(value, context)
  if (errors.length) return { ok: false, errors }
  return { ok: true, value: { ...(value as WeeklyPlanOutput), source: 'model' } }
}

export function validateWeeklyPlanOutput(value: unknown, context: WeekContext): string[] {
  const errors: string[] = []
  if (!value || typeof value !== 'object') return ['not_object']
  const plan = value as WeeklyPlanOutput
  const validTaskIds = new Set(context.tasks.map(task => task.id))
  if (plan.schemaVersion !== 'weekly-plan.v2') errors.push('wrong_schema_version')
  if (plan.requestId !== context.requestId) errors.push('wrong_request_id')
  if (plan.locale !== context.locale) errors.push('wrong_locale')
  if (plan.direction !== context.direction) errors.push('wrong_direction')
  if (!Array.isArray(plan.recommendations)) errors.push('missing_recommendations')
  const recs = Array.isArray(plan.recommendations) ? plan.recommendations : []
  if (recs.length < 3 || recs.length > 7) errors.push('recommendation_count_out_of_range')

  for (const rec of recs) {
    if (!rec.sectionId) errors.push('missing_section_id')
    if (!validTaskIds.has(rec.primaryTaskId)) errors.push(`invalid_primary_task_id:${rec.primaryTaskId}`)
    if (rec.cardPlacement !== 'immediately_after_explanation') errors.push(`bad_card_placement:${rec.sectionId}`)
    if (looksGeneric(`${rec.whyThisMatters} ${rec.whyThisWeek} ${rec.nextAction}`)) errors.push(`generic_reasoning:${rec.sectionId}`)
    if (!Array.isArray(rec.evidence) || rec.evidence.length < 2) errors.push(`too_little_evidence:${rec.sectionId}`)
    const evidence = Array.isArray(rec.evidence) ? rec.evidence : []
    if (!evidence.some(item => !['dueIso', 'priority'].includes(item.field))) errors.push(`date_priority_only_reasoning:${rec.sectionId}`)
    for (const item of evidence) {
      if (!validTaskIds.has(item.taskId)) errors.push(`invalid_evidence_task_id:${item.taskId}`)
    }
    for (const id of rec.relatedTaskIds ?? []) {
      if (!validTaskIds.has(id)) errors.push(`invalid_related_task_id:${id}`)
    }
  }
  if (hasRepeatedTemplateShape(recs)) errors.push('repeated_template_structure')
  if (overusesDueDates(recs)) errors.push('due_date_overuse')
  return [...new Set(errors)]
}

export function buildQuickDraftWeeklyPlan(context: WeekContext): WeeklyPlanOutput {
  const selected = context.tasks.slice(0, Math.min(5, Math.max(3, context.tasks.length)))
  const locale = context.locale
  const recommendations = selected.map((task, index): WeeklyPlanRecommendation => {
    const evidence = quickDraftEvidence(task)
    return {
      sectionId: `quick_${index + 1}_${task.id}`,
      rank: index + 1,
      primaryTaskId: task.id,
      relatedTaskIds: [],
      recommendationType: quickDraftType(task),
      title: task.title,
      whyThisMatters: locale === 'he'
        ? 'טיוטה עובדתית בלבד: ההסבר האימוני לא זמין כרגע, אז אני מציג את האותות החזקים מהמשימה.'
        : 'Factual quick draft only: coaching explanation is unavailable, so this shows the strongest task signals.',
      whyThisWeek: evidence.map(item => item.interpretation).join(locale === 'he' ? ' · ' : ' · '),
      riskIfIgnored: locale === 'he'
        ? 'צריך לרענן את התוכנית כדי לקבל ניתוח עומק לפני החלטה סופית.'
        : 'Refresh the plan for deeper analysis before treating this as final.',
      nextAction: locale === 'he'
        ? 'פתח את הכרטיס, בדוק את ההקשר, ובחר פעולה אחת קטנה.'
        : 'Open the card, check the context, and choose one small next action.',
      evidence,
      cardPlacement: 'immediately_after_explanation',
    }
  })

  return {
    schemaVersion: 'weekly-plan.v2',
    requestId: context.requestId,
    locale,
    direction: context.direction,
    headline: locale === 'he' ? 'טיוטה מהירה לפי נתוני המשימות' : 'Quick draft from task data',
    weekRead: {
      summary: locale === 'he'
        ? `נבדקו ${context.tasks.length} מועמדים מתוך ${context.workload.openTaskCount} משימות פתוחות.`
        : `Reviewed ${context.tasks.length} candidates from ${context.workload.openTaskCount} open tasks.`,
      workloadReality: locale === 'he'
        ? 'זה לא תחליף לתשובת מודל מלאה; זו שכבת ראיות כדי שלא תחכה מול מסך ריק.'
        : 'This is not a replacement for the full model answer; it is evidence-only so you are not left waiting.',
      mainTradeoff: locale === 'he'
        ? 'להעדיף אותות ברורים כמו דחייה, תלות, כסף/לקוח/בריאות, ותאריך קרוב.'
        : 'Prefer clear signals such as postponement, dependencies, money/client/health, and near dates.',
    },
    recommendations,
    deferrals: [],
    openQuestions: [],
    quality: {
      selectedTaskCount: recommendations.length,
      confidence: 'low',
      caveats: [locale === 'he' ? 'המודל לא החזיר תוכנית תקינה בזמן.' : 'The model did not return a valid plan in time.'],
    },
    source: 'quick_draft',
  }
}

function extractPlannerTasks(toolResults: ToolResultLike[], allTasks: Task[], now: Date): PlannerTaskSnapshot[] {
  const taskMap = new Map(allTasks.map(task => [task.id, task]))
  const candidateRecords = new Map<string, Record<string, unknown>>()
  for (const result of toolResults) {
    if (!result.success) continue
    for (const item of collectTaskRecords(result.data)) {
      const id = typeof item.id === 'string' ? item.id : ''
      if (id) candidateRecords.set(id, item)
    }
  }
  const source = candidateRecords.size
    ? [...candidateRecords.entries()].map(([id, record]) => ({ task: taskMap.get(id), record }))
    : allTasks.map(task => ({ task, record: task as unknown as Record<string, unknown> }))

  return source
    .map(({ task, record }) => toPlannerTaskSnapshot(task, record, now, allTasks))
    .filter((snapshot): snapshot is PlannerTaskSnapshot => Boolean(snapshot && snapshot.status !== 'done' && snapshot.status !== 'dismissed'))
}

function collectTaskRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord)
  if (!isRecord(data)) return []
  const out: Record<string, unknown>[] = []
  for (const key of ['tasks', 'dueTodayTasks', 'overdueTasks', 'unscheduled']) {
    const value = data[key]
    if (Array.isArray(value)) out.push(...value.filter(isRecord))
  }
  return out
}

function toPlannerTaskSnapshot(task: Task | undefined, record: Record<string, unknown>, now: Date, allTasks: Task[]): PlannerTaskSnapshot | null {
  const id = task?.id ?? String(record.id || '')
  const title = task?.title ?? String(record.title || '')
  if (!id || !title) return null
  const dueIso = normalizeDate(task?.dueDate ?? record.dueDate)
  const status = normalizeStatus(task?.status ?? record.status)
  const notes = String(task?.description ?? record.description ?? record.notes ?? '').trim()
  const projectId = task?.projectId || String(record.projectId || '')
  const projectName = String(record.project || record.projectName || projectId || '').trim()
  const blocksTaskIds = allTasks.filter(other => (other.dependsOn ?? []).includes(id)).map(other => other.id)
  const blockedByTaskIds = task?.dependsOn ?? []
  const text = `${title} ${notes} ${projectName}`
  const updatedIso = toIso(task?.updatedAt) || String(record.updatedAt || now.toISOString())
  const createdIso = toIso(task?.createdAt) || String(record.createdAt || updatedIso)
  const timerMinutes = Number(record.timerMinutesLast7Days || record.timerMinutesLast30Days || (task?.completedPomodoros ?? 0) * 25 || 0)
  const postponedCount = Number(record.postponedCount || (task?.doneForNowUntil ? 1 : 0) || 0)
  const daysUntilDue = dueIso ? Math.ceil((new Date(`${dueIso}T00:00:00`).getTime() - startOfDay(now).getTime()) / MS_PER_DAY) : null
  const evidenceSnippets = buildEvidenceSnippets({ title, notes, projectName, postponedCount, blocksTaskIds, blockedByTaskIds, timerMinutes })

  return {
    id,
    version: new Date(updatedIso).getTime() || 0,
    title,
    status,
    priority: normalizePriority(task?.priority ?? record.priority),
    dueIso,
    project: projectId || projectName ? { id: projectId || projectName, name: projectName || projectId } : undefined,
    notes: notes || undefined,
    tags: task?.tags ?? (Array.isArray(record.tags) ? record.tags.map(String) : undefined),
    estimateMinutes: Number(task?.estimatedDuration ?? record.estimatedDuration) || null,
    dependencies: { blocksTaskIds, blockedByTaskIds },
    history: {
      createdIso,
      updatedIso,
      completedCount: task?.completedPomodoros,
      postponedCount,
      lastPostponedIso: task?.doneForNowUntil ?? null,
      timerMinutesLast7Days: timerMinutes,
      timerMinutesLast30Days: Number(record.timerMinutesLast30Days || timerMinutes),
      statusChangesLast14Days: [],
    },
    derived: {
      daysUntilDue,
      isOverdue: typeof daysUntilDue === 'number' && daysUntilDue < 0,
      isStale: now.getTime() - new Date(updatedIso).getTime() > 14 * MS_PER_DAY,
      hasHumanOrExternalStakeholder: STAKEHOLDER_RE.test(text),
      hasMoneyClientHealthFamilyLegalSignal: MONEY_CLIENT_HEALTH_FAMILY_LEGAL_RE.test(text),
      evidenceSnippets,
    },
  }
}

function selectCandidatePool(tasks: PlannerTaskSnapshot[]): PlannerTaskSnapshot[] {
  const scored = tasks
    .filter(task => !['done', 'dismissed'].includes(task.status))
    .map(task => ({ task, signals: scoreTask(task) }))
    .map(item => ({ ...item, score: planningScore(item.signals) }))
    .sort((a, b) => b.score - a.score)
  const mustInclude = scored.filter(item =>
    item.task.derived.isOverdue ||
    item.signals.dependency > 0.6 ||
    item.task.history.postponedCount >= 3,
  )
  const selected: typeof scored = []
  const projectCounts = new Map<string, number>()
  for (const item of [...mustInclude, ...scored]) {
    if (selected.some(existing => existing.task.id === item.task.id)) continue
    const projectId = item.task.project?.id ?? 'none'
    const count = projectCounts.get(projectId) ?? 0
    if (count >= 3 && selected.length >= 8) continue
    selected.push(item)
    projectCounts.set(projectId, count + 1)
    if (selected.length >= 16) break
  }
  return selected.map(item => item.task)
}

function scoreTask(task: PlannerTaskSnapshot): TaskSignals {
  const days = task.derived.daysUntilDue
  const dueSoon = days == null ? 0 : days < 0 ? 1 : days <= 2 ? 0.9 : days <= 7 ? 0.55 : 0.15
  const urgency = Math.max(dueSoon, task.priority === 'urgent' ? 0.85 : 0, task.status === 'blocked' ? 0.55 : 0)
  const impact = Math.min(1,
    0.25 * Number(task.priority === 'high' || task.priority === 'urgent') +
    0.25 * Number(task.derived.hasHumanOrExternalStakeholder) +
    0.25 * Number(task.derived.hasMoneyClientHealthFamilyLegalSignal) +
    0.15 * Number(Boolean(task.project?.name)) +
    0.10 * Math.min(task.history.timerMinutesLast30Days / 180, 1),
  )
  const dependency = Math.min(1, 0.25 * (task.dependencies?.blocksTaskIds.length ?? 0))
  const avoidanceRisk = Math.min(1,
    0.18 * task.history.postponedCount +
    0.25 * Number(task.derived.isStale) +
    0.2 * Number(task.status === 'in_progress'),
  )
  const workloadFit = task.estimateMinutes == null ? 0.45 : task.estimateMinutes <= 30 ? 0.9 : task.estimateMinutes <= 90 ? 0.75 : task.estimateMinutes <= 180 ? 0.45 : 0.2
  const contextRichness = Math.min(1, task.derived.evidenceSnippets.length / 4)
  return { urgency, impact, dependency, avoidanceRisk, workloadFit, contextRichness }
}

function planningScore(signals: TaskSignals): number {
  return 0.24 * signals.urgency + 0.28 * signals.impact + 0.18 * signals.dependency + 0.16 * signals.avoidanceRisk + 0.08 * signals.workloadFit + 0.06 * signals.contextRichness
}

function quickDraftEvidence(task: PlannerTaskSnapshot): WeeklyPlanRecommendation['evidence'] {
  const evidence: WeeklyPlanRecommendation['evidence'] = []
  if (task.notes) evidence.push({ taskId: task.id, field: 'notes', value: task.notes.slice(0, 140), interpretation: 'notes add context' })
  if (task.dependencies?.blocksTaskIds.length) evidence.push({ taskId: task.id, field: 'dependencies.blocksTaskIds', value: String(task.dependencies.blocksTaskIds.length), interpretation: 'blocks other work' })
  if (task.history.postponedCount > 0) evidence.push({ taskId: task.id, field: 'history.postponedCount', value: String(task.history.postponedCount), interpretation: 'postponed before' })
  if (task.derived.hasMoneyClientHealthFamilyLegalSignal) evidence.push({ taskId: task.id, field: 'title', value: task.title, interpretation: 'title suggests real-world stakes' })
  if (task.dueIso) evidence.push({ taskId: task.id, field: 'dueIso', value: task.dueIso, interpretation: task.derived.isOverdue ? 'overdue' : 'due this week or soon' })
  if (task.priority) evidence.push({ taskId: task.id, field: 'priority', value: task.priority, interpretation: 'priority signal' })
  return evidence.slice(0, 3).length >= 2
    ? evidence.slice(0, 3)
    : [
        ...evidence,
        { taskId: task.id, field: 'status' as const, value: task.status, interpretation: 'current task state' },
        { taskId: task.id, field: 'title' as const, value: task.title, interpretation: 'limited context available' },
      ].slice(0, 3)
}

function quickDraftType(task: PlannerTaskSnapshot): WeeklyPlanRecommendation['recommendationType'] {
  if (task.dependencies?.blocksTaskIds.length) return 'unblock'
  if (task.derived.hasMoneyClientHealthFamilyLegalSignal) return 'reduce-risk'
  if (task.history.postponedCount > 0 || task.status === 'in_progress') return 'finish'
  if ((task.estimateMinutes ?? 999) <= 30) return 'quick-win'
  return 'protect'
}

function buildEvidenceSnippets(input: {
  title: string
  notes: string
  projectName: string
  postponedCount: number
  blocksTaskIds: string[]
  blockedByTaskIds: string[]
  timerMinutes: number
}): PlannerTaskSnapshot['derived']['evidenceSnippets'] {
  const snippets: PlannerTaskSnapshot['derived']['evidenceSnippets'] = [{ field: 'title', text: input.title }]
  if (input.notes) snippets.push({ field: 'notes', text: input.notes.slice(0, 180) })
  if (input.projectName) snippets.push({ field: 'project', text: input.projectName })
  if (input.postponedCount > 0 || input.timerMinutes > 0) snippets.push({ field: 'history', text: `postponed ${input.postponedCount} times; timer ${input.timerMinutes} minutes` })
  if (input.blocksTaskIds.length || input.blockedByTaskIds.length) snippets.push({ field: 'dependency', text: `blocks ${input.blocksTaskIds.length}; blocked by ${input.blockedByTaskIds.length}` })
  return snippets
}

function looksGeneric(text: string): boolean {
  return [
    /why now/i,
    /impact/i,
    /slot/i,
    /stay on track/i,
    /make progress/i,
    /high priority task/i,
    /due soon/i,
    /schedule a focused block/i,
    /משימה חשובה כי/i,
  ].some(pattern => pattern.test(text))
}

function hasRepeatedTemplateShape(recs: WeeklyPlanRecommendation[]): boolean {
  if (recs.length < 3) return false
  const openings = recs.map(rec => rec.whyThisMatters.split(/\s+/).slice(0, 5).join(' ').toLowerCase())
  return new Set(openings).size < Math.ceil(openings.length * 0.75)
}

function overusesDueDates(recs: WeeklyPlanRecommendation[]): boolean {
  return recs.filter(rec => {
    const fields = new Set(rec.evidence.map(item => item.field))
    return fields.has('dueIso') && [...fields].every(field => field === 'dueIso' || field === 'priority')
  }).length > 1
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return extractJsonObject(fenced[1])
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : null
}

function normalizeStatus(value: unknown): PlannerTaskSnapshot['status'] {
  if (value === 'done' || value === 'dismissed' || value === 'blocked' || value === 'in_progress') return value
  return 'todo'
}

function normalizePriority(value: unknown): PlannerTaskSnapshot['priority'] | undefined {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'urgent') return value
  return undefined
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return toDateKey(value)
  if (typeof value === 'string' && value.trim()) return value.slice(0, 10)
  return null
}

function toIso(value: unknown): string {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString()
  }
  return ''
}

function startOfWeek(now: Date): Date {
  const date = startOfDay(now)
  date.setDate(date.getDate() - date.getDay())
  return date
}

function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}
