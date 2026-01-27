/**
 * AI Infrastructure Types and Interfaces
 *
 * Defines the foundational types for AI-powered features in FlowState.
 * Supports multiple AI providers (Ollama, Anthropic, OpenAI, Gemini) with
 * a unified interface for suggestions, analysis, and execution.
 *
 * @see ROAD-011 in MASTER_PLAN.md - AI-Powered Features Roadmap
 */

import type { Task, TaskPriority } from './tasks'
import type { CanvasGroup } from './canvas'

// ============================================================================
// AI Provider Types
// ============================================================================

/**
 * Supported AI providers.
 * Ollama is the primary local option; others are cloud-based.
 */
export enum AIProvider {
  OLLAMA = 'ollama',
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  GEMINI = 'gemini'
}

/**
 * Connection status for an AI provider.
 */
export type AIConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error'

/**
 * Configuration for an individual AI provider.
 */
export interface AIProviderConfig {
  /** The provider type */
  provider: AIProvider

  /** Whether this provider is enabled */
  enabled: boolean

  /** API endpoint URL (for Ollama: http://localhost:11434) */
  endpoint: string

  /** API key (not needed for Ollama) */
  apiKey?: string

  /** Model identifier (e.g., 'llama3.2', 'claude-3-sonnet', 'gpt-4') */
  model: string

  /** Maximum tokens for completion */
  maxTokens: number

  /** Temperature for generation (0-1, lower = more deterministic) */
  temperature: number

  /** Connection timeout in milliseconds */
  timeout: number

  /** Custom headers for API requests */
  customHeaders?: Record<string, string>
}

/**
 * Default configurations for each AI provider.
 */
export const DEFAULT_PROVIDER_CONFIGS: Record<AIProvider, Omit<AIProviderConfig, 'apiKey'>> = {
  [AIProvider.OLLAMA]: {
    provider: AIProvider.OLLAMA,
    enabled: true,
    endpoint: 'http://localhost:11434',
    model: 'llama3.2',
    maxTokens: 2048,
    temperature: 0.7,
    timeout: 30000
  },
  [AIProvider.ANTHROPIC]: {
    provider: AIProvider.ANTHROPIC,
    enabled: false,
    endpoint: 'https://api.anthropic.com',
    model: 'claude-3-sonnet-20240229',
    maxTokens: 4096,
    temperature: 0.7,
    timeout: 60000
  },
  [AIProvider.OPENAI]: {
    provider: AIProvider.OPENAI,
    enabled: false,
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4-turbo-preview',
    maxTokens: 4096,
    temperature: 0.7,
    timeout: 60000
  },
  [AIProvider.GEMINI]: {
    provider: AIProvider.GEMINI,
    enabled: false,
    endpoint: 'https://generativelanguage.googleapis.com/v1',
    model: 'gemini-pro',
    maxTokens: 4096,
    temperature: 0.7,
    timeout: 60000
  }
}

// ============================================================================
// AI Suggestion Types
// ============================================================================

/**
 * Categories of AI suggestions.
 */
export type AISuggestionType =
  | 'group_categorization'   // Suggest grouping tasks by category
  | 'task_breakdown'         // Break complex tasks into subtasks
  | 'canvas_cleanup'         // Organize canvas layout
  | 'priority_adjustment'    // Suggest priority changes
  | 'deadline_warning'       // Warn about approaching/missed deadlines
  | 'workload_balance'       // Suggest redistributing workload
  | 'duplicate_detection'    // Detect similar/duplicate tasks
  | 'dependency_inference'   // Infer task dependencies

/**
 * Confidence level for AI suggestions.
 */
export type AIConfidenceLevel = 'low' | 'medium' | 'high'

/**
 * Base interface for all AI suggestions.
 */
export interface AISuggestion<T = unknown> {
  /** Unique identifier */
  id: string

  /** Type of suggestion */
  type: AISuggestionType

  /** Display title */
  title: string

  /** Detailed description of the suggestion */
  description: string

  /** Confidence score (0-1) */
  confidence: number

  /** Confidence level derived from score */
  confidenceLevel: AIConfidenceLevel

  /** AI's reasoning for this suggestion */
  reasoning: string

  /** Affected entity IDs (tasks, groups, etc.) */
  affectedIds: string[]

  /** Type-specific suggestion data */
  data: T

