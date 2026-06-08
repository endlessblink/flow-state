import type {
  AIClarificationEvent,
  AIContextEdge,
  AIContextEntity,
  AIMemorySnapshot,
  AIParameterBelief,
  AIRecommendationFeedback,
  ProjectContext,
  TaskContext,
} from '@/types/aiMemory'
import { buildMemoryEvidenceHeader, formatMemoryEvidence, sanitizeMemoryEvidenceText } from './memoryEvidence'
import { assessAIParameterBeliefFreshness, assessAIMemoryFreshness, summarizeAIMemoryLifecycle, type AIMemoryLifecycleSummary } from './memoryLifecycle'
import { projectEntityKey, taskEntityKey } from './weeklyMemoryRetrieval'

type CardTaskLike = Record<string, unknown>

export type BroadMemoryDb = {
  fetchProjectContexts(projectIds: string[]): Promise<ProjectContext[]>
  fetchTaskContexts(taskIds: string[]): Promise<TaskContext[]>
  fetchAIContextEntities(entityKeys: string[]): Promise<AIContextEntity[]>
  fetchAIClarificationEvents(entityKeys: string[], limit?: number): Promise<AIClarificationEvent[]>
  fetchAIParameterBeliefs(input: { entityKeys?: string[]; parameterKeys?: string[]; limit?: number }): Promise<AIParameterBelief[]>
  fetchAIRecommendationFeedback(input: { taskIds?: string[]; entityKeys?: string[]; limit?: number }): Promise<AIRecommendationFeedback[]>
  fetchAIContextEdges?(input: { entityKeys: string[]; limit?: number }): Promise<AIContextEdge[]>
  fetchAIMemorySnapshots?(input: { entityKeys?: string[]; scopes?: AIMemorySnapshot['scope'][]; limit?: number }): Promise<AIMemorySnapshot[]>
}

export type BroadMemoryRetrievalInput = {
  db: BroadMemoryDb
  cardTasks: CardTaskLike[]
  lang: 'he' | 'en'
  timeoutMs?: number
  now?: Date
  getTaskProjectId?: (taskId: string) => string | null | undefined
  getTaskTitle?: (taskId: string) => string | null | undefined
  getProjectDisplayName?: (projectId: string) => string | null | undefined
}

export type BroadMemoryRetrievalSource = 'hybrid_sql' | 'fallback'
export type BroadMemoryRetrievalStage =
  | 'projectContexts'
  | 'taskContexts'
  | 'contextEntities'
  | 'clarificationEvents'
  | 'parameterBeliefs'
  | 'recommendationFeedback'
  | 'contextEdges'
  | 'memorySnapshots'

export const BROAD_TASK_GLOBAL_MEMORY_ENTITY_KEYS = [
  'workflow:task_answer:general',
  'workflow:task_answer:day_plan',
  'workflow:task_answer:smart_lanes',
  'workflow:task_answer:prioritization',
  'workflow:task_answer:next_task',
  'workflow:task_answer:overdue_triage',
  'preference:planning_style',
  'preference:energy',
  'preference:energy_fit',
  'preference:constraints',
  'preference:brevity',
  'preference:ranking_focus',
  'preference:follow_through',
]

export type BroadMemoryRetrievalResult = {
  summary: string
  recommendationFeedback: AIRecommendationFeedback[]
  compactPreference: boolean
  entityKeys: string[]
  diagnostics: {
    source: BroadMemoryRetrievalSource
    projectContextCount: number
    taskContextCount: number
    exactEntityCount: number
    eventCount: number
    beliefCount: number
    feedbackCount: number
    graphEdgeCount: number
    snapshotCount: number
    entityKeyCount: number
    lifecycle: AIMemoryLifecycleSummary
    elapsedMs: number
    timedOut: boolean
    stageTimings: Partial<Record<BroadMemoryRetrievalStage, number>>
  }
}

