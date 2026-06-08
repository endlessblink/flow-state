import type {
  AIClarificationEvent,
  AIClarificationEventInput,
  AIContextEntity,
  AIContextEdge,
  AIContextEdgeInput,
  AIMemoryDebugSnapshot,
  AIMemoryPatch,
  AIMemorySnapshot,
  AIMemorySnapshotInput,
  AIParameterBelief,
  AIParameterBeliefInput,
  AIRecommendationFeedback,
  AIRecommendationFeedbackInput,
  ProjectContext,
  TaskContext,
} from '@/types/aiMemory'
import { getSupabase, invalidateCache, swrCache, type DatabaseContext } from './_infrastructure'

type ProjectContextRow = {
  project_id: string
  user_id?: string
  summary?: string | null
  domain?: ProjectContext['domain']
  life_area?: string | null
  why_it_matters?: string | null
  success_criteria?: unknown
  failure_risks?: unknown
  current_stakes?: ProjectContext['currentStakes']
  urgency_window?: ProjectContext['urgencyWindow']
  preferred_cadence?: ProjectContext['preferredCadence'] | null
  task_selection_hints?: unknown
  non_goals?: unknown
  user_corrections?: unknown
  confidence?: number
  completeness_score?: number
  last_confirmed_at?: string | null
  last_updated_at?: string | null
  stale_after?: string | null
}

type TaskContextRow = {
  task_id: string
  project_id?: string | null
  user_id?: string
  summary?: string | null
  why_it_matters?: string | null
  success_criteria?: unknown
  current_stakes?: TaskContext['currentStakes']
  urgency_window?: TaskContext['urgencyWindow']
  selection_hints?: unknown
  non_goals?: unknown
  user_corrections?: unknown
  confidence?: number
  completeness_score?: number
  last_confirmed_at?: string | null
  last_updated_at?: string | null
  stale_after?: string | null
}

type AIContextEntityRow = {
  id?: string
  entity_key: string
  entity_type: AIContextEntity['entityType']
  display_name: string
  canonical_project_id?: string | null
  canonical_task_id?: string | null
  summary?: string | null
  facts?: Record<string, unknown> | null
  corrections?: unknown
  confidence?: number
  completeness_score?: number
  last_asked_at?: string | null
  last_answered_at?: string | null
  ask_count?: number
  stale_after?: string | null
  memory_type?: AIContextEntity['memoryType']
  scope?: AIContextEntity['scope']
  reinforcement_count?: number
  last_reinforced_at?: string | null
  related_entities?: unknown
  decay_score?: number | null
}

type AIClarificationEventRow = {
  id?: string
  entity_key: string
  entity_type: AIClarificationEvent['entityType']
  question_id: string
  event_type: AIClarificationEvent['eventType']
  question?: string | null
  selected_option_id?: string | null
  selected_label?: string | null
  free_text?: string | null
  memory_patch?: AIMemoryPatch | null
  source_message_id?: string | null
  coverage_score_at_time?: number | null
  uncertainty_dimensions?: unknown
  path_type?: AIClarificationEvent['pathType']
  context_snapshot?: Record<string, unknown> | null
  created_at?: string | null
}

type AIRecommendationFeedbackRow = {
  id?: string
  generated_plan_id?: string | null
  recommendation_id: string
  task_id?: string | null
  entity_key?: string | null
  action: AIRecommendationFeedback['action']
  reason_category?: AIRecommendationFeedback['reasonCategory'] | null
  free_text?: string | null
  revisit_at?: string | null
  outcome_signals?: Record<string, unknown> | null
  implicit_positive?: boolean
  source_message_id?: string | null
  created_at?: string | null
}

