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
    candidateReasons: CandidateReason[]
    evidenceSnippets: Array<{
      field: 'title' | 'notes' | 'project' | 'history' | 'dependency'
      text: string
    }>
  }
}

export type CandidateReason =
  | 'due_this_week'
  | 'overdue'
  | 'blocks_other_tasks'
  | 'blocked_needs_decision'
  | 'repeatedly_postponed'
  | 'already_started'
  | 'high_timer_investment'
  | 'project_with_multiple_active_tasks'
  | 'notes_have_external_stakeholder'
  | 'notes_have_money_client_health_family_legal_signal'
  | 'small_quick_win'
  | 'large_needs_decomposition'

export type PlannerWorkstream = {
  id: string
  label: string
  taskIds: string[]
  reason: string
  evidenceSignals: CandidateReason[]
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
  workstreams: PlannerWorkstream[]
  tasks: PlannerTaskSnapshot[]
}

export type WeeklyPlanRecommendation = {
  sectionId: string
  rank: number
  focusArea: string
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
const REAL_CONSEQUENCE_RE = /(decision|meeting|client|customer|stakeholder|promise|commitment|renewal|proposal|budget|revenue|money|invoice|payment|cash|risk|blocked|blocks|unblock|release|qa|signoff|rework|context|postponed|avoidance|mental load|family|health|doctor|admin|legal|tax|relief|momentum|החלטה|פגישה|לקוח|התחייבות|הבטחה|תקציב|כסף|תשלום|חשבונית|סיכון|חוסם|לשחרר|שחרור|בדיקה|משפחה|בריאות|רופא|מס|מנהלתי|עומס|דחייה|מומנטום)/i
const GENERIC_FOCUS_RE = /^(due tasks?|top tasks?|weekly tasks?|priority tasks?|work|admin|personal|focused task|משימות|משימות השבוע|עבודה|אישי|משימה ממוקדת)$/i

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
    workstreams: buildWorkstreams(snapshots),
    tasks: snapshots,
  }
}