export async function retrieveBroadAIMemory(input: BroadMemoryRetrievalInput): Promise<BroadMemoryRetrievalResult> {
  const startedAt = performance.now()
  const stageTimings: Partial<Record<BroadMemoryRetrievalStage, number>> = {}
  const taskIdStrings = uniqueStrings(input.cardTasks.map(task => String(task.id || '')))
  const projectIdStrings = uniqueStrings(input.cardTasks
    .map(task => {
      const taskId = String(task.id || '')
      return taskId ? input.getTaskProjectId?.(taskId) || String(task.projectId || '') : String(task.projectId || '')
    })
    .map(projectId => projectId || 'uncategorized')
  )
  const taskIds = uniqueSupabaseIds(taskIdStrings)
  const projectIds = uniqueSupabaseIds(projectIdStrings)
  const entityKeys = uniqueStrings([
    ...broadWorkflowMemoryKeys(),
    ...projectIdStrings.map(projectEntityKey),
    ...taskIdStrings.map(taskEntityKey),
  ])
  const fallback = (timedOut: boolean): BroadMemoryRetrievalResult => ({
    summary: '',
    recommendationFeedback: [],
    compactPreference: false,
    entityKeys,
    diagnostics: {
      source: 'fallback',
      projectContextCount: 0,
      taskContextCount: 0,
      exactEntityCount: 0,
      eventCount: 0,
      beliefCount: 0,
      feedbackCount: 0,
      graphEdgeCount: 0,
      snapshotCount: 0,
      entityKeyCount: entityKeys.length,
      lifecycle: emptyLifecycleSummary(),
      elapsedMs: Math.round(performance.now() - startedAt),
      timedOut,
      stageTimings,
    },
  })

  let rows: [
    ProjectContext[],
    TaskContext[],
    AIContextEntity[],
    AIClarificationEvent[],
    AIParameterBelief[],
    AIRecommendationFeedback[],
    AIContextEdge[],
    AIMemorySnapshot[],
  ]
  try {
    rows = await withOptionalTimeout(Promise.all([
      timeBroadRetrievalStage(stageTimings, 'projectContexts', () => input.db.fetchProjectContexts(projectIds)),
      timeBroadRetrievalStage(stageTimings, 'taskContexts', () => input.db.fetchTaskContexts(taskIds)),
      timeBroadRetrievalStage(stageTimings, 'contextEntities', () => input.db.fetchAIContextEntities(entityKeys)),
      timeBroadRetrievalStage(stageTimings, 'clarificationEvents', () => input.db.fetchAIClarificationEvents(entityKeys, 30)),
      timeBroadRetrievalStage(stageTimings, 'parameterBeliefs', () => input.db.fetchAIParameterBeliefs({ entityKeys, limit: 40 })),
      timeBroadRetrievalStage(stageTimings, 'recommendationFeedback', () => input.db.fetchAIRecommendationFeedback({ taskIds, entityKeys, limit: 30 })),
      timeBroadRetrievalStage(stageTimings, 'contextEdges', () => input.db.fetchAIContextEdges?.({ entityKeys, limit: 40 }) ?? Promise.resolve([])),
      timeBroadRetrievalStage(stageTimings, 'memorySnapshots', () => input.db.fetchAIMemorySnapshots?.({ entityKeys, scopes: ['user', 'project', 'task', 'week', 'workflow'], limit: 12 }) ?? Promise.resolve([])),
    ]), input.timeoutMs, 'broad_task_memory_timeout')
  } catch {
    return fallback(Boolean(input.timeoutMs))
  }

  const [
    legacyProjectContexts,
    legacyTaskContexts,
    contextEntities,
    clarificationEvents,
    parameterBeliefs,
    recommendationFeedback,
    contextEdges,
    memorySnapshots,
  ] = rows
  const lifecycle = summarizeAIMemoryLifecycle(contextEntities, clarificationEvents, input.now, parameterBeliefs)
  const refreshEntityKeys = new Set(lifecycle.refreshEntityKeys)
  const activeClarificationEvents = clarificationEvents.filter(event => !refreshEntityKeys.has(event.entityKey))
  const activeParameterBeliefs = parameterBeliefs.filter(belief =>
    !refreshEntityKeys.has(belief.entityKey) &&
    assessAIParameterBeliefFreshness(belief, input.now).fresh
  )

  const projectContexts = uniqueBy(
    [
      ...legacyProjectContexts.filter(ctx => contextFresh(ctx, input.now)),
      ...contextEntities
        .filter(entity => !refreshEntityKeys.has(entity.entityKey))
        .map(entityToProjectContext)
        .filter((ctx): ctx is ProjectContext => Boolean(ctx)),
    ],
    ctx => ctx.projectId,
  )
  const taskContexts = uniqueBy(
    [
      ...legacyTaskContexts.filter(ctx => contextFresh(ctx, input.now)),
      ...contextEntities
        .filter(entity => !refreshEntityKeys.has(entity.entityKey))
        .map(entityToTaskContext)
        .filter((ctx): ctx is TaskContext => Boolean(ctx)),
    ],
    ctx => ctx.taskId,
  )

  return {
    summary: buildBroadMemorySummary({
      lang: input.lang,
      projectContexts,
      taskContexts,
      clarificationEvents: activeClarificationEvents,
      parameterBeliefs: activeParameterBeliefs,
      recommendationFeedback,
      contextEdges,
      memorySnapshots,
      contextEntities,
      lifecycle,
      projectIdStrings,
      getTaskTitle: input.getTaskTitle,
      getProjectDisplayName: input.getProjectDisplayName,
    }),
    recommendationFeedback,
    compactPreference: hasCompactPreference(contextEntities, activeParameterBeliefs, recommendationFeedback),
    entityKeys,
    diagnostics: {
      source: 'hybrid_sql',
      projectContextCount: projectContexts.length,
      taskContextCount: taskContexts.length,
      exactEntityCount: contextEntities.length,
      eventCount: clarificationEvents.length,
      beliefCount: activeParameterBeliefs.length,
      feedbackCount: recommendationFeedback.length,
      graphEdgeCount: contextEdges.length,
      snapshotCount: memorySnapshots.length,
      entityKeyCount: entityKeys.length,
      lifecycle,
      elapsedMs: Math.round(performance.now() - startedAt),
      timedOut: false,
      stageTimings,
    },
  }
}