type AIParameterBeliefRow = {
  id?: string
  entity_key: string
  entity_type: AIParameterBelief['entityType']
  parameter_key: string
  belief_json?: Record<string, unknown> | null
  confidence?: number
  impact_weight?: number
  last_answered_at?: string | null
  source_question_id?: string | null
  source_event_id?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type AIContextEdgeRow = {
  id?: string
  source_entity_key: string
  target_entity_key: string
  relation_type: AIContextEdge['relationType']
  confidence?: number
  evidence?: Record<string, unknown> | null
  source_event_id?: string | null
  valid_from?: string | null
  valid_until?: string | null
  created_at?: string | null
}

type AIMemorySnapshotRow = {
  id?: string
  snapshot_key: string
  scope: AIMemorySnapshot['scope']
  entity_keys?: unknown
  summary_text: string
  facts?: Record<string, unknown> | null
  source_event_count?: number
  source_entity_count?: number
  confidence?: number
  stale_after?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type PendingAIMemoryWrite =
  | { kind: 'clarification_event'; input: AIClarificationEventInput; queuedAt: string; attempts: number }
  | { kind: 'recommendation_feedback'; input: AIRecommendationFeedbackInput; queuedAt: string; attempts: number }
  | { kind: 'parameter_belief'; input: AIParameterBeliefInput; queuedAt: string; attempts: number }
  | { kind: 'context_edges'; input: AIContextEdgeInput[]; queuedAt: string; attempts: number }

type AIMemoryWriteOptions = {
  skipQueue?: boolean
}

const pendingAIMemoryWrites: PendingAIMemoryWrite[] = []
let isFlushingPendingAIMemoryWrites = false
const MAX_PENDING_AI_MEMORY_WRITES = 80
const LOCAL_AI_CLARIFICATION_MEMORY_KEY = 'flowstate-ai-clarification-local-memory-v1'

type LocalAIClarificationMemory = {
  contextEntities?: AIContextEntity[]
  events: AIClarificationEvent[]
  parameterBeliefs: AIParameterBelief[]
  recommendationFeedback?: AIRecommendationFeedback[]
}

const PROJECT_FIELD_MAP: Record<string, keyof ProjectContextRow> = {
  summary: 'summary',
  domain: 'domain',
  lifeArea: 'life_area',
  whyItMatters: 'why_it_matters',
  successCriteria: 'success_criteria',
  failureRisks: 'failure_risks',
  currentStakes: 'current_stakes',
  urgencyWindow: 'urgency_window',
  preferredCadence: 'preferred_cadence',
  taskSelectionHints: 'task_selection_hints',
  nonGoals: 'non_goals',
  userCorrections: 'user_corrections',
  confidence: 'confidence',
  completenessScore: 'completeness_score',
  lastConfirmedAt: 'last_confirmed_at',
  staleAfter: 'stale_after',
}

const TASK_FIELD_MAP: Record<string, keyof TaskContextRow> = {
  projectId: 'project_id',
  summary: 'summary',
  whyItMatters: 'why_it_matters',
  successCriteria: 'success_criteria',
  currentStakes: 'current_stakes',
  urgencyWindow: 'urgency_window',
  selectionHints: 'selection_hints',
  nonGoals: 'non_goals',
  userCorrections: 'user_corrections',
  confidence: 'confidence',
  completenessScore: 'completeness_score',
  lastConfirmedAt: 'last_confirmed_at',
  staleAfter: 'stale_after',
}

const PROJECT_ARRAY_FIELDS = new Set<keyof ProjectContextRow>([
  'success_criteria',
  'failure_risks',
  'task_selection_hints',
  'non_goals',
  'user_corrections',
])

const TASK_ARRAY_FIELDS = new Set<keyof TaskContextRow>([
  'success_criteria',
  'selection_hints',
  'non_goals',
  'user_corrections',
])

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

function toProjectContext(row: ProjectContextRow): ProjectContext {
  return {
    projectId: row.project_id,
    userId: row.user_id,
    summary: row.summary ?? null,
    domain: row.domain ?? 'unknown',
    lifeArea: row.life_area ?? null,
    whyItMatters: row.why_it_matters ?? null,
    successCriteria: stringArray(row.success_criteria),
    failureRisks: stringArray(row.failure_risks),
    currentStakes: row.current_stakes ?? 'unknown',
    urgencyWindow: row.urgency_window ?? 'unknown',
    preferredCadence: row.preferred_cadence ?? null,
    taskSelectionHints: stringArray(row.task_selection_hints),
    nonGoals: stringArray(row.non_goals),
    userCorrections: stringArray(row.user_corrections),
    confidence: Number(row.confidence ?? 0),
    completenessScore: Number(row.completeness_score ?? 0),
    lastConfirmedAt: row.last_confirmed_at ?? null,
    lastUpdatedAt: row.last_updated_at ?? null,
    staleAfter: row.stale_after ?? null,
  }
}

function toTaskContext(row: TaskContextRow): TaskContext {
  return {
    taskId: row.task_id,
    projectId: row.project_id ?? null,
    userId: row.user_id,
    summary: row.summary ?? null,
    whyItMatters: row.why_it_matters ?? null,
    successCriteria: stringArray(row.success_criteria),
    currentStakes: row.current_stakes ?? 'unknown',
    urgencyWindow: row.urgency_window ?? 'unknown',
    selectionHints: stringArray(row.selection_hints),
    nonGoals: stringArray(row.non_goals),
    userCorrections: stringArray(row.user_corrections),
    confidence: Number(row.confidence ?? 0),
    completenessScore: Number(row.completeness_score ?? 0),
    lastConfirmedAt: row.last_confirmed_at ?? null,
    lastUpdatedAt: row.last_updated_at ?? null,
    staleAfter: row.stale_after ?? null,
  }
}

function toAIContextEntity(row: AIContextEntityRow): AIContextEntity {
  return {
    id: row.id,
    entityKey: row.entity_key,
    entityType: row.entity_type,
    displayName: row.display_name,
    canonicalProjectId: row.canonical_project_id ?? null,
    canonicalTaskId: row.canonical_task_id ?? null,
    summary: row.summary ?? null,
    facts: row.facts ?? {},
    corrections: stringArray(row.corrections),
    confidence: Number(row.confidence ?? 0),
    completenessScore: Number(row.completeness_score ?? 0),
    lastAskedAt: row.last_asked_at ?? null,
    lastAnsweredAt: row.last_answered_at ?? null,
    askCount: Number(row.ask_count ?? 0),
    staleAfter: row.stale_after ?? null,
    memoryType: row.memory_type ?? null,
    scope: row.scope ?? null,
    reinforcementCount: Number(row.reinforcement_count ?? 0),
    lastReinforcedAt: row.last_reinforced_at ?? null,
    relatedEntities: stringArray(row.related_entities),
    decayScore: typeof row.decay_score === 'number' ? row.decay_score : row.decay_score == null ? null : Number(row.decay_score),
  }
}

function toAIClarificationEvent(row: AIClarificationEventRow): AIClarificationEvent {
  return {
    id: row.id,
    entityKey: row.entity_key,
    entityType: row.entity_type,
    questionId: row.question_id,
    eventType: row.event_type,
    question: row.question ?? null,
    selectedOptionId: row.selected_option_id ?? null,
    selectedLabel: row.selected_label ?? null,
    freeText: row.free_text ?? null,
    memoryPatch: row.memory_patch ?? null,
    sourceMessageId: row.source_message_id ?? null,
    coverageScoreAtTime: row.coverage_score_at_time == null ? null : Number(row.coverage_score_at_time),
    uncertaintyDimensions: stringArray(row.uncertainty_dimensions) as AIClarificationEvent['uncertaintyDimensions'],
    pathType: row.path_type ?? null,
    contextSnapshot: row.context_snapshot ?? null,
    createdAt: row.created_at ?? null,
  }
}

function toAIRecommendationFeedback(row: AIRecommendationFeedbackRow): AIRecommendationFeedback {
  return {
    id: row.id,
    generatedPlanId: row.generated_plan_id ?? null,
    recommendationId: row.recommendation_id,
    taskId: row.task_id ?? null,
    entityKey: row.entity_key ?? null,
    action: row.action,
    reasonCategory: row.reason_category ?? null,
    freeText: row.free_text ?? null,
    revisitAt: row.revisit_at ?? null,
    outcomeSignals: row.outcome_signals ?? {},
    implicitPositive: Boolean(row.implicit_positive),
    sourceMessageId: row.source_message_id ?? null,
    createdAt: row.created_at ?? null,
  }
}

function toAIParameterBelief(row: AIParameterBeliefRow): AIParameterBelief {
  return {
    id: row.id,
    entityKey: row.entity_key,
    entityType: row.entity_type,
    parameterKey: row.parameter_key,
    beliefJson: row.belief_json ?? {},
    confidence: Number(row.confidence ?? 0),
    impactWeight: Number(row.impact_weight ?? 0.5),
    lastAnsweredAt: row.last_answered_at ?? null,
    sourceQuestionId: row.source_question_id ?? null,
    sourceEventId: row.source_event_id ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

function toAIMemorySnapshot(row: AIMemorySnapshotRow): AIMemorySnapshot {
  return {
    id: row.id,
    snapshotKey: row.snapshot_key,
    scope: row.scope,
    entityKeys: stringArray(row.entity_keys),
    summaryText: row.summary_text,
    facts: row.facts ?? {},
    sourceEventCount: Number(row.source_event_count ?? 0),
    sourceEntityCount: Number(row.source_entity_count ?? 0),
    confidence: Number(row.confidence ?? 0.5),
    staleAfter: row.stale_after ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

function readLocalAIClarificationMemory(): LocalAIClarificationMemory {
  if (typeof localStorage === 'undefined') return { contextEntities: [], events: [], parameterBeliefs: [], recommendationFeedback: [] }
  try {
    const raw = localStorage.getItem(LOCAL_AI_CLARIFICATION_MEMORY_KEY)
    if (!raw) return { contextEntities: [], events: [], parameterBeliefs: [], recommendationFeedback: [] }
    const parsed = JSON.parse(raw) as Partial<LocalAIClarificationMemory>
    return {
      contextEntities: Array.isArray(parsed.contextEntities) ? parsed.contextEntities : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      parameterBeliefs: Array.isArray(parsed.parameterBeliefs) ? parsed.parameterBeliefs : [],
      recommendationFeedback: Array.isArray(parsed.recommendationFeedback) ? parsed.recommendationFeedback : [],
    }
  } catch {
    return { contextEntities: [], events: [], parameterBeliefs: [], recommendationFeedback: [] }
  }
}

function writeLocalAIClarificationMemory(memory: LocalAIClarificationMemory) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LOCAL_AI_CLARIFICATION_MEMORY_KEY, JSON.stringify({
    contextEntities: (memory.contextEntities ?? []).slice(0, 80),
    events: memory.events.slice(0, 80),
    parameterBeliefs: memory.parameterBeliefs.slice(0, 80),
    recommendationFeedback: (memory.recommendationFeedback ?? []).slice(0, 80),
  }))
}

function clearLocalAIClarificationMemory() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(LOCAL_AI_CLARIFICATION_MEMORY_KEY)
}

function localAIClarificationEvent(input: AIClarificationEventInput, now: string): AIClarificationEvent {
  return {
    id: `local-${now}-${input.questionId}`,
    entityKey: input.entityKey,
    entityType: input.entityType,
    questionId: input.questionId,
    eventType: input.eventType,
    question: input.question ?? null,
    selectedOptionId: input.selectedOptionId ?? null,
    selectedLabel: input.selectedLabel ?? null,
    freeText: input.freeText ?? null,
    memoryPatch: input.memoryPatch ?? null,
    sourceMessageId: input.sourceMessageId ?? null,
    coverageScoreAtTime: input.coverageScoreAtTime ?? null,
    uncertaintyDimensions: input.uncertaintyDimensions ?? null,
    pathType: input.pathType ?? null,
    contextSnapshot: input.contextSnapshot ?? null,
    createdAt: now,
  }
}

function localAIParameterBeliefsFromClarification(input: AIClarificationEventInput, now: string): AIParameterBelief[] {
  return beliefInputsFromClarification(input).map(belief => ({
    id: `local-${now}-${belief.entityKey}-${belief.parameterKey}`,
    entityKey: belief.entityKey,
    entityType: belief.entityType,
    parameterKey: belief.parameterKey,
    beliefJson: {
      value: belief.value,
      selectedLabel: belief.selectedLabel,
      freeText: belief.freeText,
      lastUpdated: now,
      evidence: belief.evidence ?? {},
    },
    confidence: belief.confidence ?? 0.78,
    impactWeight: belief.impactWeight ?? aiParameterImpactWeight(belief.parameterKey),
    lastAnsweredAt: now,
    sourceQuestionId: belief.sourceQuestionId ?? input.questionId,
    sourceEventId: belief.sourceEventId ?? null,
    createdAt: now,
    updatedAt: now,
  }))
}

function localAIContextEntityFromClarification(input: AIClarificationEventInput, existing: AIContextEntity | undefined, now: string): AIContextEntity {
  const answeredAt = input.eventType === 'answered' ? now : null
  const facts = mergeFactPatch(existing?.facts ?? {}, input.memoryPatch, input.freeText)
  const corrections = input.eventType === 'correction'
    ? uniqueStrings([...(existing?.corrections ?? []), input.freeText || input.selectedLabel || input.questionId])
    : existing?.corrections ?? []

  return {
    id: existing?.id ?? `local-entity-${input.entityKey}`,
    entityKey: input.entityKey,
    entityType: input.entityType,
    displayName: input.displayName,
    canonicalProjectId: existing?.canonicalProjectId ?? null,
    canonicalTaskId: existing?.canonicalTaskId ?? null,
    summary: typeof facts.whyItMatters === 'string' ? facts.whyItMatters : existing?.summary ?? null,
    facts,
    corrections,
    confidence: Math.max(existing?.confidence ?? 0, input.eventType === 'answered' ? 0.85 : 0.4),
    completenessScore: computeAIEntityCompleteness(facts),
    lastAskedAt: input.eventType === 'asked' ? now : existing?.lastAskedAt ?? null,
    lastAnsweredAt: answeredAt ?? existing?.lastAnsweredAt ?? null,
    askCount: (existing?.askCount ?? 0) + (input.eventType === 'asked' ? 1 : 0),
    staleAfter: answeredAt ? nextStaleAfterIso(answeredAt) : existing?.staleAfter ?? null,
    memoryType: existing?.memoryType ?? (input.entityType === 'preference' ? 'preference' : 'semantic'),
    scope: existing?.scope ?? aiEntityScope(input.entityType),
    reinforcementCount: (existing?.reinforcementCount ?? 0) + (answeredAt ? 1 : 0),
    lastReinforcedAt: answeredAt ?? existing?.lastReinforcedAt ?? null,
    relatedEntities: existing?.relatedEntities ?? [],
    decayScore: answeredAt ? 1 : existing?.decayScore ?? null,
  }
}

function recordLocalAIClarificationEvent(input: AIClarificationEventInput) {
  const now = new Date().toISOString()
  const memory = readLocalAIClarificationMemory()
  const event = localAIClarificationEvent(input, now)
  const nextEntitiesByKey = new Map((memory.contextEntities ?? []).map(entity => [entity.entityKey, entity]))
  nextEntitiesByKey.set(input.entityKey, localAIContextEntityFromClarification(input, nextEntitiesByKey.get(input.entityKey), now))
  const nextBeliefsByKey = new Map(memory.parameterBeliefs.map(belief => [`${belief.entityKey}:${belief.parameterKey}`, belief]))
  for (const belief of localAIParameterBeliefsFromClarification(input, now)) {
    const key = `${belief.entityKey}:${belief.parameterKey}`
    const existing = nextBeliefsByKey.get(key)
    nextBeliefsByKey.set(key, existing && existing.confidence > belief.confidence ? existing : belief)
  }
  writeLocalAIClarificationMemory({
    contextEntities: [...nextEntitiesByKey.values()]
      .sort((a, b) => new Date(b.lastAnsweredAt ?? b.lastAskedAt ?? 0).getTime() - new Date(a.lastAnsweredAt ?? a.lastAskedAt ?? 0).getTime())
      .slice(0, 80),
    events: [event, ...memory.events].slice(0, 80),
    parameterBeliefs: [...nextBeliefsByKey.values()]
      .sort((a, b) => new Date(b.updatedAt ?? b.lastAnsweredAt ?? 0).getTime() - new Date(a.updatedAt ?? a.lastAnsweredAt ?? 0).getTime())
      .slice(0, 80),
    recommendationFeedback: memory.recommendationFeedback ?? [],
  })
}

function localAIContextEntities(entityKeys: string[]): AIContextEntity[] {
  const keys = new Set(uniqueStrings(entityKeys))
  if (!keys.size) return []
  return (readLocalAIClarificationMemory().contextEntities ?? [])
    .filter(entity => keys.has(entity.entityKey))
}

function localAIClarificationEvents(entityKeys: string[], limit: number): AIClarificationEvent[] {
  const keys = new Set(entityKeys)
  return readLocalAIClarificationMemory().events
    .filter(event => keys.has(event.entityKey))
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, limit)
}

function localAIParameterBeliefs(input: { entityKeys?: string[]; parameterKeys?: string[]; limit?: number }): AIParameterBelief[] {
  const entityKeys = new Set(uniqueStrings(input.entityKeys ?? []))
  const parameterKeys = new Set(uniqueStrings(input.parameterKeys ?? []))
  return readLocalAIClarificationMemory().parameterBeliefs
    .filter(belief => (!entityKeys.size || entityKeys.has(belief.entityKey)) && (!parameterKeys.size || parameterKeys.has(belief.parameterKey)))
    .sort((a, b) => new Date(b.updatedAt ?? b.lastAnsweredAt ?? 0).getTime() - new Date(a.updatedAt ?? a.lastAnsweredAt ?? 0).getTime())
    .slice(0, input.limit ?? 80)
}

function localAIRecommendationFeedback(input: { taskIds?: string[]; entityKeys?: string[]; limit?: number }): AIRecommendationFeedback[] {
  const taskIds = new Set(uniqueStrings(input.taskIds ?? []))
  const entityKeys = new Set(uniqueStrings(input.entityKeys ?? []))
  return (readLocalAIClarificationMemory().recommendationFeedback ?? [])
    .filter(feedback => {
      const taskMatch = Boolean(feedback.taskId && taskIds.has(feedback.taskId))
      const entityMatch = Boolean(feedback.entityKey && entityKeys.has(feedback.entityKey))
      return (!taskIds.size && !entityKeys.size) || taskMatch || entityMatch
    })
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, input.limit ?? 80)
}

function localAIRecommendationFeedbackEvent(input: AIRecommendationFeedbackInput, now: string): AIRecommendationFeedback {
  return {
    id: `local-${now}-${input.recommendationId}-${input.action}`,
    generatedPlanId: input.generatedPlanId ?? null,
    recommendationId: input.recommendationId,
    taskId: input.taskId ?? null,
    entityKey: input.entityKey ?? null,
    action: input.action,
    reasonCategory: input.reasonCategory ?? null,
    freeText: input.freeText ?? null,
    revisitAt: input.revisitAt ?? null,
    outcomeSignals: input.outcomeSignals ?? {},
    implicitPositive: Boolean(input.implicitPositive),
    sourceMessageId: input.sourceMessageId ?? null,
    createdAt: now,
  }
}

function localAIParameterBeliefsFromRecommendationFeedback(input: AIRecommendationFeedbackInput, now: string): AIParameterBelief[] {
  return beliefInputsFromRecommendationFeedback(input).map(belief => localAIParameterBeliefFromInput(belief, now))
}

function recordLocalAIRecommendationFeedback(input: AIRecommendationFeedbackInput) {
  const now = new Date().toISOString()
  const memory = readLocalAIClarificationMemory()
  const feedback = localAIRecommendationFeedbackEvent(input, now)
  const nextBeliefsByKey = new Map(memory.parameterBeliefs.map(belief => [`${belief.entityKey}:${belief.parameterKey}`, belief]))
  const aggregateInputs = aggregateBeliefInputsFromRecommendationFeedback(input, [
    feedback,
    ...(memory.recommendationFeedback ?? []),
  ])
  for (const belief of [
    ...localAIParameterBeliefsFromRecommendationFeedback(input, now),
    ...aggregateInputs.map(aggregate => localAIParameterBeliefFromInput(aggregate, now)),
  ]) {
    const key = `${belief.entityKey}:${belief.parameterKey}`
    const existing = nextBeliefsByKey.get(key)
    nextBeliefsByKey.set(key, existing && existing.confidence > belief.confidence ? existing : belief)
  }
  writeLocalAIClarificationMemory({
    events: memory.events,
    parameterBeliefs: [...nextBeliefsByKey.values()]
      .sort((a, b) => new Date(b.updatedAt ?? b.lastAnsweredAt ?? 0).getTime() - new Date(a.updatedAt ?? a.lastAnsweredAt ?? 0).getTime())
      .slice(0, 80),
    recommendationFeedback: [feedback, ...(memory.recommendationFeedback ?? [])].slice(0, 80),
  })
}

function localAIParameterBeliefFromInput(input: AIParameterBeliefInput, now: string): AIParameterBelief {
  return {
    id: `local-${now}-${input.entityKey}-${input.parameterKey}`,
    entityKey: input.entityKey,
    entityType: input.entityType,
    parameterKey: input.parameterKey,
    beliefJson: {
      value: input.value,
      selectedLabel: input.selectedLabel,
      freeText: input.freeText,
      lastUpdated: now,
      evidence: input.evidence ?? {},
    },
    confidence: input.confidence ?? Math.min(1, 0.55 + (input.confidenceBoost ?? 0)),
    impactWeight: input.impactWeight ?? aiParameterImpactWeight(input.parameterKey),
    lastAnsweredAt: now,
    sourceQuestionId: input.sourceQuestionId ?? null,
    sourceEventId: input.sourceEventId ?? null,
    createdAt: now,
    updatedAt: now,
  }
}

function recordLocalAIParameterBelief(input: AIParameterBeliefInput) {
  const now = new Date().toISOString()
  const memory = readLocalAIClarificationMemory()
  const nextBelief = localAIParameterBeliefFromInput(input, now)
  const nextBeliefsByKey = new Map(memory.parameterBeliefs.map(belief => [`${belief.entityKey}:${belief.parameterKey}`, belief]))
  const key = `${nextBelief.entityKey}:${nextBelief.parameterKey}`
  const existing = nextBeliefsByKey.get(key)
  nextBeliefsByKey.set(key, existing && existing.confidence > nextBelief.confidence ? existing : nextBelief)
  writeLocalAIClarificationMemory({
    ...memory,
    parameterBeliefs: [...nextBeliefsByKey.values()]
      .sort((a, b) => new Date(b.updatedAt ?? b.lastAnsweredAt ?? 0).getTime() - new Date(a.updatedAt ?? a.lastAnsweredAt ?? 0).getTime())
      .slice(0, 80),
  })
}

function toAIContextEdge(row: AIContextEdgeRow): AIContextEdge {
  return {
    id: row.id,
    sourceEntityKey: row.source_entity_key,
    targetEntityKey: row.target_entity_key,
    relationType: row.relation_type,
    confidence: Number(row.confidence ?? 0.5),
    evidence: row.evidence ?? {},
    sourceEventId: row.source_event_id ?? null,
    validFrom: row.valid_from ?? null,
    validUntil: row.valid_until ?? null,
    createdAt: row.created_at ?? null,
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function isSupabaseUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isAIMemorySchemaMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
  return (
    code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('Could not find the table') ||
    message.includes('ai_context_entities') ||
    message.includes('ai_clarification_events') ||
    message.includes('ai_recommendation_feedback') ||
    message.includes('ai_context_edges') ||
    message.includes('ai_parameter_beliefs') ||
    message.includes('ai_memory_snapshots')
  )
}

function logMissingAIMemorySchema(context: string): void {
  console.debug(`[AIMemory] ${context} skipped because AI memory migrations are not applied yet.`)
}

function pendingAIMemoryWriteKey(write: PendingAIMemoryWrite): string {
  if (write.kind === 'clarification_event') {
    return `${write.kind}:${write.input.entityKey}:${write.input.questionId}:${write.input.eventType}:${write.input.sourceMessageId ?? ''}:${write.input.selectedOptionId ?? ''}:${write.input.freeText ?? ''}`
  }
  if (write.kind === 'recommendation_feedback') {
    return `${write.kind}:${write.input.recommendationId}:${write.input.taskId ?? ''}:${write.input.entityKey ?? ''}:${write.input.action}:${write.input.sourceMessageId ?? ''}`
  }
  if (write.kind === 'parameter_belief') {
    return `${write.kind}:${write.input.entityKey}:${write.input.parameterKey}:${write.input.sourceQuestionId ?? ''}`
  }
  return `${write.kind}:${write.input.map(edge => `${edge.sourceEntityKey}>${edge.relationType}>${edge.targetEntityKey}`).sort().join('|')}`
}

function enqueuePendingAIMemoryWrite(write: PendingAIMemoryWrite): void {
  const key = pendingAIMemoryWriteKey(write)
  const existing = pendingAIMemoryWrites.findIndex(item => pendingAIMemoryWriteKey(item) === key)
  if (existing >= 0) {
    pendingAIMemoryWrites[existing] = {
      ...write,
      attempts: pendingAIMemoryWrites[existing].attempts,
      queuedAt: pendingAIMemoryWrites[existing].queuedAt,
    } as PendingAIMemoryWrite
    return
  }
  pendingAIMemoryWrites.push(write)
  if (pendingAIMemoryWrites.length > MAX_PENDING_AI_MEMORY_WRITES) {
    pendingAIMemoryWrites.splice(0, pendingAIMemoryWrites.length - MAX_PENDING_AI_MEMORY_WRITES)
  }
}

export function getPendingAIMemoryWriteCount(): number {
  return pendingAIMemoryWrites.length
}

export function clearPendingAIMemoryWritesForTest(): void {
  pendingAIMemoryWrites.splice(0, pendingAIMemoryWrites.length)
  isFlushingPendingAIMemoryWrites = false
}

function computeProjectCompleteness(row: ProjectContextRow): number {
  const filled = [
    Boolean(row.summary),
    row.domain && row.domain !== 'unknown',
    Boolean(row.why_it_matters),
    stringArray(row.success_criteria).length > 0,
    row.current_stakes && row.current_stakes !== 'unknown',
    row.urgency_window && row.urgency_window !== 'unknown',
  ].filter(Boolean).length
  return Number((filled / 6).toFixed(3))
}

function computeTaskCompleteness(row: TaskContextRow): number {
  const filled = [
    Boolean(row.summary),
    Boolean(row.why_it_matters),
    stringArray(row.success_criteria).length > 0,
    row.current_stakes && row.current_stakes !== 'unknown',
    row.urgency_window && row.urgency_window !== 'unknown',
  ].filter(Boolean).length
  return Number((filled / 5).toFixed(3))
}

function computeAIEntityCompleteness(facts: Record<string, unknown>): number {
  const filled = [
    facts.domain,
    facts.whyItMatters,
    facts.successCriteria,
    facts.currentStakes,
    facts.urgencyWindow,
    facts.thisWeekImportance,
  ].filter(value => Array.isArray(value) ? value.length > 0 : Boolean(value)).length
  return Number((filled / 6).toFixed(3))
}

function mergeFactPatch(facts: Record<string, unknown>, patch?: AIMemoryPatch, freeText?: string): Record<string, unknown> {
  const next = { ...facts }
  if (patch) {
    if (patch.operation === 'append') {
      const current = Array.isArray(next[patch.field]) ? next[patch.field] as unknown[] : []
      next[patch.field] = uniqueStrings([...current.map(String), String(patch.value)])
    } else if (patch.operation === 'reject') {
      const current = Array.isArray(next.userCorrections) ? next.userCorrections as unknown[] : []
      next.userCorrections = uniqueStrings([...current.map(String), `Rejected: ${String(patch.value)}`])
    } else if (patch.operation === 'deprecate') {
      const current = Array.isArray(next.deprecated) ? next.deprecated as unknown[] : []
      next.deprecated = uniqueStrings([...current.map(String), `${patch.field}: ${String(patch.value)}`])
    } else if (patch.operation !== 'confirm') {
      next[patch.field] = patch.value
    }
  }
  if (freeText) next.whyItMatters = freeText
  return next
}

function aiEntityScope(entityType: AIContextEntity['entityType']): AIContextEntity['scope'] {
  if (entityType === 'project' || entityType === 'synthetic_group') return 'project'
  if (entityType === 'task') return 'task'
  if (entityType === 'week') return 'week'
  if (entityType === 'workflow') return 'workflow'
  return 'user'
}

function aiParameterImpactWeight(parameterKey: string): number {
  if (['project_meaning', 'impact', 'whyItMatters', 'currentStakes'].includes(parameterKey)) return 0.85
  if (['dependencies', 'stakeholders', 'successCriteria', 'failureRisks'].includes(parameterKey)) return 0.75
  if (['energy_fit', 'preferences', 'taskSelectionHints', 'rankingFocus'].includes(parameterKey)) return 0.65
  if (['history', 'task_context', 'stale_context'].includes(parameterKey)) return 0.55
  return 0.5
}

function nextStaleAfterIso(answeredAtIso: string): string {
  const answeredAtMs = Date.parse(answeredAtIso)
  const baseMs = Number.isFinite(answeredAtMs) ? answeredAtMs : Date.now()
  return new Date(baseMs + 45 * 24 * 60 * 60 * 1000).toISOString()
}

function beliefInputsFromClarification(input: AIClarificationEventInput): AIParameterBeliefInput[] {
  if (input.eventType !== 'answered') return []
  const parameterKeys = uniqueStrings([
    ...(input.uncertaintyDimensions ?? []),
    input.memoryPatch?.field ?? '',
  ])
  if (!parameterKeys.length) return []
  return parameterKeys.map(parameterKey => ({
    entityKey: input.entityKey,
    entityType: input.entityType,
    parameterKey,
    value: input.memoryPatch?.field === parameterKey ? input.memoryPatch.value : input.selectedLabel ?? input.freeText,
    selectedLabel: input.selectedLabel,
    freeText: input.freeText,
    confidence: input.memoryPatch?.confidence ?? (input.freeText ? 0.9 : 0.78),
    impactWeight: aiParameterImpactWeight(parameterKey),
    sourceQuestionId: input.questionId,
    evidence: {
      question: input.question,
      selectedOptionId: input.selectedOptionId,
      sourceMessageId: input.sourceMessageId,
      pathType: input.pathType,
    },
  }))
}

function beliefInputsFromRecommendationFeedback(input: AIRecommendationFeedbackInput): AIParameterBeliefInput[] {
  const targetEntityKey = input.entityKey || (input.taskId ? `task:${input.taskId}` : `recommendation:${input.recommendationId}`)
  const evidence = {
    recommendationId: input.recommendationId,
    action: input.action,
    reasonCategory: input.reasonCategory,
    revisitAt: input.revisitAt,
    sourceMessageId: input.sourceMessageId,
  }
  const beliefs: AIParameterBeliefInput[] = []
  if (input.action === 'simplify' || input.reasonCategory === 'too_much') {
    beliefs.push({
      entityKey: 'preference:brevity',
      entityType: 'preference',
      parameterKey: 'preferences',
      value: 'User prefers shorter AI planning answers when recommendations feel like too much.',
      confidenceBoost: 0.2,
      impactWeight: aiParameterImpactWeight('preferences'),
      sourceQuestionId: 'recommendation_feedback:simplify',
      evidence,
    })
  }
  if (input.reasonCategory === 'low_energy' || input.reasonCategory === 'too_hard') {
    beliefs.push({
      entityKey: targetEntityKey,
      entityType: input.taskId ? 'task' : 'workflow',
      parameterKey: 'energy_fit',
      value: `Recommendation was ${input.action} because ${input.reasonCategory}.`,
      confidenceBoost: 0.2,
      impactWeight: aiParameterImpactWeight('energy_fit'),
      sourceQuestionId: 'recommendation_feedback:energy_fit',
      evidence,
    })
  }
  if (input.reasonCategory === 'not_important' || input.reasonCategory === 'wrong_context' || input.reasonCategory === 'needs_more_info') {
    beliefs.push({
      entityKey: targetEntityKey,
      entityType: input.taskId ? 'task' : 'workflow',
      parameterKey: 'rankingFocus',
      value: `Recommendation was ${input.action} because ${input.reasonCategory}; reduce similar ranking weight until context changes.`,
      confidenceBoost: 0.25,
      impactWeight: aiParameterImpactWeight('rankingFocus'),
      sourceQuestionId: 'recommendation_feedback:ranking_focus',
      evidence,
    })
  }
  if (input.implicitPositive || input.action === 'accept' || input.action === 'timeblock') {
    beliefs.push({
      entityKey: targetEntityKey,
      entityType: input.taskId ? 'task' : 'workflow',
      parameterKey: 'history',
      value: `User ${input.action}ed this recommendation; treat similar suggestions as a positive signal.`,
      confidenceBoost: 0.18,
      impactWeight: aiParameterImpactWeight('history'),
      sourceQuestionId: 'recommendation_feedback:positive_signal',
      evidence,
    })
  }
  return beliefs
}

type RecommendationFeedbackAggregate = {
  entityKey: string
  entityType: AIParameterBeliefInput['entityType']
  parameterKey: string
  sourceQuestionId: string
  value: string
  match: (feedback: Pick<AIRecommendationFeedback, 'action' | 'reasonCategory' | 'implicitPositive'>) => boolean
}

function recommendationFeedbackAggregate(input: AIRecommendationFeedbackInput): RecommendationFeedbackAggregate | null {
  if (input.action === 'simplify' || input.reasonCategory === 'too_much') {
    return {
      entityKey: 'preference:brevity',
      entityType: 'preference',
      parameterKey: 'preferences',
      sourceQuestionId: 'recommendation_feedback:aggregate:brevity',
      value: 'Repeated feedback says AI planning answers should stay shorter and show fewer recommendations by default.',
      match: feedback => feedback.action === 'simplify' || feedback.reasonCategory === 'too_much',
    }
  }
  if (input.reasonCategory === 'low_energy' || input.reasonCategory === 'too_hard') {
    return {
      entityKey: 'preference:energy_fit',
      entityType: 'preference',
      parameterKey: 'energy_fit',
      sourceQuestionId: 'recommendation_feedback:aggregate:energy_fit',
      value: 'Repeated feedback says recommendations should account for energy and task difficulty before ranking.',
      match: feedback => feedback.reasonCategory === 'low_energy' || feedback.reasonCategory === 'too_hard',
    }
  }
  if (input.reasonCategory === 'not_important' || input.reasonCategory === 'wrong_context' || input.reasonCategory === 'needs_more_info') {
    return {
      entityKey: 'preference:ranking_focus',
      entityType: 'preference',
      parameterKey: 'rankingFocus',
      sourceQuestionId: 'recommendation_feedback:aggregate:ranking_focus',
      value: 'Repeated feedback says weak-context recommendations should be downranked until importance or context is confirmed.',
      match: feedback => feedback.reasonCategory === 'not_important' || feedback.reasonCategory === 'wrong_context' || feedback.reasonCategory === 'needs_more_info',
    }
  }
  if (input.implicitPositive || input.action === 'accept' || input.action === 'timeblock') {
    return {
      entityKey: 'preference:follow_through',
      entityType: 'preference',
      parameterKey: 'history',
      sourceQuestionId: 'recommendation_feedback:aggregate:positive_signal',
      value: 'Repeated accept/time-block feedback is a positive follow-through signal for similar recommendations.',
      match: feedback => Boolean(feedback.implicitPositive) || feedback.action === 'accept' || feedback.action === 'timeblock',
    }
  }
  return null
}

function aggregateBeliefInputsFromRecommendationFeedback(
  input: AIRecommendationFeedbackInput,
  recentFeedback: AIRecommendationFeedback[],
): AIParameterBeliefInput[] {
  const aggregate = recommendationFeedbackAggregate(input)
  if (!aggregate) return []
  const matching = recentFeedback.filter(aggregate.match)
  if (matching.length < 3) return []
  const reasonCounts = matching.reduce<Record<string, number>>((counts, feedback) => {
    const key = feedback.reasonCategory || feedback.action
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
  return [{
    entityKey: aggregate.entityKey,
    entityType: aggregate.entityType,
    parameterKey: aggregate.parameterKey,
    value: aggregate.value,
    confidence: Math.min(0.95, 0.82 + Math.max(0, matching.length - 3) * 0.03),
    impactWeight: aiParameterImpactWeight(aggregate.parameterKey),
    sourceQuestionId: aggregate.sourceQuestionId,
    evidence: {
      feedbackCount: matching.length,
      reasonCounts,
      latestRecommendationId: input.recommendationId,
      latestAction: input.action,
      latestReasonCategory: input.reasonCategory,
    },
  }]
}

function clarificationAnsweredRecently(events: AIClarificationEvent[], cooldownDays: number): boolean {
  const cutoff = Date.now() - cooldownDays * 24 * 60 * 60 * 1000
  return events.some(event =>
    ['answered', 'dismissed', 'generated_with_uncertainty', 'showed_candidates'].includes(event.eventType) &&
    event.createdAt &&
    new Date(event.createdAt).getTime() >= cutoff
  )
}

export function useAIMemoryDatabase(ctx: DatabaseContext) {
  const { authStore, isSyncing, getUserIdSafe, withRetry, handleError } = ctx

  const fetchProjectContexts = async (projectIds: string[]): Promise<ProjectContext[]> => {
    const ids = uniqueStrings(projectIds).filter(isSupabaseUuid)
    if (!ids.length) return []
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return []
    const cacheKey = `ai-memory:project:${userId}:${ids.sort().join(',')}`
    return swrCache.getOrFetch(cacheKey, async () => {
      try {
        return await withRetry(async () => {
          const { data, error } = await getSupabase()
            .from('project_contexts')
            .select('*')
            .eq('user_id', userId)
            .in('project_id', ids)
          if (error) throw error
          return ((data ?? []) as ProjectContextRow[]).map(toProjectContext)
        }, 'fetchProjectContexts')
      } catch (e) {
        handleError(e, 'fetchProjectContexts')
        return []
      }
    })
  }

  const fetchTaskContexts = async (taskIds: string[]): Promise<TaskContext[]> => {
    const ids = uniqueStrings(taskIds).filter(isSupabaseUuid)
    if (!ids.length) return []
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return []
    const cacheKey = `ai-memory:task:${userId}:${ids.sort().join(',')}`
    return swrCache.getOrFetch(cacheKey, async () => {
      try {
        return await withRetry(async () => {
          const { data, error } = await getSupabase()
            .from('task_contexts')
            .select('*')
            .eq('user_id', userId)
            .in('task_id', ids)
          if (error) throw error
          return ((data ?? []) as TaskContextRow[]).map(toTaskContext)
        }, 'fetchTaskContexts')
      } catch (e) {
        handleError(e, 'fetchTaskContexts')
        return []
      }
    })
  }

  const searchAIMemory = async (query: string, limit = 8): Promise<{ projects: ProjectContext[]; tasks: TaskContext[] }> => {
    const text = query.trim()
    if (!text) return { projects: [], tasks: [] }
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return { projects: [], tasks: [] }
    try {
      return await withRetry(async () => {
        const [projectResult, taskResult] = await Promise.all([
          getSupabase()
            .from('project_contexts')
            .select('*')
            .eq('user_id', userId)
            .textSearch('summary', text, { type: 'websearch' })
            .limit(limit),
          getSupabase()
            .from('task_contexts')
            .select('*')
            .eq('user_id', userId)
            .textSearch('summary', text, { type: 'websearch' })
            .limit(limit),
        ])
        if (projectResult.error) throw projectResult.error
        if (taskResult.error) throw taskResult.error
        return {
          projects: ((projectResult.data ?? []) as ProjectContextRow[]).map(toProjectContext),
          tasks: ((taskResult.data ?? []) as TaskContextRow[]).map(toTaskContext),
        }
      }, 'searchAIMemory')
    } catch (e) {
      handleError(e, 'searchAIMemory')
      return { projects: [], tasks: [] }
    }
  }

  const fetchAIContextEntities = async (entityKeys: string[]): Promise<AIContextEntity[]> => {
    const keys = uniqueStrings(entityKeys)
    if (!keys.length) return []
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return localAIContextEntities(keys)
    try {
      return await withRetry(async () => {
        const { data, error } = await getSupabase()
          .from('ai_context_entities')
          .select('*')
          .eq('user_id', userId)
          .in('entity_key', keys)
        if (error) throw error
        return ((data ?? []) as AIContextEntityRow[]).map(toAIContextEntity)
      }, 'fetchAIContextEntities')
    } catch (e) {
      if (isAIMemorySchemaMissing(e)) {
        logMissingAIMemorySchema('fetchAIContextEntities')
        return localAIContextEntities(keys)
      }
      handleError(e, 'fetchAIContextEntities')
      return []
    }
  }

  const fetchAIClarificationEvents = async (entityKeys: string[], limit = 20): Promise<AIClarificationEvent[]> => {
    const keys = uniqueStrings(entityKeys)
    if (!keys.length) return []
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return localAIClarificationEvents(keys, limit)
    try {
      return await withRetry(async () => {
        const { data, error } = await getSupabase()
          .from('ai_clarification_events')
          .select('*')
          .eq('user_id', userId)
          .in('entity_key', keys)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (error) throw error
        return ((data ?? []) as AIClarificationEventRow[]).map(toAIClarificationEvent)
      }, 'fetchAIClarificationEvents')
    } catch (e) {
      if (isAIMemorySchemaMissing(e)) {
        logMissingAIMemorySchema('fetchAIClarificationEvents')
        return localAIClarificationEvents(keys, limit)
      }
      handleError(e, 'fetchAIClarificationEvents')
      return []
    }
  }

  const fetchAIRecommendationFeedback = async (
    input: { taskIds?: string[]; entityKeys?: string[]; limit?: number },
  ): Promise<AIRecommendationFeedback[]> => {
    const taskIds = uniqueStrings(input.taskIds ?? []).filter(isSupabaseUuid)
    const entityKeys = uniqueStrings(input.entityKeys ?? [])
    if (!taskIds.length && !entityKeys.length) return []
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return localAIRecommendationFeedback({ taskIds: input.taskIds, entityKeys, limit: input.limit })
    const limit = input.limit ?? 80
    try {
      return await withRetry(async () => {
        const queries: Promise<{ data: unknown[] | null; error: unknown }>[] = []
        if (taskIds.length) {
          queries.push(getSupabase()
            .from('ai_recommendation_feedback')
            .select('*')
            .eq('user_id', userId)
            .in('task_id', taskIds)
            .order('created_at', { ascending: false })
            .limit(limit) as unknown as Promise<{ data: unknown[] | null; error: unknown }>)
        }
        if (entityKeys.length) {
          queries.push(getSupabase()
            .from('ai_recommendation_feedback')
            .select('*')
            .eq('user_id', userId)
            .in('entity_key', entityKeys)
            .order('created_at', { ascending: false })
            .limit(limit) as unknown as Promise<{ data: unknown[] | null; error: unknown }>)
        }
        const results = await Promise.all(queries)
        for (const result of results) {
          if (result.error) throw result.error
        }
        const byId = new Map<string, AIRecommendationFeedback>()
        for (const row of results.flatMap(result => result.data ?? [])) {
          const feedback = toAIRecommendationFeedback(row as AIRecommendationFeedbackRow)
          const key = feedback.id || `${feedback.recommendationId}:${feedback.taskId ?? ''}:${feedback.entityKey ?? ''}:${feedback.createdAt ?? ''}`
          byId.set(key, feedback)
        }
        return [...byId.values()]
          .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
          .slice(0, limit)
      }, 'fetchAIRecommendationFeedback')
    } catch (e) {
      if (isAIMemorySchemaMissing(e)) {
        logMissingAIMemorySchema('fetchAIRecommendationFeedback')
        return localAIRecommendationFeedback({ taskIds: input.taskIds, entityKeys, limit })
      }
      handleError(e, 'fetchAIRecommendationFeedback')
      return []
    }
  }

  const fetchAIParameterBeliefs = async (
    input: { entityKeys?: string[]; parameterKeys?: string[]; limit?: number },
  ): Promise<AIParameterBelief[]> => {
    const entityKeys = uniqueStrings(input.entityKeys ?? [])
    const parameterKeys = uniqueStrings(input.parameterKeys ?? [])
    if (!entityKeys.length && !parameterKeys.length) return []
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return localAIParameterBeliefs(input)
    const limit = input.limit ?? 80
    try {
      return await withRetry(async () => {
        let query = getSupabase()
          .from('ai_parameter_beliefs')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(limit)
        if (entityKeys.length) query = query.in('entity_key', entityKeys)
        if (parameterKeys.length) query = query.in('parameter_key', parameterKeys)
        const { data, error } = await query
        if (error) throw error
        return ((data ?? []) as AIParameterBeliefRow[]).map(toAIParameterBelief)
      }, 'fetchAIParameterBeliefs')
    } catch (e) {
      if (isAIMemorySchemaMissing(e)) {
        logMissingAIMemorySchema('fetchAIParameterBeliefs')
        return localAIParameterBeliefs(input)
      }
      handleError(e, 'fetchAIParameterBeliefs')
      return []
    }
  }

  const fetchAIContextEdges = async (
    input: { entityKeys: string[]; relationTypes?: AIContextEdge['relationType'][]; limit?: number },
  ): Promise<AIContextEdge[]> => {
    const entityKeys = uniqueStrings(input.entityKeys)
    if (!entityKeys.length) return []
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return []
    const limit = input.limit ?? 80
    try {
      return await withRetry(async () => {
        const sourceQuery = getSupabase()
          .from('ai_context_edges')
          .select('*')
          .eq('user_id', userId)
          .in('source_entity_key', entityKeys)
          .order('created_at', { ascending: false })
          .limit(limit)
        const targetQuery = getSupabase()
          .from('ai_context_edges')
          .select('*')
          .eq('user_id', userId)
          .in('target_entity_key', entityKeys)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (input.relationTypes?.length) {
          sourceQuery.in('relation_type', input.relationTypes)
          targetQuery.in('relation_type', input.relationTypes)
        }
        const [sourceResult, targetResult] = await Promise.all([
          sourceQuery as unknown as Promise<{ data: unknown[] | null; error: unknown }>,
          targetQuery as unknown as Promise<{ data: unknown[] | null; error: unknown }>,
        ])
        if (sourceResult.error) throw sourceResult.error
        if (targetResult.error) throw targetResult.error
        const byKey = new Map<string, AIContextEdge>()
        for (const row of [...(sourceResult.data ?? []), ...(targetResult.data ?? [])]) {
          const edge = toAIContextEdge(row as AIContextEdgeRow)
          const key = edge.id || `${edge.sourceEntityKey}:${edge.targetEntityKey}:${edge.relationType}`
          byKey.set(key, edge)
        }
        return [...byKey.values()]
          .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
          .slice(0, limit)
      }, 'fetchAIContextEdges')
    } catch (e) {
      if (isAIMemorySchemaMissing(e)) {
        logMissingAIMemorySchema('fetchAIContextEdges')
        return []
      }
      handleError(e, 'fetchAIContextEdges')
      return []
    }
  }

  const fetchAIMemorySnapshots = async (
    input: { entityKeys?: string[]; scopes?: AIMemorySnapshot['scope'][]; limit?: number } = {},
  ): Promise<AIMemorySnapshot[]> => {
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) return []
    const limit = input.limit ?? 20
    try {
      return await withRetry(async () => {
        let query = getSupabase()
          .from('ai_memory_snapshots')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(limit)
        if (input.scopes?.length) query = query.in('scope', input.scopes)
        const { data, error } = await query
        if (error) throw error
        const entityKeys = new Set(uniqueStrings(input.entityKeys ?? []))
        return ((data ?? []) as AIMemorySnapshotRow[])
          .map(toAIMemorySnapshot)
          .filter(snapshot => !entityKeys.size || snapshot.entityKeys.some(key => entityKeys.has(key)))
          .slice(0, limit)
      }, 'fetchAIMemorySnapshots')
    } catch (e) {
      if (isAIMemorySchemaMissing(e)) {
        logMissingAIMemorySchema('fetchAIMemorySnapshots')
        return []
      }
      handleError(e, 'fetchAIMemorySnapshots')
      return []
    }
  }

  const fetchAIMemoryDebugSnapshot = async (limit = 8): Promise<AIMemoryDebugSnapshot> => {
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    const empty = (): AIMemoryDebugSnapshot => ({
      contextEntities: [],
      contextEdges: [],
      clarificationEvents: [],
      parameterBeliefs: [],
      recommendationFeedback: [],
      memorySnapshots: [],
      schemaStatus: userId ? 'ready' : 'local_only',
      schemaMissingTables: [],
      pendingWriteCount: getPendingAIMemoryWriteCount(),
      loadedAt: new Date().toISOString(),
    })
    if (!userId) return empty()

    const memoryTables = [
      'ai_context_entities',
      'ai_context_edges',
      'ai_clarification_events',
      'ai_parameter_beliefs',
      'ai_recommendation_feedback',
      'ai_memory_snapshots',
    ]
    const missingTables = new Set<string>()
    const safeRead = async <T>(label: string, table: string, read: () => Promise<T[]>): Promise<T[]> => {
      try {
        return await withRetry(read, label)
      } catch (e) {
        if (isAIMemorySchemaMissing(e)) {
          logMissingAIMemorySchema(label)
          missingTables.add(table)
          return []
        }
        handleError(e, label)
        return []
      }
    }

    const [contextEntities, contextEdges, clarificationEvents, parameterBeliefs, recommendationFeedback, memorySnapshots] = await Promise.all([
      safeRead('fetchAIMemoryDebugSnapshot:entities', 'ai_context_entities', async () => {
        const { data, error } = await getSupabase()
          .from('ai_context_entities')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(limit)
        if (error) throw error
        return ((data ?? []) as AIContextEntityRow[]).map(toAIContextEntity)
      }),
      safeRead('fetchAIMemoryDebugSnapshot:edges', 'ai_context_edges', async () => {
        const { data, error } = await getSupabase()
          .from('ai_context_edges')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (error) throw error
        return ((data ?? []) as AIContextEdgeRow[]).map(toAIContextEdge)
      }),
      safeRead('fetchAIMemoryDebugSnapshot:events', 'ai_clarification_events', async () => {
        const { data, error } = await getSupabase()
          .from('ai_clarification_events')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (error) throw error
        return ((data ?? []) as AIClarificationEventRow[]).map(toAIClarificationEvent)
      }),
      safeRead('fetchAIMemoryDebugSnapshot:beliefs', 'ai_parameter_beliefs', async () => {
        const { data, error } = await getSupabase()
          .from('ai_parameter_beliefs')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(limit)
        if (error) throw error
        return ((data ?? []) as AIParameterBeliefRow[]).map(toAIParameterBelief)
      }),
      safeRead('fetchAIMemoryDebugSnapshot:feedback', 'ai_recommendation_feedback', async () => {
        const { data, error } = await getSupabase()
          .from('ai_recommendation_feedback')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (error) throw error
        return ((data ?? []) as AIRecommendationFeedbackRow[]).map(toAIRecommendationFeedback)
      }),
      safeRead('fetchAIMemoryDebugSnapshot:snapshots', 'ai_memory_snapshots', async () => {
        const { data, error } = await getSupabase()
          .from('ai_memory_snapshots')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(limit)
        if (error) throw error
        return ((data ?? []) as AIMemorySnapshotRow[]).map(toAIMemorySnapshot)
      }),
    ])
    const schemaMissingTables = [...missingTables].sort()
    const schemaStatus: AIMemoryDebugSnapshot['schemaStatus'] = schemaMissingTables.length === 0
      ? 'ready'
      : schemaMissingTables.length === memoryTables.length
        ? 'missing'
        : 'partial'

    return {
      contextEntities,
      contextEdges,
      clarificationEvents,
      parameterBeliefs,
      recommendationFeedback,
      memorySnapshots,
      schemaStatus,
      schemaMissingTables,
      pendingWriteCount: getPendingAIMemoryWriteCount(),
      loadedAt: new Date().toISOString(),
    }
  }

  const clearAIMemoryDebugData = async (): Promise<void> => {
    pendingAIMemoryWrites.splice(0, pendingAIMemoryWrites.length)
    clearLocalAIClarificationMemory()
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) {
      invalidateCache.all()
      return
    }
    const tables = [
      'ai_context_edges',
      'ai_recommendation_feedback',
      'ai_parameter_beliefs',
      'ai_memory_snapshots',
      'ai_clarification_events',
      'ai_context_entities',
    ]
    try {
      isSyncing.value = true
      for (const table of tables) {
        try {
          await withRetry(async () => {
            const { error } = await getSupabase()
              .from(table)
              .delete()
              .eq('user_id', userId)
            if (error) throw error
          }, `clearAIMemoryDebugData:${table}`)
        } catch (e) {
          if (isAIMemorySchemaMissing(e)) {
            logMissingAIMemorySchema(`clearAIMemoryDebugData:${table}`)
            continue
          }
          throw e
        }
      }
      invalidateCache.all()
    } catch (e) {
      handleError(e, 'clearAIMemoryDebugData')
      throw e
    } finally {
      isSyncing.value = false
    }
  }

  const upsertAIMemorySnapshot = async (input: AIMemorySnapshotInput): Promise<void> => {
    if (!input.snapshotKey || !input.summaryText.trim()) return
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) throw new Error('Cannot save AI memory snapshot without an authenticated user.')
    try {
      isSyncing.value = true
      await withRetry(async () => {
        const { error } = await getSupabase()
          .from('ai_memory_snapshots')
          .upsert({
            user_id: userId,
            snapshot_key: input.snapshotKey,
            scope: input.scope,
            entity_keys: uniqueStrings(input.entityKeys),
            summary_text: input.summaryText.trim(),
            facts: input.facts ?? {},
            source_event_count: Math.max(0, input.sourceEventCount ?? 0),
            source_entity_count: Math.max(0, input.sourceEntityCount ?? input.entityKeys.length),
            confidence: Math.max(0, Math.min(1, input.confidence ?? 0.65)),
            stale_after: input.staleAfter ?? null,
          }, { onConflict: 'user_id,snapshot_key' })
        if (error) throw error
      }, 'upsertAIMemorySnapshot')
      invalidateCache.all()
    } catch (e) {
      if (isAIMemorySchemaMissing(e)) {
        logMissingAIMemorySchema('upsertAIMemorySnapshot')
        return
      }
      handleError(e, 'upsertAIMemorySnapshot')
      throw e
    } finally {
      isSyncing.value = false
    }
  }

  const upsertAIParameterBelief = async (input: AIParameterBeliefInput, options: AIMemoryWriteOptions = {}): Promise<void> => {
    if (!input.entityKey || !input.parameterKey) return
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) throw new Error('Cannot save AI parameter belief without an authenticated user.')
    const now = new Date().toISOString()
    try {
      isSyncing.value = true
      await withRetry(async () => {
        const { data: existingData, error: fetchError } = await getSupabase()
          .from('ai_parameter_beliefs')
          .select('*')
          .eq('user_id', userId)
          .eq('entity_key', input.entityKey)
          .eq('parameter_key', input.parameterKey)
          .maybeSingle()
        if (fetchError) throw fetchError
        const existing = (existingData ?? null) as AIParameterBeliefRow | null
        const currentConfidence = Number(existing?.confidence ?? 0)
        const nextConfidence = Math.max(
          currentConfidence,
          input.confidence ?? Math.min(1, currentConfidence + (input.confidenceBoost ?? 0.55)),
        )
        const existingBelief = existing?.belief_json ?? {}
        const evidence = {
          ...existingBelief,
          value: input.value ?? existingBelief.value,
          selectedLabel: input.selectedLabel ?? existingBelief.selectedLabel,
          freeText: input.freeText ?? existingBelief.freeText,
          lastUpdated: now,
          evidence: {
            ...(typeof existingBelief.evidence === 'object' && existingBelief.evidence ? existingBelief.evidence as Record<string, unknown> : {}),
            ...(input.evidence ?? {}),
          },
        }
        const { error: upsertError } = await getSupabase()
          .from('ai_parameter_beliefs')
          .upsert({
            ...(existing ?? {}),
            user_id: userId,
            entity_key: input.entityKey,
            entity_type: input.entityType,
            parameter_key: input.parameterKey,
            belief_json: evidence,
            confidence: nextConfidence,
            impact_weight: Math.max(0, Math.min(1, input.impactWeight ?? Number(existing?.impact_weight ?? 0.5))),
            last_answered_at: now,
            source_question_id: input.sourceQuestionId ?? existing?.source_question_id ?? null,
            source_event_id: input.sourceEventId && isSupabaseUuid(input.sourceEventId) ? input.sourceEventId : existing?.source_event_id ?? null,
          }, { onConflict: 'user_id,entity_key,parameter_key' })
        if (upsertError) throw upsertError
      }, 'upsertAIParameterBelief')
      invalidateCache.all()
      if (!options.skipQueue) void flushPendingAIMemoryWrites()
    } catch (e) {
      if (isAIMemorySchemaMissing(e)) {
        logMissingAIMemorySchema('upsertAIParameterBelief')
        if (options.skipQueue) {
          throw e
        }
        recordLocalAIParameterBelief(input)
        enqueuePendingAIMemoryWrite({
          kind: 'parameter_belief',
          input,
          queuedAt: new Date().toISOString(),
          attempts: 0,
        })
        return
      }
      handleError(e, 'upsertAIParameterBelief')
      throw e
    } finally {
      isSyncing.value = false
    }
  }

  const shouldAskClarification = async (entityKey: string, questionId: string, cooldownDays = 7): Promise<boolean> => {
    const events = await fetchAIClarificationEvents([entityKey], 20)
    return !clarificationAnsweredRecently(events.filter(event => event.questionId === questionId), cooldownDays)
  }

  const fetchRecentRecommendationFeedbackForAggregation = async (
    userId: string,
    latest: AIRecommendationFeedbackInput,
  ): Promise<AIRecommendationFeedback[]> => {
    const { data, error } = await getSupabase()
      .from('ai_recommendation_feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40)
    if (error) throw error
    const latestEvent: AIRecommendationFeedback = {
      id: `latest-${latest.recommendationId}-${latest.action}`,
      generatedPlanId: latest.generatedPlanId ?? null,
      recommendationId: latest.recommendationId,
      taskId: latest.taskId ?? null,
      entityKey: latest.entityKey ?? null,
      action: latest.action,
      reasonCategory: latest.reasonCategory ?? null,
      freeText: latest.freeText ?? null,
      revisitAt: latest.revisitAt ?? null,
      outcomeSignals: latest.outcomeSignals ?? {},
      implicitPositive: Boolean(latest.implicitPositive),
      sourceMessageId: latest.sourceMessageId ?? null,
      createdAt: new Date().toISOString(),
    }
    const recent = ((data ?? []) as AIRecommendationFeedbackRow[]).map(row => toAIRecommendationFeedback(row))
    const byKey = new Map<string, AIRecommendationFeedback>()
    for (const feedback of [latestEvent, ...recent]) {
      const key = feedback.id || `${feedback.recommendationId}:${feedback.action}:${feedback.createdAt ?? ''}`
      if (!byKey.has(key)) byKey.set(key, feedback)
    }
    return [...byKey.values()]
  }

  const recordAIClarificationEvent = async (input: AIClarificationEventInput, options: AIMemoryWriteOptions = {}): Promise<void> => {
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) {
      recordLocalAIClarificationEvent(input)
      return
    }
    const now = new Date().toISOString()
    try {
      isSyncing.value = true
      await withRetry(async () => {
        const answeredAt = input.eventType === 'answered' ? now : null
        const { data: existingData, error: fetchError } = await getSupabase()
          .from('ai_context_entities')
          .select('*')
          .eq('user_id', userId)
          .eq('entity_key', input.entityKey)
          .maybeSingle()
        if (fetchError) throw fetchError
        const existing = (existingData ?? null) as AIContextEntityRow | null
        const facts = mergeFactPatch(existing?.facts ?? {}, input.memoryPatch, input.freeText)
        const corrections = input.eventType === 'correction'
          ? uniqueStrings([...stringArray(existing?.corrections), input.freeText || input.selectedLabel || input.questionId])
          : stringArray(existing?.corrections)
        const { error: upsertError } = await getSupabase()
          .from('ai_context_entities')
          .upsert({
            ...(existing ?? {}),
            user_id: userId,
            entity_key: input.entityKey,
            entity_type: input.entityType,
            display_name: input.displayName,
            summary: typeof facts.whyItMatters === 'string' ? facts.whyItMatters : existing?.summary ?? null,
            facts,
            corrections,
            confidence: Math.max(Number(existing?.confidence ?? 0), input.eventType === 'answered' ? 0.85 : 0.4),
            completeness_score: computeAIEntityCompleteness(facts),
            last_asked_at: input.eventType === 'asked' ? now : existing?.last_asked_at ?? null,
            last_answered_at: answeredAt ?? existing?.last_answered_at ?? null,
            ask_count: Number(existing?.ask_count ?? 0) + (input.eventType === 'asked' ? 1 : 0),
            stale_after: answeredAt ? nextStaleAfterIso(answeredAt) : existing?.stale_after ?? null,
            memory_type: existing?.memory_type ?? (input.entityType === 'preference' ? 'preference' : 'semantic'),
            scope: existing?.scope ?? aiEntityScope(input.entityType),
            reinforcement_count: Number(existing?.reinforcement_count ?? 0) + (answeredAt ? 1 : 0),
            last_reinforced_at: answeredAt ?? existing?.last_reinforced_at ?? null,
            decay_score: answeredAt ? 1 : existing?.decay_score ?? null,
          }, { onConflict: 'user_id,entity_key' })
        if (upsertError) throw upsertError

        const { error: eventError } = await getSupabase()
          .from('ai_clarification_events')
          .insert({
            user_id: userId,
            entity_key: input.entityKey,
            entity_type: input.entityType,
            question_id: input.questionId,
            event_type: input.eventType,
            question: input.question,
            selected_option_id: input.selectedOptionId,
            selected_label: input.selectedLabel,
            free_text: input.freeText,
            memory_patch: input.memoryPatch ?? null,
            source_message_id: input.sourceMessageId,
            coverage_score_at_time: input.coverageScoreAtTime,
            uncertainty_dimensions: input.uncertaintyDimensions ?? [],
            path_type: input.pathType,
            context_snapshot: input.contextSnapshot,
          })
        if (eventError) throw eventError

        for (const belief of beliefInputsFromClarification(input)) {
          const { data: existingBeliefData, error: beliefFetchError } = await getSupabase()
            .from('ai_parameter_beliefs')
            .select('*')
            .eq('user_id', userId)
            .eq('entity_key', belief.entityKey)
            .eq('parameter_key', belief.parameterKey)
            .maybeSingle()
          if (beliefFetchError) throw beliefFetchError
          const existingBelief = (existingBeliefData ?? null) as AIParameterBeliefRow | null
          const currentConfidence = Number(existingBelief?.confidence ?? 0)
          const nowBelief = new Date().toISOString()
          const existingBeliefJson = existingBelief?.belief_json ?? {}
          const { error: beliefUpsertError } = await getSupabase()
            .from('ai_parameter_beliefs')
            .upsert({
              ...(existingBelief ?? {}),
              user_id: userId,
              entity_key: belief.entityKey,
              entity_type: belief.entityType,
              parameter_key: belief.parameterKey,
              belief_json: {
                ...existingBeliefJson,
                value: belief.value ?? existingBeliefJson.value,
                selectedLabel: belief.selectedLabel ?? existingBeliefJson.selectedLabel,
                freeText: belief.freeText ?? existingBeliefJson.freeText,
                lastUpdated: nowBelief,
                evidence: {
                  ...(typeof existingBeliefJson.evidence === 'object' && existingBeliefJson.evidence ? existingBeliefJson.evidence as Record<string, unknown> : {}),
                  ...(belief.evidence ?? {}),
                },
              },
              confidence: Math.max(currentConfidence, belief.confidence ?? 0.78),
              impact_weight: belief.impactWeight ?? Number(existingBelief?.impact_weight ?? 0.5),
              last_answered_at: nowBelief,
              source_question_id: belief.sourceQuestionId ?? input.questionId,
              source_event_id: belief.sourceEventId && isSupabaseUuid(belief.sourceEventId) ? belief.sourceEventId : existingBelief?.source_event_id ?? null,
            }, { onConflict: 'user_id,entity_key,parameter_key' })
          if (beliefUpsertError) throw beliefUpsertError
        }
      }, 'recordAIClarificationEvent')
      invalidateCache.all()
      if (!options.skipQueue) void flushPendingAIMemoryWrites()
    } catch (e) {
      if (isAIMemorySchemaMissing(e)) {
        logMissingAIMemorySchema('recordAIClarificationEvent')
        if (options.skipQueue) {
          throw e
        }
        recordLocalAIClarificationEvent(input)
        enqueuePendingAIMemoryWrite({
          kind: 'clarification_event',
          input,
          queuedAt: new Date().toISOString(),
          attempts: 0,
        })
        return
      }
      handleError(e, 'recordAIClarificationEvent')
      throw e
    } finally {
      isSyncing.value = false
    }
  }

  const recordAIRecommendationFeedback = async (input: AIRecommendationFeedbackInput, options: AIMemoryWriteOptions = {}): Promise<void> => {
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) {
      recordLocalAIRecommendationFeedback(input)
      return
    }
    try {
      isSyncing.value = true
      await withRetry(async () => {
        const { error } = await getSupabase()
          .from('ai_recommendation_feedback')
          .insert({
            user_id: userId,
            generated_plan_id: input.generatedPlanId,
            recommendation_id: input.recommendationId,
            task_id: input.taskId && isSupabaseUuid(input.taskId) ? input.taskId : null,
            entity_key: input.entityKey,
            action: input.action,
            reason_category: input.reasonCategory,
            free_text: input.freeText,
            revisit_at: input.revisitAt,
            outcome_signals: input.outcomeSignals ?? {},
            implicit_positive: Boolean(input.implicitPositive),
            source_message_id: input.sourceMessageId,
          })
        if (error) throw error
      }, 'recordAIRecommendationFeedback')
      for (const belief of beliefInputsFromRecommendationFeedback(input)) {
        try {
          await upsertAIParameterBelief(belief, { skipQueue: options.skipQueue })
        } catch (beliefError) {
          if (options.skipQueue && isAIMemorySchemaMissing(beliefError)) {
            logMissingAIMemorySchema('recordAIRecommendationFeedback:derivedBelief')
            continue
          }
          throw beliefError
        }
      }
      try {
        const recentFeedback = await fetchRecentRecommendationFeedbackForAggregation(userId, input)
        for (const belief of aggregateBeliefInputsFromRecommendationFeedback(input, recentFeedback)) {
          await upsertAIParameterBelief(belief, { skipQueue: options.skipQueue })
        }
      } catch (aggregateError) {
        if (isAIMemorySchemaMissing(aggregateError)) {
          logMissingAIMemorySchema('recordAIRecommendationFeedback:aggregateBelief')
        } else {
          throw aggregateError
        }
      }
      invalidateCache.all()
      if (!options.skipQueue) void flushPendingAIMemoryWrites()
    } catch (e) {
      if (isAIMemorySchemaMissing(e)) {
        logMissingAIMemorySchema('recordAIRecommendationFeedback')
        if (options.skipQueue) {
          throw e
        }
        recordLocalAIRecommendationFeedback(input)
        enqueuePendingAIMemoryWrite({
          kind: 'recommendation_feedback',
          input,
          queuedAt: new Date().toISOString(),
          attempts: 0,
        })
        return
      }
      handleError(e, 'recordAIRecommendationFeedback')
      throw e
    } finally {
      isSyncing.value = false
    }
  }

  const upsertAIContextEdges = async (edges: AIContextEdgeInput[], options: AIMemoryWriteOptions = {}): Promise<void> => {
    const cleanEdges = edges.filter(edge => edge.sourceEntityKey && edge.targetEntityKey && edge.relationType)
    if (!cleanEdges.length) return
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) throw new Error('Cannot save AI context edges without an authenticated user.')
    try {
      isSyncing.value = true
      await withRetry(async () => {
        const { error } = await getSupabase()
          .from('ai_context_edges')
          .upsert(cleanEdges.map(edge => ({
            user_id: userId,
            source_entity_key: edge.sourceEntityKey,
            target_entity_key: edge.targetEntityKey,
            relation_type: edge.relationType,
            confidence: Math.max(0, Math.min(1, edge.confidence ?? 0.6)),
            evidence: edge.evidence ?? {},
            source_event_id: edge.sourceEventId && isSupabaseUuid(edge.sourceEventId) ? edge.sourceEventId : null,
            valid_until: edge.validUntil,
          })), { onConflict: 'user_id,source_entity_key,target_entity_key,relation_type' })
        if (error) throw error
      }, 'upsertAIContextEdges')
      invalidateCache.all()
      if (!options.skipQueue) void flushPendingAIMemoryWrites()
    } catch (e) {
      if (isAIMemorySchemaMissing(e)) {
        logMissingAIMemorySchema('upsertAIContextEdges')
        if (options.skipQueue) {
          throw e
        }
        enqueuePendingAIMemoryWrite({
          kind: 'context_edges',
          input: cleanEdges,
          queuedAt: new Date().toISOString(),
          attempts: 0,
        })
        return
      }
      handleError(e, 'upsertAIContextEdges')
      throw e
    } finally {
      isSyncing.value = false
    }
  }

  const applyAIMemoryPatch = async (patch: AIMemoryPatch): Promise<void> => {
    if (patch.entityType !== 'project' && patch.entityType !== 'task') {
      console.debug(`[AIMemory] Skipping legacy UUID memory patch for general entity: ${patch.entityType}:${patch.entityId}`)
      return
    }
    if (!isSupabaseUuid(patch.entityId)) {
      console.debug(`[AIMemory] Skipping ${patch.entityType} memory patch for non-Supabase UUID: ${patch.entityId}`)
      return
    }
    if (!authStore.isInitialized) await authStore.initialize()
    const userId = getUserIdSafe()
    if (!userId) throw new Error('Cannot save AI memory without an authenticated user.')

    const table = patch.entityType === 'project' ? 'project_contexts' : 'task_contexts'
    const idColumn = patch.entityType === 'project' ? 'project_id' : 'task_id'
    const fieldMap = patch.entityType === 'project' ? PROJECT_FIELD_MAP : TASK_FIELD_MAP
    const arrayFields = patch.entityType === 'project' ? PROJECT_ARRAY_FIELDS : TASK_ARRAY_FIELDS
    const dbField = fieldMap[patch.field]
    if (!dbField && patch.operation !== 'confirm') {
      throw new Error(`Unsupported AI memory field: ${patch.field}`)
    }

    try {
      isSyncing.value = true
      await withRetry(async () => {
        const { data: existingData, error: fetchError } = await getSupabase()
          .from(table)
          .select('*')
          .eq('user_id', userId)
          .eq(idColumn, patch.entityId)
          .maybeSingle()
        if (fetchError) throw fetchError

        const existing = (existingData ?? null) as ProjectContextRow | TaskContextRow | null
        const next: Record<string, unknown> = {
          ...(existing ?? {}),
          [idColumn]: patch.entityId,
          user_id: userId,
          last_updated_at: new Date().toISOString(),
          confidence: Math.max(Number(existing?.confidence ?? 0), patch.confidence),
        }

        if (patch.operation === 'confirm') {
          next.last_confirmed_at = new Date().toISOString()
        } else if (dbField) {
          const oldValue = existing?.[dbField as keyof typeof existing]
          if (patch.operation === 'append' || patch.operation === 'deprecate') {
            const current = stringArray(oldValue)
            const additions = Array.isArray(patch.value) ? patch.value.map(String) : [String(patch.value)]
            next[dbField] = uniqueStrings([
              ...current,
              ...additions.map(value => patch.operation === 'deprecate' ? `Deprecated: ${value}` : value),
            ])
          } else if (patch.operation === 'reject') {
            const current = stringArray(oldValue)
            next[dbField] = uniqueStrings([...current, `Rejected: ${String(patch.value)}`])
          } else {
            next[dbField] = patch.value
          }
        }

        if (patch.entityType === 'project') {
          next.completeness_score = computeProjectCompleteness(next as ProjectContextRow)
        } else {
          next.completeness_score = computeTaskCompleteness(next as TaskContextRow)
        }

        const { error: upsertError } = await getSupabase()
          .from(table)
          .upsert(next, { onConflict: idColumn })
        if (upsertError) throw upsertError

        const { error: eventError } = await getSupabase()
          .from('memory_events')
          .insert({
            user_id: userId,
            entity_type: patch.entityType,
            entity_id: patch.entityId,
            event_type: patch.source === 'model_inference' ? 'inferred_candidate' : patch.source === 'user_correction' ? 'correction' : patch.operation === 'confirm' ? 'confirmation' : 'user_answer',
            field: patch.field,
            old_value: dbField && existing ? existing[dbField as keyof typeof existing] ?? null : null,
            new_value: patch.value as Record<string, unknown> | string | number | boolean | null,
            confidence: patch.confidence,
            source_message_id: patch.sourceMessageId,
            source: patch.source,
          })
        if (eventError) throw eventError
      }, 'applyAIMemoryPatch')

      invalidateCache.all()
    } catch (e) {
      handleError(e, 'applyAIMemoryPatch')
      throw e
    } finally {
      isSyncing.value = false
    }
  }

  const flushPendingAIMemoryWrites = async (): Promise<void> => {
    if (isFlushingPendingAIMemoryWrites || !pendingAIMemoryWrites.length) return
    if (!authStore.isInitialized) await authStore.initialize()
    if (!getUserIdSafe()) return

    isFlushingPendingAIMemoryWrites = true
    const remaining: PendingAIMemoryWrite[] = []
    const writes = pendingAIMemoryWrites.splice(0, pendingAIMemoryWrites.length)
    try {
      for (const write of writes) {
        try {
          if (write.kind === 'clarification_event') {
            await recordAIClarificationEvent(write.input, { skipQueue: true })
          } else if (write.kind === 'recommendation_feedback') {
            await recordAIRecommendationFeedback(write.input, { skipQueue: true })
          } else if (write.kind === 'parameter_belief') {
            await upsertAIParameterBelief(write.input, { skipQueue: true })
          } else {
            await upsertAIContextEdges(write.input, { skipQueue: true })
          }
        } catch (error) {
          if (isAIMemorySchemaMissing(error)) {
            remaining.push({ ...write, attempts: write.attempts + 1 })
            continue
          }
          handleError(error, `flushPendingAIMemoryWrites:${write.kind}`)
        }
      }
    } finally {
      pendingAIMemoryWrites.unshift(...remaining)
      isFlushingPendingAIMemoryWrites = false
    }
  }

  return {
    fetchProjectContexts,
    fetchTaskContexts,
    searchAIMemory,
    fetchAIContextEntities,
    fetchAIClarificationEvents,
    fetchAIRecommendationFeedback,
    fetchAIParameterBeliefs,
    fetchAIContextEdges,
    fetchAIMemorySnapshots,
    fetchAIMemoryDebugSnapshot,
    clearAIMemoryDebugData,
    shouldAskClarification,
    recordAIClarificationEvent,
    recordAIRecommendationFeedback,
    upsertAIParameterBelief,
    upsertAIContextEdges,
    upsertAIMemorySnapshot,
    flushPendingAIMemoryWrites,
    getPendingAIMemoryWriteCount,
    applyAIMemoryPatch,
  }
}