  /** Whether user has dismissed this suggestion */
  dismissed: boolean

  /** Whether this suggestion has been applied */
  applied: boolean

  /** Provider that generated this suggestion */
  provider: AIProvider

  /** Model used for generation */
  model: string

  /** When the suggestion was created */
  createdAt: Date

  /** When the suggestion expires (optional) */
  expiresAt?: Date

  /** Priority for display ordering (higher = more important) */
  priority: number
}

// ============================================================================
// Specific Suggestion Types
// ============================================================================

/**
 * Data for group categorization suggestions.
 * Suggests organizing tasks into themed groups.
 */
export interface GroupCategorizationData {
  /** Suggested group name */
  groupName: string

  /** Suggested group type */
  groupType: CanvasGroup['type']

  /** Task IDs to include in the group */
  taskIds: string[]

  /** Common theme or category detected */
  theme: string

  /** Keywords that led to this categorization */
  keywords: string[]

  /** Suggested group color */
  suggestedColor?: string

  /** Suggested position on canvas */
  suggestedPosition?: { x: number; y: number }
}

export type GroupCategorizationSuggestion = AISuggestion<GroupCategorizationData>

/**
 * Data for task breakdown suggestions.
 * Suggests breaking a complex task into subtasks.
 */
export interface TaskBreakdownData {
  /** Original task ID */
  originalTaskId: string

  /** Original task title for reference */
  originalTitle: string

  /** Suggested subtasks */
  subtasks: Array<{
    title: string
    description: string
    estimatedDuration?: number
    priority?: TaskPriority
    order: number
  }>

  /** Total estimated duration for all subtasks */
  totalEstimatedDuration?: number

  /** Reasoning for the breakdown structure */
  breakdownRationale: string
}

export type TaskBreakdownSuggestion = AISuggestion<TaskBreakdownData>

/**
 * Data for canvas cleanup suggestions.
 * Suggests reorganizing the canvas layout.
 */
export interface CanvasCleanupData {
  /** Type of cleanup operation */
  cleanupType: 'reposition' | 'group' | 'ungroup' | 'align' | 'distribute'

  /** Tasks to reposition */
  repositions: Array<{
    taskId: string
    currentPosition: { x: number; y: number }
    suggestedPosition: { x: number; y: number }
    reason: string
  }>

  /** Groups to create or modify */
  groupChanges: Array<{
    action: 'create' | 'merge' | 'split' | 'delete'
    groupId?: string
    groupName?: string
    taskIds: string[]
    reason: string
  }>

  /** Overall cleanup strategy description */
  strategy: string

  /** Preview of the resulting layout (optional) */
  previewLayout?: {
    tasks: Array<{ id: string; position: { x: number; y: number } }>
    groups: Array<{ id: string; position: { x: number; y: number; width: number; height: number } }>
  }
}

export type CanvasCleanupSuggestion = AISuggestion<CanvasCleanupData>

/**
 * Data for priority adjustment suggestions.
 */
export interface PriorityAdjustmentData {
  /** Task ID */
  taskId: string

  /** Task title for reference */
  taskTitle: string

  /** Current priority */
  currentPriority: TaskPriority

  /** Suggested priority */
  suggestedPriority: TaskPriority

  /** Factors that influenced this suggestion */
  factors: string[]
}

export type PriorityAdjustmentSuggestion = AISuggestion<PriorityAdjustmentData>

/**
 * Data for deadline warning suggestions.
 */
export interface DeadlineWarningData {
  /** Task ID */
  taskId: string

  /** Task title for reference */
  taskTitle: string

  /** Due date */
  dueDate: string

  /** Days until deadline (negative if overdue) */
  daysUntilDue: number

  /** Warning severity */
  severity: 'approaching' | 'imminent' | 'overdue'

  /** Suggested actions */
  suggestedActions: Array<{
    action: 'reschedule' | 'prioritize' | 'delegate' | 'break_down'
    description: string
  }>
}

export type DeadlineWarningSuggestion = AISuggestion<DeadlineWarningData>

// ============================================================================
// AI Analysis Types
// ============================================================================

/**
 * Result of AI analysis operations.
 */
export interface AIAnalysisResult<T = unknown> {
  /** Unique identifier for this analysis */
  id: string

  /** Type of analysis performed */
  analysisType: string