async function timeBroadRetrievalStage<T>(
  timings: Partial<Record<BroadMemoryRetrievalStage, number>>,
  stage: BroadMemoryRetrievalStage,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now()
  try {
    return await run()
  } finally {
    timings[stage] = Math.round(performance.now() - startedAt)
  }
}

function broadWorkflowMemoryKeys(): string[] {
  return BROAD_TASK_GLOBAL_MEMORY_ENTITY_KEYS
}

function buildBroadMemorySummary(input: {
  lang: 'he' | 'en'
  projectContexts: ProjectContext[]
  taskContexts: TaskContext[]
  clarificationEvents: AIClarificationEvent[]
  parameterBeliefs: AIParameterBelief[]
  recommendationFeedback: AIRecommendationFeedback[]
  contextEdges: AIContextEdge[]
  memorySnapshots: AIMemorySnapshot[]
  contextEntities: AIContextEntity[]
  lifecycle: AIMemoryLifecycleSummary
  projectIdStrings: string[]
  getTaskTitle?: (taskId: string) => string | null | undefined
  getProjectDisplayName?: (projectId: string) => string | null | undefined
}): string {
  const lines: string[] = [buildMemoryEvidenceHeader(input.lang)]
  for (const ctx of input.projectContexts.slice(0, 8)) {
    const projectName = sanitizeMemoryEvidenceText(input.getProjectDisplayName?.(ctx.projectId) || ctx.projectId, 120)
    const bits = [
      formatMemoryEvidence('domain', ctx.domain, 80),
      ctx.currentStakes !== 'unknown' ? formatMemoryEvidence('stakes', ctx.currentStakes, 80) : '',
      ctx.whyItMatters ? formatMemoryEvidence('why', ctx.whyItMatters, 160) : '',
      ctx.successCriteria.length ? formatMemoryEvidence('success', ctx.successCriteria.slice(0, 2).join('; '), 160) : '',
    ].filter(Boolean)
    if (bits.length) lines.push(`- project ${projectName}: ${bits.join(' | ')}`)
  }
  for (const ctx of input.taskContexts.slice(0, 8)) {
    const taskName = sanitizeMemoryEvidenceText(input.getTaskTitle?.(ctx.taskId) || ctx.taskId, 160)
    const bits = [
      ctx.currentStakes !== 'unknown' ? formatMemoryEvidence('stakes', ctx.currentStakes, 80) : '',
      ctx.whyItMatters ? formatMemoryEvidence('why', ctx.whyItMatters, 160) : '',
      ctx.successCriteria.length ? formatMemoryEvidence('success', ctx.successCriteria.slice(0, 2).join('; '), 160) : '',
    ].filter(Boolean)
    if (bits.length) lines.push(`- task ${taskName}: ${bits.join(' | ')}`)
  }
  for (const entity of input.contextEntities
    .filter(entity => entity.entityType === 'preference' || entity.entityType === 'workflow')
    .slice(0, 6)) {
    const label = sanitizeMemoryEvidenceText(entity.displayName || entity.entityKey, 120)
    const facts = entity.facts ?? {}
    const bits = [
      factLabel(facts, 'rankingFocus', 140),
      factLabel(facts, 'whyItMatters', 160),
      factLabel(facts, 'taskSelectionHints', 160),
      factLabel(facts, 'preferences', 160),
      entity.confidence ? formatMemoryEvidence('confidence', entity.confidence.toFixed(2), 20) : '',
    ].filter(Boolean)
    if (bits.length) lines.push(`- response preference ${label}: ${bits.join(' | ')}`)
  }
  for (const belief of input.parameterBeliefs.slice(0, 8)) {
    const target = entityLabel(belief.entityKey, input.getTaskTitle, input.getProjectDisplayName)
    const value = beliefValueLabel(belief)
    const bits = [
      formatMemoryEvidence('parameter', belief.parameterKey, 80),
      value ? formatMemoryEvidence('answer', value, 140) : '',
      formatMemoryEvidence('confidence', belief.confidence.toFixed(2), 20),
    ].filter(Boolean)
    if (target && bits.length) lines.push(`- remembered answer for ${target}: ${bits.join(' | ')}`)
  }
  for (const event of input.clarificationEvents.filter(event => event.eventType === 'answered').slice(0, 5)) {
    const target = entityLabel(event.entityKey, input.getTaskTitle, input.getProjectDisplayName)
    const answer = event.selectedLabel || event.freeText
    if (target && answer) {
      lines.push(`- recent clarification for ${target}: ${formatMemoryEvidence('answer', answer, 140)}`)
    }
  }
  for (const edge of input.contextEdges.slice(0, 6)) {
    const source = entityLabel(edge.sourceEntityKey, input.getTaskTitle, input.getProjectDisplayName)
    const target = entityLabel(edge.targetEntityKey, input.getTaskTitle, input.getProjectDisplayName)
    if (source && target) {
      lines.push(`- relationship: ${source} ${formatMemoryEvidence('relation', edge.relationType, 80)} ${target} ${formatMemoryEvidence('confidence', edge.confidence.toFixed(2), 20)}`)
    }
  }
  for (const snapshot of input.memorySnapshots.slice(0, 4)) {
    const label = sanitizeMemoryEvidenceText(snapshot.snapshotKey, 140)
    const bits = [
      formatMemoryEvidence('summary', snapshot.summaryText, 220),
      formatMemoryEvidence('source_events', `${snapshot.sourceEventCount}`, 40),
      formatMemoryEvidence('confidence', snapshot.confidence.toFixed(2), 20),
    ]
    lines.push(`- memory snapshot ${label}: ${bits.join(' | ')}`)
  }
  const lifecycleBits = broadLifecycleEvidence(input.lifecycle)
  if (lifecycleBits.length) {
    lines.push(`- memory lifecycle: ${lifecycleBits.join(' | ')}`)
  }
  const knownProjectIds = new Set(input.projectContexts.map(ctx => ctx.projectId))
  const projectsWithoutContext = input.projectIdStrings
    .filter(id => !knownProjectIds.has(id) && !input.parameterBeliefs.some(belief => belief.entityKey === projectEntityKey(id)))
    .map(id => sanitizeMemoryEvidenceText(input.getProjectDisplayName?.(id) || id, 120))
    .slice(0, 5)
  if (projectsWithoutContext.length) {
    lines.push(`- context unknown for projects: ${projectsWithoutContext.join(', ')}`)
  }
  for (const feedback of input.recommendationFeedback.slice(0, 8)) {
    const target = feedbackTargetLabel(feedback, input.getTaskTitle, input.getProjectDisplayName)
    const bits = [
      formatMemoryEvidence('action', feedback.action, 80),
      feedback.reasonCategory ? formatMemoryEvidence('reason', feedback.reasonCategory, 80) : '',
      feedback.revisitAt ? formatMemoryEvidence('revisit', feedback.revisitAt.slice(0, 10), 80) : '',
      feedback.freeText ? formatMemoryEvidence('note', feedback.freeText, 120) : '',
    ].filter(Boolean)
    if (target && bits.length) lines.push(`- recommendation feedback for ${target}: ${bits.join(' | ')}`)
  }
  return lines.length > 1 ? lines.join('\n') : ''
}

