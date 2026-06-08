import type {
  AIClarificationEvent,
  AIContextEdge,
  AIContextEntity,
  AIParameterBelief,
  AIRecommendationFeedback,
  ProjectContext,
  TaskContext,
} from '@/types/aiMemory'
import { buildMemoryEvidenceHeader, formatMemoryEvidence, sanitizeMemoryEvidenceText } from './memoryEvidence'
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
}

export type BroadMemoryRetrievalInput = {
  db: BroadMemoryDb
  cardTasks: CardTaskLike[]
  lang: 'he' | 'en'
  timeoutMs?: number
  getTaskProjectId?: (taskId: string) => string | null | undefined
  getTaskTitle?: (taskId: string) => string | null | undefined
  getProjectDisplayName?: (projectId: string) => string | null | undefined
}

export type BroadMemoryRetrievalSource = 'hybrid_sql' | 'fallback'

export type BroadMemoryRetrievalResult = {
  summary: string
  recommendationFeedback: AIRecommendationFeedback[]
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
    entityKeyCount: number
    elapsedMs: number
    timedOut: boolean
  }
}

export async function retrieveBroadAIMemory(input: BroadMemoryRetrievalInput): Promise<BroadMemoryRetrievalResult> {
  const startedAt = performance.now()
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
    ...projectIdStrings.map(projectEntityKey),
    ...taskIdStrings.map(taskEntityKey),
  ])
  const fallback = (timedOut: boolean): BroadMemoryRetrievalResult => ({
    summary: '',
    recommendationFeedback: [],
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
      entityKeyCount: entityKeys.length,
      elapsedMs: Math.round(performance.now() - startedAt),
      timedOut,
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
  ]
  try {
    rows = await withOptionalTimeout(Promise.all([
      input.db.fetchProjectContexts(projectIds),
      input.db.fetchTaskContexts(taskIds),
      input.db.fetchAIContextEntities(entityKeys),
      input.db.fetchAIClarificationEvents(entityKeys, 30),
      input.db.fetchAIParameterBeliefs({ entityKeys, limit: 40 }),
      input.db.fetchAIRecommendationFeedback({ taskIds, entityKeys, limit: 30 }),
      input.db.fetchAIContextEdges?.({ entityKeys, limit: 40 }) ?? Promise.resolve([]),
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
  ] = rows

  const projectContexts = uniqueBy(
    [
      ...legacyProjectContexts,
      ...contextEntities.map(entityToProjectContext).filter((ctx): ctx is ProjectContext => Boolean(ctx)),
    ],
    ctx => ctx.projectId,
  )
  const taskContexts = uniqueBy(
    [
      ...legacyTaskContexts,
      ...contextEntities.map(entityToTaskContext).filter((ctx): ctx is TaskContext => Boolean(ctx)),
    ],
    ctx => ctx.taskId,
  )

  return {
    summary: buildBroadMemorySummary({
      lang: input.lang,
      projectContexts,
      taskContexts,
      clarificationEvents,
      parameterBeliefs,
      recommendationFeedback,
      contextEdges,
      projectIdStrings,
      getTaskTitle: input.getTaskTitle,
      getProjectDisplayName: input.getProjectDisplayName,
    }),
    recommendationFeedback,
    entityKeys,
    diagnostics: {
      source: 'hybrid_sql',
      projectContextCount: projectContexts.length,
      taskContextCount: taskContexts.length,
      exactEntityCount: contextEntities.length,
      eventCount: clarificationEvents.length,
      beliefCount: parameterBeliefs.length,
      feedbackCount: recommendationFeedback.length,
      graphEdgeCount: contextEdges.length,
      entityKeyCount: entityKeys.length,
      elapsedMs: Math.round(performance.now() - startedAt),
      timedOut: false,
    },
  }
}

function buildBroadMemorySummary(input: {
  lang: 'he' | 'en'
  projectContexts: ProjectContext[]
  taskContexts: TaskContext[]
  clarificationEvents: AIClarificationEvent[]
  parameterBeliefs: AIParameterBelief[]
  recommendationFeedback: AIRecommendationFeedback[]
  contextEdges: AIContextEdge[]
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