  /** Whether the analysis was successful */
  success: boolean

  /** Error message if analysis failed */
  error?: string

  /** Analysis output data */
  data: T

  /** Confidence in the analysis results */
  confidence: number

  /** Processing time in milliseconds */
  processingTime: number

  /** Provider used for analysis */
  provider: AIProvider

  /** Model used for analysis */
  model: string

  /** Token usage statistics */
  tokenUsage?: {
    prompt: number
    completion: number
    total: number
  }

  /** When the analysis was performed */
  timestamp: Date
}

/**
 * Input context for AI analysis.
 */
export interface AIAnalysisContext {
  /** Tasks to analyze */
  tasks?: Task[]

  /** Groups to analyze */
  groups?: CanvasGroup[]

  /** User preferences and settings */
  userContext?: {
    preferredWorkingHours?: { start: string; end: string }
    averageTaskDuration?: number
    completionPatterns?: Record<string, number>
  }

  /** Additional context string */
  additionalContext?: string
}

// ============================================================================
// AI Execution State Types
// ============================================================================

/**
 * Current state of an AI operation.
 */
export type AIOperationStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * State tracking for AI execution.
 */
export interface AIExecutionState {
  /** Current operation status */
  status: AIOperationStatus

  /** Current operation ID (if running) */
  currentOperationId: string | null

  /** Progress percentage (0-100) for long operations */
  progress: number

  /** Current step description */
  currentStep: string

  /** Error message if failed */
  error: string | null

  /** Error code for programmatic handling */
  errorCode?: string

  /** Streaming text output (for streaming responses) */
  streamingOutput: string

  /** Whether the operation can be cancelled */
  cancellable: boolean

  /** Start time of current operation */
  startTime: Date | null

  /** Estimated completion time */
  estimatedCompletion: Date | null

  /** Retry count for failed operations */
  retryCount: number

  /** Maximum retries allowed */
  maxRetries: number
}

/**
 * Default execution state.
 */
export const DEFAULT_EXECUTION_STATE: AIExecutionState = {
  status: 'idle',
  currentOperationId: null,
  progress: 0,
  currentStep: '',
  error: null,
  streamingOutput: '',
  cancellable: true,
  startTime: null,
  estimatedCompletion: null,
  retryCount: 0,
  maxRetries: 3
}

// ============================================================================
// AI Settings Types
// ============================================================================

/**
 * Feature flags for AI capabilities.
 */
export interface AIFeatureFlags {
  /** Enable task categorization suggestions */
  enableCategorization: boolean

  /** Enable task breakdown suggestions */
  enableTaskBreakdown: boolean

  /** Enable canvas cleanup suggestions */
  enableCanvasCleanup: boolean

  /** Enable priority suggestions */
  enablePrioritySuggestions: boolean

  /** Enable deadline warnings */
  enableDeadlineWarnings: boolean

  /** Enable automatic suggestions (vs. manual only) */
  enableAutoSuggestions: boolean

  /** Enable streaming responses */
  enableStreaming: boolean
}

/**
 * User settings for AI features.
 */
export interface AISettings {
  /** Active provider for AI operations */
  activeProvider: AIProvider

  /** Provider-specific configurations */
  providers: Record<AIProvider, AIProviderConfig>

  /** Feature flags */
  features: AIFeatureFlags

  /** Minimum confidence threshold to show suggestions (0-1) */
  confidenceThreshold: number

  /** Maximum suggestions to show at once */
  maxSuggestions: number

  /** Auto-dismiss suggestions after this many hours (0 = never) */
  suggestionExpiryHours: number

  /** Show AI reasoning in suggestions */
  showReasoning: boolean

  /** Enable usage analytics (anonymized) */
  enableAnalytics: boolean

  /** Privacy mode - don't send task content to cloud providers */
  privacyMode: boolean

  /** Cache AI responses for performance */
  enableCache: boolean

  /** Cache TTL in minutes */
  cacheTTL: number
}

/**
 * Default AI settings.
 */