function emptyLifecycleSummary(): AIMemoryLifecycleSummary {
  return {
    staleEntityKeys: [],
    refreshEntityKeys: [],
    staleParameterBeliefKeys: [],
    refreshParameterBeliefKeys: [],
    summarizeEntityKeys: [],
    archiveEventCount: 0,
    lowConfidenceEntityCount: 0,
    lowConfidenceBeliefCount: 0,
  }
}

function broadLifecycleEvidence(lifecycle: AIMemoryLifecycleSummary): string[] {
  const bits: string[] = []
  if (lifecycle.refreshEntityKeys.length) bits.push(formatMemoryEvidence('refresh_needed', `${lifecycle.refreshEntityKeys.length} memory item(s)`, 80))
  if (lifecycle.refreshParameterBeliefKeys.length) bits.push(formatMemoryEvidence('belief_refresh_needed', `${lifecycle.refreshParameterBeliefKeys.length} remembered answer(s)`, 80))
  if (lifecycle.staleEntityKeys.length) bits.push(formatMemoryEvidence('stale', `${lifecycle.staleEntityKeys.length} memory item(s)`, 80))
  if (lifecycle.staleParameterBeliefKeys.length) bits.push(formatMemoryEvidence('stale_beliefs', `${lifecycle.staleParameterBeliefKeys.length} remembered answer(s)`, 80))
  if (lifecycle.summarizeEntityKeys.length) bits.push(formatMemoryEvidence('summarize_needed', `${lifecycle.summarizeEntityKeys.length} memory item(s)`, 80))
  if (lifecycle.archiveEventCount) bits.push(formatMemoryEvidence('old_events', `${lifecycle.archiveEventCount}`, 40))
  if (lifecycle.lowConfidenceEntityCount) bits.push(formatMemoryEvidence('low_confidence', `${lifecycle.lowConfidenceEntityCount}`, 40))
  if (lifecycle.lowConfidenceBeliefCount) bits.push(formatMemoryEvidence('low_confidence_beliefs', `${lifecycle.lowConfidenceBeliefCount}`, 40))
  return bits
}

