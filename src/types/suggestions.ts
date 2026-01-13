/**
 * SmartSuggestion System Types
 *
 * AI-Ready infrastructure for intelligent suggestions.
 * Currently uses rule-based detection, designed for future AI integration (ROAD-011).
 *
 * @see TASK-266 in MASTER_PLAN.md
 */

/**
 * Types of suggestions the system can generate.
 * Extensible for future AI-powered suggestions.
 */
export type SuggestionType =
  | 'day_group_transition'  // Day-group date matches today
  | 'task_priority'         // Future: AI suggests priority changes
  | 'deadline_warning'      // Future: AI warns about approaching deadlines
  | 'workload_balance'      // Future: AI suggests task redistribution

/**
 * Source of the suggestion - rule-based or AI-powered.
 */
export type SuggestionSource = 'rule' | 'ai'

/**
 * An action the user can take on a suggestion.
 */
export interface SuggestionAction {
  id: string
  label: string
  icon?: string
  primary?: boolean
  destructive?: boolean
  handler: () => Promise<void> | void
}

/**
 * Metadata specific to day-group transition suggestions.
 */
export interface DayGroupTransitionMetadata {
  sourceGroupId: string
  sourceGroupName: string
  targetGroupId?: string  // May not exist yet
  targetGroupName: string
  taskIds: string[]
  taskCount: number
  dayName: string  // e.g., "Friday"
}

/**
 * Generic metadata for other suggestion types (future).
 */
export interface GenericSuggestionMetadata {
  [key: string]: unknown
}

/**
 * Union type for all suggestion metadata types.
 */
export type SuggestionMetadata =
  | DayGroupTransitionMetadata
  | GenericSuggestionMetadata

/**
 * Core SmartSuggestion interface.
 * Designed to be AI-ready with confidence scores and reasoning.
 */
export interface SmartSuggestion<T extends SuggestionMetadata = SuggestionMetadata> {
  /** Unique identifier for this suggestion */
  id: string

  /** Type of suggestion for routing and display */
  type: SuggestionType

  /** Display title */
  title: string

  /** Detailed description */
  description: string

  /** Available actions for the user */
  actions: SuggestionAction[]

  /** Whether this is rule-based or AI-generated */
  source: SuggestionSource

  /**
   * Confidence score (0-1) for AI suggestions.
   * Rule-based suggestions always have confidence 1.0.
   */
  confidence: number

  /**
   * AI-generated explanation for why this suggestion was made.
   * Only present for AI suggestions.
   */
  reasoning?: string

  /** Type-specific metadata */
  metadata: T

  /** When this suggestion was created */
  createdAt: Date

  /** Whether the user has dismissed this suggestion */
  dismissed: boolean

  /** Priority for display ordering (higher = more important) */
  priority: number
}

/**
 * Specialized type for day-group transition suggestions.
 */
export type DayGroupTransitionSuggestion = SmartSuggestion<DayGroupTransitionMetadata>

/**
 * Settings related to suggestions.
 */
export interface SuggestionSettings {
  /** Enable day-group transition suggestions */
  enableDayGroupSuggestions: boolean

  /** Minimum confidence threshold for AI suggestions (future) */
  aiConfidenceThreshold: number

  /** Show reasoning for AI suggestions (future) */
  showAiReasoning: boolean
}

/**
 * Default suggestion settings.
 */
export const DEFAULT_SUGGESTION_SETTINGS: SuggestionSettings = {
  enableDayGroupSuggestions: true,
  aiConfidenceThreshold: 0.7,
  showAiReasoning: true
}

/**
 * State for the suggestions store/composable.
 */
export interface SuggestionState {
  /** Currently active suggestions */
  suggestions: SmartSuggestion[]

  /** IDs of suggestions dismissed in this session */
  sessionDismissed: Set<string>

  /** Suggestion settings */
  settings: SuggestionSettings

  /** Whether the suggestion system is initialized */
  initialized: boolean
}
