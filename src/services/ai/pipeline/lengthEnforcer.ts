/**
 * Response Length Enforcer for AI Chat Pipeline
 *
 * Post-processing guardrail that enforces response length limits
 * based on the user's intent classification.
 *
 * - Greetings: max 200 chars (no one needs a paragraph for "hi")
 * - Tool result summaries: max 500 chars (the tool cards are the real content)
 * - Analytical responses: warn on >2000 chars without structure
 *
 * @see TASK-1380 in MASTER_PLAN.md
 */

import type { PostGuardrail, PostProcessInput } from './types'

/** Length limits by intent type */
const LIMITS: Record<string, number> = {
  greeting: 200,
  query: 2000,
  action: 500,
  chat: 2000,
}

/**
 * Post-processing guardrail that enforces response length.
 * Truncates verbose responses with a clean cut-off message.
 */
export const lengthEnforcerGuardrail: PostGuardrail = (input: PostProcessInput): PostProcessInput => {
  const intent = input.preProcess.intent
  const limit = LIMITS[intent] ?? 2000
  const response = input.rawResponse

  // For tool result summaries, use tighter limit
  const effectiveLimit = input.hadToolCalls ? Math.min(limit, 500) : limit

  if (response.length <= effectiveLimit) return input

  // Don't truncate if response has structure (bullet points, headers)
  const hasStructure = /^[-*•]|\n[-*•]|^#{1,3}\s/m.test(response)
  if (hasStructure && response.length < effectiveLimit * 2) return input

  // Truncate at the last sentence boundary before the limit
  const truncateAt = response.lastIndexOf('.', effectiveLimit)
  const cutPoint = truncateAt > effectiveLimit * 0.5 ? truncateAt + 1 : effectiveLimit

  console.warn(
    `[Pipeline:LengthEnforcer] Response truncated: ${response.length} → ${cutPoint} chars (intent: ${intent})`
  )

  return {
    ...input,
    rawResponse: response.slice(0, cutPoint).trim(),
  }
}
