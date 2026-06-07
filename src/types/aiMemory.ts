export type AIMemoryEntityType = 'project' | 'task'

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
  entityType: AIMemoryEntityType
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
