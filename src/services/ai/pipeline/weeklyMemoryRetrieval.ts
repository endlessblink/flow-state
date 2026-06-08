import type { AIClarificationEvent, AIContextEdge, AIContextEdgeInput, AIContextEntity, AIMemorySnapshot, AIParameterBelief, ProjectContext, TaskContext, AIRecommendationFeedback } from '@/types/aiMemory'
import type { WeekContextMemoryInput } from './weeklyPlan'
import { summarizeAIMemoryLifecycle, type AIMemoryLifecycleSummary } from './memoryLifecycle'

type CardTaskLike = Record<string, unknown>
const WEEKLY_GLOBAL_MEMORY_ENTITY_KEYS = [
  'preference:ranking_focus',
  'preference:energy_fit',
  'preference:follow_through',
  'preference:brevity',
]

export type WeeklyMemoryRetrievalSource = 'hybrid_sql' | 'fallback'

export type WeeklyMemoryRetrievalDiagnostics = {
  source: WeeklyMemoryRetrievalSource
  entityKeyCount: number
  eventCount: number
  projectContextCount: number
  taskContextCount: number
  feedbackCount: number
  graphEdgeCount: number
  snapshotCount: number
  parameterBeliefCount: number
  elapsedMs: number
  timedOut: boolean
  exactEntityCount: number
  semanticCandidateCount: number
  semanticSkippedReason?: 'pgvector_not_configured' | 'no_related_entities'
  lifecycle: AIMemoryLifecycleSummary
}

export type WeeklyMemoryDb = {
  fetchProjectContexts(projectIds: string[]): Promise<ProjectContext[]>
  fetchTaskContexts(taskIds: string[]): Promise<TaskContext[]>
  fetchAIContextEntities(entityKeys: string[]): Promise<AIContextEntity[]>
  fetchAIClarificationEvents(entityKeys: string[], limit?: number): Promise<AIClarificationEvent[]>
  fetchAIRecommendationFeedback(input: { taskIds?: string[]; entityKeys?: string[]; limit?: number }): Promise<AIRecommendationFeedback[]>
  fetchAIContextEdges?(input: { entityKeys: string[]; limit?: number }): Promise<AIContextEdge[]>
  fetchAIMemorySnapshots?(input: { entityKeys?: string[]; scopes?: AIMemorySnapshot['scope'][]; limit?: number }): Promise<AIMemorySnapshot[]>
  fetchAIParameterBeliefs?(input: { entityKeys?: string[]; parameterKeys?: string[]; limit?: number }): Promise<AIParameterBelief[]>
}

export type WeeklyMemoryRetrievalInput = {
  db: WeeklyMemoryDb
  cardTasks: CardTaskLike[]
  now: Date
  timeoutMs: number
  getTaskProjectId?: (taskId: string) => string | null | undefined
}

export type WeeklyMemoryRetrievalResult = {
  memory: WeekContextMemoryInput
  clarificationEvents: AIClarificationEvent[]
  entityKeys: string[]
  weekEntityKey: string
  edges: AIContextEdgeInput[]
  diagnostics: WeeklyMemoryRetrievalDiagnostics
}