function hasCompactPreference(
  entities: AIContextEntity[],
  beliefs: AIParameterBelief[],
  feedback: AIRecommendationFeedback[],
): boolean {
  const entityText = entities
    .filter(entity => entity.entityKey === 'preference:brevity' || entity.entityKey === 'preference:planning_style')
    .map(entity => JSON.stringify(entity.facts ?? {}))
    .join(' ')
  const beliefText = beliefs
    .filter(belief =>
      belief.entityKey === 'preference:brevity' ||
      belief.parameterKey === 'preferences' ||
      belief.sourceQuestionId === 'recommendation_feedback:simplify'
    )
    .map(belief => `${belief.entityKey} ${belief.parameterKey} ${beliefValueLabel(belief)}`)
    .join(' ')
  const feedbackText = feedback
    .filter(item => item.action === 'simplify' || item.reasonCategory === 'too_much')
    .map(item => `${item.action} ${item.reasonCategory ?? ''} ${item.freeText ?? ''}`)
    .join(' ')
  return /too much|shorter|brief|compact|less|overwhelm|עומס|קצר|פחות/i.test(`${entityText} ${beliefText} ${feedbackText}`)
}

function factLabel(facts: Record<string, unknown>, key: string, limit: number): string {
  const raw = facts[key]
  const value = Array.isArray(raw) ? raw.map(String).join('; ') : typeof raw === 'string' ? raw : ''
  return value.trim() ? formatMemoryEvidence(key, value, limit) : ''
}

