export type AIMemoryEntityType = 'project' | 'task'
export type AIContextEntityType = AIMemoryEntityType | 'week' | 'preference' | 'synthetic_group' | 'workflow'

export type AIMemoryDomain =
  | 'work'
  | 'personal'
  | 'creative'
  | 'admin'
  | 'learning'
  | 'health'
  | 'unknown'

export type AIMemoryStakes = 'low' | 'medium' | 'high' | 'critical' | 'unknown'
export type AIMemoryUrgencyWindow = 'none' | 'this_week' | 'this_month' | 'date_bound' | 'unknown'
export type AIMemoryCadence = 'daily' | 'weekly' | 'occasional' | 'paused' | 'unknown'

export type AIMemoryPatchOperation = 'set' | 'append' | 'deprecate' | 'confirm' | 'reject'

export type AIMemoryPatchSource =
  | 'button_answer'
  | 'free_text'
  | 'user_correction'
  | 'task_event'
  | 'model_inference'

export interface ProjectContext {
  projectId: string
  userId?: string
  summary?: string | null
  domain: AIMemoryDomain
  lifeArea?: string | null
  whyItMatters?: string | null
  successCriteria: string[]
  failureRisks: string[]
  currentStakes: AIMemoryStakes
  urgencyWindow: AIMemoryUrgencyWindow
  preferredCadence?: AIMemoryCadence | null
  taskSelectionHints: string[]
  nonGoals: string[]
  userCorrections: string[]
  confidence: number
  completenessScore: number
  lastConfirmedAt?: string | null
  lastUpdatedAt?: string | null
  staleAfter?: string | null
}

export interface TaskContext {
  taskId: string
  projectId?: string | null
  userId?: string
  summary?: string | null
  whyItMatters?: string | null
  successCriteria: string[]
  currentStakes: AIMemoryStakes
  urgencyWindow: AIMemoryUrgencyWindow
  selectionHints: string[]
  nonGoals: string[]
  userCorrections: string[]
  confidence: number
  completenessScore: number
  lastConfirmedAt?: string | null
  lastUpdatedAt?: string | null
  staleAfter?: string | null
}

export interface AIMemoryPatch {
  entityType: AIContextEntityType
  entityId: string
  operation: AIMemoryPatchOperation
  field: string
  value: unknown
  confidence: number
  source: AIMemoryPatchSource
  sourceMessageId?: string
}

export interface AIMemoryQuestionOption {
  id: string
  label: string
  effect: string
  memoryPatch?: AIMemoryPatch
}

export interface AIClarificationQuestion {
  id: string
  entityType?: AIContextEntityType
  entityId?: string
  reason: string
  question: string
  options: AIMemoryQuestionOption[]
  allowFreeText?: boolean
  freeTextPatch?: {
    field: string
    operation: 'set' | 'append'
  }
  freeTextPlaceholder?: string
  relatedTaskIds: string[]
}

export type AIUncertaintyDimension =
  | 'impact'
  | 'energy_fit'
  | 'stakeholders'
  | 'dependencies'
  | 'history'
  | 'preferences'
  | 'project_meaning'
  | 'task_context'
  | 'stale_context'

export type AIClarificationPathType =
  | 'clarify_first'
  | 'generated_with_uncertainty'
  | 'showed_candidates'
  | 'pause_save'
  | 'context_sufficient'
  | 'memory_timeout'

export interface AIClarificationCoverage {
  score: number
  materiality: 'low' | 'medium' | 'high'
  dimensions: Partial<Record<AIUncertaintyDimension, number>>
  missing: AIUncertaintyDimension[]
  decision: 'ask' | 'proceed_with_uncertainty' | 'proceed' | 'neutral_candidates'
}

export interface AIClarificationEVPIScore {
  targetedParameters: AIUncertaintyDimension[]
  heuristicEvpi: number
  userCost: number
  selectedScore: number
  askThreshold: number
  coverageScore: number
  candidates: Array<{
    questionId: string
    reason: string
    targetedParameters: AIUncertaintyDimension[]
    heuristicEvpi: number
    userCost: number
    selectedScore: number
    skippedReason?: 'recently_resolved' | 'no_targets'
  }>
}

export interface AIClarificationArtifact {
  schemaVersion: 'ai-clarification.v1'
  kind: 'weekly_planning' | 'response_quality'
  locale: 'he' | 'en'
  direction: 'rtl' | 'ltr'
  progressLabel: string
  summary: string
  question: AIClarificationQuestion
  candidateTaskIds: string[]
  actions: Array<'generate_current' | 'show_candidates' | 'pause_save'>
  memoryKey: string
  coverage?: AIClarificationCoverage
  pathType?: AIClarificationPathType
  debug?: {
    retrieval: {
      source: 'exact_entity_lookup' | 'legacy_context' | 'hybrid_sql' | 'fallback'
      entityKeyCount: number
      eventCount: number
      projectContextCount: number
      taskContextCount: number
      feedbackCount?: number
      elapsedMs?: number
      timedOut?: boolean
      exactEntityCount?: number
      semanticCandidateCount?: number
      semanticSkippedReason?: 'pgvector_not_configured' | 'no_related_entities'
      lifecycle?: {
        staleEntityKeys: string[]
        refreshEntityKeys: string[]
        summarizeEntityKeys: string[]
        archiveEventCount: number
        lowConfidenceEntityCount: number
      }
    }
    reason: string
    candidateCount: number
    evpi?: AIClarificationEVPIScore
  }
}