export async function retrieveWeeklyAIMemory(input: WeeklyMemoryRetrievalInput): Promise<WeeklyMemoryRetrievalResult> {
  const startedAt = performance.now()
  const taskIds = uniqueSupabaseIds(input.cardTasks.map(task => String(task.id || '')))
  const taskEntityKeys = uniqueStrings(input.cardTasks.map(task => String(task.id || '')).filter(Boolean).map(taskEntityKey))
  const rawProjectIds = uniqueStrings(input.cardTasks
    .map(task => {
      const taskId = String(task.id || '')
      return taskId ? input.getTaskProjectId?.(taskId) || String(task.projectId || '') : String(task.projectId || '')
    })
    .map(projectId => projectId || 'uncategorized')
  )
  const projectIds = uniqueSupabaseIds(rawProjectIds)
  const projectEntityKeys = rawProjectIds.map(projectEntityKey)
  const weekEntityKey = `week:${weekStartKey(input.now)}`
  const entityKeys = uniqueStrings([...projectEntityKeys, ...taskEntityKeys, weekEntityKey])
  const beliefEntityKeys = uniqueStrings([...entityKeys, ...WEEKLY_GLOBAL_MEMORY_ENTITY_KEYS])
  const fallbackDiagnostics = (timedOut: boolean): WeeklyMemoryRetrievalDiagnostics => ({
    source: 'fallback',
    entityKeyCount: entityKeys.length,
    eventCount: 0,
    projectContextCount: 0,
    taskContextCount: 0,
    feedbackCount: 0,
    graphEdgeCount: 0,
    snapshotCount: 0,
    parameterBeliefCount: 0,
    elapsedMs: Math.round(performance.now() - startedAt),
    timedOut,
    exactEntityCount: 0,
    semanticCandidateCount: 0,
    semanticSkippedReason: 'no_related_entities',
    lifecycle: emptyLifecycleSummary(),
  })

  try {
    const [projectContexts, taskContexts, contextEntities, clarificationEvents, recommendationFeedback, contextEdges, memorySnapshots, parameterBeliefs] = await withTimeout(Promise.all([
      input.db.fetchProjectContexts(projectIds),
      input.db.fetchTaskContexts(taskIds),
      input.db.fetchAIContextEntities(entityKeys),
      input.db.fetchAIClarificationEvents(entityKeys, 40),
      input.db.fetchAIRecommendationFeedback({ taskIds, entityKeys, limit: 80 }),
      input.db.fetchAIContextEdges?.({ entityKeys, limit: 80 }) ?? Promise.resolve([]),
      input.db.fetchAIMemorySnapshots?.({ entityKeys, scopes: ['user', 'project', 'task', 'week'], limit: 12 }) ?? Promise.resolve([]),
      input.db.fetchAIParameterBeliefs?.({ entityKeys: beliefEntityKeys, limit: 60 }) ?? Promise.resolve([]),
    ]), input.timeoutMs, 'weekly_plan_memory_timeout')
    const entityProjectContexts = contextEntities.map(entityToProjectContext).filter((ctx): ctx is ProjectContext => Boolean(ctx))
    const entityTaskContexts = contextEntities.map(entityToTaskContext).filter((ctx): ctx is TaskContext => Boolean(ctx))
    const lifecycle = summarizeAIMemoryLifecycle(contextEntities, clarificationEvents, input.now)
    const memory: WeekContextMemoryInput = {
      projectContexts: uniqueBy([...projectContexts, ...entityProjectContexts], ctx => ctx.projectId),
      taskContexts: uniqueBy([...taskContexts, ...entityTaskContexts], ctx => ctx.taskId),
      memorySnapshots,
      parameterBeliefs,
      recommendationFeedback,
    }
    const semanticCandidateKeys = uniqueStrings(contextEntities.flatMap(entity => entity.relatedEntities ?? []))
      .filter(key => !entityKeys.includes(key))
    return {
      memory,
      clarificationEvents,
      entityKeys,
      weekEntityKey,
      edges: buildWeeklyMemoryEdges(input.cardTasks, weekEntityKey, input.getTaskProjectId),
      diagnostics: {
        source: 'hybrid_sql',
        entityKeyCount: entityKeys.length,
        eventCount: clarificationEvents.length,
        projectContextCount: memory.projectContexts?.length ?? 0,
        taskContextCount: memory.taskContexts?.length ?? 0,
        feedbackCount: recommendationFeedback.length,
        graphEdgeCount: contextEdges.length,
        snapshotCount: memorySnapshots.length,
        parameterBeliefCount: parameterBeliefs.length,
        elapsedMs: Math.round(performance.now() - startedAt),
        timedOut: false,
        exactEntityCount: contextEntities.length,
        semanticCandidateCount: semanticCandidateKeys.length,
        semanticSkippedReason: semanticCandidateKeys.length ? 'pgvector_not_configured' : 'no_related_entities',
        lifecycle,
      },
    }
  } catch {
    return {
      memory: {},
      clarificationEvents: [],
      entityKeys,
      weekEntityKey,
      edges: buildWeeklyMemoryEdges(input.cardTasks, weekEntityKey, input.getTaskProjectId),
      diagnostics: fallbackDiagnostics(true),
    }
  }
}

function emptyLifecycleSummary(): AIMemoryLifecycleSummary {
  return {
    staleEntityKeys: [],
    refreshEntityKeys: [],
    summarizeEntityKeys: [],
    archiveEventCount: 0,
    lowConfidenceEntityCount: 0,
  }
}

export function projectEntityKey(projectId: string): string {
  return `project:${projectId || 'uncategorized'}`
}

export function taskEntityKey(taskId: string): string {
  return `task:${taskId}`
}

function buildWeeklyMemoryEdges(
  cardTasks: CardTaskLike[],
  weekEntityKey: string,
  getTaskProjectId?: (taskId: string) => string | null | undefined,
): AIContextEdgeInput[] {
  return cardTasks.flatMap(task => {
    const taskId = String(task.id || '')
    if (!taskId) return []
    const projectId = getTaskProjectId?.(taskId) || String(task.projectId || '') || 'uncategorized'
    return [
      {
        sourceEntityKey: taskEntityKey(taskId),
        targetEntityKey: projectEntityKey(projectId),
        relationType: 'belongs_to',
        confidence: 0.95,
        evidence: { source: 'weekly_plan_candidates' },
      },
      {
        sourceEntityKey: taskEntityKey(taskId),
        targetEntityKey: weekEntityKey,
        relationType: 'part_of_week',
        confidence: 0.7,
        evidence: { source: 'weekly_plan_candidates' },
      },
    ]
  })
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

function weekStartKey(now: Date): string {
  const date = new Date(now)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().slice(0, 10)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
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