function feedbackTargetLabel(
  feedback: AIRecommendationFeedback,
  getTaskTitle?: (taskId: string) => string | null | undefined,
  getProjectDisplayName?: (projectId: string) => string | null | undefined,
): string {
  if (feedback.taskId) {
    return sanitizeMemoryEvidenceText(getTaskTitle?.(feedback.taskId) || feedback.taskId, 160)
  }
  return entityLabel(feedback.entityKey || feedback.recommendationId, getTaskTitle, getProjectDisplayName)
}

function entityLabel(
  entityKey: string,
  getTaskTitle?: (taskId: string) => string | null | undefined,
  getProjectDisplayName?: (projectId: string) => string | null | undefined,
): string {
  if (entityKey.startsWith('task:')) {
    const taskId = entityKey.slice('task:'.length)
    return sanitizeMemoryEvidenceText(getTaskTitle?.(taskId) || taskId, 160)
  }
  if (entityKey.startsWith('project:')) {
    const projectId = entityKey.slice('project:'.length)
    return sanitizeMemoryEvidenceText(getProjectDisplayName?.(projectId) || projectId, 120)
  }
  return sanitizeMemoryEvidenceText(entityKey, 160)
}

function beliefValueLabel(belief: AIParameterBelief): string {
  const raw = belief.beliefJson.value ?? belief.beliefJson.selectedLabel ?? belief.beliefJson.freeText
  if (Array.isArray(raw)) return raw.map(String).join(', ')
  return typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : ''
}

function uniqueSupabaseIds(values: string[]): string[] {
  return uniqueStrings(values).filter(isSupabaseUuid)
}

function isSupabaseUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

async function withOptionalTimeout<T>(promise: Promise<T>, timeoutMs: number | undefined, timeoutMessage: string): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  return items.filter((item, index, all) => all.findIndex(other => keyOf(other) === keyOf(item)) === index)
}

function contextFresh(ctx: ProjectContext | TaskContext, now: Date = new Date()): boolean {
  return assessAIMemoryFreshness({
    staleAfter: ctx.staleAfter,
    lastConfirmedAt: ctx.lastConfirmedAt,
    lastUpdatedAt: ctx.lastUpdatedAt,
    confidence: ctx.confidence,
  }, now).fresh
}