export interface AIContextEntity {
  id?: string
  entityKey: string
  entityType: AIContextEntityType
  displayName: string
  canonicalProjectId?: string | null
  canonicalTaskId?: string | null
  summary?: string | null
  facts: Record<string, unknown>
  corrections: string[]
  confidence: number
  completenessScore: number
  lastAskedAt?: string | null
  lastAnsweredAt?: string | null
  askCount: number
  staleAfter?: string | null
  memoryType?: 'semantic' | 'episodic_summary' | 'preference' | 'procedural' | null
  scope?: 'user' | 'project' | 'task' | 'week' | 'workflow' | null
  reinforcementCount?: number
  lastReinforcedAt?: string | null
  relatedEntities?: string[]
  decayScore?: number | null
}

export interface AIClarificationEvent {
  id?: string
  entityKey: string
  entityType: AIContextEntityType
  questionId: string
  eventType: 'asked' | 'answered' | 'dismissed' | 'generated_with_uncertainty' | 'showed_candidates' | 'correction'
  question?: string | null
  selectedOptionId?: string | null
  selectedLabel?: string | null
  freeText?: string | null
  memoryPatch?: AIMemoryPatch | null
  sourceMessageId?: string | null
  coverageScoreAtTime?: number | null
  uncertaintyDimensions?: AIUncertaintyDimension[] | null
  pathType?: AIClarificationPathType | null
  contextSnapshot?: Record<string, unknown> | null
  createdAt?: string | null
}

export interface AIClarificationEventInput {
  entityKey: string
  entityType: AIContextEntityType
  displayName: string
  questionId: string
  eventType: AIClarificationEvent['eventType']
  question?: string
  selectedOptionId?: string
  selectedLabel?: string
  freeText?: string
  memoryPatch?: AIMemoryPatch
  sourceMessageId?: string
  coverageScoreAtTime?: number
  uncertaintyDimensions?: AIUncertaintyDimension[]
  pathType?: AIClarificationPathType
  contextSnapshot?: Record<string, unknown>
}

export interface AIRecommendationFeedbackInput {
  generatedPlanId?: string
  recommendationId: string
  taskId?: string
  entityKey?: string
  action: 'accept' | 'timeblock' | 'postpone' | 'dismiss' | 'simplify' | 'explain'
  reasonCategory?: 'too_hard' | 'low_energy' | 'not_important' | 'wrong_context' | 'already_done' | 'needs_more_info' | 'too_much' | 'other'
  freeText?: string
  revisitAt?: string | null
  outcomeSignals?: Record<string, unknown>
  implicitPositive?: boolean
  sourceMessageId?: string
}

export interface AIRecommendationFeedback {
  id?: string
  generatedPlanId?: string | null
  recommendationId: string
  taskId?: string | null
  entityKey?: string | null
  action: AIRecommendationFeedbackInput['action']
  reasonCategory?: AIRecommendationFeedbackInput['reasonCategory'] | null
  freeText?: string | null
  revisitAt?: string | null
  outcomeSignals?: Record<string, unknown>
  implicitPositive: boolean
  sourceMessageId?: string | null
  createdAt?: string | null
}

export interface AIParameterBelief {
  id?: string
  entityKey: string
  entityType: AIContextEntityType
  parameterKey: string
  beliefJson: Record<string, unknown>
  confidence: number
  impactWeight: number
  lastAnsweredAt?: string | null
  sourceQuestionId?: string | null
  sourceEventId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface AIParameterBeliefInput {
  entityKey: string
  entityType: AIContextEntityType
  parameterKey: string
  value?: unknown
  selectedLabel?: string
  freeText?: string
  confidence?: number
  confidenceBoost?: number
  impactWeight?: number
  sourceQuestionId?: string
  sourceEventId?: string
  evidence?: Record<string, unknown>
}

export interface AIContextEdgeInput {
  sourceEntityKey: string
  targetEntityKey: string
  relationType:
    | 'belongs_to'
    | 'blocks'
    | 'blocked_by'
    | 'follow_up'
    | 'corrected_by'
    | 'similar_to'
    | 'part_of_week'
    | 'preference_affects'
    | 'mentioned_with'
  confidence?: number
  evidence?: Record<string, unknown>
  sourceEventId?: string
  validUntil?: string | null
}

export interface AIMemoryDebugSnapshot {
  contextEntities: AIContextEntity[]
  clarificationEvents: AIClarificationEvent[]
  parameterBeliefs: AIParameterBelief[]
  recommendationFeedback: AIRecommendationFeedback[]
  pendingWriteCount: number
  loadedAt: string
}
