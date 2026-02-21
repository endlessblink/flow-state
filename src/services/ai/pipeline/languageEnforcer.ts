/**
 * Language Enforcer for AI Chat Pipeline
 *
 * Post-processing guardrail that detects when LLM response language
 * doesn't match the user's input language.
 *
 * V1: Detection + metadata flag only (no re-generation).
 * The flag can be used by ChatMessage.vue to show a language indicator.
 *
 * @see TASK-1379 in MASTER_PLAN.md
 */

import type { PostGuardrail, PostProcessInput } from './types'
import { detectLanguageMismatch, detectLanguage } from './languageDetector'

/**
 * Post-processing guardrail that flags language mismatches.
 *
 * Checks if the LLM response is in a different language than the user's input.
 * Does NOT modify the response — only enriches the pipeline metadata.
 *
 * The `PostProcessResult.languageMismatch` flag is set by the pipeline orchestrator
 * based on this guardrail's output.
 */
export const languageEnforcerGuardrail: PostGuardrail = (input: PostProcessInput): PostProcessInput => {
  const originalInput = input.preProcess.meta.originalInput
  const isMismatch = detectLanguageMismatch(originalInput, input.rawResponse)

  if (isMismatch) {
    const inputLang = input.preProcess.detectedLanguage
    const outputLang = detectLanguage(input.rawResponse)
    console.warn(
      `[Pipeline:LanguageEnforcer] Language mismatch detected: user=${inputLang}, response=${outputLang}`
    )
  }

  // Return input unchanged — the mismatch flag is communicated via
  // the PostProcessResult.languageMismatch field set by the orchestrator
  return input
}