function factString(facts: Record<string, unknown>, field: string): string | null {
  const value = facts[field]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function factArray(facts: Record<string, unknown>, field: string): string[] {
  const value = facts[field]
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function entityToProjectContext(entity: AIContextEntity): ProjectContext | null {
  if (entity.entityType !== 'project' && entity.entityType !== 'synthetic_group') return null
  const projectId = entity.canonicalProjectId || entity.entityKey.replace(/^project:/, '').replace(/^synthetic_group:/, '')
  if (!projectId) return null
  const facts = entity.facts ?? {}
  const domain = factString(facts, 'domain')
  const currentStakes = factString(facts, 'currentStakes')
  const urgencyWindow = factString(facts, 'urgencyWindow')
  return {
    projectId,
    summary: entity.summary ?? factString(facts, 'summary'),
    domain: domain === 'work' || domain === 'personal' || domain === 'creative' || domain === 'admin' || domain === 'learning' || domain === 'health' ? domain : 'unknown',
    lifeArea: factString(facts, 'lifeArea'),
    whyItMatters: factString(facts, 'whyItMatters') ?? factString(facts, 'thisWeekImportance'),
    successCriteria: factArray(facts, 'successCriteria'),
    failureRisks: factArray(facts, 'failureRisks'),
    currentStakes: currentStakes === 'low' || currentStakes === 'medium' || currentStakes === 'high' || currentStakes === 'critical' ? currentStakes : 'unknown',
    urgencyWindow: urgencyWindow === 'none' || urgencyWindow === 'this_week' || urgencyWindow === 'this_month' || urgencyWindow === 'date_bound' ? urgencyWindow : 'unknown',
    preferredCadence: null,
    taskSelectionHints: factArray(facts, 'taskSelectionHints'),
    nonGoals: factArray(facts, 'nonGoals'),
    userCorrections: [...entity.corrections, ...factArray(facts, 'userCorrections')],
    confidence: entity.confidence,
    completenessScore: entity.completenessScore,
    lastConfirmedAt: entity.lastAnsweredAt ?? null,
    lastUpdatedAt: entity.lastAnsweredAt ?? entity.lastAskedAt ?? null,
    staleAfter: entity.staleAfter ?? null,
  }
}

function entityToTaskContext(entity: AIContextEntity): TaskContext | null {
  if (entity.entityType !== 'task') return null
  const taskId = entity.canonicalTaskId || entity.entityKey.replace(/^task:/, '')
  if (!taskId) return null
  const facts = entity.facts ?? {}
  const currentStakes = factString(facts, 'currentStakes')
  const urgencyWindow = factString(facts, 'urgencyWindow')
  return {
    taskId,
    projectId: factString(facts, 'projectId'),
    summary: entity.summary ?? factString(facts, 'summary'),
    whyItMatters: factString(facts, 'whyItMatters'),
    successCriteria: factArray(facts, 'successCriteria'),
    currentStakes: currentStakes === 'low' || currentStakes === 'medium' || currentStakes === 'high' || currentStakes === 'critical' ? currentStakes : 'unknown',
    urgencyWindow: urgencyWindow === 'none' || urgencyWindow === 'this_week' || urgencyWindow === 'this_month' || urgencyWindow === 'date_bound' ? urgencyWindow : 'unknown',
    selectionHints: factArray(facts, 'selectionHints'),
    nonGoals: factArray(facts, 'nonGoals'),
    userCorrections: [...entity.corrections, ...factArray(facts, 'userCorrections')],
    confidence: entity.confidence,
    completenessScore: entity.completenessScore,
    lastConfirmedAt: entity.lastAnsweredAt ?? null,
    lastUpdatedAt: entity.lastAnsweredAt ?? entity.lastAskedAt ?? null,
    staleAfter: entity.staleAfter ?? null,
  }
}
