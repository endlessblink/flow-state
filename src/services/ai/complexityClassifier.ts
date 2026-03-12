/**
 * Complexity Classifier (TASK-1500)
 *
 * Heuristic-based complexity scorer for AI queries.
 * Pure string analysis — no LLM calls, no side effects.
 *
 * Routes simple queries to free models (Groq) and complex queries
 * to premium models (OpenRouter) when smart routing is enabled.
 */

export type ComplexityTier = 'simple' | 'standard' | 'complex'

export interface ComplexityResult {
  tier: ComplexityTier
  score: number // 0-100
  reasons: string[]
}

/**
 * Classify the complexity of a user message.
 *
 * Scoring:
 * - 0-30: simple (greeting, very short, trivial query)
 * - 31-60: standard (moderate length, factual question)
 * - 61-100: complex (planning, analysis, multi-entity, reasoning)
 */
export function classifyComplexity(message: string): ComplexityResult {
  let score = 30 // baseline = standard
  const reasons: string[] = []

  const lower = message.toLowerCase().trim()
  const wordCount = lower.split(/\s+/).length

  // Simple indicators (reduce score)
  const greetings = /^(hi|hey|hello|yo|sup|thanks|thank you|ok|okay|bye|good morning|good night|שלום|היי|תודה)\b/i
  if (greetings.test(lower)) {
    score -= 25
    reasons.push('greeting')
  }
  if (wordCount <= 3) {
    score -= 15
    reasons.push('very short')
  }

  // Standard indicators
  if (wordCount > 10 && wordCount <= 30) {
    score += 5
    reasons.push('moderate length')
  }

  // Complex indicators (increase score)
  const planningVerbs = /\b(plan|analyze|prioritize|break down|organize|restructure|evaluate|compare|strategy|optimize|refactor)\b/i
  if (planningVerbs.test(lower)) {
    score += 25
    reasons.push('planning/analysis verb')
  }

  const whyQuestions = /\b(why|how should|what if|trade-?off|pros? and cons?|which is better)\b/i
  if (whyQuestions.test(lower)) {
    score += 20
    reasons.push('reasoning question')
  }

  if (wordCount > 50) {
    score += 15
    reasons.push('long query')
  }

  // Multi-entity references (mentions multiple tasks, projects, etc.)
  const entityRefs = (lower.match(/\b(task|project|group|all|every|each|week|month|schedule)\b/gi) || []).length
  if (entityRefs >= 3) {
    score += 15
    reasons.push('multi-entity')
  }

  // Time scope references
  const timeScope = /\b(this week|next week|today|tomorrow|this month|deadline|overdue|upcoming)\b/i
  if (timeScope.test(lower)) {
    score += 10
    reasons.push('time scope')
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score))

  const tier: ComplexityTier = score <= 30 ? 'simple' : score <= 60 ? 'standard' : 'complex'

  return { tier, score, reasons }
}