export const DEFAULT_AI_SETTINGS: AISettings = {
  activeProvider: AIProvider.OLLAMA,
  providers: {
    [AIProvider.OLLAMA]: { ...DEFAULT_PROVIDER_CONFIGS[AIProvider.OLLAMA] },
    [AIProvider.ANTHROPIC]: { ...DEFAULT_PROVIDER_CONFIGS[AIProvider.ANTHROPIC] },
    [AIProvider.OPENAI]: { ...DEFAULT_PROVIDER_CONFIGS[AIProvider.OPENAI] },
    [AIProvider.GEMINI]: { ...DEFAULT_PROVIDER_CONFIGS[AIProvider.GEMINI] }
  },
  features: {
    enableCategorization: true,
    enableTaskBreakdown: true,
    enableCanvasCleanup: true,
    enablePrioritySuggestions: true,
    enableDeadlineWarnings: true,
    enableAutoSuggestions: false,
    enableStreaming: true
  },
  confidenceThreshold: 0.7,
  maxSuggestions: 5,
  suggestionExpiryHours: 24,
  showReasoning: true,
  enableAnalytics: false,
  privacyMode: true,
  enableCache: true,
  cacheTTL: 60
}

// ============================================================================
// AI Store State Types
// ============================================================================

/**
 * Complete state for the AI store.
 */
export interface AIState {
  /** AI settings */
  settings: AISettings

  /** Connection status per provider */
  connectionStatus: Record<AIProvider, AIConnectionStatus>

  /** Current execution state */
  execution: AIExecutionState

  /** Active suggestions */
  suggestions: AISuggestion[]

  /** Suggestion history (for analytics) */
  suggestionHistory: Array<{
    suggestionId: string
    type: AISuggestionType
    action: 'applied' | 'dismissed' | 'expired'
    timestamp: Date
  }>

  /** Recent analysis results */
  recentAnalyses: AIAnalysisResult[]

  /** Whether the AI system is initialized */
  initialized: boolean

  /** Last error encountered */
  lastError: string | null
}

/**
 * Default AI state.
 */
export const DEFAULT_AI_STATE: AIState = {
  settings: DEFAULT_AI_SETTINGS,
  connectionStatus: {
    [AIProvider.OLLAMA]: 'disconnected',
    [AIProvider.ANTHROPIC]: 'disconnected',
    [AIProvider.OPENAI]: 'disconnected',
    [AIProvider.GEMINI]: 'disconnected'
  },
  execution: DEFAULT_EXECUTION_STATE,
  suggestions: [],
  suggestionHistory: [],
  recentAnalyses: [],
  initialized: false,
  lastError: null
}

// ============================================================================
// Type Guards and Utilities
// ============================================================================

/**
 * Check if a value is a valid AIProvider.
 */
export function isAIProvider(value: unknown): value is AIProvider {
  return Object.values(AIProvider).includes(value as AIProvider)
}

/**
 * Check if a value is a valid AISuggestionType.
 */
export function isAISuggestionType(value: unknown): value is AISuggestionType {
  const validTypes: AISuggestionType[] = [
    'group_categorization',
    'task_breakdown',
    'canvas_cleanup',
    'priority_adjustment',
    'deadline_warning',
    'workload_balance',
    'duplicate_detection',
    'dependency_inference'
  ]
  return validTypes.includes(value as AISuggestionType)
}

/**
 * Get confidence level from a numeric score.
 */
export function getConfidenceLevel(score: number): AIConfidenceLevel {
  if (score >= 0.8) return 'high'
  if (score >= 0.5) return 'medium'
  return 'low'
}

/**
 * Check if a suggestion is still valid (not expired).
 */
export function isSuggestionValid(suggestion: AISuggestion): boolean {
  if (suggestion.dismissed || suggestion.applied) return false
  if (suggestion.expiresAt && new Date() > suggestion.expiresAt) return false
  return true
}

/**
 * Type guard for GroupCategorizationSuggestion.
 */
export function isGroupCategorizationSuggestion(
  suggestion: AISuggestion
): suggestion is GroupCategorizationSuggestion {
  return suggestion.type === 'group_categorization'
}

/**
 * Type guard for TaskBreakdownSuggestion.
 */
export function isTaskBreakdownSuggestion(
  suggestion: AISuggestion
): suggestion is TaskBreakdownSuggestion {
  return suggestion.type === 'task_breakdown'
}

/**
 * Type guard for CanvasCleanupSuggestion.
 */
export function isCanvasCleanupSuggestion(
  suggestion: AISuggestion
): suggestion is CanvasCleanupSuggestion {
  return suggestion.type === 'canvas_cleanup'
}
