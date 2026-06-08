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
}