export function buildWeeklyPlanPrompt(context: WeekContext): string {
  return JSON.stringify({
    instruction: 'Return only valid JSON matching schema weekly-plan.v2. Do not output markdown. Do not describe task cards. The UI renders cards from task IDs.',
    schemaRules: {
      recommendations: '3-7 items',
      focusArea: 'Every recommendation must name the concrete workstream/aspect it belongs to, for example Client renewals, Release blocker, Family health admin, Sales pipeline.',
      taskIds: 'Every primaryTaskId and relatedTaskIds item must be from candidateTasks.',
      evidence: 'At least two evidence items per recommendation. At least one must not be dueIso or priority.',
      reasoning: 'Explain real consequence beyond due date/priority. Avoid repeated templates.',
      locale: context.locale,
      direction: context.direction,
    },
    selectionPolicy: [
      'Build a grand view of the week: recommendations should be about workstreams/aspects, not isolated checkboxes.',
      'Use relatedTaskIds when several candidate tasks serve the same aspect of work or life.',
      'Prefer tasks with concrete consequences over tasks that merely have a due date.',
      'Do not choose more than 3 tasks from the same project unless that project is the clear center of the week.',
      'Include a repeatedly postponed task only if you can explain the avoidance risk or relief value.',
      'If a task is large, recommend the smallest useful next action, not "finish the whole thing."',
      'Explicitly defer lower-value due-soon tasks when they crowd out higher-impact work.',
    ],
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
      workstreams: context.workstreams,
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
    if (!rec.focusArea || typeof rec.focusArea !== 'string') errors.push(`missing_focus_area:${rec.sectionId}`)
    if (typeof rec.focusArea === 'string' && GENERIC_FOCUS_RE.test(rec.focusArea.trim())) errors.push(`generic_focus_area:${rec.sectionId}`)
    if (!validTaskIds.has(rec.primaryTaskId)) errors.push(`invalid_primary_task_id:${rec.primaryTaskId}`)
    if (rec.cardPlacement !== 'immediately_after_explanation') errors.push(`bad_card_placement:${rec.sectionId}`)
    if (looksGeneric(`${rec.whyThisMatters} ${rec.whyThisWeek} ${rec.nextAction}`)) errors.push(`generic_reasoning:${rec.sectionId}`)
    if (!hasRealConsequence(rec)) errors.push(`missing_real_consequence:${rec.sectionId}`)
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
  if (context.workstreams.some(stream => stream.taskIds.length > 1) && recs.every(rec => (rec.relatedTaskIds ?? []).length === 0)) {
    errors.push('missing_related_workstream_binding')
  }
  if (recs.length >= 3 && realConsequenceCoverage(recs) < 0.8) errors.push('insufficient_real_consequence_coverage')
  if (hasRepeatedTemplateShape(recs)) errors.push('repeated_template_structure')
  if (overusesDueDates(recs)) errors.push('due_date_overuse')
  return [...new Set(errors)]
}

export function buildQuickDraftWeeklyPlan(context: WeekContext): WeeklyPlanOutput {
  const selected = context.tasks.slice(0, Math.min(5, Math.max(3, context.tasks.length)))
  const workstreamByTaskId = buildWorkstreamLookup(context.workstreams)
  const locale = context.locale
  const recommendations = selected.map((task, index): WeeklyPlanRecommendation => {
    const evidence = quickDraftEvidence(task)
    const stream = workstreamByTaskId.get(task.id)
    const relatedTaskIds = stream?.taskIds.filter(id => id !== task.id).slice(0, 2) ?? []
    const focusArea = stream?.label ?? (task.project?.name || task.tags?.[0] || (locale === 'he' ? 'הקשר מוגבל' : 'Limited task context'))
    return {
      sectionId: `quick_${index + 1}_${task.id}`,
      rank: index + 1,
      focusArea,
      primaryTaskId: task.id,
      relatedTaskIds,
      recommendationType: quickDraftType(task),
      title: task.title,
      whyThisMatters: quickDraftWhyThisMatters(task, stream, locale),
      whyThisWeek: quickDraftWhyThisWeek(task, evidence, locale),
      riskIfIgnored: quickDraftRisk(task, locale),
      nextAction: quickDraftNextAction(task, locale),
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
  const estimateMinutes = Number(task?.estimatedDuration ?? record.estimatedDuration) || null
  const status = normalizeStatus(task?.status ?? record.status)
  const priority = normalizePriority(task?.priority ?? record.priority)
  const hasHumanOrExternalStakeholder = STAKEHOLDER_RE.test(text)
  const hasMoneyClientHealthFamilyLegalSignal = MONEY_CLIENT_HEALTH_FAMILY_LEGAL_RE.test(text)
  const isOverdue = typeof daysUntilDue === 'number' && daysUntilDue < 0
  const isStale = now.getTime() - new Date(updatedIso).getTime() > 14 * MS_PER_DAY
  const evidenceSnippets = buildEvidenceSnippets({ title, notes, projectName, postponedCount, blocksTaskIds, blockedByTaskIds, timerMinutes })
  const candidateReasons = buildCandidateReasons({
    daysUntilDue,
    isOverdue,
    isStale,
    status,
    projectName,
    postponedCount,
    timerMinutes,
    blocksTaskIds,
    blockedByTaskIds,
    hasHumanOrExternalStakeholder,
    hasMoneyClientHealthFamilyLegalSignal,
    estimateMinutes,
  })

  return {
    id,
    version: new Date(updatedIso).getTime() || 0,
    title,
    status,
    priority,
    dueIso,
    project: projectId || projectName ? { id: projectId || projectName, name: projectName || projectId } : undefined,
    notes: notes || undefined,
    tags: task?.tags ?? (Array.isArray(record.tags) ? record.tags.map(String) : undefined),
    estimateMinutes,
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
      isOverdue,
      isStale,
      hasHumanOrExternalStakeholder,
      hasMoneyClientHealthFamilyLegalSignal,
      candidateReasons,
      evidenceSnippets,
    },
  }
}

function buildCandidateReasons(input: {
  daysUntilDue: number | null
  isOverdue: boolean
  isStale: boolean
  status: PlannerTaskSnapshot['status']
  projectName: string
  postponedCount: number
  timerMinutes: number
  blocksTaskIds: string[]
  blockedByTaskIds: string[]
  hasHumanOrExternalStakeholder: boolean
  hasMoneyClientHealthFamilyLegalSignal: boolean
  estimateMinutes: number | null
}): CandidateReason[] {
  const reasons: CandidateReason[] = []
  if (input.isOverdue) reasons.push('overdue')
  if (typeof input.daysUntilDue === 'number' && input.daysUntilDue >= 0 && input.daysUntilDue <= 7) reasons.push('due_this_week')
  if (input.blocksTaskIds.length) reasons.push('blocks_other_tasks')
  if (input.blockedByTaskIds.length) reasons.push('blocked_needs_decision')
  if (input.postponedCount >= 2 || input.isStale) reasons.push('repeatedly_postponed')
  if (input.status === 'in_progress') reasons.push('already_started')
  if (input.timerMinutes >= 60) reasons.push('high_timer_investment')
  if (input.projectName) reasons.push('project_with_multiple_active_tasks')
  if (input.hasHumanOrExternalStakeholder) reasons.push('notes_have_external_stakeholder')
  if (input.hasMoneyClientHealthFamilyLegalSignal) reasons.push('notes_have_money_client_health_family_legal_signal')
  if (input.estimateMinutes != null && input.estimateMinutes <= 30) reasons.push('small_quick_win')
  if (input.estimateMinutes != null && input.estimateMinutes >= 180) reasons.push('large_needs_decomposition')
  return reasons
}

function buildWorkstreams(tasks: PlannerTaskSnapshot[]): PlannerWorkstream[] {
  const streams = new Map<string, PlannerWorkstream>()

  function add(id: string, label: string, task: PlannerTaskSnapshot, reason: string, signals: CandidateReason[]) {
    const stream = streams.get(id) ?? { id, label, taskIds: [], reason, evidenceSignals: [] }
    if (!stream.taskIds.includes(task.id)) stream.taskIds.push(task.id)
    for (const signal of signals) {
      if (!stream.evidenceSignals.includes(signal)) stream.evidenceSignals.push(signal)
    }
    streams.set(id, stream)
  }

  for (const task of tasks) {
    if (task.project?.name) {
      add(`project:${task.project.id}`, task.project.name, task, 'Several candidate tasks share this project/aspect.', ['project_with_multiple_active_tasks'])
    }
    if (task.derived.hasHumanOrExternalStakeholder) {
      add('signal:commitments', 'External commitments and replies', task, 'These tasks appear connected to other people, meetings, replies, approvals, or clients.', ['notes_have_external_stakeholder'])
    }
    if (task.derived.hasMoneyClientHealthFamilyLegalSignal) {
      add('signal:real-life-stakes', 'Money, client, health, family, or admin stakes', task, 'These tasks carry consequences beyond a checkbox.', ['notes_have_money_client_health_family_legal_signal'])
    }
    if (task.dependencies?.blocksTaskIds.length) {
      add('signal:blockers', 'Unblock dependent work', task, 'These tasks block follow-up work.', ['blocks_other_tasks'])
    }
    if (task.history.postponedCount >= 2 || task.derived.isStale) {
      add('signal:avoidance', 'Postponed or stale work', task, 'These tasks show avoidance or slipping context.', ['repeatedly_postponed'])
    }
    if (task.status === 'in_progress' || task.history.timerMinutesLast7Days >= 60) {
      add('signal:finish-started', 'Finish work already in motion', task, 'These tasks already have attention invested.', ['already_started', 'high_timer_investment'])
    }
  }

  return [...streams.values()]
    .filter(stream => stream.taskIds.length > 1 || stream.id.startsWith('signal:'))
    .sort((a, b) => b.taskIds.length - a.taskIds.length)
    .slice(0, 8)
}

function buildWorkstreamLookup(workstreams: PlannerWorkstream[]): Map<string, PlannerWorkstream> {
  const out = new Map<string, PlannerWorkstream>()
  for (const stream of workstreams) {
    for (const id of stream.taskIds) {
      if (!out.has(id)) out.set(id, stream)
    }
  }
  return out
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

function quickDraftWhyThisMatters(task: PlannerTaskSnapshot, stream: PlannerWorkstream | undefined, locale: PlannerLocale): string {
  if (task.dependencies?.blocksTaskIds.length) {
    return locale === 'he'
      ? `טיוטה עובדתית: המשימה הזו חוסמת ${task.dependencies.blocksTaskIds.length} משימות נוספות, לכן היא משפיעה על זרימת העבודה מעבר לצ'קבוקס שלה.`
      : `Evidence-only draft: this task blocks ${task.dependencies.blocksTaskIds.length} other task${task.dependencies.blocksTaskIds.length === 1 ? '' : 's'}, so it affects the flow of work beyond its own checkbox.`
  }
  if (task.derived.hasHumanOrExternalStakeholder) {
    return locale === 'he'
      ? 'טיוטה עובדתית: הכותרת או ההערות מצביעות על אדם אחר, תגובה, פגישה או אישור, אז יש כאן התחייבות חיצונית שצריך להגן עליה.'
      : 'Evidence-only draft: the title or notes point to another person, reply, meeting, approval, or client, so this looks like an external commitment to protect.'
  }
  if (task.derived.hasMoneyClientHealthFamilyLegalSignal) {
    return locale === 'he'
      ? 'טיוטה עובדתית: האותות במשימה מצביעים על כסף, לקוח, בריאות, משפחה או אדמין, ולכן יש לה משקל חיים/עבודה מעבר לסידור רשימה.'
      : 'Evidence-only draft: the task signals money, client, health, family, or admin stakes, so it carries life/work weight beyond list cleanup.'
  }
  if (task.history.postponedCount > 0 || task.derived.isStale) {
    return locale === 'he'
      ? `טיוטה עובדתית: המשימה נדחתה ${task.history.postponedCount} פעמים או התיישנה, אז הסיכון הוא שהיא תמשיך לשבת פתוחה ולמשוך קשב.`
      : `Evidence-only draft: this task has been postponed ${task.history.postponedCount} time${task.history.postponedCount === 1 ? '' : 's'} or has gone stale, so the risk is continued open-loop attention.`
  }
  if (task.status === 'in_progress' || task.history.timerMinutesLast7Days > 0) {
    return locale === 'he'
      ? `טיוטה עובדתית: כבר הושקעו כאן ${task.history.timerMinutesLast7Days} דקות או שהמשימה בתהליך, כך שיש ערך בלסגור את ההקשר לפני שהוא מתפזר.`
      : `Evidence-only draft: ${task.history.timerMinutesLast7Days} minutes are already invested or the task is in progress, so there is value in closing the context before it fades.`
  }
  if (stream) {
    return locale === 'he'
      ? `טיוטה עובדתית: המשימה יושבת בתוך "${stream.label}", יחד עם ${stream.taskIds.length} משימות קשורות, אז כדאי לראות אותה כחלק מאותו היבט עבודה.`
      : `Evidence-only draft: this sits inside "${stream.label}" with ${stream.taskIds.length} related tasks, so treat it as part of that work aspect.`
  }
  return locale === 'he'
    ? 'טיוטה עובדתית: אין מספיק הקשר עמוק, לכן זה מוצג לפי האותות הזמינים בכרטיס ולא כהמלצה אימונית מלאה.'
    : 'Evidence-only draft: there is limited deeper context, so this is shown from available task signals rather than as full coaching advice.'
}

function quickDraftWhyThisWeek(task: PlannerTaskSnapshot, evidence: WeeklyPlanRecommendation['evidence'], locale: PlannerLocale): string {
  const signals = evidence.map(item => item.interpretation).join(locale === 'he' ? ' · ' : ' · ')
  if (task.derived.isOverdue) return locale === 'he' ? `השבוע כי היא כבר באיחור. אותות: ${signals}` : `This week because it is already overdue. Signals: ${signals}`
  if (typeof task.derived.daysUntilDue === 'number' && task.derived.daysUntilDue <= 7) {
    return locale === 'he'
      ? `השבוע כי היא בתוך חלון הזמן הקרוב. אותות: ${signals}`
      : `This week because it falls inside the near-term planning window. Signals: ${signals}`
  }
  if (task.dependencies?.blocksTaskIds.length) return locale === 'he' ? `השבוע כדי לשחרר עבודה תלויה. אותות: ${signals}` : `This week to unblock dependent work. Signals: ${signals}`
  return locale === 'he' ? `השבוע לפי האותות החזקים ביותר בכרטיס: ${signals}` : `This week based on the strongest card signals: ${signals}`
}

function quickDraftRisk(task: PlannerTaskSnapshot, locale: PlannerLocale): string {
  if (task.dependencies?.blocksTaskIds.length) return locale === 'he' ? 'אם תתעלם, עבודה קשורה עלולה להישאר תקועה.' : 'If ignored, related work may remain blocked.'
  if (task.history.postponedCount > 0 || task.derived.isStale) return locale === 'he' ? 'אם תתעלם, זה כנראה יישאר לולאה פתוחה גם בשבוע הבא.' : 'If ignored, this is likely to remain an open loop into next week.'
  if (task.derived.hasHumanOrExternalStakeholder) return locale === 'he' ? 'אם תתעלם, ההתחייבות מול אדם אחר או חלון ההחלטה עלולים להיחלש.' : 'If ignored, the commitment to another person or decision window may weaken.'
  return locale === 'he' ? 'אם תתעלם, אין לי מספיק הקשר כדי להעריך סיכון עמוק יותר בלי רענון מודל.' : 'If ignored, there is not enough context here to estimate deeper risk without a model refresh.'
}

function quickDraftNextAction(task: PlannerTaskSnapshot, locale: PlannerLocale): string {
  if (task.estimateMinutes != null && task.estimateMinutes <= 30) return locale === 'he' ? 'בצע את הפעולה הקטנה בכרטיס וסגור אותה אם היא באמת לוקחת פחות מחצי שעה.' : 'Do the small action on the card and close it if it really fits under 30 minutes.'
  if (task.dependencies?.blocksTaskIds.length) return locale === 'he' ? 'פתח את הכרטיס ובחר את הצעד המינימלי שישחרר את המשימות התלויות.' : 'Open the card and choose the smallest step that unblocks the dependent tasks.'
  if (task.history.postponedCount > 0 || task.derived.isStale) return locale === 'he' ? 'פתח את הכרטיס והגדר צעד פתיחה של 10 דקות, לא יעד סיום מלא.' : 'Open the card and define a 10-minute starting step, not a full completion target.'
  return locale === 'he' ? 'פתח את הכרטיס, בדוק את ההקשר, ובחר פעולה אחת קטנה ומדידה.' : 'Open the card, check the context, and choose one small measurable action.'
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

function hasRealConsequence(rec: WeeklyPlanRecommendation): boolean {
  const text = [
    rec.focusArea,
    rec.title,
    rec.whyThisMatters,
    rec.whyThisWeek,
    rec.riskIfIgnored,
    rec.nextAction,
    ...rec.evidence.map(item => `${item.value} ${item.interpretation}`),
  ].join(' ')
  return REAL_CONSEQUENCE_RE.test(text)
}

function realConsequenceCoverage(recs: WeeklyPlanRecommendation[]): number {
  if (!recs.length) return 0
  return recs.filter(hasRealConsequence).length / recs.length
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
