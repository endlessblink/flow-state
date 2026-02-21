/**
 * AI Chat Pipeline Orchestrator
 *
 * Runs pre-processing guardrails on user input before LLM call,
 * and post-processing guardrails on LLM output before rendering.
 *
 * Each guardrail is a pure function that transforms the pipeline data.
 * They compose via simple function chaining.
 *
 * @see TASK-1375 in MASTER_PLAN.md
 */

import type {
  PreProcessResult,
  PostProcessInput,
  PostProcessResult,
  PipelineConfig,
  PreGuardrail,
  PostGuardrail,
} from './types'

// Re-export types for convenience
export type { PreProcessResult, PostProcessInput, PostProcessResult, PipelineConfig } from './types'
export type { DetectedLanguage, UserIntent, PreGuardrail, PostGuardrail } from './types'

/** Default pipeline config — populated as guardrails are implemented */
let activePipeline: PipelineConfig = {
  preGuardrails: [],
  postGuardrails: [],
  bypass: false,
}

/**
 * Configure the active pipeline.
 * Called once at app startup to register guardrails.
 */
export function configurePipeline(config: Partial<PipelineConfig>): void {
  activePipeline = { ...activePipeline, ...config }
}

/**
 * Run all pre-processing guardrails on user input.
 * Returns enriched PreProcessResult for use in system prompt building and post-processing.
 */
export function runPreProcess(input: PreProcessResult): PreProcessResult {
  if (activePipeline.bypass) return input

  let result = input
  for (const guardrail of activePipeline.preGuardrails) {
    try {
      result = guardrail(result)
    } catch (err) {
      console.warn('[Pipeline] Pre-processing guardrail failed:', err)
      // Continue with previous result — guardrails should not break the pipeline
    }
  }
  return result
}

/**
 * Run all post-processing guardrails on LLM output.
 * Returns cleaned PostProcessResult ready for rendering.
 */
export function runPostProcess(input: PostProcessInput): PostProcessResult {
  if (activePipeline.bypass) {
    return {
      cleanedResponse: input.rawResponse,
      warnings: [],
      languageMismatch: false,
      wasTruncated: false,
    }
  }

  let processed = input
  const warnings: string[] = []

  for (const guardrail of activePipeline.postGuardrails) {
    try {
      processed = guardrail(processed)
    } catch (err) {
      console.warn('[Pipeline] Post-processing guardrail failed:', err)
      warnings.push(`Guardrail error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  return {
    cleanedResponse: processed.rawResponse,
    warnings,
    languageMismatch: false, // Will be set by language enforcer guardrail
    wasTruncated: false, // Will be set by length enforcer guardrail
  }
}

/**
 * Get the current pipeline config (for testing/inspection).
 */
export function getPipelineConfig(): Readonly<PipelineConfig> {
  return activePipeline
}
