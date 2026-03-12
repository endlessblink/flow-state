/**
 * AI Pipeline Guardrail Registration
 *
 * Wires the implemented guardrails into the pipeline orchestrator via
 * configurePipeline(). Call setupAIPipeline() once at module load time
 * (e.g. from useAIChat.ts). The function is idempotent — repeated calls
 * are no-ops.
 *
 * Pre-guardrails run before the LLM call, post-guardrails run after.
 *
 * Note on intentClassifier / reasoningDirective as pre-guardrails:
 *   routeIntentByKeywords() requires (tasks, entityMemory) which are
 *   per-request runtime values, not available in a stateless PreGuardrail.
 *   Those functions are called directly in useAIChat.ts with the correct
 *   context, so they are intentionally NOT registered here.
 *
 * @see TASK-1375 in MASTER_PLAN.md
 */

import { configurePipeline, getPipelineConfig } from './index'
import { detectLanguage, containsHebrew } from './languageDetector'
import { responseValidatorGuardrail } from './responseValidator'
import { languageEnforcerGuardrail } from './languageEnforcer'
import { lengthEnforcerGuardrail } from './lengthEnforcer'
import type { PreGuardrail } from './types'

// ---------------------------------------------------------------------------
// Pre-guardrails
// ---------------------------------------------------------------------------

/**
 * Enrich the PreProcessResult with language detection metadata.
 *
 * Overwrites detectedLanguage and meta.hasHebrewInput based on the
 * original user input so that downstream guardrails and the LLM prompt
 * builder work from a single, consistent source of truth.
 */
const languageDetectorGuardrail: PreGuardrail = (input) => {
  const detected = detectLanguage(input.meta.originalInput)
  return {
    ...input,
    detectedLanguage: detected,
    meta: {
      ...input.meta,
      hasHebrewInput: containsHebrew(input.meta.originalInput),
    },
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let _configured = false

/**
 * Register all available guardrails into the pipeline.
 *
 * Idempotent: safe to call multiple times; only the first call has effect.
 */
export function setupAIPipeline(): void {
  if (_configured) return

  configurePipeline({
    preGuardrails: [
      languageDetectorGuardrail,
    ],
    postGuardrails: [
      languageEnforcerGuardrail,
      lengthEnforcerGuardrail,
      responseValidatorGuardrail,
    ],
  })

  _configured = true

  const config = getPipelineConfig()
  console.log('[Pipeline] Guardrails configured:', {
    pre: config.preGuardrails.length,
    post: config.postGuardrails.length,
  })
}
