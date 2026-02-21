/**
 * AI Chat Pipeline Types
 *
 * Pre/post-processing pipeline between user input and LLM output.
 * Ensures language, quality, and formatting are enforced deterministically.
 *
 * @see TASK-1375 in MASTER_PLAN.md
 */

/** Detected language of text */
export type DetectedLanguage = 'en' | 'he' | 'unknown'

/** User intent classification */
export type UserIntent = 'chat' | 'query' | 'action' | 'greeting'

/** Result of pre-processing user input before LLM call */
export interface PreProcessResult {
  /** Detected language of user input */
  detectedLanguage: DetectedLanguage
  /** Classified intent */
  intent: UserIntent
  /** Optimized task context string for system prompt */
  optimizedContext: string
  /** Task statistics line (unchanged from current) */
  taskStats: string
  /** Metadata carried through to post-processing */
  meta: {
    inputCharCount: number
    hasHebrewInput: boolean
    isQuestion: boolean
    originalInput: string
  }
}

/** Input to post-processing pipeline */
export interface PostProcessInput {
  /** Raw LLM response text */
  rawResponse: string
  /** Pre-processing results for context */
  preProcess: PreProcessResult
  /** Tool results from ReAct loop (if any) */
  hadToolCalls: boolean
}

/** Result of post-processing LLM response */
export interface PostProcessResult {
  /** Cleaned response text */
  cleanedResponse: string
  /** Warnings logged (not shown to user) */
  warnings: string[]
  /** Whether language was corrected */
  languageMismatch: boolean
  /** Whether response was truncated */
  wasTruncated: boolean
}

/** A single guardrail function in the pipeline */
export type PreGuardrail = (input: PreProcessResult) => PreProcessResult
export type PostGuardrail = (input: PostProcessInput) => PostProcessInput

/** Pipeline configuration */
export interface PipelineConfig {
  preGuardrails: PreGuardrail[]
  postGuardrails: PostGuardrail[]
  /** Skip all guardrails (useful for testing/debugging) */
  bypass?: boolean
}
